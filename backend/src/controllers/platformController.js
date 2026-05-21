const bcrypt = require('bcryptjs');
const { query } = require('../config/database');

// ── Organizations CRUD ────────────────────────────────────────────────────

const listOrganizations = async (req, res, next) => {
  try {
    const { search, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    const params = [];
    let where = '1=1';

    if (search) {
      params.push(`%${search}%`);
      where += ` AND (o.name ILIKE $${params.length} OR o.slug ILIKE $${params.length})`;
    }

    const count = await query(`SELECT COUNT(*) FROM organizations o WHERE ${where}`, params);
    params.push(limit, offset);

    const result = await query(
      `SELECT o.*,
              COUNT(DISTINCT u.id) FILTER (WHERE u.is_active = TRUE) as active_employees,
              COUNT(DISTINCT v.id) FILTER (WHERE v.created_at > NOW() - INTERVAL '30 days') as visits_last_30d
       FROM organizations o
       LEFT JOIN users u ON u.organization_id = o.id AND u.role NOT IN ('platform_super_admin')
       LEFT JOIN visits v ON v.organization_id = o.id
       WHERE ${where}
       GROUP BY o.id
       ORDER BY o.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({
      organizations: result.rows,
      total: parseInt(count.rows[0].count),
      page: parseInt(page),
      limit: parseInt(limit),
    });
  } catch (err) {
    next(err);
  }
};

const getOrganization = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT o.*,
              COUNT(DISTINCT u.id) FILTER (WHERE u.is_active = TRUE) as active_employees,
              COUNT(DISTINCT b.id) as branch_count,
              COUNT(DISTINCT t.id) as robot_count
       FROM organizations o
       LEFT JOIN users u ON u.organization_id = o.id
       LEFT JOIN branches b ON b.organization_id = o.id
       LEFT JOIN temi_robots t ON t.organization_id = o.id
       WHERE o.id = $1
       GROUP BY o.id`,
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Organization not found' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

const createOrganization = async (req, res, next) => {
  try {
    const { name, slug, domain, address, phone, email, plan, maxEmployees,
            adminName, adminEmail, adminPassword } = req.body;

    if (!name || !slug || !adminEmail || !adminPassword) {
      return res.status(400).json({ error: 'name, slug, adminEmail, adminPassword are required' });
    }

    const client = await require('../config/database').getClient();
    try {
      await client.query('BEGIN');

      const orgResult = await client.query(
        `INSERT INTO organizations (name, slug, domain, address, phone, email, plan, max_employees)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [name, slug.toLowerCase(), domain, address, phone, email, plan || 'standard', maxEmployees || 100]
      );
      const org = orgResult.rows[0];

      // Create org super admin user
      const hash = await bcrypt.hash(adminPassword, 12);
      const userResult = await client.query(
        `INSERT INTO users (email, password_hash, name, role, organization_id, is_active)
         VALUES ($1, $2, $3, 'org_super_admin', $4, TRUE) RETURNING id, email, name, role`,
        [adminEmail.toLowerCase(), hash, adminName || adminEmail.split('@')[0], org.id]
      );

      await client.query('COMMIT');
      res.status(201).json({ organization: org, admin: userResult.rows[0] });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    next(err);
  }
};

const updateOrganization = async (req, res, next) => {
  try {
    const { name, domain, address, phone, email, plan, maxEmployees, isActive } = req.body;
    const result = await query(
      `UPDATE organizations SET
         name         = COALESCE($1, name),
         domain       = COALESCE($2, domain),
         address      = COALESCE($3, address),
         phone        = COALESCE($4, phone),
         email        = COALESCE($5, email),
         plan         = COALESCE($6, plan),
         max_employees = COALESCE($7, max_employees),
         is_active    = COALESCE($8, is_active),
         updated_at   = NOW()
       WHERE id = $9 RETURNING *`,
      [name, domain, address, phone, email, plan, maxEmployees, isActive, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Organization not found' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

const deleteOrganization = async (req, res, next) => {
  try {
    await query('UPDATE organizations SET is_active = FALSE WHERE id = $1', [req.params.id]);
    res.json({ message: 'Organization deactivated' });
  } catch (err) {
    next(err);
  }
};

// ── Platform Analytics ─────────────────────────────────────────────────────

const getPlatformAnalytics = async (req, res, next) => {
  try {
    const [orgs, totalUsers, totalVisits, totalRobots, recentActivity] = await Promise.all([
      query(`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE is_active) as active FROM organizations`),
      query(`SELECT COUNT(*) FROM users WHERE role NOT IN ('platform_super_admin')`),
      query(`SELECT COUNT(*) FROM visits`),
      query(`SELECT COUNT(*) FROM temi_robots`),
      query(
        `SELECT o.name as org_name, COUNT(v.id) as visits_today
         FROM organizations o
         LEFT JOIN visits v ON v.organization_id = o.id AND DATE(v.created_at) = CURRENT_DATE
         GROUP BY o.id, o.name ORDER BY visits_today DESC LIMIT 10`
      ),
    ]);

    res.json({
      organizations: orgs.rows[0],
      totalUsers: parseInt(totalUsers.rows[0].count),
      totalVisits: parseInt(totalVisits.rows[0].count),
      totalRobots: parseInt(totalRobots.rows[0].count),
      recentActivity: recentActivity.rows,
    });
  } catch (err) {
    next(err);
  }
};

// ── All robots across all orgs ─────────────────────────────────────────────

const listAllRobots = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT t.*, o.name as org_name, l.name as location_name
       FROM temi_robots t
       LEFT JOIN organizations o ON o.id = t.organization_id
       LEFT JOIN locations l ON l.id = t.location_id
       ORDER BY o.name, t.name`
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  listOrganizations, getOrganization, createOrganization, updateOrganization, deleteOrganization,
  getPlatformAnalytics, listAllRobots,
};
