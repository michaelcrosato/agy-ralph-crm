import { expect, test } from "@playwright/test";

test.describe("Opportunities panel — smoke", () => {
  test("dashboard renders the pipeline value tile", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Total Pipeline Value")).toBeVisible();
  });

  test("pipeline opportunity chart is present", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTitle("Pipeline Opportunity Chart")).toBeAttached();
  });
});
