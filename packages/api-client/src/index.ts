import type { AppType } from "api";
import { hc } from "hono/client";

// Until every routes/*.ts uses OpenAPIHono with `.openapi(route, handler)`,
// hc<AppType>() collapses to `unknown` for most sub-app paths because their
// inner schema is BlankSchema. Expose a permissive runtime client surface
// (callers may type their own response shapes for now) while still keeping
// the strongly-typed AppType available for opt-in use.
type TypedClient = ReturnType<typeof hc<AppType>>;
// biome-ignore lint/suspicious/noExplicitAny: pragmatic seam until all routes are openapi-typed
export type ApiClient = TypedClient & Record<string, any>;

export function createApiClient(
  baseUrl: string,
  options?: {
    getToken?: () => string | null | undefined;
    headers?: Record<string, string>;
  },
): ApiClient {
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
  }) as ApiClient;
}
