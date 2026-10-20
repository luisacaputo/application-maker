import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { once } from 'node:events';
import { createRequire } from 'node:module';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import type { Server } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';
import { NestPrismaGeneratorService } from './nestPrismaGenerator';

const execFileAsync = promisify(execFile);

async function buildProject(projectPath: string): Promise<void> {
  await execFileAsync('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund'], {
    cwd: projectPath, timeout: 120_000, maxBuffer: 5 * 1024 * 1024,
  });
  await execFileAsync(process.execPath, ['node_modules/prisma/build/index.js', 'generate'], {
    cwd: projectPath, timeout: 60_000,
  });
  await execFileAsync('npm', ['run', 'build'], { cwd: projectPath, timeout: 60_000 });
}

test('generated Express/Fastify applications build and serve validated Prisma CRUD', { timeout: 300_000 }, async t => {
  const temporaryPath = await mkdtemp(path.join(os.tmpdir(), 'prisma-framework-tests-'));
  const databasePath = path.join(temporaryPath, 'test.db');
  const connectionString = `file:${databasePath}`;
  const sqlPath = path.join(temporaryPath, 'schema.sql');
  await writeFile(sqlPath, `
    CREATE TABLE Account (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      active BOOLEAN NOT NULL DEFAULT 1
    );
    CREATE TABLE Ledger (
      id BIGINT PRIMARY KEY NOT NULL,
      amount BIGINT NOT NULL
    );
  `);
  const previousUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = connectionString;

  try {
    await execFileAsync('npx', ['--yes', 'prisma@5.22.0', 'db', 'execute', '--url', connectionString, '--file', sqlPath], {
      timeout: 60_000,
    });
    for (const framework of ['express', 'fastify'] as const) {
      await t.test(framework, async () => {
        const generator = new NestPrismaGeneratorService();
        const projectName = `test-${framework}-api`;
        const generated = await generator.execute({ connectionString, framework, projectName });
        let close: (() => Promise<void>) | undefined;
        let prisma: { $disconnect(): Promise<void> } | undefined;
        try {
          assert.equal(generated.projectname, projectName);
          assert.equal(generated.framework, framework);
          assert.equal(path.dirname(generated.path), path.resolve(__dirname, '../../generated-projects'));
          assert.ok(path.basename(generated.path).startsWith(`${projectName}-`));
          const manifest = JSON.parse(await readFile(path.join(generated.path, 'package.json'), 'utf8'));
          assert.equal(manifest.name, projectName);
          await buildProject(generated.path);
          const requireProject = createRequire(path.join(generated.path, 'package.json'));
          const app = requireProject('./dist/app').createApp();
          prisma = requireProject('./dist/prisma/prisma.service').prisma;
          let baseUrl: string;
          if (framework === 'express') {
            const server: Server = app.listen(0, '127.0.0.1');
            await once(server, 'listening');
            const address = server.address();
            assert.ok(address && typeof address !== 'string');
            baseUrl = `http://127.0.0.1:${address.port}`;
            close = () => new Promise<void>((resolve, reject) =>
              server.close(error => error ? reject(error) : resolve()),
            );
          } else {
            baseUrl = await app.listen({ port: 0, host: '127.0.0.1' });
            close = () => app.close();
          }
          const request = async (url: string, method = 'GET', body?: unknown) => fetch(`${baseUrl}${url}`, {
            method,
            ...(body === undefined ? {} : {
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
            }),
          });

          const docs = await request('/docs-json');
          assert.equal(docs.status, 200);
          const document = await docs.json();
          assert.equal(document.info.title, `${projectName} API`);
          assert.equal(document.components.schemas.CreateAccountDto.properties.email.example, 'ana.silva@example.com');
          assert.equal((await request('/docs/')).status, 200);

          for (const invalid of [{ name: 'Ana' }, { email: 42, name: 'Ana' }, { email: 'a@example.com', name: 'Ana', unexpected: true }, [], null]) {
            assert.equal((await request('/api/account', 'POST', invalid)).status, 400);
          }
          assert.equal((await request('/api/account?take=-1')).status, 400);
          assert.equal((await request('/api/account?skip=invalid')).status, 400);
          assert.equal((await request('/api/account/not-an-integer')).status, 400);
          const created = await request('/api/account', 'POST', { email: `${framework}@example.com`, name: 'Ana Silva', active: true });
          assert.equal(created.status, 201);
          const account = await created.json();
          assert.equal(account.name, 'Ana Silva');
          assert.equal(account.active, true);
          const id = account.id;
          assert.equal((await request(`/api/account/${id}`)).status, 200);
          const listed = await request('/api/account?skip=0&take=1000');
          assert.equal(listed.status, 200);
          assert.ok((await listed.json()).some((item: { id: number }) => item.id === id));
          assert.equal((await request(`/api/account/${id}`, 'PUT', { id })).status, 400);
          const updated = await request(`/api/account/${id}`, 'PUT', { name: 'Ana Atualizada' });
          assert.equal(updated.status, 200);
          assert.equal((await updated.json()).name, 'Ana Atualizada');
          const removed = await request(`/api/account/${id}`, 'DELETE');
          assert.equal(removed.status, 204);
          assert.equal(await removed.text(), '');
          assert.equal((await request(`/api/account/${id}`)).status, 404);

          const bigint = '9007199254740993';
          const ledger = await request('/api/ledger', 'POST', { id: bigint, amount: bigint });
          assert.equal(ledger.status, 201);
          assert.equal((await ledger.json()).amount, bigint);
          assert.equal((await request(`/api/ledger/${bigint}`)).status, 200);
          assert.equal((await request(`/api/ledger/${bigint}`, 'DELETE')).status, 204);
        } finally {
          await close?.();
          await prisma?.$disconnect();
          await rm(generated.path, { recursive: true, force: true });
        }
      });
    }
    await t.test('NestJS retains automatic naming and builds without regressions', async () => {
      const generated = await new NestPrismaGeneratorService().execute({ connectionString });
      try {
        assert.equal(generated.framework, 'nestjs');
        assert.match(generated.projectname, /^nestjs-prisma-\d+-[a-f0-9]{6}$/);
        const main = await readFile(path.join(generated.path, 'src/main.ts'), 'utf8');
        assert.match(main, /NestFactory.create/);
        await buildProject(generated.path);
      } finally {
        await rm(generated.path, { recursive: true, force: true });
      }
    });
    await t.test('repeated custom names do not overwrite generated projects', async () => {
      const generator = new NestPrismaGeneratorService();
      const first = await generator.execute({ connectionString, projectName: 'same-name' });
      try {
        const second = await generator.execute({ connectionString, projectName: 'same-name' });
        try {
          assert.equal(first.projectname, 'same-name');
          assert.equal(second.projectname, 'same-name');
          assert.notEqual(first.path, second.path);
          assert.equal(JSON.parse(await readFile(path.join(first.path, 'package.json'), 'utf8')).name, 'same-name');
          assert.equal(JSON.parse(await readFile(path.join(second.path, 'package.json'), 'utf8')).name, 'same-name');
        } finally {
          await rm(second.path, { recursive: true, force: true });
        }
      } finally {
        await rm(first.path, { recursive: true, force: true });
      }
    });
  } finally {
    if (previousUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousUrl;
    await rm(temporaryPath, { recursive: true, force: true });
  }
});
