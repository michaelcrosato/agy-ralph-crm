import * as jose from "jose";

export const AUTH_VERSION = "0.1.0";

export enum Permission {
  READ_RECORDS = 1 << 0, // 1
  WRITE_RECORDS = 1 << 1, // 2
  DELETE_RECORDS = 1 << 2, // 4
  MANAGE_USERS = 1 << 3, // 8
  MANAGE_METADATA = 1 << 4, // 16
  MANAGE_INTEGRATIONS = 1 << 5, // 32
}

export function hasPermission(mask: number, permission: Permission): boolean {
  return (mask & permission) === permission;
}

export interface TenantContext {
  userId: string;
  orgId: string;
  roleId: string;
  permissionsMask: number;
}

// A simple symmetric secret key for signing session tokens (JWT)
const JWT_SECRET = new TextEncoder().encode(
  "cohesive-crm-super-secret-key-that-is-at-least-32-characters",
);

// Sign a session token containing TenantContext
export async function createSessionToken(
  context: TenantContext,
): Promise<string> {
  return await new jose.SignJWT({ ...context })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(JWT_SECRET);
}

// Verify a session token and return the resolved TenantContext
export async function verifySessionToken(
  token: string,
): Promise<TenantContext> {
  const { payload } = await jose.jwtVerify(token, JWT_SECRET);
  return {
    userId: payload.userId as string,
    orgId: payload.orgId as string,
    roleId: payload.roleId as string,
    permissionsMask: payload.permissionsMask as number,
  };
}
