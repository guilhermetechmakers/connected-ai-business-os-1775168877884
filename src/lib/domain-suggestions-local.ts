/** Client-side domain suggestion heuristic (used when Supabase is not configured or fetch fails). */

export function slugifyDomainBase(input: string): string {
  const s = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return s.length > 0 ? s : "workspace";
}

export function buildDomainSuggestionsLocal(base: string): string[] {
  const slug = slugifyDomainBase(base);
  const variants = [
    `${slug}.connected.ai`,
    `${slug}-hq.connected.ai`,
    `${slug}-app.connected.ai`,
    `${slug}-os.connected.ai`,
  ];
  return [...new Set(variants)];
}
