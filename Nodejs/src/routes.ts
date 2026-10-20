import { Router } from 'express';
import { generateController } from './controllers/generateController';
import { csharpController } from './controllers/csharpController';
import { pythonController } from './controllers/pythonController';
import { goController } from './controllers/goController';

const router = Router();

const nodejsCtrl = new generateController();
const csharpCtrl = new csharpController();
const pythonCtrl = new pythonController();
const goCtrl = new goController();

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