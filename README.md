# <a alt="Sia logo" href="https://getpullrequest.com" target="_blank" rel="noreferrer"><img src="apps/landing-page/public/favicon.svg" width="40"></a> Sia

> ⚠️ **Pre-alpha** - This project is under active development and not ready for production use.

Sia is an AI Developer Assistant that automates small, well-defined coding tasks and creates ready-to-review Pull Requests (PRs) while the human developer is offline or sleeping.

## Tech Stack

| Layer | Tech |
|-------|------|
| Monorepo | Nx |
| Frontend | Next.js, TailwindCSS, shadcn/ui, TanStack Query |
| Backend | Fastify (REST), WebSocket (logs), gRPC (agents) |
| Database | PostgreSQL + Drizzle ORM |
| Workflows | Temporal |
| Auth | PropelAuth |

## Workspace Structure

- **`apps/web`** - Next.js frontend (desktop/tablet only, 768px+)
- **`apps/api`** - Fastify backend + gRPC server
- **`apps/agent`** - AI agent that runs on cloud dev machines
- **`apps/cli`** - Command line interface
- **`libs/models`** - Shared types, protobuf, OpenAPI client

## Quick Rules

- Use strict TypeScript everywhere - avoid `any`/`unknown`
- Never edit files in `generated/` folders
- Run `npm run build:all` after changes to verify everything compiles
- Check `.kiro/steering/` for detailed frontend/backend guidelines

## Prerequisites

- Node.js (v18+ recommended)
- npm

## Getting Started

### Install Dependencies

```sh
npm install
```

## Managing Dependencies

This workspace uses **npm workspaces** for dependency management. Here's the recommended approach:

### **Recommendation: Add project-specific dependencies to the project's `package.json`**

For dependencies that are specific to a single project (like `@tanstack/react-query` for the web app, or `fastify` for the API), add them to the project's own `package.json` file.

**Why?**
- Keeps dependencies scoped to where they're used
- Makes it clear which project uses which dependencies
- Better for code splitting and bundle optimization
- Easier to maintain and understand project boundaries

### Adding Dependencies

#### Add to a specific project (Recommended)

Use the `-w` (workspace) flag to add dependencies to a specific project:

```sh
# Add to web app
npm install <package-name> -w apps/web

# Add to API server
npm install <package-name> -w apps/api

# Add as dev dependency
npm install <package-name> -D -w apps/web
```

**Examples:**
```sh
# Add TanStack Query to web app
npm install @tanstack/react-query -w apps/web

# Add a dev dependency to API
npm install @types/node -D -w apps/api
```

#### Add to root (for shared dependencies)

Only add dependencies to the root `package.json` if they're shared across multiple projects or are workspace-level tools:

```sh
# Add shared dependency
npm install <package-name> -w .

# Add shared dev dependency-
npm install <package-name> -D -w .
```

**Examples of root-level dependencies:**
- Build tools (`@nx/next`, `@nx/js`)
- Testing frameworks (`jest`, `@testing-library/react`)
- Linting tools (`eslint`, `prettier`)
- TypeScript (`typescript`, `@types/node`)

### Summary

| Dependency Type | Location | Command |
|----------------|----------|---------|
| Project-specific runtime | `apps/<project>/package.json` | `npm install <pkg> -w apps/<project>` |
| Project-specific dev | `apps/<project>/package.json` | `npm install <pkg> -D -w apps/<project>` |
| Shared runtime | Root `package.json` | `npm install <pkg> -w .` |
| Shared dev tools | Root `package.json` | `npm install <pkg> -D -w .` |

## Running Applications

### Run Web Application (Frontend)

Start the Next.js development server:

```sh
npx nx serve @sia/web
```

or

```sh
npx nx dev @sia/web
```

The web app will be available at [http://localhost:3000](http://localhost:3000)

after authentication added the auth is not work on localhost endpoint for that case use ngrok for development.

### Run API Server (Backend)

Start the Fastify API server:

```sh
npx nx serve @sia/api
```

The API server will be available at [http://localhost:3001](http://localhost:3001)

### Run Both Applications Simultaneously

Open two terminal windows and run each command:

**Terminal 1:**
```sh
npx nx serve @sia/web
```

**Terminal 2:**
```sh
npx nx serve @sia/api
```

Alternatively, you can use a process manager like `concurrently`:

```sh
npx concurrently "nx serve @sia/web" "nx serve @sia/api"
```

## Available Commands

### Web Application (`@sia/web`)

| Command | Description |
|---------|-------------|
| `npx nx serve @sia/web` | Start development server |
| `npx nx dev @sia/web` | Start development server (alias) |
| `npx nx build @sia/web` | Build for production |
| `npx nx start @sia/web` | Start production server (requires build first) |
| `npx nx lint @sia/web` | Run ESLint |
| `npx nx test @sia/web` | Run tests |

### API Server (`@sia/api`)

| Command | Description |
|---------|-------------|
| `npx nx serve @sia/api` | Start development server |
| `npx nx build @sia/api` | Build for production |
| `npx nx lint @sia/api` | Run ESLint |
| `npx nx typecheck @sia/api` | Run TypeScript type checking |
npx nx run-many --target=build --all
### General Commands

| Command | Description |
|---------|-------------|
| `npx nx graph` | Visualize project dependencies |
| `npx nx show project <project-name>` | Show all available targets for a project |
| `` | Build all projects |
| `npx nx run-many --target=lint --all` | Lint all projects |
| `npx nx run-many --target=test --all` | Test all projects |

### DB Migration Commands
`npm run db:generate -w @sia/api -- --name={name of migration}`
`npm run db:migrate -w @sia/api`

## API Endpoints

The Fastify API server includes:

- `GET /` - Hello world endpoint returning `{ hello: 'world' }`

## Building for Production

### Build Web Application

```sh
npx nx build @sia/web
```

### Build API Server

```sh
npx nx build @sia/api
```

### Build All Projects

```sh
npx nx run-many --target=build --all
```

## Development

### Type Checking

```sh
npx nx typecheck @sia/api
```

### Linting

```sh
npx nx lint @sia/web
npx nx lint @sia/api
```

### Testing

```sh
npx nx test @sia/web
```

