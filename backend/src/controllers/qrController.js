const { query } = require('../config/database');
const { validateQRToken, markQRUsed } = require('../services/qrService');
const { notifyVisitorCheckedIn } = require('../services/notificationService');
const { VISIT_STATUS } = require('../config/constants');

let io;
const setIo = (socketIo) => { io = socketIo; };

// POST /qr/validate — Called by Temi robot to validate QR
const validateQR = async (req, res, next) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ error: 'Token required', code: 'MISSING_TOKEN' });
    }

    let visitId;
    try {
      const validated = await validateQRToken(token);
      visitId = validated.visitId;
    } catch (err) {
      return res.status(400).json({ error: err.message, code: err.code || 'QR_INVALID' });
    }

    // Fetch full visitor + visit info for Temi display
    const result = await query(
      `SELECT v.id as visit_id, v.purpose, v.meeting_room, v.visit_type, v.status,
              vis.name as visitor_name, vis.company, vis.photo_url,
              u.name as employee_name, u.desk_location, u.department
       FROM visits v
       JOIN visitors vis ON vis.id = v.visitor_id
       JOIN users u ON u.id = v.host_employee_id
       WHERE v.id = $1`,
      [visitId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Visit record not found', code: 'NOT_FOUND' });
    }

    const visitInfo = result.rows[0];

    // Mark QR as used and update visit status to checked_in
    await markQRUsed(token);
    await query(
      'UPDATE visits SET status = $1, checked_in_at = NOW() WHERE id = $2',
      [VISIT_STATUS.CHECKED_IN, visitId]
    );

    // Notify employee of check-in
    const hostResult = await query('SELECT host_employee_id FROM visits WHERE id = $1', [visitId]);
    if (hostResult.rows.length) {
      await notifyVisitorCheckedIn({
        employeeId: hostResult.rows[0].host_employee_id,
        visitId,
        visitorName: visitInfo.visitor_name,
        meetingRoom: visitInfo.meeting_room,
      }).catch((e) => console.error('Notification error:', e.message));
    }

    await query(
      `INSERT INTO audit_logs (action, entity_type, entity_id, metadata)
       VALUES ('qr_validated', 'visit', $1, $2)`,
      [visitId, JSON.stringify({ visitorName: visitInfo.visitor_name })]
    );

    // Notify Temi robot to escort visitor
    if (io) {
      const temiSerial = process.env.TEMI_SERIAL || '00126040079';
      const dest = visitInfo.meeting_room || visitInfo.desk_location || 'reception';
      const destLabel = dest.replace(/_/g, ' ');
      io.to(`temi:${temiSerial}`).emit('temi:escort', {
        visitId,
        visitorName: visitInfo.visitor_name,
        visitorCompany: visitInfo.company || '',
        hostName: visitInfo.employee_name || 'your host',
        hostDepartment: visitInfo.department || '',
        destination: dest,
        meetingRoom: visitInfo.meeting_room || '',
        instruction: visitInfo.meeting_room
          ? `Please follow me to ${destLabel}`
          : `Please follow me to ${visitInfo.employee_name}'s desk`,
      });
    }

    res.json({
      valid: true,
      visitor: {
        name: visitInfo.visitor_name,
        company: visitInfo.company,
        photoUrl: visitInfo.photo_url,
      },
      visit: {
        id: visitInfo.visit_id,
        purpose: visitInfo.purpose,
        meetingRoom: visitInfo.meeting_room,
        type: visitInfo.visit_type,
      },
      host: {
        name: visitInfo.employee_name,
        department: visitInfo.department,
        deskLocation: visitInfo.desk_location,
      },
      navigation: {
        destination: visitInfo.meeting_room || visitInfo.desk_location || 'reception',
        instruction: visitInfo.meeting_room
          ? `Please follow me to ${visitInfo.meeting_room}`
          : `Please follow me to ${visitInfo.employee_name}'s desk`,
      },
    });
  } catch (err) {
    next(err);
  }
};

// GET /qr/:visitId/image — Get QR code image for a visit
const getQRImage = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT q.qr_image_base64, q.expires_at, v.host_employee_id
       FROM qr_codes q JOIN visits v ON v.id = q.visit_id
       WHERE q.visit_id = $1`,
      [req.params.visitId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'QR code not found' });
    }

    const qr = result.rows[0];

    // Authorization: only host employee or admin
    if (req.user.role !== 'admin' && req.user.id !== qr.host_employee_id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    res.json({ qrImage: qr.qr_image_base64, expiresAt: qr.expires_at });
  } catch (err) {
    next(err);
  }
};

module.exports = { validateQR, getQRImage, setIo };
