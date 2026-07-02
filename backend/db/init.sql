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


-- ==========================================================
-- THÊM DỮ LIỆU MẪU: KHÁCH HÀNG, ĐẶT PHÒNG, THANH TOÁN
-- ==========================================================

-- 1. Thêm Khách hàng mẫu
INSERT INTO customers (full_name, phone, email, id_card, address) VALUES
('Lê Hoàng Long', '0901234567', 'long.le@email.com', '001090123456', 'Hà Nội'),
('Phạm Thị Mai', '0912345678', 'mai.pham@email.com', '030195123456', 'Hải Phòng'),
('Nguyễn Tuấn Anh', '0923456789', 'tuananh.nguyen@email.com', '048092123456', 'Đà Nẵng'),
('Trần Lê Thu Thảo', '0934567890', 'thuthao.tran@email.com', '079198123456', 'TP.HCM'),
('Vũ Đình Kiên', '0945678901', 'kien.vu@email.com', '034090123456', 'Ninh Bình');

-- 2. Thêm Đặt phòng mẫu (Bookings)
-- Ghi chú: Dùng CURRENT_DATE để dữ liệu luôn xoay quanh thời điểm hiện tại, giúp dashboard có số liệu.
INSERT INTO bookings (booking_code, customer_id, room_id, check_in_date, check_out_date, actual_check_in, actual_check_out, status, total_amount, deposit, notes) VALUES
-- Booking 1: Đã trả phòng (Khách cũ) - Phòng 101 (id: 1)
('BK001', 1, 1, CURRENT_DATE - INTERVAL '5 days', CURRENT_DATE - INTERVAL '3 days', CURRENT_DATE - INTERVAL '5 days' + INTERVAL '14 hours', CURRENT_DATE - INTERVAL '3 days' + INTERVAL '11 hours', 'da_tra_phong', 1000000, 500000, 'Khách trả phòng đúng giờ'),

-- Booking 2: Đang sử dụng (Đang lưu trú) - Phòng 201 (id: 4)
('BK002', 2, 4, CURRENT_DATE - INTERVAL '1 day', CURRENT_DATE + INTERVAL '2 days', CURRENT_DATE - INTERVAL '1 day' + INTERVAL '14 hours', NULL, 'da_nhan_phong', 2400000, 1000000, 'Khách yêu cầu dọn phòng mỗi ngày'),

-- Booking 3: Đặt trước (Sắp đến) - Phòng 301 (id: 7)
('BK003', 3, 7, CURRENT_DATE + INTERVAL '2 days', CURRENT_DATE + INTERVAL '4 days', NULL, NULL, 'dat_truoc', 3000000, 1000000, 'Chuẩn bị phòng honey moon'),

-- Booking 4: Đã hủy - Phòng 102 (id: 2)
('BK004', 4, 2, CURRENT_DATE - INTERVAL '10 days', CURRENT_DATE - INTERVAL '8 days', NULL, NULL, 'da_huy', 1000000, 300000, 'Khách ốm đột xuất, không hoàn cọc'),

-- Booking 5: Đang sử dụng (Vừa check-in hôm nay) - Phòng 401 (id: 9)
('BK005', 5, 9, CURRENT_DATE, CURRENT_DATE + INTERVAL '1 day', CURRENT_DATE + INTERVAL '13 hours', NULL, 'da_nhan_phong', 1200000, 0, 'Khách vãng lai, chưa cọc');

-- 3. Cập nhật lại trạng thái phòng để khớp với dữ liệu Booking ở trên
-- Phòng 201(4) và 401(9) đang có khách ở -> 'dang_su_dung'
-- Phòng 301(7) có người đặt trước -> 'dat_truoc'
UPDATE rooms SET status = 'dang_su_dung' WHERE id IN (4, 9);
UPDATE rooms SET status = 'dat_truoc' WHERE id = 7;

-- 4. Thêm Thanh toán mẫu (Payments)
INSERT INTO payments (booking_id, amount, payment_method, notes) VALUES
-- Thanh toán cho Booking 1: Cọc 500k, sau đó trả nốt 500k
(1, 500000, 'chuyen_khoan', 'Chuyển khoản cọc'),
(1, 500000, 'the', 'Quẹt thẻ lúc trả phòng'),

-- Thanh toán cho Booking 2: Mới cọc 1 triệu
(2, 1000000, 'chuyen_khoan', 'Cọc qua Momo'),

-- Thanh toán cho Booking 3: Cọc 1 triệu
(3, 1000000, 'tien_mat', 'Đến tận nơi cọc tiền mặt'),

-- Thanh toán cho Booking 4: Cọc 300k (Booking này đã hủy)
(4, 300000, 'chuyen_khoan', 'Cọc giữ chỗ');