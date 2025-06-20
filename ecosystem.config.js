module.exports = {
  apps: [
    {
      // 개발 봇
      name: 'kimhunter-dev',
      script: './index.js',
      env: {
        NODE_ENV: 'development',
        ENV_TYPE: 'development'
      },
      watch: true,
      ignore_watch: ['node_modules', 'backup', '.git'],
      max_memory_restart: '1G'
    },
    {
      // 베타 봇
      name: 'kimhunter-beta',
      script: './index.js',
      env: {
        NODE_ENV: 'production',
        ENV_TYPE: 'beta'
      },
      instances: 1,
      exec_mode: 'cluster',
      max_memory_restart: '2G',
      error_file: './logs/beta-error.log',
      out_file: './logs/beta-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    },
    {
      // 프로덕션 봇 (향후 사용)
      name: 'kimhunter-prod',
      script: './index.js',
      env: {
        NODE_ENV: 'production',
        ENV_TYPE: 'production'
      },
      instances: 2,
      exec_mode: 'cluster',
      max_memory_restart: '4G',
      error_file: './logs/prod-error.log',
      out_file: './logs/prod-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    }
  ]
};