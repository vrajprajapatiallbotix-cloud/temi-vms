const { query } = require('../config/database');
const { SOCKET_EVENTS, NOTIFICATION_TYPES } = require('../config/constants');

let io;

const initializeSocket = (socketIo) => {
  io = socketIo;

  io.on('connection', (socket) => {
    socket.on('join', ({ userId, role }) => {
      socket.join(`user:${userId}`);
      if (['admin','org_admin','org_super_admin'].includes(role)) socket.join('admin');
      console.log(`Socket joined: user:${userId} (${role})`);
    });

    socket.on('temi:join', ({ serial, organizationId }) => {
      socket.join(`temi:${serial}`);
      if (organizationId) socket.join(`temi:${organizationId}`);
      console.log(`Temi joined: temi:${serial}`);
    });

    socket.on('visit:join', ({ visitId }) => {
      socket.join(`visit:${visitId}`);
    });

    // Kiosk joins org room to receive OTP approval events
    socket.on('org:join', ({ organizationId }) => {
      if (organizationId) socket.join(`org:${organizationId}`);
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected:', socket.id);
    });
  });
};

const createNotification = async ({ userId, visitId, type, title, message }) => {
  const result = await query(
    `INSERT INTO notifications (user_id, visit_id, type, title, message)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [userId, visitId, type, title, message]
  );
  const notification = result.rows[0];

  if (io) {
    io.to(`user:${userId}`).emit(SOCKET_EVENTS.NOTIFICATION, notification);
  }

  return notification;
};

const notifyVisitRequest = async ({ employeeId, visitId, visitorName, visitorCompany }) => {
  await createNotification({
    userId: employeeId,
    visitId,
    type: NOTIFICATION_TYPES.VISIT_REQUEST,
    title: 'New Visitor Request',
    message: `${visitorName}${visitorCompany ? ` from ${visitorCompany}` : ''} is waiting for your approval.`,
  });

  if (io) {
    io.to(`user:${employeeId}`).emit(SOCKET_EVENTS.VISIT_REQUEST, { visitId, visitorName, visitorCompany });
  }
};

const notifyVisitApproved = async ({ employeeId, visitId, visitorEmail, visitorName }) => {
  if (io) {
    io.to('admin').emit(SOCKET_EVENTS.VISIT_APPROVED, { visitId, visitorName });
  }
};

const notifyVisitorCheckedIn = async ({ employeeId, visitId, visitorName, meetingRoom }) => {
  await createNotification({
    userId: employeeId,
    visitId,
    type: NOTIFICATION_TYPES.VISITOR_CHECKED_IN,
    title: 'Visitor Checked In',
    message: `${visitorName} has checked in${meetingRoom ? ` and is heading to ${meetingRoom}` : ''}.`,
  });

  if (io) {
    io.to(`user:${employeeId}`).emit(SOCKET_EVENTS.VISITOR_CHECKED_IN, { visitId, visitorName, meetingRoom });
    io.to('admin').emit(SOCKET_EVENTS.VISITOR_CHECKED_IN, { visitId, visitorName, meetingRoom });
  }
};

const getUnreadNotifications = async (userId) => {
  const result = await query(
    `SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
    [userId]
  );
  return result.rows;
};

const markNotificationsRead = async (userId, notificationIds) => {
  if (notificationIds && notificationIds.length > 0) {
    await query(
      `UPDATE notifications SET is_read = TRUE WHERE user_id = $1 AND id = ANY($2)`,
      [userId, notificationIds]
    );
  } else {
    await query(
      'UPDATE notifications SET is_read = TRUE WHERE user_id = $1',
      [userId]
    );
  }
};

const emitToVisit = (visitId, event, data) => {
  if (io) io.to(`visit:${visitId}`).emit(event, data);
};

module.exports = {
  initializeSocket,
  createNotification,
  notifyVisitRequest,
  notifyVisitApproved,
  notifyVisitorCheckedIn,
  getUnreadNotifications,
  markNotificationsRead,
  emitToVisit,
};
