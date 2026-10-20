import { Request, Response } from 'express';
import { CsharpGeneratorService } from '../services/csharpGeneratorService';

class csharpController {
  async handle(request: Request, response: Response) {
    const { host, database, username, password, databasetype, path, projectname, port } = request.body;

    const service = new CsharpGeneratorService();
    const result = await service.execute({ host, database, username, password, databasetype, path, projectname, port });

    return response.json(result);
  }
}

export { csharpController };
