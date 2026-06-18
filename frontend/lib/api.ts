// lib/api.ts — 공유 fetch 래퍼 (base URL + NEXT_PUBLIC_MOCK 스위치 + 본문-기반 자동 POST)
// 단일 소스: docs/design-system.md §5, docs/build-prompts/fe/01-foundation.md
// ⚠️ 이 파일은 공유 골격이다. 엔드포인트 래퍼/목 데이터는 각 기능의 features/<도메인>/api.ts에 둔다.

export const API: string =
  process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

/** NEXT_PUBLIC_MOCK === "1" 이면 클러스터 의존 호출을 목으로 대체한다(각 기능 프롬프트가 채움). */
export const MOCK: boolean = process.env.NEXT_PUBLIC_MOCK === "1";

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

export interface ApiFetchOptions extends Omit<RequestInit, "body"> {
  /** JSON 본문 — 있으면 method 미지정 시 자동 POST */
  json?: unknown;
  /** multipart/form-data 본문 — 있으면 method 미지정 시 자동 POST */
  form?: FormData;
  /** 쿼리 파라미터 (예: { lang: "ko" }) */
  query?: Record<string, string | number | boolean | undefined>;
}

function buildUrl(path: string, query?: ApiFetchOptions["query"]): string {
  const base = path.startsWith("http") ? path : `${API}${path.startsWith("/") ? "" : "/"}${path}`;
  if (!query) return base;
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null) usp.set(k, String(v));
  }
  const qs = usp.toString();
  return qs ? `${base}${base.includes("?") ? "&" : "?"}${qs}` : base;
}

/**
 * 공유 fetch 래퍼.
 *
 * ★ HTTP 메서드 기본값 규칙 (필수):
 *   본문(json 또는 form)이 있으면 호출부가 method를 안 줘도 자동으로 POST로 보낸다.
 *   본문이 없으면 GET. 호출부가 method를 명시하면 그게 우선.
 *   → 이 규칙이 없으면 본문을 가진 호출이 기본 GET으로 나가
 *     "Request with GET/HEAD method cannot have body" 에러가 난다(f3 /generate-inp에서 실제 발생).
 */
export async function apiFetch<T = unknown>(
  path: string,
  opts: ApiFetchOptions = {},
): Promise<T> {
  const { json, form, query, headers, method, ...rest } = opts;

  const hasBody = json !== undefined || form !== undefined;
  const resolvedMethod = method ?? (hasBody ? "POST" : "GET");

  const finalHeaders = new Headers(headers);
  let body: BodyInit | undefined;

  if (form !== undefined) {
    body = form; // Content-Type은 브라우저가 boundary와 함께 자동 설정
  } else if (json !== undefined) {
    finalHeaders.set("Content-Type", "application/json");
    body = JSON.stringify(json);
  }

  const url = buildUrl(path, query);

  let res: Response;
  try {
    res = await fetch(url, { ...rest, method: resolvedMethod, headers: finalHeaders, body });
  } catch (e) {
    throw new ApiError(
      `네트워크 오류: ${url} 에 연결할 수 없습니다 (백엔드 :8000 미기동?)`,
      0,
      e,
    );
  }

  const contentType = res.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");
  const payload = isJson ? await res.json().catch(() => null) : await res.text();

  if (!res.ok) {
    const detail =
      isJson && payload && typeof payload === "object" && "detail" in payload
        ? String((payload as Record<string, unknown>).detail)
        : `${res.status} ${res.statusText}`;
    throw new ApiError(detail, res.status, payload);
  }

  return payload as T;
}
