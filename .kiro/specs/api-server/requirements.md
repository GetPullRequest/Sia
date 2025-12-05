# Requirements Document: API Server

## Introduction

This document specifies the requirements for the SIA Backend API Server (`apps/api`). The API server is the central hub of the SIA platform, responsible for:
- Exposing REST APIs for web and CLI clients
- Managing gRPC connections with SIA Agents
- Orchestrating job execution via Temporal workflows
- Broadcasting real-time updates via WebSocket
- Persisting data to PostgreSQL

## Glossary

- **Fastify**: High-performance Node.js web framework used for REST APIs
- **gRPC**: Protocol for agent communication with bidirectional streaming
- **Temporal**: Workflow orchestration engine for durable job execution
- **Drizzle ORM**: Type-safe ORM for PostgreSQL database access
- **PropelAuth**: Authentication service for user management
- **WebSocket**: Protocol for real-time bidirectional communication with clients

## Requirements

### Requirement 1: REST API

**User Story:** As a client application, I want REST API endpoints, so that I can manage jobs, organizations, and users.

#### Acceptance Criteria

1. WHEN a client requests job creation THEN the API SHALL validate input and create a job record
2. WHEN a client requests job list THEN the API SHALL return paginated jobs filtered by organization
3. WHEN a client requests job details THEN the API SHALL return job data including logs and status
4. WHEN a client requests queue status THEN the API SHALL return current queue state with positions

### Requirement 2: gRPC Agent Communication

**User Story:** As an agent, I want to communicate with the backend via gRPC, so that I can receive jobs and stream execution logs.

#### Acceptance Criteria

1. WHEN an agent connects THEN the API SHALL establish a bidirectional gRPC stream
2. WHEN the API sends a job THEN the agent SHALL receive job details via the stream
3. WHEN the agent streams logs THEN the API SHALL persist logs and broadcast to subscribers
4. WHEN the agent disconnects THEN the API SHALL mark the agent as offline

### Requirement 3: Authentication and Authorization

**User Story:** As a system operator, I want secure authentication, so that only authorized users can access resources.

#### Acceptance Criteria

1. WHEN a request arrives THEN the API SHALL validate the PropelAuth JWT token
2. WHEN accessing organization resources THEN the API SHALL verify organization membership
3. WHEN an agent connects THEN the API SHALL validate agent credentials

### Requirement 4: Database Operations

**User Story:** As a system operator, I want reliable data persistence, so that all platform data is stored safely.

#### Acceptance Criteria

1. WHEN storing jobs THEN the API SHALL use Drizzle ORM with PostgreSQL
2. WHEN schema changes THEN the API SHALL apply migrations via Drizzle Kit
3. WHEN querying data THEN the API SHALL use type-safe Drizzle queries

### Requirement 5: WebSocket Real-time Updates

**User Story:** As a client, I want real-time updates, so that I can see job progress without polling.

#### Acceptance Criteria

1. WHEN a client subscribes to a job THEN the API SHALL send existing logs followed by live updates
2. WHEN job status changes THEN the API SHALL broadcast to all subscribers
3. WHEN a client disconnects THEN the API SHALL clean up subscription resources

### Requirement 6: Temporal Workflow Integration

**User Story:** As a system operator, I want durable workflow execution, so that jobs are fault-tolerant.

#### Acceptance Criteria

1. WHEN a job is queued THEN the API SHALL create a Temporal workflow
2. WHEN Temporal triggers activities THEN the API SHALL execute job operations
3. WHEN workflows fail THEN Temporal SHALL retry according to configured policies
