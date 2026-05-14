require('dotenv').config();

const { httpServer } = require('./app');
const { pool } = require('./config/database');

const PORT = process.env.PORT || 5000;

const start = async () => {
  try {
    await pool.query('SELECT 1');
    console.log('✅ Database connected');

    httpServer.listen(PORT, () => {
      console.log(`🚀 Temi VMS Server running on port ${PORT}`);
      console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`   Temi Serial: ${process.env.TEMI_SERIAL || 'not configured'}`);
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err.message);
    process.exit(1);
  }
};

process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down...');
  await pool.end();
  process.exit(0);
});

start();
