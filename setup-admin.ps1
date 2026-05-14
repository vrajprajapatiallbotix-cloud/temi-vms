# Sets the default admin password to Admin@123
# Run this once after the database is initialized

Set-Location "$PSScriptRoot\backend"

node -e @'
require("dotenv").config();
const bcrypt = require("bcryptjs");
const { query } = require("./src/config/database");

(async () => {
  try {
    const hash = await bcrypt.hash("Admin@123", 12);
    const res = await query(
      "UPDATE users SET password_hash = $1 WHERE email = $2 RETURNING email, name",
      [hash, "admin@vms.com"]
    );
    if (res.rows.length) {
      console.log("Admin password set for:", res.rows[0].email);
    } else {
      console.log("Admin user not found. Run migrations first.");
    }
    process.exit(0);
  } catch (e) {
    console.error("Error:", e.message);
    process.exit(1);
  }
})();
'@
