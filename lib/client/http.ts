export function fetchNoStore(
  input: RequestInfo | URL,
  init?: Omit<RequestInit, "cache">
) {
  return fetch(input, {
    cache: "no-store",
    ...init,
  });
}

export function jsonRequestInit(
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  body: unknown,
  init?: Omit<RequestInit, "method" | "body">
): RequestInit {
  return {
    ...init,
    method,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    body: JSON.stringify(body),
  };
}
