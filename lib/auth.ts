import "server-only";

import { and, eq, gt, lt } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getDb } from "@/db";
import { organizations, sessions, users } from "@/db/schema";

const SESSION_COOKIE = "stockflow_session";
const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 30;
const PASSWORD_ITERATIONS = 210_000;
const encoder = new TextEncoder();

export type CurrentUser = {
  id: string;
  email: string;
  organizationId: string;
  organizationName: string;
  defaultLowStockThreshold: number;
};

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function bytesToBase64Url(bytes: Uint8Array) {
  return bytesToBase64(bytes)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function secureRandomBytes(length: number) {
  return crypto.getRandomValues(new Uint8Array(length));
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return bytesToBase64Url(new Uint8Array(digest));
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index] ^ right[index];
  }
  return difference === 0;
}

export async function hashPassword(password: string) {
  const salt = secureRandomBytes(16);
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: PASSWORD_ITERATIONS,
      hash: "SHA-256",
    },
    key,
    256,
  );

  return [
    "pbkdf2_sha256",
    PASSWORD_ITERATIONS,
    bytesToBase64(salt),
    bytesToBase64(new Uint8Array(bits)),
  ].join("$");
}

export async function verifyPassword(password: string, storedHash: string) {
  const [algorithm, iterationText, saltText, hashText] = storedHash.split("$");
  const iterations = Number(iterationText);
  if (
    algorithm !== "pbkdf2_sha256" ||
    !Number.isSafeInteger(iterations) ||
    iterations < 100_000 ||
    !saltText ||
    !hashText
  ) {
    return false;
  }

  try {
    const salt = base64ToBytes(saltText);
    const expected = base64ToBytes(hashText);
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(password),
      "PBKDF2",
      false,
      ["deriveBits"],
    );
    const bits = await crypto.subtle.deriveBits(
      { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
      key,
      expected.length * 8,
    );
    return constantTimeEqual(new Uint8Array(bits), expected);
  } catch {
    return false;
  }
}

export async function createSession(userId: string) {
  const token = bytesToBase64Url(secureRandomBytes(32));
  const sessionId = await sha256(token);
  const now = Date.now();
  const expiresAt = now + SESSION_DURATION_MS;
  const db = getDb();

  await db.delete(sessions).where(lt(sessions.expiresAt, now));
  await db.insert(sessions).values({
    id: sessionId,
    userId,
    createdAt: now,
    expiresAt,
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(expiresAt),
  });
}

export async function destroySession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (token) {
    const db = getDb();
    await db.delete(sessions).where(eq(sessions.id, await sha256(token)));
  }

  cookieStore.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(0),
  });
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const sessionId = await sha256(token);
  const db = getDb();
  const [record] = await db
    .select({
      id: users.id,
      email: users.email,
      organizationId: organizations.id,
      organizationName: organizations.name,
      defaultLowStockThreshold: organizations.defaultLowStockThreshold,
      expiresAt: sessions.expiresAt,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .innerJoin(organizations, eq(users.organizationId, organizations.id))
    .where(and(eq(sessions.id, sessionId), gt(sessions.expiresAt, Date.now())))
    .limit(1);

  if (!record) return null;
  return {
    id: record.id,
    email: record.email,
    organizationId: record.organizationId,
    organizationName: record.organizationName,
    defaultLowStockThreshold: record.defaultLowStockThreshold,
  };
}

export async function requireCurrentUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
