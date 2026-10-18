import {
  ApiRoute,
  HEALTH_ROUTE,
  isApiErrorBody,
  isHealthResponse,
  isHoldingResponse,
  isInventoryResponse,
  isKindledResponse,
  isMeResponse,
  type ApiErrorCode,
  type CreateKindledRequest,
  type CredentialsRequest,
  type HealthResponse,
  type HoldingResponse,
  type HoldingStationRequest,
  type InventoryMoveRequest,
  type InventoryResponse,
  type KindledView,
  type MeResponse,
  type WritFeedRequest,
  type WritNameRequest,
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
  /** The signed-in Kindled's items by place, each in items.json order; `no-kindled` before creation. */
  inventory(): Promise<ApiResult<InventoryResponse>>;
  /** Move items between two places; answers the new inventory, or `pack-full`, `stack-limit`, `insufficient`, `wrong-place`, `bad-request`. */
  move(body: InventoryMoveRequest): Promise<ApiResult<InventoryResponse>>;
  /** The server's build (its /health, same origin); `unreachable` when the page's origin doesn't serve it. */
  health(): Promise<ApiResult<HealthResponse>>;
  /** The holding (docs/design/holding.md), settled: the baskets, the active action, the server's clock, the skills. */
  holding(): Promise<ApiResult<HoldingResponse>>;
  /** Start or switch to working a station; `unknown-station`, `no-action` (the post). */
  holdingWork(body: HoldingStationRequest): Promise<ApiResult<HoldingResponse>>;
  /** Settle and clear the active action. */
  holdingStop(): Promise<ApiResult<HoldingResponse>>;
  /** Take all: what fits of a station's basket into the store; the answer's `take` says what moved and what stayed. */
  holdingTake(body: HoldingStationRequest): Promise<ApiResult<HoldingResponse>>;
  /** Name the island (once): the typed Name; the server hears its letters. `name-refused`, `already-named`. */
  writName(body: WritNameRequest): Promise<ApiResult<HoldingResponse>>;
  /** Feed the Writ: a count of a kind, or `fill` (wild slivers). `unnamed`, `not-sparkglass`, `insufficient`, `full`, `too-much`. */
  writFeed(body: WritFeedRequest): Promise<ApiResult<HoldingResponse>>;
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
    inventory: () => request(fetchFn, ApiRoute.Inventory, 'GET', undefined, isInventoryResponse),
    move: (body) => request(fetchFn, ApiRoute.InventoryMove, 'POST', body, isInventoryResponse),
    health: () => request(fetchFn, HEALTH_ROUTE, 'GET', undefined, isHealthResponse),
    holding: () => request(fetchFn, ApiRoute.Holding, 'GET', undefined, isHoldingResponse),
    holdingWork: (body) => request(fetchFn, ApiRoute.HoldingWork, 'POST', body, isHoldingResponse),
    holdingStop: () => request(fetchFn, ApiRoute.HoldingStop, 'POST', {}, isHoldingResponse),
    holdingTake: (body) => request(fetchFn, ApiRoute.HoldingTake, 'POST', body, isHoldingResponse),
    writName: (body) => request(fetchFn, ApiRoute.WritName, 'POST', body, isHoldingResponse),
    writFeed: (body) => request(fetchFn, ApiRoute.WritFeed, 'POST', body, isHoldingResponse),
  };
}

export const api = createApi();

/** Who is signed in, kept between scenes (null until /api/me answers, or after logging out). */
export const accountStore = {
  current: null as MeResponse | null,
};
