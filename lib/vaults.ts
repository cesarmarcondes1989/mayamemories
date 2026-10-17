/** Endereço curto e único a partir do nome: "Maya" -> "maya" (o servidor tenta "maya-2"… se já existir). */
export function slugBase(name: string): string {
  const s = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32)
    .replace(/-+$/g, "");
  return s.length >= 3 ? s : `bau-${s || "novo"}`;
}
