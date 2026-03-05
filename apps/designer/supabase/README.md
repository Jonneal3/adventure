Supabase migrations and DB conventions

Usage

```bash
# Create a new empty migration (will prompt for name)
npm run db:new

# Apply pending migrations to local DB
npm run db:push

# Update generated TypeScript types and config cleanups
npm run db:update
```

Conventions

- Place all schema changes in `supabase/migrations/*.sql` files.
- Use `IF NOT EXISTS` for additive changes to keep migrations idempotent.
- Add explicit constraints and indexes alongside column/table changes.
- Avoid separate ad-hoc SQL files under `scripts/` for DB changes.


