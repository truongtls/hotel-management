const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'hotel_user',
  password: process.env.DB_PASSWORD || 'hotel_pass',
  database: process.env.DB_NAME || 'hotel_db',
});

// Chờ database sẵn sàng, retry vài lần vì container postgres có thể chưa init xong bảng
async function waitForDb(retries = 20, delayMs = 2000) {
  for (let i = 0; i < retries; i++) {
    try {
      await pool.query('SELECT 1');
      return true;
    } catch (err) {
      console.log(`Đang chờ kết nối database... (lần thử ${i + 1}/${retries})`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw new Error('Không thể kết nối tới database sau nhiều lần thử.');
}

// Tạo tài khoản admin mặc định nếu chưa có user nào trong hệ thống
async function ensureAdminUser() {
  const { rows } = await pool.query('SELECT COUNT(*)::int AS count FROM users');
  if (rows[0].count === 0) {
    const username = process.env.ADMIN_USERNAME || 'admin';
    const password = process.env.ADMIN_PASSWORD || 'admin123';
    const hash = await bcrypt.hash(password, 10);
    await pool.query(
      `INSERT INTO users (username, password_hash, full_name, role) VALUES ($1, $2, $3, 'admin')`,
      [username, hash, 'Quản trị viên']
    );
    console.log(`Đã tạo tài khoản admin mặc định: ${username} / ${password}`);
  }
}

module.exports = { pool, waitForDb, ensureAdminUser };
