-- ==========================================================
-- CƠ SỞ DỮ LIỆU HỆ THỐNG QUẢN LÝ KHÁCH SẠN
-- ==========================================================

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(150),
    role VARCHAR(20) NOT NULL DEFAULT 'staff', -- admin | staff
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS room_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    base_price NUMERIC(12,2) NOT NULL DEFAULT 0,
    max_guests INT NOT NULL DEFAULT 2
);

CREATE TABLE IF NOT EXISTS rooms (
    id SERIAL PRIMARY KEY,
    room_number VARCHAR(20) UNIQUE NOT NULL,
    room_type_id INT REFERENCES room_types(id) ON DELETE SET NULL,
    floor INT,
    status VARCHAR(20) NOT NULL DEFAULT 'trong', -- trong | dat_truoc | dang_su_dung | bao_tri
    notes TEXT
);

CREATE TABLE IF NOT EXISTS customers (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(150) NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(150),
    id_card VARCHAR(30),
    address TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bookings (
    id SERIAL PRIMARY KEY,
    booking_code VARCHAR(20) UNIQUE NOT NULL,
    customer_id INT REFERENCES customers(id) ON DELETE CASCADE,
    room_id INT REFERENCES rooms(id) ON DELETE SET NULL,
    check_in_date DATE NOT NULL,
    check_out_date DATE NOT NULL,
    actual_check_in TIMESTAMP,
    actual_check_out TIMESTAMP,
    status VARCHAR(20) NOT NULL DEFAULT 'dat_truoc', -- dat_truoc | da_nhan_phong | da_tra_phong | da_huy
    total_amount NUMERIC(12,2) DEFAULT 0,
    deposit NUMERIC(12,2) DEFAULT 0,
    notes TEXT,
    created_by INT REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    booking_id INT REFERENCES bookings(id) ON DELETE CASCADE,
    amount NUMERIC(12,2) NOT NULL,
    payment_method VARCHAR(30) DEFAULT 'tien_mat', -- tien_mat | chuyen_khoan | the
    payment_date TIMESTAMP DEFAULT NOW(),
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_bookings_room ON bookings(room_id);
CREATE INDEX IF NOT EXISTS idx_bookings_dates ON bookings(check_in_date, check_out_date);
CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms(status);

-- ==========================================================
-- DỮ LIỆU MẪU
-- ==========================================================

INSERT INTO room_types (name, description, base_price, max_guests) VALUES
('Phòng Standard', 'Phòng tiêu chuẩn, 1 giường đôi', 500000, 2),
('Phòng Deluxe', 'Phòng cao cấp, view đẹp', 800000, 2),
('Phòng Suite', 'Phòng hạng sang, có phòng khách riêng', 1500000, 4),
('Phòng Gia đình', 'Phòng rộng cho gia đình, 2 giường đôi', 1200000, 4)
ON CONFLICT DO NOTHING;

INSERT INTO rooms (room_number, room_type_id, floor, status) VALUES
('101', 1, 1, 'trong'),
('102', 1, 1, 'trong'),
('103', 1, 1, 'bao_tri'),
('201', 2, 2, 'trong'),
('202', 2, 2, 'trong'),
('203', 2, 2, 'trong'),
('301', 3, 3, 'trong'),
('302', 3, 3, 'trong'),
('401', 4, 4, 'trong'),
('402', 4, 4, 'trong')
ON CONFLICT DO NOTHING;

-- Ghi chú: tài khoản admin mặc định (username/password lấy từ biến môi trường
-- ADMIN_USERNAME/ADMIN_PASSWORD) sẽ được tạo tự động bởi backend khi khởi động
-- lần đầu tiên (xem backend/src/db.js), không tạo cứng ở đây để tránh lệch hash.
