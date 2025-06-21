"""Commit processing functionality."""
import logging
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Optional, List, Tuple
from concurrent.futures import ThreadPoolExecutor, as_completed
import git

logger = logging.getLogger(__name__)


def process_commits_local_checkout(
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
        
        # Clean the repository first
        logger.info("Cleaning repository with git clean -fxd")
        repo.git.clean('-fxd')
        
        # Configure once at the beginning
        logger.info("Running configure once for local checkout mode")
        logger.debug(f"Configure flags: {configure_flags}")
        
        configure_cmd = [
            str(repo_path / 'configure'),
            *configure_flags.split()
        ]
        logger.debug(f"Configure command: {' '.join(configure_cmd)}")
        
        result = subprocess.run(
            configure_cmd,
            cwd=repo_path,
            check=True,
            capture_output=verbose < 3
        )
        if verbose >= 3:
            if result.stdout:
                print(result.stdout.decode() if isinstance(result.stdout, bytes) else result.stdout)
            if result.stderr:
                print(result.stderr.decode() if isinstance(result.stderr, bytes) else result.stderr)
        
        # Process each commit
        for commit in commits:
            logger.info(f"Processing commit {commit.hexsha[:8]} in local checkout mode")
            
            # Checkout the commit
            logger.info(f"Checking out commit {commit.hexsha[:8]}")
            repo.git.checkout(commit.hexsha)
            
            # Create unique directory for this run
            run_dir = output_dir / commit.hexsha
            
            # Handle existing directory
            if run_dir.exists():
                if not force:
                    error_msg = f"Output directory for commit {commit.hexsha[:8]} already exists: {run_dir}. Use -f/--force to overwrite."
                    logger.error(error_msg)
                    return error_msg
                else:
                    logger.info(f"Removing existing directory for commit {commit.hexsha[:8]}: {run_dir}")
                    try:
                        shutil.rmtree(run_dir)
                    except Exception as e:
                        error_msg = f"Failed to remove existing directory {run_dir}: {e}"
                        logger.error(error_msg)
                        return error_msg
            
            run_dir.mkdir(parents=True, exist_ok=True)
            logger.debug(f"Created run directory: {run_dir}")
            
            try:
                # Build Python using make (no make install)
                logger.info(f"Running make for commit {commit.hexsha[:8]}")
                logger.debug(f"Make flags: {make_flags}")
                
                make_cmd = ['make', *make_flags.split()]
                logger.debug(f"Make command: {' '.join(make_cmd)}")
                
                result = subprocess.run(
                    make_cmd,
                    cwd=repo_path,
                    check=True,
                    capture_output=verbose < 3
                )
                if verbose >= 3:
                    if result.stdout:
                        print(result.stdout.decode() if isinstance(result.stdout, bytes) else result.stdout)
                    if result.stderr:
                        print(result.stderr.decode() if isinstance(result.stderr, bytes) else result.stderr)
                
                # Create virtual environment using local python binary
                logger.info(f"Creating virtual environment for commit {commit.hexsha[:8]}")
                venv_dir = Path(tempfile.mkdtemp(prefix='cpython_venv_'))
                logger.debug(f"Creating virtual environment in {venv_dir}")
                
                python_binary = repo_path / 'python'
                venv_cmd = [str(python_binary), '-m', 'venv', str(venv_dir)]
                logger.debug(f"Venv command: {' '.join(venv_cmd)}")
                
                result = subprocess.run(
                    venv_cmd,
                    check=True,
                    capture_output=verbose < 3
                )
                if verbose >= 3:
                    if result.stdout:
                        print(result.stdout.decode() if isinstance(result.stdout, bytes) else result.stdout)
                    if result.stderr:
                        print(result.stderr.decode() if isinstance(result.stderr, bytes) else result.stderr)
                
                # Install memray
                logger.info(f"Installing memray for commit {commit.hexsha[:8]}")
                
                pip_cmd = [str(venv_dir / 'bin' / 'pip'), 'install', '-v', 'memray', '--no-cache-dir']
                logger.debug(f"Pip command: {' '.join(pip_cmd)}")
                
                result = subprocess.run(
                    pip_cmd,
                    check=True,
                    capture_output=verbose < 3
                )
                if verbose >= 3:
                    if result.stdout:
                        print(result.stdout.decode() if isinstance(result.stdout, bytes) else result.stdout)
                    if result.stderr:
                        print(result.stderr.decode() if isinstance(result.stderr, bytes) else result.stderr)
                
                # Run benchmarks
                logger.info(f"Running benchmarks for commit {commit.hexsha[:8]}")
                from .benchmarks import run_benchmarks, upload_results_to_server, validate_binary_and_environment
                
                # Validate binary and environment before running benchmarks
                try:
                    validate_binary_and_environment(binary_id, environment_id)
                except ValueError as e:
                    error_msg = f"Validation failed for commit {commit.hexsha}: {e}"
                    logger.error(error_msg)
                    return error_msg
                
                run_benchmarks(venv_dir, run_dir, commit)
                
                # Upload results to server
                logger.info(f"Uploading results for commit {commit.hexsha[:8]}")
                try:
                    upload_results_to_server(run_dir, binary_id=binary_id, environment_id=environment_id, auth_token=auth_token, server_url=api_base)
                except Exception as e:
                    logger.warning(f"Failed to upload results for commit {commit.hexsha[:8]}: {e}")
                    logger.info("Results are still saved locally")
                
                logger.info(f"Successfully completed processing commit {commit.hexsha[:8]}")
                
                # Clean up venv directory
                try:
                    shutil.rmtree(venv_dir, ignore_errors=True)
                except Exception as e:
                    logger.warning(f"Failed to clean up venv directory {venv_dir}: {e}")
                    
            except subprocess.CalledProcessError as e:
                error_msg = f"Error processing commit {commit.hexsha}: {e}"
                if e.stdout:
                    logger.error(f"Command stdout:\n{e.stdout.decode() if isinstance(e.stdout, bytes) else e.stdout}")
                if e.stderr:
                    logger.error(f"Command stderr:\n{e.stderr.decode() if isinstance(e.stderr, bytes) else e.stderr}")
                return error_msg
                
    except Exception as e:
        error_msg = f"Unexpected error in local checkout mode: {e}"
        logger.exception(error_msg)
        return error_msg
    
    return None


def process_commit(
    commit: git.Commit,
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
    """Process a single commit."""
    build_dir = None
    try:
        logger.info(f"Processing commit {commit.hexsha[:8]}")
        logger.debug(f"Commit message: {commit.message.splitlines()[0] if commit.message else ''}")
        
        # Check if this is a temporary repo copy (no .git directory)
        # If so, skip checkout since the repo is already at the right commit
        git_dir = repo_path / '.git'
        if git_dir.exists():
            # This is a full git repo, checkout the commit
            logger.info(f"Checking out commit {commit.hexsha[:8]}")
            repo = git.Repo(repo_path)
            repo.git.checkout(commit.hexsha)
        else:
            # This is a temporary copy already at the right commit
            logger.debug(f"Using temporary repo copy already at commit {commit.hexsha[:8]}")
        
        # Create unique directory for this run
        run_dir = output_dir / commit.hexsha
        
        # Handle existing directory
        if run_dir.exists():
            if not force:
                error_msg = f"Output directory for commit {commit.hexsha[:8]} already exists: {run_dir}. Use -f/--force to overwrite."
                logger.error(error_msg)
                return error_msg
            else:
                logger.info(f"Removing existing directory for commit {commit.hexsha[:8]}: {run_dir}")
                try:
                    shutil.rmtree(run_dir)
                except Exception as e:
                    error_msg = f"Failed to remove existing directory {run_dir}: {e}"
                    logger.error(error_msg)
                    return error_msg
        
        run_dir.mkdir(parents=True, exist_ok=True)
        logger.debug(f"Created run directory: {run_dir}")
        
        # Create temporary build directory
        build_dir = Path(tempfile.mkdtemp(prefix='cpython_build_'))
        logger.debug(f"Created build directory: {build_dir}")
        
        try:
            # Configure and build in the temporary directory
            logger.info(f"Running configure for commit {commit.hexsha[:8]}")
            logger.debug(f"Configure flags: {configure_flags}")
            
            configure_cmd = [
                str(repo_path / 'configure'),
                *configure_flags.split(),
                f'--prefix={build_dir}'
            ]
            logger.debug(f"Configure command: {' '.join(configure_cmd)}")
            
            result = subprocess.run(
                configure_cmd,
                cwd=build_dir,
                check=True,
                capture_output=verbose < 3
            )
            if verbose >= 3:
                if result.stdout:
                    print(result.stdout.decode() if isinstance(result.stdout, bytes) else result.stdout)
                if result.stderr:
                    print(result.stderr.decode() if isinstance(result.stderr, bytes) else result.stderr)
            else:
                if result.stdout:
                    logger.debug(f"Configure stdout:\n{result.stdout.decode() if isinstance(result.stdout, bytes) else result.stdout}")
                if result.stderr:
                    logger.debug(f"Configure stderr:\n{result.stderr.decode() if isinstance(result.stderr, bytes) else result.stderr}")
        
        except subprocess.CalledProcessError as e:
            error_msg = f"Error configuring commit {commit.hexsha}: {e}"
            if e.stdout:
                logger.error(f"Configure stdout:\n{e.stdout.decode() if isinstance(e.stdout, bytes) else e.stdout}")
            if e.stderr:
                logger.error(f"Configure stderr:\n{e.stderr.decode() if isinstance(e.stderr, bytes) else e.stderr}")
            return error_msg
        
        try:
            # Build Python
            logger.info(f"Running make for commit {commit.hexsha[:8]}")
            logger.debug(f"Make flags: {make_flags}")
            
            make_cmd = ['make', *make_flags.split()]
            logger.debug(f"Make command: {' '.join(make_cmd)}")
            
            result = subprocess.run(
                make_cmd,
                cwd=build_dir,
                check=True,
                capture_output=verbose < 3
            )
            if verbose >= 3:
                if result.stdout:
                    print(result.stdout.decode() if isinstance(result.stdout, bytes) else result.stdout)
                if result.stderr:
                    print(result.stderr.decode() if isinstance(result.stderr, bytes) else result.stderr)
            else:
                if result.stdout:
                    logger.debug(f"Make stdout:\n{result.stdout.decode() if isinstance(result.stdout, bytes) else result.stdout}")
                if result.stderr:
                    logger.debug(f"Make stderr:\n{result.stderr.decode() if isinstance(result.stderr, bytes) else result.stderr}")
            
            # Install Python
            logger.info(f"Running make install for commit {commit.hexsha[:8]}")
            
            result = subprocess.run(
                ['make', 'install'],
                cwd=build_dir,
                check=True,
                capture_output=verbose < 3
            )
            if verbose >= 3:
                if result.stdout:
                    print(result.stdout.decode() if isinstance(result.stdout, bytes) else result.stdout)
                if result.stderr:
                    print(result.stderr.decode() if isinstance(result.stderr, bytes) else result.stderr)
            else:
                if result.stdout:
                    logger.debug(f"Make install stdout:\n{result.stdout.decode() if isinstance(result.stdout, bytes) else result.stdout}")
                if result.stderr:
                    logger.debug(f"Make install stderr:\n{result.stderr.decode() if isinstance(result.stderr, bytes) else result.stderr}")
            
            # Create virtual environment
            logger.info(f"Creating virtual environment for commit {commit.hexsha[:8]}")
            venv_dir = Path(tempfile.mkdtemp(prefix='cpython_venv_'))
            logger.debug(f"Creating virtual environment in {venv_dir}")
            
            venv_cmd = [str(build_dir / 'bin' / 'python3'), '-m', 'venv', str(venv_dir)]
            logger.debug(f"Venv command: {' '.join(venv_cmd)}")
            
            result = subprocess.run(
                venv_cmd,
                check=True,
                capture_output=verbose < 3
            )
            if verbose >= 3:
                if result.stdout:
                    print(result.stdout.decode() if isinstance(result.stdout, bytes) else result.stdout)
                if result.stderr:
                    print(result.stderr.decode() if isinstance(result.stderr, bytes) else result.stderr)
            else:
                if result.stdout:
                    logger.debug(f"Venv stdout:\n{result.stdout.decode() if isinstance(result.stdout, bytes) else result.stdout}")
                if result.stderr:
                    logger.debug(f"Venv stderr:\n{result.stderr.decode() if isinstance(result.stderr, bytes) else result.stderr}")
            
            # Install memray
            logger.info(f"Installing memray for commit {commit.hexsha[:8]}")
            
            pip_cmd = [str(venv_dir / 'bin' / 'pip'), 'install', '-v', 'memray', '--no-cache-dir']
            logger.debug(f"Pip command: {' '.join(pip_cmd)}")
            
            result = subprocess.run(
                pip_cmd,
                check=True,
                capture_output=verbose < 3
            )
            if verbose >= 3:
                if result.stdout:
                    print(result.stdout.decode() if isinstance(result.stdout, bytes) else result.stdout)
                if result.stderr:
                    print(result.stderr.decode() if isinstance(result.stderr, bytes) else result.stderr)
            else:
                if result.stdout:
                    logger.debug(f"Pip stdout:\n{result.stdout.decode() if isinstance(result.stdout, bytes) else result.stdout}")
                if result.stderr:
                    logger.debug(f"Pip stderr:\n{result.stderr.decode() if isinstance(result.stderr, bytes) else result.stderr}")
            
            # Run benchmarks
            logger.info(f"Running benchmarks for commit {commit.hexsha[:8]}")
            from .benchmarks import run_benchmarks, upload_results_to_server, validate_binary_and_environment
            
            # Validate binary and environment before running benchmarks
            try:
                validate_binary_and_environment(binary_id, environment_id)
            except ValueError as e:
                error_msg = f"Validation failed for commit {commit.hexsha}: {e}"
                logger.error(error_msg)
                return error_msg
            
            run_benchmarks(venv_dir, run_dir, commit)
            
            # Upload results to server
            logger.info(f"Uploading results for commit {commit.hexsha[:8]}")
            try:
                upload_results_to_server(run_dir, binary_id=binary_id, environment_id=environment_id, auth_token=auth_token, server_url=api_base)
            except Exception as e:
                logger.warning(f"Failed to upload results for commit {commit.hexsha[:8]}: {e}")
                logger.info("Results are still saved locally")
            
            logger.info(f"Successfully completed processing commit {commit.hexsha[:8]}")
            return None
            
        except subprocess.CalledProcessError as e:
            error_msg = f"Error processing commit {commit.hexsha}: {e}"
            if e.stdout:
                logger.error(f"Command stdout:\n{e.stdout.decode() if isinstance(e.stdout, bytes) else e.stdout}")
            if e.stderr:
                logger.error(f"Command stderr:\n{e.stderr.decode() if isinstance(e.stderr, bytes) else e.stderr}")
            return error_msg
            
    except Exception as e:
        error_msg = f"Unexpected error processing commit {commit.hexsha}: {e}"
        logger.exception(error_msg)
        return error_msg
    finally:
        # Cleanup build directory after everything is done
        if build_dir and build_dir.exists():
            logger.debug(f"Cleaning up build directory: {build_dir}")
            try:
                shutil.rmtree(build_dir, ignore_errors=True)
            except Exception as e:
                logger.warning(f"Failed to clean up build directory {build_dir}: {e}")


def copy_repo_to_worktree(repo_path: Path, commit: git.Commit) -> Path:
    """Create a git worktree copy of the repository at the given commit."""
    # Create a temporary directory for the worktree
    temp_dir = Path(tempfile.mkdtemp(prefix='cpython_worktree_'))
    
    # Create worktree at the commit
    repo = git.Repo(repo_path)
    worktree_path = temp_dir / f"worktree_{commit.hexsha[:8]}"
    repo.git.worktree('add', str(worktree_path), commit.hexsha)
    
    return worktree_path


def process_commits_in_parallel(
    commits: List[git.Commit],
    repo_path: Path,
    output_dir: Path,
    configure_flags: str,
    make_flags: str,
    verbose: int,
    binary_id: str,
    environment_id: str,
    force: bool,
    max_workers: int,
    batch_size: int,
    auth_token: str,
    api_base: str = "http://localhost:8000",
) -> List[Tuple[git.Commit, Optional[str]]]:
    """Process commits in parallel using ThreadPoolExecutor."""
    all_results = []
    
    # Process commits in batches
    for i in range(0, len(commits), batch_size):
        batch = commits[i:i + batch_size]
        logger.info(f"Processing batch {i//batch_size + 1} of {(len(commits) + batch_size - 1)//batch_size} ({len(batch)} commits)")
        
        # Create worktrees for this batch
        worktrees = []
        try:
            for commit in batch:
                worktree_path = copy_repo_to_worktree(repo_path, commit)
                worktrees.append((commit, worktree_path))
            
            # Process commits in parallel
            with ThreadPoolExecutor(max_workers=min(max_workers, len(batch))) as executor:
                # Submit tasks
                future_to_commit = {
                    executor.submit(
                        process_commit,
                        commit,
                        worktree_path,
                        output_dir,
                        configure_flags,
                        make_flags,
                        verbose,
                        binary_id,
                        environment_id,
                        force,
                        auth_token,
                        api_base
                    ): commit
                    for commit, worktree_path in worktrees
                }
                
                # Collect results
                batch_results = []
                for future in as_completed(future_to_commit):
                    commit = future_to_commit[future]
                    try:
                        error = future.result()
                        batch_results.append((commit, error))
                    except Exception as exc:
                        logger.error(f'Commit {commit.hexsha[:8]} generated an exception: {exc}')
                        batch_results.append((commit, str(exc)))
                
                all_results.extend(batch_results)
        
        finally:
            # Clean up worktrees
            repo = git.Repo(repo_path)
            for commit, worktree_path in worktrees:
                try:
                    repo.git.worktree('remove', str(worktree_path), '--force')
                except Exception as e:
                    logger.warning(f"Failed to remove worktree {worktree_path}: {e}")
    
    return all_results