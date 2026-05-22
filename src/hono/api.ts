import clientsEndpoint from "@/hono/api/clients";
import envelopePreparationEndpoint from "@/hono/api/envelope-preparation";
import envelopesEndpoint from "@/hono/api/envelopes";
import finalDocumentsEndpoint from "@/hono/api/final-documents";
import healthEndpoint from "@/hono/api/health";
import signingEndpoint from "@/hono/api/signing";
import { createHono } from "./factory";

export const apiHono = createHono().basePath("/api");

apiHono.route("/health", healthEndpoint);
apiHono.route("/clients", clientsEndpoint);
apiHono.route("/envelopes", envelopesEndpoint);
apiHono.route("/envelopes", envelopePreparationEndpoint);
apiHono.route("/final-documents", finalDocumentsEndpoint);
apiHono.route("/signing", signingEndpoint);
