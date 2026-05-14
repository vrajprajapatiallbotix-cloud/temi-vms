const bcrypt = require('bcryptjs');
const { query } = require('../config/database');

// GET /admin/employees
const getEmployees = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search, role } = req.query;
    const offset = (page - 1) * limit;

    let conditions = ['role != $1'];
    const params = ['security'];
    let paramCount = 1;

    if (search) {
      paramCount++;
      conditions.push(`(name ILIKE $${paramCount} OR email ILIKE $${paramCount})`);
      params.push(`%${search}%`);
    }
    if (role) {
      paramCount++;
      conditions.push(`role = $${paramCount}`);
      params.push(role);
    }

    const where = conditions.join(' AND ');
    const count = await query(`SELECT COUNT(*) FROM users WHERE ${where}`, params);

    params.push(limit, offset);
    const result = await query(
      `SELECT id, email, name, role, department, phone, desk_location, is_active, created_at
       FROM users WHERE ${where} ORDER BY name ASC
       LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`,
      params
    );

    res.json({ employees: result.rows, total: parseInt(count.rows[0].count), page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    next(err);
  }
};

// POST /admin/employees
const createEmployee = async (req, res, next) => {
  try {
    const { email, name, role = 'employee', department, phone, deskLocation, password, locationId } = req.body;

    if (!email || !name || !password) {
      return res.status(400).json({ error: 'Email, name and password required' });
    }
    if (!['admin', 'employee', 'security'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const hash = await bcrypt.hash(password, 12);
    const result = await query(
      `INSERT INTO users (email, password_hash, name, role, department, phone, desk_location, location_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, email, name, role, department`,
      [email.toLowerCase(), hash, name, role, department, phone, deskLocation, locationId]
    );

    await query(
      `INSERT INTO audit_logs (action, entity_type, entity_id, performed_by, metadata)
       VALUES ('create_user', 'user', $1, $2, $3)`,
      [result.rows[0].id, req.user.id, JSON.stringify({ email, role })]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

// PUT /admin/employees/:id
const updateEmployee = async (req, res, next) => {
  try {
    const { name, department, phone, deskLocation, isActive, role } = req.body;
    const result = await query(
      `UPDATE users SET
         name = COALESCE($1, name),
         department = COALESCE($2, department),
         phone = COALESCE($3, phone),
         desk_location = COALESCE($4, desk_location),
         is_active = COALESCE($5, is_active),
         role = COALESCE($6, role),
         updated_at = NOW()
       WHERE id = $7 RETURNING id, email, name, role, department, is_active`,
      [name, department, phone, deskLocation, isActive, role, req.params.id]
    );

    if (!result.rows.length) return res.status(404).json({ error: 'Employee not found' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

// DELETE /admin/employees/:id — soft delete
const deleteEmployee = async (req, res, next) => {
  try {
    await query('UPDATE users SET is_active = FALSE WHERE id = $1', [req.params.id]);
    res.json({ message: 'Employee deactivated' });
  } catch (err) {
    next(err);
  }
};

// GET /admin/visits — all visits with filters
const getAllVisits = async (req, res, next) => {
  try {
    const { status, type, employeeId, from, to, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    let conditions = ['1=1'];
    const params = [];
    let pc = 0;

    if (status) { pc++; conditions.push(`v.status = $${pc}`); params.push(status); }
    if (type) { pc++; conditions.push(`v.visit_type = $${pc}`); params.push(type); }
    if (employeeId) { pc++; conditions.push(`v.host_employee_id = $${pc}`); params.push(employeeId); }
    if (from) { pc++; conditions.push(`v.created_at >= $${pc}`); params.push(from); }
    if (to) { pc++; conditions.push(`v.created_at <= $${pc}`); params.push(to); }

    const where = conditions.join(' AND ');
    const count = await query(`SELECT COUNT(*) FROM visits v WHERE ${where}`, params);

    params.push(limit, offset);
    const result = await query(
      `SELECT v.*, vis.name as visitor_name, vis.email as visitor_email, vis.company,
              u.name as employee_name, u.department
       FROM visits v
       JOIN visitors vis ON vis.id = v.visitor_id
       JOIN users u ON u.id = v.host_employee_id
       WHERE ${where}
       ORDER BY v.created_at DESC
       LIMIT $${pc + 1} OFFSET $${pc + 2}`,
      params
    );

    res.json({ visits: result.rows, total: parseInt(count.rows[0].count), page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    next(err);
  }
};

// GET /admin/analytics
const getAnalytics = async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const fromDate = from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const toDate = to || new Date().toISOString();

    const [totalVisits, byStatus, byType, peakHours, topEmployees, dailyTrend] = await Promise.all([
      query(`SELECT COUNT(*) FROM visits WHERE created_at BETWEEN $1 AND $2`, [fromDate, toDate]),
      query(`SELECT status, COUNT(*) FROM visits WHERE created_at BETWEEN $1 AND $2 GROUP BY status`, [fromDate, toDate]),
      query(`SELECT visit_type, COUNT(*) FROM visits WHERE created_at BETWEEN $1 AND $2 GROUP BY visit_type`, [fromDate, toDate]),
      query(`SELECT EXTRACT(HOUR FROM checked_in_at) as hour, COUNT(*) as count
             FROM visits WHERE checked_in_at IS NOT NULL AND checked_in_at BETWEEN $1 AND $2
             GROUP BY hour ORDER BY hour`, [fromDate, toDate]),
      query(`SELECT u.name, COUNT(v.id) as visit_count
             FROM visits v JOIN users u ON u.id = v.host_employee_id
             WHERE v.created_at BETWEEN $1 AND $2
             GROUP BY u.name ORDER BY visit_count DESC LIMIT 10`, [fromDate, toDate]),
      query(`SELECT DATE(created_at) as date, COUNT(*) as count
             FROM visits WHERE created_at BETWEEN $1 AND $2
             GROUP BY DATE(created_at) ORDER BY date`, [fromDate, toDate]),
    ]);

    res.json({
      totalVisits: parseInt(totalVisits.rows[0].count),
      byStatus: byStatus.rows,
      byType: byType.rows,
      peakHours: peakHours.rows,
      topEmployees: topEmployees.rows,
      dailyTrend: dailyTrend.rows,
    });
  } catch (err) {
    next(err);
  }
};

// GET /admin/audit-logs
const getAuditLogs = async (req, res, next) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    const result = await query(
      `SELECT al.*, u.name as performed_by_name
       FROM audit_logs al
       LEFT JOIN users u ON u.id = al.performed_by
       ORDER BY al.created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    const count = await query('SELECT COUNT(*) FROM audit_logs');

    res.json({ logs: result.rows, total: parseInt(count.rows[0].count) });
  } catch (err) {
    next(err);
  }
};

// GET /admin/temi-robots
const getTemiRobots = async (req, res, next) => {
  try {
    const result = await query('SELECT t.*, l.name as location_name FROM temi_robots t LEFT JOIN locations l ON l.id = t.location_id ORDER BY t.name');
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

module.exports = { getEmployees, createEmployee, updateEmployee, deleteEmployee, getAllVisits, getAnalytics, getAuditLogs, getTemiRobots };
