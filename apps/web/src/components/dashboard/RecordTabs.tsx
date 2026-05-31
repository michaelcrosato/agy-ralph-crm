import type { Contact, Lead, Opportunity } from "../../types/crm";

type TabId = "leads" | "contacts" | "opportunities" | "activities";

interface RecordTabsProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  loading: boolean;
  leads: Lead[];
  contacts: Contact[];
  opportunities: Opportunity[];
  onConvertLead: (lead: Lead) => void;
}

/**
 * Tabbed record grids for leads, contacts, and opportunities.
 * Renders the glass-panel tab bar and corresponding data tables.
 */
export function RecordTabs({
  activeTab,
  onTabChange,
  loading,
  leads,
  contacts,
  opportunities,
  onConvertLead,
}: RecordTabsProps) {
  return (
    <div className="glass-panel xl:col-span-2" style={{ gridColumn: "span 2" }}>
      <div
        className="flex border-b border-white/10 mb-4"
        style={{
          display: "flex",
          borderBottom: "1px solid var(--glass-border)",
          marginBottom: "1rem",
        }}
      >
        {(["leads", "contacts", "opportunities"] as const).map((tab) => (
          <button
            type="button"
            key={tab}
            onClick={() => onTabChange(tab)}
            style={{
              background: "none",
              border: "none",
              color:
                activeTab === tab
                  ? "var(--accent-primary)"
                  : "var(--text-secondary)",
              padding: "10px 15px",
              borderBottom:
                activeTab === tab ? "2px solid var(--accent-primary)" : "none",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {tab === "leads"
              ? "Leads Base"
              : tab === "contacts"
                ? "Contacts List"
                : "Opportunities"}
          </button>
        ))}
      </div>

      {loading ? (
        <div
          style={{
            height: "250px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span>Loading secure tenant datasets...</span>
        </div>
      ) : activeTab === "leads" ? (
        <LeadsTable leads={leads} onConvertLead={onConvertLead} />
      ) : activeTab === "contacts" ? (
        <ContactsTable contacts={contacts} />
      ) : (
        <OpportunitiesTable opportunities={opportunities} />
      )}
    </div>
  );
}

/* ── Sub-table components ─────────────────────────────────── */

function LeadsTable({
  leads,
  onConvertLead,
}: {
  leads: Lead[];
  onConvertLead: (lead: Lead) => void;
}) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table className="glass-table">
        <thead>
          <tr>
            <th>Company</th>
            <th>Email</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => (
            <tr key={lead.id}>
              <td style={{ fontWeight: 600 }}>
                {lead.company || "Unknown Company"}
              </td>
              <td>{lead.email || "No Email Provided"}</td>
              <td>
                <span className="badge badge-lead">{lead.status}</span>
              </td>
              <td>
                {lead.status !== "Converted" ? (
                  <button
                    type="button"
                    className="glass-btn"
                    style={{
                      padding: "0.4rem 0.8rem",
                      fontSize: "0.75rem",
                    }}
                    onClick={() => onConvertLead(lead)}
                  >
                    Convert Lead
                  </button>
                ) : (
                  <span
                    style={{
                      color: "var(--text-secondary)",
                      fontSize: "0.8rem",
                    }}
                  >
                    Converted ✔
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ContactsTable({ contacts }: { contacts: Contact[] }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table className="glass-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Type</th>
          </tr>
        </thead>
        <tbody>
          {contacts.map((contact) => (
            <tr key={contact.id}>
              <td style={{ fontWeight: 600 }}>
                {contact.firstName} {contact.lastName}
              </td>
              <td>{contact.email}</td>
              <td>
                <span className="badge badge-contact">Active Contact</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OpportunitiesTable({
  opportunities,
}: {
  opportunities: Opportunity[];
}) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table className="glass-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Stage</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          {opportunities.map((opp) => (
            <tr key={opp.id}>
              <td style={{ fontWeight: 600 }}>{opp.name}</td>
              <td>
                <span className="badge badge-opp">{opp.stage}</span>
              </td>
              <td style={{ fontWeight: "bold" }}>
                $
                {Number(opp.amount || 0).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
