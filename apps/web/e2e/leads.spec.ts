import { expect, test } from "@playwright/test";

test.describe("Leads panel — smoke", () => {
  test("dashboard renders the leads section heading", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Active CRM Leads")).toBeVisible();
  });

  test("leads status breakdown chart is present", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByLabel("Leads Status Breakdown Chart"),
    ).toBeAttached();
  });
});
