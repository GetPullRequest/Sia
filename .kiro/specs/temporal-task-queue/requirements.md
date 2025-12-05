# Requirements Document

## Introduction

This document specifies the requirements for implementing a Temporal-based task queue system for the SIA platform. The system enables sequential task execution where tasks are scheduled, executed one-by-one in priority order, and monitored in real-time. The architecture involves an Agent running on the client's machine communicating with the SIA API backend via gRPC, with Temporal orchestrating the workflow execution and task scheduling.

The system incorporates robust resilience patterns including heartbeat monitoring, orphan job detection, and automatic recovery mechanisms to ensure fault-tolerant operation.

## Glossary

- **Task/Job**: A unit of work to be executed by the Agent, corresponding to a job in the existing system
- **Task Queue**: A Temporal task queue that holds pending tasks awaiting execution
- **Agent**: A client-side application that executes tasks on the user's machine, communicating via gRPC
- **SIA API**: The backend service that manages task scheduling, state, and coordination with Temporal
- **Temporal Worker**: A process that polls Temporal for tasks and executes workflow/activity code
- **Workflow**: A Temporal workflow that orchestrates the execution of a single task or a sequence of tasks
- **Activity**: A Temporal activity that performs actual work (e.g., invoking the Agent via gRPC)
- **Priority Order**: Tasks with lower `orderInQueue` values execute before tasks with higher values
- **Task Output Stream**: Real-time log messages streamed from the Agent during task execution
- **Heartbeat**: A periodic signal sent to indicate that an activity is still running and making progress
- **Orphan Job**: A job that is marked as 'in-progress' but whose associated Temporal workflow is no longer running
- **Stuck Job**: A job that has been in-progress for longer than a threshold time without updates
- **Health Check**: A periodic verification that an agent is responsive and operational

## Requirements

### Requirement 1

**User Story:** As a system operator, I want tasks to be scheduled into a Temporal queue, so that task execution is durable and fault-tolerant.

#### Acceptance Criteria

1. WHEN a job status changes to 'queued' THEN the SIA API SHALL create a Temporal workflow for that task
2. WHEN a Temporal workflow is created THEN the system SHALL include the task ID, organization ID, and priority order as workflow parameters
3. WHEN the Temporal service is unavailable THEN the SIA API SHALL retry workflow creation with exponential backoff
4. WHEN a workflow is successfully created THEN the system SHALL update the job record with the Temporal workflow ID

### Requirement 2

**User Story:** As a system operator, I want tasks to execute sequentially in priority order, so that higher-priority work completes before lower-priority work.

#### Acceptance Criteria

1. WHEN multiple tasks are queued for an organization THEN the system SHALL execute tasks in ascending `orderInQueue` order
2. WHEN a task completes THEN the system SHALL automatically trigger execution of the next task in the queue
3. WHEN a new high-priority task is added while another task is executing THEN the system SHALL queue the new task for execution after the current task completes
4. WHILE a task is executing THEN the system SHALL prevent other tasks for the same organization from starting execution

### Requirement 3

**User Story:** As a developer, I want the Agent to receive task execution requests via gRPC, so that tasks run on the client's machine with access to local resources.

#### Acceptance Criteria

1. WHEN a Temporal activity needs to execute a task THEN the SIA API SHALL invoke the Agent via the existing gRPC `ExecuteJob` method
2. WHEN the gRPC connection to the Agent fails THEN the Temporal activity SHALL fail and trigger Temporal's retry mechanism
3. WHEN the Agent completes task execution THEN the activity SHALL return the execution result to the Temporal workflow
4. WHEN the Agent streams log messages during execution THEN the activity SHALL forward logs to the monitoring system

### Requirement 4

**User Story:** As a user, I want to monitor task execution progress in real-time, so that I can track what the system is doing.

#### Acceptance Criteria

1. WHEN the Agent streams a log message THEN the system SHALL persist the log to the database
2. WHEN the Agent streams a log message THEN the system SHALL broadcast the log via WebSocket to subscribed clients
3. WHEN a client subscribes to task progress THEN the system SHALL send all existing logs followed by real-time updates
4. WHEN a task transitions between stages THEN the system SHALL emit a stage-change event to subscribers

### Requirement 5

**User Story:** As a system operator, I want failed tasks to be handled gracefully, so that transient failures don't cause permanent task loss.

#### Acceptance Criteria

1. WHEN a Temporal activity fails THEN Temporal SHALL retry the activity according to the configured retry policy
2. WHEN a task fails after exhausting retries THEN the system SHALL update the job status to 'failed'
3. WHEN a task fails THEN the system SHALL preserve all execution logs for debugging
4. WHEN a task fails THEN the system SHALL proceed to execute the next task in the queue

### Requirement 6

**User Story:** As a user, I want to cancel a running task, so that I can stop work that is no longer needed.

#### Acceptance Criteria

1. WHEN a user requests task cancellation THEN the SIA API SHALL signal the Temporal workflow to cancel
2. WHEN a workflow receives a cancellation signal THEN the workflow SHALL invoke the Agent's `CancelJob` gRPC method
3. WHEN a task is cancelled THEN the system SHALL update the job status to 'failed' with a cancellation reason
4. WHEN a task is cancelled THEN the system SHALL proceed to execute the next task in the queue

### Requirement 7

**User Story:** As a developer, I want the Temporal integration to be cleanly separated from existing code, so that the system remains maintainable.

#### Acceptance Criteria

1. WHEN implementing Temporal workflows THEN the system SHALL place workflow code in a dedicated `temporal` directory
2. WHEN implementing Temporal activities THEN the system SHALL reuse existing services (AgentClient, JobExecutionService) where possible
3. WHEN configuring Temporal THEN the system SHALL use environment variables for connection settings
4. WHEN the Temporal worker starts THEN the system SHALL register all workflows and activities with the Temporal client

### Requirement 8

**User Story:** As a system operator, I want to query the current state of the task queue, so that I can understand system load and task ordering.

#### Acceptance Criteria

1. WHEN a user requests queue status THEN the SIA API SHALL return all queued tasks with their positions and priorities
2. WHEN a user requests workflow status THEN the SIA API SHALL query Temporal for the workflow execution state
3. WHEN displaying queue status THEN the system SHALL include the currently executing task if one exists

### Requirement 9

**User Story:** As a system operator, I want activities to send heartbeats during long-running operations, so that Temporal can detect unresponsive agents and trigger appropriate recovery.

#### Acceptance Criteria

1. WHEN a Temporal activity executes a long-running operation THEN the activity SHALL be configured with a heartbeat timeout
2. WHEN an activity fails to send a heartbeat within the timeout period THEN Temporal SHALL consider the activity failed
3. WHEN a heartbeat timeout occurs THEN Temporal SHALL retry the activity according to the configured retry policy
4. WHEN configuring activity options THEN the system SHALL set a heartbeat timeout of 5 minutes for job execution activities

### Requirement 10

**User Story:** As a system operator, I want orphan jobs to be automatically detected and recovered, so that jobs are not permanently stuck when workflows crash or agents become unavailable.

#### Acceptance Criteria

1. WHEN the queue monitor workflow runs THEN the system SHALL check for jobs in 'in-progress' status whose Temporal workflow is not running
2. WHEN an orphan job is detected THEN the system SHALL log an error message indicating the job is orphaned
3. WHEN an orphan job has a queue type THEN the system SHALL return the job to the end of its original queue
4. WHEN an orphan job has no queue type THEN the system SHALL mark the job as 'failed'
5. WHEN returning an orphan job to the queue THEN the system SHALL assign it the next available position in the queue

### Requirement 11

**User Story:** As a system operator, I want stuck jobs to be detected based on inactivity, so that jobs that have not made progress can be recovered.

#### Acceptance Criteria

1. WHEN a job has been in 'in-progress' status for longer than the stuck threshold THEN the system SHALL consider the job stuck
2. WHEN the stuck threshold is not specified THEN the system SHALL use a default threshold of 60 minutes
3. WHEN a stuck job is detected THEN the system SHALL apply the same recovery logic as orphan jobs

### Requirement 12

**User Story:** As a system operator, I want agent health to be monitored continuously, so that unresponsive agents can be detected and handled appropriately.

#### Acceptance Criteria

1. WHEN an agent health check is triggered THEN the system SHALL send a ping message via the agent's stream connection
2. WHEN an agent responds to a health check ping THEN the system SHALL reset the agent's consecutive failure count to zero
3. WHEN an agent fails to respond to a health check THEN the system SHALL increment the agent's consecutive failure count
4. WHEN an agent accumulates three consecutive health check failures THEN the system SHALL mark the agent as 'offline'
5. WHEN an agent is marked as offline THEN the system SHALL pause the agent's queue monitoring and health check schedules

### Requirement 13

**User Story:** As a system operator, I want the queue monitor to run periodically via Temporal schedules, so that jobs are processed without long-running workflows.

#### Acceptance Criteria

1. WHEN a queue monitor schedule triggers THEN the system SHALL execute a short-lived workflow that checks for available jobs
2. WHEN the queue monitor finds an available job THEN the system SHALL atomically claim the job to prevent race conditions
3. WHEN claiming a job THEN the system SHALL remove the job from the queue and mark it as 'in-progress' in a single transaction
4. WHEN the queue monitor executes THEN the system SHALL check the rework queue before the backlog queue
5. WHEN an agent already has a job in progress THEN the queue monitor SHALL skip processing for that agent
