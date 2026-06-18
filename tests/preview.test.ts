import { describe, expect, it } from "vitest";
import { createArchivePreview } from "../src/shared/preview";
import { BridgePayloadV2 } from "../src/shared/types";

describe("archive preview", () => {
  it("summarizes extension install statuses", () => {
    const preview = createArchivePreview(createPayload(), [
      {
        id: "installed",
        name: "Installed",
        enabled: true,
        installType: "normal",
        type: "extension",
        version: "1.0.0",
        status: "installed",
        installedVersion: "1.0.0",
      },
      {
        id: "missing",
        name: "Missing",
        enabled: true,
        installType: "normal",
        type: "extension",
        version: "1.0.0",
        status: "missing",
      },
    ]);

    expect(preview.extensions.total).toBe(2);
    expect(preview.extensions.installed).toBe(1);
    expect(preview.extensions.missing).toBe(1);
  });
});

function createPayload(): BridgePayloadV2 {
  return {
    app: "browser-bridge",
    schemaVersion: 2,
    createdAt: "2026-06-12T00:00:00.000Z",
    source: {
      browser: "chrome",
      extensionVersion: "0.1.0",
    },
    selection: {
      sections: {
        bookmarks: false,
        cookies: false,
        extensions: true,
      },
      cookieDomains: [],
    },
    payload: {
      extensions: [],
    },
  };
}
