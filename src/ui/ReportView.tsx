import { AlertTriangle, CheckCircle2, Download } from "lucide-react";
import { Button } from "../components/ui/button";
import { cookieHealthRank } from "../shared/diagnostics";
import { createMigrationReportExport } from "../shared/report-export";
import { ArchivePreview, CookieDomainHealth, ImportReport } from "../shared/types";
import { downloadMigrationReport } from "./bridge-client";
import { cookieOutcomeLabel, summarizeCookieOutcomes } from "./simpleFlow";

const labels = {
  bookmarks: "Bookmarks",
  cookies: "Cookies",
  extensions: "Extensions",
};

export function ReportView({
  preview,
  report,
}: {
  preview?: ArchivePreview | null;
  report: ImportReport;
}) {
  const hasErrors = Object.values(report).some(
    (value) => typeof value === "object" && "errors" in value && value.errors.length,
  );
  const outcomeSummary = summarizeCookieOutcomes(report);

  return (
    <div className="rounded-md border bg-card p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          {hasErrors || report.cancelled ? (
            <AlertTriangle className="h-4 w-4 text-amber-600" />
          ) : (
            <CheckCircle2 className="h-4 w-4 text-primary" />
          )}
          <div className="text-sm font-semibold">
            {report.cancelled ? "Restore stopped" : "Cookie restore report"}
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => downloadMigrationReport(createMigrationReportExport(report, preview))}
        >
          <Download className="h-4 w-4" />
          Download report
        </Button>
      </div>
      <div className="mb-3 grid gap-2 sm:grid-cols-3">
        <div className="rounded-md border bg-background p-2">
          <div className="text-lg font-semibold">{outcomeSummary.likelyRestored}</div>
          <div className="text-xs text-muted-foreground">Likely restored</div>
        </div>
        <div className="rounded-md border bg-background p-2">
          <div className="text-lg font-semibold">{outcomeSummary.mayNeedLogin}</div>
          <div className="text-xs text-muted-foreground">May need login</div>
        </div>
        <div className="rounded-md border bg-background p-2">
          <div className="text-lg font-semibold">{outcomeSummary.notRestored}</div>
          <div className="text-xs text-muted-foreground">Not restored</div>
        </div>
      </div>
      <CookieDomainBreakdown report={report} />
      <details className="mt-3 rounded-md border bg-background p-3">
        <summary className="cursor-pointer text-sm font-medium">Technical details</summary>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {(["bookmarks", "cookies", "extensions"] as const).map((section) => {
            const item = report[section];
            if (!item.requested) return null;
            return (
              <div key={section} className="rounded-md border bg-card p-3">
                <div className="text-sm font-medium">{labels[section]}</div>
                <div className="mt-2 text-xs leading-5 text-muted-foreground">
                  {item.total} total · {item.success} success
                </div>
                <div className="text-xs leading-5 text-muted-foreground">
                  {item.failed} failed · {item.skipped} skipped · {item.durationMs} ms
                </div>
                {section === "cookies" ? (
                  <div className="mt-1 text-xs leading-5 text-muted-foreground">
                    {item.created ?? 0} created · {item.updated ?? 0} updated ·{" "}
                    {item.deleted ?? 0} deleted
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </details>
      <MessageList title="Warnings" messages={collectMessages(report, "warnings")} />
      <MessageList title="Errors" messages={collectMessages(report, "errors")} />
    </div>
  );
}

function CookieDomainBreakdown({ report }: { report: ImportReport }) {
  const domains = Object.entries(report.cookies.domains ?? {})
    .filter(([, item]) => item.total || item.success || item.failed || item.skipped || item.deleted)
    .sort(([, left], [, right]) => {
      const healthDelta = cookieHealthRank(left.health) - cookieHealthRank(right.health);
      if (healthDelta !== 0) return healthDelta;
      const leftIssues = left.failed + left.warnings.length + left.errors.length;
      const rightIssues = right.failed + right.warnings.length + right.errors.length;
      return rightIssues - leftIssues || right.total - left.total;
    });

  if (domains.length === 0) return null;

  return (
    <div className="mt-3 rounded-md bg-muted p-3">
      <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
        Cookie domains
      </div>
      <div className="max-h-40 space-y-2 overflow-auto text-xs scrollbar-stable">
        {domains.slice(0, 20).map(([domain, item]) => (
          <div key={domain} className="rounded-md bg-background p-2">
            <div className="flex items-start justify-between gap-2">
              <div className="font-medium">{domain}</div>
              <span className={`rounded-sm px-1.5 py-0.5 text-[11px] font-medium ${healthClass(item.health)}`}>
                {cookieOutcomeLabel(item.health ?? "good")}
              </span>
            </div>
            <div className="mt-1 text-muted-foreground">
              {item.success} success · {item.failed} failed · {item.skipped} skipped ·{" "}
              {item.created} created · {item.updated} updated · {item.deleted} deleted
            </div>
            {item.recommendedAction ? (
              <div className="mt-1 text-muted-foreground">{item.recommendedAction}</div>
            ) : null}
            {item.errors[0] ? (
              <div className="mt-1 truncate text-destructive">{item.errors[0]}</div>
            ) : item.warnings[0] ? (
              <div className="mt-1 truncate text-amber-700">{item.warnings[0]}</div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function healthClass(health: CookieDomainHealth | undefined) {
  if (health === "failed") return "bg-destructive/10 text-destructive";
  if (health === "needs_login") return "bg-amber-100 text-amber-900";
  if (health === "partial") return "bg-blue-100 text-blue-900";
  return "bg-primary/10 text-primary";
}

function MessageList({ title, messages }: { title: string; messages: string[] }) {
  if (messages.length === 0) return null;
  return (
    <div className="mt-3 rounded-md bg-muted p-3">
      <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">{title}</div>
      <div className="max-h-32 space-y-1 overflow-auto text-xs leading-5 text-muted-foreground scrollbar-stable">
        {messages.map((message) => (
          <div key={message}>{message}</div>
        ))}
      </div>
    </div>
  );
}

function collectMessages(report: ImportReport, key: "warnings" | "errors") {
  return (["bookmarks", "cookies", "extensions"] as const).flatMap(
    (section) => report[section][key],
  );
}
