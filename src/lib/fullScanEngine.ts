import imageCompression from "browser-image-compression";
import type {
  LegalMetrology10FieldId,
  FullScanFieldResult,
  FullScanSingleImageResult,
  FullScanMergedResult,
  InFlightCapturedPhoto,
  ValueConflict,
  ExtractedProductMetadata,
} from "./types";

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

/**
 * Compresses photo and immediately starts background Gemini analysis.
 */
export async function startBackgroundPhotoAnalysis(
  dataUrl: string,
  photoIndex: number,
  id: string
): Promise<InFlightCapturedPhoto> {
  // Convert Data URL to Blob for client-side web worker compression
  const res = await fetch(dataUrl);
  const blob = await res.blob();

  // Compression options (Max 1024px, 0.75 quality)
  const options = {
    maxWidthOrHeight: 1024,
    useWebWorker: true,
    fileType: "image/jpeg" as const,
    initialQuality: 0.75,
  };

  const compressedBlob = await imageCompression(blob as File, options);

  // Convert compressed blob back to base64 for API transmission
  const compressedBase64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const base64Data = result.split(",")[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(compressedBlob);
  });

  const mimeType = "image/jpeg";

  // Dispatch background API call in parallel
  const promise: Promise<FullScanSingleImageResult> = (async () => {
    const apiRes = await fetch("/api/analyze-full", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        imageBase64: compressedBase64,
        mimeType,
        photoIndex,
      }),
    });

    if (!apiRes.ok) {
      const errJson = await apiRes.json().catch(() => ({}));
      throw new Error(errJson.error || "Background photo analysis failed");
    }

    const data: FullScanSingleImageResult = await apiRes.json();
    return data;
  })();

  const inFlightItem: InFlightCapturedPhoto = {
    id,
    dataUrl,
    mimeType,
    capturedAt: Date.now(),
    promise,
    isDeleted: false,
  };

  // Cache result when promise settles
  promise
    .then((result) => {
      inFlightItem.result = result;
    })
    .catch((err) => {
      console.warn(`[Background Photo ${photoIndex}] failed:`, err);
    });

  return inFlightItem;
}

/**
 * Awaits in-flight background calls and merges results across all captured angles.
 */
export async function consolidateAndMergeFullScanResults(
  capturedPhotos: InFlightCapturedPhoto[],
  totalProcessingTimeMs: number
): Promise<FullScanMergedResult> {
  // Filter only non-deleted photos
  const activePhotos = capturedPhotos.filter((p) => !p.isDeleted);

  if (activePhotos.length === 0) {
    throw new Error("No photos available for analysis.");
  }

  // Wait for all in-flight promises to settle
  const settled = await Promise.allSettled(activePhotos.map((p) => p.promise));

  const validResults: { result: FullScanSingleImageResult; photoIndex: number; dataUrl: string }[] = [];

  settled.forEach((outcome, idx) => {
    if (outcome.status === "fulfilled" && outcome.value) {
      validResults.push({
        result: outcome.value,
        photoIndex: idx + 1,
        dataUrl: activePhotos[idx].dataUrl,
      });
    }
  });

  if (validResults.length === 0) {
    throw new Error("Unable to analyze product label from the provided photos. Please try again.");
  }

  // 1. Merge 10 Legal Metrology Fields
  const mergedFields: FullScanFieldResult[] = [];
  const conflicts: ValueConflict[] = [];

  for (const fieldId of ALL_10_FIELDS) {
    // Gather all evaluations for this field
    const fieldEvaluations: {
      eval: FullScanFieldResult;
      photoIndex: number;
    }[] = [];

    for (const { result, photoIndex } of validResults) {
      const found = result.fields.find((f) => f.fieldId === fieldId);
      if (found) {
        fieldEvaluations.push({ eval: found, photoIndex });
      }
    }

    const detectedEvals = fieldEvaluations.filter((item) => item.eval.status === "detected");

    if (detectedEvals.length > 0) {
      // Check for value conflicts across photos
      const normalizedValues = detectedEvals.map((item) => ({
        photoIndex: item.photoIndex,
        rawText: item.eval.extractedText || "",
        normalized: (item.eval.extractedText || "")
          .toLowerCase()
          .replace(/[₹\s,./-]/g, ""),
        confidence: item.eval.confidenceScore,
      }));

      const uniqueNorms = Array.from(new Set(normalizedValues.map((v) => v.normalized))).filter(
        (v) => v.length > 0
      );

      // If conflicting distinct values exist
      if (uniqueNorms.length > 1) {
        conflicts.push({
          fieldId,
          detectedValues: detectedEvals.map((e) => ({
            photoIndex: e.photoIndex,
            value: e.eval.extractedText || "",
            confidence: e.eval.confidenceScore,
          })),
          warningMessage: `Conflicting values detected across photos for ${fieldId}. Please inspect label closely.`,
        });
      }

      // Pick the detection with the highest confidence score
      detectedEvals.sort((a, b) => b.eval.confidenceScore - a.eval.confidenceScore);
      const topPick = detectedEvals[0];

      mergedFields.push({
        ...topPick.eval,
        sourcePhotoIndex: topPick.photoIndex,
      });
    } else {
      // Check for uncertain, not_applicable, or not_detected
      const uncertain = fieldEvaluations.find((item) => item.eval.status === "uncertain");
      const notApplicable = fieldEvaluations.find((item) => item.eval.status === "not_applicable");
      const notDetected = fieldEvaluations.find((item) => item.eval.status === "not_detected");

      if (uncertain) {
        mergedFields.push({ ...uncertain.eval, sourcePhotoIndex: uncertain.photoIndex });
      } else if (notApplicable) {
        mergedFields.push({ ...notApplicable.eval, sourcePhotoIndex: notApplicable.photoIndex });
      } else if (notDetected) {
        mergedFields.push({ ...notDetected.eval, sourcePhotoIndex: notDetected.photoIndex });
      } else {
        mergedFields.push({
          fieldId,
          status: "not_detected",
          extractedText: null,
          confidenceScore: 0,
          note: "Not detected on any captured angle.",
        });
      }
    }
  }

  // 2. Merge Metadata (Brand, Commodity, Barcode, Batch)
  const allBrands = validResults
    .map((r) => r.result.metadata.brandName)
    .filter((b): b is string => typeof b === "string" && b.length > 0);

  const allCommodities = validResults
    .map((r) => r.result.metadata.commodityName)
    .filter((c): c is string => typeof c === "string" && c.length > 0);

  const allBarcodes = validResults
    .map((r) => r.result.metadata.barcodeNumber)
    .filter((bc): bc is string => typeof bc === "string" && bc.length >= 8);

  const allBatches = validResults
    .map((r) => r.result.metadata.batchNumber)
    .filter((bt): bt is string => typeof bt === "string" && bt.length > 0);

  // Pick highest frequency or longest string
  const brandName = allBrands.length > 0 ? allBrands.sort((a, b) => b.length - a.length)[0] : null;
  const commodityName =
    allCommodities.length > 0 ? allCommodities.sort((a, b) => b.length - a.length)[0] : null;
  const barcodeNumber = allBarcodes.length > 0 ? allBarcodes[0] : null;
  const batchNumber = allBatches.length > 0 ? allBatches[0] : null;

  const metadata: ExtractedProductMetadata = {
    brandName,
    commodityName,
    barcodeNumber,
    batchNumber,
  };

  return {
    fields: mergedFields,
    metadata,
    conflicts,
    totalPhotosCaptured: activePhotos.length,
    photoDataUrls: activePhotos.map((p) => p.dataUrl),
    totalProcessingTimeMs,
  };
}
