import { getCurrentUser } from "@/lib/auth";
import { apiError, getInventorySnapshot } from "@/lib/inventory";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return Response.json(
        { error: "Authentication is required." },
        { status: 401 },
      );
    }

    const snapshot = await getInventorySnapshot(user.organizationId);
    if (!snapshot) {
      return Response.json({ error: "Organization not found." }, { status: 404 });
    }

    return Response.json(snapshot);
  } catch (error) {
    return apiError(error);
  }
}
