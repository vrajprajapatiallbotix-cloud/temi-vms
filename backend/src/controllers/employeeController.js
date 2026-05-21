const { query } = require('../config/database');
const { sendOTPCode, sendVisitDeclined } = require('../services/emailService');
const { notifyVisitApproved, emitToVisit } = require('../services/notificationService');
const { createOTPSession } = require('../services/otpService');
const { VISIT_STATUS } = require('../config/constants');

// GET /employee/visits — upcoming + recent visits
const getVisits = async (req, res, next) => {
  try {
    const { status, type, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let conditions = ['v.host_employee_id = $1'];
    const params = [req.user.id];
    let paramCount = 1;

    if (status) {
      paramCount++;
      conditions.push(`v.status = $${paramCount}`);
      params.push(status);
    }
    if (type) {
      paramCount++;
      conditions.push(`v.visit_type = $${paramCount}`);
      params.push(type);
    }

    const whereClause = conditions.join(' AND ');
    const countResult = await query(
      `SELECT COUNT(*) FROM visits v WHERE ${whereClause}`,
      params
    );

    paramCount++;
    params.push(limit);
    paramCount++;
    params.push(offset);

    const result = await query(
      `SELECT v.*, vis.name as visitor_name, vis.email as visitor_email,
              vis.phone as visitor_phone, vis.company, vis.photo_url,
              qr.expires_at as qr_expires_at, qr.is_used as qr_used
       FROM visits v
       JOIN visitors vis ON vis.id = v.visitor_id
       LEFT JOIN qr_codes qr ON qr.visit_id = v.id
       WHERE ${whereClause}
       ORDER BY COALESCE(v.scheduled_at, v.created_at) DESC
       LIMIT $${paramCount - 1} OFFSET $${paramCount}`,
      params
    );

    res.json({
      visits: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      limit: parseInt(limit),
    });
  } catch (err) {
    next(err);
  }
};

// GET /employee/visits/pending — visits awaiting approval
// Admins see ALL pending visits; employees see only their own
const getPendingApprovals = async (req, res, next) => {
  try {
    let result;
    if (req.user.role === 'admin') {
      result = await query(
        `SELECT v.*, vis.name as visitor_name, vis.email as visitor_email,
                vis.phone as visitor_phone, vis.company,
                u.name as host_name, u.department as host_department, u.desk_location as host_location
         FROM visits v
         JOIN visitors vis ON vis.id = v.visitor_id
         JOIN users u ON u.id = v.host_employee_id
         WHERE v.status = 'pending' AND v.visit_type = 'impromptu'
         ORDER BY v.created_at DESC`
      );
    } else {
      result = await query(
        `SELECT v.*, vis.name as visitor_name, vis.email as visitor_email,
                vis.phone as visitor_phone, vis.company
         FROM visits v
         JOIN visitors vis ON vis.id = v.visitor_id
         WHERE v.host_employee_id = $1 AND v.status = 'pending' AND v.visit_type = 'impromptu'
         ORDER BY v.created_at DESC`,
        [req.user.id]
      );
    }
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

// POST /employee/approve — approve or decline impromptu visit
const approveVisit = async (req, res, next) => {
  try {
    const { visitId, action, declineReason, meetingRoom } = req.body;

    if (!visitId || !['approve', 'decline'].includes(action)) {
      return res.status(400).json({ error: 'visitId and action (approve/decline) required' });
    }

    // Admins can approve any visit; employees only their own
    const visitResult = await query(
      `SELECT v.*, vis.email as visitor_email, vis.name as visitor_name
       FROM visits v JOIN visitors vis ON vis.id = v.visitor_id
       WHERE v.id = $1 ${req.user.role !== 'admin' ? 'AND v.host_employee_id = $2' : ''}`,
      req.user.role !== 'admin' ? [visitId, req.user.id] : [visitId]
    );

    if (!visitResult.rows.length) {
      return res.status(404).json({ error: 'Visit not found or unauthorized' });
    }

    const visit = visitResult.rows[0];
    if (visit.status !== VISIT_STATUS.PENDING) {
      return res.status(409).json({ error: `Visit is already ${visit.status}` });
    }

    if (action === 'approve') {
      await query(
        `UPDATE visits SET status = $1, approved_by = $2, approved_at = NOW()
         ${meetingRoom ? ', meeting_room = $4' : ''} WHERE id = $3`,
        meetingRoom
          ? [VISIT_STATUS.APPROVED, req.user.id, visitId, meetingRoom]
          : [VISIT_STATUS.APPROVED, req.user.id, visitId]
      );

      // Generate OTP and email it to visitor
      let otpSent = false;
      if (visit.visitor_email) {
        const { otp, expiresAt } = await createOTPSession({
          visitId: parseInt(visitId),
          email: visit.visitor_email,
          organizationId: visit.organization_id || req.user.organization_id,
        });
        await sendOTPCode({
          visitorEmail: visit.visitor_email,
          visitorName: visit.visitor_name,
          otp,
          hostName: req.user.name,
        }).catch((e) => console.error('OTP email error:', e.message));
        otpSent = true;
      }

      await notifyVisitApproved({
        employeeId: req.user.id,
        visitId,
        visitorEmail: visit.visitor_email,
        visitorName: visit.visitor_name,
      });

      // Notify kiosk that visit was approved (visitor can now use OTP)
      emitToVisit(visitId, 'visit:approved', { visitId, otpSent });

      await query(
        `INSERT INTO audit_logs (action, entity_type, entity_id, performed_by, metadata)
         VALUES ('approve_visit', 'visit', $1, $2, $3)`,
        [visitId, req.user.id, JSON.stringify({ visitorName: visit.visitor_name })]
      );

      res.json({ message: 'Visit approved. OTP sent to visitor email.', otpSent });
    } else {
      await query(
        'UPDATE visits SET status = $1, declined_reason = $2 WHERE id = $3',
        [VISIT_STATUS.DECLINED, declineReason, visitId]
      );

      if (visit.visitor_email) {
        await sendVisitDeclined({
          visitorEmail: visit.visitor_email,
          visitorName: visit.visitor_name,
          reason: declineReason,
        }).catch((e) => console.error('Decline email error:', e.message));
      }

      await query(
        `INSERT INTO audit_logs (action, entity_type, entity_id, performed_by, metadata)
         VALUES ('decline_visit', 'visit', $1, $2, $3)`,
        [visitId, req.user.id, JSON.stringify({ reason: declineReason })]
      );

      res.json({ message: 'Visit declined.' });
    }
  } catch (err) {
    next(err);
  }
};

// GET /employee/notifications
const getNotifications = async (req, res, next) => {
  try {
    const { getUnreadNotifications } = require('../services/notificationService');
    const notifications = await getUnreadNotifications(req.user.id);
    res.json(notifications);
  } catch (err) {
    next(err);
  }
};

// POST /employee/notifications/read
const markNotificationsRead = async (req, res, next) => {
  try {
    const { markNotificationsRead: markRead } = require('../services/notificationService');
    await markRead(req.user.id, req.body.ids);
    res.json({ message: 'Notifications marked as read' });
  } catch (err) {
    next(err);
  }
};

// GET /visitor/employees/search — PUBLIC, returns minimal fields for kiosk walk-in form
const searchEmployeesPublic = async (req, res, next) => {
  try {
    const { q = '' } = req.query;
    const result = await query(
      `SELECT id, name, department, desk_location
       FROM users
       WHERE role IN ('employee', 'admin') AND is_active = TRUE
         AND (name ILIKE $1 OR department ILIKE $1)
       ORDER BY name ASC LIMIT 10`,
      [`%${q}%`]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

module.exports = { getVisits, getPendingApprovals, approveVisit, getNotifications, markNotificationsRead, searchEmployeesPublic };
