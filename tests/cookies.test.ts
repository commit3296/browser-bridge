import { describe, expect, it } from "vitest";
import {
  buildCookieRemoveDetails,
  buildCookieSetDetails,
  createCookieImportPlan,
  getCookieMatchingKey,
  getCookiePreflightIssue,
} from "../src/shared/cookies";
import { ExportedCookie } from "../src/shared/types";

describe("cookie reconstruction", () => {
  it("builds secure domain cookie details", () => {
    expect(
      buildCookieSetDetails({
        ...baseCookie,
        domain: ".example.com",
        hostOnly: false,
        path: "account",
        secure: true,
      }),
    ).toMatchObject({
      url: "https://example.com/account",
      domain: ".example.com",
      path: "/account",
      secure: true,
    });
  });

  it("omits domain for hostOnly cookies", () => {
    const details = buildCookieSetDetails({
      ...baseCookie,
      domain: "app.example.com",
      hostOnly: true,
      secure: false,
    });

    expect(details.url).toBe("http://app.example.com/");
    expect(details).not.toHaveProperty("domain");
  });

  it("flags expired cookies before Chrome rejects them", () => {
    const issue = getCookiePreflightIssue({
      ...baseCookie,
      session: false,
      expirationDate: Math.floor(Date.now() / 1000) - 10,
    });

    expect(issue?.code).toBe("expired");
  });

  it("includes partition key in matching key and set details", () => {
    const cookie = {
      ...baseCookie,
      partitionKey: {
        topLevelSite: "https://example.com",
        hasCrossSiteAncestor: false,
      },
    };

    expect(getCookieMatchingKey(cookie)).not.toBe(getCookieMatchingKey(baseCookie));
    expect(buildCookieSetDetails(cookie).partitionKey).toEqual(cookie.partitionKey);
  });

  it("builds remove details with reconstructed URL", () => {
    expect(buildCookieRemoveDetails(baseCookie)).toMatchObject({
      url: "http://example.com/",
      name: "sid",
      storeId: "0",
    });
  });

  it("rejects insecure SameSite=None cookies before Chrome rejects them", () => {
    const issue = getCookiePreflightIssue({
      ...baseCookie,
      sameSite: "no_restriction",
      secure: false,
    });

    expect(issue?.code).toBe("insecure_samesite_none");
  });
});

describe("cookie import planner", () => {
  it("counts overwrite and skip existing policies", () => {
    const incoming = [baseCookie, { ...baseCookie, name: "new" }];
    const existing = [baseCookie];

    expect(
      createCookieImportPlan({
        incoming,
        existing,
        policy: "overwrite",
        selectedDomains: ["example.com"],
      }),
    ).toMatchObject({
      total: 2,
      importable: 2,
      new: 1,
      overwrite: 1,
      skipExisting: 0,
    });

    expect(
      createCookieImportPlan({
        incoming,
        existing,
        policy: "skip_existing",
        selectedDomains: ["example.com"],
      }),
    ).toMatchObject({
      total: 2,
      importable: 1,
      new: 1,
      overwrite: 0,
      skipExisting: 1,
    });
  });

  it("counts cookies to delete for replace selected domains", () => {
    const plan = createCookieImportPlan({
      incoming: [baseCookie],
      existing: [baseCookie, { ...baseCookie, name: "old" }],
      policy: "replace_selected_domains",
      selectedDomains: ["example.com"],
    });

    expect(plan.toDelete).toBe(2);
    expect(plan.domains[0]).toMatchObject({
      domain: "example.com",
      toDelete: 2,
    });
  });
});

const baseCookie: ExportedCookie = {
  domain: "example.com",
  hostOnly: true,
  httpOnly: true,
  name: "sid",
  path: "/",
  sameSite: "lax",
  secure: false,
  session: true,
  storeId: "0",
  value: "value",
};
