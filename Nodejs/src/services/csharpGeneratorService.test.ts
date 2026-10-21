import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { DataSource } from 'typeorm';
import { Conecttype } from './conecttype';
import { CsharpGeneratorService } from './csharpGeneratorService';
import { parseCsharpConnectionString } from '../controllers/csharpController';

for (const sslmode of ['require', 'verify-full', 'disable']) {
  test(`passes PostgreSQL ${sslmode} through introspection and generated Npgsql configuration`, async t => {
    const temporaryPath = await mkdtemp(path.join(os.tmpdir(), 'csharp-ssl-test-'));
    const config = parseCsharpConnectionString(`postgresql://db.example.com/catalog?sslmode=${sslmode}`);
    let initialized = false;
    t.mock.method(DataSource.prototype, 'initialize', async function (this: DataSource) {
      if (this.options.type !== 'postgres') throw new Error('Expected a PostgreSQL data source');
      assert.equal(this.options.url, config.connectionString);
      assert.equal(this.options.ssl, undefined);
      Object.assign(this, { isInitialized: true });
      initialized = true;
      return this;
    });
    t.mock.method(DataSource.prototype, 'destroy', async function (this: DataSource) {
      Object.assign(this, { isInitialized: false });
    });
    t.mock.method(DataSource.prototype, 'query', async (sql: string) =>
      sql.includes('information_schema.tables')
        ? [{ table_name: 'customer' }]
        : [{ name: 'id', type: 'int', isPk: true }],
    );
    try {
      await new CsharpGeneratorService().execute({
        ...config,
        path: temporaryPath,
        projectname: 'ssl-api',
      });
      assert.equal(initialized, true);
      const settings = JSON.parse(await readFile(path.join(temporaryPath, 'ssl-api', 'appsettings.json'), 'utf8'));
      assert.ok(settings.ConnectionStrings.Default.includes(`SSL Mode=${sslmode};`));
    } finally {
      const activeConnection = new Conecttype().getActive();
      if (activeConnection?.isInitialized) await activeConnection.destroy();
      await rm(temporaryPath, { recursive: true, force: true });
    }
  });
}

test('generates an ASP.NET Core and EF Core project from SQLite', async () => {
  const temporaryPath = await mkdtemp(path.join(os.tmpdir(), 'csharp-generator-test-'));
  const databasePath = path.join(temporaryPath, 'catalog.db');
  const setup = new DataSource({ type: 'sqlite', database: databasePath });

  try {
    await setup.initialize();
    await setup.query('CREATE TABLE customer (id INTEGER PRIMARY KEY, name TEXT NOT NULL)');
    await setup.destroy();

    const generated = await new CsharpGeneratorService().execute({
      host: '',
      database: databasePath,
      username: '',
      password: '',
      databasetype: 'sqlite',
      path: temporaryPath,
      projectname: 'my-api',
      port: 0,
    });

    assert.equal(generated.success, true);
    assert.deepEqual(generated.tables, ['Customer']);

    const projectPath = path.join(temporaryPath, 'my-api');
    const program = await readFile(path.join(projectPath, 'Program.cs'), 'utf8');
    const projectFile = await readFile(path.join(projectPath, 'my-api.csproj'), 'utf8');
    const settings = JSON.parse(await readFile(path.join(projectPath, 'appsettings.json'), 'utf8'));
    assert.match(program, /using MyApi\.Data;/);
    assert.match(projectFile, /Microsoft\.EntityFrameworkCore\.Sqlite/);
    assert.equal(settings.ConnectionStrings.Default, `Data Source=${databasePath}`);
  } finally {
    const activeConnection = new Conecttype().getActive();
    if (activeConnection?.isInitialized) await activeConnection.destroy();
    if (setup.isInitialized) await setup.destroy();
    await rm(temporaryPath, { recursive: true, force: true });
  }
});
