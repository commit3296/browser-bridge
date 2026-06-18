import { describe, expect, it } from "vitest";
import { decryptArchive, encryptPayload } from "../src/shared/crypto";
import { BridgePayloadV2 } from "../src/shared/types";

describe("archive crypto", () => {
  it("decrypts with the right password and hides payload in the envelope", async () => {
    const payload = createPayload();
    const archive = await encryptPayload(payload, "correct horse battery staple");

    expect(archive.schemaVersion).toBe(2);
    expect(JSON.stringify(archive)).not.toContain("secret-cookie-value");

    await expect(decryptArchive(archive, "correct horse battery staple")).resolves.toEqual(
      payload,
    );
  });

  it("rejects the wrong password", async () => {
    const archive = await encryptPayload(createPayload(), "right-password");
    await expect(decryptArchive(archive, "wrong-password")).rejects.toThrow(
      /Cannot decrypt archive/,
    );
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
        cookies: true,
        extensions: false,
      },
      cookieDomains: ["example.com"],
    },
    payload: {
      cookies: {
        "example.com": [
          {
            domain: ".example.com",
            hostOnly: false,
            httpOnly: true,
            name: "sid",
            path: "/",
            sameSite: "lax",
            secure: true,
            session: true,
            storeId: "0",
            value: "secret-cookie-value",
          },
        ],
      },
    },
  };
}
