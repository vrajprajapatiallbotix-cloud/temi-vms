const { query } = require('../config/database');
const { SOCKET_EVENTS } = require('../config/constants');

let io;
const setIo = (socketIo) => { io = socketIo; };

// POST /temi/heartbeat — Temi robot pings to update status
const heartbeat = async (req, res, next) => {
  try {
    const { serial, status = 'online', currentTask, batteryLevel } = req.body;
    if (!serial) return res.status(400).json({ error: 'Serial number required' });

    await query(
      `UPDATE temi_robots
       SET status = $1, current_task = $2, last_seen = NOW()
       WHERE serial_number = $3`,
      [status, currentTask, serial]
    );

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

// GET /temi/config/:serial — Temi fetches its configuration
const getConfig = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT t.*, l.name as location_name, l.address as location_address
       FROM temi_robots t
       LEFT JOIN locations l ON l.id = t.location_id
       WHERE t.serial_number = $1`,
      [req.params.serial]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Robot not registered' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

// POST /temi/locations/sync — Temi pushes its saved locations to backend
const syncLocations = async (req, res, next) => {
  try {
    const { serial, locations } = req.body;
    if (!serial || !Array.isArray(locations)) {
      return res.status(400).json({ error: 'serial and locations[] required' });
    }

    // Add column if first time
    await query(
      `ALTER TABLE temi_robots ADD COLUMN IF NOT EXISTS saved_locations JSONB DEFAULT '[]'`
    );

    await query(
      `UPDATE temi_robots SET saved_locations = $1, last_seen = NOW() WHERE serial_number = $2`,
      [JSON.stringify(locations), serial]
    );

    // Notify admin dashboard of location update
    if (io) io.to('admin').emit('temi:locations_synced', { serial, locations });

    console.log(`[Temi ${serial}] Synced ${locations.length} locations:`, locations);
    res.json({ ok: true, synced: locations.length, locations });
  } catch (err) {
    next(err);
  }
};

// GET /temi/locations/:serial — Get saved navigation locations for this Temi
const getLocations = async (req, res, next) => {
  try {
    await query(
      `ALTER TABLE temi_robots ADD COLUMN IF NOT EXISTS saved_locations JSONB DEFAULT '[]'`
    ).catch(() => {});

    const result = await query(
      `SELECT saved_locations FROM temi_robots WHERE serial_number = $1`,
      [req.params.serial]
    );

    const savedRooms = result.rows[0]?.saved_locations?.length
      ? result.rows[0].saved_locations
      : ['reception', 'meeting_room_a', 'meeting_room_b', 'conference_hall', 'lobby', 'waiting_area'];

    res.json({ savedRooms });
  } catch (err) {
    next(err);
  }
};

// POST /temi/checkout — Temi marks visit as completed
const checkoutVisit = async (req, res, next) => {
  try {
    const { visitId } = req.body;
    if (!visitId) return res.status(400).json({ error: 'visitId required' });

    await query(
      'UPDATE visits SET status = $1, checked_out_at = NOW() WHERE id = $2',
      ['completed', visitId]
    );

    await query(
      `INSERT INTO audit_logs (action, entity_type, entity_id, metadata)
       VALUES ('visitor_checkout', 'visit', $1, $2)`,
      [visitId, JSON.stringify({ source: 'temi' })]
    );

    if (io) {
      io.to('admin').emit('visit:completed', { visitId });
    }

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

// POST /temi/error — Temi reports an error event
const reportError = async (req, res, next) => {
  try {
    const { serial, errorType, visitId, message } = req.body;

    await query(
      `INSERT INTO audit_logs (action, entity_type, entity_id, metadata)
       VALUES ('temi_error', 'temi_robot', $1, $2)`,
      [null, JSON.stringify({ serial, errorType, visitId, message })]
    );

    if (io) {
      io.to('admin').emit('temi:error', { serial, errorType, visitId, message });
    }

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

module.exports = { heartbeat, getConfig, getLocations, syncLocations, checkoutVisit, reportError, setIo };
