"use client";

import type React from "react";
import { useState } from "react";

interface Activity {
  id: string;
  type: string;
  subject: string;
  body: string;
  sender: "Lead" | "Bot";
  createdAt: string;
}

interface ConversationSimulatorProps {
  history: Activity[];
  simulating: boolean;
  botNextQuery: string | null;
  onSimulate: (message: string, type: "email" | "sms") => Promise<void>;
}

export default function ConversationSimulator({
  history,
  simulating,
  botNextQuery,
  onSimulate,
}: ConversationSimulatorProps) {
  const [message, setMessage] = useState("");
  const [type, setType] = useState<"email" | "sms">("email");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || simulating) return;
    await onSimulate(message.trim(), type);
    setMessage("");
  };

  const quickTriggers = [
    {
      label: "💰 High Budget",
      text: "Our budget is $20,000 for the core setup.",
    },
    {
      label: "🔑 VP Role",
      text: "Yes, I am the VP of Sales and make the choice.",
    },
    {
      label: "🎯 CRM Need",
      text: "We need custom layouts and picklist validation rules.",
    },
    {
      label: "📅 ASAP Timeline",
      text: "We need to deploy this platform ASAP.",
    },
    {
      label: "❌ Disqualify",
      text: "We have zero budget and want it for free.",
    },
  ];

  return (
    <div
      className="glass-panel"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "1.5rem",
        height: "100%",
      }}
    >
      {/* Title */}
      <div>
        <h2
          style={{
            fontSize: "1.5rem",
            color: "#f8fafc",
            marginBottom: "0.25rem",
          }}
        >
          Conversation Simulator
        </h2>
        <p style={{ color: "#94a3b8", fontSize: "0.875rem" }}>
          Simulate client messages and observe the qualification loop
        </p>
      </div>

      {/* Chat History Pane */}
      <div
        style={{
          flex: 1,
          minHeight: "300px",
          maxHeight: "450px",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
          padding: "1rem",
          borderRadius: "12px",
          backgroundColor: "rgba(15, 23, 42, 0.45)",
          border: "1px solid rgba(255, 255, 255, 0.05)",
        }}
      >
        {history.length === 0 ? (
          <div
            style={{
              height: "100%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              color: "#64748b",
              textAlign: "center",
              padding: "2rem",
              gap: "0.75rem",
            }}
          >
            <span style={{ fontSize: "2rem" }}>💬</span>
            <p style={{ fontSize: "0.9rem" }}>
              No conversation history recorded yet.
              <br />
              Use the simulator below to submit the first simulated lead
              inquiry!
            </p>
          </div>
        ) : (
          history.map((act) => {
            const isLead = act.sender === "Lead";
            return (
              <div
                key={act.id}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: isLead ? "flex-end" : "flex-start",
                  width: "100%",
                }}
              >
                {/* Sender Indicator */}
                <span
                  style={{
                    fontSize: "0.7rem",
                    color: isLead ? "#818cf8" : "#a855f7",
                    marginBottom: "0.25rem",
                    fontWeight: "600",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.25rem",
                  }}
                >
                  {isLead ? "👤 Client (Lead)" : "🤖 CRM Autopilot"}
                  <span style={{ color: "#64748b", fontWeight: "normal" }}>
                    ·{" "}
                    {new Date(act.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}{" "}
                    via {act.type.toUpperCase()}
                  </span>
                </span>

                {/* Message Balloon */}
                <div
                  style={{
                    maxWidth: "85%",
                    padding: "0.75rem 1rem",
                    borderRadius: "12px",
                    borderTopRightRadius: isLead ? "2px" : "12px",
                    borderTopLeftRadius: isLead ? "12px" : "2px",
                    backgroundColor: isLead
                      ? "rgba(99, 102, 241, 0.15)"
                      : "rgba(255, 255, 255, 0.03)",
                    border: isLead
                      ? "1px solid rgba(99, 102, 241, 0.3)"
                      : "1px solid rgba(255,255,255,0.06)",
                    color: "#f8fafc",
                    fontSize: "0.875rem",
                    lineHeight: "1.4",
                    boxShadow: isLead
                      ? "0 4px 12px rgba(99, 102, 241, 0.05)"
                      : "none",
                  }}
                >
                  {act.body}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Suggested Bot Follow-up */}
      {botNextQuery && (
        <div
          style={{
            padding: "0.75rem 1rem",
            borderRadius: "8px",
            backgroundColor: "rgba(168, 85, 247, 0.06)",
            border: "1px solid rgba(168, 85, 247, 0.15)",
            fontSize: "0.8rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.25rem",
          }}
        >
          <span
            style={{
              color: "#c084fc",
              fontWeight: "600",
              display: "flex",
              alignItems: "center",
              gap: "0.25rem",
            }}
          >
            ✨ Bot Next Target Objective
          </span>
          <p style={{ color: "#94a3b8", fontStyle: "italic" }}>
            "{botNextQuery}"
          </p>
        </div>
      )}

      {/* Simulation Form */}
      <form
        onSubmit={handleSubmit}
        style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
      >
        {/* Quick Triggers */}
        <div
          style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
        >
          <span
            style={{
              fontSize: "0.75rem",
              color: "#64748b",
              fontWeight: "600",
              textTransform: "uppercase",
            }}
          >
            Quick Simulated Triggers
          </span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            {quickTriggers.map((t) => (
              <button
                key={t.label}
                type="button"
                className="glass-btn glass-btn-secondary"
                style={{
                  padding: "0.35rem 0.75rem",
                  borderRadius: "20px",
                  fontSize: "0.75rem",
                }}
                onClick={() => setMessage(t.text)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Input Text Box */}
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as "email" | "sms")}
            className="glass-input"
            style={{ width: "90px", padding: "0.5rem" }}
          >
            <option value="email">Email</option>
            <option value="sms">SMS</option>
          </select>

          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type a simulated message from the lead..."
            className="glass-input"
            style={{ flex: 1 }}
            disabled={simulating}
          />

          <button
            type="submit"
            className="glass-btn"
            disabled={simulating || !message.trim()}
            style={{ minWidth: "120px" }}
          >
            {simulating ? "Processing..." : "Send Inbound"}
          </button>
        </div>
      </form>
    </div>
  );
}
