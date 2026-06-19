import { describe, expect, it } from "vitest";
import { ARCHIVE_KDF_ITERATIONS } from "../src/shared/archive-format";
import { BridgePayloadV2Schema, EncryptedArchiveV2Schema } from "../src/shared/schemas";

describe("archive schema", () => {
  it("rejects old plaintext schema", () => {
    expect(() =>
      EncryptedArchiveV2Schema.parse({
        app: "browser-bridge",
        schemaVersion: 1,
        createdAt: "2026-06-12T00:00:00.000Z",
        payload: {},
      }),
    ).toThrow();
  });

  it("rejects encrypted archives with unsafe envelope parameters", () => {
    const archive = validEncryptedArchive();

    expect(() =>
      EncryptedArchiveV2Schema.parse({
        ...archive,
        kdf: { ...archive.kdf, iterations: ARCHIVE_KDF_ITERATIONS + 1 },
      }),
    ).toThrow();

    expect(() => EncryptedArchiveV2Schema.parse({ ...archive, salt: "AAAA" })).toThrow();
    expect(() => EncryptedArchiveV2Schema.parse({ ...archive, iv: "AAAA" })).toThrow();
    expect(() =>
      EncryptedArchiveV2Schema.parse({ ...archive, ciphertext: "not strict base64" }),
    ).toThrow();
  });

  it("accepts v2 payload cookies without new optional fields", () => {
    expect(() =>
      BridgePayloadV2Schema.parse({
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
                domain: "example.com",
                hostOnly: true,
                httpOnly: false,
                name: "sid",
                path: "/",
                sameSite: "lax",
                secure: true,
                session: true,
                storeId: "0",
                value: "secret",
              },
            ],
          },
        },
      }),
    ).not.toThrow();
  });

  it("accepts optional Chromium source metadata in v2 payloads", () => {
    expect(() =>
      BridgePayloadV2Schema.parse({
        app: "browser-bridge",
        schemaVersion: 2,
        createdAt: "2026-06-18T00:00:00.000Z",
        source: {
          browser: "chrome",
          browserName: "Google Chrome",
          browserFamily: "chromium",
          profileHint: "QA profile",
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
      }),
    ).not.toThrow();
  });

  it("accepts older v2 bookmark payloads without Chrome syncing metadata", () => {
    const parsed = BridgePayloadV2Schema.parse({
      app: "browser-bridge",
      schemaVersion: 2,
      createdAt: "2026-06-18T00:00:00.000Z",
      source: {
        browser: "chrome",
        extensionVersion: "0.1.0",
      },
      selection: {
        sections: {
          bookmarks: true,
          cookies: false,
          extensions: false,
        },
        cookieDomains: [],
      },
      payload: {
        bookmarks: [
          {
            id: "1",
            title: "Bookmarks Bar",
            children: [
              {
                id: "2",
                parentId: "1",
                title: "Example",
                url: "https://example.com/",
              },
            ],
          },
        ],
      },
    });

    expect(parsed.payload.bookmarks?.[0]?.syncing).toBe(false);
    expect(parsed.payload.bookmarks?.[0]?.children?.[0]?.syncing).toBe(false);
  });
});

function validEncryptedArchive() {
  return {
    app: "browser-bridge",
    schemaVersion: 2,
    createdAt: "2026-06-12T00:00:00.000Z",
    kdf: {
      name: "PBKDF2",
      hash: "SHA-256",
      iterations: ARCHIVE_KDF_ITERATIONS,
    },
    cipher: {
      name: "AES-GCM",
    },
    salt: "AAAAAAAAAAAAAAAAAAAAAA==",
    iv: "AAAAAAAAAAAAAAAA",
    ciphertext: "AAAAAAAAAAAAAAAAAAAAAA==",
  };
}
