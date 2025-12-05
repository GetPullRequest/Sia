# Design Document: Shared Models Library

## Overview

The Shared Models Library provides type definitions, protobuf schemas, and generated clients used across all SIA applications. It ensures type safety and consistency across the monorepo.

## Architecture

```mermaid
flowchart TB
    subgraph "libs/models"
        subgraph "Source"
            PROTO[Proto Files]
            TYPES[TypeScript Types]
            OPENAPI[OpenAPI Spec]
        end
        
        subgraph "Generated"
            GRPC_TYPES[gRPC Types<br/>ts-proto]
            API_CLIENT[API Client<br/>@hey-api/openapi-ts]
        end
        
        subgraph "Scripts"
            GEN_PROTO[generate-proto.ts]
            GEN_OPENAPI[generate-openapi.ts]
        end
    end
    
    subgraph "Consumers"
        API[apps/api]
        WEB[apps/web]
        AGENT[apps/agent]
        CLI[apps/cli]
    end
    
    PROTO --> GEN_PROTO
    GEN_PROTO --> GRPC_TYPES
    
    OPENAPI --> GEN_OPENAPI
    GEN_OPENAPI --> API_CLIENT
    
    GRPC_TYPES --> API
    GRPC_TYPES --> AGENT
    
    API_CLIENT --> WEB
    API_CLIENT --> CLI
    
    TYPES --> API
    TYPES --> WEB
    TYPES --> AGENT
    TYPES --> CLI
```

## Directory Structure

```
libs/models/
├── src/
│   ├── proto/
│   │   ├── agent.proto        # Agent service definition
│   │   └── generated/         # Generated TypeScript
│   ├── openapi/
│   │   └── generated/         # Generated API client
│   └── types/
│       ├── job.ts             # Job types
│       ├── agent.ts           # Agent types
│       └── index.ts           # Barrel export
├── scripts/
│   ├── generate-proto.ts      # Proto generation script
│   └── generate-openapi.ts    # OpenAPI generation script
├── package.json
└── tsconfig.json
```

## Proto Service Definition

```protobuf
service AgentService {
  rpc ExecuteJob(ExecuteJobRequest) returns (stream LogMessage);
  rpc CancelJob(CancelJobRequest) returns (CancelJobResponse);
  rpc RunVerification(VerificationRequest) returns (VerificationResponse);
  rpc CreatePR(CreatePRRequest) returns (CreatePRResponse);
  rpc CleanupWorkspace(CleanupRequest) returns (CleanupResponse);
  rpc HintJob(HintJobRequest) returns (HintJobResponse);
}
```

## Generation Scripts

### Proto Generation
```bash
npm run generate:proto
# Uses ts-proto to generate TypeScript from .proto files
```

### OpenAPI Generation
```bash
npm run generate:openapi
# Uses @hey-api/openapi-ts to generate client from OpenAPI spec
```

## Testing Strategy

- Type checking via TypeScript compiler
- Ensure generated code compiles without errors
