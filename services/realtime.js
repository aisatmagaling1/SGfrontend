// Live updates. Events only say "something changed"; the page then asks the
// normal API for the data, so nobody receives information they may not see.
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

let io = null;

function parseCookies(header = '') {
  const out = {};
  header.split(';').forEach((part) => {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  });
  return out;
}

function init(server) {
  io = new Server(server);

  io.use(async (socket, next) => {
    try {
      const token = parseCookies(socket.handshake.headers.cookie).token;
      if (!token) return next(new Error('unauthorized'));
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(payload.id);
      if (!user || user.status !== 'active') return next(new Error('unauthorized'));
      socket.data.userId = user.id;
      socket.data.role = user.role;
      next();
    } catch (err) {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    socket.join('user:' + socket.data.userId);
    if (socket.data.role) socket.join('role:' + socket.data.role);
  });
}

function emitToUsers(ids, event, payload) {
  if (!io) return;
  [...new Set(ids.filter(Boolean).map(String))].forEach((id) => io.to('user:' + id).emit(event, payload));
}

function emitToRoles(roles, event, payload) {
  if (!io) return;
  roles.forEach((role) => io.to('role:' + role).emit(event, payload));
}

module.exports = { init, emitToUsers, emitToRoles };
