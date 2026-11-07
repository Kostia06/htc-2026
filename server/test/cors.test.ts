import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import app from "../src/index";

const preflight = (origin: string, bindings = env) =>
  app.request(
    "/api/pairing/ABCD2345",
    { method: "OPTIONS", headers: { Origin: origin, "Access-Control-Request-Method": "GET", "Access-Control-Request-Headers": "X-Pairing-Token" } },
    bindings,
  );

describe("cors", () => {
  it("answers a preflight from the local headset page without a session", async () => {
    const res = await preflight("http://localhost:5173");
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:5173");
    expect(res.headers.get("Access-Control-Allow-Headers")).toContain("X-Pairing-Token");
    expect(res.headers.get("Access-Control-Allow-Methods")).toBe("GET,POST,PATCH,DELETE");
  });

  it("does not allow an origin that is not listed", async () => {
    const res = await preflight("https://evil.example");
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("reads the allowed origins from ALLOWED_ORIGINS", async () => {
    const bindings = { ...env, ALLOWED_ORIGINS: "https://raven.example, https://quest.example" };
    expect((await preflight("https://quest.example", bindings)).headers.get("Access-Control-Allow-Origin")).toBe("https://quest.example");
    expect((await preflight("http://localhost:5173", bindings)).headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("adds the header to real responses too", async () => {
    const res = await app.request("/api/pairing", { method: "POST", headers: { Origin: "http://localhost:5173", "CF-Connecting-IP": crypto.randomUUID() } }, env);
    expect(res.status).toBe(201);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:5173");
  });
});
