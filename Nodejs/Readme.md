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