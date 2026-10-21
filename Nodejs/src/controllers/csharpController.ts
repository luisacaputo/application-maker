import { Request, Response } from 'express';
import { existsSync, mkdirSync } from 'fs';
import path from 'path';
import { CsharpGeneratorService } from '../services/csharpGeneratorService';
import { ensurePostgresSsl, validateProjectName } from '../services/nestPrismaGenerator';
import { createProjectArchive } from '../services/projectArchive';

interface DatabaseConfig {
  host: string;
  database: string;
  username: string;
  password: string;
  databasetype: string;
  port: number;
  connectionString?: string;
}

export function parseCsharpConnectionString(connectionString: unknown): DatabaseConfig {
  if (typeof connectionString !== 'string' || !connectionString.trim()) {
    throw new Error('connectionString is required');
  }

  const value = connectionString.trim();
  if (value.startsWith('file:')) {
    const sqlitePath = value.slice('file:'.length);
    if (!sqlitePath) throw new Error('SQLite connection string must include a database path');
    const database = path.resolve(sqlitePath);
    return { host: '', database, username: '', password: '', databasetype: 'sqlite', port: 0 };
  }

  if (value.startsWith('sqlserver://')) {
    const [server, ...segments] = value.slice('sqlserver://'.length).split(';');
    const serverUrl = new URL(`sqlserver://${server}`);
    const options = new Map<string, string>();
    for (const segment of segments) {
      const separator = segment.indexOf('=');
      if (separator > 0) options.set(segment.slice(0, separator).trim().toLowerCase(), segment.slice(separator + 1).trim());
    }
    const database = options.get('database') || options.get('initial catalog') || '';
    const username = options.get('user') || options.get('user id') || options.get('username') || '';
    const password = options.get('password') || options.get('pwd') || '';
    if (!database || !username || !password) {
      throw new Error('SQL Server connection string must include database, user and password');
    }
    return {
      host: serverUrl.hostname,
      database,
      username,
      password,
      databasetype: 'mssql',
      port: Number(serverUrl.port || 1433),
    };
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Use a PostgreSQL, MySQL, SQL Server or SQLite connection string');
  }

  const type = url.protocol.toLowerCase();
  const databasetype = type === 'postgres:' || type === 'postgresql:'
    ? 'postgresql'
    : type === 'mysql:'
      ? 'mysql'
      : null;
  if (!databasetype || !url.hostname || !url.pathname.replace(/^\/+/, '')) {
    throw new Error('Use a PostgreSQL or MySQL URL containing a host and database name');
  }

  return {
    host: url.hostname,
    database: decodeURIComponent(url.pathname.replace(/^\/+/, '')),
    username: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    databasetype,
    port: Number(url.port || (databasetype === 'postgresql' ? 5432 : 3306)),
    ...(databasetype === 'postgresql' ? { connectionString: ensurePostgresSsl(value) } : {}),
  };
}

class csharpController {
  async handle(request: Request, response: Response) {
    const { connectionString, projectName, framework, orm } = request.body ?? {};
    if (framework !== 'aspnetcore' || orm !== 'efcore') {
      return response.status(400).json({ error: 'C# generation supports ASP.NET Core with Entity Framework Core' });
    }

    let databaseConfig: DatabaseConfig;
    let requestedName: string | undefined;
    try {
      databaseConfig = parseCsharpConnectionString(connectionString);
      requestedName = validateProjectName(projectName);
    } catch (error) {
      return response.status(400).json({ error: error instanceof Error ? error.message : 'Invalid project configuration' });
    }

    const outputPath = path.resolve(__dirname, '..', '..', 'generated-projects', 'csharp');
    mkdirSync(outputPath, { recursive: true });
    const baseName = requestedName || `aspnetcore-api-${Date.now()}`;
    let projectname = baseName;
    let suffix = 2;
    while (existsSync(path.join(outputPath, projectname))) {
      projectname = `${baseName}-${suffix}`;
      suffix += 1;
    }

    const service = new CsharpGeneratorService();
    const result = await service.execute({
      ...databaseConfig,
      path: outputPath,
      projectname,
    });
    const projectPath = path.join(outputPath, projectname);
    const downloadUrl = await createProjectArchive(projectPath);

    return response.status(201).json({
      ...result,
      language: 'csharp',
      framework: 'aspnetcore',
      orm: 'efcore',
      projectname,
      path: projectPath,
      downloadUrl,
      models: result.tables,
    });
  }
}

export { csharpController };
