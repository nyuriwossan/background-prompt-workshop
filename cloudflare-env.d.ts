declare module "cloudflare:workers" {
  export const env: Record<string, unknown> & { DB?: D1Database };
}

interface Fetcher {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

interface D1Database {}
