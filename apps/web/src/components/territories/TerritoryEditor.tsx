"use client";

import { useCallback, useEffect, useState } from "react";
import CriteriaRulesBuilder from "./CriteriaRulesBuilder";
import MembersGrid from "./MembersGrid";
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
      await fetch(`${apiBase}/api/sales-ops/territories`, {
        headers: { Authorization: `Bearer ${token}` },
      });
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
      <CriteriaRulesBuilder
        criteria={criteria}
        onCriteriaChange={handleCriteriaChange}
        onAddRow={addCriteriaRow}
        onRemoveRow={removeCriteriaRow}
      />

      {/* Members Grid (only for existing territories) */}
      {!isCreating && territory && (
        <MembersGrid
          token={token}
          apiBase={apiBase}
          territoryId={territory.id}
          members={members}
          onMembersChange={setMembers}
          loadingMembers={loadingMembers}
        />
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
