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

## Database Configuration Options

Sia supports two database configurations:

### Option 1: Embedded PostgreSQL (Default for Development)

Uses a PostgreSQL container managed by Docker Compose. Good for local development.

```bash
# Start with embedded database
docker-compose -f docker-compose.dev.yml --profile embedded-db up
```

In your `.env` or `apps/api/.env`:

```env
DATABASE_URL=postgresql://sia_user:sia_password@postgres:5432/sia_db
```

### Option 2: External PostgreSQL (For Existing Databases)

Connect to an existing PostgreSQL database (local or remote). Avoids git conflicts from commenting/uncommenting services.

```bash
# Start without embedded database
docker-compose -f docker-compose.dev.yml up
```

In your `.env` or `apps/api/.env`:

```env
# For local database on your host machine
DATABASE_URL=postgresql://your_user:your_password@host.docker.internal:5432/your_database

# For remote database
DATABASE_URL=postgresql://user:pass@your-db-host.com:5432/dbname
```

**Note:** When connecting to a database on your host machine from Docker, use `host.docker.internal` as the hostname (works on Docker Desktop for Mac/Windows). On Linux, you may need to use your host's IP address.

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
# With embedded PostgreSQL
docker-compose -f docker-compose.dev.yml --profile embedded-db up

# With external PostgreSQL (set DATABASE_URL in .env)
docker-compose -f docker-compose.dev.yml up
```

### Start in Background

```bash
# With embedded PostgreSQL
docker-compose -f docker-compose.dev.yml --profile embedded-db up -d

# With external PostgreSQL
docker-compose -f docker-compose.dev.yml up -d
```

### View Logs

```bash
# All services
docker-compose -f docker-compose.dev.yml logs -f

# Specific service
docker-compose -f docker-compose.dev.yml logs -f api
docker-compose -f docker-compose.dev.yml logs -f web

# PostgreSQL (only when using embedded-db profile)
docker-compose -f docker-compose.dev.yml --profile embedded-db logs -f postgres
```

### Stop Containers

```bash
# Without removing volumes
docker-compose -f docker-compose.dev.yml down

# If using embedded-db profile
docker-compose -f docker-compose.dev.yml --profile embedded-db down
```

### Clean Reset (Remove All Data)

```bash
# Remove containers, networks, and volumes (including database data)
docker-compose -f docker-compose.dev.yml down -v

# If using embedded-db profile
docker-compose -f docker-compose.dev.yml --profile embedded-db down -v
```

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

**If using embedded PostgreSQL:**

Check if PostgreSQL is running:

```bash
docker-compose -f docker-compose.dev.yml --profile embedded-db logs postgres
```

Reset the database:

```bash
docker-compose -f docker-compose.dev.yml --profile embedded-db down -v
docker-compose -f docker-compose.dev.yml --profile embedded-db up
```

**If using external PostgreSQL:**

1. Verify your `DATABASE_URL` in `.env` is correct
2. Ensure the database server is accessible from Docker:
   ```bash
   # Test connection from your host first
   psql -h your-db-host -U your-user -d your-database
   ```
3. If connecting to a local database, use `host.docker.internal` as the hostname
4. Check firewall rules and database server configuration (e.g., `pg_hba.conf`)

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

## Production Deployment

### Dockerfile vs Dockerfile.prod

The repository includes two types of Dockerfiles for different environments:

#### Development Dockerfiles (`apps/*/Dockerfile`)

Used for local development with Docker Compose:

- **NODE_ENV**: `development`
- **Dependencies**: Includes dev dependencies (`npm ci --ignore-scripts`)
- **Execution**: Uses `tsx` for running TypeScript directly (hot reload support)
- **Size**: Larger image size due to dev dependencies
- **Use case**: Local development with hot reload

#### Production Dockerfiles (`apps/*/Dockerfile.prod`)

Optimized for production deployment (Cloud Run, Kubernetes, etc.):

- **NODE_ENV**: `production`
- **Dependencies**: Production only (`npm ci --omit=dev`)
- **Execution**: Runs compiled JavaScript (`node dist/main.js`)
- **Optimization**: Removes npm cache and temp files (`rm -rf /tmp/* /root/.npm`)
- **Size**: Smaller image size (~30-40% reduction)
- **Use case**: Production deployments

**Note:** Currently, only `apps/api/Dockerfile.prod` exists. For the web app, the development Dockerfile can be used for production, but you may want to create `apps/web/Dockerfile.prod` with similar optimizations.

#### Key Differences

| Aspect       | Development (`Dockerfile`) | Production (`Dockerfile.prod`)   |
| ------------ | -------------------------- | -------------------------------- |
| NODE_ENV     | `development`              | `production`                     |
| Dependencies | All dependencies           | Production only (`--omit=dev`)   |
| Runtime      | `npx tsx dist/main.js`     | `node dist/main.js`              |
| Cleanup      | Basic (`/tmp/*`)           | Aggressive (`/tmp/* /root/.npm`) |
| Image Size   | ~800MB                     | ~500MB                           |
| Use Case     | Local development          | Production deployment            |

### Cloud Run Deployment

Google Cloud Run requires specific Dockerfile configurations. **Always use `Dockerfile.prod`** for Cloud Run deployments.

#### Cloud Run Requirements

1. **Use Production Dockerfile**

   ```bash
   # Build for Cloud Run (from repository root)

   # API (production Dockerfile available)
   docker build -f apps/api/Dockerfile.prod -t gcr.io/PROJECT_ID/sia-api .

   # Web (use development Dockerfile for now, or create Dockerfile.prod)
   docker build -f apps/web/Dockerfile -t gcr.io/PROJECT_ID/sia-web .
   ```

2. **Port Configuration**

   - Cloud Run injects the `PORT` environment variable
   - API already listens on `process.env.PORT || 3001` (apps/api/Dockerfile.prod:27)
   - Web listens on Next.js default port 3000

3. **Health Checks**

   - Cloud Run automatically health checks your service
   - Ensure your API has a health endpoint (e.g., `/health` or `/`)

4. **Environment Variables**

   - Set `DATABASE_URL` to your Cloud SQL or external PostgreSQL instance
   - Configure all required environment variables in Cloud Run service settings
   - Never embed secrets in the Docker image

5. **Database Connection**
   - Use Cloud SQL Proxy sidecar for Cloud SQL connections
   - Or connect directly using public IP with SSL
   - Set `DATABASE_URL` via Cloud Run environment variables

#### Example Cloud Run Deployment

```bash
# Build and push API
docker build -f apps/api/Dockerfile.prod -t gcr.io/PROJECT_ID/sia-api .
docker push gcr.io/PROJECT_ID/sia-api

# Deploy to Cloud Run
gcloud run deploy sia-api \
  --image gcr.io/PROJECT_ID/sia-api \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars "DATABASE_URL=postgresql://user:pass@HOST:5432/sia_db" \
  --set-env-vars "NODE_ENV=production" \
  --memory 2Gi \
  --cpu 2 \
  --max-instances 10

# Build and push Web (no Dockerfile.prod yet, using regular Dockerfile)
docker build -f apps/web/Dockerfile -t gcr.io/PROJECT_ID/sia-web .
docker push gcr.io/PROJECT_ID/sia-web

# Deploy to Cloud Run
gcloud run deploy sia-web \
  --image gcr.io/PROJECT_ID/sia-web \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars "NEXT_PUBLIC_SIA_BACKEND_URL=https://sia-api-xxx.run.app" \
  --memory 1Gi \
  --cpu 1 \
  --max-instances 5
```

#### Cloud Run Best Practices

1. **Always use `Dockerfile.prod`** - Never deploy development Dockerfiles to production
2. **Set resource limits** - Configure appropriate CPU and memory limits
3. **Use Cloud SQL** - For managed PostgreSQL with automatic backups
4. **Enable Cloud CDN** - For serving static assets from the web frontend
5. **Use Secret Manager** - Store sensitive values (API keys, database passwords) in Google Secret Manager
6. **Configure autoscaling** - Set min/max instances based on expected load
7. **Enable logging** - Cloud Run automatically captures stdout/stderr to Cloud Logging

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
