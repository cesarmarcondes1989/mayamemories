import { describe, expect, it } from "vitest";
import { subjectWords } from "@/lib/subject";

describe("subjectWords", () => {
  it("uses the right article", () => {
    expect(subjectWords({ subject_name: "Maya", gender: "girl" }).of).toBe("da Maya");
    expect(subjectWords({ subject_name: "João", gender: "boy" }).with).toBe("com o João");
    expect(subjectWords({ subject_name: "Alex", gender: "unspecified" }).of).toBe("de Alex");
    expect(subjectWords({ subject_name: "Ana & Leo", kind: "event" }).keepers).toBe("os organizadores");
  });
});

import { slugBase } from "@/lib/vaults";
describe("slugBase", () => {
  it("makes short, safe addresses", () => {
    expect(slugBase("Maya")).toBe("maya");
    expect(slugBase("João Pedro")).toBe("joao-pedro");
    expect(slugBase("Ana & Leo — Casamento!")).toBe("ana-leo-casamento");
    expect(slugBase("Bê")).toBe("bau-be");
  });
});
