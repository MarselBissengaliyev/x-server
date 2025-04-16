import logger from '../services/loggerService.js';

export const isAuthenticated = (req, res, next) => {
  // Временно отключаем проверку аутентификации для тестирования
  logger.logAPI('AUTH', `${req.method} ${req.originalUrl}`, { 
    authBypass: true, 
    sessionUser: req.session?.user?.id || 'none'
  });
  console.log('Auth check bypassed for testing');
  return next();
  
  // Оригинальный код
  /*
  if (req.session && req.session.user) {
    logger.logAPI('AUTH_SUCCESS', `${req.method} ${req.originalUrl}`, { userId: req.session.user.id });
    return next();
  }
  logger.logAPI('AUTH_FAILED', `${req.method} ${req.originalUrl}`);
  res.status(401).json({ error: 'Unauthorized - Please log in' });
  */
}; 