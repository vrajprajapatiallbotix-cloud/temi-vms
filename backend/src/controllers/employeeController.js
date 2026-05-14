const { query } = require('../config/database');
const { createQRCodeRecord } = require('../services/qrService');
const { sendQRCode, sendVisitDeclined } = require('../services/emailService');
const { notifyVisitApproved, emitToVisit } = require('../services/notificationService');
const { VISIT_STATUS, VISIT_TYPES } = require('../config/constants');

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
const getPendingApprovals = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT v.*, vis.name as visitor_name, vis.email as visitor_email,
              vis.phone as visitor_phone, vis.company
       FROM visits v
       JOIN visitors vis ON vis.id = v.visitor_id
       WHERE v.host_employee_id = $1 AND v.status = 'pending' AND v.visit_type = 'impromptu'
       ORDER BY v.created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

// POST /employee/approve — approve or decline impromptu visit
const approveVisit = async (req, res, next) => {
  try {
    const { visitId, action, declineReason } = req.body;

    if (!visitId || !['approve', 'decline'].includes(action)) {
      return res.status(400).json({ error: 'visitId and action (approve/decline) required' });
    }

    const visitResult = await query(
      `SELECT v.*, vis.email as visitor_email, vis.name as visitor_name
       FROM visits v JOIN visitors vis ON vis.id = v.visitor_id
       WHERE v.id = $1 AND v.host_employee_id = $2`,
      [visitId, req.user.id]
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
        'UPDATE visits SET status = $1, approved_by = $2, approved_at = NOW() WHERE id = $3',
        [VISIT_STATUS.APPROVED, req.user.id, visitId]
      );

      // Generate QR code
      const { qrImage, expiresAt } = await createQRCodeRecord(visitId, VISIT_TYPES.IMPROMPTU);

      // Send QR to visitor
      if (visit.visitor_email) {
        await sendQRCode({
          visitorEmail: visit.visitor_email,
          visitorName: visit.visitor_name,
          qrImageBase64: qrImage,
          visitDate: new Date(),
          location: 'Main Reception',
        }).catch((e) => console.error('QR email error:', e.message));
      }

      await notifyVisitApproved({
        employeeId: req.user.id,
        visitId,
        visitorEmail: visit.visitor_email,
        visitorName: visit.visitor_name,
      });

      // Push QR to kiosk screen so the visitor sees it immediately
      emitToVisit(visitId, 'visit:approved_qr', { qrImage, expiresAt });

      await query(
        `INSERT INTO audit_logs (action, entity_type, entity_id, performed_by, metadata)
         VALUES ('approve_visit', 'visit', $1, $2, $3)`,
        [visitId, req.user.id, JSON.stringify({ visitorName: visit.visitor_name })]
      );

      res.json({ message: 'Visit approved. QR code sent to visitor.', qrImage, expiresAt });
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
