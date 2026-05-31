import type { TenantId, TenantMockData } from "../types/crm";

/**
 * High-fidelity fallback mock data used when the API server is not running.
 * Keyed by tenant organisation ID.
 */
export const MOCK_DATA: Record<TenantId, TenantMockData> = {
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
