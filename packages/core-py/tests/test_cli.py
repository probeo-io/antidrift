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
