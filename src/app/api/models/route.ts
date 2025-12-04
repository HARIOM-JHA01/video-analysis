import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function GET() {
  try {
    const [openaiList, geminiList] = await Promise.all([
      openai.models.list(),
      gemini.models.list(),
    ]);

    const openaiData = (openaiList?.data ?? []) as unknown as { id?: string }[];
    const openaiModels = openaiData
      .map((m) => ({
        provider: "openai",
        id: m.id ?? "unknown",
        name: String(m.id ?? "unknown"),
        displayName: m.id ?? "unknown",
      }))
      .slice(0, 100);

    const geminiData: { name?: string; displayName?: string }[] = [];
    try {
      const pager = await gemini.models.list();
      for await (const m of pager) {
        geminiData.push(
          m as unknown as { name?: string; displayName?: string },
        );
      }
    } catch (err) {
      const asAny = geminiList as unknown as { models?: unknown[] };
      if (asAny?.models)
        geminiData.push(
          ...(asAny.models as unknown as {
            name?: string;
            displayName?: string;
          }[]),
        );
      console.error(err);
    }
    const geminiModels = geminiData
      .map((m) => ({
        provider: "gemini",
        id: m.name ?? "unknown",
        name: m.name ?? "unknown",
        displayName: m.displayName ?? m.name ?? "unknown",
      }))
      .slice(0, 100);

    return NextResponse.json({ models: [...openaiModels, ...geminiModels] });
  } catch (err) {
    console.error(err);
    const errMessage =
      (err &&
        typeof err === "object" &&
        (err as { message?: string }).message) ||
      String(err);
    return NextResponse.json({ error: errMessage }, { status: 500 });
  }
}
