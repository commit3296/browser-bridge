import { describe, expect, it } from "vitest";
import { chromiumTargets, getPrimaryChromiumTarget } from "../src/shared/chromium-targets";

describe("chromium target metadata", () => {
  it("marks Chrome as primary and other Chromium browsers as compatibility targets", () => {
    expect(getPrimaryChromiumTarget()?.id).toBe("chrome");
    expect(chromiumTargets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "edge", status: "compatibility" }),
        expect.objectContaining({ id: "brave", status: "compatibility" }),
        expect.objectContaining({ id: "vivaldi", status: "compatibility" }),
        expect.objectContaining({ id: "opera", status: "compatibility" }),
      ]),
    );
  });
});
