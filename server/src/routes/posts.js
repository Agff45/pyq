const express = require('express');
const authMiddleware = require('../middleware/auth');
const postService = require('../services/postService');
const config = require('../config');

const router = express.Router();

router.get('/api/posts', authMiddleware, (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const { search, tag, author, draft } = req.query;

    const result = postService.listPosts({ page, limit, search, tag, author, draft });
    res.json({ code: 0, data: result });
  } catch (err) {
    console.error('获取文章列表失败:', err);
    res.status(500).json({ code: 500, message: '获取文章列表失败' });
  }
});

router.get('/api/posts/:filename', authMiddleware, (req, res) => {
  try {
    const post = postService.readPost(req.params.filename);
    if (!post) {
      return res.status(404).json({ code: 404, message: '文章不存在' });
    }
    res.json({
      code: 0,
      data: {
        filename: post.filename,
        frontMatter: post.frontMatter,
        content: post.content,
        raw: post.raw,
      },
    });
  } catch (err) {
    console.error('获取文章详情失败:', err);
    res.status(500).json({ code: 500, message: '获取文章详情失败' });
  }
});

router.post('/api/posts', authMiddleware, (req, res) => {
  try {
    const {
      title, content, author, location, tags,
      images, cover, isLongArticle, weight, comments, draft, date,
    } = req.body;

    if (!content && !title) {
      return res.status(400).json({ code: 400, message: '标题和内容至少填写一项' });
    }

    const post = postService.createPost({
      title, content, author, location, tags,
      images, cover, isLongArticle, weight, comments, draft, date,
    });

    res.json({ code: 0, message: '发布成功', data: post });
  } catch (err) {
    console.error('创建文章失败:', err);
    res.status(500).json({ code: 500, message: '创建文章失败: ' + err.message });
  }
});

router.put('/api/posts/:filename', authMiddleware, (req, res) => {
  try {
    const post = postService.updatePost(req.params.filename, req.body);
    if (!post) {
      return res.status(404).json({ code: 404, message: '文章不存在' });
    }
    res.json({ code: 0, message: '更新成功', data: post });
  } catch (err) {
    console.error('更新文章失败:', err);
    res.status(500).json({ code: 500, message: '更新文章失败: ' + err.message });
  }
});

router.delete('/api/posts/:filename', authMiddleware, (req, res) => {
  try {
    const post = postService.readPost(req.params.filename);
    if (!post) {
      return res.status(404).json({ code: 404, message: '文章不存在' });
    }
    postService.deletePost(req.params.filename);
    postService.removeFromIndex(req.params.filename);
    res.json({ code: 0, message: '删除成功' });
  } catch (err) {
    console.error('删除文章失败:', err);
    res.status(500).json({ code: 500, message: '删除文章失败' });
  }
});

router.put('/api/posts/:filename/pin', authMiddleware, (req, res) => {
  try {
    const result = postService.togglePin(req.params.filename);
    if (!result) {
      return res.status(404).json({ code: 404, message: '文章不存在' });
    }
    res.json({ code: 0, message: result.weight > 0 ? '已置顶' : '已取消置顶', data: result });
  } catch (err) {
    console.error('切换置顶失败:', err);
    res.status(500).json({ code: 500, message: '操作失败' });
  }
});

router.post('/api/posts/rebuild-index', authMiddleware, (req, res) => {
  try {
    const index = postService.rebuildIndex ? postService.rebuildIndex() : [];
    res.json({ code: 0, message: '索引重建成功', data: { count: index.length } });
  } catch (err) {
    res.status(500).json({ code: 500, message: '索引重建失败' });
  }
});

module.exports = router;
