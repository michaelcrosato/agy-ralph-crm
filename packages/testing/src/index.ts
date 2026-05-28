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
