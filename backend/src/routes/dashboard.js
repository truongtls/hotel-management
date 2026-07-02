const express = require('express');
const { pool } = require('../db');
const { authRequired } = require('../middleware/auth');

const router = express.Router();
router.use(authRequired);

router.get('/stats', async (req, res) => {
  try {
    const totalRooms = await pool.query('SELECT COUNT(*)::int AS count FROM rooms');
    const roomsByStatus = await pool.query(
      `SELECT status, COUNT(*)::int AS count FROM rooms GROUP BY status`
    );
    const activeBookings = await pool.query(
      `SELECT COUNT(*)::int AS count FROM bookings WHERE status IN ('dat_truoc','da_nhan_phong')`
    );
    const todayCheckins = await pool.query(
      `SELECT COUNT(*)::int AS count FROM bookings WHERE check_in_date = CURRENT_DATE AND status='dat_truoc'`
    );
    const todayCheckouts = await pool.query(
      `SELECT COUNT(*)::int AS count FROM bookings WHERE check_out_date = CURRENT_DATE AND status='da_nhan_phong'`
    );
    const revenueThisMonth = await pool.query(
      `SELECT COALESCE(SUM(amount),0)::numeric AS total FROM payments
       WHERE date_trunc('month', payment_date) = date_trunc('month', CURRENT_DATE)`
    );
    const revenueByDay = await pool.query(
      `SELECT to_char(payment_date, 'YYYY-MM-DD') AS day, SUM(amount)::numeric AS total
       FROM payments
       WHERE payment_date >= CURRENT_DATE - INTERVAL '13 days'
       GROUP BY day ORDER BY day`
    );

    const statusMap = {};
    roomsByStatus.rows.forEach((r) => (statusMap[r.status] = r.count));

    res.json({
      total_rooms: totalRooms.rows[0].count,
      rooms_by_status: {
        trong: statusMap.trong || 0,
        dat_truoc: statusMap.dat_truoc || 0,
        dang_su_dung: statusMap.dang_su_dung || 0,
        bao_tri: statusMap.bao_tri || 0,
      },
      active_bookings: activeBookings.rows[0].count,
      today_checkins: todayCheckins.rows[0].count,
      today_checkouts: todayCheckouts.rows[0].count,
      revenue_this_month: Number(revenueThisMonth.rows[0].total),
      revenue_by_day: revenueByDay.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi máy chủ khi lấy thống kê.' });
  }
});

module.exports = router;
