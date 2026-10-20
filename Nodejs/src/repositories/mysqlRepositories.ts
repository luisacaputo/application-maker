import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { activeDataSource } from '../services/conecttype';

const TEMPLATE_DIR = path.join(__dirname, '..', '..', 'template');

function readTemplate(filename: string): string {
  return readFileSync(path.join(TEMPLATE_DIR, filename)).toString();
}

class prismaRepositories {
  name_routes: string = '';
  name_routes_: string = '';
  methods: string = '';
  swaggerPaths: any = {};

  async querymodel(typebd: string, projectPath: string, dbName: string, dbConfig: any): Promise<string[]> {
    console.log(`[PRISMA] Starting Native Introspection (db pull) with Prisma 5 for ${typebd}`);
    
    const srcPath = path.join(projectPath, 'src');
    const prismaDir = path.join(projectPath, 'prisma');
    if (!existsSync(prismaDir)) mkdirSync(prismaDir, { recursive: true });

    const providerMap: any = { mysql: 'mysql', sql: 'sqlserver', mssql: 'sqlserver', postgres: 'postgresql', postgresql: 'postgresql', sqlite: 'sqlite' };
    const provider = providerMap[typebd] || 'mysql';
    let dbUrl = dbConfig.host.includes('://') ? dbConfig.host : (provider === 'sqlite' ? `file:./dev.db` : (provider === 'sqlserver' ? `sqlserver://${dbConfig.host}:${dbConfig.port};database=${dbConfig.database};user=${dbConfig.username};password=${dbConfig.password};trustServerCertificate=true` : (provider === 'postgresql' ? `postgresql://${dbConfig.username}:${dbConfig.password}@${dbConfig.host}:${dbConfig.port}/${dbConfig.database}?sslmode=disable` : `mysql://${dbConfig.username}:${dbConfig.password}@${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`)));
    
    writeFileSync(path.join(projectPath, '.env'), `DATABASE_URL="${dbUrl}"`);
    
    const initialSchema = `generator client {\n  provider = "prisma-client-js"\n}\n\ndatasource db {\n  provider = "${provider}"\n  url      = env("DATABASE_URL")\n}\n`;
    writeFileSync(path.join(prismaDir, 'schema.prisma'), initialSchema);

    try {
      console.log("[PRISMA] Running npx --yes prisma@5 db pull...");
      execSync(`npx --yes prisma@5 db pull`, { cwd: projectPath, stdio: 'inherit' });
      console.log("[PRISMA] Running npx --yes prisma@5 generate...");
      execSync(`npx --yes prisma@5 generate`, { cwd: projectPath, stdio: 'inherit' });
    } catch (err: any) {
      console.error("[PRISMA] db pull failed. Output:", err.stdout?.toString() || err.stderr?.toString() || err.message);
    }

    if (!existsSync(path.join(prismaDir, 'schema.prisma'))) return [];

    const schemaContent = readFileSync(path.join(prismaDir, 'schema.prisma')).toString();
    const modelRegex = /model\s+(\w+)\s+{([\s\S]*?)}/g;
    let match;
    const detectedTables: string[] = [];

    while ((match = modelRegex.exec(schemaContent)) !== null) {
      const className = match[1];
      const modelBody = match[2];
      detectedTables.push(className);

      const pkMatch = modelBody.match(/(\w+)\s+\w+\s+@id/);
      const pkName = pkMatch ? pkMatch[1] : 'id';

      const columns: any[] = [];
      const lines = modelBody.split('\n');
      lines.forEach(line => {
        const colMatch = line.trim().match(/^(\w+)\s+(\w+)/);
        if (colMatch && !line.includes('@@')) {
          columns.push({ name: colMatch[1], type: colMatch[2] });
        }
      });

      this.writeTableFiles(className, className, srcPath, pkName);
      this.addSwaggerPath(className.toLowerCase(), className, pkName, columns);
    }

    this.writeRoutes(srcPath);
    this.writeSwaggerJson(srcPath, dbConfig.projectname);
    
    const dbDir = path.join(srcPath, 'databases');
    if (!existsSync(dbDir)) mkdirSync(dbDir, { recursive: true });
    writeFileSync(path.join(dbDir, 'prisma.ts'), readTemplate('prismaClient.txt'));

    return detectedTables;
  }

  private addSwaggerPath(tableName: string, className: string, pkName: string, columns: any[]) {
    const tag = className;
    const properties: any = {};
    columns.forEach(c => {
        properties[c.name] = { type: c.type === 'Int' || c.type === 'Float' ? 'number' : c.type === 'Boolean' ? 'boolean' : 'string' };
    });

    this.swaggerPaths[`/${tableName}`] = {
      get: { tags: [tag], summary: `List all ${tableName}`, responses: { 200: { description: 'Success' } } },
      post: { tags: [tag], summary: `Create new ${tableName}`, parameters: [{ in: 'body', name: 'body', schema: { type: 'object', properties } }], responses: { 201: { description: 'Created' } } }
    };
    this.swaggerPaths[`/${tableName}/{id}`] = {
      get: { tags: [tag], summary: `Get ${tableName} by ID`, parameters: [{ in: 'path', name: 'id', required: true, type: 'string' }], responses: { 200: { description: 'Success' } } },
      put: { tags: [tag], summary: `Update ${tableName}`, parameters: [{ in: 'path', name: 'id', required: true, type: 'string' }, { in: 'body', name: 'body', schema: { type: 'object', properties } }], responses: { 200: { description: 'Updated' } } },
      delete: { tags: [tag], summary: `Delete ${tableName}`, parameters: [{ in: 'path', name: 'id', required: true, type: 'string' }], responses: { 204: { description: 'Deleted' } } }
    };
  }

  private writeSwaggerJson(srcPath: string, projectName: string) {
    const swagger = {
      swagger: "2.0",
      info: { title: `${projectName} API`, version: "1.0.0", description: `Full CRUD API for ${projectName}` },
      basePath: "/",
      paths: this.swaggerPaths
    };
    writeFileSync(path.join(srcPath, 'swagger.json'), JSON.stringify(swagger, null, 2));
  }

  private writeTableFiles(_nameTable: string, className: string, srcPath: string, pkName: string) {
    const ctrlTpl = readTemplate('controller.txt');
    const servTpl = readTemplate('services.txt');
    const repoTpl = readTemplate('prismaRepository.txt');

    const name_controller = ctrlTpl.replace(/#model/g, className);
    const name_services = servTpl.replace(/#model/g, className).replace(/#modelLower/g, className.charAt(0).toLowerCase() + className.slice(1)).replace(/#pkName/g, pkName);
    const name_repository = repoTpl.replace(/#model/g, className).replace(/#modelLower/g, className.charAt(0).toLowerCase() + className.slice(1)).replace(/#pkName/g, pkName);

    if (!existsSync(path.join(srcPath, 'controllers'))) mkdirSync(path.join(srcPath, 'controllers'), { recursive: true });
    if (!existsSync(path.join(srcPath, 'services'))) mkdirSync(path.join(srcPath, 'services'), { recursive: true });
    if (!existsSync(path.join(srcPath, 'repositories'))) mkdirSync(path.join(srcPath, 'repositories'), { recursive: true });

    writeFileSync(path.join(srcPath, 'controllers', `${className}Controller.ts`), name_controller);
    writeFileSync(path.join(srcPath, 'services', `${className}Service.ts`), name_services);
    writeFileSync(path.join(srcPath, 'repositories', `${className}Repository.ts`), name_repository);

    this.name_routes += `import { ${className}Controller } from './controllers/${className}Controller';\n`;
    this.name_routes_ += `const ${className.toLowerCase()}controller = new ${className}Controller();\n`;
    const routeName = className.toLowerCase();
    this.methods += `\n// Routes for ${className}\nrouter.get("/${routeName}", ${className.toLowerCase()}controller.list)\nrouter.get("/${routeName}/:id", ${className.toLowerCase()}controller.show)\nrouter.post("/${routeName}", ${className.toLowerCase()}controller.add)\nrouter.put("/${routeName}/:id", ${className.toLowerCase()}controller.update)\nrouter.delete("/${routeName}/:id", ${className.toLowerCase()}controller.delete)\n`;
  }

  private writeRoutes(srcPath: string) {
    writeFileSync(path.join(srcPath, 'routes.ts'), readTemplate('routes.txt').replace(/#import/g, this.name_routes).replace(/#new/g, this.name_routes_).replace(/#methods/g, this.methods));
  }
}

export { prismaRepositories as mysqlRepositories };