/**
 * Prepy eval harness (BUILD_PLAN Task 10).
 *
 * Usage (PowerShell, from the project folder, with .env.local filled in):
 *   npx tsx --env-file=.env.local evals/run-evals.ts
 *
 * Needs:
 *   - a saved profile in data/prepy.json (upload your resume in the app first)
 *   - JD files in evals/testset/ (or evals/testset/private/ for real JDs you
 *     don't want in Git), named "<Company> - <Role>.txt"
 *   - optional reference concept lists: "<same name>.concepts.txt", one concept per line
 *
 * Writes a Markdown report to evals/results/<date>.md. Uses its own data
 * folder (evals/.data) so your real prep kits are not touched.
 */
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";

const ROOT = process.cwd();
const EVAL_DATA = path.join(ROOT, "evals", ".data");
const MAIN_DB = path.join(ROOT, "data", "prepy.json");

// Use a separate store for eval runs, seeded with the saved profile.
fs.mkdirSync(EVAL_DATA, { recursive: true });
process.env.PREPY_DATA_DIR = EVAL_DATA;

async function main() {
  const { store } = await import("../src/lib/store");
  const { callLLM } = await import("../src/lib/llm");
  const { P2, P9 } = await import("../src/lib/prompts");
  const { JDSchema, PracticeScoreSchema } = await import("../src/lib/schemas");
  const prep = await import("../src/lib/prep");
  const { profileLines, linesAsPrompt } = await import("../src/lib/profile-lines");
  type Concepts = import("../src/lib/schemas").Concepts;
  type Questions = import("../src/lib/schemas").Questions;
  type Cases = import("../src/lib/schemas").Cases;
  type Situational = import("../src/lib/schemas").Situational;

  if (!fs.existsSync(MAIN_DB)) throw new Error("No data/prepy.json. Upload and save your resume in the app first.");
  const main = JSON.parse(fs.readFileSync(MAIN_DB, "utf8"));
  if (!main.profile) throw new Error("No saved profile found. Save your profile in the app first.");
  store.deleteAll();
  store.saveProfile(main.profile.data, main.profile.raw_text);
  const lines = profileLines(main.profile.data);

  const dirs = [path.join(ROOT, "evals", "testset"), path.join(ROOT, "evals", "testset", "private")];
  const files = dirs
    .filter((d) => fs.existsSync(d))
    .flatMap((d) =>
      fs
        .readdirSync(d)
        .filter((f) => f.endsWith(".txt") && !f.endsWith(".concepts.txt"))
        .map((f) => path.join(d, f)),
    );
  if (files.length === 0) throw new Error("Add JD .txt files to evals/testset/ first.");

  const Judge = z.object({ score: z.number().min(1).max(5), reason: z.string() });
  const Grounding = z.object({
    unsupported_claims: z.array(z.string()),
    supported: z.boolean(),
  });
  const Coverage = z.object({ covered: z.array(z.string()), missing: z.array(z.string()), incorrect: z.array(z.string()) });

  type Row = {
    name: string;
    family: string;
    fit: string;
    nConcepts: number;
    qRel: number;
    caseRel: number;
    coverage: string;
    unsupported: number;
    conceptNames: string[];
  };
  const rows: Row[] = [];

  for (const file of files) {
    const base = path.basename(file, ".txt");
    const [company, role] = base.includes(" - ") ? base.split(" - ") : ["", base];
    console.log(`\n▶ ${base}`);
    const text = fs.readFileSync(file, "utf8");
    const data = await callLLM({ name: P2.name, version: P2.version, system: P2.system, user: P2.user(text, company, role), schema: JDSchema });
    const jd = store.createJD({ company, role, raw_text: text, data });
    const fit = await prep.ensureFit(jd.id);
    const concepts = (await prep.ensureSection(jd.id, "concepts")) as Concepts;
    const questions = (await prep.ensureSection(jd.id, "questions")) as Questions;
    const cases = (await prep.ensureSection(jd.id, "cases")) as Cases;
    const sit = (await prep.ensureSection(jd.id, "situational")) as Situational;
    const names = concepts.topics.flatMap((t) => t.items.map((i) => i.name));

    // Relevance of questions and cases (LLM as judge, 1–5)
    const qj = await callLLM({
      name: "EVAL_question_relevance",
      version: "v1",
      system: "You are a strict hiring manager. Rate how specific and realistic these interview questions are for this exact JD, 1 to 5.",
      user: `JD:\n${text.slice(0, 6000)}\n\nQUESTIONS:\n${questions.questions.slice(0, 10).map((q) => "- " + q.text).join("\n")}\n\nReturn {"score": 1-5, "reason": string}`,
      schema: Judge,
    });
    const cj = await callLLM({
      name: "EVAL_case_relevance",
      version: "v1",
      system: "You are a strict hiring manager. Rate how realistic and role-relevant these interview cases are for this exact JD, 1 to 5.",
      user: `JD:\n${text.slice(0, 6000)}\n\nCASES:\n${cases.cases.map((c) => "- " + c.prompt).join("\n")}\n\nReturn {"score": 1-5, "reason": string}`,
      schema: Judge,
    });

    // Concept coverage against a hand-written reference list (optional)
    let coverage = "no reference list";
    const refFile = file.replace(/\.txt$/, ".concepts.txt");
    if (fs.existsSync(refFile)) {
      const ref = fs.readFileSync(refFile, "utf8").split("\n").map((s) => s.trim()).filter(Boolean);
      const cov = await callLLM({
        name: "EVAL_concept_coverage",
        version: "v1",
        system: "Compare a generated concept list with a reference list. A reference concept is covered if a generated concept means the same thing. Also list generated concepts that are factually wrong.",
        user: `REFERENCE:\n${ref.join("\n")}\n\nGENERATED:\n${concepts.topics.flatMap((t) => t.items.map((i) => `${i.name}: ${i.what}`)).join("\n")}\n\nReturn {"covered": [reference items covered], "missing": [reference items missing], "incorrect": [generated items that are wrong]}`,
        schema: Coverage,
      });
      coverage = `${Math.round((cov.covered.length / Math.max(ref.length, 1)) * 100)}% covered, ${cov.incorrect.length} incorrect`;
    }

    // Grounding: answer outlines for behavioral + resume questions must only use profile facts
    const outlineQs = [
      ...sit.behavioral.slice(0, 2).map((b) => b.text),
      ...questions.questions.filter((q) => q.category === "resume").slice(0, 2).map((q) => q.text),
    ];
    let unsupported = 0;
    for (const q of outlineQs) {
      const o = await prep.ensureOutline(jd.id, q);
      const g = await callLLM({
        name: "EVAL_grounding",
        version: "v1",
        system: "You check whether an answer outline invents facts about the candidate. Bracketed placeholders like [add metric] are allowed. Any employer, role, project, number, team size, result or skill that is NOT in the profile lines is an unsupported claim.",
        user: `PROFILE LINES:\n${linesAsPrompt(lines)}\n\nOUTLINE:\nS: ${o.situation}\nT: ${o.task}\nA: ${o.action}\nR: ${o.result}\n\nReturn {"unsupported_claims": [string], "supported": boolean}`,
        schema: Grounding,
      });
      unsupported += g.unsupported_claims.length;
    }

    rows.push({
      name: base,
      family: data.role_family,
      fit: `${fit.overall_label} (${fit.counts.Strong}/${fit.counts.Partial}/${fit.counts.Gap})`,
      nConcepts: names.length,
      qRel: qj.score,
      caseRel: cj.score,
      coverage,
      unsupported,
      conceptNames: names.map((n) => n.toLowerCase()),
    });
    console.log(`  fit ${rows.at(-1)!.fit}, question relevance ${qj.score}, case relevance ${cj.score}, unsupported claims ${unsupported}`);
  }

  // Role adaptivity: concept-name overlap between every pair of JDs
  const overlaps: string[] = [];
  for (let i = 0; i < rows.length; i++)
    for (let j = i + 1; j < rows.length; j++) {
      const a = new Set(rows[i].conceptNames);
      const b = rows[j].conceptNames;
      const shared = b.filter((x) => a.has(x)).length;
      const pct = Math.round((shared / Math.max(1, Math.min(a.size, b.length))) * 100);
      overlaps.push(`| ${rows[i].name} | ${rows[j].name} | ${pct}% |`);
    }

  // Scoring consistency: same answer scored 3 times
  const first = store.listJDs()[0];
  const items = prep.practiceItems(first.id);
  const item = items.find((i) => i.type === "case") ?? items[0];
  const answer =
    "I would first clarify whether the problem is across the whole area or one segment, then break the metric into its drivers, check supply-side issues before demand-side ones, and act on the weakest driver while tracking it weekly.";
  const jdRec = store.getJD(first.id)!;
  const scores: number[] = [];
  for (let k = 0; k < 3; k++) {
    const r = await callLLM({
      name: P9.name,
      version: P9.version,
      system: P9.system,
      user: P9.user({ itemType: item.type, itemText: item.text, answer, jd: jdRec.data, company: jdRec.company, concepts: item.concepts }),
      schema: PracticeScoreSchema,
    });
    scores.push(r.scores.structure + r.scores.relevance + r.scores.evidence_or_concepts + r.scores.clarity);
  }
  const spread = Math.max(...scores) - Math.min(...scores);

  const avg = (xs: number[]) => (xs.reduce((a, b) => a + b, 0) / Math.max(xs.length, 1)).toFixed(2);
  const date = new Date().toISOString().slice(0, 10);
  const md = `# Prepy eval results · ${date}

Model: ${process.env.LLM_MODEL || "claude-sonnet-5-5"} · Prompt versions: P2–P9 v1 · JDs tested: ${rows.length}

## Summary

| Eval | Result | Pass threshold | Pass? |
| --- | --- | --- | --- |
| Grounding: unsupported claims in answer outlines | ${rows.reduce((a, r) => a + r.unsupported, 0)} | 0 | ${rows.every((r) => r.unsupported === 0) ? "Yes" : "No"} |
| Question relevance (avg, 1–5) | ${avg(rows.map((r) => r.qRel))} | ≥ 4 | ${Number(avg(rows.map((r) => r.qRel))) >= 4 ? "Yes" : "No"} |
| Case relevance (avg, 1–5) | ${avg(rows.map((r) => r.caseRel))} | ≥ 4 | ${Number(avg(rows.map((r) => r.caseRel))) >= 4 ? "Yes" : "No"} |
| Scoring consistency (total score spread over 3 runs, out of 20) | ${spread} (${scores.join(", ")}) | ≤ 2 | ${spread <= 2 ? "Yes" : "No"} |

## Per JD

| JD | Role family | Fit (S/P/G) | Concepts | Question relevance | Case relevance | Concept coverage | Unsupported claims |
| --- | --- | --- | --- | --- | --- | --- | --- |
${rows.map((r) => `| ${r.name} | ${r.family} | ${r.fit} | ${r.nConcepts} | ${r.qRel} | ${r.caseRel} | ${r.coverage} | ${r.unsupported} |`).join("\n")}

## Role adaptivity (concept-name overlap; lower = more role-specific)

| JD A | JD B | Overlap |
| --- | --- | --- |
${overlaps.join("\n") || "| (needs 2+ JDs) | | |"}
`;
  const outDir = path.join(ROOT, "evals", "results");
  fs.mkdirSync(outDir, { recursive: true });
  const out = path.join(outDir, `${date}.md`);
  fs.writeFileSync(out, md);
  console.log(`\n✔ Results written to ${path.relative(ROOT, out)}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
