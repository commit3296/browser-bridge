import { summarizeCookieDomains } from "./cookies";
import {
  ArchivePreview,
  BridgePayloadV2,
  CookieImportPolicy,
  ExtensionInstallStatus,
} from "./types";

type CookiePreviewPlan = ArchivePreview["cookies"] & {
  domains: ArchivePreview["cookieDomains"];
};

export function createArchivePreview(
  payload: BridgePayloadV2,
  extensions: ExtensionInstallStatus[] = [],
  cookiePlan?: CookiePreviewPlan,
): ArchivePreview {
  const extensionItems =
    extensions.length > 0
      ? extensions
      : (payload.payload.extensions ?? []).map((extension) => ({
          ...extension,
          status: "missing" as const,
        }));

  return {
    createdAt: payload.createdAt,
    source: payload.source,
    sections: payload.selection.sections,
    cookieDomains: cookiePlan?.domains ?? summarizeCookieDomains(payload.payload.cookies ?? {}),
    cookies: cookiePlan ?? createEmptyCookiePreview("overwrite"),
    bookmarks: {
      total: countBookmarkNodes(payload.payload.bookmarks ?? []),
    },
    extensions: {
      total: extensionItems.length,
      items: extensionItems,
      missing: extensionItems.filter((extension) => extension.status === "missing").length,
      installed: extensionItems.filter((extension) => extension.status !== "missing").length,
    },
  };
}

export function countBookmarkNodes(nodes: chrome.bookmarks.BookmarkTreeNode[]): number {
  return nodes.reduce((count, node) => {
    const children = node.children ? countBookmarkNodes(node.children) : 0;
    return count + 1 + children;
  }, 0);
}

function createEmptyCookiePreview(policy: CookieImportPolicy): ArchivePreview["cookies"] {
  return {
    policy,
    total: 0,
    importable: 0,
    new: 0,
    overwrite: 0,
    skipExisting: 0,
    expired: 0,
    invalid: 0,
    chromeRejectedRisk: 0,
    toDelete: 0,
  };
}
