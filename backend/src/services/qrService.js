const QRCode = require('qrcode');
const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const { addHours, isExpired } = require('../utils/helpers');
const { QR_EXPIRY, VISIT_TYPES } = require('../config/constants');

const generateQRToken = (visitId, visitType) => {
  const expiryHours =
    visitType === VISIT_TYPES.PRE_PLANNED
      ? QR_EXPIRY.PRE_PLANNED_HOURS
      : QR_EXPIRY.IMPROMPTU_HOURS;

  const token = jwt.sign(
    { visitId, visitType },
    process.env.QR_SECRET,
    { expiresIn: `${expiryHours}h` }
  );

  const expiresAt = addHours(new Date(), expiryHours);
  return { token, expiresAt };
};

const generateQRImage = async (token) => {
  const qrDataUrl = await QRCode.toDataURL(token, {
    width: 300,
    margin: 2,
    color: { dark: '#1a1a2e', light: '#ffffff' },
    errorCorrectionLevel: 'H',
  });
  return qrDataUrl;
};

const createQRCodeRecord = async (visitId, visitType) => {
  const { token, expiresAt } = generateQRToken(visitId, visitType);
  const qrImage = await generateQRImage(token);

  await query('DELETE FROM qr_codes WHERE visit_id = $1', [visitId]);
  await query(
    `INSERT INTO qr_codes (visit_id, token, qr_image_base64, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [visitId, token, qrImage, expiresAt]
  );

  return { token, qrImage, expiresAt };
};

const validateQRToken = async (token) => {
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.QR_SECRET);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw Object.assign(new Error('QR code has expired'), { code: 'QR_EXPIRED' });
    }
    throw Object.assign(new Error('Invalid QR code'), { code: 'QR_INVALID' });
  }

  const result = await query(
    `SELECT q.*, v.status as visit_status
     FROM qr_codes q
     JOIN visits v ON v.id = q.visit_id
     WHERE q.token = $1`,
    [token]
  );

  if (!result.rows.length) {
    throw Object.assign(new Error('QR code not found'), { code: 'QR_NOT_FOUND' });
  }

  const qr = result.rows[0];

  if (qr.is_used) {
    throw Object.assign(new Error('QR code already used'), { code: 'QR_USED' });
  }
  if (isExpired(qr.expires_at)) {
    throw Object.assign(new Error('QR code has expired'), { code: 'QR_EXPIRED' });
  }
  if (qr.visit_status === 'declined') {
    throw Object.assign(new Error('Visit was declined'), { code: 'VISIT_DECLINED' });
  }
  if (qr.visit_status === 'expired') {
    throw Object.assign(new Error('Visit has expired'), { code: 'VISIT_EXPIRED' });
  }

  return { qrRecord: qr, visitId: decoded.visitId };
};

const markQRUsed = async (token) => {
  await query(
    'UPDATE qr_codes SET is_used = TRUE, used_at = NOW() WHERE token = $1',
    [token]
  );
};

module.exports = { createQRCodeRecord, validateQRToken, markQRUsed, generateQRImage };
