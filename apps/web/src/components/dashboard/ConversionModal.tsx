import type { Lead } from "../../types/crm";

interface ConversionModalProps {
  convertingLead: Lead;
  conversionStageName: string;
  onConversionStageNameChange: (name: string) => void;
  conversionStageAmount: string;
  onConversionStageAmountChange: (amount: string) => void;
  converting: boolean;
  onConvert: () => void;
  onCancel: () => void;
}

/**
 * Lead conversion modal overlay that creates a Contact + Opportunity
 * from an existing lead record.
 */
export function ConversionModal({
  convertingLead,
  conversionStageName,
  onConversionStageNameChange,
  conversionStageAmount,
  onConversionStageAmountChange,
  converting,
  onConvert,
  onCancel,
}: ConversionModalProps) {
  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0, 0, 0, 0.75)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
    >
      <div
        className="glass-panel"
        style={{
          maxWidth: "450px",
          width: "90%",
          padding: "2rem",
          margin: "auto",
        }}
      >
        <h3
          style={{
            fontSize: "1.3rem",
            fontWeight: 800,
            marginBottom: "1rem",
            background: "var(--accent-gradient)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          Lead Conversion Suite
        </h3>
        <p
          style={{
            fontSize: "0.9rem",
            color: "var(--text-secondary)",
            marginBottom: "1.5rem",
          }}
        >
          Converting <strong>{convertingLead.email}</strong> will map
          organization context, register a new active Account and Contact, and
          establish a Deal pipeline.
        </p>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
            marginBottom: "1.5rem",
          }}
        >
          <div>
            <label
              style={{
                fontSize: "0.75rem",
                color: "var(--text-secondary)",
                fontWeight: 600,
                display: "block",
                marginBottom: "4px",
              }}
            >
              Opportunity Deal Name
              <input
                type="text"
                className="glass-input"
                value={conversionStageName}
                onChange={(e) => onConversionStageNameChange(e.target.value)}
                placeholder="Enter opportunity name..."
                style={{ marginTop: "4px" }}
              />
            </label>
          </div>

          <div>
            <label
              style={{
                fontSize: "0.75rem",
                color: "var(--text-secondary)",
                fontWeight: 600,
                display: "block",
                marginBottom: "4px",
              }}
            >
              Projected Deal Value ($)
              <input
                type="number"
                className="glass-input"
                value={conversionStageAmount}
                onChange={(e) => onConversionStageAmountChange(e.target.value)}
                placeholder="50000"
                style={{ marginTop: "4px" }}
              />
            </label>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "0.5rem",
          }}
        >
          <button
            type="button"
            className="glass-btn glass-btn-secondary"
            onClick={onCancel}
            disabled={converting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="glass-btn"
            onClick={onConvert}
            disabled={converting}
          >
            {converting ? "Processing..." : "Convert Lead Now"}
          </button>
        </div>
      </div>
    </div>
  );
}
