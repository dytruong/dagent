import { describe, expect, it } from "vitest";
import { createSessionPasswordCache } from "../../src/ssh/session-password-cache.js";

describe("session password cache", () => {
  it("stores passwords only in process memory by alias", () => {
    const cache = createSessionPasswordCache();
    cache.set("prod-api", "secret-value");
    expect(cache.get("prod-api")).toBe("secret-value");
    cache.clear();
    expect(cache.get("prod-api")).toBeUndefined();
  });
});
