import { chromium } from "playwright";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const extensionPath = resolve(".output/chrome-mv3");
const screenshotsDir = resolve("docs/store-assets/screenshots");
const archivePassword = "Correct horse battery staple 2026!";
const viewport = { width: 1280, height: 800 };

if (!existsSync(extensionPath)) {
  throw new Error("Build output missing. Run npm run build:chrome first.");
}

if (
  process.platform === "linux" &&
  !process.env.DISPLAY &&
  process.env.BROWSER_BRIDGE_E2E_HEADLESS !== "1"
) {
  throw new Error("Store screenshot capture needs a display on Linux. Run with xvfb-run.");
}

const executablePath = process.env.PLAYWRIGHT_CHROME_EXECUTABLE || chromium.executablePath();
const userDataDir = await mkdtemp(join(tmpdir(), "browser-bridge-store-shots-"));
let context;

try {
  await mkdir(screenshotsDir, { recursive: true });

  context = await chromium.launchPersistentContext(userDataDir, {
    executablePath,
    headless: process.env.BROWSER_BRIDGE_E2E_HEADLESS === "1",
    ignoreDefaultArgs: ["--disable-extensions"],
    viewport,
    deviceScaleFactor: 1,
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
    cookieForUrl("https://example.com", "bridge_store_example", "store-secret-example"),
    cookieForUrl("https://github.com", "bridge_store_github", "store-secret-github"),
  ]);

  const extensionId = await getExtensionId(context, userDataDir);
  const page = await context.newPage();
  await page.setViewportSize(viewport);
  await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
  await page.getByRole("button", { name: "Generate password" }).click();
  await page.getByRole("checkbox", { name: "Confirm encrypted cookie archive risk" }).click();
  await page.screenshot({
    path: join(screenshotsDir, "01-export-cookies.png"),
    fullPage: false,
  });

  await page.getByRole("checkbox", { name: "Cookies" }).click();
  await page.screenshot({
    path: join(screenshotsDir, "04-no-data-selected.png"),
    fullPage: false,
  });
  await page.getByRole("checkbox", { name: "Cookies" }).click();

  const archiveResponse = await sendMessage(page, {
    type: "CREATE_ARCHIVE",
    operationId: `store-export-${Date.now()}`,
    sections: { bookmarks: false, cookies: true, extensions: false },
    cookieDomains: ["example.com", "github.com"],
    password: archivePassword,
  });
  if (!archiveResponse.ok) {
    throw new Error(archiveResponse.error || "Failed to create screenshot archive.");
  }

  const archivePath = join(userDataDir, "browser-bridge-store-fixture.json");
  await writeFile(archivePath, JSON.stringify(archiveResponse.archive, null, 2));

  await page.getByRole("button", { name: /Import cookies into this browser/ }).click();
  await page.locator('input[type="file"]').setInputFiles(archivePath);
  await page.getByPlaceholder("Archive password").fill(archivePassword);
  await page.getByRole("button", { name: "Preview cookies" }).click();
  await page.getByText("Archive preview ready").waitFor();
  await page.screenshot({
    path: join(screenshotsDir, "02-import-preview.png"),
    fullPage: false,
  });

  await page.getByRole("button", { name: "Restore cookies", exact: true }).click();
  await page.getByText("Cookie restore report").waitFor();
  await page.getByText("Cookie restore report").scrollIntoViewIfNeeded();
  await page.screenshot({
    path: join(screenshotsDir, "03-restore-report.png"),
    fullPage: false,
  });
} finally {
  await context?.close();
  await rm(userDataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 250 });
}

async function getExtensionId(context, userDataDir) {
  const idFromPreferences = await getExtensionIdFromPreferences(userDataDir);
  if (idFromPreferences) return idFromPreferences;

  let serviceWorker = context.serviceWorkers()[0];
  if (!serviceWorker) {
    serviceWorker = await context.waitForEvent("serviceworker", { timeout: 8_000 });
  }
  return new URL(serviceWorker.url()).host;
}

async function getExtensionIdFromPreferences(userDataDir) {
  const preferencesPath = join(userDataDir, "Default", "Preferences");
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const preferences = JSON.parse(await readFile(preferencesPath, "utf8"));
      const settings = preferences?.extensions?.settings;
      if (settings && typeof settings === "object") {
        for (const [id, value] of Object.entries(settings)) {
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

function isBrowserBridgeExtensionSetting(value) {
  if (!value || typeof value !== "object") return false;
  return (
    value.manifest?.name === "Browser Bridge" ||
    (typeof value.path === "string" && resolve(value.path) === extensionPath)
  );
}

async function sendMessage(page, message) {
  return page.evaluate(
    (payload) =>
      new Promise((resolveMessage) => {
        chrome.runtime.sendMessage(payload, (response) => resolveMessage(response));
      }),
    message,
  );
}

function cookieForUrl(url, name, value) {
  return {
    name,
    value,
    url,
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    expires: Math.floor(Date.now() / 1000) + 3600,
  };
}
