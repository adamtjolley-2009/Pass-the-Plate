import { describe, it, expect } from "vitest";
import { normalizeUsername, validateProfileNames, isProfileComplete } from "./profile";

describe("normalizeUsername", () => {
  it("lowercases and strips unsupported characters", () => {
    expect(normalizeUsername("Sam.Jones-99!")).toBe("samjones99");
    expect(normalizeUsername("sam_cooks")).toBe("sam_cooks");
  });

  it("caps the length", () => {
    expect(normalizeUsername("a".repeat(30))).toHaveLength(20);
  });
});

describe("validateProfileNames", () => {
  const valid = { firstName: "Sam", lastName: "Jones", username: "samj" };

  it("accepts a complete profile", () => {
    expect(validateProfileNames(valid)).toBeNull();
  });

  it("requires every field", () => {
    expect(validateProfileNames({ ...valid, firstName: "  " })).toMatch(/first name/);
    expect(validateProfileNames({ ...valid, lastName: "" })).toMatch(/last name/);
    expect(validateProfileNames({ ...valid, username: "ab" })).toMatch(/at least 3/);
    expect(validateProfileNames({ ...valid, username: "Sam J" })).toMatch(/letters, numbers/);
  });
});

describe("isProfileComplete", () => {
  it("needs first name, last name and username", () => {
    expect(isProfileComplete({ first_name: "Sam", last_name: "Jones", username: "samj" })).toBe(true);
    expect(isProfileComplete({ first_name: "Sam", last_name: null, username: "samj" })).toBe(false);
    expect(isProfileComplete({ first_name: "Sam", last_name: "Jones", username: "" })).toBe(false);
    expect(isProfileComplete(null)).toBe(false);
  });
});
