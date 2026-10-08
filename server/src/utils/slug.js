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
  const dateMatch = typeof date === 'string' && date.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const d = dateMatch ? null : (date ? new Date(date) : new Date());
  const yyyy = dateMatch ? dateMatch[1] : d.getFullYear();
  const mm = dateMatch ? dateMatch[2] : String(d.getMonth() + 1).padStart(2, '0');
  const dd = dateMatch ? dateMatch[3] : String(d.getDate()).padStart(2, '0');
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
