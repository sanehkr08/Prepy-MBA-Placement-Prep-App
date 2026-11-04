import { ComingSoon } from "@/components/ComingSoon";

/** Story bank: planned (placeholder until it is built). */
export default function StoryBankPage() {
  return (
    <ComingSoon
      active="stories"
      eyebrow="Practice"
      title="Story bank"
      badge="Coming soon"
      intro="Your best STAR stories, saved once and reused across every role and interview."
      points={[
        "Stories drafted only from your resume, with placeholders for missing details.",
        "Each story tagged with the competencies it shows: leadership, ownership, problem solving.",
        "Pick the right story for any behavioral question in seconds.",
      ]}
    />
  );
}
