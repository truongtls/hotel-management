const express = require('express');
const { pool } = require('../db');
const { authRequired } = require('../middleware/auth');

const router = express.Router();
router.use(authRequired);

function genBookingCode() {
  const ts = Date.now().toString(36).toUpperCase();
  return `BK-${ts}`;
}

// Lấy danh sách đặt phòng (kèm tên khách + số phòng)
router.get('/', async (req, res) => {
  const { status } = req.query;
  let query = `
    SELECT b.*, c.full_name AS customer_name, c.phone AS customer_phone,
           r.room_number, rt.name AS room_type_name
    FROM bookings b
    JOIN customers c ON c.id = b.customer_id
    LEFT JOIN rooms r ON r.id = b.room_id
    LEFT JOIN room_types rt ON rt.id = r.room_type_id
  `;
  const params = [];
  if (status) {
    params.push(status);
    query += ' WHERE b.status = $1';
  }
  query += ' ORDER BY b.created_at DESC';
  const { rows } = await pool.query(query, params);
  res.json(rows);
});

router.get('/:id', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT b.*, c.full_name AS customer_name, c.phone AS customer_phone,
            r.room_number, rt.name AS room_type_name
     FROM bookings b
     JOIN customers c ON c.id = b.customer_id
     LEFT JOIN rooms r ON r.id = b.room_id
     LEFT JOIN room_types rt ON rt.id = r.room_type_id
     WHERE b.id = $1`,
    [req.params.id]
  );
  if (rows.length === 0) return res.status(404).json({ error: 'Không tìm thấy đặt phòng.' });
  const payments = await pool.query('SELECT * FROM payments WHERE booking_id=$1 ORDER BY payment_date', [req.params.id]);
  res.json({ ...rows[0], payments: payments.rows });
});

// Tạo đặt phòng mới - kiểm tra phòng còn trống trong khoảng ngày, sau đó đánh dấu phòng đã đặt
router.post('/', async (req, res) => {
  const { customer_id, room_id, check_in_date, check_out_date, deposit, notes } = req.body;
  if (!customer_id || !room_id || !check_in_date || !check_out_date) {
    return res.status(400).json({ error: 'Thiếu thông tin bắt buộc (khách hàng, phòng, ngày nhận/trả).' });
  }
  if (new Date(check_out_date) <= new Date(check_in_date)) {
    return res.status(400).json({ error: 'Ngày trả phòng phải sau ngày nhận phòng.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Kiểm tra trùng lịch đặt phòng
    const conflict = await client.query(
      `SELECT id FROM bookings
       WHERE room_id = $1 AND status IN ('dat_truoc','da_nhan_phong')
       AND daterange(check_in_date, check_out_date) && daterange($2::date, $3::date)`,
      [room_id, check_in_date, check_out_date]
    );
    if (conflict.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Phòng đã có người đặt trong khoảng thời gian này.' });
    }

    const roomRes = await client.query('SELECT * FROM rooms WHERE id=$1', [room_id]);
    if (roomRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Không tìm thấy phòng.' });
    }
    const room = roomRes.rows[0];

    const typeRes = await client.query('SELECT base_price FROM room_types WHERE id=$1', [room.room_type_id]);
    const basePrice = typeRes.rows[0] ? Number(typeRes.rows[0].base_price) : 0;
    const nights = Math.ceil((new Date(check_out_date) - new Date(check_in_date)) / (1000 * 60 * 60 * 24));
    const totalAmount = basePrice * nights;

    const code = genBookingCode();
    const bookingRes = await client.query(
      `INSERT INTO bookings
        (booking_code, customer_id, room_id, check_in_date, check_out_date, status, total_amount, deposit, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,'dat_truoc',$6,$7,$8,$9) RETURNING *`,
      [code, customer_id, room_id, check_in_date, check_out_date, totalAmount, deposit || 0, notes || null, req.user.id]
    );

    // Ghi chú: KHÔNG đổi trạng thái phòng thành 'dat_truoc' ở đây nữa.
    // Trạng thái phòng (rooms.status) chỉ phản ánh tình trạng THỰC TẾ ngay lúc
    // này (trống / đang sử dụng / bảo trì) - việc phòng đã có ai đặt trước hay
    // chưa được xác định bằng cách so ngày trong bảng bookings (xem route
    // GET /rooms/available). Nhờ vậy một phòng có thể được đặt trước cho
    // nhiều khoảng ngày khác nhau trong tương lai, miễn không trùng ngày.

    // Nếu có tiền đặt cọc, tự động ghi nhận luôn thành 1 khoản thanh toán đầu
    // tiên để nó được trừ vào tổng tiền phải thanh toán sau này.
    if (deposit && Number(deposit) > 0) {
      await client.query(
        `INSERT INTO payments (booking_id, amount, payment_method, notes) VALUES ($1,$2,'dat_coc',$3)`,
        [bookingRes.rows[0].id, deposit, 'Tiền đặt cọc lúc tạo đặt phòng']
      );
    }

    await client.query('COMMIT');
    res.status(201).json(bookingRes.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Lỗi máy chủ khi tạo đặt phòng.' });
  } finally {
    client.release();
  }
});

// Nhận phòng (check-in)
router.post('/:id/checkin', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const bRes = await client.query('SELECT * FROM bookings WHERE id=$1', [req.params.id]);
    if (bRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Không tìm thấy đặt phòng.' });
    }
    const booking = bRes.rows[0];
    if (booking.status !== 'dat_truoc') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Chỉ có thể nhận phòng khi đang ở trạng thái đặt trước.' });
    }
    const updated = await client.query(
      `UPDATE bookings SET status='da_nhan_phong', actual_check_in=NOW() WHERE id=$1 RETURNING *`,
      [req.params.id]
    );
    await client.query(`UPDATE rooms SET status='dang_su_dung' WHERE id=$1`, [booking.room_id]);
    await client.query('COMMIT');
    res.json(updated.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Lỗi máy chủ khi nhận phòng.' });
  } finally {
    client.release();
  }
});

// Trả phòng (check-out)
router.post('/:id/checkout', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const bRes = await client.query('SELECT * FROM bookings WHERE id=$1', [req.params.id]);
    if (bRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Không tìm thấy đặt phòng.' });
    }
    const booking = bRes.rows[0];
    if (booking.status !== 'da_nhan_phong') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Chỉ có thể trả phòng khi khách đang lưu trú.' });
    }
    const updated = await client.query(
      `UPDATE bookings SET status='da_tra_phong', actual_check_out=NOW() WHERE id=$1 RETURNING *`,
      [req.params.id]
    );
    await client.query(`UPDATE rooms SET status='trong' WHERE id=$1`, [booking.room_id]);
    await client.query('COMMIT');
    res.json(updated.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Lỗi máy chủ khi trả phòng.' });
  } finally {
    client.release();
  }
});

// Hủy đặt phòng
router.post('/:id/cancel', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const bRes = await client.query('SELECT * FROM bookings WHERE id=$1', [req.params.id]);
    if (bRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Không tìm thấy đặt phòng.' });
    }
    const booking = bRes.rows[0];
    if (!['dat_truoc', 'da_nhan_phong'].includes(booking.status)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Không thể hủy đặt phòng ở trạng thái hiện tại.' });
    }
    const updated = await client.query(`UPDATE bookings SET status='da_huy' WHERE id=$1 RETURNING *`, [req.params.id]);
    await client.query(`UPDATE rooms SET status='trong' WHERE id=$1`, [booking.room_id]);
    await client.query('COMMIT');
    res.json(updated.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Lỗi máy chủ khi hủy đặt phòng.' });
  } finally {
    client.release();
  }
});

// Ghi nhận thanh toán cho một đặt phòng
router.post('/:id/payments', async (req, res) => {
  const { amount, payment_method, notes } = req.body;
  if (!amount || amount <= 0) return res.status(400).json({ error: 'Số tiền thanh toán không hợp lệ.' });
  const { rows } = await pool.query(
    `INSERT INTO payments (booking_id, amount, payment_method, notes) VALUES ($1,$2,$3,$4) RETURNING *`,
    [req.params.id, amount, payment_method || 'tien_mat', notes || null]
  );
  res.status(201).json(rows[0]);
});

module.exports = router;
