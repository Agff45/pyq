const { exec } = require('child_process');
const config = require('../config');

let buildStatus = 'idle';
let buildTimer = null;

function build() {
  return new Promise((resolve) => {
    clearTimeout(buildTimer);

    buildTimer = setTimeout(() => {
      buildStatus = 'building';
      exec('hugo --minify', { cwd: config.hugoSitePath, timeout: 60000 }, (err, stdout, stderr) => {
        if (err) {
          buildStatus = 'error';
          console.error('Hugo 构建失败:', stderr);
          resolve({ success: false, error: stderr });
        } else {
          buildStatus = 'idle';
          console.log('Hugo 构建完成');
          resolve({ success: true });
        }
      });
    }, 2000);
  });
}

function getStatus() {
  return buildStatus;
}

module.exports = { build, getStatus };
