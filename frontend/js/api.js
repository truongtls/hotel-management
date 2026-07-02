const API_BASE = '/api';

function getToken() {
  return localStorage.getItem('hotel_token');
}

async function apiRequest(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 204) return null;

  let data = null;
  try { data = await res.json(); } catch (e) { /* no body */ }

  if (!res.ok) {
    const message = (data && data.error) || 'Đã xảy ra lỗi không xác định.';
    throw new Error(message);
  }
  return data;
}

const api = {
  login: (username, password) =>
    apiRequest('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),

  getRooms: (status) => apiRequest(`/rooms${status ? `?status=${status}` : ''}`),
  getAvailableRooms: (checkIn, checkOut, excludeBookingId) => {
    const params = new URLSearchParams({ check_in_date: checkIn, check_out_date: checkOut });
    if (excludeBookingId) params.set('exclude_booking_id', excludeBookingId);
    return apiRequest(`/rooms/available?${params.toString()}`);
  },
  createRoom: (payload) => apiRequest('/rooms', { method: 'POST', body: JSON.stringify(payload) }),
  updateRoom: (id, payload) => apiRequest(`/rooms/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteRoom: (id) => apiRequest(`/rooms/${id}`, { method: 'DELETE' }),

  getRoomTypes: () => apiRequest('/room-types'),
  createRoomType: (payload) => apiRequest('/room-types', { method: 'POST', body: JSON.stringify(payload) }),
  updateRoomType: (id, payload) => apiRequest(`/room-types/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteRoomType: (id) => apiRequest(`/room-types/${id}`, { method: 'DELETE' }),

  getCustomers: (search) => apiRequest(`/customers${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  createCustomer: (payload) => apiRequest('/customers', { method: 'POST', body: JSON.stringify(payload) }),
  updateCustomer: (id, payload) => apiRequest(`/customers/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteCustomer: (id) => apiRequest(`/customers/${id}`, { method: 'DELETE' }),

  getBookings: (status) => apiRequest(`/bookings${status ? `?status=${status}` : ''}`),
  getBooking: (id) => apiRequest(`/bookings/${id}`),
  createBooking: (payload) => apiRequest('/bookings', { method: 'POST', body: JSON.stringify(payload) }),
  checkinBooking: (id) => apiRequest(`/bookings/${id}/checkin`, { method: 'POST' }),
  checkoutBooking: (id) => apiRequest(`/bookings/${id}/checkout`, { method: 'POST' }),
  cancelBooking: (id) => apiRequest(`/bookings/${id}/cancel`, { method: 'POST' }),
  addPayment: (id, payload) => apiRequest(`/bookings/${id}/payments`, { method: 'POST', body: JSON.stringify(payload) }),

  getDashboardStats: () => apiRequest('/dashboard/stats'),
};
