.PHONY: help install install-backend install-frontend dev dev-backend dev-frontend test test-backend clean init-db populate-db reset-db build

# Default target
help:
	@echo "Available commands:"
	@echo "  install          - Install all dependencies (frontend + backend)"
	@echo "  install-backend  - Install backend dependencies"
	@echo "  install-frontend - Install frontend dependencies"
	@echo "  dev              - Start both frontend and backend in development mode"
	@echo "  dev-backend      - Start backend development server"
	@echo "  dev-frontend     - Start frontend development server"
	@echo "  test             - Run all tests"
	@echo "  test-backend     - Run backend tests"
	@echo "  init-db          - Initialize the database with schema"
	@echo "  populate-db      - Populate database with mock data"
	@echo "  reset-db         - Reset database (drop and recreate)"
	@echo "  clean            - Clean up generated files"
	@echo "  build            - Build frontend for production"

# Installation targets
install: install-backend install-frontend

install-backend:
	@echo "Installing backend dependencies..."
	cd backend && pip install -r requirements.txt

install-frontend:
	@echo "Installing frontend dependencies..."
	cd frontend && npm install

# Development targets
dev:
	@echo "Starting both frontend and backend..."
	@make -j2 dev-backend dev-frontend

dev-backend:
	@echo "Starting backend development server..."
	cd backend && python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 --log-level info

dev-frontend:
	@echo "Starting frontend development server..."
	cd frontend && npm run dev

# Testing targets
test: test-backend

test-backend:
	@echo "Running backend tests..."
	cd backend && python -m pytest tests/ -v

# Database targets
init-db:
	@echo "Initializing database..."
	cd backend && python -c "import asyncio; from app.database import create_tables; asyncio.run(create_tables())"

populate-db:
	@echo "Populating database with mock data..."
	cd backend && python scripts/populate_db.py

reset-db:
	@echo "Resetting database..."
	rm -f backend/memory_tracker.db
	@make init-db
	@make populate-db

# Utility targets
clean:
	@echo "Cleaning up..."
	rm -f backend/memory_tracker.db
	rm -rf backend/__pycache__/
	rm -rf backend/app/__pycache__/
	rm -rf frontend/.next/
	rm -rf frontend/node_modules/.cache/

build:
	@echo "Building frontend for production..."
	cd frontend && npm run build

# Setup targets for new development environment
setup: install init-db populate-db
	@echo "Setup complete! Run 'make dev' to start development servers."
