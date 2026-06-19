import { summarizeCookieHealth } from "./diagnostics";
import {
  ArchivePreview,
  CookieDomainReport,
  ImportReport,
  MigrationReportExport,
  SectionReport,
} from "./types";

export function createMigrationReportExport(
  report: ImportReport,
  preview?: ArchivePreview | null,
): MigrationReportExport {
  return {
    app: "browser-bridge",
    reportVersion: 1,
    createdAt: new Date().toISOString(),
    archive: preview
      ? {
          createdAt: preview.createdAt,
          source: preview.source,
          sections: preview.sections,
          cookieDomains: preview.cookieDomains.map((domain) => domain.domain),
        }
      : undefined,
    report: sanitizeReport(report),
    cookieHealthSummary: summarizeCookieHealth(report),
    note: "This report intentionally excludes cookie values and archive passwords.",
  };
}

function sanitizeReport(report: ImportReport): ImportReport {
  return {
    startedAt: report.startedAt,
    finishedAt: report.finishedAt,
    cancelled: report.cancelled,
    bookmarks: sanitizeSectionReport(report.bookmarks),
    cookies: sanitizeSectionReport(report.cookies),
    extensions: sanitizeSectionReport(report.extensions),
  };
}

function sanitizeSectionReport(report: SectionReport): SectionReport {
  return {
    requested: report.requested,
    total: report.total,
    success: report.success,
    failed: report.failed,
    skipped: report.skipped,
    created: report.created,
    updated: report.updated,
    deleted: report.deleted,
    skippedExisting: report.skippedExisting,
    domains: sanitizeDomainReports(report.domains),
    warnings: [...report.warnings],
    errors: [...report.errors],
    durationMs: report.durationMs,
  };
}

function sanitizeDomainReports(
  domains: SectionReport["domains"],
): SectionReport["domains"] {
  if (!domains) return undefined;
  return Object.fromEntries(
    Object.entries(domains).map(([domain, report]) => [domain, sanitizeDomainReport(report)]),
  );
}

function sanitizeDomainReport(report: CookieDomainReport): CookieDomainReport {
  return {
    total: report.total,
    success: report.success,
    failed: report.failed,
    skipped: report.skipped,
    created: report.created,
    updated: report.updated,
    deleted: report.deleted,
    skippedExisting: report.skippedExisting,
    warnings: [...report.warnings],
    errors: [...report.errors],
    health: report.health,
    reasonCodes: report.reasonCodes ? [...report.reasonCodes] : undefined,
    recommendedAction: report.recommendedAction,
    riskLevel: report.riskLevel,
  };
}
