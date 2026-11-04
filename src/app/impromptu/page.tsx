import { ComingSoon } from "@/components/ComingSoon";

/** Impromptu speaking: planned (placeholder until it is built). */
export default function ImpromptuPage() {
  return (
    <ComingSoon
      active="impromptu"
      eyebrow="Practice"
      title="Impromptu speaking"
      badge="Coming next"
      intro="Think on your feet: a random topic, a few seconds to prepare, then speak for a minute or two."
      points={[
        "A random topic, from business and current affairs to abstract prompts.",
        "A short preparation countdown, then a speaking timer.",
        "Feedback on structure, content, clarity and delivery, with filler words counted.",
      ]}
    />
  );
}
