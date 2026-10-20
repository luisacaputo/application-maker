import { Request, Response } from 'express';
import { PythonGeneratorService } from '../services/pythonGeneratorService';

class pythonController {
  async handle(request: Request, response: Response) {
    const { host, database, username, password, databasetype, path, projectname, port } = request.body;

    const service = new PythonGeneratorService();
    const result = await service.execute({ host, database, username, password, databasetype, path, projectname, port });

    return response.json(result);
  }
}

export { pythonController };
