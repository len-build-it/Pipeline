import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

export async function buildDemoServer() {
  const app = Fastify({
    logger: false
  });

  // Serve web application assets
  await app.register(fastifyStatic, {
    root: join(rootDir, 'web'),
    prefix: '/'
  });

  // Demo status endpoint confirming demo mode
  app.get('/api/demo-status', async (req, reply) => {
    return {
      demo: true,
      label: 'DEMO MODE - Synthetic Data Only',
      organizations: ['AqOne', 'Dev Guild']
    };
  });

  // SPA fallback to index.html
  app.setNotFoundHandler((req, reply) => {
    if (req.raw.url && req.raw.url.startsWith('/api')) {
      reply.status(404).send({ error: 'Not found in demo API' });
    } else {
      reply.sendFile('index.html');
    }
  });

  return app;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const app = await buildDemoServer();
  const host = '127.0.0.1';
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  try {
    const address = await app.listen({ port, host });
    console.log(`\n======================================================`);
    console.log(`  [DEMO SERVER] Running on ${address}`);
    console.log(`  Notice: Synthetic data only. Loopback access only.`);
    console.log(`======================================================\n`);
  } catch (err) {
    console.error('Failed to start demo server:', err);
    process.exit(1);
  }
}
