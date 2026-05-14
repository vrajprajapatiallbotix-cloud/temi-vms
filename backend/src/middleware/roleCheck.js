const { ROLES } = require('../config/constants');

const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  next();
};

const requireAdmin = requireRole(ROLES.ADMIN);
const requireEmployee = requireRole(ROLES.ADMIN, ROLES.EMPLOYEE);
const requireSecurity = requireRole(ROLES.ADMIN, ROLES.SECURITY);

module.exports = { requireRole, requireAdmin, requireEmployee, requireSecurity };
