# Contributing to Sia

Thank you for your interest in contributing to Sia! This document provides guidelines and instructions for contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Coding Standards](#coding-standards)
- [Commit Guidelines](#commit-guidelines)
- [Testing](#testing)
- [Submitting Changes](#submitting-changes)

## Code of Conduct

This project adheres to a code of conduct that all contributors are expected to follow. Please be respectful and constructive in all interactions.

## Getting Started

### Prerequisites

- Node.js (v18+ recommended)
- npm
- PostgreSQL (for backend development)
- Git

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

## Development Setup

### Install Dependencies

```sh
npm install
```

### Environment Configuration

1. Copy the example environment file:

   ```sh
   cp .env.example .env
   ```

2. Edit `.env` with your local configuration:
   - Database connection strings
   - API keys for integrations
   - Authentication settings

### Running Applications

#### Web Application (Frontend)

```sh
npx nx serve @sia/web
```

or

```sh
npx nx dev @sia/web
```

The web app will be available at [http://localhost:3000](http://localhost:3000)

> **Note:** After authentication is added, auth may not work on localhost endpoints. Use ngrok for development in that case.

#### API Server (Backend)

```sh
npx nx serve @sia/api
```

The API server will be available at [http://localhost:3001](http://localhost:3001)

#### Run Both Applications Simultaneously

**Option 1: Separate Terminals**

Terminal 1:

```sh
npx nx serve @sia/web
```

Terminal 2:

```sh
npx nx serve @sia/api
```

**Option 2: Using concurrently**

```sh
npx concurrently "nx serve @sia/web" "nx serve @sia/api"
```

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

### Architecture Specifications

Detailed architecture documentation, design specifications, and requirements for all components are available in [`.kiro/specs/`](../.kiro/specs/):

- **`sia-platform/`** - Platform architecture, requirements, and high-level design
- **`api-server/`** - Backend API server design and implementation details
- **`web-frontend/`** - Web frontend specifications and requirements
- **`sia-agent/`** - SIA agent architecture and implementation
- **`cli-app/`** - CLI application design and requirements
- **`chat-platform-integration/`** - Slack/Discord integration specifications
- **`temporal-task-queue/`** - Temporal workflow system design
- **`shared-models/`** - Shared data models and type definitions

Each component directory contains:

- `design.md` - Detailed design and architecture
- `requirements.md` - Functional and non-functional requirements
- `tasks.md` - Implementation tasks and checklists

## Tech Stack

| Layer     | Tech                                            |
| --------- | ----------------------------------------------- |
| Monorepo  | Nx                                              |
| Frontend  | Next.js, TailwindCSS, shadcn/ui, TanStack Query |
| Backend   | Fastify (REST), WebSocket (logs), gRPC (agents) |
| Database  | PostgreSQL + Drizzle ORM                        |
| Workflows | Temporal                                        |
| Auth      | PropelAuth                                      |

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

## Available Commands

### Web Application (`@sia/web`)

| Command                 | Description                                    |
| ----------------------- | ---------------------------------------------- |
| `npx nx serve @sia/web` | Start development server                       |
| `npx nx dev @sia/web`   | Start development server (alias)               |
| `npx nx build @sia/web` | Build for production                           |
| `npx nx start @sia/web` | Start production server (requires build first) |
| `npx nx lint @sia/web`  | Run ESLint                                     |
| `npx nx test @sia/web`  | Run tests                                      |

### API Server (`@sia/api`)

| Command                     | Description                  |
| --------------------------- | ---------------------------- |
| `npx nx serve @sia/api`     | Start development server     |
| `npx nx build @sia/api`     | Build for production         |
| `npx nx lint @sia/api`      | Run ESLint                   |
| `npx nx typecheck @sia/api` | Run TypeScript type checking |

### General Commands

| Command                                | Description                              |
| -------------------------------------- | ---------------------------------------- |
| `npx nx graph`                         | Visualize project dependencies           |
| `npx nx show project <project-name>`   | Show all available targets for a project |
| `npx nx run-many --target=build --all` | Build all projects                       |
| `npx nx run-many --target=lint --all`  | Lint all projects                        |
| `npx nx run-many --target=test --all`  | Test all projects                        |

### Database Migration Commands

```sh
npm run db:generate -w @sia/api -- --name={name of migration}
npm run db:migrate -w @sia/api
```

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

### Testing

```sh
npx nx test @sia/web
```

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

1. Check the existing documentation
2. Search existing issues and discussions
3. Open a new issue with your question

Thank you for contributing to Sia! 🚀
