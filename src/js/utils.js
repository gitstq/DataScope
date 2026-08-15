/**
 * JsonLens utility functions: JSONPath, statistics, redaction, tree ops.
 */

const JsonLensUtils = (() => {
  const { isPlainObject } = { ...(typeof JsonLensParser !== 'undefined' ? { isPlainObject: JsonLensParser.isPlainObject } : {}) };

  function isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
  function typeName(v) {
    if (v === null) return 'null';
    if (Array.isArray(v)) return 'array';
    if (v instanceof Date) return 'date';
    const t = typeof v;
    return t === 'number' ? 'number' : t === 'boolean' ? 'boolean' : t === 'string' ? 'string' : 'object';
  }

  // ---- Statistics ----
  function countNodes(value) {
    let count = 0;
    const walk = (v) => {
      count++;
      if (Array.isArray(v)) v.forEach(walk);
      else if (isObj(v)) Object.values(v).forEach(walk);
    };
    walk(value);
    return count;
  }

  function maxDepth(value) {
    const walk = (v, d) => {
      if (Array.isArray(v)) return v.length ? Math.max(...v.map((x) => walk(x, d + 1))) : d + 1;
      if (isObj(v)) {
        const vals = Object.values(v);
        return vals.length ? Math.max(...vals.map((x) => walk(x, d + 1))) : d + 1;
      }
      return d;
    };
    return walk(value, 0);
  }

  function typeDistribution(value) {
    const dist = {};
    const walk = (v) => {
      const t = typeName(v);
      dist[t] = (dist[t] || 0) + 1;
      if (Array.isArray(v)) v.forEach(walk);
      else if (isObj(v)) Object.values(v).forEach(walk);
    };
    walk(value);
    return dist;
  }

  function formatBytes(v) {
    const s = typeof v === 'string' ? v : JSON.stringify(v);
    const bytes = new Blob([s]).size;
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  // ---- JSONPath ----
  function toJsonPath(basePath, key, isArray) {
    if (basePath === '$') return isArray ? `${basePath}[${key}]` : /^[A-Za-z_$][\w$]*$/.test(String(key)) ? `${basePath}.${key}` : `${basePath}[${JSON.stringify(String(key))}]`;
    if (isArray) return `${basePath}[${key}]`;
    return /^[A-Za-z_$][\w$]*$/.test(String(key)) ? `${basePath}.${key}` : `${basePath}[${JSON.stringify(String(key))}]`;
  }

  function getByPath(value, path) {
    // path like $.a.b[0].c
    const tokens = path.replace(/^\$\.?/, '').split(/\.|\[(\d+)\]|\["([^"]+)"\]/).filter(Boolean);
    let cur = value;
    for (const t of tokens) {
      if (cur == null) return undefined;
      cur = cur[t];
    }
    return cur;
  }

  // ---- Redaction ----
  const SECRET_KEYS = /(password|passwd|secret|token|apikey|api_key|apisecret|apisecret|access_key|accesskey|private_key|privatekey|auth|authorization|credential|cookie|session|bearer|client_secret|secret_key|ssh)/i;

  function redactValue(value, enabled) {
    if (!enabled) return value;
    const walk = (v) => {
      if (Array.isArray(v)) return v.map(walk);
      if (isObj(v)) {
        const out = {};
        for (const [k, val] of Object.entries(v)) {
          if (SECRET_KEYS.test(k)) out[k] = '••••••••';
          else out[k] = walk(val);
        }
        return out;
      }
      return v;
    };
    return walk(value);
  }

  // ---- Tree operations (immutable-ish helpers) ----
  function clone(value) {
    if (value instanceof Date) return new Date(value);
    if (Array.isArray(value)) return value.map(clone);
    if (isObj(value)) { const o = {}; for (const k of Object.keys(value)) o[k] = clone(value[k]); return o; }
    return value;
  }

  function defaultScalar() {
    return '';
  }

  // ---- Sorting ----
  function sortKeys(value) {
    const walk = (v) => {
      if (Array.isArray(v)) return v.map(walk);
      if (isObj(v)) {
        const o = {};
        Object.keys(v).sort().forEach((k) => { o[k] = walk(v[k]); });
        return o;
      }
      return v;
    };
    return walk(value);
  }

  return {
    isObj,
    typeName,
    countNodes,
    maxDepth,
    typeDistribution,
    formatBytes,
    toJsonPath,
    getByPath,
    redactValue,
    clone,
    defaultScalar,
    sortKeys,
    SECRET_KEYS,
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports.JsonLensUtils = JsonLensUtils;
}
export default JsonLensUtils;