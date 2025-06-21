"""Argument parsing for the CLI."""
import argparse
from pathlib import Path
from .commands import benchmark_command, list_binaries_command, list_environments_command


def parse_args():
    """Parse command line arguments using proper subcommands."""
    parser = argparse.ArgumentParser(
        description="Memory tracker for CPython commits",
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    
    # Create subparsers
    subparsers = parser.add_subparsers(
        dest='command',
        help='Available commands',
        metavar='COMMAND'
    )
    
    # List binaries command
    list_binaries_parser = subparsers.add_parser(
        'list-binaries', 
        help='List available registered binaries from server'
    )
    list_binaries_parser.add_argument(
        '-v', '--verbose',
        action='count',
        default=0,
        help='Increase verbosity (can be used multiple times, e.g. -vvv)'
    )
    list_binaries_parser.add_argument(
        '--server-url',
        default='http://localhost:8000',
        help='Server URL for API calls (default: http://localhost:8000)'
    )
    list_binaries_parser.set_defaults(func=list_binaries_command)
    
    # List environments command
    list_environments_parser = subparsers.add_parser(
        'list-environments', 
        help='List available registered environments from server'
    )
    list_environments_parser.add_argument(
        '-v', '--verbose',
        action='count',
        default=0,
        help='Increase verbosity (can be used multiple times, e.g. -vvv)'
    )
    list_environments_parser.add_argument(
        '--server-url',
        default='http://localhost:8000',
        help='Server URL for API calls (default: http://localhost:8000)'
    )
    list_environments_parser.set_defaults(func=list_environments_command)
    
    # Benchmark command
    benchmark_parser = subparsers.add_parser(
        'benchmark',
        help='Run memory benchmarks on CPython commits'
    )
    benchmark_parser.add_argument(
        'repo_path',
        nargs='?',
        type=Path,
        help='Path to CPython repository (optional, will clone if not provided)'
    )
    benchmark_parser.add_argument(
        'commit_range',
        help='Git commit range to benchmark (e.g., HEAD~5..HEAD)'
    )
    benchmark_parser.add_argument(
        '--output-dir', '-o',
        type=Path,
        default=Path('./benchmark_results'),
        help='Directory to store benchmark results (default: ./benchmark_results)'
    )
    benchmark_parser.add_argument(
        '--configure-flags', '-c',
        default='--enable-optimizations',
        help='Configure flags for CPython build (default: --enable-optimizations)'
    )
    benchmark_parser.add_argument(
        '--make-flags', '-m',
        default='-j4',
        help='Make flags for CPython build (default: -j4)'
    )
    benchmark_parser.add_argument(
        '-v', '--verbose',
        action='count',
        default=0,
        help='Increase verbosity (can be used multiple times, e.g. -vvv)'
    )
    benchmark_parser.add_argument(
        '--binary-id',
        required=True,
        help='Binary ID to use for this run (e.g., optimized, debug, default)'
    )
    benchmark_parser.add_argument(
        '--environment-id', 
        required=True,
        help='Environment ID to use for this run (e.g., linux-x86_64, macos-x86_64)'
    )
    benchmark_parser.add_argument(
        '-f', '--force',
        action='store_true',
        help='Force overwrite existing output directories for commits'
    )
    benchmark_parser.add_argument(
        '--max-workers', '-j',
        type=int,
        default=1,
        help='Maximum number of parallel workers. Creates temporary repo copies for each worker to avoid conflicts. (default: 1 for sequential processing)'
    )
    benchmark_parser.add_argument(
        '--batch-size', '-b',
        type=int,
        default=None,
        help='Number of commits to process in each parallel batch. Useful for memory management with large commit ranges. (default: same as max-workers)'
    )
    benchmark_parser.add_argument(
        '--auth-token',
        help='Authentication token for uploading results to server. Can also be set via MEMORY_TRACKER_TOKEN environment variable.'
    )
    benchmark_parser.add_argument(
        '--api-base',
        default='http://localhost:8000',
        help='Base URL for the memory tracker API (default: http://localhost:8000)'
    )
    benchmark_parser.add_argument(
        '--local-checkout',
        action='store_true',
        help='Use local checkout for building. Runs git clean -fxd, configures once, and runs make for each commit. Incompatible with parallel processing (-j > 1).'
    )
    benchmark_parser.set_defaults(func=benchmark_command)
    
    return parser.parse_args()