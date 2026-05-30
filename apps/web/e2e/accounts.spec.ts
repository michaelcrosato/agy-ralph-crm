import { expect, test } from "@playwright/test";

test.describe("Contacts/Accounts panel — smoke", () => {
  test("dashboard renders the contacts base heading", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("CRM Contact Base")).toBeVisible();
  });
});
