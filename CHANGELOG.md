# Changelog

All notable changes to this project will be documented in this file.

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
