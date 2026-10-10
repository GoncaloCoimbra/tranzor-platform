const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  const backendUrl = process.env.DOCKER_BACKEND_URL || process.env.VITE_API_URL || 'http://localhost:3000';

  console.log('[setupProxy] Backend URL configured as:', backendUrl);

  app.use('/api', createProxyMiddleware({ target: backendUrl, changeOrigin: true, logLevel: 'debug' }));
  app.use('/ws', createProxyMiddleware({ target: backendUrl, changeOrigin: true, ws: true, logLevel: 'debug' }));
};
