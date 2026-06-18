import { summarizeCookieHealth } from "./diagnostics";
import {
  ArchivePreview,
  ImportReport,
  MigrationReportExport,
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
  return JSON.parse(JSON.stringify(report)) as ImportReport;
}
