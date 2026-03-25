#!/usr/bin/env python3
"""antidrift-skills — Community skills for Claude Code brains."""

import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

REPO = "probeo-io/antidrift-skills"


def run(cmd: str, **kwargs) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, shell=True, **kwargs)


def show_help():
    print(f"""
@antidrift/skills — Community skills for Claude Code brains

Core skills ship with every brain via antidrift (pip) or @antidrift/core (npm).
This registry has community extras from github.com/{REPO}

Usage:
  antidrift-skills list                 List community skills
  antidrift-skills add <name...>        Add skills to current brain
  antidrift-skills add --all            Add all community skills
  antidrift-skills remove <name...>     Remove skills from current brain
  antidrift-skills help                 Show this message
""")


def fetch_registry() -> list[str]:
    try:
        result = run(
            f"gh api repos/{REPO}/git/trees/main --jq '.tree[] | select(.type==\"tree\") | .path'",
            capture_output=True, text=True, check=True,
        )
        return [line for line in result.stdout.strip().split("\n") if line]
    except (subprocess.CalledProcessError, FileNotFoundError):
        print("  Could not fetch registry. Make sure gh is installed and authenticated.\n")
        sys.exit(1)


def fetch_skill_meta(name: str) -> dict:
    try:
        result = run(
            f"gh api repos/{REPO}/contents/{name}/SKILL.md --jq '.content' | base64 -d",
            capture_output=True, text=True, check=True,
        )
        content = result.stdout
        import re
        match = re.search(r"^---\n(.*?)\n---", content, re.DOTALL)
        if not match:
            return {"name": name, "description": ""}
        frontmatter = match.group(1)
        desc_match = re.search(r"^description:\s*(.+)$", frontmatter, re.MULTILINE)
        description = desc_match.group(1).strip() if desc_match else ""
        return {"name": name, "description": description}
    except (subprocess.CalledProcessError, FileNotFoundError):
        return {"name": name, "description": ""}


def get_installed_skills() -> list[str]:
    skills_dir = Path.cwd() / ".claude" / "skills"
    if not skills_dir.exists():
        return []
    return [d.name for d in skills_dir.iterdir() if d.is_dir() and (d / "SKILL.md").exists()]


def clone_registry() -> Path:
    tmp = Path(tempfile.mkdtemp())
    run(
        f'git clone --depth=1 https://github.com/{REPO}.git "{tmp / "registry"}"',
        capture_output=True, check=True,
    )
    return tmp / "registry"


def list_skills():
    available = fetch_registry()
    installed = set(get_installed_skills())

    print()
    for name in available:
        meta = fetch_skill_meta(name)
        status = "✓" if name in installed else "○"
        print(f"  {status} {meta['name']:<12} {meta['description']}")

    installed_count = len([n for n in available if n in installed])
    print(f"\n  {installed_count}/{len(available)} installed\n")


def add_skills(names: list[str]):
    if not names:
        print("  Usage: antidrift-skills add <name...>")
        print("         antidrift-skills add --all\n")
        return

    available = fetch_registry()
    if "--all" in names:
        to_install = available
    else:
        to_install = []
        for n in names:
            if n not in available:
                print(f'  ✗ "{n}" not found in registry')
            else:
                to_install.append(n)

    if not to_install:
        return

    registry_dir = clone_registry()
    skills_target = Path.cwd() / ".claude" / "skills"
    skills_target.mkdir(parents=True, exist_ok=True)

    for skill in to_install:
        src = registry_dir / skill
        dst = skills_target / skill
        if src.exists():
            if dst.exists():
                shutil.rmtree(dst)
            shutil.copytree(src, dst)
            print(f"  ✓ {skill}")
        else:
            print(f"  ✗ {skill} — not found in clone")

    # Clean up
    shutil.rmtree(registry_dir.parent, ignore_errors=True)

    s = "" if len(to_install) == 1 else "s"
    print(f"\n  Added {len(to_install)} skill{s}. Restart Claude Code to pick them up.\n")


def remove_skills(names: list[str]):
    if not names:
        print("  Usage: antidrift-skills remove <name...>\n")
        return

    skills_dir = Path.cwd() / ".claude" / "skills"
    for name in names:
        skill_path = skills_dir / name
        if not skill_path.exists():
            print(f'  ✗ "{name}" not installed')
            continue
        shutil.rmtree(skill_path)
        print(f"  ✓ removed {name}")
    print()


def main():
    command = sys.argv[1] if len(sys.argv) > 1 else "help"
    args = sys.argv[2:]

    if command == "help":
        show_help()
    elif command == "list":
        list_skills()
    elif command == "add":
        add_skills(args)
    elif command == "remove":
        remove_skills(args)
    else:
        print(f"  Unknown command: {command}\n")
        show_help()


if __name__ == "__main__":
    main()
