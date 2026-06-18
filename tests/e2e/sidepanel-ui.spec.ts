import { expect, test, chromium, type BrowserContext, type Page } from "@playwright/test";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const extensionPath = resolve(".output/chrome-mv3");
const chromeExecutable = process.env.PLAYWRIGHT_CHROME_EXECUTABLE;
const archivePassword = "Correct horse battery staple 2026!";

test.skip(
  Boolean(chromeExecutable) && !existsSync(chromeExecutable ?? ""),
  `Chrome executable not found: ${chromeExecutable}`,
);
test.skip(!existsSync(extensionPath), "Build output missing. Run npm run build:chrome first.");
test.skip(
  process.platform === "linux" && !process.env.DISPLAY && !process.env.BROWSER_BRIDGE_E2E_HEADLESS,
  "Chromium extension UI tests need a display on Linux. Run with xvfb-run.",
);

test("simple cookie-first export requires all-domain acknowledgement", async () => {
  const userDataDir = await mkdtemp(join(tmpdir(), "browser-bridge-simple-ui-"));
  let context: BrowserContext | undefined;

  try {
    context = await chromium.launchPersistentContext(userDataDir, {
      executablePath: chromeExecutable,
      headless: process.env.BROWSER_BRIDGE_E2E_HEADLESS === "1",
      ignoreDefaultArgs: ["--disable-extensions"],
      viewport: { width: 420, height: 920 },
      args: [
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        ...(process.env.BROWSER_BRIDGE_E2E_HEADLESS === "1" ? ["--headless=new"] : []),
      ],
    });
    await context.addCookies([
      cookieForUrl("https://example.com", "bridge_simple_example", "simple-secret"),
      cookieForUrl("https://github.com", "bridge_simple_github", "simple-github"),
    ]);

    const extensionId = await getExtensionId(context, userDataDir);
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);

    await expect(page.getByText("Cookie transfer")).toBeVisible();
    await expect(page.getByText("Local encrypted file")).toBeVisible();
    await expect(page.getByRole("button", { name: /Export cookies from this browser/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Import cookies into this browser/ })).toBeVisible();
    await expect(page.getByText("I understand this encrypted file may keep me signed in")).toBeVisible();

    const createArchive = page.getByRole("button", { name: "Create encrypted cookie archive" });
    await page.getByPlaceholder("Password for encrypted archive").fill(archivePassword);
    await expect(createArchive).toBeDisabled();
    await page.getByRole("checkbox", { name: "Confirm encrypted cookie archive risk" }).click();
    await expect(createArchive).toBeEnabled();
    await expect(page.getByText("Cookie import policy")).toHaveCount(0);
    await page.screenshot({
      path: "test-results/sidepanel-simple-export-narrow.png",
      fullPage: true,
    });

    await assertNoHorizontalOverflow(page);
  } finally {
    await context?.close();
    await rm(userDataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 250 });
  }
});

for (const viewport of [
  { name: "narrow", width: 420, height: 920 },
  { name: "wide", width: 900, height: 920 },
]) {
  test(`side panel visual QA states - ${viewport.name}`, async () => {
    const userDataDir = await mkdtemp(join(tmpdir(), `browser-bridge-ui-${viewport.name}-`));
    const archivePath = join(userDataDir, "browser-bridge-ui-fixture.json");
    let context: BrowserContext | undefined;

    try {
      context = await chromium.launchPersistentContext(userDataDir, {
        executablePath: chromeExecutable,
        headless: process.env.BROWSER_BRIDGE_E2E_HEADLESS === "1",
        ignoreDefaultArgs: ["--disable-extensions"],
        viewport,
        args: [
          "--no-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
          `--disable-extensions-except=${extensionPath}`,
          `--load-extension=${extensionPath}`,
          ...(process.env.BROWSER_BRIDGE_E2E_HEADLESS === "1" ? ["--headless=new"] : []),
        ],
      });
      const extensionId = await getExtensionId(context, userDataDir);
      const page = await context.newPage();
      await page.setViewportSize(viewport);
      await page.goto(`chrome-extension://${extensionId}/sidepanel.html?qa=1`);

      await expect(page.getByRole("heading", { name: "Browser Bridge" })).toBeVisible();
      await expect(page.getByText("Step")).toBeVisible();
      await expect(page.getByText("Cookie transfer")).toBeVisible();
      await page.screenshot({
        path: `test-results/sidepanel-export-${viewport.name}.png`,
        fullPage: true,
      });

      await context.addCookies([
        cookieForUrl("https://example.com", "bridge_ui_example", "ui-secret"),
        cookieForUrl("https://github.com", "bridge_ui_github", "ui-github"),
      ]);
      const archiveResponse = await sendMessage(page, {
        type: "CREATE_ARCHIVE",
        operationId: `ui-export-${Date.now()}`,
        sections: { bookmarks: false, cookies: true, extensions: false },
        cookieDomains: ["example.com", "github.com"],
        password: archivePassword,
      });
      expect(archiveResponse.ok).toBe(true);
      await writeFile(archivePath, JSON.stringify(archiveResponse.archive, null, 2));

      await page.getByRole("button", { name: /Import cookies into this browser/ }).click();
      await page.locator('input[type="file"]').setInputFiles(archivePath);
      await page.getByPlaceholder("Archive password").fill(archivePassword);
      await expect(page.getByRole("button", { name: "Restore cookies", exact: true })).toBeDisabled();
      await page.getByRole("button", { name: "Preview cookies" }).click();
      await expect(page.getByRole("columnheader", { name: "Domain" })).toBeVisible();
      await expect(page.getByRole("columnheader", { name: "Overwrite" })).toBeVisible();
      await page.screenshot({
        path: `test-results/sidepanel-preview-${viewport.name}.png`,
        fullPage: true,
      });

      await page.getByRole("button", { name: "Replace selected domains" }).click();
      await expect(page.getByText("deletes cookies only for the selected domains")).toBeVisible();
      await expect(page.getByRole("button", { name: "Restore cookies", exact: true })).toBeDisabled();
      await page.getByRole("checkbox", { name: "Confirm replace selected domains" }).click();
      await expect(page.getByRole("button", { name: "Restore cookies", exact: true })).toBeEnabled();
      await page.screenshot({
        path: `test-results/sidepanel-replace-warning-${viewport.name}.png`,
        fullPage: true,
      });

      await page.getByRole("button", { name: /^Dry run Return a report/ }).click();
      await page.getByRole("button", { name: "Run dry run" }).click();
      await expect(page.getByText("Cookie restore report")).toBeVisible();
      await expect(page.getByText("Download report")).toBeVisible();
      await expect(page.getByText("Likely restored").first()).toBeVisible();
      await expect(page.getByText("Cookie domains").first()).toBeVisible();
      await page.screenshot({
        path: `test-results/sidepanel-report-${viewport.name}.png`,
        fullPage: true,
      });

      await assertNoHorizontalOverflow(page);
    } finally {
      await context?.close();
      await rm(userDataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 250 });
    }
  });
}

async function getExtensionId(context: BrowserContext, userDataDir: string) {
  const idFromPreferences = await getExtensionIdFromPreferences(userDataDir);
  if (idFromPreferences) return idFromPreferences;

  let serviceWorker = context.serviceWorkers()[0];
  if (!serviceWorker) {
    serviceWorker = await context.waitForEvent("serviceworker", { timeout: 8_000 });
  }
  return new URL(serviceWorker.url()).host;
}

async function getExtensionIdFromPreferences(userDataDir: string) {
  const preferencesPath = join(userDataDir, "Default", "Preferences");
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const preferences = JSON.parse(await readFile(preferencesPath, "utf8"));
      const settings = preferences?.extensions?.settings;
      if (settings && typeof settings === "object") {
        for (const [id, value] of Object.entries<Record<string, unknown>>(settings)) {
          if (isBrowserBridgeExtensionSetting(value)) return id;
        }
      }
    } catch {
      // Chrome writes Preferences asynchronously while the profile starts.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return "";
}

function isBrowserBridgeExtensionSetting(value: unknown) {
  if (!value || typeof value !== "object") return false;
  const setting = value as {
    manifest?: { name?: string };
    path?: string;
  };
  return (
    setting.manifest?.name === "Browser Bridge" ||
    (typeof setting.path === "string" && resolve(setting.path) === extensionPath)
  );
}

async function sendMessage(page: Page, message: unknown): Promise<any> {
  return page.evaluate(
    (payload: unknown) =>
      new Promise<any>((resolve) => {
        chrome.runtime.sendMessage(payload, (response) => resolve(response));
      }),
    message,
  );
}

function cookieForUrl(url: string, name: string, value: string) {
  return {
    name,
    value,
    url,
    httpOnly: true,
    secure: true,
    sameSite: "Lax" as const,
    expires: Math.floor(Date.now() / 1000) + 3600,
  };
}

async function assertNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  expect(overflow).toBe(false);
}
