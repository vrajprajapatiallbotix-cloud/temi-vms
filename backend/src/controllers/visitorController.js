const { query } = require('../config/database');
const { createQRCodeRecord } = require('../services/qrService');
const { sendVisitorInvite, sendQRCode } = require('../services/emailService');
const { notifyVisitRequest } = require('../services/notificationService');
const { generateSecureToken } = require('../utils/helpers');
const { VISIT_TYPES, VISIT_STATUS } = require('../config/constants');

// POST /visitor/preplanned — Employee creates pre-planned visit
const createPrePlanned = async (req, res, next) => {
  try {
    const {
      visitorName, visitorEmail, visitorPhone, visitorCompany,
      purpose, scheduledAt, meetingRoom, notes,
    } = req.body;

    if (!visitorName || !visitorEmail || !purpose || !scheduledAt) {
      return res.status(400).json({ error: 'Name, email, purpose, and scheduled date are required' });
    }

    // Upsert visitor
    let visitorResult = await query(
      'SELECT id FROM visitors WHERE email = $1',
      [visitorEmail.toLowerCase()]
    );

    let visitorId;
    if (visitorResult.rows.length) {
      visitorId = visitorResult.rows[0].id;
      await query(
        'UPDATE visitors SET name = $1, phone = $2, company = $3 WHERE id = $4',
        [visitorName, visitorPhone, visitorCompany, visitorId]
      );
    } else {
      const newVisitor = await query(
        'INSERT INTO visitors (name, email, phone, company) VALUES ($1, $2, $3, $4) RETURNING id',
        [visitorName, visitorEmail.toLowerCase(), visitorPhone, visitorCompany]
      );
      visitorId = newVisitor.rows[0].id;
    }

    // Create visit record with secure token for visitor form link
    const secureToken = generateSecureToken();
    const visitResult = await query(
      `INSERT INTO visits (visitor_id, host_employee_id, visit_type, purpose, status, scheduled_at, meeting_room, secure_token, notes, location_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [visitorId, req.user.id, VISIT_TYPES.PRE_PLANNED, purpose, VISIT_STATUS.APPROVED,
       scheduledAt, meetingRoom, secureToken, notes, req.user.location_id]
    );

    const visit = visitResult.rows[0];
    const secureLink = `${process.env.FRONTEND_URL}/visitor/register/${secureToken}`;

    // Send invite email
    if (visitorEmail) {
      await sendVisitorInvite({
        visitorEmail,
        visitorName,
        employeeName: req.user.name,
        visitDate: scheduledAt,
        secureLink,
      }).catch((e) => console.error('Email error:', e.message));
    }

    await query(
      `INSERT INTO audit_logs (action, entity_type, entity_id, performed_by, metadata)
       VALUES ('create_preplanned_visit', 'visit', $1, $2, $3)`,
      [visit.id, req.user.id, JSON.stringify({ visitorName, visitorEmail })]
    );

    res.status(201).json({ visit, secureLink });
  } catch (err) {
    next(err);
  }
};

// POST /visitor/impromptu — Security/kiosk creates impromptu visit
const createImpromptu = async (req, res, next) => {
  try {
    const { visitorName, visitorEmail, visitorPhone, visitorCompany, purpose, employeeId } = req.body;

    if (!visitorName || !purpose || !employeeId) {
      return res.status(400).json({ error: 'Name, purpose, and employee are required' });
    }

    // Check employee exists
    const empResult = await query(
      `SELECT id, name, email, location_id FROM users
       WHERE id = $1 AND role IN ('employee', 'admin') AND is_active = TRUE`,
      [employeeId]
    );
    if (!empResult.rows.length) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    const employee = empResult.rows[0];

    // Upsert visitor
    let visitorId;
    if (visitorEmail) {
      const existing = await query('SELECT id FROM visitors WHERE email = $1', [visitorEmail.toLowerCase()]);
      if (existing.rows.length) {
        visitorId = existing.rows[0].id;
        await query('UPDATE visitors SET name=$1, phone=$2, company=$3 WHERE id=$4',
          [visitorName, visitorPhone, visitorCompany, visitorId]);
      } else {
        const nv = await query(
          'INSERT INTO visitors (name, email, phone, company) VALUES ($1, $2, $3, $4) RETURNING id',
          [visitorName, visitorEmail.toLowerCase(), visitorPhone, visitorCompany]
        );
        visitorId = nv.rows[0].id;
      }
    } else {
      const nv = await query(
        'INSERT INTO visitors (name, phone, company) VALUES ($1, $2, $3) RETURNING id',
        [visitorName, visitorPhone, visitorCompany]
      );
      visitorId = nv.rows[0].id;
    }

    const visitResult = await query(
      `INSERT INTO visits (visitor_id, host_employee_id, visit_type, purpose, status, location_id)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [visitorId, employeeId, VISIT_TYPES.IMPROMPTU, purpose, VISIT_STATUS.PENDING, employee.location_id]
    );

    const visit = visitResult.rows[0];

    // Notify employee — wrapped so a notification failure never crashes the request
    try {
      await notifyVisitRequest({
        employeeId,
        visitId: visit.id,
        visitorName,
        visitorCompany,
      });
    } catch (e) {
      console.error('Notification error (non-fatal):', e.message);
    }

    // Send email notification to employee
    const { sendApprovalNotification } = require('../services/emailService');
    if (employee.email) {
      await sendApprovalNotification({
        employeeEmail: employee.email,
        employeeName: employee.name,
        visitorName,
        visitorCompany,
        visitPurpose: purpose,
      }).catch((e) => console.error('Email error:', e.message));
    }

    res.status(201).json({ visit, message: 'Visit request sent. Awaiting employee approval.' });
  } catch (err) {
    next(err);
  }
};

// GET /visitor/register/:token — Visitor accesses secure form link
const getVisitorForm = async (req, res, next) => {
  try {
    const { token } = req.params;
    const result = await query(
      `SELECT v.*, vis.name as visitor_name, vis.email as visitor_email, vis.company,
              u.name as employee_name, u.department
       FROM visits v
       JOIN visitors vis ON vis.id = v.visitor_id
       JOIN users u ON u.id = v.host_employee_id
       WHERE v.secure_token = $1`,
      [token]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Invalid or expired invitation link' });
    }

    const visit = result.rows[0];
    if (visit.status === 'declined' || visit.status === 'expired') {
      return res.status(410).json({ error: 'This invitation is no longer valid' });
    }

    res.json({
      visitId: visit.id,
      visitorName: visit.visitor_name,
      visitorEmail: visit.visitor_email,
      company: visit.company,
      employeeName: visit.employee_name,
      department: visit.department,
      scheduledAt: visit.scheduled_at,
      meetingRoom: visit.meeting_room,
    });
  } catch (err) {
    next(err);
  }
};

// POST /visitor/register/:token — Visitor submits form + gets QR
const submitVisitorForm = async (req, res, next) => {
  try {
    const { token } = req.params;
    const { fullName, company, phone, photo } = req.body;

    const result = await query(
      'SELECT v.*, vis.email as visitor_email FROM visits v JOIN visitors vis ON vis.id = v.visitor_id WHERE v.secure_token = $1',
      [token]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Invalid invitation link' });
    }

    const visit = result.rows[0];

    // Update visitor details
    const photoUrl = req.file ? `/uploads/${req.file.filename}` : undefined;
    await query(
      `UPDATE visitors SET name = COALESCE($1, name), company = COALESCE($2, company), phone = COALESCE($3, phone)
       ${photoUrl ? ', photo_url = $5' : ''} WHERE id = $4`,
      photoUrl
        ? [fullName, company, phone, visit.visitor_id, photoUrl]
        : [fullName, company, phone, visit.visitor_id]
    );

    // Generate QR
    const { token: qrToken, qrImage, expiresAt } = await createQRCodeRecord(visit.id, VISIT_TYPES.PRE_PLANNED);

    // Send QR via email
    if (visit.visitor_email) {
      await sendQRCode({
        visitorEmail: visit.visitor_email,
        visitorName: fullName,
        qrImageBase64: qrImage,
        visitDate: visit.scheduled_at,
        location: 'Main Reception',
      }).catch((e) => console.error('QR email error:', e.message));
    }

    res.json({
      message: 'Registration complete. QR code sent to your email.',
      qrImage,
      expiresAt,
    });
  } catch (err) {
    next(err);
  }
};

// GET /visitor/:id
const getVisitor = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT v.*, vis.name as visitor_name, vis.email, vis.phone, vis.company, vis.photo_url,
              u.name as employee_name, u.department, u.desk_location
       FROM visits v
       JOIN visitors vis ON vis.id = v.visitor_id
       JOIN users u ON u.id = v.host_employee_id
       WHERE v.id = $1`,
      [req.params.id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Visit not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

module.exports = { createPrePlanned, createImpromptu, getVisitorForm, submitVisitorForm, getVisitor };
