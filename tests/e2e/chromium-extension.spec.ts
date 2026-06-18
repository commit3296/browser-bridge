import { expect, test, chromium, type BrowserContext, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const extensionPath = resolve(".output/chrome-mv3");
const chromeExecutable = process.env.PLAYWRIGHT_CHROME_EXECUTABLE;
const archivePassword = "Correct horse battery staple 2026!";
const launchArgs = [
  "--no-sandbox",
  "--disable-dev-shm-usage",
  "--disable-gpu",
  `--disable-extensions-except=${extensionPath}`,
  `--load-extension=${extensionPath}`,
];

test.skip(
  Boolean(chromeExecutable) && !existsSync(chromeExecutable ?? ""),
  `Chrome executable not found: ${chromeExecutable}`,
);
test.skip(!existsSync(extensionPath), "Build output missing. Run npm run build:chrome first.");
test.skip(
  process.platform === "linux" && !process.env.DISPLAY && !process.env.BROWSER_BRIDGE_E2E_HEADLESS,
  "Chromium extension tests need a display on Linux. Run with xvfb-run or set BROWSER_BRIDGE_E2E_HEADLESS=1.",
);

test("loads extension and verifies real Chrome cookie migration policies", async () => {
  const server = await startLocalServer();
  const userDataDir = await mkdtemp(join(tmpdir(), "browser-bridge-e2e-"));
  let context: BrowserContext | undefined;

  try {
    context = await chromium.launchPersistentContext(userDataDir, {
      executablePath: chromeExecutable,
      headless: process.env.BROWSER_BRIDGE_E2E_HEADLESS === "1",
      ignoreDefaultArgs: ["--disable-extensions"],
      args: [
        ...launchArgs,
        ...(process.env.BROWSER_BRIDGE_E2E_HEADLESS === "1" ? ["--headless=new"] : []),
      ],
    });
    const consoleMessages = collectConsoleMessages(context);

    const extensionId = await getExtensionId(context, userDataDir).catch((error: unknown) => {
      throw createLaunchDiagnosticError("Extension service worker did not start.", error, {
        context,
        consoleMessages,
        userDataDir,
      });
    });
    const page = await context.newPage();

    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await expect(page.getByText("Browser Bridge")).toBeVisible();
    await expect(page.getByText("Open control panel")).toBeVisible();

    await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
    await expect(page.getByRole("heading", { name: /Cookie domains/ })).toBeVisible();

    await seedArchiveSourceCookies(context, server.origin);
    const archiveResponse = await createCookieArchive(page, ["example.com", "github.com", "127.0.0.1"]);
    expect(archiveResponse.ok).toBe(true);
    expect(JSON.stringify(archiveResponse.archive)).not.toContain("secret-e2e-value");
    expect(JSON.stringify(archiveResponse.archive)).not.toContain("github-secret-value");
    expect(JSON.stringify(archiveResponse.archive)).not.toContain("local-secret-value");

    const wrongPasswordPreview = await sendMessage(page, {
      type: "PREVIEW_ARCHIVE",
      operationId: "e2e-wrong-password",
      archive: archiveResponse.archive,
      password: "wrong-password",
      cookieImportPolicy: "overwrite",
    });
    expect(wrongPasswordPreview.ok).toBe(false);

    await verifyPreview(page, archiveResponse.archive);
    await verifyDryRunPolicy(page, context, archiveResponse.archive);
    await verifyOverwritePolicy(page, context, archiveResponse.archive, server.origin);
    await verifySkipExistingPolicy(page, context, archiveResponse.archive, server.origin);
    await verifyReplaceSelectedDomainsPolicy(page, context, archiveResponse.archive, server.origin);
  } finally {
    await context?.close();
    await rm(userDataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 250 });
    await server.close();
  }
});

test("exports and imports bookmarks in a real Chrome profile", async () => {
  const userDataDir = await mkdtemp(join(tmpdir(), "browser-bridge-bookmarks-e2e-"));
  let context: BrowserContext | undefined;

  try {
    context = await chromium.launchPersistentContext(userDataDir, {
      executablePath: chromeExecutable,
      headless: process.env.BROWSER_BRIDGE_E2E_HEADLESS === "1",
      ignoreDefaultArgs: ["--disable-extensions"],
      args: [
        ...launchArgs,
        ...(process.env.BROWSER_BRIDGE_E2E_HEADLESS === "1" ? ["--headless=new"] : []),
      ],
    });
    const extensionId = await getExtensionId(context, userDataDir).catch((error: unknown) => {
      throw createLaunchDiagnosticError("Extension service worker did not start.", error, {
        context,
        consoleMessages: [],
        userDataDir,
      });
    });
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/sidepanel.html?qa=1`);

    await page.evaluate(async () => {
      const folder = await chrome.bookmarks.create({
        parentId: "1",
        title: "Bridge QA Source",
      });
      await chrome.bookmarks.create({
        parentId: folder.id,
        title: "Bridge QA Example",
        url: "https://example.com/bridge-qa",
      });
    });

    const archiveResponse = await sendMessage(page, {
      type: "CREATE_ARCHIVE",
      operationId: `e2e-bookmarks-export-${Date.now()}`,
      sections: { bookmarks: true, cookies: false, extensions: false },
      cookieDomains: [],
      password: archivePassword,
    });
    expect(archiveResponse.ok).toBe(true);

    const importResponse = await sendMessage(page, {
      type: "IMPORT_ARCHIVE",
      operationId: `e2e-bookmarks-import-${Date.now()}`,
      archive: archiveResponse.archive,
      password: archivePassword,
      sections: { bookmarks: true, cookies: false, extensions: false },
      cookieDomains: [],
      cookieImportPolicy: "overwrite",
    });
    expect(importResponse.ok).toBe(true);
    expect(importResponse.report.bookmarks.success).toBeGreaterThan(0);

    const tree = await page.evaluate(() => chrome.bookmarks.getTree());
    const importedRoot = findBookmark(tree, (node) => node.title.startsWith("Browser Bridge Import"));
    expect(importedRoot).toBeTruthy();
    const importedBookmark = findBookmark(
      importedRoot?.children ?? [],
      (node) => node.title === "Bridge QA Example" && node.url === "https://example.com/bridge-qa",
    );
    expect(importedBookmark).toBeTruthy();
  } finally {
    await context?.close();
    await rm(userDataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 250 });
  }
});

async function verifyPreview(page: Page, archive: unknown) {
  const previewResponse = await sendMessage(page, {
    type: "PREVIEW_ARCHIVE",
    operationId: "e2e-preview",
    archive,
    password: archivePassword,
    sections: { bookmarks: false, cookies: true, extensions: false },
    cookieDomains: ["example.com", "github.com", "127.0.0.1"],
    cookieImportPolicy: "skip_existing",
  });
  expect(previewResponse.ok).toBe(true);
  expect(previewResponse.preview.cookieDomains.length).toBeGreaterThan(0);
  expect(previewResponse.preview.cookies.total).toBeGreaterThan(0);
  expect(previewResponse.preview.cookies.policy).toBe("skip_existing");
}

async function verifyDryRunPolicy(page: Page, context: BrowserContext, archive: unknown) {
  await context.clearCookies();
  await context.addCookies([
    cookieForUrl("https://example.com", "bridge_e2e", "dry-run-existing"),
  ]);

  const response = await importArchive(page, archive, "dry_run", ["example.com"]);
  expect(response.ok).toBe(true);
  expect(response.report.cookies.success).toBeGreaterThan(0);
  await expectCookieValue(context, "https://example.com", "bridge_e2e", "dry-run-existing");
}

async function verifyOverwritePolicy(
  page: Page,
  context: BrowserContext,
  archive: unknown,
  localOrigin: string,
) {
  await context.clearCookies();
  await context.addCookies([
    cookieForUrl("https://example.com", "bridge_e2e", "stale-example"),
    cookieForUrl("https://github.com", "bridge_github", "stale-github"),
    cookieForUrl(localOrigin, "bridge_local", "stale-local", false),
  ]);

  const response = await importArchive(
    page,
    archive,
    "overwrite",
    ["example.com", "github.com", "127.0.0.1"],
  );
  expect(response.ok).toBe(true);
  expect(response.report.cookies.updated).toBeGreaterThan(0);
  await expectCookieValue(context, "https://example.com", "bridge_e2e", "secret-e2e-value");
  await expectCookieValue(context, "https://github.com", "bridge_github", "github-secret-value");
  await expectCookieValue(context, localOrigin, "bridge_local", "local-secret-value");
}

async function verifySkipExistingPolicy(
  page: Page,
  context: BrowserContext,
  archive: unknown,
  localOrigin: string,
) {
  await context.clearCookies();
  await context.addCookies([
    cookieForUrl("https://example.com", "bridge_e2e", "skip-existing-value"),
  ]);

  const response = await importArchive(
    page,
    archive,
    "skip_existing",
    ["example.com", "github.com", "127.0.0.1"],
  );
  expect(response.ok).toBe(true);
  expect(response.report.cookies.skippedExisting).toBeGreaterThan(0);
  await expectCookieValue(context, "https://example.com", "bridge_e2e", "skip-existing-value");
  await expectCookieValue(context, "https://github.com", "bridge_github", "github-secret-value");
  await expectCookieValue(context, localOrigin, "bridge_local", "local-secret-value");
}

async function verifyReplaceSelectedDomainsPolicy(
  page: Page,
  context: BrowserContext,
  archive: unknown,
  localOrigin: string,
) {
  await context.clearCookies();
  await context.addCookies([
    cookieForUrl("https://example.com", "bridge_e2e", "replace-old-example"),
    cookieForUrl("https://example.com", "bridge_old", "delete-me"),
    cookieForUrl("https://github.com", "bridge_github", "keep-github"),
    cookieForUrl(localOrigin, "bridge_local", "keep-local", false),
  ]);

  const response = await importArchive(page, archive, "replace_selected_domains", ["example.com"]);
  expect(response.ok).toBe(true);
  expect(response.report.cookies.deleted).toBeGreaterThanOrEqual(2);
  await expectCookieValue(context, "https://example.com", "bridge_e2e", "secret-e2e-value");
  await expectCookieMissing(context, "https://example.com", "bridge_old");
  await expectCookieValue(context, "https://github.com", "bridge_github", "keep-github");
  await expectCookieValue(context, localOrigin, "bridge_local", "keep-local");
}

async function seedArchiveSourceCookies(context: BrowserContext, localOrigin: string) {
  await context.clearCookies();
  await context.addCookies([
    cookieForUrl("https://example.com", "bridge_e2e", "secret-e2e-value"),
    cookieForUrl("https://github.com", "bridge_github", "github-secret-value"),
    cookieForUrl(localOrigin, "bridge_local", "local-secret-value", false),
  ]);
}

async function createCookieArchive(page: Page, cookieDomains: string[]) {
  return sendMessage(page, {
    type: "CREATE_ARCHIVE",
    operationId: `e2e-export-${Date.now()}`,
    sections: { bookmarks: false, cookies: true, extensions: false },
    cookieDomains,
    password: archivePassword,
  });
}

async function importArchive(
  page: Page,
  archive: unknown,
  cookieImportPolicy: "overwrite" | "skip_existing" | "replace_selected_domains" | "dry_run",
  cookieDomains: string[],
) {
  return sendMessage(page, {
    type: "IMPORT_ARCHIVE",
    operationId: `e2e-import-${cookieImportPolicy}-${Date.now()}`,
    archive,
    password: archivePassword,
    sections: { bookmarks: false, cookies: true, extensions: false },
    cookieDomains,
    cookieImportPolicy,
  });
}

function cookieForUrl(url: string, name: string, value: string, secure = true) {
  return {
    name,
    value,
    url,
    httpOnly: true,
    secure,
    sameSite: "Lax" as const,
    expires: Math.floor(Date.now() / 1000) + 3600,
  };
}

async function expectCookieValue(
  context: BrowserContext,
  url: string,
  name: string,
  expectedValue: string,
) {
  const cookies = await context.cookies(url);
  expect(cookies.find((cookie) => cookie.name === name)?.value).toBe(expectedValue);
}

async function expectCookieMissing(context: BrowserContext, url: string, name: string) {
  const cookies = await context.cookies(url);
  expect(cookies.find((cookie) => cookie.name === name)).toBeUndefined();
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

function collectConsoleMessages(context: BrowserContext) {
  const messages: string[] = [];
  context.on("page", (page) => {
    page.on("console", (message) => {
      if (message.type() === "error" || message.type() === "warning") {
        messages.push(`${message.type()}: ${message.text()}`);
      }
    });
    page.on("pageerror", (error) => {
      messages.push(`pageerror: ${error.message}`);
    });
  });
  return messages;
}

function createLaunchDiagnosticError(
  message: string,
  error: unknown,
  {
    context,
    consoleMessages,
    userDataDir,
  }: {
    context: BrowserContext | undefined;
    consoleMessages: string[];
    userDataDir: string;
  },
) {
  const chromeVersion = getChromeVersion();
  const workers = context?.serviceWorkers().map((worker) => worker.url()) ?? [];
  return new Error(
    [
      message,
      `Cause: ${getErrorMessage(error)}`,
      `Chrome: ${chromeVersion}`,
      `Executable: ${chromeExecutable || "Playwright bundled Chromium"}`,
      `Extension path: ${extensionPath}`,
      `Profile dir: ${userDataDir}`,
      `Launch args: ${launchArgs.join(" ")}`,
      `DISPLAY: ${process.env.DISPLAY || ""}`,
      `WAYLAND_DISPLAY: ${process.env.WAYLAND_DISPLAY || ""}`,
      `Service workers: ${workers.length ? workers.join(", ") : "none"}`,
      `Console: ${consoleMessages.length ? consoleMessages.slice(-10).join(" | ") : "none"}`,
      process.platform === "linux"
        ? "For virtual display on Fedora, install Xvfb with: sudo dnf install xorg-x11-server-Xvfb"
        : "",
    ]
      .filter(Boolean)
      .join("\n"),
  );
}

function getChromeVersion() {
  if (!chromeExecutable) return "Playwright bundled Chromium";
  try {
    return execFileSync(chromeExecutable, ["--version"], { encoding: "utf8" }).trim();
  } catch (error) {
    return `unknown (${getErrorMessage(error)})`;
  }
}

function findBookmark(
  nodes: chrome.bookmarks.BookmarkTreeNode[],
  predicate: (node: chrome.bookmarks.BookmarkTreeNode) => boolean,
): chrome.bookmarks.BookmarkTreeNode | undefined {
  for (const node of nodes) {
    if (predicate(node)) return node;
    const match = node.children ? findBookmark(node.children, predicate) : undefined;
    if (match) return match;
  }
  return undefined;
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

async function startLocalServer() {
  const server = createServer((_request, response) => {
    response.writeHead(200, { "content-type": "text/plain" });
    response.end("Browser Bridge local cookie test");
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Local test server did not expose a TCP address.");
  }

  return {
    origin: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error);
}
