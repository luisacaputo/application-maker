import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import express, { NextFunction, Request, Response } from 'express';
import { NestPrismaController } from '../controllers/nestPrismaController';
import {
  getPrismaProvider, parsePrismaSchema, renderNestProjectFiles, renderPrismaProjectFiles,
  validateProjectName, NestPrismaGeneratorService,
} from './nestPrismaGenerator';

test('maps supported database URL schemes to Prisma providers', () => {
  assert.equal(getPrismaProvider('postgresql://user:password@localhost:5432/app'), 'postgresql');
  assert.equal(getPrismaProvider('postgres://user:password@localhost:5432/app'), 'postgresql');
  assert.equal(getPrismaProvider('mysql://user:password@localhost:3306/app'), 'mysql');
  assert.equal(getPrismaProvider('sqlserver://localhost:1433;database=app'), 'sqlserver');
  assert.equal(getPrismaProvider('file:./app.db'), 'sqlite');
});

test('rejects unknown database URL schemes', () => {
  assert.throws(() => getPrismaProvider('mongodb://localhost/app'), /Unsupported connection string/);
});

test('extracts single-field keys and ignores composite-key models for CRUD', () => {
  const schema = `
model Account {
  accountId Int @id @default(autoincrement())
  email     String @unique
  updatedAt DateTime @updatedAt
  posts     Post[]
}

model JoinRecord {
  leftId  Int
  rightId Int

  @@id([leftId, rightId])
}
`;

  assert.deepEqual(parsePrismaSchema(schema), {
    models: [{
      name: 'Account',
      delegate: 'account',
      route: 'account',
      key: {
        name: 'accountId',
        type: 'Int',
        attributes: '@id @default(autoincrement())',
        optional: false,
        list: false,
      },
      fields: [
        {
          name: 'accountId',
          type: 'Int',
          attributes: '@id @default(autoincrement())',
          optional: false,
          list: false,
        },
        { name: 'email', type: 'String', attributes: '@unique', optional: false, list: false },
        { name: 'updatedAt', type: 'DateTime', attributes: '@updatedAt', optional: false, list: false },
      ],
    }],
    skippedModels: ['JoinRecord'],
  });
});

test('renders a NestJS CRUD module with validated DTOs and an allowlist', () => {
  const model = parsePrismaSchema(`
model Account {
  accountId Int @id @default(autoincrement())
  email     String
  updatedAt DateTime @updatedAt
}
`).models[0];
  const files = new Map(renderNestProjectFiles('sample-api', [model]));
  const dto = files.get('src/account/account.dto.ts');
  const service = files.get('src/account/account.service.ts');
  const readme = files.get('README.md');

  assert.match(dto ?? '', /@IsDefined\(\)\s+@IsString\(\)\s+email!: string;/);
  assert.doesNotMatch(dto ?? '', /accountId/);
  assert.doesNotMatch(dto ?? '', /updatedAt/);
  assert.match(service ?? '', /Request contains fields that are not writable/);
  assert.match(service ?? '', /UncheckedCreateInput/);
  assert.match(readme ?? '', /Swagger documentation is available at `\/docs`/);
});

function dtoProperties(dto: string, className: string): Map<string, {
  example: unknown;
  type: string;
  required: boolean;
  isArray?: boolean;
  enum?: string[];
}> {
  const body = dto.split(`export class ${className} {`)[1]?.split('\n}')[0];
  assert.ok(body, `Missing DTO class ${className}`);
  return new Map(Array.from(
    body.matchAll(/@ApiProperty\((.+)\)[\s\S]*?^\s+(\w+)[?!]:/gm),
    match => [match[2], JSON.parse(match[1])],
  ));
}

test('documents realistic examples for every writable scalar without changing DTO defaults', () => {
  const models = parsePrismaSchema(`
model Customer {
  id          Int @id @default(autoincrement())
  email       String @unique
  firstName   String
  last_name   String
  phone       String?
  city        String
  country     String
  postalCode  String
  website     String
  description String
  currency    String @db.VarChar(3)
  code        String @db.VarChar(4)
  age         Int
  balance     Decimal
  rating      Float
  active      Boolean @default(true)
  externalId  BigInt
  registered  DateTime
  metadata    Json
  attachment  Bytes
  tags        String[]
  scores      Int[]
  updatedAt   DateTime @updatedAt
}
`).models;
  const files = new Map(renderNestProjectFiles('sample-api', models));
  const dto = files.get('src/customer/customer.dto.ts') ?? '';
  const create = dtoProperties(dto, 'CreateCustomerDto');
  const update = dtoProperties(dto, 'UpdateCustomerDto');

  assert.match(dto, /import \{ ApiProperty \} from '@nestjs\/swagger'/);
  assert.deepEqual(Object.fromEntries(Array.from(create, ([name, property]) => [name, property.example])), {
    email: 'ana.silva@example.com',
    firstName: 'Ana',
    last_name: 'Silva',
    phone: '+351912345678',
    city: 'Lisboa',
    country: 'Portugal',
    postalCode: '1000-001',
    website: 'https://example.com',
    description: 'Produto de exemplo para testes da API',
    currency: 'EUR',
    code: 'code',
    age: 30,
    balance: 99.9,
    rating: 99.9,
    active: true,
    externalId: '9007199254740993',
    registered: '2026-01-15T10:30:00.000Z',
    metadata: { source: 'website', active: true },
    attachment: 'ZXhlbXBsbyBkZSB0ZXN0ZQ==',
    tags: ['tags de exemplo'],
    scores: [1],
  });
  assert.equal(create.get('email')?.required, true);
  assert.equal(create.get('phone')?.required, false);
  assert.equal(create.get('active')?.required, false);
  assert.equal(create.get('externalId')?.type, 'string');
  assert.equal(create.get('age')?.type, 'integer');
  assert.equal(create.get('metadata')?.type, 'object');
  assert.equal(create.get('scores')?.isArray, true);
  assert.doesNotMatch(dto, /^\s+\w+[?!]?:[^;\n]+=/m);
  assert.doesNotMatch(dto, /\b(id|updatedAt)[?!]:/);
  assert.equal(update.size, create.size);
  for (const [name, property] of update) {
    assert.deepEqual(property.example, create.get(name)?.example);
    assert.equal(property.required, false);
  }
  assert.deepEqual(renderNestProjectFiles('sample-api', models), Array.from(files));
});

test('uses schema enum values and UUID examples for required keys', () => {
  const models = parsePrismaSchema(`
enum State {
  PENDING @map("pending")
  APPROVED
  @@map("states")
}

model Order {
  id         String @id @db.Uuid
  state      State
  states     State[]
  customerId Int
}

model Event {
  id          Int @id @default(autoincrement())
  reference   String @default(uuid())
}
`).models;
  const files = new Map(renderNestProjectFiles('sample-api', models));
  const dto = files.get('src/order/order.dto.ts') ?? '';
  const create = dtoProperties(dto, 'CreateOrderDto');
  const update = dtoProperties(dto, 'UpdateOrderDto');
  assert.deepEqual(create.get('id'), {
    example: '550e8400-e29b-41d4-a716-446655440000',
    type: 'string',
    required: true,
  });
  assert.deepEqual(create.get('state'), {
    example: 'PENDING',
    type: 'string',
    required: true,
    enum: ['PENDING', 'APPROVED'],
  });
  assert.deepEqual(create.get('states'), {
    example: ['PENDING'],
    type: 'string',
    required: true,
    isArray: true,
    enum: ['PENDING', 'APPROVED'],
  });
  assert.equal(create.get('customerId')?.example, 1);
  assert.equal(update.has('id'), false);
  assert.deepEqual(update.get('states')?.example, ['PENDING']);
  const event = dtoProperties(files.get('src/event/event.dto.ts') ?? '', 'CreateEventDto');
  assert.equal(event.get('reference')?.example, '550e8400-e29b-41d4-a716-446655440000');
  assert.equal(event.get('reference')?.required, false);
});

test('validates optional project names without allowing paths or code injection', () => {
  assert.equal(validateProjectName(undefined), undefined);
  assert.equal(validateProjectName('   '), undefined);
  assert.equal(validateProjectName(' customer-api '), 'customer-api');
  assert.equal(validateProjectName('a'), 'a');
  assert.equal(validateProjectName('a'.repeat(80)), 'a'.repeat(80));
  for (const name of [null, 12, {}, '../api', '/tmp/api', 'My API', 'api/name', "api';process.exit()", '-api', 'api-', 'node_modules', 'a'.repeat(81)]) {
    assert.throws(() => validateProjectName(name), /projectName/);
  }
});

for (const framework of ['express', 'fastify'] as const) {
  test(`renders ${framework} with the shared Prisma services, DTO validation and Swagger examples`, () => {
    const models = parsePrismaSchema(`
enum State {
  ACTIVE
  INACTIVE
}
model Account {
  id        Int @id @default(autoincrement())
  email     String
  state     State
  tags      String[]
  updatedAt DateTime @updatedAt
}
`).models;
    const files = new Map(renderPrismaProjectFiles('customer-api', models, framework));
    const nest = new Map(renderNestProjectFiles('customer-api', models));
    const manifest = JSON.parse(files.get('package.json') ?? '{}');
    assert.equal(manifest.name, 'customer-api');
    assert.ok(manifest.dependencies[framework]);
    assert.ok(manifest.dependencies['@prisma/client']);
    assert.ok(manifest.dependencies['class-validator']);
    assert.equal(manifest.dependencies['@nestjs/common'], undefined);
    assert.equal(files.has('src/app.module.ts'), false);
    assert.equal(files.has('nest-cli.json'), false);
    assert.match(files.get('src/account/account.routes.ts') ?? '', /validateBody\(CreateAccountDto, req.body\)/);
    assert.match(files.get('src/account/account.routes.ts') ?? '', /validateBody\(UpdateAccountDto, req.body\)/);
    assert.match(files.get('src/account/account.dto.ts') ?? '', /@IsDefined\(\)\s+@IsString\(\)\s+email!: string;/);
    assert.doesNotMatch(files.get('src/account/account.dto.ts') ?? '', /@nestjs|ApiProperty|updatedAt|\bid[?!]:/);
    const stripNestImports = (source: string) => source.replace(/^import \{ BadRequestException.*\n/m, '').replace('@Injectable()\n', '');
    assert.equal(
      stripNestImports(files.get('src/account/account.service.ts') ?? ''),
      stripNestImports(nest.get('src/account/account.service.ts') ?? ''),
    );
    const document = files.get('src/openapi.ts') ?? '';
    const json = JSON.parse(document.slice(document.indexOf('= ') + 2).trim().replace(/;$/, ''));
    assert.equal(json.info.title, 'customer-api API');
    assert.equal(json.components.schemas.CreateAccountDto.properties.email.example, 'ana.silva@example.com');
    assert.deepEqual(json.components.schemas.CreateAccountDto.properties.tags.example, ['tags de exemplo']);
    assert.deepEqual(json.components.schemas.CreateAccountDto.properties.state.enum, ['ACTIVE', 'INACTIVE']);
    assert.deepEqual(json.components.schemas.CreateAccountDto.required, ['email', 'state', 'tags']);
    assert.equal(json.components.schemas.UpdateAccountDto.required, undefined);
    assert.equal(json.paths['/api/account'].post.responses['201'].description, 'Record created');
    assert.equal(json.paths['/api/account/{id}'].delete.responses['204'].description, 'Record deleted');
    assert.match(files.get('src/app.ts') ?? '', /\/docs/);
    assert.match(files.get('src/common/http.ts') ?? '', /forbidNonWhitelisted: true/);
    assert.match(files.get('src/main.ts') ?? '', /\$connect\(\)/);
    assert.match(files.get('src/main.ts') ?? '', /\$disconnect\(\)/);
    assert.ok(files.get('README.md')?.includes(framework === 'express' ? 'Express REST API' : 'Fastify REST API'));
  });
}

test('Prisma HTTP endpoints forward the selected framework and validated project name', async t => {
  const execute = t.mock.method(NestPrismaGeneratorService.prototype, 'execute', async () => ({ success: true }));
  const app = express();
  app.use(express.json());
  const controller = new NestPrismaController();
  app.post('/generateapi/nodejs/:framework(nestjs|express|fastify)/prisma', (req, res, next) => {
    void controller.handle(req, res).catch(next);
  });
  app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
    res.status(400).json({ error: error.message });
  });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    const post = (framework: string, body: object) => fetch(
      `http://127.0.0.1:${address.port}/generateapi/nodejs/${framework}/prisma`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
    );
    for (const framework of ['nestjs', 'express', 'fastify']) {
      const response = await post(framework, {
        framework, orm: 'prisma', connectionString: 'file:/tmp/test.db', projectName: ' customer-api ',
      });
      assert.equal(response.status, 201);
      assert.deepEqual(execute.mock.calls[execute.mock.callCount() - 1]?.arguments, [{
        framework, connectionString: 'file:/tmp/test.db', projectName: 'customer-api',
      }]);
    }
    const calls = execute.mock.callCount();
    for (const body of [
      { framework: 'nestjs', orm: 'prisma', connectionString: 'file:/tmp/test.db' },
      { framework: 'express', orm: 'typeorm', connectionString: 'file:/tmp/test.db' },
      { framework: 'express', orm: 'prisma', connectionString: '' },
      { framework: 'express', orm: 'prisma', connectionString: 'file:/tmp/test.db', projectName: '../unsafe' },
    ]) {
      assert.equal((await post('express', body)).status, 400);
    }
    assert.equal(execute.mock.callCount(), calls);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
