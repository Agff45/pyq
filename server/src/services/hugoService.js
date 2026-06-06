const { exec, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const config = require('../config');

let buildStatus = 'idle';
let buildTimer = null;
let scheduledBuild = null;
let scheduledResolve = null;
let buildQueue = Promise.resolve();

const HUGO_BIN = (() => {
  const candidates = [
    'hugo',
    'hugo.exe',
    '/snap/bin/hugo',
    '/usr/local/bin/hugo',
    '/usr/bin/hugo',
    '/opt/hugo/bin/hugo',
  ];
  for (const bin of candidates) {
    try {
      execSync(`"${bin}" version`, { stdio: 'pipe' });
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
      console.warn('Windows 环境未自动创建 themes/Amigo 软链接，请手动配置主题目录或在支持符号链接的环境中运行。');
      return;
    } else {
      fs.symlinkSync(config.hugoSitePath, amigoLink, 'dir');
    }
    console.log('已创建主题软链接: themes/Amigo');
  } catch (e) {
    // 可能已通过其他方式配置，忽略
    console.warn('主题软链接创建失败（可忽略）:', e.message);
  }
}

function runBuild() {
  ensureThemeSymlink();
  buildStatus = 'building';
  console.log('Hugo 构建中...');

  return new Promise((resolve) => {
    exec(`"${HUGO_BIN}" --minify`, { cwd: config.hugoSitePath, timeout: 90000 }, (err, stdout, stderr) => {
      if (err) {
        buildStatus = 'error';
        console.error('Hugo 构建失败:', stderr || err.message);
        resolve({ success: false, error: stderr || err.message });
      } else {
        buildStatus = 'idle';
        console.log('Hugo 构建完成');
        resolve({ success: true, stdout, stderr });
      }
    });
  });
}

function queueBuild() {
  buildQueue = buildQueue.then(() => runBuild());
  return buildQueue;
}

function build({ immediate = false } = {}) {
  if (immediate) {
    clearTimeout(buildTimer);
    buildTimer = null;

    if (scheduledResolve) {
      const resolve = scheduledResolve;
      scheduledBuild = null;
      scheduledResolve = null;
      const queued = queueBuild();
      queued.then(resolve);
      return queued;
    }

    return queueBuild();
  }

  if (!scheduledBuild) {
    scheduledBuild = new Promise((resolve) => {
      scheduledResolve = resolve;
    });
  }

  clearTimeout(buildTimer);
  buildTimer = setTimeout(() => {
    const resolve = scheduledResolve;
    scheduledBuild = null;
    scheduledResolve = null;
    buildTimer = null;

    queueBuild().then(resolve);
  }, 2000);

  return scheduledBuild;
}

function getStatus() {
  return buildStatus;
}

module.exports = { build, getStatus, ensureThemeSymlink };
