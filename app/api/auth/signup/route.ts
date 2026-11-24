import { eq } from "drizzle-orm";

import { getDb } from "@/db";
import { organizations, users } from "@/db/schema";
import { createSession, hashPassword } from "@/lib/auth";
import { firstValidationError, signupSchema } from "@/lib/validation";

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const result = signupSchema.safeParse(payload);
  if (!result.success) {
    return Response.json(firstValidationError(result.error), { status: 400 });
  }

  const { email, password, organizationName } = result.data;
  const db = getDb();
  const [existingUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existingUser) {
    return Response.json(
      { error: "An account already exists for this email", field: "email" },
      { status: 409 },
    );
  }

  const now = Date.now();
  const organizationId = crypto.randomUUID();
  const userId = crypto.randomUUID();
  const passwordHash = await hashPassword(password);

  try {
    await db.batch([
      db.insert(organizations).values({
        id: organizationId,
        name: organizationName,
        defaultLowStockThreshold: 5,
        createdAt: now,
        updatedAt: now,
      }),
      db.insert(users).values({
        id: userId,
        organizationId,
        email,
        passwordHash,
        createdAt: now,
        updatedAt: now,
      }),
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.toLowerCase().includes("unique")) {
      return Response.json(
        { error: "An account already exists for this email", field: "email" },
        { status: 409 },
      );
    }
    throw error;
  }

  await createSession(userId);

  return Response.json(
    {
      user: { id: userId, email },
      organization: {
        id: organizationId,
        name: organizationName,
        defaultLowStockThreshold: 5,
      },
    },
    { status: 201 },
  );
}
