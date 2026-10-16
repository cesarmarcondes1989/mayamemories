import { describe, expect, it } from "vitest";
import { boldParts, pickNudge, subjectCounter, type MemoryStats } from "@/lib/nudges";

const now = new Date("2027-05-01T12:00:00-03:00");
const base: MemoryStats = {
  enabled: true, subject_name: "Maya", birth_date: null, expected_birth_date: null,
  my_total: 0, my_approved: 0, my_last_at: null, my_last_photo_at: null, my_last_audio_at: null,
  my_letters: 0, my_visits: 0, family_total: 0, next_capsule: null,
};

describe("nudges", () => {
  it("invites the first memory", () => {
    expect(pickNudge(base, now, 0.5).text).toMatch(/primeira lembrança/);
  });
  it("mentions days since last memory", () => {
    const n = pickNudge({ ...base, my_total: 3, my_last_at: "2027-04-08T12:00:00-03:00", my_last_photo_at: "2027-04-30T12:00:00-03:00", my_last_audio_at: "x", my_letters: 1 }, now, 0);
    expect(n.text).toMatch(/23 dias/);
  });
  it("never shames or compares with others", () => {
    for (let i = 0; i < 20; i++) {
      const n = pickNudge({ ...base, my_total: 2, my_last_at: "2027-01-01T12:00:00-03:00" }, now, i / 20);
      expect(n.text).not.toMatch(/ranking|outr[ao]s pessoas|vergonha/i);
      expect(n.cta.href.startsWith("/")).toBe(true);
    }
  });
  it("counts days of life or days until birth", () => {
    expect(subjectCounter({ ...base, birth_date: "2027-03-15" }, now)).toMatch(/47 dias de vida/);
    expect(subjectCounter({ ...base, expected_birth_date: "2027-05-31" }, now)).toMatch(/Faltam \*\*30 dias\*\*/);
  });
  it("splits bold markup", () => {
    expect(boldParts("a **b** c")).toEqual([{ text: "a ", bold: false }, { text: "b", bold: true }, { text: " c", bold: false }]);
  });
});
