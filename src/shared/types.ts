export type BridgeSection = "bookmarks" | "cookies" | "extensions";

export type SectionSelection = Record<BridgeSection, boolean>;

export type ExportedCookie = Pick<
  chrome.cookies.Cookie,
  | "domain"
  | "expirationDate"
  | "hostOnly"
  | "httpOnly"
  | "name"
  | "path"
  | "sameSite"
  | "secure"
  | "session"
  | "storeId"
  | "value"
> & {
  partitionKey?: chrome.cookies.CookiePartitionKey;
  sourceScheme?: "http" | "https";
};

export type CookieImportPolicy =
  | "overwrite"
  | "skip_existing"
  | "replace_selected_domains"
  | "dry_run";

export type CookieDomainSummary = {
  domain: string;
  total: number;
  session: number;
  persistent: number;
  secure: number;
  httpOnly: number;
  sameSite: Record<string, number>;
  importable?: number;
  skipped?: number;
  warnings?: number;
  new?: number;
  overwrite?: number;
  skipExisting?: number;
  expired?: number;
  invalid?: number;
  chromeRejectedRisk?: number;
  toDelete?: number;
};

export type ExportedExtension = {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  homepageUrl?: string;
  optionsUrl?: string;
  installType: string;
  type: string;
  version: string;
};

export type ExtensionInstallStatus = ExportedExtension & {
  status: "installed" | "missing" | "disabled" | "version_mismatch";
  installedVersion?: string;
};

export type CookieImportIssueCode =
  | "expired"
  | "invalid_domain"
  | "invalid_url"
  | "insecure_samesite_none"
  | "unsupported_partition_key"
  | "chrome_rejected"
  | "unknown";

export type CookieImportIssue = {
  code: CookieImportIssueCode;
  domain: string;
  path: string;
  name: string;
  message: string;
};

export type ChromiumBrowserId = "chrome" | "edge" | "brave" | "vivaldi" | "opera";

export type ChromiumTargetStatus = "primary" | "compatibility";

export type ChromiumTargetMetadata = {
  id: ChromiumBrowserId;
  displayName: string;
  status: ChromiumTargetStatus;
  installNotes: string;
  caveats: string[];
};

export type BridgePayloadV2 = {
  app: "browser-bridge";
  schemaVersion: 2;
  createdAt: string;
  source: {
    browser: "chrome";
    extensionVersion: string;
    browserName?: string;
    browserFamily?: "chromium";
    profileHint?: string;
  };
  selection: {
    sections: SectionSelection;
    cookieDomains: string[];
  };
  payload: {
    bookmarks?: chrome.bookmarks.BookmarkTreeNode[];
    cookies?: Record<string, ExportedCookie[]>;
    extensions?: ExportedExtension[];
  };
};

export type EncryptedArchiveV2 = {
  app: "browser-bridge";
  schemaVersion: 2;
  createdAt: string;
  kdf: {
    name: "PBKDF2";
    hash: "SHA-256";
    iterations: number;
  };
  cipher: {
    name: "AES-GCM";
  };
  salt: string;
  iv: string;
  ciphertext: string;
};

export type SectionReport = {
  requested: boolean;
  total: number;
  success: number;
  failed: number;
  skipped: number;
  created?: number;
  updated?: number;
  deleted?: number;
  skippedExisting?: number;
  domains?: Record<string, CookieDomainReport>;
  warnings: string[];
  errors: string[];
  durationMs: number;
};

export type CookieDomainReport = {
  total: number;
  success: number;
  failed: number;
  skipped: number;
  created: number;
  updated: number;
  deleted: number;
  skippedExisting: number;
  warnings: string[];
  errors: string[];
  health?: CookieDomainHealth;
  reasonCodes?: string[];
  recommendedAction?: string;
  riskLevel?: CookieDomainRiskLevel;
};

export type ImportReport = Record<BridgeSection, SectionReport> & {
  startedAt: string;
  finishedAt: string;
  cancelled: boolean;
};

export type CookieDomainHealth = "good" | "partial" | "failed" | "needs_login";

export type CookieDomainRiskLevel = "low" | "medium" | "high";

export type MigrationReportExport = {
  app: "browser-bridge";
  reportVersion: 1;
  createdAt: string;
  archive?: {
    createdAt: string;
    source: BridgePayloadV2["source"];
    sections: SectionSelection;
    cookieDomains: string[];
  };
  report: ImportReport;
  cookieHealthSummary: Record<CookieDomainHealth, number>;
  note: string;
};

export type ArchivePreview = {
  createdAt: string;
  source: BridgePayloadV2["source"];
  sections: SectionSelection;
  cookieDomains: CookieDomainSummary[];
  cookies: {
    policy: CookieImportPolicy;
    total: number;
    importable: number;
    new: number;
    overwrite: number;
    skipExisting: number;
    expired: number;
    invalid: number;
    chromeRejectedRisk: number;
    toDelete: number;
  };
  bookmarks: {
    total: number;
  };
  extensions: {
    total: number;
    items: ExtensionInstallStatus[];
    missing: number;
    installed: number;
  };
};

export type ProgressEvent = {
  type: "BRIDGE_PROGRESS";
  operationId: string;
  phase: "export" | "preview" | "import";
  section?: BridgeSection;
  completed: number;
  total: number;
  message: string;
};

export type QaCookieSummary = {
  domain: string;
  total: number;
  session: number;
  persistent: number;
  secure: number;
  httpOnly: number;
  names: string[];
};

export type GetCookieDomainsRequest = {
  type: "GET_COOKIE_DOMAINS";
};

export type CreateArchiveRequest = {
  type: "CREATE_ARCHIVE";
  operationId: string;
  sections: SectionSelection;
  cookieDomains: string[];
  password: string;
};

export type PreviewArchiveRequest = {
  type: "PREVIEW_ARCHIVE";
  operationId: string;
  archive: EncryptedArchiveV2;
  password: string;
  sections?: SectionSelection;
  cookieDomains?: string[];
  cookieImportPolicy?: CookieImportPolicy;
};

export type ImportArchiveRequest = {
  type: "IMPORT_ARCHIVE";
  operationId: string;
  archive: EncryptedArchiveV2;
  password: string;
  sections: SectionSelection;
  cookieDomains: string[];
  cookieImportPolicy: CookieImportPolicy;
};

export type GetTabCookieDomainsRequest = {
  type: "GET_TAB_COOKIE_DOMAINS";
};

export type CancelOperationRequest = {
  type: "CANCEL_OPERATION";
  operationId: string;
};

export type CreateQaCookiesRequest = {
  type: "CREATE_QA_COOKIES";
};

export type GetQaCookieSummaryRequest = {
  type: "GET_QA_COOKIE_SUMMARY";
};

export type ClearQaCookiesRequest = {
  type: "CLEAR_QA_COOKIES";
};

export type QaDryRunPreviewRequest = {
  type: "QA_DRY_RUN_PREVIEW";
  operationId: string;
  password: string;
};

export type BridgeRequest =
  | GetCookieDomainsRequest
  | GetTabCookieDomainsRequest
  | CreateArchiveRequest
  | PreviewArchiveRequest
  | ImportArchiveRequest
  | CancelOperationRequest
  | CreateQaCookiesRequest
  | GetQaCookieSummaryRequest
  | ClearQaCookiesRequest
  | QaDryRunPreviewRequest;

export type BridgeResponse =
  | { ok: true; cookieDomains: CookieDomainSummary[] }
  | { ok: true; archive: EncryptedArchiveV2; preview: ArchivePreview }
  | { ok: true; preview: ArchivePreview }
  | { ok: true; report: ImportReport }
  | { ok: true; cancelled: true }
  | { ok: true; qaCookies: QaCookieSummary[] }
  | { ok: true; created: number }
  | { ok: true; cleared: number }
  | { ok: false; error: string };

export const defaultSections: SectionSelection = {
  bookmarks: true,
  cookies: true,
  extensions: true,
};

export const defaultCookieImportPolicy: CookieImportPolicy = "overwrite";
