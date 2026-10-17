import {
  ApiRoute,
  HEALTH_ROUTE,
  isApiErrorBody,
  isHealthResponse,
  isInventoryResponse,
  isKindledResponse,
  isMeResponse,
  type ApiErrorCode,
  type CreateKindledRequest,
  type CredentialsRequest,
  type HealthResponse,
  type InventoryEntry,
  type KindledView,
  type MeResponse,
} from '@iot/shared';

/**
 * The typed client of the server's JSON API (docs/design/accounts.md): same
 * origin, cookies included, routes and response guards from @iot/shared. A
 * response that fails its guard counts as a failure, like a network error.
 */
export type ApiResult<T> =
  | { ok: true; value: T }
  /** status 0: no answer (network down, or not JSON from the API). */
  | { ok: false; status: number; error: ApiErrorCode | 'unreachable'; message: string };

export const UNREACHABLE = "Can't reach the server. Try again in a moment.";

type Fetch = (input: string, init: RequestInit) => Promise<Response>;

async function request<T>(
  fetchFn: Fetch,
  route: string,
  method: 'GET' | 'POST',
  body: unknown,
  guard: ((value: unknown) => value is T) | null,
): Promise<ApiResult<T>> {
  let res: Response;
  try {
    res = await fetchFn(route, {
      method,
      credentials: 'include',
      headers: method === 'POST' ? { 'content-type': 'application/json' } : {},
      ...(method === 'POST' ? { body: JSON.stringify(body ?? {}) } : {}),
    });
  } catch {
    return { ok: false, status: 0, error: 'unreachable', message: UNREACHABLE };
  }
  if (res.status === 204 && guard === null) return { ok: true, value: undefined as T };
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    return { ok: false, status: res.status, error: 'unreachable', message: UNREACHABLE };
  }
  if (res.ok && guard?.(json)) return { ok: true, value: json };
  if (!res.ok && isApiErrorBody(json))
    return { ok: false, status: res.status, error: json.error, message: json.message };
  return { ok: false, status: res.status, error: 'unreachable', message: UNREACHABLE };
}

export interface Api {
  /** The signed-in account and its Kindled; `not-signed-in` without a session. */
  me(): Promise<ApiResult<MeResponse>>;
  register(body: CredentialsRequest): Promise<ApiResult<MeResponse>>;
  login(body: CredentialsRequest): Promise<ApiResult<MeResponse>>;
  logout(): Promise<ApiResult<undefined>>;
  createKindled(body: CreateKindledRequest): Promise<ApiResult<KindledView>>;
  /** The signed-in Kindled's items, in items.json order; `no-kindled` before creation. */
  inventory(): Promise<ApiResult<InventoryEntry[]>>;
  /** The server's build (its /health, same origin); `unreachable` when the page's origin doesn't serve it. */
  health(): Promise<ApiResult<HealthResponse>>;
}

export function createApi(fetchFn: Fetch = (input, init) => fetch(input, init)): Api {
  return {
    me: () => request(fetchFn, ApiRoute.Me, 'GET', undefined, isMeResponse),
    register: (body) => request(fetchFn, ApiRoute.Register, 'POST', body, isMeResponse),
    login: (body) => request(fetchFn, ApiRoute.Login, 'POST', body, isMeResponse),
    logout: () => request<undefined>(fetchFn, ApiRoute.Logout, 'POST', {}, null),
    createKindled: async (body) => {
      const res = await request(fetchFn, ApiRoute.Kindled, 'POST', body, isKindledResponse);
      return res.ok ? { ok: true, value: res.value.kindled } : res;
    },
    inventory: async () => {
      const res = await request(fetchFn, ApiRoute.Inventory, 'GET', undefined, isInventoryResponse);
      return res.ok ? { ok: true, value: res.value.items } : res;
    },
    health: () => request(fetchFn, HEALTH_ROUTE, 'GET', undefined, isHealthResponse),
  };
}

export const api = createApi();

/** Who is signed in, kept between scenes (null until /api/me answers, or after logging out). */
export const accountStore = {
  current: null as MeResponse | null,
};
