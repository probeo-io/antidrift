"""Shared fixtures for antidrift tests."""

import pytest
from pathlib import Path


@pytest.fixture
def brain_dir(tmp_path: Path) -> Path:
    """Return a clean temporary directory for brain file operations."""
    return tmp_path


@pytest.fixture
def nested_brain_dir(tmp_path: Path) -> Path:
    """Return a temporary directory with a nested subdirectory structure."""
    sub = tmp_path / "dept" / "team"
    sub.mkdir(parents=True)
    return tmp_path


@pytest.fixture
def skills_source_dir(tmp_path: Path) -> Path:
    """Return a temporary directory mimicking the bundled skills layout."""
    for skill_name in ("alpha", "beta"):
        skill_dir = tmp_path / skill_name
        skill_dir.mkdir()
        (skill_dir / "SKILL.md").write_text(f"# {skill_name}\nCore skill.\n")
    return tmp_path
