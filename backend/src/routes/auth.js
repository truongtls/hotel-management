const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../db');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Vui lòng nhập tên đăng nhập và mật khẩu.' });
    }
    const { rows } = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (rows.length === 0) {
      return res.status(401).json({ error: 'Sai tên đăng nhập hoặc mật khẩu.' });
    }
    const user = rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Sai tên đăng nhập hoặc mật khẩu.' });
    }
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, full_name: user.full_name },
      process.env.JWT_SECRET || 'please_change_this_secret_key',
      { expiresIn: '12h' }
    );
    res.json({ token, user: { id: user.id, username: user.username, role: user.role, full_name: user.full_name } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi máy chủ khi đăng nhập.' });
  }
});

router.get('/me', authRequired, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
