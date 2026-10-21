import { execFile } from 'child_process';
import { randomBytes } from 'crypto';
import { existsSync } from 'fs';
import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'fs/promises';
import path from 'path';
import { promisify } from 'util';
import { renderHttpBootstrapFiles, renderHttpModelRoutes } from './httpPrismaTemplates';

const execFileAsync = promisify(execFile);
const GENERATED_PROJECTS_DIR = path.resolve(__dirname, '..', '..', 'generated-projects');
const PRISMA_VERSION = '5.22.0';

type PrismaProvider = 'mysql' | 'postgresql' | 'sqlserver' | 'sqlite';
export type PrismaFramework = 'nestjs' | 'express' | 'fastify';

interface PrismaField {
  name: string;
  type: string;
  attributes: string;
  optional: boolean;
  list: boolean;
  enumValues?: string[];
}

export interface PrismaModel {
  name: string;
  delegate: string;
  route: string;
  key: PrismaField;
  fields: PrismaField[];
}

interface ParsedSchema {
  models: PrismaModel[];
  skippedModels: string[];
}

export interface NestPrismaGenerateRequest {
  connectionString: string;
  framework?: PrismaFramework;
  projectName?: string;
}

export function validateProjectName(projectName: unknown): string | undefined {
  if (projectName === undefined || projectName === '') return undefined;
  if (typeof projectName !== 'string') throw new Error('projectName must be a string');
  const name = projectName.trim();
  if (name === '') return undefined;
  if (!/^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/.test(name) || name === 'node_modules') {
    throw new Error('projectName must contain 1-80 lowercase letters, numbers or hyphens, and start and end with a letter or number');
  }
  return name;
}

export function getPrismaProvider(connectionString: string): PrismaProvider {
  const scheme = /^([a-z][a-z\d+.-]*):/i.exec(connectionString.trim())?.[1].toLowerCase();
  const providers: Record<string, PrismaProvider> = {
    mysql: 'mysql',
    postgres: 'postgresql',
    postgresql: 'postgresql',
    sqlserver: 'sqlserver',
    file: 'sqlite',
  };
  const provider = scheme ? providers[scheme] : undefined;

  if (!provider) {
    throw new Error('Unsupported connection string. Use MySQL, PostgreSQL, SQL Server, or SQLite.');
  }

  return provider;
}

export function ensurePostgresSsl(connectionString: string): string {
  if (!/^postgres(?:ql)?:/i.test(connectionString)) return connectionString;
  const url = new URL(connectionString);
  if (!url.searchParams.has('sslmode')) url.searchParams.set('sslmode', 'require');
  return url.toString();
}

export function parsePrismaSchema(schema: string): ParsedSchema {
  const scalarTypes = new Set([
    'String',
    'Boolean',
    'Int',
    'BigInt',
    'Float',
    'Decimal',
    'DateTime',
    'Json',
    'Bytes',
  ]);
  const enumTypes = new Map(
    Array.from(schema.matchAll(/^\s*enum\s+([A-Za-z_]\w*)\s*\{([^}]+)\}/gm), match => [
      match[1],
      Array.from(match[2].matchAll(/^\s*([A-Za-z_]\w*)\b/gm), value => value[1]),
    ]),
  );
  const models: PrismaModel[] = [];
  const skippedModels: string[] = [];
  const modelBlocks = /^\s*model\s+([A-Za-z_]\w*)\s*\{([\s\S]*?)^\s*\}/gm;

  for (const match of schema.matchAll(modelBlocks)) {
    const name = match[1];
    const fields: PrismaField[] = [];

    for (const line of match[2].split('\n')) {
      const fieldMatch = /^\s*([A-Za-z_]\w*)\s+([A-Za-z_]\w*)(\?)?(\[\])?\s*(.*)$/.exec(line);
      if (!fieldMatch) continue;

      const [, fieldName, type, optional, list, attributes] = fieldMatch;
      if (!scalarTypes.has(type) && !enumTypes.has(type)) continue;
      fields.push({
        name: fieldName, type, attributes, optional: Boolean(optional), list: Boolean(list),
        ...(enumTypes.has(type) ? { enumValues: enumTypes.get(type) } : {}),
      });
    }

    const idFields = fields.filter(field => /(?:^|\s)@id(?:\s|\(|$)/.test(field.attributes));
    const uniqueFields = fields.filter(field => /(?:^|\s)@unique(?:\s|\(|$)/.test(field.attributes));
    const key = idFields.length === 1 ? idFields[0] : idFields.length === 0 && uniqueFields.length === 1
      ? uniqueFields[0]
      : undefined;

    if (!key || !['String', 'Int', 'BigInt'].includes(key.type)) {
      skippedModels.push(name);
      continue;
    }

    models.push({
      name,
      delegate: name[0].toLowerCase() + name.slice(1),
      route: name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase(),
      key,
      fields,
    });
  }

  return { models, skippedModels };
}

function dtoExample(field: PrismaField): unknown {
  if (field.enumValues?.length) return field.enumValues[0];

  switch (field.type) {
    case 'Boolean': return true;
    case 'Int': return /age|idade/i.test(field.name) ? 30 : 1;
    case 'BigInt': return '9007199254740993';
    case 'Float':
    case 'Decimal': return 99.9;
    case 'DateTime': return '2026-01-15T10:30:00.000Z';
    case 'Json': return { source: 'website', active: true };
    case 'Bytes': return 'ZXhlbXBsbyBkZSB0ZXN0ZQ==';
  }

  const name = field.name.replace(/_/g, '').toLowerCase();
  let example: string;
  if (/@db\.Uuid\b|@default\s*\(\s*uuid\s*\(/.test(field.attributes) || name.includes('uuid')) {
    example = '550e8400-e29b-41d4-a716-446655440000';
  } else if (name.includes('email')) {
    example = 'ana.silva@example.com';
  } else if (/firstname|givenname|primeironome/.test(name)) {
    example = 'Ana';
  } else if (/lastname|surname|sobrenome|apelido/.test(name)) {
    example = 'Silva';
  } else if (/username|login/.test(name)) {
    example = 'ana.silva';
  } else if (/phone|mobile|telefone|telemovel|celular/.test(name)) {
    example = '+351912345678';
  } else if (/password|senha/.test(name)) {
    example = 'Teste@2026!';
  } else if (/url|website|link/.test(name)) {
    example = 'https://example.com';
  } else if (/postal|zipcode|cep/.test(name)) {
    example = '1000-001';
  } else if (/address|endereco|morada/.test(name)) {
    example = 'Rua do Comercio, 25';
  } else if (/city|cidade/.test(name)) {
    example = 'Lisboa';
  } else if (/country|pais/.test(name)) {
    example = 'Portugal';
  } else if (/currency|moeda/.test(name)) {
    example = 'EUR';
  } else if (/description|descricao/.test(name)) {
    example = 'Produto de exemplo para testes da API';
  } else if (/name|nome/.test(name)) {
    example = 'Ana Silva';
  } else {
    example = `${field.name} de exemplo`;
  }

  const maxLength = /@db\.(?:VarChar|NVarChar|Char|NChar)\(\s*(\d+)\s*\)/i.exec(field.attributes);
  return maxLength ? example.slice(0, Number(maxLength[1])) : example;
}

function dtoProperty(field: PrismaField, mode: 'create' | 'update') {
  const isOptional = mode === 'update' || field.optional || /@default\s*\(|@updatedAt\b/.test(field.attributes);
  const swaggerTypes: Record<string, string> = {
    Boolean: 'boolean', Int: 'integer', Float: 'number', Decimal: 'number', Json: 'object',
  };
  const example = dtoExample(field);
  return {
    example: field.list ? [example] : example,
    type: swaggerTypes[field.type] ?? 'string',
    required: !isOptional,
    ...(field.list ? { isArray: true } : {}),
    ...(field.enumValues ? { enum: field.enumValues } : {}),
  };
}

function dtoSchema(fields: PrismaField[], mode: 'create' | 'update') {
  const properties = Object.fromEntries(fields.map(field => {
    const { required: _required, isArray, example, ...schema } = dtoProperty(field, mode);
    return [field.name, isArray ? { type: 'array', items: schema, example } : { ...schema, example }];
  }));
  const required = fields.filter(field => dtoProperty(field, mode).required).map(field => field.name);
  return {
    type: 'object',
    properties,
    ...(required.length > 0 ? { required } : {}),
    additionalProperties: false,
  };
}

function dtoField(field: PrismaField, mode: 'create' | 'update', swagger = true): string {
  const typeMap: Record<string, string> = {
    String: 'string',
    Boolean: 'boolean',
    Int: 'number',
    BigInt: 'string',
    Float: 'number',
    Decimal: 'number',
    DateTime: 'string',
    Json: 'unknown',
    Bytes: 'string',
  };
  const validatorMap: Record<string, string> = {
    String: 'IsString',
    Boolean: 'IsBoolean',
    Int: 'IsInt',
    BigInt: 'IsString',
    Float: 'IsNumber',
    Decimal: 'IsNumber',
    DateTime: 'IsDateString',
    Json: 'Allow',
    Bytes: 'IsString',
  };
  const decorators = new Set<string>();
  const isOptional = mode === 'update' || field.optional || /@default\s*\(|@updatedAt\b/.test(field.attributes);
  decorators.add(isOptional ? 'IsOptional' : 'IsDefined');
  if (field.list) decorators.add('IsArray');
  decorators.add(validatorMap[field.type] ?? 'IsString');

  const validator = validatorMap[field.type] ?? 'IsString';
  const property = swagger ? `  @ApiProperty(${JSON.stringify(dtoProperty(field, mode))})\n` : '';
  return `${property}${Array.from(decorators, decorator => {
    const options = decorator === validator && field.list && validator !== 'Allow' ? '{ each: true }' : '';
    return `  @${decorator}(${options})`;
  }).join('\n')}
  ${field.name}${isOptional ? '?' : '!'}: ${typeMap[field.type] ?? 'string'}${field.list ? '[]' : ''};`;
}

export function renderNestProjectFiles(projectName: string, models: PrismaModel[]): Array<[string, string]> {
  return renderPrismaProjectFiles(projectName, models, 'nestjs');
}

export function renderPrismaProjectFiles(
  projectName: string, models: PrismaModel[], framework: PrismaFramework,
): Array<[string, string]> {
  const isNest = framework === 'nestjs';
  const frameworkName = { nestjs: 'NestJS', express: 'Express', fastify: 'Fastify' }[framework];
  const modelImports = models.map(model => `import { ${model.name}Module } from './${model.route}/${model.route}.module';`);
  const modelModules = models.map(model => `    ${model.name}Module,`);
  const files: Array<[string, string]> = [
    ...(isNest ? [['package.json', JSON.stringify({
      name: projectName,
      version: '1.0.0',
      private: true,
      scripts: {
        build: 'nest build',
        start: 'nest start',
        'start:dev': 'nest start --watch',
        'start:prod': 'node dist/main',
        postinstall: 'prisma generate',
        'prisma:generate': 'prisma generate',
      },
      dependencies: {
        '@nestjs/common': '^10.4.15',
        '@nestjs/core': '^10.4.15',
        '@nestjs/platform-express': '^10.4.15',
        '@nestjs/swagger': '^7.4.2',
        '@prisma/client': `^${PRISMA_VERSION}`,
        'class-transformer': '^0.5.1',
        'class-validator': '^0.14.1',
        dotenv: '^16.4.7',
        'reflect-metadata': '^0.2.2',
        rxjs: '^7.8.1',
      },
      devDependencies: {
        '@nestjs/cli': '^10.4.9',
        '@types/node': '^20.17.10',
        prisma: `^${PRISMA_VERSION}`,
        typescript: '^5.7.2',
      },
    }, null, 2) + '\n'],
    ['nest-cli.json', JSON.stringify({ collection: '@nestjs/schematics', sourceRoot: 'src' }, null, 2) + '\n']] as Array<[string, string]> : []),
    ['tsconfig.json', JSON.stringify({
      compilerOptions: {
        module: 'commonjs',
        declaration: true,
        removeComments: true,
        emitDecoratorMetadata: true,
        experimentalDecorators: true,
        allowSyntheticDefaultImports: true,
        ...(!isNest ? { esModuleInterop: true } : {}),
        target: 'ES2022',
        sourceMap: true,
        outDir: './dist',
        baseUrl: './',
        incremental: true,
        skipLibCheck: true,
        strictNullChecks: true,
        noImplicitAny: false,
        strictBindCallApply: true,
        forceConsistentCasingInFileNames: true,
        noFallthroughCasesInSwitch: true,
      },
    }, null, 2) + '\n'],
    ['tsconfig.build.json', JSON.stringify({ extends: './tsconfig.json', exclude: ['node_modules', 'test', 'dist', '**/*spec.ts'] }, null, 2) + '\n'],
    ['.env.example', 'DATABASE_URL="replace-with-your-database-connection-string"\nCORS_ORIGINS=\n'],
    ['.env', 'DATABASE_URL="replace-with-your-database-connection-string"\nCORS_ORIGINS=\n'],
    ['.gitignore', 'node_modules/\ndist/\n.env\n*.tsbuildinfo\n'],
    ['README.md', `# ${projectName}

${frameworkName} REST API generated from an existing database with Prisma.

## Setup

1. Update \`DATABASE_URL\` in \`.env\` with the database connection string.
2. Configure allowed browser origins in \`CORS_ORIGINS\`, as a comma-separated list.
3. Install dependencies and start the API:

\`\`\`sh
npm install
npm run start:dev
\`\`\`

Swagger documentation is available at \`/docs\`. Generated CRUD endpoints are
under \`/api/<model-name>\`; list endpoints accept \`skip\` and \`take\` (maximum
100 records per request).

Create and update DTOs include realistic, synthetic Swagger examples based on
field names and Prisma types, including enum values and arrays. No database
records are read for these examples, and they are not runtime defaults.
Replace unique values and foreign keys with suitable test data before submitting.

The Prisma schema in \`prisma/schema.prisma\` was introspected from the source
database. Review the schema and generated API before exposing it to users.
`],
    ...(isNest ? [['src/main.ts', `import 'dotenv/config';
import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { BigIntSerializationInterceptor } from './common/bigint-serialization.interceptor';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }));
  app.useGlobalInterceptors(new BigIntSerializationInterceptor());
  const corsOrigins = process.env.CORS_ORIGINS?.split(',').map(origin => origin.trim()).filter(Boolean) ?? [];
  if (corsOrigins.length > 0) app.enableCors({ origin: corsOrigins });

  const config = new DocumentBuilder()
    .setTitle('${projectName} API')
    .setDescription('CRUD API generated from the existing database schema')
    .setVersion('1.0.0')
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));

  await app.listen(process.env.PORT ?? 3000);
}

void bootstrap();
`],
    ['src/app.module.ts', `${modelImports.join('\n')}
import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
${modelModules.join('\n')}
  ],
})
export class AppModule {}
`],
    ['src/prisma/prisma.module.ts', `import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
`],
    ['src/prisma/prisma.service.ts', `import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy, OnModuleInit {
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
`],
    ['src/common/bigint-serialization.interceptor.ts', `import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { map, Observable } from 'rxjs';

function serializeBigInt(value: unknown): unknown {
  const serialized = JSON.stringify(value, (_key, item: unknown) =>
    typeof item === 'bigint' ? item.toString() : item,
  );
  return serialized === undefined ? value : JSON.parse(serialized);
}

@Injectable()
export class BigIntSerializationInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map(serializeBigInt));
  }
}
`]] as Array<[string, string]> : []),
  ];

  const schemas: Record<string, ReturnType<typeof dtoSchema>> = {};
  for (const model of models) {
    const createFields = model.fields.filter(field =>
      !/@updatedAt\b/.test(field.attributes) &&
      (field.name !== model.key.name || !/@default\s*\(/.test(field.attributes)),
    );
    const updateFields = model.fields.filter(field =>
      field.name !== model.key.name && !/@updatedAt\b/.test(field.attributes),
    );
    schemas[`Create${model.name}Dto`] = dtoSchema(createFields, 'create');
    schemas[`Update${model.name}Dto`] = dtoSchema(updateFields, 'update');
    const createAllowedFields = JSON.stringify(createFields.map(field => field.name));
    const updateAllowedFields = JSON.stringify(updateFields.map(field => field.name));
    const fieldTypes = JSON.stringify(Object.fromEntries(model.fields.map(field => [field.name, field.type])));
    const dtoValidatorSet = new Set<string>(['IsDefined', 'IsOptional']);
    for (const field of [...createFields, ...updateFields]) {
      if (field.list) dtoValidatorSet.add('IsArray');
      dtoValidatorSet.add(({
        String: 'IsString',
        Boolean: 'IsBoolean',
        Int: 'IsInt',
        BigInt: 'IsString',
        Float: 'IsNumber',
        Decimal: 'IsNumber',
        DateTime: 'IsDateString',
        Json: 'Allow',
        Bytes: 'IsString',
      } as Record<string, string>)[field.type] ?? 'IsString');
    }
    const dtoValidators = Array.from(dtoValidatorSet).sort();
    const dtoFields = (fields: PrismaField[], mode: 'create' | 'update') =>
      fields.map(field => dtoField(field, mode, isNest)).join('\n\n');
    const keyParser = model.key.type === 'Int'
      ? `const parsed = Number(id);
    if (!Number.isSafeInteger(parsed)) throw new BadRequestException('ID must be a valid integer');
    return parsed;`
      : model.key.type === 'BigInt'
        ? `try {
      return BigInt(id);
    } catch {
      throw new BadRequestException('ID must be a valid integer');
    }`
        : 'return id;';

    files.push(
      ...(isNest ? [[`src/${model.route}/${model.route}.module.ts`, `import { Module } from '@nestjs/common';
import { ${model.name}Controller } from './${model.route}.controller';
import { ${model.name}Service } from './${model.route}.service';

@Module({
  controllers: [${model.name}Controller],
  providers: [${model.name}Service],
})
export class ${model.name}Module {}
`],
      [`src/${model.route}/${model.route}.controller.ts`, `import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Put, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Create${model.name}Dto, Update${model.name}Dto } from './${model.route}.dto';
import { ${model.name}Service } from './${model.route}.service';

@ApiTags('${model.name}')
@Controller('api/${model.route}')
export class ${model.name}Controller {
  constructor(private readonly service: ${model.name}Service) {}

  @Get()
  @ApiOperation({ summary: 'List ${model.name} records with pagination' })
  list(@Query('skip') skip?: string, @Query('take') take?: string) {
    return this.service.list(skip, take);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a ${model.name} by its unique key' })
  getById(@Param('id') id: string) {
    return this.service.getById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a ${model.name}' })
  create(@Body() body: Create${model.name}Dto) {
    return this.service.create(body);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a ${model.name}' })
  update(@Param('id') id: string, @Body() body: Update${model.name}Dto) {
    return this.service.update(id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a ${model.name}' })
  delete(@Param('id') id: string) {
    return this.service.delete(id);
  }
}
`]] as Array<[string, string]> : renderHttpModelRoutes(model, framework)),
      [`src/${model.route}/${model.route}.dto.ts`, `${isNest ? "import { ApiProperty } from '@nestjs/swagger';\n" : ''}import { ${dtoValidators.join(', ')} } from 'class-validator';

export class Create${model.name}Dto {
${dtoFields(createFields, 'create')}
}

export class Update${model.name}Dto {
${dtoFields(updateFields, 'update')}
}
`],
      [`src/${model.route}/${model.route}.service.ts`, `${isNest
        ? "import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';"
        : "import { BadRequestException, NotFoundException } from '../common/http';"}
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { Create${model.name}Dto, Update${model.name}Dto } from './${model.route}.dto';

const fieldTypes: Record<string, string> = ${fieldTypes};

${isNest ? '@Injectable()\n' : ''}export class ${model.name}Service {
  constructor(private readonly prisma: PrismaService) {}

  list(skipValue?: string, takeValue?: string) {
    const skip = skipValue === undefined ? 0 : Number(skipValue);
    const take = takeValue === undefined ? 50 : Number(takeValue);
    if (!Number.isSafeInteger(skip) || skip < 0 || !Number.isSafeInteger(take) || take < 1) {
      throw new BadRequestException('skip and take must be valid positive integers');
    }
    return this.prisma.${model.delegate}.findMany({ skip, take: Math.min(take, 100) });
  }

  async getById(id: string) {
    const item = await this.prisma.${model.delegate}.findUnique({
      where: { ${model.key.name}: this.parseId(id) },
    });
    if (!item) throw new NotFoundException('${model.name} not found');
    return item;
  }

  create(data: Create${model.name}Dto) {
    return this.prisma.${model.delegate}.create({
      data: this.parseInput(data, new Set<string>(${createAllowedFields})) as Prisma.${model.name}UncheckedCreateInput,
    });
  }

  async update(id: string, data: Update${model.name}Dto) {
    await this.getById(id);
    return this.prisma.${model.delegate}.update({
      where: { ${model.key.name}: this.parseId(id) },
      data: this.parseInput(data, new Set<string>(${updateAllowedFields})) as Prisma.${model.name}UncheckedUpdateInput,
    });
  }

  async delete(id: string): Promise<void> {
    await this.getById(id);
    await this.prisma.${model.delegate}.delete({
      where: { ${model.key.name}: this.parseId(id) },
    });
  }

  private parseId(id: string): ${model.key.type === 'Int' ? 'number' : model.key.type === 'BigInt' ? 'bigint' : 'string'} {
    ${keyParser}
  }

  private parseInput(data: object, writableFields: Set<string>): Record<string, unknown> {
    if (data === null || typeof data !== 'object' || Array.isArray(data)) {
      throw new BadRequestException('Request body must be a JSON object');
    }

    const unknownFields = Object.keys(data).filter(field => !writableFields.has(field));
    if (unknownFields.length > 0) {
      throw new BadRequestException('Request contains fields that are not writable');
    }

    const parsed: Record<string, unknown> = Object.fromEntries(Object.entries(data));
    for (const [field, value] of Object.entries(parsed)) {
      if (value === null || value === undefined) continue;
      if (fieldTypes[field] === 'BigInt' && typeof value !== 'bigint') {
        try {
          parsed[field] = BigInt(String(value));
        } catch {
          throw new BadRequestException(field + ' must be a valid integer');
        }
      } else if (fieldTypes[field] === 'DateTime' && typeof value === 'string') {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) throw new BadRequestException(field + ' must be a valid date');
        parsed[field] = date;
      } else if (fieldTypes[field] === 'Bytes' && typeof value === 'string') {
        parsed[field] = Buffer.from(value, 'base64');
      }
    }
    return parsed;
  }
}
`],
    );
  }

  if (!isNest) files.push(...renderHttpBootstrapFiles(projectName, framework, models, schemas, PRISMA_VERSION));
  return files;
}

export class NestPrismaGeneratorService {
  async execute({ connectionString, framework = 'nestjs', projectName: requestedName }: NestPrismaGenerateRequest) {
    if (!['nestjs', 'express', 'fastify'].includes(framework)) throw new Error('Unsupported framework');
    const trimmedConnectionString = connectionString.trim();
    const provider = getPrismaProvider(trimmedConnectionString);
    const databaseConnectionString = ensurePostgresSsl(trimmedConnectionString);
    const customName = validateProjectName(requestedName);
    const directoryName = `${customName ?? `${framework}-prisma`}-${Date.now()}-${randomBytes(3).toString('hex')}`;
    const projectName = customName ?? directoryName;

    await mkdir(GENERATED_PROJECTS_DIR, { recursive: true });
    const projectPath = path.join(GENERATED_PROJECTS_DIR, directoryName);
    if (existsSync(projectPath)) {
      throw new Error('A project with the generated identifier already exists. Please retry.');
    }

    const temporaryPath = await mkdtemp(path.join(GENERATED_PROJECTS_DIR, `.${projectName}-`));
    let completed = false;

    try {
      await mkdir(path.join(temporaryPath, 'src', 'common'), { recursive: true });
      await mkdir(path.join(temporaryPath, 'src', 'prisma'), { recursive: true });
      await mkdir(path.join(temporaryPath, 'prisma'), { recursive: true });
      await writeFile(
        path.join(temporaryPath, 'prisma', 'schema.prisma'),
        `generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "${provider}"
  url      = env("DATABASE_URL")
}
`,
      );

      try {
        await execFileAsync('npx', ['--yes', `prisma@${PRISMA_VERSION}`, 'db', 'pull'], {
          cwd: temporaryPath,
          env: { ...process.env, DATABASE_URL: databaseConnectionString },
          timeout: 120_000,
          maxBuffer: 5 * 1024 * 1024,
        });
      } catch {
        throw new Error('Database introspection failed. Check the connection string and read access to the database schema.');
      }

      const schema = await readFile(path.join(temporaryPath, 'prisma', 'schema.prisma'), 'utf8');
      const parsedSchema = parsePrismaSchema(schema);
      if (parsedSchema.models.length === 0) {
        throw new Error('No supported Prisma models with a single String, Int, or BigInt key were found.');
      }

      for (const [relativePath, contents] of renderPrismaProjectFiles(projectName, parsedSchema.models, framework)) {
        const filePath = path.join(temporaryPath, relativePath);
        await mkdir(path.dirname(filePath), { recursive: true });
        await writeFile(filePath, contents);
      }

      await rename(temporaryPath, projectPath);
      completed = true;

      return {
        success: true,
        message: `${framework} + Prisma project generated at ${projectPath}`,
        language: 'nodejs',
        framework,
        orm: 'prisma',
        projectname: projectName,
        path: projectPath,
        models: parsedSchema.models.map(model => model.name),
        skippedModels: parsedSchema.skippedModels,
      };
    } finally {
      if (!completed) await rm(temporaryPath, { recursive: true, force: true });
    }
  }
}
