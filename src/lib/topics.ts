/**
 * Variety for generated GD and impromptu topics: each request gets a random theme and
 * style, the topics already shown are excluded, and a near-repeat triggers one retry.
 */

export const THEMES = [
  "technology and AI",
  "startups and entrepreneurship",
  "banking, fintech and personal finance",
  "economy and jobs",
  "education and skills",
  "healthcare",
  "environment and climate",
  "energy",
  "agriculture and rural India",
  "cities and infrastructure",
  "media, social media and entertainment",
  "sports",
  "marketing and brands",
  "e-commerce and retail",
  "manufacturing and supply chains",
  "work culture and careers",
  "leadership and management",
  "ethics and business",
  "government policy and regulation",
  "global affairs and trade",
  "gender and diversity",
  "consumer behaviour",
  "travel and tourism",
  "food and lifestyle",
  "culture and society",
  "science and space",
  "the future of work",
  "philosophy and abstract ideas",
];

export const GD_STYLES = [
  'a debate motion ("Should…" or "Is…")',
  "a provocative statement to agree or disagree with",
  "an abstract one- to three-word topic (classic B-school abstract GD)",
  "a short business case situation the group must resolve",
  'a comparison ("X versus Y")',
  "a well-known saying or quote to interpret and debate",
];

export const IMPROMPTU_STYLES = [
  'an opinion question ("Is…", "Should…")',
  "a reflective prompt about choices or experiences",
  "a short scenario to respond to",
  "an abstract word or phrase to speak on",
  'a "convince us" prompt (argue for one side)',
];

export const pick = <T>(xs: readonly T[]) => xs[Math.floor(Math.random() * xs.length)];

const words = (t: string) =>
  new Set(
    t
      .toLowerCase()
      .replace(/[^a-z0-9 ]+/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3),
  );

/** True when a topic is the same as, or mostly the same words as, one already seen. */
export function isRepeat(topic: string, seen: string[]): boolean {
  const a = words(topic);
  if (!a.size) return false;
  return seen.some((s) => {
    const b = words(s);
    if (!b.size) return false;
    let common = 0;
    for (const w of a) if (b.has(w)) common++;
    return common / Math.min(a.size, b.size) >= 0.6;
  });
}

/** Clean the client's list of topics already shown in this session. */
export function cleanExclude(x: unknown): string[] {
  return Array.isArray(x)
    ? x
        .map((t) => String(t).trim().slice(0, 300))
        .filter(Boolean)
        .slice(-40)
    : [];
}
