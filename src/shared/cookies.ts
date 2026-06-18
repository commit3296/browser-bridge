import {
  CookieDomainReport,
  CookieDomainSummary,
  CookieImportIssue,
  CookieImportPolicy,
  ExportedCookie,
} from "./types";

export type CookieImportPlan = {
  policy: CookieImportPolicy;
  total: number;
  importable: number;
  new: number;
  overwrite: number;
  skipExisting: number;
  expired: number;
  invalid: number;
  chromeRejectedRisk: number;
  toDelete: number;
  domains: CookieDomainSummary[];
  items: CookieImportPlanItem[];
  deleteCookies: ExportedCookie[];
};

export type CookieImportPlanItem = {
  cookie: ExportedCookie;
  domain: string;
  action: "create" | "update" | "skip_existing" | "skip_invalid";
  issue?: CookieImportIssue;
};

export function normalizeCookieDomain(domain: string) {
  return domain.startsWith(".") ? domain.slice(1) : domain;
}

export function serializeCookie(cookie: chrome.cookies.Cookie): ExportedCookie {
  return {
    domain: cookie.domain,
    expirationDate: cookie.expirationDate,
    hostOnly: cookie.hostOnly,
    httpOnly: cookie.httpOnly,
    name: cookie.name,
    path: cookie.path,
    sameSite: cookie.sameSite,
    secure: cookie.secure,
    session: cookie.session,
    storeId: cookie.storeId,
    value: cookie.value,
    partitionKey: cookie.partitionKey,
    sourceScheme: cookie.secure ? "https" : "http",
  };
}

export function groupCookiesByDomain(cookies: ExportedCookie[]) {
  return cookies.reduce<Record<string, ExportedCookie[]>>((groups, cookie) => {
    const domain = normalizeCookieDomain(cookie.domain);
    groups[domain] ??= [];
    groups[domain].push(cookie);
    return groups;
  }, {});
}

export function summarizeCookieDomains(
  cookiesOrGroups: ExportedCookie[] | Record<string, ExportedCookie[]>,
): CookieDomainSummary[] {
  const groups = Array.isArray(cookiesOrGroups)
    ? groupCookiesByDomain(cookiesOrGroups)
    : cookiesOrGroups;

  return Object.entries(groups)
    .map(([domain, cookies]) => ({
      domain,
      total: cookies.length,
      session: cookies.filter((cookie) => cookie.session).length,
      persistent: cookies.filter((cookie) => !cookie.session).length,
      secure: cookies.filter((cookie) => cookie.secure).length,
      httpOnly: cookies.filter((cookie) => cookie.httpOnly).length,
      sameSite: cookies.reduce<Record<string, number>>((counts, cookie) => {
        const key = cookie.sameSite || "unspecified";
        counts[key] = (counts[key] ?? 0) + 1;
        return counts;
      }, {}),
    }))
    .sort((left, right) => left.domain.localeCompare(right.domain));
}

export function filterCookiesByDomains(cookies: ExportedCookie[], domains: string[]) {
  const selected = new Set(domains.map(normalizeCookieDomain));
  return cookies.filter((cookie) => selected.has(normalizeCookieDomain(cookie.domain)));
}

export function getCookieMatchingKey(cookie: ExportedCookie) {
  return [
    cookie.storeId || "0",
    stablePartitionKey(cookie.partitionKey),
    normalizeCookieDomain(cookie.domain).toLowerCase(),
    cookie.hostOnly ? "host" : "domain",
    normalizeCookiePath(cookie.path),
    cookie.name,
  ].join("\n");
}

export function createCookieImportPlan({
  incoming,
  existing,
  policy,
  selectedDomains,
}: {
  incoming: ExportedCookie[];
  existing: ExportedCookie[];
  policy: CookieImportPolicy;
  selectedDomains: string[];
}): CookieImportPlan {
  const existingByKey = new Set(existing.map(getCookieMatchingKey));
  const selectedCookies = selectedDomains.length
    ? filterCookiesByDomains(incoming, selectedDomains)
    : incoming;
  const selectedExisting = selectedDomains.length
    ? filterCookiesByDomains(existing, selectedDomains)
    : [];
  const deleteCookies = policy === "replace_selected_domains" ? selectedExisting : [];
  const items: CookieImportPlanItem[] = selectedCookies.map((cookie) => {
    const domain = normalizeCookieDomain(cookie.domain);
    const issue = getCookiePreflightIssue(cookie);
    if (issue) {
      return { cookie, domain, action: "skip_invalid", issue };
    }

    const exists = existingByKey.has(getCookieMatchingKey(cookie));
    if (policy === "skip_existing" && exists) {
      return { cookie, domain, action: "skip_existing" };
    }

    return { cookie, domain, action: exists ? "update" : "create" };
  });

  const domains = summarizeCookieImportDomains(items, deleteCookies);

  return {
    policy,
    total: selectedCookies.length,
    importable: items.filter((item) => item.action === "create" || item.action === "update").length,
    new: items.filter((item) => item.action === "create").length,
    overwrite: items.filter((item) => item.action === "update").length,
    skipExisting: items.filter((item) => item.action === "skip_existing").length,
    expired: items.filter((item) => item.issue?.code === "expired").length,
    invalid: items.filter((item) =>
      ["invalid_domain", "invalid_url", "insecure_samesite_none", "unsupported_partition_key"].includes(
        item.issue?.code ?? "",
      ),
    ).length,
    chromeRejectedRisk: items.filter((item) => item.issue?.code === "chrome_rejected").length,
    toDelete: deleteCookies.length,
    domains,
    items,
    deleteCookies,
  };
}

export function buildCookieSetDetails(cookie: ExportedCookie): chrome.cookies.SetDetails {
  const preflightIssue = getCookiePreflightIssue(cookie);
  if (preflightIssue) {
    throw new Error(preflightIssue.message);
  }

  const host = normalizeCookieDomain(cookie.domain);
  const path = cookie.path || "/";
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const details: chrome.cookies.SetDetails = {
    url: buildCookieUrl(cookie),
    name: cookie.name,
    value: cookie.value,
    path: normalizedPath,
    secure: cookie.secure,
    httpOnly: cookie.httpOnly,
    sameSite: cookie.sameSite,
    storeId: cookie.storeId,
    partitionKey: cookie.partitionKey,
  };

  if (!cookie.hostOnly) {
    details.domain = cookie.domain;
  }

  if (!cookie.session && cookie.expirationDate && cookie.expirationDate > Date.now() / 1000) {
    details.expirationDate = cookie.expirationDate;
  }

  return details;
}

export function buildCookieRemoveDetails(cookie: ExportedCookie): chrome.cookies.CookieDetails {
  const preflightIssue = getCookiePreflightIssue(cookie);
  if (preflightIssue) {
    throw new Error(preflightIssue.message);
  }

  return {
    url: buildCookieUrl(cookie),
    name: cookie.name,
    storeId: cookie.storeId,
    partitionKey: cookie.partitionKey,
  };
}

export function getCookiePreflightIssue(cookie: ExportedCookie): CookieImportIssue | null {
  if (!cookie.session && cookie.expirationDate && cookie.expirationDate <= Date.now() / 1000) {
    return createCookieIssue(cookie, "expired", "Cookie is expired.");
  }

  const host = normalizeCookieDomain(cookie.domain);
  if (!host || host.includes(" ") || host.startsWith(".") || host.endsWith(".")) {
    return createCookieIssue(cookie, "invalid_domain", "Cookie domain is invalid.");
  }

  if (cookie.sameSite === "no_restriction" && !cookie.secure) {
    return createCookieIssue(
      cookie,
      "insecure_samesite_none",
      "SameSite=None cookies must be Secure.",
    );
  }

  if (cookie.partitionKey && !cookie.partitionKey.topLevelSite) {
    return createCookieIssue(
      cookie,
      "unsupported_partition_key",
      "Partitioned cookie is missing a top-level site.",
    );
  }

  try {
    const path = cookie.path?.startsWith("/") ? cookie.path : `/${cookie.path || ""}`;
    const url = new URL(`${getCookieScheme(cookie)}://${host}${path}`);
    if (!url.hostname.includes(".")) {
      return createCookieIssue(cookie, "invalid_domain", "Cookie domain must be a registrable host.");
    }
  } catch {
    return createCookieIssue(cookie, "invalid_url", "Cookie URL cannot be reconstructed.");
  }

  return null;
}

export function createEmptyCookieDomainReport(): CookieDomainReport {
  return {
    total: 0,
    success: 0,
    failed: 0,
    skipped: 0,
    created: 0,
    updated: 0,
    deleted: 0,
    skippedExisting: 0,
    warnings: [],
    errors: [],
  };
}

export function classifyCookieSetError(cookie: ExportedCookie, error: unknown): CookieImportIssue {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();

  if (lower.includes("domain")) {
    return createCookieIssue(cookie, "invalid_domain", message);
  }

  if (lower.includes("url")) {
    return createCookieIssue(cookie, "invalid_url", message);
  }

  if (lower.includes("failed") || lower.includes("rejected")) {
    return createCookieIssue(cookie, "chrome_rejected", message);
  }

  return createCookieIssue(cookie, "unknown", message);
}

function createCookieIssue(
  cookie: ExportedCookie,
  code: CookieImportIssue["code"],
  message: string,
): CookieImportIssue {
  return {
    code,
    domain: cookie.domain,
    path: cookie.path,
    name: cookie.name,
    message,
  };
}

function summarizeCookieImportDomains(
  items: CookieImportPlanItem[],
  deleteCookies: ExportedCookie[],
): CookieDomainSummary[] {
  const groups = items.reduce<Record<string, CookieImportPlanItem[]>>((next, item) => {
    next[item.domain] ??= [];
    next[item.domain].push(item);
    return next;
  }, {});
  const deletes = deleteCookies.reduce<Record<string, number>>((next, cookie) => {
    const domain = normalizeCookieDomain(cookie.domain);
    next[domain] = (next[domain] ?? 0) + 1;
    return next;
  }, {});

  return Object.keys({ ...groups, ...deletes })
    .map((domain) => {
      const domainItems = groups[domain] ?? [];
      return {
        domain,
        total: domainItems.length,
        session: domainItems.filter((item) => item.cookie.session).length,
        persistent: domainItems.filter((item) => !item.cookie.session).length,
        secure: domainItems.filter((item) => item.cookie.secure).length,
        httpOnly: domainItems.filter((item) => item.cookie.httpOnly).length,
        sameSite: domainItems.reduce<Record<string, number>>((counts, item) => {
          const key = item.cookie.sameSite || "unspecified";
          counts[key] = (counts[key] ?? 0) + 1;
          return counts;
        }, {}),
        importable: domainItems.filter((item) => item.action === "create" || item.action === "update").length,
        skipped: domainItems.filter((item) => item.action === "skip_existing" || item.action === "skip_invalid").length,
        warnings: domainItems.filter((item) => item.issue).length,
        new: domainItems.filter((item) => item.action === "create").length,
        overwrite: domainItems.filter((item) => item.action === "update").length,
        skipExisting: domainItems.filter((item) => item.action === "skip_existing").length,
        expired: domainItems.filter((item) => item.issue?.code === "expired").length,
        invalid: domainItems.filter((item) =>
          ["invalid_domain", "invalid_url", "insecure_samesite_none", "unsupported_partition_key"].includes(
            item.issue?.code ?? "",
          ),
        ).length,
        chromeRejectedRisk: domainItems.filter((item) => item.issue?.code === "chrome_rejected").length,
        toDelete: deletes[domain] ?? 0,
      };
    })
    .sort((left, right) => {
      const issueDelta = (right.warnings ?? 0) - (left.warnings ?? 0);
      if (issueDelta !== 0) return issueDelta;
      return left.domain.localeCompare(right.domain);
    });
}

function buildCookieUrl(cookie: ExportedCookie) {
  const host = normalizeCookieDomain(cookie.domain);
  const path = normalizeCookiePath(cookie.path);
  return `${getCookieScheme(cookie)}://${host}${path}`;
}

function getCookieScheme(cookie: ExportedCookie) {
  return cookie.sourceScheme ?? (cookie.secure ? "https" : "http");
}

function normalizeCookiePath(path: string) {
  const normalized = path || "/";
  return normalized.startsWith("/") ? normalized : `/${normalized}`;
}

function stablePartitionKey(partitionKey: chrome.cookies.CookiePartitionKey | undefined) {
  if (!partitionKey) return "";
  return JSON.stringify({
    topLevelSite: partitionKey.topLevelSite ?? "",
    hasCrossSiteAncestor: partitionKey.hasCrossSiteAncestor ?? false,
  });
}
