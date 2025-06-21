from pydantic import BaseModel
from typing import List, Optional, Dict, Any, Tuple
from datetime import datetime


class PythonVersion(BaseModel):
    major: int
    minor: int
    patch: int


class CommitBase(BaseModel):
    sha: str
    timestamp: datetime
    message: str
    author: str
    python_version: PythonVersion


class CommitCreate(CommitBase):
    pass


class Commit(CommitBase):
    class Config:
        from_attributes = True


class BinaryBase(BaseModel):
    id: str
    name: str
    flags: List[
        str
    ]  # Configure flags used to build Python (e.g., --enable-optimizations, --with-debug)
    description: Optional[str] = (
        None  # Description of what this binary configuration does
    )
    color: Optional[str] = "#8b5cf6"  # Hex color code
    icon: Optional[str] = "server"  # Lucide icon name
    display_order: Optional[int] = 0  # Order for display


class BinaryCreate(BinaryBase):
    pass


class Binary(BinaryBase):
    class Config:
        from_attributes = True


class EnvironmentBase(BaseModel):
    id: str
    name: str
    description: Optional[str] = None


class EnvironmentCreate(EnvironmentBase):
    pass


class Environment(EnvironmentBase):
    class Config:
        from_attributes = True


class RunBase(BaseModel):
    run_id: str
    commit_sha: str
    binary_id: str
    environment_id: str
    python_version: PythonVersion
    timestamp: datetime


class RunCreate(RunBase):
    pass


class Run(RunBase):
    class Config:
        from_attributes = True


class TopAllocatingFunction(BaseModel):
    function: str
    count: int
    total_size: int


class BenchmarkResultJson(BaseModel):
    high_watermark_bytes: int
    allocation_histogram: List[Tuple[int, int]]
    total_allocated_bytes: int
    top_allocating_functions: List[TopAllocatingFunction]
    benchmark_name: Optional[str] = None


class BenchmarkResultBase(BaseModel):
    id: str
    run_id: str
    benchmark_name: str
    result_json: BenchmarkResultJson


class BenchmarkResultCreate(BaseModel):
    run_id: str
    benchmark_name: str
    result_json: BenchmarkResultJson
    flamegraph_html: Optional[str] = None


class BenchmarkResult(BenchmarkResultBase):
    class Config:
        from_attributes = True


# Worker upload schemas
class WorkerBenchmarkResult(BaseModel):
    benchmark_name: str
    stats_json: Dict[str, Any]  # The memray stats JSON
    flamegraph_html: str  # The HTML content


class WorkerRunUpload(BaseModel):
    metadata: Dict[str, Any]  # The metadata.json content
    benchmark_results: List[WorkerBenchmarkResult]
    binary_id: str  # Provided by worker
    environment_id: str  # Provided by worker


class DiffTableRow(BaseModel):
    benchmark_name: str
    metric_delta_percent: Optional[float] = None
    prev_metric_value: Optional[int] = None
    curr_metric_value: int
    curr_commit_details: Commit
    prev_commit_details: Optional[Commit] = None
    metric_key: str
    prev_python_version_str: Optional[str] = None
    curr_python_version_str: str
    curr_result_id: str


class PythonVersionFilterOption(BaseModel):
    label: str
    major: int
    minor: int


class TrendRequest(BaseModel):
    benchmark_name: str
    binary_id: str
    environment_id: str
    limit: int = 50


class BatchTrendRequest(BaseModel):
    trend_queries: List[TrendRequest]


class BatchTrendResponse(BaseModel):
    results: Dict[str, List[dict]]  # Key format: "{binary_id}:{benchmark_name}"


class BenchmarkUpload(BaseModel):
    commit_sha: str
    binary_id: str
    environment_id: str
    python_version: PythonVersion
    benchmark_results: List[BenchmarkResultJson]
