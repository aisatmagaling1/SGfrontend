// Creates the first HR account so someone can approve everyone else.
// Run once with: npm run seed
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

(async () => {
  const { MONGODB_URI, SEED_HR_NAME, SEED_HR_EMAIL, SEED_HR_PASSWORD } = process.env;
  if (!MONGODB_URI || !SEED_HR_EMAIL || !SEED_HR_PASSWORD) {
    console.error('Set MONGODB_URI, SEED_HR_EMAIL and SEED_HR_PASSWORD in your .env file first.');
    process.exit(1);
  }
  if (SEED_HR_PASSWORD.length < 8) {
    console.error('SEED_HR_PASSWORD must have at least 8 characters.');
    process.exit(1);
  }

  await mongoose.connect(MONGODB_URI);
  const email = SEED_HR_EMAIL.trim().toLowerCase();

  if (await User.exists({ email })) {
    console.log(`An account for ${email} already exists. Nothing changed.`);
  } else {
    await User.create({
      fullName: (SEED_HR_NAME || 'HR Admin').trim(),
      email,
      passwordHash: await bcrypt.hash(SEED_HR_PASSWORD, 10),
      role: 'hr',
      status: 'active',
      mustChangePassword: true,
    });
    console.log(`HR account created for ${email}. Log in and choose a new password.`);
  }
  await mongoose.disconnect();
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
