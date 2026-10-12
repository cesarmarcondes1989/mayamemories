import { describe, expect, it } from "vitest";
import { capsuleDisplayState, capsuleIsOpen, dateAtAge } from "@/lib/permissions/capsules";

const now = new Date("2030-01-01T12:00:00Z");
const past = "2029-12-31T12:00:00Z";
const future = "2031-01-01T12:00:00Z";

describe("capsule opening rules (display mirror of the database rule)", () => {
  it("date rule opens only after the date", () => {
    expect(capsuleIsOpen({ status: "scheduled", opening_rule: "date", opens_at: future, opened_at: null }, now)).toBe(false);
    expect(capsuleIsOpen({ status: "scheduled", opening_rule: "date", opens_at: past, opened_at: null }, now)).toBe(true);
  });
  it("manual rule needs an explicit opening", () => {
    expect(capsuleIsOpen({ status: "scheduled", opening_rule: "manual", opens_at: null, opened_at: null }, now)).toBe(false);
    expect(capsuleIsOpen({ status: "opened", opening_rule: "manual", opens_at: null, opened_at: past }, now)).toBe(true);
  });
  it("date_and_manual needs both", () => {
    const c = { status: "scheduled", opening_rule: "date_and_manual", opens_at: past, opened_at: null };
    expect(capsuleIsOpen(c, now)).toBe(false);
    expect(capsuleDisplayState(c, now)).toBe("ready_for_authorization");
    expect(capsuleIsOpen({ ...c, opened_at: past }, now)).toBe(true);
  });
  it("sealed and draft capsules never open", () => {
    expect(capsuleIsOpen({ status: "sealed", opening_rule: "date", opens_at: past, opened_at: past }, now)).toBe(false);
    expect(capsuleIsOpen({ status: "draft", opening_rule: "date", opens_at: past, opened_at: null }, now)).toBe(false);
  });
  it("computes dates at a given age", () => {
    expect(dateAtAge("2027-03-10", 15)).toBe("2042-03-10");
    expect(dateAtAge("2027-03-10", 0, 6)).toBe("2027-09-10");
  });
});
