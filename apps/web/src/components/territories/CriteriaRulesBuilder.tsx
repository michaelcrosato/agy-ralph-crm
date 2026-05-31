"use client";

import type { TerritoryCriteria } from "./TerritoryList";

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

interface CriteriaRulesBuilderProps {
  criteria: TerritoryCriteria[];
  onCriteriaChange: (
    idx: number,
    field: keyof TerritoryCriteria,
    val: string,
  ) => void;
  onAddRow: () => void;
  onRemoveRow: (idx: number) => void;
}

export default function CriteriaRulesBuilder({
  criteria,
  onCriteriaChange,
  onAddRow,
  onRemoveRow,
}: CriteriaRulesBuilderProps) {
  return (
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
          onClick={onAddRow}
        >
          + Add Rule
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
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
              onChange={(e) => onCriteriaChange(idx, "field", e.target.value)}
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
                onCriteriaChange(idx, "operator", e.target.value)
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
              onChange={(e) => onCriteriaChange(idx, "value", e.target.value)}
              placeholder="Value…"
              style={{ fontSize: "0.82rem", padding: "0.5rem" }}
            />
            <button
              type="button"
              aria-label={`Remove rule ${idx + 1}`}
              onClick={() => onRemoveRow(idx)}
              disabled={criteria.length <= 1}
              style={{
                background: "none",
                border: "none",
                color:
                  criteria.length <= 1 ? "var(--text-muted)" : "var(--danger)",
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
  );
}
