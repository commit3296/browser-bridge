import { describe, expect, it } from "vitest";
import {
  classifyCookieDomainReport,
  summarizeCookieHealth,
} from "../src/shared/diagnostics";
import { createMigrationReportExport } from "../src/shared/report-export";
import { CookieDomainReport } from "../src/shared/types";
import { createImportReport } from "../src/shared/reports";

describe("cookie domain diagnostics", () => {
  it("classifies successful domains as good", () => {
    const diagnostics = classifyCookieDomainReport(domainReport({ total: 2, success: 2 }));

    expect(diagnostics).toMatchObject({
      health: "good",
      riskLevel: "low",
      reasonCodes: [],
    });
  });

  it("classifies mixed domains as partial", () => {
    const diagnostics = classifyCookieDomainReport(
      domainReport({
        total: 3,
        success: 2,
        skipped: 1,
        warnings: ["skipped_existing: example.com has 1 existing cookies to skip."],
      }),
    );

    expect(diagnostics).toMatchObject({
      health: "partial",
      riskLevel: "medium",
      reasonCodes: ["skipped_existing"],
    });
  });

  it("classifies total failures as failed", () => {
    const diagnostics = classifyCookieDomainReport(
      domainReport({
        total: 1,
        failed: 1,
        errors: ["chrome_rejected: example.com/ sid - Chrome rejected test cookie"],
      }),
    );

    expect(diagnostics.health).toBe("failed");
    expect(diagnostics.riskLevel).toBe("high");
    expect(diagnostics.reasonCodes).toContain("chrome_rejected");
  });

  it("classifies high-risk skipped domains as needs login", () => {
    const diagnostics = classifyCookieDomainReport(
      domainReport({
        total: 2,
        skipped: 2,
        warnings: ["expired: example.com has 2 expired cookies."],
      }),
    );

    expect(diagnostics.health).toBe("needs_login");
    expect(diagnostics.recommendedAction).toContain("sign in again");
  });

  it("exports sanitized report JSON with health summary and no cookie values", () => {
    const report = createImportReport({ bookmarks: false, cookies: true, extensions: false });
    report.cookies.domains = {
      "example.com": {
        ...domainReport({
          total: 1,
          success: 1,
          warnings: ["skipped_existing: example.com has 1 existing cookies to skip."],
        }),
        health: "partial",
        reasonCodes: ["skipped_existing"],
        recommendedAction: "Open the site and verify the session.",
        riskLevel: "medium",
      },
    };

    const exported = createMigrationReportExport(report, {
      createdAt: "2026-06-18T00:00:00.000Z",
      source: {
        browser: "chrome",
        browserName: "Google Chrome",
        browserFamily: "chromium",
        extensionVersion: "0.1.0",
      },
      sections: { bookmarks: false, cookies: true, extensions: false },
      cookieDomains: [{ domain: "example.com", total: 1, session: 1, persistent: 0, secure: 1, httpOnly: 1, sameSite: {} }],
      cookies: {
        policy: "overwrite",
        total: 1,
        importable: 1,
        new: 1,
        overwrite: 0,
        skipExisting: 0,
        expired: 0,
        invalid: 0,
        chromeRejectedRisk: 0,
        toDelete: 0,
      },
      bookmarks: { total: 0 },
      extensions: { total: 0, items: [], missing: 0, installed: 0 },
    });

    const json = JSON.stringify(exported);
    expect(exported.cookieHealthSummary.partial).toBe(1);
    expect(json).not.toContain("secret-cookie-value");
    expect(json).not.toContain("archive-password");
  });
});

function domainReport(overrides: Partial<CookieDomainReport> = {}): CookieDomainReport {
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
    ...overrides,
  };
}
