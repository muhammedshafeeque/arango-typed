# Changelog

## 1.6.3 - 2025-02-13
- fix(exports): added package.json export for better module resolution compatibility
- docs: documented workaround for `node --import tsx` named export resolution issue
- note: when using `node --import tsx`, use namespace imports (`import * as arango`) or run `tsx` directly

## 1.6.2 - 2025-02-13
- fix(exports): simplified package.json exports structure for better Node.js ESM compatibility
- fix(exports): removed nested export conditions that were causing ESM resolution failures
- fix(exports): flattened exports to use direct paths for import/require/types conditions
- fix(exports): added default export condition and reordered exports for better Node.js v24 compatibility

## 1.6.1 - 2025-02-13
- fix(exports): improved ESM module exports configuration for better compatibility
- fix(exports): added explicit `module` field and enhanced `exports` mapping in package.json
- fix(exports): resolved "does not provide an export named 'connect'" error in ESM environments
- build: updated package.json exports to support both ESM and CommonJS with proper type definitions

## 1.6.0 - 2025-01-15
- feat(audit): comprehensive audit functionality with automatic tracking
- feat(audit): AuditContext for managing user context
- feat(model): automatic audit fields (createdBy, createdAt, updatedBy, updatedAt, deletedBy, deletedAt)
- feat(model): automatic audit logging for all CRUD operations
- feat(model): `getAuditLogs()`, `getAuditLogsByUser()`, and `getAuditLogsByAction()` methods
- feat(model): audit field injection for create, update, and delete operations
- feat(document): automatic audit field tracking in Document.save()
- feat(audit): integration with multi-tenancy and soft delete
- feat(audit): custom audit field names and audit log collection configuration
- docs: comprehensive audit documentation with examples and best practices
- docs: updated HTML documentation with audit functionality section

## 1.5.0 - 2025-01-15
- feat(model): soft delete functionality with `isDeleted` and `deletedAt` fields
- feat(model): automatic filtering of soft-deleted documents in queries
- feat(model): `findWithDeleted()` and `findDeleted()` methods for querying soft-deleted documents
- feat(model): `restore()` method to restore soft-deleted documents
- feat(model): `hardDelete()` method for permanent deletion when soft delete is enabled
- feat(document): `softDelete()`, `restore()`, and `hardDelete()` instance methods
- feat(query): `withDeleted()` and `onlyDeleted()` chainable query methods
- feat(query): automatic soft delete filtering in QueryBuilder and LeanQuery
- docs: comprehensive soft delete documentation with examples and multi-tenancy integration
- docs: updated HTML documentation with soft delete section

## 1.4.0 - 2025-01-15
- feat(query): automatic partial text search for fields ending with "Contains" (e.g., `nameContains`, `codeContains`)
- feat(query): case-insensitive LIKE search for Contains fields with automatic field name extraction
- docs: comprehensive LangChain integration documentation with RAG, MCP, and VectorStore examples
- docs: enhanced index.html with statistics, use cases, code examples, and quick links
- docs: added beautiful icon and active sidebar link highlighting for better navigation
- docs: reorganized documentation structure (moved sitemap.xml, robots.txt, index.html to html/ directory)
- docs: updated sitemap.xml with all documentation pages and proper SEO metadata
- docs: improved robots.txt with correct paths and disallow rules
- test: added tests for partial text search functionality

## 1.3.11 - 2025-01-XX
- Previous version

## 1.3.10 - 2025-11-03
- feat: export `ArangoClient` as alias for `Database` (from arangojs) for compatibility
- fix: users can now import `ArangoClient` directly from `arango-typed`

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
