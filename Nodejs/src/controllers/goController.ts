import { Request, Response } from 'express';
import { GoGeneratorService } from '../services/goGeneratorService';

class goController {
  async handle(request: Request, response: Response) {
    const { host, database, username, password, databasetype, path, projectname, port } = request.body;

    const service = new GoGeneratorService();
    const result = await service.execute({ host, database, username, password, databasetype, path, projectname, port });

    return response.json(result);
  }
}

export { goController };
