/**
 * Run once in Codespaces to seed real employee accounts.
 * Usage: node backend/add-employees.js
 */
require('dotenv').config({ path: __dirname + '/.env' });
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const LOCATION_ID = '00000000-0000-0000-0000-000000000001';
const DEFAULT_PASSWORD = 'Employee@123';

const employees = [
  { name: 'Vraj Prajapati',    email: 'vraj@nanta.tech',    department: 'Engineering',  desk_location: 'Software Room',    role: 'employee' },
  { name: 'Mayank Shah',       email: 'mayank@nanta.tech',  department: 'Management',   desk_location: 'Director Office',  role: 'admin'    },
  { name: 'Admin User',        email: 'admin@vms.com',      department: 'IT',           desk_location: 'IT Room',          role: 'admin'    },
  { name: 'HR Manager',        email: 'hr@nanta.tech',      department: 'HR',           desk_location: 'HR Cabin',         role: 'employee' },
  { name: 'Sales Lead',        email: 'sales@nanta.tech',   department: 'Sales',        desk_location: 'Sales Room',       role: 'employee' },
  { name: 'Marketing Manager', email: 'marketing@nanta.tech', department: 'Marketing',  desk_location: 'Marketing Cabin',  role: 'employee' },
];

async function main() {
  const hash = await bcrypt.hash(DEFAULT_PASSWORD, 12);
  console.log(`\nSeeding ${employees.length} employees…\n`);

  for (const emp of employees) {
    const empHash = emp.email === 'admin@vms.com'
      ? await bcrypt.hash('Admin@123', 12)   // keep admin password
      : hash;

    const res = await pool.query(
      `INSERT INTO users (email, password_hash, name, role, department, desk_location, location_id, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)
       ON CONFLICT (email) DO UPDATE
         SET name = EXCLUDED.name, department = EXCLUDED.department,
             desk_location = EXCLUDED.desk_location, password_hash = EXCLUDED.password_hash,
             is_active = TRUE
       RETURNING id, name, email, role, desk_location`,
      [emp.email, empHash, emp.name, emp.role, emp.department, emp.desk_location, LOCATION_ID]
    );
    console.log(`✓ ${res.rows[0].name} (${res.rows[0].role}) — ${res.rows[0].desk_location}`);
  }

  console.log(`\n✅ Done! All employees can log in with password: ${DEFAULT_PASSWORD}`);
  console.log('   Admin (admin@vms.com) password: Admin@123\n');
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
