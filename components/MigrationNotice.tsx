// components/MigrationNotice.tsx
// Detects a table that hasn't been created yet, so pages can show a setup
// notice instead of crashing.

// PostgREST answers PGRST205 ("could not find the table in the schema
// cache") for a table that doesn't exist; 42P01 is Postgres's own code.
export function isMissingTable(error: { code?: string; message?: string } | null | undefined) {
  return !!error && (error.code === 'PGRST205' || error.code === '42P01' || /does not exist|schema cache/i.test(error.message ?? ''))
}
