"use client";

import { useCallback, useEffect, useState } from "react";

interface Account {
  id: string;
  orgId: string;
  name: string;
  ownerId: string;
  custom?: Record<string, unknown> | null;
}

interface RoutingResult {
  success: boolean;
  data?: Account;
  message?: string;
  matchInfo?: {
    territoryId: string;
    newOwnerId: string;
  };
}

interface RoutingSimulatorProps {
  token: string;
  apiBase: string;
}

export default function RoutingSimulator({
  token,
  apiBase,
}: RoutingSimulatorProps) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(
    null,
  );
  const [routingResult, setRoutingResult] = useState<RoutingResult | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [routing, setRouting] = useState(false);

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/accounts`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = (await res.json()) as { data: Account[] };
        setAccounts(data.data || []);
      }
    } catch {
      /* Offline fallback */
    } finally {
      setLoading(false);
    }
  }, [apiBase, token]);

  useEffect(() => {
    if (token) {
      void fetchAccounts();
    }
  }, [token, fetchAccounts]);

  const handleRoute = async () => {
    if (!selectedAccountId) return;
    setRouting(true);
    setRoutingResult(null);
    try {
      const res = await fetch(
        `${apiBase}/api/accounts/${selectedAccountId}/route`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
      );
      const data = (await res.json()) as RoutingResult;
      setRoutingResult(data);

      /* Refresh accounts to show updated owner */
      void fetchAccounts();
    } catch {
      setRoutingResult({
        success: false,
        message: "Failed to connect to the routing engine.",
      });
    } finally {
      setRouting(false);
    }
  };

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);

  return (
    <div className="glass-panel" id="routing-simulator-panel">
      <h3
        style={{
          fontSize: "1.15rem",
          fontWeight: 700,
          marginBottom: "1rem",
          background: "var(--accent-gradient)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}
      >
        ⚡ Account Routing Simulator
      </h3>
      <p
        style={{
          fontSize: "0.82rem",
          color: "var(--text-secondary)",
          marginBottom: "1.25rem",
          lineHeight: 1.6,
        }}
      >
        Select an account and execute the territory routing engine in real-time.
        The system will evaluate all active territory criteria rules and assign
        the account to the matched territory owner.
      </p>

      {loading ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "1rem",
            color: "var(--text-muted)",
          }}
        >
          <div
            style={{
              width: "16px",
              height: "16px",
              borderRadius: "50%",
              border: "2px solid var(--accent-primary)",
              borderTopColor: "transparent",
              animation: "spin 0.8s linear infinite",
            }}
          />
          <span style={{ fontSize: "0.85rem" }}>Loading accounts…</span>
        </div>
      ) : accounts.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "2rem",
            color: "var(--text-muted)",
          }}
        >
          <p style={{ fontSize: "0.9rem" }}>No accounts available.</p>
          <p style={{ fontSize: "0.78rem", marginTop: "0.25rem" }}>
            Create accounts in the Accounts module to use the simulator.
          </p>
        </div>
      ) : (
        <>
          {/* Account Selector */}
          <div style={{ marginBottom: "1rem" }}>
            <label
              htmlFor="simulator-account-select"
              style={{
                fontSize: "0.75rem",
                color: "var(--text-secondary)",
                fontWeight: 600,
                display: "block",
                marginBottom: "4px",
              }}
            >
              Select Account
            </label>
            <select
              id="simulator-account-select"
              className="glass-input"
              value={selectedAccountId || ""}
              onChange={(e) => setSelectedAccountId(e.target.value || null)}
              style={{ cursor: "pointer" }}
            >
              <option value="">— Choose an account —</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} (Owner: {a.ownerId})
                </option>
              ))}
            </select>
          </div>

          {/* Selected Account Preview */}
          {selectedAccount && (
            <div
              style={{
                padding: "0.75rem 1rem",
                borderRadius: "10px",
                background: "rgba(99, 102, 241, 0.06)",
                border: "1px solid rgba(99, 102, 241, 0.15)",
                marginBottom: "1rem",
                fontSize: "0.82rem",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "auto 1fr",
                  gap: "0.3rem 1rem",
                }}
              >
                <span style={{ color: "var(--text-muted)", fontWeight: 500 }}>
                  ID:
                </span>
                <span>{selectedAccount.id}</span>
                <span style={{ color: "var(--text-muted)", fontWeight: 500 }}>
                  Name:
                </span>
                <span style={{ fontWeight: 600 }}>{selectedAccount.name}</span>
                <span style={{ color: "var(--text-muted)", fontWeight: 500 }}>
                  Owner:
                </span>
                <span>{selectedAccount.ownerId}</span>
                {selectedAccount.custom && (
                  <>
                    <span
                      style={{
                        color: "var(--text-muted)",
                        fontWeight: 500,
                      }}
                    >
                      Custom:
                    </span>
                    <span
                      style={{
                        fontFamily: "monospace",
                        fontSize: "0.75rem",
                        color: "var(--text-secondary)",
                      }}
                    >
                      {JSON.stringify(selectedAccount.custom)}
                    </span>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Execute Button */}
          <button
            type="button"
            id="simulator-route-btn"
            className="glass-btn"
            onClick={handleRoute}
            disabled={!selectedAccountId || routing}
            style={{
              width: "100%",
              padding: "0.75rem",
              fontSize: "0.9rem",
              marginBottom: "1rem",
            }}
          >
            {routing
              ? "⏳ Evaluating Territory Rules…"
              : "🚀 Execute Territory Routing"}
          </button>

          {/* Routing Result */}
          {routingResult && (
            <div
              style={{
                padding: "1rem",
                borderRadius: "10px",
                background: routingResult.success
                  ? "rgba(16, 185, 129, 0.06)"
                  : "rgba(239, 68, 68, 0.06)",
                border: `1px solid ${routingResult.success ? "rgba(16, 185, 129, 0.2)" : "rgba(239, 68, 68, 0.2)"}`,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  marginBottom: "0.5rem",
                }}
              >
                <span style={{ fontSize: "1.2rem" }}>
                  {routingResult.success ? "✅" : "⚠️"}
                </span>
                <span
                  style={{
                    fontWeight: 700,
                    fontSize: "0.9rem",
                    color: routingResult.success
                      ? "var(--success)"
                      : "var(--warning)",
                  }}
                >
                  {routingResult.success
                    ? "Routing Successful"
                    : "Routing Failed"}
                </span>
              </div>

              {routingResult.success && routingResult.matchInfo ? (
                <div
                  style={{
                    fontSize: "0.82rem",
                    display: "grid",
                    gridTemplateColumns: "auto 1fr",
                    gap: "0.25rem 1rem",
                  }}
                >
                  <span
                    style={{
                      color: "var(--text-muted)",
                      fontWeight: 500,
                    }}
                  >
                    Territory:
                  </span>
                  <span style={{ fontFamily: "monospace" }}>
                    {routingResult.matchInfo.territoryId}
                  </span>
                  <span
                    style={{
                      color: "var(--text-muted)",
                      fontWeight: 500,
                    }}
                  >
                    New Owner:
                  </span>
                  <span
                    style={{
                      fontWeight: 600,
                      color: "var(--success)",
                    }}
                  >
                    {routingResult.matchInfo.newOwnerId}
                  </span>
                </div>
              ) : (
                <p
                  style={{
                    fontSize: "0.82rem",
                    color: "var(--text-secondary)",
                  }}
                >
                  {routingResult.message || "No matching territory found."}
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
