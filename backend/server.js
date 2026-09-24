const app = require('./src/app');
const connectDB = require('./src/config/db');
const env = require('./src/config/env');

let server;

const startServer = async () => {
  // Connect to database
  await connectDB();

  server = app.listen(env.PORT, () => {
    console.log(`====================================================`);
    console.log(`  JEWELLERY ERP BACKEND SERVER RUNNING`);
    console.log(`  Port:        ${env.PORT}`);
    console.log(`  Environment: ${env.NODE_ENV}`);
    console.log(`  Health:      http://localhost:${env.PORT}/api/health`);
    console.log(`====================================================`);
  });
};

// Graceful shutdown handling
const gracefulShutdown = (signal) => {
  console.log(`\n[Server] Received ${signal}. Shutting down gracefully...`);
  if (server) {
    server.close(() => {
      console.log('[Server] HTTP server closed.');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (err) => {
  console.error('[Process] Unhandled Rejection:', err);
});

process.on('uncaughtException', (err) => {
  console.error('[Process] Uncaught Exception:', err);
  process.exit(1);
});

startServer();
