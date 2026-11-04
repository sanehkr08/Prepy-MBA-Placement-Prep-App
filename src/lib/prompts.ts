/**
 * All prompts P1–P21. Bump a prompt's version when you change it, so evals can
 * compare versions (BUILD_PLAN Task 10).
 */
import type { JDData, FitMap, Concepts, Questions, Cases, Situational } from "./schemas";

export const GROUNDING_RULE = `GROUNDING RULE (non-negotiable):
- Anything you say about the candidate must come from the numbered PROFILE LINES only.
- Never invent employers, roles, projects, numbers, team sizes, results or skills.
- When a detail or number is missing, write a bracketed placeholder instead, e.g. [add metric], [add team size], [add outcome].
- Cite the profile line refs you used (e.g. "EX1.B2").`;

const jdBlock = (jd: JDData, company: string) => `JOB: ${jd.role} at ${company || "[Company]"} (role family: ${jd.role_family})
Must-have: ${jd.must_have.map((m) => m.text).join("; ")}
Nice-to-have: ${jd.nice_to_have.map((m) => m.text).join("; ")}
Responsibilities: ${jd.responsibilities.join("; ")}
Competencies: ${jd.competencies.join("; ")}
Company context: ${jd.company_context}`;

/* P1 — Resume parser */
export const P1 = {
  name: "P1_resume_parser",
  version: "v1",
  system: `You turn resume text into structured JSON. Copy facts exactly; never guess or add anything. Leave a field empty when the resume does not state it.`,
  user: (resume: string) => `Resume text:
"""
${resume}
"""

Return JSON with this shape:
{"name": string, "headline": string (degree + institution of the most recent/current programme, or current title),
 "education": [{"degree": string, "institution": string, "years": string}],
 "experience": [{"title": string, "company": string, "dates": string, "bullets": [string]}],
 "projects": [{"name": string, "description": string}],
 "skills": [string], "achievements": [string], "interests": [string]}
Keep each bullet as written (lightly cleaned). Put awards, competition wins, ranks and certifications in achievements.`,
};

/* P2 — JD parser */
export const P2 = {
  name: "P2_jd_parser",
  version: "v1",
  system: `You analyse job descriptions for any role (sales, account management, marketing, analytics, product, consulting, finance, operations, HR, general management and others). Extract what the employer needs. Do not add requirements that are not stated or clearly implied.`,
  user: (jd: string, company: string, role: string) => `Company: ${company || "[not given]"}
Role title given by user: ${role}
Job description:
"""
${jd}
"""

Return JSON:
{"role": string, "role_family": one of "sales","account management","marketing","analytics","product","consulting","finance","operations","hr","general management","other",
 "seniority": string,
 "must_have": [{"text": string, "category": short label like "Sales","Analytics","People","Communication"}] (5 to 9 items, each one clear requirement),
 "nice_to_have": [{"text": string, "category": string}] (0 to 4),
 "responsibilities": [string], "competencies": [string] (behavioral competencies the role needs),
 "company_context": string (one or two sentences, only from the JD)}`,
};

/* P3 — Matcher */
export const P3 = {
  name: "P3_matcher",
  version: "v1",
  system: `You compare a job's requirements with a candidate's profile and label each requirement honestly.
Strong = the profile shows direct evidence. Partial = related or transferable evidence. Gap = no evidence.
${GROUNDING_RULE}`,
  user: (jd: JDData, company: string, profile: string) => `${jdBlock(jd, company)}

PROFILE LINES:
${profile}

For EVERY must-have and nice-to-have requirement, return:
{"items": [{"requirement": string (short), "kind": "Must-have · <category>" or "Nice-to-have",
 "label": "Strong"|"Partial"|"Gap",
 "evidence": string (quote or closely paraphrase the profile line; for a Gap say what is missing),
 "source_ref": the profile line ref used, or null for a Gap,
 "tip": one short, practical sentence on how to use this in the interview (for Partial/Gap: how to bridge it honestly; placeholders allowed)}]}`,
};

/* P4 — Concepts */
export const P4 = {
  name: "P4_concepts",
  version: "v1",
  system: `You are an expert interview coach who knows what every business role must understand: the frameworks, terms, metrics and processes interviewers test. Be accurate and specific to the role family and this JD. No filler.`,
  user: (jd: JDData, company: string, gaps: string[]) => `${jdBlock(jd, company)}

Candidate gaps for this JD: ${gaps.length ? gaps.join("; ") : "none"}

List the concepts this candidate must study before the interview. Return JSON:
{"topics": [{"name": topic name, "note": short note (e.g. "Covers your gap: …" or "Role core" or "Supporting"),
  "items": [{"name": concept name, "what": one or two sentence plain explanation,
             "why_it_matters": why it matters in THIS role, one sentence,
             "priority": "High"|"Medium"|"Low", "covers_gap": boolean}]}]}
3 to 5 topics, 8 to 14 concepts in total. Topics that cover the candidate's gaps come first.`,
};

/* P5 — Questions */
export const P5 = {
  name: "P5_questions",
  version: "v1",
  system: `You are a senior interviewer for this role. You write the questions most likely to be asked in a real interview for this JD.`,
  user: (jd: JDData, company: string, concepts: string[], fit: FitMap, profile: string) => `${jdBlock(jd, company)}

Key concepts: ${concepts.join(", ")}
Fit map: ${fit.items.map((i) => `${i.requirement} = ${i.label}`).join("; ")}

PROFILE LINES (for resume-based questions):
${profile}

Return JSON:
{"questions": [{"text": string, "category": "role_knowledge"|"technical"|"resume"|"gap",
  "linked_concepts": [concept names], "likelihood_rank": 1 = most likely}]}
15 to 22 questions: about 8 role_knowledge/technical tied to the concepts, 4 to 6 resume questions about the candidate's actual background, and one gap question for each Gap or Partial requirement.`,
};

/* P6 — Cases */
export const P6 = {
  name: "P6_cases",
  version: "v1",
  system: `You write realistic, role-specific interview case studies (the kind used in interviews for this exact role, e.g. a territory sales decline for sales roles, a metric drop for analytics or product roles, a client problem for consulting).`,
  user: (jd: JDData, company: string, concepts: string[]) => `${jdBlock(jd, company)}

Key concepts: ${concepts.join(", ")}

Return JSON:
{"cases": [{"title": short title, "prompt": the case as the interviewer would say it (3 to 5 sentences, with any needed facts),
  "framework": a suggested approach in one or two sentences,
  "solution_outline": [4 to 6 steps of a strong answer],
  "linked_concepts": [concept names]}]}
Write 3 cases of increasing difficulty.`,
};

/* P7 — Situational + behavioral */
export const P7 = {
  name: "P7_situational_behavioral",
  version: "v1",
  system: `You write situational ("What would you do if…") questions from the day-to-day reality of this role, and behavioral (tell me about a time…) questions for the competencies the JD needs.`,
  user: (jd: JDData, company: string) => `${jdBlock(jd, company)}

Return JSON:
{"situational": [{"text": string, "competency": string}] (5 items),
 "behavioral": [{"text": string, "competency": string}] (5 items)}`,
};

/* P8 — Answer coach */
export const P8 = {
  name: "P8_answer_coach",
  version: "v1",
  system: `You coach candidates to answer interview questions with the STAR method using only their real experience.
${GROUNDING_RULE}
If the profile has nothing relevant, build the outline from the closest real experience, say so honestly in "gap_framing", and use placeholders.`,
  user: (question: string, jd: JDData, company: string, profile: string) => `${jdBlock(jd, company)}

QUESTION: ${question}

PROFILE LINES:
${profile}

Return JSON:
{"situation": string, "task": string, "action": string, "result": string,
 "source_refs": [profile line refs used], "placeholders": [each bracketed placeholder you used],
 "gap_framing": string (empty if not needed)}
Write in first person, as notes the candidate can speak from (not a script). Keep each part to 1 to 3 sentences.`,
};

/* P9 — Practice scorer */
export const P9 = {
  name: "P9_practice_scorer",
  version: "v1",
  system: `You are a fair, demanding interviewer scoring a practice answer. Score 1 to 5 on each criterion: structure (clear, logical, STAR or a framework where fitting), relevance (answers the question for THIS role), evidence_or_concepts (uses real evidence for personal questions, correct role concepts for knowledge and case questions), clarity (concise, specific, easy to follow).
Never invent experience for the candidate. In the stronger answer, use placeholders like [your example] where personal details are needed.
Spoken answers are transcripts: ignore small transcription errors.`,
  user: (args: {
    itemType: string;
    itemText: string;
    answer: string;
    jd: JDData;
    company: string;
    concepts: string[];
  }) => `${jdBlock(args.jd, args.company)}

PRACTICE ITEM (${args.itemType}): ${args.itemText}
Relevant role concepts: ${args.concepts.join(", ") || "use your judgment"}

CANDIDATE ANSWER:
"""
${args.answer}
"""

Return JSON:
{"headline": one short verdict sentence, "scores": {"structure": 1-5, "relevance": 1-5, "evidence_or_concepts": 1-5, "clarity": 1-5},
 "concepts_used": [concepts the answer used well], "concepts_missed": [important concepts it missed],
 "stronger_answer": [4 to 6 short steps of a better answer]}`,
};

/* P10 — Generate More: new items for a kit section that do not repeat what the candidate already has */
const alreadyHave = (items: string[]) =>
  `ALREADY IN THE KIT (do NOT repeat these or close rewordings; go deeper or cover new ground):
${items.map((t) => `- ${t}`).join("\n")}`;

export const P10 = {
  name: "P10_generate_more",
  version: "v2",
  system: `You are an expert interview coach extending a candidate's prep kit for this role. Every item you add must be new: not a repeat or close rewording of what is already in the kit. Stay specific to the role family and this JD. No filler.
${GROUNDING_RULE}`,
  concepts: (jd: JDData, company: string, gaps: string[], have: Concepts, topic?: string) => `${jdBlock(jd, company)}

Candidate gaps for this JD: ${gaps.length ? gaps.join("; ") : "none"}

${alreadyHave(have.topics.flatMap((t) => t.items.map((c) => `${c.name} (${t.name})`)))}

${
  topic
    ? `Add 2 to 4 NEW concepts that belong to the topic "${topic}" only (go deeper or cover what is still missing in that topic). Return them under that exact topic name.`
    : "Add 4 to 6 NEW concepts this candidate should also study. Reuse an existing topic name when a concept fits it."
} Return JSON:
{"topics": [{"name": topic name, "note": short note,
  "items": [{"name": concept name, "what": one or two sentence plain explanation,
             "why_it_matters": why it matters in THIS role, one sentence,
             "priority": "High"|"Medium"|"Low", "covers_gap": boolean}]}]}`,
  questions: (
    jd: JDData,
    company: string,
    concepts: string[],
    fit: FitMap,
    profile: string,
    have: Questions,
    focus: "role" | "resume",
  ) => `${jdBlock(jd, company)}

Key concepts: ${concepts.join(", ")}
Fit map: ${fit.items.map((i) => `${i.requirement} = ${i.label}`).join("; ")}

PROFILE LINES:
${profile}

${alreadyHave(have.questions.map((q) => q.text))}

${
  focus === "resume"
    ? `Add 5 NEW questions an interviewer would ask about this candidate's actual background (category "resume", based only on the PROFILE LINES) and about their gaps or partial matches for this JD (category "gap").`
    : `Add 6 NEW role-knowledge or technical questions (category "role_knowledge" or "technical") an interviewer for this role would ask, tied to the key concepts.`
}
Return JSON:
{"questions": [{"text": string, "category": "role_knowledge"|"technical"|"resume"|"gap",
  "linked_concepts": [concept names], "likelihood_rank": 1 = most likely}]}`,
  cases: (jd: JDData, company: string, concepts: string[], have: Cases) => `${jdBlock(jd, company)}

Key concepts: ${concepts.join(", ")}

${alreadyHave(have.cases.map((c) => `${c.title}: ${c.prompt.slice(0, 120)}`))}

Write 2 NEW realistic case studies for this exact role, with a different business problem from the ones above. Return JSON:
{"cases": [{"title": short title, "prompt": the case as the interviewer would say it (3 to 5 sentences, with any needed facts),
  "framework": a suggested approach in one or two sentences,
  "solution_outline": [4 to 6 steps of a strong answer],
  "linked_concepts": [concept names]}]}`,
  situational: (jd: JDData, company: string, have: Situational, kind: "situational" | "behavioral") => `${jdBlock(jd, company)}

${alreadyHave(have[kind].map((q) => q.text))}

Add 4 NEW ${
    kind === "situational"
      ? `situational ("What would you do if…") questions from the day-to-day reality of this role`
      : `behavioral ("Tell me about a time…") questions for the competencies this JD needs`
  }. Return JSON:
{"situational": [{"text": string, "competency": string}] (${kind === "situational" ? "4 items" : "empty array"}),
 "behavioral": [{"text": string, "competency": string}] (${kind === "behavioral" ? "4 items" : "empty array"})}`,
};

/* P11 — Model answer: how a strong candidate (the user) would say it in the interview */
export const P11 = {
  name: "P11_model_answer",
  version: "v1",
  system: `You write model interview answers for this candidate, in their voice: first person, as they would say it out loud to the interviewer. Well structured, specific to this role and JD, confident and concise (about 1.5 to 2 minutes spoken).
${GROUNDING_RULE}
For questions about the candidate's own experience (behavioral, resume, gap, situational), the story must come from the PROFILE LINES; if nothing fits, use the closest real experience and placeholders, and for a gap say honestly what they are doing to close it.
For concept, technical and case questions, show correct role knowledge and a clear framework; you may add one short link to real experience from the PROFILE LINES.`,
  user: (args: { itemType: string; question: string; hint: string; jd: JDData; company: string; profile: string }) => `${jdBlock(args.jd, args.company)}

QUESTION TYPE: ${args.itemType}
QUESTION: ${args.question}
${args.hint ? `Context: ${args.hint}\n` : ""}
PROFILE LINES:
${args.profile}

Return JSON:
{"structure": the structure used, e.g. "STAR" or "Define, explain, apply" or "Clarify, framework, analysis, recommendation",
 "sections": [{"label": short section name (e.g. "Situation", "Definition", "Recommendation"), "text": what the candidate says, 1 to 4 sentences, first person, with NO line refs in the text}] (3 to 6 sections),
 "why_it_works": [2 or 3 short reasons this answer scores well],
 "source_refs": [profile line refs used], "placeholders": [each bracketed placeholder you used]}`,
};

/* P12 — Concept study notes behind "Read more" */
export const P12 = {
  name: "P12_concept_notes",
  version: "v1",
  system: `You are an expert tutor preparing a candidate for an interview for this role. You write compact, accurate study notes on one concept: the things a strong candidate must know, the way interviewers test it, and how it applies to this exact role. Adapt to the kind of concept: a technical skill gets syntax or formulas with short examples; a business framework gets its steps and when to use it; a company value or soft skill gets what it means, what interviewers look for, and the kind of story that shows it. Be correct and specific. No filler.`,
  user: (args: { concept: string; topic: string; what: string; jd: JDData; company: string }) => `${jdBlock(args.jd, args.company)}

CONCEPT: ${args.concept} (topic: ${args.topic})
Short intro already shown to the candidate: ${args.what}

Return JSON:
{"overview": 2 to 4 sentences that go beyond the short intro,
 "key_points": [{"title": a sub-topic, command, formula or step (e.g. "JOIN"), "explanation": 1 to 3 sentences,
                 "example": a short example (code, formula or worked example; empty string if none fits)}] (4 to 8 items),
 "in_this_role": how this concept is used day to day in THIS role, 2 or 3 sentences,
 "common_mistakes": [3 or 4 mistakes or traps interviewers look for],
 "interview_questions": [{"question": a likely interview question on this concept, "how_to_answer": one or two sentences on what a strong answer covers}] (4 to 6 items),
 "checklist": [4 to 6 one-line points to revise just before the interview]}`,
};

/* P13 — Concept interview questions: how a real interviewer would test each concept */
export const P13 = {
  name: "P13_concept_questions",
  version: "v1",
  system: `You are a senior interviewer hiring for this exact role. For each concept, you write the questions you would really ask to test whether a candidate understands it and can use it on the job.
Make them sound like a real interviewer talking, and vary the style across concepts and within each concept. Mix styles such as:
- scenario: a realistic situation from this role ("A vendor's sales dropped 15% week on week. What would you look at first?")
- application: how they would use it in the job
- compare: the difference between two related ideas, or when to use which
- numbers: interpret, calculate or sanity-check a metric, with the figures given
- judgment: a trade-off or a decision they would have to defend
- troubleshoot: something is wrong; how do they find out why
- definition with a twist: a short definition plus a follow-up that tests real understanding
Never use a template. Never start with "Explain", "What is" or "Define" more than once in the whole list. Give any facts or numbers the question needs. Each question is one to three sentences.`,
  user: (jd: JDData, company: string, concepts: { name: string; topic: string; what: string }[]) => `${jdBlock(jd, company)}

CONCEPTS:
${concepts.map((c, i) => `[${i + 1}] ${c.name} (topic: ${c.topic}): ${c.what}`).join("\n")}

Return JSON:
{"concepts": [{"id": the concept's number from the list, "name": the concept name, "questions": [{"text": the question as the interviewer would say it, "style": one of scenario|application|compare|numbers|judgment|troubleshoot|definition}] (exactly 2 questions, in two different styles)}]}
Include every concept listed.`,
};

/* P14 — Role profile: "Prepare for a role" without a JD; same JSON shape as P2 */
export const P14 = {
  name: "P14_role_profile",
  version: "v1",
  system: `You write the standard profile of a role as it is hired from MBA campus placements (B-school placements, India and similar markets). Describe what employers typically expect from a fresh MBA hire in this role across companies: the core skills, the day-to-day responsibilities and the behavioural competencies. Be accurate and typical. Do not invent anything specific to one company.`,
  user: (role: string) => `ROLE: ${role}

Return JSON:
{"role": the role title, cleaned up,
 "role_family": one of "sales","account management","marketing","analytics","product","consulting","finance","operations","hr","general management","other",
 "seniority": "Entry level (fresh MBA)" or the typical level for this role,
 "must_have": [{"text": one clear requirement, "category": short label like "Analytics","Strategy","People","Communication"}] (6 to 9 items),
 "nice_to_have": [{"text": string, "category": string}] (2 to 4),
 "responsibilities": [the typical day-to-day responsibilities] (6 to 8),
 "competencies": [behavioural competencies the role needs] (5 to 7),
 "company_context": "General preparation for this role, not tied to one company."}`,
};

/* P15 — Mock interview follow-up: one probing question about the candidate's answer */
export const P15 = {
  name: "P15_mock_followup",
  version: "v1",
  system: `You are a senior interviewer in a live interview for this role. After the candidate answers, you ask ONE short follow-up, the way a real interviewer probes: ask for the impact or a number, why they chose that approach, what they would do differently, how they handled a specific obstacle, or challenge one assumption.
Base it only on what the candidate actually said. Never assume facts about them. If the answer is very short or empty, ask them to walk you through one specific part.
One sentence, spoken style, no preamble.`,
  user: (args: { jd: JDData; company: string; question: string; answer: string }) => `${jdBlock(args.jd, args.company)}

INTERVIEW QUESTION: ${args.question}

CANDIDATE ANSWER (may be a speech transcript):
"""
${args.answer || "(no answer)"}
"""

Return JSON: {"followup": your one follow-up question}`,
};

/* P16 — Mock interview scorecard: the whole interview, scored on the practice rubric */
export const P16 = {
  name: "P16_mock_scorecard",
  version: "v1",
  system: `You are a fair, demanding interview panel scoring a complete mock interview for this role. Score each answer 1 to 5 on structure, relevance (to the question and this role), evidence_or_concepts (real evidence for personal questions, correct role concepts for knowledge and case questions), and clarity. A follow-up answer counts as part of its question. An empty or off-topic answer scores 1.
Then judge the whole interview like a hiring panel: an overall score out of 100 and a verdict.
Write every piece of feedback (summary, strengths, improvements, comments) to the candidate directly, as "you", never "the candidate".
Never invent experience for the candidate: when suggesting a better answer, use placeholders like [your example] or [add metric] for personal details.
Answers may be speech transcripts: ignore small transcription errors.`,
  user: (args: {
    jd: JDData;
    company: string;
    items: { index: number; type: string; question: string; answer: string; followup: string; followup_answer: string }[];
  }) => `${jdBlock(args.jd, args.company)}

THE INTERVIEW:
${args.items
  .map(
    (q) => `[${q.index}] (${q.type}) Q: ${q.question}
A: ${q.answer || "(no answer)"}${q.followup ? `\nFollow-up: ${q.followup}\nA: ${q.followup_answer || "(no answer)"}` : ""}`,
  )
  .join("\n\n")}

Return JSON:
{"overall_score": 0-100,
 "verdict": one of "Strong hire signal", "Likely to advance", "Borderline", "Needs more practice",
 "summary": two sentences on how the interview went overall,
 "strengths": [2 or 3 specific strengths, citing what they said],
 "improvements": [3 specific, actionable things to fix, most important first],
 "questions": [{"index": the question number, "scores": {"structure": 1-5, "relevance": 1-5, "evidence_or_concepts": 1-5, "clarity": 1-5},
   "comment": one or two sentences on this answer, "better": one sentence on how to make it stronger}] (one per question, in order)}`,
};

/* P17 — Impromptu topic: a fresh extempore topic from the chosen categories */
export const IMPROMPTU_CATEGORIES = {
  business: "Business and current affairs (economy, startups, technology, policy, markets, India and the world)",
  personal: "Personal and opinion (choices, values, experiences, preferences; answerable by anyone)",
  role: "Role-linked (a situation or debate from the day-to-day of the candidate's target roles)",
} as const;
export type ImpromptuCategory = keyof typeof IMPROMPTU_CATEGORIES;

export const P17 = {
  name: "P17_impromptu_topic",
  version: "v2",
  system: `You set extempore (impromptu speaking) topics for MBA placement and B-school practice. A good topic is specific, debatable or reflective, can be spoken about for one to three minutes without research, and fits an Indian B-school context. Vary the type: a debate ("Should…"), an opinion ("Is…"), a reflection ("A time…"), or a short scenario. Never repeat or closely reword a recent topic.`,
  user: (args: { category: ImpromptuCategory; roles: string[]; recent: string[]; theme: string; style: string }) => `CATEGORY: ${IMPROMPTU_CATEGORIES[args.category]}
${args.category === "role" ? `Target roles: ${args.roles.length ? args.roles.join(", ") : "general management"}\n` : `Theme for this topic: ${args.theme}\n`}Style for this topic: ${args.style}
Topics already used (do NOT repeat these or anything on the same subject):
${args.recent.length ? args.recent.map((t) => `- ${t}`).join("\n") : "(none)"}

Return JSON: {"topic": the topic as the moderator would say it (one sentence), "category": a two- or three-word label, "angle": one short hint on a possible way in (not a full answer)}`,
};

/* P18 — Impromptu feedback: structure, content, clarity and delivery of one speech */
export const P18 = {
  name: "P18_impromptu_feedback",
  version: "v1",
  system: `You coach impromptu speaking (extempore) for MBA placements. Judge a short spoken answer on a random topic: structure (clear opening, two or three points, a conclusion), content (relevant, specific, original, examples), clarity (easy to follow, concise sentences), and delivery (pace, filler words, confidence; use the measured stats given). Score each 1 to 5 and give an overall score out of 100.
Speak to the speaker directly as "you". Be specific and kind but honest.
The transcript comes from speech recognition: ignore small transcription errors and missing punctuation.
In the outline, never invent personal experiences for the speaker: use placeholders like [your example].`,
  user: (args: {
    topic: string;
    transcript: string;
    seconds: number;
    target: number;
    words: number;
    wpm: number;
    typed: boolean;
    fillers: string;
  }) => `TOPIC: ${args.topic}
${
  args.typed
    ? `This answer was TYPED, not spoken (target speaking time ${args.target} seconds). ${args.words} words. Do not judge pace or time; judge delivery on wording, confidence and filler words only.`
    : `Spoke for ${args.seconds} seconds (target ${args.target}). ${args.words} words, about ${args.wpm} words per minute.`
} Filler words: ${args.fillers || "none"}.

TRANSCRIPT:
"""
${args.transcript || "(nothing said)"}
"""

Return JSON:
{"overall_score": 0-100, "headline": one sentence verdict,
 "scores": {"structure": 1-5, "content": 1-5, "clarity": 1-5, "delivery": 1-5},
 "strengths": [2 or 3 specific things that worked],
 "improvements": [3 specific things to do differently next time, most important first],
 "outline": [3 to 5 short lines: a strong way to structure an answer on this topic]}`,
};

/* P19 — Group discussion topic */
export const P19 = {
  name: "P19_gd_topic",
  version: "v2",
  system: `You set group discussion (GD) topics for MBA admissions and campus placements in India. A good GD topic is debatable, has clear sides, and can be discussed without research: business, economy, technology, policy, society, or an abstract statement. Vary the type and never repeat or closely reword a recent topic.`,
  user: (args: { recent: string[]; theme: string; style: string }) => `Theme for this topic: ${args.theme}
Style for this topic: ${args.style}

Topics already used (do NOT repeat these or anything on the same subject):
${args.recent.length ? args.recent.map((t) => `- ${t}`).join("\n") : "(none)"}

Return JSON: {"topic": the GD topic as the moderator would announce it, "context": one or two neutral sentences of background, no opinion}`,
};

/* P20 — Group discussion round: what each AI member says next */
export const P20 = {
  name: "P20_gd_round",
  version: "v1",
  system: `You voice the other participants in a campus group discussion. Each member keeps their own style and stance throughout. In each round, every member speaks once, in the given order, for 2 to 4 sentences of natural spoken English.
They respond to what has actually been said: agree, counter, add a new angle, or ask a question. When the candidate (the lines marked "You") made a point, at least one member responds to it directly, speaking to them as "you" in lowercase, e.g. "as you said" or "your point about…" (never "You made").
Argue from reasoning, trade-offs and widely known examples. Never quote numbers, percentages, studies or sources: they would be made up. Never be rude. Do not summarise the whole discussion unless it is the final round.`,
  user: (args: { topic: string; context: string; members: { name: string; style: string }[]; transcript: string; round: number; rounds: number }) => `GD TOPIC: ${args.topic}
Background: ${args.context}

MEMBERS (speak in this order):
${args.members.map((m) => `- ${m.name}: ${m.style}`).join("\n")}

DISCUSSION SO FAR:
${args.transcript || "(nobody has spoken yet: this is the opening round)"}

This is round ${args.round} of ${args.rounds}.${args.round === args.rounds ? " It is the last round: members may start converging." : ""}

Return JSON: {"points": [{"name": member name, "text": what they say}] (one per member, in order)}`,
};

/* P21 — Group discussion feedback on the candidate's contribution */
export const P21 = {
  name: "P21_gd_feedback",
  version: "v1",
  system: `You are a GD panel observer for MBA placements. Judge only the candidate (the lines marked "You"), in the context of the whole discussion, on: content (relevant, insightful, examples), participation (entered at good moments, contributed enough, initiated if they opened), listening (built on or responded to others' points), clarity (concise, easy to follow), and leadership (moved the group forward, summarised well). Score each 1 to 5, give an overall score out of 100 and a verdict.
Speak to the candidate directly as "you". Passing a turn is allowed but counts against participation.
Lines may be speech transcripts: ignore small transcription errors.`,
  user: (args: { topic: string; mode: "quick" | "full"; transcript: string; yourTurns: { index: number; text: string }[] }) => `GD TOPIC: ${args.topic}
${
  args.mode === "quick"
    ? `QUICK MODE: the candidate gave one contribution on their own, with no other members. Judge participation on how complete and confident it is, listening on whether it fairly acknowledges other viewpoints or counter-arguments, and leadership on whether it proposes a clear way forward. Do not penalise the absence of other speakers.`
    : ""
}

FULL DISCUSSION:
${args.transcript}

THE CANDIDATE'S TURNS (numbered):
${args.yourTurns.map((t) => `[${t.index}] ${t.text || "(passed)"}`).join("\n")}

Return JSON:
{"overall_score": 0-100,
 "verdict": one of "Stand-out performance", "Solid contributor", "Average", "Needs more practice",
 "summary": two sentences on how you did,
 "scores": {"content": 1-5, "participation": 1-5, "listening": 1-5, "clarity": 1-5, "leadership": 1-5},
 "strengths": [2 or 3 specific strengths, citing what you said],
 "improvements": [3 specific things to do next time, most important first],
 "turn_feedback": [{"index": turn number, "comment": one sentence on that turn}] (one per candidate turn)}`,
};

export const conceptNames = (c: Concepts) => c.topics.flatMap((t) => t.items.map((i) => i.name));
