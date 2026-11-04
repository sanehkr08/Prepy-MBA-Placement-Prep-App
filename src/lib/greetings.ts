/**
 * Home-page greetings: a new one on every visit, matched to the time of day,
 * with a little MBA and corporate humour. {name} is the user's first name.
 */
type Part = "morning" | "afternoon" | "evening" | "night";

const BY_PART: Record<Part, string[]> = {
  morning: [
    "Good morning, {name}. Coffee first, frameworks second.",
    "Rise and grind, {name}. Your 2x2 matrix awaits.",
    "Morning, {name}. Let's move the needle before the first stand-up.",
    "Good morning, {name}. Today's agenda: crush one case, then circle back.",
    "Morning, {name}. Early birds get the shortlist.",
    "Good morning, {name}. Let's front-load today's wins.",
  ],
  afternoon: [
    "Good afternoon, {name}. Post-lunch slump? Let's synergise it away.",
    "Afternoon, {name}. Perfect time to boil the ocean. Or just one case.",
    "Good afternoon, {name}. Let's turn this slot into a value-add.",
    "Hey {name}, good afternoon. Quick sync with your future offer letter?",
    "Good afternoon, {name}. Let's deep-dive before the 4 pm deck crunch.",
  ],
  evening: [
    "Good evening, {name}. Time to close the loop on today's prep.",
    "Evening, {name}. Let's take this offline, and into a mock interview.",
    "Good evening, {name}. Your EOD deliverable: one great answer.",
    "Hey {name}, good evening. Low-hanging fruit tastes best after 6 pm.",
    "Good evening, {name}. Let's bridge some gaps before dinner.",
  ],
  night: [
    "Burning the midnight oil, {name}? Spoken like a true consultant.",
    "Hey {name}, still up? The deck can wait. Your prep can't.",
    "Late night, {name}? Let's make this the highest-ROI hour of your day.",
    "Hello, night owl {name}. Placements reward the persistent.",
  ],
};

const ANYTIME = [
  "Hey {name}, let's turn your gaps into growth areas.",
  "Hey {name}, your dream role called. It wants a STAR answer.",
  "Welcome back, {name}. Let's add some bandwidth to your prep.",
  "Hey {name}, ready to align your story with the JD?",
  "Hey {name}, let's make your resume do the talking.",
];

export function dayPart(d: Date): Part {
  const h = d.getHours();
  if (h >= 5 && h < 12) return "morning";
  if (h >= 12 && h < 17) return "afternoon";
  if (h >= 17 && h < 22) return "evening";
  return "night";
}

/** A random greeting for this time of day; `avoid` skips the one shown last time. */
export function pickGreeting(name: string, d = new Date(), avoid?: string): string {
  const pool = [...BY_PART[dayPart(d)], ...BY_PART[dayPart(d)], ...ANYTIME]; // time-of-day lines twice as likely
  const lines = pool.map((l) => l.replaceAll("{name}", name || "there"));
  const choices = lines.filter((l) => l !== avoid);
  return choices[Math.floor(Math.random() * choices.length)] ?? lines[0];
}
