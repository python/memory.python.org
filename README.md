# CPython Memory Tracker

A memory benchmarking and analysis tool for CPython development, designed to track memory usage patterns across different commits and build configurations.

## Architecture

This project consists of three main components:

- **Backend** (`/backend/`) - FastAPI application with SQLite database for data storage and API endpoints
- **Frontend** (`/frontend/`) - Next.js React application with rich data visualization and analysis tools  
- **Worker** (`/worker/`) - Python CLI tool for running memory benchmarks on CPython commits

## Quick Start

### Prerequisites
- Python 3.8+
- Node.js 16+
- CPython source repository (for benchmarking)

### Setup & Installation
```bash
# Install all dependencies and set up database
make setup

# Or install components separately
make install          # Install frontend + backend dependencies
make init-db         # Initialize SQLite database
make populate-db     # Add mock data for development
```

### Development
```bash
# Start both frontend and backend servers
make dev

# Or start them individually
make dev-frontend    # Frontend on http://localhost:9002
make dev-backend     # Backend API on http://localhost:8000
```

## Development Commands

### Testing
```bash
npm run lint                # Frontend linting (in frontend directory)
npm run typecheck           # TypeScript type checking
```

### Database Management
```bash
make reset-db               # Drop and recreate database with fresh data
make populate-db           # Add mock benchmark data
```

### Production
```bash
make build                  # Build frontend for production
make clean                  # Clean up generated files and caches
```

## Worker Setup

### Worker Usage
```bash
# Set authentication token
export MEMORY_TRACKER_TOKEN=your_token_here

# List available binaries and environments
memory-tracker list-binaries
memory-tracker list-environments

# Run benchmarks on CPython commits
memory-tracker benchmark /path/to/cpython HEAD~5..HEAD \
  --binary-id default \
  --environment-id linux-x86_64

# Parallel processing with 4 workers
memory-tracker benchmark /path/to/cpython HEAD~10..HEAD \
  --binary-id default \
  --environment-id linux-x86_64 \
  --max-workers 4

# Local checkout mode (sequential only)
memory-tracker benchmark /path/to/cpython HEAD~5..HEAD \
  --binary-id default \
  --environment-id linux-x86_64 \
  --local-checkout
```

## Docker Support

```bash
# Development with hot reload
docker-compose -f docker-compose.dev.yml up

# Production deployment
docker-compose up
```

## Usage Examples

### Analyzing Memory Trends
1. Navigate to `/trends` to view memory usage over time
2. Filter by specific benchmarks or commit ranges
3. Compare different Python build configurations
4. Export charts for reports and presentations

### Comparing Commits
1. Go to `/diff` for commit comparison
2. Select two commits to analyze
3. View detailed memory usage differences
4. Identify performance regressions or improvements

### Running Benchmarks
```bash
# Benchmark recent commits with parallel processing
memory-tracker benchmark ~/cpython HEAD~20..HEAD \
  --binary-id optimized \
  --environment-id linux-x86_64 \
  --max-workers 8 \
  --batch-size 4

# Force overwrite existing results
memory-tracker benchmark ~/cpython HEAD~10..HEAD \
  --binary-id default \
  --environment-id linux-x86_64 \
  --force
```

## Contributing

1. Follow the existing code style and conventions
2. Run tests before committing: `make test`
3. Use TypeScript for all frontend code
4. Follow the repository patterns for new features
5. Never commit secrets or authentication tokens

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Related Projects

- [CPython](https://github.com/python/cpython) - The Python programming language
- [Memray](https://github.com/bloomberg/memray) - Memory profiler for Python
- [pyperformance](https://github.com/python/pyperformance) - Python performance benchmarking suite
