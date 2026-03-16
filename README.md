# CPython Memory Tracker

A memory benchmarking and analysis tool for CPython development, designed to track memory usage patterns across different commits and build configurations.

## Architecture

This project consists of three main components:

- **Backend** (`/backend/`) - FastAPI application with SQLite database for data storage and API endpoints
- **Frontend** (`/frontend/`) - Next.js React application with rich data visualization and analysis tools  
- **Worker** (`/worker/`) - Python CLI tool for running memory benchmarks on CPython commits

## Quick Start

### Prerequisites
- Docker Engine 20.10+ and Docker Compose 2.0+
- CPython source repository (for benchmarking with the worker)

### Setup & Installation
```bash
# Copy environment config
cp .env.example .env

# Build and start all services
docker compose -f docker-compose.dev.yml up --build
```

### Development

Services start automatically with hot reload:
- Frontend: http://localhost:9002
- Backend API: http://localhost:8000
- API Documentation: http://localhost:8000/api/docs

## Development Commands

### Testing
```bash
# Via Docker (recommended)
docker compose -f docker-compose.dev.yml exec frontend npm run lint
docker compose -f docker-compose.dev.yml exec frontend npm run typecheck

# Or locally in the frontend directory
npm run lint                # ESLint (must pass with zero errors)
npm run typecheck           # TypeScript type checking
```

Both checks run in CI on pushes to `main` and on pull requests.

### Populating Mock Data
```bash
docker compose -f docker-compose.dev.yml exec backend python scripts/populate_db.py
```

### Updating Backend Dependencies
```bash
# Edit backend/requirements.in, then regenerate both lockfiles:
docker run --rm -v "$(pwd)/backend:/app" -w /app python:3.13-slim-bookworm \
  sh -c "pip install --quiet pip-tools && \
  pip-compile --strip-extras --generate-hashes \
    --output-file requirements.txt requirements.in && \
  pip-compile --strip-extras --generate-hashes \
    --output-file requirements-dev.txt requirements-dev.in"

# Rebuild the backend container:
docker compose -f docker-compose.dev.yml up --build -d backend
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
docker compose -f docker-compose.dev.yml up

# Production deployment
docker compose up
```

## Local Development (not recommended)

Running services directly on the host is possible but not recommended.
Docker Compose ensures consistent Python/Node versions, database setup,
and dependency isolation across all platforms.

### Prerequisites
- Python 3.13+
- Node.js 20+

```bash
make setup        # Install deps, init DB, populate mock data
make dev          # Start frontend + backend with hot reload
make test         # Run backend tests
make reset-db     # Drop and recreate database with fresh data
make populate-db  # Populate the DB with mock data
make build        # Build frontend for production
make clean        # Clean up generated files and caches
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
2. Run tests before committing
3. Use TypeScript for all frontend code
4. Follow the repository patterns for new features
5. Never commit secrets or authentication tokens

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Related Projects

- [CPython](https://github.com/python/cpython) - The Python programming language
- [Memray](https://github.com/bloomberg/memray) - Memory profiler for Python
- [pyperformance](https://github.com/python/pyperformance) - Python performance benchmarking suite
