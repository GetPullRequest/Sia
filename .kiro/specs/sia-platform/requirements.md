# Requirements Document

## Introduction

This document specifies the high-level requirements for the SIA (Software Intelligence Assistant) platform. SIA is an AI Developer Assistant that automates small, well-defined coding tasks and creates ready-to-review Pull Requests (PRs) while the human developer is offline or sleeping.

The platform follows a distributed architecture where:
- Users interact via Web UI or Chat Apps (Slack/Discord)
- The SIA Backend Server orchestrates job management and communication
- SIA Agents run on Cloud Dev Machines to execute coding tasks using AI coding assistants (Claude Code, CLI)
- Communication between backend and agents uses gRPC for reliable, bidirectional streaming

The project is organized as an Nx monorepo for easier dependency management, code sharing, and build orchestration.

## Glossary

- **SIA**: Software Intelligence Assistant - the overall platform name
- **Job**: A coding task submitted by a user to be executed by an agent
- **Agent**: A client-side application running on a Cloud Dev Machine that executes coding tasks
- **Backend Server**: The central API server that manages jobs, users, organizations, and agent coordination
- **Web UI**: The Next.js frontend application for user interaction
- **CLI**: Command-line interface for interacting with SIA
- **Cloud Dev Machine**: A remote development environment where agents execute coding tasks
- **gRPC**: Google Remote Procedure Call - protocol for backend-agent communication
- **Temporal**: Workflow orchestration engine for durable task execution
- **Nx**: Build system and monorepo management tool
- **Queue**: A prioritized list of jobs waiting to be executed

## Requirements

### Requirement 1: Monorepo Architecture

**User Story:** As a developer, I want the SIA platform to be organized as an Nx monorepo, so that code can be shared efficiently and builds are optimized.

#### Acceptance Criteria

1. WHEN the project is initialized THEN the system SHALL use Nx as the build system and monorepo manager
2. WHEN code is shared between applications THEN the system SHALL use shared libraries in the `libs/` directory
3. WHEN building applications THEN Nx SHALL cache build artifacts and only rebuild changed projects
4. WHEN adding dependencies THEN the system SHALL support both workspace-level and project-specific dependencies

### Requirement 2: Backend API Server

**User Story:** As a system operator, I want a robust backend API server, so that all platform components can communicate reliably.

#### Acceptance Criteria

1. WHEN the backend server starts THEN the system SHALL expose REST API endpoints for web clients
2. WHEN agents connect THEN the system SHALL establish gRPC connections for bidirectional communication
3. WHEN users authenticate THEN the system SHALL validate credentials via PropelAuth
4. WHEN jobs are created THEN the system SHALL persist them to PostgreSQL database
5. WHEN real-time updates occur THEN the system SHALL broadcast via WebSocket connections

### Requirement 3: Web Frontend Application

**User Story:** As a user, I want a web interface to manage my coding tasks, so that I can submit jobs and monitor their progress.

#### Acceptance Criteria

1. WHEN a user visits the web application THEN the system SHALL display a dashboard with job status
2. WHEN a user creates a job THEN the system SHALL provide a form to specify task details and repository
3. WHEN a job is executing THEN the system SHALL display real-time logs and progress
4. WHEN a job completes THEN the system SHALL show the PR link and execution summary

### Requirement 4: Agent Application

**User Story:** As a system operator, I want agents to execute coding tasks on Cloud Dev Machines, so that code generation happens in isolated environments.

#### Acceptance Criteria

1. WHEN an agent starts THEN the agent SHALL connect to the backend via gRPC
2. WHEN the agent receives a job THEN the agent SHALL clone the repository and set up the workspace
3. WHEN executing a task THEN the agent SHALL invoke the AI coding assistant (Claude Code)
4. WHEN code is generated THEN the agent SHALL run verification (build, test, lint)
5. WHEN verification passes THEN the agent SHALL create a Pull Request

### Requirement 5: CLI Application

**User Story:** As a developer, I want a command-line interface, so that I can interact with SIA from my terminal.

#### Acceptance Criteria

1. WHEN a user runs the CLI THEN the system SHALL authenticate with the backend
2. WHEN a user submits a job via CLI THEN the system SHALL create the job and return a job ID
3. WHEN a user queries job status THEN the system SHALL display current status and logs

### Requirement 6: Shared Models Library

**User Story:** As a developer, I want shared type definitions and models, so that all applications use consistent data structures.

#### Acceptance Criteria

1. WHEN defining API contracts THEN the system SHALL use shared TypeScript interfaces from `@sia/models`
2. WHEN generating gRPC types THEN the system SHALL use protobuf definitions in the models library
3. WHEN API schemas change THEN the system SHALL regenerate OpenAPI client types

### Requirement 7: Job Queue Management

**User Story:** As a system operator, I want jobs to be queued and executed in priority order, so that important tasks complete first.

#### Acceptance Criteria

1. WHEN a job is submitted THEN the system SHALL add it to the appropriate queue (backlog or rework)
2. WHEN an agent is available THEN the system SHALL assign the highest priority job from the queue
3. WHEN a job fails THEN the system SHALL allow requeuing to the rework queue
4. WHEN multiple agents exist THEN the system SHALL distribute jobs across available agents

### Requirement 8: Real-time Communication

**User Story:** As a user, I want real-time updates on job progress, so that I can monitor execution without refreshing.

#### Acceptance Criteria

1. WHEN an agent streams logs THEN the backend SHALL forward logs to subscribed WebSocket clients
2. WHEN job status changes THEN the system SHALL emit events to all subscribers
3. WHEN a client connects THEN the system SHALL send current state followed by real-time updates

### Requirement 9: Authentication and Authorization

**User Story:** As a system operator, I want secure authentication, so that only authorized users can access the platform.

#### Acceptance Criteria

1. WHEN a user logs in THEN the system SHALL authenticate via PropelAuth
2. WHEN accessing resources THEN the system SHALL verify organization membership
3. WHEN agents connect THEN the system SHALL validate agent credentials

### Requirement 10: Database and Persistence

**User Story:** As a system operator, I want reliable data persistence, so that job history and configuration are preserved.

#### Acceptance Criteria

1. WHEN storing data THEN the system SHALL use PostgreSQL as the primary database
2. WHEN schema changes THEN the system SHALL use Drizzle ORM migrations
3. WHEN querying data THEN the system SHALL use type-safe Drizzle queries

### Requirement 11: Landing Page

**User Story:** As a potential user, I want a marketing landing page, so that I can learn about SIA and sign up.

#### Acceptance Criteria

1. WHEN visiting the landing page THEN the system SHALL display product information and features
2. WHEN a user wants to sign up THEN the system SHALL provide a call-to-action to the web application

### Requirement 12: Chat App Integration

**User Story:** As a user, I want to interact with SIA via Slack or Discord, so that I can submit jobs from my team's communication platform.

#### Acceptance Criteria

1. WHEN a user sends a command in Slack/Discord THEN the system SHALL create a job via the backend API
2. WHEN a job completes THEN the system SHALL notify the user in the chat channel
