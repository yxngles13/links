// components/MigrationNotice.tsx
// Shown instead of a crash when the mentor tables haven't been created yet.

// PostgREST answers PGRST205 ("could not find the table in the schema
// cache") for a table that doesn't exist; 42P01 is Postgres's own code.
export function isMissingTable(error: { code?: string; message?: string } | null | undefined) {
  return !!error && (error.code === 'PGRST205' || error.code === '42P01' || /does not exist|schema cache/i.test(error.message ?? ''))
}

export default function MigrationNotice() {
  return (
    <div className="l-card l-card-soft">
      <div className="l-eyebrow" style={{ marginBottom: 8 }}>Setup needed</div>
      <p className="l-body" style={{ margin: 0 }}>
        Mentor matching needs its database tables. Run <code>supabase/migrations/20261018000000_mentors.sql</code> in the
        Supabase SQL Editor, then reload this page.
      </p>
    </div>
  )
}
