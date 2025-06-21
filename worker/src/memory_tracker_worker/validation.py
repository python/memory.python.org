"""Validation and prerequisite checking utilities."""
import logging
import os
import shutil
import subprocess
from pathlib import Path
from typing import Optional, Tuple
import git

logger = logging.getLogger(__name__)


def check_prerequisites() -> Tuple[bool, str]:
    """Check if all prerequisites are available."""
    required_tools = ['make', 'gcc', 'git']
    missing = []
    
    for tool in required_tools:
        if not shutil.which(tool):
            missing.append(tool)
    
    if missing:
        return False, f"Missing required tools: {', '.join(missing)}"
    
    return True, ""


def validate_commit_range(repo: git.Repo, commit_range: str) -> Tuple[bool, str]:
    """Validate that the given commit range is valid."""
    try:
        # Try to get the commits from the range
        commits = list(repo.iter_commits(commit_range))
        if not commits:
            return False, f"No commits found in range: {commit_range}"
        return True, ""
    except git.GitCommandError as e:
        return False, f"Invalid commit range '{commit_range}': {e}"
    except Exception as e:
        return False, f"Error validating commit range: {e}"


def check_output_directory(output_dir: Path) -> Tuple[bool, str]:
    """Check if output directory is writable."""
    try:
        output_dir.mkdir(parents=True, exist_ok=True)
        # Try to write a test file
        test_file = output_dir / '.test_write'
        test_file.write_text('test')
        test_file.unlink()
        return True, ""
    except Exception as e:
        error_msg = f"Cannot write to output directory: {e}"
        logger.error(error_msg)
        return False, error_msg


def check_build_environment(repo_path: Path) -> Tuple[bool, str]:
    """Check if the build environment is ready."""
    configure_script = repo_path / 'configure'
    if not configure_script.exists():
        return False, f"configure script not found in {repo_path}"
    
    makefile_in = repo_path / 'Makefile.pre.in'
    if not makefile_in.exists():
        return False, f"Makefile.pre.in not found in {repo_path}"
    
    return True, ""


def get_commits_to_process(repo: git.Repo, commit_range: str) -> list:
    """Get the list of commits to process from the commit range."""
    try:
        commits = list(repo.iter_commits(commit_range))
        if not commits:
            raise ValueError(f"No commits found in range: {commit_range}")
        return commits
    except git.GitCommandError as e:
        raise ValueError(f"Invalid commit range '{commit_range}': {e}")