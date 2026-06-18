import {
  CookieDomainHealth,
  CookieDomainReport,
  CookieDomainRiskLevel,
  ImportReport,
} from "./types";

type DomainDiagnostics = Required<
  Pick<CookieDomainReport, "health" | "reasonCodes" | "recommendedAction" | "riskLevel">
>;

const highRiskCodes = [
  "expired",
  "invalid_domain",
  "invalid_url",
  "insecure_samesite_none",
  "unsupported_partition_key",
  "chrome_rejected",
];

export function applyCookieDomainDiagnostics(report: ImportReport) {
  for (const domainReport of Object.values(report.cookies.domains ?? {})) {
    const diagnostics = classifyCookieDomainReport(domainReport);
    domainReport.health = diagnostics.health;
    domainReport.reasonCodes = diagnostics.reasonCodes;
    domainReport.recommendedAction = diagnostics.recommendedAction;
    domainReport.riskLevel = diagnostics.riskLevel;
  }
}

export function classifyCookieDomainReport(report: CookieDomainReport): DomainDiagnostics {
  const reasonCodes = extractReasonCodes(report);
  const highRiskCount = reasonCodes.filter((code) => highRiskCodes.includes(code)).length;
  const problemOperations = report.failed + report.skipped;
  const issueSignals = problemOperations + report.warnings.length + report.errors.length;
  const totalOperations = Math.max(report.total, report.success + problemOperations, 1);

  if (report.success === 0 && report.failed > 0) {
    return {
      health: "failed",
      reasonCodes: reasonCodes.length ? reasonCodes : ["import_failed"],
      recommendedAction: "Review domain errors and retry after checking Chrome cookie restrictions.",
      riskLevel: "high",
    };
  }

  if (
    (report.success === 0 && report.skipped > 0 && highRiskCount > 0) ||
    (highRiskCount > 0 && problemOperations / totalOperations >= 0.5)
  ) {
    return {
      health: "needs_login",
      reasonCodes: reasonCodes.length ? reasonCodes : ["login_likely_required"],
      recommendedAction: "Open this site in the target browser and sign in again if the session is missing.",
      riskLevel: "high",
    };
  }

  if (report.success > 0 && issueSignals > 0) {
    return {
      health: "partial",
      reasonCodes: reasonCodes.length ? reasonCodes : ["partial_import"],
      recommendedAction: "Open the site and verify the session; some cookies were skipped or warned.",
      riskLevel: highRiskCount > 0 || report.failed > 0 ? "high" : "medium",
    };
  }

  return {
    health: "good",
    reasonCodes: [],
    recommendedAction: "No action needed.",
    riskLevel: "low",
  };
}

export function summarizeCookieHealth(report: ImportReport): Record<CookieDomainHealth, number> {
  const summary: Record<CookieDomainHealth, number> = {
    good: 0,
    partial: 0,
    failed: 0,
    needs_login: 0,
  };

  for (const domain of Object.values(report.cookies.domains ?? {})) {
    const health = domain.health ?? classifyCookieDomainReport(domain).health;
    summary[health] += 1;
  }

  return summary;
}

function extractReasonCodes(report: CookieDomainReport) {
  const codes = new Set<string>();
  for (const message of [...report.warnings, ...report.errors]) {
    const [code] = message.split(":");
    if (code && /^[a-z_]+$/.test(code)) codes.add(code);
  }
  if (report.failed > 0 && codes.size === 0) codes.add("import_failed");
  if (report.skippedExisting > 0) codes.add("skipped_existing");
  return [...codes].sort();
}

export function cookieHealthLabel(health: CookieDomainHealth) {
  const labels: Record<CookieDomainHealth, string> = {
    good: "Good",
    partial: "Partial",
    failed: "Failed",
    needs_login: "Needs login",
  };
  return labels[health];
}

export function cookieHealthRank(health: CookieDomainHealth | undefined) {
  if (health === "failed") return 0;
  if (health === "needs_login") return 1;
  if (health === "partial") return 2;
  return 3;
}
