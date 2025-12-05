# Design Document: SIA Platform

## Overview

SIA (Software Intelligence Assistant) is a distributed platform for automating coding tasks using AI. The platform enables users to submit coding tasks via Web UI or Chat Apps, which are then executed by AI-powered agents running on Cloud Dev Machines. The system creates ready-to-review Pull Requests automatically.

The architecture follows a hub-and-spoke model:
- **Hub**: SIA Backend Server (Fastify API) orchestrates all operations
- **Spokes**: Multiple SIA Agents execute tasks on Cloud Dev Machines
- **Clients**: Web UI, CLI, and Chat Apps provide user interfaces

## High-Level Architecture

```mermaid
flowchart TB
    subgraph "User Interfaces"
        UI[Web UI<br/>Next.js]
        CHAT[Chat Apps<br/>Slack/Discord]
        CLI[CLI<br/>Node.js]
    end
    
    subgraph "SIA Backend"
        API[SIA Backend Server<br/>Fastify + gRPC]
        DB[(PostgreSQL<br/>Drizzle ORM)]
        TEMP[Temporal<br/>Workflow Engine]
        WS[WebSocket<br/>Manager]
    end
    
    subgraph "Cloud Dev Machines"
        AG1[SIA Agent 1]
        AG2[SIA Agent 2]
        AGN[SIA Agent N]
        
        subgraph "Agent Components"
            CLAUDE[Claude Code]
            GIT[Git Operations]
            BUILD[Build/Test/Lint]
        end
    end
    
    UI -->|REST| API
    CHAT -->|REST| API
    CLI -->|REST| API
    UI <-->|WebSocket| WS
    
    API <-->|gRPC| AG1
    API <-->|gRPC| AG2
    API <-->|gRPC| AGN
    
    API --> DB
    API --> TEMP
    TEMP --> API
    
    AG1 --> CLAUDE
    AG1 --> GIT
    AG1 --> BUILD
```

## Monorepo Structure

```
sia/
├── apps/
│   ├── api/              # Backend API Server (Fastify)
│   ├── web/              # Web Frontend (Next.js)
│   ├── agent/            # SIA Agent (Node.js + gRPC)
│   ├── cli/              # Command Line Interface
│   └── landing-page/     # Marketing Landing Page (Vite)
├── libs/
│   └── models/           # Shared Types, Protobuf, OpenAPI
├── .kiro/
│   └── specs/            # Feature Specifications
├── nx.json               # Nx Configuration
├── package.json          # Root Package
└── tsconfig.base.json    # Shared TypeScript Config
```

## Component Architecture

### 1. Backend API Server (`apps/api`)

The central hub that coordinates all platform operations.

```mermaid
flowchart TB
    subgraph "apps/api"
        subgraph "API Layer"
            REST[REST Routes<br/>Fastify]
            GRPC[gRPC Server<br/>Agent Communication]
            WSS[WebSocket Server<br/>Real-time Updates]
        end
        
        subgraph "Service Layer"
            JOB[Job Service]
            QUEUE[Queue Service]
            AUTH[Auth Service]
            AGENT[Agent Service]
        end
        
        subgraph "Temporal Layer"
            WORK[Workflows]
            ACT[Activities]
            WORKER[Worker]
        end
        
        subgraph "Data Layer"
            DRIZZLE[Drizzle ORM]
            SCHEMA[DB Schema]
        end
    end
    
    REST --> JOB
    REST --> QUEUE
    REST --> AUTH
    GRPC --> AGENT
    WSS --> JOB
    
    JOB --> WORK
    QUEUE --> WORK
    WORK --> ACT
    ACT --> DRIZZLE
    
    DRIZZLE --> SCHEMA
```

**Key Technologies:**
- Fastify for REST API
- gRPC for agent communication
- WebSocket for real-time updates
- Temporal for workflow orchestration
- Drizzle ORM for database access
- PropelAuth for authentication

### 2. Web Frontend (`apps/web`)

Next.js application providing the user interface.

```mermaid
flowchart TB
    subgraph "apps/web"
        subgraph "Pages"
            DASH[Dashboard]
            JOBS[Jobs List]
            DETAIL[Job Detail]
            SETTINGS[Settings]
        end
        
        subgraph "Components"
            QUEUE_VIEW[Queue View]
            LOG_VIEWER[Log Viewer]
            JOB_FORM[Job Form]
        end
        
        subgraph "State"
            REACT_QUERY[React Query]
            WS_HOOK[WebSocket Hook]
        end
        
        subgraph "API Client"
            OPENAPI[OpenAPI Client]
        end
    end
    
    DASH --> QUEUE_VIEW
    JOBS --> QUEUE_VIEW
    DETAIL --> LOG_VIEWER
    
    QUEUE_VIEW --> REACT_QUERY
    LOG_VIEWER --> WS_HOOK
    
    REACT_QUERY --> OPENAPI
```

**Key Technologies:**
- Next.js 15 with App Router
- React 19
- TailwindCSS + shadcn/ui
- React Query for data fetching
- WebSocket for real-time updates

### 3. SIA Agent (`apps/agent`)

Executes coding tasks on Cloud Dev Machines.

```mermaid
flowchart TB
    subgraph "apps/agent"
        subgraph "Communication"
            GRPC_CLIENT[gRPC Client]
            STREAM[Bidirectional Stream]
        end
        
        subgraph "Execution"
            EXECUTOR[Job Executor]
            WORKSPACE[Workspace Manager]
        end
        
        subgraph "AI Integration"
            CLAUDE_INT[Claude Code Integration]
            PROMPT[Prompt Builder]
        end
        
        subgraph "Git Operations"
            CLONE[Clone Repository]
            BRANCH[Create Branch]
            COMMIT[Commit Changes]
            PR[Create PR]
        end
        
        subgraph "Verification"
            BUILD[Build]
            TEST[Test]
            LINT[Lint]
        end
    end
    
    GRPC_CLIENT --> STREAM
    STREAM --> EXECUTOR
    
    EXECUTOR --> WORKSPACE
    EXECUTOR --> CLAUDE_INT
    EXECUTOR --> CLONE
    
    CLAUDE_INT --> PROMPT
    
    WORKSPACE --> BUILD
    WORKSPACE --> TEST
    WORKSPACE --> LINT
    
    BUILD --> COMMIT
    COMMIT --> PR
```

**Key Technologies:**
- Node.js with TypeScript
- gRPC for backend communication
- Claude Code SDK for AI coding
- Simple-git for Git operations

### 4. CLI Application (`apps/cli`)

Command-line interface for developers.

```mermaid
flowchart LR
    subgraph "apps/cli"
        PARSER[Command Parser]
        AUTH_CMD[Auth Commands]
        JOB_CMD[Job Commands]
        STATUS_CMD[Status Commands]
        API_CLIENT[API Client]
    end
    
    PARSER --> AUTH_CMD
    PARSER --> JOB_CMD
    PARSER --> STATUS_CMD
    
    AUTH_CMD --> API_CLIENT
    JOB_CMD --> API_CLIENT
    STATUS_CMD --> API_CLIENT
```

**Key Technologies:**
- Node.js with TypeScript
- Commander.js for CLI parsing
- OpenAPI client for API calls

### 5. Shared Models Library (`libs/models`)

Shared type definitions and generated code.

```
libs/models/
├── src/
│   ├── proto/           # Protobuf definitions
│   │   └── generated/   # Generated gRPC types
│   ├── openapi/         # OpenAPI schema
│   │   └── generated/   # Generated API client
│   └── types/           # Shared TypeScript types
├── scripts/
│   ├── generate-proto.ts
│   └── generate-openapi.ts
└── package.json
```

## Data Flow

### Job Execution Flow

```mermaid
sequenceDiagram
    participant User
    participant Web as Web UI
    participant API as Backend API
    participant Temporal
    participant Agent
    participant Claude as Claude Code
    participant GitHub
    
    User->>Web: Create Job
    Web->>API: POST /jobs
    API->>API: Validate & Store Job
    API->>Temporal: Queue Job
    API-->>Web: Job Created
    
    Note over Temporal: Queue Monitor Triggers
    
    Temporal->>API: Claim Job
    API->>Agent: gRPC ExecuteJob
    
    Agent->>GitHub: Clone Repository
    Agent->>Agent: Setup Workspace
    Agent->>Claude: Execute Task
    
    loop Code Generation
        Claude-->>Agent: Generated Code
        Agent-->>API: Stream Logs
        API-->>Web: WebSocket Update
    end
    
    Agent->>Agent: Run Verification
    Agent->>GitHub: Create PR
    Agent-->>API: Job Complete
    
    API->>Temporal: Update Status
    API-->>Web: Job Complete Event
    Web-->>User: Show PR Link
```

## Technology Stack Summary

| Component | Technology | Purpose |
|-----------|------------|---------|
| Monorepo | Nx | Build orchestration, caching, dependency management |
| Backend | Fastify | REST API server |
| Frontend | Next.js 15 | Web application |
| Database | PostgreSQL | Data persistence |
| ORM | Drizzle | Type-safe database access |
| Workflows | Temporal | Durable task orchestration |
| Agent Comm | gRPC | Backend-agent communication |
| Real-time | WebSocket | Live updates to clients |
| Auth | PropelAuth | User authentication |
| AI | Claude Code | Code generation |
| Styling | TailwindCSS | UI styling |
| Components | shadcn/ui | UI component library |

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system.*

### Property 1: Job State Consistency
*For any* job in the system, the job status SHALL be one of: draft, queued, in-progress, in-review, completed, failed.
**Validates: Requirements 2.4, 7.1**

### Property 2: Queue Order Preservation
*For any* set of jobs in a queue, jobs SHALL be processed in ascending orderInQueue order.
**Validates: Requirements 7.2**

### Property 3: Agent Assignment Exclusivity
*For any* agent at any point in time, the agent SHALL have at most one job in-progress.
**Validates: Requirements 7.3**

### Property 4: Real-time Update Delivery
*For any* job status change or log message, all subscribed WebSocket clients SHALL receive the update.
**Validates: Requirements 8.1, 8.2**

### Property 5: Authentication Enforcement
*For any* API request to protected endpoints, the system SHALL verify authentication before processing.
**Validates: Requirements 9.1, 9.2**

## Error Handling

### Error Categories

1. **User Errors**: Invalid input, unauthorized access
2. **System Errors**: Database failures, service unavailability
3. **Agent Errors**: Build failures, verification failures, AI errors
4. **Network Errors**: gRPC disconnection, WebSocket drops

### Recovery Strategies

- **Temporal Retries**: Automatic retry with exponential backoff
- **Orphan Detection**: Periodic checks for stuck jobs
- **Agent Health Checks**: Continuous monitoring of agent availability
- **Graceful Degradation**: Continue operation with reduced functionality

## Testing Strategy

### Unit Tests
- Service layer logic
- Utility functions
- Component rendering

### Integration Tests
- API endpoint testing
- Database operations
- gRPC communication

### End-to-End Tests
- Full job execution flow
- User authentication flow
- Real-time update delivery

### Property-Based Tests
- Queue ordering properties
- State machine transitions
- Data validation
