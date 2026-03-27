# Changelog

All notable changes to this project will be documented in this file.

## [0.8.0] - 2026-03-27

### Added

- **Claude Cowork / Desktop support** — MCP connectors now install to `claude_desktop_config.json` with `--cowork` flag
- **Platform targeting flags** — `--claude-code`, `--cowork`, and `--all` for `antidrift connect`
- 5 supported platforms: Claude Code, Claude Cowork / Desktop, OpenAI Codex, Cursor, Google Antigravity

## [0.7.3] - 2026-03-27

### Added

- **Attio MCP** — 14 tools: people, companies, deals, tasks, notes, pipeline management
- Portable `.mcp-servers/` install for project-level MCP configuration

## [0.7.2] - 2026-03-26

### Added

- **Stripe MCP** — 17 tools: customers, invoices, subscriptions, charges, products, prices, payment links, balance
- **GitHub MCP** — 15 tools: repos, issues, PRs, actions, releases, branches, file access, traffic

## [0.7.1] - 2026-03-26

### Fixed

- Async `getAuthClient` in Google Workspace connectors (Calendar, Drive, Gmail, Sheets)

## [0.7.0] - 2026-03-26

### Changed

- Google MCP auth switched from device auth flow to loopback redirect for faster, more reliable OAuth
- 4 platform support: Claude Code, Codex, Cursor, and Antigravity

### Added

- `antidrift connect` command for first-party MCP connector setup
- 21 skills across all packs
- 118 tests across Node.js and Python

## [0.6.5] - 2026-03-26

### Added

- Google Workspace MCP published to registry
- Version displayed in CLI banner
- Website and Probeo branding updates

## [0.6.4] - 2026-03-26

### Fixed

- Python package excludes `__pycache__` from dist
- Export `parseIR` from core for third-party integrations
- Updated CLI banner and messages

### Added

- Python test suite — 32 tests covering init, sync, and CLI commands

## [0.6.3] - 2026-03-26

### Added

- Comprehensive test suite — 86 tests across `@antidrift/core` and `@antidrift/skills`
- Covers init, brain sync, IR compilation, skill CLI, and cross-compile round-trips
- 118 total tests across Node.js and Python

## [0.6.2] - 2026-03-26

### Added

- Python CLI now supports `antidrift skills list`, `antidrift skills add`, and `antidrift cross-compile`
- Delegates to `npx` under the hood — single compiler, zero duplication
- `pip install antidrift` now gets the same capabilities as the Node.js CLI

## [0.6.1] - 2026-03-26

### Added

- **Cursor and Antigravity support** — brain context and skills compile for all five tools
- Cross-platform compiler updated for Claude Code, Cowork, Codex, Cursor, and Antigravity
- **Security skill pack** — audit, secrets, threat-model, incident, pentest-prep
- Any tool that reads markdown context files works out of the box

## [0.6.0] - 2026-03-26

### Added

- **Google Antigravity support** — GEMINI.md brain file sync
- Triple brain file sync (CLAUDE.md + AGENTS.md + GEMINI.md)

## [0.5.4] - 2026-03-26

### Added

- **Unified CLI** — `@antidrift/cli` package for init, join, skills, and updates
- Pack-based skill installation: `antidrift skills add essentials`
- 4 skill packs: essentials, engineering, customer-research, legal
- Install everything at once with `antidrift skills add --all`
- Additive merge strategy for `/push` — safer team-level merges
- Idempotent ingest with project detection and local path separation
- Cleaner skills list output with truncated descriptions and `/name` format

## [0.5.0] - 2026-03-25

### Changed

- Skills CLI no longer requires `gh` or GitHub auth
- Skills list and add now fetch from a hosted registry over HTTPS
- Registry auto-builds on merge to antidrift-skills

## [0.4.1] - 2026-03-25

### Fixed

- Improved `antidrift update` output with step-by-step progress
- Single source of truth for versioning via `version.json` + sync script

## [0.4.0] - 2026-03-25

### Added

- **Cross-platform skill compiler** — convert skills between Claude Code and Codex
  - `antidrift cross-compile <path> --to <claude|codex>` CLI command
  - Universal IR (intermediate representation) format for platform-agnostic skills
  - Auto-detect source platform, warnings for untranslatable features
  - Round-trip preservation: claude → codex → claude retains content
- **Dual platform support** — CLAUDE.md + AGENTS.md
  - `init` creates both root files
  - `update` syncs all CLAUDE.md ↔ AGENTS.md across the brain
  - `/push` syncs brain files before every commit
  - `/ingest` creates both files for every department
  - CLAUDE.md is source of truth when both exist and differ
- **Community skills in IR format** — registry uses universal format, compiled on install
  - `@antidrift/skills add` detects platform and compiles to native format
  - `update` recompiles installed IR skills for all detected platforms
  - Supports dual-platform installs (Claude Code + Codex on same machine)
- **Test suite** — 31 tests covering compiler, decompiler, cross-compile, round-trip

## [0.3.0] - 2026-03-23

### Added

- Initial public release
- Company brain with CLAUDE.md per department
- Core skills: `/onboard`, `/push`, `/refresh`, `/ingest`, `/remote`, `/invite`, `/publish`
- Community skills registry (`@antidrift/skills`)
- MCP integrations: Google Workspace, Stripe, Attio CRM
- Python installer (`pip install antidrift`)
