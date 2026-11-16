import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";

test("mobile landing, account, period forecast, check-in, export and deletion", async ({
  page,
  context,
}) => {
  const email = `browser-${randomUUID().slice(0, 12)}@example.com`;
  const password = "synthetic-browser-test-password!";
  const reactErrors: string[] = [];
  page.on("pageerror", (error) => reactErrors.push(error.message));
  await page.setViewportSize({ width: 375, height: 820 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /find your own rhythm/i }),
  ).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
    .toBe(375);
  await page.getByRole("button", { name: "Start tracking" }).click();
  await page.getByLabel("Name", { exact: true }).fill("Poppy");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Hello, Poppy." }),
  ).toBeVisible();
  await expect(page.getByText("No estimate yet")).toBeVisible();

  const dashboard = await (await context.request.get("/api/dashboard")).json();
  const daysAgo = (offset: number) => {
    const today = new Date(dashboard.today + "T12:00:00Z");
    today.setUTCDate(today.getUTCDate() - offset);
    return today.toISOString().slice(0, 10);
  };
  for (const offset of [73, 45, 17]) {
    await page.getByRole("button", { name: "Log period", exact: true }).click();
    await page.getByLabel("Start date").fill(daysAgo(offset));
    await page.getByLabel("End date").fill(daysAgo(offset - 4));
    await page.getByRole("button", { name: "Save period" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Edit period", exact: true }),
    ).toHaveCount([73, 45, 17].indexOf(offset) + 1);
  }
  await expect(
    page.getByText("Based on the median of 2 recent start-to-start intervals."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Previous month" }).click();
  await page.getByRole("button", { name: "Today", exact: true }).click();
  await page.getByRole("combobox", { name: "Mood", exact: true }).selectOption("Tired");
  await page.getByRole("checkbox", { name: "Cramps" }).check();
  await page.getByRole("button", { name: "Save check-in" }).click();
  await expect(
    page.getByRole("button", { name: "Remove check-in" }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByRole("checkbox", { name: "Cramps" })).toBeChecked();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
    .toBe(375);
  expect(await page.evaluate(() => localStorage.length)).toBe(0);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export my data" }).click();
  const exported = await download;
  const exportPath = await exported.path();
  expect(exported.suggestedFilename()).toBe("luna-data.json");
  expect(JSON.parse(await readFile(exportPath!, "utf8")).checkins[0].mood).toBe(
    "Tired",
  );

  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(page.getByRole("link", { name: "Settings" })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
    .toBe(1280);
  await page.getByRole("link", { name: "Settings" }).click();
  await page.getByLabel("Display name").fill("Poppy Updated");
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByText("Settings saved.")).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  const main = page.getByRole("main");
  await main.getByLabel("Email").fill(email);
  await main.getByLabel("Password").fill(password);
  await main.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Hello, Poppy Updated." }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Delete account", exact: true })
    .click();
  await page.getByLabel("Confirm password").fill(password);
  await page
    .getByRole("button", { name: "Permanently delete account" })
    .click();
  await expect(
    page.getByRole("heading", { name: /find your own rhythm/i }),
  ).toBeVisible();
  expect(reactErrors).toEqual([]);
});
