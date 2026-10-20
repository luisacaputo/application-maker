import { Router } from 'express';
import { generateController } from './controllers/generateController';
import { csharpController } from './controllers/csharpController';
import { pythonController } from './controllers/pythonController';
import { goController } from './controllers/goController';
import { NestPrismaController } from './controllers/nestPrismaController';

const router = Router();

const nodejsCtrl = new generateController();
const csharpCtrl = new csharpController();
const pythonCtrl = new pythonController();
const goCtrl = new goController();
const nestPrismaCtrl = new NestPrismaController();

// Node.js framework and ORM combinations
router.post('/generateapi/nodejs/:framework(nestjs|express|fastify)/prisma', nestPrismaCtrl.handle);
// Node.js generation
router.post('/generateapi', nodejsCtrl.handle);
router.post('/generateapi/nodejs', nodejsCtrl.handle);

// C# .NET generation
router.post('/generateapi/csharp', csharpCtrl.handle);

// Python Django REST generation
router.post('/generateapi/python', pythonCtrl.handle);

// Go generation
router.post('/generateapi/go', goCtrl.handle);

export { router };