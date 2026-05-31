import type { Activity } from "../../types/crm";

interface ActivityFeedProps {
  activities: Activity[];
}

/**
 * Tenant audit timeline — renders the list of recent system activities
 * as a vertical timeline of glassmorphic cards.
 */
export function ActivityFeed({ activities }: ActivityFeedProps) {
  return (
    <div className="glass-panel">
      <h3
        style={{
          fontSize: "1.2rem",
          fontWeight: 700,
          marginBottom: "1rem",
          color: "var(--text-primary)",
        }}
      >
        Tenant Audit Timeline
      </h3>

      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {activities.map((act) => (
          <div
            key={act.id}
            className="glass-panel"
            style={{
              padding: "0.85rem",
              background: "rgba(255, 255, 255, 0.02)",
              display: "flex",
              flexDirection: "column",
              gap: "0.3rem",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span style={{ fontWeight: 700, fontSize: "0.85rem" }}>
                {act.action}
              </span>
              <span className="badge badge-opp" style={{ fontSize: "0.65rem" }}>
                {act.recordType}
              </span>
            </div>
            <div
              style={{
                fontSize: "0.75rem",
                color: "var(--text-secondary)",
              }}
            >
              Time: {new Date(act.createdAt).toLocaleTimeString()}
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
              Mutation: {JSON.stringify(act.changes)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
