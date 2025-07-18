"""Command handlers for the CLI."""

import logging
import os
import sys
import tempfile
from pathlib import Path
import git

from .validation import (
    check_prerequisites,
    validate_commit_range,
    check_output_directory,
    check_build_environment,
    get_commits_to_process,
)
from .processing import process_commits

logger = logging.getLogger(__name__)


def list_binaries_command(args):
    """Handle list-binaries command."""
    from .benchmarks import list_binaries

    configure_logging(args.verbose)
    try:
        binaries = list_binaries(args.server_url)
        if binaries:
            print("Available binaries:")
            for binary in binaries:
                print(f"  {binary['id']}: {binary['name']}")
                if binary.get("description"):
                    print(f"    Description: {binary['description']}")
                print()
        else:
            print("No binaries found.")
    except Exception as e:
        logger.error(f"Failed to list binaries: {e}")
        sys.exit(1)


def list_environments_command(args):
    """Handle list-environments command."""
    from .benchmarks import list_environments

    configure_logging(args.verbose)
    try:
        environments = list_environments(args.server_url)
        if environments:
            print("Available environments:")
            for env in environments:
                print(f"  {env['id']}: {env['name']}")
                if env.get("description"):
                    print(f"    Description: {env['description']}")
                print()
        else:
            print("No environments found.")
    except Exception as e:
        logger.error(f"Failed to list environments: {e}")
        sys.exit(1)


def configure_logging(verbose: int):
    """Configure logging based on verbosity level consistently across all commands."""
    log_level = {
        0: logging.WARNING,
        1: logging.INFO,
        2: logging.DEBUG,
        3: logging.DEBUG,
    }.get(verbose, logging.DEBUG)

    # Clear any existing handlers
    root_logger = logging.getLogger()
    for handler in root_logger.handlers[:]:
        root_logger.removeHandler(handler)

    # Create formatter
    formatter = logging.Formatter(
        "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    )

    # Create console handler
    console_handler = logging.StreamHandler()
    console_handler.setLevel(log_level)
    console_handler.setFormatter(formatter)

    # Configure root logger
    root_logger.setLevel(log_level)
    root_logger.addHandler(console_handler)

    # Suppress verbose logging from git module unless debug level
    if verbose < 2:
        logging.getLogger("git").setLevel(logging.WARNING)


def benchmark_command(args):
    """Handle benchmark command."""
    configure_logging(args.verbose)

    # Check prerequisites
    logger.info("Checking prerequisites...")
    ok, msg = check_prerequisites()
    if not ok:
        logger.error(f"Prerequisites check failed: {msg}")
        sys.exit(1)

    # Get or clone CPython repository
    if args.repo_path is None:
        repo_path = Path(tempfile.mkdtemp(prefix="cpython_"))
        logger.info(f"Cloning CPython repository to {repo_path}")
        try:
            repo = git.Repo.clone_from(
                "https://github.com/python/cpython.git", repo_path
            )
        except git.GitCommandError as e:
            logger.error(f"Failed to clone CPython repository: {e}")
            sys.exit(1)
    else:
        repo_path = args.repo_path.resolve()
        try:
            repo = git.Repo(repo_path)
        except git.InvalidGitRepositoryError:
            logger.error(f"Invalid Git repository: {repo_path}")
            sys.exit(1)

    # Validate commit range
    logger.info("Validating commit expression...")
    ok, msg = validate_commit_range(repo, args.commit_range)
    if not ok:
        logger.error(f"Commit expression validation failed: {msg}")
        sys.exit(1)

    # Check output directory
    logger.info("Checking output directory...")
    ok, msg = check_output_directory(args.output_dir.resolve())
    if not ok:
        logger.error(f"Output directory check failed: {msg}")
        sys.exit(1)

    # Check build environment
    logger.info("Checking build environment...")
    ok, msg = check_build_environment(repo_path)
    if not ok:
        logger.error(f"Build environment check failed: {msg}")
        sys.exit(1)

    # Validate binary and environment before processing any commits
    logger.info("Validating binary and environment registration...")
    try:
        from .benchmarks import validate_binary_and_environment

        validate_binary_and_environment(
            args.binary_id, args.environment_id, args.api_base
        )
    except ValueError as e:
        logger.error(f"Pre-flight validation failed: {e}")
        sys.exit(1)

    # Use the provided commit range directly
    commit_range = args.commit_range

    # Get commits to process
    try:
        commits = get_commits_to_process(repo, commit_range)
    except ValueError as e:
        logger.error(f"Failed to get commits: {e}")
        sys.exit(1)

    # Get authentication token from CLI or environment variable
    auth_token = args.auth_token or os.getenv("MEMORY_TRACKER_TOKEN")
    if not auth_token:
        logger.error(
            "Authentication token required. Provide via --auth-token or set MEMORY_TRACKER_TOKEN environment variable."
        )
        sys.exit(1)
    logger.info("Authentication token provided")

    logger.info("Configuration:")
    logger.info(f"Repository: {repo_path}")
    logger.info(f"Commit expression: {args.commit_range}")
    logger.info(f"Output directory: {args.output_dir}")
    logger.info(f"Configure flags: {args.configure_flags}")
    logger.info(f"Make flags: {args.make_flags}")
    logger.info(f"Number of commits to process: {len(commits)}")
    if len(commits) > 0:
        logger.info("Commits to process:")
        for commit in commits:
            logger.info(f"  {commit.hexsha[:8]} - {commit.message.splitlines()[0]}")

    # Process commits using incremental mode (previously local checkout)
    logger.info("Processing commits using incremental mode")
    errors = []
    error = process_commits(
        commits,
        repo_path,
        args.output_dir,
        args.configure_flags,
        args.make_flags,
        args.verbose,
        args.binary_id,
        args.environment_id,
        args.force,
        auth_token,
        args.api_base,
    )
    if error:
        errors.append((None, error))

    # Print final status
    if errors:
        logger.error("Build Summary (with errors):")
        for commit, error in errors:
            if commit:
                logger.error(f"Failed {commit.hexsha[:8]} - {error}")
            else:
                logger.error(f"Failed - {error}")
    else:
        logger.info("Build Summary (all successful):")
        for commit in commits:
            logger.info(f"Success {commit.hexsha[:8]}")
