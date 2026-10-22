require('dotenv').config();
const path = require('path');
const http = require('http');
const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const connectDB = require('./config/db');
const realtime = require('./services/realtime');
const User = require('./models/User');
const { YEARLY_LEAVE_DAYS } = require('./config/constants');

if (!process.env.MONGODB_URI) {
  console.error('Missing MONGODB_URI. Copy .env.example to .env and fill it in.');
  process.exit(1);
}
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error('JWT_SECRET must be set in .env and be at least 32 characters long.');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 4000;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());

app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/requests', require('./routes/requests'));
app.use('/api', (req, res) => res.status(404).json({ message: 'Not found.' }));

app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => res.redirect('/login.html'));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err && err.name === 'VersionError') {
    return res.status(409).json({ message: 'This request just changed. Reload the page and try again.' });
  }
  if (err && err.code === 11000) {
    return res.status(409).json({ message: 'An account with this email already exists.' });
  }
  if (err && err.status && err.status < 500) {
    return res.status(err.status).json({ message: err.message });
  }
  console.error(err);
  res.status(500).json({ message: 'Something went wrong on the server. Try again.' });
});

// Leave carries over: each new year adds the yearly days to whatever is left.
// Also gives accounts made in Phase 1 their starting balances.
async function prepareBalances() {
  const year = new Date().getFullYear();
  await User.updateMany(
    { balanceYear: { $exists: false } },
    { $set: { sickDays: YEARLY_LEAVE_DAYS, vacationDays: YEARLY_LEAVE_DAYS, balanceYear: year } }
  );
  const add = (field) => ({
    $add: [`$${field}`, { $multiply: [YEARLY_LEAVE_DAYS, { $subtract: [year, '$balanceYear'] }] }],
  });
  const result = await User.updateMany(
    { balanceYear: { $lt: year } },
    [{ $set: { sickDays: add('sickDays'), vacationDays: add('vacationDays'), balanceYear: year } }]
  );
  if (result.modifiedCount) console.log(`Added the new year's leave days for ${result.modifiedCount} account(s).`);
}

const server = http.createServer(app);
realtime.init(server);

connectDB()
  .then(async () => {
    await prepareBalances();
    setInterval(() => prepareBalances().catch((e) => console.error(e.message)), 60 * 60 * 1000);
    server.listen(PORT, () => console.log(`Request Hub running at http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error('Could not connect to MongoDB:', err.message);
    process.exit(1);
  });
