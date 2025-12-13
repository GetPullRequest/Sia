# @sia/models

This library contains **only generated code** and generation scripts. All source models and APIs are defined in their respective projects:

- **Proto files**: `apps/agent/proto/` - gRPC service definitions
- **API types**: `apps/api/src/types.ts` - REST API request/response types
- **Database schema**: `apps/api/src/db/schema.ts` - Database models

## Generated Code

The `src/generated/` directory contains auto-generated TypeScript code from:

1. **Protocol Buffer files** (`.proto`) - gRPC service types and clients
2. **OpenAPI specification** (`apps/api/openapi.json`) - REST API client SDK

## Generating Code

### Prerequisites

- Node.js installed
- Dependencies installed (`npm install`)
- For API client: API must be built first to generate `openapi.json`

### Generate All Code

```bash
npm run generate -w @sia/models
```

This runs both generation scripts:

- `generate-proto`: Generates TypeScript from proto files in `apps/agent/proto/`
- `generate-api-client`: Generates TypeScript SDK from `apps/api/openapi.json`

### Generate Proto Code Only

```bash
npm run generate-proto -w @sia/models
```

Reads proto files from `apps/agent/proto/` and generates TypeScript code in `src/generated/`.

### Generate API Client Only

```bash
npm run generate-api-client -w @sia/models
```

Reads OpenAPI spec from `apps/api/openapi.json` and generates TypeScript client SDK in `src/generated/api-client/`.

**Note**: The API must be built first to generate `openapi.json`:

```bash
npx nx build @sia/api
```

## Generated Code Structure

```
src/generated/
├── agent.ts          # Generated from apps/agent/proto/agent.proto
├── api-client/       # Generated from apps/api/openapi.json
│   ├── services/     # API service classes
│   ├── models/       # Request/response models
│   └── schemas/      # JSON schemas
└── index.ts          # Auto-generated index exports
```

## Usage

Import generated types and clients from `@sia/models`:

```typescript
// Import generated proto types
import { AgentServiceClient, ExecuteJobRequest } from '@sia/models';

// Import generated API client
import { JobsService } from '@sia/models';
```

## Workflow

1. **Define models in source projects**:

   - Add/modify proto files in `apps/agent/proto/`
   - Add/modify API routes in `apps/api/src/routes/`
   - Update types in `apps/api/src/types.ts`

2. **Build API** (generates `openapi.json`):

   ```bash
   npx nx build @sia/api
   ```

3. **Generate code**:

   ```bash
   npm run generate -w @sia/models
   ```

4. **Build models library**:

   ```bash
   npx nx build @sia/models
   ```

5. **Use in other projects**:
   ```typescript
   import { ... } from '@sia/models';
   ```

## Important Notes

- **Generated code is checked into git** - this ensures consistency across environments
- **Source files are in their respective projects** - not in `libs/models`
- **Always rebuild API before generating API client** - to ensure `openapi.json` is up to date
- **Generated code should not be edited manually** - it will be overwritten on next generation
