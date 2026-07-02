const express = require('express');
const { pool } = require('../db');
const { authRequired } = require('../middleware/auth');

const router = express.Router();
router.use(authRequired);

router.get('/', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM room_types ORDER BY id');
  res.json(rows);
});

router.post('/', async (req, res) => {
  const { name, description, base_price, max_guests } = req.body;
  if (!name || base_price === undefined) {
    return res.status(400).json({ error: 'Thiếu tên loại phòng hoặc giá.' });
  }
  const { rows } = await pool.query(
    `INSERT INTO room_types (name, description, base_price, max_guests) VALUES ($1,$2,$3,$4) RETURNING *`,
    [name, description || null, base_price, max_guests || 2]
  );
  res.status(201).json(rows[0]);
});

router.put('/:id', async (req, res) => {
  const { name, description, base_price, max_guests } = req.body;
  const { rows } = await pool.query(
    `UPDATE room_types SET name=$1, description=$2, base_price=$3, max_guests=$4 WHERE id=$5 RETURNING *`,
    [name, description || null, base_price, max_guests || 2, req.params.id]
  );
  if (rows.length === 0) return res.status(404).json({ error: 'Không tìm thấy loại phòng.' });
  res.json(rows[0]);
});

router.delete('/:id', async (req, res) => {
  await pool.query('DELETE FROM room_types WHERE id=$1', [req.params.id]);
  res.status(204).send();
});

module.exports = router;
