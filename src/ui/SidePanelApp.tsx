import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  CloudOff,
  EyeOff,
  FileJson,
  Loader2,
  LockKeyhole,
  SlidersHorizontal,
  RefreshCw,
  ShieldCheck,
  Square,
} from "lucide-react";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { browser } from "wxt/browser";
import { Button } from "../components/ui/button";
import { Checkbox } from "../components/ui/checkbox";
import {
  CookieImportPolicy,
  defaultCookieImportPolicy,
  defaultSections,
  EncryptedArchiveV2,
  ImportReport,
  ProgressEvent,
  SectionSelection,
} from "../shared/types";
import {
  createOperationId,
  downloadArchive,
  getErrorMessage,
  isProgressEvent,
  readArchiveFile,
  sendBridgeMessage,
} from "./bridge-client";
import { CookiePreview } from "./CookiePreview";
import { DomainPicker } from "./DomainPicker";
import { ExtensionInventory } from "./ExtensionInventory";
import { PasswordStrength, getPasswordScore } from "./PasswordStrength";
import { ProgressPanel } from "./ProgressPanel";
import { QaDiagnostics } from "./QaDiagnostics";
import { ReportView } from "./ReportView";
import { SectionPicker } from "./SectionPicker";
import { CookieDomainSummary, ArchivePreview } from "../shared/types";
import {
  getExportActionState,
  getImportActionState,
  requiresAllDomainCookieAcknowledgement,
  summarizeCookieTransfer,
} from "./simpleFlow";

type Mode = "export" | "import";
type BusyState = "idle" | "loading-domains" | "exporting" | "previewing" | "importing";

export function SidePanelApp() {
  const [mode, setMode] = useState<Mode>("export");
  const [sections, setSections] = useState<SectionSelection>(defaultSections);
  const [domains, setDomains] = useState<CookieDomainSummary[]>([]);
  const [selectedDomains, setSelectedDomains] = useState<string[]>([]);
  const [cookieImportPolicy, setCookieImportPolicy] =
    useState<CookieImportPolicy>(defaultCookieImportPolicy);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<BusyState>("idle");
  const [error, setError] = useState("");
  const [progress, setProgress] = useState<ProgressEvent | null>(null);
  const [lastPreview, setLastPreview] = useState<ArchivePreview | null>(null);
  const [archive, setArchive] = useState<EncryptedArchiveV2 | null>(null);
  const [archiveName, setArchiveName] = useState("");
  const [report, setReport] = useState<ImportReport | null>(null);
  const [archiveSaved, setArchiveSaved] = useState(false);
  const [domainReviewOpen, setDomainReviewOpen] = useState(false);
  const [allDomainExportAcknowledged, setAllDomainExportAcknowledged] = useState(false);
  const [replaceImportAcknowledged, setReplaceImportAcknowledged] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(
    () => new URLSearchParams(window.location.search).get("qa") === "1",
  );
  const operationIdRef = useRef(createOperationId());
  const fileRef = useRef<HTMLInputElement>(null);

  const isBusy = busy !== "idle";
  const importDomains = useMemo(
    () => lastPreview?.cookieDomains ?? [],
    [lastPreview],
  );
  const visibleDomains = mode === "export" ? domains : importDomains;
  const allVisibleDomainsSelected =
    visibleDomains.length > 0 && selectedDomains.length === visibleDomains.length;
  const selectedDomainSummaries = useMemo(() => {
    const selected = new Set(selectedDomains);
    return visibleDomains.filter((domain) => selected.has(domain.domain));
  }, [selectedDomains, visibleDomains]);
  const cookieSummary = useMemo(
    () => summarizeCookieTransfer(selectedDomainSummaries),
    [selectedDomainSummaries],
  );
  const needsAllDomainExportAcknowledgement =
    mode === "export" &&
    requiresAllDomainCookieAcknowledgement({
      sections,
      selectedDomains: selectedDomains.length,
      totalDomains: visibleDomains.length,
    });
  const exportAction = getExportActionState({
    allDomainAcknowledged: allDomainExportAcknowledged,
    hasPassword: Boolean(password),
    isBusy,
    sections,
    selectedDomains: selectedDomains.length,
    totalDomains: visibleDomains.length,
  });
  const importAction = getImportActionState({
    hasPreview: Boolean(lastPreview),
    isBusy,
    policy: cookieImportPolicy,
    replaceAcknowledged: replaceImportAcknowledged,
  });
  const showQaDiagnostics =
    import.meta.env.DEV || new URLSearchParams(window.location.search).get("qa") === "1";
  const showStandaloneCookieWarning =
    sections.cookies && !(mode === "export" && needsAllDomainExportAcknowledgement);

  useEffect(() => {
    const listener = (message: unknown) => {
      if (isProgressEvent(message) && message.operationId === operationIdRef.current) {
        setProgress(message);
      }
    };
    browser.runtime.onMessage.addListener(listener);
    void refreshDomains();
    return () => browser.runtime.onMessage.removeListener(listener);
  }, []);

  async function refreshDomains() {
    setBusy("loading-domains");
    setError("");
    try {
      const response = await sendBridgeMessage({ type: "GET_COOKIE_DOMAINS" });
      if (!response.ok || !("cookieDomains" in response)) {
        throw new Error(response.ok ? "Unexpected domain response." : response.error);
      }
      setDomains(response.cookieDomains);
      setSelectedDomains(response.cookieDomains.map((domain) => domain.domain));
      setAllDomainExportAcknowledged(false);
    } catch (refreshError) {
      setError(getErrorMessage(refreshError));
    } finally {
      setBusy("idle");
    }
  }

  async function selectOpenTabDomains() {
    setError("");
    try {
      const response = await sendBridgeMessage({ type: "GET_TAB_COOKIE_DOMAINS" });
      if (!response.ok || !("cookieDomains" in response)) {
        throw new Error(response.ok ? "Unexpected tab domain response." : response.error);
      }
      const available = new Set(visibleDomains.map((domain) => domain.domain));
      const tabDomains = response.cookieDomains
        .map((domain) => domain.domain)
        .filter((domain) => available.has(domain))
        .sort();
      setSelectedDomains(tabDomains);
      setAllDomainExportAcknowledged(false);
      if (tabDomains.length === 0) {
        setError("No open tab domains match the current cookie list.");
      }
    } catch (tabError) {
      setError(getErrorMessage(tabError));
    }
  }

  async function handleExport() {
    if (!password) {
      setError("Enter a password for the encrypted archive.");
      return;
    }
    if (sections.cookies && selectedDomains.length === 0) {
      setError("Select at least one cookie domain or disable cookies.");
      return;
    }
    if (needsAllDomainExportAcknowledgement && !allDomainExportAcknowledged) {
      setError("Confirm that you understand the encrypted cookie archive can keep websites signed in.");
      return;
    }

    operationIdRef.current = createOperationId();
    setBusy("exporting");
    setError("");
    setReport(null);
    setLastPreview(null);
    setProgress(null);
    setArchiveSaved(false);

    try {
      const response = await sendBridgeMessage({
        type: "CREATE_ARCHIVE",
        operationId: operationIdRef.current,
        sections,
        cookieDomains: selectedDomains,
        password,
      });
      if (!response.ok || !("archive" in response)) {
        throw new Error(response.ok ? "Unexpected export response." : response.error);
      }
      setLastPreview(response.preview);
      downloadArchive(response.archive);
      setArchiveSaved(true);
      setPassword("");
      setAllDomainExportAcknowledged(false);
    } catch (exportError) {
      setError(getErrorMessage(exportError));
    } finally {
      setBusy("idle");
    }
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError("");
    setReport(null);
    setLastPreview(null);
    setSelectedDomains([]);
    try {
      setArchive(await readArchiveFile(file));
      setArchiveName(file.name);
      setArchiveSaved(false);
      setReplaceImportAcknowledged(false);
      setDomainReviewOpen(false);
      setMode("import");
    } catch (fileError) {
      setArchive(null);
      setArchiveName("");
      setError(getErrorMessage(fileError));
    } finally {
      event.target.value = "";
    }
  }

  async function handlePreview() {
    await previewArchive(cookieImportPolicy);
  }

  async function previewArchive(policy: CookieImportPolicy) {
    if (!archive) {
      fileRef.current?.click();
      return;
    }
    if (!password) {
      setError("Enter the archive password.");
      return;
    }

    operationIdRef.current = createOperationId();
    setBusy("previewing");
    setError("");
    setProgress(null);
    setReport(null);

    try {
      const response = await sendBridgeMessage({
        type: "PREVIEW_ARCHIVE",
        operationId: operationIdRef.current,
        archive,
        password,
        sections,
        cookieDomains: selectedDomains,
        cookieImportPolicy: policy,
      });
      if (!response.ok || !("preview" in response)) {
        throw new Error(response.ok ? "Unexpected preview response." : response.error);
      }
      setLastPreview(response.preview);
      setSections(response.preview.sections);
      if (selectedDomains.length === 0) {
        setSelectedDomains(response.preview.cookieDomains.map((domain) => domain.domain));
      }
    } catch (previewError) {
      setError(getErrorMessage(previewError));
    } finally {
      setBusy("idle");
    }
  }

  function handleCookieImportPolicyChange(policy: CookieImportPolicy) {
    setCookieImportPolicy(policy);
    setReplaceImportAcknowledged(false);
    if (mode === "import" && archive && password && lastPreview && !isBusy) {
      void previewArchive(policy);
    }
  }

  function handleSectionChange(nextSections: SectionSelection) {
    setSections(nextSections);
    setAllDomainExportAcknowledged(false);
  }

  function handleSelectedDomainsChange(nextDomains: string[]) {
    setSelectedDomains(nextDomains);
    setAllDomainExportAcknowledged(false);
    setReplaceImportAcknowledged(false);
  }

  async function handleImport() {
    if (!archive || !lastPreview) {
      await handlePreview();
      return;
    }

    if (
      sections.cookies &&
      cookieImportPolicy === "replace_selected_domains" &&
      !replaceImportAcknowledged
    ) {
      setError("Confirm replace mode before deleting selected-domain cookies.");
      return;
    }

    operationIdRef.current = createOperationId();
    setBusy("importing");
    setError("");
    setProgress(null);
    setReport(null);

    try {
      const response = await sendBridgeMessage({
        type: "IMPORT_ARCHIVE",
        operationId: operationIdRef.current,
        archive,
        password,
        sections,
        cookieDomains: selectedDomains,
        cookieImportPolicy,
      });
      if (!response.ok || !("report" in response)) {
        throw new Error(response.ok ? "Unexpected import response." : response.error);
      }
      setReport(response.report);
      setPassword("");
    } catch (importError) {
      setError(getErrorMessage(importError));
    } finally {
      setBusy("idle");
    }
  }

  async function handleCancel() {
    await sendBridgeMessage({
      type: "CANCEL_OPERATION",
      operationId: operationIdRef.current,
    });
  }

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b bg-card px-4 py-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Cookie transfer
            </div>
            <h1 className="mt-0.5 text-xl font-semibold">Browser Bridge</h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              aria-label={advancedOpen ? "Hide advanced settings" : "Show advanced settings"}
              className={advancedOpen ? "border-primary bg-primary/10 text-primary" : ""}
              size="icon"
              title={advancedOpen ? "Hide advanced settings" : "Show advanced settings"}
              variant="outline"
              onClick={() => setAdvancedOpen((open) => !open)}
            >
              <SlidersHorizontal className="h-4 w-4" />
            </Button>
            <Button
              disabled={busy === "loading-domains"}
              size="icon"
              title="Refresh domains"
              variant="outline"
              onClick={refreshDomains}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <TrustStrip />
      </header>

      <section className="border-b bg-card px-4 py-2.5">
        <ActionChooser
          mode={mode}
          onChange={(nextMode) => {
            setMode(nextMode);
            setError("");
            setReport(null);
            setDomainReviewOpen(false);
            setReplaceImportAcknowledged(false);
          }}
        />
      </section>

      <section className="space-y-4 px-4 py-4">
        <GuidedStatus
          archiveSelected={Boolean(archive)}
          archiveSaved={archiveSaved}
          hasPassword={Boolean(password)}
          hasPreview={Boolean(lastPreview)}
          hasReport={Boolean(report)}
          mode={mode}
          sections={sections}
          selectedDomains={selectedDomains.length}
        />

        {mode === "import" ? (
          <Panel title="Choose archive">
            <input
              ref={fileRef}
              className="hidden"
              type="file"
              accept="application/json,.json"
              onChange={handleFileChange}
            />
            <div className="flex items-center gap-3 rounded-md border bg-card p-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted">
                <FileJson className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">
                  {archiveName || "No archive selected"}
                </div>
                <div className="text-xs text-muted-foreground">
                  Local encrypted Browser Bridge archive
                </div>
              </div>
              <Button disabled={isBusy} variant="outline" onClick={() => fileRef.current?.click()}>
                Choose
              </Button>
            </div>
          </Panel>
        ) : null}

        <Panel title={mode === "export" ? "Data to transfer" : "Data to restore"}>
          <SectionPicker disabled={isBusy} sections={sections} onChange={handleSectionChange} />
        </Panel>

        <Panel title="Password">
          <input
            className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none transition-[border-color,box-shadow] duration-150 focus:border-primary focus:ring-2 focus:ring-ring/20"
            disabled={isBusy}
            placeholder={mode === "export" ? "Password for encrypted archive" : "Archive password"}
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <PasswordStrength password={password} />
          {mode === "export" && sections.cookies && getPasswordScore(password) > 0 && getPasswordScore(password) < 3 ? (
            <div className="mt-2 text-xs text-amber-700">
              Use at least 16 characters with mixed case, numbers, and symbols for cookie archives.
            </div>
          ) : null}
        </Panel>

        {sections.cookies ? (
          <Panel
            aside={
              mode === "export" && !advancedOpen ? (
                <Button
                  className="h-7 px-2 text-xs"
                  disabled={isBusy || visibleDomains.length === 0}
                  size="sm"
                  variant="ghost"
                  onClick={() => setDomainReviewOpen((open) => !open)}
                >
                  {domainReviewOpen ? "Hide" : "Review"}
                </Button>
              ) : (
                <span className="text-xs text-muted-foreground">
                  {selectedDomains.length} / {visibleDomains.length}
                  {allVisibleDomainsSelected ? " · all selected" : ""}
                </span>
              )
            }
            title={mode === "export" ? "Cookie domains" : "Cookie restore preview"}
          >
            <CookieDomainSummaryPanel
              archiveReady={Boolean(archive)}
              mode={mode}
              previewReady={Boolean(lastPreview)}
              summary={cookieSummary}
              totalDomains={visibleDomains.length}
            />
            {needsAllDomainExportAcknowledgement ? (
              <CookieArchiveAcknowledgement
                checked={allDomainExportAcknowledged}
                onChange={setAllDomainExportAcknowledged}
              />
            ) : null}
            {advancedOpen || (mode === "export" && domainReviewOpen) ? (
              <div className="mt-3">
                <DomainPicker
                  disabled={isBusy}
                  domains={visibleDomains}
                  selected={selectedDomains}
                  onSelectOpenTabs={selectOpenTabDomains}
                  onChange={handleSelectedDomainsChange}
                />
              </div>
            ) : null}
          </Panel>
        ) : null}

        {mode === "import" && sections.cookies ? (
          advancedOpen ? (
            <Panel title="Advanced cookie restore policy">
              <CookiePolicySelector
                disabled={isBusy}
                policy={cookieImportPolicy}
                onChange={handleCookieImportPolicyChange}
              />
              {cookieImportPolicy === "replace_selected_domains" ? (
                <ReplaceDomainAcknowledgement
                  checked={replaceImportAcknowledged}
                  onChange={setReplaceImportAcknowledged}
                />
              ) : null}
            </Panel>
          ) : (
            <div className="rounded-md border bg-card p-3 text-xs leading-5 text-muted-foreground">
              Restore matching cookies without deleting other browser data. Preview first to see
              how many cookies will be new, updated, skipped, or require attention.
            </div>
          )
        ) : null}

        {showStandaloneCookieWarning ? (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-2.5 text-amber-950">
            <div className="flex gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p className="text-xs leading-4">
                Cookies may keep websites signed in. Keep encrypted archives private; passwords
                cannot be recovered.
              </p>
            </div>
          </div>
        ) : null}

        {lastPreview ? <PreviewPanel advanced={advancedOpen} preview={lastPreview} /> : null}
        {lastPreview && advancedOpen ? <ExtensionInventory items={lastPreview.extensions.items} /> : null}
        <ProgressPanel progress={progress} />
        {report ? <ReportView preview={lastPreview} report={report} /> : null}
        {showQaDiagnostics && advancedOpen ? <QaDiagnostics /> : null}

        {error ? (
          <div className="rounded-md border border-destructive/35 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}
      </section>

      <footer className="sticky bottom-0 flex gap-2 border-t bg-card/95 px-4 py-3 backdrop-blur">
        {busy === "importing" ? (
          <Button variant="outline" onClick={handleCancel}>
            <Square className="h-4 w-4" />
            Stop
          </Button>
        ) : null}
        {mode === "import" ? (
          <Button className="flex-1" disabled={isBusy} variant="outline" onClick={handlePreview}>
            {busy === "previewing" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Preview cookies
          </Button>
        ) : null}
        <Button
          className="flex-1"
          disabled={mode === "export" ? exportAction.disabled : importAction.disabled}
          onClick={mode === "export" ? handleExport : handleImport}
        >
          {busy === "exporting" || busy === "importing" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : null}
          {mode === "export" ? exportAction.label : importAction.label}
        </Button>
      </footer>
    </main>
  );
}

function GuidedStatus({
  archiveSelected,
  archiveSaved,
  hasPassword,
  hasPreview,
  hasReport,
  mode,
  sections,
  selectedDomains,
}: {
  archiveSelected: boolean;
  archiveSaved: boolean;
  hasPassword: boolean;
  hasPreview: boolean;
  hasReport: boolean;
  mode: Mode;
  sections: SectionSelection;
  selectedDomains: number;
}) {
  const steps = [
    { label: "Choose action", done: true },
    {
      label: mode === "export" ? "Choose cookies" : "Choose archive",
      done: !sections.cookies || selectedDomains > 0,
    },
    {
      label: mode === "export" ? "Password" : "File and password",
      done: mode === "export" ? hasPassword || archiveSaved : archiveSelected && hasPassword,
    },
    {
      label: mode === "export" ? "Create archive" : "Preview",
      done: mode === "export" ? archiveSaved : hasPreview || hasReport,
    },
    {
      label: "Report",
      done: mode === "export" ? archiveSaved : hasReport,
    },
  ];
  const firstIncompleteIndex = steps.findIndex((step) => !step.done);
  const activeIndex = firstIncompleteIndex === -1 ? steps.length - 1 : firstIncompleteIndex;
  const activeStep = steps[activeIndex];

  return (
    <section className="flex min-h-10 items-center gap-2 rounded-md border bg-card px-2.5 py-1.5">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span className="rounded-sm bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary">
          {mode === "export" ? "Export" : "Import"}
        </span>
        <span className="shrink-0 text-xs text-muted-foreground">
          Step {activeIndex + 1}/{steps.length}
        </span>
        <span className="truncate text-xs font-medium">{activeStep.label}</span>
        <div className="ml-0.5 hidden shrink-0 items-center gap-1 min-[360px]:flex" aria-hidden="true">
          {steps.map((step, index) => (
            <span
              key={step.label}
              className={`h-1.5 w-1.5 rounded-full ${
                step.done || index === activeIndex ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function TrustStrip() {
  const items = [
    { label: "Local encrypted file", icon: LockKeyhole },
    { label: "No cloud upload", icon: CloudOff },
    { label: "Values hidden", icon: EyeOff },
  ];

  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div key={item.label} className="flex min-w-0 items-center gap-1">
            <Icon className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span className="truncate">{item.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function ActionChooser({
  mode,
  onChange,
}: {
  mode: Mode;
  onChange: (mode: Mode) => void;
}) {
  const actions: Array<{
    mode: Mode;
    ariaLabel: string;
    title: string;
    icon: typeof ArrowDownToLine;
  }> = [
    {
      mode: "export",
      ariaLabel: "Export cookies from this browser",
      title: "Export",
      icon: ArrowDownToLine,
    },
    {
      mode: "import",
      ariaLabel: "Import cookies into this browser",
      title: "Import",
      icon: ArrowUpFromLine,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-2">
      {actions.map((action) => {
        const Icon = action.icon;
        const active = mode === action.mode;
        return (
          <button
            key={action.mode}
            aria-label={action.ariaLabel}
            className={`flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-md border px-3 text-center transition-[background-color,border-color,transform] duration-150 ease-out active:scale-[0.99] ${
              active ? "border-primary bg-primary/10" : "bg-background hover:bg-muted/55"
            }`}
            type="button"
            onClick={() => onChange(action.mode)}
          >
            <Icon className="h-4 w-4 text-primary" />
            <span className="truncate text-sm font-semibold">{action.title}</span>
          </button>
        );
      })}
    </div>
  );
}

function Panel({
  aside,
  children,
  title,
}: {
  aside?: React.ReactNode;
  children: React.ReactNode;
  title: string;
}) {
  return (
    <section>
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

function PreviewPanel({ advanced, preview }: { advanced: boolean; preview: ArchivePreview }) {
  return (
    <div className="rounded-md border bg-card p-3">
      <div className="mb-2 text-sm font-semibold">Preview</div>
      <div className="grid gap-2 sm:grid-cols-3">
        <Metric label="Bookmarks" value={preview.bookmarks.total} />
        <Metric label="Cookie domains" value={preview.cookieDomains.length} />
        <Metric label="Extensions" value={preview.extensions.total} />
      </div>
      <SimpleCookiePreview preview={preview} />
      {advanced ? <CookiePreview preview={preview} /> : null}
      <div className="mt-2 text-xs text-muted-foreground">
        {preview.extensions.installed} installed · {preview.extensions.missing} missing extensions
      </div>
      <div className="mt-1 text-xs text-muted-foreground">
        Created {new Date(preview.createdAt).toLocaleString()} · {preview.source.browser} ·
        extension {preview.source.extensionVersion}
      </div>
    </div>
  );
}

function SimpleCookiePreview({ preview }: { preview: ArchivePreview }) {
  if (!preview.sections.cookies) return null;
  const skipped =
    preview.cookies.skipExisting +
    preview.cookies.expired +
    preview.cookies.invalid +
    preview.cookies.chromeRejectedRisk;

  return (
    <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
      <Metric label="New cookies" value={preview.cookies.new} />
      <Metric label="Will update" value={preview.cookies.overwrite} />
      <Metric label="Skipped" value={skipped} />
      <Metric label="Will delete" value={preview.cookies.toDelete} />
    </div>
  );
}

function CookieDomainSummaryPanel({
  archiveReady,
  mode,
  previewReady,
  summary,
  totalDomains,
}: {
  archiveReady: boolean;
  mode: Mode;
  previewReady: boolean;
  summary: ReturnType<typeof summarizeCookieTransfer>;
  totalDomains: number;
}) {
  const waitingForImportPreview = mode === "import" && (!archiveReady || !previewReady);
  const metrics = [
    { label: "Domains", value: waitingForImportPreview ? 0 : summary.domains },
    { label: "Cookies", value: waitingForImportPreview ? 0 : summary.total },
    { label: "Session", value: waitingForImportPreview ? 0 : summary.session },
    { label: "Persistent", value: waitingForImportPreview ? 0 : summary.persistent },
  ];

  return (
    <div className="rounded-md border bg-card p-2.5">
      <div className="grid grid-cols-4 divide-x overflow-hidden rounded-md border bg-background">
        {metrics.map((metric) => (
          <div key={metric.label} className="min-w-0 px-2 py-2">
            <div className="truncate text-base font-semibold">{metric.value}</div>
            <div className="truncate text-[11px] text-muted-foreground">{metric.label}</div>
          </div>
        ))}
      </div>
      <div className="mt-2 text-xs leading-4 text-muted-foreground">
        {mode === "export"
          ? totalDomains === 0
            ? "No cookies found yet. Refresh after opening sites you want to transfer."
            : "All detected domains are selected by default. Review and remove domains if needed."
          : archiveReady
            ? previewReady
              ? "Preview is ready. Restore keeps other browser data unless Advanced replace mode is selected."
              : "Enter the password and preview before restoring cookies."
            : "Choose an encrypted archive to preview its cookie domains."}
      </div>
    </div>
  );
}

function CookieArchiveAcknowledgement({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="mt-2 flex items-start gap-2.5 rounded-md border border-amber-300 bg-amber-50 p-2.5 text-amber-950">
      <Checkbox
        checked={checked}
        aria-label="Confirm encrypted cookie archive risk"
        onCheckedChange={(value) => onChange(value === true)}
      />
      <span className="text-xs leading-4">
        I understand this encrypted file may keep me signed in to websites. I will keep it
        private and remember the password.
      </span>
    </div>
  );
}

function ReplaceDomainAcknowledgement({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="mt-2 flex items-start gap-2.5 rounded-md border border-amber-300 bg-amber-50 p-2.5 text-amber-950">
      <Checkbox
        checked={checked}
        aria-label="Confirm replace selected domains"
        onCheckedChange={(value) => onChange(value === true)}
      />
      <span className="text-xs leading-4">
        Replace selected domains deletes cookies only for the selected domains before import.
        Bookmarks and extensions are not affected.
      </span>
    </div>
  );
}

function CookiePolicySelector({
  disabled,
  policy,
  onChange,
}: {
  disabled?: boolean;
  policy: CookieImportPolicy;
  onChange: (policy: CookieImportPolicy) => void;
}) {
  const options: Array<{ value: CookieImportPolicy; label: string; description: string }> = [
    {
      value: "overwrite",
      label: "Overwrite matching",
      description: "Update matching cookies and keep everything else.",
    },
    {
      value: "skip_existing",
      label: "Skip existing",
      description: "Only create cookies that are not already present.",
    },
    {
      value: "replace_selected_domains",
      label: "Replace selected domains",
      description: "Delete selected-domain cookies before import.",
    },
    {
      value: "dry_run",
      label: "Dry run",
      description: "Return a report without changing browser cookies.",
    },
  ];

  return (
    <div className="grid gap-2">
      {options.map((option) => (
        <button
          key={option.value}
          className={`cursor-pointer rounded-md border p-2.5 text-left transition-[background-color,border-color,transform] duration-150 ease-out active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 ${
            policy === option.value ? "border-primary bg-primary/10" : "bg-card hover:bg-muted/55"
          }`}
          disabled={disabled}
          type="button"
          onClick={() => onChange(option.value)}
        >
          <div className="text-sm font-medium">{option.label}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">{option.description}</div>
        </button>
      ))}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border bg-background p-2.5">
      <div className="text-lg font-semibold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
