"""Tests for CLI routing and helper functions."""

import sys
from unittest.mock import patch

import pytest

from antidrift.cli import check_prereqs, check_npx, show_help, main


class TestCheckPrereqs:
    """check_prereqs should return missing tools when not found."""

    def test_returns_empty_when_all_found(self):
        def fake_which(name):
            return f"/usr/bin/{name}"

        with patch("antidrift.cli.shutil.which", side_effect=fake_which):
            result = check_prereqs()
        assert result == []

    def test_returns_missing_when_no_claude_or_codex(self):
        def fake_which(name):
            if name in ("claude", "codex"):
                return None
            return f"/usr/bin/{name}"

        with patch("antidrift.cli.shutil.which", side_effect=fake_which):
            result = check_prereqs()
        names = [m["name"] for m in result]
        assert "Claude Code or Codex" in names

    def test_returns_empty_when_only_claude_found(self):
        def fake_which(name):
            if name == "codex":
                return None
            return f"/usr/bin/{name}"

        with patch("antidrift.cli.shutil.which", side_effect=fake_which):
            result = check_prereqs()
        assert result == []

    def test_returns_empty_when_only_codex_found(self):
        def fake_which(name):
            if name == "claude":
                return None
            return f"/usr/bin/{name}"

        with patch("antidrift.cli.shutil.which", side_effect=fake_which):
            result = check_prereqs()
        assert result == []

    def test_returns_git_missing(self):
        def fake_which(name):
            if name == "git":
                return None
            return f"/usr/bin/{name}"

        with patch("antidrift.cli.shutil.which", side_effect=fake_which):
            result = check_prereqs()
        names = [m["name"] for m in result]
        assert "git" in names

    def test_returns_both_missing(self):
        with patch("antidrift.cli.shutil.which", return_value=None):
            result = check_prereqs()
        names = [m["name"] for m in result]
        assert "git" in names
        assert "Claude Code or Codex" in names


class TestCheckNpx:
    """check_npx should return True/False based on shutil.which."""

    def test_returns_true_when_npx_available(self):
        with patch("antidrift.cli.shutil.which", return_value="/usr/bin/npx"):
            assert check_npx() is True

    def test_returns_false_when_npx_missing(self):
        with patch("antidrift.cli.shutil.which", return_value=None):
            assert check_npx() is False


class TestShowHelp:
    """show_help should print without crashing."""

    def test_show_help_does_not_crash(self, capsys):
        show_help()
        captured = capsys.readouterr()
        assert "antidrift" in captured.out
        assert "init" in captured.out
        assert "update" in captured.out


class TestVersionCommand:
    """The version command should print the version string."""

    def test_version_prints_version(self, capsys):
        with patch.object(sys, "argv", ["antidrift", "version"]):
            with patch("antidrift.cli.check_prereqs", return_value=[]):
                with patch("antidrift.__version__", "0.6.3", create=True):
                    main()
        captured = capsys.readouterr()
        assert "0.6.3" in captured.out


class TestUnknownCommand:
    """An unknown command should show help text."""

    def test_unknown_command_shows_help(self, capsys):
        with patch.object(sys, "argv", ["antidrift", "boguscmd"]):
            with patch("antidrift.cli.check_prereqs", return_value=[]):
                main()
        captured = capsys.readouterr()
        assert "Unknown command: boguscmd" in captured.out
        assert "antidrift" in captured.out


class TestConnect:
    """Connect command should route to npx with correct args."""

    def test_connect_no_service_shows_list(self, capsys):
        with patch.object(sys, "argv", ["antidrift", "connect"]):
            with patch("antidrift.cli.check_prereqs", return_value=[]):
                main()
        captured = capsys.readouterr()
        assert "google" in captured.out
        assert "attio" in captured.out

    def test_connect_unknown_service_shows_list(self, capsys):
        with patch.object(sys, "argv", ["antidrift", "connect", "unknown"]):
            with patch("antidrift.cli.check_prereqs", return_value=[]):
                main()
        captured = capsys.readouterr()
        assert "Available services" in captured.out

    def test_connect_google_delegates_to_npx(self):
        with patch.object(sys, "argv", ["antidrift", "connect", "google"]):
            with patch("antidrift.cli.check_prereqs", return_value=[]):
                with patch("antidrift.cli.npx_delegate") as mock_npx:
                    main()
        mock_npx.assert_called_once_with("mcp-google", [])

    def test_connect_attio_delegates_to_npx(self):
        with patch.object(sys, "argv", ["antidrift", "connect", "attio"]):
            with patch("antidrift.cli.check_prereqs", return_value=[]):
                with patch("antidrift.cli.npx_delegate") as mock_npx:
                    main()
        mock_npx.assert_called_once_with("mcp-attio", [])

    def test_connect_passes_flags_through(self):
        with patch.object(sys, "argv", ["antidrift", "connect", "google", "--cowork"]):
            with patch("antidrift.cli.check_prereqs", return_value=[]):
                with patch("antidrift.cli.npx_delegate") as mock_npx:
                    main()
        mock_npx.assert_called_once_with("mcp-google", ["--cowork"])

    def test_connect_passes_all_flag(self):
        with patch.object(sys, "argv", ["antidrift", "connect", "attio", "--all"]):
            with patch("antidrift.cli.check_prereqs", return_value=[]):
                with patch("antidrift.cli.npx_delegate") as mock_npx:
                    main()
        mock_npx.assert_called_once_with("mcp-attio", ["--all"])

    def test_connect_passes_claude_code_flag(self):
        with patch.object(sys, "argv", ["antidrift", "connect", "google", "--claude-code"]):
            with patch("antidrift.cli.check_prereqs", return_value=[]):
                with patch("antidrift.cli.npx_delegate") as mock_npx:
                    main()
        mock_npx.assert_called_once_with("mcp-google", ["--claude-code"])

    def test_help_text_includes_connect_flags(self, capsys):
        show_help()
        captured = capsys.readouterr()
        assert "--cowork" in captured.out
        assert "connect google" in captured.out


class TestSkillsDelegate:
    """Skills command should delegate to npx."""

    def test_skills_delegates_to_npx(self):
        with patch.object(sys, "argv", ["antidrift", "skills", "list"]):
            with patch("antidrift.cli.check_prereqs", return_value=[]):
                with patch("antidrift.cli.npx_delegate") as mock_npx:
                    main()
        mock_npx.assert_called_once()

    def test_skills_no_args_defaults_to_list(self):
        with patch.object(sys, "argv", ["antidrift", "skills"]):
            with patch("antidrift.cli.check_prereqs", return_value=[]):
                with patch("antidrift.cli.skills_delegate") as mock_skills:
                    main()
        mock_skills.assert_called_once()


class TestCrossCompile:
    """Cross-compile should delegate to npx core."""

    def test_cross_compile_delegates_to_npx(self):
        with patch.object(sys, "argv", ["antidrift", "cross-compile", "./skill", "--to", "codex"]):
            with patch("antidrift.cli.check_prereqs", return_value=[]):
                with patch("antidrift.cli.npx_delegate") as mock_npx:
                    main()
        mock_npx.assert_called_once_with("core", ["cross-compile", "./skill", "--to", "codex"])
