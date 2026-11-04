import { ComingSoon } from "@/components/ComingSoon";

/** Group discussion: planned (placeholder until it is built). */
export default function GroupDiscussionPage() {
  return (
    <ComingSoon
      active="gd"
      eyebrow="Practice"
      title="Group discussion"
      badge="Coming next"
      intro="Practise group discussions the way B-school and campus placement rounds run them."
      points={[
        "Quick mode: a GD topic, your contribution in two or three minutes, then feedback.",
        "Full mode: three or four AI participants make their points, and you jump in by speaking or typing.",
        "Feedback on your content, how you entered the discussion, and how you built on others.",
      ]}
    />
  );
}
