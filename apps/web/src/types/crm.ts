/** Shared CRM domain type interfaces used across dashboard components. */

export interface Lead {
  id: string;
  orgId: string;
  email: string | null;
  company: string | null;
  status: string;
  custom?: Record<string, unknown> | null;
}

export interface Contact {
  id: string;
  orgId: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  custom?: Record<string, unknown> | null;
}

export interface Opportunity {
  id: string;
  orgId: string;
  name: string;
  amount?: string | null;
  stage: string;
}

export interface SearchResult {
  id: string;
  type: string;
  title: string;
  subtitle: string;
}

export interface Activity {
  id: string;
  action: string;
  recordType: string;
  createdAt: string;
  changes: Record<string, unknown> | null;
}

/** Tenant IDs supported by the dashboard workspace selector. */
export type TenantId = "org-acme-corp" | "org-tech-llc";

/** Shape of a single tenant's fallback mock data set. */
export interface TenantMockData {
  name: string;
  leads: Lead[];
  contacts: Contact[];
  opportunities: Opportunity[];
}
