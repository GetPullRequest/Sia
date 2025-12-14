# Docker Setup Guide

This guide covers running Sia using Docker Compose for local development.

## Quick Start

```bash
# Copy environment files from examples
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.local.example apps/web/.env.local

# Update configuration with your values
nano apps/api/.env
nano apps/web/.env.local

# Start containers
docker-compose -f docker-compose.dev.yml up
```

Access the application:

- Web UI: http://localhost:3000
- API: http://localhost:3001
- PostgreSQL: localhost:5432

## Environment Configuration

### API Configuration (`apps/api/.env`)

Copy from `apps/api/.env.example` and update:

```env
# Database
DATABASE_URL=postgresql://sia_user:sia_password@postgres:5432/sia_db

# Authentication
PROPEL_AUTH_URL=https://your-propelauth-instance.propelauthtest.com

# CORS (loaded from env file, not derived from docker-compose)
ALLOWED_ORIGINS=https://your-propelauth-instance.propelauthtest.com,http://localhost:3000

# GitHub App credentials
GITHUB_APP_ID=your_app_id
GITHUB_APP_PRIVATE_KEY=your_private_key
GITHUB_APP_SLUG=your_app_slug

# Slack integration
SLACK_CLIENT_ID=your_client_id
SLACK_CLIENT_SECRET=your_client_secret
# ... other Slack and service credentials
```

### Web Configuration (`apps/web/.env.local`)

Copy from `apps/web/.env.local.example` and update:

```env
NEXT_PUBLIC_AUTH_URL=https://your-propelauth-instance.propelauthtest.com
NEXT_PUBLIC_SIA_BACKEND_URL=http://localhost:3001
NEXT_PUBLIC_FRONT_END_URL=http://localhost:3000
```

## Dependency Management

Each module (API and Web) is self-contained with its own `.env.example` file.

### Adding Dependencies

When you add dependencies to `apps/api/package.json` or `apps/web/package.json`:

1. **Update the lock file locally:**

   ```bash
   npm install
   ```

   This updates `package-lock.json` to include the new dependencies.

2. **Restart containers:**
   ```bash
   docker-compose -f docker-compose.dev.yml down
   docker-compose -f docker-compose.dev.yml up
   ```

The containers will install dependencies from the updated `package-lock.json`.

**Important:** Always run `npm install` after adding/updating dependencies in `package.json` files. Failing to do so will cause Docker to fail with dependency mismatch errors.

## Common Commands

### Start Development Environment

```bash
docker-compose -f docker-compose.dev.yml up
```

### Start in Background

```bash
docker-compose -f docker-compose.dev.yml up -d
```

### View Logs

```bash
# All services
docker-compose -f docker-compose.dev.yml logs -f

# Specific service
docker-compose -f docker-compose.dev.yml logs -f api
docker-compose -f docker-compose.dev.yml logs -f web
docker-compose -f docker-compose.dev.yml logs -f postgres
```

### Stop Containers

```bash
docker-compose -f docker-compose.dev.yml down
```

### Clean Reset (Remove All Data)

```bash
docker-compose -f docker-compose.dev.yml down -v
```

This removes containers, networks, and volumes (including database data).

### Rebuild Images

```bash
docker-compose -f docker-compose.dev.yml up --build
```

## Troubleshooting

### "Package mismatch" or "Missing from lock file" Error

**Cause:** You modified `package.json` but didn't update `package-lock.json`

**Solution:**

```bash
# Stop containers
docker-compose -f docker-compose.dev.yml down

# Update lock file
npm install

# Restart containers
docker-compose -f docker-compose.dev.yml up
```

### Database Connection Issues

**Check if PostgreSQL is running:**

```bash
docker-compose -f docker-compose.dev.yml logs postgres
```

**Reset the database:**

```bash
docker-compose -f docker-compose.dev.yml down -v
docker-compose -f docker-compose.dev.yml up
```

### Port Already in Use

If ports 3000, 3001, or 5432 are already in use:

1. **Find what's using the port:**

   ```bash
   lsof -i :3000    # For port 3000
   lsof -i :3001    # For port 3001
   lsof -i :5432    # For PostgreSQL
   ```

2. **Either:**
   - Stop the other service
   - Or modify `docker-compose.dev.yml` to use different ports

### API Can't Connect to Database

**Ensure containers can communicate:**

```bash
docker-compose -f docker-compose.dev.yml down
docker-compose -f docker-compose.dev.yml up
```

Check the API logs:

```bash
docker-compose -f docker-compose.dev.yml logs api
```

## Architecture

The `docker-compose.dev.yml` sets up:

- **dependencies**: Installs npm packages once (shared between api and web)
- **postgres**: PostgreSQL 16 database with persistence
- **api**: Node.js development server for the API
- **web**: Node.js development server for the web UI

All services run with:

- Source code mounted for hot-reload
- Environment variables loaded from `.env` files
- All containers on the `sia-network` bridge network

## Development Workflow

1. Make changes to code
2. Changes are automatically reflected in containers (hot-reload)
3. Check logs if needed: `docker-compose -f docker-compose.dev.yml logs -f api`
4. Restart individual service if needed: `docker-compose -f docker-compose.dev.yml restart api`

## Module Structure

```
Sia/
├── apps/
│   ├── api/
│   │   ├── .env              # ← Copy from .env.example, add your values
│   │   ├── .env.example      # ← Reference for required variables
│   │   └── ...
│   ├── web/
│   │   ├── .env.local        # ← Copy from .env.local.example, add your values
│   │   ├── .env.local.example # ← Reference for required variables
│   │   └── ...
│   └── ...
├── docker-compose.dev.yml    # ← Development docker compose
└── ...
```

Each module is independently buildable and self-contained with its own configuration.
