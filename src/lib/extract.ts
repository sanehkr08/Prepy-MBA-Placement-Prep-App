import { extractText, getDocumentProxy } from "unpdf";
import mammoth from "mammoth";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export class ExtractError extends Error {}

/** Text from a pasted string or an uploaded PDF / DOCX / TXT file. */
export async function textFromForm(form: FormData, field = "file", textField = "text") {
  const pasted = String(form.get(textField) ?? "").trim();
  const file = form.get(field);
  if (file && typeof file !== "string" && file.size > 0) {
    if (file.size > MAX_UPLOAD_BYTES) throw new ExtractError("File is larger than 5 MB.");
    const buf = Buffer.from(await file.arrayBuffer());
    const name = file.name.toLowerCase();
    let text = "";
    if (name.endsWith(".pdf")) {
      const pdf = await getDocumentProxy(new Uint8Array(buf));
      const out = await extractText(pdf, { mergePages: true });
      text = Array.isArray(out.text) ? out.text.join("\n") : out.text;
    } else if (name.endsWith(".docx")) {
      text = (await mammoth.extractRawText({ buffer: buf })).value;
    } else if (name.endsWith(".txt") || name.endsWith(".md")) {
      text = buf.toString("utf8");
    } else {
      throw new ExtractError("Upload a PDF, DOCX or TXT file, or paste the text.");
    }
    text = text.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
    if (text.length < 200) {
      throw new ExtractError(
        "Very little text came out of this file. It may be a scanned PDF. Paste the text instead.",
      );
    }
    return text;
  }
  if (pasted.length < 50) throw new ExtractError("Paste the text or upload a file.");
  return pasted;
}
