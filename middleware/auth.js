const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Verifies the signed login cookie, then loads the user from the database.
// The role and status are always read from the database, so a role change
// by HR (or a disabled account) takes effect on the very next request.
async function requireAuth(req, res, next) {
  try {
    const token = req.cookies && req.cookies.token;
    if (!token) return res.status(401).json({ message: 'Please log in.' });

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.id);
    if (!user || user.status !== 'active') {
      return res.status(401).json({ message: 'Please log in.' });
    }
    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Your session has ended. Please log in again.' });
    }
    next(err);
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'You do not have permission to do that.' });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
