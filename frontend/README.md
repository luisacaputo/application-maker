# Application Maker workspace

React and TypeScript frontend for the Application Maker generator.

```sh
pnpm dev
pnpm build
```

During local development, the generator API must be running at
`http://localhost:5002`; Vite proxies browser requests from `/api` to that API.

For the complete Docker deployment, run this from the repository root:

```sh
docker compose up -d --build --wait
```

Open `http://localhost:8080`. Nginx serves the production frontend and proxies
`/api` to the internal API, including ZIP downloads. Generated projects persist
in a Docker volume. See the [deployment instructions](../Nodejs/Readme.md#deploy-com-docker-compose)
for database connectivity, port configuration, backups and production access.

## Login and logout

Login accepts a valid email address with the exact `@capgemini.com` domain,
case-insensitively. The address is kept in `sessionStorage` for the current
browser tab. Logout clears it, resets the workspace and clears in-memory project
activity and credentials. Pending generation requests are cancelled in the
browser; a generation already started on the server may still finish.

This is a domain-only UI access gate, not authentication: it does not verify
mailbox ownership, issue tokens, or protect the generator API. Production access
control requires server-side authentication.

## Dashboard

The dashboard reports successful generations from the current page lifecycle,
with project, model and framework counts, project search/filtering and
generated project details. Activity is held in memory, never contains connection
strings, and is cleared on logout or page refresh. No sample projects or
invented metrics are displayed.

## Project generation

The project form supports Node.js with NestJS, Express or Fastify and Prisma,
and C# / .NET with ASP.NET Core and Entity Framework Core. The project name is
optional; when omitted, the generator chooses a name automatically.

C# generation returns a **Baixar projeto (.zip)** action in the result and project
details. Extract it on your computer, install the .NET 8 SDK, check the database
connection in `appsettings.json`, and run these commands in the project folder:

```sh
dotnet restore
dotnet run --launch-profile http
```

Swagger opens at `http://localhost:5000/swagger`. Stop the API with Ctrl+C.
SQLite file paths must refer to a database available on the computer running the
project. The ZIP contains database configuration, potentially including
credentials: keep it and its download link private.

The login and workspace reference the blue and white Capgemini logos hosted on
the official [Capgemini website](https://www.capgemini.com/). These images require
access to that domain.
