const bcrypt = require('bcryptjs');
const { query } = require('../config/database');

// Middleware: ensure the acting user can only operate within their own org
// (platform_super_admin can see any org via ?orgId query param)
const resolveOrgId = (req) => {
  if (req.user.role === 'platform_super_admin' && req.query.orgId) {
    return req.query.orgId;
  }
  return req.user.organization_id;
};

// ── Branches ──────────────────────────────────────────────────────────────

const listBranches = async (req, res, next) => {
  try {
    const orgId = resolveOrgId(req);
    const result = await query(
      `SELECT b.*, COUNT(u.id) as employee_count
       FROM branches b
       LEFT JOIN users u ON u.branch_id = b.id AND u.is_active = TRUE
       WHERE b.organization_id = $1
       GROUP BY b.id ORDER BY b.name`,
      [orgId]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

const createBranch = async (req, res, next) => {
  try {
    const orgId = resolveOrgId(req);
    const { name, address, city, country } = req.body;
    if (!name) return res.status(400).json({ error: 'Branch name required' });
    const result = await query(
      `INSERT INTO branches (organization_id, name, address, city, country)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [orgId, name, address, city, country || 'India']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

const updateBranch = async (req, res, next) => {
  try {
    const orgId = resolveOrgId(req);
    const { name, address, city, country, isActive } = req.body;
    const result = await query(
      `UPDATE branches SET
         name      = COALESCE($1, name),
         address   = COALESCE($2, address),
         city      = COALESCE($3, city),
         country   = COALESCE($4, country),
         is_active = COALESCE($5, is_active)
       WHERE id = $6 AND organization_id = $7 RETURNING *`,
      [name, address, city, country, isActive, req.params.id, orgId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Branch not found' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

// ── Employees within org ───────────────────────────────────────────────────

const listOrgEmployees = async (req, res, next) => {
  try {
    const orgId = resolveOrgId(req);
    const { search, role, branchId, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let conditions = [`u.organization_id = $1`, `u.role NOT IN ('platform_super_admin')`];
    const params = [orgId];
    let pc = 1;

    if (search) {
      pc++; conditions.push(`(u.name ILIKE $${pc} OR u.email ILIKE $${pc})`); params.push(`%${search}%`);
    }
    if (role) {
      pc++; conditions.push(`u.role = $${pc}`); params.push(role);
    }
    if (branchId) {
      pc++; conditions.push(`u.branch_id = $${pc}`); params.push(branchId);
    }

    const where = conditions.join(' AND ');
    const count = await query(`SELECT COUNT(*) FROM users u WHERE ${where}`, params);
    params.push(limit, offset);

    const result = await query(
      `SELECT u.id, u.email, u.name, u.role, u.department, u.phone, u.desk_location, u.is_active,
              u.branch_id, b.name as branch_name, u.created_at
       FROM users u
       LEFT JOIN branches b ON b.id = u.branch_id
       WHERE ${where}
       ORDER BY u.name ASC
       LIMIT $${pc + 1} OFFSET $${pc + 2}`,
      params
    );

    res.json({ employees: result.rows, total: parseInt(count.rows[0].count), page: parseInt(page) });
  } catch (err) {
    next(err);
  }
};

const createOrgEmployee = async (req, res, next) => {
  try {
    const orgId = resolveOrgId(req);
    const { email, name, role = 'employee', department, phone, deskLocation, branchId, password } = req.body;

    if (!email || !name || !password) {
      return res.status(400).json({ error: 'Email, name, and password required' });
    }
    const validRoles = ['org_admin', 'admin', 'employee', 'security'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const hash = await bcrypt.hash(password, 12);
    const result = await query(
      `INSERT INTO users (email, password_hash, name, role, department, phone, desk_location, branch_id, organization_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id, email, name, role, department`,
      [email.toLowerCase(), hash, name, role, department, phone, deskLocation, branchId || null, orgId]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

// ── Org Visits (scoped) ────────────────────────────────────────────────────

const listOrgVisits = async (req, res, next) => {
  try {
    const orgId = resolveOrgId(req);
    const { status, type, from, to, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    let conditions = [`v.organization_id = $1`];
    const params = [orgId];
    let pc = 1;

    if (status) { pc++; conditions.push(`v.status = $${pc}`); params.push(status); }
    if (type)   { pc++; conditions.push(`v.visit_type = $${pc}`); params.push(type); }
    if (from)   { pc++; conditions.push(`v.created_at >= $${pc}`); params.push(from); }
    if (to)     { pc++; conditions.push(`v.created_at <= $${pc}`); params.push(to); }

    const where = conditions.join(' AND ');
    const count = await query(`SELECT COUNT(*) FROM visits v WHERE ${where}`, params);

    params.push(limit, offset);
    const result = await query(
      `SELECT v.*, vis.name as visitor_name, vis.email as visitor_email, vis.company,
              u.name as employee_name, u.department
       FROM visits v
       JOIN visitors vis ON vis.id = v.visitor_id
       LEFT JOIN users u ON u.id = v.host_employee_id
       WHERE ${where}
       ORDER BY v.created_at DESC
       LIMIT $${pc + 1} OFFSET $${pc + 2}`,
      params
    );

    res.json({ visits: result.rows, total: parseInt(count.rows[0].count) });
  } catch (err) {
    next(err);
  }
};

// ── Org Analytics ─────────────────────────────────────────────────────────

const getOrgAnalytics = async (req, res, next) => {
  try {
    const orgId = resolveOrgId(req);
    const { from, to } = req.query;
    const fromDate = from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const toDate   = to   || new Date().toISOString();

    const [totalVisits, byStatus, byType, topEmployees, dailyTrend] = await Promise.all([
      query(`SELECT COUNT(*) FROM visits WHERE organization_id=$1 AND created_at BETWEEN $2 AND $3`, [orgId, fromDate, toDate]),
      query(`SELECT status, COUNT(*) FROM visits WHERE organization_id=$1 AND created_at BETWEEN $2 AND $3 GROUP BY status`, [orgId, fromDate, toDate]),
      query(`SELECT visit_type, COUNT(*) FROM visits WHERE organization_id=$1 AND created_at BETWEEN $2 AND $3 GROUP BY visit_type`, [orgId, fromDate, toDate]),
      query(`SELECT u.name, COUNT(v.id) as visit_count
             FROM visits v JOIN users u ON u.id = v.host_employee_id
             WHERE v.organization_id=$1 AND v.created_at BETWEEN $2 AND $3
             GROUP BY u.name ORDER BY visit_count DESC LIMIT 10`, [orgId, fromDate, toDate]),
      query(`SELECT DATE(created_at) as date, COUNT(*) as count
             FROM visits WHERE organization_id=$1 AND created_at BETWEEN $2 AND $3
             GROUP BY DATE(created_at) ORDER BY date`, [orgId, fromDate, toDate]),
    ]);

    res.json({
      totalVisits: parseInt(totalVisits.rows[0].count),
      byStatus: byStatus.rows,
      byType: byType.rows,
      topEmployees: topEmployees.rows,
      dailyTrend: dailyTrend.rows,
    });
  } catch (err) {
    next(err);
  }
};

// ── Pending approvals (org-scoped) ────────────────────────────────────────

const getOrgPendingApprovals = async (req, res, next) => {
  try {
    const orgId = resolveOrgId(req);
    const isAdmin = ['platform_super_admin','org_super_admin','org_admin','admin'].includes(req.user.role);

    let whereExtra = isAdmin ? '' : `AND v.host_employee_id = ${req.user.id}`;
    const params = [orgId];

    const result = await query(
      `SELECT v.*, vis.name as visitor_name, vis.email as visitor_email,
              vis.phone as visitor_phone, vis.company,
              u.name as employee_name, u.department, u.email as employee_email
       FROM visits v
       JOIN visitors vis ON vis.id = v.visitor_id
       JOIN users u ON u.id = v.host_employee_id
       WHERE v.organization_id = $1 AND v.status = 'pending' ${whereExtra}
       ORDER BY v.created_at DESC`,
      params
    );

    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/org/visits/:id/approve
 * Approves visit, creates OTP session, emails it to visitor.
 */
const approveOrgVisit = async (req, res, next) => {
  try {
    const orgId = resolveOrgId(req);
    const { meetingRoom } = req.body;

    const visitResult = await query(
      `SELECT v.*, vis.name as visitor_name, vis.email as visitor_email,
              u.name as host_name
       FROM visits v
       JOIN visitors vis ON vis.id = v.visitor_id
       LEFT JOIN users u ON u.id = v.host_employee_id
       WHERE v.id = $1 AND v.organization_id = $2`,
      [req.params.id, orgId]
    );

    if (!visitResult.rows.length) {
      return res.status(404).json({ error: 'Visit not found' });
    }

    const visit = visitResult.rows[0];

    await query(
      `UPDATE visits SET status='approved', meeting_room=COALESCE($1, meeting_room),
       approved_at=NOW() WHERE id=$2`,
      [meetingRoom, visit.id]
    );

    // Generate + email OTP if visitor has email
    let otpSent = false;
    if (visit.visitor_email) {
      const { createOTPSession } = require('../services/otpService');
      const { sendOTPCode } = require('../services/emailService');
      const { otp, expiresAt } = await createOTPSession({
        visitId: visit.id,
        email: visit.visitor_email,
        organizationId: orgId,
      });
      await sendOTPCode({
        visitorEmail: visit.visitor_email,
        visitorName: visit.visitor_name,
        otp,
        hostName: visit.host_name,
        visitDate: visit.scheduled_at || visit.created_at,
      }).catch((e) => console.error('[Approve] OTP email error:', e.message));
      otpSent = true;
    }

    res.json({ message: 'Visit approved', otpSent });
  } catch (err) {
    next(err);
  }
};

const declineOrgVisit = async (req, res, next) => {
  try {
    const orgId = resolveOrgId(req);
    const { reason } = req.body;
    await query(
      `UPDATE visits SET status='declined', notes=COALESCE($1,notes) WHERE id=$2 AND organization_id=$3`,
      [reason, req.params.id, orgId]
    );
    res.json({ message: 'Visit declined' });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  listBranches, createBranch, updateBranch,
  listOrgEmployees, createOrgEmployee,
  listOrgVisits, getOrgAnalytics,
  getOrgPendingApprovals, approveOrgVisit, declineOrgVisit,
};
