import { eq } from "drizzle-orm";

import { getDb } from "@/db";
import { organizations } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import {
  apiError,
  getOrganizationSettings,
  parseDefaultThreshold,
  readJsonBody,
} from "@/lib/inventory";

function unauthorized() {
  return Response.json({ error: "Authentication is required." }, { status: 401 });
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();

    const organization = await getOrganizationSettings(user.organizationId);
    if (!organization) {
      return Response.json({ error: "Organization not found." }, { status: 404 });
    }

    return Response.json({
      organizationName: organization.name,
      defaultLowStockThreshold: organization.defaultLowStockThreshold,
      updatedAt: organization.updatedAt,
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();

    const defaultLowStockThreshold = parseDefaultThreshold(
      await readJsonBody(request),
    );
    const db = getDb();
    const [organization] = await db
      .update(organizations)
      .set({ defaultLowStockThreshold, updatedAt: Date.now() })
      .where(eq(organizations.id, user.organizationId))
      .returning({
        name: organizations.name,
        defaultLowStockThreshold: organizations.defaultLowStockThreshold,
        updatedAt: organizations.updatedAt,
      });

    if (!organization) {
      return Response.json({ error: "Organization not found." }, { status: 404 });
    }

    return Response.json({
      organizationName: organization.name,
      defaultLowStockThreshold: organization.defaultLowStockThreshold,
      updatedAt: organization.updatedAt,
    });
  } catch (error) {
    return apiError(error);
  }
}
