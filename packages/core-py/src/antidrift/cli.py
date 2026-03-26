#!/usr/bin/env python3
"""antidrift — Company brain for you and your AI agents."""

import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

SKILLS_DIR = Path(__file__).parent / "skills"

BANNER = """
  ┌─────────────────────────────┐
  │  antidrift                  │
  │  AI agents and you          │
  └─────────────────────────────┘
"""


def ask(prompt: str) -> str:
    try:
        return input(prompt)
    except (EOFError, KeyboardInterrupt):
        print()
        sys.exit(0)


def run(cmd: str, **kwargs) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, shell=True, **kwargs)


def check_prereqs() -> list[dict]:
    missing = []
    p = sys.platform

    if shutil.which("git") is None:
        if p == "darwin":
            install = "Run: xcode-select --install\n             Or: brew install git"
        elif p == "win32":
            install = "Download: https://git-scm.com/download/win\n             Or: winget install Git.Git"
        else:
            install = "Run: sudo apt install git\n             Or: sudo dnf install git"
        missing.append({"name": "git", "install": install})

    # Check for either Claude Code or Codex
    has_claude = shutil.which("claude") is not None
    has_codex = shutil.which("codex") is not None
    if not has_claude and not has_codex:
        if p == "darwin":
            install = "Claude Code: brew install claude-code\n             Codex: npm install -g @openai/codex"
        else:
            install = "Claude Code: npm install -g @anthropic-ai/claude-code\n             Codex: npm install -g @openai/codex"
        missing.append({"name": "Claude Code or Codex", "install": install})

    return missing


def install_core_skills(target_dir: Path):
    target_dir.mkdir(parents=True, exist_ok=True)
    skills = [d.name for d in SKILLS_DIR.iterdir() if d.is_dir() and (d / "SKILL.md").exists()]
    for skill in skills:
        src = SKILLS_DIR / skill
        dst = target_dir / skill
        if dst.exists():
            shutil.rmtree(dst)
        shutil.copytree(src, dst)
    print(f"    Installed {len(skills)} core skills: {', '.join(sorted(skills))}")


def sync_brain_files(root_dir: Path):
    """Sync CLAUDE.md ↔ AGENTS.md across all directories."""
    synced = 0
    skip = {"node_modules", ".git", ".venv", "__pycache__"}

    for dirpath, dirnames, filenames in os.walk(root_dir):
        dirnames[:] = [d for d in dirnames if d not in skip]
        dp = Path(dirpath)
        claude_path = dp / "CLAUDE.md"
        agents_path = dp / "AGENTS.md"
        gemini_path = dp / "GEMINI.md"

        # Find source of truth: CLAUDE.md > AGENTS.md > GEMINI.md
        source = None
        if claude_path.exists():
            source = claude_path
        elif agents_path.exists():
            source = agents_path
        elif gemini_path.exists():
            source = gemini_path

        if source:
            content = source.read_text()
            for target in [claude_path, agents_path, gemini_path]:
                if target == source:
                    continue
                if not target.exists() or target.read_text() != content:
                    target.write_text(content)
                    synced += 1

    if synced > 0:
        print(f"    Synced {synced} brain file(s) (CLAUDE.md ↔ AGENTS.md ↔ GEMINI.md)")
    else:
        print("    All brain files in sync")


def show_help():
    print("""
antidrift — Company brain for you and your AI agents

Usage:
  antidrift init              Start a new brain
  antidrift join <repo>       Join an existing brain
  antidrift update            Update core skills + sync brain files
  antidrift help              Show this message

Community skills:
  npm install -g @antidrift/cli
  antidrift skills list       Browse community skills
  antidrift skills add <pack> Install a skill pack

Connect services (type /connect inside Claude, or install directly):
  npx @antidrift/mcp-google   Google Sheets, Docs, Drive, Gmail, Calendar
  npx @antidrift/mcp-stripe   Stripe invoices, customers
  npx @antidrift/mcp-attio    Attio CRM

Learn more: https://antidrift.io
""")


def init():
    print(BANNER)

    company = ask("  Company name: ")
    dir_name = "".join(c if c.isalnum() else "-" for c in company.strip().lower()).strip("-") or "company-brain"
    while "--" in dir_name:
        dir_name = dir_name.replace("--", "-")
    target_dir = Path.cwd() / dir_name

    if target_dir.exists():
        print(f"\n  {dir_name}/ already exists.")
        return

    target_dir.mkdir(parents=True)
    print(f"  Created {dir_name}/")

    # Git
    if not (target_dir / ".git").exists():
        run("git init && git branch -m main", cwd=target_dir, capture_output=True)
        print("  Initialized git repo")

    # Gitignore
    gitignore = target_dir / ".gitignore"
    if not gitignore.exists():
        gitignore.write_text("scratch/\n.code/\n.env\n.env.*\n*.local\n.DS_Store\n.claude/local.json\n")
        print("  Created .gitignore")

    # Core skills
    install_core_skills(target_dir / ".claude" / "skills")

    # Brain files — both CLAUDE.md and AGENTS.md
    brain_content = f"""# {company.strip()} — Company Brain

## Getting Started
- `/ingest <path>` — Import files and directories into the brain
- `/push` — Save changes (commits locally, pushes if remote exists)
- `/refresh` — Pull latest changes from remote
- `/remote` — Set up GitHub so the team can share the brain
- `/publish <skill>` — Share a skill you built with the community
- Say **"I'm new here"** to get walked through everything

## How It Works
Each directory has a brain file (CLAUDE.md / AGENTS.md) that your agent reads automatically. Add departments by creating directories. The brain grows as you use it.

## Departments

| Directory | What's In It |
|---|---|
| _Run /ingest to populate_ | |
"""
    (target_dir / "CLAUDE.md").write_text(brain_content)
    (target_dir / "AGENTS.md").write_text(brain_content)
    (target_dir / "GEMINI.md").write_text(brain_content)
    print("  Created CLAUDE.md + AGENTS.md + GEMINI.md")

    # Commit
    try:
        run('git add -A && git commit -m "Initial brain — antidrift"', cwd=target_dir, capture_output=True, check=True)
        print("  Created initial commit")
    except subprocess.CalledProcessError:
        pass

    # Launch
    print()
    launch = ask("  Launch Claude Code? (y/n) ")
    if launch.strip().lower().startswith("y"):
        print("\n  Type /ingest to build your brain, or just start talking.\n")
        try:
            run("claude", cwd=target_dir)
        except Exception:
            print(f"\n  cd {target_dir} && claude")
    else:
        print(f"""
  Ready. Next steps:

    cd {target_dir}
    claude

  Type /ingest to build your brain, or just start talking.

  Tip: Install the CLI for easier access:
    npm install -g @antidrift/cli

  Then use:
    antidrift skills list
    antidrift update
""")


def join_brain():
    print(BANNER)

    repo = sys.argv[2] if len(sys.argv) > 2 else ask("  Brain repo (org/name or URL): ")
    repo = repo.strip()

    if not repo:
        print("  No repo provided.")
        return

    repo_name = Path(repo.replace(".git", "")).name
    target_dir = Path.cwd() / repo_name

    if target_dir.exists():
        print(f"  {repo_name}/ exists. Pulling latest...\n")
        try:
            run("git pull --ff-only origin main", cwd=target_dir, check=True)
        except subprocess.CalledProcessError:
            print("  Pull failed — may need to resolve conflicts.")
    else:
        print(f"  Cloning {repo}...\n")
        url = repo if ("://" in repo or "@" in repo) else f"https://github.com/{repo}.git"
        try:
            run(f"git clone {url}", cwd=Path.cwd(), check=True)
        except subprocess.CalledProcessError:
            print("\n  Clone failed. Check the URL and your access.")
            return

    skills_dir = target_dir / ".claude" / "skills"
    if not skills_dir.exists():
        print("\n  No skills found. Installing core skills...")
        install_core_skills(skills_dir)
    else:
        skills = [d.name for d in skills_dir.iterdir() if d.is_dir()]
        print(f"\n  Found {len(skills)} skills: {', '.join(skills)}")

    print()
    launch = ask("  Open Claude Code? (y/n) ")
    if launch.strip().lower().startswith("y"):
        print('\n  Say "I\'m new here" to get started.\n')
        try:
            run("claude", cwd=target_dir)
        except Exception:
            print(f"\n  cd {repo_name} && claude")
    else:
        print(f"""
  Ready:

    cd {repo_name}
    claude

  Say "I'm new here" to get walked through everything.
""")


def update():
    print(BANNER)
    print("  Updating brain...\n")

    cwd = Path.cwd()
    skills_target = cwd / ".claude" / "skills"

    if not skills_target.exists():
        print(f"  No .claude/skills/ found in {cwd}")
        print("  Run `antidrift init` first.\n")
        return

    # Step 1: Core skills
    print("  Step 1: Core skills")
    install_core_skills(skills_target)

    # Step 2: Sync brain files
    print("  Step 2: Sync brain files")
    sync_brain_files(cwd)

    print("\n  ✓ Brain updated.")
    print("  Browse community skills: antidrift skills list\n")


def main():
    command = sys.argv[1] if len(sys.argv) > 1 else "help"

    if command in ("help", "--help", "-h"):
        show_help()
        return

    if command in ("version", "--version", "-v"):
        from antidrift import __version__
        print(f"antidrift {__version__}")
        return

    missing = check_prereqs()
    if missing:
        print(BANNER)
        print("  Missing prerequisites:\n")
        for m in missing:
            print(f"    ✗ {m['name']}")
            print(f"      {m['install']}\n")
        sys.exit(1)

    if command == "init":
        init()
    elif command == "join":
        join_brain()
    elif command == "update":
        update()
    else:
        print(f"  Unknown command: {command}\n")
        show_help()


if __name__ == "__main__":
    main()
