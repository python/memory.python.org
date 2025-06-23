FROM node:18-bookworm AS frontend-base

# Install dependencies only when needed
FROM frontend-base AS deps
WORKDIR /app

# Copy package files
COPY frontend/package*.json ./
RUN npm ci

# Rebuild the source code only when needed
FROM frontend-base AS frontend-builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY ./frontend/ .

# Build the application
RUN npm run build


FROM python:3.13-slim-bookworm

WORKDIR /app

# Install system dependencies including PostgreSQL client libraries
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    curl \
    nodejs \
    socat \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first to leverage Docker layer caching
COPY backend/requirements.txt .

# Install PostgreSQL adapter
RUN pip install --no-cache-dir asyncpg psycopg2-binary

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the backend source code
COPY ./backend/ .

# Copy the nextjs application
COPY --from=frontend-builder --chown=nobody /app/.next/standalone ./
COPY --from=frontend-builder --chown=nobody /app/.next/static ./.next/static

COPY ./scripts ./scripts
