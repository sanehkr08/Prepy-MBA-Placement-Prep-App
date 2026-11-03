import type { Profile } from "./schemas";

export type ProfileLine = { ref: string; label: string; text: string };

/**
 * Numbers every fact in the confirmed profile with a stable reference
 * (e.g. EX1.B2 = experience 1, bullet 2). Prompts see these lines, cite the
 * refs, and the app checks every cited ref exists. That is how Prepy proves
 * an answer is grounded in the resume.
 */
export function profileLines(p: Profile): ProfileLine[] {
  const lines: ProfileLine[] = [];
  p.education.forEach((e, i) =>
    lines.push({
      ref: `ED${i + 1}`,
      label: `Education ${i + 1}`,
      text: [e.degree, e.institution, e.years].filter(Boolean).join(", "),
    }),
  );
  p.experience.forEach((e, i) => {
    lines.push({
      ref: `EX${i + 1}`,
      label: `Experience ${i + 1}`,
      text: [e.title, e.company, e.dates].filter(Boolean).join(", "),
    });
    e.bullets.forEach((b, j) =>
      lines.push({ ref: `EX${i + 1}.B${j + 1}`, label: `Experience ${i + 1} · bullet ${j + 1}`, text: b }),
    );
  });
  p.projects.forEach((pr, i) =>
    lines.push({
      ref: `PR${i + 1}`,
      label: `Project ${i + 1}`,
      text: [pr.name, pr.description].filter(Boolean).join(": "),
    }),
  );
  p.achievements.forEach((a, i) =>
    lines.push({ ref: `AC${i + 1}`, label: `Achievement ${i + 1}`, text: a }),
  );
  if (p.skills.length) lines.push({ ref: "SK", label: "Skills", text: p.skills.join(", ") });
  if (p.interests.length) lines.push({ ref: "IN", label: "Interests", text: p.interests.join(", ") });
  return lines.filter((l) => l.text.trim().length > 0);
}

export function linesAsPrompt(lines: ProfileLine[]) {
  return lines.map((l) => `[${l.ref}] ${l.text}`).join("\n");
}

export function refLabel(lines: ProfileLine[], ref: string | null | undefined) {
  if (!ref) return null;
  return lines.find((l) => l.ref === ref)?.label ?? null;
}
