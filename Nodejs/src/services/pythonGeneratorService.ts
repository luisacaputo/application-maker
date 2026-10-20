import { writeFileSync, mkdirSync, existsSync } from 'fs';
import path from 'path';
import { Conecttype } from './conecttype';

interface IGenerateRequest {
  host: string;
  database: string;
  username: string;
  password: string;
  databasetype: string;
  path: string;
  projectname: string;
  port: number;
}

const PY_TYPE_MAP: Record<string, string> = {
  varchar: 'models.CharField(max_length=255)', nvarchar: 'models.CharField(max_length=255)',
  text: 'models.TextField()', ntext: 'models.TextField()', char: 'models.CharField(max_length=255)',
  int: 'models.IntegerField()', bigint: 'models.BigIntegerField()', smallint: 'models.SmallIntegerField()', tinyint: 'models.SmallIntegerField()',
  bit: 'models.BooleanField(default=False)', boolean: 'models.BooleanField(default=False)',
  float: 'models.FloatField()', real: 'models.FloatField()', numeric: 'models.DecimalField(max_digits=19, decimal_places=4)', decimal: 'models.DecimalField(max_digits=19, decimal_places=4)',
  datetime: 'models.DateTimeField(null=True)', datetime2: 'models.DateTimeField(null=True)', date: 'models.DateField(null=True)', timestamp: 'models.DateTimeField(null=True)',
  'character varying': 'models.CharField(max_length=255)', 'timestamp without time zone': 'models.DateTimeField(null=True)',
};

function mapPyType(dbType: string): string { return PY_TYPE_MAP[dbType.toLowerCase()] || 'models.TextField()'; }
function toPascalCase(str: string): string { return str.replace(/(^|_)([a-z])/gi, (_, __, c) => c.toUpperCase()); }

class PythonGeneratorService {

  async execute({ host, database, username, password, databasetype, path: outputPath, projectname, port }: IGenerateRequest) {
    console.log(`[PYTHON] Full Introspection for ${databasetype}`);

    await new Conecttype().execute({ host, database, username, password, databasetype, port });
    const { activeDataSource } = await import('./conecttype');
    const connection = activeDataSource;
    if (!connection || !connection.isInitialized) throw new Error('Database connection not initialized');

    const projectDir = path.join(outputPath, projectname);
    const appDir = path.join(projectDir, 'api');
    const projectPkgDir = path.join(projectDir, projectname);
    [projectDir, appDir, projectPkgDir].forEach(d => { if (!existsSync(d)) mkdirSync(d, { recursive: true }); });

    let tables: string[] = [];
    if (databasetype === 'sql' || databasetype === 'mssql') {
      const rows = await connection.query("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE='BASE TABLE'");
      tables = rows.map((r: any) => r.TABLE_NAME as string);
    } else if (databasetype === 'postgres' || databasetype === 'postgresql') {
      const rows = await connection.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'");
      tables = rows.map((r: any) => r.table_name as string);
    } else if (databasetype === 'mysql') {
      const rows = await connection.query('SHOW TABLES');
      tables = rows.map((r: any) => Object.values(r)[0] as string);
    } else if (databasetype === 'sqlite') {
      const rows = await connection.query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
      tables = rows.map((r: any) => r.name);
    }

    const models: string[] = [];
    const serializers: string[] = [];
    const viewsets: string[] = [];
    const urlPatterns: string[] = [];

    for (const table of tables) {
      let columns: any[] = [];
      if (databasetype === 'sql' || databasetype === 'mssql') {
        const cols = await connection.query(`SELECT COLUMN_NAME as name, DATA_TYPE as type FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='${table}'`);
        columns = cols.map((c: any) => ({ name: c.name, pyType: mapPyType(c.type) }));
      } else if (databasetype === 'postgres' || databasetype === 'postgresql') {
        const cols = await connection.query(`SELECT column_name as name, data_type as type FROM information_schema.columns WHERE table_name='${table}' AND table_schema='public'`);
        columns = cols.map((c: any) => ({ name: c.name, pyType: mapPyType(c.type) }));
      } else if (databasetype === 'mysql') {
        const cols = await connection.query(`DESCRIBE ${table}`);
        columns = cols.map((c: any) => ({ name: c.Field, pyType: mapPyType(c.Type.split('(')[0]) }));
      } else if (databasetype === 'sqlite') {
        const cols = await connection.query(`PRAGMA table_info(${table})`);
        columns = cols.map((c: any) => ({ name: c.name, pyType: mapPyType(c.type) }));
      }

      const structName = toPascalCase(table);
      const fields = columns.map(c => `  ${c.name} = ${c.pyType}`).join('\n');
      models.push(`class ${structName}(models.Model):\n${fields}\n  class Meta: db_table = '${table}'`);
      serializers.push(`class ${structName}Serializer(serializers.ModelSerializer):\n  class Meta:\n    model = ${structName}\n    fields = '__all__'`);
      viewsets.push(`class ${structName}ViewSet(viewsets.ModelViewSet):\n  queryset = ${structName}.objects.all()\n  serializer_class = ${structName}Serializer`);
      urlPatterns.push(`router.register(r'${table}', ${structName}ViewSet)`);
    }

    writeFileSync(path.join(appDir, '__init__.py'), '');
    writeFileSync(path.join(appDir, 'models.py'), `from django.db import models\n\n${models.join('\n\n')}\n`);
    writeFileSync(path.join(appDir, 'serializers.py'), `from rest_framework import serializers\nfrom .models import *\n\n${serializers.join('\n\n')}\n`);
    writeFileSync(path.join(appDir, 'views.py'), `from rest_framework import viewsets\nfrom .models import *\nfrom .serializers import *\n\n${viewsets.join('\n\n')}\n`);
    writeFileSync(path.join(appDir, 'urls.py'), `from django.urls import path, include\nfrom rest_framework.routers import DefaultRouter\nfrom .views import *\n\nrouter = DefaultRouter()\n${urlPatterns.join('\n')}\n\nurlpatterns = [path('', include(router.urls))]\n`);

    const engineMap: any = { sql: 'mssql', mssql: 'mssql', postgres: 'django.db.backends.postgresql', postgresql: 'django.db.backends.postgresql', mysql: 'django.db.backends.mysql', sqlite: 'django.db.backends.sqlite3' };
    const dbConfig = host.includes('://') ? `{'ENGINE': '${engineMap[databasetype] || 'django.db.backends.sqlite3'}', 'NAME': '${host}'}` : `{'ENGINE': '${engineMap[databasetype] || 'django.db.backends.sqlite3'}', 'NAME': '${database}', 'USER': '${username}', 'PASSWORD': '${password}', 'HOST': '${host}', 'PORT': '${port}'}`;

    writeFileSync(path.join(projectPkgDir, 'settings.py'), `from pathlib import Path\nBASE_DIR = Path(__file__).resolve().parent.parent\nSECRET_KEY = 'django-insecure'\nDEBUG = True\nALLOWED_HOSTS = ['*']\nINSTALLED_APPS = ['django.contrib.contenttypes', 'django.contrib.auth', 'rest_framework', 'corsheaders', 'drf_spectacular', 'api']\nMIDDLEWARE = ['corsheaders.middleware.CorsMiddleware', 'django.middleware.common.CommonMiddleware']\nROOT_URLCONF = '${projectname}.urls'\nCORS_ALLOW_ALL_ORIGINS = True\nDATABASES = {'default': ${dbConfig}}\nREST_FRAMEWORK = {'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema'}\nSPECTACULAR_SETTINGS = {'TITLE': '${projectname} API', 'VERSION': '1.0.0'}\n`);
    writeFileSync(path.join(projectPkgDir, 'urls.py'), `from django.urls import path, include\nfrom drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView\nurlpatterns = [path('api/', include('api.urls')), path('api/schema/', SpectacularAPIView.as_view(), name='schema'), path('docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui')]\n`);
    writeFileSync(path.join(projectDir, 'manage.py'), `import os, sys\ndef main(): os.environ.setdefault('DJANGO_SETTINGS_MODULE', '${projectname}.settings'); from django.core.management import execute_from_command_line; execute_from_command_line(sys.argv)\nif __name__ == '__main__': main()`);
    writeFileSync(path.join(projectDir, 'requirements.txt'), `django\ndjangorestframework\ndjango-cors-headers\ndrf-spectacular\npsycopg2-binary\nmysqlclient\n`);

    return { success: true, message: `Python project '${projectname}' generated at ${projectDir}`, language: 'python', tables: tables.map(t => toPascalCase(t)), data: { host, database, username, databasetype, path: outputPath, projectname, port } };
  }
}
export { PythonGeneratorService };
