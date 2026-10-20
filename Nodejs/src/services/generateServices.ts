import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'fs';
import path from 'path';
import { Conecttype } from './conecttype';
import { mysqlRepositories } from '../repositories/mysqlRepositories';

interface IgenerateRequest {
  host: string;
  database: string;
  username: string;
  password: string;
  databasetype: string;
  path: string;
  projectname: string;
  port: number;
}

const TEMPLATE_DIR = path.join(__dirname, '..', '..', 'template');

function readTemplate(filename: string): string {
  return readFileSync(path.join(TEMPLATE_DIR, filename)).toString();
}

class Creategenerateservice {

  async execute(config: IgenerateRequest) {
    const { host, database, username, password, databasetype, path: outputPath, projectname, port } = config;

    console.log(`[NODE] Generating Prisma project ${projectname} for ${databasetype}`);

    // Validate connection
    await new Conecttype().execute({ host, database, username, password, databasetype, port });

    const pathdir = path.join(outputPath, projectname);
    const pathdirsrc = path.join(pathdir, 'src');
    
    const dirs = [
      pathdir,
      pathdirsrc,
      path.join(pathdirsrc, 'services'),
      path.join(pathdirsrc, 'models'),
      path.join(pathdirsrc, 'databases'),
      path.join(pathdirsrc, 'controllers'),
    ];

    dirs.forEach(dir => {
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    });

    // Write base files
    writeFileSync(`${pathdirsrc}/server.ts`, readTemplate('server.txt'));
    writeFileSync(`${pathdir}/package.json`, readTemplate('package.txt').replace('namprojecto', projectname));
    writeFileSync(`${pathdir}/tsconfig.json`, readTemplate('tsconfig.txt'));

    // The Prisma generator handles schema.prisma, .env, and client
    const repoGenerator = new mysqlRepositories();
    const tables = await repoGenerator.querymodel(databasetype, pathdir, database, config);

    return {
      success: true,
      message: `Node.js project '${projectname}' generated with PRISMA and full CRUD at ${pathdir}`,
      language: 'nodejs',
      tables,
      data: { host, database, username, databasetype, path: outputPath, projectname, port }
    };
  }
}

export { Creategenerateservice };