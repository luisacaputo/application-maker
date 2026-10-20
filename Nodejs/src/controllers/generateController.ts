import { Request, Response } from 'express';
import { Creategenerateservice } from '../services/generateServices';

class generateController {
  async handle(request: Request, response: Response) {
    const { host, database, username, password, databasetype, path, projectname, port } = request.body;

    const creategenerateservice = new Creategenerateservice();
    const result = await creategenerateservice.execute({ host, database, username, password, databasetype, path, projectname, port });

    return response.json(result);
  }
}

export { generateController };