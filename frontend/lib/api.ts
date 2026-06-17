// lib/api.ts — 공통 fetch 래퍼 (base URL + NEXT_PUBLIC_MOCK 스위치 + 본문-기반 자동 POST)
// 기능 프롬프트(fe/02~07)는 이 파일을 수정하지 않는다. 엔드포인트 래퍼/목은 features/<도메인>/api.ts.

export const API =
  process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

/** NEXT_PUBLIC_MOCK === "1" 이면 클러스터 의존 호출을 목으로 대체한다(각 기능이 목 데이터를 채움). */
export const IS_MOCK = process.env.NEXT_PUBLIC_MOCK === "1";

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

export interface ApiFetchOptions extends Omit<RequestInit, "body"> {
  /** JSON 본문 — 있으면 메서드 미지정 시 자동 POST + Content-Type application/json */
  json?: unknown;
  /** multipart 본문 — 있으면 메서드 미지정 시 자동 POST (Content-Type은 브라우저가 boundary 포함해 설정) */
  form?: FormData;
  /** ?key=value 쿼리 (예: lang=ko) */
  query?: Record<string, string | number | boolean | undefined>;
  /** Response 를 그대로 받고 싶을 때(blob 다운로드 등) — true면 파싱하지 않고 Response 반환 */
  raw?: boolean;
}

function buildUrl(
  path: string,
  query?: ApiFetchOptions["query"]
): string {
  const base = path.startsWith("http") ? path : `${API}${path}`;
  if (!query) return base;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null) params.set(k, String(v));
  }
  const qs = params.toString();
  return qs ? `${base}${base.includes("?") ? "&" : "?"}${qs}` : base;
}

/**
 * 단일 fetch 래퍼.
 *
 * ★ HTTP 메서드 기본값 규칙 (fe/01 필수):
 *   본문(json 또는 form)이 있으면 호출부가 method를 안 줘도 자동으로 POST.
 *   본문이 없으면 GET. 호출부가 method를 명시하면 그게 우선.
 *   → 본문 가진 호출이 기본 GET 으로 나가
 *     "Request with GET/HEAD method cannot have body" 에러를 던지는 것을 방지.
 */
export async function apiFetch<T = unknown>(
  path: string,
  opts: ApiFetchOptions = {}
): Promise<T> {
  const { json, form, query, raw, headers, method, ...rest } = opts;

  const hasBody = json !== undefined || form !== undefined;
  const resolvedMethod = method ?? (hasBody ? "POST" : "GET");

  const finalHeaders = new Headers(headers);
  let body: BodyInit | undefined;

  if (form !== undefined) {
    body = form; // Content-Type 은 브라우저가 multipart boundary 포함해 설정
  } else if (json !== undefined) {
    if (!finalHeaders.has("Content-Type")) {
      finalHeaders.set("Content-Type", "application/json");
    }
    body = JSON.stringify(json);
  }

  const res = await fetch(buildUrl(path, query), {
    ...rest,
    method: resolvedMethod,
    headers: finalHeaders,
    body,
  });

  if (raw) {
    if (!res.ok) {
      throw new ApiError(res.status, `${resolvedMethod} ${path} → ${res.status}`);
    }
    return res as unknown as T;
  }

  const contentType = res.headers.get("content-type") ?? "";
  let parsed: unknown = null;
  if (contentType.includes("application/json")) {
    parsed = await res.json().catch(() => null);
  } else {
    parsed = await res.text().catch(() => null);
  }

  if (!res.ok) {
    const msg =
      (parsed && typeof parsed === "object" && "detail" in parsed
        ? String((parsed as { detail: unknown }).detail)
        : typeof parsed === "string" && parsed
          ? parsed
          : `${resolvedMethod} ${path} → ${res.status}`) || "Request failed";
    throw new ApiError(res.status, msg, parsed);
  }

  return parsed as T;
}
