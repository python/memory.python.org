"""
Test fixtures derived from the production database.

These represent real CPython commits, benchmark results, and the relationships
between them. The deltablue_base benchmark shows a ~10.5% high watermark
increase between the two commits, while json_dumps_base and nbody_base remain
unchanged — a pattern typical of real-world memory regressions where only
specific benchmarks are affected.
"""

from datetime import datetime

BINARY_NOGIL = {
    "id": "nogil",
    "name": "Free-threaded Build",
    "flags": ["--disable-gil"],
    "description": "Experimental build without the Global Interpreter Lock (GIL).",
    "color": "#f59e0b",
    "icon": "zap",
    "display_order": 5,
}

ENVIRONMENT_GH_ACTIONS = {
    "id": "gh_actions",
    "name": "GitHub actions",
    "description": "GitHub actions in memory.python.org",
}

COMMIT_PREV = {
    "sha": "e05182f98ea100b6e26796a76b1399237aeac22f",
    "timestamp": datetime(2025, 8, 29, 11, 49, 35),
    "message": "gh-138250: load fast optimization should fall through to empty blocks (#138249)",
    "author": "Dino Viehland",
    "python_major": 3,
    "python_minor": 15,
    "python_patch": 0,
}

COMMIT_CURR = {
    "sha": "d3d94e0ed715829d9bf93ef9c35e04832962f19f",
    "timestamp": datetime(2025, 8, 30, 22, 21, 25),
    "message": "gh-138061: Exclude __pycache__ directory from the computed digest in the JIT stencils (#138131)",
    "author": "alm",
    "python_major": 3,
    "python_minor": 15,
    "python_patch": 0,
}

RUN_PREV = {
    "run_id": "run_e05182f9_nogil_gh_actions_1756509299",
    "commit_sha": COMMIT_PREV["sha"],
    "binary_id": "nogil",
    "environment_id": "gh_actions",
    "python_major": 3,
    "python_minor": 15,
    "python_patch": 0,
    "timestamp": datetime(2025, 8, 29, 23, 14, 59, 158448),
}

RUN_CURR = {
    "run_id": "run_d3d94e0e_nogil_gh_actions_1756595617",
    "commit_sha": COMMIT_CURR["sha"],
    "binary_id": "nogil",
    "environment_id": "gh_actions",
    "python_major": 3,
    "python_minor": 15,
    "python_patch": 0,
    "timestamp": datetime(2025, 8, 30, 23, 13, 37, 215031),
}

# deltablue_base: 10.5% high watermark increase between commits
BENCH_DELTABLUE_PREV = {
    "id": "run_e05182f9_nogil_gh_actions_1756509299_deltablue-base",
    "run_id": RUN_PREV["run_id"],
    "benchmark_name": "deltablue_base",
    "high_watermark_bytes": 1_557_777,
    "total_allocated_bytes": 111_297_305,
    "allocation_histogram": [
        [0, 123], [3, 3612], [10, 992], [34, 61414],
        [111, 519085], [362, 726], [1176, 198],
        [3821, 386], [12416, 23], [40342, 10],
    ],
    "top_allocating_functions": [
        {"function": "execute:deltablue_base.py:340", "count": 0, "total_size": 39_168_000},
        {"function": "execute:deltablue_base.py:494", "count": 0, "total_size": 23_869_728},
        {"function": "_get_code_from_file:<frozen runpy>:259", "count": 0, "total_size": 4_191_949},
        {"function": "add_propagate:deltablue_base.py:438", "count": 0, "total_size": 3_131_664},
        {"function": "weakest_of:deltablue_base.py:51", "count": 0, "total_size": 1_664_832},
    ],
}

BENCH_DELTABLUE_CURR = {
    "id": "run_d3d94e0e_nogil_gh_actions_1756595617_deltablue-base",
    "run_id": RUN_CURR["run_id"],
    "benchmark_name": "deltablue_base",
    "high_watermark_bytes": 1_721_155,
    "total_allocated_bytes": 111_291_390,
    "allocation_histogram": [
        [0, 123], [3, 3612], [10, 992], [34, 61399],
        [111, 519085], [362, 722], [1176, 197],
        [3821, 386], [12416, 23], [40342, 10],
    ],
    "top_allocating_functions": [
        {"function": "execute:deltablue_base.py:340", "count": 0, "total_size": 39_168_000},
        {"function": "execute:deltablue_base.py:494", "count": 0, "total_size": 23_869_728},
        {"function": "_get_code_from_file:<frozen runpy>:259", "count": 0, "total_size": 4_191_949},
        {"function": "add_propagate:deltablue_base.py:438", "count": 0, "total_size": 3_131_664},
        {"function": "weakest_of:deltablue_base.py:51", "count": 0, "total_size": 1_664_832},
    ],
}

# json_dumps_base: identical across both commits
BENCH_JSON_DUMPS_PREV = {
    "id": "run_e05182f9_nogil_gh_actions_1756509299_json-dumps-base",
    "run_id": RUN_PREV["run_id"],
    "benchmark_name": "json_dumps_base",
    "high_watermark_bytes": 405_465,
    "total_allocated_bytes": 14_132_797,
    "allocation_histogram": [
        [0, 14], [3, 425], [12, 196], [45, 49869],
        [160, 23501], [571, 85], [2036, 31],
        [7248, 22], [25805, 8], [91871, 11],
    ],
    "top_allocating_functions": [
        {"function": "iterencode:json/encoder.py:261", "count": 0, "total_size": 7_404_609},
        {"function": "bench_json_dumps:json_dumps_base.py:31", "count": 0, "total_size": 1_632_536},
        {"function": "encode:json/encoder.py:200", "count": 0, "total_size": 1_312_456},
        {"function": "iterencode:json/encoder.py:252", "count": 0, "total_size": 960_240},
        {"function": "dumps:json/__init__.py:231", "count": 0, "total_size": 928_360},
    ],
}

BENCH_JSON_DUMPS_CURR = {
    "id": "run_d3d94e0e_nogil_gh_actions_1756595617_json-dumps-base",
    "run_id": RUN_CURR["run_id"],
    "benchmark_name": "json_dumps_base",
    "high_watermark_bytes": 405_465,
    "total_allocated_bytes": 14_132_797,
    "allocation_histogram": BENCH_JSON_DUMPS_PREV["allocation_histogram"],
    "top_allocating_functions": BENCH_JSON_DUMPS_PREV["top_allocating_functions"],
}

# nbody_base: identical across both commits
BENCH_NBODY_PREV = {
    "id": "run_e05182f9_nogil_gh_actions_1756509299_nbody-base",
    "run_id": RUN_PREV["run_id"],
    "benchmark_name": "nbody_base",
    "high_watermark_bytes": 563_371,
    "total_allocated_bytes": 1_808_575,
    "allocation_histogram": [
        [0, 18], [3, 1047], [10, 223], [34, 3845],
        [111, 804], [362, 166], [1176, 37],
        [3821, 75], [12416, 8], [40342, 5],
    ],
    "top_allocating_functions": [
        {"function": "_get_code_from_file:<frozen runpy>:259", "count": 0, "total_size": 905_285},
        {"function": "_read_directory:<frozen zipimport>:302", "count": 0, "total_size": 132_232},
        {"function": "get_data:<frozen importlib._bootstrap_external>:954", "count": 0, "total_size": 132_225},
        {"function": "_get_code_from_file:<frozen runpy>:258", "count": 0, "total_size": 132_176},
        {"function": "_get_code_from_file:<frozen runpy>:254", "count": 0, "total_size": 132_176},
    ],
}

BENCH_NBODY_CURR = {
    "id": "run_d3d94e0e_nogil_gh_actions_1756595617_nbody-base",
    "run_id": RUN_CURR["run_id"],
    "benchmark_name": "nbody_base",
    "high_watermark_bytes": 563_371,
    "total_allocated_bytes": 1_808_575,
    "allocation_histogram": BENCH_NBODY_PREV["allocation_histogram"],
    "top_allocating_functions": BENCH_NBODY_PREV["top_allocating_functions"],
}

ALL_PREV_BENCHMARKS = [BENCH_DELTABLUE_PREV, BENCH_JSON_DUMPS_PREV, BENCH_NBODY_PREV]
ALL_CURR_BENCHMARKS = [BENCH_DELTABLUE_CURR, BENCH_JSON_DUMPS_CURR, BENCH_NBODY_CURR]
