#!/usr/bin/env python3
"""antidrift — Company brain for Claude."""

import os
import shutil
import subprocess
import sys
from pathlib import Path

SKILLS_DIR = Path(__file__).parent / "skills"

BANNER = """
  ┌─────────────────────────────┐
  │  antidrift                  │
  │  Company brain for Claude   │
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

    if shutil.which("claude") is None:
        if p == "darwin":
            install = "Run: brew install claude-code\n             Or: npm install -g @anthropic-ai/claude-code"
        else:
            install = "Run: npm install -g @anthropic-ai/claude-code"
        missing.append({"name": "Claude Code", "install": install})

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
    print(f"  Installed {len(skills)} core skills: {', '.join(sorted(skills))}")


def show_help():
    print("""
antidrift — Company brain for Claude

Usage:
  antidrift init              Start a new brain
  antidrift join <repo>       Join an existing brain
  antidrift update            Update core skills to latest
  antidrift help              Show this message

Community skills:
  antidrift-skills list       Browse community skills
  antidrift-skills add <name> Add a community skill to your brain

Connect services (type /connect inside Claude, or install directly):
  npx @antidrift/mcp-google   Google Sheets, Docs, Drive, Gmail, Calendar
  npx @antidrift/mcp-stripe   Stripe invoices, customers
  npx @antidrift/mcp-attio    Attio CRM
""")


def init():
    print(BANNER)

    company = ask("  Company name: ")
    dir_name = "".join(c if c.isalnum() else "-" for c in company.strip().lower()).strip("-") or "company-brain"
    # Collapse multiple hyphens
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
        gitignore.write_text("scratch/\n.code/\n.env\n.env.*\n*.local\n.DS_Store\n")
        print("  Created .gitignore")

    # Core skills
    install_core_skills(target_dir / ".claude" / "skills")

    # CLAUDE.md
    claude_md = f"""# {company.strip()} — Company Brain

## Getting Started
- `/ingest <path>` — Import files and directories into the brain
- `/push` — Save changes (commits locally, pushes if remote exists)
- `/refresh` — Pull latest changes from remote
- `/remote` — Set up GitHub so the team can share the brain
- `/publish <skill>` — Share a skill you built with the community
- Say **"I'm new here"** to get walked through everything

## How It Works
Each directory has a `CLAUDE.md` that Claude reads automatically. Add departments by creating directories with CLAUDE.md files. The brain grows as you use it.

## Departments

| Directory | What's In It |
|---|---|
| _Run /ingest to populate_ | |
"""
    (target_dir / "CLAUDE.md").write_text(claude_md)
    print("  Created CLAUDE.md")

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
""")


def join_brain():
    print(BANNER)

    repo = sys.argv[3] if len(sys.argv) > 3 else ask("  Brain repo (org/name or URL): ")
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

    skills_target = Path.cwd() / ".claude" / "skills"
    if not skills_target.exists():
        print("  No .claude/skills/ found. Run `antidrift init` first.")
        return

    install_core_skills(skills_target)
    print("\n  Core skills updated. Browse extras with: antidrift-skills list")


def main():
    command = sys.argv[1] if len(sys.argv) > 1 else "help"

    if command == "help":
        show_help()
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
