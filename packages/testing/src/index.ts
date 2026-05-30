import { genId } from "@crm/db";

export const TESTING_VERSION = "0.1.0";

export interface MockSeedConfig {
  accountCount: number;
  contactCount: number;
  leadCount: number;
}

export interface AccountSeed {
  name: string;
  domain: string;
}

export interface ContactSeed {
  firstName: string;
  lastName: string;
  email: string;
}

export interface LeadSeed {
  company: string;
  email: string;
  status: string;
}

// generateSeedData synthesizes high scale CRM records programmatically
export function generateSeedData(config: MockSeedConfig): {
  accounts: AccountSeed[];
  contacts: ContactSeed[];
  leads: LeadSeed[];
} {
  const accounts: AccountSeed[] = [];
  const contacts: ContactSeed[] = [];
  const leads: LeadSeed[] = [];

  for (let i = 0; i < config.accountCount; i++) {
    accounts.push({
      name: `Mock Account ${i}`,
      domain: `account-${i}.com`,
    });
  }

  for (let i = 0; i < config.contactCount; i++) {
    contacts.push({
      firstName: `First${i}`,
      lastName: `Last${i}`,
      email: `contact-${i}@domain.com`,
    });
  }

  for (let i = 0; i < config.leadCount; i++) {
    leads.push({
      company: `Mock Lead Company ${i}`,
      email: `lead-${i}@company.com`,
      status: i % 2 === 0 ? "New" : "Working",
    });
  }

  return { accounts, contacts, leads };
}

export interface HighScaleSeedConfig {
  accountCount: number;
  contactCount: number;
  leadCount: number;
  opportunityCount: number;
}

export interface HighScaleSeededData {
  accounts: {
    id: string;
    orgId: string;
    ownerId: string;
    name: string;
    domain: string;
    custom: Record<string, unknown>;
  }[];
  contacts: {
    id: string;
    orgId: string;
    ownerId: string;
    accountId: string;
    firstName: string;
    lastName: string;
    email: string;
    custom: Record<string, unknown>;
  }[];
  leads: {
    id: string;
    orgId: string;
    ownerId: string;
    status: string;
    email: string;
    company: string;
    custom: Record<string, unknown>;
  }[];
  opportunities: {
    id: string;
    orgId: string;
    ownerId: string;
    name: string;
    stage: string;
    amount: string;
    closeDate: Date;
    custom: Record<string, unknown>;
  }[];
}

export function generateHighScaleSeed(
  config: HighScaleSeedConfig,
  orgId: string,
): HighScaleSeededData {
  const accounts = [];
  const contacts = [];
  const leads = [];
  const opportunities = [];

  for (let i = 0; i < config.accountCount; i++) {
    accounts.push({
      id: `${genId("acc-scale")}-${i}`,
      orgId,
      ownerId: "user-scale-admin",
      name: `Scale Account ${i}`,
      domain: `scale-account-${i}.com`,
      custom: {},
    });
  }

  for (let i = 0; i < config.contactCount; i++) {
    const parentAccount = accounts[i % (accounts.length || 1)];
    contacts.push({
      id: `${genId("con-scale")}-${i}`,
      orgId,
      ownerId: "user-scale-admin",
      accountId: parentAccount ? parentAccount.id : "null",
      firstName: `FirstScale${i}`,
      lastName: `LastScale${i}`,
      email: `scale-contact-${i}@domain.com`,
      custom: {},
    });
  }

  for (let i = 0; i < config.leadCount; i++) {
    leads.push({
      id: `${genId("lead-scale")}-${i}`,
      orgId,
      ownerId: "user-scale-admin",
      status: i % 3 === 0 ? "New" : i % 3 === 1 ? "Working" : "Converted",
      email: `scale-lead-${i}@company.com`,
      company: `Scale Lead Company ${i}`,
      custom: {},
    });
  }

  for (let i = 0; i < config.opportunityCount; i++) {
    const parentAccount = accounts[i % (accounts.length || 1)];
    opportunities.push({
      id: `${genId("opp-scale")}-${i}`,
      orgId,
      ownerId: "user-scale-admin",
      name: `Scale Opportunity ${i}`,
      stage: i % 2 === 0 ? "Qualification" : "Closed Won",
      amount: (1000 + i * 150).toFixed(2),
      closeDate: new Date("2026-12-31"),
      accountId: parentAccount ? parentAccount.id : "null",
      custom: {},
    });
  }

  return { accounts, contacts, leads, opportunities };
}

export function generateFuzzPayloads(): Record<string, unknown>[] {
  return [
    // 1. Extreme boundary string payload
    {
      company: "A".repeat(5000), // Oversized
      email: "fuzz-oversized@domain.com",
      status: "New",
    },
    // 2. SQL injection pattern payload
    {
      company: "Lead' OR '1'='1",
      email: "fuzz-sqli@domain.com",
      status: "Working",
    },
    // 3. HTML Injection payload
    {
      company: "Lead <script>alert(1)</script>",
      email: "fuzz-html@domain.com",
      status: "New",
    },
    // 4. Broken payload structures (missing required fields)
    {
      email: "broken-lead@domain.com",
    },
    // 5. Invalid numeric strings or empty objects
    {
      company: "Empty Payload Corp",
      email: "",
      status: {},
    },
  ];
}
