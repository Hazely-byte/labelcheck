import { createClient } from "./supabaseClient";
import type {
  Product,
  ProductScan,
  FullScanMergedResult,
  ProductHierarchyItem,
} from "./types";

export interface DeduplicationDecisionResult {
  status: "saved" | "requires_choice";
  product?: Product;
  productScan?: ProductScan;
  ambiguousCandidate?: Product;
  message: string;
}

/**
 * Uploads photos to the secure per-user product-photos storage bucket.
 */
export async function uploadScanPhotosToStorage(
  userId: string,
  scanId: string,
  photoDataUrls: string[]
): Promise<string[]> {
  const supabase = createClient();
  const uploadedUrls: string[] = [];

  for (let i = 0; i < photoDataUrls.length; i++) {
    const dataUrl = photoDataUrls[i];
    try {
      // Convert Data URL to Blob
      const res = await fetch(dataUrl);
      const blob = await res.blob();

      // Secure path: {user_id}/{scan_id}/{index}.jpg
      const filePath = `${userId}/${scanId}/photo_${i + 1}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from("product-photos")
        .upload(filePath, blob, {
          contentType: "image/jpeg",
          upsert: true,
        });

      if (uploadError) {
        console.warn(`Storage upload warning for photo ${i + 1}:`, uploadError.message);
        // If storage bucket doesn't exist yet or is offline, store path reference
        uploadedUrls.push(filePath);
      } else {
        // Retrieve signed URL for private bucket (valid 1 year)
        const { data: signedData } = await supabase.storage
          .from("product-photos")
          .createSignedUrl(filePath, 60 * 60 * 24 * 365);

        uploadedUrls.push(signedData?.signedUrl || filePath);
      }
    } catch (e) {
      console.warn(`Exception uploading photo ${i + 1}:`, e);
      uploadedUrls.push(`local_photo_${i + 1}.jpg`);
    }
  }

  return uploadedUrls;
}

/**
 * Handles product deduplication and saves product_scans timeline event.
 */
export async function saveProductScanWithDeduplication(
  userId: string,
  mergedResult: FullScanMergedResult,
  options?: {
    forcedChoice?: "link_existing" | "create_new";
    targetProductId?: string;
  }
): Promise<DeduplicationDecisionResult> {
  const supabase = createClient();
  const rawBrand = (mergedResult.metadata.brandName || "Unknown Brand").trim();
  const rawCommodity = (mergedResult.metadata.commodityName || "Packaged Commodity").trim();
  const barcode = mergedResult.metadata.barcodeNumber ? mergedResult.metadata.barcodeNumber.trim() : null;
  const batchNumber = mergedResult.metadata.batchNumber ? mergedResult.metadata.batchNumber.trim() : null;

  // 1. Query existing products for this user
  const { data: existingProducts, error: prodQueryErr } = await supabase
    .from("products")
    .select("*")
    .eq("user_id", userId);

  if (prodQueryErr) {
    console.error("Failed to query products for deduplication:", prodQueryErr.message);
  }

  const productsList = (existingProducts as Product[]) || [];

  // Find matches on Brand & Commodity
  const brandNorm = rawBrand.toLowerCase();
  const commNorm = rawCommodity.toLowerCase();

  const brandMatches = productsList.filter(
    (p) =>
      p.brand_name.toLowerCase().trim() === brandNorm &&
      p.commodity_name.toLowerCase().trim() === commNorm
  );

  let targetProduct: Product | null = null;

  // Manual inspector override selection
  if (options?.forcedChoice === "link_existing" && options.targetProductId) {
    targetProduct = productsList.find((p) => p.id === options.targetProductId) || null;
  } else if (options?.forcedChoice === "create_new") {
    targetProduct = null;
  } else {
    // Deduplication Rule 1: Exact Barcode Match
    if (barcode) {
      const barcodeMatch = productsList.find(
        (p) => p.barcode_number && p.barcode_number.trim() === barcode
      );

      if (barcodeMatch) {
        // Matched existing product barcode
        targetProduct = barcodeMatch;
      }
    } else {
      // Deduplication Rule 2: No Barcode found
      // Check if there is exactly 1 candidate with same brand & commodity and no barcode
      const noBarcodeCandidates = brandMatches.filter((p) => !p.barcode_number);

      if (noBarcodeCandidates.length === 1 && !options?.forcedChoice) {
        // Prompt inspector for decision
        return {
          status: "requires_choice",
          ambiguousCandidate: noBarcodeCandidates[0],
          message: `We found an existing "${noBarcodeCandidates[0].brand_name} ${noBarcodeCandidates[0].commodity_name}" entry without a barcode on file. Is this the same product, or a new variant?`,
        };
      }
    }
  }

  // If no target product found/chosen, create new Product row
  if (!targetProduct) {
    const { data: newProd, error: createProdErr } = await supabase
      .from("products")
      .insert({
        user_id: userId,
        brand_name: rawBrand,
        commodity_name: rawCommodity,
        barcode_number: barcode,
      })
      .select()
      .single();

    if (createProdErr || !newProd) {
      throw new Error(createProdErr?.message || "Failed to create product record.");
    }

    targetProduct = newProd as Product;
  }

  // 2. Generate Scan ID and upload photos to user folder
  const scanTempId = crypto.randomUUID();
  const photoUrls = await uploadScanPhotosToStorage(
    userId,
    scanTempId,
    mergedResult.photoDataUrls
  );

  // 3. Insert Product Scan row
  const { data: scanRecord, error: scanInsertErr } = await supabase
    .from("product_scans")
    .insert({
      id: scanTempId,
      product_id: targetProduct.id,
      user_id: userId,
      batch_number: batchNumber,
      checklist_results: mergedResult,
      photo_urls: photoUrls,
      response_time_ms: mergedResult.totalProcessingTimeMs,
    })
    .select()
    .single();

  if (scanInsertErr) {
    throw new Error(scanInsertErr.message || "Failed to save product scan record.");
  }

  return {
    status: "saved",
    product: targetProduct,
    productScan: scanRecord as ProductScan,
    message: `Scan successfully logged under ${targetProduct.brand_name} — ${targetProduct.commodity_name}`,
  };
}

/**
 * Fetches and aggregates products into a Brand -> Commodity -> Product -> Scans hierarchy.
 */
export async function fetchProductHierarchy(userId: string): Promise<ProductHierarchyItem[]> {
  const supabase = createClient();

  // Fetch all products
  const { data: products, error: pErr } = await supabase
    .from("products")
    .select("*")
    .eq("user_id", userId)
    .order("brand_name", { ascending: true });

  if (pErr) throw pErr;

  // Fetch all scans
  const { data: scans, error: sErr } = await supabase
    .from("product_scans")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (sErr) throw sErr;

  const prods = (products as Product[]) || [];
  const scs = (scans as ProductScan[]) || [];

  // Group by Brand -> Commodity
  const brandMap = new Map<string, Map<string, { product: Product; scans: ProductScan[] }[]>>();

  for (const prod of prods) {
    const bName = prod.brand_name || "Unbranded";
    const cName = prod.commodity_name || "General Commodity";

    if (!brandMap.has(bName)) {
      brandMap.set(bName, new Map());
    }

    const commMap = brandMap.get(bName)!;
    if (!commMap.has(cName)) {
      commMap.set(cName, []);
    }

    const prodScans = scs.filter((s) => s.product_id === prod.id);
    commMap.get(cName)!.push({ product: prod, scans: prodScans });
  }

  const hierarchy: ProductHierarchyItem[] = [];

  for (const [brandName, commMap] of brandMap.entries()) {
    const commodities: ProductHierarchyItem["commodities"] = [];

    for (const [commodityName, prodList] of commMap.entries()) {
      commodities.push({
        commodityName,
        products: prodList,
      });
    }

    hierarchy.push({
      brandName,
      commodities,
    });
  }

  return hierarchy;
}
