// components/AgentMigrationNotice.tsx
// Shown instead of a crash when the agent tables haven't been created yet.
export default function AgentMigrationNotice() {
  return (
    <div className="notice">
      <div className="label" style={{ marginBottom: 8 }}>Setup needed</div>
      <p className="body-copy">
        Plans need their database tables. Run <code>supabase/migrations/20261023000000_agent_plans.sql</code> in the
        Supabase SQL Editor, then reload this page.
      </p>
    </div>
  )
}
