import { createClient } from "./supabaseClient";
import type {
  Product,
  ProductScan,
  FullScanMergedResult,
  ProductHierarchyItem,
} from "./types";

export interface DeduplicationDecisionResult {
  status: "saved" | "requires_choice" | "batch_already_inspected";
  product?: Product;
  productScan?: ProductScan;
  ambiguousCandidate?: Product;
  existingScan?: ProductScan;
  message: string;
}

export interface LocalCacheStatus {
  hasLocalData: boolean;
  productCount: number;
  scanCount: number;
  keysFound: string[];
}

export interface SyncResult {
  success: boolean;
  syncedProducts: number;
  syncedScans: number;
  errorMessage?: string;
}

const LOCAL_PRODUCTS_PREFIX = "labelcheck_local_products";
const LOCAL_SCANS_PREFIX = "labelcheck_local_product_scans";

/**
 * Scans localStorage for any cached products or scans on this device.
 */
export function detectLocalCachedData(userId?: string): LocalCacheStatus {
  if (typeof window === "undefined") {
    return { hasLocalData: false, productCount: 0, scanCount: 0, keysFound: [] };
  }

  const keysFound: string[] = [];
  let productCount = 0;
  let scanCount = 0;

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;

      if (key.startsWith(LOCAL_PRODUCTS_PREFIX) || (userId && key === `${LOCAL_PRODUCTS_PREFIX}_${userId}`)) {
        keysFound.push(key);
        try {
          const prods = JSON.parse(localStorage.getItem(key) || "[]");
          if (Array.isArray(prods)) productCount += prods.length;
        } catch {
          // ignore corrupted JSON
        }
      }

      if (key.startsWith(LOCAL_SCANS_PREFIX) || (userId && key === `${LOCAL_SCANS_PREFIX}_${userId}`)) {
        keysFound.push(key);
        try {
          const scans = JSON.parse(localStorage.getItem(key) || "[]");
          if (Array.isArray(scans)) scanCount += scans.length;
        } catch {
          // ignore corrupted JSON
        }
      }
    }
  } catch (err) {
    console.warn("Error scanning localStorage:", err);
  }

  return {
    hasLocalData: productCount > 0 || scanCount > 0,
    productCount,
    scanCount,
    keysFound: Array.from(new Set(keysFound)),
  };
}

/**
 * Migrates all locally cached products and scans on this device into Supabase.
 * Only deletes local keys after confirming Supabase writes succeeded.
 */
export async function syncLocalDataToCloud(userId: string): Promise<SyncResult> {
  if (typeof window === "undefined") {
    return { success: true, syncedProducts: 0, syncedScans: 0 };
  }

  const supabase = createClient();
  const allLocalProducts: Product[] = [];
  const allLocalScans: ProductScan[] = [];
  const keysToClean: string[] = [];

  try {
    // 1. Gather all local items from all matching keys
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;

      if (key.startsWith(LOCAL_PRODUCTS_PREFIX)) {
        keysToClean.push(key);
        try {
          const items: Product[] = JSON.parse(localStorage.getItem(key) || "[]");
          if (Array.isArray(items)) {
            for (const item of items) {
              if (!allLocalProducts.some((p) => p.id === item.id)) {
                allLocalProducts.push(item);
              }
            }
          }
        } catch (e) {
          console.warn(`Failed to parse ${key}:`, e);
        }
      }

      if (key.startsWith(LOCAL_SCANS_PREFIX)) {
        keysToClean.push(key);
        try {
          const items: ProductScan[] = JSON.parse(localStorage.getItem(key) || "[]");
          if (Array.isArray(items)) {
            for (const item of items) {
              if (!allLocalScans.some((s) => s.id === item.id)) {
                allLocalScans.push(item);
              }
            }
          }
        } catch (e) {
          console.warn(`Failed to parse ${key}:`, e);
        }
      }
    }

    if (allLocalProducts.length === 0 && allLocalScans.length === 0) {
      return { success: true, syncedProducts: 0, syncedScans: 0 };
    }

    console.log(
      `[Cloud Migration] Found ${allLocalProducts.length} products and ${allLocalScans.length} scans to sync...`
    );

    // 2. Fetch existing products from Supabase to avoid duplicates
    const { data: existingProds, error: pQueryErr } = await supabase
      .from("products")
      .select("id, brand_name, commodity_name, barcode_number")
      .eq("user_id", userId);

    if (pQueryErr) {
      console.error("[Cloud Migration Error] Could not query products table:", pQueryErr.message);
      return {
        success: false,
        syncedProducts: 0,
        syncedScans: 0,
        errorMessage: pQueryErr.message,
      };
    }

    const existingList = existingProds || [];
    let syncedProducts = 0;
    let syncedScans = 0;

    // 3. Insert local products into Supabase
    for (const prod of allLocalProducts) {
      const alreadyInCloud = existingList.some(
        (p) =>
          p.id === prod.id ||
          (p.brand_name.toLowerCase().trim() === prod.brand_name.toLowerCase().trim() &&
            p.commodity_name.toLowerCase().trim() === prod.commodity_name.toLowerCase().trim() &&
            p.barcode_number === prod.barcode_number)
      );

      if (!alreadyInCloud) {
        const { error: insertErr } = await supabase.from("products").insert({
          id: prod.id,
          user_id: userId,
          brand_name: prod.brand_name,
          commodity_name: prod.commodity_name,
          barcode_number: prod.barcode_number,
        });

        if (insertErr) {
          console.error(`[Cloud Migration] Failed to insert product "${prod.brand_name}":`, insertErr.message);
          // If failure, stop to prevent partial orphan state
          return {
            success: false,
            syncedProducts,
            syncedScans,
            errorMessage: `Failed inserting product ${prod.brand_name}: ${insertErr.message}`,
          };
        }
        syncedProducts++;
      }
    }

    // 4. Insert local scans into Supabase
    for (const scan of allLocalScans) {
      const { data: scanExists } = await supabase
        .from("product_scans")
        .select("id")
        .eq("id", scan.id)
        .maybeSingle();

      if (!scanExists) {
        const { error: scanInsertErr } = await supabase.from("product_scans").insert({
          id: scan.id,
          product_id: scan.product_id,
          user_id: userId,
          batch_number: scan.batch_number,
          checklist_results: scan.checklist_results,
          photo_urls: scan.photo_urls || [],
          response_time_ms: scan.response_time_ms || 0,
        });

        if (scanInsertErr) {
          console.error(`[Cloud Migration] Failed to insert scan ${scan.id}:`, scanInsertErr.message);
          return {
            success: false,
            syncedProducts,
            syncedScans,
            errorMessage: `Failed inserting scan: ${scanInsertErr.message}`,
          };
        }
        syncedScans++;
      }
    }

    // 5. Verify data actually exists in Supabase before clearing localStorage
    const { data: verifyProds } = await supabase
      .from("products")
      .select("id")
      .eq("user_id", userId);

    if (verifyProds && verifyProds.length > 0) {
      // Safely delete only the migration keys that succeeded
      for (const key of keysToClean) {
        localStorage.removeItem(key);
      }
      console.log(`[Cloud Migration] Success! Synced ${syncedProducts} new products, ${syncedScans} new scans. Local keys removed.`);
      return {
        success: true,
        syncedProducts,
        syncedScans,
      };
    } else {
      return {
        success: false,
        syncedProducts,
        syncedScans,
        errorMessage: "Verification query returned 0 products in Supabase. Local cache retained.",
      };
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Cloud Migration Exception]:", msg);
    return {
      success: false,
      syncedProducts: 0,
      syncedScans: 0,
      errorMessage: msg,
    };
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
    forceBatchSave?: boolean;
  }
): Promise<DeduplicationDecisionResult> {
  const supabase = createClient();

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

  // 2. CHECK FOR SAME-BATCH RE-SCANS (if batch number is present and save was not explicitly forced)
  if (batchNumber && targetProduct && !options?.forceBatchSave) {
    const { data: existingScans, error: scanQueryErr } = await supabase
      .from("product_scans")
      .select("*")
      .eq("product_id", targetProduct.id)
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (!scanQueryErr && existingScans && existingScans.length > 0) {
      const cleanBatch = batchNumber.trim().toLowerCase();
      const matchedDuplicate = existingScans.find(
        (s) => s.batch_number && s.batch_number.trim().toLowerCase() === cleanBatch
      );

      if (matchedDuplicate) {
        return {
          status: "batch_already_inspected",
          product: targetProduct,
          existingScan: matchedDuplicate as ProductScan,
          message: `This exact batch (#${batchNumber}) was already inspected on ${matchedDuplicate.created_at}.`,
        };
      }
    }
  }

  // 3. Generate Scan ID and upload photos to Supabase Storage
  const scanTempId = crypto.randomUUID();
  const photoUrls = await uploadScanPhotosToStorage(
    userId,
    scanTempId,
    mergedResult.photoDataUrls
  );

  // 4. Insert Product Scan record directly into Supabase
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
