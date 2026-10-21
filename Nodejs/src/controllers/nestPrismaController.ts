import { Request, Response } from 'express';
import { NestPrismaGeneratorService, validateProjectName } from '../services/nestPrismaGenerator';
import { createProjectArchive } from '../services/projectArchive';

const generator = new NestPrismaGeneratorService();

class NestPrismaController {
  async handle(request: Request, response: Response) {
    const { connectionString, projectName, orm } = request.body ?? {};
    const framework = request.params.framework ?? 'nestjs';
    if ((framework !== 'nestjs' && framework !== 'express' && framework !== 'fastify') || orm !== 'prisma' ||
        request.body?.framework !== framework) {
      return response.status(400).json({ error: 'Use NestJS, Express or Fastify with Prisma, matching the requested route' });
    }
    if (typeof connectionString !== 'string' || connectionString.trim().length === 0) {
      return response.status(400).json({ error: 'connectionString is required' });
    }

    const name = validateProjectName(projectName);
    const result = await generator.execute({
      connectionString, projectName: name, framework,
    });
    const downloadUrl = await createProjectArchive(result.path);
    return response.status(201).json({ ...result, downloadUrl });
  }
}

export { NestPrismaController };
