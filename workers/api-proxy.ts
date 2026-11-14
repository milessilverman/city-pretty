export interface Env {
  GOOGLE_MAPS_KEY: string;
  LLM_API_KEY: string;
}

const ALLOWED_ORIGIN = "https://milessilverman.github.io";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get("Origin");
    if (origin !== ALLOWED_ORIGIN) {
      return new Response("Forbidden Origin", { status: 403 });
    }

    const url = new URL(request.url);
    if (url.pathname === "/api/streetview") {
      const lat = url.searchParams.get("lat");
      const lng = url.searchParams.get("lng");
      const heading = url.searchParams.get("heading") ?? "0";
      const upstream = `https://maps.googleapis.com/maps/api/streetview?size=640x400&location=${lat},${lng}&heading=${heading}&pitch=5&key=${env.GOOGLE_MAPS_KEY}`;
      const res = await fetch(upstream);
      return new Response(res.body, {
        headers: {
          "Content-Type": "image/jpeg",
          "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
          "Cache-Control": "public, max-age=604800",
        },
      });
    }

    return new Response("Not Found", { status: 404 });
  },
};
