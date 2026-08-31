import type { RealingoUser } from "./types";

export const REALINGO_GRAPHQL = "https://www.realingo.cz/graphql";

const LOGIN_MUTATION = `mutation Login($email: String!, $password: String!) {
  login(email: $email, password: $password) {
    token
    user {
      id
      email
      premiumPlan
    }
  }
}`;

interface LoginResponse {
  data: { login: { token: string; user: RealingoUser } | null } | null;
  errors?: { message?: string }[];
}

interface GqlResponse<T = unknown> {
  data?: T;
  errors?: { message?: string; extensions?: { code?: string } }[];
}

const REQUEST_TIMEOUT_MS = 20000;

function decodeTokenExpiry(token: string): number {
  try {
    const payload = token.split(".")[1];
    const json = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return typeof json.exp === "number" ? json.exp * 1000 : 0;
  } catch {
    return 0;
  }
}

export class RealingoClient {
  private email = "";
  private password = "";
  private token: string | null = null;
  private tokenExpiry = 0;

  constructor() {
    this.email = process.env.REALINGO_EMAIL ?? "";
    this.password = process.env.REALINGO_PASSWORD ?? "";
  }

  get hasCredentials(): boolean {
    return Boolean(this.email && this.password);
  }

  async login(): Promise<RealingoUser | null> {
    if (!this.hasCredentials) return null;
    const res = await fetch(REALINGO_GRAPHQL, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "*/*" },
      body: JSON.stringify({
        query: LOGIN_MUTATION,
        operationName: "Login",
        variables: { email: this.email, password: this.password },
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) {
      throw new Error(`Realingo login -> HTTP ${res.status}`);
    }
    const json = (await res.json()) as LoginResponse;
    const login = json.data?.login;
    if (!login?.token) {
      const msg = json.errors?.[0]?.message;
      throw new Error(`Realingo login failed: ${msg ?? "unknown"}`);
    }
    this.token = login.token;
    this.tokenExpiry = decodeTokenExpiry(login.token);
    return login.user;
  }

  /** Aktuální (neprošlý) token, jinak se znovu přihlásí. */
  private async getToken(): Promise<string> {
    if (this.token && Date.now() + 60_000 < this.tokenExpiry) {
      return this.token;
    }
    await this.login();
    if (!this.token) throw new Error("Realingo not authenticated");
    return this.token;
  }

  async gql<T = unknown>(
    query: string,
    operationName: string,
    variables: Record<string, unknown> = {}
  ): Promise<{ data?: T; errors?: { message?: string }[] }> {
    const token = await this.getToken();
    const res = await fetch(REALINGO_GRAPHQL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "*/*",
        cookie: `jwt-token=${token}`,
      },
      body: JSON.stringify({ query, operationName, variables }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) {
      throw new Error(`Realingo ${operationName} -> HTTP ${res.status}`);
    }
    return (await res.json()) as GqlResponse<T>;
  }
}

let _client: RealingoClient | null = null;

/** Sdílená instance klienta (single-user, per-server). */
export function getRealingoClient(): RealingoClient {
  if (!_client) _client = new RealingoClient();
  return _client;
}
