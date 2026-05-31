"use client";

import { useCallback, useEffect, useState } from "react";

export interface TerritoryCriteria {
  field: string;
  operator: string;
  value: string;
}

export interface Territory {
  id: string;
  orgId: string;
  name: string;
  isActive: number;
  routingMethod: string;
  lastAssignedIndex: number;
  criteria: TerritoryCriteria[] | Record<string, unknown>;
}

interface TerritoryListProps {
  token: string;
  apiBase: string;
  selectedTerritoryId: string | null;
  onSelectTerritory: (territory: Territory) => void;
  onCreateNew: () => void;
  refreshKey: number;
}

export default function TerritoryList({
  token,
  apiBase,
  selectedTerritoryId,
  onSelectTerritory,
  onCreateNew,
  refreshKey,
}: TerritoryListProps) {
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTerritories = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/sales-ops/territories`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = (await res.json()) as {
          success: boolean;
          data: Territory[];
        };
        setTerritories(data.data || []);
      }
    } catch {
      /* API unavailable — show empty */
    } finally {
      setLoading(false);
    }
  }, [apiBase, token]);

  /* Fetch on mount, when token changes, or when parent increments refreshKey */
  // biome-ignore lint/correctness/useExhaustiveDependencies: refreshKey is an intentional refetch trigger prop
  useEffect(() => {
    if (token) {
      void fetchTerritories();
    }
  }, [token, fetchTerritories, refreshKey]);

  const summarizeCriteria = (
    criteria: TerritoryCriteria[] | Record<string, unknown>,
  ): string => {
    if (Array.isArray(criteria)) {
      if (criteria.length === 0) return "No rules";
      return criteria
        .slice(0, 2)
        .map((c) => `${c.field} ${c.operator} ${c.value}`)
        .join(", ")
        .concat(criteria.length > 2 ? ` +${criteria.length - 2} more` : "");
    }
    return "Custom criteria";
  };

  const routingMethodLabel = (method: string): string => {
    switch (method) {
      case "round_robin":
        return "Round Robin";
      case "direct":
        return "Direct";
      default:
        return method;
    }
  };

  if (loading) {
    return (
      <div className="glass-panel" id="territory-list-loading">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "2rem",
            gap: "0.75rem",
          }}
        >
          <div
            style={{
              width: "20px",
              height: "20px",
              borderRadius: "50%",
              border: "2px solid var(--accent-primary)",
              borderTopColor: "transparent",
              animation: "spin 0.8s linear infinite",
            }}
          />
          <span style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
            Loading territories…
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-panel" id="territory-list-panel">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1.25rem",
        }}
      >
        <h3
          style={{
            fontSize: "1.15rem",
            fontWeight: 700,
            background: "var(--accent-gradient)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          Territories
        </h3>
        <button
          type="button"
          id="territory-create-btn"
          className="glass-btn"
          style={{ padding: "0.5rem 1rem", fontSize: "0.8rem" }}
          onClick={onCreateNew}
        >
          + New Territory
        </button>
      </div>

      {territories.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "2.5rem 1rem",
            color: "var(--text-muted)",
          }}
        >
          <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>🗺️</div>
          <p style={{ fontSize: "0.95rem", fontWeight: 500 }}>
            No territories configured yet
          </p>
          <p style={{ fontSize: "0.8rem", marginTop: "0.25rem" }}>
            Create your first territory to start routing accounts.
          </p>
        </div>
      ) : (
        <div
          style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
        >
          {territories.map((t) => {
            const isSelected = selectedTerritoryId === t.id;
            return (
              <button
                key={t.id}
                type="button"
                id={`territory-item-${t.id}`}
                aria-pressed={isSelected}
                onClick={() => onSelectTerritory(t)}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.4rem",
                  padding: "0.85rem 1rem",
                  borderRadius: "10px",
                  border: isSelected
                    ? "1px solid var(--accent-primary)"
                    : "1px solid var(--glass-border)",
                  background: isSelected
                    ? "rgba(99, 102, 241, 0.08)"
                    : "rgba(255, 255, 255, 0.02)",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 0.2s ease",
                  width: "100%",
                  fontFamily: "inherit",
                  color: "inherit",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>
                    {t.name}
                  </span>
                  <span
                    className="badge"
                    style={{
                      background: t.isActive
                        ? "rgba(16, 185, 129, 0.15)"
                        : "rgba(239, 68, 68, 0.15)",
                      color: t.isActive ? "var(--success)" : "var(--danger)",
                      border: `1px solid ${t.isActive ? "rgba(16, 185, 129, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
                    }}
                  >
                    {t.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                    fontSize: "0.78rem",
                    color: "var(--text-muted)",
                  }}
                >
                  <span
                    style={{
                      padding: "2px 8px",
                      borderRadius: "4px",
                      background: "rgba(99, 102, 241, 0.12)",
                      color: "#818cf8",
                      fontWeight: 500,
                    }}
                  >
                    {routingMethodLabel(t.routingMethod)}
                  </span>
                  <span>{summarizeCriteria(t.criteria)}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
