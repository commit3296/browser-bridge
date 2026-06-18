import { z } from "zod";

const SectionSelectionSchema = z.object({
  bookmarks: z.boolean(),
  cookies: z.boolean(),
  extensions: z.boolean(),
});

const CookiePartitionKeySchema = z
  .object({
    topLevelSite: z.string().optional(),
    hasCrossSiteAncestor: z.boolean().optional(),
  })
  .passthrough();

const CookieImportPolicySchema = z.enum([
  "overwrite",
  "skip_existing",
  "replace_selected_domains",
  "dry_run",
]);

const BookmarkNodeSchema: z.ZodType<chrome.bookmarks.BookmarkTreeNode> = z.lazy(() =>
  z
    .object({
      id: z.string(),
      parentId: z.string().optional(),
      index: z.number().optional(),
      url: z.string().optional(),
      title: z.string(),
      syncing: z.boolean().default(false),
      dateAdded: z.number().optional(),
      dateGroupModified: z.number().optional(),
      unmodifiable: z.literal("managed").optional(),
      children: z.array(BookmarkNodeSchema).optional(),
    })
    .passthrough(),
);

export const ExportedCookieSchema = z.object({
  domain: z.string().min(1),
  expirationDate: z.number().optional(),
  hostOnly: z.boolean(),
  httpOnly: z.boolean(),
  name: z.string(),
  path: z.string(),
  sameSite: z.enum(["unspecified", "no_restriction", "lax", "strict"]),
  secure: z.boolean(),
  session: z.boolean(),
  storeId: z.string(),
  value: z.string(),
  partitionKey: CookiePartitionKeySchema.optional(),
  sourceScheme: z.enum(["http", "https"]).optional(),
});

export const ExportedExtensionSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  enabled: z.boolean(),
  homepageUrl: z.string().optional(),
  optionsUrl: z.string().optional(),
  installType: z.string(),
  type: z.string(),
  version: z.string(),
});

export const ExtensionInstallStatusSchema = ExportedExtensionSchema.extend({
  status: z.enum(["installed", "missing", "disabled", "version_mismatch"]),
  installedVersion: z.string().optional(),
});

export const BridgePayloadV2Schema = z.object({
  app: z.literal("browser-bridge"),
  schemaVersion: z.literal(2),
  createdAt: z.string(),
  source: z.object({
    browser: z.literal("chrome"),
    extensionVersion: z.string(),
    browserName: z.string().optional(),
    browserFamily: z.literal("chromium").optional(),
    profileHint: z.string().optional(),
  }),
  selection: z.object({
    sections: SectionSelectionSchema,
    cookieDomains: z.array(z.string()),
  }),
  payload: z.object({
    bookmarks: z.array(BookmarkNodeSchema).optional(),
    cookies: z.record(z.string(), z.array(ExportedCookieSchema)).optional(),
    extensions: z.array(ExportedExtensionSchema).optional(),
  }),
});

export const EncryptedArchiveV2Schema = z.object({
  app: z.literal("browser-bridge"),
  schemaVersion: z.literal(2),
  createdAt: z.string(),
  kdf: z.object({
    name: z.literal("PBKDF2"),
    hash: z.literal("SHA-256"),
    iterations: z.number().int().positive(),
  }),
  cipher: z.object({
    name: z.literal("AES-GCM"),
  }),
  salt: z.string().min(1),
  iv: z.string().min(1),
  ciphertext: z.string().min(1),
});

export const BridgeRequestSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("GET_COOKIE_DOMAINS") }),
  z.object({ type: z.literal("GET_TAB_COOKIE_DOMAINS") }),
  z.object({
    type: z.literal("CREATE_ARCHIVE"),
    operationId: z.string().min(1),
    sections: SectionSelectionSchema,
    cookieDomains: z.array(z.string()),
    password: z.string().min(1),
  }),
  z.object({
    type: z.literal("PREVIEW_ARCHIVE"),
    operationId: z.string().min(1),
    archive: EncryptedArchiveV2Schema,
    password: z.string().min(1),
    sections: SectionSelectionSchema.optional(),
    cookieDomains: z.array(z.string()).optional(),
    cookieImportPolicy: CookieImportPolicySchema.optional(),
  }),
  z.object({
    type: z.literal("IMPORT_ARCHIVE"),
    operationId: z.string().min(1),
    archive: EncryptedArchiveV2Schema,
    password: z.string().min(1),
    sections: SectionSelectionSchema,
    cookieDomains: z.array(z.string()),
    cookieImportPolicy: CookieImportPolicySchema,
  }),
  z.object({
    type: z.literal("CANCEL_OPERATION"),
    operationId: z.string().min(1),
  }),
  z.object({ type: z.literal("CREATE_QA_COOKIES") }),
  z.object({ type: z.literal("GET_QA_COOKIE_SUMMARY") }),
  z.object({ type: z.literal("CLEAR_QA_COOKIES") }),
  z.object({
    type: z.literal("QA_DRY_RUN_PREVIEW"),
    operationId: z.string().min(1),
    password: z.string().min(1),
  }),
]);
