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
  'enableSearch',
  'enableDarkMode',
  'showLocation',
  'showTags',
  'icp',
  'favicon',
  'headerMediaList',
  'social',
];

const ARRAY_FIELDS = ['headerMediaList'];

function parseArrayValue(raw) {
  const trimmed = raw.trim();
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    const inner = trimmed.slice(1, -1).trim();
    if (!inner) return [];
    const items = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < inner.length; i++) {
      const ch = inner[i];
      if (ch === '"' && (i === 0 || inner[i - 1] !== '\\')) {
        inQuotes = !inQuotes;
        continue;
      }
      if (ch === ',' && !inQuotes) {
        items.push(current.trim());
        current = '';
        continue;
      }
      current += ch;
    }
    if (current.trim()) items.push(current.trim());
    return items;
  }
  return [];
}

function formatArrayValue(arr) {
  if (!Array.isArray(arr)) arr = [];
  return '[' + arr.map((v) => `"${String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`).join(', ') + ']';
}

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
      if (SETTINGS_FIELDS.includes(key)) {
        if (ARRAY_FIELDS.includes(key)) {
          settings[key] = parseArrayValue(raw);
        } else {
          settings[key] = parseValue(raw);
        }
      }
    }
  }

  const defaults = {
    title: '',
    username: '',
    description: '',
    avatar: '',
    headerMedia: '',
    navBackground: '',
    navScrolledBackground: '',
    footerText: '',
    fontFamily: 'ZQL',
    enablePjax: true,
    enableLightbox: true,
    enableSearch: true,
    enableDarkMode: true,
    showLocation: true,
    showTags: true,
    icp: '',
    favicon: 'favicon.ico',
    headerMediaList: [],
    social: '[]',
  };

  for (const key of SETTINGS_FIELDS) {
    if (settings[key] === undefined) {
      settings[key] = defaults[key];
    }
  }

  if (settings.enablePjax === false) settings.enablePjax = false;
  if (settings.enableLightbox === false) settings.enableLightbox = false;
  if (settings.enableSearch === false) settings.enableSearch = false;
  if (settings.enableDarkMode === false) settings.enableDarkMode = false;
  if (settings.showLocation === true) settings.showLocation = true;
  if (settings.showTags === true) settings.showTags = true;

  return settings;
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

  const formatted = ARRAY_FIELDS.includes(key) ? formatArrayValue(value) : formatValue(value);
  const pattern = new RegExp(`^\\s*${key}\\s*=`);
  for (let i = range.start + 1; i < range.end; i += 1) {
    if (pattern.test(lines[i])) {
      lines[i] = `  ${key} = ${formatted}`;
      return;
    }
  }

  lines.splice(range.end, 0, `  ${key} = ${formatted}`);
}

function updateSettings(input) {
  const raw = { ...input };

  if (raw.headerMediaList !== undefined) {
    if (typeof raw.headerMediaList === 'string') {
      raw.headerMediaList = raw.headerMediaList
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }

  const allowed = Object.fromEntries(
    SETTINGS_FIELDS
      .filter((key) => raw[key] !== undefined)
      .map((key) => [key, raw[key]])
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

  const result = readSettings();
  if (Array.isArray(result.headerMediaList)) {
    result.headerMediaList = result.headerMediaList.join('\n');
  }
  return result;
}

module.exports = { readSettings, updateSettings };
