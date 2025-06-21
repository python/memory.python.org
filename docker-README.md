# Docker Setup for Memory Tracker

This Docker Compose configuration brings up the entire Memory Tracker application with PostgreSQL database, FastAPI backend, and Next.js frontend.

## Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+

## Quick Start

1. **Set up environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your GitHub OAuth credentials and admin username
   ```

2. **Build and start all services:**
   ```bash
   docker-compose up --build
   ```

3. **Start in detached mode (background):**
   ```bash
   docker-compose up -d --build
   ```

4. **Access the application:**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000
   - API Documentation: http://localhost:8000/docs
   - PostgreSQL: localhost:5432

## Services

### Database (PostgreSQL)
- **Image:** postgres:15-alpine
- **Port:** 5432
- **Database:** memory_tracker
- **User:** memory_tracker_user
- **Password:** memory_tracker_password
- **Data Volume:** postgres_data

### Backend (FastAPI)
- **Port:** 8000
- **Health Check:** http://localhost:8000/health
- **Environment Variables:**
  - `DATABASE_URL`: PostgreSQL connection string

### Frontend (Next.js)
- **Port:** 3000
- **Environment Variables:**
  - `NEXT_PUBLIC_API_BASE`: Backend API URL

### Database Initialization
- **Service:** db-init
- **Purpose:** Populates the database with default binary configurations
- **Runs:** Once after backend is healthy

## Database Configuration

The application automatically:
1. Creates database tables on first startup
2. Populates default binary configurations (default, debug, etc.)

## Useful Commands

### View logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f db
```

### Restart services
```bash
# All services
docker-compose restart

# Specific service
docker-compose restart backend
```

### Stop and remove everything
```bash
docker-compose down
```

### Stop and remove with volumes (clears database)
```bash
docker-compose down -v
```

### Rebuild specific service
```bash
docker-compose build backend
docker-compose up -d backend
```

## Development

### Environment Variables

The application uses a `.env` file for configuration. Copy the example and customize:

```bash
cp .env.example .env
```

Required variables in `.env`:

```env
# GitHub OAuth Configuration (required for admin authentication)
GITHUB_CLIENT_ID=your_github_oauth_app_client_id
GITHUB_CLIENT_SECRET=your_github_oauth_app_secret
OAUTH_REDIRECT_URI=http://localhost:9002/auth/callback  # for dev
OAUTH_STATE_SECRET=your-random-secret-key

# Admin Authentication (required)
ADMIN_INITIAL_USERNAME=your_github_username

# Legacy team-based auth (optional, deprecated)
ADMIN_GITHUB_ORG=python
ADMIN_GITHUB_TEAMS=memory-python-org
```

**Note:** Development compose file uses port 9002 for frontend, production uses 3000.

### Accessing the Database

```bash
# Connect to PostgreSQL container
docker-compose exec db psql -U memory_tracker_user -d memory_tracker

# Or from host (if psql is installed)
psql -h localhost -p 5432 -U memory_tracker_user -d memory_tracker
```

### Backend Shell Access

```bash
docker-compose exec backend sh
```

### Frontend Shell Access

```bash
docker-compose exec frontend sh
```

## Troubleshooting

### Service won't start
1. Check logs: `docker-compose logs [service-name]`
2. Verify health checks: `docker-compose ps`
3. Restart specific service: `docker-compose restart [service-name]`

### Database connection issues
1. Ensure PostgreSQL is healthy: `docker-compose ps db`
2. Check database logs: `docker-compose logs db`
3. Verify connection string in backend logs

### Frontend can't reach backend
1. Check backend health: `curl http://localhost:8000/health`
2. Verify NEXT_PUBLIC_API_BASE environment variable
3. Check CORS configuration in backend

### Clean slate restart
```bash
# Stop everything and remove volumes
docker-compose down -v

# Remove images (optional)
docker-compose down --rmi all

# Rebuild and start
docker-compose up --build
```

## Production Considerations

For production deployment:

1. **Change default passwords** in environment variables
2. **Use external PostgreSQL** database for persistence
3. **Configure proper CORS** origins for your domain
4. **Set up reverse proxy** (nginx/traefik) for SSL termination
5. **Configure logging** aggregation and monitoring
6. **Use secrets management** for sensitive environment variables

## Architecture

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Frontend  │───▶│   Backend   │───▶│ PostgreSQL  │
│   Next.js   │    │   FastAPI   │    │  Database   │
│   Port 3000 │    │   Port 8000 │    │   Port 5432 │
└─────────────┘    └─────────────┘    └─────────────┘
```

The services communicate through Docker's internal network, with health checks ensuring proper startup order.