"use client";

import { useCallback, useEffect, useState } from "react";
import type { Territory, TerritoryCriteria } from "./TerritoryList";

interface TerritoryMember {
  id: string;
  orgId: string;
  territoryId: string;
  userId: string;
  role: string;
}

interface TerritoryEditorProps {
  token: string;
  apiBase: string;
  territory: Territory | null;
  isCreating: boolean;
  onSaved: () => void;
  onCancel: () => void;
}

export default function TerritoryEditor({
  token,
  apiBase,
  territory,
  isCreating,
  onSaved,
  onCancel,
}: TerritoryEditorProps) {
  const [name, setName] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [routingMethod, setRoutingMethod] = useState<"direct" | "round_robin">(
    "direct",
  );
  const [criteria, setCriteria] = useState<TerritoryCriteria[]>([
    { field: "", operator: "equals", value: "" },
  ]);
  const [members, setMembers] = useState<TerritoryMember[]>([]);
  const [newMemberUserId, setNewMemberUserId] = useState("");
  const [newMemberRole, setNewMemberRole] = useState("Primary");
  const [saving, setSaving] = useState(false);
  const [loadingMembers, setLoadingMembers] = useState(false);

  /* Populate form when territory changes */
  useEffect(() => {
    if (territory && !isCreating) {
      setName(territory.name);
      setIsActive(!!territory.isActive);
      setRoutingMethod(
        territory.routingMethod === "round_robin" ? "round_robin" : "direct",
      );
      const tc = Array.isArray(territory.criteria)
        ? (territory.criteria as TerritoryCriteria[])
        : [];
      setCriteria(
        tc.length > 0 ? tc : [{ field: "", operator: "equals", value: "" }],
      );
    } else if (isCreating) {
      setName("");
      setIsActive(true);
      setRoutingMethod("direct");
      setCriteria([{ field: "", operator: "equals", value: "" }]);
      setMembers([]);
    }
  }, [territory, isCreating]);

  /* Fetch members for existing territory */
  const fetchMembers = useCallback(async () => {
    if (!territory || isCreating) return;
    setLoadingMembers(true);
    try {
      const res = await fetch(`${apiBase}/api/sales-ops/territories`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        /* Members endpoint is not standalone — we infer from the full list
           But the API only has POST /:id/members and DELETE /:id/members/:userId,
           so we just track locally or re-fetch the full data. For now, keep
           what's loaded or empty. */
      }
    } catch {
      /* Members load failed */
    } finally {
      setLoadingMembers(false);
    }
  }, [apiBase, token, territory, isCreating]);

  useEffect(() => {
    void fetchMembers();
  }, [fetchMembers]);

  const handleCriteriaChange = (
    idx: number,
    field: keyof TerritoryCriteria,
    val: string,
  ) => {
    setCriteria((prev) =>
      prev.map((c, i) => (i === idx ? { ...c, [field]: val } : c)),
    );
  };

  const addCriteriaRow = () => {
    setCriteria((prev) => [
      ...prev,
      { field: "", operator: "equals", value: "" },
    ]);
  };

  const removeCriteriaRow = (idx: number) => {
    setCriteria((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        isActive,
        routingMethod,
        criteria: criteria.filter((c) => c.field.trim() && c.value.trim()),
      };

      const url =
        territory && !isCreating
          ? `${apiBase}/api/sales-ops/territories/${territory.id}`
          : `${apiBase}/api/sales-ops/territories`;
      const method = territory && !isCreating ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        onSaved();
      }
    } catch {
      /* Save failed */
    } finally {
      setSaving(false);
    }
  };

  const handleAddMember = async () => {
    if (!newMemberUserId.trim() || !territory) return;
    try {
      const res = await fetch(
        `${apiBase}/api/sales-ops/territories/${territory.id}/members`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            userId: newMemberUserId.trim(),
            role: newMemberRole,
          }),
        },
      );
      if (res.ok) {
        const data = (await res.json()) as {
          success: boolean;
          data: TerritoryMember;
        };
        setMembers((prev) => [...prev, data.data]);
        setNewMemberUserId("");
      }
    } catch {
      /* Add member failed */
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!territory) return;
    try {
      const res = await fetch(
        `${apiBase}/api/sales-ops/territories/${territory.id}/members/${userId}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (res.ok) {
        setMembers((prev) => prev.filter((m) => m.userId !== userId));
      }
    } catch {
      /* Remove member failed */
    }
  };

  const operatorOptions = [
    { value: "equals", label: "Equals" },
    { value: "not_equals", label: "Not Equals" },
    { value: "contains", label: "Contains" },
    { value: "starts_with", label: "Starts With" },
    { value: "greater_than", label: "Greater Than" },
    { value: "less_than", label: "Less Than" },
  ];

  const fieldSuggestions = [
    "industry",
    "region",
    "country",
    "state",
    "city",
    "annualRevenue",
    "employeeCount",
    "segment",
  ];

  return (
    <div className="glass-panel" id="territory-editor-panel">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1.5rem",
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
          {isCreating ? "Create Territory" : `Edit: ${territory?.name || ""}`}
        </h3>
        <button
          type="button"
          className="glass-btn glass-btn-secondary"
          style={{ padding: "0.4rem 0.8rem", fontSize: "0.78rem" }}
          onClick={onCancel}
        >
          ✕ Close
        </button>
      </div>

      {/* Name + Status Row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto",
          gap: "1rem",
          marginBottom: "1.25rem",
        }}
      >
        <div>
          <label
            htmlFor="territory-name-input"
            style={{
              fontSize: "0.75rem",
              color: "var(--text-secondary)",
              fontWeight: 600,
              display: "block",
              marginBottom: "4px",
            }}
          >
            Territory Name
          </label>
          <input
            id="territory-name-input"
            className="glass-input"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. West Coast Enterprise"
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <span
            style={{
              fontSize: "0.75rem",
              color: "var(--text-secondary)",
              fontWeight: 600,
            }}
          >
            Status
          </span>
          <button
            type="button"
            id="territory-toggle-active"
            onClick={() => setIsActive(!isActive)}
            style={{
              padding: "0.6rem 1.2rem",
              borderRadius: "8px",
              border: "1px solid var(--glass-border)",
              background: isActive
                ? "rgba(16, 185, 129, 0.12)"
                : "rgba(239, 68, 68, 0.12)",
              color: isActive ? "var(--success)" : "var(--danger)",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: "0.85rem",
              fontFamily: "inherit",
              transition: "all 0.2s ease",
            }}
          >
            {isActive ? "● Active" : "○ Inactive"}
          </button>
        </div>
      </div>

      {/* Routing Method */}
      <div style={{ marginBottom: "1.25rem" }}>
        <label
          htmlFor="territory-routing-select"
          style={{
            fontSize: "0.75rem",
            color: "var(--text-secondary)",
            fontWeight: 600,
            display: "block",
            marginBottom: "4px",
          }}
        >
          Routing Method
        </label>
        <select
          id="territory-routing-select"
          className="glass-input"
          value={routingMethod}
          onChange={(e) =>
            setRoutingMethod(e.target.value as "direct" | "round_robin")
          }
          style={{ cursor: "pointer" }}
        >
          <option value="direct">Direct Assignment</option>
          <option value="round_robin">Round Robin</option>
        </select>
      </div>

      {/* Criteria Rules Builder */}
      <div style={{ marginBottom: "1.5rem" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "0.75rem",
          }}
        >
          <span
            style={{
              fontSize: "0.8rem",
              color: "var(--text-secondary)",
              fontWeight: 600,
            }}
          >
            Criteria Rules
          </span>
          <button
            type="button"
            id="territory-add-rule-btn"
            className="glass-btn glass-btn-secondary"
            style={{ padding: "0.3rem 0.7rem", fontSize: "0.72rem" }}
            onClick={addCriteriaRow}
          >
            + Add Rule
          </button>
        </div>

        <div
          style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
        >
          {criteria.map((rule, idx) => (
            <div
              key={`rule-${idx.toString()}`}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr auto",
                gap: "0.5rem",
                alignItems: "center",
              }}
            >
              <select
                aria-label={`Rule ${idx + 1} field`}
                className="glass-input"
                value={rule.field}
                onChange={(e) =>
                  handleCriteriaChange(idx, "field", e.target.value)
                }
                style={{ fontSize: "0.82rem", padding: "0.5rem" }}
              >
                <option value="">Select Field…</option>
                {fieldSuggestions.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
              <select
                aria-label={`Rule ${idx + 1} operator`}
                className="glass-input"
                value={rule.operator}
                onChange={(e) =>
                  handleCriteriaChange(idx, "operator", e.target.value)
                }
                style={{ fontSize: "0.82rem", padding: "0.5rem" }}
              >
                {operatorOptions.map((op) => (
                  <option key={op.value} value={op.value}>
                    {op.label}
                  </option>
                ))}
              </select>
              <input
                aria-label={`Rule ${idx + 1} value`}
                className="glass-input"
                type="text"
                value={rule.value}
                onChange={(e) =>
                  handleCriteriaChange(idx, "value", e.target.value)
                }
                placeholder="Value…"
                style={{ fontSize: "0.82rem", padding: "0.5rem" }}
              />
              <button
                type="button"
                aria-label={`Remove rule ${idx + 1}`}
                onClick={() => removeCriteriaRow(idx)}
                disabled={criteria.length <= 1}
                style={{
                  background: "none",
                  border: "none",
                  color:
                    criteria.length <= 1
                      ? "var(--text-muted)"
                      : "var(--danger)",
                  cursor: criteria.length <= 1 ? "default" : "pointer",
                  fontSize: "1.1rem",
                  padding: "0.3rem",
                  fontFamily: "inherit",
                }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Members Grid (only for existing territories) */}
      {!isCreating && territory && (
        <div style={{ marginBottom: "1.5rem" }}>
          <span
            style={{
              fontSize: "0.8rem",
              color: "var(--text-secondary)",
              fontWeight: 600,
              display: "block",
              marginBottom: "0.75rem",
            }}
          >
            Assigned Members
          </span>

          {loadingMembers ? (
            <p
              style={{
                fontSize: "0.8rem",
                color: "var(--text-muted)",
                padding: "0.5rem 0",
              }}
            >
              Loading members…
            </p>
          ) : (
            <>
              {members.length > 0 && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.4rem",
                    marginBottom: "0.75rem",
                  }}
                >
                  {members.map((m) => (
                    <div
                      key={m.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "0.5rem 0.75rem",
                        borderRadius: "8px",
                        background: "rgba(255, 255, 255, 0.03)",
                        border: "1px solid var(--glass-border)",
                      }}
                    >
                      <div>
                        <span
                          style={{
                            fontWeight: 500,
                            fontSize: "0.85rem",
                            marginRight: "0.5rem",
                          }}
                        >
                          {m.userId}
                        </span>
                        <span
                          className="badge"
                          style={{
                            background: "rgba(99, 102, 241, 0.12)",
                            color: "#818cf8",
                            border: "1px solid rgba(99, 102, 241, 0.25)",
                          }}
                        >
                          {m.role}
                        </span>
                      </div>
                      <button
                        type="button"
                        aria-label={`Remove member ${m.userId}`}
                        onClick={() => handleRemoveMember(m.userId)}
                        style={{
                          background: "none",
                          border: "none",
                          color: "var(--danger)",
                          cursor: "pointer",
                          fontSize: "0.8rem",
                          fontFamily: "inherit",
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add Member Form */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto auto",
                  gap: "0.5rem",
                  alignItems: "end",
                }}
              >
                <div>
                  <label
                    htmlFor="member-user-id-input"
                    style={{
                      fontSize: "0.7rem",
                      color: "var(--text-muted)",
                      display: "block",
                      marginBottom: "2px",
                    }}
                  >
                    User ID
                  </label>
                  <input
                    id="member-user-id-input"
                    className="glass-input"
                    type="text"
                    value={newMemberUserId}
                    onChange={(e) => setNewMemberUserId(e.target.value)}
                    placeholder="e.g. user-a"
                    style={{ fontSize: "0.82rem", padding: "0.5rem" }}
                  />
                </div>
                <div>
                  <label
                    htmlFor="member-role-select"
                    style={{
                      fontSize: "0.7rem",
                      color: "var(--text-muted)",
                      display: "block",
                      marginBottom: "2px",
                    }}
                  >
                    Role
                  </label>
                  <select
                    id="member-role-select"
                    className="glass-input"
                    value={newMemberRole}
                    onChange={(e) => setNewMemberRole(e.target.value)}
                    style={{
                      fontSize: "0.82rem",
                      padding: "0.5rem",
                      cursor: "pointer",
                    }}
                  >
                    <option value="Primary">Primary</option>
                    <option value="Secondary">Secondary</option>
                    <option value="Backup">Backup</option>
                  </select>
                </div>
                <button
                  type="button"
                  id="territory-add-member-btn"
                  className="glass-btn"
                  style={{ padding: "0.5rem 1rem", fontSize: "0.78rem" }}
                  onClick={handleAddMember}
                  disabled={!newMemberUserId.trim()}
                >
                  + Add
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Save Button */}
      <div
        style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}
      >
        <button
          type="button"
          className="glass-btn glass-btn-secondary"
          onClick={onCancel}
          disabled={saving}
          style={{ padding: "0.6rem 1.2rem", fontSize: "0.85rem" }}
        >
          Cancel
        </button>
        <button
          type="button"
          id="territory-save-btn"
          className="glass-btn"
          onClick={handleSave}
          disabled={saving || !name.trim()}
          style={{ padding: "0.6rem 1.5rem", fontSize: "0.85rem" }}
        >
          {saving
            ? "Saving…"
            : isCreating
              ? "Create Territory"
              : "Save Changes"}
        </button>
      </div>
    </div>
  );
}
