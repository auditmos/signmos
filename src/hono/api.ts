import clientsEndpoint from "@/hono/api/clients";
import envelopesEndpoint from "@/hono/api/envelopes";
import healthEndpoint from "@/hono/api/health";
import signingEndpoint from "@/hono/api/signing";
import { createHono } from "./factory";

export const apiHono = createHono().basePath("/api");

apiHono.route("/health", healthEndpoint);
apiHono.route("/clients", clientsEndpoint);
apiHono.route("/envelopes", envelopesEndpoint);
apiHono.route("/signing", signingEndpoint);
