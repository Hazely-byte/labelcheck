import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isCertifiedInspector } from "@/lib/certifiedInspectors";
import type { Product, ProductScan, ProductHierarchyItem } from "@/lib/types";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;

    if (!userId || typeof userId !== "string") {
      return NextResponse.json({ error: "Invalid inspector ID" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("[Public Inspector API] SUPABASE_SERVICE_ROLE_KEY is not configured.");
      return NextResponse.json(
        { error: "Public inspector service is not configured on the server." },
        { status: 500 }
      );
    }

    // 1. Create elevated admin client capable of querying auth.users and bypassing RLS
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // 2. Fetch the user's authentic record from auth.users
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);

    if (userError || !userData?.user) {
      // Return uniform 404 to avoid leaking user existence
      return NextResponse.json(
        { error: "Inspector catalog not found or private." },
        { status: 404 }
      );
    }

    const targetUser = userData.user;

    // 3. Server-side verification against the certified inspector allowlist
    if (!isCertifiedInspector(targetUser.email)) {
      // Non-certified user catalogs remain strictly private
      return NextResponse.json(
        { error: "Inspector catalog not found or private." },
        { status: 404 }
      );
    }

    // 4. Fetch all catalogued products for this certified inspector
    const { data: products, error: pErr } = await supabaseAdmin
      .from("products")
      .select("*")
      .eq("user_id", userId)
      .order("brand_name", { ascending: true });

    if (pErr) {
      console.error("[Public Inspector API] Error fetching products:", pErr.message);
      return NextResponse.json({ error: "Failed to load product records" }, { status: 500 });
    }

    // 5. Fetch all scans for this certified inspector
    const { data: scans, error: sErr } = await supabaseAdmin
      .from("product_scans")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (sErr) {
      console.error("[Public Inspector API] Error fetching product scans:", sErr.message);
      return NextResponse.json({ error: "Failed to load scan records" }, { status: 500 });
    }

    const prods = (products as Product[]) || [];
    const scs = (scans as ProductScan[]) || [];

    // 6. Build the Brand -> Commodity -> Product -> Scans hierarchy tree
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

    const inspectorName =
      targetUser.user_metadata?.full_name ||
      targetUser.user_metadata?.name ||
      targetUser.email?.split("@")[0] ||
      "Certified Inspector";

    const avatarUrl =
      targetUser.user_metadata?.avatar_url || targetUser.user_metadata?.picture || null;

    return NextResponse.json({
      inspector: {
        userId,
        name: inspectorName,
        email: targetUser.email,
        avatarUrl,
        isCertified: true,
      },
      hierarchy,
      totalProducts: prods.length,
      totalScans: scs.length,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Public Inspector API Exception]:", msg);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
