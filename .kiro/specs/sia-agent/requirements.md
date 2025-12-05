# Requirements Document: SIA Agent

## Introduction

This document specifies the requirements for the SIA Agent (`apps/agent`). The agent runs on Cloud Dev Machines and executes coding tasks using AI coding assistants. It communicates with the backend via gRPC and manages the full lifecycle of code generation, verification, and PR creation.

## Glossary

- **Cloud Dev Machine**: Remote development environment where the agent runs
- **Claude Code**: AI coding assistant used for code generation
- **gRPC**: Protocol for communication with the backend server
- **Workspace**: Temporary directory where repository is cloned and code is generated
- **Verification**: Build, test, and lint checks run after code generation

## Requirements

### Requirement 1: Backend Communication

**User Story:** As an agent, I want to communicate with the backend, so that I can receive jobs and report progress.

#### Acceptance Criteria

1. WHEN the agent starts THEN the agent SHALL connect to the backend via gRPC
2. WHEN the connection drops THEN the agent SHALL attempt reconnection with exponential backoff
3. WHEN receiving a job THEN the agent SHALL acknowledge receipt and begin execution
4. WHEN executing THEN the agent SHALL stream logs to the backend in real-time

### Requirement 2: Workspace Management

**User Story:** As an agent, I want to manage workspaces, so that each job has an isolated environment.

#### Acceptance Criteria

1. WHEN a job starts THEN the agent SHALL create a new workspace directory
2. WHEN setting up THEN the agent SHALL clone the repository and create a new branch
3. WHEN the job completes THEN the agent SHALL clean up the workspace
4. WHEN cleanup fails THEN the agent SHALL log the error and continue

### Requirement 3: AI Code Generation

**User Story:** As an agent, I want to use AI for code generation, so that coding tasks are automated.

#### Acceptance Criteria

1. WHEN executing a task THEN the agent SHALL invoke Claude Code with the prompt
2. WHEN Claude Code generates output THEN the agent SHALL stream progress to the backend
3. WHEN generation completes THEN the agent SHALL save the generated code

### Requirement 4: Verification Pipeline

**User Story:** As an agent, I want to verify generated code, so that only working code is submitted.

#### Acceptance Criteria

1. WHEN code is generated THEN the agent SHALL run the build command
2. WHEN build succeeds THEN the agent SHALL run tests
3. WHEN tests pass THEN the agent SHALL run linting
4. WHEN any step fails THEN the agent SHALL report the failure with details

### Requirement 5: PR Creation

**User Story:** As an agent, I want to create Pull Requests, so that generated code can be reviewed.

#### Acceptance Criteria

1. WHEN verification passes THEN the agent SHALL commit changes with a descriptive message
2. WHEN committing THEN the agent SHALL push to the remote branch
3. WHEN pushing succeeds THEN the agent SHALL create a PR via GitHub API
4. WHEN PR is created THEN the agent SHALL return the PR link to the backend

### Requirement 6: Health Monitoring

**User Story:** As a system operator, I want agents to report health, so that unresponsive agents can be detected.

#### Acceptance Criteria

1. WHEN the backend sends a health check THEN the agent SHALL respond promptly
2. WHEN the agent is busy THEN the agent SHALL still respond to health checks
3. WHEN the agent cannot respond THEN the backend SHALL mark it as offline
