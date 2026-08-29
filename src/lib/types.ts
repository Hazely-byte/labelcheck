// ==========================================
// 1. QUICK SCAN TYPES (Unchanged for compatibility)
// ==========================================

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

// ==========================================
// 2. FULL PRODUCT SCAN TYPES (10-Field System)
// ==========================================

export type LegalMetrology10FieldId =
  | "manufacturerAddress"
  | "countryOfOrigin"
  | "commodityName"
  | "netQuantity"
  | "mfgMonthYear"
  | "mrp"
  | "consumerCare"
  | "bestBeforeOrExpiry"
  | "unitSalePrice"
  | "batchNumber";

export type FullScanFieldStatus =
  | "detected"
  | "not_detected"
  | "uncertain"
  | "not_applicable";

export interface FullScanFieldResult {
  fieldId: LegalMetrology10FieldId;
  status: FullScanFieldStatus;
  extractedText: string | null;
  confidenceScore: number;
  applicabilityReason?: string;
  note: string;
  sourcePhotoIndex?: number;
}

export interface ExtractedProductMetadata {
  brandName: string | null;
  commodityName: string | null;
  barcodeNumber: string | null;
  batchNumber: string | null;
}

export interface FullScanSingleImageResult {
  fields: FullScanFieldResult[];
  metadata: ExtractedProductMetadata;
}

export interface ValueConflict {
  fieldId: LegalMetrology10FieldId;
  detectedValues: {
    photoIndex: number;
    value: string;
    confidence: number;
  }[];
  warningMessage: string;
}

export interface FullScanMergedResult {
  fields: FullScanFieldResult[];
  metadata: ExtractedProductMetadata;
  conflicts: ValueConflict[];
  totalPhotosCaptured: number;
  photoDataUrls: string[];
  totalProcessingTimeMs: number;
}

export interface InFlightCapturedPhoto {
  id: string;
  dataUrl: string;
  mimeType: string;
  capturedAt: number;
  promise: Promise<FullScanSingleImageResult>;
  isDeleted: boolean;
  result?: FullScanSingleImageResult;
}

// ==========================================
// 3. PRODUCT DATABASE & DEDUPLICATION TYPES
// ==========================================

export interface Product {
  id: string;
  user_id: string;
  brand_name: string;
  commodity_name: string;
  barcode_number: string | null;
  created_at: string;
}

export interface ProductScan {
  id: string;
  product_id: string;
  user_id: string;
  batch_number: string | null;
  checklist_results: FullScanMergedResult;
  photo_urls: string[];
  response_time_ms: number;
  created_at: string;
}

export interface ProductHierarchyItem {
  brandName: string;
  commodities: {
    commodityName: string;
    products: {
      product: Product;
      scans: ProductScan[];
    }[];
  }[];
}
