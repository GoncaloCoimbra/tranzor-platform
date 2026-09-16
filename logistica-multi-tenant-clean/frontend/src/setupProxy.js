const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  // In Docker environment with docker-compose, the React dev server
  // can communicate directly with the backend container via hostname
  // Use the local backend port unless Docker provides an explicit target.
  const backendUrl = process.env.DOCKER_BACKEND_URL || 'http://localhost:3000';

  console.log('[setupProxy] Backend URL configured as:', backendUrl);

  app.use(
    '/api',
    createProxyMiddleware({
      target: backendUrl,
      changeOrigin: true,
      logLevel: 'debug'
    })
  );

  app.use(
    '/ws',
    createProxyMiddleware({
      target: backendUrl,
      changeOrigin: true,
      ws: true,
      logLevel: 'debug'
    })
  );
};