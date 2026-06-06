const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const config = require('../config');
const { generateFilename } = require('../utils/slug');

class InvalidPostFilenameError extends Error {
  constructor(message = '无效的文章文件名') {
    super(message);
    this.name = 'InvalidPostFilenameError';
    this.statusCode = 400;
  }
}

function isPathInside(childPath, parentPath) {
  const relative = path.relative(parentPath, childPath);
  return relative === '' || (!!relative && !relative.startsWith('..') && !path.isAbsolute(relative));
}

function getPostPath(filename) {
  if (typeof filename !== 'string' || !filename.trim()) {
    throw new InvalidPostFilenameError();
  }

  if (
    filename.includes('\0') ||
    filename.includes('/') ||
    filename.includes('\\') ||
    path.basename(filename) !== filename ||
    path.extname(filename).toLowerCase() !== '.md'
  ) {
    throw new InvalidPostFilenameError();
  }

  const contentRoot = path.resolve(config.contentPath);
  const filePath = path.resolve(contentRoot, filename);
  if (!isPathInside(filePath, contentRoot)) {
    throw new InvalidPostFilenameError();
  }
  return filePath;
}

function ensureDataDir() {
  const dir = path.dirname(config.indexPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function ensureContentDir() {
  if (!fs.existsSync(config.contentPath)) {
    fs.mkdirSync(config.contentPath, { recursive: true });
  }
}

function loadIndex() {
  ensureDataDir();
  if (!fs.existsSync(config.indexPath)) {
    return [];
  }
  try {
    return JSON.parse(fs.readFileSync(config.indexPath, 'utf-8'));
  } catch {
    return [];
  }
}

function saveIndex(index) {
  ensureDataDir();
  fs.writeFileSync(config.indexPath, JSON.stringify(index, null, 2), 'utf-8');
}

function readPost(filename) {
  const filePath = getPostPath(filename);
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, 'utf-8');
  const parsed = matter(raw);
  return {
    filename,
    frontMatter: parsed.data,
    content: parsed.content.trim(),
    raw,
  };
}

function writePost(filename, frontMatter, content) {
  ensureContentDir();
  const filePath = getPostPath(filename);
  const fm = { ...frontMatter };
  if (!fm.date) {
    fm.date = new Date().toISOString();
  }
  const markdown = matter.stringify((content || '').trim(), fm);
  fs.writeFileSync(filePath, markdown, 'utf-8');
  return filePath;
}

function deletePost(filename) {
  const filePath = getPostPath(filename);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

function upsertIndexEntry(post) {
  const index = loadIndex();
  const existing = index.findIndex((e) => e.filename === post.filename);
  const entry = {
    filename: post.filename,
    title: post.frontMatter.title || '',
    date: post.frontMatter.date || '',
    author: post.frontMatter.author || '',
    location: post.frontMatter.location || '',
    tags: post.frontMatter.tags || [],
    imageCount: (post.frontMatter.images || []).length,
    isLongArticle: post.frontMatter.isLongArticle || false,
    weight: post.frontMatter.weight || 0,
    draft: post.frontMatter.draft || false,
    wordCount: (post.content || '').length,
  };

  if (existing >= 0) {
    index[existing] = entry;
  } else {
    index.push(entry);
  }

  index.sort((a, b) => {
    if (a.weight !== b.weight) return b.weight - a.weight;
    return new Date(b.date) - new Date(a.date);
  });

  saveIndex(index);
  return entry;
}

function removeFromIndex(filename) {
  const index = loadIndex().filter((e) => e.filename !== filename);
  saveIndex(index);
}

function createPost({ title, content, author, location, tags, images, cover, isLongArticle, weight, draft, date }) {
  ensureContentDir();
  const filename = generateFilename(title || '未命名', date);
  const frontMatter = {
    title: title || '未命名',
    date: date || new Date().toISOString(),
  };

  if (author) frontMatter.author = author;
  if (location) frontMatter.location = location;
  if (tags && tags.length) frontMatter.tags = tags;
  if (images && images.length) frontMatter.images = images;
  if (cover) frontMatter.cover = cover;
  if (isLongArticle) frontMatter.isLongArticle = true;
  if (weight) frontMatter.weight = weight;
  if (draft) frontMatter.draft = true;

  const filePath = writePost(filename, frontMatter, content);

  const post = { filename, frontMatter, content: content || '' };
  const indexEntry = upsertIndexEntry(post);

  return { ...indexEntry, filePath };
}

function updatePost(filename, {
  title, content, author, location, tags, images, imagesTouched, cover, isLongArticle, weight, draft,
}) {
  const existing = readPost(filename);
  if (!existing) return null;

  const frontMatter = { ...existing.frontMatter };

  if (title !== undefined) frontMatter.title = title;
  if (content !== undefined) existing.content = content;
  if (author !== undefined) {
    if (author) frontMatter.author = author;
    else delete frontMatter.author;
  }
  if (location !== undefined) {
    if (location) frontMatter.location = location;
    else delete frontMatter.location;
  }
  if (tags !== undefined) {
    if (tags && tags.length) frontMatter.tags = tags;
    else delete frontMatter.tags;
  }
  if (images !== undefined || imagesTouched) {
    const nextImages = Array.isArray(images) ? images : [];
    if (nextImages.length) frontMatter.images = nextImages;
    else frontMatter.images = [];
  }
  if (cover !== undefined) {
    if (cover) frontMatter.cover = cover;
    else delete frontMatter.cover;
  }
  if (isLongArticle !== undefined) {
    if (isLongArticle) frontMatter.isLongArticle = true;
    else delete frontMatter.isLongArticle;
  }
  if (weight !== undefined) {
    if (weight) frontMatter.weight = weight;
    else delete frontMatter.weight;
  }
  if (draft !== undefined) {
    if (draft) frontMatter.draft = true;
    else delete frontMatter.draft;
  }

  frontMatter.lastmod = new Date().toISOString();
  writePost(filename, frontMatter, existing.content);

  const post = { filename, frontMatter, content: existing.content };
  const indexEntry = upsertIndexEntry(post);

  return { ...indexEntry };
}

function listPosts({ page = 1, limit = 20, search, tag, author, draft } = {}) {
  let index = loadIndex();
  if (draft !== undefined) {
    index = index.filter((e) => e.draft === draft);
  }
  if (search) {
    const kw = search.toLowerCase();
    index = index.filter((e) => e.title.toLowerCase().includes(kw));
  }
  if (tag) {
    index = index.filter((e) => e.tags.includes(tag));
  }
  if (author) {
    index = index.filter((e) => e.author === author);
  }

  const total = index.length;
  const start = (page - 1) * limit;
  const items = index.slice(start, start + limit);

  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
}

function togglePin(filename) {
  const existing = readPost(filename);
  if (!existing) return null;

  const currentWeight = existing.frontMatter.weight || 0;
  const newWeight = currentWeight > 0 ? 0 : 1;

  existing.frontMatter.weight = newWeight;
  writePost(filename, existing.frontMatter, existing.content);

  const post = { filename, frontMatter: existing.frontMatter, content: existing.content };
  upsertIndexEntry(post);

  return { weight: newWeight };
}

function rebuildIndex() {
  ensureContentDir();
  const files = fs.readdirSync(config.contentPath);
  const index = [];

  for (const file of files) {
    if (!file.endsWith('.md')) continue;
    const post = readPost(file);
    if (!post) continue;

    index.push({
      filename: file,
      title: post.frontMatter.title || '',
      date: post.frontMatter.date || '',
      author: post.frontMatter.author || '',
      location: post.frontMatter.location || '',
      tags: post.frontMatter.tags || [],
      imageCount: (post.frontMatter.images || []).length,
      isLongArticle: post.frontMatter.isLongArticle || false,
      weight: post.frontMatter.weight || 0,
      draft: post.frontMatter.draft || false,
      wordCount: (post.content || '').length,
    });
  }

  index.sort((a, b) => {
    if (a.weight !== b.weight) return b.weight - a.weight;
    return new Date(b.date) - new Date(a.date);
  });

  saveIndex(index);
  return index;
}

module.exports = {
  loadIndex,
  saveIndex,
  readPost,
  writePost,
  deletePost,
  createPost,
  updatePost,
  listPosts,
  togglePin,
  removeFromIndex,
  upsertIndexEntry,
  rebuildIndex,
  InvalidPostFilenameError,
};
