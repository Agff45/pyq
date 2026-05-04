const express = require('express');
const authMiddleware = require('../middleware/auth');
const settingsService = require('../services/settingsService');
const hugoService = require('../services/hugoService');

const router = express.Router();

router.get('/api/settings', authMiddleware, (req, res) => {
  try {
    const data = settingsService.readSettings();
    if (Array.isArray(data.headerMediaList)) {
      data.headerMediaList = data.headerMediaList.join('\n');
    }
    res.json({ code: 0, data });
  } catch (err) {
    console.error('读取站点设置失败:', err);
    res.status(500).json({ code: 500, message: '读取站点设置失败: ' + err.message });
  }
});

router.put('/api/settings', authMiddleware, (req, res) => {
  try {
    const settings = settingsService.updateSettings(req.body || {});
    res.json({ code: 0, message: '保存成功', data: settings });
    hugoService.build();
  } catch (err) {
    console.error('保存站点设置失败:', err);
    res.status(500).json({ code: 500, message: '保存站点设置失败: ' + err.message });
  }
});

module.exports = router;
