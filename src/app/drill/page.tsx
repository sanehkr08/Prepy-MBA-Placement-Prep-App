import { ComingSoon } from "@/components/ComingSoon";

/** Daily drill: planned (placeholder until it is built). */
export default function DailyDrillPage() {
  return (
    <ComingSoon
      active="drill"
      eyebrow="Practice"
      title="Daily drill"
      badge="Coming soon"
      intro="One quick question a day from your prep kits, to keep the habit going."
      points={[
        "A new question each day, chosen from what you have not practised yet.",
        "Answer in a minute by typing or speaking, and get a quick score.",
        "A streak to keep you consistent through placement season.",
      ]}
    />
  );
}
