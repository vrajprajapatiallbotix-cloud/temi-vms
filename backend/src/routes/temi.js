const router = require('express').Router();
const { heartbeat, getConfig, getLocations, checkoutVisit, reportError } = require('../controllers/temiController');
const { authenticateTemi } = require('../middleware/auth');

router.use(authenticateTemi);

router.post('/heartbeat', heartbeat);
router.get('/config/:serial', getConfig);
router.get('/locations/:serial', getLocations);
router.post('/checkout', checkoutVisit);
router.post('/error', reportError);

module.exports = router;
