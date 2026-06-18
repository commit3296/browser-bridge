import { decryptArchive, encryptPayload } from "../shared/crypto";
import {
  buildCookieRemoveDetails,
  buildCookieSetDetails,
  classifyCookieSetError,
  CookieImportPlan,
  createCookieImportPlan,
  createEmptyCookieDomainReport,
  filterCookiesByDomains,
  getCookiePreflightIssue,
  groupCookiesByDomain,
  normalizeCookieDomain,
  serializeCookie,
  summarizeCookieDomains,
} from "../shared/cookies";
import { createArchivePreview } from "../shared/preview";
import { applyCookieDomainDiagnostics } from "../shared/diagnostics";
import { createImportReport, pushReportMessage, timeSection } from "../shared/reports";
import { BridgeRequestSchema, EncryptedArchiveV2Schema } from "../shared/schemas";
import {
  BridgePayloadV2,
  BridgeRequest,
  BridgeResponse,
  BridgeSection,
  CookieDomainReport,
  CookieImportPolicy,
  defaultCookieImportPolicy,
  ExportedCookie,
  ExportedExtension,
  ExtensionInstallStatus,
  ImportReport,
  ProgressEvent,
  QaCookieSummary,
  SectionSelection,
} from "../shared/types";

export type BridgeBrowser = {
  bookmarks: {
    create(details: {
      parentId?: string;
      title?: string;
      url?: string;
    }): Promise<chrome.bookmarks.BookmarkTreeNode>;
    getTree(): Promise<chrome.bookmarks.BookmarkTreeNode[]>;
  };
  cookies: {
    getAll(details: chrome.cookies.GetAllDetails): Promise<chrome.cookies.Cookie[]>;
    remove(details: chrome.cookies.CookieDetails): Promise<unknown>;
    set(details: chrome.cookies.SetDetails): Promise<chrome.cookies.Cookie | null>;
  };
  management: {
    getAll(): Promise<chrome.management.ExtensionInfo[]>;
  };
  runtime: {
    id?: string;
    getManifest(): { version: string };
  };
  tabs: {
    query(queryInfo: chrome.tabs.QueryInfo): Promise<chrome.tabs.Tab[]>;
  };
};

export type BridgeProgressEmitter = (event: ProgressEvent) => Promise<void> | void;

export function createBridgeService({
  browser,
  emitProgress: emitProgressEvent = () => undefined,
}: {
  browser: BridgeBrowser;
  emitProgress?: BridgeProgressEmitter;
}) {
  const cancelledOperations = new Set<string>();

  async function handleMessage(rawRequest: unknown): Promise<BridgeResponse> {
    const request = BridgeRequestSchema.parse(rawRequest) as BridgeRequest;

    if (request.type === "GET_COOKIE_DOMAINS") {
      const cookies = (await browser.cookies.getAll({})).map(serializeCookie);
      return { ok: true, cookieDomains: summarizeCookieDomains(cookies) };
    }

    if (request.type === "GET_TAB_COOKIE_DOMAINS") {
      const domains = await getTabCookieDomains();
      return { ok: true, cookieDomains: domains };
    }

    if (request.type === "CREATE_ARCHIVE") {
      cancelledOperations.delete(request.operationId);
      const payload = await createPayload(request);
      const archive = await encryptPayload(payload, request.password);
      return {
        ok: true,
        archive,
        preview: createArchivePreview(
          payload,
          await getExtensionStatuses(payload.payload.extensions ?? []),
        ),
      };
    }

    if (request.type === "PREVIEW_ARCHIVE") {
      cancelledOperations.delete(request.operationId);
      const archive = EncryptedArchiveV2Schema.parse(request.archive);
      await emitProgress(request.operationId, "preview", undefined, 0, 1, "Decrypting archive");
      const payload = await decryptArchive(archive, request.password);
      const preview = await createPreviewWithCurrentState(payload, {
        sections: request.sections,
        cookieDomains: request.cookieDomains,
        cookieImportPolicy: request.cookieImportPolicy,
      });
      await emitProgress(request.operationId, "preview", undefined, 1, 1, "Archive preview ready");
      return { ok: true, preview };
    }

    if (request.type === "IMPORT_ARCHIVE") {
      cancelledOperations.delete(request.operationId);
      const archive = EncryptedArchiveV2Schema.parse(request.archive);
      const payload = await decryptArchive(archive, request.password);
      const report = await importPayload(payload, request);
      cancelledOperations.delete(request.operationId);
      return { ok: true, report };
    }

    if (request.type === "CANCEL_OPERATION") {
      cancelledOperations.add(request.operationId);
      return { ok: true, cancelled: true };
    }

    if (request.type === "CREATE_QA_COOKIES") {
      return { ok: true, created: await createQaCookies() };
    }

    if (request.type === "GET_QA_COOKIE_SUMMARY") {
      return { ok: true, qaCookies: await getQaCookieSummary() };
    }

    if (request.type === "CLEAR_QA_COOKIES") {
      return { ok: true, cleared: await clearQaCookies() };
    }

    if (request.type === "QA_DRY_RUN_PREVIEW") {
      const cookies = await getQaCookies();
      const payload = createQaPayload(cookies);
      const archive = await encryptPayload(payload, request.password);
      const preview = await createPreviewWithCurrentState(payload, {
        sections: payload.selection.sections,
        cookieDomains: payload.selection.cookieDomains,
        cookieImportPolicy: "dry_run",
      });
      return { ok: true, archive, preview };
    }

    return { ok: false, error: "Unknown request type." };
  }

  async function createPayload(request: Extract<BridgeRequest, { type: "CREATE_ARCHIVE" }>) {
    const manifest = browser.runtime.getManifest();
    const payload: BridgePayloadV2 = {
      app: "browser-bridge",
      schemaVersion: 2,
      createdAt: new Date().toISOString(),
      source: {
        browser: "chrome",
        browserName: "Google Chrome",
        browserFamily: "chromium",
        extensionVersion: manifest.version,
      },
      selection: {
        sections: request.sections,
        cookieDomains: request.sections.cookies ? request.cookieDomains : [],
      },
      payload: {},
    };

    if (request.sections.bookmarks) {
      await emitProgress(request.operationId, "export", "bookmarks", 0, 1, "Reading bookmarks");
      payload.payload.bookmarks = await browser.bookmarks.getTree();
      await emitProgress(request.operationId, "export", "bookmarks", 1, 1, "Bookmarks exported");
    }

    if (request.sections.cookies) {
      await emitProgress(request.operationId, "export", "cookies", 0, 1, "Reading cookies");
      const cookies = (await browser.cookies.getAll({})).map(serializeCookie);
      const selectedCookies = filterCookiesByDomains(cookies, request.cookieDomains);
      payload.payload.cookies = groupCookiesByDomain(selectedCookies);
      await emitProgress(
        request.operationId,
        "export",
        "cookies",
        selectedCookies.length,
        selectedCookies.length,
        "Cookies exported",
      );
    }

    if (request.sections.extensions) {
      await emitProgress(request.operationId, "export", "extensions", 0, 1, "Reading extensions");
      const selfId = browser.runtime.id;
      payload.payload.extensions = (await browser.management.getAll())
        .filter((extension) => extension.id !== selfId)
        .map(serializeExtension);
      await emitProgress(request.operationId, "export", "extensions", 1, 1, "Extensions exported");
    }

    return payload;
  }

  async function createPreviewWithCurrentState(
    payload: BridgePayloadV2,
    options: {
      sections?: SectionSelection;
      cookieDomains?: string[];
      cookieImportPolicy?: CookieImportPolicy;
    },
  ) {
    const sections = options.sections
      ? intersectSections(payload.selection.sections, options.sections)
      : payload.selection.sections;
    const extensions = await getExtensionStatuses(payload.payload.extensions ?? []);

    if (!sections.cookies || !payload.payload.cookies) {
      return createArchivePreview(payload, extensions);
    }

    const domains = options.cookieDomains?.length
      ? options.cookieDomains
      : Object.keys(payload.payload.cookies);
    const incoming = filterCookiesByDomains(Object.values(payload.payload.cookies).flat(), domains);
    const existing = (await browser.cookies.getAll({})).map(serializeCookie);
    const plan = createCookieImportPlan({
      incoming,
      existing,
      policy: options.cookieImportPolicy ?? defaultCookieImportPolicy,
      selectedDomains: domains,
    });

    return createArchivePreview(payload, extensions, {
      policy: plan.policy,
      total: plan.total,
      importable: plan.importable,
      new: plan.new,
      overwrite: plan.overwrite,
      skipExisting: plan.skipExisting,
      expired: plan.expired,
      invalid: plan.invalid,
      chromeRejectedRisk: plan.chromeRejectedRisk,
      toDelete: plan.toDelete,
      domains: plan.domains,
    });
  }

  async function getTabCookieDomains() {
    const tabs = await browser.tabs.query({});
    const tabDomains = new Set(
      tabs
        .flatMap((tab) => {
          const rawUrl = tab.url || tab.pendingUrl;
          if (!rawUrl) return [];
          try {
            const url = new URL(rawUrl);
            if (url.protocol !== "http:" && url.protocol !== "https:") return [];
            return [url.hostname.replace(/^www\./, "")];
          } catch {
            return [];
          }
        })
        .filter(Boolean),
    );

    if (tabDomains.size === 0) return [];

    const cookies = (await browser.cookies.getAll({})).map(serializeCookie);
    const matchingCookies = cookies.filter((cookie) => {
      const cookieDomain = normalizeCookieDomain(cookie.domain).toLowerCase();
      return [...tabDomains].some(
        (tabDomain) => cookieDomain === tabDomain || tabDomain.endsWith(`.${cookieDomain}`),
      );
    });

    return summarizeCookieDomains(matchingCookies);
  }

  async function createQaCookies() {
    const details: chrome.cookies.SetDetails[] = [
      {
        url: "https://example.com/",
        name: "bridge_qa_example",
        value: `qa-example-${Date.now()}`,
        path: "/",
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        expirationDate: Math.floor(Date.now() / 1000) + 3600,
      },
      {
        url: "https://github.com/",
        name: "bridge_qa_github",
        value: `qa-github-${Date.now()}`,
        path: "/",
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        expirationDate: Math.floor(Date.now() / 1000) + 3600,
      },
      {
        url: "http://127.0.0.1/",
        name: "bridge_qa_local",
        value: `qa-local-${Date.now()}`,
        path: "/",
        httpOnly: false,
        secure: false,
        sameSite: "lax",
        expirationDate: Math.floor(Date.now() / 1000) + 3600,
      },
    ];

    let created = 0;
    for (const detail of details) {
      await browser.cookies.set(detail);
      created += 1;
    }
    return created;
  }

  async function getQaCookieSummary(): Promise<QaCookieSummary[]> {
    return summarizeQaCookies(await getQaCookies());
  }

  async function clearQaCookies() {
    const cookies = await getQaCookies();
    let cleared = 0;
    for (const cookie of cookies) {
      await browser.cookies.remove(buildCookieRemoveDetails(cookie));
      cleared += 1;
    }
    return cleared;
  }

  async function getQaCookies() {
    const cookies = (await browser.cookies.getAll({})).map(serializeCookie);
    return cookies.filter((cookie) => cookie.name.startsWith("bridge_qa_"));
  }

  function createQaPayload(cookies: ExportedCookie[]): BridgePayloadV2 {
    const domains = summarizeQaCookies(cookies).map((domain) => domain.domain);
    return {
      app: "browser-bridge",
      schemaVersion: 2,
      createdAt: new Date().toISOString(),
      source: {
        browser: "chrome",
        browserName: "Google Chrome",
        browserFamily: "chromium",
        extensionVersion: browser.runtime.getManifest().version,
      },
      selection: {
        sections: { bookmarks: false, cookies: true, extensions: false },
        cookieDomains: domains,
      },
      payload: {
        cookies: groupCookiesByDomain(cookies),
      },
    };
  }

  function summarizeQaCookies(cookies: ExportedCookie[]): QaCookieSummary[] {
    const groups = groupCookiesByDomain(cookies);
    return Object.entries(groups)
      .map(([domain, domainCookies]) => ({
        domain,
        total: domainCookies.length,
        session: domainCookies.filter((cookie) => cookie.session).length,
        persistent: domainCookies.filter((cookie) => !cookie.session).length,
        secure: domainCookies.filter((cookie) => cookie.secure).length,
        httpOnly: domainCookies.filter((cookie) => cookie.httpOnly).length,
        names: domainCookies.map((cookie) => cookie.name).sort(),
      }))
      .sort((left, right) => left.domain.localeCompare(right.domain));
  }

  async function importPayload(
    payload: BridgePayloadV2,
    request: Extract<BridgeRequest, { type: "IMPORT_ARCHIVE" }>,
  ) {
    const sections = intersectSections(payload.selection.sections, request.sections);
    const report = createImportReport(sections);

    if (sections.bookmarks && payload.payload.bookmarks) {
      await timeSection(report, "bookmarks", () =>
        importBookmarks(payload.payload.bookmarks ?? [], report, request.operationId),
      );
    }

    if (sections.cookies && payload.payload.cookies) {
      const domains = request.cookieDomains.length
        ? request.cookieDomains
        : Object.keys(payload.payload.cookies);
      const cookies = filterCookiesByDomains(Object.values(payload.payload.cookies).flat(), domains);
      const existing = (await browser.cookies.getAll({})).map(serializeCookie);
      const plan = createCookieImportPlan({
        incoming: cookies,
        existing,
        policy: request.cookieImportPolicy,
        selectedDomains: domains,
      });
      await timeSection(report, "cookies", () =>
        importCookies(plan, report, request.operationId),
      );
    }

    if (sections.extensions && payload.payload.extensions) {
      importExtensions(payload.payload.extensions, report);
    }

    report.cancelled = cancelledOperations.has(request.operationId);
    report.finishedAt = new Date().toISOString();
    return report;
  }

  async function importBookmarks(
    tree: chrome.bookmarks.BookmarkTreeNode[],
    report: ImportReport,
    operationId: string,
  ) {
    const nodes = collectBookmarkChildren(tree);
    report.bookmarks.total = countBookmarkNodes(nodes);

    if (report.bookmarks.total === 0) return;

    const root = await browser.bookmarks.create({
      parentId: "1",
      title: `Browser Bridge Import ${new Date().toLocaleString()}`,
    });

    let completed = 0;
    for (const node of nodes) {
      if (isCancelled(operationId, report)) break;
      completed = await createBookmarkNode(node, root.id, report, operationId, completed);
      await emitProgress(
        operationId,
        "import",
        "bookmarks",
        completed,
        report.bookmarks.total,
        "Importing bookmarks",
      );
    }
  }

  function collectBookmarkChildren(tree: chrome.bookmarks.BookmarkTreeNode[]) {
    return tree.flatMap((root) =>
      root.children?.flatMap((child) => child.children ?? []) ?? [],
    );
  }

  function countBookmarkNodes(nodes: chrome.bookmarks.BookmarkTreeNode[]): number {
    return nodes.reduce((count, node) => {
      const childCount = node.children ? countBookmarkNodes(node.children) : 0;
      return count + 1 + childCount;
    }, 0);
  }

  async function createBookmarkNode(
    node: chrome.bookmarks.BookmarkTreeNode,
    parentId: string,
    report: ImportReport,
    operationId: string,
    completed: number,
  ): Promise<number> {
    if (isCancelled(operationId, report)) return completed;

    let nextCompleted = completed + 1;

    try {
      const created = await browser.bookmarks.create({
        parentId,
        title: node.title || node.url || "Untitled",
        url: node.url,
      });
      report.bookmarks.success += 1;

      for (const child of node.children ?? []) {
        nextCompleted = await createBookmarkNode(
          child,
          created.id,
          report,
          operationId,
          nextCompleted,
        );
      }
    } catch (error) {
      report.bookmarks.failed += 1;
      pushReportMessage(
        report.bookmarks.errors,
        `${node.title || node.url || "Bookmark"}: ${getErrorMessage(error)}`,
      );
    }

    return nextCompleted;
  }

  async function importCookies(plan: CookieImportPlan, report: ImportReport, operationId: string) {
    report.cookies.total = plan.total;
    report.cookies.created = 0;
    report.cookies.updated = 0;
    report.cookies.deleted = 0;
    report.cookies.skippedExisting = 0;
    report.cookies.domains = {};

    if (plan.policy === "dry_run") {
      applyDryRunCookieReport(plan, report);
      applyCookieDomainDiagnostics(report);
      await emitProgress(operationId, "import", "cookies", plan.total, plan.total, "Cookie dry run complete");
      return;
    }

    if (plan.policy === "replace_selected_domains" && plan.deleteCookies.length > 0) {
      await deleteCookiesForPlan(plan, report, operationId);
    }

    const importItems = plan.items;
    let cursor = 0;
    let completed = 0;

    async function worker() {
      while (cursor < importItems.length) {
        if (isCancelled(operationId, report)) break;
        const index = cursor;
        cursor += 1;
        const item = importItems[index];
        const domainReport = getCookieDomainReport(report, item.domain);

        if (item.action === "skip_invalid" && item.issue) {
          report.cookies.skipped += 1;
          domainReport.skipped += 1;
          pushCookieWarning(report, domainReport, item.cookie, item.issue.code, item.issue.message);
        } else if (item.action === "skip_existing") {
          report.cookies.skipped += 1;
          report.cookies.skippedExisting = (report.cookies.skippedExisting ?? 0) + 1;
          domainReport.skipped += 1;
          domainReport.skippedExisting += 1;
        } else {
          await setPlannedCookie(plan.policy, item, report, domainReport);
        }

        completed += 1;
        if (completed % 25 === 0 || completed === importItems.length) {
          await emitProgress(
            operationId,
            "import",
            "cookies",
            completed,
            importItems.length,
            `Importing cookies: ${item.domain}`,
          );
        }
      }
    }

    await Promise.all(Array.from({ length: Math.min(4, importItems.length) }, () => worker()));

    if (isCancelled(operationId, report) && completed < importItems.length) {
      const remaining = importItems.length - completed;
      report.cookies.skipped += remaining;
      for (const item of importItems.slice(completed)) {
        getCookieDomainReport(report, item.domain).skipped += 1;
      }
    }

    applyCookieDomainDiagnostics(report);
  }

  function applyDryRunCookieReport(plan: CookieImportPlan, report: ImportReport) {
    report.cookies.success = plan.importable;
    report.cookies.skipped = plan.skipExisting + plan.expired + plan.invalid + plan.chromeRejectedRisk;
    report.cookies.created = plan.new;
    report.cookies.updated = plan.overwrite;
    report.cookies.deleted = plan.toDelete;
    report.cookies.skippedExisting = plan.skipExisting;

    for (const domain of plan.domains) {
      const domainReport = getCookieDomainReport(report, domain.domain);
      domainReport.total = domain.total;
      domainReport.success = domain.importable ?? 0;
      domainReport.skipped = domain.skipped ?? 0;
      domainReport.created = domain.new ?? 0;
      domainReport.updated = domain.overwrite ?? 0;
      domainReport.deleted = domain.toDelete ?? 0;
      domainReport.skippedExisting = domain.skipExisting ?? 0;
      pushDryRunDomainWarnings(domainReport, domain);
    }
  }

  function pushDryRunDomainWarnings(
    domainReport: CookieDomainReport,
    domain: ReturnType<typeof createCookieImportPlan>["domains"][number],
  ) {
    if (domain.expired) {
      domainReport.warnings.push(`expired: ${domain.domain} has ${domain.expired} expired cookies.`);
    }
    if (domain.invalid) {
      domainReport.warnings.push(`invalid_domain: ${domain.domain} has ${domain.invalid} invalid cookies.`);
    }
    if (domain.chromeRejectedRisk) {
      domainReport.warnings.push(
        `chrome_rejected: ${domain.domain} has ${domain.chromeRejectedRisk} cookies Chrome may reject.`,
      );
    }
    if (domain.skipExisting) {
      domainReport.warnings.push(
        `skipped_existing: ${domain.domain} has ${domain.skipExisting} existing cookies to skip.`,
      );
    }
  }

  async function deleteCookiesForPlan(
    plan: CookieImportPlan,
    report: ImportReport,
    operationId: string,
  ) {
    let completed = 0;
    for (const cookie of plan.deleteCookies) {
      if (isCancelled(operationId, report)) {
        report.cookies.skipped += plan.deleteCookies.length - completed;
        break;
      }

      const domain = normalizeCookieDomain(cookie.domain);
      const domainReport = getCookieDomainReport(report, domain);
      try {
        await browser.cookies.remove(buildCookieRemoveDetails(cookie));
        report.cookies.deleted = (report.cookies.deleted ?? 0) + 1;
        domainReport.deleted += 1;
      } catch (error) {
        const issue = classifyCookieSetError(cookie, error);
        report.cookies.failed += 1;
        domainReport.failed += 1;
        pushCookieError(report, domainReport, cookie, issue.code, issue.message);
      }

      completed += 1;
      if (completed % 25 === 0 || completed === plan.deleteCookies.length) {
        await emitProgress(
          operationId,
          "import",
          "cookies",
          completed,
          plan.deleteCookies.length + plan.items.length,
          `Deleting cookies: ${domain}`,
        );
      }
    }
  }

  async function setPlannedCookie(
    policy: CookieImportPolicy,
    item: CookieImportPlan["items"][number],
    report: ImportReport,
    domainReport: CookieDomainReport,
  ) {
    const cookie = item.cookie;
    const preflightIssue = getCookiePreflightIssue(cookie);
    if (preflightIssue) {
      report.cookies.skipped += 1;
      domainReport.skipped += 1;
      pushCookieWarning(report, domainReport, cookie, preflightIssue.code, preflightIssue.message);
      return;
    }

    try {
      await browser.cookies.set(buildCookieSetDetails(cookie));
      report.cookies.success += 1;
      domainReport.success += 1;
      if (item.action === "update" && policy !== "replace_selected_domains") {
        report.cookies.updated = (report.cookies.updated ?? 0) + 1;
        domainReport.updated += 1;
      } else {
        report.cookies.created = (report.cookies.created ?? 0) + 1;
        domainReport.created += 1;
      }
    } catch (error) {
      const issue = classifyCookieSetError(cookie, error);
      report.cookies.failed += 1;
      domainReport.failed += 1;
      pushCookieError(report, domainReport, cookie, issue.code, issue.message);
    }
  }

  function getCookieDomainReport(report: ImportReport, domain: string) {
    report.cookies.domains ??= {};
    report.cookies.domains[domain] ??= createEmptyCookieDomainReport();
    return report.cookies.domains[domain];
  }

  function pushCookieWarning(
    report: ImportReport,
    domainReport: CookieDomainReport,
    cookie: ExportedCookie,
    code: string,
    message: string,
  ) {
    const text = `${code}: ${cookie.domain}${cookie.path} ${cookie.name} - ${message}`;
    pushReportMessage(report.cookies.warnings, text);
    pushReportMessage(domainReport.warnings, text, 10);
  }

  function pushCookieError(
    report: ImportReport,
    domainReport: CookieDomainReport,
    cookie: ExportedCookie,
    code: string,
    message: string,
  ) {
    const text = `${code}: ${cookie.domain}${cookie.path} ${cookie.name} - ${message}`;
    pushReportMessage(report.cookies.errors, text);
    pushReportMessage(domainReport.errors, text, 10);
  }

  function importExtensions(extensions: ExportedExtension[], report: ImportReport) {
    report.extensions.total = extensions.length;
    report.extensions.skipped = extensions.length;
    pushReportMessage(
      report.extensions.warnings,
      "Chrome extensions cannot install other extensions automatically. Use the inventory to reinstall them manually.",
    );
  }

  function serializeExtension(extension: chrome.management.ExtensionInfo): ExportedExtension {
    return {
      id: extension.id,
      name: extension.name,
      description: extension.description,
      enabled: extension.enabled,
      homepageUrl: extension.homepageUrl,
      optionsUrl: extension.optionsUrl,
      installType: extension.installType,
      type: extension.type,
      version: extension.version,
    };
  }

  async function getExtensionStatuses(
    extensions: ExportedExtension[],
  ): Promise<ExtensionInstallStatus[]> {
    if (extensions.length === 0) return [];

    const installed = new Map(
      (await browser.management.getAll()).map((extension) => [extension.id, extension]),
    );

    return extensions
      .map((extension) => {
        const installedExtension = installed.get(extension.id);
        if (!installedExtension) {
          return { ...extension, status: "missing" as const };
        }

        if (!installedExtension.enabled) {
          return {
            ...extension,
            status: "disabled" as const,
            installedVersion: installedExtension.version,
          };
        }

        if (installedExtension.version !== extension.version) {
          return {
            ...extension,
            status: "version_mismatch" as const,
            installedVersion: installedExtension.version,
          };
        }

        return {
          ...extension,
          status: "installed" as const,
          installedVersion: installedExtension.version,
        };
      })
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  function intersectSections(left: SectionSelection, right: SectionSelection): SectionSelection {
    return {
      bookmarks: left.bookmarks && right.bookmarks,
      cookies: left.cookies && right.cookies,
      extensions: left.extensions && right.extensions,
    };
  }

  function isCancelled(operationId: string, report: ImportReport) {
    const cancelled = cancelledOperations.has(operationId);
    if (cancelled) report.cancelled = true;
    return cancelled;
  }

  async function emitProgress(
    operationId: string,
    phase: ProgressEvent["phase"],
    section: BridgeSection | undefined,
    completed: number,
    total: number,
    message: string,
  ) {
    await emitProgressEvent({
      type: "BRIDGE_PROGRESS",
      operationId,
      phase,
      section,
      completed,
      total,
      message,
    });
  }

  return { handleMessage };
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error);
}
