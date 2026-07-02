require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { waitForDb, ensureAdminUser } = require('./db');

const authRoutes = require('./routes/auth');
const roomRoutes = require('./routes/rooms');
const roomTypeRoutes = require('./routes/roomTypes');
const customerRoutes = require('./routes/customers');
const bookingRoutes = require('./routes/bookings');
const dashboardRoutes = require('./routes/dashboard');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/room-types', roomTypeRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/dashboard', dashboardRoutes);

app.use((req, res) => res.status(404).json({ error: 'Không tìm thấy endpoint.' }));

const PORT = process.env.PORT || 4000;

async function start() {
  await waitForDb();
  await ensureAdminUser();
  app.listen(PORT, () => {
    console.log(`Backend đang chạy tại cổng ${PORT}`);
  });
}

start().catch((err) => {
  console.error('Không thể khởi động server:', err);
  process.exit(1);
});
