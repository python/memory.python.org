FROM python:3.11-slim

WORKDIR /app

# Install system dependencies including PostgreSQL client libraries
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first to leverage Docker layer caching
COPY requirements.txt .

# Install PostgreSQL adapter
RUN pip install --no-cache-dir asyncpg psycopg2-binary

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the backend source code
COPY . .

# Set default environment variables
ENV API_PORT=8000
ENV API_HOST=0.0.0.0

# Expose the port (using environment variable)
EXPOSE ${API_PORT}

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:${API_PORT}/health || exit 1

# Run the application
CMD ["sh", "-c", "python -m uvicorn app.main:app --host ${API_HOST} --port ${API_PORT}"]