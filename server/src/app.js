const express = require('express');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
const config = require('./config');
const postService = require('./services/postService');
const hugoService = require('./services/hugoService');

const authRoutes = require('./routes/auth');
const postRoutes = require('./routes/posts');
const uploadRoutes = require('./routes/upload');
const settingsRoutes = require('./routes/settings');

const app = express();

function isPathInside(childPath, parentPath) {
  const relative = path.relative(parentPath, childPath);
  return relative === '' || (!!relative && !relative.startsWith('..') && !path.isAbsolute(relative));
}

function resolvePublicFile(requestPath) {
  const publicRoot = path.resolve(publicPath);
  const relativeRequest = requestPath === '/' ? 'index.html' : requestPath.replace(/^\/+/, '');
  const candidates = [
    path.resolve(publicRoot, relativeRequest),
    path.resolve(publicRoot, `${relativeRequest}.html`),
  ];

  return candidates.find((candidate) => (
    isPathInside(candidate, publicRoot) &&
    fs.existsSync(candidate) &&
    fs.statSync(candidate).isFile()
  ));
}

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use(authRoutes);
app.use(postRoutes);
app.use(uploadRoutes);
app.use(settingsRoutes);

const staticPath = config.staticPath;
if (fs.existsSync(staticPath)) {
  app.use(express.static(staticPath));
}

const adminDistPath = config.adminPath;
if (fs.existsSync(adminDistPath)) {
  app.use('/admin', express.static(adminDistPath, {
    setHeaders: (res) => {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    },
  }));
  app.get('/admin/*', (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.sendFile(path.join(adminDistPath, 'index.html'));
  });
}

const publicPath = config.publicPath;
if (fs.existsSync(publicPath)) {
  app.use(express.static(publicPath, { extensions: ['html'] }));
}

app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ code: 404, message: '接口不存在' });
  }
  next();
});

app.use((req, res) => {
  if (fs.existsSync(publicPath)) {
    const htmlPath = resolvePublicFile(req.path);
    if (htmlPath) {
      return res.sendFile(htmlPath);
    }
  }
  res.status(404).send('页面不存在');
});

app.use((err, req, res, next) => {
  console.error('服务端错误:', err);
  res.status(500).json({ code: 500, message: '服务器内部错误' });
});

app.listen(config.port, () => {
  console.log(`Amigo 管理服务已启动 → http://localhost:${config.port}`);
  console.log(`管理后台入口 → http://localhost:${config.port}/admin`);
  console.log(`API 入口 → http://localhost:${config.port}/api`);

  hugoService.ensureThemeSymlink();

  try {
    const index = postService.loadIndex();
    if (index.length === 0) {
      const count = postService.rebuildIndex ? postService.rebuildIndex().length : 0;
      if (count > 0) console.log(`已为 ${count} 篇文章重建索引`);
    }
  } catch (e) {
    // 首启时 content 目录可能不存在，忽略
  }
});

module.exports = app;
