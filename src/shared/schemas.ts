import { z } from "zod";
import {
  ARCHIVE_IV_BYTES,
  ARCHIVE_KDF_ITERATIONS,
  ARCHIVE_MAX_CIPHERTEXT_BYTES,
  ARCHIVE_SALT_BYTES,
} from "./archive-format";

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
    iterations: z.literal(ARCHIVE_KDF_ITERATIONS),
  }),
  cipher: z.object({
    name: z.literal("AES-GCM"),
  }),
  salt: base64BytesSchema(ARCHIVE_SALT_BYTES, "salt"),
  iv: base64BytesSchema(ARCHIVE_IV_BYTES, "iv"),
  ciphertext: base64StringSchema("ciphertext").refine(
    (value) => decodedBase64ByteLength(value) <= ARCHIVE_MAX_CIPHERTEXT_BYTES,
    "Archive ciphertext is too large.",
  ),
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

function base64BytesSchema(byteLength: number, label: string) {
  return base64StringSchema(label).refine(
    (value) => decodedBase64ByteLength(value) === byteLength,
    `Archive ${label} must decode to ${byteLength} bytes.`,
  );
}

function base64StringSchema(label: string) {
  return z
    .string()
    .min(1)
    .refine((value) => isStrictBase64(value), `Archive ${label} must be strict base64.`);
}

function isStrictBase64(value: string) {
  if (value.length === 0 || value.length % 4 !== 0) return false;
  return /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value);
}

function decodedBase64ByteLength(value: string) {
  if (!isStrictBase64(value)) return Number.POSITIVE_INFINITY;
  const padding = value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0;
  return (value.length / 4) * 3 - padding;
}
