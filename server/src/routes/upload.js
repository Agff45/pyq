const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { spawn } = require('child_process');
const authMiddleware = require('../middleware/auth');
const config = require('../config');
const { generateImageDir } = require('../utils/slug');

const router = express.Router();

const ALLOWED_IMAGES = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.avif'];
const ALLOWED_AUDIO = ['.mp3', '.wav', '.flac', '.aac', '.m4a', '.ogg'];
const ALLOWED_VIDEO = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv'];
const ALLOWED_ALL = [...ALLOWED_IMAGES, ...ALLOWED_AUDIO, ...ALLOWED_VIDEO];

function getMediaDir(mediaType) {
  const typeMap = {
    music: 'music',
    voice: 'voice',
    video: 'videos',
    livephoto: 'livephoto',
    image: 'images',
    cover: 'images',
    site: 'images/site',
  };
  const dir = typeMap[mediaType] || 'images';
  return path.join(config.staticPath, dir);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const mediaType = req.query.mediaType || req.body.mediaType || 'image';
    const uploadDir = getMediaDir(mediaType);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const randomStr = crypto.randomBytes(4).toString('hex');
    const timestamp = Date.now();
    const safeName = file.originalname
      .replace(ext, '')
      .replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]/g, '_')
      .substring(0, 40);
    cb(null, `${safeName}_${timestamp}_${randomStr}${ext}`);
  },
});

function fileFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  const type = req.query.type || req.body.type || 'image';

  let allowed;
  if (type === 'image') allowed = ALLOWED_IMAGES;
  else if (type === 'audio') allowed = ALLOWED_AUDIO;
  else if (type === 'video') allowed = ALLOWED_VIDEO;
  else allowed = ALLOWED_ALL;

  if (allowed.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`不支持的文件类型: ${ext}`));
  }
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 200 * 1024 * 1024 },
});

function generateVideoThumb(videoPath) {
  return new Promise((resolve) => {
    const ext = path.extname(videoPath);
    const thumbPath = videoPath.replace(ext, '.thumb.jpg');
    if (fs.existsSync(thumbPath)) return resolve(thumbPath);

    const ffmpeg = spawn('ffmpeg', [
      '-ss', '00:00:01',
      '-i', videoPath,
      '-vframes', '1',
      '-vf', 'scale=480:-1',
      '-q:v', '5',
      '-y',
      thumbPath,
    ], { stdio: 'ignore' });

    ffmpeg.on('close', (code) => {
      if (code === 0 && fs.existsSync(thumbPath)) {
        resolve(thumbPath);
      } else {
        resolve(null);
      }
    });

    ffmpeg.on('error', () => resolve(null));
  });
}

function getThumbPath(filePath) {
  const ext = path.extname(filePath);
  const thumbPath = filePath.replace(ext, '.thumb.jpg');
  return fs.existsSync(thumbPath) ? '/' + path.relative(config.staticPath, thumbPath).replace(/\\/g, '/') : null;
}

router.post('/api/upload', authMiddleware, (req, res) => {
  upload.array('files', 20)(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ code: 400, message: '文件大小不能超过 200MB' });
      }
      return res.status(400).json({ code: 400, message: err.message });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ code: 400, message: '请选择文件' });
    }

    const staticBase = config.staticPath;
    const files = req.files.map((file) => {
      const relativePath = '/' + path.relative(staticBase, file.path).replace(/\\/g, '/');
      const ext = path.extname(file.originalname).toLowerCase();
      let fileType = 'media';
      if (ALLOWED_IMAGES.includes(ext)) fileType = 'image';
      else if (ALLOWED_AUDIO.includes(ext)) fileType = 'audio';
      else if (ALLOWED_VIDEO.includes(ext)) fileType = 'video';

      return {
        filename: file.filename,
        originalName: file.originalname,
        path: relativePath,
        size: file.size,
        mimetype: file.mimetype,
        type: fileType,
      };
    });

    res.json({
      code: 0,
      message: '上传成功',
      data: { files },
    });

    req.files
      .filter((f) => ALLOWED_VIDEO.includes(path.extname(f.originalname).toLowerCase()))
      .forEach((f) => generateVideoThumb(f.path));
  });
});

router.get('/api/media', authMiddleware, (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 40;
    const type = req.query.type || 'image';

    const scanDirs = ['images', 'videos', 'music', 'voice', 'livephoto'];
    const files = [];

    function walkDir(dir, basePath) {
      if (!fs.existsSync(dir)) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walkDir(fullPath, basePath);
        } else {
          const ext = path.extname(entry.name).toLowerCase();
          const isImage = ALLOWED_IMAGES.includes(ext);
          const isAudio = ALLOWED_AUDIO.includes(ext);
          const isVideo = ALLOWED_VIDEO.includes(ext);

          if (type === 'image' && !isImage) continue;
          if (type === 'audio' && !isAudio) continue;
          if (type === 'video' && !isVideo) continue;
          if (type === 'media' && !isAudio && !isVideo) continue;
          if (type === 'all' && !isImage && !isAudio && !isVideo) continue;

          const relativePath = '/' + path.relative(basePath, fullPath).replace(/\\/g, '/');
          const stat = fs.statSync(fullPath);
          let fileType = 'media';
          if (isImage) fileType = 'image';
          else if (isAudio) fileType = 'audio';
          else if (isVideo) fileType = 'video';

          const item = {
            path: relativePath,
            filename: entry.name,
            size: stat.size,
            mtime: stat.mtime.toISOString(),
            type: fileType,
          };

          if (isVideo) {
            const thumb = getThumbPath(fullPath);
            if (thumb) item.thumb = thumb;
          }

          files.push(item);
        }
      }
    }

    for (const dir of scanDirs) {
      const dirPath = path.join(config.staticPath, dir);
      walkDir(dirPath, config.staticPath);
    }

    files.sort((a, b) => new Date(b.mtime) - new Date(a.mtime));

    const total = files.length;
    const start = (page - 1) * limit;
    const items = files.slice(start, start + limit);

    res.json({
      code: 0,
      data: { items, total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('获取媒体列表失败:', err);
    res.status(500).json({ code: 500, message: '获取媒体列表失败' });
  }
});

router.delete('/api/media', authMiddleware, (req, res) => {
  try {
    const { path: filePath } = req.body;
    if (!filePath) {
      return res.status(400).json({ code: 400, message: '请提供文件路径' });
    }

    const fullPath = path.join(config.staticPath, filePath.replace(/^\//, ''));
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ code: 404, message: '文件不存在' });
    }

    const realFull = fs.realpathSync(fullPath);
    const realStatic = fs.realpathSync(config.staticPath);
    if (!realFull.startsWith(realStatic)) {
      return res.status(403).json({ code: 403, message: '不允许删除该文件' });
    }

    fs.unlinkSync(fullPath);

    const ext = path.extname(fullPath);
    const thumbPath = fullPath.replace(ext, '.thumb.jpg');
    if (fs.existsSync(thumbPath)) {
      fs.unlinkSync(thumbPath);
    }

    res.json({ code: 0, message: '删除成功' });
  } catch (err) {
    console.error('删除文件失败:', err);
    res.status(500).json({ code: 500, message: '删除文件失败' });
  }
});

module.exports = router;
