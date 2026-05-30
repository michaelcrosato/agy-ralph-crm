import { createApiClient } from "@crm/api-client";

export const dynamic = "force-dynamic";

interface Account {
  id: string;
  orgId: string;
  ownerId: string;
  name: string;
}

export default async function AccountsPage() {
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
  const accountsRes = await client.api.accounts.$get();
  const accountsData = (await accountsRes.json()) as { data: Account[] };
  const accounts = accountsData.data || [];

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
        Accounts (Server Component)
      </h1>
      <div
        style={{
          display: "grid",
          gap: "1rem",
          gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
        }}
      >
        {accounts.map((account: Account) => (
          <div
            key={account.id}
            style={{
              padding: "1.5rem",
              borderRadius: "8px",
              backgroundColor: "#1f2937",
              border: "1px solid #374151",
            }}
          >
            <h3 style={{ margin: 0, fontSize: "1.2rem", color: "#ffffff" }}>
              {account.name || "No Name"}
            </h3>
            <p style={{ margin: "0.5rem 0", color: "#9ca3af" }}>
              Owner ID: {account.ownerId}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
