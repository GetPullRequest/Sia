# Contributing to Sia

Thank you for your interest in contributing to Sia! We appreciate contributions of all kinds—from bug reports and documentation improvements to new features and code optimizations.

This guide will help you get started with developing Sia locally, understanding the codebase, and submitting your contributions.

## Table of Contents

- [Ways to Contribute](#ways-to-contribute)
- [Before You Start](#before-you-start)
- [Development Setup](#development-setup)
- [Architecture Overview](#architecture-overview)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Commit Guidelines](#commit-guidelines)
- [Submitting Changes](#submitting-changes)
- [Additional Resources](#additional-resources)

## Ways to Contribute

There are many ways to contribute to Sia:

- **Report bugs:** Found an issue? Open a bug report with detailed reproduction steps
- **Suggest features:** Have an idea? Start a discussion or open a feature request
- **Improve documentation:** Help make our docs clearer and more comprehensive
- **Write code:** Pick up an issue or propose a new feature
- **Review PRs:** Help review pull requests from other contributors
- **Share feedback:** Tell us about your experience using Sia

## Before You Start

### Open an Issue First

For significant changes, please **open an issue first** to discuss your proposed changes. This helps ensure:

- Your contribution aligns with the project's goals and roadmap
- You don't duplicate work that's already in progress
- You get early feedback on your approach

For small changes like typo fixes or minor improvements, feel free to submit a PR directly.

### Code of Conduct

This project adheres to a code of conduct that all contributors are expected to follow. Please be respectful, constructive, and inclusive in all interactions.

## Development Setup

### Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18+ recommended)
- **npm** (comes with Node.js)
- **Docker & Docker Compose** (recommended for easiest setup)
- **PostgreSQL** (if running without Docker)
- **Git**

### Fork and Clone

1. Fork the repository on GitHub
2. Clone your fork:
   ```sh
   git clone https://github.com/your-username/sia.git
   cd sia
   ```
3. Add the upstream remote:
   ```sh
   git remote add upstream https://github.com/getpullrequest/sia.git
   ```

### Option 1: Docker Compose Setup (Recommended)

The easiest way to get started is using Docker Compose, which handles all dependencies automatically.

#### 1. Install Dependencies

```sh
npm install
```

#### 2. Configure Environment Files

Copy the example environment files:

```sh
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.local.example apps/web/.env.local
```

#### 3. Update Configuration

Edit the environment files with your configuration:

**`apps/api/.env`:**

- Database connection strings
- API keys (GitHub, Slack, OpenAI, etc.)
- Authentication settings (PropelAuth)
- gRPC settings

**`apps/web/.env.local`:**

- Authentication configuration
- API endpoint URLs

#### 4. Choose Your Database Setup

Sia supports two database configurations. Choose based on your needs:

**Option 1: Embedded PostgreSQL (Recommended for new contributors)**

Best for getting started quickly without managing a separate database.

```sh
# Start with embedded PostgreSQL
docker-compose -f docker-compose.dev.yml --profile embedded-db up
```

In `apps/api/.env`, set:

```env
DATABASE_URL=postgresql://sia_user:sia_password@postgres:5432/sia_db
```

**Option 2: Existing PostgreSQL (For teams with existing databases)**

Connect to your own PostgreSQL instance. This approach:

- Avoids git conflicts from commenting/uncommenting services
- Lets you use your existing local or remote database
- Keeps your data separate from the Docker environment

```sh
# Start without embedded PostgreSQL
docker-compose -f docker-compose.dev.yml up
```

In `apps/api/.env`, set one of:

```env
# For local database on your host machine (Mac/Windows)
DATABASE_URL=postgresql://your_user:your_password@host.docker.internal:5432/your_database

# For remote database
DATABASE_URL=postgresql://user:pass@your-db-host.com:5432/dbname

# For local database on Linux
DATABASE_URL=postgresql://your_user:your_password@172.17.0.1:5432/your_database
```

**Important:**

- On Mac/Windows Docker Desktop, use `host.docker.internal` to access databases on your host machine
- On Linux, you may need to use your host's IP address (e.g., `172.17.0.1`) or configure Docker differently

This will start:

- **PostgreSQL database** on port 5432 (only if using `--profile embedded-db`)
- **API server** on port 3001
- **Web UI** on port 3000

See [DOCKER_SETUP.md](./DOCKER_SETUP.md) for detailed configuration, troubleshooting, and advanced options.

#### 5. Verify Everything is Running

Check that all services are healthy:

```sh
# View all logs
docker-compose -f docker-compose.dev.yml logs -f

# Check specific service
docker-compose -f docker-compose.dev.yml logs api
```

Access the services:

- Web UI: http://localhost:3000
- API: http://localhost:3001
- PostgreSQL: localhost:5432 (if using embedded database)

#### 6. Stop the Environment

```sh
docker-compose -f docker-compose.dev.yml down

# If using embedded database profile
docker-compose -f docker-compose.dev.yml --profile embedded-db down
```

To remove all data and start fresh:

```sh
docker-compose -f docker-compose.dev.yml down -v

# If using embedded database profile
docker-compose -f docker-compose.dev.yml --profile embedded-db down -v
```

### Option 2: Local Development (Without Docker)

If you prefer running services locally without Docker:

#### 1. Install Dependencies

```sh
npm install
```

#### 2. Set Up PostgreSQL

Ensure PostgreSQL is running locally and create a database for Sia.

#### 3. Configure Environment Files

```sh
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.local.example apps/web/.env.local
```

Update the `.env` files with your local PostgreSQL connection string and other configuration.

#### 4. Run Database Migrations

```sh
npm run db:migrate -w @sia/api
```

#### 5. Start Development Servers

You'll need two terminal windows:

**Terminal 1 - Web UI:**

```sh
npx nx serve @sia/web
# Runs at http://localhost:3000
```

**Terminal 2 - API Server:**

```sh
npx nx serve @sia/api
# Runs at http://localhost:3001
```

**Note:** If authentication is configured, localhost endpoints may not work properly. Consider using ngrok for local development with auth enabled.

## Architecture Overview

Understanding Sia's architecture will help you contribute more effectively.

### System Architecture

Sia is built as a distributed system with the following components:

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Interfaces                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Slack Bot    │  │ Discord Bot  │  │ Web Dashboard│          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                  │                  │                   │
│         └──────────────────┴──────────────────┘                   │
│                            │                                      │
└────────────────────────────┼──────────────────────────────────────┘
                             │
                             ▼
                ┌────────────────────────┐
                │    Backend Server      │
                │  - REST API (Fastify)  │
                │  - WebSocket (logs)    │
                │  - gRPC Server         │
                │  - Temporal Workflows  │
                └────┬──────────────┬────┘
                     │              │
         ┌───────────┴──┐      ┌────┴──────────┐
         │              │      │                │
         ▼              ▼      ▼                ▼
    ┌────────┐    ┌──────────┐           ┌─────────┐
    │PostGres│    │ Temporal │           │ gRPC    │
    │   DB   │    │  Queue   │           │ Clients │
    └────────┘    └──────────┘           └────┬────┘
                                              │
                                              ▼
                                     ┌─────────────────┐
                                     │   AI Agents     │
                                     │ (Cloud VMs)     │
                                     │ - Code writing  │
                                     │ - Test running  │
                                     │ - PR creation   │
                                     └─────────────────┘
```

### Component Responsibilities

| Component          | Purpose                                              | Technology               |
| ------------------ | ---------------------------------------------------- | ------------------------ |
| **Chat Bots**      | Task submission interface for Slack/Discord          | Bot APIs                 |
| **Web Dashboard**  | Monitor queue, view logs, manage tasks               | Next.js, TailwindCSS     |
| **Backend Server** | Orchestrates jobs, manages state, coordinates agents | Fastify, gRPC            |
| **Database**       | Stores jobs, users, configurations, logs             | PostgreSQL + Drizzle ORM |
| **Temporal**       | Manages long-running workflows and task queue        | Temporal workflows       |
| **AI Agents**      | Executes coding tasks on isolated cloud VMs          | Claude Code, gRPC client |

### Data Flow

1. **Task Submission:** User submits task via Slack, Discord, or Web UI
2. **Job Creation:** Backend creates a job record in PostgreSQL
3. **Queue Management:** Temporal workflow queues the job
4. **Agent Assignment:** Available agent picks up the job via gRPC
5. **Execution:** Agent writes code, runs tests, fixes issues autonomously
6. **PR Creation:** Agent creates pull request on GitHub
7. **Notification:** User receives notification with PR link

## Project Structure

This is an Nx monorepo with the following structure:

```
sia/
├── apps/
│   ├── web/              # Next.js frontend (desktop/tablet only, 768px+)
│   ├── api/              # Fastify backend + gRPC server
│   ├── agent/            # AI agent that runs on cloud dev machines
│   ├── cli/              # Command line interface
│   └── landing-page/     # Marketing landing page
├── libs/
│   └── models/           # Shared types, protobuf, OpenAPI client
└── ...
```

### Workspace Structure

- **`apps/web`** - Next.js frontend (desktop/tablet only, 768px+)
- **`apps/api`** - Fastify backend + gRPC server
- **`apps/agent`** - AI agent that runs on cloud dev machines
- **`apps/cli`** - Command line interface
- **`libs/models`** - Shared types, protobuf, OpenAPI client

### Tech Stack

| Layer         | Technology                                      |
| ------------- | ----------------------------------------------- |
| **Monorepo**  | Nx                                              |
| **Frontend**  | Next.js, TailwindCSS, shadcn/ui, TanStack Query |
| **Backend**   | Fastify (REST), WebSocket (logs), gRPC (agents) |
| **Database**  | PostgreSQL + Drizzle ORM                        |
| **Workflows** | Temporal                                        |
| **Auth**      | PropelAuth                                      |

### Detailed Architecture Documentation

Comprehensive architecture documentation, design specifications, and requirements for all components are available in [`.kiro/specs/`](../.kiro/specs/):

| Directory                        | Description                                                |
| -------------------------------- | ---------------------------------------------------------- |
| **`sia-platform/`**              | Platform architecture, requirements, and high-level design |
| **`api-server/`**                | Backend API server design and implementation details       |
| **`web-frontend/`**              | Web frontend specifications and requirements               |
| **`sia-agent/`**                 | SIA agent architecture and implementation                  |
| **`cli-app/`**                   | CLI application design and requirements                    |
| **`chat-platform-integration/`** | Slack/Discord integration specifications                   |
| **`temporal-task-queue/`**       | Temporal workflow system design                            |
| **`shared-models/`**             | Shared data models and type definitions                    |

Each component directory contains:

- `design.md` - Detailed design and architecture
- `requirements.md` - Functional and non-functional requirements
- `tasks.md` - Implementation tasks and checklists

## Development Workflow

### Common Development Tasks

#### Running Individual Applications

**Web UI:**

```sh
npx nx serve @sia/web
# or
npx nx dev @sia/web
```

**API Server:**

```sh
npx nx serve @sia/api
```

#### Building for Production

**Build specific project:**

```sh
npx nx build @sia/web
npx nx build @sia/api
```

**Build all projects:**

```sh
npx nx run-many --target=build --all
```

#### Database Operations

**Generate a new migration:**

```sh
npm run db:generate -w @sia/api -- --name={migration_name}
```

**Run migrations:**

```sh
npm run db:migrate -w @sia/api
```

#### Nx Workspace Commands

| Command                               | Description                              |
| ------------------------------------- | ---------------------------------------- |
| `npx nx graph`                        | Visualize project dependencies           |
| `npx nx show project <name>`          | Show all available targets for a project |
| `npx nx run-many --target=lint --all` | Lint all projects                        |
| `npx nx run-many --target=test --all` | Test all projects                        |

#### Type Checking

**Check types for API:**

```sh
npx nx typecheck @sia/api
```

#### Testing

**Run tests for specific project:**

```sh
npx nx test @sia/web
npx nx test @sia/api
```

**Run all tests:**

```sh
npx nx run-many --target=test --all
```

## Coding Standards

### Quick Rules

- Use strict TypeScript everywhere - avoid `any`/`unknown`
- Never edit files in `generated/` folders (they are auto-generated)
- Run `npm run build:all` after changes to verify everything compiles
- Check `.kiro/steering/` for detailed frontend/backend guidelines
- Follow [Conventional Commits](https://www.conventionalcommits.org/) for commit messages

### TypeScript

- Always use strict TypeScript
- Avoid `any` and `unknown` types
- Use proper type definitions for all functions and variables
- Leverage TypeScript's type inference where appropriate

### Code Formatting

We use Prettier for code formatting and ESLint for linting. Formatting is automatically applied on commit, but you can also format manually:

**Format all files:**

```sh
npm run format
```

**Check formatting (without modifying files):**

```sh
npm run format:check
```

**Fix all linting issues:**

```sh
npm run lint:fix
```

**One-shot command to fix all styling and linting:**

```sh
npm run style:fix
```

This command will:

1. Format all files with Prettier (TypeScript, JavaScript, CSS, JSON, Markdown, YAML, HTML, etc.)
2. Fix all ESLint issues across all projects in the monorepo

### Linting

Run linting for specific projects:

```sh
npx nx lint @sia/web
npx nx lint @sia/api
```

Lint all projects:

```sh
npx nx run-many --target=lint --all
```

## Managing Dependencies

This workspace uses **npm workspaces** for dependency management.

### Recommendation: Add project-specific dependencies to the project's `package.json`

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

# Add shared dev dependency
npm install <package-name> -D -w .
```

**Examples of root-level dependencies:**

- Build tools (`@nx/next`, `@nx/js`)
- Testing frameworks (`jest`, `@testing-library/react`)
- Linting tools (`eslint`, `prettier`)
- TypeScript (`typescript`, `@types/node`)

### Summary

| Dependency Type          | Location                      | Command                                  |
| ------------------------ | ----------------------------- | ---------------------------------------- |
| Project-specific runtime | `apps/<project>/package.json` | `npm install <pkg> -w apps/<project>`    |
| Project-specific dev     | `apps/<project>/package.json` | `npm install <pkg> -D -w apps/<project>` |
| Shared runtime           | Root `package.json`           | `npm install <pkg> -w .`                 |
| Shared dev tools         | Root `package.json`           | `npm install <pkg> -D -w .`              |

## Commit Guidelines

This project uses [Conventional Commits](https://www.conventionalcommits.org/) to maintain a clean and consistent commit history.

### Making Commits

Use Commitizen to create properly formatted commits:

```sh
npm run commit
```

To amend the previous commit:

```sh
npm run commit -- --amend
```

You can also pass any other git commit flags:

```sh
npm run commit -- --amend --no-edit  # Amend without changing the message
npm run commit -- -S                 # Sign the commit
```

This will guide you through creating a commit message that follows the conventional commit format:

- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation only changes
- `style`: Changes that do not affect the meaning of the code (white-space, formatting, etc.)
- `refactor`: A code change that neither fixes a bug nor adds a feature
- `perf`: A code change that improves performance
- `test`: Adding missing tests or correcting existing tests
- `build`: Changes that affect the build system or external dependencies
- `ci`: Changes to CI configuration files and scripts
- `chore`: Other changes that don't modify src or test files
- `revert`: Reverts a previous commit

### Pre-commit Hooks

This project uses [Husky](https://typicode.github.io/husky/) to run pre-commit hooks that:

- **Lint staged files** - Automatically runs ESLint on staged TypeScript/JavaScript files
- **Format code** - Automatically formats staged files with Prettier
- **Validate commit messages** - Ensures commit messages follow the conventional commit format

These hooks run automatically when you commit. If any checks fail, the commit will be blocked until issues are resolved.

### Manual Commit (Advanced)

If you need to commit without using Commitizen, ensure your commit message follows this format:

```
<type>(<scope>): <subject>

[optional body]

[optional footer(s)]
```

Example:

```
feat(api): add user authentication endpoint

Implements JWT-based authentication for the API server.
Closes #123
```

## Changelog Generation

This project uses [standard-version](https://github.com/conventional-changelog/standard-version) to automatically generate changelogs and version bumps based on conventional commits.

### Generating a Release

To create a new release and update the changelog:

```sh
# Patch release (0.0.1 -> 0.0.2)
npm run release:patch

# Minor release (0.0.1 -> 0.1.0)
npm run release:minor

# Major release (0.0.1 -> 1.0.0)
npm run release:major

# Auto-detect version bump based on commits
npm run release
```

This will:

1. Update the version in `package.json`
2. Generate/update `CHANGELOG.md` based on conventional commits
3. Create a git tag for the release
4. Create a commit with the version bump and changelog

After running the release command, push the changes and tags:

```sh
git push --follow-tags origin main
```

### Changelog Format

The changelog is automatically organized by commit type:

- **Features** - New features
- **Bug Fixes** - Bug fixes
- **Documentation** - Documentation changes
- **Code Refactoring** - Code refactoring
- **Performance Improvements** - Performance improvements
- **Tests** - Test changes
- **Build System** - Build system changes
- **Continuous Integration** - CI changes
- **Chores** - Other changes

## Submitting Changes

### Pull Request Process

1. **Create a branch** from `main`:

   ```sh
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** following the coding standards

3. **Test your changes**:

   ```sh
   npm run build:all
   npm run style:fix
   ```

4. **Commit your changes** using the commit guidelines:

   ```sh
   npm run commit
   ```

5. **Push to your fork**:

   ```sh
   git push origin feature/your-feature-name
   ```

6. **Create a Pull Request** on GitHub with:
   - A clear title and description
   - Reference to any related issues
   - Screenshots or examples if applicable

### Pull Request Guidelines

- Keep PRs focused on a single feature or fix
- Ensure all tests pass
- Update documentation as needed
- Follow the commit message conventions
- Request review from maintainers

## Additional Resources

- **Nx Documentation:** [nx.dev](https://nx.dev)
- **Conventional Commits:** [conventionalcommits.org](https://www.conventionalcommits.org/)
- **Project Guidelines:** Check `.kiro/steering/` for detailed frontend/backend guidelines
- **Architecture Specifications:** See [`.kiro/specs/`](../.kiro/specs/) for comprehensive architecture documentation, design documents, and requirements for all platform components

## Questions?

If you have questions or need help, please:

1. Join our [Discord community](https://discord.gg/U4kzxjBv) for real-time discussions and support
2. Check the existing documentation
3. Search existing issues and discussions
4. Open a new issue with your question

Thank you for contributing to Sia! 🚀
