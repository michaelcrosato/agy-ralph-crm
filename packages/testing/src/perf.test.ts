import { describe, expect, it } from "vitest";
import { generateSeedData, type MockSeedConfig } from "./index";

describe("Phase 6: High Scale Seeder & Performance Optimization Tests", () => {
  it("should successfully generate bulk mock nodes scaling up to config targets", () => {
    const config: MockSeedConfig = {
      accountCount: 100,
      contactCount: 200,
      leadCount: 150,
    };

    const startTime = performance.now();
    const seeded = generateSeedData(config);
    const endTime = performance.now();

    expect(seeded.accounts.length).toBe(100);
    expect(seeded.contacts.length).toBe(200);
    expect(seeded.leads.length).toBe(150);

    expect(seeded.accounts[0].name).toContain("Mock Account 0");
    expect(seeded.contacts[0].email).toContain("contact-0@domain.com");

    const duration = endTime - startTime;
    // Seeding 450 nodes should easily run in under 10ms
    expect(duration).toBeLessThan(10);
  });
});
