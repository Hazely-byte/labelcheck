import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";
import { ANALYSIS_PROMPT, GEMINI_RESPONSE_SCHEMA } from "@/lib/geminiPrompt";
import type {
  AnalysisResult,
  AnalysisResponse,
  PriorityFieldId,
  PriorityFieldStatus,
  PriorityFieldResult,
  AdditionalFieldId,
  AdditionalFinding,
} from "@/lib/types";

// Primary: ultra-fast low-latency Flash-Lite tier. Fallback: standard Flash tier.
const MODELS = ["gemini-3.5-flash-lite", "gemini-3.6-flash"] as const;

export async function POST(request: NextRequest) {
  const reqStartTime = Date.now();
  console.log("\n--- [/api/analyze execution start] ---");

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY not configured in .env.local" },
        { status: 500 }
      );
    }

    const t0 = Date.now();
    const body = await request.json();
    const tParseReq = Date.now() - t0;

    const { imageBase64, mimeType } = body as {
      imageBase64: string;
      mimeType: string;
    };

    const imageSizeKb = imageBase64 ? ((imageBase64.length * 0.75) / 1024).toFixed(1) : "0";
    console.log(`[Request Intake] Parsed in ${tParseReq}ms | Image size: ~${imageSizeKb} KB | MIME: ${mimeType}`);

    if (!imageBase64 || !mimeType) {
      return NextResponse.json(
        { error: "imageBase64 and mimeType are required" },
        { status: 400 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });

    let outputText: string | undefined;
    let usedModel: string | undefined;
    let geminiDurationMs = 0;

    for (const model of MODELS) {
      const callStart = Date.now();
      console.log(`[Gemini Call] Requesting model: ${model}...`);
      try {
        const response = await ai.models.generateContent({
          model,
          contents: [
            {
              role: "user",
              parts: [
                { text: ANALYSIS_PROMPT },
                {
                  inlineData: {
                    mimeType: mimeType,
                    data: imageBase64,
                  },
                },
              ],
            },
          ],
          config: {
            responseMimeType: "application/json",
            responseSchema: GEMINI_RESPONSE_SCHEMA,
            maxOutputTokens: 600,
          },
        });

        const callDuration = Date.now() - callStart;
        geminiDurationMs += callDuration;
        outputText = response.text;
        usedModel = model;
        console.log(`[Gemini Call SUCCESS] ${model} responded in ${callDuration}ms`);
        break; // Stop immediately after the first successful call
      } catch (err: unknown) {
        const callDuration = Date.now() - callStart;
        geminiDurationMs += callDuration;
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[Gemini Call FAILED] ${model} failed after ${callDuration}ms: ${msg.substring(0, 120)}`);

        if (msg.includes("503") || msg.includes("UNAVAILABLE") || msg.includes("404") || msg.includes("NOT_FOUND")) {
          console.warn(`Attempting fallback model...`);
          continue;
        }
        throw err;
      }
    }

    if (!outputText) {
      return NextResponse.json(
        { error: "AI service temporarily unavailable. Please try again shortly." },
        { status: 503 }
      );
    }

    const tParseStart = Date.now();
    let rawParsed: Record<string, unknown> = {};
    try {
      rawParsed = JSON.parse(outputText);
    } catch {
      console.error("Failed to parse JSON output from Gemini:", outputText);
      return NextResponse.json(
        { error: "Model returned invalid JSON format. Please retry." },
        { status: 500 }
      );
    }

    // Defensive normalization for Priority Fields (always guarantees all 3 fields)
    const rawPriority =
      (rawParsed.priorityFields as unknown[]) ||
      (rawParsed.priority_fields as unknown[]) ||
      (rawParsed.priority as unknown[]) ||
      [];

    const validPriorityIds: PriorityFieldId[] = ["mrp", "mfgMonthYear", "bestBeforeOrExpiry"];
    const priorityFields: PriorityFieldResult[] = validPriorityIds.map((id) => {
      const found = Array.isArray(rawPriority)
        ? (rawPriority.find(
            (f: unknown) =>
              f &&
              typeof f === "object" &&
              ("id" in f ? f.id === id : "field" in f ? f.field === id : "fieldId" in f ? f.fieldId === id : false)
          ) as Record<string, unknown> | undefined)
        : undefined;

      if (found) {
        const statusVal = String(found.status || "");
        const status: PriorityFieldStatus = (
          ["detected", "not_detected", "uncertain"].includes(statusVal)
            ? statusVal
            : "uncertain"
        ) as PriorityFieldStatus;

        return {
          id,
          status,
          extractedText: typeof found.extractedText === "string" ? found.extractedText : null,
          confidenceScore:
            typeof found.confidenceScore === "number"
              ? Math.min(100, Math.max(0, Math.round(found.confidenceScore)))
              : 85,
          note: typeof found.note === "string" ? found.note : "",
        };
      }

      return {
        id,
        status: "not_detected",
        extractedText: null,
        confidenceScore: 0,
        note: "Not detected on label",
      };
    });

    // Defensive normalization for Additional Findings
    const rawAdditional =
      (rawParsed.additionalFindings as unknown[]) ||
      (rawParsed.additional_findings as unknown[]) ||
      (rawParsed.additional as unknown[]) ||
      [];

    const validAdditionalIds: AdditionalFieldId[] = [
      "netQuantity",
      "batchNumber",
      "commodityName",
      "manufacturerAddress",
      "consumerCare",
      "countryOfOrigin",
      "unitSalePrice",
    ];

    const additionalFindings: AdditionalFinding[] = Array.isArray(rawAdditional)
      ? rawAdditional
          .map((item: unknown) => {
            if (!item || typeof item !== "object") return null;
            const obj = item as Record<string, unknown>;
            const fieldKey = String(obj.field || obj.id || "");
            if (!validAdditionalIds.includes(fieldKey as AdditionalFieldId)) return null;
            const text = String(obj.extractedText ?? obj.text ?? "").trim();
            if (!text) return null;
            return {
              field: fieldKey as AdditionalFieldId,
              extractedText: text,
            };
          })
          .filter((item): item is AdditionalFinding => item !== null)
      : [];

    const result: AnalysisResult = {
      priorityFields,
      additionalFindings,
    };

    const tParseDuration = Date.now() - tParseStart;
    const totalServerDuration = Date.now() - reqStartTime;
    console.log(
      `[Total Latency] End-to-end: ${totalServerDuration}ms (Model ${usedModel}: ${geminiDurationMs}ms, Normalize: ${tParseDuration}ms)`
    );
    console.log("--- [/api/analyze execution complete] ---\n");

    const apiResponse: AnalysisResponse = {
      result,
      responseTimeMs: totalServerDuration,
    };

    return NextResponse.json(apiResponse);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Analyze API error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
