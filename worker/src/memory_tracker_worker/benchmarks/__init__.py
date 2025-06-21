import json
import logging
import shutil
import subprocess
from pathlib import Path
from typing import Dict, Any
import tempfile
import git

import requests

logger = logging.getLogger(__name__)

def get_sysconfig_info(python_path: Path, commit: git.Commit) -> Dict[str, Any]:
    """Get system configuration information from Python."""
    cmd = [
        str(python_path),
        '-c',
        """
import json
import sysconfig
import sys
import platform

info = {
    'version': {
        'full': sys.version,
        'major': sys.version_info.major,
        'minor': sys.version_info.minor,
        'micro': sys.version_info.micro,
        'releaselevel': sys.version_info.releaselevel,
        'serial': sys.version_info.serial,
        'hexversion': sys.hexversion
    },
    'configure_vars': sysconfig.get_config_vars(),
    'platform': sys.platform,
    'implementation': sys.implementation.name,
    'compiler': {
        'name': platform.python_compiler(),
        'version': platform.python_compiler().split()[1] if len(platform.python_compiler().split()) > 1 else None
    },
    'build_info': {
        'build_date': sysconfig.get_config_var('BUILD_DATE'),
        'build_platform': sysconfig.get_config_var('BUILD_PLATFORM'),
        'build_compiler': sysconfig.get_config_var('BUILD_COMPILER'),
        'build_cflags': sysconfig.get_config_var('CFLAGS'),
        'build_ldflags': sysconfig.get_config_var('LDFLAGS'),
    }
}

print(json.dumps(info))
"""
    ]
    
    try:
        result = subprocess.run(cmd, capture_output=True, check=True)
        info = json.loads(result.stdout.decode())
        
        # Add commit information
        info['commit'] = {
            'hexsha': commit.hexsha,
            'short_hexsha': commit.hexsha[:8],
            'author': commit.author.name,
            'author_email': commit.author.email,
            'authored_date': commit.authored_datetime.isoformat(),
            'committer': commit.committer.name,
            'committer_email': commit.committer.email,
            'committed_date': commit.committed_datetime.isoformat(),
            'message': commit.message
        }
        
        return info
    except subprocess.CalledProcessError as e:
        logger.error(f"Failed to get sysconfig info: {e}")
        if e.stdout:
            logger.error(f"stdout: {e.stdout.decode() if isinstance(e.stdout, bytes) else e.stdout}")
        if e.stderr:
            logger.error(f"stderr: {e.stderr.decode() if isinstance(e.stderr, bytes) else e.stderr}")
        raise
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse sysconfig info: {e}")
        raise

def run_benchmarks(venv_dir: Path, output_dir: Path, commit: git.Commit) -> None:
    """Run benchmarks using the virtual environment."""
    python_path = venv_dir / 'bin' / 'python'
    memray_path = venv_dir / 'bin' / 'memray'
    
    if not python_path.exists():
        raise FileNotFoundError(f"Python executable not found at {python_path}")
    if not memray_path.exists():
        raise FileNotFoundError(f"Memray executable not found at {memray_path}")
    
    # Get system configuration
    logger.info("Getting system configuration...")
    sysconfig_info = get_sysconfig_info(python_path, commit)
    
    # Save system configuration
    config_file = output_dir / 'metadata.json'
    with open(config_file, 'w') as f:
        json.dump(sysconfig_info, f, indent=2)
    logger.info(f"Saved metadata to {config_file}")
    
    # Create temporary directory for benchmark files
    temp_dir = Path(tempfile.mkdtemp(prefix='benchmarks_'))
    try:
        # Copy benchmark files to temporary directory
        benchmarks_dir = Path(__file__).parent
        for benchmark_file in benchmarks_dir.glob('*.py'):
            if benchmark_file.name == '__init__.py':
                continue
                
            # Copy benchmark file
            dest_file = temp_dir / benchmark_file.name
            shutil.copy2(benchmark_file, dest_file)
            logger.info(f"Copied benchmark {benchmark_file.name} to temporary directory")
            
            # Run benchmark with memray
            benchmark_name = benchmark_file.stem
            logger.info(f"Running benchmark: {benchmark_name}")
            
            # Run memray
            memray_output = output_dir / f"{benchmark_name}.bin"
            try:
                result = subprocess.run([
                    str(memray_path), 'run',
                    "--native", "--trace-python-allocators",
                    '--output', str(memray_output),
                    str(dest_file), 
                ], capture_output=True, check=True)
                
                if result.stdout:
                    logger.debug(f"Memray stdout:\n{result.stdout.decode() if isinstance(result.stdout, bytes) else result.stdout}")
                if result.stderr:
                    logger.debug(f"Memray stderr:\n{result.stderr.decode() if isinstance(result.stderr, bytes) else result.stderr}")
                
                # Generate stats
                stats_output = output_dir / f"{benchmark_name}_stats.json"
                result = subprocess.run([
                    str(memray_path), 'stats',
                    '--json',
                    '--output', str(stats_output),
                    str(memray_output)
                ], capture_output=True, check=True)
                
                if result.stdout:
                    logger.debug(f"Stats stdout:\n{result.stdout.decode() if isinstance(result.stdout, bytes) else result.stdout}")
                if result.stderr:
                    logger.debug(f"Stats stderr:\n{result.stderr.decode() if isinstance(result.stderr, bytes) else result.stderr}")
                
                # Generate flamegraph
                flamegraph_output = output_dir / f"{benchmark_name}_flamegraph.html"
                result = subprocess.run([
                    str(memray_path), 'flamegraph',
                    '--output', str(flamegraph_output),
                    str(memray_output)
                ], capture_output=True, check=True)
                
                if result.stdout:
                    logger.debug(f"Flamegraph stdout:\n{result.stdout.decode() if isinstance(result.stdout, bytes) else result.stdout}")
                if result.stderr:
                    logger.debug(f"Flamegraph stderr:\n{result.stderr.decode() if isinstance(result.stderr, bytes) else result.stderr}")
                    
            except subprocess.CalledProcessError as e:
                logger.error(f"Failed to run benchmark {benchmark_name}: {e}")
                if e.stdout:
                    logger.error(f"stdout: {e.stdout.decode() if isinstance(e.stdout, bytes) else e.stdout}")
                if e.stderr:
                    logger.error(f"stderr: {e.stderr.decode() if isinstance(e.stderr, bytes) else e.stderr}")
                raise
    finally:
        # Clean up temporary directory
        if temp_dir.exists():
            shutil.rmtree(temp_dir)
            logger.debug(f"Cleaned up temporary directory: {temp_dir}")


def list_binaries(server_url: str = "http://localhost:8000") -> list:
    """List all available binaries from the server."""
    try:
        logger.info(f"Fetching available binaries from {server_url}")
        response = requests.get(f"{server_url}/api/binaries", timeout=10)
        response.raise_for_status()
        logger.debug(f"Got {len(response.json())} binaries")
        return response.json()
    except requests.exceptions.RequestException as e:
        raise ValueError(f"Failed to fetch binaries: {e}")


def list_environments(server_url: str = "http://localhost:8000") -> list:
    """List all available environments from the server."""
    try:
        logger.info(f"Fetching available environments from {server_url}")
        response = requests.get(f"{server_url}/api/environments", timeout=10)
        response.raise_for_status()
        logger.debug(f"Got {len(response.json())} environments")
        return response.json()
    except requests.exceptions.RequestException as e:
        raise ValueError(f"Failed to fetch environments: {e}")


def validate_binary_and_environment(binary_id: str, environment_id: str, server_url: str = "http://localhost:8000") -> None:
    """Validate that binary and environment exist on the server before running benchmarks."""
    logger.info(f"Validating binary_id: {binary_id} and environment_id: {environment_id}")
    
    try:
        # Check if binary exists
        logger.debug(f"Checking if binary '{binary_id}' exists")
        binary_response = requests.get(f"{server_url}/api/binaries/{binary_id}", timeout=10)
        if binary_response.status_code == 404:
            raise ValueError(f"Binary '{binary_id}' not found on server. Please register the binary first.")
        binary_response.raise_for_status()
        
        # Check if environment exists  
        logger.debug(f"Checking if environment '{environment_id}' exists")
        env_response = requests.get(f"{server_url}/api/environments/{environment_id}", timeout=10)
        if env_response.status_code == 404:
            raise ValueError(f"Environment '{environment_id}' not found on server. Please register the environment first.")
        env_response.raise_for_status()
        
        logger.info(f"Successfully validated binary '{binary_id}' and environment '{environment_id}'")
        
    except requests.exceptions.RequestException as e:
        raise ValueError(f"Failed to validate binary and environment: {e}")


def upload_results_to_server(output_dir: Path, binary_id: str, environment_id: str, auth_token: str = None, server_url: str = "http://localhost:8000") -> None:
    """Upload benchmark results to the server."""
    logger.info(f"Uploading results from {output_dir} to {server_url}")
    logger.info(f"Using binary_id: {binary_id}, environment_id: {environment_id}")
    
    # Load metadata
    metadata_file = output_dir / 'metadata.json'
    if not metadata_file.exists():
        logger.error(f"Metadata file not found: {metadata_file}")
        return
        
    with open(metadata_file, 'r') as f:
        metadata = json.load(f)
    
    # Collect benchmark results
    benchmark_results = []
    for stats_file in output_dir.glob('*_stats.json'):
        benchmark_name = stats_file.stem.replace('_stats', '')
        flamegraph_file = output_dir / f"{benchmark_name}_flamegraph.html"
        
        # Load stats JSON
        with open(stats_file, 'r') as f:
            stats_json = json.load(f)
        
        # Load flamegraph HTML
        flamegraph_html = ""
        if flamegraph_file.exists():
            with open(flamegraph_file, 'r') as f:
                flamegraph_html = f.read()
        
        benchmark_results.append({
            "benchmark_name": benchmark_name,
            "stats_json": stats_json,
            "flamegraph_html": flamegraph_html
        })
    
    # Prepare upload payload
    upload_data = {
        "metadata": metadata,
        "benchmark_results": benchmark_results,
        "binary_id": binary_id,
        "environment_id": environment_id
    }
    
    # Prepare headers with authentication
    headers = {"Content-Type": "application/json"}
    if auth_token:
        headers["Authorization"] = f"Bearer {auth_token}"
        logger.debug("Using authentication token for upload")
    else:
        logger.warning("No authentication token provided - upload may fail")
    
    # Upload to server
    try:
        response = requests.post(f"{server_url}/api/upload-run", json=upload_data, headers=headers, timeout=30)
        response.raise_for_status()
        
        result = response.json()
        logger.info(f"Successfully uploaded run: {result.get('run_id')}")
        logger.info(f"Created {result.get('results_created')} benchmark results")
        logger.info(f"Detected binary: {result.get('binary_id')}, environment: {result.get('environment_id')}")
        
    except requests.exceptions.HTTPError as e:
        # Extract detailed error message from server response
        error_detail = "Unknown error"
        try:
            if e.response.headers.get('content-type', '').startswith('application/json'):
                error_json = e.response.json()
                error_detail = error_json.get('detail', str(e))
            else:
                error_detail = e.response.text or str(e)
        except Exception:
            error_detail = str(e)
        
        logger.error(f"Server rejected upload (HTTP {e.response.status_code}): {error_detail}")
        logger.info(f"Results are still saved locally in: {output_dir}")
        raise ValueError(f"Upload failed: {error_detail}")
        
    except requests.exceptions.RequestException as e:
        logger.error(f"Failed to connect to server: {e}")
        logger.info(f"Results are still saved locally in: {output_dir}")
        raise ValueError(f"Connection failed: {e}")
        
    except Exception as e:
        logger.error(f"Unexpected error during upload: {e}")
        logger.info(f"Results are still saved locally in: {output_dir}")
        raise ValueError(f"Upload failed: {e}") 