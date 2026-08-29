export type PriorityFieldId = "mrp" | "mfgMonthYear" | "bestBeforeOrExpiry";

export type PriorityFieldStatus = "detected" | "not_detected" | "uncertain";

export type AdditionalFieldId =
  | "netQuantity"
  | "batchNumber"
  | "commodityName"
  | "manufacturerAddress"
  | "consumerCare"
  | "countryOfOrigin"
  | "unitSalePrice";

export interface PriorityFieldResult {
  id: PriorityFieldId;
  status: PriorityFieldStatus;
  extractedText: string | null;
  confidenceScore: number;
  note: string;
}

export interface AdditionalFinding {
  field: AdditionalFieldId;
  extractedText: string;
}

export interface AnalysisResult {
  priorityFields: PriorityFieldResult[];
  additionalFindings: AdditionalFinding[];
}

export interface AnalysisResponse {
  result: AnalysisResult;
  responseTimeMs: number;
}

export interface SavedScanRecord {
  id: string;
  user_id: string;
  created_at: string;
  response_time_ms: number;
  priority_fields: PriorityFieldResult[];
  additional_findings: AdditionalFinding[];
}
