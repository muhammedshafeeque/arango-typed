# Changelog

## 1.3.9 - 2025-11-03
- fix(build): correct ESM import paths for integrations subdirectories (langchain, express, frameworks)
- fix: ensure all integration imports use explicit `/index` paths for proper ESM resolution

## 1.3.8 - 2025-11-03
- feat(connection): auto-create database if not found (configurable via `autoCreateDatabase`, default true)
- fix(build): proper ESM with `.js` extensions in relative imports; dual exports maintained
- docs: added basic SEO assets (docs/index.html, robots.txt, sitemap.xml)
- chore: improved package.json description and keywords; README badges/keywords

## 1.3.7 - 2025-11-03
- fix(build): ensure ESM resolution works; restore ESM/CJS exports
- chore: publish fixes to npm

## 1.3.6 - 2025-11-03
- fix(build): temporarily route import/require to CJS to avoid ESM extension issues
