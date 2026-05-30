import { createApiClient } from "@crm/api-client";

export const dynamic = "force-dynamic";

interface Lead {
  id: string;
  orgId: string;
  email: string | null;
  company: string | null;
  status: string;
  custom?: Record<string, unknown> | null;
}

export default async function LeadsPage() {
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

  // Obtain token using the standard system token auth route or a default token
  const authRes = await fetch(`${API_BASE}/api/auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      orgId: "org-acme-corp",
      userId: "user-a",
    }),
  });
  const authData = (await authRes.json()) as { token: string };
  const token = authData.token;

  const client = createApiClient(API_BASE, { getToken: () => token });
  const leadsRes = await client.api.leads.$get();
  const leadsData = (await leadsRes.json()) as { data: Lead[] };
  const leads = leadsData.data || [];

  return (
    <div
      style={{
        padding: "2rem",
        fontFamily: "sans-serif",
        backgroundColor: "#0b0f19",
        color: "#f3f4f6",
        minHeight: "100vh",
      }}
    >
      <h1
        style={{
          fontSize: "2rem",
          fontWeight: "bold",
          marginBottom: "1.5rem",
          color: "#f3f4f6",
        }}
      >
        Leads (Server Component)
      </h1>
      <div
        style={{
          display: "grid",
          gap: "1rem",
          gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
        }}
      >
        {leads.map((lead: Lead) => (
          <div
            key={lead.id}
            style={{
              padding: "1.5rem",
              borderRadius: "8px",
              backgroundColor: "#1f2937",
              border: "1px solid #374151",
            }}
          >
            <h3 style={{ margin: 0, fontSize: "1.2rem", color: "#ffffff" }}>
              {lead.company || "No Company"}
            </h3>
            <p style={{ margin: "0.5rem 0", color: "#9ca3af" }}>{lead.email}</p>
            <span
              style={{
                inlineSize: "fit-content",
                padding: "0.25rem 0.75rem",
                borderRadius: "9999px",
                fontSize: "0.875rem",
                backgroundColor: "#374151",
                color: "#f3f4f6",
              }}
            >
              {lead.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
