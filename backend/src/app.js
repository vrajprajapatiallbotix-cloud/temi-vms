require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { createServer } = require('http');
const { Server } = require('socket.io');

const authRoutes = require('./routes/auth');
const visitorRoutes = require('./routes/visitor');
const employeeRoutes = require('./routes/employee');
const adminRoutes = require('./routes/admin');
const qrRoutes = require('./routes/qr');
const temiRoutes = require('./routes/temi');
const errorHandler = require('./middleware/errorHandler');
const { initializeSocket } = require('./services/notificationService');
const { setIo } = require('./controllers/temiController');
const { setIo: setQrIo } = require('./controllers/qrController');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      const ok = [
        process.env.FRONTEND_URL || 'http://localhost:5173',
        /^http:\/\/192\.168\.\d+\.\d+:5173$/,
        /^http:\/\/10\.\d+\.\d+\.\d+:5173$/,
      ].some(o => o instanceof RegExp ? o.test(origin) : o === origin);
      cb(ok ? null : new Error('CORS blocked'), ok);
    },
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

initializeSocket(io);
setIo(io);
setQrIo(io);

app.use(helmet({ crossOriginEmbedderPolicy: false }));
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:5173',
  /^http:\/\/192\.168\.\d+\.\d+:5173$/,
  /^http:\/\/10\.\d+\.\d+\.\d+:5173$/,
];
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    const ok = allowedOrigins.some(o => o instanceof RegExp ? o.test(origin) : o === origin);
    cb(ok ? null : new Error('CORS blocked'), ok);
  },
  credentials: true,
}));

const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200 });
app.use('/api/', apiLimiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/visitor', visitorRoutes);
app.use('/api/employee', employeeRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/qr', qrRoutes);
app.use('/api/temi', temiRoutes);

app.get('/health', (req, res) =>
  res.json({ status: 'ok', timestamp: new Date().toISOString(), service: 'Temi VMS API' })
);

app.use(errorHandler);

module.exports = { app, httpServer, io };
