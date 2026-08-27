import Fastify, { FastifyInstance } from "fastify";
import { generationRoute } from "./generation.js";
import cors from "@fastify/cors";

const app = Fastify({
  logger: true,
});

await app.register(cors, {
  origin: true,
});
await app.register(generationRoute);

export async function healthRoute(app: FastifyInstance) {
  app.get("/health", async () => {
    return {
      status: "ok",
      service: "g7i-read-api",
      message: "Service is running and healthy",
    };
  });
}
