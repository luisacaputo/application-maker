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

const GO_TYPE_MAP: Record<string, string> = {
  varchar: 'string', nvarchar: 'string', text: 'string', ntext: 'string', char: 'string',
  int: 'int', bigint: 'int64', smallint: 'int16', tinyint: 'int8', bit: 'bool', boolean: 'bool',
  float: 'float64', real: 'float32', numeric: 'float64', decimal: 'float64', money: 'float64',
  datetime: 'time.Time', datetime2: 'time.Time', date: 'time.Time', time: 'time.Time', timestamp: 'time.Time',
  'character varying': 'string', 'timestamp without time zone': 'time.Time', 'timestamp with time zone': 'time.Time',
};

function mapGoType(dbType: string): string { return GO_TYPE_MAP[dbType.toLowerCase()] || 'string'; }
function toPascalCase(str: string): string { return str.replace(/(^|_)([a-z])/gi, (_, __, c) => c.toUpperCase()); }

class GoGeneratorService {

  async execute({ host, database, username, password, databasetype, path: outputPath, projectname, port }: IGenerateRequest) {
    console.log(`[GO] Full Introspection for ${databasetype}`);

    await new Conecttype().execute({ host, database, username, password, databasetype, port });
    const { activeDataSource } = await import('./conecttype');
    const connection = activeDataSource;
    if (!connection || !connection.isInitialized) throw new Error('Database connection not initialized');

    const projectDir = path.join(outputPath, projectname);
    const dirs = ['models', 'handlers', 'repositories', 'docs'];
    dirs.forEach(d => { if (!existsSync(path.join(projectDir, d))) mkdirSync(path.join(projectDir, d), { recursive: true }); });

    const driverMap: Record<string, { pkg: string; driver: string; dsn: string }> = {
      sql: { pkg: 'github.com/denisenkom/go-mssqldb', driver: 'sqlserver', dsn: `sqlserver://${username}:${password}@${host}:${port}?database=${database}&TrustServerCertificate=true` },
      mssql: { pkg: 'github.com/denisenkom/go-mssqldb', driver: 'sqlserver', dsn: `sqlserver://${username}:${password}@${host}:${port}?database=${database}&TrustServerCertificate=true` },
      postgres: { pkg: 'github.com/lib/pq', driver: 'postgres', dsn: `postgres://${username}:${password}@${host}:${port}/${database}?sslmode=disable` },
      postgresql: { pkg: 'github.com/lib/pq', driver: 'postgres', dsn: `postgres://${username}:${password}@${host}:${port}/${database}?sslmode=disable` },
      mysql: { pkg: 'github.com/go-sql-driver/mysql', driver: 'mysql', dsn: `${username}:${password}@tcp(${host}:${port})/${database}?parseTime=true` },
      sqlite: { pkg: 'github.com/mattn/go-sqlite3', driver: 'sqlite3', dsn: `./models/${database.endsWith('.db') ? database : database + '.db'}` },
    };
    const dbInfo = driverMap[databasetype] || driverMap['postgres'];

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

    const routeRegistrations: string[] = [];
    const swaggerPaths: any = {};

    for (const table of tables) {
      let columns: Array<{ name: string; goType: string; isPk: boolean }> = [];
      if (databasetype === 'sql' || databasetype === 'mssql') {
        const cols = await connection.query(`SELECT c.COLUMN_NAME as name, c.DATA_TYPE as type, CASE WHEN pk.COLUMN_NAME IS NOT NULL THEN 1 ELSE 0 END as isPk FROM INFORMATION_SCHEMA.COLUMNS c LEFT JOIN (SELECT ku.COLUMN_NAME FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE ku ON tc.CONSTRAINT_NAME=ku.CONSTRAINT_NAME WHERE tc.TABLE_NAME='${table}' AND tc.CONSTRAINT_TYPE='PRIMARY KEY') pk ON c.COLUMN_NAME = pk.COLUMN_NAME WHERE c.TABLE_NAME='${table}'`);
        columns = cols.map((c: any) => ({ name: c.name, goType: mapGoType(c.type), isPk: c.isPk === 1 }));
      } else if (databasetype === 'postgres' || databasetype === 'postgresql') {
        const cols = await connection.query(`SELECT c.column_name as name, c.data_type as type, CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END as "isPk" FROM information_schema.columns c LEFT JOIN (SELECT ku.column_name FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage ku ON tc.constraint_name=ku.constraint_name WHERE tc.table_name='${table}' AND tc.constraint_type='PRIMARY KEY') pk ON c.column_name=pk.column_name WHERE c.table_name='${table}' AND c.table_schema='public'`);
        columns = cols.map((c: any) => ({ name: c.name, goType: mapGoType(c.type), isPk: c.isPk }));
      } else if (databasetype === 'mysql') {
        const cols = await connection.query(`DESCRIBE ${table}`);
        columns = cols.map((c: any) => ({ name: c.Field, goType: mapGoType(c.Type.split('(')[0]), isPk: c.Key === 'PRI' }));
      } else if (databasetype === 'sqlite') {
        const cols = await connection.query(`PRAGMA table_info(${table})`);
        columns = cols.map((c: any) => ({ name: c.name, goType: mapGoType(c.type), isPk: c.pk === 1 }));
      }

      const structName = toPascalCase(table);
      const pkCol = (columns.find(c => c.isPk) || columns[0]).name;
      const fields = columns.map(c => `\t${toPascalCase(c.name)} ${c.goType} \`json:"${c.name}" db:"${c.name}"\``).join('\n');
      writeFileSync(path.join(projectDir, 'models', `${table}.go`), `package models\n\nimport "time"\n\ntype ${structName} struct {\n${fields}\n}\n`);

      const colNames = columns.map(c => c.name).join(', ');
      const scanFields = columns.map(c => `&item.${toPascalCase(c.name)}`).join(', ');
      const nonPkCols = columns.filter(c => !c.isPk);
      const insertCols = nonPkCols.map(c => c.name).join(', ');
      const placeholders = nonPkCols.map((_, i) => databasetype === 'postgres' || databasetype === 'postgresql' ? `$${i + 1}` : '?').join(', ');
      const insertVals = nonPkCols.map(c => `item.${toPascalCase(c.name)}`).join(', ');
      const updateSet = nonPkCols.map((c, i) => `${c.name} = ${databasetype === 'postgres' || databasetype === 'postgresql' ? `$${i + 1}` : '?'}`).join(', ');
      const nonPkCount = nonPkCols.length;
      const finalUpdatePkPlaceholder = databasetype === 'postgres' || databasetype === 'postgresql' ? `\$${nonPkCount + 1}` : '?';

      writeFileSync(path.join(projectDir, 'repositories', `${table}_repository.go`), `package repositories\n\nimport ("database/sql"; "${projectname}/models")\n\ntype ${structName}Repository struct { DB *sql.DB }\n\nfunc (r *${structName}Repository) GetAll() ([]models.${structName}, error) { rows, err := r.DB.Query("SELECT ${colNames} FROM ${table}"); if err != nil { return nil, err }; defer rows.Close(); var items []models.${structName}; for rows.Next() { var item models.${structName}; if err := rows.Scan(${scanFields}); err != nil { return nil, err }; items = append(items, item) }; return items, nil }\nfunc (r *${structName}Repository) GetByID(id interface{}) (*models.${structName}, error) { item := &models.${structName}{}; err := r.DB.QueryRow("SELECT ${colNames} FROM ${table} WHERE ${pkCol} = ${databasetype === 'postgres' || databasetype === 'postgresql' ? '$1' : '?'}", id).Scan(${scanFields}); if err != nil { return nil, err }; return item, nil }\nfunc (r *${structName}Repository) Create(item *models.${structName}) error { _, err := r.DB.Exec("INSERT INTO ${table} (${insertCols}) VALUES (${placeholders})", ${insertVals}); return err }\nfunc (r *${structName}Repository) Update(id interface{}, item *models.${structName}) error { _, err := r.DB.Exec("UPDATE ${table} SET ${updateSet} WHERE ${pkCol} = ${finalUpdatePkPlaceholder}", ${insertVals}, id); return err }\nfunc (r *${structName}Repository) Delete(id interface{}) error { _, err := r.DB.Exec("DELETE FROM ${table} WHERE ${pkCol} = ${databasetype === 'postgres' || databasetype === 'postgresql' ? '$1' : '?'}", id); return err }\n`);
      writeFileSync(path.join(projectDir, 'handlers', `${table}_handler.go`), `package handlers\n\nimport ("database/sql"; "encoding/json"; "net/http"; "strings"; "${projectname}/repositories"; "${projectname}/models")\n\ntype ${structName}Handler struct { Repo *repositories.${structName}Repository }\nfunc New${structName}Handler(db *sql.DB) *${structName}Handler { return &${structName}Handler{Repo: &repositories.${structName}Repository{DB: db}} }\nfunc (h *${structName}Handler) Handle(w http.ResponseWriter, r *http.Request) { parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/"); id := ""; if len(parts) > 2 { id = parts[len(parts)-1] }; switch r.Method { case http.MethodGet: if id == "" { items, err := h.Repo.GetAll(); if err != nil { http.Error(w, err.Error(), 500); return }; json.NewEncoder(w).Encode(items) } else { item, err := h.Repo.GetByID(id); if err != nil { http.Error(w, "Not Found", 404); return }; json.NewEncoder(w).Encode(item) }; case http.MethodPost: var item models.${structName}; json.NewDecoder(r.Body).Decode(&item); h.Repo.Create(&item); w.WriteHeader(201); json.NewEncoder(w).Encode(item); case http.MethodPut: if id == "" { http.Error(w, "ID required", 400); return }; var item models.${structName}; json.NewDecoder(r.Body).Decode(&item); h.Repo.Update(id, &item); json.NewEncoder(w).Encode(item); case http.MethodDelete: h.Repo.Delete(id); w.WriteHeader(204); default: http.Error(w, "Method not allowed", 405) } }\n`);
      
      routeRegistrations.push(`\tmux.HandleFunc("/api/${table}", handlers.New${structName}Handler(db).Handle)\n\tmux.HandleFunc("/api/${table}/", handlers.New${structName}Handler(db).Handle)`);
      
      swaggerPaths[`/api/${table}`] = { get: { tags: [structName], summary: `List all ${table}` }, post: { tags: [structName], summary: `Create ${table}` } };
      swaggerPaths[`/api/${table}/{id}`] = { get: { tags: [structName], summary: `Get ${table} by ID` }, put: { tags: [structName], summary: `Update ${table}` }, delete: { tags: [structName], summary: `Delete ${table}` } };
    }

    const dsn = host.includes('://') ? host : dbInfo.dsn;
    writeFileSync(path.join(projectDir, 'main.go'), `package main\n\nimport ("database/sql"; "fmt"; "log"; "net/http"; _ "${dbInfo.pkg}"; "${projectname}/handlers")\n\nfunc main() {\n\tdb, err := sql.Open("${dbInfo.driver}", "${dsn}")\n\tif err != nil { log.Fatal(err) }\n\tdefer db.Close()\n\tmux := http.NewServeMux()\n${routeRegistrations.join('\n')}\n\tmux.HandleFunc("/docs/", func(w http.ResponseWriter, r *http.Request) { http.ServeFile(w, r, "./docs/index.html") })\n\tmux.HandleFunc("/docs/swagger.json", func(w http.ResponseWriter, r *http.Request) { http.ServeFile(w, r, "./docs/swagger.json") })\n\tfmt.Println("Server running on :8080\\nDocumentation: http://localhost:8080/docs/")\n\tlog.Fatal(http.ListenAndServe(":8080", mux))\n}\n`);
    writeFileSync(path.join(projectDir, 'docs', 'swagger.json'), JSON.stringify({ swagger: "2.0", info: { title: `${projectname} API`, version: "1.0" }, paths: swaggerPaths }, null, 2));
    writeFileSync(path.join(projectDir, 'docs', 'index.html'), `<!DOCTYPE html><html><head><link rel="stylesheet" type="text/css" href="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui.min.css"><script src="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui-bundle.min.js"></script></head><body><div id="swagger-ui"></div><script>SwaggerUIBundle({url: "/docs/swagger.json", dom_id: "#swagger-ui"});</script></body></html>`);
    writeFileSync(path.join(projectDir, 'go.mod'), `module ${projectname}\n\ngo 1.21\n\nrequire ${dbInfo.pkg} v1.1.0\n`);

    return { success: true, message: `Go project '${projectname}' generated at ${projectDir}`, language: 'go', tables: tables.map(t => toPascalCase(t)), data: { host, database, username, databasetype, path: outputPath, projectname, port } };
  }
}
export { GoGeneratorService };
