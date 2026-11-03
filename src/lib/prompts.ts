/**
 * All prompts P1–P11. Bump a prompt's version when you change it, so evals can
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
  version: "v1",
  system: `You are an expert interview coach extending a candidate's prep kit for this role. Every item you add must be new: not a repeat or close rewording of what is already in the kit. Stay specific to the role family and this JD. No filler.
${GROUNDING_RULE}`,
  concepts: (jd: JDData, company: string, gaps: string[], have: Concepts) => `${jdBlock(jd, company)}

Candidate gaps for this JD: ${gaps.length ? gaps.join("; ") : "none"}

${alreadyHave(have.topics.flatMap((t) => t.items.map((c) => `${c.name} (${t.name})`)))}

Add 4 to 6 NEW concepts this candidate should also study. Reuse an existing topic name when a concept fits it. Return JSON:
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

export const conceptNames = (c: Concepts) => c.topics.flatMap((t) => t.items.map((i) => i.name));
