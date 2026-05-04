const fs = require('fs');
const path = require('path');
const config = require('../config');

const SETTINGS_FIELDS = [
  'title',
  'username',
  'description',
  'avatar',
  'headerMedia',
  'navBackground',
  'navScrolledBackground',
  'footerText',
  'fontFamily',
  'enablePjax',
  'enableLightbox',
];

function getConfigPath() {
  return path.join(config.hugoSitePath, 'hugo.toml');
}

function readConfigText() {
  const filePath = getConfigPath();
  if (!fs.existsSync(filePath)) throw new Error('hugo.toml 不存在');
  return fs.readFileSync(filePath, 'utf-8');
}

function parseValue(raw) {
  const value = raw.trim();
  if (value === 'true') return true;
  if (value === 'false') return false;
  const quoted = value.match(/^"([\s\S]*)"$/) || value.match(/^'([\s\S]*)'$/);
  if (quoted) return quoted[1].replace(/\\"/g, '"').replace(/\\n/g, '\n');
  return value;
}

function formatValue(value) {
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return `"${String(value ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`;
}

function getParamsRange(lines) {
  const start = lines.findIndex((line) => /^\s*\[params\]\s*$/.test(line));
  if (start < 0) return { start: -1, end: -1 };
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    if (/^\s*\[[^\]]+\]\s*$/.test(lines[i])) {
      end = i;
      break;
    }
  }
  return { start, end };
}

function readSettings() {
  const text = readConfigText();
  const lines = text.split(/\r?\n/);
  const settings = {};

  for (const line of lines) {
    const titleMatch = line.match(/^\s*title\s*=\s*(.+?)\s*$/);
    if (titleMatch && settings.title === undefined) settings.title = parseValue(titleMatch[1]);
  }

  const range = getParamsRange(lines);
  if (range.start >= 0) {
    for (let i = range.start + 1; i < range.end; i += 1) {
      const match = lines[i].match(/^\s*([A-Za-z][A-Za-z0-9_]*)\s*=\s*(.+?)\s*$/);
      if (!match) continue;
      const [, key, raw] = match;
      if (SETTINGS_FIELDS.includes(key)) settings[key] = parseValue(raw);
    }
  }

  return {
    title: settings.title || '',
    username: settings.username || '',
    description: settings.description || '',
    avatar: settings.avatar || '',
    headerMedia: settings.headerMedia || '',
    navBackground: settings.navBackground || '',
    navScrolledBackground: settings.navScrolledBackground || '',
    footerText: settings.footerText || '',
    fontFamily: settings.fontFamily || 'ZQL',
    enablePjax: settings.enablePjax !== false,
    enableLightbox: settings.enableLightbox !== false,
  };
}

function upsertRootValue(lines, key, value) {
  const idx = lines.findIndex((line) => new RegExp(`^\\s*${key}\\s*=`).test(line));
  const next = `${key} = ${formatValue(value)}`;
  if (idx >= 0) lines[idx] = next;
  else lines.unshift(next);
}

function upsertParamValue(lines, key, value) {
  let range = getParamsRange(lines);
  if (range.start < 0) {
    lines.push('', '[params]');
    range = getParamsRange(lines);
  }

  const pattern = new RegExp(`^\\s*${key}\\s*=`);
  for (let i = range.start + 1; i < range.end; i += 1) {
    if (pattern.test(lines[i])) {
      lines[i] = `  ${key} = ${formatValue(value)}`;
      return;
    }
  }

  lines.splice(range.end, 0, `  ${key} = ${formatValue(value)}`);
}

function updateSettings(input) {
  const allowed = Object.fromEntries(
    SETTINGS_FIELDS
      .filter((key) => input[key] !== undefined)
      .map((key) => [key, input[key]])
  );

  const text = readConfigText();
  const lines = text.split(/\r?\n/);

  if (allowed.title !== undefined) {
    upsertRootValue(lines, 'title', allowed.title);
    delete allowed.title;
  }

  for (const [key, value] of Object.entries(allowed)) {
    upsertParamValue(lines, key, value);
  }

  fs.writeFileSync(getConfigPath(), lines.join('\n'), 'utf-8');
  return readSettings();
}

module.exports = { readSettings, updateSettings };
