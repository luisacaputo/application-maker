# Node.js generator

Supported targets are **NestJS + Prisma**, **Express + Prisma**, and
**Fastify + Prisma**, sharing introspection, DTO validation/examples, and CRUD
services. The older Express/TypeORM generator remains available at
`/generateapi/nodejs` without changes.

## Framework selection and project names

Use `POST /generateapi/nodejs/<framework>/prisma`, where `<framework>` is
`nestjs`, `express`, or `fastify`, with this JSON body:

```json
{
  "connectionString": "file:/absolute/path/to/database.db",
  "framework": "express",
  "orm": "prisma",
  "projectName": "customer-api"
}
```

`projectName` is optional. Use 1-80 lowercase letters, numbers or hyphens,
starting and ending with a letter or number (`node_modules` is reserved).
The name is used in `package.json` and Swagger; output folders include a unique
suffix to avoid overwriting earlier generations. Omitting the name preserves
automatic naming. The web UI supports the same options.
The web UI locks configuration while generating, clears previous results when
configuration changes, and rejects success responses for a different framework.

All three targets provide CRUD at `/api/<model-name>` and Swagger at `/docs`.
Express/Fastify also expose the OpenAPI document at `/docs-json`. Generated
Express/Fastify projects require Node.js 20+ and use the same setup commands:
`npm install`, `npm run start:dev`, and `npm run build`.

Run `npm test` for generator regression tests. `npm run test:integration`
creates a temporary SQLite database, generates and builds Express/Fastify apps,
and exercises real CRUD, validation, BigInt serialization and Swagger. It
requires network access to install generated dependencies and cleans up its
temporary projects and database.

## Run the generator

From this directory:

```sh
npm install
npm run dev
```

The API listens on port `5002`. The web UI is in `../frontend`.

## C# / .NET generation

Use `POST /generateapi/csharp` with `framework: "aspnetcore"`, `orm: "efcore"`,
an optional `projectName`, and a supported database `connectionString`.
Generated ASP.NET Core 8 projects use Entity Framework Core and are written to
`generated-projects/csharp/`.

PostgreSQL URLs retain their SSL parameters during C# database introspection.
Both Node.js and C# generation add `sslmode=require` when it is absent; explicit
modes such as `sslmode=verify-full` or `sslmode=disable` are preserved. The C#
project's Npgsql connection string also includes the selected SSL mode.

C# generation responses include the absolute project `path` and a `downloadUrl`.
`GET /downloads/<id>` downloads the generated ZIP; the random download link is a
bearer capability and must be kept private. Archives persist under
`generated-projects/.downloads/` across API restarts. They exclude `bin`, `obj`,
`.git` and `node_modules`, reject symbolic links, and include database
configuration, which may contain credentials. Delete obsolete archives there
when they are no longer needed.

To run a downloaded project locally, extract the ZIP, check `appsettings.json`,
then run `dotnet restore` and `dotnet run --launch-profile http` with the .NET 8
SDK. Swagger is at `http://localhost:5000/swagger`; Ctrl+C stops the API.

## Supported connection string schemes

- PostgreSQL: `postgresql://user:password@host:5432/database?schema=public`
- MySQL: `mysql://user:password@host:3306/database`
- SQL Server: `sqlserver://host:1433;database=database;user=user;password=password;trustServerCertificate=true`
- SQLite: `file:./database.db`

The generator runs Prisma introspection and writes projects under
`Nodejs/generated-projects/`. It passes the connection string to the
introspection process through its environment and does not write it into the
generated project. Copy `.env.example` to `.env` in the generated project,
configure `DATABASE_URL`, then install dependencies and run the app.

CRUD controllers are generated only for Prisma models with a single `String`,
`Int`, or `BigInt` primary/unique key. Models with composite keys or other key
types are reported as skipped rather than receiving incorrect CRUD endpoints.
The generated CRUD routes include list pagination, read-by-key, create, update,
and delete. Authentication, authorization, generation history, and artifact
downloads are not part of this first slice.

Generated create/update DTOs expose realistic, synthetic examples in Swagger
(`/docs`), based on field names and Prisma types, including enums and arrays.
Examples do not read existing database records or set runtime default values.
Replace unique values and foreign keys with suitable test data before sending
requests. This applies to newly generated projects.

## Deploy com Docker Compose

Na raiz do repositorio, com Docker Engine e Docker Compose instalados:

```sh
docker compose up -d --build --wait
```

Abra `http://localhost:8080` (ou o IP/dominio do servidor). Para outra porta:
`PORT=80 docker compose up -d --build --wait`.

O servico `web` compila o frontend e serve-o com Nginx, que encaminha `/api/`
para a API interna. Apenas o Nginx publica uma porta; geracao e downloads usam a
mesma origem. O timeout do proxy permite pedidos de geracao demorados. A API
corre como utilizador nao-root e os projetos/ZIPs ficam no volume persistente
`generated-projects`. Nao e necessario instalar Node.js ou .NET no host para
executar o gerador. O SDK .NET continua a ser necessario para executar projetos
C# descarregados.

As bases de dados de origem nao sao criadas pelo Compose. Use uma ligacao
acessivel a partir do contentor; `localhost` aponta para o proprio contentor.
Para uma base no host Docker, use `host.docker.internal` e configure a base para
aceitar ligacoes da rede Docker. SQLite exige um ficheiro acessivel dentro do
contentor; pode adicionar um bind mount para a pasta que contem a base.
A geracao Node.js requer acesso de saida ao npm para executar o Prisma.

```sh
docker compose ps
docker compose logs -f
docker compose down
```

`down` preserva os projetos. **Nao use `down -v` se pretender manter os dados.**
Faca backup do volume antes de migrar o deploy para outro servidor.
Para atualizar o codigo, execute novamente o comando de arranque.

Antes de expor o servico na Internet, coloque-o atras de HTTPS e controlo de
acesso (por exemplo num proxy de entrada). Esta configuracao serve HTTP e nao
adiciona autenticacao; os projetos e links ZIP podem conter credenciais.

## Deploy no Render (um unico servico)

O `Dockerfile` na raiz compila frontend e API e executa ambos no mesmo contentor.
O Nginx publica a porta `PORT` fornecida pelo Render e encaminha `/api/` para
a API interna. Supervisor gere os dois processos; ambos correm sem root.
O Docker Compose continua disponivel para VPS e nao e usado neste deploy.

Depois de enviar estes ficheiros para o GitHub, configure um **Web Service**:

- Runtime: **Docker**.
- Root Directory: vazio (raiz do repositorio).
- Dockerfile Path: `./Dockerfile`.
- Docker Build Context Directory: `.` (se apresentado).
- Docker Command: vazio, para usar o comando definido na imagem.
- Health Check Path: `/healthz` (verifica tambem a API).
- `PORT`: use o valor fornecido pelo Render; por omissao a imagem usa `10000`.

Faca deploy do commit que inclui o Dockerfile da raiz. Nao aponte apenas para
`frontend/Dockerfile` ou `Nodejs/Dockerfile`: esses ficheiros sao destinados aos
servicos separados do Compose.

Para manter projetos e ZIPs entre deploys/reinicios, adicione um **Persistent
Disk** montado em `/app/generated-projects` num plano que suporte discos.
Sem esse disco, o armazenamento e efemero e os downloads antigos podem deixar
de existir. A montagem deve permitir escrita pelo utilizador `node` (UID 1000).
As bases de dados de origem devem ser acessiveis a partir do Render;
`host.docker.internal` nao aponta para o seu computador neste ambiente.

O Render termina HTTPS no endereco publico do servico. Configure controlo de
acesso antes de disponibilizar o gerador publicamente: o login atual e apenas
uma restricao na interface, nao autenticacao da API.

Para testar a mesma imagem localmente:

```sh
docker build -t application-maker .
docker run --rm -p 10000:10000 -v application-maker-data:/app/generated-projects application-maker
```
