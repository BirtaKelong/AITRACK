
export type TransactionType = 'income' | 'expense';

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string; // Stored locally for this demo
}

export interface Transaction {
  id: string;
  date: string;
  amount: number;
  category: string;
  description: string;
  type: TransactionType;
}

export interface Budget {
  category: string;
  limit: number;
}

export interface RecurringTransaction {
  id: string;
  description: string;
  amount: number;
  category: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  nextDate: string;
  type: TransactionType;
}

export interface CategorySummary {
  name: string;
  value: number;
  color: string;
}

export interface MonthlyData {
  month: string;
  income: number;
  expenses: number;
}
