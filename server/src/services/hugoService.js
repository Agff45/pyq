const { exec, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const config = require('../config');

let buildStatus = 'idle';
let buildTimer = null;

const HUGO_BIN = (() => {
  const candidates = [
    'hugo',
    '/snap/bin/hugo',
    '/usr/local/bin/hugo',
    '/usr/bin/hugo',
    '/opt/hugo/bin/hugo',
  ];
  for (const bin of candidates) {
    try {
      execSync(`${bin} version 2>/dev/null`, { stdio: 'pipe' });
      console.log(`检测到 Hugo: ${bin}`);
      return bin;
    } catch {}
  }
  console.warn('未找到 Hugo 二进制文件');
  return 'hugo';
})();

function ensureThemeSymlink() {
  const themesDir = path.join(config.hugoSitePath, 'themes');
  const amigoLink = path.join(themesDir, 'Amigo');

  if (fs.existsSync(amigoLink)) return;

  try {
    if (!fs.existsSync(themesDir)) {
      fs.mkdirSync(themesDir, { recursive: true });
    }

    if (process.platform === 'win32') {
      const { execSync } = require('child_process');
      execSync(`mklink /D "${amigoLink}" "${config.hugoSitePath}"`, { stdio: 'pipe' });
    } else {
      fs.symlinkSync(config.hugoSitePath, amigoLink, 'dir');
    }
    console.log('已创建主题软链接: themes/Amigo');
  } catch (e) {
    // 可能已通过其他方式配置，忽略
    console.warn('主题软链接创建失败（可忽略）:', e.message);
  }
}

function build() {
  return new Promise((resolve) => {
    clearTimeout(buildTimer);

    buildTimer = setTimeout(() => {
      ensureThemeSymlink();
      buildStatus = 'building';
      console.log('Hugo 构建中...');
      exec(`"${HUGO_BIN}" --minify`, { cwd: config.hugoSitePath, timeout: 90000 }, (err, stdout, stderr) => {
        if (err) {
          buildStatus = 'error';
          console.error('Hugo 构建失败:', stderr || err.message);
          resolve({ success: false, error: stderr || err.message });
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

module.exports = { build, getStatus, ensureThemeSymlink };
