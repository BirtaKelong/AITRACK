
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  PieChart as PieChartIcon, 
  History, 
  Sparkles,
  Trash2,
  Filter,
  Bell,
  Settings,
  Calendar,
  AlertTriangle,
  Moon,
  Sun,
  Download,
  FileText,
  ChevronRight
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  PieChart,
  Pie,
  Legend
} from 'recharts';
import { Transaction, TransactionType, Budget, RecurringTransaction } from './types';
import { INCOME_CATEGORIES, EXPENSE_CATEGORIES, CATEGORY_COLORS, CURRENCY_SYMBOL } from './constants';
import { getFinancialInsights } from './services/geminiService';

const App: React.FC = () => {
  // --- Core State ---
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('fin-track-dark-mode');
    return saved ? JSON.parse(saved) : false;
  });

  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem('fin-track-tx');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [budgets, setBudgets] = useState<Budget[]>(() => {
    const saved = localStorage.getItem('fin-track-budgets');
    return saved ? JSON.parse(saved) : [];
  });

  const [recurring, setRecurring] = useState<RecurringTransaction[]>(() => {
    const saved = localStorage.getItem('fin-track-recurring');
    return saved ? JSON.parse(saved) : [];
  });

  const [activeTab, setActiveTab] = useState<'dashboard' | 'history' | 'insights' | 'budgets' | 'reports'>('dashboard');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'transaction' | 'budget' | 'recurring'>('transaction');
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );

  // --- AI State ---
  const [aiInsights, setAiInsights] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // --- Form States ---
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<TransactionType>('expense');
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'monthly'>('monthly');

  // --- Effects ---
  useEffect(() => {
    localStorage.setItem('fin-track-dark-mode', JSON.stringify(darkMode));
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  useEffect(() => {
    localStorage.setItem('fin-track-tx', JSON.stringify(transactions));
    checkBudgetExceedance();
  }, [transactions]);

  useEffect(() => {
    localStorage.setItem('fin-track-budgets', JSON.stringify(budgets));
  }, [budgets]);

  useEffect(() => {
    localStorage.setItem('fin-track-recurring', JSON.stringify(recurring));
    checkUpcomingRecurring();
  }, [recurring]);

  // --- Notification Logic ---
  const requestPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
    }
  };

  const sendNotification = (title: string, body: string) => {
    if (notificationPermission === 'granted') {
      new Notification(title, { body, icon: 'https://cdn-icons-png.flaticon.com/512/2845/2845831.png' });
    }
  };

  const checkBudgetExceedance = () => {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    
    budgets.forEach(budget => {
      const spent = transactions
        .filter(t => t.type === 'expense' && 
                t.category === budget.category && 
                new Date(t.date).getMonth() === currentMonth &&
                new Date(t.date).getFullYear() === currentYear)
        .reduce((sum, t) => sum + t.amount, 0);

      if (spent >= budget.limit) {
        sendNotification('Budget Alert!', `You've exceeded your ${budget.category} budget.`);
      } else if (spent >= budget.limit * 0.8) {
        sendNotification('Budget Warning', `You're at 80% of your ${budget.category} budget.`);
      }
    });
  };

  const checkUpcomingRecurring = () => {
    const today = new Date();
    recurring.forEach(r => {
      const nextDate = new Date(r.nextDate);
      const diffTime = nextDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays <= 2 && diffDays >= 0) {
        sendNotification('Upcoming Bill', `${r.description} is due in ${diffDays} day(s).`);
      }
    });
  };

  // --- Derived State ---
  const stats = useMemo(() => {
    const income = transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
    const expenses = transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
    return { income, expenses, balance: income - expenses };
  }, [transactions]);

  const chartData = useMemo(() => {
    const categories: Record<string, number> = {};
    transactions
      .filter(t => t.type === 'expense')
      .forEach(t => {
        categories[t.category] = (categories[t.category] || 0) + t.amount;
      });
    
    return Object.entries(categories).map(([name, value]) => ({
      name,
      value,
      color: CATEGORY_COLORS[name] || '#94A3B8'
    }));
  }, [transactions]);

  const monthlyHistoryData = useMemo(() => {
    const months: Record<string, { income: number, expense: number }> = {};
    const sorted = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    sorted.forEach(t => {
      const monthYear = new Date(t.date).toLocaleString('default', { month: 'short', year: '2-digit' });
      if (!months[monthYear]) months[monthYear] = { income: 0, expense: 0 };
      if (t.type === 'income') months[monthYear].income += t.amount;
      else months[monthYear].expense += t.amount;
    });

    return Object.entries(months).map(([name, vals]) => ({
      name,
      income: vals.income,
      expense: vals.expense
    }));
  }, [transactions]);

  const exportToCSV = () => {
    if (transactions.length === 0) return;
    
    const headers = ['Date', 'Description', 'Category', 'Type', 'Amount (INR)'];
    const rows = transactions.map(tx => [
      new Date(tx.date).toLocaleDateString(),
      tx.description || 'N/A',
      tx.category,
      tx.type,
      tx.amount
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `FinTrack_Report_${new Date().toLocaleDateString()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- Handlers ---
  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) return;

    if (modalType === 'transaction') {
      const newTx: Transaction = {
        id: crypto.randomUUID(),
        amount: parseFloat(amount),
        type,
        category,
        description,
        date,
      };
      setTransactions([newTx, ...transactions]);
    } else if (modalType === 'budget') {
      const newBudget: Budget = { category, limit: parseFloat(amount) };
      setBudgets(prev => {
        const filtered = prev.filter(b => b.category !== category);
        return [...filtered, newBudget];
      });
    } else if (modalType === 'recurring') {
      const newRecurring: RecurringTransaction = {
        id: crypto.randomUUID(),
        description,
        amount: parseFloat(amount),
        category,
        frequency,
        nextDate: date,
        type,
      };
      setRecurring([newRecurring, ...recurring]);
    }

    setIsModalOpen(false);
    resetForm();
  };

  const resetForm = () => {
    setAmount('');
    setType('expense');
    setCategory(EXPENSE_CATEGORIES[0]);
    setDescription('');
    setDate(new Date().toISOString().split('T')[0]);
  };

  const deleteTransaction = (id: string) => setTransactions(transactions.filter(t => t.id !== id));
  const deleteBudget = (cat: string) => setBudgets(budgets.filter(b => b.category !== cat));
  const deleteRecurring = (id: string) => setRecurring(recurring.filter(r => r.id !== id));

  const fetchInsights = async () => {
    if (transactions.length === 0) {
      setAiInsights("Add some transactions first so I can analyze your spending habits!");
      setActiveTab('insights');
      return;
    }
    setIsAnalyzing(true);
    setActiveTab('insights');
    const insights = await getFinancialInsights(transactions);
    setAiInsights(insights);
    setIsAnalyzing(false);
  };

  return (
    <div className={`min-h-screen transition-colors duration-200 pb-24 md:pb-8 ${darkMode ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-900'}`}>
      {/* Header */}
      <header className={`border-b sticky top-0 z-10 px-4 py-4 sm:px-8 flex flex-wrap justify-between items-center gap-4 transition-colors duration-200 ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
        <div className="flex items-center gap-2">
          <div className="bg-blue-600 p-2 rounded-lg">
            <Wallet className="text-white w-6 h-6" />
          </div>
          <h1 className={`text-xl font-bold tracking-tight ${darkMode ? 'text-white' : 'text-slate-900'}`}>FinTrack AI</h1>
        </div>
        
        <div className="flex items-center gap-2 sm:gap-3">
          <button 
            onClick={() => setDarkMode(!darkMode)}
            className={`p-2 rounded-lg transition-all ${darkMode ? 'text-yellow-400 hover:bg-slate-700' : 'text-slate-500 hover:bg-slate-100'}`}
            title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {darkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>

          {notificationPermission !== 'granted' && (
            <button 
              onClick={requestPermission}
              className={`p-2 rounded-lg transition-all ${darkMode ? 'text-slate-400 hover:text-blue-400 hover:bg-slate-700' : 'text-slate-500 hover:text-blue-600 hover:bg-blue-50'}`}
              title="Enable Notifications"
            >
              <Bell size={20} />
            </button>
          )}
          <button 
            onClick={() => { setModalType('transaction'); setIsModalOpen(true); }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-full flex items-center gap-2 transition-all shadow-lg active:scale-95"
          >
            <Plus size={20} />
            <span className="hidden sm:inline">Add Transaction</span>
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 md:p-8 space-y-8">
        {/* Permission Callout */}
        {notificationPermission === 'default' && (
          <div className={`border p-4 rounded-2xl flex items-center justify-between gap-4 transition-colors ${darkMode ? 'bg-blue-900/30 border-blue-800' : 'bg-blue-50 border-blue-100'}`}>
            <div className="flex items-center gap-3">
              <Bell className="text-blue-500" size={20} />
              <p className={`text-sm font-medium ${darkMode ? 'text-blue-200' : 'text-blue-800'}`}>Get notified about budget alerts and bills!</p>
            </div>
            <button onClick={requestPermission} className={`text-sm font-bold hover:underline ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>Enable</button>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className={`p-6 rounded-2xl shadow-sm border transition-colors ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Total Balance</p>
            <h2 className={`text-2xl font-bold mt-1 ${stats.balance >= 0 ? (darkMode ? 'text-white' : 'text-slate-900') : 'text-red-600'}`}>
              {CURRENCY_SYMBOL}{stats.balance.toLocaleString()}
            </h2>
          </div>
          <div className={`p-6 rounded-2xl shadow-sm border transition-colors ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
            <div className="flex justify-between items-start">
              <div>
                <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Income</p>
                <h2 className="text-2xl font-bold mt-1 text-emerald-500">+{CURRENCY_SYMBOL}{stats.income.toLocaleString()}</h2>
              </div>
              <div className={`${darkMode ? 'bg-emerald-900/40' : 'bg-emerald-50'} p-2 rounded-full`}><TrendingUp className="text-emerald-500" size={20} /></div>
            </div>
          </div>
          <div className={`p-6 rounded-2xl shadow-sm border transition-colors ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
            <div className="flex justify-between items-start">
              <div>
                <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Expenses</p>
                <h2 className="text-2xl font-bold mt-1 text-rose-500">-{CURRENCY_SYMBOL}{stats.expenses.toLocaleString()}</h2>
              </div>
              <div className={`${darkMode ? 'bg-rose-900/40' : 'bg-rose-50'} p-2 rounded-full`}><TrendingDown className="text-rose-500" size={20} /></div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className={`flex p-1 rounded-xl w-fit overflow-x-auto no-scrollbar transition-colors ${darkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all whitespace-nowrap ${activeTab === 'dashboard' ? (darkMode ? 'bg-slate-700 shadow text-blue-400' : 'bg-white shadow text-blue-600') : (darkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900')}`}
          >
            <PieChartIcon size={18} /> Dashboard
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all whitespace-nowrap ${activeTab === 'history' ? (darkMode ? 'bg-slate-700 shadow text-blue-400' : 'bg-white shadow text-blue-600') : (darkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900')}`}
          >
            <History size={18} /> History
          </button>
          <button 
            onClick={() => setActiveTab('budgets')}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all whitespace-nowrap ${activeTab === 'budgets' ? (darkMode ? 'bg-slate-700 shadow text-blue-400' : 'bg-white shadow text-blue-600') : (darkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900')}`}
          >
            <Settings size={18} /> Budgets
          </button>
          <button 
            onClick={() => setActiveTab('reports')}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all whitespace-nowrap ${activeTab === 'reports' ? (darkMode ? 'bg-slate-700 shadow text-blue-400' : 'bg-white shadow text-blue-600') : (darkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900')}`}
          >
            <FileText size={18} /> Reports
          </button>
          <button 
            onClick={fetchInsights}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all whitespace-nowrap ${activeTab === 'insights' ? (darkMode ? 'bg-slate-700 shadow text-blue-400' : 'bg-white shadow text-blue-600') : (darkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900')}`}
          >
            <Sparkles size={18} /> AI Insights
          </button>
        </div>

        {/* Content Area */}
        <div className="min-h-[400px]">
          {activeTab === 'dashboard' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className={`p-6 rounded-2xl shadow-sm border transition-colors ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
                <h3 className="text-lg font-semibold mb-6">Spending by Category</h3>
                {chartData.length > 0 ? (
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={chartData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                          {chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ backgroundColor: darkMode ? '#1e293b' : '#ffffff', border: 'none', borderRadius: '8px', color: darkMode ? '#f8fafc' : '#1e293b' }}
                          itemStyle={{ color: darkMode ? '#f8fafc' : '#1e293b' }}
                          formatter={(value: number) => `${CURRENCY_SYMBOL}${value.toLocaleString()}`} 
                        />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : <div className="h-80 flex items-center justify-center text-slate-400">No expense data yet</div>}
              </div>

              <div className={`p-6 rounded-2xl shadow-sm border transition-colors ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
                <h3 className="text-lg font-semibold mb-6">Cash Flow Trend</h3>
                {monthlyHistoryData.length > 0 ? (
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={monthlyHistoryData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={darkMode ? "#334155" : "#f1f5f9"} />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: darkMode ? '#94a3b8' : '#64748b'}} />
                        <YAxis axisLine={false} tickLine={false} tick={{fill: darkMode ? '#94a3b8' : '#64748b'}} />
                        <Tooltip 
                          cursor={{fill: darkMode ? '#334155' : '#f8fafc'}}
                          contentStyle={{ backgroundColor: darkMode ? '#1e293b' : '#ffffff', border: 'none', borderRadius: '8px' }}
                          formatter={(value: number) => `${CURRENCY_SYMBOL}${value.toLocaleString()}`}
                        />
                        <Bar dataKey="income" fill="#10b981" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="expense" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : <div className="h-80 flex items-center justify-center text-slate-400">No trend data yet</div>}
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className={`rounded-2xl shadow-sm border overflow-hidden transition-colors ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
              <div className={`p-6 border-b flex justify-between items-center ${darkMode ? 'border-slate-700' : 'border-slate-100'}`}>
                <h3 className="text-lg font-semibold">Transaction History</h3>
                <div className="flex items-center gap-4">
                  <button 
                    onClick={exportToCSV}
                    className="flex items-center gap-2 text-sm font-medium text-blue-500 hover:text-blue-600 transition-colors"
                  >
                    <Download size={18} />
                    Export CSV
                  </button>
                  <Filter size={18} className="text-slate-400" />
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className={`text-xs font-medium uppercase transition-colors ${darkMode ? 'bg-slate-900/50 text-slate-400' : 'bg-slate-50 text-slate-500'}`}>
                    <tr>
                      <th className="px-6 py-3">Date</th>
                      <th className="px-6 py-3">Description</th>
                      <th className="px-6 py-3">Category</th>
                      <th className="px-6 py-3">Amount</th>
                      <th className="px-6 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y transition-colors ${darkMode ? 'divide-slate-700' : 'divide-slate-100'}`}>
                    {transactions.length > 0 ? transactions.map((tx) => (
                      <tr key={tx.id} className={`transition-colors ${darkMode ? 'hover:bg-slate-700/50' : 'hover:bg-slate-50'}`}>
                        <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">{new Date(tx.date).toLocaleDateString()}</td>
                        <td className={`px-6 py-4 font-medium ${darkMode ? 'text-white' : 'text-slate-900'}`}>{tx.description || '-'}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${darkMode ? 'bg-slate-700 text-slate-200' : 'bg-slate-100 text-slate-800'}`}>
                            {tx.category}
                          </span>
                        </td>
                        <td className={`px-6 py-4 font-semibold ${tx.type === 'income' ? 'text-emerald-500' : 'text-rose-500'}`}>
                          {tx.type === 'income' ? '+' : '-'}{CURRENCY_SYMBOL}{tx.amount.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button onClick={() => deleteTransaction(tx.id)} className="text-slate-400 hover:text-rose-500 transition-colors">
                            <Trash2 size={18} />
                          </button>
                        </td>
                      </tr>
                    )) : <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic">No transactions found</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'budgets' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Budgets Section */}
              <div className={`p-6 rounded-2xl shadow-sm border transition-colors ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <AlertTriangle size={20} className="text-amber-500" />
                    Monthly Budgets
                  </h3>
                  <button 
                    onClick={() => { setModalType('budget'); setIsModalOpen(true); }}
                    className={`text-sm font-bold flex items-center gap-1 transition-colors ${darkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'}`}
                  >
                    <Plus size={16} /> Set Budget
                  </button>
                </div>
                <div className="space-y-4">
                  {budgets.length > 0 ? budgets.map(b => {
                    const currentMonth = new Date().getMonth();
                    const currentYear = new Date().getFullYear();
                    const spent = transactions
                      .filter(t => t.type === 'expense' && 
                              t.category === b.category &&
                              new Date(t.date).getMonth() === currentMonth &&
                              new Date(t.date).getFullYear() === currentYear)
                      .reduce((sum, t) => sum + t.amount, 0);
                    const progress = Math.min((spent / b.limit) * 100, 100);
                    
                    // Determine progress color: Green (<70), Yellow (70-90), Red (>90)
                    const progressColor = progress > 90 
                      ? 'bg-rose-500' 
                      : progress > 70 
                        ? 'bg-amber-500' 
                        : 'bg-emerald-500';

                    return (
                      <div key={b.category} className={`p-4 border rounded-xl hover:shadow-md transition-all group ${darkMode ? 'border-slate-700' : 'border-slate-100'}`}>
                        <div className="flex justify-between items-center mb-2">
                          <div className="flex items-center gap-2">
                            <span className={`font-medium ${darkMode ? 'text-white' : 'text-slate-900'}`}>{b.category}</span>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${progress >= 100 ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'}`}>
                              {Math.round(progress)}%
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">{CURRENCY_SYMBOL}{spent.toLocaleString()} / {CURRENCY_SYMBOL}{b.limit.toLocaleString()}</span>
                            <button onClick={() => deleteBudget(b.category)} className="text-slate-400 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-all">
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                        <div className={`w-full h-3 rounded-full overflow-hidden ${darkMode ? 'bg-slate-700' : 'bg-slate-100'}`}>
                          <div 
                            className={`h-full transition-all duration-700 ${progressColor}`} 
                            style={{ width: `${progress}%` }} 
                          />
                        </div>
                        {progress >= 90 && (
                          <p className={`text-[10px] mt-2 font-medium flex items-center gap-1 ${progress >= 100 ? 'text-rose-500' : 'text-amber-500'}`}>
                            <AlertTriangle size={12} />
                            {progress >= 100 ? 'Budget Limit Exceeded' : 'Approaching Budget Limit'}
                          </p>
                        )}
                      </div>
                    );
                  }) : <p className="text-center text-slate-400 py-8 italic">No budgets set yet</p>}
                </div>
              </div>

              {/* Recurring Section */}
              <div className={`p-6 rounded-2xl shadow-sm border transition-colors ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Calendar size={20} className="text-indigo-500" />
                    Recurring Bills
                  </h3>
                  <button 
                    onClick={() => { setModalType('recurring'); setIsModalOpen(true); }}
                    className={`text-sm font-bold flex items-center gap-1 transition-colors ${darkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'}`}
                  >
                    <Plus size={16} /> Add Recurring
                  </button>
                </div>
                <div className="space-y-4">
                  {recurring.length > 0 ? recurring.map(r => (
                    <div key={r.id} className={`p-4 border rounded-xl hover:shadow-md transition-all group ${darkMode ? 'border-slate-700' : 'border-slate-100'}`}>
                      <div className="flex justify-between items-center">
                        <div>
                          <p className={`font-semibold ${darkMode ? 'text-white' : 'text-slate-900'}`}>{r.description}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">{r.frequency} • {r.category}</p>
                        </div>
                        <div className="text-right">
                          <p className={`font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>{CURRENCY_SYMBOL}{r.amount.toLocaleString()}</p>
                          <p className="text-xs text-slate-400 dark:text-slate-500">Next: {new Date(r.nextDate).toLocaleDateString()}</p>
                        </div>
                        <button onClick={() => deleteRecurring(r.id)} className="ml-4 text-slate-400 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-all">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  )) : <p className="text-center text-slate-400 py-8 italic">No recurring bills added</p>}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'reports' && (
            <div className="space-y-8">
              <div className={`p-8 rounded-3xl border transition-colors ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
                <div className="flex justify-between items-center mb-8">
                  <div>
                    <h3 className="text-2xl font-bold">Monthly Financial Report</h3>
                    <p className="text-slate-500 dark:text-slate-400">Summarized view of your earnings and spending</p>
                  </div>
                  <button 
                    onClick={exportToCSV}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg active:scale-95"
                  >
                    <Download size={20} />
                    Download Full CSV
                  </button>
                </div>
                
                <div className="overflow-hidden rounded-2xl border border-slate-100 dark:border-slate-700">
                  <table className="w-full text-left">
                    <thead className={`text-xs font-bold uppercase transition-colors ${darkMode ? 'bg-slate-900/50 text-slate-400' : 'bg-slate-50 text-slate-500'}`}>
                      <tr>
                        <th className="px-6 py-4">Month</th>
                        <th className="px-6 py-4">Income</th>
                        <th className="px-6 py-4">Expenses</th>
                        <th className="px-6 py-4">Net Savings</th>
                        <th className="px-6 py-4">Efficiency</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y transition-colors ${darkMode ? 'divide-slate-700' : 'divide-slate-100'}`}>
                      {monthlyHistoryData.length > 0 ? [...monthlyHistoryData].reverse().map((data) => {
                        const net = data.income - data.expense;
                        const efficiency = data.income > 0 ? Math.round((net / data.income) * 100) : 0;
                        return (
                          <tr key={data.name} className={`transition-colors ${darkMode ? 'hover:bg-slate-700/50' : 'hover:bg-slate-50'}`}>
                            <td className="px-6 py-4 font-bold">{data.name}</td>
                            <td className="px-6 py-4 text-emerald-500">+{CURRENCY_SYMBOL}{data.income.toLocaleString()}</td>
                            <td className="px-6 py-4 text-rose-500">-{CURRENCY_SYMBOL}{data.expense.toLocaleString()}</td>
                            <td className={`px-6 py-4 font-bold ${net >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                              {net >= 0 ? '+' : ''}{CURRENCY_SYMBOL}{net.toLocaleString()}
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 bg-slate-100 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full ${efficiency >= 20 ? 'bg-emerald-500' : efficiency >= 0 ? 'bg-blue-500' : 'bg-rose-500'}`}
                                    style={{ width: `${Math.min(Math.abs(efficiency), 100)}%` }}
                                  />
                                </div>
                                <span className="text-xs font-bold w-10 text-right">{efficiency}%</span>
                              </div>
                            </td>
                          </tr>
                        );
                      }) : <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-400">No data available to generate report</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Category Performance Card */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className={`p-6 rounded-3xl border transition-colors ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
                   <h4 className="text-lg font-bold mb-4">Highest Expenditure Category</h4>
                   {chartData.length > 0 ? (
                     <div className="flex items-center justify-between p-4 bg-rose-50 dark:bg-rose-900/20 rounded-2xl border border-rose-100 dark:border-rose-800">
                        <div>
                          <p className="text-sm text-rose-600 dark:text-rose-400 font-medium">Top Category</p>
                          <p className="text-xl font-bold">{chartData.sort((a,b) => b.value - a.value)[0].name}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-rose-600 dark:text-rose-400 font-medium">Amount Spent</p>
                          <p className="text-xl font-bold">{CURRENCY_SYMBOL}{chartData.sort((a,b) => b.value - a.value)[0].value.toLocaleString()}</p>
                        </div>
                     </div>
                   ) : <p className="text-slate-400">Not enough data</p>}
                </div>
                <div className={`p-6 rounded-3xl border transition-colors ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
                   <h4 className="text-lg font-bold mb-4">Savings Progress</h4>
                   <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl border border-emerald-100 dark:border-emerald-800">
                      <div className="flex justify-between items-center mb-2">
                        <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">Total Savings Pool</p>
                        <TrendingUp size={20} className="text-emerald-500" />
                      </div>
                      <p className="text-2xl font-bold text-emerald-600">{CURRENCY_SYMBOL}{(stats.income - stats.expenses).toLocaleString()}</p>
                   </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'insights' && (
            <div className="max-w-3xl mx-auto space-y-6">
              <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-8 rounded-3xl text-white shadow-xl relative overflow-hidden">
                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-4">
                    <Sparkles className="text-yellow-300 animate-pulse" />
                    <h2 className="text-2xl font-bold">Smart Insights</h2>
                  </div>
                  {isAnalyzing ? (
                    <div className="space-y-4">
                      <div className="h-4 bg-white/20 rounded-full w-3/4 animate-pulse" />
                      <div className="h-4 bg-white/20 rounded-full w-5/6 animate-pulse" />
                      <div className="h-4 bg-white/20 rounded-full w-2/3 animate-pulse" />
                    </div>
                  ) : <div className="prose prose-invert max-w-none"><p className="whitespace-pre-wrap leading-relaxed">{aiInsights || "Let me analyze your finances to give you actionable tips!"}</p></div>}
                </div>
              </div>
              {!isAnalyzing && <div className="flex justify-center"><button onClick={fetchInsights} className="text-slate-500 dark:text-slate-400 hover:text-blue-500 transition-colors text-sm font-medium flex items-center gap-2"><Sparkles size={16} /> Refresh AI Analysis</button></div>}
            </div>
          )}
        </div>
      </main>

      {/* Unified Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className={`rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 transition-colors ${darkMode ? 'bg-slate-800' : 'bg-white'}`}>
            <div className={`p-6 border-b flex justify-between items-center transition-colors ${darkMode ? 'bg-slate-700/30 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
              <h2 className={`text-xl font-bold capitalize ${darkMode ? 'text-white' : 'text-slate-900'}`}>{modalType.replace('_', ' ')}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 rotate-45 transition-colors"><Plus size={24} /></button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              {modalType !== 'budget' && (
                <div className={`flex p-1 rounded-xl mb-4 transition-colors ${darkMode ? 'bg-slate-900/50' : 'bg-slate-100'}`}>
                  <button type="button" onClick={() => { setType('expense'); setCategory(EXPENSE_CATEGORIES[0]); }} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${type === 'expense' ? (darkMode ? 'bg-slate-700 shadow text-rose-400' : 'bg-white shadow text-rose-600') : (darkMode ? 'text-slate-500' : 'text-slate-600')}`}>Expense</button>
                  <button type="button" onClick={() => { setType('income'); setCategory(INCOME_CATEGORIES[0]); }} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${type === 'income' ? (darkMode ? 'bg-slate-700 shadow text-emerald-400' : 'bg-white shadow text-emerald-600') : (darkMode ? 'text-slate-500' : 'text-slate-600')}`}>Income</button>
                </div>
              )}

              <div>
                <label className={`block text-sm font-medium mb-1 transition-colors ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>{modalType === 'budget' ? 'Monthly Limit' : 'Amount'} ({CURRENCY_SYMBOL})</label>
                <input 
                  type="number" 
                  required 
                  value={amount} 
                  onChange={(e) => setAmount(e.target.value)} 
                  placeholder="0.00" 
                  className={`w-full px-4 py-3 rounded-xl border outline-none focus:ring-2 focus:ring-blue-500 transition-all ${darkMode ? 'bg-slate-900 border-slate-700 text-white placeholder-slate-600' : 'bg-white border-slate-200 text-slate-900'}`} 
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-1 transition-colors ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>Category</label>
                <select 
                  value={category} 
                  onChange={(e) => setCategory(e.target.value)} 
                  className={`w-full px-4 py-3 rounded-xl border outline-none focus:ring-2 focus:ring-blue-500 transition-all ${darkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                >
                  {(type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>

              {(modalType === 'transaction' || modalType === 'recurring') && (
                <>
                  <div>
                    <label className={`block text-sm font-medium mb-1 transition-colors ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>{modalType === 'recurring' ? 'Next Due Date' : 'Date'}</label>
                    <input 
                      type="date" 
                      required 
                      value={date} 
                      onChange={(e) => setDate(e.target.value)} 
                      className={`w-full px-4 py-3 rounded-xl border outline-none focus:ring-2 focus:ring-blue-500 transition-all ${darkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`} 
                    />
                  </div>
                  {modalType === 'recurring' && (
                    <div>
                      <label className={`block text-sm font-medium mb-1 transition-colors ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>Frequency</label>
                      <select 
                        value={frequency} 
                        onChange={(e: any) => setFrequency(e.target.value)} 
                        className={`w-full px-4 py-3 rounded-xl border outline-none bg-white transition-all ${darkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                      >
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                      </select>
                    </div>
                  )}
                  <div>
                    <label className={`block text-sm font-medium mb-1 transition-colors ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>Description (Optional)</label>
                    <input 
                      type="text" 
                      value={description} 
                      onChange={(e) => setDescription(e.target.value)} 
                      placeholder="What was this for?" 
                      className={`w-full px-4 py-3 rounded-xl border outline-none focus:ring-2 focus:ring-blue-500 transition-all ${darkMode ? 'bg-slate-900 border-slate-700 text-white placeholder-slate-600' : 'bg-white border-slate-200 text-slate-900'}`} 
                    />
                  </div>
                </>
              )}

              <button type="submit" className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg transition-all active:scale-95 mt-4">Save {modalType}</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
