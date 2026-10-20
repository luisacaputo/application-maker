import { DataSource } from 'typeorm';

interface IserverRequest {
  host: string;
  database: string;
  username: string;
  password: string;
  databasetype: string;
  port: number;
}

let activeDataSource: DataSource | null = null;

class Conecttype {

  async execute({ host, database, username, password, databasetype, port }: IserverRequest): Promise<DataSource> {
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
        database: database.endsWith('.sqlite') ? `src/database/${database}` : `src/database/${database}.sqlite`,
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
        ssl: isUrl ? undefined : false, // Let the URL decide SSL if provided
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