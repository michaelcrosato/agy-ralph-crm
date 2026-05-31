"use client";

import { useCallback, useEffect, useState } from "react";
import RoutingSimulator from "../../components/territories/RoutingSimulator";
import TerritoryEditor from "../../components/territories/TerritoryEditor";
import type { Territory } from "../../components/territories/TerritoryList";
import TerritoryList from "../../components/territories/TerritoryList";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export default function TerritoriesPage() {
  const [token, setToken] = useState<string | null>(null);
  const [selectedTerritory, setSelectedTerritory] = useState<Territory | null>(
    null,
  );
  const [isCreating, setIsCreating] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  /* Auth — reuse the standard system token pattern */
  const authenticate = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId: "org-acme-corp", userId: "user-a" }),
      });
      if (res.ok) {
        const data = (await res.json()) as { token: string };
        setToken(data.token);
      }
    } catch {
      /* API offline — components handle gracefully */
    }
  }, []);

  useEffect(() => {
    void authenticate();
  }, [authenticate]);

  const handleSelectTerritory = (territory: Territory) => {
    setSelectedTerritory(territory);
    setIsCreating(false);
    setEditorOpen(true);
  };

  const handleCreateNew = () => {
    setSelectedTerritory(null);
    setIsCreating(true);
    setEditorOpen(true);
  };

  const handleEditorSaved = () => {
    setEditorOpen(false);
    setSelectedTerritory(null);
    setIsCreating(false);
    setRefreshKey((k) => k + 1);
  };

  const handleEditorCancel = () => {
    setEditorOpen(false);
    if (isCreating) {
      setSelectedTerritory(null);
      setIsCreating(false);
    }
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "0",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Background Glow Orbs */}
      <div
        className="glow-spotlight pulsing-orb"
        style={{ top: "-80px", left: "-120px", opacity: 0.15 }}
      />
      <div
        className="glow-spotlight pulsing-orb"
        style={{
          bottom: "-60px",
          right: "-100px",
          opacity: 0.1,
          animationDelay: "4s",
        }}
      />

      {/* Header */}
      <header
        style={{
          padding: "1.5rem 2rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "1px solid var(--glass-border)",
          position: "relative",
          zIndex: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <a
            href="/"
            id="territories-back-link"
            style={{
              color: "var(--text-muted)",
              textDecoration: "none",
              fontSize: "0.85rem",
              padding: "0.4rem 0.8rem",
              borderRadius: "6px",
              border: "1px solid var(--glass-border)",
              transition: "all 0.2s ease",
            }}
          >
            ← Console
          </a>
          <div>
            <h1
              style={{
                fontSize: "1.6rem",
                fontWeight: 800,
                background: "var(--accent-gradient)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                lineHeight: 1.2,
              }}
            >
              Territory Management
            </h1>
            <p
              style={{
                fontSize: "0.8rem",
                color: "var(--text-muted)",
                marginTop: "2px",
              }}
            >
              Configure geographic & firmographic routing rules
            </p>
          </div>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
          }}
        >
          <span
            className="badge"
            style={{
              background: token
                ? "rgba(16, 185, 129, 0.15)"
                : "rgba(245, 158, 11, 0.15)",
              color: token ? "var(--success)" : "var(--warning)",
              border: `1px solid ${token ? "rgba(16, 185, 129, 0.3)" : "rgba(245, 158, 11, 0.3)"}`,
              fontSize: "0.72rem",
            }}
          >
            {token ? "● Connected" : "○ Offline"}
          </span>
        </div>
      </header>

      {/* Content */}
      <div
        style={{
          padding: "2rem",
          position: "relative",
          zIndex: 5,
          maxWidth: "1440px",
          margin: "0 auto",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: editorOpen ? "380px 1fr" : "1fr 1fr",
            gap: "1.5rem",
            alignItems: "start",
          }}
        >
          {/* Left Column: Territory List */}
          <div>
            {token ? (
              <TerritoryList
                token={token}
                apiBase={API_BASE}
                selectedTerritoryId={selectedTerritory?.id || null}
                onSelectTerritory={handleSelectTerritory}
                onCreateNew={handleCreateNew}
                refreshKey={refreshKey}
              />
            ) : (
              <div className="glass-panel">
                <p
                  style={{
                    textAlign: "center",
                    color: "var(--text-muted)",
                    padding: "2rem",
                  }}
                >
                  Connecting to API…
                </p>
              </div>
            )}
          </div>

          {/* Right Column: Editor or Simulator */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "1.5rem",
            }}
          >
            {editorOpen && token ? (
              <TerritoryEditor
                token={token}
                apiBase={API_BASE}
                territory={selectedTerritory}
                isCreating={isCreating}
                onSaved={handleEditorSaved}
                onCancel={handleEditorCancel}
              />
            ) : (
              <div className="glass-panel" style={{ textAlign: "center" }}>
                <div style={{ padding: "2rem 1rem" }}>
                  <div
                    style={{
                      fontSize: "3rem",
                      marginBottom: "0.75rem",
                      opacity: 0.6,
                    }}
                  >
                    🗺️
                  </div>
                  <p
                    style={{
                      fontSize: "0.95rem",
                      color: "var(--text-secondary)",
                      fontWeight: 500,
                    }}
                  >
                    Select a territory or create a new one
                  </p>
                  <p
                    style={{
                      fontSize: "0.8rem",
                      color: "var(--text-muted)",
                      marginTop: "0.25rem",
                    }}
                  >
                    Configure criteria rules, routing methods, and member
                    assignments.
                  </p>
                </div>
              </div>
            )}

            {/* Routing Simulator — always visible below */}
            {token && <RoutingSimulator token={token} apiBase={API_BASE} />}
          </div>
        </div>
      </div>

      {/* Spin keyframe for loading indicators */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </main>
  );
}
