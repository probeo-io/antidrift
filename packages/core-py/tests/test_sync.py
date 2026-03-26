"""Tests for brain file sync — sync_brain_files()."""

from pathlib import Path

from antidrift.cli import sync_brain_files


class TestSingleSourceCreation:
    """When only one brain file exists, the other two should be created."""

    def test_claude_only_creates_agents_and_gemini(self, brain_dir: Path):
        (brain_dir / "CLAUDE.md").write_text("brain content")
        sync_brain_files(brain_dir)

        assert (brain_dir / "AGENTS.md").read_text() == "brain content"
        assert (brain_dir / "GEMINI.md").read_text() == "brain content"

    def test_agents_only_creates_claude_and_gemini(self, brain_dir: Path):
        (brain_dir / "AGENTS.md").write_text("agents content")
        sync_brain_files(brain_dir)

        assert (brain_dir / "CLAUDE.md").read_text() == "agents content"
        assert (brain_dir / "GEMINI.md").read_text() == "agents content"

    def test_gemini_only_creates_claude_and_agents(self, brain_dir: Path):
        (brain_dir / "GEMINI.md").write_text("gemini content")
        sync_brain_files(brain_dir)

        assert (brain_dir / "CLAUDE.md").read_text() == "gemini content"
        assert (brain_dir / "AGENTS.md").read_text() == "gemini content"


class TestPriority:
    """CLAUDE.md > AGENTS.md > GEMINI.md when multiple exist."""

    def test_claude_wins_over_agents_and_gemini(self, brain_dir: Path):
        (brain_dir / "CLAUDE.md").write_text("claude wins")
        (brain_dir / "AGENTS.md").write_text("agents loses")
        (brain_dir / "GEMINI.md").write_text("gemini loses")
        sync_brain_files(brain_dir)

        assert (brain_dir / "AGENTS.md").read_text() == "claude wins"
        assert (brain_dir / "GEMINI.md").read_text() == "claude wins"

    def test_agents_wins_over_gemini_when_no_claude(self, brain_dir: Path):
        (brain_dir / "AGENTS.md").write_text("agents wins")
        (brain_dir / "GEMINI.md").write_text("gemini loses")
        sync_brain_files(brain_dir)

        assert (brain_dir / "CLAUDE.md").read_text() == "agents wins"
        assert (brain_dir / "GEMINI.md").read_text() == "agents wins"


class TestAllMatchNoOp:
    """When all files already match, synced count should be 0."""

    def test_all_match_no_sync(self, brain_dir: Path, capsys):
        content = "identical content"
        (brain_dir / "CLAUDE.md").write_text(content)
        (brain_dir / "AGENTS.md").write_text(content)
        (brain_dir / "GEMINI.md").write_text(content)

        sync_brain_files(brain_dir)

        captured = capsys.readouterr()
        assert "All brain files in sync" in captured.out


class TestDivergedOverwrite:
    """When all three exist but CLAUDE.md differs, others get overwritten."""

    def test_claude_differs_overwrites_others(self, brain_dir: Path):
        (brain_dir / "CLAUDE.md").write_text("updated")
        (brain_dir / "AGENTS.md").write_text("stale")
        (brain_dir / "GEMINI.md").write_text("stale")
        sync_brain_files(brain_dir)

        assert (brain_dir / "AGENTS.md").read_text() == "updated"
        assert (brain_dir / "GEMINI.md").read_text() == "updated"


class TestNestedDirectorySync:
    """Sync should recurse into subdirectories."""

    def test_syncs_in_subdirectory(self, nested_brain_dir: Path):
        sub = nested_brain_dir / "dept" / "team"
        (sub / "CLAUDE.md").write_text("nested brain")
        sync_brain_files(nested_brain_dir)

        assert (sub / "AGENTS.md").read_text() == "nested brain"
        assert (sub / "GEMINI.md").read_text() == "nested brain"

    def test_syncs_root_and_subdirectory_independently(self, nested_brain_dir: Path):
        (nested_brain_dir / "CLAUDE.md").write_text("root brain")
        sub = nested_brain_dir / "dept" / "team"
        (sub / "AGENTS.md").write_text("team brain")
        sync_brain_files(nested_brain_dir)

        # Root: CLAUDE.md is source
        assert (nested_brain_dir / "AGENTS.md").read_text() == "root brain"
        # Sub: AGENTS.md is source (no CLAUDE.md there)
        assert (sub / "CLAUDE.md").read_text() == "team brain"


class TestSkipsExcludedDirs:
    """Sync should skip node_modules, .git, .venv."""

    def test_skips_node_modules(self, brain_dir: Path):
        nm = brain_dir / "node_modules" / "pkg"
        nm.mkdir(parents=True)
        (nm / "CLAUDE.md").write_text("should be ignored")
        sync_brain_files(brain_dir)

        assert not (nm / "AGENTS.md").exists()

    def test_skips_dot_git(self, brain_dir: Path):
        git_dir = brain_dir / ".git" / "hooks"
        git_dir.mkdir(parents=True)
        (git_dir / "CLAUDE.md").write_text("should be ignored")
        sync_brain_files(brain_dir)

        assert not (git_dir / "AGENTS.md").exists()

    def test_skips_dot_venv(self, brain_dir: Path):
        venv = brain_dir / ".venv" / "lib"
        venv.mkdir(parents=True)
        (venv / "AGENTS.md").write_text("should be ignored")
        sync_brain_files(brain_dir)

        assert not (venv / "CLAUDE.md").exists()


class TestEmptyDirectory:
    """Empty directory should not cause a crash."""

    def test_empty_dir_no_crash(self, brain_dir: Path):
        sync_brain_files(brain_dir)
        # No files created, no crash
        assert not (brain_dir / "CLAUDE.md").exists()
        assert not (brain_dir / "AGENTS.md").exists()
        assert not (brain_dir / "GEMINI.md").exists()
