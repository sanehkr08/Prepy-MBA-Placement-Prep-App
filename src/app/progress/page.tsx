import { ComingSoon } from "@/components/ComingSoon";

/** My progress: planned (placeholder until it is built). */
export default function ProgressPage() {
  return (
    <ComingSoon
      active="progress"
      eyebrow="Your preparation"
      title="My progress"
      badge="Coming soon"
      intro="See how your answers improve over time, across every prep kit."
      points={[
        "Your practice and mock interview scores over time.",
        "Your strongest and weakest areas: structure, relevance, evidence and clarity.",
        "Which concepts you have practised, and which you have not touched yet.",
      ]}
    />
  );
}
