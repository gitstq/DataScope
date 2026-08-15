/**
 * JsonLens main application logic.
 * Zero-dependency offline JSON/YAML/TOML structure visualizer & smart editor.
 */
import Parser from './parser.js';
import Utils from './utils.js';

const { isObj, typeName, countNodes, maxDepth, typeDistribution, formatBytes, toJsonPath, redactValue, clone, sortKeys, SECRET_KEYS } = Utils;

const App = (() => {
  const state = {
    format: 'json',
    data: null,
    error: null,
    collapsed: new Set(),
    redact: false,
    theme: 'dark',
    search: '',
  };

  const $ = (sel) => document.querySelector(sel);

  // ---- Elements ----
  const editor = $('#editor');
  const lineGutter = $('#line-gutter');
  const treeView = $('#tree-view');
  const statusBar = $('#status');
  const dropZone = $('#drop-zone');

  // ---- Sample data ----
  const SAMPLES = {
    json: `{
  "project": "JsonLens",
  "version": "1.0.0",
  "author": "琦琦",
  "tags": ["json", "yaml", "toml", "offline"],
  "config": {
    "theme": "dark",
    "apiKey": "sk-super-secret-token-123",
    "features": {
      "tree": true,
      "edit": true,
      "redact": true
    },
    "limits": {
      "maxDepth": 8,
      "maxNodes": 10000
    }
  },
  "servers": [
    { "name": "prod", "host": "api.example.com", "port": 443 },
    { "name": "dev", "host": "localhost", "port": 8080 }
  ]
}`,
    yaml: `project: JsonLens
version: 1.0.0
author: 琦琦
tags:
  - json
  - yaml
  - toml
  - offline
config:
  theme: dark
  apiKey: sk-super-secret-token-123
  features:
    tree: true
    edit: true
    redact: true
  limits:
    maxDepth: 8
    maxNodes: 10000
servers:
  - name: prod
    host: api.example.com
    port: 443
  - name: dev
    host: localhost
    port: 8080`,
    toml: `project = "JsonLens"
version = "1.0.0"
author = "琦琦"
tags = ["json", "yaml", "toml", "offline"]

[config]
theme = "dark"
apiKey = "sk-super-secret-token-123"

[config.features]
tree = true
edit = true
redact = true

[config.limits]
maxDepth = 8
maxNodes = 10000

[[servers]]
name = "prod"
host = "api.example.com"
port = 443

[[servers]]
name = "dev"
host = "localhost"
port = 8080`,
    csv: `name,role,active,score
Alice,admin,true,98
Bob,developer,false,82
Carol,designer,true,91
Dave,qa,false,75`,
  };

  // ---- Parsing / serializing ----
  function parseText(text, format) {
    switch (format) {
      case 'yaml': return Parser.YAMLParse(text);
      case 'toml': return Parser.TOMLParse(text);
      case 'csv': return Parser.CSVParse(text, true);
      default: return Parser.JSONParse(text);
    }
  }

  function serialize(value, format) {
    switch (format) {
      case 'yaml': return Parser.YAMLStringify(value);
      case 'toml': return Parser.TOMLStringify(value);
      case 'csv': return Parser.CSVStringify(value, true);
      default: return Parser.JSONStringify(value, 2);
    }
  }

  function refresh(keepEditor = false) {
    const text = editor.value;
    try {
      state.data = parseText(text, state.format);
      state.error = null;
    } catch (e) {
      state.error = e.message;
      state.data = null;
    }
    updateLineNumbers();
    renderTree();
    updateStatus();
  }

  // ---- Line numbers ----
  function updateLineNumbers() {
    const n = editor.value.split('\n').length;
    const nums = [];
    for (let i = 1; i <= n; i++) nums.push(i);
    lineGutter.textContent = nums.join('\n');
    lineGutter.scrollTop = editor.scrollTop;
  }

  // ---- Tree rendering ----
  function renderTree() {
    treeView.innerHTML = '';
    if (state.error) {
      const err = document.createElement('div');
      err.className = 'empty-state error-state';
      err.innerHTML = `<div class="empty-icon">⚠️</div><div class="empty-title">解析失败</div><div class="empty-sub" title="${escapeHtml(state.error)}">${escapeHtml(state.error)}</div>`;
      treeView.appendChild(err);
      return;
    }
    if (state.data === null || state.data === undefined) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.innerHTML = `<div class="empty-icon">🔍</div><div class="empty-title">等待数据</div><div class="empty-sub">在左侧输入或粘贴数据，即可实时查看结构树</div>`;
      treeView.appendChild(empty);
      return;
    }

    const rootEl = document.createElement('div');
    rootEl.className = 'tree-root';
    const rootNode = {
      key: '$',
      value: state.data,
      path: '$',
      isRoot: true,
    };
    renderNode(rootEl, rootNode, state.data, '$', 0, true);
    // apply search highlight
    if (state.search) applySearch(rootEl);
    treeView.appendChild(rootEl);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function renderNode(parent, node, value, path, depth, isRoot) {
    const row = document.createElement('div');
    row.className = 'node-row';
    row.dataset.path = path;
    row.style.setProperty('--depth', depth);

    const type = typeName(value);
    const isContainer = type === 'array' || type === 'object';
    const isCollapsed = state.collapsed.has(path);

    // toggle
    const toggle = document.createElement('span');
    toggle.className = 'toggle';
    if (isContainer) {
      toggle.textContent = isCollapsed ? '▸' : '▾';
      toggle.classList.add('clickable');
      toggle.addEventListener('click', (e) => { e.stopPropagation(); toggleCollapse(path); });
    } else {
      toggle.textContent = '·';
      toggle.classList.add('leaf');
    }

    // key
    const keyEl = document.createElement('span');
    keyEl.className = 'node-key';
    if (isRoot) {
      keyEl.textContent = '$ (root)';
      keyEl.classList.add('root-key');
    } else if (Array.isArray(parent)) {
      keyEl.textContent = `[${node}]`;
      keyEl.classList.add('array-key');
    } else {
      keyEl.textContent = String(node) + ':';
      keyEl.classList.add('obj-key');
    }

    // value / summary
    const valWrap = document.createElement('span');
    valWrap.className = 'node-value-wrap';
    if (isContainer) {
      const count = type === 'array' ? value.length : Object.keys(value).length;
      const badge = document.createElement('span');
      badge.className = `type-badge ${type}`;
      badge.textContent = type === 'array' ? `array(${count})` : `object(${count})`;
      valWrap.appendChild(badge);
    } else {
      const shown = redactOrValue(value, path);
      const scalar = document.createElement('span');
      scalar.className = `scalar ${type}`;
      scalar.textContent = formatScalar(shown, type);
      scalar.title = toJsonPath(path.split('.').slice(0, -1).join('.'), lastKey(path), Array.isArray(parent));
      scalar.addEventListener('dblclick', (e) => { e.stopPropagation(); startInlineEdit(scalar, path, value, type); });
      valWrap.appendChild(scalar);
    }

    // actions
    const actions = document.createElement('span');
    actions.className = 'node-actions';
    actions.append(...buildActions(value, path, type, isRoot, isContainer));

    row.append(toggle, keyEl, valWrap, actions);
    row.addEventListener('click', (e) => {
      if (e.target.closest('.node-actions') || e.target.closest('.toggle')) return;
      if (isContainer) toggleCollapse(path);
    });
    parent.appendChild(row);

    if (isContainer && !isCollapsed) {
      const children = document.createElement('div');
      children.className = 'node-children';
      if (type === 'array') {
        value.forEach((item, i) => renderNode(children, i, item, `${path}[${i}]`, depth + 1, false));
      } else {
        Object.keys(value).forEach((k) => renderNode(children, k, value[k], toJsonPath(path, k, false), depth + 1, false));
      }
      parent.appendChild(children);
    }
  }

  function lastKey(path) {
    const m = path.match(/([^.\[]+)(\])?$/);
    return m ? m[1] : path;
  }

  function redactOrValue(value, path) {
    if (!state.redact) return value;
    if (typeof value === 'string' && SECRET_KEYS.test(lastKey(path)) && value.length > 3) {
      return '••••••••';
    }
    return value;
  }

  function formatScalar(v, type) {
    if (v === null) return 'null';
    if (type === 'string') return `"${v.length > 60 ? v.slice(0, 60) + '…' : v}"`;
    if (v instanceof Date) return v.toISOString();
    return String(v);
  }

  function buildActions(value, path, type, isRoot, isContainer) {
    const btns = [];
    const mk = (icon, title, fn) => {
      const b = document.createElement('button');
      b.className = 'act-btn';
      b.textContent = icon;
      b.title = title;
      b.addEventListener('click', (e) => { e.stopPropagation(); fn(); });
      return b;
    };
    if (!isRoot) {
      btns.push(mk('⤒', '上移', () => moveNode(path, -1)));
      btns.push(mk('⤓', '下移', () => moveNode(path, 1)));
      btns.push(mk('✕', '删除节点', () => deleteNode(path)));
    }
    if (isContainer) {
      btns.push(mk('＋', '新增子项', () => addChild(path, type)));
    } else {
      btns.push(mk('✎', '编辑 (双击)', () => editScalar(path)));
    }
    btns.push(mk('⧉', '复制 JSONPath', () => copyJsonPath(path)));
    btns.push(mk('❐', '复制值', () => copyValue(path)));
    return btns;
  }

  // ---- Collapse ----
  function toggleCollapse(path) {
    if (state.collapsed.has(path)) state.collapsed.delete(path);
    else state.collapsed.add(path);
    renderTree();
  }

  function expandAll() { state.collapsed.clear(); renderTree(); }
  function collapseAll() {
    const walk = (v, p) => {
      if (Array.isArray(v)) { state.collapsed.add(p); v.forEach((x, i) => walk(x, `${p}[${i}]`)); }
      else if (isObj(v)) { state.collapsed.add(p); Object.keys(v).forEach((k) => walk(v[k], toJsonPath(p, k, false))); }
    };
    walk(state.data, '$');
    renderTree();
  }

  // ---- Node operations ----
  function getParent(path) {
    const m = path.match(/^(.*)([.\[])([^.\[]+)\]?$/);
    if (!m) return null;
    const parentPath = m[1] || '$';
    const isArrayChild = m[2] === '[';
    let parent = state.data;
    if (parentPath !== '$') {
      parent = Utils.getByPath(state.data, parentPath);
    }
    const key = isArrayChild ? Number(m[3]) : m[3];
    return { parent, key, isArrayChild, parentPath };
  }

  function deleteNode(path) {
    const ctx = getParent(path);
    if (!ctx) return;
    if (Array.isArray(ctx.parent)) ctx.parent.splice(ctx.key, 1);
    else delete ctx.parent[ctx.key];
    syncAndRender();
  }

  function moveNode(path, dir) {
    const ctx = getParent(path);
    if (!ctx || !Array.isArray(ctx.parent)) return;
    const i = ctx.key + dir;
    if (i < 0 || i >= ctx.parent.length) return;
    const [item] = ctx.parent.splice(ctx.key, 1);
    ctx.parent.splice(i, 0, item);
    syncAndRender();
  }

  function addChild(path, type) {
    const node = Utils.getByPath(state.data, path);
    if (type === 'array') {
      node.push('');
    } else {
      const name = `newKey${Object.keys(node).length + 1}`;
      node[name] = '';
    }
    syncAndRender();
  }

  function editScalar(path) {
    const node = Utils.getByPath(state.data, path);
    const shown = redactOrValue(node, path);
    const raw = String(shown);
    const newValRaw = prompt('编辑值:', raw);
    if (newValRaw === null) return;
    setScalar(path, newValRaw);
  }

  function setScalar(path, raw) {
    const ctx = getParent(path);
    if (!ctx) return;
    // try to parse as JSON-ish value
    let val;
    const t = raw.trim();
    if (t === 'null') val = null;
    else if (t === 'true') val = true;
    else if (t === 'false') val = false;
    else if (/^-?\d+(\.\d+)?$/.test(t)) val = Number(t);
    else if ((t[0] === '"' && t[t.length - 1] === '"') || (t[0] === "'" && t[t.length - 1] === "'")) {
      try { val = JSON.parse(t); } catch { val = t.slice(1, -1); }
    } else if (t.startsWith('[') || t.startsWith('{')) {
      try { val = Parser.JSONParse(t); } catch { val = t; }
    } else val = t;
    if (Array.isArray(ctx.parent)) ctx.parent[ctx.key] = val;
    else ctx.parent[ctx.key] = val;
    syncAndRender();
  }

  function startInlineEdit(el, path, value, type) {
    const input = document.createElement('input');
    input.className = 'inline-edit';
    input.value = String(value);
    input.spellcheck = false;
    el.replaceWith(input);
    input.focus();
    input.select();
    const commit = () => {
      setScalar(path, input.value);
    };
    input.addEventListener('blur', commit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
      if (e.key === 'Escape') { input.blur(); renderTree(); }
    });
  }

  function copyJsonPath(path) {
    copyToClipboard(path);
    flash('已复制 JSONPath: ' + path);
  }

  function copyValue(path) {
    const v = Utils.getByPath(state.data, path);
    copyToClipboard(typeof v === 'string' ? v : Parser.JSONStringify(v, 2));
    flash('已复制值');
  }

  function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text);
    } else {
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); ta.remove();
    }
  }

  function syncAndRender() {
    try {
      editor.value = serialize(state.data, state.format);
      refresh();
    } catch (e) {
      state.error = e.message;
      renderTree();
      updateStatus();
    }
  }

  // ---- Toolbar actions ----
  function formatJson() {
    if (!state.data) return;
    editor.value = Parser.JSONStringify(state.data, 2);
    refresh();
  }
  function minifyJson() {
    if (!state.data) return;
    editor.value = Parser.JSONMinify(state.data);
    refresh();
  }
  function toggleRedact() {
    state.redact = !state.redact;
    const btn = $('#btn-redact');
    btn.classList.toggle('active', state.redact);
    renderTree();
  }
  function sortData() {
    if (!state.data) return;
    state.data = sortKeys(state.data);
    syncAndRender();
  }
  function showStats() {
    if (!state.data) return;
    const dist = typeDistribution(state.data);
    const distStr = Object.entries(dist).map(([k, v]) => `${k}: ${v}`).join(' · ');
    const info = [
      `节点总数: ${countNodes(state.data)}`,
      `最大深度: ${maxDepth(state.data)}`,
      `数据大小: ${formatBytes(state.data)}`,
      `类型分布: ${distStr}`,
    ].join('\n');
    alert('📊 JsonLens 结构统计\n\n' + info);
  }

  function switchFormat(fmt) {
    if (state.data === null) { state.format = fmt; setActiveFormat(fmt); editor.value = SAMPLES[fmt]; refresh(); return; }
    if (fmt === state.format) return;
    try {
      editor.value = serialize(state.data, fmt);
      state.format = fmt;
      setActiveFormat(fmt);
      refresh();
    } catch (e) {
      alert('格式转换失败: ' + e.message);
    }
  }

  function setActiveFormat(fmt) {
    document.querySelectorAll('.fmt-btn').forEach((b) => b.classList.toggle('active', b.dataset.fmt === fmt));
  }

  function loadSample() {
    editor.value = SAMPLES[state.format];
    refresh();
  }

  // ---- Import / export ----
  function importFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      editor.value = reader.result;
      // try to detect format
      const ext = (file.name.split('.').pop() || '').toLowerCase();
      const detected = ['json', 'yaml', 'yml', 'toml', 'csv'].includes(ext) ? ext : detectFormat(reader.result);
      if (ext === 'yml') state.format = 'yaml';
      else if (['json', 'yaml', 'toml', 'csv'].includes(detected)) state.format = detected;
      setActiveFormat(state.format);
      refresh();
    };
    reader.readAsText(file);
  }

  function detectFormat(text) {
    const t = text.trim();
    if (!t) return 'json';
    if (t.startsWith('{') || t.startsWith('[')) return 'json';
    if (t.includes('=') && /^[a-zA-Z_][\w.]*\s*=/.test(t)) return 'toml';
    if (t.includes(': ') || /^#/.test(t) || t.includes('\n- ')) return 'yaml';
    if (t.includes(',') && t.includes('\n')) return 'csv';
    return 'json';
  }

  function exportFile() {
    const blob = new Blob([editor.value], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `jsonlens-data.${state.format}`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // ---- Search ----
  function applySearch(rootEl) {
    const q = state.search.toLowerCase();
    rootEl.querySelectorAll('.node-row').forEach((row) => {
      const text = row.textContent.toLowerCase();
      row.classList.toggle('search-match', text.includes(q));
    });
  }

  // ---- Status ----
  function updateStatus() {
    if (state.error) {
      statusBar.textContent = `⚠️ 解析错误: ${state.error}`;
      statusBar.className = 'status error';
    } else if (state.data !== null) {
      const dist = typeDistribution(state.data);
      const distStr = Object.entries(dist).map(([k, v]) => `${k}:${v}`).join(' ');
      statusBar.textContent = `✓ ${state.format.toUpperCase()} · ${countNodes(state.data)} 节点 · 深度 ${maxDepth(state.data)} · ${formatBytes(state.data)} · ${distStr}`;
      statusBar.className = 'status ok';
    } else {
      statusBar.textContent = '就绪';
      statusBar.className = 'status';
    }
  }

  // ---- Toast ----
  function flash(msg) {
    let toast = $('#toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'toast';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => toast.classList.remove('show'), 1600);
  }

  // ---- Theme ----
  function toggleTheme() {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', state.theme);
    const btn = $('#btn-theme');
    btn.textContent = state.theme === 'dark' ? '☀︎' : '☾';
  }

  // ---- Init ----
  function init() {
    editor.value = SAMPLES.json;
    state.format = 'json';
    setActiveFormat('json');
    refresh();

    // events
    editor.addEventListener('input', () => refresh(true));
    editor.addEventListener('scroll', () => { lineGutter.scrollTop = editor.scrollTop; });

    $('#btn-format').addEventListener('click', formatJson);
    $('#btn-minify').addEventListener('click', minifyJson);
    $('#btn-redact').addEventListener('click', toggleRedact);
    $('#btn-sort').addEventListener('click', sortData);
    $('#btn-stats').addEventListener('click', showStats);
    $('#btn-expand').addEventListener('click', expandAll);
    $('#btn-collapse').addEventListener('click', collapseAll);
    $('#btn-sample').addEventListener('click', loadSample);
    $('#btn-export').addEventListener('click', exportFile);
    $('#btn-theme').addEventListener('click', toggleTheme);

    document.querySelectorAll('.fmt-btn').forEach((b) =>
      b.addEventListener('click', () => switchFormat(b.dataset.fmt))
    );

    // import
    $('#file-input').addEventListener('change', (e) => {
      if (e.target.files[0]) { importFile(e.target.files[0]); e.target.value = ''; }
    });
    $('#btn-import').addEventListener('click', () => $('#file-input').click());

    // search
    $('#search').addEventListener('input', (e) => {
      state.search = e.target.value.trim();
      renderTree();
    });

    // drag & drop
    ['dragenter', 'dragover'].forEach((ev) =>
      dropZone.addEventListener(ev, (e) => { e.preventDefault(); dropZone.classList.add('active'); })
    );
    ['dragleave', 'drop'].forEach((ev) =>
      dropZone.addEventListener(ev, (e) => { e.preventDefault(); dropZone.classList.remove('active'); })
    );
    dropZone.addEventListener('drop', (e) => {
      const file = e.dataTransfer.files[0];
      if (file) importFile(file);
    });

    // keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); flash('已保存'); }
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') { e.preventDefault(); $('#search').focus(); }
    });

    // initial theme
    document.documentElement.setAttribute('data-theme', 'dark');
  }

  return { init };
})();

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => App.init());
}
export default App;