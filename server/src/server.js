'use strict';
require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/database');
const { startExpiryJob, stopExpiryJob } = require('./jobs/documentExpiryJob');
const mongoose = require('mongoose');

const PORT = process.env.PORT || 5000;

async function start() {
  try {
    await connectDB();
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`[server] Scholarship Desk API listening on 0.0.0.0:${PORT} (${process.env.NODE_ENV || 'development'})`);
    });

    // Start background jobs after server is up
    startExpiryJob();

    // Graceful shutdown
    const shutdown = (signal) => {
      console.log(`[server] ${signal} received – shutting down gracefully`);
      stopExpiryJob();
      server.close(async () => {
        console.log('[server] HTTP server closed');
        try {
          await mongoose.connection.close(false);
          console.log('[db] MongoDB connection closed');
        } catch (dbErr) {
          console.error('[db] Error closing MongoDB connection:', dbErr.message);
        }
        process.exit(0);
      });
      setTimeout(() => {
        console.error('[server] Forced exit after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (err) {
    console.error('[server] Startup failed:', err.message);
    process.exit(1);
  }
}

start();
