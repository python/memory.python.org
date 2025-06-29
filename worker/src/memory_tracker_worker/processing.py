"""Commit processing functionality."""

import logging
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Optional, List
import git

logger = logging.getLogger(__name__)


def process_commits(
    commits: List[git.Commit],
    repo_path: Path,
    output_dir: Path,
    configure_flags: str,
    make_flags: str,
    verbose: int,
    binary_id: str,
    environment_id: str,
    force: bool = False,
    auth_token: str = None,
    api_base: str = "http://localhost:8000",
) -> Optional[str]:
    """Process commits using local checkout mode."""
    try:
        repo = git.Repo(repo_path)

        # Process each commit
        for commit in commits:
            logger.info(f"Processing commit {commit.hexsha[:8]} in local checkout mode")

            # Create unique directory for this run
            run_dir = output_dir / commit.hexsha

            # Handle existing directory
            if run_dir.exists():
                if not force:
                    error_msg = f"Output directory for commit {commit.hexsha[:8]} already exists: {run_dir}. Use -f/--force to overwrite."
                    logger.error(error_msg)
                    return error_msg
                else:
                    logger.info(
                        f"Removing existing directory for commit {commit.hexsha[:8]}: {run_dir}"
                    )
                    try:
                        shutil.rmtree(run_dir)
                    except Exception as e:
                        error_msg = (
                            f"Failed to remove existing directory {run_dir}: {e}"
                        )
                        logger.error(error_msg)
                        return error_msg

            run_dir.mkdir(parents=True, exist_ok=True)
            logger.debug(f"Created run directory: {run_dir}")

            try:
                # Create parent temp directory for this commit
                parent_temp_dir = Path(tempfile.mkdtemp(prefix="cpython_build_"))
                logger.debug(f"Parent temp directory: {parent_temp_dir}")
                
                # Clone CPython repo into temp directory
                cpython_repo_dir = parent_temp_dir / "cpython"
                logger.info(f"Cloning CPython repo to temp directory for commit {commit.hexsha[:8]}")
                cloned_repo = git.Repo.clone_from(str(repo_path), str(cpython_repo_dir))
                cloned_repo.git.checkout(commit.hexsha)
                logger.debug(f"CPython cloned to: {cpython_repo_dir}")
                
                # Create install directory within parent temp dir
                install_dir = parent_temp_dir / "install"
                install_dir.mkdir(parents=True, exist_ok=True)
                logger.debug(f"Install directory: {install_dir}")

                # Configure for this commit with prefix
                logger.info(f"Running configure for commit {commit.hexsha[:8]}")
                logger.debug(f"Configure flags: {configure_flags}")

                configure_cmd = [str(cpython_repo_dir / "configure"), f"--prefix={install_dir}", *configure_flags.split()]
                logger.debug(f"Configure command: {' '.join(configure_cmd)}")

                result = subprocess.run(
                    configure_cmd, cwd=cpython_repo_dir, check=True, capture_output=verbose < 3
                )
                if verbose >= 3:
                    if result.stdout:
                        print(
                            result.stdout.decode()
                            if isinstance(result.stdout, bytes)
                            else result.stdout
                        )
                    if result.stderr:
                        print(
                            result.stderr.decode()
                            if isinstance(result.stderr, bytes)
                            else result.stderr
                        )

                # Clean before building
                logger.info(f"Running make clean for commit {commit.hexsha[:8]}")
                
                clean_cmd = ["make", "clean"]
                logger.debug(f"Clean command: {' '.join(clean_cmd)}")
                
                result = subprocess.run(
                    clean_cmd, cwd=cpython_repo_dir, check=True, capture_output=verbose < 3
                )
                if verbose >= 3:
                    if result.stdout:
                        print(
                            result.stdout.decode()
                            if isinstance(result.stdout, bytes)
                            else result.stdout
                        )
                    if result.stderr:
                        print(
                            result.stderr.decode()
                            if isinstance(result.stderr, bytes)
                            else result.stderr
                        )

                # Build Python using make (no make install)
                logger.info(f"Running make for commit {commit.hexsha[:8]}")
                logger.debug(f"Make flags: {make_flags}")

                make_cmd = ["make", *make_flags.split()]
                logger.debug(f"Make command: {' '.join(make_cmd)}")

                result = subprocess.run(
                    make_cmd, cwd=cpython_repo_dir, check=True, capture_output=verbose < 3
                )
                if verbose >= 3:
                    if result.stdout:
                        print(
                            result.stdout.decode()
                            if isinstance(result.stdout, bytes)
                            else result.stdout
                        )
                    if result.stderr:
                        print(
                            result.stderr.decode()
                            if isinstance(result.stderr, bytes)
                            else result.stderr
                        )

                # Install Python
                logger.info(f"Running make install for commit {commit.hexsha[:8]}")
                
                install_cmd = ["make", "install"]
                logger.debug(f"Install command: {' '.join(install_cmd)}")
                
                result = subprocess.run(
                    install_cmd, cwd=cpython_repo_dir, check=True, capture_output=verbose < 3
                )
                if verbose >= 3:
                    if result.stdout:
                        print(
                            result.stdout.decode()
                            if isinstance(result.stdout, bytes)
                            else result.stdout
                        )
                    if result.stderr:
                        print(
                            result.stderr.decode()
                            if isinstance(result.stderr, bytes)
                            else result.stderr
                        )

                # Create virtual environment using installed python binary
                logger.info(
                    f"Creating virtual environment for commit {commit.hexsha[:8]}"
                )
                venv_dir = parent_temp_dir / "venv"
                logger.debug(f"Creating virtual environment in {venv_dir}")

                python_binary = install_dir / "bin" / "python3"
                venv_cmd = [str(python_binary), "-m", "venv", str(venv_dir)]
                logger.debug(f"Venv command: {' '.join(venv_cmd)}")

                result = subprocess.run(
                    venv_cmd, cwd=cpython_repo_dir, check=True, capture_output=verbose < 3
                )
                if verbose >= 3:
                    if result.stdout:
                        print(
                            result.stdout.decode()
                            if isinstance(result.stdout, bytes)
                            else result.stdout
                        )
                    if result.stderr:
                        print(
                            result.stderr.decode()
                            if isinstance(result.stderr, bytes)
                            else result.stderr
                        )

                # Install memray
                logger.info(f"Installing memray for commit {commit.hexsha[:8]}")

                pip_cmd = [
                    str(venv_dir / "bin" / "pip"),
                    "install",
                    "-v",
                    "memray",
                    "--no-cache-dir",
                ]
                logger.debug(f"Pip command: {' '.join(pip_cmd)}")

                result = subprocess.run(pip_cmd, check=True, capture_output=verbose < 3)
                if verbose >= 3:
                    if result.stdout:
                        print(
                            result.stdout.decode()
                            if isinstance(result.stdout, bytes)
                            else result.stdout
                        )
                    if result.stderr:
                        print(
                            result.stderr.decode()
                            if isinstance(result.stderr, bytes)
                            else result.stderr
                        )

                # Run benchmarks
                logger.info(f"Running benchmarks for commit {commit.hexsha[:8]}")
                from .benchmarks import (
                    run_benchmarks,
                    upload_results_to_server,
                    validate_binary_and_environment,
                )

                # Validate binary and environment before running benchmarks
                try:
                    validate_binary_and_environment(
                        binary_id, environment_id, server_url=api_base
                    )
                except ValueError as e:
                    error_msg = f"Validation failed for commit {commit.hexsha}: {e}"
                    logger.error(error_msg)
                    return error_msg

                run_benchmarks(venv_dir, run_dir, commit)

                # Upload results to server
                logger.info(f"Uploading results for commit {commit.hexsha[:8]}")
                try:
                    upload_results_to_server(
                        run_dir,
                        binary_id=binary_id,
                        environment_id=environment_id,
                        auth_token=auth_token,
                        server_url=api_base,
                    )
                except Exception as e:
                    logger.warning(
                        f"Failed to upload results for commit {commit.hexsha[:8]}: {e}"
                    )
                    logger.info("Results are still saved locally")

                logger.info(
                    f"Successfully completed processing commit {commit.hexsha[:8]}"
                )

                # Clean up parent temp directory
                try:
                    shutil.rmtree(parent_temp_dir, ignore_errors=True)
                    logger.debug(f"Cleaned up parent temp directory: {parent_temp_dir}")
                except Exception as e:
                    logger.warning(f"Failed to clean up parent temp directory {parent_temp_dir}: {e}")

            except subprocess.CalledProcessError as e:
                error_msg = f"Error processing commit {commit.hexsha}: {e}"
                if e.stdout:
                    logger.error(
                        f"Command stdout:\n{e.stdout.decode() if isinstance(e.stdout, bytes) else e.stdout}"
                    )
                if e.stderr:
                    logger.error(
                        f"Command stderr:\n{e.stderr.decode() if isinstance(e.stderr, bytes) else e.stderr}"
                    )
                return error_msg

    except Exception as e:
        error_msg = f"Unexpected error in local checkout mode: {e}"
        logger.exception(error_msg)
        return error_msg

    return None
