import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

const MODELS = ["gemini-3.5-flash-lite", "gemini-3.6-flash"] as const;

export async function GET() {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: "GEMINI_API_KEY not set in .env.local" },
        { status: 500 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });

    for (const model of MODELS) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: "Say hello and confirm you are working. Reply in one short sentence.",
        });

        return NextResponse.json({
          success: true,
          response: response.text,
          model,
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("503") || msg.includes("UNAVAILABLE") || msg.includes("404")) {
          continue;
        }
        throw err;
      }
    }

    return NextResponse.json(
      { success: false, error: "All models temporarily unavailable. Try again shortly." },
      { status: 503 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
