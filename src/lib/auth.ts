import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { query } from "@/lib/db";

/**
 * Sesja: podpisany JWT (jose) w ciasteczku HttpOnly + Secure (przy HTTPS)
 * + SameSite=Lax, wygasanie 12 h. Do zapisu wynagrodzeń/kosztów nie służy.
 * Sekret: APP_SESSION_SECRET z .env — przy braku/wycieku ustaw nowy.
 */

const COOKIE_NAME = "tp_nets_session";
const SESSION_HOURS = 12;

export type Role = "worker" | "boss";

export interface SessionUser {
  userId: number;
  login: string;
  role: Role;
  employeeId: number | null;
}

function getSecret(): Uint8Array {
  const secret = process.env.APP_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "Brak lub za krótki APP_SESSION_SECRET (min. 32 znaki) — ustaw w .env."
    );
  }
  return new TextEncoder().encode(secret);
}

export async function createSession(user: SessionUser): Promise<void> {
  const token = await new SignJWT({
    uid: user.userId,
    login: user.login,
    role: user.role,
    eid: user.employeeId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_HOURS}h`)
    .sign(getSecret());

  const store = await cookies();
  const isHttps =
    process.env.APP_PUBLIC_URL?.startsWith("https://") ?? false;
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isHttps, // Secure przy HTTPS (Tailscale Serve), bez przy http://localhost
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_HOURS * 60 * 60,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

/** Zwraca dane sesji albo null (brak/nieprawidłowe/wygasłe ciasteczko). */
export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (
      typeof payload.uid !== "number" ||
      (payload.role !== "worker" && payload.role !== "boss")
    ) {
      return null;
    }
    return {
      userId: payload.uid,
      login: String(payload.login ?? ""),
      role: payload.role,
      employeeId: typeof payload.eid === "number" ? payload.eid : null,
    };
  } catch {
    return null;
  }
}

/** Wymusza zalogowanie; rzuca AuthError (obsługiwane przez middleware/strony). */
export async function requireSession(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) throw new AuthError();
  return session;
}

export async function requireRole(role: Role): Promise<SessionUser> {
  const session = await requireSession();
  if (session.role !== role) throw new ForbiddenError();
  return session;
}

export class AuthError extends Error {}
export class ForbiddenError extends Error {}

// --- logowanie ---

export async function verifyCredentials(
  login: string,
  password: string
): Promise<SessionUser | null> {
  if (!login || !password) return null;
  const res = await query<{
    id: number;
    email: string;
    password_hash: string;
    role: string;
    employee_id: number | null;
  }>(
    `SELECT id, email, password_hash, role, employee_id
     FROM users
     WHERE lower(email) = lower($1) AND is_active AND role IN ('worker', 'boss')`,
    [login]
  );
  const user = res.rows[0];
  if (!user) return null;
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return null;
  return {
    userId: user.id,
    login: user.email,
    role: user.role === "boss" ? "boss" : "worker",
    employeeId: user.employee_id,
  };
}
