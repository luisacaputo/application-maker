import { writeFileSync, mkdirSync, existsSync } from "fs";
import path from "path";
import { Conecttype } from "./conecttype";

interface IGenerateRequest {
  host: string;
  database: string;
  username: string;
  password: string;
  databasetype: string;
  path: string;
  projectname: string;
  port: number;
  connectionString?: string;
}

const TYPE_MAP: Record<string, string> = {
  varchar: "string",
  nvarchar: "string",
  text: "string",
  ntext: "string",
  char: "string",
  nchar: "string",
  int: "int",
  bigint: "long",
  smallint: "short",
  tinyint: "byte",
  bit: "bool",
  boolean: "bool",
  float: "double",
  real: "float",
  numeric: "decimal",
  decimal: "decimal",
  money: "decimal",
  datetime: "DateTime",
  datetime2: "DateTime",
  date: "DateTime",
  time: "TimeSpan",
  timestamp: "DateTime",
  datetimeoffset: "DateTimeOffset",
  uniqueidentifier: "Guid",
  uuid: "Guid",
  "character varying": "string",
  "timestamp without time zone": "DateTime",
  "timestamp with time zone": "DateTimeOffset",
};

function mapType(dbType: string): string {
  return TYPE_MAP[dbType.toLowerCase()] || "string";
}

function connectionStringValue(value: string): string {
  return /[;{}]/.test(value) ? `{${value.replace(/}/g, "}}")}}` : value;
}

class CsharpGeneratorService {
  async execute({
    host,
    database,
    username,
    password,
    databasetype,
    path: outputPath,
    projectname,
    port,
    connectionString,
  }: IGenerateRequest) {
    console.log(`[C#] Full Introspection for ${databasetype}`);

    await new Conecttype().execute({
      host,
      database,
      username,
      password,
      databasetype,
      port,
      connectionString,
    });
    const { activeDataSource } = await import("./conecttype");
    const connection = activeDataSource;
    if (!connection || !connection.isInitialized)
      throw new Error("Database connection not initialized");

    const projectDir = path.join(outputPath, projectname);
    const namespaceBase = this.toPascalCase(projectname);
    const projectNamespace = /^[a-z_]/i.test(namespaceBase)
      ? namespaceBase
      : `Project${namespaceBase}`;
    const dirs = [
      projectDir,
      path.join(projectDir, "Controllers"),
      path.join(projectDir, "Models"),
      path.join(projectDir, "Repositories"),
      path.join(projectDir, "Interfaces"),
      path.join(projectDir, "Data"),
      path.join(projectDir, "Properties"),
    ];
    dirs.forEach((d) => {
      if (!existsSync(d)) mkdirSync(d, { recursive: true });
    });

    let tables: string[] = [];
    if (databasetype === "sql" || databasetype === "mssql") {
      const rows = await connection.query(
        "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE='BASE TABLE'",
      );
      tables = rows.map((r: any) => r.TABLE_NAME as string);
    } else if (databasetype === "postgres" || databasetype === "postgresql") {
      const rows = await connection.query(
        "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'",
      );
      tables = rows.map((r: any) => r.table_name as string);
    } else if (databasetype === "mysql") {
      const rows = await connection.query("SHOW TABLES");
      tables = rows.map((r: any) => Object.values(r)[0] as string);
    } else if (databasetype === "sqlite") {
      const rows = await connection.query(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
      );
      tables = rows.map((r: any) => r.name);
    }

    const dbContextEntries: string[] = [];
    const serviceRegistrations: string[] = [];

    for (const table of tables) {
      let columns: Array<{ name: string; type: string; isPk: boolean }> = [];
      if (databasetype === "sql" || databasetype === "mssql") {
        const cols = await connection.query(
          `SELECT c.COLUMN_NAME as name, c.DATA_TYPE as type, CASE WHEN pk.COLUMN_NAME IS NOT NULL THEN 1 ELSE 0 END as isPk FROM INFORMATION_SCHEMA.COLUMNS c LEFT JOIN (SELECT ku.COLUMN_NAME FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE ku ON tc.CONSTRAINT_NAME = ku.CONSTRAINT_NAME WHERE tc.TABLE_NAME='${table}' AND tc.CONSTRAINT_TYPE='PRIMARY KEY') pk ON c.COLUMN_NAME = pk.COLUMN_NAME WHERE c.TABLE_NAME='${table}'`,
        );
        columns = cols.map((c: any) => ({
          name: c.name,
          type: mapType(c.type),
          isPk: c.isPk === 1,
        }));
      } else if (databasetype === "postgres" || databasetype === "postgresql") {
        const cols = await connection.query(
          `SELECT c.column_name as name, c.data_type as type, CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END as "isPk" FROM information_schema.columns c LEFT JOIN (SELECT ku.column_name FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage ku ON tc.constraint_name = ku.constraint_name WHERE tc.table_name='${table}' AND tc.constraint_type='PRIMARY KEY') pk ON c.column_name = pk.column_name WHERE c.table_name='${table}' AND c.table_schema='public'`,
        );
        columns = cols.map((c: any) => ({
          name: c.name,
          type: mapType(c.type),
          isPk: c.isPk,
        }));
      } else if (databasetype === "mysql") {
        const cols = await connection.query(`DESCRIBE ${table}`);
        columns = cols.map((c: any) => ({
          name: c.Field,
          type: mapType(c.Type.split("(")[0]),
          isPk: c.Key === "PRI",
        }));
      } else if (databasetype === "sqlite") {
        const cols = await connection.query(`PRAGMA table_info(${table})`);
        columns = cols.map((c: any) => ({
          name: c.name,
          type: mapType(c.type),
          isPk: c.pk === 1,
        }));
      }

      const pkCol = columns.find((c) => c.isPk) || columns[0];
      const pkType = pkCol.type;
      const className = this.toPascalCase(table);
      const properties = columns
        .map((c) =>
          c.isPk
            ? `    [Key]\n    public ${c.type} ${this.toPascalCase(c.name)} { get; set; }`
            : `    public ${c.type} ${this.toPascalCase(c.name)} { get; set; }`,
        )
        .join("\n\n");

      writeFileSync(
        path.join(projectDir, "Models", `${className}.cs`),
        `using System;\nusing System.ComponentModel.DataAnnotations;\nusing System.ComponentModel.DataAnnotations.Schema;\n\nnamespace ${projectNamespace}.Models\n{\n  [Table("${table}")]\n  public class ${className}\n  {\n${properties}\n  }\n}\n`,
      );
      writeFileSync(
        path.join(projectDir, "Interfaces", `I${className}Repository.cs`),
        `using System.Collections.Generic;\nusing System.Threading.Tasks;\nusing ${projectNamespace}.Models;\n\nnamespace ${projectNamespace}.Interfaces\n{\n  public interface I${className}Repository\n  {\n    Task<IEnumerable<${className}>> GetAll();\n    Task<${className}> GetById(${pkType} id);\n    Task<${className}> Add(${className} entity);\n    Task<${className}> Update(${className} entity);\n    Task<bool> Delete(${pkType} id);\n  }\n}\n`,
      );
      writeFileSync(
        path.join(projectDir, "Repositories", `${className}Repository.cs`),
        `using System.Collections.Generic;\nusing System.Threading.Tasks;\nusing Microsoft.EntityFrameworkCore;\nusing ${projectNamespace}.Data;\nusing ${projectNamespace}.Interfaces;\nusing ${projectNamespace}.Models;\n\nnamespace ${projectNamespace}.Repositories\n{\n  public class ${className}Repository : I${className}Repository\n  {\n    private readonly AppDbContext _context;\n    public ${className}Repository(AppDbContext context) { _context = context; }\n    public async Task<IEnumerable<${className}>> GetAll() => await _context.${className}s.ToListAsync();\n    public async Task<${className}> GetById(${pkType} id) => await _context.${className}s.FindAsync(id);\n    public async Task<${className}> Add(${className} entity) { _context.${className}s.Add(entity); await _context.SaveChangesAsync(); return entity; }\n    public async Task<${className}> Update(${className} entity) { _context.Entry(entity).State = EntityState.Modified; await _context.SaveChangesAsync(); return entity; }\n    public async Task<bool> Delete(${pkType} id) { var e = await _context.${className}s.FindAsync(id); if (e == null) return false; _context.${className}s.Remove(e); await _context.SaveChangesAsync(); return true; }\n  }\n}\n`,
      );
      writeFileSync(
        path.join(projectDir, "Controllers", `${className}Controller.cs`),
        `using System.Threading.Tasks;\nusing Microsoft.AspNetCore.Mvc;\nusing ${projectNamespace}.Interfaces;\nusing ${projectNamespace}.Models;\n\nnamespace ${projectNamespace}.Controllers\n{\n  [ApiController]\n  [Route("api/[controller]")]\n  [Tags("${className}")]\n  public class ${className}Controller : ControllerBase\n  {\n    private readonly I${className}Repository _repo;\n    public ${className}Controller(I${className}Repository repo) { _repo = repo; }\n    [HttpGet] public async Task<IActionResult> GetAll() => Ok(await _repo.GetAll());\n    [HttpGet("{id}")] public async Task<IActionResult> GetById(${pkType} id) { var e = await _repo.GetById(id); return e == null ? NotFound() : Ok(e); }\n    [HttpPost] public async Task<IActionResult> Add([FromBody] ${className} entity) => Ok(await _repo.Add(entity));\n    [HttpPut] public async Task<IActionResult> Update([FromBody] ${className} entity) => Ok(await _repo.Update(entity));\n    [HttpDelete("{id}")] public async Task<IActionResult> Delete(${pkType} id) => Ok(await _repo.Delete(id));\n  }\n}\n`,
      );

      dbContextEntries.push(
        `    public DbSet<${className}> ${className}s { get; set; }`,
      );
      serviceRegistrations.push(
        `builder.Services.AddScoped<I${className}Repository, ${className}Repository>();`,
      );
    }

    const connStr = host.includes("://")
      ? host
      : databasetype === "sql" || databasetype === "mssql"
        ? `Server=${host},${port};Database=${database};User Id=${username};Password=${password};TrustServerCertificate=True;`
        : databasetype === "postgres" || databasetype === "postgresql"
          ? `Host=${host};Port=${port};Database=${database};Username=${username};Password=${password};`
          : databasetype === "sqlite"
            ? `Data Source=Data/${database.endsWith(".db") ? database : database + ".db"}`
            : `Server=${host};Port=${port};Database=${database};Uid=${username};Pwd=${password};`;
    writeFileSync(
      path.join(projectDir, "Data", "AppDbContext.cs"),
      `using Microsoft.EntityFrameworkCore;\nusing ${projectNamespace}.Models;\n\nnamespace ${projectNamespace}.Data\n{\n  public class AppDbContext : DbContext\n  {\n    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) {}\n\n${dbContextEntries.join("\n")}\n  }\n}\n`,
    );
    const efProvider =
      databasetype === "sql" || databasetype === "mssql"
        ? `builder.Services.AddDbContext<AppDbContext>(o => o.UseSqlServer(builder.Configuration.GetConnectionString("Default")));`
        : databasetype === "postgres" || databasetype === "postgresql"
          ? `builder.Services.AddDbContext<AppDbContext>(o => o.UseNpgsql(builder.Configuration.GetConnectionString("Default")));`
          : databasetype === "sqlite"
            ? `builder.Services.AddDbContext<AppDbContext>(o => o.UseSqlite(builder.Configuration.GetConnectionString("Default")));`
            : `builder.Services.AddDbContext<AppDbContext>(o => o.UseMySql(builder.Configuration.GetConnectionString("Default"), ServerVersion.AutoDetect(builder.Configuration.GetConnectionString("Default"))));`;
    writeFileSync(
      path.join(projectDir, "Program.cs"),
      `using ${projectNamespace}.Data;\nusing ${projectNamespace}.Interfaces;\nusing ${projectNamespace}.Repositories;\nusing Microsoft.EntityFrameworkCore;\n\nvar builder = WebApplication.CreateBuilder(args);\nbuilder.Services.AddCors(o => o.AddDefaultPolicy(p => p.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader()));\nbuilder.Services.AddControllers();\nbuilder.Services.AddEndpointsApiExplorer();\nbuilder.Services.AddSwaggerGen();\n${efProvider}\n${serviceRegistrations.join("\n")}\nvar app = builder.Build();\nif (app.Environment.IsDevelopment()) { app.UseSwagger(); app.UseSwaggerUI(); }\napp.UseCors();\napp.UseAuthorization();\napp.MapControllers();\napp.Run();\n`,
    );
    const sslMode =
      connectionString &&
        (databasetype === "postgres" || databasetype === "postgresql")
        ? new URL(connectionString).searchParams.get("sslmode")
        : null;
    const generatedConnectionString =
      databasetype === "sqlite"
        ? `Data Source=${connectionStringValue(database)}`
        : sslMode
          ? `${connStr}SSL Mode=${connectionStringValue(sslMode)};`
          : connStr;
    writeFileSync(
      path.join(projectDir, "appsettings.json"),
      JSON.stringify(
        {
          ConnectionStrings: { Default: generatedConnectionString },
          Logging: {
            LogLevel: {
              Default: "Information",
              "Microsoft.AspNetCore": "Warning",
            },
          },
          AllowedHosts: "*",
        },
        null,
        2,
      ),
    );
    const efPkg =
      databasetype === "sql" || databasetype === "mssql"
        ? '    <PackageReference Include="Microsoft.EntityFrameworkCore.SqlServer" Version="8.0.0" />'
        : databasetype === "postgres" || databasetype === "postgresql"
          ? '    <PackageReference Include="Npgsql.EntityFrameworkCore.PostgreSQL" Version="8.0.0" />'
          : databasetype === "sqlite"
            ? '    <PackageReference Include="Microsoft.EntityFrameworkCore.Sqlite" Version="8.0.0" />'
            : '    <PackageReference Include="Pomelo.EntityFrameworkCore.MySql" Version="8.0.0" />';
    writeFileSync(
      path.join(projectDir, `${projectname}.csproj`),
      `<Project Sdk="Microsoft.NET.Sdk.Web">\n  <PropertyGroup>\n    <TargetFramework>net8.0</TargetFramework>\n    <Nullable>enable</Nullable>\n    <ImplicitUsings>enable</ImplicitUsings>\n  </PropertyGroup>\n  <ItemGroup>\n    <PackageReference Include="Microsoft.AspNetCore.OpenApi" Version="8.0.0" />\n    <PackageReference Include="Microsoft.EntityFrameworkCore" Version="8.0.0" />\n    <PackageReference Include="Microsoft.EntityFrameworkCore.Design" Version="8.0.0" />\n${efPkg}\n    <PackageReference Include="Swashbuckle.AspNetCore" Version="6.5.0" />\n  </ItemGroup>\n</Project>\n`,
    );
    writeFileSync(
      path.join(projectDir, "Properties", "launchSettings.json"),
      JSON.stringify(
        {
          profiles: {
            http: {
              commandName: "Project",
              dotnetRunMessages: true,
              launchBrowser: true,
              launchUrl: "swagger",
              applicationUrl: "http://localhost:5000",
              environmentVariables: { ASPNETCORE_ENVIRONMENT: "Development" },
            },
          },
        },
        null,
        2,
      ),
    );

    return {
      success: true,
      message: `C# project '${projectname}' generated at ${projectDir}`,
      language: "csharp",
      tables: tables.map((t) => this.toPascalCase(t)),
      data: {
        host,
        database,
        username,
        databasetype,
        path: outputPath,
        projectname,
        port,
      },
    };
  }
  private toPascalCase(str: string): string {
    return str.replace(/(^|[_-])([a-z])/gi, (_, __, c) => c.toUpperCase());
  }
}
export { CsharpGeneratorService };
