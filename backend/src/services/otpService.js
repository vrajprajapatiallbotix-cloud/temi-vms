const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { query } = require('../config/database');
const { OTP } = require('../config/constants');

const generateOTP = () => {
  return String(crypto.randomInt(100000, 999999));
};

/**
 * Create a new OTP session for a visit.
 * Invalidates any previous unused sessions for this email + visit.
 * Returns the plaintext OTP (to be emailed) and the session id.
 */
const createOTPSession = async ({ visitId, email, organizationId }) => {
  await query(
    `UPDATE otp_sessions SET used = TRUE WHERE visit_id = $1 AND used = FALSE`,
    [visitId]
  );

  const otp = generateOTP();
  const hash = await bcrypt.hash(otp, 10);
  const expiresAt = new Date(Date.now() + OTP.EXPIRY_MINUTES * 60 * 1000);

  const result = await query(
    `INSERT INTO otp_sessions (visit_id, email, otp_hash, expires_at, organization_id)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [visitId, email.toLowerCase(), hash, expiresAt, organizationId || null]
  );

  return { otp, sessionId: result.rows[0].id, expiresAt };
};

/**
 * Validate an OTP.
 * When email is provided, looks up the session by email (original behaviour).
 * When email is omitted, searches all recent active sessions and matches by OTP hash.
 */
const validateOTP = async ({ email, otp }) => {
  if (email && email.trim()) {
    // Email-based lookup (original path)
    const result = await query(
      `SELECT * FROM otp_sessions
       WHERE email = $1 AND used = FALSE AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [email.toLowerCase()]
    );

    if (!result.rows.length) {
      return { valid: false, error: 'OTP_NOT_FOUND', message: 'No active OTP found. Please request a new one.' };
    }

    const session = result.rows[0];

    if (session.attempts >= session.max_attempts) {
      return { valid: false, error: 'OTP_MAX_ATTEMPTS', message: 'Too many incorrect attempts. Please request a new OTP.' };
    }

    const match = await bcrypt.compare(otp.trim(), session.otp_hash);

    if (!match) {
      await query(
        `UPDATE otp_sessions SET attempts = attempts + 1 WHERE id = $1`,
        [session.id]
      );
      const attemptsLeft = session.max_attempts - session.attempts - 1;
      return {
        valid: false,
        error: 'OTP_INVALID',
        message: `Incorrect OTP. ${attemptsLeft} attempt${attemptsLeft !== 1 ? 's' : ''} remaining.`,
        attemptsLeft,
      };
    }

    await query(`UPDATE otp_sessions SET used = TRUE WHERE id = $1`, [session.id]);
    return { valid: true, visitId: session.visit_id, sessionId: session.id };
  }

  // No email: scan recent active sessions and match by hash
  const result = await query(
    `SELECT * FROM otp_sessions
     WHERE used = FALSE AND expires_at > NOW() AND attempts < max_attempts
     ORDER BY created_at DESC LIMIT 50`,
    []
  );

  if (!result.rows.length) {
    return { valid: false, error: 'OTP_NOT_FOUND', message: 'No active OTP found. Please request a new one.' };
  }

  for (const session of result.rows) {
    const match = await bcrypt.compare(otp.trim(), session.otp_hash);
    if (match) {
      await query(`UPDATE otp_sessions SET used = TRUE WHERE id = $1`, [session.id]);
      return { valid: true, visitId: session.visit_id, sessionId: session.id };
    }
  }

  return {
    valid: false,
    error: 'OTP_INVALID',
    message: 'Incorrect OTP. Please try again.',
  };
};

/**
 * Check if a visit already has a valid (unused, unexpired) OTP session.
 */
const hasActiveSession = async (visitId) => {
  const r = await query(
    `SELECT id FROM otp_sessions WHERE visit_id = $1 AND used = FALSE AND expires_at > NOW() LIMIT 1`,
    [visitId]
  );
  return r.rows.length > 0;
};

module.exports = { createOTPSession, validateOTP, hasActiveSession };
