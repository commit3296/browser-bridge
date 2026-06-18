import { describe, expect, it } from "vitest";
import { generateStrongPassword, getPasswordScore } from "../src/ui/PasswordStrength";

describe("password helpers", () => {
  it("generates strong archive passwords", () => {
    const password = generateStrongPassword();

    expect(password).toHaveLength(24);
    expect(/[a-z]/.test(password)).toBe(true);
    expect(/[A-Z]/.test(password)).toBe(true);
    expect(/\d/.test(password)).toBe(true);
    expect(/[^A-Za-z0-9]/.test(password)).toBe(true);
    expect(getPasswordScore(password)).toBe(4);
  });

  it("keeps generated passwords at least 16 characters long", () => {
    expect(generateStrongPassword(4)).toHaveLength(16);
  });
});
