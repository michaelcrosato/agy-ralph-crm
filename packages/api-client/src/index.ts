import type { AppType } from "api";
import { hc } from "hono/client";

export type ApiClient = ReturnType<typeof hc<AppType>>;

export function createApiClient(
  baseUrl: string,
  options?: {
    getToken?: () => string | null | undefined;
    headers?: Record<string, string>;
  },
) {
  const customFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    if (options?.getToken) {
      const token = options.getToken();
      if (token) {
        headers.set("Authorization", `Bearer ${token}`);
      }
    }
    if (options?.headers) {
      for (const [key, value] of Object.entries(options.headers)) {
        headers.set(key, value);
      }
    }
    return fetch(input, {
      ...init,
      headers,
    });
  };

  return hc<AppType>(baseUrl, {
    fetch: customFetch,
  });
}
