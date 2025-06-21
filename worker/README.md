# Memory Tracker Worker

A tool to run memory benchmarks on CPython commits using Memray.

## Installation

```bash
pip install -e .
```

## Usage

The tool provides a CLI command `memory-tracker` that can be used to run benchmarks on a range of CPython commits.

### Basic Usage

```bash
# Run benchmarks on a range of commits
memory-tracker benchmark HEAD~5..HEAD

# Specify a custom CPython repository
memory-tracker benchmark /path/to/cpython HEAD~5..HEAD

# Customize build flags
memory-tracker benchmark HEAD~5..HEAD --configure-flags="--enable-optimizations --with-lto" --make-flags="-j8"

# Specify output directory
memory-tracker benchmark HEAD~5..HEAD --output-dir="./my_benchmarks"
```

### Output

For each commit, the tool will:

1. Checkout the commit
2. Build CPython with the specified flags
3. Create a virtual environment with the built Python
4. Install Memray
5. Run all benchmarks in the `benchmarks` directory
6. Generate the following files for each benchmark:
   - `.bin` file with raw Memray data
   - `_stats.json` with memory statistics
   - `_flamegraph.html` with an interactive flamegraph
   - `sysconfig.json` with system configuration information

### Adding New Benchmarks

To add a new benchmark:

1. Create a new Python file in the `benchmarks` directory
2. Write your benchmark code
3. The file will be automatically discovered and run

Example benchmark:

```python
def my_benchmark():
    # Your benchmark code here
    pass

if __name__ == '__main__':
    my_benchmark()
```

## Development

### Setup

```bash
# Create a virtual environment
python -m venv .venv
source .venv/bin/activate

# Install development dependencies
pip install -e ".[dev]"
```

### Running Tests

```bash
pytest
``` 