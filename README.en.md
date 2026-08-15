# ◈ DataScope · The Structure Lens

> 🌐 **Language / 语言**：<a href="README.md">简体中文</a> · <a href="README.zh-TW.md">繁體中文</a> · <a href="#/">English</a>

**DataScope** is a **zero-dependency, offline, browser-based JSON / YAML / TOML / CSV structure visualizer and smart editor**. It renders complex data files into a collapsible, color-coded structure tree, so you can both "grasp it at a glance" and "edit it directly" — all inside your local browser. **Your data never leaves your machine and is never uploaded anywhere.** 🔒

> 🐣 **Inspiration**: terminal tools like `jless` are read-only, `jq` requires writing filters with a steep learning curve, and online JSON viewers send your sensitive configs to third-party servers. DataScope fills the gap of "**local visualization + editing + multi-format conversion**" — works out of the box with total privacy.

---

## ✨ Core Features

- 🗂️ **Multi-format parsing & conversion**: natively supports **JSON / YAML / TOML / CSV**, with one-click lossless conversion between any of them.
- 🌳 **Color-coded structure tree**: objects/arrays auto-collapse, values colored by type (string🟢 / number🟠 / boolean🟣 / null⚪), nested levels obvious at a glance.
- ✏️ **Direct visual editing**: double-click any scalar to edit inline; add / delete / move up / move down nodes with ease.
- 🔍 **Smart search highlight**: search the tree in real time and highlight matching nodes.
- ◐ **Sensitive-value redaction**: mask fields like `password`, `apiKey`, `token` as `••••••••` with one click — perfect for demos and sharing.
- 📊 **Structure statistics**: live node count, max depth, data size, and type distribution.
- 🔧 **Format / minify / sort**: indent, minify to one line, or sort keys by name.
- ⧉ **JSONPath copy**: hover a node to copy its exact JSONPath or value for scripting.
- 🎨 **Dark / light themes**: switch with one click.
- 💾 **Import / export / drag & drop**: file import, export download, and auto-format detection on drop.
- 🚫 **Fully offline**: runs from a single file, no build, no dependencies, no network calls.

---

## 🚀 Quick Start

### 📦 Requirements

- Any modern browser (Chrome / Edge / Firefox / Safari)
- (Optional) Node.js ≥ 16 to run the local server
- **No dependencies to install**, no `npm install`

### 🏃 Option 1: Open directly (fastest)

```bash
git clone https://github.com/gitstq/DataScope.git
cd DataScope
open index.html        # macOS
start index.html       # Windows
xdg-open index.html    # Linux
```

### 🖥️ Option 2: Local server (recommended)

```bash
cd DataScope
npm start              # starts at http://localhost:8080
# or
node server.js --port 8080
```

Open **http://localhost:8080** in your browser.

### 🐍 Option 3: Python one-liner

```bash
cd DataScope
python3 -m http.server 8000   # visit http://localhost:8000
```

---

## 📖 Detailed Usage

### 1️⃣ Structure tree

On launch, the left "Source" panel is pre-filled with a sample JSON. The right "Tree" panel renders it live as a color-coded tree. Click `▾/▸` to expand/collapse; hover a node to reveal action buttons (up / down / delete / add / copy path / copy value).

![Structure tree](docs/screenshot-tree.png)

### 2️⃣ Editing data

- **Edit a scalar**: double-click a value (e.g. `"1.0.0"`), type in the inline input, press Enter to confirm or `Esc` to cancel.
- **Add a child**: hover an object/array node and click `＋`.
- **Delete / move**: hover and click `✕` to delete, `⤒ / ⤓` to move.

![Inline edit](docs/screenshot-edit.png)

### 3️⃣ Format switching & conversion

Use the top **JSON / YAML / TOML / CSV** tabs to switch anytime. DataScope parses the current data and losslessly serializes it to the target format — **no data is lost**. Great for writing configs in YAML, calling APIs with JSON, or working with CSV tables.

| Scenario | Recommended format |
|----------|--------------------|
| API debugging / app config | JSON |
| DevOps / CI config files | YAML |
| Rust / modern tool config | TOML |
| Tabular data / bulk import | CSV |

### 4️⃣ Redaction & privacy

Click **◐ Redact** in the toolbar; fields like `password`, `apiKey`, `token`, `secret` are automatically masked. Click again to restore.

![Redaction](docs/screenshot-redact.png)

### 5️⃣ Statistics & search

- **▤ Stats**: shows node count, max depth, data size, and type distribution.
- **🔍 Search**: type in the search box above the tree to highlight matches in real time.

---

## 💡 Design & Roadmap

### Design philosophy

DataScope is built on the principles of **"zero-dependency, offline-first, privacy-first"**. All parsers (YAML / TOML / CSV) are **self-developed**, with no third-party libraries, enabling single-file usage, full offline capability, and data that never leaves the browser. The UI follows a "data lens" lab aesthetic — dark base, neon accents, restrained typography — so the data itself is the star.

### Tech choices

- **Native HTML / CSS / JavaScript (ES Modules)**: zero build, zero dependencies, runs on any device that can open a web page.
- **Self-developed parsers**: covers common YAML subset (nested maps, sequences, inline arrays/maps, block scalars, comments), TOML (tables, array-of-tables, inline tables, basic types), and CSV (with/without header).
- **Node built-in test runner**: unit tests run with no extra dependencies.

### Roadmap

- [ ] JSON Schema validation & error hints
- [ ] Customizable theme colors
- [ ] More formats (XML / INI / Properties)
- [ ] Diff view
- [ ] Virtual scrolling for large files

---

## 📦 Packaging & Deployment

### Build

```bash
cd DataScope
npm run build        # produces a self-contained dist/ folder
python3 -m http.server 8000 --directory dist
```

### Deploy

- **Static hosting**: upload `dist/` to GitHub Pages, Netlify, Vercel, Nginx, or any static host.
- **Intranet / offline**: copy `dist/` to any local or intranet server and use offline.
- **Desktop**: double-click `index.html` — no server needed.

### Compatibility

| Browser | Version |
|---------|---------|
| Chrome / Edge | 80+ |
| Firefox | 78+ |
| Safari | 14+ |
| Node.js (optional) | ≥ 16 |

---

## 🤝 Contributing

- 🐛 Report bugs via [Issues](../../issues) with reproduction steps and environment details.
- 💡 Open an Issue for feature suggestions or new format support.
- 🔧 Submit code via a Fork + PR, following the [commit guidelines](CONTRIBUTING.md) (Angular Commit Convention).
- 🌐 Translate documentation and add multi-language support.

---

## 📄 License

Licensed under the **MIT License**. Free to use, modify, commercialize, and redistribute. See [LICENSE](LICENSE).

⭐ If DataScope helps you, please give it a star and share it with friends!