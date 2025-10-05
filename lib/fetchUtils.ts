/**
 * Typed fetch function.
 */

// Overload for streaming
export async function api<Request, Response>(
  path: string,
  method: "GET" | "POST" | "PUT" | "DELETE",
  body: Request,
  stream: true
): Promise<globalThis.Response>;

// Overload for JSON response
export async function api<Request, Response>(
  path: string,
  method: "GET" | "POST" | "PUT" | "DELETE",
  body: Request,
  stream?: false
): Promise<Response>;

export async function api<Request, Response>(
  path: string,
  method: "GET" | "POST" | "PUT" | "DELETE",
  body: Request,
  stream = false
): Promise<Response | globalThis.Response> {
  const response = await fetch(path, {
    method,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(response.statusText);
  }

  if (stream) {
    return response;
  }

  return (await response.json()) as Response;
}
