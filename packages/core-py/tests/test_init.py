"""Tests for init flow — file-writing logic (no interactive prompts)."""

import shutil
from pathlib import Path
from unittest.mock import patch

from antidrift.cli import install_core_skills, SKILLS_DIR


class TestBrainFileCreation:
    """Simulated init: write the same content to all three brain files."""

    def test_all_three_brain_files_created_with_same_content(self, brain_dir: Path):
        content = "# Acme Corp — Company Brain\n\nShared context.\n"
        (brain_dir / "CLAUDE.md").write_text(content)
        (brain_dir / "AGENTS.md").write_text(content)
        (brain_dir / "GEMINI.md").write_text(content)

        assert (brain_dir / "CLAUDE.md").read_text() == content
        assert (brain_dir / "AGENTS.md").read_text() == content
        assert (brain_dir / "GEMINI.md").read_text() == content

    def test_brain_files_are_identical(self, brain_dir: Path):
        content = "# Test Brain\n"
        for name in ("CLAUDE.md", "AGENTS.md", "GEMINI.md"):
            (brain_dir / name).write_text(content)

        texts = [(brain_dir / n).read_text() for n in ("CLAUDE.md", "AGENTS.md", "GEMINI.md")]
        assert texts[0] == texts[1] == texts[2]


class TestGitignore:
    """The generated .gitignore should include .claude/local.json."""

    def test_gitignore_contains_local_json(self, brain_dir: Path):
        gitignore = brain_dir / ".gitignore"
        gitignore.write_text(
            "scratch/\n.code/\n.env\n.env.*\n*.local\n.DS_Store\n.claude/local.json\n"
        )

        content = gitignore.read_text()
        assert ".claude/local.json" in content

    def test_gitignore_contains_scratch(self, brain_dir: Path):
        gitignore = brain_dir / ".gitignore"
        gitignore.write_text(
            "scratch/\n.code/\n.env\n.env.*\n*.local\n.DS_Store\n.claude/local.json\n"
        )

        content = gitignore.read_text()
        assert "scratch/" in content


class TestCoreSkillsInstallation:
    """install_core_skills should copy bundled skills to target."""

    def test_skills_directory_created(self, brain_dir: Path):
        target = brain_dir / ".claude" / "skills"
        install_core_skills(target)

        assert target.exists()
        assert target.is_dir()

    def test_core_skills_have_skill_md(self, brain_dir: Path):
        target = brain_dir / ".claude" / "skills"
        install_core_skills(target)

        # Every skill directory from the package should have SKILL.md
        installed = [d for d in target.iterdir() if d.is_dir()]
        assert len(installed) > 0
        for skill_dir in installed:
            assert (skill_dir / "SKILL.md").exists(), f"{skill_dir.name} missing SKILL.md"

    def test_skills_match_bundled_source(self, brain_dir: Path):
        target = brain_dir / ".claude" / "skills"
        install_core_skills(target)

        # Count should match what the package ships
        source_skills = [
            d.name for d in SKILLS_DIR.iterdir()
            if d.is_dir() and (d / "SKILL.md").exists()
        ]
        installed_skills = [d.name for d in target.iterdir() if d.is_dir()]
        assert sorted(installed_skills) == sorted(source_skills)

    def test_reinstall_overwrites_existing(self, brain_dir: Path):
        target = brain_dir / ".claude" / "skills"
        install_core_skills(target)

        # Tamper with a skill
        first_skill = next(d for d in target.iterdir() if d.is_dir())
        (first_skill / "SKILL.md").write_text("tampered")

        # Re-install should overwrite
        install_core_skills(target)
        assert (first_skill / "SKILL.md").read_text() != "tampered"
