---
inclusion: fileMatch
fileMatchPattern: '**/db/schema.ts,**/db/**/*.ts,**/drizzle/**/*'
---

# Database Schema Changes Guidelines

When making changes to the database schema, follow these rules to ensure migrations are properly generated and applied.

## Schema Location

All database table definitions are in:

```
apps/api/src/db/schema.ts
```

## Required Steps After Schema Changes

### 1. Modify Schema

Edit `apps/api/src/db/schema.ts` with your changes:

```typescript
// Example: Adding a new column
export const jobs = pgTable('gpr_jobs', {
  id: uuid('id').primaryKey(),
  // ... existing columns
  newColumn: text('new_column'), // Add new column here
});
```

### 2. Generate Migration

**NEVER create SQL files manually.** Always use Drizzle to auto-generate:

```bash
npm run db:generate -w @sia/api -- --name=<meaningful_name>
```

Example:

```bash
npm run db:generate -w @sia/api -- --name=add-job-priority-column
npm run db:generate -w @sia/api -- --name=create-agents-table
npm run db:generate -w @sia/api -- --name=add-temporal-workflow-fields
```

### 3. Apply Migration

After generating the migration, apply it to the database:

```bash
npm run db:migrate -w @sia/api
```

## Migration Naming Conventions

Use descriptive, kebab-case names:

- `add-<column>-to-<table>` - Adding a column
- `create-<table>-table` - Creating a new table
- `remove-<column>-from-<table>` - Removing a column
- `rename-<old>-to-<new>` - Renaming
- `add-<index>-index` - Adding an index

## Important Rules

1. **Never manually write SQL migration files** - Drizzle generates them
2. **Always generate before migrating** - Don't skip the generate step
3. **Use meaningful migration names** - Makes rollbacks easier to understand
4. **Test migrations locally first** - Before applying to production

## Workflow Summary

```bash
# 1. Edit schema.ts
# 2. Generate migration
npm run db:generate -w @sia/api -- --name=your-change-description

# 3. Apply migration
npm run db:migrate -w @sia/api
```
