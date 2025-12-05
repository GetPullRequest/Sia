---
inclusion: fileMatch
fileMatchPattern: "apps/api/**/*"
---

# Backend Development Guidelines (apps/api)

## Technology Stack

- **Framework**: Fastify for REST APIs
- **Real-time**: WebSocket for streaming logs during job execution
- **Agent Communication**: gRPC streaming for backend-agent communication
- **Database**: PostgreSQL with Drizzle ORM
- **Workflows**: Temporal for durable task orchestration
- **Auth**: PropelAuth for authentication
- **Language**: TypeScript with strict typing

## REST API - Fastify

```typescript
// routes/jobs/index.ts
import { FastifyPluginAsync } from 'fastify';

const jobRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', {
    schema: {
      response: {
        200: JobListSchema
      }
    }
  }, async (request, reply) => {
    const jobs = await jobService.list(request.orgId);
    return jobs;
  });
};
```

## WebSocket - Log Streaming

Use WebSocket for streaming job logs to the frontend in real-time:

```typescript
// services/websocket-manager.ts
export class WebSocketManager {
  broadcastLog(jobId: string, log: LogEntry) {
    const subscribers = this.jobSubscribers.get(jobId);
    subscribers?.forEach(ws => ws.send(JSON.stringify(log)));
  }
}
```

## gRPC - Agent Communication

Use gRPC bidirectional streaming for backend-agent communication:

```typescript
// grpc/agent-server.ts
// Agent connects and streams job updates
// Backend streams job assignments
```

Proto definitions are in `libs/models/src/proto/`.

## TypeScript Guidelines

- **Always use explicit types** - avoid `any` and `unknown`
- Exception: External library callbacks where types aren't available
- Exception: Fastify request/reply generics in some cases
- Define interfaces for all request/response bodies

```typescript
// ✅ Good
interface CreateJobRequest {
  prompt: string;
  repoId: string;
  queueType: 'backlog' | 'rework';
}

// ❌ Avoid
const handleRequest = (data: any) => { ... }
```

## Database - Drizzle ORM

```typescript
// db/schema.ts
export const jobs = pgTable('jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  status: jobStatusEnum('status').notNull(),
  prompt: text('prompt').notNull(),
  // ...
});

// Usage
const job = await db.query.jobs.findFirst({
  where: eq(jobs.id, jobId)
});
```

## Temporal Workflows

```typescript
// temporal/workflows/job-workflow.ts
export async function jobWorkflow(jobId: string): Promise<void> {
  await executeActivity('claimJob', { jobId });
  await executeActivity('executeJob', { jobId });
}
```

## Error Handling

Use Fastify's error handling:

```typescript
import { FastifyError } from 'fastify';

// Custom errors
class NotFoundError extends Error {
  statusCode = 404;
}

// In routes
if (!job) {
  throw new NotFoundError('Job not found');
}
```

## File Organization

```
apps/api/src/
├── routes/              # REST API routes
├── services/            # Business logic
├── temporal/            # Workflows & activities
├── grpc/                # gRPC server
├── db/                  # Database schema & migrations
├── middleware/          # Auth, validation
└── main.ts              # Entry point
```

## Build Verification

After making changes, always verify the build:

```sh
npm run build:all
```

This runs `npx nx run-many --target=build --all` to ensure all projects compile correctly.
