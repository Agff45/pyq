const express = require('express');
const jwt = require('jsonwebtoken');
const config = require('../config');

const router = express.Router();

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

module.exports = router;
