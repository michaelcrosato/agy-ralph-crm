"use client";

import { useEffect, useState } from "react";
import BantAnalytics from "../../components/leads/BantAnalytics";
import ConversationSimulator from "../../components/leads/ConversationSimulator";

interface Lead {
  id: string;
  orgId: string;
  email: string | null;
  company: string | null;
  status: string;
  ownerId?: string | null;
  custom?: {
    bantBudget?: "qualified" | "unqualified" | "unknown";
    bantAuthority?: "qualified" | "unqualified" | "unknown";
    bantNeed?: "qualified" | "unqualified" | "unknown";
    bantTimeline?: "qualified" | "unqualified" | "unknown";
    bantScore?: number;
    botQualificationStatus?: "qualified" | "unqualified" | "needs_more_info";
    botNextQuery?: string | null;
    botNotes?: string;
  } | null;
}

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

interface Activity {
  id: string;
  type: string;
  subject: string;
  body: string;
  sender: "Lead" | "Bot";
  createdAt: string;
}

export default function LeadsPage() {
  const [token, setToken] = useState<string | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [bant, setBant] = useState<BantData | null>(null);
  const [history, setHistory] = useState<Activity[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(true);
  const [loadingBant, setLoadingBant] = useState(false);
  const [simulating, setSimulating] = useState(false);

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

  // 1. Obtain token & fetch leads on mount
  useEffect(() => {
    async function initAuthAndFetch() {
      try {
        const authRes = await fetch(`${API_BASE}/api/auth/token`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orgId: "org-acme-corp",
            userId: "user-a",
          }),
        });
        if (!authRes.ok) throw new Error("Authentication failed");
        const authData = (await authRes.json()) as { token: string };
        setToken(authData.token);

        // Fetch leads
        const leadsRes = await fetch(`${API_BASE}/api/leads`, {
          headers: { Authorization: `Bearer ${authData.token}` },
        });
        const leadsJson = (await leadsRes.json()) as { data: Lead[] };
        setLeads(leadsJson.data || []);
      } catch (err) {
        console.error(
          "[Hono Connection Warning] API is offline. Using local browser context engine.",
          err,
        );
      } finally {
        setLoadingLeads(false);
      }
    }
    void initAuthAndFetch();
  }, [API_BASE]);

  // 2. Fetch specific lead BANT details & logs
  async function fetchLeadBantStatus(leadId: string, activeToken: string) {
    setLoadingBant(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/leads/${leadId}/conversation/status`,
        {
          headers: { Authorization: `Bearer ${activeToken}` },
        },
      );
      if (res.ok) {
        const json = await res.json();
        setBant(json.data);
        setHistory(json.data.history || []);
      }
    } catch (err) {
      console.error("Failed to retrieve conversation status", err);
    } finally {
      setLoadingBant(false);
    }
  }

  const handleSelectLead = (lead: Lead) => {
    setSelectedLeadId(lead.id);
    if (token) {
      void fetchLeadBantStatus(lead.id, token);
    }
  };

  // 3. Simulate message submission
  const handleSimulate = async (message: string, type: "email" | "sms") => {
    if (!selectedLeadId || !token || simulating) return;
    setSimulating(true);

    try {
      // Simulate inbound message
      const simRes = await fetch(
        `${API_BASE}/api/leads/${selectedLeadId}/conversation/simulate`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ message, type }),
        },
      );

      if (simRes.ok) {
        // Immediately reload status & logs
        await fetchLeadBantStatus(selectedLeadId, token);

        // Update local leads list status and custom attributes
        const leadsRes = await fetch(`${API_BASE}/api/leads`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const leadsJson = (await leadsRes.json()) as { data: Lead[] };
        setLeads(leadsJson.data || []);
      }
    } catch (err) {
      console.error("Failed to run simulation turn", err);
    } finally {
      setSimulating(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        padding: "2rem",
        display: "flex",
        flexDirection: "column",
        gap: "2rem",
        position: "relative",
      }}
    >
      {/* Background Decorative Pulsing Orbs */}
      <div
        className="glow-spotlight pulsing-orb"
        style={{ top: "10%", left: "5%" }}
      ></div>
      <div
        className="glow-spotlight pulsing-orb"
        style={{
          bottom: "10%",
          right: "5%",
          background:
            "radial-gradient(circle, rgba(168, 85, 247, 0.15) 0%, rgba(168, 85, 247, 0) 70%)",
        }}
      ></div>

      {/* Navbar / Top Bar */}
      <div
        className="glass-panel"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "1rem 2rem",
          zIndex: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <span style={{ fontSize: "1.75rem" }}>🤖</span>
          <div>
            <h1 style={{ fontSize: "1.25rem", color: "#f8fafc", margin: 0 }}>
              Ralph AI Lead Qualification Engine
            </h1>
            <p style={{ fontSize: "0.75rem", color: "#64748b", margin: 0 }}>
              ACME CORP WORKSPACE · MONOREPO SHELL
            </p>
          </div>
        </div>

        <a
          href="/"
          className="glass-btn glass-btn-secondary"
          style={{
            textDecoration: "none",
            fontSize: "0.85rem",
            padding: "0.5rem 1rem",
          }}
        >
          ← Return to Console
        </a>
      </div>

      {/* Main Grid Workspace */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "350px 1fr",
          gap: "2rem",
          alignItems: "stretch",
          zIndex: 10,
          flex: 1,
        }}
      >
        {/* Left Column: Leads List */}
        <div
          className="glass-panel"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
            maxHeight: "850px",
            overflowY: "auto",
          }}
        >
          <div
            style={{
              borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
              paddingBottom: "0.75rem",
            }}
          >
            <h3
              style={{
                fontSize: "1.1rem",
                color: "#f8fafc",
                marginBottom: "0.25rem",
              }}
            >
              Active Inbound Pipeline
            </h3>
            <p style={{ color: "#64748b", fontSize: "0.75rem" }}>
              Click a lead to inspect Relationship Intelligence
            </p>
          </div>

          {loadingLeads ? (
            <div
              style={{ color: "#64748b", textAlign: "center", padding: "2rem" }}
            >
              Loading pipeline...
            </div>
          ) : leads.length === 0 ? (
            <div
              style={{ color: "#64748b", textAlign: "center", padding: "2rem" }}
            >
              No leads currently enqueued.
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
              }}
            >
              {leads.map((lead) => {
                const isSelected = lead.id === selectedLeadId;
                const score = lead.custom?.bantScore || 0;
                return (
                  <button
                    key={lead.id}
                    type="button"
                    className="glass-panel"
                    onClick={() => handleSelectLead(lead)}
                    style={{
                      cursor: "pointer",
                      padding: "1rem",
                      borderRadius: "10px",
                      backgroundColor: isSelected
                        ? "rgba(99, 102, 241, 0.1)"
                        : "rgba(15, 23, 42, 0.35)",
                      borderColor: isSelected
                        ? "rgba(99, 102, 241, 0.4)"
                        : "rgba(255, 255, 255, 0.05)",
                      transform: isSelected ? "scale(1.01)" : "none",
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.5rem",
                      textAlign: "left",
                      width: "100%",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                      }}
                    >
                      <h4
                        style={{
                          color: "#ffffff",
                          fontSize: "0.95rem",
                          margin: 0,
                        }}
                      >
                        {lead.company || "No Company"}
                      </h4>
                      {score > 0 && (
                        <span
                          style={{
                            fontSize: "0.7rem",
                            fontWeight: "bold",
                            color: score >= 100 ? "#10b981" : "#f59e0b",
                            background:
                              score >= 100
                                ? "rgba(16,185,129,0.1)"
                                : "rgba(245,158,11,0.1)",
                            padding: "0.15rem 0.4rem",
                            borderRadius: "4px",
                          }}
                        >
                          {score}%
                        </span>
                      )}
                    </div>
                    <p
                      style={{
                        color: "#94a3b8",
                        fontSize: "0.75rem",
                        margin: 0,
                      }}
                    >
                      {lead.email || "No Email Address"}
                    </p>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginTop: "0.25rem",
                      }}
                    >
                      <span
                        className="badge badge-lead"
                        style={{
                          fontSize: "0.65rem",
                          padding: "0.15rem 0.5rem",
                        }}
                      >
                        {lead.status}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Relationship Intelligence & Simulator */}
        <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
          {!selectedLeadId ? (
            <div
              className="glass-panel"
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
                padding: "4rem 2rem",
                color: "#94a3b8",
                gap: "1.5rem",
              }}
            >
              <div style={{ fontSize: "3.5rem" }}>🎯</div>
              <div>
                <h2
                  style={{
                    fontSize: "1.75rem",
                    color: "#f8fafc",
                    marginBottom: "0.5rem",
                  }}
                >
                  Autonomous qualification simulator
                </h2>
                <p
                  style={{
                    maxWidth: "450px",
                    fontSize: "0.95rem",
                    lineHeight: "1.6",
                  }}
                >
                  Select an inbound lead from the pipeline directory to activate
                  the live BANT profiling engine and converse with our AI
                  autopilot.
                </p>
              </div>
              <div
                style={{
                  display: "flex",
                  gap: "1rem",
                  color: "#64748b",
                  fontSize: "0.85rem",
                }}
              >
                <span>💵 Budget Checks</span> ·{" "}
                <span>🔑 Authority Parsing</span> · <span>🎯 Need Scope</span> ·{" "}
                <span>📅 Timeline Tracking</span>
              </div>
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1.2fr",
                gap: "2rem",
                alignItems: "stretch",
                flex: 1,
              }}
            >
              {/* BANT Stats panel */}
              {loadingBant ? (
                <div
                  className="glass-panel"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minHeight: "400px",
                  }}
                >
                  Loading qualification profile...
                </div>
              ) : bant ? (
                <BantAnalytics bant={bant} />
              ) : (
                <div className="glass-panel">
                  Awaiting BANT extraction logs...
                </div>
              )}

              {/* Chat simulator panel */}
              {loadingBant ? (
                <div
                  className="glass-panel"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minHeight: "400px",
                  }}
                >
                  Loading simulator state...
                </div>
              ) : (
                <ConversationSimulator
                  history={history}
                  simulating={simulating}
                  botNextQuery={bant?.botNextQuery || null}
                  onSimulate={handleSimulate}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
