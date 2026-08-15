# Contributing to DataScope

Thanks for your interest in making DataScope better! 🎉

## Ways to contribute

- 🐛 Report bugs or unexpected behavior via [Issues](../../issues)
- 💡 Suggest features, UX improvements, or new format support
- 🌐 Help translate / improve documentation
- 🔧 Submit code fixes or enhancements via Pull Requests

## Getting started

1. Fork the repo and clone it locally.
2. Install dependencies (none are required at runtime, but tests use Node's built-in runner).
3. Run the app: `npm start` then open `http://localhost:8080`.
4. Run tests: `npm test`.

## Commit conventions

We follow the [Angular commit message guidelines](https://github.com/angular/angular/blob/main/CONTRIBUTING.md#commit).

- `feat:` new feature
- `fix:` bug fix
- `docs:` documentation only
- `refactor:` code change that neither fixes a bug nor adds a feature
- `test:` adding or updating tests
- `chore:` maintenance tasks

Example: `feat(parser): add TOML inline table support`

## Code style

- Keep the code **zero-dependency** and **offline-first**.
- Preserve the existing structure under `src/`.
- Add or update tests under `tests/` for any parser or pure-logic change.

## Issues

When opening an issue, include:

- Steps to reproduce
- Expected vs actual behavior
- Your environment (OS, browser, version)

Thanks again! 🙌