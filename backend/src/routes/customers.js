const express = require('express');
const { pool } = require('../db');
const { authRequired } = require('../middleware/auth');

const router = express.Router();
router.use(authRequired);

router.get('/', async (req, res) => {
  const { search } = req.query;
  let query = 'SELECT * FROM customers';
  const params = [];
  if (search) {
    params.push(`%${search}%`);
    query += ` WHERE full_name ILIKE $1 OR phone ILIKE $1 OR email ILIKE $1`;
  }
  query += ' ORDER BY id DESC';
  const { rows } = await pool.query(query, params);
  res.json(rows);
});

router.get('/:id', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM customers WHERE id=$1', [req.params.id]);
  if (rows.length === 0) return res.status(404).json({ error: 'Không tìm thấy khách hàng.' });
  res.json(rows[0]);
});

router.post('/', async (req, res) => {
  const { full_name, phone, email, id_card, address } = req.body;
  if (!full_name) return res.status(400).json({ error: 'Thiếu họ tên khách hàng.' });
  const { rows } = await pool.query(
    `INSERT INTO customers (full_name, phone, email, id_card, address) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [full_name, phone || null, email || null, id_card || null, address || null]
  );
  res.status(201).json(rows[0]);
});

router.put('/:id', async (req, res) => {
  const { full_name, phone, email, id_card, address } = req.body;
  const { rows } = await pool.query(
    `UPDATE customers SET full_name=$1, phone=$2, email=$3, id_card=$4, address=$5 WHERE id=$6 RETURNING *`,
    [full_name, phone || null, email || null, id_card || null, address || null, req.params.id]
  );
  if (rows.length === 0) return res.status(404).json({ error: 'Không tìm thấy khách hàng.' });
  res.json(rows[0]);
});

router.delete('/:id', async (req, res) => {
  await pool.query('DELETE FROM customers WHERE id=$1', [req.params.id]);
  res.status(204).send();
});

module.exports = router;
