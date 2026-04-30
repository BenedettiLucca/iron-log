# Iron Log — QA Bug Review (2026-04-30)

**Stack:** Expo SDK 54 · React Native · Drizzle ORM / SQLite · NativeWind (Tailwind) · TypeScript  
**Source Files:** ~100 (excluding node_modules/android-sdk)  
**Largest File:** `app/session/exercise.tsx` (886 LOC)  
**Tests:** 281 passing across 16 suites ✅  
**Migrations:** 17 (0000–0016)

---

## 🔴 CRITICAL (Data Loss / Security)

### BUG-1: Hard DELETE on sessions table that has soft-delete (`deletedAt` column)

**Files:** `app/session/finish.tsx` (L268), `app/session/[routineId].tsx` (L196)

```typescript
// finish.tsx — confirmDiscard
await db.delete(sessions).where(eq(sessions.id, Number(sessionId)));

// [routineId].tsx — exit cleanup for empty session
await db.delete(sessions).where(eq(sessions.id, sessionId));
```

The `sessions` table has `deletedAt` for soft-delete, but two places physically delete rows. This bypasses foreign key cascades and can orphan `sets` rows. The exit dialog in `[routineId].tsx` hard-deletes sessions with 0 sets (defensible), but `finish.tsx`'s `confirmDiscard` hard-deletes sessions that might already have sets saved.

**Fix:** Use `db.update(sessions).set({ deletedAt: Date.now() })` consistently. For empty sessions, hard-delete is OK but should check both `sets count === 0` AND `sets count with deletedAt !== null`.

---

### BUG-2: No DB schema validation on import

**File:** `services/DatabaseBackupService.ts` — `importDb()`

The import flow picks any file, creates a snapshot of the current DB, then replaces it. There's no validation that the file is actually a valid SQLite database or has the correct schema. A corrupted or wrong file could brick the app. The only check is `sourceInfo.size === 0`.

**Fix:** After copying the file, open it and verify the schema has the expected tables (`sessions`, `sets`, `exercises`, etc.) before replacing the active DB. If invalid, revert to the snapshot.

---

### BUG-3: Google OAuth Client ID fallback is a dummy string

**File:** `app/(drawer)/settings.tsx` L77

```typescript
clientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || 'DUMMY_ID_FOR_DEV',
```

If `EXPO_PUBLIC_GOOGLE_CLIENT_ID` is not set, the Google auth flow silently proceeds with a dummy ID instead of blocking or showing the "config required" dialog. Could cause confusing errors in production.

**Fix:** Remove the fallback. Guard the `useAuthRequest` call behind a check for the env var, or show the config dialog before calling `promptAsync`.

---

## 🟡 WARNING (Correctness / Performance / Maintainability)

### BUG-4: Volume calculation includes warmup sets in finish screen

**File:** `app/session/finish.tsx` L110-113

```typescript
for (const set of sessionSets) {
  if (set.reps && set.weightKg) {
    totalVolume += set.reps * set.weightKg;
  }
}
```

Counts warmup sets in total volume, inflating the displayed number. The AnalyticsService correctly filters `!s.isWarmup` everywhere, but the finish screen doesn't.

**Fix:** Add `&& !set.isWarmup` to the condition.

---

### BUG-5: Missing `routineExercises` composite primary key

**File:** `src/db/schema.ts` — `routineExercises` table

```typescript
export const routineExercises = sqliteTable('routine_exercises', {
  routineId: integer('routine_id').references(() => routines.id),
  exerciseId: integer('exercise_id').references(() => exercises.id),
  ...
});
```

Without a PK (or composite PK on `routineId + exerciseId`), Drizzle can't reliably update or delete individual rows. No way to update a single exercise's target/notes within a routine.

**Fix:** Add `primaryKey({ columns: [routineExercises.routineId, routineExercises.exerciseId] })` or add an auto-increment `id` column. Requires a new migration.

---

### BUG-6: N+1 query in history screen day press

**File:** `app/(drawer)/history/index.tsx` L139-160

`handleDayPress` loops over filtered sessions and makes an individual DB query per session to get exercise names. For a day with 5 sessions, that's 5 sequential DB calls.

**Fix:** Batch query all sets for those session IDs in a single call.

---

### BUG-7: No PR insertion logic anywhere (dead feature)

The exercise screen saves sets but never checks/updates the `personalRecords` table. PRs are tracked in the schema but there's no code that actually inserts or updates them during workouts. The finish screen counts PRs (`prCount`) but they'll always be 0.

**Fix:** After saving a set in `exercise.tsx`, query the current PR for that exercise+recordType. If the new set exceeds it, insert/update the PR record.

---

### BUG-8: Photo files never cleaned up on deletion

**Files:** `app/(drawer)/bio/index.tsx`, `services/DatabaseBackupService.ts`

When check-in photos are deleted (via the delete button or session discard), the physical files in `FileSystem.documentDirectory` are never deleted. Over time, orphaned photos accumulate and waste storage.

**Fix:** Before removing a photo reference from the DB, check if the file exists and delete it with `FileSystem.deleteAsync()`.

---

### BUG-9: Google token expiry not handled

**File:** `services/DatabaseBackupService.ts` — `uploadToDrive()`

Uses the access token directly with no refresh logic. Google access tokens expire after 1 hour. If the user connects, waits, then tries to backup, the token will be expired and the upload will fail silently.

**Fix:** Check token expiry before uploading. If expired, prompt re-auth or use a refresh token.

---

### BUG-10: SQL IN clause fragility in AnalyticsService

**File:** `services/AnalyticsService.ts` L149-153

```typescript
sql`${sets.sessionId} IN (${sql.join(sessionIds.map(id => sql`${id}`), sql`, `)})`
```

With very large session counts (100+), this generates massive SQL strings. Should use a subquery instead.

**Fix:** Replace with a join/subquery approach: `WHERE sessionId IN (SELECT id FROM sessions WHERE ...)`.

---

### BUG-11: Image crop always forces square (800×800)

**File:** `app/(drawer)/bio/index.tsx` L131-136

```typescript
{ resize: { width: 800, height: 800 } },
{ crop: { originX: 0, originY: 0, width: 800, height: 800 } },
```

The resize+crop combo forces all check-in photos to 800×800 squares. For body photos (front/back/side), this may crop important body parts. The `aspect: [3, 4]` in the picker doesn't match the forced square output.

**Fix:** Change resize to maintain aspect ratio (e.g., `resize: { width: 800 }` without height constraint) and remove the crop, or match the crop to 3:4 aspect.

---

## 🔵 SUGGESTIONS (Improvements)

### SUG-1: Hardcoded hex colors in 4 files

`#fff`, `#000` in `app/_layout.tsx`, `app/(drawer)/_layout.tsx`, `app/(drawer)/settings.tsx`, `app/session/exercise.tsx`. Should reference the `Colors` constant or Tailwind tokens for theme consistency.

---

### SUG-2: `as any` casts in 2 files

- `app/(drawer)/bio/index.tsx` — `(m as any)[p]` for dynamic metric field access
- `app/session/finish.tsx` — `router.replace('/(drawer)' as any)`

Should use proper typing.

---

### SUG-3: `useState<any>` in exercise screen

**File:** `app/session/exercise.tsx` L74-75

```typescript
const [nextExercise, setNextExercise] = useState<any>(null);
const [allExercises, setAllExercises] = useState<any[]>([]);
```

Should be typed with the actual routine exercise interface.

---

### SUG-4: 157-line unused `useSessionExercise` hook

**File:** `hooks/use-session-exercise.ts`

Defines a full hook with `addSet`, `updateSet`, `deleteSet`, etc., but `app/session/exercise.tsx` implements all the same logic inline. Dead code — either refactor exercise.tsx to use it or delete it.

---

### SUG-5: `expo-file-system/legacy` import

**Files:** `services/DatabaseBackupService.ts`, `services/AlexandriaExportService.ts`

Uses deprecated legacy API. Will break in a future Expo SDK. Plan migration to the new OO API (`Paths`, `File`, `Directory`).

---

### SUG-6: Weight diff arrow logic inverted

**File:** `app/session/finish.tsx` L310

```typescript
className={`... ${weightDiff > 0 ? 'text-success' : 'text-danger'}`}
```

Weight GAIN shows green (success) and weight LOSS shows red (danger). For a cutting phase, this is backwards. Should be context-dependent or neutral.

---

### SUG-7: Missing `parseInt` radix parameter

Multiple files use `parseInt(str)` without explicit radix `10`. While modern JS defaults to base 10, it's a best practice to always specify.

---

## Priority Fix Order

| Priority | Bug ID | Description | Effort |
|----------|--------|-------------|--------|
| 1 | BUG-1 | Hard DELETE → soft delete | Small |
| 2 | BUG-4 | Warmup sets in volume | Trivial |
| 3 | BUG-2 | DB import validation | Medium |
| 4 | BUG-5 | Missing routineExercises composite PK | Medium (migration) |
| 5 | BUG-6 | N+1 history queries | Small |
| 6 | BUG-7 | PR insertion logic | Medium |
| 7 | BUG-8 | Photo file cleanup | Small |
| 8 | BUG-3 | Google OAuth fallback | Small |
| 9 | BUG-9 | Token expiry | Small |
| 10 | BUG-11 | Image crop forces square | Small |
| 11+ | SUG-* | Suggestions | Various |

---

## Status

- [x] Review completed
- [x] BUG-1 fix — soft delete in finish.tsx + [routineId].tsx
- [x] BUG-4 fix — exclude warmup from volume & totalSets in finish.tsx
- [x] BUG-2 fix — SQLite header validation in DatabaseBackupService.ts
- [x] BUG-5 fix — composite PK (routineId, exerciseId) on routineExercises + migration 0016
- [x] BUG-6 fix — batch query with inArray in history/index.tsx
- [x] BUG-7 fix — PR upsert logic (weight + reps) after set save in exercise.tsx
- [x] BUG-8 fix — physical file deletion in bio/index.tsx deletePhoto()
- [x] BUG-3 fix — removed DUMMY_ID fallback in settings.tsx
- [x] BUG-9 fix — token expiry tracking + re-auth prompt in settings.tsx
- [x] BUG-10 fix — replaced raw SQL IN with inArray() in AnalyticsService (2 occurrences)
- [x] BUG-11 fix — resize width-only (no forced square crop) in bio/index.tsx
- [x] SUG-1 fix — replaced #fff/#000 with Colors.white/Colors.black in 4 files
- [x] SUG-2 fix — typed photo key access with `as const` in bio/index.tsx
- [x] Test suite — 281/281 passing after all changes
- [x] All fixes committed and pushed to master
