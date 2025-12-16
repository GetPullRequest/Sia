---
globs: apps/web/**/*
---

# Frontend Development Guidelines (apps/web)

## Technology Stack

- **Framework**: Next.js with App Router
- **Styling**: Tailwind CSS
- **Component Library**: shadcn/ui (use the shadcn MCP server for component details and examples)
- **Icons**: Lucide React (`lucide-react`)
- **Data Fetching**: TanStack Query (React Query) for API caching
- **Language**: TypeScript with strict typing

## Component Library - shadcn/ui

- Use shadcn/ui as the primary component library
- When you need details about a specific shadcn component, use the shadcn MCP server tools
- Install new components using: `npx shadcn@latest add <component-name>`
- Components are located in `apps/web/components/ui/`

## API Calls - TanStack Query Pattern

Always use TanStack Query for backend API calls. Follow this pattern:

```typescript
// hooks/use-jobs.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// Query for fetching data
export function useJobs(orgId: string) {
  return useQuery({
    queryKey: ['jobs', orgId],
    queryFn: () => api.getJobs(orgId),
    enabled: !!orgId,
  });
}

// Mutation for creating/updating data
export function useCreateJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateJobInput) => api.createJob(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
}
```

## Icons - Lucide React

```typescript
import { Plus, Trash2, Settings, ChevronRight } from 'lucide-react';

// Usage
<Plus className="h-4 w-4" />
<Trash2 className="h-4 w-4 text-destructive" />
```

## TypeScript Guidelines

- **Always use explicit types** - avoid `any` and `unknown` as much as possible
- Define interfaces for all props, API responses, and state
- Use type inference where TypeScript can reliably infer types
- Export types from dedicated type files when shared across components

```typescript
// ✅ Good
interface JobCardProps {
  job: Job;
  onSelect: (id: string) => void;
}

// ❌ Avoid
const handleData = (data: any) => { ... }
```

## Component Size Guidelines

- Keep components under ~600 lines of code
- If a component grows beyond 600 lines, consider extracting sub-components
- This is a guideline, not a hard rule - use judgment based on complexity and readability
- Extract reusable logic into custom hooks

```typescript
// Instead of one large component:
// components/jobs/job-detail-modal.tsx (800+ lines)

// Split into:
// components/jobs/job-detail-modal.tsx (main component)
// components/jobs/job-detail-header.tsx
// components/jobs/job-detail-logs.tsx
// components/jobs/job-detail-actions.tsx
```

## Responsive Design

- Design for **desktop and tablet screens only** (non-mobile)
- A separate mobile app will handle mobile devices
- Use Tailwind responsive breakpoints: `sm:`, `md:`, `lg:`, `xl:`, `2xl:`
- Minimum supported width: 768px (tablet)

```typescript
// Example responsive layout
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {/* Content */}
</div>
```

## File Organization

```
apps/web/
├── app/                    # Next.js App Router pages
├── components/
│   ├── ui/                # shadcn/ui components
│   ├── jobs/              # Job-related components
│   ├── queues/            # Queue components
│   └── shared/            # Shared/common components
├── hooks/                  # Custom React hooks (TanStack Query hooks)
├── lib/                    # Utilities, API client
├── providers/              # React context providers
└── types/                  # TypeScript type definitions
```

## Common Patterns

### Page Component

```typescript
// app/jobs/page.tsx
import { JobsList } from '@/components/jobs/jobs-list';

export default function JobsPage() {
  return (
    <div className="container py-6">
      <h1 className="text-2xl font-bold mb-6">Jobs</h1>
      <JobsList />
    </div>
  );
}
```

### Data Fetching Component

```typescript
// components/jobs/jobs-list.tsx
'use client';

import { useJobs } from '@/hooks/use-jobs';
import { Loader2 } from 'lucide-react';

export function JobsList() {
  const { data: jobs, isLoading, error } = useJobs();

  if (isLoading) {
    return <Loader2 className="h-6 w-6 animate-spin" />;
  }

  if (error) {
    return <div className="text-destructive">Failed to load jobs</div>;
  }

  return (
    <div className="space-y-4">
      {jobs?.map(job => (
        <JobCard key={job.id} job={job} />
      ))}
    </div>
  );
}
```
