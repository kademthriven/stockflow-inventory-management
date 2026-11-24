import { and, asc, eq, like, or } from "drizzle-orm";

import { getDb } from "@/db";
import { products } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import {
  apiError,
  parseProductMutation,
  readJsonBody,
  serializeProduct,
} from "@/lib/inventory";

function unauthorized() {
  return Response.json({ error: "Authentication is required." }, { status: 401 });
}

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();

    const search = new URL(request.url).searchParams.get("search")?.trim().slice(0, 120);
    const db = getDb();
    const where = search
      ? and(
          eq(products.organizationId, user.organizationId),
          or(
            like(products.name, `%${search}%`),
            like(products.sku, `%${search}%`),
          ),
        )
      : eq(products.organizationId, user.organizationId);

    const records = await db
      .select()
      .from(products)
      .where(where)
      .orderBy(asc(products.name), asc(products.sku))
      .limit(500);

    return Response.json({
      products: records.map((product) =>
        serializeProduct(product, user.defaultLowStockThreshold),
      ),
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();

    const input = parseProductMutation(await readJsonBody(request), "create");
    const db = getDb();
    const now = Date.now();
    const [created] = await db
      .insert(products)
      .values({
        id: crypto.randomUUID(),
        organizationId: user.organizationId,
        name: input.name!,
        sku: input.sku!,
        description: input.description ?? null,
        quantityOnHand: input.quantityOnHand!,
        costPriceCents: input.costPriceCents ?? null,
        sellingPriceCents: input.sellingPriceCents ?? null,
        lowStockThreshold: input.lowStockThreshold ?? null,
        lastUpdatedBy: user.id,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return Response.json(
      {
        product: serializeProduct(created, user.defaultLowStockThreshold),
      },
      { status: 201 },
    );
  } catch (error) {
    return apiError(error);
  }
}
