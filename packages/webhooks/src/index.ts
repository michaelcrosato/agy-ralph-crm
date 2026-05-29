import * as crypto from "node:crypto";

export const WEBHOOKS_VERSION = "0.1.0";

// Computes HMAC-SHA256 signature for payload verification
export function computeHmacSignature(payload: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

// Simulates sending an outbound webhook asynchronously, signing it if a secret exists
export async function simulateWebhookDispatch(params: {
  targetUrl: string;
  secret: string | null;
  event: string;
  payload: Record<string, unknown>;
}): Promise<{
  statusCode: number;
  payloadString: string;
  signature: string | null;
}> {
  const payloadString = JSON.stringify({
    event: params.event,
    timestamp: new Date().toISOString(),
    data: params.payload,
  });

  let signature: string | null = null;
  if (params.secret) {
    signature = computeHmacSignature(payloadString, params.secret);
  }

  // If the targetUrl contains the word "fail", simulate a down-stream delivery failure (HTTP 500)
  const statusCode = params.targetUrl.includes("fail") ? 500 : 200;

  return {
    statusCode,
    payloadString,
    signature,
  };
}
