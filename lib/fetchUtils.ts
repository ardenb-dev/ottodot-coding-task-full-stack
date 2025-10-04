/**
 * Typed fetch function.
 */
export async function api<Request, Response>(
  path: string,
  method: "GET" | "POST" | "PUT" | "DELETE",
  body: Request
): Promise<Response> {
  const response = await fetch(path, {
    method: method,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(response.statusText);
  }

  return (await response.json()) as Response;
}
