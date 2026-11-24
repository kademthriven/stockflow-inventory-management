import { and, eq } from "drizzle-orm";

import { getDb } from "@/db";
import { products } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import {
  apiError,
  parseProductMutation,
  readJsonBody,
  serializeProduct,
} from "@/lib/inventory";

type RouteContext = { params: Promise<{ id: string }> };

function unauthorized() {
  return Response.json({ error: "Authentication is required." }, { status: 401 });
}

function notFound() {
  return Response.json({ error: "Product not found." }, { status: 404 });
}

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();

    const { id } = await params;
    const db = getDb();
    const [product] = await db
      .select()
      .from(products)
      .where(
        and(
          eq(products.id, id),
          eq(products.organizationId, user.organizationId),
        ),
      )
      .limit(1);

    if (!product) return notFound();
    return Response.json({
      product: serializeProduct(product, user.defaultLowStockThreshold),
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();

    const { id } = await params;
    const input = parseProductMutation(await readJsonBody(request), "update");
    const db = getDb();
    const [updated] = await db
      .update(products)
      .set({
        ...input,
        lastUpdatedBy: user.id,
        updatedAt: Date.now(),
      })
      .where(
        and(
          eq(products.id, id),
          eq(products.organizationId, user.organizationId),
        ),
      )
      .returning();

    if (!updated) return notFound();
    return Response.json({
      product: serializeProduct(updated, user.defaultLowStockThreshold),
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();

    const { id } = await params;
    const db = getDb();
    const [deleted] = await db
      .delete(products)
      .where(
        and(
          eq(products.id, id),
          eq(products.organizationId, user.organizationId),
        ),
      )
      .returning({ id: products.id });

    if (!deleted) return notFound();
    return Response.json({ success: true, id: deleted.id });
  } catch (error) {
    return apiError(error);
  }
}
