import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";
import type {
  LegalMetrology10FieldId,
  FullScanFieldStatus,
  FullScanFieldResult,
  ExtractedProductMetadata,
  FullScanSingleImageResult,
} from "@/lib/types";

const MODELS = ["gemini-2.5-flash", "gemini-3.5-flash-lite", "gemini-3.6-flash"] as const;

const FULL_ANALYSIS_PROMPT = `You are a Senior Legal Metrology Inspector & OCR specialist analyzing a photo of an Indian packaged retail product under India's Legal Metrology (Packaged Commodities) Rules, 2011.

Evaluate this image across all 10 mandatory declarations:
1. manufacturerAddress — Name & complete address of manufacturer/packer/importer (Rule 6(1)(a))
2. countryOfOrigin — Country of origin (Rule 6(1)(a) — required if imported; NOT APPLICABLE if clearly manufactured in India)
3. commodityName — Generic/common name of commodity (Rule 6(1)(b))
4. netQuantity — Net quantity in standard SI units g/kg/ml/l/units (Rule 6(1)(c))
5. mfgMonthYear — Month & year of manufacture/packing/import (Rule 6(1)(d))
6. mrp — Maximum Retail Price inclusive of all taxes in ₹ (Rule 6(1)(e))
7. consumerCare — Consumer grievance care name/address/phone/email (Rule 6(2))
8. bestBeforeOrExpiry — Best before / use by / expiry date (Conditional — required for food/cosmetics/perishables; NOT APPLICABLE for durable non-food hardware/apparel)
9. unitSalePrice — Unit sale price per g/ml (Rule 6(1)(s) — NOT APPLICABLE for multi-piece assortments or free promotional items)
10. batchNumber — Batch/lot identification number (Rule 6(1)(p))

STATUS RULES:
- "detected": A specific, real, meaningful value is clearly visible for this declaration.
- "not_detected": Missing from this angle, OR the field contains a placeholder/deferral like "see on side", "see back", "see base", "refer lid", "—", blank space. Under Rule 9, deferral to another panel counts as not_detected! Explain in note.
- "uncertain": Text is blurry, obscured, partially cut off, or ambiguous.
- "not_applicable": The field is genuinely not legally required for this commodity type (e.g. countryOfOrigin for domestic goods, expiry for non-perishable hardware).

METADATA EXTRACTION:
Also extract:
- brandName: The primary brand/manufacturer name (or empty string)
- commodityName: The product's generic commodity title (or empty string)
- barcodeNumber: Digits of any printed barcode / EAN-13 / UPC / DataMatrix (or empty string)
- batchNumber: The batch / lot code (or empty string)

Respond strictly in the provided JSON schema.`;

const FULL_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    fields: {
      type: "array",
      items: {
        type: "object",
        properties: {
          fieldId: {
            type: "string",
            enum: [
              "manufacturerAddress",
              "countryOfOrigin",
              "commodityName",
              "netQuantity",
              "mfgMonthYear",
              "mrp",
              "consumerCare",
              "bestBeforeOrExpiry",
              "unitSalePrice",
              "batchNumber",
            ],
          },
          status: {
            type: "string",
            enum: ["detected", "not_detected", "uncertain", "not_applicable"],
          },
          extractedText: {
            type: "string",
            description: "Extracted value or empty string",
          },
          confidenceScore: {
            type: "integer",
            description: "0 to 100",
          },
          applicabilityReason: {
            type: "string",
            description: "Reasoning for status",
          },
          note: {
            type: "string",
            description: "Inspection observation",
          },
        },
        required: ["fieldId", "status", "extractedText", "confidenceScore", "note"],
      },
    },
    metadata: {
      type: "object",
      properties: {
        brandName: { type: "string" },
        commodityName: { type: "string" },
        barcodeNumber: { type: "string" },
        batchNumber: { type: "string" },
      },
      required: ["brandName", "commodityName", "barcodeNumber", "batchNumber"],
    },
  },
  required: ["fields", "metadata"],
};

const ALL_10_FIELDS: LegalMetrology10FieldId[] = [
  "manufacturerAddress",
  "countryOfOrigin",
  "commodityName",
  "netQuantity",
  "mfgMonthYear",
  "mrp",
  "consumerCare",
  "bestBeforeOrExpiry",
  "unitSalePrice",
  "batchNumber",
];

export async function POST(request: NextRequest) {
  const reqStart = Date.now();

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY not configured in .env.local" },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { imageBase64, mimeType, photoIndex } = body as {
      imageBase64: string;
      mimeType: string;
      photoIndex?: number;
    };

    if (!imageBase64 || !mimeType) {
      return NextResponse.json(
        { error: "imageBase64 and mimeType are required" },
        { status: 400 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });
    let outputText: string | undefined;
    let usedModel: string | undefined;

    for (const model of MODELS) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: [
            {
              role: "user",
              parts: [
                { text: FULL_ANALYSIS_PROMPT },
                {
                  inlineData: {
                    mimeType,
                    data: imageBase64,
                  },
                },
              ],
            },
          ],
          config: {
            responseMimeType: "application/json",
            responseSchema: FULL_RESPONSE_SCHEMA,
            maxOutputTokens: 1200,
          },
        });

        outputText = response.text;
        usedModel = model;
        break;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[Full Scan Model Attempt] ${model} failed: ${msg.substring(0, 100)}`);
        if (msg.includes("503") || msg.includes("UNAVAILABLE") || msg.includes("404") || msg.includes("NOT_FOUND")) {
          continue;
        }
        throw err;
      }
    }

    if (!outputText) {
      return NextResponse.json(
        { error: "AI service temporarily unavailable for Full Scan." },
        { status: 503 }
      );
    }

    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(outputText);
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON returned by AI model." },
        { status: 500 }
      );
    }

    // Defensive normalization of 10 fields
    const rawFields = Array.isArray(parsed.fields) ? (parsed.fields as Record<string, unknown>[]) : [];
    const fields: FullScanFieldResult[] = ALL_10_FIELDS.map((id) => {
      const found = rawFields.find(
        (f) => f && (f.fieldId === id || f.id === id || f.field === id)
      );

      if (found) {
        const statusStr = String(found.status || "");
        const status: FullScanFieldStatus = [
          "detected",
          "not_detected",
          "uncertain",
          "not_applicable",
        ].includes(statusStr)
          ? (statusStr as FullScanFieldStatus)
          : "not_detected";

        return {
          fieldId: id,
          status,
          extractedText:
            typeof found.extractedText === "string" && found.extractedText.trim().length > 0
              ? found.extractedText.trim()
              : null,
          confidenceScore:
            typeof found.confidenceScore === "number"
              ? Math.min(100, Math.max(0, Math.round(found.confidenceScore)))
              : status === "detected"
              ? 85
              : 0,
          applicabilityReason:
            typeof found.applicabilityReason === "string" ? found.applicabilityReason : undefined,
          note: typeof found.note === "string" ? found.note : "",
          sourcePhotoIndex: photoIndex ?? 0,
        };
      }

      return {
        fieldId: id,
        status: "not_detected",
        extractedText: null,
        confidenceScore: 0,
        note: "Not visible from this angle",
        sourcePhotoIndex: photoIndex ?? 0,
      };
    });

    const rawMeta = (parsed.metadata && typeof parsed.metadata === "object")
      ? (parsed.metadata as Record<string, unknown>)
      : {};

    const cleanStr = (val: unknown) =>
      typeof val === "string" && val.trim().length > 0 && val.trim().toLowerCase() !== "null"
        ? val.trim()
        : null;

    const metadata: ExtractedProductMetadata = {
      brandName: cleanStr(rawMeta.brandName),
      commodityName: cleanStr(rawMeta.commodityName),
      barcodeNumber: cleanStr(rawMeta.barcodeNumber)?.replace(/[^0-9]/g, "") || null,
      batchNumber: cleanStr(rawMeta.batchNumber),
    };

    const result: FullScanSingleImageResult = {
      fields,
      metadata,
    };

    console.log(
      `[Full Scan Background Photo ${photoIndex ?? 0}] Analyzed in ${Date.now() - reqStart}ms via ${usedModel}`
    );

    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Full Scan API error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
