import { BridgeSection, ImportReport, SectionReport, SectionSelection } from "./types";

export function createImportReport(sections: SectionSelection): ImportReport {
  const now = new Date().toISOString();
  return {
    startedAt: now,
    finishedAt: now,
    cancelled: false,
    bookmarks: createSectionReport(sections.bookmarks),
    cookies: createSectionReport(sections.cookies),
    extensions: createSectionReport(sections.extensions),
  };
}

export function createSectionReport(requested: boolean): SectionReport {
  return {
    requested,
    total: 0,
    success: 0,
    failed: 0,
    skipped: 0,
    created: 0,
    updated: 0,
    deleted: 0,
    skippedExisting: 0,
    domains: {},
    warnings: [],
    errors: [],
    durationMs: 0,
  };
}

export function pushReportMessage(messages: string[], message: string, limit = 25) {
  if (messages.length < limit) messages.push(message);
}

export async function timeSection<T>(
  report: ImportReport,
  section: BridgeSection,
  task: () => Promise<T> | T,
) {
  const started = performance.now();
  try {
    return await task();
  } finally {
    report[section].durationMs += Math.round(performance.now() - started);
    report.finishedAt = new Date().toISOString();
  }
}
