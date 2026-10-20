import type { PrismaFramework, PrismaModel } from './nestPrismaGenerator';

type HttpFramework = Exclude<PrismaFramework, 'nestjs'>;

export function renderHttpModelRoutes(model: PrismaModel, framework: HttpFramework): Array<[string, string]> {
  const imports = `import { Create${model.name}Dto, Update${model.name}Dto } from './${model.route}.dto';
import { ${model.name}Service } from './${model.route}.service';
import { prisma } from '../prisma/prisma.service';
import { paginationValue, validateBody } from '../common/http';

const service = new ${model.name}Service(prisma);
`;
  const source = framework === 'express'
    ? `import { Router, Request, Response, NextFunction } from 'express';
${imports}
const router = Router();
const handle = (action: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction): void => {
    void Promise.resolve().then(() => action(req, res)).catch(next);
  };

router.get('/', handle(async (req, res) =>
  res.json(await service.list(paginationValue(req.query.skip), paginationValue(req.query.take))),
));
router.get('/:id', handle(async (req, res) =>
  res.json(await service.getById(req.params.id)),
));
router.post('/', handle(async (req, res) =>
  res.status(201).json(await service.create(validateBody(Create${model.name}Dto, req.body))),
));
router.put('/:id', handle(async (req, res) =>
  res.json(await service.update(req.params.id, validateBody(Update${model.name}Dto, req.body))),
));
router.delete('/:id', handle(async (req, res) => {
  await service.delete(req.params.id);
  res.status(204).end();
}));

export default router;
`
    : `import { FastifyPluginAsync } from 'fastify';
${imports}
const routes: FastifyPluginAsync = async (app) => {
  app.get<{ Querystring: { skip?: string; take?: string } }>('/', async (req) =>
    service.list(paginationValue(req.query.skip), paginationValue(req.query.take)),
  );
  app.get<{ Params: { id: string } }>('/:id', async (req) =>
    service.getById(req.params.id),
  );
  app.post('/', async (req, reply) =>
    reply.code(201).send(await service.create(validateBody(Create${model.name}Dto, req.body))),
  );
  app.put<{ Params: { id: string } }>('/:id', async (req) =>
    service.update(req.params.id, validateBody(Update${model.name}Dto, req.body)),
  );
  app.delete<{ Params: { id: string } }>('/:id', async (req, reply) => {
    await service.delete(req.params.id);
    return reply.code(204).send();
  });
};

export default routes;
`;
  return [[`src/${model.route}/${model.route}.routes.ts`, source]];
}

function openApiDocument(projectName: string, models: PrismaModel[], schemas: Record<string, unknown>) {
  const paths: Record<string, unknown> = {};
  for (const model of models) {
    const responses = {
      '400': { description: 'Invalid request' },
      '404': { description: 'Record not found' },
      '500': { description: 'Internal server error' },
    };
    const body = (mode: 'Create' | 'Update') => ({
      required: true,
      content: { 'application/json': { schema: { $ref: `#/components/schemas/${mode}${model.name}Dto` } } },
    });
    const idParameter = {
      name: 'id',
      in: 'path',
      required: true,
      schema: { type: model.key.type === 'Int' ? 'integer' : 'string' },
      example: model.key.type === 'String' ? 'record-id' : '1',
    };
    paths[`/api/${model.route}`] = {
      get: {
        tags: [model.name],
        summary: `List ${model.name} records with pagination`,
        parameters: [
          { name: 'skip', in: 'query', schema: { type: 'integer', minimum: 0, default: 0 } },
          { name: 'take', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 50 } },
        ],
        responses: { '200': { description: 'Records' }, ...responses },
      },
      post: {
        tags: [model.name],
        summary: `Create a ${model.name}`,
        requestBody: body('Create'),
        responses: { '201': { description: 'Record created' }, ...responses },
      },
    };
    paths[`/api/${model.route}/{id}`] = {
      get: {
        tags: [model.name],
        summary: `Get a ${model.name} by its unique key`,
        parameters: [idParameter],
        responses: { '200': { description: 'Record' }, ...responses },
      },
      put: {
        tags: [model.name],
        summary: `Update a ${model.name}`,
        parameters: [idParameter],
        requestBody: body('Update'),
        responses: { '200': { description: 'Record updated' }, ...responses },
      },
      delete: {
        tags: [model.name],
        summary: `Delete a ${model.name}`,
        parameters: [idParameter],
        responses: { '204': { description: 'Record deleted' }, ...responses },
      },
    };
  }
  return {
    openapi: '3.0.3',
    info: { title: `${projectName} API`, version: '1.0.0', description: 'CRUD API generated from the existing database schema' },
    paths,
    components: { schemas },
  };
}

export function renderHttpBootstrapFiles(
  projectName: string, framework: HttpFramework, models: PrismaModel[], schemas: Record<string, unknown>,
  prismaVersion: string,
): Array<[string, string]> {
  const isExpress = framework === 'express';
  const routeImports = models.map(model =>
    `import ${model.name}Routes from './${model.route}/${model.route}.routes';`,
  ).join('\n');
  const registration = models.map(model => isExpress
    ? `  app.use('/api/${model.route}', ${model.name}Routes);`
    : `  app.register(${model.name}Routes, { prefix: '/api/${model.route}' });`,
  ).join('\n');
  const files: Array<[string, string]> = [
    ['package.json', JSON.stringify({
      name: projectName,
      version: '1.0.0',
      private: true,
      scripts: {
        build: 'tsc -p tsconfig.build.json',
        start: 'node dist/main.js',
        'start:dev': 'tsx watch src/main.ts',
        'start:prod': 'node dist/main.js',
        postinstall: 'prisma generate',
        'prisma:generate': 'prisma generate',
      },
      dependencies: {
        '@prisma/client': `^${prismaVersion}`,
        'class-transformer': '^0.5.1',
        'class-validator': '^0.14.1',
        dotenv: '^16.4.7',
        'reflect-metadata': '^0.2.2',
        ...(isExpress ? {
          express: '^4.21.2',
          cors: '^2.8.5',
          'swagger-ui-express': '^5.0.1',
        } : {
          fastify: '^5.2.1',
          '@fastify/cors': '^10.0.1',
          '@fastify/swagger': '^9.4.0',
          '@fastify/swagger-ui': '^5.2.0',
        }),
      },
      devDependencies: {
        '@types/node': '^20.17.10',
        'openapi-types': '^12.1.3',
        ...(isExpress ? {
          '@types/express': '^4.17.21',
          '@types/cors': '^2.8.17',
          '@types/swagger-ui-express': '^4.1.8',
        } : {}),
        prisma: `^${prismaVersion}`,
        tsx: '^4.19.2',
        typescript: '^5.7.2',
      },
      engines: { node: '>=20' },
    }, null, 2) + '\n'],
    ['src/prisma/prisma.service.ts', `import { PrismaClient } from '@prisma/client';

export { PrismaClient as PrismaService };
export const prisma = new PrismaClient();
`],
    ['src/openapi.ts', `import type { OpenAPIV3 } from 'openapi-types';\n\nexport const openapi: OpenAPIV3.Document = ${JSON.stringify(openApiDocument(projectName, models, schemas), null, 2)};\n`],
    ['src/common/http.ts', `import { plainToInstance, ClassConstructor } from 'class-transformer';
import { validateSync } from 'class-validator';

class HttpError extends Error {
  constructor(readonly statusCode: number, message: string) {
    super(message);
  }
}

export class BadRequestException extends HttpError {
  constructor(message: string) { super(400, message); }
}

export class NotFoundException extends HttpError {
  constructor(message: string) { super(404, message); }
}

export function validateBody<T extends object>(dto: ClassConstructor<T>, body: unknown): T {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new BadRequestException('Request body must be a JSON object');
  }
  const value = plainToInstance(dto, body);
  const errors = validateSync(value, {
    whitelist: true,
    forbidNonWhitelisted: true,
    forbidUnknownValues: true,
  });
  if (errors.length > 0) {
    throw new BadRequestException(errors.flatMap(error =>
      Object.values(error.constraints ?? { invalid: error.property + ' is invalid' }),
    ).join('; '));
  }
  return value;
}

export function paginationValue(value: unknown): string | undefined {
  if (value === undefined || typeof value === 'string') return value;
  throw new BadRequestException('Pagination parameters must be single values');
}

export function serializeJson(value: unknown): string {
  return JSON.stringify(value, (_key, item: unknown) =>
    typeof item === 'bigint' ? item.toString() : item,
  );
}

export function errorResponse(error: unknown): { statusCode: number; message: string } {
  if (error instanceof HttpError) return { statusCode: error.statusCode, message: error.message };
  if (error instanceof Error && 'statusCode' in error &&
      typeof error.statusCode === 'number' && error.statusCode >= 400 && error.statusCode < 500) {
    return { statusCode: error.statusCode, message: error.message };
  }
  console.error(error);
  return { statusCode: 500, message: 'Internal server error' };
}
`],
    ['src/app.ts', isExpress
      ? `import 'dotenv/config';
import 'reflect-metadata';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import { errorResponse, serializeJson } from './common/http';
import { openapi } from './openapi';
${routeImports}

export function createApp() {
  const app = express();
  app.set('json replacer', (_key: string, value: unknown) =>
    typeof value === 'bigint' ? value.toString() : value,
  );
  app.use(express.json());
  const origins = process.env.CORS_ORIGINS?.split(',').map(origin => origin.trim()).filter(Boolean) ?? [];
  if (origins.length > 0) app.use(cors({ origin: origins }));
  app.get('/docs-json', (_req, res) => { res.json(openapi); });
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapi));
${registration}
  app.use((_req, res) => { res.status(404).json({ statusCode: 404, message: 'Route not found' }); });
  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const result = errorResponse(error);
    res.status(result.statusCode).type('json').send(serializeJson(result));
  });
  return app;
}
`
      : `import 'dotenv/config';
import 'reflect-metadata';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { errorResponse, serializeJson } from './common/http';
import { openapi } from './openapi';
${routeImports}

export function createApp() {
  const app = Fastify({ logger: true });
  app.setReplySerializer(serializeJson);
  const origins = process.env.CORS_ORIGINS?.split(',').map(origin => origin.trim()).filter(Boolean) ?? [];
  if (origins.length > 0) app.register(cors, { origin: origins });
  app.register(swagger, { mode: 'static', specification: { document: openapi } });
  app.register(swaggerUi, { routePrefix: '/docs' });
  app.get('/docs-json', async () => openapi);
${registration}
  app.setErrorHandler((error, _req, reply) => {
    const result = errorResponse(error);
    void reply.code(result.statusCode).send(result);
  });
  return app;
}
`],
    ['src/main.ts', `import 'dotenv/config';
import { createApp } from './app';
import { prisma } from './prisma/prisma.service';

async function bootstrap(): Promise<void> {
  await prisma.$connect();
  const app = createApp();
  ${isExpress
    ? `const server = await new Promise<ReturnType<typeof app.listen>>((resolve, reject) => {
    const listener = app.listen(Number(process.env.PORT ?? 3000), process.env.HOST ?? '0.0.0.0', () => resolve(listener));
    listener.once('error', reject);
  });`
    : `await app.listen({ port: Number(process.env.PORT ?? 3000), host: process.env.HOST ?? '0.0.0.0' });`}
  const shutdown = async (): Promise<void> => {
    ${isExpress
      ? `await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));`
      : 'await app.close();'}
    await prisma.$disconnect();
  };
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => {
      void shutdown().catch(error => {
        console.error(error);
        process.exit(1);
      });
    });
  }
}

void bootstrap().catch(async error => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
`],
  ];
  return files;
}
