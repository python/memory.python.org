#!/usr/bin/env python3
"""
Database population script for CPython Memory Tracker.
This script populates the database with mock data for testing and development.
"""

import asyncio
import sys
import os
import random
from datetime import datetime, timedelta
from typing import List

# Add the parent directory to the path so we can import from app
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.database import AsyncSessionLocal
from app import models, schemas, crud


# Mock data generators
def generate_commits(count: int = 200) -> List[schemas.CommitCreate]:
    """Generate mock commits with realistic data."""
    authors = [
        "Alice Wonderland",
        "Bob The Builder",
        "Carol Danvers",
        "David Copperfield",
        "Eve Harrington",
        "Frank Sinatra",
        "Grace Hopper",
        "Henry Ford",
        "Iris Chang",
        "Jack Sparrow",
    ]

    python_versions = [
        (3, 11, 0),
        (3, 11, 1),
        (3, 11, 2),
        (3, 11, 3),
        (3, 12, 0),
        (3, 12, 1),
        (3, 12, 2),
        (3, 12, 3),
        (3, 12, 4),
        (3, 12, 5),
        (3, 13, 0),
        (3, 13, 1),
    ]

    messages = [
        "Initial commit",
        "Add performance optimization",
        "Fix memory leak",
        "Refactor allocation logic",
        "Update benchmarking suite",
        "Optimize hot path",
        "Add new benchmark tests",
        "Fix regression in memory usage",
        "Improve garbage collection",
        "Add debug logging",
        "Release version",
        "Fix critical bug",
        "Performance improvements",
        "Code cleanup",
        "Add feature",
        "Update dependencies",
        "Security fix",
    ]

    commits = []
    base_time = datetime.now()

    for i in range(count):
        major, minor, patch = random.choice(python_versions)
        days_ago = i * random.uniform(0.5, 3.0)  # Commits spread over time

        commit = schemas.CommitCreate(
            sha=f"{random.randint(10000000, 99999999):08x}",
            timestamp=base_time - timedelta(days=days_ago),
            message=f"{random.choice(messages)} (Python {major}.{minor})",
            author=random.choice(authors),
            python_version=schemas.PythonVersion(major=major, minor=minor, patch=patch),
        )
        commits.append(commit)

    # Sort by timestamp (newest first)
    commits.sort(key=lambda c: c.timestamp, reverse=True)
    return commits


def generate_binaries() -> List[schemas.BinaryCreate]:
    """Generate standard binary configurations with configure flags."""
    return [
        schemas.BinaryCreate(
            id="default",
            name="Default",
            flags=[],
            description="Standard CPython build with default compilation settings",
        ),
        schemas.BinaryCreate(
            id="debug",
            name="Debug",
            flags=["--with-debug"],
            description="Debug build with additional runtime checks and memory overhead",
        ),
        schemas.BinaryCreate(
            id="nogil",
            name="No GIL",
            flags=["--disable-gil"],
            description="Experimental build without the Global Interpreter Lock",
        ),
    ]


def generate_environments() -> List[schemas.EnvironmentCreate]:
    """Generate standard environment configurations."""
    return [
        schemas.EnvironmentCreate(
            id="gcc-11",
            name="GCC 11 + Ubuntu 22.04",
            description="Compiled with GCC 11 compiler on Ubuntu 22.04 LTS",
        ),
        schemas.EnvironmentCreate(
            id="clang-14",
            name="Clang 14 + Ubuntu 22.04",
            description="Compiled with Clang 14 compiler on Ubuntu 22.04 LTS",
        ),
    ]


def generate_runs(
    commits: List[models.Commit],
    binaries: List[models.Binary],
    environments: List[models.Environment],
) -> List[schemas.RunCreate]:
    """Generate runs for commits and binaries - test all binaries for each commit."""
    runs = []

    for commit in commits:
        for binary in binaries:
            # Randomly select environment (both should be tested over time)
            environment = random.choice(environments)

            run_id = f"run_{commit.sha[:8]}_{binary.id}_{environment.id}"
            # Run timestamp is slightly after commit timestamp
            run_timestamp = commit.timestamp + timedelta(minutes=random.randint(5, 60))

            run = schemas.RunCreate(
                run_id=run_id,
                commit_sha=commit.sha,
                binary_id=binary.id,
                environment_id=environment.id,
                python_version=schemas.PythonVersion(
                    major=commit.python_major,
                    minor=commit.python_minor,
                    patch=commit.python_patch,
                ),
                timestamp=run_timestamp,
            )
            runs.append(run)

    return runs


def generate_benchmark_results(
    runs: List[models.Run],
) -> List[schemas.BenchmarkResultCreate]:
    """Generate VERY OBVIOUS test data with exactly 3 benchmarks to easily verify calculations."""
    # ONLY 3 benchmarks with VERY OBVIOUS values for easy verification
    benchmark_names = [
        "benchmark_A",  # Base: 1MB (1,000,000 bytes)
        "benchmark_B",  # Base: 2MB (2,000,000 bytes)
        "benchmark_C",  # Base: 10MB (10,000,000 bytes)
    ]

    results = []

    # EXACT base memory values for easy calculation verification
    benchmark_base_memory = {
        "benchmark_A": 1_000_000,  # Exactly 1MB
        "benchmark_B": 2_000_000,  # Exactly 2MB
        "benchmark_C": 10_000_000,  # Exactly 10MB
    }

    # Group runs by commit, benchmark, and environment to create correlated data
    commit_benchmark_env_data = {}

    for run in runs:
        for benchmark_name in benchmark_names:
            key = (run.commit_sha, benchmark_name, run.environment_id)
            if key not in commit_benchmark_env_data:
                commit_benchmark_env_data[key] = {}
            commit_benchmark_env_data[key][run.binary_id] = run

    # Generate PREDICTABLE data with EXACT multipliers for easy verification
    for (
        commit_sha,
        benchmark_name,
        environment_id,
    ), binary_runs in commit_benchmark_env_data.items():
        # Get base memory for this benchmark
        base_memory = benchmark_base_memory[benchmark_name]

        # EXACT values based on binary type - NO RANDOMNESS for easy verification
        for binary_id, run in binary_runs.items():
            if binary_id == "default":
                # Default uses exact base memory
                calculated_memory = base_memory
            elif binary_id == "debug":
                # Debug is EXACTLY 1.5x (50% more) than default
                calculated_memory = int(base_memory * 1.5)
            elif binary_id == "nogil":
                # NoGIL is EXACTLY 0.8x (20% less) than default
                calculated_memory = int(base_memory * 0.8)
            else:
                calculated_memory = base_memory

            # Create allocation histogram
            histogram = [
                [16, random.randint(1000, 5000)],
                [32, random.randint(500, 2000)],
                [64, random.randint(50, 200)],
            ]

            # Generate total allocated bytes (higher than high watermark)
            total_allocated = int(calculated_memory * random.uniform(2.5, 4.0))

            # Create mock top allocating functions with correct schema
            top_functions = [
                schemas.TopAllocatingFunction(
                    function=f"PyDict_{random.choice(['SetItem', 'GetItem', 'New', 'Resize'])}",
                    count=random.randint(1000, 10000),
                    total_size=random.randint(50000, 500000),
                ),
                schemas.TopAllocatingFunction(
                    function=f"PyList_{random.choice(['Append', 'New', 'Resize', 'SetSlice'])}",
                    count=random.randint(500, 8000),
                    total_size=random.randint(30000, 400000),
                ),
                schemas.TopAllocatingFunction(
                    function=f"PyUnicode_{random.choice(['New', 'Concat', 'FromString', 'Decode'])}",
                    count=random.randint(2000, 15000),
                    total_size=random.randint(40000, 600000),
                ),
            ]

            result = schemas.BenchmarkResultCreate(
                run_id=run.run_id,
                benchmark_name=benchmark_name,
                result_json=schemas.BenchmarkResultJson(
                    high_watermark_bytes=calculated_memory,
                    allocation_histogram=histogram,
                    total_allocated_bytes=total_allocated,
                    top_allocating_functions=top_functions,
                ),
                flamegraph_html=f"<svg>Mock flamegraph for {benchmark_name} on {binary_id}</svg>",
            )
            results.append(result)

    return results


async def populate_database():
    """Populate the database with mock data using efficient bulk inserts."""
    print("Populating database with mock data...")

    async with AsyncSessionLocal() as db:
        try:
            # Generate ONLY 2 commits per version for easy verification = 6 total
            print("Creating commits...")
            python_versions = [(3, 11, 0), (3, 12, 0), (3, 13, 0)]

            all_commits = []
            for major, minor, patch in python_versions:
                version_commits = generate_commits_for_version(
                    2, major, minor, patch
                )  # Only 2 commits per version
                all_commits.extend(version_commits)

            # Bulk insert commits
            commit_objects = [
                models.Commit(
                    sha=commit.sha,
                    timestamp=commit.timestamp,
                    message=commit.message,
                    author=commit.author,
                    python_major=commit.python_version.major,
                    python_minor=commit.python_version.minor,
                    python_patch=commit.python_version.patch,
                )
                for commit in all_commits
            ]
            db.add_all(commit_objects)
            await db.flush()  # Get IDs without committing
            print(f"✅ Created {len(commit_objects)} commits")

            # Generate and bulk insert binaries
            print("Creating binaries...")
            binary_data = generate_binaries()
            binary_objects = [
                models.Binary(
                    id=binary.id,
                    name=binary.name,
                    flags=binary.flags,
                    description=binary.description,
                )
                for binary in binary_data
            ]
            db.add_all(binary_objects)
            await db.flush()
            print(f"✅ Created {len(binary_objects)} binaries")

            # Generate and bulk insert environments
            print("Creating environments...")
            environment_data = generate_environments()
            environment_objects = [
                models.Environment(
                    id=env.id, name=env.name, description=env.description
                )
                for env in environment_data
            ]
            db.add_all(environment_objects)
            await db.flush()
            print(f"✅ Created {len(environment_objects)} environments")

            # Generate runs: each commit x each binary x each environment for complete coverage
            print("Creating runs...")
            run_objects = []
            run_counter = 0

            for commit_obj in commit_objects:
                for binary_obj in binary_objects:
                    # Test each binary in both environments for complete data coverage
                    for env_obj in environment_objects:
                        run_id = f"run_{commit_obj.sha[:8]}_{binary_obj.id}_{env_obj.id}_{run_counter}"
                        run_timestamp = commit_obj.timestamp + timedelta(
                            minutes=random.randint(5, 60)
                        )

                        run_objects.append(
                            models.Run(
                                run_id=run_id,
                                commit_sha=commit_obj.sha,
                                binary_id=binary_obj.id,
                                environment_id=env_obj.id,
                                python_major=commit_obj.python_major,
                                python_minor=commit_obj.python_minor,
                                python_patch=commit_obj.python_patch,
                                timestamp=run_timestamp,
                            )
                        )
                        run_counter += 1

                    batch_size = 1000
            for i in range(0, len(run_objects), batch_size):
                batch = run_objects[i : i + batch_size]
                db.add_all(batch)
                await db.flush()
                print(
                    f"   Inserted runs batch {i // batch_size + 1}/{(len(run_objects) - 1) // batch_size + 1}"
                )

            print(f"✅ Created {len(run_objects)} runs")

            # Generate benchmark results using the realistic data function
            print("Creating benchmark results...")
            benchmark_results_data = generate_benchmark_results(run_objects)

            # Convert to database objects
            result_objects = []
            for result_data in benchmark_results_data:
                result_id = f"{result_data.run_id}_{result_data.benchmark_name.replace('_', '-')}"

                result_objects.append(
                    models.BenchmarkResult(
                        id=result_id,
                        run_id=result_data.run_id,
                        benchmark_name=result_data.benchmark_name,
                        high_watermark_bytes=result_data.result_json.high_watermark_bytes,
                        allocation_histogram=result_data.result_json.allocation_histogram,
                        total_allocated_bytes=result_data.result_json.total_allocated_bytes,
                        top_allocating_functions=[
                            func.model_dump()
                            for func in result_data.result_json.top_allocating_functions
                        ],
                        flamegraph_html=result_data.flamegraph_html,
                    )
                )

            # Bulk insert benchmark results in batches
            for i in range(0, len(result_objects), batch_size):
                batch = result_objects[i : i + batch_size]
                db.add_all(batch)
                await db.flush()
                print(
                    f"   Inserted benchmark results batch {i // batch_size + 1}/{(len(result_objects) - 1) // batch_size + 1}"
                )

            print(f"✅ Created {len(result_objects)} benchmark results")

            # Commit everything at once
            await db.commit()

            print(f"\n🎉 Database populated with OBVIOUS TEST DATA!")
            print(f"   - {len(commit_objects)} commits (2 per Python version)")
            print(f"   - {len(binary_objects)} binaries (default, debug, nogil)")
            print(f"   - {len(environment_objects)} environments (gcc-11, clang-14)")
            print(
                f"   - {len(run_objects)} runs (commit × binary × environment combinations)"
            )
            print(
                f"   - {len(result_objects)} benchmark results (3 benchmarks per run)"
            )
            print(f"\n📊 MEMORY VALUES FOR VERIFICATION:")
            print(f"   Benchmark A: Default=1MB, Debug=1.5MB, NoGIL=0.8MB")
            print(f"   Benchmark B: Default=2MB, Debug=3MB, NoGIL=1.6MB")
            print(f"   Benchmark C: Default=10MB, Debug=15MB, NoGIL=8MB")

        except Exception as e:
            print(f"❌ Error populating database: {e}")
            await db.rollback()
            return False

    return True


def generate_commits_for_version(
    count: int, major: int, minor: int, patch: int
) -> List[schemas.CommitCreate]:
    """Generate commits for a specific Python version."""
    authors = [
        "Alice Wonderland",
        "Bob The Builder",
        "Carol Danvers",
        "David Copperfield",
        "Eve Harrington",
        "Frank Sinatra",
        "Grace Hopper",
        "Henry Ford",
        "Iris Chang",
        "Jack Sparrow",
    ]

    messages = [
        "Initial commit",
        "Add performance optimization",
        "Fix memory leak",
        "Refactor allocation logic",
        "Update benchmarking suite",
        "Optimize hot path",
        "Add new benchmark tests",
        "Fix regression in memory usage",
        "Improve garbage collection",
        "Add debug logging",
        "Release version",
        "Fix critical bug",
        "Performance improvements",
        "Code cleanup",
        "Add feature",
        "Update dependencies",
        "Security fix",
    ]

    commits = []
    base_time = datetime.now()

    for i in range(count):
        days_ago = i * random.uniform(0.1, 1.0)  # More frequent commits

        commit = schemas.CommitCreate(
            sha=f"{random.randint(10000000, 99999999):08x}",
            timestamp=base_time - timedelta(days=days_ago),
            message=f"{random.choice(messages)} (Python {major}.{minor})",
            author=random.choice(authors),
            python_version=schemas.PythonVersion(major=major, minor=minor, patch=patch),
        )
        commits.append(commit)

    # Sort by timestamp (newest first)
    commits.sort(key=lambda c: c.timestamp, reverse=True)
    return commits


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Populate database with mock data")
    parser.add_argument(
        "--clear-first", action="store_true", help="Clear existing data first"
    )

    args = parser.parse_args()

    if args.clear_first:
        print("Clearing existing data...")
        # This would require implementing a clear function
        pass

    success = asyncio.run(populate_database())

    if not success:
        sys.exit(1)
