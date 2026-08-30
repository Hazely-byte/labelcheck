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

const LOCAL_PRODUCTS_KEY = "labelcheck_local_products";
const LOCAL_SCANS_KEY = "labelcheck_local_product_scans";

/**
 * One-time migration helper: syncs any previously cached local scans into Supabase.
 */
async function syncLocalCacheToSupabase(userId: string) {
  if (typeof window === "undefined") return;

  try {
    const rawProds = localStorage.getItem(`${LOCAL_PRODUCTS_KEY}_${userId}`);
    const rawScans = localStorage.getItem(`${LOCAL_SCANS_KEY}_${userId}`);

    if (!rawProds && !rawScans) return;

    const localProds: Product[] = rawProds ? JSON.parse(rawProds) : [];
    const localScans: ProductScan[] = rawScans ? JSON.parse(rawScans) : [];

    if (localProds.length === 0 && localScans.length === 0) return;

    const supabase = createClient();

    // Verify if products table is active in Supabase
    const { error: testErr } = await supabase.from("products").select("id").limit(1);
    if (testErr) {
      // Table doesn't exist yet, defer sync
      return;
    }

    console.log(`[Cloud Sync] Migrating ${localProds.length} products and ${localScans.length} scans to Supabase...`);

    // Sync products
    for (const prod of localProds) {
      await supabase.from("products").upsert({
        id: prod.id,
        user_id: userId,
        brand_name: prod.brand_name,
        commodity_name: prod.commodity_name,
        barcode_number: prod.barcode_number,
      });
    }

    // Sync scans
    for (const scan of localScans) {
      await supabase.from("product_scans").upsert({
        id: scan.id,
        product_id: scan.product_id,
        user_id: userId,
        batch_number: scan.batch_number,
        checklist_results: scan.checklist_results,
        photo_urls: scan.photo_urls,
        response_time_ms: scan.response_time_ms,
      });
    }

    // Clean up local storage after successful cloud sync
    localStorage.removeItem(`${LOCAL_PRODUCTS_KEY}_${userId}`);
    localStorage.removeItem(`${LOCAL_SCANS_KEY}_${userId}`);
    console.log("[Cloud Sync] Local cache successfully migrated to Supabase.");
  } catch (err) {
    console.warn("[Cloud Sync] Deferred sync attempt:", err);
  }
}

/**
 * Uploads photos to the secure per-user product-photos storage bucket in Supabase.
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
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const filePath = `${userId}/${scanId}/photo_${i + 1}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from("product-photos")
        .upload(filePath, blob, {
          contentType: "image/jpeg",
          upsert: true,
        });

      if (uploadError) {
        console.warn(`[Storage Notice] Photo ${i + 1}: ${uploadError.message}`);
        uploadedUrls.push(dataUrl);
      } else {
        const { data: signedData } = await supabase.storage
          .from("product-photos")
          .createSignedUrl(filePath, 60 * 60 * 24 * 365);

        uploadedUrls.push(signedData?.signedUrl || filePath);
      }
    } catch (e) {
      console.warn(`[Storage Exception] Photo ${i + 1}:`, e);
      uploadedUrls.push(dataUrl);
    }
  }

  return uploadedUrls;
}

/**
 * Handles product deduplication and saves product_scans timeline event directly to Supabase.
 * Exclusively uses the real authenticated Supabase user_id.
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

  // Attempt to sync any previous local scans first
  await syncLocalCacheToSupabase(userId);

  const rawBrand = (mergedResult.metadata.brandName || "Unknown Brand").trim();
  const rawCommodity = (mergedResult.metadata.commodityName || "Packaged Commodity").trim();
  const barcode = mergedResult.metadata.barcodeNumber ? mergedResult.metadata.barcodeNumber.trim() : null;
  const batchNumber = mergedResult.metadata.batchNumber ? mergedResult.metadata.batchNumber.trim() : null;

  // 1. Query existing products for this authenticated user from Supabase
  const { data: existingProducts, error: prodQueryErr } = await supabase
    .from("products")
    .select("*")
    .eq("user_id", userId);

  if (prodQueryErr) {
    console.error(`[Product Deduplication Error] ${prodQueryErr.message} (code: ${prodQueryErr.code})`);
    throw new Error(
      prodQueryErr.code === "PGRST205"
        ? "Database table 'products' does not exist in Supabase. Please run migration 002."
        : prodQueryErr.message
    );
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
        targetProduct = barcodeMatch;
      }
    } else {
      // Deduplication Rule 2: No Barcode found
      const noBarcodeCandidates = brandMatches.filter((p) => !p.barcode_number);

      if (noBarcodeCandidates.length === 1 && !options?.forcedChoice) {
        return {
          status: "requires_choice",
          ambiguousCandidate: noBarcodeCandidates[0],
          message: `We found an existing "${noBarcodeCandidates[0].brand_name} ${noBarcodeCandidates[0].commodity_name}" entry without a barcode on file. Is this the same product, or a new variant?`,
        };
      }
    }
  }

  // If no target product found/chosen, insert new Product row in Supabase
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
      console.error("[Product Insert Error]:", createProdErr?.message);
      throw new Error(createProdErr?.message || "Failed to create product record in database.");
    }

    targetProduct = newProd as Product;
  }

  // 2. Generate Scan ID and upload photos to Supabase Storage
  const scanTempId = crypto.randomUUID();
  const photoUrls = await uploadScanPhotosToStorage(
    userId,
    scanTempId,
    mergedResult.photoDataUrls
  );

  // 3. Insert Product Scan record directly into Supabase
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

  if (scanInsertErr || !scanRecord) {
    console.error("[Scan Insert Error]:", scanInsertErr?.message);
    throw new Error(scanInsertErr?.message || "Failed to save product scan record in database.");
  }

  return {
    status: "saved",
    product: targetProduct,
    productScan: scanRecord as ProductScan,
    message: `Scan successfully logged under ${targetProduct.brand_name} — ${targetProduct.commodity_name}`,
  };
}

/**
 * Fetches and aggregates products into a Brand -> Commodity -> Product -> Scans hierarchy directly from Supabase.
 * Exclusively queries using the real authenticated user ID.
 */
export async function fetchProductHierarchy(userId: string): Promise<ProductHierarchyItem[]> {
  const supabase = createClient();

  // Attempt to sync any local scans first if tables are available
  await syncLocalCacheToSupabase(userId);

  // 1. Fetch all products from Supabase for this user
  const { data: products, error: pErr } = await supabase
    .from("products")
    .select("*")
    .eq("user_id", userId)
    .order("brand_name", { ascending: true });

  if (pErr) {
    console.error("[Product Hierarchy Error]:", pErr.message, "code:", pErr.code);
    throw new Error(
      pErr.code === "PGRST205"
        ? "Database table 'products' does not exist in Supabase. Please run migration 002."
        : pErr.message
    );
  }

  // 2. Fetch all scans from Supabase for this user
  const { data: scans, error: sErr } = await supabase
    .from("product_scans")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (sErr) {
    console.error("[Product Scans Hierarchy Error]:", sErr.message, "code:", sErr.code);
    throw new Error(
      sErr.code === "PGRST205"
        ? "Database table 'product_scans' does not exist in Supabase. Please run migration 002."
        : sErr.message
    );
  }

  const prods = (products as Product[]) || [];
  const scs = (scans as ProductScan[]) || [];

  // Group by Brand -> Commodity
  const brandMap = new Map<string, Map<string, { product: Product; scans: ProductScan[] }[]>>();

  for (const prod of prods) {
    const bName = (prod.brand_name || "Unbranded").trim();
    const cName = (prod.commodity_name || "General Commodity").trim();

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
