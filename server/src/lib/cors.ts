import type { MiddlewareHandler } from "hono";
import { cors } from "hono/cors";
import type { AppContext } from "../env";

const DEFAULT_ORIGINS = "http://localhost:5173";

const allowedOrigins = (list: string | undefined) =>
  (list ?? DEFAULT_ORIGINS)
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

// the headset page is served from another origin; only listed ones may call the API from a browser
export const corsForApi: MiddlewareHandler<AppContext> = (c, next) =>
  cors({
    origin: (origin) => (allowedOrigins(c.env.ALLOWED_ORIGINS).includes(origin) ? origin : null),
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowHeaders: ["Authorization", "Content-Type"],
    maxAge: 600,
  })(c, next);
