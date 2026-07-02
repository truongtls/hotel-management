// ============ STATE ============
let currentUser = null;
let roomTypesCache = [];
let roomsCache = [];
let customersCache = [];

const STATUS_LABELS = {
  trong: 'Trống',
  dat_truoc: 'Đã đặt trước',
  dang_su_dung: 'Đang sử dụng',
  bao_tri: 'Bảo trì',
};
const STATUS_BADGE = {
  trong: 'badge-free',
  dat_truoc: 'badge-reserved',
  dang_su_dung: 'badge-busy',
  bao_tri: 'badge-maint',
};
const BOOKING_STATUS_LABELS = {
  dat_truoc: 'Đặt trước',
  da_nhan_phong: 'Đang lưu trú',
  da_tra_phong: 'Đã trả phòng',
  da_huy: 'Đã hủy',
};
const BOOKING_STATUS_BADGE = {
  dat_truoc: 'badge-reserved',
  da_nhan_phong: 'badge-busy',
  da_tra_phong: 'badge-done',
  da_huy: 'badge-cancelled',
};

function formatMoney(n) {
  return Number(n || 0).toLocaleString('vi-VN') + ' ₫';
}
function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('vi-VN');
}
function formatDateTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('vi-VN');
}

function showToast(message, type = 'success') {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.className = `toast ${type}`;
  el.hidden = false;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => { el.hidden = true; }, 3500);
}

function handleError(err) {
  console.error(err);
  showToast(err.message || 'Đã xảy ra lỗi.', 'error');
}

// ============ LOGIN ============
const loginScreen = document.getElementById('login-screen');
const appShell = document.getElementById('app');

async function initAuth() {
  const token = getToken();
  if (!token) return showLogin();
  try {
    await api.getDashboardStats(); // dùng để xác thực token còn hạn
    const saved = JSON.parse(localStorage.getItem('hotel_user') || 'null');
    if (saved) {
      currentUser = saved;
      showApp();
    } else {
      showLogin();
    }
  } catch (e) {
    showLogin();
  }
}

function showLogin() {
  loginScreen.hidden = false;
  appShell.hidden = true;
}

function showApp() {
  loginScreen.hidden = true;
  appShell.hidden = false;
  document.getElementById('user-name').textContent = currentUser?.full_name || currentUser?.username || '';
  navigateTo('dashboard');
}

document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  const errorEl = document.getElementById('login-error');
  errorEl.hidden = true;
  try {
    const data = await api.login(username, password);
    localStorage.setItem('hotel_token', data.token);
    localStorage.setItem('hotel_user', JSON.stringify(data.user));
    currentUser = data.user;
    showApp();
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.hidden = false;
  }
});

document.getElementById('logout-btn').addEventListener('click', () => {
  localStorage.removeItem('hotel_token');
  localStorage.removeItem('hotel_user');
  currentUser = null;
  showLogin();
});

// ============ NAVIGATION ============
const viewTitles = {
  dashboard: 'Tổng quan',
  rooms: 'Quản lý phòng',
  bookings: 'Đặt phòng',
  customers: 'Khách hàng',
  'room-types': 'Loại phòng',
};

document.querySelectorAll('.nav-item').forEach((btn) => {
  btn.addEventListener('click', () => navigateTo(btn.dataset.view));
});

async function navigateTo(view) {
  document.querySelectorAll('.nav-item').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
  document.querySelectorAll('.view').forEach((v) => (v.hidden = true));
  document.getElementById(`view-${view}`).hidden = false;
  document.getElementById('view-title').textContent = viewTitles[view];
  renderTopbarActions(view);

  try {
    if (view === 'dashboard') await loadDashboard();
    else if (view === 'rooms') await loadRooms();
    else if (view === 'bookings') await loadBookings();
    else if (view === 'customers') await loadCustomers();
    else if (view === 'room-types') await loadRoomTypes();
  } catch (err) {
    handleError(err);
  }
}

function renderTopbarActions(view) {
  const container = document.getElementById('topbar-actions');
  container.innerHTML = '';
  const map = {
    rooms: { label: '+ Thêm phòng', fn: openRoomForm },
    bookings: { label: '+ Tạo đặt phòng', fn: openBookingForm },
    customers: { label: '+ Thêm khách hàng', fn: openCustomerForm },
    'room-types': { label: '+ Thêm loại phòng', fn: openRoomTypeForm },
  };
  if (map[view]) {
    const btn = document.createElement('button');
    btn.className = 'btn btn-gold';
    btn.textContent = map[view].label;
    btn.addEventListener('click', () => map[view].fn());
    container.appendChild(btn);
  }
}

// ============ MODAL HELPERS ============
const backdrop = document.getElementById('modal-backdrop');
const modalBox = document.getElementById('modal-box');

function openModal(html) {
  modalBox.innerHTML = html;
  backdrop.hidden = false;
}
function closeModal() {
  backdrop.hidden = true;
  modalBox.innerHTML = '';
}
backdrop.addEventListener('click', (e) => {
  if (e.target === backdrop) closeModal();
});

// ============ DASHBOARD ============
async function loadDashboard() {
  const stats = await api.getDashboardStats();
  document.getElementById('stat-total-rooms').textContent = stats.total_rooms;
  document.getElementById('stat-rooms-free').textContent = stats.rooms_by_status.trong;
  document.getElementById('stat-active-bookings').textContent = stats.active_bookings;
  document.getElementById('stat-revenue').textContent = formatMoney(stats.revenue_this_month);
  document.getElementById('stat-checkins').textContent = stats.today_checkins;
  document.getElementById('stat-checkouts').textContent = stats.today_checkouts;

  const colors = { trong: 'var(--free)', dat_truoc: 'var(--reserved)', dang_su_dung: 'var(--busy)', bao_tri: 'var(--maint)' };
  const total = stats.total_rooms || 1;
  const bars = document.getElementById('room-status-bars');
  bars.innerHTML = Object.entries(stats.rooms_by_status).map(([key, count]) => `
    <div class="status-bar-row">
      <span class="label">${STATUS_LABELS[key]}</span>
      <span class="status-bar-track"><span class="status-bar-fill" style="width:${(count / total) * 100}%; background:${colors[key]}"></span></span>
      <span class="count">${count}</span>
    </div>
  `).join('');
}

// ============ LOẠI PHÒNG ============
async function loadRoomTypes() {
  roomTypesCache = await api.getRoomTypes();
  const tbody = document.getElementById('room-types-tbody');
  if (roomTypesCache.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:24px;">Chưa có loại phòng nào.</td></tr>`;
    return;
  }
  tbody.innerHTML = roomTypesCache.map((rt) => `
    <tr>
      <td>${rt.name}</td>
      <td>${rt.description || '—'}</td>
      <td>${formatMoney(rt.base_price)}</td>
      <td>${rt.max_guests}</td>
      <td class="row-actions">
        <button class="btn btn-outline btn-sm" onclick="openRoomTypeForm(${rt.id})">Sửa</button>
        <button class="btn btn-danger btn-sm" onclick="removeRoomType(${rt.id})">Xóa</button>
      </td>
    </tr>
  `).join('');
}

function openRoomTypeForm(id) {
  const rt = id ? roomTypesCache.find((r) => r.id === id) : null;
  openModal(`
    <h3>${rt ? 'Sửa loại phòng' : 'Thêm loại phòng'}</h3>
    <form id="room-type-form">
      <label>Tên loại phòng <input type="text" name="name" required value="${rt?.name || ''}" /></label>
      <label>Mô tả <textarea name="description" rows="2">${rt?.description || ''}</textarea></label>
      <label>Giá cơ bản / đêm (VNĐ) <input type="number" name="base_price" min="0" required value="${rt?.base_price || 0}" /></label>
      <label>Số khách tối đa <input type="number" name="max_guests" min="1" required value="${rt?.max_guests || 2}" /></label>
      <div class="modal-actions">
        <button type="button" class="btn btn-outline" onclick="closeModal()">Hủy</button>
        <button type="submit" class="btn btn-primary">Lưu</button>
      </div>
    </form>
  `);
  document.getElementById('room-type-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const payload = {
      name: fd.get('name'),
      description: fd.get('description'),
      base_price: Number(fd.get('base_price')),
      max_guests: Number(fd.get('max_guests')),
    };
    try {
      if (rt) await api.updateRoomType(rt.id, payload);
      else await api.createRoomType(payload);
      closeModal();
      showToast('Đã lưu loại phòng thành công.');
      await loadRoomTypes();
    } catch (err) { handleError(err); }
  });
}

async function removeRoomType(id) {
  if (!confirm('Xóa loại phòng này? Các phòng liên kết sẽ mất loại phòng.')) return;
  try {
    await api.deleteRoomType(id);
    showToast('Đã xóa loại phòng.');
    await loadRoomTypes();
  } catch (err) { handleError(err); }
}

// ============ PHÒNG ============
async function loadRooms() {
  roomsCache = await api.getRooms();
  if (roomTypesCache.length === 0) roomTypesCache = await api.getRoomTypes();
  const tbody = document.getElementById('rooms-tbody');
  if (roomsCache.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:24px;">Chưa có phòng nào.</td></tr>`;
    return;
  }
  tbody.innerHTML = roomsCache.map((r) => `
    <tr>
      <td><strong>${r.room_number}</strong></td>
      <td>${r.room_type_name || '—'}</td>
      <td>${r.floor ?? '—'}</td>
      <td><span class="badge ${STATUS_BADGE[r.status]}">${STATUS_LABELS[r.status]}</span></td>
      <td>${r.base_price ? formatMoney(r.base_price) : '—'}</td>
      <td>${r.notes || '—'}</td>
      <td class="row-actions">
        <button class="btn btn-outline btn-sm" onclick="openRoomForm(${r.id})">Sửa</button>
        <button class="btn btn-danger btn-sm" onclick="removeRoom(${r.id})">Xóa</button>
      </td>
    </tr>
  `).join('');
}

async function openRoomForm(id) {
  if (roomTypesCache.length === 0) roomTypesCache = await api.getRoomTypes();
  const room = id ? roomsCache.find((r) => r.id === id) : null;
  const typeOptions = roomTypesCache.map((rt) => `<option value="${rt.id}" ${room?.room_type_id === rt.id ? 'selected' : ''}>${rt.name}</option>`).join('');
  const statusOptions = Object.entries(STATUS_LABELS).map(([val, label]) => `<option value="${val}" ${room?.status === val ? 'selected' : ''}>${label}</option>`).join('');

  openModal(`
    <h3>${room ? 'Sửa phòng' : 'Thêm phòng'}</h3>
    <form id="room-form">
      <label>Số phòng <input type="text" name="room_number" required value="${room?.room_number || ''}" /></label>
      <label>Loại phòng
        <select name="room_type_id" required>${typeOptions || '<option value="">Chưa có loại phòng</option>'}</select>
      </label>
      <label>Tầng <input type="number" name="floor" value="${room?.floor ?? ''}" /></label>
      <label>Trạng thái <select name="status">${statusOptions}</select></label>
      <label>Ghi chú <textarea name="notes" rows="2">${room?.notes || ''}</textarea></label>
      <div class="modal-actions">
        <button type="button" class="btn btn-outline" onclick="closeModal()">Hủy</button>
        <button type="submit" class="btn btn-primary">Lưu</button>
      </div>
    </form>
  `);
  document.getElementById('room-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const payload = {
      room_number: fd.get('room_number'),
      room_type_id: Number(fd.get('room_type_id')) || null,
      floor: Number(fd.get('floor')) || null,
      status: fd.get('status'),
      notes: fd.get('notes'),
    };
    try {
      if (room) await api.updateRoom(room.id, payload);
      else await api.createRoom(payload);
      closeModal();
      showToast('Đã lưu phòng thành công.');
      await loadRooms();
    } catch (err) { handleError(err); }
  });
}

async function removeRoom(id) {
  if (!confirm('Xóa phòng này?')) return;
  try {
    await api.deleteRoom(id);
    showToast('Đã xóa phòng.');
    await loadRooms();
  } catch (err) { handleError(err); }
}

// ============ KHÁCH HÀNG ============
async function loadCustomers() {
  customersCache = await api.getCustomers();
  const tbody = document.getElementById('customers-tbody');
  if (customersCache.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:24px;">Chưa có khách hàng nào.</td></tr>`;
    return;
  }
  tbody.innerHTML = customersCache.map((c) => `
    <tr>
      <td><strong>${c.full_name}</strong></td>
      <td>${c.phone || '—'}</td>
      <td>${c.email || '—'}</td>
      <td>${c.id_card || '—'}</td>
      <td>${c.address || '—'}</td>
      <td class="row-actions">
        <button class="btn btn-outline btn-sm" onclick="openCustomerForm(${c.id})">Sửa</button>
        <button class="btn btn-danger btn-sm" onclick="removeCustomer(${c.id})">Xóa</button>
      </td>
    </tr>
  `).join('');
}

function openCustomerForm(id) {
  const c = id ? customersCache.find((x) => x.id === id) : null;
  openModal(`
    <h3>${c ? 'Sửa khách hàng' : 'Thêm khách hàng'}</h3>
    <form id="customer-form">
      <label>Họ tên <input type="text" name="full_name" required value="${c?.full_name || ''}" /></label>
      <label>Điện thoại <input type="text" name="phone" value="${c?.phone || ''}" /></label>
      <label>Email <input type="email" name="email" value="${c?.email || ''}" /></label>
      <label>CMND/CCCD <input type="text" name="id_card" value="${c?.id_card || ''}" /></label>
      <label>Địa chỉ <textarea name="address" rows="2">${c?.address || ''}</textarea></label>
      <div class="modal-actions">
        <button type="button" class="btn btn-outline" onclick="closeModal()">Hủy</button>
        <button type="submit" class="btn btn-primary">Lưu</button>
      </div>
    </form>
  `);
  document.getElementById('customer-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const payload = {
      full_name: fd.get('full_name'),
      phone: fd.get('phone'),
      email: fd.get('email'),
      id_card: fd.get('id_card'),
      address: fd.get('address'),
    };
    try {
      if (c) await api.updateCustomer(c.id, payload);
      else await api.createCustomer(payload);
      closeModal();
      showToast('Đã lưu khách hàng thành công.');
      await loadCustomers();
    } catch (err) { handleError(err); }
  });
}

async function removeCustomer(id) {
  if (!confirm('Xóa khách hàng này? Toàn bộ lịch sử đặt phòng liên quan cũng sẽ bị xóa.')) return;
  try {
    await api.deleteCustomer(id);
    showToast('Đã xóa khách hàng.');
    await loadCustomers();
  } catch (err) { handleError(err); }
}

// ============ ĐẶT PHÒNG ============
async function loadBookings() {
  const bookings = await api.getBookings();
  const tbody = document.getElementById('bookings-tbody');
  if (bookings.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:24px;">Chưa có đặt phòng nào.</td></tr>`;
    return;
  }
  tbody.innerHTML = bookings.map((b) => `
    <tr>
      <td><strong>${b.booking_code}</strong></td>
      <td>${b.customer_name}<br><span style="color:var(--text-muted);font-size:12px;">${b.customer_phone || ''}</span></td>
      <td>${b.room_number || '—'}</td>
      <td>${formatDate(b.check_in_date)}</td>
      <td>${formatDate(b.check_out_date)}</td>
      <td><span class="badge ${BOOKING_STATUS_BADGE[b.status]}">${BOOKING_STATUS_LABELS[b.status]}</span></td>
      <td>${formatMoney(b.total_amount)}</td>
      <td class="row-actions">
        ${b.status === 'dat_truoc' ? `<button class="btn btn-gold btn-sm" onclick="doCheckin(${b.id})">Nhận phòng</button>` : ''}
        ${b.status === 'da_nhan_phong' ? `<button class="btn btn-gold btn-sm" onclick="doCheckout(${b.id})">Trả phòng</button>` : ''}
        ${['dat_truoc', 'da_nhan_phong'].includes(b.status) ? `<button class="btn btn-danger btn-sm" onclick="doCancel(${b.id})">Hủy</button>` : ''}
        <button class="btn btn-outline btn-sm" onclick="openPaymentForm(${b.id}, '${b.booking_code}')">Thanh toán</button>
      </td>
    </tr>
  `).join('');
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

async function openBookingForm() {
  if (customersCache.length === 0) customersCache = await api.getCustomers();
  const customerOptions = customersCache.map((c) => `<option value="${c.id}">${c.full_name} — ${c.phone || 'không có SĐT'}</option>`).join('');

  // Mặc định gợi ý nhận phòng hôm nay, trả phòng ngày mai — người dùng có thể
  // đổi sang bất kỳ ngày nào trong tương lai (đặt trước nhiều ngày vẫn được).
  const defaultCheckIn = todayStr();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const defaultCheckOut = tomorrow.toISOString().slice(0, 10);

  openModal(`
    <h3>Tạo đặt phòng mới</h3>
    <form id="booking-form">
      <label>Khách hàng
        <select name="customer_id" required>
          <option value="">— Chọn khách hàng —</option>
          ${customerOptions}
        </select>
      </label>
      <label>Ngày nhận phòng
        <input type="date" name="check_in_date" id="bf-checkin" min="${todayStr()}" value="${defaultCheckIn}" required />
      </label>
      <label>Ngày trả phòng
        <input type="date" name="check_out_date" id="bf-checkout" min="${defaultCheckOut}" value="${defaultCheckOut}" required />
      </label>
      <label>Phòng
        <select name="room_id" id="bf-room" required>
          <option value="">Đang tải danh sách phòng trống…</option>
        </select>
      </label>
      <p id="bf-room-hint" class="error-text" hidden></p>
      <label>Tiền đặt cọc (VNĐ)
        <input type="number" name="deposit" min="0" value="0" />
      </label>
      <p style="font-size:12px;color:var(--text-muted);margin:-8px 0 0;">
        Tiền cọc sẽ được tự động trừ vào tổng tiền phải thanh toán.
      </p>
      <label>Ghi chú <textarea name="notes" rows="2"></textarea></label>
      <div class="modal-actions">
        <button type="button" class="btn btn-outline" onclick="closeModal()">Hủy</button>
        <button type="submit" class="btn btn-primary" id="bf-submit">Tạo đặt phòng</button>
      </div>
    </form>
    ${customersCache.length === 0 ? '<p class="error-text" style="margin-top:8px;">Bạn cần thêm khách hàng trước khi tạo đặt phòng.</p>' : ''}
  `);

  const checkinInput = document.getElementById('bf-checkin');
  const checkoutInput = document.getElementById('bf-checkout');
  const roomSelect = document.getElementById('bf-room');
  const roomHint = document.getElementById('bf-room-hint');
  const submitBtn = document.getElementById('bf-submit');

  async function refreshAvailableRooms() {
    const checkIn = checkinInput.value;
    const checkOut = checkoutInput.value;
    roomHint.hidden = true;
    if (!checkIn || !checkOut) return;

    // Ngày trả phải sau ngày nhận; tự điều chỉnh min của ô ngày trả
    checkoutInput.min = checkIn;
    if (checkOut <= checkIn) {
      const next = new Date(checkIn);
      next.setDate(next.getDate() + 1);
      checkoutInput.value = next.toISOString().slice(0, 10);
    }

    roomSelect.innerHTML = '<option value="">Đang tải danh sách phòng trống…</option>';
    submitBtn.disabled = true;
    try {
      const rooms = await api.getAvailableRooms(checkinInput.value, checkoutInput.value);
      if (rooms.length === 0) {
        roomSelect.innerHTML = '<option value="">Không còn phòng trống cho khoảng ngày này</option>';
        roomHint.textContent = 'Không còn phòng trống cho khoảng ngày đã chọn. Hãy thử đổi ngày hoặc chọn phòng khác.';
        roomHint.hidden = false;
        submitBtn.disabled = true;
      } else {
        roomSelect.innerHTML = '<option value="">— Chọn phòng —</option>' +
          rooms.map((r) => `<option value="${r.id}">${r.room_number} — ${r.room_type_name || 'Chưa gán loại phòng'} (${formatMoney(r.base_price)}/đêm)</option>`).join('');
        submitBtn.disabled = customersCache.length === 0;
      }
    } catch (err) {
      handleError(err);
      roomSelect.innerHTML = '<option value="">Lỗi khi tải danh sách phòng</option>';
    }
  }

  checkinInput.addEventListener('change', refreshAvailableRooms);
  checkoutInput.addEventListener('change', refreshAvailableRooms);
  await refreshAvailableRooms();

  document.getElementById('booking-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    if (!fd.get('room_id')) {
      showToast('Vui lòng chọn phòng còn trống.', 'error');
      return;
    }
    const payload = {
      customer_id: Number(fd.get('customer_id')),
      room_id: Number(fd.get('room_id')),
      check_in_date: fd.get('check_in_date'),
      check_out_date: fd.get('check_out_date'),
      deposit: Number(fd.get('deposit')) || 0,
      notes: fd.get('notes'),
    };
    try {
      await api.createBooking(payload);
      closeModal();
      showToast('Đã tạo đặt phòng thành công.');
      await loadBookings();
    } catch (err) { handleError(err); }
  });
}

async function doCheckin(id) {
  try {
    await api.checkinBooking(id);
    showToast('Đã nhận phòng cho khách.');
    await loadBookings();
  } catch (err) { handleError(err); }
}
async function doCheckout(id) {
  try {
    await api.checkoutBooking(id);
    showToast('Đã trả phòng.');
    await loadBookings();
  } catch (err) { handleError(err); }
}
async function doCancel(id) {
  if (!confirm('Hủy đặt phòng này?')) return;
  try {
    await api.cancelBooking(id);
    showToast('Đã hủy đặt phòng.');
    await loadBookings();
  } catch (err) { handleError(err); }
}

async function openPaymentForm(bookingId, code) {
  const booking = await api.getBooking(bookingId);
  const paid = booking.payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const remaining = Number(booking.total_amount) - paid;

  openModal(`
    <h3>Thanh toán — ${code}</h3>
    <p style="font-size:13px;color:var(--text-muted);margin-top:-8px;">
      Tổng tiền: <strong>${formatMoney(booking.total_amount)}</strong> ·
      Đã thanh toán: <strong>${formatMoney(paid)}</strong> ·
      Còn lại: <strong>${formatMoney(remaining)}</strong>
    </p>
    <form id="payment-form">
      <label>Số tiền (VNĐ) <input type="number" name="amount" min="1" required value="${remaining > 0 ? remaining : ''}" /></label>
      <label>Phương thức
        <select name="payment_method">
          <option value="tien_mat">Tiền mặt</option>
          <option value="chuyen_khoan">Chuyển khoản</option>
          <option value="the">Thẻ</option>
        </select>
      </label>
      <label>Ghi chú <textarea name="notes" rows="2"></textarea></label>
      <div class="modal-actions">
        <button type="button" class="btn btn-outline" onclick="closeModal()">Đóng</button>
        <button type="submit" class="btn btn-primary">Ghi nhận thanh toán</button>
      </div>
    </form>
  `);
  document.getElementById('payment-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const payload = {
      amount: Number(fd.get('amount')),
      payment_method: fd.get('payment_method'),
      notes: fd.get('notes'),
    };
    try {
      await api.addPayment(bookingId, payload);
      closeModal();
      showToast('Đã ghi nhận thanh toán.');
    } catch (err) { handleError(err); }
  });
}

// ============ KHỞI ĐỘNG ============
initAuth();
