import { describe, expect, it } from "vitest";
import { createImportReport } from "../src/shared/reports";
import { defaultSections } from "../src/shared/types";
import {
  cookieOutcomeLabel,
  getExportActionState,
  getImportActionState,
  hasSelectedSection,
  requiresAllDomainCookieAcknowledgement,
  summarizeCookieOutcomes,
} from "../src/ui/simpleFlow";

describe("simple cookie-first flow", () => {
  const sections = { bookmarks: true, cookies: true, extensions: true };

  it("defaults to cookies only", () => {
    expect(defaultSections).toEqual({
      bookmarks: false,
      cookies: true,
      extensions: false,
    });
  });

  it("requires explicit acknowledgement for all-domain cookie export", () => {
    expect(
      requiresAllDomainCookieAcknowledgement({
        sections,
        selectedDomains: 3,
        totalDomains: 3,
      }),
    ).toBe(true);

    expect(
      getExportActionState({
        allDomainAcknowledged: false,
        hasPassword: true,
        isBusy: false,
        sections,
        selectedDomains: 3,
        totalDomains: 3,
      }),
    ).toMatchObject({ disabled: true, needsAllDomainAcknowledgement: true });

    expect(
      getExportActionState({
        allDomainAcknowledged: true,
        hasPassword: true,
        isBusy: false,
        sections,
        selectedDomains: 3,
        totalDomains: 3,
      }),
    ).toMatchObject({
      disabled: false,
      label: "Export",
      needsAllDomainAcknowledgement: true,
    });
  });

  it("does not require all-domain acknowledgement for a partial cookie selection", () => {
    expect(
      requiresAllDomainCookieAcknowledgement({
        sections,
        selectedDomains: 2,
        totalDomains: 3,
      }),
    ).toBe(false);
  });

  it("disables export when no section is selected", () => {
    const noSections = { bookmarks: false, cookies: false, extensions: false };

    expect(hasSelectedSection(noSections)).toBe(false);
    expect(
      getExportActionState({
        allDomainAcknowledged: false,
        hasPassword: true,
        isBusy: false,
        sections: noSections,
        selectedDomains: 0,
        totalDomains: 3,
      }),
    ).toMatchObject({
      disabled: true,
      disabledReason: "Select at least one data type to export.",
      label: "Export",
    });
  });

  it("allows explicit non-cookie exports", () => {
    expect(
      getExportActionState({
        allDomainAcknowledged: false,
        hasPassword: true,
        isBusy: false,
        sections: { bookmarks: true, cookies: false, extensions: false },
        selectedDomains: 0,
        totalDomains: 3,
      }),
    ).toMatchObject({
      disabled: false,
      disabledReason: "",
      label: "Export",
    });
  });

  it("keeps import restore disabled until preview succeeds", () => {
    expect(
      getImportActionState({
        hasPreview: false,
        isBusy: false,
        policy: "overwrite",
        replaceAcknowledged: false,
      }),
    ).toMatchObject({ label: "Restore cookies", disabled: true });

    expect(
      getImportActionState({
        hasPreview: true,
        isBusy: false,
        policy: "overwrite",
        replaceAcknowledged: false,
      }),
    ).toMatchObject({ label: "Restore cookies", disabled: false });
  });

  it("uses user-facing cookie outcome labels", () => {
    expect(cookieOutcomeLabel("good")).toBe("Likely restored");
    expect(cookieOutcomeLabel("partial")).toBe("May need login");
    expect(cookieOutcomeLabel("needs_login")).toBe("May need login");
    expect(cookieOutcomeLabel("failed")).toBe("Not restored");
  });

  it("summarizes cookie outcomes for the report screen", () => {
    const report = createImportReport({ bookmarks: false, cookies: true, extensions: false });
    report.cookies.domains = {
      "example.com": {
        total: 1,
        success: 1,
        failed: 0,
        skipped: 0,
        created: 1,
        updated: 0,
        deleted: 0,
        skippedExisting: 0,
        warnings: [],
        errors: [],
        health: "good",
      },
      "github.com": {
        total: 1,
        success: 1,
        failed: 0,
        skipped: 1,
        created: 0,
        updated: 1,
        deleted: 0,
        skippedExisting: 1,
        warnings: ["skipped_existing: github.com has existing cookies."],
        errors: [],
        health: "partial",
      },
      "figma.com": {
        total: 1,
        success: 0,
        failed: 1,
        skipped: 0,
        created: 0,
        updated: 0,
        deleted: 0,
        skippedExisting: 0,
        warnings: [],
        errors: ["chrome_rejected: Chrome rejected this cookie."],
        health: "failed",
      },
    };

    expect(summarizeCookieOutcomes(report)).toEqual({
      likelyRestored: 1,
      mayNeedLogin: 1,
      notRestored: 1,
    });
  });
});
