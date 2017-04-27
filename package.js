Package.describe({
  name: 'faburem:cloudron',
  version: '0.0.1',
  summary: 'OAuth handler for Cloudron',
  git: 'https://github.com/faburem/cloudron-oauth',
  documentation: 'README.md'
});

Package.onUse(function(api) {
  api.versionsFrom('1.2.1');
  api.use('ecmascript');
  api.use('oauth2', ['client', 'server']);
  api.use('oauth', ['client', 'server']);
  api.use('http', ['server']);
  api.use(['underscore', 'service-configuration'], ['client', 'server']);
  api.use(['random', 'templating'], 'client');

  api.export('Cloudron');

  api.addFiles('cloudron_server.js', 'server');
  api.addFiles('cloudron_client.js', 'client');
});
