/**
 * JsonLens core parser & serializer.
 * Self-developed, zero-dependency parsers for JSON / YAML / TOML / CSV.
 * Supports the common subset of each format used in real-world config files.
 */

/* eslint-disable no-control-regex */

const JsonLensParser = (() => {
  // ---------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------
  function isPlainObject(v) {
    return v !== null && typeof v === 'object' && !Array.isArray(v);
  }

  function typeName(v) {
    if (v === null) return 'null';
    if (Array.isArray(v)) return 'array';
    if (v instanceof Date) return 'date';
    const t = typeof v;
    if (t === 'number') return 'number';
    if (t === 'boolean') return 'boolean';
    if (t === 'string') return 'string';
    return 'object';
  }

  // ---------------------------------------------------------------
  // JSON
  // ---------------------------------------------------------------
  const JSONParse = (text) => {
    const value = JSON.parse(text);
    if (value === undefined) throw new Error('Empty JSON');
    return value;
  };

  const JSONStringify = (value, indent = 2) => JSON.stringify(value, null, indent);

  const JSONMinify = (value) => JSON.stringify(value);

  // ---------------------------------------------------------------
  // YAML (subset)
  // ---------------------------------------------------------------
  function stripYamlComment(line) {
    // Simple: strip a trailing comment that is not inside quotes.
    let inSingle = false;
    let inDouble = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === "'" && !inDouble) inSingle = !inSingle;
      else if (c === '"' && !inSingle) inDouble = !inDouble;
      else if (c === '#' && !inSingle && !inDouble) return line.slice(0, i);
    }
    return line;
  }

  function parseYamlScalar(raw) {
    const s = raw.trim();
    if (s === '' || s === '~' || s === 'null' || s === 'Null' || s === 'NULL') return null;
    if (s === 'true' || s === 'True' || s === 'TRUE') return true;
    if (s === 'false' || s === 'False' || s === 'FALSE') return false;
    if (s.startsWith('"') && s.endsWith('"') && s.length >= 2) {
      try { return JSON.parse(s); } catch { return s.slice(1, -1); }
    }
    if (s.startsWith("'") && s.endsWith("'") && s.length >= 2) {
      return s.slice(1, -1).replace(/''/g, "'");
    }
    // number (int / float / exponent)
    if (/^[-+]?(\d+|\d*\.\d+)([eE][-+]?\d+)?$/.test(s)) {
      const n = Number(s);
      if (!Number.isNaN(n)) return n;
    }
    // date-like
    if (/^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/.test(s)) {
      const d = new Date(s);
      if (!Number.isNaN(d.getTime())) return d;
    }
    return s;
  }

  function yamlParseBlock(lines) {
    // Iterative YAML subset parser using indentation.
    const indentUnit = '  ';
    const stack = []; // each entry: {indent, container(Array|Object), key}
    let root = null;

    function indentOf(line) {
      let n = 0;
      while (line[n] === ' ') n++;
      return n;
    }

    for (let idx = 0; idx < lines.length; idx++) {
      const raw = lines[idx];
      if (raw.trim() === '' || raw.trim().startsWith('#')) continue;
      const indent = indentOf(raw);
      const content = stripYamlComment(raw).trim();

      // Pop stack entries deeper than current indent
      while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop();

      const parent = stack.length ? stack[stack.length - 1].container : null;

      // Sequence item
      if (content.startsWith('- ') || content === '-') {
        const itemRaw = content === '-' ? '' : content.slice(2).trim();
        let arr;
        if (parent === null) {
          if (root === null) { root = []; arr = root; }
          else if (Array.isArray(root)) { arr = root; }
          else throw new Error('Malformed YAML: mixed root');
        } else if (Array.isArray(parent)) {
          arr = parent;
        } else {
          throw new Error('Malformed YAML: sequence under mapping');
        }
        // Determine if item is inline map or scalar
        if (itemRaw === '') {
          // nested block starts in following lines
          arr.push(null);
          stack.push({ indent, container: arr, key: arr.length - 1 });
        } else if (itemRaw.startsWith('{') || itemRaw.includes(': ')) {
          const sub = parseInlineStructure(itemRaw);
          arr.push(sub);
          if (isPlainObject(sub)) stack.push({ indent, container: sub, key: null });
        } else {
          arr.push(parseYamlScalar(itemRaw));
        }
        continue;
      }

      // Mapping entry: key: value
      const colonIdx = findYamlColon(content);
      if (colonIdx === -1) throw new Error(`Malformed YAML line: ${content}`);
      const key = content.slice(0, colonIdx).trim().replace(/^['"]|['"]$/g, '');
      let valRaw = content.slice(colonIdx + 1).trim();

      let target;
      if (parent === null) {
        if (root === null) { root = {}; target = root; }
        else if (isPlainObject(root)) { target = root; }
        else throw new Error('Malformed YAML: mixed root');
      } else if (isPlainObject(parent)) {
        target = parent;
      } else {
        throw new Error('Malformed YAML: mapping under sequence');
      }

      if (valRaw === '' || valRaw === '|' || valRaw.startsWith('|') || valRaw === '>' || valRaw.startsWith('>')) {
        // Nested block or folded scalar
        let collected = [];
        let j = idx + 1;
        const blockIndent = indent + 1;
        while (j < lines.length) {
          const next = lines[j];
          if (next.trim() === '') { j++; continue; }
          if (indentOf(next) > indent) { collected.push(next); j++; }
          else break;
        }
        if (collected.length && (valRaw === '' || valRaw === '>' || valRaw.startsWith('>'))) {
          // folded / plain multiline not fully supported -> attempt nested parse
          try {
            const sub = yamlParseBlock(collected.map((l) => l.slice(Math.min(blockIndent, indentOf(l)))));
            target[key] = sub;
          } catch {
            target[key] = collected.map((l) => l.trim()).join('\n');
          }
          idx = j - 1;
        } else {
          // literal block |
          const minIndent = Math.min(...collected.filter((l) => l.trim() !== '').map(indentOf), Infinity);
          const text = collected
            .filter((l) => l.trim() !== '' || true)
            .map((l) => (l.trim() === '' ? '' : l.slice(minIndent)))
            .join('\n');
          target[key] = text.replace(/\n$/, '');
          idx = j - 1;
        }
        stack.push({ indent, container: target, key });
        continue;
      }

      if (valRaw.startsWith('[') || valRaw.startsWith('{')) {
        target[key] = parseInlineStructure(valRaw);
      } else {
        target[key] = parseYamlScalar(valRaw);
      }
      stack.push({ indent, container: target, key });
    }

    return root;
  }

  function findYamlColon(s) {
    let inSingle = false;
    let inDouble = false;
    let depth = 0;
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (c === "'" && !inDouble) inSingle = !inSingle;
      else if (c === '"' && !inSingle) inDouble = !inDouble;
      else if (!inSingle && !inDouble) {
        if (c === '[' || c === '{') depth++;
        else if (c === ']' || c === '}') depth--;
        else if (c === ':' && depth === 0) return i;
      }
    }
    return -1;
  }

  function parseInlineStructure(s) {
    s = s.trim();
    if (s.startsWith('[')) {
      const inner = s.slice(1, -1).trim();
      if (inner === '') return [];
      return splitTopLevel(inner, ',').map((item) => {
        const t = item.trim();
        if (t.startsWith('[') || t.startsWith('{')) return parseInlineStructure(t);
        return parseYamlScalar(t);
      });
    }
    if (s.startsWith('{')) {
      const inner = s.slice(1, -1).trim();
      if (inner === '') return {};
      const obj = {};
      for (const pair of splitTopLevel(inner, ',')) {
        const ci = findYamlColon(pair);
        if (ci === -1) continue;
        const k = pair.slice(0, ci).trim().replace(/^['"]|['"]$/g, '');
        const v = pair.slice(ci + 1).trim();
        obj[k] = v.startsWith('[') || v.startsWith('{') ? parseInlineStructure(v) : parseYamlScalar(v);
      }
      return obj;
    }
    // Bare inline mapping: `key: value, key2: value2`
    const ci = findYamlColon(s);
    if (ci !== -1) {
      const obj = {};
      for (const pair of splitTopLevel(s, ',')) {
        const c = findYamlColon(pair);
        if (c === -1) continue;
        const k = pair.slice(0, c).trim().replace(/^['"]|['"]$/g, '');
        const v = pair.slice(c + 1).trim();
        obj[k] = v.startsWith('[') || v.startsWith('{') ? parseInlineStructure(v) : parseYamlScalar(v);
      }
      return obj;
    }
    return parseYamlScalar(s);
  }

  function splitTopLevel(s, sep) {
    const parts = [];
    let depth = 0;
    let cur = '';
    let inSingle = false;
    let inDouble = false;
    for (const c of s) {
      if (c === "'" && !inDouble) inSingle = !inSingle;
      else if (c === '"' && !inSingle) inDouble = !inDouble;
      if (!inSingle && !inDouble) {
        if (c === '[' || c === '{') depth++;
        else if (c === ']' || c === '}') depth--;
        else if (c === sep && depth === 0) { parts.push(cur); cur = ''; continue; }
      }
      cur += c;
    }
    if (cur.trim() !== '') parts.push(cur);
    return parts;
  }

  const YAMLParse = (text) => {
    const lines = text.replace(/\r\n/g, '\n').split('\n');
    const value = yamlParseBlock(lines);
    if (value === null || value === undefined) throw new Error('Empty YAML');
    return value;
  };

  function yamlScalarOut(v) {
    if (v === null) return 'null';
    if (typeof v === 'boolean') return v ? 'true' : 'false';
    if (typeof v === 'number') return String(v);
    if (v instanceof Date) return v.toISOString();
    if (typeof v === 'string') {
      if (v === '') return '""';
      if (/[:#\[\]{},&*!|>'"%@`]|^\s|\s$|^\s*-|\n/.test(v)) {
        return JSON.stringify(v);
      }
      return v;
    }
    return String(v);
  }

  function yamlEmit(value, indent, key) {
    const pad = '  '.repeat(indent);
    const lines = [];
    if (Array.isArray(value)) {
      if (value.length === 0) {
        lines.push(pad + (key != null ? key + ': []' : '[]'));
        return lines;
      }
      const header = key != null;
      if (header) lines.push(pad + key + ':');
      const itemPad = header ? indent + 1 : indent;
      for (const item of value) {
        const ipad = '  '.repeat(itemPad);
        if (isPlainObject(item)) {
          const ikeys = Object.keys(item);
          if (ikeys.length === 0) { lines.push(ipad + '- {}'); continue; }
          const first = ikeys[0];
          const firstVal = item[first];
          if (isPlainObject(firstVal) || Array.isArray(firstVal)) {
            lines.push(ipad + '-');
            for (const ik of ikeys) lines.push(...yamlEmit(item[ik], itemPad + 1, ik));
          } else {
            lines.push(ipad + '- ' + first + ': ' + yamlScalarOut(firstVal));
            for (let i = 1; i < ikeys.length; i++) {
              lines.push(...yamlEmit(item[ikeys[i]], itemPad + 1, ikeys[i]));
            }
          }
        } else if (Array.isArray(item)) {
          lines.push(ipad + '-');
          lines.push(...yamlEmit(item, itemPad + 1, null));
        } else {
          lines.push(ipad + '- ' + yamlScalarOut(item));
        }
      }
      return lines;
    }
    if (isPlainObject(value)) {
      const keys = Object.keys(value);
      if (keys.length === 0) {
        lines.push(pad + (key != null ? key + ': {}' : '{}'));
        return lines;
      }
      if (key != null) lines.push(pad + key + ':');
      const childPad = key != null ? indent + 1 : indent;
      for (const k of keys) lines.push(...yamlEmit(value[k], childPad, k));
      return lines;
    }
    lines.push(pad + (key != null ? key + ': ' : '') + yamlScalarOut(value));
    return lines;
  }

  function YAMLStringify(value) {
    if (isPlainObject(value) || Array.isArray(value)) {
      return yamlEmit(value, 0, null).join('\n').replace(/:\n  \[\]/g, ': []');
    }
    return yamlScalarOut(value);
  }

  // ---------------------------------------------------------------
  // TOML (subset)
  // ---------------------------------------------------------------
  function parseTomlValue(raw) {
    const s = raw.trim();
    if (s === '') throw new Error('Empty TOML value');
    // strings
    if (s.startsWith('"""')) {
      const end = s.indexOf('"""', 3);
      if (end === -1) throw new Error('Unterminated multiline string');
      return s.slice(3, end).replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\"/g, '"');
    }
    if (s.startsWith("'''")) {
      const end = s.indexOf("'''", 3);
      if (end === -1) throw new Error('Unterminated literal string');
      return s.slice(3, end);
    }
    if (s.startsWith('"')) {
      if (!s.endsWith('"')) throw new Error('Unterminated string');
      return JSON.parse(s);
    }
    if (s.startsWith("'")) {
      if (!s.endsWith("'")) throw new Error('Unterminated string');
      return s.slice(1, -1);
    }
    // arrays
    if (s.startsWith('[')) {
      const inner = s.slice(1, -1).trim();
      if (inner === '') return [];
      return splitTopLevel(inner, ',').map(parseTomlValue);
    }
    // inline tables
    if (s.startsWith('{')) {
      const inner = s.slice(1, -1).trim();
      if (inner === '') return {};
      const obj = {};
      for (const pair of splitTopLevel(inner, ',')) {
        const eq = pair.indexOf('=');
        if (eq === -1) continue;
        const k = pair.slice(0, eq).trim().replace(/^["']|["']$/g, '');
        obj[k] = parseTomlValue(pair.slice(eq + 1));
      }
      return obj;
    }
    // booleans
    if (s === 'true') return true;
    if (s === 'false') return false;
    // numbers
    if (/^[+-]?\d+$/.test(s)) return parseInt(s, 10);
    if (/^[+-]?(\d+\.\d*|\.\d+)([eE][+-]?\d+)?$/.test(s)) return parseFloat(s);
    if (/^[+-]?0x[0-9a-fA-F]+$/.test(s)) return parseInt(s, 16);
    if (/^[+-]?0o[0-7]+$/.test(s)) return parseInt(s, 8);
    if (/^[+-]?0b[01]+$/.test(s)) return parseInt(s, 2);
    // datetime
    if (/^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/.test(s)) {
      const d = new Date(s.includes(' ') ? s.replace(' ', 'T') : s.replace('Z', 'Z'));
      if (!Number.isNaN(d.getTime())) return d;
    }
    throw new Error(`Unsupported TOML value: ${s}`);
  }

  function TOMLParse(text) {
    const lines = text.replace(/\r\n/g, '\n').split('\n');
    const root = {};
    let current = root;
    let arrayOfTables = null;

    for (const raw of lines) {
      const line = raw.trim();
      if (line === '' || line.startsWith('#')) continue;
      // Array of tables
      if (line.startsWith('[[')) {
        const path = line.slice(2, -2).trim();
        const keys = path.split('.');
        let target = root;
        for (let i = 0; i < keys.length; i++) {
          const k = keys[i];
          if (i === keys.length - 1) {
            if (!Array.isArray(target[k])) target[k] = [];
            const arr = target[k];
            arr.push({});
            current = arr[arr.length - 1];
            arrayOfTables = current;
          } else {
            if (!isPlainObject(target[k])) target[k] = {};
            target = target[k];
          }
        }
        continue;
      }
      // Table
      if (line.startsWith('[')) {
        const path = line.slice(1, -1).trim();
        const keys = path.split('.');
        let target = root;
        for (const k of keys) {
          if (!isPlainObject(target[k])) target[k] = {};
          target = target[k];
        }
        current = target;
        arrayOfTables = null;
        continue;
      }
      // key = value
      const eq = line.indexOf('=');
      if (eq === -1) throw new Error(`Malformed TOML line: ${line}`);
      const key = line.slice(0, eq).trim().replace(/^["']|["']$/g, '');
      const valRaw = line.slice(eq + 1).trim().replace(/#.*$/, '');
      const value = parseTomlValue(valRaw);
      if (arrayOfTables) {
        // aot persists for subsequent keys
      }
      current[key] = value;
    }
    return root;
  }

  function tomlScalarOut(v) {
    if (v === null) return '""';
    if (typeof v === 'boolean') return v ? 'true' : 'false';
    if (typeof v === 'number') return String(v);
    if (v instanceof Date) return v.toISOString();
    if (typeof v === 'string') return JSON.stringify(v);
    if (Array.isArray(v)) return '[' + v.map(tomlScalarOut).join(', ') + ']';
    if (isPlainObject(v)) {
      return '{ ' + Object.entries(v).map(([k, val]) => `${k} = ${tomlScalarOut(val)}`).join(', ') + ' }';
    }
    return JSON.stringify(String(v));
  }

  function TOMLStringify(value) {
    if (!isPlainObject(value)) return tomlScalarOut(value);
    const lines = [];
    const tables = [];
    const walk = (obj, prefix) => {
      for (const [k, v] of Object.entries(obj)) {
        if (Array.isArray(v) && v.some(isPlainObject)) {
          for (const item of v) {
            const p = prefix ? `${prefix}.${k}` : k;
            lines.push(`[[${p}]]`);
            walkScalars(item, lines);
          }
        } else if (isPlainObject(v)) {
          const p = prefix ? `${prefix}.${k}` : k;
          tables.push([p, v]);
        } else {
          lines.push(`${prefix ? prefix + '.' : ''}${k} = ${tomlScalarOut(v)}`);
        }
      }
    };
    const walkScalars = (obj, arr) => {
      for (const [k, v] of Object.entries(obj)) {
        if (!isPlainObject(v) && !(Array.isArray(v) && v.some(isPlainObject))) {
          arr.push(`${k} = ${tomlScalarOut(v)}`);
        }
      }
    };
    walk(value, '', false);
    for (const [path, obj] of tables) {
      lines.push('');
      lines.push(`[${path}]`);
      walk(obj, path, true);
    }
    return lines.join('\n');
  }

  // ---------------------------------------------------------------
  // CSV
  // ---------------------------------------------------------------
  function CSVParse(text, header = true) {
    const rows = [];
    let row = [];
    let field = '';
    let inQuotes = false;
    const chars = text.replace(/\r\n/g, '\n').split('');
    for (let i = 0; i < chars.length; i++) {
      const c = chars[i];
      if (inQuotes) {
        if (c === '"') {
          if (chars[i + 1] === '"') { field += '"'; i++; }
          else inQuotes = false;
        } else field += c;
      } else if (c === '"') {
        inQuotes = true;
      } else if (c === ',') {
        row.push(field); field = '';
      } else if (c === '\n') {
        row.push(field);
        if (row.some((x) => x !== '')) rows.push(row);
        row = []; field = '';
      } else {
        field += c;
      }
    }
    if (field !== '' || row.length) { row.push(field); if (row.some((x) => x !== '')) rows.push(row); }

    if (!rows.length) return {};
    if (header) {
      const keys = rows[0];
      return rows.slice(1).map((r) => {
        const o = {};
        keys.forEach((k, i) => { o[k] = coerce(r[i]); });
        return o;
      });
    }
    return rows.map((r) => r.map(coerce));
  }

  function coerce(v) {
    if (v === '') return null;
    if (v === 'true') return true;
    if (v === 'false') return false;
    if (/^[-+]?\d+(\.\d+)?$/.test(v)) { const n = Number(v); if (!Number.isNaN(n)) return n; }
    return v;
  }

  function csvEscape(v) {
    const s = v === null || v === undefined ? '' : String(v);
    if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  function CSVStringify(value, header = true) {
    if (Array.isArray(value)) {
      const rows = [];
      if (header && value.length && isPlainObject(value[0])) {
        const keys = Object.keys(value[0]);
        rows.push(keys.map(csvEscape).join(','));
        for (const item of value) {
          rows.push(keys.map((k) => csvEscape(item[k])).join(','));
        }
      } else {
        for (const item of value) rows.push((Array.isArray(item) ? item : [item]).map(csvEscape).join(','));
      }
      return rows.join('\n');
    }
    return csvEscape(value);
  }

  // ---------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------
  return {
    JSONParse,
    JSONStringify,
    JSONMinify,
    YAMLParse,
    YAMLStringify,
    TOMLParse,
    TOMLStringify,
    CSVParse,
    CSVStringify,
    typeName,
    isPlainObject,
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = JsonLensParser;
}
export default JsonLensParser;