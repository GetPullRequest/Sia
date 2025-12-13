# Requirements Document: Web Frontend

## Introduction

This document specifies the requirements for the SIA Web Frontend (`apps/web`). The web application provides the primary user interface for managing coding tasks, monitoring job execution, and reviewing generated Pull Requests.

## Glossary

- **Next.js**: React framework with server-side rendering and App Router
- **shadcn/ui**: Component library built on Radix UI primitives
- **React Query**: Data fetching and caching library
- **WebSocket**: Protocol for real-time updates from the backend

## Requirements

### Requirement 1: Dashboard

**User Story:** As a user, I want a dashboard, so that I can see an overview of my jobs and queue status.

#### Acceptance Criteria

1. WHEN a user visits the dashboard THEN the system SHALL display job statistics
2. WHEN jobs are queued THEN the system SHALL show queue status with positions
3. WHEN a job is in progress THEN the system SHALL highlight the active job

### Requirement 2: Job Management

**User Story:** As a user, I want to create and manage jobs, so that I can submit coding tasks.

#### Acceptance Criteria

1. WHEN a user creates a job THEN the system SHALL provide a form with prompt and repository selection
2. WHEN viewing jobs THEN the system SHALL display a filterable, sortable list
3. WHEN a job is selected THEN the system SHALL show detailed job information

### Requirement 3: Real-time Log Viewer

**User Story:** As a user, I want to see real-time logs, so that I can monitor job execution progress.

#### Acceptance Criteria

1. WHEN viewing a job THEN the system SHALL display execution logs in real-time
2. WHEN logs are streaming THEN the system SHALL auto-scroll to the latest entry
3. WHEN filtering logs THEN the system SHALL support level and stage filtering

### Requirement 4: Queue Management

**User Story:** As a user, I want to manage the job queue, so that I can prioritize tasks.

#### Acceptance Criteria

1. WHEN viewing the queue THEN the system SHALL display jobs in priority order
2. WHEN reordering THEN the system SHALL support drag-and-drop reordering
3. WHEN pausing the queue THEN the system SHALL prevent new jobs from starting

### Requirement 5: Authentication

**User Story:** As a user, I want secure authentication, so that my data is protected.

#### Acceptance Criteria

1. WHEN accessing the app THEN the system SHALL require PropelAuth login
2. WHEN switching organizations THEN the system SHALL update the context
3. WHEN the session expires THEN the system SHALL redirect to login

### Requirement 6: PR Review

**User Story:** As a user, I want to review generated PRs, so that I can approve or request changes.

#### Acceptance Criteria

1. WHEN a job completes THEN the system SHALL display the PR link
2. WHEN viewing a completed job THEN the system SHALL show execution summary
