# Sảnh Vàng — Hệ thống quản lý khách sạn

Ứng dụng web quản lý khách sạn: quản lý phòng, loại phòng, khách hàng, đặt phòng
(nhận phòng / trả phòng / hủy), thanh toán và dashboard thống kê. Triển khai hoàn
toàn bằng Docker.

## Kiến trúc

- **frontend** — HTML/CSS/JS thuần, phục vụ qua Nginx (proxy `/api` sang backend)
- **backend** — Node.js + Express, REST API, xác thực bằng JWT
- **db** — PostgreSQL 16

```
docker-compose.yml
backend/    (Dockerfile, Express API, script khởi tạo DB)
frontend/   (Dockerfile, Nginx, giao diện web)
```

## Cách chạy

1. Cài [Docker](https://docs.docker.com/get-docker/) và Docker Compose (đã tích hợp sẵn trong Docker Desktop).
2. Sao chép file cấu hình mẫu và chỉnh sửa nếu cần:
   ```bash
   cp .env.example .env
   ```
   Đặc biệt nên đổi `JWT_SECRET`, `ADMIN_PASSWORD`, `DB_PASSWORD` trước khi dùng thật.
3. Khởi động toàn bộ hệ thống:
   ```bash
   docker compose up -d --build
   ```
4. Mở trình duyệt tại: `http://localhost:8080` (hoặc cổng bạn đặt ở `WEB_PORT`).
5. Đăng nhập bằng tài khoản trong `.env` (mặc định `admin` / `admin123`).

Dừng hệ thống:
```bash
docker compose down
```

Dừng và xóa luôn dữ liệu database:
```bash
docker compose down -v
```

## Tính năng

- **Đăng nhập** bằng JWT, tài khoản admin được tự động tạo lần đầu khởi động.
- **Quản lý loại phòng**: tên, mô tả, giá/đêm, số khách tối đa.
- **Quản lý phòng**: số phòng, tầng, loại phòng, trạng thái (trống / đã đặt trước /
  đang sử dụng / bảo trì).
- **Quản lý khách hàng**: họ tên, điện thoại, email, CMND/CCCD, địa chỉ.
- **Đặt phòng**:
  - Tạo đặt phòng mới (tự động kiểm tra trùng lịch, tự tính tổng tiền theo số đêm).
  - Nhận phòng (check-in) → phòng chuyển trạng thái "đang sử dụng".
  - Trả phòng (check-out) → phòng chuyển lại "trống".
  - Hủy đặt phòng.
  - Ghi nhận thanh toán (tiền mặt / chuyển khoản / thẻ), theo dõi số tiền còn lại.
- **Dashboard**: tổng số phòng, tỉ lệ trạng thái phòng, số đặt phòng đang hoạt
  động, doanh thu tháng hiện tại, số lượt nhận/trả phòng dự kiến hôm nay.

## Dữ liệu mẫu

`backend/db/init.sql` tạo sẵn 4 loại phòng và 10 phòng mẫu để bạn có thể dùng thử
ngay sau khi khởi động.

## Sao lưu / phục hồi database

Sao lưu:
```bash
docker exec hotel_db pg_dump -U hotel_user hotel_db > backup.sql
```

Phục hồi:
```bash
cat backup.sql | docker exec -i hotel_db psql -U hotel_user -d hotel_db
```

## Ghi chú triển khai thật (production)

- Đổi `JWT_SECRET`, mật khẩu database và mật khẩu admin trong `.env`.
- Nên đặt hệ thống sau một reverse proxy có HTTPS (VD: Traefik, Nginx + Let's Encrypt).
- Cân nhắc thêm cơ chế backup định kỳ cho volume `hotel_db_data`.
- Có thể mở rộng thêm vai trò người dùng (hiện có `admin` / `staff` trong bảng `users`,
  nhưng phân quyền chi tiết theo vai trò chưa được áp dụng ở API — có thể bổ sung
  trong middleware `auth.js` nếu cần).
