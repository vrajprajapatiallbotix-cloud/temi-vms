require('dotenv').config();
const bcrypt = require('bcryptjs');
const { query } = require('./src/config/database');

(async () => {
  try {
    const hash = await bcrypt.hash('Admin@123', 12);
    const res = await query(
      'UPDATE users SET password_hash = $1 WHERE email = $2 RETURNING email, name',
      [hash, 'admin@vms.com']
    );
    if (res.rows.length) {
      console.log('✅ Admin password set for:', res.rows[0].email, '/', res.rows[0].name);
      console.log('   Login: admin@vms.com  |  Password: Admin@123');
    } else {
      console.log('❌ No admin row found — check seed migration.');
    }
    process.exit(0);
  } catch (e) {
    console.error('❌ Error:', e.message);
    process.exit(1);
  }
})();
