const logger = require('../config/logger');

function logMiddleware(req, res, next) {
  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;

    logger.info('Requête HTTP', {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: duration,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      idUser: req.user?.idUser || null
    });
  });

  next();
}

module.exports = logMiddleware;
