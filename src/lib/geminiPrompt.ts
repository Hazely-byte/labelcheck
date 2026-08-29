export const ANALYSIS_PROMPT = `You are an OCR and label-analysis assistant for an informational compliance-flagging tool under India's Legal Metrology (Packaged Commodities) Rules, 2011. You are shown one photo of a retail product label.

TIER 1 — PRIORITY DECLARATIONS (Always evaluate and return all 3 fields):
1. mrp — Maximum Retail Price inclusive of all taxes in ₹ (Rule 6(1)(e))
2. mfgMonthYear — Month & year of manufacture/packing/import (Rule 6(1)(d))
3. bestBeforeOrExpiry — Best before / use by / expiry date (where applicable)

For each of these 3 fields determine:
- "detected": A real, specific value is printed on this label.
- "not_detected": Missing entirely, OR the value is a placeholder/deferral such as "see on side", "see back", "see base", "see cap", "refer other panel", blank, "—", etc. Deferral to another panel counts as not_detected — do NOT mark detected just because the field name is printed. For deferrals, note must explain: "Value deferred to another panel ('[exact text]') — under Rule 9, declarations must appear on this label."
- "uncertain": Text exists but is blurry, cut off, or ambiguous.

TIER 2 — ADDITIONAL FINDINGS (Opportunistic extraction only):
Look for any of these 7 fields if clearly visible:
- netQuantity, batchNumber, commodityName, manufacturerAddress, consumerCare, countryOfOrigin, unitSalePrice
Only include items for fields actually visible in this photo. Do not infer applicability, do not explain absence, and omit fields that are not visible.

Respond strictly in the provided JSON schema.`;

export const GEMINI_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    priorityFields: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: {
            type: "string",
            enum: ["mrp", "mfgMonthYear", "bestBeforeOrExpiry"],
            description: "The priority field identifier",
          },
          status: {
            type: "string",
            enum: ["detected", "not_detected", "uncertain"],
            description: "Compliance status of the priority declaration",
          },
          extractedText: {
            type: "string",
            description: "The text extracted from the label or empty string if not found",
          },
          confidenceScore: {
            type: "integer",
            description: "Confidence score from 0 to 100",
          },
          note: {
            type: "string",
            description: "Short explanation, especially for deferral cases",
          },
        },
        required: ["id", "status", "extractedText", "confidenceScore", "note"],
      },
    },
    additionalFindings: {
      type: "array",
      items: {
        type: "object",
        properties: {
          field: {
            type: "string",
            enum: [
              "netQuantity",
              "batchNumber",
              "commodityName",
              "manufacturerAddress",
              "consumerCare",
              "countryOfOrigin",
              "unitSalePrice",
            ],
            description: "The declaration field name found",
          },
          extractedText: {
            type: "string",
            description: "The extracted value found on the label",
          },
        },
        required: ["field", "extractedText"],
      },
    },
  },
  required: ["priorityFields", "additionalFindings"],
};
