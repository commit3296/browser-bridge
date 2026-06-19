import { describe, expect, it } from "vitest";
import { createEmptyCookieDomainReport } from "../src/shared/cookies";
import { createMigrationReportExport } from "../src/shared/report-export";
import { createImportReport } from "../src/shared/reports";

describe("migration report export", () => {
  it("exports only allow-listed report fields", () => {
    const report = createImportReport({ bookmarks: false, cookies: true, extensions: false });
    report.cookies.total = 1;
    report.cookies.success = 1;
    report.cookies.domains = {
      "example.com": {
        ...createEmptyCookieDomainReport(),
        total: 1,
        success: 1,
        created: 1,
        health: "good",
        reasonCodes: [],
        riskLevel: "low",
      },
    };

    Object.assign(report.cookies, {
      accidentalCookieValue: "known-secret-cookie-value",
      archivePassword: "known-secret-password",
    });
    Object.assign(report.cookies.domains["example.com"], {
      accidentalCookieValue: "known-secret-cookie-value",
    });

    const exported = createMigrationReportExport(report);
    const serialized = JSON.stringify(exported);

    expect(serialized).not.toContain("known-secret-cookie-value");
    expect(serialized).not.toContain("known-secret-password");
    expect(exported.report.cookies.domains?.["example.com"]).toMatchObject({
      total: 1,
      success: 1,
      created: 1,
      health: "good",
    });
  });
});
