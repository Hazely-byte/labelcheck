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
  isCloudSynced?: boolean;
}

const LOCAL_PRODUCTS_KEY = "labelcheck_local_products";
const LOCAL_SCANS_KEY = "labelcheck_local_product_scans";

// ==========================================
// Local Storage Cache Fallback Helpers
// ==========================================

function getLocalProducts(userId: string): Product[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(`${LOCAL_PRODUCTS_KEY}_${userId}`);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.warn("Error reading local products:", e);
    return [];
  }
}

function saveLocalProduct(userId: string, product: Product) {
  if (typeof window === "undefined") return;
  try {
    const current = getLocalProducts(userId);
    const existingIdx = current.findIndex((p) => p.id === product.id);
    if (existingIdx >= 0) {
      current[existingIdx] = product;
    } else {
      current.push(product);
    }
    localStorage.setItem(`${LOCAL_PRODUCTS_KEY}_${userId}`, JSON.stringify(current));
  } catch (e) {
    console.warn("Error saving local product:", e);
  }
}

function getLocalProductScans(userId: string): ProductScan[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(`${LOCAL_SCANS_KEY}_${userId}`);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.warn("Error reading local scans:", e);
    return [];
  }
}

function saveLocalProductScan(userId: string, scan: ProductScan) {
  if (typeof window === "undefined") return;
  try {
    const current = getLocalProductScans(userId);
    const existingIdx = current.findIndex((s) => s.id === scan.id);
    if (existingIdx >= 0) {
      current[existingIdx] = scan;
    } else {
      current.unshift(scan);
    }
    localStorage.setItem(`${LOCAL_SCANS_KEY}_${userId}`, JSON.stringify(current));
  } catch (e) {
    console.warn("Error saving local scan:", e);
  }
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
        console.warn(`[Storage Warning] Photo ${i + 1}: ${uploadError.message}`);
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
 * Handles product deduplication and saves product_scans timeline event with local-first guarantee.
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

  // 1. Fetch products (Supabase first, local fallback)
  let productsList: Product[] = [];
  let isCloudAvailable = true;

  const { data: existingProducts, error: prodQueryErr } = await supabase
    .from("products")
    .select("*")
    .eq("user_id", userId);

  if (prodQueryErr) {
    console.warn(`[Product Deduplication] Supabase query notice: ${prodQueryErr.message} (code: ${prodQueryErr.code})`);
    isCloudAvailable = false;
    productsList = getLocalProducts(userId);
  } else {
    productsList = (existingProducts as Product[]) || [];
  }

  // Merge any locally cached products
  const localOnly = getLocalProducts(userId);
  for (const lp of localOnly) {
    if (!productsList.some((p) => p.id === lp.id)) {
      productsList.push(lp);
    }
  }

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

  // If no target product found/chosen, create new Product
  if (!targetProduct) {
    const newProductId = crypto.randomUUID();
    const newProdPayload: Product = {
      id: newProductId,
      user_id: userId,
      brand_name: rawBrand,
      commodity_name: rawCommodity,
      barcode_number: barcode,
      created_at: new Date().toISOString(),
    };

    if (isCloudAvailable) {
      try {
        const { data: newProd, error: createProdErr } = await supabase
          .from("products")
          .insert({
            id: newProductId,
            user_id: userId,
            brand_name: rawBrand,
            commodity_name: rawCommodity,
            barcode_number: barcode,
          })
          .select()
          .single();

        if (createProdErr || !newProd) {
          console.warn("[Product Insert Warning] Supabase error:", createProdErr?.message);
        } else {
          newProdPayload.id = newProd.id;
        }
      } catch (e) {
        console.warn("[Product Insert Exception]:", e);
      }
    }

    // Save locally
    saveLocalProduct(userId, newProdPayload);
    targetProduct = newProdPayload;
  }

  // 2. Generate Scan ID and upload photos
  const scanTempId = crypto.randomUUID();
  let photoUrls: string[] = [];

  if (isCloudAvailable) {
    photoUrls = await uploadScanPhotosToStorage(
      userId,
      scanTempId,
      mergedResult.photoDataUrls
    );
  } else {
    photoUrls = mergedResult.photoDataUrls;
  }

  // 3. Create Product Scan Record
  const scanPayload: ProductScan = {
    id: scanTempId,
    product_id: targetProduct.id,
    user_id: userId,
    batch_number: batchNumber,
    checklist_results: mergedResult,
    photo_urls: photoUrls,
    response_time_ms: mergedResult.totalProcessingTimeMs,
    created_at: new Date().toISOString(),
  };

  // Always cache locally first
  saveLocalProductScan(userId, scanPayload);

  if (isCloudAvailable) {
    try {
      const { error: scanInsertErr } = await supabase
        .from("product_scans")
        .insert({
          id: scanTempId,
          product_id: targetProduct.id,
          user_id: userId,
          batch_number: batchNumber,
          checklist_results: mergedResult,
          photo_urls: photoUrls,
          response_time_ms: mergedResult.totalProcessingTimeMs,
        });

      if (scanInsertErr) {
        console.warn("[Scan Insert Warning] Supabase scan save:", scanInsertErr.message);
      }
    } catch (e) {
      console.warn("[Scan Insert Exception]:", e);
    }
  }

  return {
    status: "saved",
    product: targetProduct,
    productScan: scanPayload,
    isCloudSynced: isCloudAvailable,
    message: `Scan successfully logged under ${targetProduct.brand_name} — ${targetProduct.commodity_name}`,
  };
}

/**
 * Fetches and aggregates products into a Brand -> Commodity -> Product -> Scans hierarchy.
 */
export async function fetchProductHierarchy(userId: string): Promise<ProductHierarchyItem[]> {
  const supabase = createClient();

  let prods: Product[] = [];
  let scs: ProductScan[] = [];

  // Try fetching from Supabase
  try {
    const { data: cloudProds, error: pErr } = await supabase
      .from("products")
      .select("*")
      .eq("user_id", userId)
      .order("brand_name", { ascending: true });

    const { data: cloudScans, error: sErr } = await supabase
      .from("product_scans")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (!pErr && cloudProds) {
      prods = cloudProds as Product[];
    }
    if (!sErr && cloudScans) {
      scs = cloudScans as ProductScan[];
    }
  } catch (err) {
    console.warn("[Product Hierarchy Fetch] Supabase query offline/pending:", err);
  }

  // Merge with local storage cache
  const localProds = getLocalProducts(userId);
  const localScs = getLocalProductScans(userId);

  for (const lp of localProds) {
    if (!prods.some((p) => p.id === lp.id)) {
      prods.push(lp);
    }
  }

  for (const ls of localScs) {
    if (!scs.some((s) => s.id === ls.id)) {
      scs.push(ls);
    }
  }

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
