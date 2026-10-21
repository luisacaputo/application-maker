import { DataSource } from 'typeorm';
import path from 'path';

interface IserverRequest {
  host: string;
  database: string;
  username: string;
  password: string;
  databasetype: string;
  port: number;
  connectionString?: string;
}

let activeDataSource: DataSource | null = null;

class Conecttype {

  async execute({ host, database, username, password, databasetype, port, connectionString }: IserverRequest): Promise<DataSource> {
    const isUrl = host.includes('://');
    console.log(`[DB] Connecting to ${databasetype} ${isUrl ? 'via URL' : 'at ' + host + ':' + port}`);

    if (activeDataSource && activeDataSource.isInitialized) {
      await activeDataSource.destroy();
    }

    const baseConfig: any = {
      synchronize: false,
      logging: false,
    };

    if (isUrl) {
      baseConfig.url = host;
    } else {
      Object.assign(baseConfig, {
        host,
        port: Number(port),
        username,
        password,
        database,
      });
    }

    if (databasetype === 'mysql') {
      activeDataSource = new DataSource({ ...baseConfig, type: 'mysql' });
    } else if (databasetype === 'sqlite' || databasetype === 'sqlite3') {
      activeDataSource = new DataSource({
        type: 'sqlite',
        database: path.isAbsolute(database)
          ? database
          : path.join('src', 'database', database.endsWith('.sqlite') ? database : `${database}.sqlite`),
      });
    } else if (databasetype === 'sql' || databasetype === 'mssql') {
      activeDataSource = new DataSource({
        ...baseConfig,
        type: 'mssql',
        options: { trustServerCertificate: true },
      });
    } else if (databasetype === 'postgres' || databasetype === 'postgresql') {
      activeDataSource = new DataSource({
        ...baseConfig,
        type: 'postgres',
        ...(connectionString ? { url: connectionString } : {}),
        ssl: connectionString || isUrl ? undefined : false,
      });
    } else {
      throw new Error(`Unsupported database type: ${databasetype}`);
    }

    try {
      await activeDataSource.initialize();
      console.log(`[DB] ${databasetype} connected successfully.`);
      return activeDataSource;
    } catch (err) {
      console.error(`[DB] Failed to connect to ${databasetype}:`, err);
      throw err;
    }
  }

  getActive(): DataSource | null {
    return activeDataSource;
  }
}

export { Conecttype, activeDataSource };