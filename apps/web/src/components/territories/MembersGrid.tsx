"use client";

import { useState } from "react";

interface TerritoryMember {
  id: string;
  orgId: string;
  territoryId: string;
  userId: string;
  role: string;
}

interface MembersGridProps {
  token: string;
  apiBase: string;
  territoryId: string;
  members: TerritoryMember[];
  onMembersChange: (members: TerritoryMember[]) => void;
  loadingMembers: boolean;
}

export default function MembersGrid({
  token,
  apiBase,
  territoryId,
  members,
  onMembersChange,
  loadingMembers,
}: MembersGridProps) {
  const [newMemberUserId, setNewMemberUserId] = useState("");
  const [newMemberRole, setNewMemberRole] = useState("Primary");

  const handleAddMember = async () => {
    if (!newMemberUserId.trim()) return;
    try {
      const res = await fetch(
        `${apiBase}/api/sales-ops/territories/${territoryId}/members`,
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
        onMembersChange([...members, data.data]);
        setNewMemberUserId("");
      }
    } catch {
      /* Add member failed */
    }
  };

  const handleRemoveMember = async (userId: string) => {
    try {
      const res = await fetch(
        `${apiBase}/api/sales-ops/territories/${territoryId}/members/${userId}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (res.ok) {
        onMembersChange(members.filter((m) => m.userId !== userId));
      }
    } catch {
      /* Remove member failed */
    }
  };

  return (
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
  );
}
