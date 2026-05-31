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

const DEV_JWT_SECRET = "dev-only-jwt-secret-change-before-production-000000";

function readEnv(name: string): string | undefined {
  const env =
    (
      globalThis as typeof globalThis & {
        process?: { env?: Record<string, string | undefined> };
      }
    ).process?.env ?? {};
  const value = env[name];
  return value && value.length > 0 ? value : undefined;
}

function getJwtSecret(): Uint8Array {
  const configuredSecret = readEnv("JWT_SECRET");
  const isProduction = readEnv("NODE_ENV") === "production";
  if (!configuredSecret && isProduction) {
    throw new Error("JWT_SECRET is required in production.");
  }

  const secret = configuredSecret ?? DEV_JWT_SECRET;
  if (secret.length < 32) {
    throw new Error("JWT_SECRET must be at least 32 characters.");
  }
  return new TextEncoder().encode(secret);
}

// Sign a session token containing TenantContext
export async function createSessionToken(
  context: TenantContext,
): Promise<string> {
  return await new jose.SignJWT({ ...context })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(getJwtSecret());
}

// Verify a session token and return the resolved TenantContext
export async function verifySessionToken(
  token: string,
): Promise<TenantContext> {
  const { payload } = await jose.jwtVerify(token, getJwtSecret());
  return {
    userId: payload.userId as string,
    orgId: payload.orgId as string,
    roleId: payload.roleId as string,
    permissionsMask: payload.permissionsMask as number,
  };
}
