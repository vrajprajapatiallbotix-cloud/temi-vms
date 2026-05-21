const { query } = require('../config/database');
const { createOTPSession, validateOTP } = require('../services/otpService');
const { sendOTPCode } = require('../services/emailService');
const { notifyEmployee } = require('../services/notificationService');
const { VISIT_STATUS, SOCKET_EVENTS } = require('../config/constants');

let _io;
const setIo = (io) => { _io = io; };

/**
 * POST /api/otp/send
 * Body: { visitId, email }
 * Called by the kiosk or Temi app when the visitor wants to check in.
 * The visit must already be in APPROVED state.
 */
const sendOTP = async (req, res, next) => {
  try {
    const { visitId, email } = req.body;
    if (!visitId || !email) {
      return res.status(400).json({ error: 'visitId and email are required' });
    }

    // Verify visit exists and is approved
    const visitResult = await query(
      `SELECT v.*, vis.name as visitor_name, vis.email as visitor_email,
              u.name as host_name
       FROM visits v
       JOIN visitors vis ON vis.id = v.visitor_id
       LEFT JOIN users u ON u.id = v.host_employee_id
       WHERE v.id = $1`,
      [visitId]
    );

    if (!visitResult.rows.length) {
      return res.status(404).json({ error: 'Visit not found' });
    }

    const visit = visitResult.rows[0];

    // For impromptu visits, allow pending status (approval via OTP flow)
    const allowedStatuses = [VISIT_STATUS.APPROVED, VISIT_STATUS.PENDING];
    if (!allowedStatuses.includes(visit.status)) {
      return res.status(400).json({ error: `Visit status is '${visit.status}'. OTP cannot be sent.` });
    }

    // Use visitor's email from the visit record if provided email matches, else use provided
    const targetEmail = email.toLowerCase().trim();

    const { otp, expiresAt } = await createOTPSession({
      visitId: visit.id,
      email: targetEmail,
      organizationId: visit.organization_id,
    });

    await sendOTPCode({
      visitorEmail: targetEmail,
      visitorName: visit.visitor_name || 'Visitor',
      otp,
      hostName: visit.host_name,
      visitDate: visit.scheduled_at || visit.created_at,
    }).catch((e) => console.error('[OTP] Email error (non-fatal):', e.message));

    res.json({
      message: 'OTP sent to email',
      expiresAt,
      // Only reveal masked email for UX
      emailMasked: maskEmail(targetEmail),
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/otp/verify
 * Body: { email, otp }
 * Public endpoint — called from kiosk or Temi app.
 * On success: marks visit as checked_in, emits socket event.
 */
const verifyOTP = async (req, res, next) => {
  try {
    const { email, otp } = req.body;
    if (!otp) {
      return res.status(400).json({ error: 'otp is required' });
    }

    if (String(otp).length !== 6) {
      return res.status(400).json({ error: 'OTP must be 6 digits' });
    }

    const result = await validateOTP({ email: email || '', otp: String(otp) });

    if (!result.valid) {
      return res.status(401).json({
        error: result.error,
        message: result.message,
        attemptsLeft: result.attemptsLeft,
      });
    }

    // Fetch visit details to build response
    const visitResult = await query(
      `SELECT v.*, vis.name as visitor_name, vis.email as visitor_email,
              vis.phone as visitor_phone, vis.company as visitor_company,
              u.name as host_name, u.department as host_department,
              u.desk_location as host_desk_location
       FROM visits v
       JOIN visitors vis ON vis.id = v.visitor_id
       LEFT JOIN users u ON u.id = v.host_employee_id
       WHERE v.id = $1`,
      [result.visitId]
    );

    if (!visitResult.rows.length) {
      return res.status(404).json({ error: 'Visit not found' });
    }

    const visit = visitResult.rows[0];

    // Mark visit as checked in
    await query(
      `UPDATE visits SET status = $1, checked_in_at = NOW() WHERE id = $2`,
      [VISIT_STATUS.CHECKED_IN, visit.id]
    );

    // Emit socket event so employee dashboard updates in real time
    if (_io) {
      _io.to(`user:${visit.host_employee_id}`).emit(SOCKET_EVENTS.VISITOR_CHECKED_IN, {
        visitId: visit.id,
        visitorName: visit.visitor_name,
        hostName: visit.host_name,
      });
      // Also emit to Temi rooms
      _io.to(`temi:${visit.organization_id}`).emit(SOCKET_EVENTS.OTP_APPROVED, {
        visitId: visit.id,
        visitorName: visit.visitor_name,
        destination: visit.host_desk_location || visit.meeting_room,
        hostName: visit.host_name,
        hostDepartment: visit.host_department,
      });
    }

    res.json({
      valid: true,
      visit: {
        id: visit.id,
        visitorName:   visit.visitor_name,
        visitorCompany: visit.visitor_company,
        hostName:      visit.host_name,
        hostDepartment: visit.host_department,
        destination:   visit.host_desk_location || visit.meeting_room,
        meetingRoom:   visit.meeting_room,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/otp/request-walkın  (impromptu)
 * Body: { visitorName, visitorEmail, visitorPhone, visitorCompany, employeeId, purpose }
 * Called from kiosk walk-in. Creates visit, notifies employee, waits for approval.
 * Approval triggers OTP send via socket/approveVisit flow.
 */
const requestWalkIn = async (req, res, next) => {
  try {
    const { visitorName, visitorEmail, visitorPhone, visitorCompany, employeeId, purpose = 'Walk-in visit' } = req.body;

    if (!visitorName || !visitorEmail || !employeeId) {
      return res.status(400).json({ error: 'Name, email, and employee are required' });
    }

    const empResult = await query(
      `SELECT id, name, email, location_id, organization_id FROM users
       WHERE id = $1 AND role IN ('employee','admin','org_admin','org_super_admin') AND is_active = TRUE`,
      [employeeId]
    );
    if (!empResult.rows.length) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    const employee = empResult.rows[0];

    // Upsert visitor
    let visitorId;
    const existing = await query('SELECT id FROM visitors WHERE email = $1', [visitorEmail.toLowerCase()]);
    if (existing.rows.length) {
      visitorId = existing.rows[0].id;
      await query('UPDATE visitors SET name=$1, phone=$2, company=$3 WHERE id=$4',
        [visitorName, visitorPhone, visitorCompany, visitorId]);
    } else {
      const nv = await query(
        `INSERT INTO visitors (name, email, phone, company, organization_id)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [visitorName, visitorEmail.toLowerCase(), visitorPhone, visitorCompany, employee.organization_id]
      );
      visitorId = nv.rows[0].id;
    }

    const visitResult = await query(
      `INSERT INTO visits (visitor_id, host_employee_id, visit_type, purpose, status, location_id, organization_id)
       VALUES ($1, $2, 'impromptu', $3, 'pending', $4, $5) RETURNING *`,
      [visitorId, employeeId, purpose, employee.location_id, employee.organization_id]
    );

    const visit = visitResult.rows[0];

    // Notify employee via socket
    if (_io) {
      _io.to(`user:${employeeId}`).emit('visit:request', {
        visitId: visit.id,
        visitorName,
        visitorCompany,
        purpose,
      });
    }

    // Send approval request email to employee
    const { sendApprovalNotification } = require('../services/emailService');
    if (employee.email) {
      sendApprovalNotification({
        employeeEmail: employee.email,
        employeeName: employee.name,
        visitorName,
        visitorCompany,
        visitPurpose: purpose,
      }).catch((e) => console.error('[OTP WalkIn] Email error:', e.message));
    }

    res.status(201).json({
      visitId: visit.id,
      message: 'Visit request sent. Awaiting employee approval.',
    });
  } catch (err) {
    next(err);
  }
};

const maskEmail = (email) => {
  const [local, domain] = email.split('@');
  if (!domain) return email;
  const visible = local.length > 2 ? local.slice(0, 2) : local[0] || '*';
  return `${visible}${'*'.repeat(Math.max(0, local.length - 2))}@${domain}`;
};

module.exports = { sendOTP, verifyOTP, requestWalkIn, setIo };
