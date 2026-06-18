import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  FileJson,
  Loader2,
  SlidersHorizontal,
  RefreshCw,
  ShieldCheck,
  Square,
} from "lucide-react";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { browser } from "wxt/browser";
import { Button } from "../components/ui/button";
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
  const showQaDiagnostics =
    import.meta.env.DEV || new URLSearchParams(window.location.search).get("qa") === "1";

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

    operationIdRef.current = createOperationId();
    setBusy("exporting");
    setError("");
    setReport(null);
    setLastPreview(null);
    setProgress(null);
    setArchiveSaved(false);

    try {
      if (
        sections.cookies &&
        !window.confirm(
          allVisibleDomainsSelected
            ? "The archive will contain cookies from every listed domain. Keep the file private and remember the password."
            : "The archive will contain selected cookie sessions. Keep the file private and remember the password.",
        )
      ) {
        setBusy("idle");
        return;
      }

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
    if (mode === "import" && archive && password && lastPreview && !isBusy) {
      void previewArchive(policy);
    }
  }

  async function handleImport() {
    if (!archive || !lastPreview) {
      await handlePreview();
      return;
    }

    if (
      sections.cookies &&
      cookieImportPolicy === "replace_selected_domains" &&
      !window.confirm(
        "Replace selected domains will delete cookies only for the selected domains before import. Continue?",
      )
    ) {
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
      <header className="sticky top-0 z-10 border-b bg-card/95 px-5 py-4 backdrop-blur">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Chromium-family migration
            </div>
            <h1 className="mt-1 text-2xl font-semibold">Browser Bridge</h1>
          </div>
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
      </header>

      <section className="border-b bg-card px-5 py-3">
        <div className="grid grid-cols-2 rounded-md bg-muted p-1">
          <ModeButton active={mode === "export"} onClick={() => setMode("export")}>
            <ArrowDownToLine className="h-4 w-4" />
            Export
          </ModeButton>
          <ModeButton active={mode === "import"} onClick={() => setMode("import")}>
            <ArrowUpFromLine className="h-4 w-4" />
            Import
          </ModeButton>
        </div>
      </section>

      <section className="space-y-5 px-5 py-5">
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

        <button
          className="inline-flex h-9 items-center gap-2 rounded-md border bg-card px-3 text-sm font-medium transition-[background-color,transform] duration-150 ease-out active:scale-[0.98] hover:bg-muted/55"
          type="button"
          onClick={() => setAdvancedOpen((open) => !open)}
        >
          <SlidersHorizontal className="h-4 w-4" />
          {advancedOpen ? "Hide advanced" : "Advanced"}
        </button>

        <Panel title="1. Select data">
          <SectionPicker disabled={isBusy} sections={sections} onChange={setSections} />
        </Panel>

        <Panel title="2. Password">
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
              <span className="text-xs text-muted-foreground">
                {selectedDomains.length} / {visibleDomains.length}
                {allVisibleDomainsSelected ? " · all selected" : ""}
              </span>
            }
            title="3. Cookie domains"
          >
            <DomainPicker
              disabled={isBusy}
              domains={visibleDomains}
              selected={selectedDomains}
              onSelectOpenTabs={selectOpenTabDomains}
              onChange={setSelectedDomains}
            />
          </Panel>
        ) : null}

        {mode === "import" && sections.cookies ? (
          advancedOpen ? (
            <Panel title="4. Cookie import policy">
              <CookiePolicySelector
                disabled={isBusy}
                policy={cookieImportPolicy}
                onChange={handleCookieImportPolicyChange}
              />
              {cookieImportPolicy === "replace_selected_domains" ? (
                <div className="mt-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs leading-5 text-amber-950">
                  Replace selected domains deletes cookies only for the selected domains before
                  importing the archive. Bookmarks and extensions are not affected.
                </div>
              ) : null}
            </Panel>
          ) : (
            <div className="rounded-md border bg-card p-3 text-xs leading-5 text-muted-foreground">
              Guided import keeps the default policy: overwrite matching cookies without deleting
              unrelated data. Run Preview first; use Advanced for dry run, skip existing, or replace mode.
            </div>
          )
        ) : null}

        {mode === "import" ? (
          <Panel title={sections.cookies ? "5. Archive file" : "4. Archive file"}>
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
                  Encrypted Browser Bridge schema v2 archive
                </div>
              </div>
              <Button disabled={isBusy} variant="outline" onClick={() => fileRef.current?.click()}>
                Choose
              </Button>
            </div>
          </Panel>
        ) : null}

        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-950">
          <div className="flex gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="text-xs leading-5">
              Cookies are session secrets. Archives are encrypted with your password and the
              password is never stored. Browser Bridge requests all-host cookie access so selected
              domains can be exported and recreated.
            </p>
          </div>
        </div>

        {lastPreview ? <PreviewPanel preview={lastPreview} /> : null}
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

      <footer className="sticky bottom-0 flex gap-2 border-t bg-card/95 px-5 py-4 backdrop-blur">
        {busy === "importing" ? (
          <Button variant="outline" onClick={handleCancel}>
            <Square className="h-4 w-4" />
            Stop
          </Button>
        ) : null}
        {mode === "import" ? (
          <Button className="flex-1" disabled={isBusy} variant="outline" onClick={handlePreview}>
            {busy === "previewing" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Preview / Dry run
          </Button>
        ) : null}
        <Button
          className="flex-1"
          disabled={isBusy}
          onClick={mode === "export" ? handleExport : handleImport}
        >
          {busy === "exporting" || busy === "importing" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : null}
          {mode === "export"
            ? "Export encrypted archive"
            : cookieImportPolicy === "dry_run"
              ? "Run dry run"
              : "Run import"}
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
      label: "Select data",
      done: !sections.cookies || selectedDomains > 0,
    },
    {
      label: mode === "export" ? "Password" : "File and password",
      done: mode === "export" ? hasPassword || archiveSaved : archiveSelected && hasPassword,
    },
    {
      label: mode === "export" ? "Export" : "Preview / dry run",
      done: mode === "export" ? archiveSaved : hasPreview || hasReport,
    },
    {
      label: "Report",
      done: mode === "export" ? archiveSaved : hasReport,
    },
  ];

  return (
    <section className="rounded-md border bg-card p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">Guided migration</div>
          <div className="mt-1 text-xs leading-5 text-muted-foreground">
            Local encrypted archive flow for Chrome first, with Chromium-family compatibility checks.
          </div>
        </div>
        <span className="rounded-sm bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
          {mode === "export" ? "Export" : "Import"}
        </span>
      </div>
      <div className="grid gap-2 sm:grid-cols-5">
        {steps.map((step, index) => (
          <div
            key={step.label}
            className={`rounded-md border p-2 text-xs ${
              step.done ? "border-primary/30 bg-primary/10" : "bg-background text-muted-foreground"
            }`}
          >
            <div className="font-medium">{index + 1}. {step.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ModeButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      className={`inline-flex h-9 items-center justify-center gap-2 rounded-sm text-sm font-medium transition-[background-color,color,transform] duration-150 ease-out active:scale-[0.98] ${
        active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
      }`}
      type="button"
      onClick={onClick}
    >
      {children}
    </button>
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
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

function PreviewPanel({ preview }: { preview: ArchivePreview }) {
  return (
    <div className="rounded-md border bg-card p-4">
      <div className="mb-3 text-sm font-semibold">Preview</div>
      <div className="grid gap-2 sm:grid-cols-3">
        <Metric label="Bookmarks" value={preview.bookmarks.total} />
        <Metric label="Cookie domains" value={preview.cookieDomains.length} />
        <Metric label="Extensions" value={preview.extensions.total} />
      </div>
      <CookiePreview preview={preview} />
      <div className="mt-3 text-xs text-muted-foreground">
        {preview.extensions.installed} installed · {preview.extensions.missing} missing extensions
      </div>
      <div className="mt-1 text-xs text-muted-foreground">
        Created {new Date(preview.createdAt).toLocaleString()} · {preview.source.browser} ·
        extension {preview.source.extensionVersion}
      </div>
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
          className={`rounded-md border p-3 text-left transition-[background-color,border-color,transform] duration-150 ease-out active:scale-[0.99] ${
            policy === option.value ? "border-primary bg-primary/10" : "bg-card hover:bg-muted/55"
          }`}
          disabled={disabled}
          type="button"
          onClick={() => onChange(option.value)}
        >
          <div className="text-sm font-medium">{option.label}</div>
          <div className="mt-1 text-xs text-muted-foreground">{option.description}</div>
        </button>
      ))}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border bg-background p-3">
      <div className="text-xl font-semibold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
