import Fastify, { FastifyInstance } from "fastify";
import { generationRoute } from "./generation.js";
import cors from "@fastify/cors";
import { authenticate } from "./utils/authenticate.js";

const app = Fastify({
  logger: true,
});

await app.register(cors, {
  origin: true,
});
await app.register(generationRoute);

export async function meRoute(app: FastifyInstance) {
  app.get(
    "/me",
    {
      preHandler: authenticate,
    },
    async (request) => {
      return {
        user: request.user,
      };
    },
  );
}
