"use client";

import { createApiClient } from "@crm/api-client";
import { useCallback, useEffect, useState } from "react";

import { ActivityFeed } from "../components/dashboard/ActivityFeed";
import { ConversionModal } from "../components/dashboard/ConversionModal";
import { MetricsGrid } from "../components/dashboard/MetricsGrid";
import { RecordTabs } from "../components/dashboard/RecordTabs";
import { SearchBar } from "../components/dashboard/SearchBar";
import { MOCK_DATA } from "../data/mock-tenants";
import type {
  Activity,
  Contact,
  Lead,
  Opportunity,
  SearchResult,
  TenantId,
} from "../types/crm";

const API_BASE = "http://localhost:3001";

export default function Home() {
  const [tenant, setTenant] = useState<TenantId>("org-acme-corp");
  const [token, setToken] = useState<string>("");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [recentActivities, setRecentActivities] = useState<Activity[]>([]);

  const [loading, setLoading] = useState(true);
  const [apiLive, setApiLive] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "leads" | "contacts" | "opportunities" | "activities"
  >("leads");

  // Lead conversion modal & status state
  const [convertingLead, setConvertingLead] = useState<Lead | null>(null);
  const [conversionStageName, setConversionStageName] = useState("");
  const [conversionStageAmount, setConversionStageAmount] = useState("50000");
  const [converting, setConverting] = useState(false);

  // Search State
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);

  // General data loading helper — useCallback so identity is stable across renders.
  const refreshData = useCallback(async (activeToken: string) => {
    try {
      const client = createApiClient(API_BASE, { getToken: () => activeToken });

      const [leadsRes, contactsRes, oppsRes] = await Promise.all([
        client.api.leads.$get(),
        client.api.contacts.$get(),
        client.api.opportunities.$get(),
      ]);

      const [leadsData, contactsData, oppsData] = await Promise.all([
        leadsRes.json(),
        contactsRes.json(),
        oppsRes.json(),
      ]);

      setLeads(leadsData.data || []);
      setContacts(contactsData.data || []);
      setOpportunities(oppsData.data || []);

      // Grab some recent audit logs as activities
      setRecentActivities([
        {
          id: "act-1",
          action: "Query Workspace",
          recordType: "Database",
          createdAt: new Date().toISOString(),
          changes: { origin: { after: "Live Server" } },
        },
      ]);
    } catch (e) {
      console.error("Failed to refresh live server data", e);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch token for current tenant
  useEffect(() => {
    async function initAuthAndFetch() {
      setLoading(true);
      try {
        const credentials =
          tenant === "org-acme-corp"
            ? {
                userId: "user-acme",
                orgId: "org-acme-corp",
                roleId: "role-acme",
                permissionsMask: 15,
              }
            : {
                userId: "user-tech",
                orgId: "org-tech-llc",
                roleId: "role-tech",
                permissionsMask: 15,
              };

        const authRes = await fetch(`${API_BASE}/api/auth/token`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(credentials),
        });

        if (!authRes.ok) throw new Error("Authentication failed");
        const authData = await authRes.json();
        const activeToken = authData.token;
        setToken(activeToken);
        setApiLive(true);

        await refreshData(activeToken);
      } catch (err) {
        console.warn(
          "[Hono Connection Warning] API is offline. Using local browser context engine.",
          err,
        );
        setApiLive(false);
        const fallback = MOCK_DATA[tenant];
        setLeads(fallback.leads);
        setContacts(fallback.contacts);
        setOpportunities(fallback.opportunities);
        setRecentActivities([
          {
            id: "act-1",
            action: "Tenant Swapped",
            recordType: "System",
            createdAt: new Date().toISOString(),
            changes: { orgName: { after: fallback.name } },
          },
        ]);
        setLoading(false);
      }
    }

    void initAuthAndFetch();
  }, [tenant, refreshData]);

  // Handle lead conversion
  async function handleConvertLead() {
    if (!convertingLead) return;
    setConverting(true);

    try {
      if (apiLive && token) {
        const res = await fetch(
          `${API_BASE}/api/leads/${convertingLead.id}/convert`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              opportunityName:
                conversionStageName ||
                `${convertingLead.company || "Company"} Deal`,
              opportunityAmount: conversionStageAmount,
            }),
          },
        );

        if (!res.ok) throw new Error("Conversion failed");
        await refreshData(token);
      } else {
        // Mock client-side conversion
        const convertedId = convertingLead.id;
        setLeads((prev) => prev.filter((l) => l.id !== convertedId));

        const newContact: Contact = {
          id: `contact-mock-${Date.now()}`,
          orgId: tenant,
          firstName: convertingLead.email?.split("@")[0] || "Converted",
          lastName: "Contact",
          email: convertingLead.email,
        };

        const newOpp: Opportunity = {
          id: `opp-mock-${Date.now()}`,
          orgId: tenant,
          name:
            conversionStageName ||
            `${convertingLead.company || "Company"} Deal`,
          amount: Number(conversionStageAmount).toFixed(2),
          stage: "Qualification",
        };

        setContacts((prev) => [...prev, newContact]);
        setOpportunities((prev) => [...prev, newOpp]);
        setRecentActivities((prev) => [
          {
            id: `act-${Date.now()}`,
            action: "Convert",
            recordType: "Lead",
            createdAt: new Date().toISOString(),
            changes: { status: { before: "New", after: "Converted" } },
          },
          ...prev,
        ]);
      }

      setConvertingLead(null);
      setConversionStageName("");
    } catch (_e) {
      alert("Error converting lead. Please check Hono is active.");
    } finally {
      setConverting(false);
    }
  }

  // Execute fuzzy search
  useEffect(() => {
    if (searchQuery.trim().length === 0) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    const handler = setTimeout(async () => {
      if (apiLive && token) {
        try {
          const res = await fetch(
            `${API_BASE}/api/search?q=${encodeURIComponent(searchQuery)}`,
            {
              headers: { Authorization: `Bearer ${token}` },
            },
          );
          const body = await res.json();
          if (body.success) {
            setSearchResults(
              body.data.map(
                (x: {
                  id: string;
                  type: string;
                  title: string;
                  subtitle?: string;
                }) => ({
                  id: x.id,
                  type: x.type,
                  title: x.title,
                  subtitle: x.subtitle || "",
                }),
              ),
            );
            setShowSearchResults(true);
          }
        } catch (_e) {
          setShowSearchResults(false);
        }
      } else {
        // Fallback local mock search filter
        const fallback = MOCK_DATA[tenant];
        const query = searchQuery.toLowerCase();

        const matchingLeads = fallback.leads
          .filter(
            (l) =>
              l.email?.toLowerCase().includes(query) ||
              l.company?.toLowerCase().includes(query),
          )
          .map((l) => ({
            id: l.id,
            type: "Lead",
            title: l.company || "Company",
            subtitle: l.email || "",
          }));

        const matchingContacts = fallback.contacts
          .filter(
            (c) =>
              c.firstName?.toLowerCase().includes(query) ||
              c.lastName?.toLowerCase().includes(query) ||
              c.email?.toLowerCase().includes(query),
          )
          .map((c) => ({
            id: c.id,
            type: "Contact",
            title: `${c.firstName} ${c.lastName}`,
            subtitle: c.email || "",
          }));

        const matchingOpps = fallback.opportunities
          .filter(
            (o) =>
              o.name.toLowerCase().includes(query) ||
              o.stage.toLowerCase().includes(query),
          )
          .map((o) => ({
            id: o.id,
            type: "Opportunity",
            title: o.name,
            subtitle: `$${o.amount || "0"} - ${o.stage}`,
          }));

        setSearchResults(
          [...matchingLeads, ...matchingContacts, ...matchingOpps].slice(0, 5),
        );
        setShowSearchResults(true);
      }
    }, 150);

    return () => clearTimeout(handler);
  }, [searchQuery, apiLive, token, tenant]);

  return (
    <main className="relative min-height-screen p-6 md:p-12">
      {/* Visual glowing spotlight bubbles */}
      <div
        className="glow-spotlight pulsing-orb"
        style={{ top: "5%", left: "10%" }}
      />
      <div
        className="glow-spotlight pulsing-orb"
        style={{
          bottom: "10%",
          right: "5%",
          background:
            "radial-gradient(circle, rgba(168, 85, 247, 0.15) 0%, rgba(168, 85, 247, 0) 70%)",
        }}
      />

      <div
        style={{
          position: "relative",
          zIndex: 10,
          maxWidth: "1400px",
          margin: "0 auto",
        }}
      >
        {/* TOP NAVBAR PANEL */}
        <header
          className="glass-panel mb-8 flex flex-col md:flex-row items-center justify-between gap-6"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "1.5rem",
          }}
        >
          <div>
            <div className="flex items-center gap-3">
              <span className="badge badge-opp">Core Engine</span>
              <span
                className={`badge ${apiLive ? "badge-contact" : "badge-lead"}`}
              >
                {apiLive ? "Live Server Connected" : "Local Engine Sandbox"}
              </span>
            </div>
            <h1
              className="text-3xl font-extrabold mt-1"
              style={{
                fontSize: "2rem",
                background: "var(--accent-gradient)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Ralph Autonomous CRM Core
            </h1>
          </div>

          <div
            className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto"
            style={{ display: "flex", alignItems: "center", gap: "1rem" }}
          >
            {/* Real-time Fuzzy Search Bar */}
            <SearchBar
              searchQuery={searchQuery}
              onSearchQueryChange={setSearchQuery}
              searchResults={searchResults}
              showSearchResults={showSearchResults}
              onShowSearchResults={setShowSearchResults}
            />

            {/* Tenant Workspace Dropdown Selector */}
            <div
              style={{ display: "flex", flexDirection: "column", gap: "2px" }}
            >
              <select
                aria-label="Workspace Selector"
                className="glass-input cursor-pointer"
                value={tenant}
                onChange={(e) => setTenant(e.target.value as TenantId)}
                style={{ paddingRight: "2rem", fontWeight: 600 }}
              >
                <option value="org-acme-corp" style={{ background: "#1e1b4b" }}>
                  Acme Corp Workspace
                </option>
                <option value="org-tech-llc" style={{ background: "#1e1b4b" }}>
                  Tech Startups Workspace
                </option>
              </select>
            </div>

            {/* Quick Nav Links */}
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <a
                href="/leads"
                id="nav-link-leads"
                style={{
                  padding: "0.4rem 0.8rem",
                  borderRadius: "6px",
                  border: "1px solid var(--glass-border)",
                  color: "var(--text-secondary)",
                  textDecoration: "none",
                  fontSize: "0.78rem",
                  fontWeight: 500,
                  transition: "all 0.2s ease",
                }}
              >
                Leads
              </a>
              <a
                href="/territories"
                id="nav-link-territories"
                style={{
                  padding: "0.4rem 0.8rem",
                  borderRadius: "6px",
                  border: "1px solid var(--glass-border)",
                  color: "var(--text-secondary)",
                  textDecoration: "none",
                  fontSize: "0.78rem",
                  fontWeight: 500,
                  transition: "all 0.2s ease",
                }}
              >
                🗺️ Territories
              </a>
            </div>
          </div>
        </header>

        {/* METRICS DASHBOARD + CHARTS */}
        <MetricsGrid
          leads={leads}
          contacts={contacts}
          opportunities={opportunities}
        />

        {/* PRIMARY DETAILS GRID (TABS + ACTIVITY TIMELINE) */}
        <section
          className="grid grid-cols-1 xl:grid-cols-3 gap-6"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: "1.5rem",
          }}
        >
          <RecordTabs
            activeTab={activeTab}
            onTabChange={setActiveTab}
            loading={loading}
            leads={leads}
            contacts={contacts}
            opportunities={opportunities}
            onConvertLead={(lead) => {
              setConvertingLead(lead);
              setConversionStageName(`${lead.company} Enterprise Deal`);
            }}
          />

          <ActivityFeed activities={recentActivities} />
        </section>

        {/* LEAD CONVERSION MODAL */}
        {convertingLead && (
          <ConversionModal
            convertingLead={convertingLead}
            conversionStageName={conversionStageName}
            onConversionStageNameChange={setConversionStageName}
            conversionStageAmount={conversionStageAmount}
            onConversionStageAmountChange={setConversionStageAmount}
            converting={converting}
            onConvert={handleConvertLead}
            onCancel={() => setConvertingLead(null)}
          />
        )}
      </div>
    </main>
  );
}
