export const dynamic = "force-dynamic";

type Context = { params: { path: string[] } };
const hopHeaders = new Set(["host", "connection", "content-length", "transfer-encoding"]);

async function proxy(request: Request, { params }: Context): Promise<Response> {
  const backend = process.env.BACKEND_INTERNAL_URL;
  if (!backend) return Response.json({ error: "Adventure backend is unavailable" }, { status: 503 });
  const incoming = new URL(request.url);
  const path = params.path.map(encodeURIComponent).join("/");
  const target = new URL(`/api/${path}${incoming.search}`, backend);
  const headers = new Headers();
  request.headers.forEach((value, key) => { if (!hopHeaders.has(key)) headers.set(key, value); });
  headers.set("x-forwarded-host", incoming.host);
  headers.set("x-forwarded-proto", incoming.protocol.slice(0, -1));
  try {
    const upstream = await fetch(target, { method: request.method, headers, body: ["GET", "HEAD"].includes(request.method) ? undefined : await request.arrayBuffer(), redirect: "manual", cache: "no-store" });
    const responseHeaders = new Headers(upstream.headers);
    const cookies = upstream.headers.getSetCookie();
    if (cookies.length) { responseHeaders.delete("set-cookie"); cookies.forEach(cookie => responseHeaders.append("set-cookie", cookie)); }
    for (const key of ["content-encoding", "content-length", "transfer-encoding"]) responseHeaders.delete(key);
    responseHeaders.set("cache-control", "no-store");
    return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
  } catch {
    return Response.json({ error: "Adventure backend is unavailable" }, { status: 503 });
  }
}
export { proxy as GET, proxy as POST, proxy as PATCH, proxy as DELETE };
