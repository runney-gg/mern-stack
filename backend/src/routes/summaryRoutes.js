import { Router } from 'express';
import { getSummary } from '../controllers/transactionController.js';
import { requireDatabase } from '../config/db.js';

const router = Router();
router.get('/', requireDatabase, getSummary);

export default router;
