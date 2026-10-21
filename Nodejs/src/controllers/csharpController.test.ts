import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import express from 'express';
import { DataSource } from 'typeorm';
import path from 'node:path';
import { csharpController, parseCsharpConnectionString } from './csharpController';
import { downloadProject } from './projectDownloadController';
import { getProjectArchivePath } from '../services/projectArchive';
import { Conecttype } from '../services/conecttype';

test('parses PostgreSQL and MySQL URLs with their default ports', () => {
  assert.deepEqual(parseCsharpConnectionString('postgresql://app:p%40ss@db.example.com/catalog'), {
    host: 'db.example.com',
    database: 'catalog',
    username: 'app',
    password: 'p@ss',
    databasetype: 'postgresql',
    port: 5432,
    connectionString: 'postgresql://app:p%40ss@db.example.com/catalog?sslmode=require',
  });
  assert.deepEqual(parseCsharpConnectionString('mysql://app:secret@db.example.com:3307/catalog'), {
    host: 'db.example.com',
    database: 'catalog',
    username: 'app',
    password: 'secret',
    databasetype: 'mysql',
    port: 3307,
  });
});

test('parses SQL Server connection strings', () => {
  assert.deepEqual(parseCsharpConnectionString('sqlserver://sql.example.com:1444;database=catalog;user=app;password=secret'), {
    host: 'sql.example.com',
    database: 'catalog',
    username: 'app',
    password: 'secret',
    databasetype: 'mssql',
    port: 1444,
  });
});

test('resolves SQLite file paths for database introspection', () => {
  const config = parseCsharpConnectionString('file:./data/catalog.db');
  assert.equal(config.databasetype, 'sqlite');
  assert.equal(config.database, path.resolve('./data/catalog.db'));
});

test('rejects unsupported or incomplete database connection strings', () => {
  assert.throws(() => parseCsharpConnectionString(''), /connectionString is required/);
  assert.throws(() => parseCsharpConnectionString('mongodb://db.example.com/catalog'), /Use a PostgreSQL or MySQL URL/);
  assert.throws(() => parseCsharpConnectionString('sqlserver://sql.example.com;database=catalog'), /must include database, user and password/);
});

test('preserves explicit PostgreSQL SSL modes and other connection parameters', () => {
  for (const sslmode of ['require', 'verify-full', 'disable']) {
    const url = `postgresql://db.example.com/catalog?schema=public&sslmode=${sslmode}`;
    const config = parseCsharpConnectionString(url);
    assert.equal(config.connectionString, url);
  }
  assert.equal(
    parseCsharpConnectionString('postgres://db.example.com/catalog?schema=public').connectionString,
    'postgres://db.example.com/catalog?schema=public&sslmode=require',
  );
});

test('generates C# with a usable project path, local launch profile and downloadable ZIP', async () => {
  const temporaryPath = await mkdtemp(path.join(os.tmpdir(), 'csharp-http-test-'));
  const databasePath = path.join(temporaryPath, 'catalog.db');
  const database = new DataSource({ type: 'sqlite', database: databasePath });
  const projectname = `download-test-${randomUUID()}`;
  const projectPath = path.resolve(__dirname, '../../generated-projects/csharp', projectname);
  let archivePath: string | null = null;
  const app = express();
  const controller = new csharpController();
  app.use(express.json());
  app.post('/generateapi/csharp', (request, response, next) => {
    controller.handle(request, response).catch(next);
  });
  app.get('/downloads/:id', downloadProject);
  const server = app.listen(0, '127.0.0.1');
  try {
    await once(server, 'listening');
    await database.initialize();
    await database.query('CREATE TABLE customer (id INTEGER PRIMARY KEY, name TEXT NOT NULL)');
    await database.destroy();
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Missing server address');
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const response = await fetch(`${baseUrl}/generateapi/csharp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        connectionString: `file:${databasePath}`,
        projectName: projectname,
        framework: 'aspnetcore',
        orm: 'efcore',
      }),
    });
    assert.equal(response.status, 201);
    const result = await response.json();
    archivePath = getProjectArchivePath(result.downloadUrl.split('/').pop());
    assert.equal(result.success, true);
    assert.equal(result.path, projectPath);
    assert.deepEqual(result.models, ['Customer']);
    const launchSettings = JSON.parse(await readFile(path.join(result.path, 'Properties/launchSettings.json'), 'utf8'));
    assert.equal(launchSettings.profiles.http.applicationUrl, 'http://localhost:5000');
    assert.equal(launchSettings.profiles.http.environmentVariables.ASPNETCORE_ENVIRONMENT, 'Development');
    const download = await fetch(`${baseUrl}${result.downloadUrl}`);
    assert.equal(download.status, 200);
    const archive = Buffer.from(await download.arrayBuffer());
    assert.equal(archive.readUInt32LE(0), 0x04034b50);
    assert.ok(archive.includes(Buffer.from(`${projectname}.csproj`)));
    assert.ok(archive.includes(Buffer.from('Properties/launchSettings.json')));
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    const activeConnection = new Conecttype().getActive();
    if (activeConnection?.isInitialized) await activeConnection.destroy();
    if (database.isInitialized) await database.destroy();
    if (archivePath) await rm(archivePath, { force: true });
    await rm(projectPath, { recursive: true, force: true });
    await rm(temporaryPath, { recursive: true, force: true });
  }
});
