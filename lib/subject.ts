// Palavras do protagonista do baú: "da Maya", "do João", "de Ana & Leo".

export type SubjectSource = { subject_name?: string | null; gender?: string | null; kind?: string | null } | null | undefined;

export type SubjectWords = {
  name: string;
  /** "da Maya" / "do João" / "de Ana & Leo" */
  of: string;
  /** "com a Maya" */
  with: string;
  /** "para a Maya" */
  to: string;
  /** "os pais da Maya" / "os organizadores" */
  keepers: string;
  /** "ela" / "ele" / "vocês" */
  pronoun: string;
};

export function subjectWords(v: SubjectSource): SubjectWords {
  const name = v?.subject_name?.trim() || "Maya";
  if (v?.kind === "event") {
    return { name, of: `de ${name}`, with: `com ${name}`, to: `para ${name}`, keepers: "os organizadores", pronoun: "vocês" };
  }
  const art = v?.gender === "boy" ? "o" : v?.gender === "girl" ? "a" : "";
  const the = art ? `${art} ${name}` : name;
  return {
    name,
    of: art ? `d${art} ${name}` : `de ${name}`,
    with: `com ${the}`,
    to: `para ${the}`,
    keepers: `os pais ${art ? `d${art} ${name}` : `de ${name}`}`,
    pronoun: v?.gender === "boy" ? "ele" : v?.gender === "girl" ? "ela" : "ela",
  };
}
