import { z } from "zod";

/* ---------- Profile (P1) ---------- */

export const ProfileSchema = z.object({
  name: z.string().default(""),
  headline: z.string().default(""), // e.g. "MBA-BA, IIM Ranchi"
  education: z
    .array(
      z.object({
        degree: z.string().default(""),
        institution: z.string().default(""),
        years: z.string().default(""),
      }),
    )
    .default([]),
  experience: z
    .array(
      z.object({
        title: z.string().default(""),
        company: z.string().default(""),
        dates: z.string().default(""),
        bullets: z.array(z.string()).default([]),
      }),
    )
    .default([]),
  projects: z
    .array(z.object({ name: z.string().default(""), description: z.string().default("") }))
    .default([]),
  skills: z.array(z.string()).default([]),
  achievements: z.array(z.string()).default([]),
  interests: z.array(z.string()).default([]),
});
export type Profile = z.infer<typeof ProfileSchema>;

/* ---------- Job description (P2) ---------- */

export const ROLE_FAMILIES = [
  "sales",
  "account management",
  "marketing",
  "analytics",
  "product",
  "consulting",
  "finance",
  "operations",
  "hr",
  "general management",
  "other",
] as const;

export const JDSchema = z.object({
  role: z.string(),
  role_family: z.string(),
  seniority: z.string().default(""),
  must_have: z.array(z.object({ text: z.string(), category: z.string().default("") })).default([]),
  nice_to_have: z.array(z.object({ text: z.string(), category: z.string().default("") })).default([]),
  responsibilities: z.array(z.string()).default([]),
  competencies: z.array(z.string()).default([]),
  company_context: z.string().default(""),
});
export type JDData = z.infer<typeof JDSchema>;

/* ---------- Fit map (P3) ---------- */

export const FitLabel = z.enum(["Strong", "Partial", "Gap"]);
export type FitLabel = z.infer<typeof FitLabel>;

export const FitMapSchema = z.object({
  items: z.array(
    z.object({
      requirement: z.string(),
      kind: z.string().default(""),
      label: FitLabel,
      evidence: z.string().default(""),
      source_ref: z.string().nullable().default(null),
      tip: z.string().default(""),
    }),
  ),
});
export type FitMap = z.infer<typeof FitMapSchema> & {
  overall_label: "Strong" | "Moderate" | "Low";
  counts: { Strong: number; Partial: number; Gap: number };
};

/* ---------- Prep kit (P4–P7) ---------- */

export const Priority = z.enum(["High", "Medium", "Low"]);

export const ConceptsSchema = z.object({
  topics: z.array(
    z.object({
      name: z.string(),
      note: z.string().default(""),
      items: z.array(
        z.object({
          name: z.string(),
          what: z.string(),
          why_it_matters: z.string(),
          priority: Priority,
          covers_gap: z.boolean().default(false),
        }),
      ),
    }),
  ),
});
export type Concepts = z.infer<typeof ConceptsSchema>;

export const QuestionCategory = z.enum(["role_knowledge", "technical", "resume", "gap"]);

export const QuestionsSchema = z.object({
  questions: z.array(
    z.object({
      text: z.string(),
      category: QuestionCategory,
      linked_concepts: z.array(z.string()).default([]),
      likelihood_rank: z.number().default(0),
    }),
  ),
});
export type Questions = z.infer<typeof QuestionsSchema>;

export const CasesSchema = z.object({
  cases: z.array(
    z.object({
      title: z.string(),
      prompt: z.string(),
      framework: z.string(),
      solution_outline: z.array(z.string()),
      linked_concepts: z.array(z.string()).default([]),
    }),
  ),
});
export type Cases = z.infer<typeof CasesSchema>;

export const SituationalSchema = z.object({
  situational: z.array(z.object({ text: z.string(), competency: z.string().default("") })),
  behavioral: z.array(z.object({ text: z.string(), competency: z.string().default("") })),
});
export type Situational = z.infer<typeof SituationalSchema>;

/* ---------- Answer outline (P8) ---------- */

export const OutlineSchema = z.object({
  situation: z.string(),
  task: z.string(),
  action: z.string(),
  result: z.string(),
  source_refs: z.array(z.string()).default([]),
  placeholders: z.array(z.string()).default([]),
  gap_framing: z.string().default(""),
});
export type Outline = z.infer<typeof OutlineSchema>;

/* ---------- Practice score (P9) ---------- */

const Score = z.number().min(1).max(5);

export const PracticeScoreSchema = z.object({
  headline: z.string(),
  scores: z.object({
    structure: Score,
    relevance: Score,
    evidence_or_concepts: Score,
    clarity: Score,
  }),
  concepts_used: z.array(z.string()).default([]),
  concepts_missed: z.array(z.string()).default([]),
  stronger_answer: z.array(z.string()).default([]),
});
export type PracticeScore = z.infer<typeof PracticeScoreSchema>;

/* ---------- Model answer (P11) ---------- */

export const ModelAnswerSchema = z.object({
  structure: z.string().default(""),
  sections: z.array(z.object({ label: z.string(), text: z.string() })),
  why_it_works: z.array(z.string()).default([]),
  source_refs: z.array(z.string()).default([]),
  placeholders: z.array(z.string()).default([]),
});
export type ModelAnswer = z.infer<typeof ModelAnswerSchema>;

/* ---------- Concept study notes (P12) ---------- */

export const ConceptNotesSchema = z.object({
  overview: z.string(),
  key_points: z.array(z.object({ title: z.string(), explanation: z.string(), example: z.string().default("") })),
  in_this_role: z.string().default(""),
  common_mistakes: z.array(z.string()).default([]),
  interview_questions: z.array(z.object({ question: z.string(), how_to_answer: z.string() })).default([]),
  checklist: z.array(z.string()).default([]),
});
export type ConceptNotes = z.infer<typeof ConceptNotesSchema>;

/* ---------- Concept interview questions for practice (P13) ---------- */

export const ConceptQuestionsSchema = z.object({
  concepts: z.array(
    z.object({
      id: z.coerce.number().optional(),
      name: z.string().default(""),
      questions: z.array(z.object({ text: z.string(), style: z.string().default("") })),
    }),
  ),
});
export type ConceptQuestions = z.infer<typeof ConceptQuestionsSchema>;

/* ---------- Mock interview (P15 follow-up, P16 scorecard) ---------- */

export const FollowupSchema = z.object({ followup: z.string().default("") });

export const MockScoreSchema = z.object({
  overall_score: z.number().min(0).max(100),
  verdict: z.string(),
  summary: z.string(),
  strengths: z.array(z.string()).default([]),
  improvements: z.array(z.string()).default([]),
  questions: z.array(
    z.object({
      index: z.coerce.number(),
      scores: z.object({ structure: Score, relevance: Score, evidence_or_concepts: Score, clarity: Score }),
      comment: z.string().default(""),
      better: z.string().default(""),
    }),
  ),
});
export type MockScore = z.infer<typeof MockScoreSchema>;

/* ---------- Impromptu speaking (P17 topic, P18 feedback) ---------- */

export const ImpromptuTopicSchema = z.object({
  topic: z.string(),
  category: z.string().default(""),
  angle: z.string().default(""),
});
export type ImpromptuTopic = z.infer<typeof ImpromptuTopicSchema>;

export const ImpromptuScoreSchema = z.object({
  overall_score: z.number().min(0).max(100),
  headline: z.string(),
  scores: z.object({ structure: Score, content: Score, clarity: Score, delivery: Score }),
  strengths: z.array(z.string()).default([]),
  improvements: z.array(z.string()).default([]),
  outline: z.array(z.string()).default([]),
});
export type ImpromptuScore = z.infer<typeof ImpromptuScoreSchema>;

/* ---------- Kit section names ---------- */

export const KIT_SECTIONS = ["concepts", "questions", "cases", "situational"] as const;
export type KitSection = (typeof KIT_SECTIONS)[number];
