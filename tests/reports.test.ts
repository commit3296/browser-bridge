import { describe, expect, it } from "vitest";
import { createImportReport, pushReportMessage } from "../src/shared/reports";

describe("reports", () => {
  it("tracks counters and caps messages", () => {
    const report = createImportReport({
      bookmarks: true,
      cookies: false,
      extensions: true,
    });

    report.bookmarks.total = 2;
    report.bookmarks.success = 1;
    report.bookmarks.failed = 1;
    for (let index = 0; index < 30; index += 1) {
      pushReportMessage(report.bookmarks.errors, `error ${index}`);
    }

    expect(report.bookmarks.requested).toBe(true);
    expect(report.cookies.requested).toBe(false);
    expect(report.bookmarks.errors).toHaveLength(25);
  });
});
