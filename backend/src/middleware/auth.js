const jwt = require('jsonwebtoken');

function authRequired(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Chưa đăng nhập hoặc thiếu token.' });
  }
  const token = header.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'please_change_this_secret_key');
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token không hợp lệ hoặc đã hết hạn.' });
  }
}

module.exports = { authRequired };
