import { Router } from 'express';
import {
  createTransaction,
  deleteTransaction,
  listTransactions,
  updateTransaction,
} from '../controllers/transactionController.js';
import { requireDatabase } from '../config/db.js';

const router = Router();

router.use(requireDatabase);
router.route('/').get(listTransactions).post(createTransaction);
router.route('/:id').put(updateTransaction).delete(deleteTransaction);

export default router;
