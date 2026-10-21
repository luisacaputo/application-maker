import type { Request, Response, NextFunction } from 'express';
import { getProjectArchivePath } from '../services/projectArchive';

export function downloadProject(request: Request, response: Response, next: NextFunction): void {
  const archivePath = getProjectArchivePath(request.params.id);
  if (!archivePath) {
    response.status(400).json({ error: 'Invalid project download identifier' });
    return;
  }

  response.setHeader('Cache-Control', 'no-store');
  response.download(archivePath, 'projeto.zip', error => {
    if (!error) return;
    if (response.headersSent) {
      next(error);
    } else if ('code' in error && error.code === 'ENOENT') {
      response.status(404).json({ error: 'Project ZIP not found. Generate the project again.' });
    } else {
      next(error);
    }
  });
}
