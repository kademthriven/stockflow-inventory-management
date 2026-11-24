import { eq } from "drizzle-orm";

import { getDb } from "@/db";
import { organizations, users } from "@/db/schema";
import { createSession, verifyPassword } from "@/lib/auth";
import { firstValidationError, loginSchema } from "@/lib/validation";

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const result = loginSchema.safeParse(payload);
  if (!result.success) {
    return Response.json(firstValidationError(result.error), { status: 400 });
  }

  const db = getDb();
  const [account] = await db
    .select({
      id: users.id,
      email: users.email,
      passwordHash: users.passwordHash,
      organizationId: organizations.id,
      organizationName: organizations.name,
      defaultLowStockThreshold: organizations.defaultLowStockThreshold,
    })
    .from(users)
    .innerJoin(organizations, eq(users.organizationId, organizations.id))
    .where(eq(users.email, result.data.email))
    .limit(1);

  if (!account || !(await verifyPassword(result.data.password, account.passwordHash))) {
    return Response.json(
      { error: "Email or password is incorrect" },
      { status: 401 },
    );
  }

  await createSession(account.id);

  return Response.json({
    user: { id: account.id, email: account.email },
    organization: {
      id: account.organizationId,
      name: account.organizationName,
      defaultLowStockThreshold: account.defaultLowStockThreshold,
    },
  });
}
