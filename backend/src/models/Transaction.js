import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['income', 'expense'],
      required: [true, 'Transaction type is required.'],
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required.'],
      min: [0.01, 'Amount must be greater than zero.'],
      max: [1_000_000_000, 'Amount cannot exceed 1,000,000,000.'],
    },
    category: {
      type: String,
      required: [true, 'Category is required.'],
      trim: true,
      maxlength: [100, 'Category cannot exceed 100 characters.'],
    },
    description: {
      type: String,
      trim: true,
      default: '',
      maxlength: [500, 'Description cannot exceed 500 characters.'],
    },
    date: {
      type: Date,
      required: [true, 'Transaction date is required.'],
    },
  },
  { timestamps: true },
);

export default mongoose.model('Transaction', transactionSchema);
