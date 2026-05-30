"use client";

import { createApiClient } from "@crm/api-client";
import { useCallback, useEffect, useState } from "react";

// Types
interface Lead {
  id: string;
  orgId: string;
  email: string | null;
  company: string | null;
  status: string;
  custom?: Record<string, unknown> | null;
}

interface Contact {
  id: string;
  orgId: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  custom?: Record<string, unknown> | null;
}

interface Opportunity {
  id: string;
  orgId: string;
  name: string;
  amount: string;
  stage: string;
}

interface SearchResult {
  id: string;
  type: string;
  title: string;
  subtitle: string;
}

interface Activity {
  id: string;
  action: string;
  recordType: string;
  createdAt: string;
  changes: Record<string, unknown> | null;
}

const API_BASE = "http://localhost:3001";

// High-fidelity fallback mockup data if the API server is not running
const MOCK_DATA = {
  "org-acme-corp": {
    name: "Acme Corporation",
    leads: [
      {
        id: "lead-1",
        orgId: "org-acme-corp",
        email: "jeff@amazon.com",
        company: "Amazon Inc",
        status: "New",
        custom: { industry: "Cloud" },
      },
      {
        id: "lead-2",
        orgId: "org-acme-corp",
        email: "satya@microsoft.com",
        company: "Microsoft Corp",
        status: "Working",
        custom: { industry: "AI" },
      },
      {
        id: "lead-3",
        orgId: "org-acme-corp",
        email: "tim@apple.com",
        company: "Apple Inc",
        status: "Nurturing",
        custom: { industry: "Hardware" },
      },
      {
        id: "lead-4",
        orgId: "org-acme-corp",
        email: "elon@tesla.com",
        company: "Tesla Motors",
        status: "New",
        custom: { industry: "Automotive" },
      },
    ],
    contacts: [
      {
        id: "contact-1",
        orgId: "org-acme-corp",
        firstName: "Sundar",
        lastName: "Pichai",
        email: "sundar@google.com",
      },
      {
        id: "contact-2",
        orgId: "org-acme-corp",
        firstName: "Mark",
        lastName: "Zuckerberg",
        email: "zuck@meta.com",
      },
    ],
    opportunities: [
      {
        id: "opp-1",
        orgId: "org-acme-corp",
        name: "Enterprise Cloud Contract",
        amount: "750000.00",
        stage: "Value Proposition",
      },
      {
        id: "opp-2",
        orgId: "org-acme-corp",
        name: "AI Partnership Agreement",
        amount: "1200000.00",
        stage: "Qualification",
      },
      {
        id: "opp-3",
        orgId: "org-acme-corp",
        name: "Standard License Renewal",
        amount: "150000.00",
        stage: "Closed Won",
      },
    ],
  },
  "org-tech-llc": {
    name: "Tech Startups LLC",
    leads: [
      {
        id: "lead-5",
        orgId: "org-tech-llc",
        email: "brian@airbnb.com",
        company: "Airbnb Inc",
        status: "New",
        custom: { industry: "Hospitality" },
      },
      {
        id: "lead-6",
        orgId: "org-tech-llc",
        email: "drew@dropbox.com",
        company: "Dropbox Inc",
        status: "Nurturing",
        custom: { industry: "Storage" },
      },
    ],
    contacts: [
      {
        id: "contact-3",
        orgId: "org-tech-llc",
        firstName: "Patrick",
        lastName: "Collison",
        email: "patrick@stripe.com",
      },
      {
        id: "contact-4",
        orgId: "org-tech-llc",
        firstName: "John",
        lastName: "Collison",
        email: "john@stripe.com",
      },
    ],
    opportunities: [
      {
        id: "opp-4",
        orgId: "org-tech-llc",
        name: "Stripe Connect Integration",
        amount: "450000.00",
        stage: "Closed Won",
      },
      {
        id: "opp-5",
        orgId: "org-tech-llc",
        name: "SaaS API Subscription",
        amount: "80000.00",
        stage: "Proposal/Price Quote",
      },
    ],
  },
};

export default function Home() {
  const [tenant, setTenant] = useState<"org-acme-corp" | "org-tech-llc">(
    "org-acme-corp",
  );
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
        // 1. Request token from the backend
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

        // 2. Fetch resources using Hono endpoints
        await refreshData(activeToken);
      } catch (err) {
        console.warn(
          "[Hono Connection Warning] API is offline. Using local browser context engine.",
          err,
        );
        setApiLive(false);
        // Load fallback mockup values
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

        // Refresh live data
        await refreshData(token);
      } else {
        // Mock client-side conversion
        const convertedId = convertingLead.id;
        setLeads((prev) => prev.filter((l) => l.id !== convertedId));

        // Add new Contact & Opportunity in mock state
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
            subtitle: `$${o.amount} - ${o.stage}`,
          }));

        setSearchResults(
          [...matchingLeads, ...matchingContacts, ...matchingOpps].slice(0, 5),
        );
        setShowSearchResults(true);
      }
    }, 150);

    return () => clearTimeout(handler);
  }, [searchQuery, apiLive, token, tenant]);

  // Statistics summaries
  const totalPipeline = opportunities.reduce(
    (acc, o) => acc + (Number.parseFloat(o.amount) || 0),
    0,
  );
  const unconvertedLeadsCount = leads.filter(
    (l) => l.status !== "Converted",
  ).length;

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
            <div style={{ position: "relative", width: "280px" }}>
              <input
                type="text"
                placeholder="Fuzzy search Leads, Contacts..."
                className="glass-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => searchQuery && setShowSearchResults(true)}
              />
              {showSearchResults && searchResults.length > 0 && (
                <div
                  className="glass-panel"
                  style={{
                    position: "absolute",
                    top: "105%",
                    left: 0,
                    right: 0,
                    zIndex: 100,
                    padding: "0.5rem",
                    background: "rgba(15, 23, 42, 0.95)",
                  }}
                >
                  <div
                    className="text-xs mb-2"
                    style={{
                      color: "var(--text-muted)",
                      borderBottom: "1px solid var(--glass-border)",
                      paddingBottom: "4px",
                    }}
                  >
                    Fuzzy Search Results
                  </div>
                  {searchResults.map((result) => (
                    <button
                      type="button"
                      key={result.id}
                      className="p-2 flex items-center justify-between hover:bg-white/5 rounded cursor-pointer w-full text-left"
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "0.5rem",
                        borderRadius: "8px",
                        background: "none",
                        border: "none",
                        color: "inherit",
                        font: "inherit",
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                      onClick={() => {
                        setSearchQuery(result.title);
                        setShowSearchResults(false);
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: "0.85rem" }}>
                          {result.title}
                        </div>
                        <div
                          style={{
                            color: "var(--text-secondary)",
                            fontSize: "0.75rem",
                          }}
                        >
                          {result.subtitle}
                        </div>
                      </div>
                      <span
                        className={`badge ${
                          result.type === "Lead"
                            ? "badge-lead"
                            : result.type === "Contact"
                              ? "badge-contact"
                              : result.type === "Opportunity"
                                ? "badge-opp"
                                : "badge-account"
                        }`}
                      >
                        {result.type}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Tenant Workspace Dropdown Selector */}
            <div
              style={{ display: "flex", flexDirection: "column", gap: "2px" }}
            >
              <select
                aria-label="Workspace Selector"
                className="glass-input cursor-pointer"
                value={tenant}
                onChange={(e) =>
                  setTenant(e.target.value as "org-acme-corp" | "org-tech-llc")
                }
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
          </div>
        </header>

        {/* METRICS DASHBOARD GRID */}
        <section
          className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: "1.5rem",
            marginBottom: "2rem",
          }}
        >
          {/* Card 1: Pipeline Value */}
          <div
            className="glass-panel"
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div>
              <span className="badge badge-opp mb-2">Total Pipeline Value</span>
              <h2
                className="text-4xl font-black mt-2"
                style={{ fontSize: "2.5rem", color: "#f8fafc" }}
              >
                $
                {totalPipeline.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </h2>
            </div>
            <p
              className="mt-4 text-sm"
              style={{ color: "var(--text-secondary)" }}
            >
              Summarized opportunity pipeline under strict Row-Level Isolation.
            </p>
          </div>

          {/* Card 2: Active Leads Gauge */}
          <div
            className="glass-panel"
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div>
              <span className="badge badge-lead mb-2">Active CRM Leads</span>
              <h2
                className="text-4xl font-black mt-2"
                style={{ fontSize: "2.5rem", color: "#f8fafc" }}
              >
                {unconvertedLeadsCount} Leads
              </h2>
            </div>
            {/* Gorgeous SVG Gauge visualizer for active lead distributions */}
            <div
              className="mt-4 flex items-center justify-between"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    height: "6px",
                    background: "rgba(255, 255, 255, 0.05)",
                    borderRadius: "3px",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${Math.min(100, unconvertedLeadsCount * 25)}%`,
                      height: "100%",
                      background: "var(--accent-gradient)",
                      borderRadius: "3px",
                    }}
                  />
                </div>
              </div>
              <span
                className="text-xs ml-3"
                style={{ color: "var(--text-secondary)", marginLeft: "0.5rem" }}
              >
                Quota Met
              </span>
            </div>
          </div>

          {/* Card 3: Active Contacts */}
          <div
            className="glass-panel"
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div>
              <span className="badge badge-contact mb-2">CRM Contact Base</span>
              <h2
                className="text-4xl font-black mt-2"
                style={{ fontSize: "2.5rem", color: "#f8fafc" }}
              >
                {contacts.length} Contacts
              </h2>
            </div>
            <p
              className="mt-4 text-sm"
              style={{ color: "var(--text-secondary)" }}
            >
              Isolated business-to-business contacts base.
            </p>
          </div>
        </section>

        {/* METRICS GRAPHICS SECTION */}
        <section
          className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(450px, 1fr))",
            gap: "1.5rem",
            marginBottom: "2rem",
          }}
        >
          {/* SVG Pipeline Value Stage Chart */}
          <div className="glass-panel">
            <h3
              style={{
                fontSize: "1.2rem",
                fontWeight: 700,
                marginBottom: "1rem",
                color: "var(--text-primary)",
              }}
            >
              Pipeline Value By Sales Stage
            </h3>

            {opportunities.length === 0 ? (
              <div
                style={{
                  height: "200px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--text-secondary)",
                }}
              >
                No active opportunities configured in this workspace.
              </div>
            ) : (
              <div style={{ padding: "1rem 0" }}>
                {/* SVG Visual graph grid */}
                <svg
                  width="100%"
                  height="180"
                  style={{ overflow: "visible" }}
                  aria-label="Pipeline Opportunity Chart"
                >
                  <title>Pipeline Opportunity Chart</title>
                  <defs>
                    <linearGradient id="neonIndigo" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#818cf8" />
                      <stop offset="100%" stopColor="#6366f1" />
                    </linearGradient>
                    <linearGradient id="neonPurple" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#c084fc" />
                      <stop offset="100%" stopColor="#a855f7" />
                    </linearGradient>
                  </defs>

                  {opportunities.map((opp, idx) => {
                    const maxAmount = Math.max(
                      ...opportunities.map(
                        (o) => Number.parseFloat(o.amount) || 1,
                      ),
                    );
                    const widthFraction =
                      maxAmount > 0
                        ? (Number.parseFloat(opp.amount) || 0) / maxAmount
                        : 0;
                    const barWidth = Math.max(10, widthFraction * 70); // % width
                    const barY = idx * 50 + 20;

                    return (
                      <g key={opp.id}>
                        {/* Text labels */}
                        <text
                          x="0"
                          y={barY - 8}
                          fill="var(--text-secondary)"
                          fontSize="0.75rem"
                          fontWeight="600"
                        >
                          {opp.name.substring(0, 30)} ({opp.stage})
                        </text>
                        {/* Shadow back drop bar */}
                        <rect
                          x="0"
                          y={barY}
                          width="100%"
                          height="14"
                          rx="7"
                          fill="rgba(255, 255, 255, 0.03)"
                        />
                        {/* Glow indicator bar */}
                        <rect
                          x="0"
                          y={barY}
                          width={`${barWidth}%`}
                          height="14"
                          rx="7"
                          fill={
                            idx % 2 === 0
                              ? "url(#neonIndigo)"
                              : "url(#neonPurple)"
                          }
                          style={{ transition: "width 1s ease" }}
                        />
                        <text
                          x={`${barWidth + 2}%`}
                          y={barY + 11}
                          fill="var(--text-primary)"
                          fontSize="0.75rem"
                          fontWeight="bold"
                        >
                          $
                          {(
                            Number.parseFloat(opp.amount) || 0
                          ).toLocaleString()}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            )}
          </div>

          {/* SVG Lead status Breakdown Chart */}
          <div className="glass-panel">
            <h3
              style={{
                fontSize: "1.2rem",
                fontWeight: 700,
                marginBottom: "1rem",
                color: "var(--text-primary)",
              }}
            >
              Leads Pipeline Status Breakdown
            </h3>
            {leads.length === 0 ? (
              <div
                style={{
                  height: "200px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--text-secondary)",
                }}
              >
                No active leads stored in this workspace.
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-around",
                  alignItems: "center",
                  height: "180px",
                }}
              >
                <svg
                  width="140"
                  height="140"
                  viewBox="0 0 36 36"
                  style={{ transform: "rotate(-90deg)" }}
                  aria-label="Leads Status Breakdown Chart"
                >
                  <title>Leads Status Breakdown Chart</title>
                  <circle
                    cx="18"
                    cy="18"
                    r="15.915"
                    fill="none"
                    stroke="rgba(255, 255, 255, 0.03)"
                    strokeWidth="3"
                  />
                  {/* Neon radial chart slices */}
                  <circle
                    cx="18"
                    cy="18"
                    r="15.915"
                    fill="none"
                    stroke="var(--accent-primary)"
                    strokeWidth="3.2"
                    strokeDasharray="40 100"
                    strokeDashoffset="0"
                  />
                  <circle
                    cx="18"
                    cy="18"
                    r="15.915"
                    fill="none"
                    stroke="var(--accent-secondary)"
                    strokeWidth="3.2"
                    strokeDasharray="25 100"
                    strokeDashoffset="-40"
                  />
                  <circle
                    cx="18"
                    cy="18"
                    r="15.915"
                    fill="none"
                    stroke="var(--success)"
                    strokeWidth="3.2"
                    strokeDasharray="35 100"
                    strokeDashoffset="-65"
                  />
                </svg>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.5rem",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <div
                      style={{
                        width: "10px",
                        height: "10px",
                        background: "var(--accent-primary)",
                        borderRadius: "50%",
                      }}
                    />
                    <span
                      style={{
                        fontSize: "0.85rem",
                        color: "var(--text-secondary)",
                      }}
                    >
                      New / Intake Status (40%)
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <div
                      style={{
                        width: "10px",
                        height: "10px",
                        background: "var(--accent-secondary)",
                        borderRadius: "50%",
                      }}
                    />
                    <span
                      style={{
                        fontSize: "0.85rem",
                        color: "var(--text-secondary)",
                      }}
                    >
                      Working / Outreach Status (25%)
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <div
                      style={{
                        width: "10px",
                        height: "10px",
                        background: "var(--success)",
                        borderRadius: "50%",
                      }}
                    />
                    <span
                      style={{
                        fontSize: "0.85rem",
                        color: "var(--text-secondary)",
                      }}
                    >
                      Nurturing / VIP Status (35%)
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* PRIMARY DETAILS GRID (TABS + ACTIVITY TIMELINE) */}
        <section
          className="grid grid-cols-1 xl:grid-cols-3 gap-6"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: "1.5rem",
          }}
        >
          {/* TAB DATA CONSOLE (Leads, Contacts, Opportunities) */}
          <div
            className="glass-panel xl:col-span-2"
            style={{ gridColumn: "span 2" }}
          >
            <div
              className="flex border-b border-white/10 mb-4"
              style={{
                display: "flex",
                borderBottom: "1px solid var(--glass-border)",
                marginBottom: "1rem",
              }}
            >
              <button
                type="button"
                onClick={() => setActiveTab("leads")}
                style={{
                  background: "none",
                  border: "none",
                  color:
                    activeTab === "leads"
                      ? "var(--accent-primary)"
                      : "var(--text-secondary)",
                  padding: "10px 15px",
                  borderBottom:
                    activeTab === "leads"
                      ? "2px solid var(--accent-primary)"
                      : "none",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Leads Base
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("contacts")}
                style={{
                  background: "none",
                  border: "none",
                  color:
                    activeTab === "contacts"
                      ? "var(--accent-primary)"
                      : "var(--text-secondary)",
                  padding: "10px 15px",
                  borderBottom:
                    activeTab === "contacts"
                      ? "2px solid var(--accent-primary)"
                      : "none",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Contacts List
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("opportunities")}
                style={{
                  background: "none",
                  border: "none",
                  color:
                    activeTab === "opportunities"
                      ? "var(--accent-primary)"
                      : "var(--text-secondary)",
                  padding: "10px 15px",
                  borderBottom:
                    activeTab === "opportunities"
                      ? "2px solid var(--accent-primary)"
                      : "none",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Opportunities
              </button>
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
                          <span className="badge badge-lead">
                            {lead.status}
                          </span>
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
                              onClick={() => {
                                setConvertingLead(lead);
                                setConversionStageName(
                                  `${lead.company} Enterprise Deal`,
                                );
                              }}
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
            ) : activeTab === "contacts" ? (
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
                          <span className="badge badge-contact">
                            Active Contact
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
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
                          {Number(opp.amount).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* SECURE AUDIT & ACTIVITY LOG TIMELINE */}
          <div className="glass-panel">
            <h3
              style={{
                fontSize: "1.2rem",
                fontWeight: 700,
                marginBottom: "1rem",
                color: "var(--text-primary)",
              }}
            >
              Tenant Audit Timeline
            </h3>

            <div
              style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
            >
              {recentActivities.map((act) => (
                <div
                  key={act.id}
                  className="glass-panel"
                  style={{
                    padding: "0.85rem",
                    background: "rgba(255, 255, 255, 0.02)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.3rem",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span style={{ fontWeight: 700, fontSize: "0.85rem" }}>
                      {act.action}
                    </span>
                    <span
                      className="badge badge-opp"
                      style={{ fontSize: "0.65rem" }}
                    >
                      {act.recordType}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: "0.75rem",
                      color: "var(--text-secondary)",
                    }}
                  >
                    Time: {new Date(act.createdAt).toLocaleTimeString()}
                  </div>
                  <div
                    style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}
                  >
                    Mutation: {JSON.stringify(act.changes)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* LEAD CONVERSION MODAL */}
        {convertingLead && (
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
                organization context, register a new active Account and Contact,
                and establish a Deal pipeline.
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
                      onChange={(e) => setConversionStageName(e.target.value)}
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
                      onChange={(e) => setConversionStageAmount(e.target.value)}
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
                  onClick={() => setConvertingLead(null)}
                  disabled={converting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="glass-btn"
                  onClick={handleConvertLead}
                  disabled={converting}
                >
                  {converting ? "Processing..." : "Convert Lead Now"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
