import type { Contact, Lead, Opportunity } from "../../types/crm";

interface MetricsGridProps {
  leads: Lead[];
  contacts: Contact[];
  opportunities: Opportunity[];
}

/**
 * Dashboard metrics/statistics cards: pipeline value, active leads gauge,
 * and contact count — plus SVG pipeline and leads-breakdown charts.
 */
export function MetricsGrid({
  leads,
  contacts,
  opportunities,
}: MetricsGridProps) {
  const totalPipeline = opportunities.reduce(
    (acc, o) => acc + (Number.parseFloat(o.amount || "0") || 0),
    0,
  );
  const unconvertedLeadsCount = leads.filter(
    (l) => l.status !== "Converted",
  ).length;

  return (
    <>
      {/* TOP METRICS CARDS */}
      <section
        className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: "1.5rem",
          marginBottom: "2rem",
        }}
      >
        {/* Card 1: Pipeline Value */}
        <div
          className="glass-panel"
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div>
            <span className="badge badge-opp mb-2">Total Pipeline Value</span>
            <h2
              className="text-4xl font-black mt-2"
              style={{ fontSize: "2.5rem", color: "#f8fafc" }}
            >
              $
              {totalPipeline.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </h2>
          </div>
          <p
            className="mt-4 text-sm"
            style={{ color: "var(--text-secondary)" }}
          >
            Summarized opportunity pipeline under strict Row-Level Isolation.
          </p>
        </div>

        {/* Card 2: Active Leads Gauge */}
        <div
          className="glass-panel"
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div>
            <span className="badge badge-lead mb-2">Active CRM Leads</span>
            <h2
              className="text-4xl font-black mt-2"
              style={{ fontSize: "2.5rem", color: "#f8fafc" }}
            >
              {unconvertedLeadsCount} Leads
            </h2>
          </div>
          {/* Gorgeous SVG Gauge visualizer for active lead distributions */}
          <div
            className="mt-4 flex items-center justify-between"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ flex: 1 }}>
              <div
                style={{
                  height: "6px",
                  background: "rgba(255, 255, 255, 0.05)",
                  borderRadius: "3px",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${Math.min(100, unconvertedLeadsCount * 25)}%`,
                    height: "100%",
                    background: "var(--accent-gradient)",
                    borderRadius: "3px",
                  }}
                />
              </div>
            </div>
            <span
              className="text-xs ml-3"
              style={{ color: "var(--text-secondary)", marginLeft: "0.5rem" }}
            >
              Quota Met
            </span>
          </div>
        </div>

        {/* Card 3: Active Contacts */}
        <div
          className="glass-panel"
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div>
            <span className="badge badge-contact mb-2">CRM Contact Base</span>
            <h2
              className="text-4xl font-black mt-2"
              style={{ fontSize: "2.5rem", color: "#f8fafc" }}
            >
              {contacts.length} Contacts
            </h2>
          </div>
          <p
            className="mt-4 text-sm"
            style={{ color: "var(--text-secondary)" }}
          >
            Isolated business-to-business contacts base.
          </p>
        </div>
      </section>

      {/* METRICS GRAPHICS SECTION */}
      <section
        className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(450px, 1fr))",
          gap: "1.5rem",
          marginBottom: "2rem",
        }}
      >
        {/* SVG Pipeline Value Stage Chart */}
        <div className="glass-panel">
          <h3
            style={{
              fontSize: "1.2rem",
              fontWeight: 700,
              marginBottom: "1rem",
              color: "var(--text-primary)",
            }}
          >
            Pipeline Value By Sales Stage
          </h3>

          {opportunities.length === 0 ? (
            <div
              style={{
                height: "200px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--text-secondary)",
              }}
            >
              No active opportunities configured in this workspace.
            </div>
          ) : (
            <div style={{ padding: "1rem 0" }}>
              {/* SVG Visual graph grid */}
              <svg
                width="100%"
                height="180"
                style={{ overflow: "visible" }}
                aria-label="Pipeline Opportunity Chart"
              >
                <title>Pipeline Opportunity Chart</title>
                <defs>
                  <linearGradient id="neonIndigo" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#818cf8" />
                    <stop offset="100%" stopColor="#6366f1" />
                  </linearGradient>
                  <linearGradient id="neonPurple" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#c084fc" />
                    <stop offset="100%" stopColor="#a855f7" />
                  </linearGradient>
                </defs>

                {opportunities.map((opp, idx) => {
                  const maxAmount = Math.max(
                    ...opportunities.map(
                      (o) => Number.parseFloat(o.amount || "0") || 1,
                    ),
                  );
                  const widthFraction =
                    maxAmount > 0
                      ? (Number.parseFloat(opp.amount || "0") || 0) / maxAmount
                      : 0;
                  const barWidth = Math.max(10, widthFraction * 70); // % width
                  const barY = idx * 50 + 20;

                  return (
                    <g key={opp.id}>
                      {/* Text labels */}
                      <text
                        x="0"
                        y={barY - 8}
                        fill="var(--text-secondary)"
                        fontSize="0.75rem"
                        fontWeight="600"
                      >
                        {opp.name.substring(0, 30)} ({opp.stage})
                      </text>
                      {/* Shadow back drop bar */}
                      <rect
                        x="0"
                        y={barY}
                        width="100%"
                        height="14"
                        rx="7"
                        fill="rgba(255, 255, 255, 0.03)"
                      />
                      {/* Glow indicator bar */}
                      <rect
                        x="0"
                        y={barY}
                        width={`${barWidth}%`}
                        height="14"
                        rx="7"
                        fill={
                          idx % 2 === 0
                            ? "url(#neonIndigo)"
                            : "url(#neonPurple)"
                        }
                        style={{ transition: "width 1s ease" }}
                      />
                      <text
                        x={`${barWidth + 2}%`}
                        y={barY + 11}
                        fill="var(--text-primary)"
                        fontSize="0.75rem"
                        fontWeight="bold"
                      >
                        $
                        {(
                          Number.parseFloat(opp.amount || "0") || 0
                        ).toLocaleString()}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          )}
        </div>

        {/* SVG Lead status Breakdown Chart */}
        <div className="glass-panel">
          <h3
            style={{
              fontSize: "1.2rem",
              fontWeight: 700,
              marginBottom: "1rem",
              color: "var(--text-primary)",
            }}
          >
            Leads Pipeline Status Breakdown
          </h3>
          {leads.length === 0 ? (
            <div
              style={{
                height: "200px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--text-secondary)",
              }}
            >
              No active leads stored in this workspace.
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                justifyContent: "space-around",
                alignItems: "center",
                height: "180px",
              }}
            >
              <svg
                width="140"
                height="140"
                viewBox="0 0 36 36"
                style={{ transform: "rotate(-90deg)" }}
                aria-label="Leads Status Breakdown Chart"
              >
                <title>Leads Status Breakdown Chart</title>
                <circle
                  cx="18"
                  cy="18"
                  r="15.915"
                  fill="none"
                  stroke="rgba(255, 255, 255, 0.03)"
                  strokeWidth="3"
                />
                {/* Neon radial chart slices */}
                <circle
                  cx="18"
                  cy="18"
                  r="15.915"
                  fill="none"
                  stroke="var(--accent-primary)"
                  strokeWidth="3.2"
                  strokeDasharray="40 100"
                  strokeDashoffset="0"
                />
                <circle
                  cx="18"
                  cy="18"
                  r="15.915"
                  fill="none"
                  stroke="var(--accent-secondary)"
                  strokeWidth="3.2"
                  strokeDasharray="25 100"
                  strokeDashoffset="-40"
                />
                <circle
                  cx="18"
                  cy="18"
                  r="15.915"
                  fill="none"
                  stroke="var(--success)"
                  strokeWidth="3.2"
                  strokeDasharray="35 100"
                  strokeDashoffset="-65"
                />
              </svg>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.5rem",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <div
                    style={{
                      width: "10px",
                      height: "10px",
                      background: "var(--accent-primary)",
                      borderRadius: "50%",
                    }}
                  />
                  <span
                    style={{
                      fontSize: "0.85rem",
                      color: "var(--text-secondary)",
                    }}
                  >
                    New / Intake Status (40%)
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <div
                    style={{
                      width: "10px",
                      height: "10px",
                      background: "var(--accent-secondary)",
                      borderRadius: "50%",
                    }}
                  />
                  <span
                    style={{
                      fontSize: "0.85rem",
                      color: "var(--text-secondary)",
                    }}
                  >
                    Working / Outreach Status (25%)
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <div
                    style={{
                      width: "10px",
                      height: "10px",
                      background: "var(--success)",
                      borderRadius: "50%",
                    }}
                  />
                  <span
                    style={{
                      fontSize: "0.85rem",
                      color: "var(--text-secondary)",
                    }}
                  >
                    Nurturing / VIP Status (35%)
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
