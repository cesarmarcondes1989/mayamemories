import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// Um campo chamado "id" (ou "action") sobrescreve form.id / form.action no
// navegador; o React então descarta o botão clicado do envio e a moderação
// chegava ao banco sem dizer se era aprovar ou excluir.
function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "node_modules" ? [] : tsxFiles(path);
    return path.endsWith(".tsx") ? [path] : [];
  });
}

describe("campos de formulário", () => {
  it('nenhum formulário usa name="id" ou name="action"', () => {
    const bad = [...tsxFiles("app"), ...tsxFiles("components")].filter((f) => /\bname=["'](id|action)["']/.test(readFileSync(f, "utf8")));
    expect(bad).toEqual([]);
  });
});
