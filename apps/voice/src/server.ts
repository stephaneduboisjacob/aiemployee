import Fastify from 'fastify';
import cors from '@fastify/cors';
import { z } from 'zod';

const app = Fastify({ logger: { redact: ['req.headers.authorization', 'req.headers.cookie'] }, bodyLimit: 65_536 });
const apiUrl = process.env.API_URL ?? 'http://localhost:4000';
await app.register(cors, { origin: process.env.WEB_ORIGIN ?? false });

app.get('/health', async () => ({ status: 'ok', service: 'voice-ingress', mode: process.env.DEMO_MODE === 'true' ? 'simulator' : 'provider-required' }));
app.post('/voice/simulate', async (request, reply) => {
  if (process.env.DEMO_MODE !== 'true') return reply.code(404).send({ error: 'not_found' });
  const schema = z.object({ caller: z.object({ name: z.string(), phone: z.string(), email: z.string().email(), address: z.string(), city: z.string(), region: z.string(), postalCode: z.string(), issue: z.string() }), transcript: z.string().min(12), failOnceStep: z.string().optional() });
  const parsed = schema.safeParse(request.body);
  if (!parsed.success) return reply.code(400).send({ error: 'invalid_call', issues: parsed.error.issues });
  const session = await fetch(`${apiUrl}/api/v1/demo/session`).then((response) => response.json()) as { token: string };
  const response = await fetch(`${apiUrl}/api/v1/calls/inbound`, { method: 'POST', headers: { Authorization: `Bearer ${session.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(parsed.data) });
  return reply.code(response.status).send(await response.json());
});

await app.listen({ host: process.env.HOST ?? '0.0.0.0', port: Number(process.env.PORT ?? 4100) });
