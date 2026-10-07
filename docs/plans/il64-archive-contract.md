# IL-64: Archive Routines Contract (Soft-Archive)

## 1. Overview

Implement soft-archive functionality for routines. Instead of deleting routines, they are marked as archived via an `is_archived` boolean flag. Archived routines are hidden from default listings but remain accessible via explicit filter and preserve all historical data.

## 2. Data Model Changes

### 2.1 Routines Table Schema Addition

Add `is_archived` column to the `routines` table:

```sql
ALTER TABLE routines ADD COLUMN is_archived INTEGER NOT NULL DEFAULT 0;
```

In Drizzle schema (src/db/schema.ts):
```typescript
export const routines = sqliteTable('routines', {
  // ... existing columns ...
  isArchived: integer('is_archived', { mode: 'boolean' }).notNull().default(false),
});
```

### 2.2 Type Inference Update

The `Routine` type in `src/types/index.ts` will automatically include the `isArchived` property via `$inferSelect`.

## 3. Behavioral Contract

### 3.1 Default Query Behavior
- All default queries for routines (home quick-pick, routine listing, etc.) MUST exclude archived routines unless explicitly requested
- Archived routines are invisible in standard UI flows but remain in the database

### 3.2 Archiving Action
- **Soft Delete**: Setting `is_archived = true` does NOT delete or modify any associated data
- **Idempotent**: Archiving an already-archived routine is a no-op and returns success
- **Atomic**: Archive operation runs in a transaction

### 3.3 Unarchiving Action
- **Restore**: Setting `is_archived = false` makes the routine visible in default listings again
- **Idempotent**: Unarchiving a non-archived routine is a no-op
- **Atomic**: Unarchive operation runs in a transaction

### 3.4 Data Preservation
When a routine is archived:
- **Sessions**: All existing sessions referencing the routine remain unchanged and accessible
  - Session's `routineId` foreign key remains valid
  - Session's `routineName` snapshot is preserved
  - All associated sets, PRs, etc. remain intact
- **History/Stats**: Analytics, volume calculations, etc. continue to include archived routine data
- **Programs**: If routine is used in program weeks, the association remains intact
- **Templates**: `isTemplate` flag operates independently of `isArchived`

### 3.5 UI/UX Contract
- **Home Quick-Pick**: Archived routines never appear in the main routines list on home tab
- **Routines Tab**: 
  - Default view shows only non-archived routines
  - Explicit "Show Archived" filter/toggle displays only archived routines
  - Combined view (show all) may be implemented later but is not required for MVP
- **Routine Editor**: 
  - Archived routines can be opened for viewing
  - Editing an archived routine requires unarchiving first OR editing creates a new duplicate (TBD - editing archived routines should likely require unarchiving first for safety)
- **Delete vs Archive**: 
  - Delete (hard delete) removes routine permanently (when implemented)
  - Archive (soft archive) preserves all data and history

### 3.6 Import/Share Interaction
- **Import**: 
  - Imported routines default to `is_archived = false`
  - Import fails with `DUPLICATE_ROUTINE_NAME` if a non-archived routine with same name exists
  - Import succeeds (with name suffixing) if only archived routine with same name exists — owner decision (2026-10-06): generate first free suffixed name (`Name (2)`, `Name (3)`, ...) by checking BOTH active and archived rows for global uniqueness; surface the final name in `RoutineImportResult.routineName` so the UI can inform the user.
- **Share/Export**:
  - Exported routine JSON does NOT include `is_archived` flag (it's a UI state, not part of routine definition)
  - Import treats archived status as local UI concern only

### 3.7 Migration Considerations
- Existing routines: `is_archived = false` for all current rows
- Backwards compatible: No data loss or breaking changes to existing queries that don't filter by archived status
- Index: Consider adding index on `is_archived` for performance if queries show need

## 4. API Surface

### 4.1 Service Functions (to be implemented in services/routine* or similar)
```typescript
export async function archiveRoutine(id: number): Promise<boolean>;
export async function unarchiveRoutine(id: number): Promise<boolean>;
export async function getArchivedRoutines(): Promise<Routine[]>;
export async function getAllRoutinesIncludingArchored(): Promise<Routine[]>;
```

### 4.2 Hook Updates
`useRoutines()` hook should return:
- `allRoutines`: non-archived routines only (default)
- `archivedRoutines`: archived routines only (when requested)
- `fetchRoutines`: refetches non-archived
- `fetchArchivedRoutines`: refetches archived only
- Toggle functions as above

## 5. Safety Properties

### 5.1 Referential Integrity
- Foreign key constraints remain valid
- No cascade deletes or modifications triggered by archive/unarchive

### 5.2 Atomicity
- Archive/unarchive operations are transactional
- Either complete fully or have no effect

### 5.3 Idempotency
- Multiple archive calls on same routine have same effect as single call
- Multiple unarchive calls on same routine have same effect as single call

### 5.4 Naming Constraints
- `name` uniqueness constraint applies ONLY to non-archived routines
- Archived routines do not block name reuse (but see Import behavior above)

## 6. Open Questions / Future Work

### 6.1 Hard Delete
When hard delete functionality is implemented, it should:
- Only apply to archived routines (safety)
- Actually remove the routine and optionally associated data
- Require explicit confirmation

### 6.2 Bulk Operations
- Archive multiple routines at once
- Unarchive multiple routines at once

### 6.3 Program Interaction
- What happens when trying to activate a program that uses an archived routine?
- Should programs prevent use of archived routines, or allow with visual indicator?

### 6.4 Template Interaction
- Can archived routines be marked as templates?
- Should template routines be exempt from archiving?