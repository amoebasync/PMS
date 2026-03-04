module.exports = {
  apps: [{
    name: 'pms',
    script: './server.js',
    instances: 2,
    exec_mode: 'cluster',
  }],
};
