const winston = require('winston');
const path = require('path');
const fs = require('fs');

const logsDirectory =
  process.env.LOG_DIR || path.join(__dirname, '../../logs');

fs.mkdirSync(logsDirectory, { recursive: true });

const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,

  transports: [
    new winston.transports.File({
      filename: path.join(logsDirectory, 'error.log'),
      level: 'error',
      maxsize: 5 * 1024 * 1024,
      maxFiles: 5
    }),

    new winston.transports.File({
      filename: path.join(logsDirectory, 'application.log'),
      maxsize: 10 * 1024 * 1024,
      maxFiles: 5
    }),

    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

module.exports = logger;
