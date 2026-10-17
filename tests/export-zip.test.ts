import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { downloadZip } from "client-zip";
import { buildIndexHtml } from "@/lib/export/index-html";

describe("export zip", () => {
  it("streams files into a valid zip with the offline index", async () => {
    const big = new Uint8Array(3 * 1024 * 1024).map((_, i) => i % 251);
    async function* entries() {
      yield { name: "LEIA-ME.txt", input: "olá" };
      yield {
        name: "index.html",
        input: buildIndexHtml({
          title: "Baú da <Alice>",
          exportedAt: "2026-10-21T00:00:00Z",
          people: [{ id: "p1", display_name: "Vovó" }],
          memories: [{ id: "m1", title: "Banho", description: "Linha 1\nLinha 2", memory_type: "photo", author_person_id: "p1", occurred_at: "2026-03-14", created_at: "2026-03-14", unlock_at: null, recipient: null, moderation_status: "approved", deleted_at: null }],
          comments: [],
          media: [{ memory_id: "m1", media_type: "image", zipPath: "media/2026/fotos/a.jpg", original_filename: "a.jpg" }],
          parts: 2,
        }),
      };
      yield { name: "media/2026/videos/v.mp4", input: new Response(big) };
    }
    const buf = Buffer.from(await downloadZip(entries()).arrayBuffer());
    const dir = mkdtempSync(join(tmpdir(), "zip-"));
    const file = join(dir, "x.zip");
    writeFileSync(file, buf);
    expect(execFileSync("unzip", ["-t", file]).toString()).toMatch(/No errors detected/);
    const html = execFileSync("unzip", ["-p", file, "index.html"]).toString();
    expect(html).toContain("Baú da &lt;Alice&gt;");
    expect(html).toContain('src="media/2026/fotos/a.jpg"');
    expect(html).toContain("Linha 1<br>Linha 2");
    expect(html).toContain("mesma pasta");
  });
});
