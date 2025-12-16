---
globs: **/routes/**/*.ts,**/proto/**/*.proto,**/*.proto,**/grpc/**/*.ts
---

# API Changes Guidelines

When making changes to any API (REST, WebSocket, or gRPC), follow these rules to ensure type safety across the entire codebase.

## Communication Patterns

- **Frontend ↔ Backend**: REST APIs (Fastify) and WebSocket (log streaming only)
- **Backend ↔ Agent**: gRPC (bidirectional streaming)
- **WebSocket Usage**: Only for streaming logs to the frontend in real-time

## Required Steps After API Changes

### 1. REST API Changes (Fastify routes)

After modifying any route in `apps/api/src/routes/`:

```bash
# Regenerate OpenAPI client and types
npm run generate -w @sia/models
```

### 2. gRPC/Proto Changes

After modifying any `.proto` file:

```bash
# Regenerate protobuf types
npm run generate -w @sia/models
```

### 3. WebSocket Changes

WebSocket schemas are part of the API. After changes:

```bash
npm run generate -w @sia/models
```

## Frontend API Usage Rules

**NEVER hardcode API schemas in UI code.**

Always import from the generated SDK:

```typescript
// ✅ CORRECT - Use generated types
import { getJobs, postJobs, type Job } from '@sia/models/generated/api-client';

// ❌ WRONG - Never hardcode types
interface Job {
  id: string;
  status: string;
  // ...
}
```

### Import Paths

```typescript
// SDK functions (for API calls)
import {
  getJobs,
  postJobs,
  putJobsById,
} from '@sia/models/generated/api-client/sdk.gen';

// Types
import type {
  Job,
  Agent,
  Organization,
} from '@sia/models/generated/api-client/types.gen';

// Proto types (for gRPC)
import { LogMessage, ExecuteJobRequest } from '@sia/models/proto';
```

## Workflow Summary

1. Make API changes in `apps/api/src/routes/` or `libs/models/src/proto/`
2. Run `npm run generate -w @sia/models`
3. Update frontend code using the regenerated types from `@sia/models`
4. Never manually define API types in frontend code
