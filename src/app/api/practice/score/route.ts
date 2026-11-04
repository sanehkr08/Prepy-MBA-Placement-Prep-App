import { withUser } from "@/lib/api-auth";
import { callLLM, errorResponse } from "@/lib/llm";
import { practiceItems, requireJD } from "@/lib/prep";
import { PracticeScoreSchema } from "@/lib/schemas";
import { P9 } from "@/lib/prompts";
import { store } from "@/lib/store";

/** Score one practice answer (typed or dictated) and save the attempt. */
async function handlePOST(req: Request) {
  try {
    const body = (await req.json()) as {
      jdId: string;
      itemId: string;
      answer: string;
      inputMode?: "typed" | "voice";
    };
    const answer = (body.answer ?? "").trim();
    if (answer.length < 20) {
      return Response.json({ error: "Write or speak a little more before scoring." }, { status: 400 });
    }
    const jd = await requireJD(body.jdId);
    const item = (await practiceItems(body.jdId)).find((i) => i.id === body.itemId);
    if (!item) return Response.json({ error: "Practice item not found." }, { status: 404 });
    const result = await callLLM({
      name: P9.name,
      version: P9.version,
      system: P9.system,
      user: P9.user({
        itemType: item.type,
        itemText: item.text,
        answer,
        jd: jd.data,
        company: jd.company,
        concepts: item.concepts,
      }),
      schema: PracticeScoreSchema,
      maxTokens: 2500,
    });
    await store.addAttempt({
      jd_id: jd.id,
      item_id: item.id,
      item_type: item.type,
      input_mode: body.inputMode === "voice" ? "voice" : "typed",
      answer_text: answer,
      result,
    });
    return Response.json({ result });
  } catch (err) {
    return errorResponse(err);
  }
}

export const POST = withUser(handlePOST);
