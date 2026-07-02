const express = require('express');
const { pool } = require('../db');
const { authRequired } = require('../middleware/auth');

const router = express.Router();
router.use(authRequired);

const VALID_STATUSES = ['trong', 'dat_truoc', 'dang_su_dung', 'bao_tri'];

router.get('/', async (req, res) => {
  const { status } = req.query;
  let query = `
    SELECT r.*, rt.name AS room_type_name, rt.base_price
    FROM rooms r
    LEFT JOIN room_types rt ON rt.id = r.room_type_id
  `;
  const params = [];
  if (status) {
    params.push(status);
    query += ` WHERE r.status = $1`;
  }
  query += ' ORDER BY r.room_number';
  const { rows } = await pool.query(query, params);
  res.json(rows);
});

// Trả về danh sách phòng còn trống trong khoảng ngày cụ thể (không tính phòng
// đang bảo trì, và loại trừ phòng đã có đặt chỗ khác bị trùng ngày).
// Đặt route này TRƯỚC '/:id' để "available" không bị hiểu nhầm là :id.
router.get('/available', async (req, res) => {
  const { check_in_date, check_out_date, exclude_booking_id } = req.query;
  if (!check_in_date || !check_out_date) {
    return res.status(400).json({ error: 'Thiếu ngày nhận phòng hoặc ngày trả phòng.' });
  }
  if (new Date(check_out_date) <= new Date(check_in_date)) {
    return res.status(400).json({ error: 'Ngày trả phòng phải sau ngày nhận phòng.' });
  }

  const params = [check_in_date, check_out_date];
  let excludeClause = '';
  if (exclude_booking_id) {
    params.push(exclude_booking_id);
    excludeClause = `AND b.id != $${params.length}`;
  }

  const { rows } = await pool.query(
    `SELECT r.*, rt.name AS room_type_name, rt.base_price
     FROM rooms r
     LEFT JOIN room_types rt ON rt.id = r.room_type_id
     WHERE r.status != 'bao_tri'
     AND r.id NOT IN (
       SELECT b.room_id FROM bookings b
       WHERE b.status IN ('dat_truoc','da_nhan_phong')
       AND daterange(b.check_in_date, b.check_out_date) && daterange($1::date, $2::date)
       ${excludeClause}
     )
     ORDER BY r.room_number`,
    params
  );
  res.json(rows);
});

router.get('/:id', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT r.*, rt.name AS room_type_name, rt.base_price
     FROM rooms r LEFT JOIN room_types rt ON rt.id = r.room_type_id
     WHERE r.id = $1`,
    [req.params.id]
  );
  if (rows.length === 0) return res.status(404).json({ error: 'Không tìm thấy phòng.' });
  res.json(rows[0]);
});

router.post('/', async (req, res) => {
  const { room_number, room_type_id, floor, status, notes } = req.body;
  if (!room_number) return res.status(400).json({ error: 'Thiếu số phòng.' });
  if (status && !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Trạng thái phòng không hợp lệ.' });
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO rooms (room_number, room_type_id, floor, status, notes) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [room_number, room_type_id || null, floor || null, status || 'trong', notes || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Số phòng đã tồn tại.' });
    console.error(err);
    res.status(500).json({ error: 'Lỗi máy chủ.' });
  }
});

router.put('/:id', async (req, res) => {
  const { room_number, room_type_id, floor, status, notes } = req.body;
  if (status && !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Trạng thái phòng không hợp lệ.' });
  }
  const { rows } = await pool.query(
    `UPDATE rooms SET room_number=$1, room_type_id=$2, floor=$3, status=$4, notes=$5 WHERE id=$6 RETURNING *`,
    [room_number, room_type_id || null, floor || null, status || 'trong', notes || null, req.params.id]
  );
  if (rows.length === 0) return res.status(404).json({ error: 'Không tìm thấy phòng.' });
  res.json(rows[0]);
});

router.delete('/:id', async (req, res) => {
  await pool.query('DELETE FROM rooms WHERE id=$1', [req.params.id]);
  res.status(204).send();
});

module.exports = router;
