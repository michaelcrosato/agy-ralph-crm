"use client";

interface BantData {
  bantBudget: "qualified" | "unqualified" | "unknown";
  bantAuthority: "qualified" | "unqualified" | "unknown";
  bantNeed: "qualified" | "unqualified" | "unknown";
  bantTimeline: "qualified" | "unqualified" | "unknown";
  bantScore: number;
  botQualificationStatus: "qualified" | "unqualified" | "needs_more_info";
  botNextQuery: string | null;
  botNotes: string;
}

interface BantAnalyticsProps {
  bant: BantData;
}

export default function BantAnalytics({ bant }: BantAnalyticsProps) {
  const getStatusColor = (status: "qualified" | "unqualified" | "unknown") => {
    switch (status) {
      case "qualified":
        return {
          text: "#10b981",
          bg: "rgba(16, 185, 129, 0.1)",
          border: "rgba(16, 185, 129, 0.2)",
          shadow: "0 0 15px rgba(16, 185, 129, 0.2)",
        };
      case "unqualified":
        return {
          text: "#ef4444",
          bg: "rgba(239, 68, 68, 0.1)",
          border: "rgba(239, 68, 68, 0.2)",
          shadow: "0 0 15px rgba(239, 68, 68, 0.2)",
        };
      default:
        return {
          text: "#94a3b8",
          bg: "rgba(148, 163, 184, 0.05)",
          border: "rgba(148, 163, 184, 0.1)",
          shadow: "none",
        };
    }
  };

  const getGlobalStatusBadge = (status: BantData["botQualificationStatus"]) => {
    switch (status) {
      case "qualified":
        return (
          <span
            className="badge"
            style={{
              backgroundColor: "rgba(16, 185, 129, 0.15)",
              color: "#10b981",
              border: "1px solid rgba(16, 185, 129, 0.3)",
              fontSize: "0.85rem",
              padding: "0.35rem 0.85rem",
            }}
          >
            ● Qualified
          </span>
        );
      case "unqualified":
        return (
          <span
            className="badge"
            style={{
              backgroundColor: "rgba(239, 68, 68, 0.15)",
              color: "#ef4444",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              fontSize: "0.85rem",
              padding: "0.35rem 0.85rem",
            }}
          >
            ● Unqualified
          </span>
        );
      default:
        return (
          <span
            className="badge"
            style={{
              backgroundColor: "rgba(245, 158, 11, 0.15)",
              color: "#f59e0b",
              border: "1px solid rgba(245, 158, 11, 0.3)",
              fontSize: "0.85rem",
              padding: "0.35rem 0.85rem",
            }}
          >
            ● Needs Info
          </span>
        );
    }
  };

  const items = [
    {
      key: "Budget",
      status: bant.bantBudget,
      desc: "Has allocated financial backing (exceeds CRM pricing baseline)",
      icon: "💵",
    },
    {
      key: "Authority",
      status: bant.bantAuthority,
      desc: "Liaising directly with VP/Director/CEO decision-makers",
      icon: "🔑",
    },
    {
      key: "Need",
      status: bant.bantNeed,
      desc: "Expressed valid requirements for scaling, sequences, or automation",
      icon: "🎯",
    },
    {
      key: "Timeline",
      status: bant.bantTimeline,
      desc: "Urgency to deploy the service within this quarter or ASAP",
      icon: "📅",
    },
  ];

  const scoreColor =
    bant.bantScore >= 100
      ? "#10b981"
      : bant.bantScore >= 50
        ? "#f59e0b"
        : "#64748b";

  return (
    <div
      className="glass-panel"
      style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}
    >
      {/* Header Info */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <h2
            style={{
              fontSize: "1.5rem",
              color: "#f8fafc",
              marginBottom: "0.25rem",
            }}
          >
            Relationship Intelligence
          </h2>
          <p style={{ color: "#94a3b8", fontSize: "0.875rem" }}>
            Autonomous BANT profile mapping & conversational qualification
          </p>
        </div>
        {getGlobalStatusBadge(bant.botQualificationStatus)}
      </div>

      {/* Main Score Visualizer */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "1.5rem",
          padding: "1.25rem",
          borderRadius: "12px",
          background: "rgba(15, 23, 42, 0.4)",
          border: "1px solid rgba(255, 255, 255, 0.05)",
        }}
      >
        <div
          style={{
            position: "relative",
            width: "90px",
            height: "90px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* Circular progress bar */}
          <svg
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              transform: "rotate(-90deg)",
            }}
          >
            <title>BANT Score Progress</title>
            <circle
              cx="45"
              cy="45"
              r="38"
              stroke="rgba(255,255,255,0.05)"
              strokeWidth="6"
              fill="transparent"
            />
            <circle
              cx="45"
              cy="45"
              r="38"
              stroke={scoreColor}
              strokeWidth="6"
              fill="transparent"
              strokeDasharray={`${2 * Math.PI * 38}`}
              strokeDashoffset={`${2 * Math.PI * 38 * (1 - bant.bantScore / 100)}`}
              style={{
                transition:
                  "stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1)",
              }}
            />
          </svg>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span
              style={{
                fontSize: "1.5rem",
                fontWeight: "bold",
                color: "#f8fafc",
              }}
            >
              {bant.bantScore}%
            </span>
            <span
              style={{
                fontSize: "0.65rem",
                color: "#64748b",
                textTransform: "uppercase",
                fontWeight: "600",
              }}
            >
              BANT Score
            </span>
          </div>
        </div>

        <div style={{ flex: 1 }}>
          <h4
            style={{
              color: "#f8fafc",
              fontSize: "1rem",
              marginBottom: "0.25rem",
            }}
          >
            Lead Qualification Index
          </h4>
          <p
            style={{ color: "#94a3b8", fontSize: "0.85rem", lineHeight: "1.4" }}
          >
            {bant.bantScore >= 100
              ? "This lead matches all standard BANT parameters perfectly and has been automatically routed to Sales."
              : bant.bantScore >= 50
                ? "This lead is partially qualified but requires more details before sales handoff. Auto-bot is active."
                : "Awaiting inbound communications or simulated turns to extract BANT attributes."}
          </p>
        </div>
      </div>

      {/* 4 BANT Parameters Grid */}
      <div
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}
      >
        {items.map((item) => {
          const colors = getStatusColor(item.status);
          return (
            <div
              key={item.key}
              style={{
                padding: "1rem",
                borderRadius: "12px",
                backgroundColor: colors.bg,
                border: `1px solid ${colors.border}`,
                boxShadow: colors.shadow,
                transition: "all 0.3s ease",
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span
                  style={{
                    fontSize: "0.95rem",
                    fontWeight: "600",
                    color: "#ffffff",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                  }}
                >
                  <span>{item.icon}</span> {item.key}
                </span>
                <span
                  style={{
                    fontSize: "0.7rem",
                    fontWeight: "bold",
                    color: colors.text,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  {item.status}
                </span>
              </div>
              <p
                style={{
                  color: "#94a3b8",
                  fontSize: "0.75rem",
                  lineHeight: "1.4",
                }}
              >
                {item.desc}
              </p>
            </div>
          );
        })}
      </div>

      {/* Bot Notes / Summary */}
      {bant.botNotes && (
        <div
          style={{
            padding: "1rem",
            borderRadius: "12px",
            background: "rgba(255, 255, 255, 0.02)",
            border: "1px solid rgba(255, 255, 255, 0.04)",
          }}
        >
          <h4
            style={{
              color: "#f8fafc",
              fontSize: "0.9rem",
              marginBottom: "0.5rem",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            🤖 AI Qualification Summary
          </h4>
          <p
            style={{
              color: "#94a3b8",
              fontSize: "0.85rem",
              lineHeight: "1.5",
              fontStyle: "italic",
            }}
          >
            "{bant.botNotes}"
          </p>
        </div>
      )}
    </div>
  );
}
