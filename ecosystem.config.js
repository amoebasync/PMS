module.exports = {
  apps: [{
    name: 'pms',
    script: './node_modules/.bin/next',
    args: 'start -H 0.0.0.0',
    instances: 2,
    exec_mode: 'cluster',
  }],
};
