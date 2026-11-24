import { createHash, randomBytes } from "node:crypto";

import { Op } from "sequelize";

export const SESSION_COOKIE = "stockflow_session";
export const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 30;

function digestToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

function readCookie(request, name) {
  const header = request.headers.cookie;
  if (!header) return null;
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    const key = part.slice(0, separator).trim();
    if (key !== name) continue;
    try {
      return decodeURIComponent(part.slice(separator + 1).trim());
    } catch {
      return null;
    }
  }
  return null;
}

function cookieOptions(expiresAt) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  };
}

function serializeCurrentUser(user) {
  const organization = user.organization;
  return {
    id: user.id,
    email: user.email,
    organizationId: organization.id,
    organizationName: organization.name,
    defaultLowStockThreshold: organization.defaultLowStockThreshold,
  };
}

export function createAuth(database) {
  const { Organization, Session, User } = database;

  async function createSession(userId, response) {
    const token = randomBytes(32).toString("base64url");
    const now = new Date();
    const expiresAt = new Date(now.getTime() + SESSION_DURATION_MS);

    await Session.destroy({ where: { expiresAt: { [Op.lt]: now } } });
    await Session.create({
      id: digestToken(token),
      userId,
      expiresAt,
    });

    response.cookie(SESSION_COOKIE, token, cookieOptions(expiresAt));
  }

  async function destroySession(request, response) {
    const token = readCookie(request, SESSION_COOKIE);
    if (token) {
      await Session.destroy({ where: { id: digestToken(token) } });
    }
    response.clearCookie(SESSION_COOKIE, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });
  }

  async function getCurrentUser(request) {
    const token = readCookie(request, SESSION_COOKIE);
    if (!token) return null;

    const session = await Session.findOne({
      where: {
        id: digestToken(token),
        expiresAt: { [Op.gt]: new Date() },
      },
      include: [
        {
          model: User,
          as: "user",
          required: true,
          include: [
            {
              model: Organization,
              as: "organization",
              required: true,
            },
          ],
        },
      ],
    });

    if (!session?.user?.organization) return null;
    return serializeCurrentUser(session.user);
  }

  async function requireAuth(request, response, next) {
    try {
      const user = await getCurrentUser(request);
      if (!user) {
        response.status(401).json({ error: "Authentication is required." });
        return;
      }
      request.currentUser = user;
      next();
    } catch (error) {
      next(error);
    }
  }

  return {
    createSession,
    destroySession,
    getCurrentUser,
    requireAuth,
  };
}
