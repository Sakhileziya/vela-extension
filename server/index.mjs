import Fastify from 'fastify';
import cors from 'fastify-cors';
import dotenv from 'dotenv';
import { appendEvent, readEvents } from './storage.js';

dotenv.config();

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || 'dev-change-me';

const fastify = Fastify({ logger: true });
await fastify.register(cors, { origin: true });

fastify.addHook('onRequest', async (request, reply) => {
  // basic API key auth for now
  if (request.routerPath && request.routerPath.startsWith('/v1')) {
    const key = request.headers['x-api-key'] || '';
    if (!key || key !== ADMIN_API_KEY) {
      reply.code(401).send({ error: 'Unauthorized' });
    }
  }
});

fastify.get('/health', async () => ({ status: 'ok', ts: new Date().toISOString() }));

fastify.post('/v1/events', async (request, reply) => {
  const body = request.body;
  if (!body || typeof body !== 'object') return reply.code(400).send({ error: 'invalid body' });
  const rec = await appendEvent(body);
  return reply.code(201).send(rec);
});

fastify.get('/v1/events', async (request) => {
  const q = request.query || {};
  const limit = parseInt(q.limit || '100', 10);
  const events = await readEvents();
  return events.slice(-Math.max(0, Math.min(1000, limit)));
});

const start = async () => {
  try {
    await fastify.listen({ port: Number(PORT), host: HOST });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
