const express = require('express');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const config = require('../config');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

const ENV_PATH = path.join(__dirname, '../.env');

function updateEnvFile(newPassword) {
  if (!fs.existsSync(ENV_PATH)) {
    fs.writeFileSync(ENV_PATH, `ADMIN_PASSWORD=${newPassword}\n`, 'utf-8');
    return;
  }
  let content = fs.readFileSync(ENV_PATH, 'utf-8');
  if (/^ADMIN_PASSWORD=/m.test(content)) {
    content = content.replace(/^ADMIN_PASSWORD=.*$/m, `ADMIN_PASSWORD=${newPassword}`);
  } else {
    content += `\nADMIN_PASSWORD=${newPassword}\n`;
  }
  fs.writeFileSync(ENV_PATH, content, 'utf-8');
}

router.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ code: 400, message: '用户名和密码不能为空' });
  }

  if (username !== config.adminUsername || password !== config.adminPassword) {
    return res.status(401).json({ code: 401, message: '用户名或密码错误' });
  }

  const token = jwt.sign(
    { username, role: 'admin' },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );

  res.json({
    code: 0,
    message: '登录成功',
    data: {
      token,
      username,
      expiresIn: 86400,
    },
  });
});

router.get('/api/auth/verify', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ code: 401, message: '未认证' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    res.json({ code: 0, data: { username: decoded.username, role: decoded.role } });
  } catch {
    res.status(401).json({ code: 401, message: '令牌无效' });
  }
});

router.put('/api/auth/password', authMiddleware, (req, res) => {
  const { oldPassword, newPassword } = req.body;

  if (!oldPassword || !newPassword) {
    return res.status(400).json({ code: 400, message: '旧密码和新密码不能为空' });
  }

  if (newPassword.length < 4) {
    return res.status(400).json({ code: 400, message: '新密码至少 4 位' });
  }

  if (oldPassword !== config.adminPassword) {
    return res.status(401).json({ code: 401, message: '旧密码不正确' });
  }

  if (oldPassword === newPassword) {
    return res.status(400).json({ code: 400, message: '新密码不能与旧密码相同' });
  }

  try {
    updateEnvFile(newPassword);
    config.adminPassword = newPassword;
    res.json({ code: 0, message: '密码已更新，下次登录生效' });
  } catch (err) {
    console.error('更新密码失败:', err);
    res.status(500).json({ code: 500, message: '更新密码失败: ' + err.message });
  }
});

module.exports = router;
