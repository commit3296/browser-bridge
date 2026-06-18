import { summarizeCookieHealth } from "../shared/diagnostics";
import {
  CookieDomainHealth,
  CookieDomainSummary,
  CookieImportPolicy,
  ImportReport,
  SectionSelection,
} from "../shared/types";

export type CookieTransferSummary = {
  domains: number;
  total: number;
  session: number;
  persistent: number;
};

export function summarizeCookieTransfer(domains: CookieDomainSummary[]): CookieTransferSummary {
  return domains.reduce(
    (summary, domain) => ({
      domains: summary.domains + 1,
      total: summary.total + domain.total,
      session: summary.session + domain.session,
      persistent: summary.persistent + domain.persistent,
    }),
    { domains: 0, total: 0, session: 0, persistent: 0 },
  );
}

export function requiresAllDomainCookieAcknowledgement({
  sections,
  selectedDomains,
  totalDomains,
}: {
  sections: SectionSelection;
  selectedDomains: number;
  totalDomains: number;
}) {
  return sections.cookies && totalDomains > 0 && selectedDomains === totalDomains;
}

export function hasSelectedSection(sections: SectionSelection) {
  return sections.bookmarks || sections.cookies || sections.extensions;
}

export function getExportActionState({
  allDomainAcknowledged,
  hasPassword,
  isBusy,
  sections,
  selectedDomains,
  totalDomains,
}: {
  allDomainAcknowledged: boolean;
  hasPassword: boolean;
  isBusy: boolean;
  sections: SectionSelection;
  selectedDomains: number;
  totalDomains: number;
}) {
  const needsAllDomainAcknowledgement = requiresAllDomainCookieAcknowledgement({
    sections,
    selectedDomains,
    totalDomains,
  });
  const hasDataToExport = hasSelectedSection(sections);

  return {
    label: "Export",
    disabled:
      isBusy ||
      !hasDataToExport ||
      (sections.cookies && selectedDomains === 0) ||
      !hasPassword ||
      (needsAllDomainAcknowledgement && !allDomainAcknowledged),
    disabledReason: !hasDataToExport
      ? "Select at least one data type to export."
      : sections.cookies && totalDomains === 0
        ? "Open the sites you want to transfer, then refresh cookies."
        : sections.cookies && selectedDomains === 0
          ? "Select at least one cookie domain or disable cookies."
          : !hasPassword
            ? "Enter a password for the encrypted archive."
            : needsAllDomainAcknowledgement && !allDomainAcknowledged
              ? "Confirm that you understand the encrypted cookie archive can keep websites signed in."
              : "",
    needsAllDomainAcknowledgement,
  };
}

export function getPreviewActionState({
  hasArchive,
  hasPassword,
  isBusy,
  sections,
}: {
  hasArchive: boolean;
  hasPassword: boolean;
  isBusy: boolean;
  sections: SectionSelection;
}) {
  const hasDataToPreview = hasSelectedSection(sections);

  return {
    label: "Preview cookies",
    disabled: isBusy || !hasArchive || !hasPassword || !hasDataToPreview,
    disabledReason: !hasArchive
      ? "Choose an encrypted archive to preview."
      : !hasPassword
        ? "Enter the archive password."
        : !hasDataToPreview
          ? "Select at least one data type to preview."
          : "",
  };
}

export function getPasswordCopyState({
  copied,
  hasPassword,
  isBusy,
}: {
  copied: boolean;
  hasPassword: boolean;
  isBusy: boolean;
}) {
  return {
    label: copied ? "Copied" : "Copy password",
    disabled: isBusy || !hasPassword,
  };
}

export function getImportActionState({
  hasPassword,
  hasPreview,
  isBusy,
  policy,
  replaceAcknowledged,
  sections,
}: {
  hasPassword: boolean;
  hasPreview: boolean;
  isBusy: boolean;
  policy: CookieImportPolicy;
  replaceAcknowledged: boolean;
  sections: SectionSelection;
}) {
  const hasDataToRestore = hasSelectedSection(sections);
  const needsReplaceAcknowledgement =
    policy === "replace_selected_domains" && !replaceAcknowledged;

  return {
    label: policy === "dry_run" ? "Run dry run" : "Restore cookies",
    disabled:
      isBusy || !hasPreview || !hasDataToRestore || !hasPassword || needsReplaceAcknowledgement,
    disabledReason: !hasDataToRestore
      ? "Select at least one data type to restore."
      : !hasPreview
        ? "Preview the archive before restoring cookies."
        : !hasPassword
          ? "Enter the archive password."
          : needsReplaceAcknowledgement
            ? "Confirm replace mode before deleting selected-domain cookies."
            : "",
  };
}

export function cookieOutcomeLabel(health: CookieDomainHealth) {
  const labels: Record<CookieDomainHealth, string> = {
    good: "Likely restored",
    partial: "May need login",
    needs_login: "May need login",
    failed: "Not restored",
  };
  return labels[health];
}

export function summarizeCookieOutcomes(report: ImportReport) {
  const health = summarizeCookieHealth(report);
  return {
    likelyRestored: health.good,
    mayNeedLogin: health.partial + health.needs_login,
    notRestored: health.failed,
  };
}
