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

const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use(authRoutes);
app.use(postRoutes);
app.use(uploadRoutes);

const staticPath = config.staticPath;
if (fs.existsSync(staticPath)) {
  app.use(express.static(staticPath));
}

const adminDistPath = config.adminPath;
if (fs.existsSync(adminDistPath)) {
  app.use('/admin', express.static(adminDistPath));
  app.get('/admin/*', (req, res) => {
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
    const htmlPath = path.join(publicPath, req.path === '/' ? 'index.html' : req.path);
    if (fs.existsSync(htmlPath)) {
      return res.sendFile(htmlPath);
    }
    if (fs.existsSync(path.join(publicPath, req.path + '.html'))) {
      return res.sendFile(path.join(publicPath, req.path + '.html'));
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
