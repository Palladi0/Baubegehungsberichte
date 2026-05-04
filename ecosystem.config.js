/** @type {import('pm2').ProcessDescription} */
module.exports = {
  apps: [
    {
      name: 'baubegehungsberichte',
      script: 'node_modules/.bin/next',
      args: 'start',
      cwd: '/var/www/baubegehungsberichte',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      error_file: '/var/log/pm2/baubegehungsberichte-error.log',
      out_file: '/var/log/pm2/baubegehungsberichte-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
