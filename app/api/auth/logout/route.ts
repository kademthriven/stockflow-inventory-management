import { destroySession } from "@/lib/auth";

async function logout() {
  await destroySession();
  return new Response(null, { status: 204 });
}

export const POST = logout;
export const DELETE = logout;
