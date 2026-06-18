import { describe, expect, it, vi } from "vitest";
import { createBridgeService, BridgeBrowser } from "../src/background/bridge-service";
import { encryptPayload } from "../src/shared/crypto";
import { groupCookiesByDomain } from "../src/shared/cookies";
import { createMigrationReportExport } from "../src/shared/report-export";
import {
  BridgePayloadV2,
  CookieImportPolicy,
  ExportedCookie,
  ProgressEvent,
  SectionSelection,
} from "../src/shared/types";

const password = "integration-test-password";
const cookieSections: SectionSelection = {
  bookmarks: false,
  cookies: true,
  extensions: false,
};

describe("background cookie import integration", () => {
  it("dry run returns a report without mutating cookies", async () => {
    const archive = await createArchive([cookie("sid"), cookie("fresh")]);
    const browser = createMockBrowser({ existingCookies: [cookie("sid")] });
    const progress: ProgressEvent[] = [];
    const service = createBridgeService({
      browser,
      emitProgress: (event) => {
        progress.push(event);
      },
    });

    const response = await importArchive(service, archive, "dry_run");

    expect(response.ok).toBe(true);
    if (!response.ok || !("report" in response)) throw new Error("Expected report response");
    expect(browser.cookies.set).not.toHaveBeenCalled();
    expect(browser.cookies.remove).not.toHaveBeenCalled();
    expect(response.report.cookies).toMatchObject({
      total: 2,
      success: 2,
      created: 1,
      updated: 1,
      deleted: 0,
      skippedExisting: 0,
    });
    expect(response.report.cookies.domains?.["example.com"].health).toBe("good");
    expect(progress.some((event) => event.message === "Cookie dry run complete")).toBe(true);
  });

  it("overwrite updates matching cookies and creates new cookies", async () => {
    const archive = await createArchive([cookie("sid"), cookie("fresh")]);
    const browser = createMockBrowser({ existingCookies: [cookie("sid")] });
    const service = createBridgeService({ browser });

    const response = await importArchive(service, archive, "overwrite");

    expect(response.ok).toBe(true);
    if (!response.ok || !("report" in response)) throw new Error("Expected report response");
    expect(browser.cookies.set).toHaveBeenCalledTimes(2);
    expect(browser.cookies.remove).not.toHaveBeenCalled();
    expect(response.report.cookies).toMatchObject({
      success: 2,
      created: 1,
      updated: 1,
    });
  });

  it("skip existing only sets cookies that are not already present", async () => {
    const archive = await createArchive([cookie("sid"), cookie("fresh")]);
    const browser = createMockBrowser({ existingCookies: [cookie("sid")] });
    const service = createBridgeService({ browser });

    const response = await importArchive(service, archive, "skip_existing");

    expect(response.ok).toBe(true);
    if (!response.ok || !("report" in response)) throw new Error("Expected report response");
    expect(browser.cookies.set).toHaveBeenCalledTimes(1);
    expect(browser.cookies.set).toHaveBeenCalledWith(expect.objectContaining({ name: "fresh" }));
    expect(response.report.cookies).toMatchObject({
      success: 1,
      skipped: 1,
      skippedExisting: 1,
    });
  });

  it("replace selected domains deletes only selected-domain cookies before import", async () => {
    const archive = await createArchive([cookie("sid"), cookie("fresh")]);
    const browser = createMockBrowser({
      existingCookies: [
        cookie("sid"),
        cookie("old"),
        cookie("other", { domain: "other.com" }),
      ],
    });
    const service = createBridgeService({ browser });

    const response = await importArchive(service, archive, "replace_selected_domains");

    expect(response.ok).toBe(true);
    if (!response.ok || !("report" in response)) throw new Error("Expected report response");
    expect(browser.cookies.remove).toHaveBeenCalledTimes(2);
    expect(browser.cookies.remove).toHaveBeenCalledWith(
      expect.objectContaining({ name: "sid", url: "https://example.com/" }),
    );
    expect(browser.cookies.remove).toHaveBeenCalledWith(
      expect.objectContaining({ name: "old", url: "https://example.com/" }),
    );
    expect(browser.cookies.remove).not.toHaveBeenCalledWith(
      expect.objectContaining({ name: "other" }),
    );
    expect(browser.cookies.set).toHaveBeenCalledTimes(2);
    expect(response.report.cookies.deleted).toBe(2);
  });

  it("continues after an individual cookie set failure and reports the domain error", async () => {
    const archive = await createArchive([cookie("bad"), cookie("next"), cookie("last")]);
    const browser = createMockBrowser({
      setCookie: vi.fn(async (details) => {
        if (details.name === "bad") throw new Error("Chrome rejected test cookie");
        return null;
      }),
    });
    const service = createBridgeService({ browser });

    const response = await importArchive(service, archive, "overwrite");

    expect(response.ok).toBe(true);
    if (!response.ok || !("report" in response)) throw new Error("Expected report response");
    expect(browser.cookies.set).toHaveBeenCalledTimes(3);
    expect(response.report.cookies).toMatchObject({
      success: 2,
      failed: 1,
    });
    expect(response.report.cookies.errors[0]).toContain("chrome_rejected");
    expect(response.report.cookies.domains?.["example.com"].errors[0]).toContain("bad");
    expect(response.report.cookies.domains?.["example.com"].health).toBe("partial");
  });

  it("exports report JSON without cookie values", async () => {
    const archive = await createArchive([cookie("sid", { value: "known-secret-value" })]);
    const browser = createMockBrowser();
    const service = createBridgeService({ browser });

    const response = await importArchive(service, archive, "overwrite");

    expect(response.ok).toBe(true);
    if (!response.ok || !("report" in response)) throw new Error("Expected report response");
    const exported = createMigrationReportExport(response.report);
    expect(JSON.stringify(exported)).not.toContain("known-secret-value");
    expect(exported.cookieHealthSummary.good).toBe(1);
  });

  it("stops a running cookie import when cancellation is requested", async () => {
    const archive = await createArchive(
      Array.from({ length: 8 }, (_, index) => cookie(`c${index}`)),
    );
    const deferred = createDeferred<void>();
    const browser = createMockBrowser({
      setCookie: vi.fn(() => deferred.promise.then(() => null)),
    });
    const service = createBridgeService({ browser });

    const importPromise = importArchive(service, archive, "overwrite", "cancel-me");
    await waitFor(() => vi.mocked(browser.cookies.set).mock.calls.length >= 4);

    await service.handleMessage({ type: "CANCEL_OPERATION", operationId: "cancel-me" });
    deferred.resolve();
    const response = await importPromise;

    expect(response.ok).toBe(true);
    if (!response.ok || !("report" in response)) throw new Error("Expected report response");
    expect(response.report.cancelled).toBe(true);
    expect(response.report.cookies.skipped).toBeGreaterThan(0);
    expect(vi.mocked(browser.cookies.set).mock.calls.length).toBeLessThan(8);
  });

  it("preview computes cookie counts against current browser state", async () => {
    const archive = await createArchive([cookie("sid"), cookie("fresh")]);
    const browser = createMockBrowser({ existingCookies: [cookie("sid")] });
    const service = createBridgeService({ browser });

    const response = await service.handleMessage({
      type: "PREVIEW_ARCHIVE",
      operationId: "preview",
      archive,
      password,
      sections: cookieSections,
      cookieDomains: ["example.com"],
      cookieImportPolicy: "skip_existing",
    });

    expect(response.ok).toBe(true);
    if (!response.ok || !("preview" in response)) throw new Error("Expected preview response");
    expect(response.preview.cookies).toMatchObject({
      policy: "skip_existing",
      total: 2,
      new: 1,
      skipExisting: 1,
    });
  });

  it("imports old v2 archives without optional cookie fields", async () => {
    const legacyCookie = cookie("legacy");
    delete legacyCookie.partitionKey;
    delete legacyCookie.sourceScheme;
    const archive = await createArchive([legacyCookie]);
    const browser = createMockBrowser();
    const service = createBridgeService({ browser });

    const response = await importArchive(service, archive, "overwrite");

    expect(response.ok).toBe(true);
    if (!response.ok || !("report" in response)) throw new Error("Expected report response");
    expect(response.report.cookies.success).toBe(1);
    expect(browser.cookies.set).toHaveBeenCalledTimes(1);
  });
});

async function importArchive(
  service: ReturnType<typeof createBridgeService>,
  archive: Awaited<ReturnType<typeof encryptPayload>>,
  cookieImportPolicy: CookieImportPolicy,
  operationId = `import-${cookieImportPolicy}`,
) {
  return service.handleMessage({
    type: "IMPORT_ARCHIVE",
    operationId,
    archive,
    password,
    sections: cookieSections,
    cookieDomains: ["example.com"],
    cookieImportPolicy,
  });
}

async function createArchive(cookies: ExportedCookie[]) {
  const payload: BridgePayloadV2 = {
    app: "browser-bridge",
    schemaVersion: 2,
    createdAt: "2026-06-17T00:00:00.000Z",
    source: {
      browser: "chrome",
      extensionVersion: "0.1.0",
    },
    selection: {
      sections: cookieSections,
      cookieDomains: ["example.com"],
    },
    payload: {
      cookies: groupCookiesByDomain(cookies),
    },
  };

  return encryptPayload(payload, password);
}

function createMockBrowser({
  existingCookies = [],
  setCookie,
}: {
  existingCookies?: ExportedCookie[];
  setCookie?: ReturnType<typeof vi.fn>;
} = {}) {
  const browser: BridgeBrowser = {
    bookmarks: {
      create: vi.fn(async () => ({ id: "created", title: "created" })),
      getTree: vi.fn(async () => []),
    },
    cookies: {
      getAll: vi.fn(async () => existingCookies as chrome.cookies.Cookie[]),
      remove: vi.fn(async () => ({})),
      set: (setCookie ?? vi.fn(async () => null)) as BridgeBrowser["cookies"]["set"],
    },
    management: {
      getAll: vi.fn(async () => []),
    },
    runtime: {
      id: "browser-bridge",
      getManifest: vi.fn(() => ({ version: "0.1.0" })),
    },
    tabs: {
      query: vi.fn(async () => []),
    },
  };

  return browser;
}

function cookie(name: string, overrides: Partial<ExportedCookie> = {}): ExportedCookie {
  return {
    domain: "example.com",
    expirationDate: Math.floor(Date.now() / 1000) + 60 * 60,
    hostOnly: true,
    httpOnly: true,
    name,
    path: "/",
    sameSite: "lax",
    secure: true,
    session: false,
    storeId: "0",
    value: `${name}-value`,
    sourceScheme: "https",
    ...overrides,
  };
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, reject, resolve };
}

async function waitFor(assertion: () => boolean) {
  for (let index = 0; index < 200; index += 1) {
    if (assertion()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("Timed out waiting for assertion.");
}
