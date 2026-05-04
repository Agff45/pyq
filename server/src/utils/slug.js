function generateSlug(title) {
  const cleaned = title
    .trim()
    .replace(/[，,。！？、；：\s]+/g, '-')
    .replace(/[^\w\u4e00-\u9fa5-]+/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();

  if (cleaned.length < 2) {
    return `post-${Date.now().toString(36)}`;
  }

  return cleaned.substring(0, 60);
}

function generateFilename(title, date) {
  const d = date ? new Date(date) : new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const slug = generateSlug(title || '未命名');
  return `${yyyy}-${mm}-${dd}-${slug}.md`;
}

function generateImageDir(date, slug) {
  const d = date ? new Date(date) : new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `images/posts/${yyyy}/${mm}`;
}

module.exports = { generateSlug, generateFilename, generateImageDir };
