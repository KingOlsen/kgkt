import React, { useState, useEffect, useMemo } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
import {
  CreditCard,
  BarChart3,
  Wallet,
  Users,
  Check,
  X,
  Plus,
  Trash2,
  Edit3,
  AlertTriangle,
  Download,
  Settings,
  Search,
  Database,
  ArrowUpRight,
  ArrowDownRight,
  Palette,
  Calendar,
} from 'lucide-react';
import {
  db,
  handleFirestoreError,
  OperationType,
} from './firebase';
import {
  MONTHS,
  MemberRecord,
  PaymentRecord,
  TransactionRecord,
  ClubConfigRecord,
  INCOME_CATEGORIES,
  EXPENSE_CATEGORIES,
  VALIDATION_RULES,
  sanitizeMemberName,
  sanitizeCategoryName,
  sanitizeUppercaseText,
} from './types';

type ActiveTab = 'payments' | 'status' | 'budget' | 'members';
type ThemeSchemeId = 'botanical' | 'terracotta' | 'cobalt' | 'obsidian';

interface ThemeOption {
  id: ThemeSchemeId;
  label: string;
  swatch: string;
}

const TRENDING_THEMES: ThemeOption[] = [
  { id: 'botanical', label: 'Botanical Teal', swatch: '#0F766E' },
  { id: 'terracotta', label: 'Terracotta Sand', swatch: '#C2410C' },
  { id: 'cobalt', label: 'Electric Cobalt', swatch: '#1D4ED8' },
  { id: 'obsidian', label: 'Obsidian Mint', swatch: '#10B981' },
];

interface ToastBanner {
  id: number;
  message: string;
  isError: boolean;
}

const SHARED_WORKSPACE_ID = 'skas_kgkt_shared';

const DEFAULT_CONFIG: ClubConfigRecord = {
  clubTitle: 'SKAS | KGKT MANAGEMENT',
  pageTitle: 'Payment and Expense Tracker',
  buttonText: 'Save Payment',
  ownerId: SHARED_WORKSPACE_ID,
};

function getTodayIsoDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function generateValidId(prefix: string): string {
  const rand = Math.random().toString(36).substring(2, 10);
  return `${prefix}_${Date.now()}_${rand}`;
}

export default function App() {
  const [dataLoading, setDataLoading] = useState(true);

  const [themeScheme, setThemeScheme] = useState<ThemeSchemeId>(() => {
    const saved = localStorage.getItem('kgkt_theme_scheme') as ThemeSchemeId | null;
    if (saved && TRENDING_THEMES.some((t) => t.id === saved)) {
      return saved;
    }
    return 'botanical';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', themeScheme);
    if (themeScheme === 'obsidian') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('kgkt_theme_scheme', themeScheme);
  }, [themeScheme]);

  const [activeTab, setActiveTab] = useState<ActiveTab>('payments');
  const [toast, setToast] = useState<ToastBanner | null>(null);

  // Firestore synced state
  const [members, setMembers] = useState<MemberRecord[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [clubConfig, setClubConfig] = useState<ClubConfigRecord>(DEFAULT_CONFIG);

  // Settings Modal state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [configTitleInput, setConfigTitleInput] = useState(DEFAULT_CONFIG.clubTitle);
  const [configPageInput, setConfigPageInput] = useState(DEFAULT_CONFIG.pageTitle);
  const [configBtnInput, setConfigBtnInput] = useState(DEFAULT_CONFIG.buttonText);
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  // Global Year Filter ('all' or 4-digit year string like '2026')
  const [selectedYear, setSelectedYear] = useState<string>('2026');

  // Record Payment Form state
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [feeAmountInput, setFeeAmountInput] = useState('');
  const [paymentDateInput, setPaymentDateInput] = useState(getTodayIsoDate());
  const [isSavingPayment, setIsSavingPayment] = useState(false);
  const [duplicateMonthsWarning, setDuplicateMonthsWarning] = useState<string[]>([]);

  // Status & History Filters
  const [statusSearch, setStatusSearch] = useState('');
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [editPaymentMemberId, setEditPaymentMemberId] = useState('');
  const [editPaymentMonths, setEditPaymentMonths] = useState('');
  const [editPaymentAmount, setEditPaymentAmount] = useState('');
  const [editPaymentDate, setEditPaymentDate] = useState('');
  const [deletingPaymentId, setDeletingPaymentId] = useState<string | null>(null);

  // Budget Form state
  const [txType, setTxType] = useState<'income' | 'expense'>('income');
  const [txCategory, setTxCategory] = useState('');
  const [txAmount, setTxAmount] = useState('');
  const [txDescription, setTxDescription] = useState('');
  const [txDate, setTxDate] = useState(getTodayIsoDate());
  const [isSavingTx, setIsSavingTx] = useState(false);

  // Budget Filters & Edit state
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [txSearch, setTxSearch] = useState('');
  const [editingTxId, setEditingTxId] = useState<string | null>(null);
  const [editTxType, setEditTxType] = useState<'income' | 'expense'>('income');
  const [editTxCategory, setEditTxCategory] = useState('');
  const [editTxAmount, setEditTxAmount] = useState('');
  const [editTxDescription, setEditTxDescription] = useState('');
  const [editTxDate, setEditTxDate] = useState('');
  const [deletingTxId, setDeletingTxId] = useState<string | null>(null);

  // Manage Members state
  const [newMemberName, setNewMemberName] = useState('');
  const [memberSearch, setMemberSearch] = useState('');
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [editMemberNameInput, setEditMemberNameInput] = useState('');
  const [deletingMemberId, setDeletingMemberId] = useState<string | null>(null);
  const [isSeeding, setIsSeeding] = useState(false);

  const showNotice = (message: string, isError = false) => {
    setToast({ id: Date.now(), message, isError });
  };

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  // Firestore Real-Time Auto-Sync Listeners across all devices (no login required)
  useEffect(() => {
    setDataLoading(true);

    const membersColRef = collection(db, 'members');
    const paymentsColRef = collection(db, 'payments');
    const transactionsColRef = collection(db, 'transactions');
    const settingsDocRef = doc(db, 'settings', SHARED_WORKSPACE_ID);

    const unsubMembers = onSnapshot(
      membersColRef,
      (snapshot) => {
        const list: MemberRecord[] = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<MemberRecord, 'id'>),
        }));
        setMembers(list);
        setDataLoading(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'members');
      }
    );

    const unsubPayments = onSnapshot(
      paymentsColRef,
      (snapshot) => {
        const list: PaymentRecord[] = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<PaymentRecord, 'id'>),
        }));
        setPayments(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'payments');
      }
    );

    const unsubTransactions = onSnapshot(
      transactionsColRef,
      (snapshot) => {
        const list: TransactionRecord[] = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<TransactionRecord, 'id'>),
        }));
        setTransactions(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'transactions');
      }
    );

    const unsubSettings = onSnapshot(
      settingsDocRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as ClubConfigRecord;
          const normalizedPageTitle =
            data.pageTitle === '2026 Payment and Expense Tracker'
              ? 'Payment and Expense Tracker'
              : data.pageTitle;
          setClubConfig({ ...data, pageTitle: normalizedPageTitle });
          setConfigTitleInput(data.clubTitle);
          setConfigPageInput(normalizedPageTitle);
          setConfigBtnInput(data.buttonText);
        } else {
          setClubConfig({ ...DEFAULT_CONFIG, ownerId: SHARED_WORKSPACE_ID });
        }
      },
      (error) => {
        handleFirestoreError(
          error,
          OperationType.GET,
          `settings/${SHARED_WORKSPACE_ID}`
        );
      }
    );

    return () => {
      unsubMembers();
      unsubPayments();
      unsubTransactions();
      unsubSettings();
    };
  }, []);

  // Available years dynamically merged from default range + payment/transaction records
  const availableYears = useMemo(() => {
    const yearSet = new Set<string>(['2024', '2025', '2026', '2027', '2028']);
    payments.forEach((p) => {
      const y = p.paymentDate?.slice(0, 4);
      if (y && /^\d{4}$/.test(y)) yearSet.add(y);
    });
    transactions.forEach((t) => {
      const y = t.transactionDate?.slice(0, 4);
      if (y && /^\d{4}$/.test(y)) yearSet.add(y);
    });
    return Array.from(yearSet).sort();
  }, [payments, transactions]);

  // Concrete 4-digit year used for 12-month views (Record Payments & 12-Month Matrix)
  const activePaymentYear = useMemo(() => {
    if (selectedYear !== 'all' && /^\d{4}$/.test(selectedYear)) {
      return selectedYear;
    }
    const fromInput = paymentDateInput?.slice(0, 4);
    if (fromInput && /^\d{4}$/.test(fromInput)) {
      return fromInput;
    }
    return '2026';
  }, [selectedYear, paymentDateInput]);

  const handleYearFilterChange = (newYear: string) => {
    setSelectedYear(newYear);
    if (newYear !== 'all' && /^\d{4}$/.test(newYear)) {
      setPaymentDateInput((prev) => {
        const suffix =
          prev && VALIDATION_RULES.DATE_REGEX.test(prev)
            ? prev.slice(4)
            : '-01-15';
        return `${newYear}${suffix}`;
      });
      setTxDate((prev) => {
        const suffix =
          prev && VALIDATION_RULES.DATE_REGEX.test(prev)
            ? prev.slice(4)
            : '-01-15';
        return `${newYear}${suffix}`;
      });
    }
  };

  // Payments and transactions filtered by selectedYear ('all' or specific YYYY)
  const yearFilteredPayments = useMemo(() => {
    if (selectedYear === 'all') return payments;
    return payments.filter((p) => p.paymentDate?.startsWith(selectedYear));
  }, [payments, selectedYear]);

  const yearFilteredTransactions = useMemo(() => {
    if (selectedYear === 'all') return transactions;
    return transactions.filter((t) => t.transactionDate?.startsWith(selectedYear));
  }, [transactions, selectedYear]);

  // Sorted Members
  const sortedMembers = useMemo(() => {
    return [...members].sort((a, b) => a.memberName.localeCompare(b.memberName));
  }, [members]);

  // Paid months for currently selected member AND activePaymentYear in Record Payments
  const selectedMemberRecord = useMemo(
    () => members.find((m) => m.id === selectedMemberId) || null,
    [members, selectedMemberId]
  );

  const paidMonthsForSelectedMember = useMemo(() => {
    const set = new Set<string>();
    if (!selectedMemberRecord) return set;
    payments
      .filter(
        (p) =>
          p.paymentDate?.startsWith(activePaymentYear) &&
          (p.memberId === selectedMemberRecord.id ||
            p.memberName.toUpperCase() === selectedMemberRecord.memberName.toUpperCase())
      )
      .forEach((p) => {
        p.months.split(',').forEach((raw) => {
          const cleaned = raw.trim().toUpperCase();
          MONTHS.forEach((m) => {
            if (m.toUpperCase() === cleaned) {
              set.add(m);
            }
          });
        });
      });
    return set;
  }, [payments, selectedMemberRecord, activePaymentYear]);

  // Automatically remove any already-paid months from selection when member, year, or payments change
  useEffect(() => {
    if (paidMonthsForSelectedMember.size === 0) return;
    setSelectedMonths((prev) => {
      const filtered = prev.filter((m) => !paidMonthsForSelectedMember.has(m));
      return filtered.length === prev.length ? prev : filtered;
    });
  }, [paidMonthsForSelectedMember]);

  // Check duplicates live when user toggles months or member
  useEffect(() => {
    if (!selectedMemberRecord || selectedMonths.length === 0) {
      setDuplicateMonthsWarning([]);
      return;
    }
    const dupes = selectedMonths.filter((m) => paidMonthsForSelectedMember.has(m));
    setDuplicateMonthsWarning(dupes);
  }, [selectedMemberRecord, selectedMonths, paidMonthsForSelectedMember]);

  // Financial Summary Calculations (respecting Year Filter)
  const financialSummary = useMemo(() => {
    const paymentIncome = yearFilteredPayments.reduce(
      (sum, p) => sum + Number(p.feeAmount || 0),
      0
    );
    const transactionIncome = yearFilteredTransactions
      .filter((t) => t.transactionType === 'income')
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);
    const totalIncome = paymentIncome + transactionIncome;
    const totalExpenses = yearFilteredTransactions
      .filter((t) => t.transactionType === 'expense')
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);
    const currentBalance = totalIncome - totalExpenses;

    return {
      paymentIncome,
      transactionIncome,
      totalIncome,
      totalExpenses,
      currentBalance,
    };
  }, [yearFilteredPayments, yearFilteredTransactions]);

  // Member x Month Status Matrix (for activePaymentYear)
  const memberMonthMatrix = useMemo(() => {
    const map: Record<string, Record<string, boolean>> = {};
    sortedMembers.forEach((m) => {
      map[m.id] = {};
      MONTHS.forEach((month) => {
        map[m.id][month] = false;
      });
    });

    payments
      .filter((p) => p.paymentDate?.startsWith(activePaymentYear))
      .forEach((payment) => {
        const targetMember =
          sortedMembers.find((m) => m.id === payment.memberId) ||
          sortedMembers.find(
            (m) => m.memberName.toUpperCase() === payment.memberName.toUpperCase()
          );
        if (!targetMember) return;
        payment.months.split(',').forEach((raw) => {
          const cleaned = raw.trim().toUpperCase();
          MONTHS.forEach((m) => {
            if (m.toUpperCase() === cleaned) {
              map[targetMember.id][m] = true;
            }
          });
        });
      });

    return map;
  }, [sortedMembers, payments, activePaymentYear]);

  // Dynamic Categories for Budget Filter
  const availableCategories = useMemo(() => {
    const cats = new Set<string>();
    yearFilteredTransactions.forEach((t) => {
      if (t.category) cats.add(t.category.toUpperCase());
    });
    return Array.from(cats).sort();
  }, [yearFilteredTransactions]);

  // Filtered Transactions
  const filteredTransactions = useMemo(() => {
    return [...yearFilteredTransactions]
      .filter((t) => {
        if (filterType !== 'all' && t.transactionType !== filterType) return false;
        if (
          filterCategory !== 'all' &&
          t.category.toUpperCase() !== filterCategory.toUpperCase()
        ) {
          return false;
        }
        if (txSearch.trim()) {
          const q = txSearch.trim().toUpperCase();
          return (
            t.description.toUpperCase().includes(q) ||
            t.category.toUpperCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => b.transactionDate.localeCompare(a.transactionDate));
  }, [yearFilteredTransactions, filterType, filterCategory, txSearch]);

  // Sorted Payment History (filtered by selectedYear and search query)
  const sortedPayments = useMemo(() => {
    return [...yearFilteredPayments]
      .filter((p) => {
        if (!statusSearch.trim()) return true;
        const q = statusSearch.trim().toUpperCase();
        return (
          p.memberName.toUpperCase().includes(q) ||
          p.months.toUpperCase().includes(q) ||
          p.paymentDate.includes(q)
        );
      })
      .sort((a, b) => b.paymentDate.localeCompare(a.paymentDate));
  }, [yearFilteredPayments, statusSearch]);

  // Handlers
  const handleToggleMonth = (month: string) => {
    if (paidMonthsForSelectedMember.has(month)) return;
    setSelectedMonths((prev) =>
      prev.includes(month) ? prev.filter((m) => m !== month) : [...prev, month]
    );
  };

  const handleSelectAllMonths = () => {
    setSelectedMonths(
      MONTHS.filter((month) => !paidMonthsForSelectedMember.has(month))
    );
  };

  const handleClearAllMonths = () => {
    setSelectedMonths([]);
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedMemberRecord) {
      showNotice('Please select a club member.', true);
      return;
    }
    if (selectedMonths.length === 0) {
      showNotice('Please select at least one unpaid month.', true);
      return;
    }

    const parsedFee = parseFloat(feeAmountInput);
    if (
      isNaN(parsedFee) ||
      parsedFee < 0 ||
      parsedFee > VALIDATION_RULES.MAX_FEE_AMOUNT
    ) {
      showNotice(
        `Please enter a valid fee amount between $0.00 and $${VALIDATION_RULES.MAX_FEE_AMOUNT.toLocaleString()}.`,
        true
      );
      return;
    }

    if (!VALIDATION_RULES.DATE_REGEX.test(paymentDateInput)) {
      showNotice('Please select a valid payment date (YYYY-MM-DD).', true);
      return;
    }

    if (members.length + payments.length + transactions.length >= 999) {
      showNotice(
        'Maximum limit of 999 records reached. Please delete some records first.',
        true
      );
      return;
    }

    const orderedMonths = MONTHS.filter((m) => selectedMonths.includes(m));
    const monthsStr = orderedMonths.join(', ').slice(0, VALIDATION_RULES.MONTHS_MAX_LEN);
    const paymentId = generateValidId('pay');

    setIsSavingPayment(true);
    try {
      await setDoc(doc(db, 'payments', paymentId), {
        memberId: selectedMemberRecord.id,
        memberName: sanitizeMemberName(selectedMemberRecord.memberName),
        months: monthsStr,
        feeAmount: Number(parsedFee.toFixed(2)),
        paymentDate: paymentDateInput,
        ownerId: SHARED_WORKSPACE_ID,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      showNotice('Payment recorded successfully!');
      setSelectedMonths([]);
      setFeeAmountInput('');
      setPaymentDateInput(getTodayIsoDate());
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `payments/${paymentId}`);
    } finally {
      setIsSavingPayment(false);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanName = sanitizeMemberName(newMemberName);
    if (!cleanName) {
      showNotice('Please enter a valid member name (letters, numbers, spaces).', true);
      return;
    }

    if (
      members.some((m) => m.memberName.toUpperCase() === cleanName.toUpperCase())
    ) {
      showNotice('This member already exists in the directory.', true);
      return;
    }

    if (members.length + payments.length + transactions.length >= 999) {
      showNotice('Maximum limit of 999 records reached.', true);
      return;
    }

    const memberId = generateValidId('mem');
    setIsAddingMember(true);
    try {
      await setDoc(doc(db, 'members', memberId), {
        memberName: cleanName,
        ownerId: SHARED_WORKSPACE_ID,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setNewMemberName('');
      showNotice(`Member "${cleanName}" added successfully!`);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `members/${memberId}`);
    } finally {
      setIsAddingMember(false);
    }
  };

  const handleSaveRenameMember = async (member: MemberRecord) => {
    const cleanName = sanitizeMemberName(editMemberNameInput);
    if (!cleanName) {
      showNotice('Please enter a valid member name.', true);
      return;
    }
    if (
      members.some(
        (m) =>
          m.id !== member.id &&
          m.memberName.toUpperCase() === cleanName.toUpperCase()
      )
    ) {
      showNotice('Another member with this name already exists.', true);
      return;
    }

    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'members', member.id), {
        memberName: cleanName,
        updatedAt: serverTimestamp(),
      });

      const memberPayments = payments.filter((p) => p.memberId === member.id);
      memberPayments.forEach((p) => {
        batch.update(doc(db, 'payments', p.id), {
          memberName: cleanName,
          updatedAt: serverTimestamp(),
        });
      });

      await batch.commit();
      setEditingMemberId(null);
      showNotice('Member name updated across all payment records.');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `members/${member.id}`);
    }
  };

  const handleConfirmDeleteMember = async (member: MemberRecord) => {
    try {
      const batch = writeBatch(db);
      const memberPayments = payments.filter(
        (p) =>
          p.memberId === member.id ||
          p.memberName.toUpperCase() === member.memberName.toUpperCase()
      );
      memberPayments.forEach((p) => {
        batch.delete(doc(db, 'payments', p.id));
      });
      batch.delete(doc(db, 'members', member.id));
      await batch.commit();
      setDeletingMemberId(null);
      if (selectedMemberId === member.id) {
        setSelectedMemberId('');
      }
      showNotice('Member and their payment records deleted.');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `members/${member.id}`);
    }
  };

  const startEditPayment = (payment: PaymentRecord) => {
    setEditingPaymentId(payment.id);
    setEditPaymentMemberId(payment.memberId);
    setEditPaymentMonths(payment.months);
    setEditPaymentAmount(String(payment.feeAmount));
    setEditPaymentDate(payment.paymentDate);
  };

  const handleSaveEditPayment = async (payment: PaymentRecord) => {
    const targetMember = members.find((m) => m.id === editPaymentMemberId);
    if (!targetMember) {
      showNotice('Please select a valid member.', true);
      return;
    }

    const cleanedMonths = editPaymentMonths
      .replace(/[^A-Za-z, ]/g, '')
      .trim()
      .slice(0, VALIDATION_RULES.MONTHS_MAX_LEN);
    const parsedAmount = parseFloat(editPaymentAmount);

    if (
      cleanedMonths.length < 3 ||
      isNaN(parsedAmount) ||
      parsedAmount < 0 ||
      parsedAmount > VALIDATION_RULES.MAX_FEE_AMOUNT ||
      !VALIDATION_RULES.DATE_REGEX.test(editPaymentDate)
    ) {
      showNotice('Please fill in all payment fields accurately.', true);
      return;
    }

    try {
      await updateDoc(doc(db, 'payments', payment.id), {
        memberId: targetMember.id,
        memberName: sanitizeMemberName(targetMember.memberName),
        months: cleanedMonths,
        feeAmount: Number(parsedAmount.toFixed(2)),
        paymentDate: editPaymentDate,
        updatedAt: serverTimestamp(),
      });
      setEditingPaymentId(null);
      showNotice('Payment updated successfully!');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `payments/${payment.id}`);
    }
  };

  const handleConfirmDeletePayment = async (paymentId: string) => {
    try {
      await deleteDoc(doc(db, 'payments', paymentId));
      setDeletingPaymentId(null);
      showNotice('Payment record deleted.');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `payments/${paymentId}`);
    }
  };

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanCat = sanitizeCategoryName(txCategory);
    const cleanDesc = sanitizeUppercaseText(
      txDescription,
      VALIDATION_RULES.DESCRIPTION_MAX_LEN,
      VALIDATION_RULES.DESCRIPTION_REGEX
    );
    const parsedAmt = parseFloat(txAmount);

    if (!cleanCat) {
      showNotice('Please select a category.', true);
      return;
    }
    if (!cleanDesc) {
      showNotice('Please enter a transaction description.', true);
      return;
    }
    if (
      isNaN(parsedAmt) ||
      parsedAmt < 0 ||
      parsedAmt > VALIDATION_RULES.MAX_TX_AMOUNT
    ) {
      showNotice('Please enter a valid transaction amount.', true);
      return;
    }
    if (!VALIDATION_RULES.DATE_REGEX.test(txDate)) {
      showNotice('Please enter a valid date (YYYY-MM-DD).', true);
      return;
    }

    if (members.length + payments.length + transactions.length >= 999) {
      showNotice('Maximum limit of 999 records reached.', true);
      return;
    }

    const txId = generateValidId('tx');
    setIsSavingTx(true);
    try {
      await setDoc(doc(db, 'transactions', txId), {
        transactionType: txType,
        category: cleanCat,
        amount: Number(parsedAmt.toFixed(2)),
        description: cleanDesc,
        transactionDate: txDate,
        ownerId: SHARED_WORKSPACE_ID,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setTxCategory('');
      setTxAmount('');
      setTxDescription('');
      setTxDate(getTodayIsoDate());
      showNotice('Budget transaction added successfully!');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `transactions/${txId}`);
    } finally {
      setIsSavingTx(false);
    }
  };

  const startEditTransaction = (tx: TransactionRecord) => {
    setEditingTxId(tx.id);
    setEditTxType(tx.transactionType);
    setEditTxCategory(tx.category);
    setEditTxAmount(String(tx.amount));
    setEditTxDescription(tx.description);
    setEditTxDate(tx.transactionDate);
  };

  const handleSaveEditTransaction = async (tx: TransactionRecord) => {
    const cleanCat = sanitizeCategoryName(editTxCategory);
    const cleanDesc = sanitizeUppercaseText(
      editTxDescription,
      VALIDATION_RULES.DESCRIPTION_MAX_LEN,
      VALIDATION_RULES.DESCRIPTION_REGEX
    );
    const parsedAmt = parseFloat(editTxAmount);

    if (
      !cleanCat ||
      !cleanDesc ||
      isNaN(parsedAmt) ||
      parsedAmt < 0 ||
      parsedAmt > VALIDATION_RULES.MAX_TX_AMOUNT ||
      !VALIDATION_RULES.DATE_REGEX.test(editTxDate)
    ) {
      showNotice('Please fill in all transaction fields accurately.', true);
      return;
    }

    try {
      await updateDoc(doc(db, 'transactions', tx.id), {
        transactionType: editTxType,
        category: cleanCat,
        amount: Number(parsedAmt.toFixed(2)),
        description: cleanDesc,
        transactionDate: editTxDate,
        updatedAt: serverTimestamp(),
      });
      setEditingTxId(null);
      showNotice('Transaction updated successfully!');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `transactions/${tx.id}`);
    }
  };

  const handleConfirmDeleteTransaction = async (txId: string) => {
    try {
      await deleteDoc(doc(db, 'transactions', txId));
      setDeletingTxId(null);
      showNotice('Transaction deleted.');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `transactions/${txId}`);
    }
  };

  const handleSaveWorkspaceConfig = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanClub = configTitleInput.trim().slice(0, 100) || DEFAULT_CONFIG.clubTitle;
    const cleanPage = configPageInput.trim().slice(0, 150) || DEFAULT_CONFIG.pageTitle;
    const cleanBtn = configBtnInput.trim().slice(0, 60) || DEFAULT_CONFIG.buttonText;

    setIsSavingConfig(true);
    try {
      const ref = doc(db, 'settings', SHARED_WORKSPACE_ID);
      await setDoc(ref, {
        clubTitle: cleanClub,
        pageTitle: cleanPage,
        buttonText: cleanBtn,
        ownerId: clubConfig.ownerId || SHARED_WORKSPACE_ID,
        createdAt: clubConfig.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setIsSettingsOpen(false);
      showNotice('Workspace settings updated.');
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.WRITE,
        `settings/${SHARED_WORKSPACE_ID}`
      );
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleSeedSampleData = async () => {
    if (isSeeding) return;
    setIsSeeding(true);
    try {
      const batch = writeBatch(db);
      const sampleMembers = [
        { id: generateValidId('mem1'), name: 'AHMAD FAIZAL BIN RAZAK' },
        { id: generateValidId('mem2'), name: 'NURUL AINA BINTI HASSAN' },
        { id: generateValidId('mem3'), name: 'MUHAMMAD HAFIZUDDIN' },
        { id: generateValidId('mem4'), name: 'SITI SARAH BINTI ZULKIFLI' },
        { id: generateValidId('mem5'), name: 'WAN AZMAN BIN WAN OMAR' },
      ];

      sampleMembers.forEach((m) => {
        batch.set(doc(db, 'members', m.id), {
          memberName: m.name,
          ownerId: SHARED_WORKSPACE_ID,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });

      await batch.commit();

      const batch2 = writeBatch(db);
      const samplePayments = [
        {
          id: generateValidId('pay1'),
          member: sampleMembers[0],
          months: 'January, February, March, April, May, June',
          feeAmount: 60,
          paymentDate: '2026-01-15',
        },
        {
          id: generateValidId('pay2'),
          member: sampleMembers[1],
          months: 'January, February, March, April',
          feeAmount: 40,
          paymentDate: '2026-02-10',
        },
        {
          id: generateValidId('pay3'),
          member: sampleMembers[2],
          months: 'January, February, March, April, May, June, July, August, September, October, November, December',
          feeAmount: 120,
          paymentDate: '2026-01-20',
        },
        {
          id: generateValidId('pay4'),
          member: sampleMembers[3],
          months: 'January, February, March',
          feeAmount: 30,
          paymentDate: '2026-03-05',
        },
      ];

      samplePayments.forEach((p) => {
        batch2.set(doc(db, 'payments', p.id), {
          memberId: p.member.id,
          memberName: p.member.name,
          months: p.months,
          feeAmount: p.feeAmount,
          paymentDate: p.paymentDate,
          ownerId: SHARED_WORKSPACE_ID,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });

      const sampleTransactions = [
        {
          id: generateValidId('tx1'),
          type: 'income' as const,
          category: 'DONATIONS',
          amount: 250,
          description: 'PTA & ALUMNI ANNUAL CONTRIBUTION',
          date: '2026-01-12',
        },
        {
          id: generateValidId('tx2'),
          type: 'expense' as const,
          category: 'FOOD & BEVERAGES',
          amount: 85,
          description: 'STAFF APPRECIATION MEETING REFRESHMENTS',
          date: '2026-02-18',
        },
        {
          id: generateValidId('tx3'),
          type: 'expense' as const,
          category: 'SUPPLIES',
          amount: 42.5,
          description: 'EVENT BANNERS AND CERTIFICATES',
          date: '2026-03-02',
        },
      ];

      sampleTransactions.forEach((t) => {
        batch2.set(doc(db, 'transactions', t.id), {
          transactionType: t.type,
          category: t.category,
          amount: t.amount,
          description: t.description,
          transactionDate: t.date,
          ownerId: SHARED_WORKSPACE_ID,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });

      await batch2.commit();
      showNotice('Sample SKAS | KGKT Club data loaded!');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'seed_sample_data');
    } finally {
      setIsSeeding(false);
    }
  };

  const handleExportCsv = () => {
    const lines: string[] = [
      'Record Type,Member / Description,Category / Months,Amount ($),Date',
    ];
    payments.forEach((p) => {
      lines.push(
        `"PAYMENT","${p.memberName}","${p.months}",${p.feeAmount.toFixed(2)},"${p.paymentDate}"`
      );
    });
    transactions.forEach((t) => {
      lines.push(
        `"${t.transactionType.toUpperCase()}","${t.description}","${t.category}",${t.amount.toFixed(2)},"${t.transactionDate}"`
      );
    });

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SKAS_KGKT_Ledger_${getTodayIsoDate()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen theme-canvas flex flex-col">
      {/* Top Bar Contract: 3 zones separated by gap-8 */}
      <header className="sticky top-0 z-20 flex items-center justify-between gap-8 px-6 lg:px-10 py-3.5 theme-surface border-b">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('payments');
          }}
          className="font-display text-lg font-bold tracking-tight theme-accent-text whitespace-nowrap shrink-0"
        >
          {clubConfig.clubTitle || DEFAULT_CONFIG.clubTitle}
        </a>

        {/* Zone 2: 4 concise single-line text navigation links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
          <button
            type="button"
            onClick={() => setActiveTab('payments')}
            className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'payments'
                ? 'border-[var(--accent-primary)] theme-text-primary font-semibold'
                : 'border-transparent theme-text-secondary hover:opacity-80'
            }`}
          >
            Record Payments
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('status')}
            className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'status'
                ? 'border-[var(--accent-primary)] theme-text-primary font-semibold'
                : 'border-transparent theme-text-secondary hover:opacity-80'
            }`}
          >
            Payment Status
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('budget')}
            className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'budget'
                ? 'border-[var(--accent-primary)] theme-text-primary font-semibold'
                : 'border-transparent theme-text-secondary hover:opacity-80'
            }`}
          >
            Budget
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('members')}
            className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'members'
                ? 'border-[var(--accent-primary)] theme-text-primary font-semibold'
                : 'border-transparent theme-text-secondary hover:opacity-80'
            }`}
          >
            Manage Members
          </button>
        </nav>

        {/* Zone 3: Primary action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={handleExportCsv}
            className="px-4 py-2 text-xs font-semibold theme-btn-primary rounded-lg transition-colors whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-10 py-8">
        {/* Workspace Header Strip & Trending Color Scheme Selector */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 mb-8 border-b theme-border">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold theme-text-primary tracking-tight">
              {clubConfig.pageTitle || DEFAULT_CONFIG.pageTitle}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs theme-text-muted">
              <span>Cloud Auto-Sync Active</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                Year: {selectedYear === 'all' ? 'All Years' : selectedYear}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">{members.length} Members</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                {yearFilteredPayments.length} Payments
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                Balance: ${financialSummary.currentBalance.toFixed(2)}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Global Year Filter */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 theme-surface border rounded-xl">
              <Calendar className="w-3.5 h-3.5 theme-accent-text shrink-0" />
              <label
                htmlFor="globalYearFilter"
                className="text-xs font-semibold theme-text-secondary whitespace-nowrap"
              >
                Year:
              </label>
              <select
                id="globalYearFilter"
                value={selectedYear}
                onChange={(e) => handleYearFilterChange(e.target.value)}
                className="text-xs font-mono font-bold theme-text-primary bg-transparent focus:outline-none cursor-pointer"
              >
                <option value="all" className="theme-surface theme-text-primary">
                  All Years
                </option>
                {availableYears.map((yr) => (
                  <option
                    key={yr}
                    value={yr}
                    className="theme-surface theme-text-primary"
                  >
                    {yr}
                  </option>
                ))}
              </select>
            </div>

            {/* Trending Theme Scheme Switcher */}
            <div className="flex items-center gap-1 p-1 theme-tab-rail rounded-xl">
              {TRENDING_THEMES.map((theme) => (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => setThemeScheme(theme.id)}
                  className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                    themeScheme === theme.id
                      ? 'theme-surface theme-accent-text shadow-xs'
                      : 'theme-text-secondary hover:opacity-90'
                  }`}
                >
                  {theme.label}
                </button>
              ))}
            </div>

            {members.length === 0 && payments.length === 0 && (
              <button
                type="button"
                onClick={handleSeedSampleData}
                disabled={isSeeding}
                className="px-3.5 py-2 text-xs font-semibold theme-btn-soft border rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Database className="w-3.5 h-3.5" />
                {isSeeding ? 'Loading Sample Data...' : 'Load Sample Data'}
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className="px-3.5 py-2 text-xs font-medium theme-surface border rounded-lg hover:opacity-85 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5" />
              Customize
            </button>
          </div>
        </div>

        {/* Interactive Tab Selector Bar */}
        <div className="flex items-center gap-2 p-1.5 theme-tab-rail rounded-xl mb-8 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('payments')}
            className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg transition-all whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'payments'
                ? 'theme-surface theme-accent-text shadow-xs'
                : 'theme-text-secondary hover:opacity-90'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            Record Payments
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('status')}
            className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg transition-all whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'status'
                ? 'theme-surface theme-accent-text shadow-xs'
                : 'theme-text-secondary hover:opacity-90'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            Payment Status
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('budget')}
            className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg transition-all whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'budget'
                ? 'theme-surface theme-accent-text shadow-xs'
                : 'theme-text-secondary hover:opacity-90'
            }`}
          >
            <Wallet className="w-4 h-4" />
            Budget
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('members')}
            className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg transition-all whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'members'
                ? 'theme-surface theme-accent-text shadow-xs'
                : 'theme-text-secondary hover:opacity-90'
            }`}
          >
            <Users className="w-4 h-4" />
            Manage Members
          </button>
        </div>

        {/* Global Notification Toast Banner */}
        {toast && (
          <div
            className={`mb-6 p-4 rounded-xl border flex items-center justify-between gap-4 ${
              toast.isError
                ? 'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300'
                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300'
            }`}
          >
            <div className="flex items-center gap-2.5 text-sm font-semibold">
              {toast.isError ? (
                <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
              ) : (
                <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              )}
              <span>{toast.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="text-xs font-medium underline opacity-75 hover:opacity-100 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* TAB 1: RECORD PAYMENTS */}
        {activeTab === 'payments' && (
          <section className="theme-surface border rounded-2xl p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 mb-6 border-b theme-border">
              <div>
                <h2 className="font-display text-xl font-bold theme-text-primary">
                  Record Monthly Membership Payment
                </h2>
                <p className="text-sm theme-text-secondary mt-0.5">
                  Select a member and check the month(s) covered by their fee payment. Completed months are automatically locked.
                </p>
              </div>
              {members.length === 0 && !dataLoading && (
                <button
                  type="button"
                  onClick={() => setActiveTab('members')}
                  className="px-4 py-2 text-xs font-semibold theme-btn-soft border rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  + Add Members First
                </button>
              )}
            </div>

            <form onSubmit={handleRecordPayment} className="space-y-6">
              {/* Member, Payment Year & Payment Date Selection */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="md:col-span-2">
                  <label
                    htmlFor="memberSelect"
                    className="block text-xs font-semibold theme-text-secondary mb-2"
                  >
                    Select Member
                  </label>
                  <select
                    id="memberSelect"
                    value={selectedMemberId}
                    onChange={(e) => setSelectedMemberId(e.target.value)}
                    className="w-full px-4 py-3 border rounded-xl text-sm theme-input transition-all"
                    required
                  >
                    <option value="">Choose a member...</option>
                    {sortedMembers.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.memberName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="recordPaymentYearSelect"
                    className="block text-xs font-semibold theme-text-secondary mb-2"
                  >
                    Payment Year
                  </label>
                  <select
                    id="recordPaymentYearSelect"
                    value={activePaymentYear}
                    onChange={(e) => handleYearFilterChange(e.target.value)}
                    className="w-full px-4 py-3 border rounded-xl text-sm font-mono tabular-nums font-semibold theme-input transition-all"
                  >
                    {availableYears.map((yr) => (
                      <option key={yr} value={yr}>
                        {yr}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="paymentDateInput"
                    className="block text-xs font-semibold theme-text-secondary mb-2"
                  >
                    Payment Date
                  </label>
                  <input
                    id="paymentDateInput"
                    type="date"
                    value={paymentDateInput}
                    onChange={(e) => {
                      const val = e.target.value;
                      setPaymentDateInput(val);
                      const yr = val.slice(0, 4);
                      if (/^\d{4}$/.test(yr)) {
                        setSelectedYear(yr);
                      }
                    }}
                    className="w-full px-4 py-3 border rounded-xl text-sm font-mono tabular-nums theme-input transition-all"
                    required
                  />
                </div>
              </div>

              {/* Month Selection */}
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-3">
                    <label className="text-xs font-semibold theme-text-secondary">
                      Select Month(s) for {activePaymentYear}
                    </label>
                    {selectedMemberRecord && (
                      <span className="text-xs theme-text-muted font-mono tabular-nums">
                        ({paidMonthsForSelectedMember.size}/12 already paid in{' '}
                        {activePaymentYear})
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSelectAllMonths}
                      disabled={paidMonthsForSelectedMember.size === MONTHS.length}
                      className="px-3 py-1.5 text-xs font-semibold theme-btn-soft border disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Select All Unpaid
                    </button>
                    <button
                      type="button"
                      onClick={handleClearAllMonths}
                      className="px-3 py-1.5 text-xs font-semibold theme-subtle border rounded-lg hover:opacity-80 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Clear All
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {MONTHS.map((month) => {
                    const isAlreadyPaid = paidMonthsForSelectedMember.has(month);
                    const isChecked = !isAlreadyPaid && selectedMonths.includes(month);

                    return (
                      <label
                        key={month}
                        aria-disabled={isAlreadyPaid}
                        className={`flex items-center justify-between p-3.5 border rounded-xl transition-all select-none ${
                          isAlreadyPaid
                            ? 'border-emerald-500/30 bg-emerald-500/10 opacity-60 cursor-not-allowed'
                            : isChecked
                            ? 'theme-btn-soft ring-1 ring-[var(--accent-primary)] cursor-pointer'
                            : 'theme-surface hover:border-[var(--accent-primary)] cursor-pointer'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            disabled={isAlreadyPaid}
                            onChange={() => handleToggleMonth(month)}
                            className="w-4 h-4 accent-[var(--accent-primary)] rounded disabled:opacity-40 disabled:cursor-not-allowed"
                          />
                          <span
                            className={`text-sm font-semibold uppercase ${
                              isAlreadyPaid
                                ? 'text-emerald-700 dark:text-emerald-400 line-through'
                                : 'theme-text-primary'
                            }`}
                          >
                            {month}
                          </span>
                        </div>
                        {isAlreadyPaid && (
                          <span
                            title="Payment already completed for this month"
                            className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-0.5"
                          >
                            <Check className="w-3.5 h-3.5" />
                            Paid
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Duplicate Warning Message */}
              {duplicateMonthsWarning.length > 0 && (
                <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                  <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-semibold text-sm mb-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>
                      Warning: {selectedMemberRecord?.memberName} has already paid for some of the selected months:
                    </span>
                  </div>
                  <p className="text-xs text-amber-700 dark:text-amber-300 font-mono pl-6">
                    {duplicateMonthsWarning.join(' · ')}
                  </p>
                </div>
              )}

              {/* Fee Amount Input */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label
                    htmlFor="feeAmount"
                    className="block text-xs font-semibold theme-text-secondary"
                  >
                    Fee Amount ($)
                  </label>
                  {selectedMonths.length > 0 && (
                    <span className="text-xs theme-text-muted font-mono tabular-nums">
                      {selectedMonths.length} month(s) selected
                    </span>
                  )}
                </div>
                <input
                  id="feeAmount"
                  type="number"
                  step="0.01"
                  min="0"
                  max={VALIDATION_RULES.MAX_FEE_AMOUNT}
                  value={feeAmountInput}
                  onChange={(e) => setFeeAmountInput(e.target.value)}
                  placeholder="Enter total fee amount (e.g. 20.00)"
                  className="w-full px-4 py-3 border rounded-xl text-sm font-mono tabular-nums theme-input transition-all"
                  required
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={
                  isSavingPayment ||
                  (selectedMemberRecord !== null &&
                    paidMonthsForSelectedMember.size === MONTHS.length)
                }
                className="w-full py-3.5 px-6 theme-btn-primary disabled:opacity-50 disabled:cursor-not-allowed font-semibold rounded-xl transition-colors text-sm cursor-pointer"
              >
                {isSavingPayment
                  ? 'Saving Payment...'
                  : selectedMemberRecord &&
                    paidMonthsForSelectedMember.size === MONTHS.length
                  ? 'All 12 Months Paid for Selected Member'
                  : clubConfig.buttonText || DEFAULT_CONFIG.buttonText}
              </button>
            </form>
          </section>
        )}

        {/* TAB 2: PAYMENT STATUS */}
        {activeTab === 'status' && (
          <div className="space-y-8">
            {/* Payment Status Grid */}
            <section className="theme-surface border rounded-2xl p-6 sm:p-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 mb-6 border-b theme-border">
                <div>
                  <h2 className="font-display text-xl font-bold theme-text-primary">
                    {activePaymentYear} Payment Status Matrix
                  </h2>
                  <p className="text-sm theme-text-secondary mt-0.5">
                    Monthly payment completion across all registered club members for {activePaymentYear}.
                  </p>
                </div>

                {/* Year Filter & Legend */}
                <div className="flex flex-wrap items-center gap-4">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 theme-subtle border rounded-lg">
                    <Calendar className="w-3.5 h-3.5 theme-accent-text shrink-0" />
                    <label
                      htmlFor="matrixYearSelect"
                      className="text-xs font-semibold theme-text-secondary whitespace-nowrap"
                    >
                      Matrix Year:
                    </label>
                    <select
                      id="matrixYearSelect"
                      value={activePaymentYear}
                      onChange={(e) => handleYearFilterChange(e.target.value)}
                      className="text-xs font-mono font-bold theme-text-primary bg-transparent focus:outline-none cursor-pointer"
                    >
                      {availableYears.map((yr) => (
                        <option
                          key={yr}
                          value={yr}
                          className="theme-surface theme-text-primary"
                        >
                          {yr}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-4 text-xs font-semibold theme-text-secondary">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-md bg-emerald-600 text-white inline-flex items-center justify-center">
                        <Check className="w-3.5 h-3.5" />
                      </span>
                      <span>Paid</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-md bg-rose-600 text-white inline-flex items-center justify-center">
                        <X className="w-3.5 h-3.5" />
                      </span>
                      <span>Unpaid</span>
                    </div>
                  </div>
                </div>
              </div>

              {sortedMembers.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-sm theme-text-muted mb-4">
                    No members added yet. Add members in the &ldquo;Manage Members&rdquo; tab to view the 12-month payment status matrix.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('members')}
                    className="px-4 py-2 text-xs font-semibold theme-btn-primary rounded-lg transition-colors cursor-pointer"
                  >
                    Go to Manage Members
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto border theme-border rounded-xl">
                  <table className="min-w-full border-collapse text-sm">
                    <thead>
                      <tr className="theme-subtle border-b theme-border">
                        <th className="sticky left-0 z-10 theme-subtle px-4 py-3 text-left font-semibold theme-text-primary border-r theme-border">
                          Member
                        </th>
                        {MONTHS.map((month) => (
                          <th
                            key={month}
                            className="px-2.5 py-3 text-center font-semibold theme-text-secondary text-xs uppercase border-r theme-border whitespace-nowrap"
                          >
                            {month.substring(0, 3)}
                          </th>
                        ))}
                        <th className="px-4 py-3 text-right font-semibold theme-text-primary text-xs uppercase whitespace-nowrap">
                          Total Paid
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-color)]">
                      {sortedMembers.map((member) => {
                        const memberTotal = payments
                          .filter(
                            (p) =>
                              p.paymentDate?.startsWith(activePaymentYear) &&
                              (p.memberId === member.id ||
                                p.memberName.toUpperCase() ===
                                  member.memberName.toUpperCase())
                          )
                          .reduce((sum, p) => sum + Number(p.feeAmount || 0), 0);

                        return (
                          <tr key={member.id} className="transition-colors">
                            <td className="sticky left-0 z-10 theme-surface px-4 py-2.5 font-semibold theme-text-primary border-r theme-border whitespace-nowrap">
                              {member.memberName}
                            </td>
                            {MONTHS.map((month) => {
                              const isPaid =
                                memberMonthMatrix[member.id]?.[month] ?? false;
                              return (
                                <td
                                  key={month}
                                  className={`px-2 py-2.5 text-center border-r theme-border font-bold ${
                                    isPaid
                                      ? 'bg-emerald-600 text-white'
                                      : 'bg-rose-600/90 text-white'
                                  }`}
                                  title={`${member.memberName} — ${month} ${activePaymentYear}: ${
                                    isPaid ? 'PAID' : 'UNPAID'
                                  }`}
                                >
                                  <span aria-label={isPaid ? 'Paid' : 'Unpaid'}>
                                    {isPaid ? '✓' : '✗'}
                                  </span>
                                </td>
                              );
                            })}
                            <td className="px-4 py-2.5 text-right font-mono tabular-nums font-semibold theme-text-primary whitespace-nowrap">
                              ${memberTotal.toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Payment History */}
            <section className="theme-surface border rounded-2xl p-6 sm:p-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 mb-6 border-b theme-border">
                <div>
                  <h2 className="font-display text-xl font-bold theme-text-primary">
                    Payment History ({selectedYear === 'all' ? 'All Years' : selectedYear})
                  </h2>
                  <p className="text-sm theme-text-secondary mt-0.5">
                    Chronological log of recorded member fee payments with inline editing.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <select
                    value={selectedYear}
                    onChange={(e) => handleYearFilterChange(e.target.value)}
                    aria-label="Filter payment history by year"
                    className="px-3 py-2 border rounded-lg text-xs font-mono font-semibold theme-input"
                  >
                    <option value="all">All Years</option>
                    {availableYears.map((yr) => (
                      <option key={yr} value={yr}>
                        Year: {yr}
                      </option>
                    ))}
                  </select>

                  <div className="relative w-full sm:w-64">
                    <Search className="w-4 h-4 theme-text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={statusSearch}
                      onChange={(e) => setStatusSearch(e.target.value.toUpperCase())}
                      placeholder="Filter member or month..."
                      className="w-full pl-9 pr-3.5 py-2 border rounded-lg text-xs theme-input"
                    />
                  </div>
                </div>
              </div>

              {sortedPayments.length === 0 ? (
                <div className="py-10 text-center">
                  <p className="text-sm theme-text-muted">
                    No payments recorded yet. Start by adding a payment in the &ldquo;Record Payments&rdquo; tab.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-[var(--border-color)] border-t border-b theme-border">
                  {sortedPayments.map((payment) => {
                    const isEditing = editingPaymentId === payment.id;
                    const isDeleting = deletingPaymentId === payment.id;

                    return (
                      <div key={payment.id} className="py-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div>
                            <h3 className="font-semibold text-base theme-text-primary">
                              {payment.memberName}
                            </h3>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs theme-text-muted">
                              <span>Months: {payment.months}</span>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono tabular-nums">
                                Date: {payment.paymentDate}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-4">
                            <span className="font-mono tabular-nums text-base font-bold theme-accent-text">
                              ${Number(payment.feeAmount).toFixed(2)}
                            </span>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => startEditPayment(payment)}
                                className="px-3 py-1.5 text-xs font-semibold theme-subtle border rounded-lg hover:opacity-80 transition-colors inline-flex items-center gap-1 cursor-pointer"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeletingPaymentId(payment.id)}
                                className="px-3 py-1.5 text-xs font-semibold text-red-700 dark:text-red-300 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-colors inline-flex items-center gap-1 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Delete
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Inline Delete Confirmation */}
                        {isDeleting && (
                          <div className="mt-3 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                              Are you sure you want to delete this payment record for {payment.memberName}?
                            </p>
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleConfirmDeletePayment(payment.id)}
                                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors cursor-pointer"
                              >
                                Yes, Delete
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeletingPaymentId(null)}
                                className="px-3.5 py-1.5 text-xs font-semibold theme-surface border rounded-lg transition-colors cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Inline Edit Form */}
                        {isEditing && (
                          <div className="mt-4 p-4 theme-subtle border rounded-xl space-y-4">
                            <h4 className="text-xs font-bold uppercase tracking-wider theme-text-secondary">
                              Edit Payment Record
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-xs font-semibold theme-text-secondary mb-1">
                                  Member
                                </label>
                                <select
                                  value={editPaymentMemberId}
                                  onChange={(e) => setEditPaymentMemberId(e.target.value)}
                                  className="w-full px-3 py-2 border rounded-lg text-xs theme-input"
                                >
                                  {sortedMembers.map((m) => (
                                    <option key={m.id} value={m.id}>
                                      {m.memberName}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="block text-xs font-semibold theme-text-secondary mb-1">
                                  Months (comma-separated)
                                </label>
                                <input
                                  type="text"
                                  value={editPaymentMonths}
                                  onChange={(e) =>
                                    setEditPaymentMonths(e.target.value.toUpperCase())
                                  }
                                  className="w-full px-3 py-2 border rounded-lg text-xs theme-input uppercase"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-semibold theme-text-secondary mb-1">
                                  Amount ($)
                                </label>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={editPaymentAmount}
                                  onChange={(e) => setEditPaymentAmount(e.target.value)}
                                  className="w-full px-3 py-2 border rounded-lg text-xs font-mono tabular-nums theme-input"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-semibold theme-text-secondary mb-1">
                                  Date
                                </label>
                                <input
                                  type="date"
                                  value={editPaymentDate}
                                  onChange={(e) => setEditPaymentDate(e.target.value)}
                                  className="w-full px-3 py-2 border rounded-lg text-xs font-mono tabular-nums theme-input"
                                />
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleSaveEditPayment(payment)}
                                className="px-4 py-2 text-xs font-semibold theme-btn-primary rounded-lg transition-colors cursor-pointer"
                              >
                                Save Changes
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingPaymentId(null)}
                                className="px-4 py-2 text-xs font-semibold theme-surface border rounded-lg transition-colors cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}

        {/* TAB 3: BUDGET */}
        {activeTab === 'budget' && (
          <div className="space-y-8">
            {/* Financial Summary Strip */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="theme-surface border rounded-2xl p-6">
                <span className="text-xs font-semibold theme-text-muted">
                  Current Balance
                </span>
                <p
                  className={`mt-2 font-mono tabular-nums text-3xl font-bold tracking-tight ${
                    financialSummary.currentBalance >= 0
                      ? 'theme-text-primary'
                      : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  ${financialSummary.currentBalance.toFixed(2)}
                </p>
                <div className="mt-2 flex items-center gap-2 text-xs theme-text-muted">
                  <span>Net Treasury Position</span>
                </div>
              </div>

              <div className="theme-surface border rounded-2xl p-6">
                <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                  Total Income
                </span>
                <p className="mt-2 font-mono tabular-nums text-3xl font-bold tracking-tight text-emerald-700 dark:text-emerald-400">
                  +${financialSummary.totalIncome.toFixed(2)}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs theme-text-muted font-mono tabular-nums">
                  <span>Fees: ${financialSummary.paymentIncome.toFixed(2)}</span>
                  <span aria-hidden="true">·</span>
                  <span>Other: ${financialSummary.transactionIncome.toFixed(2)}</span>
                </div>
              </div>

              <div className="theme-surface border rounded-2xl p-6">
                <span className="text-xs font-semibold text-rose-700 dark:text-rose-400">
                  Total Expenses
                </span>
                <p className="mt-2 font-mono tabular-nums text-3xl font-bold tracking-tight text-rose-700 dark:text-rose-400">
                  -${financialSummary.totalExpenses.toFixed(2)}
                </p>
                <div className="mt-2 flex items-center gap-2 text-xs theme-text-muted font-mono tabular-nums">
                  <span>
                    {
                      yearFilteredTransactions.filter(
                        (t) => t.transactionType === 'expense'
                      ).length
                    }{' '}
                    Expense Record(s) (
                    {selectedYear === 'all' ? 'All Years' : selectedYear})
                  </span>
                </div>
              </div>
            </div>

            {/* Add Transaction Form */}
            <section className="theme-surface border rounded-2xl p-6 sm:p-8">
              <div className="pb-6 mb-6 border-b theme-border">
                <h2 className="font-display text-xl font-bold theme-text-primary">
                  Add Budget Transaction
                </h2>
                <p className="text-sm theme-text-secondary mt-0.5">
                  Log additional club income or operating expenses into the 2026 treasury ledger.
                </p>
              </div>

              <form onSubmit={handleAddTransaction} className="space-y-6">
                {/* Transaction Type */}
                <div>
                  <label className="block text-xs font-semibold theme-text-secondary mb-2">
                    Transaction Type
                  </label>
                  <div className="inline-flex p-1 theme-tab-rail rounded-xl">
                    <button
                      type="button"
                      onClick={() => {
                        setTxType('income');
                        setTxCategory('');
                      }}
                      className={`px-5 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                        txType === 'income'
                          ? 'theme-surface text-emerald-700 dark:text-emerald-400 shadow-xs'
                          : 'theme-text-secondary'
                      }`}
                    >
                      Income
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTxType('expense');
                        setTxCategory('');
                      }}
                      className={`px-5 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                        txType === 'expense'
                          ? 'theme-surface text-rose-700 dark:text-rose-400 shadow-xs'
                          : 'theme-text-secondary'
                      }`}
                    >
                      Expense
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Category */}
                  <div>
                    <label
                      htmlFor="budgetCategory"
                      className="block text-xs font-semibold theme-text-secondary mb-2"
                    >
                      Category
                    </label>
                    <select
                      id="budgetCategory"
                      value={txCategory}
                      onChange={(e) => setTxCategory(e.target.value)}
                      className="w-full px-4 py-3 border rounded-xl text-sm theme-input"
                      required
                    >
                      <option value="">Choose a category...</option>
                      {(txType === 'income'
                        ? INCOME_CATEGORIES
                        : EXPENSE_CATEGORIES
                      ).map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Amount */}
                  <div>
                    <label
                      htmlFor="budgetAmount"
                      className="block text-xs font-semibold theme-text-secondary mb-2"
                    >
                      Amount ($)
                    </label>
                    <input
                      id="budgetAmount"
                      type="number"
                      step="0.01"
                      min="0"
                      max={VALIDATION_RULES.MAX_TX_AMOUNT}
                      value={txAmount}
                      onChange={(e) => setTxAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full px-4 py-3 border rounded-xl text-sm font-mono tabular-nums theme-input"
                      required
                    />
                  </div>

                  {/* Date */}
                  <div>
                    <label
                      htmlFor="budgetDate"
                      className="block text-xs font-semibold theme-text-secondary mb-2"
                    >
                      Date
                    </label>
                    <input
                      id="budgetDate"
                      type="date"
                      value={txDate}
                      onChange={(e) => setTxDate(e.target.value)}
                      className="w-full px-4 py-3 border rounded-xl text-sm font-mono tabular-nums theme-input"
                      required
                    />
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label
                    htmlFor="budgetDescription"
                    className="block text-xs font-semibold theme-text-secondary mb-2"
                  >
                    Description
                  </label>
                  <input
                    id="budgetDescription"
                    type="text"
                    maxLength={VALIDATION_RULES.DESCRIPTION_MAX_LEN}
                    value={txDescription}
                    onChange={(e) => setTxDescription(e.target.value.toUpperCase())}
                    placeholder="ENTER TRANSACTION DESCRIPTION"
                    className="w-full px-4 py-3 border rounded-xl text-sm uppercase theme-input"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSavingTx}
                  className="w-full py-3.5 px-6 theme-btn-primary disabled:opacity-50 font-semibold rounded-xl transition-colors text-sm cursor-pointer"
                >
                  {isSavingTx ? 'Adding Transaction...' : 'Add Transaction'}
                </button>
              </form>
            </section>

            {/* Transaction History */}
            <section className="theme-surface border rounded-2xl p-6 sm:p-8">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 mb-6 border-b theme-border">
                <div>
                  <h2 className="font-display text-xl font-bold theme-text-primary">
                    Transaction History
                  </h2>
                  <p className="text-sm theme-text-secondary mt-0.5">
                    Filter and audit all recorded budget income and expense entries.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 theme-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={txSearch}
                      onChange={(e) => setTxSearch(e.target.value.toUpperCase())}
                      placeholder="Search description..."
                      className="pl-8 pr-3 py-2 border rounded-lg text-xs theme-input"
                    />
                  </div>

                  <select
                    value={selectedYear}
                    onChange={(e) => handleYearFilterChange(e.target.value)}
                    aria-label="Filter transactions by year"
                    className="px-3 py-2 border rounded-lg text-xs font-mono font-semibold theme-input"
                  >
                    <option value="all">All Years</option>
                    {availableYears.map((yr) => (
                      <option key={yr} value={yr}>
                        Year: {yr}
                      </option>
                    ))}
                  </select>

                  <select
                    value={filterType}
                    onChange={(e) =>
                      setFilterType(e.target.value as 'all' | 'income' | 'expense')
                    }
                    className="px-3 py-2 border rounded-lg text-xs font-semibold theme-input"
                  >
                    <option value="all">All Transactions</option>
                    <option value="income">Income Only</option>
                    <option value="expense">Expenses Only</option>
                  </select>

                  <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    className="px-3 py-2 border rounded-lg text-xs font-semibold theme-input"
                  >
                    <option value="all">All Categories</option>
                    {availableCategories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {filteredTransactions.length === 0 ? (
                <div className="py-10 text-center">
                  <p className="text-sm theme-text-muted">
                    No transactions match your current filters.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-[var(--border-color)] border-t border-b theme-border">
                  {filteredTransactions.map((tx) => {
                    const isIncome = tx.transactionType === 'income';
                    const isEditing = editingTxId === tx.id;
                    const isDeleting = deletingTxId === tx.id;

                    return (
                      <div key={tx.id} className="py-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <span
                              className={`mt-0.5 w-7 h-7 rounded-lg inline-flex items-center justify-center shrink-0 ${
                                isIncome
                                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                                  : 'bg-rose-500/15 text-rose-700 dark:text-rose-400'
                              }`}
                            >
                              {isIncome ? (
                                <ArrowUpRight className="w-4 h-4" />
                              ) : (
                                <ArrowDownRight className="w-4 h-4" />
                              )}
                            </span>
                            <div>
                              <h3 className="font-semibold text-base theme-text-primary">
                                {tx.description}
                              </h3>
                              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs theme-text-muted">
                                <span>{tx.category}</span>
                                <span aria-hidden="true">·</span>
                                <span className="uppercase">{tx.transactionType}</span>
                                <span aria-hidden="true">·</span>
                                <span className="font-mono tabular-nums">
                                  {tx.transactionDate}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-4">
                            <span
                              className={`font-mono tabular-nums text-base font-bold ${
                                isIncome
                                  ? 'text-emerald-700 dark:text-emerald-400'
                                  : 'text-rose-700 dark:text-rose-400'
                              }`}
                            >
                              {isIncome ? '+' : '-'}${Number(tx.amount).toFixed(2)}
                            </span>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => startEditTransaction(tx)}
                                className="px-3 py-1.5 text-xs font-semibold theme-subtle border rounded-lg hover:opacity-80 transition-colors inline-flex items-center gap-1 cursor-pointer"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeletingTxId(tx.id)}
                                className="px-3 py-1.5 text-xs font-semibold text-red-700 dark:text-red-300 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-colors inline-flex items-center gap-1 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Delete
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Delete Confirmation */}
                        {isDeleting && (
                          <div className="mt-3 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                              Are you sure you want to delete this transaction ({tx.description})?
                            </p>
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleConfirmDeleteTransaction(tx.id)}
                                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors cursor-pointer"
                              >
                                Yes, Delete
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeletingTxId(null)}
                                className="px-3.5 py-1.5 text-xs font-semibold theme-surface border rounded-lg transition-colors cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Edit Transaction Form */}
                        {isEditing && (
                          <div className="mt-4 p-4 theme-subtle border rounded-xl space-y-4">
                            <h4 className="text-xs font-bold uppercase tracking-wider theme-text-secondary">
                              Edit Transaction
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                              <div>
                                <label className="block text-xs font-semibold theme-text-secondary mb-1">
                                  Type
                                </label>
                                <select
                                  value={editTxType}
                                  onChange={(e) =>
                                    setEditTxType(
                                      e.target.value as 'income' | 'expense'
                                    )
                                  }
                                  className="w-full px-3 py-2 border rounded-lg text-xs theme-input"
                                >
                                  <option value="income">Income</option>
                                  <option value="expense">Expense</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-xs font-semibold theme-text-secondary mb-1">
                                  Category
                                </label>
                                <input
                                  type="text"
                                  value={editTxCategory}
                                  onChange={(e) =>
                                    setEditTxCategory(e.target.value.toUpperCase())
                                  }
                                  className="w-full px-3 py-2 border rounded-lg text-xs uppercase theme-input"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-semibold theme-text-secondary mb-1">
                                  Amount ($)
                                </label>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={editTxAmount}
                                  onChange={(e) => setEditTxAmount(e.target.value)}
                                  className="w-full px-3 py-2 border rounded-lg text-xs font-mono tabular-nums theme-input"
                                />
                              </div>
                              <div className="sm:col-span-2">
                                <label className="block text-xs font-semibold theme-text-secondary mb-1">
                                  Description
                                </label>
                                <input
                                  type="text"
                                  value={editTxDescription}
                                  onChange={(e) =>
                                    setEditTxDescription(e.target.value.toUpperCase())
                                  }
                                  className="w-full px-3 py-2 border rounded-lg text-xs uppercase theme-input"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-semibold theme-text-secondary mb-1">
                                  Date
                                </label>
                                <input
                                  type="date"
                                  value={editTxDate}
                                  onChange={(e) => setEditTxDate(e.target.value)}
                                  className="w-full px-3 py-2 border rounded-lg text-xs font-mono tabular-nums theme-input"
                                />
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleSaveEditTransaction(tx)}
                                className="px-4 py-2 text-xs font-semibold theme-btn-primary rounded-lg transition-colors cursor-pointer"
                              >
                                Save Changes
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingTxId(null)}
                                className="px-4 py-2 text-xs font-semibold theme-surface border rounded-lg transition-colors cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}

        {/* TAB 4: MANAGE MEMBERS */}
        {activeTab === 'members' && (
          <section className="theme-surface border rounded-2xl p-6 sm:p-8">
            <div className="pb-6 mb-6 border-b theme-border">
              <h2 className="font-display text-xl font-bold theme-text-primary">
                Manage Club Members
              </h2>
              <p className="text-sm theme-text-secondary mt-0.5">
                Add new members to the SKAS | KGKT directory or review total payments per member.
              </p>
            </div>

            {/* Add Member Form */}
            <form
              onSubmit={handleAddMember}
              className="pb-8 mb-8 border-b theme-border"
            >
              <label
                htmlFor="newMemberName"
                className="block text-xs font-semibold theme-text-secondary mb-2"
              >
                Add New Member
              </label>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  id="newMemberName"
                  type="text"
                  maxLength={VALIDATION_RULES.MEMBER_NAME_MAX_LEN}
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value.toUpperCase())}
                  placeholder="ENTER MEMBER FULL NAME"
                  className="flex-1 px-4 py-3 border rounded-xl text-sm uppercase theme-input"
                  required
                />
                <button
                  type="submit"
                  disabled={isAddingMember}
                  className="px-6 py-3 theme-btn-primary disabled:opacity-50 font-semibold rounded-xl text-sm transition-colors inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  {isAddingMember ? 'Adding...' : 'Add Member'}
                </button>
              </div>
            </form>

            {/* Current Members Directory */}
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <h3 className="text-sm font-bold theme-text-primary">
                  Current Members ({sortedMembers.length})
                </h3>
                <div className="flex flex-wrap items-center gap-3">
                  <select
                    value={selectedYear}
                    onChange={(e) => handleYearFilterChange(e.target.value)}
                    aria-label="Filter member payment stats by year"
                    className="px-3 py-2 border rounded-lg text-xs font-mono font-semibold theme-input"
                  >
                    <option value="all">All Years</option>
                    {availableYears.map((yr) => (
                      <option key={yr} value={yr}>
                        Year: {yr}
                      </option>
                    ))}
                  </select>
                  <div className="relative w-full sm:w-64">
                    <Search className="w-3.5 h-3.5 theme-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={memberSearch}
                      onChange={(e) => setMemberSearch(e.target.value.toUpperCase())}
                      placeholder="Search member name..."
                      className="w-full pl-8 pr-3 py-2 border rounded-lg text-xs theme-input"
                    />
                  </div>
                </div>
              </div>

              {sortedMembers.length === 0 ? (
                <div className="py-10 text-center">
                  <p className="text-sm theme-text-muted">
                    No members added yet. Add your first member above or click &ldquo;Load Sample 2026 Data&rdquo;.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-[var(--border-color)] border-t border-b theme-border">
                  {sortedMembers
                    .filter((m) =>
                      !memberSearch.trim()
                        ? true
                        : m.memberName
                            .toUpperCase()
                            .includes(memberSearch.trim().toUpperCase())
                    )
                    .map((member) => {
                      const memberPayments = yearFilteredPayments.filter(
                        (p) =>
                          p.memberId === member.id ||
                          p.memberName.toUpperCase() ===
                            member.memberName.toUpperCase()
                      );
                      const allTimeMemberPayments = payments.filter(
                        (p) =>
                          p.memberId === member.id ||
                          p.memberName.toUpperCase() ===
                            member.memberName.toUpperCase()
                      );
                      const totalPaid = memberPayments.reduce(
                        (sum, p) => sum + Number(p.feeAmount || 0),
                        0
                      );
                      const monthsCoveredCount = MONTHS.filter(
                        (m) => memberMonthMatrix[member.id]?.[m]
                      ).length;

                      const isRenaming = editingMemberId === member.id;
                      const isDeleting = deletingMemberId === member.id;

                      return (
                        <div key={member.id} className="py-4">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                              <h4 className="font-semibold text-base theme-text-primary">
                                {member.memberName}
                              </h4>
                              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs theme-text-muted font-mono tabular-nums">
                                <span>
                                  {memberPayments.length} payment(s) (
                                  {selectedYear === 'all' ? 'All Years' : selectedYear})
                                </span>
                                <span aria-hidden="true">·</span>
                                <span>
                                  {monthsCoveredCount}/12 months paid ({activePaymentYear})
                                </span>
                                <span aria-hidden="true">·</span>
                                <span className="font-semibold theme-text-secondary">
                                  Total: ${totalPaid.toFixed(2)}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedMemberId(member.id);
                                  setActiveTab('payments');
                                }}
                                className="px-3 py-1.5 text-xs font-semibold theme-btn-soft border rounded-lg transition-colors cursor-pointer"
                              >
                                Record Fee
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingMemberId(member.id);
                                  setEditMemberNameInput(member.memberName);
                                }}
                                className="px-3 py-1.5 text-xs font-semibold theme-subtle border rounded-lg transition-colors cursor-pointer"
                              >
                                Rename
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeletingMemberId(member.id)}
                                className="px-3 py-1.5 text-xs font-semibold text-red-700 dark:text-red-300 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-colors cursor-pointer"
                              >
                                Delete
                              </button>
                            </div>
                          </div>

                          {/* Rename Member Inline Bar */}
                          {isRenaming && (
                            <div className="mt-3 p-4 theme-subtle border rounded-xl flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                              <input
                                type="text"
                                value={editMemberNameInput}
                                onChange={(e) =>
                                  setEditMemberNameInput(e.target.value.toUpperCase())
                                }
                                maxLength={VALIDATION_RULES.MEMBER_NAME_MAX_LEN}
                                className="flex-1 px-3 py-2 border rounded-lg text-xs uppercase theme-input"
                              />
                              <div className="flex items-center gap-2 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleSaveRenameMember(member)}
                                  className="px-3.5 py-2 text-xs font-semibold theme-btn-primary rounded-lg transition-colors cursor-pointer"
                                >
                                  Save Name
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingMemberId(null)}
                                  className="px-3.5 py-2 text-xs font-semibold theme-surface border rounded-lg transition-colors cursor-pointer"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Delete Member Inline Warning */}
                          {isDeleting && (
                            <div className="mt-3 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                                This will delete {member.memberName} and all {allTimeMemberPayments.length} of their payment records. Are you sure?
                              </p>
                              <div className="flex items-center gap-2 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleConfirmDeleteMember(member)}
                                  className="px-3.5 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors cursor-pointer"
                                >
                                  Yes, Delete
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeletingMemberId(null)}
                                  className="px-3.5 py-1.5 text-xs font-semibold theme-surface border rounded-lg transition-colors cursor-pointer"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </section>
        )}
      </main>

      {/* Customize Workspace Titles Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="theme-surface border rounded-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between pb-4 mb-4 border-b theme-border">
              <h2 className="font-display text-lg font-bold theme-text-primary">
                Customize Workspace
              </h2>
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="theme-text-muted hover:opacity-80 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveWorkspaceConfig} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold theme-text-secondary mb-1">
                  Club / Organization Title
                </label>
                <input
                  type="text"
                  maxLength={100}
                  value={configTitleInput}
                  onChange={(e) => setConfigTitleInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 border rounded-xl text-sm theme-input"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold theme-text-secondary mb-1">
                  Page Subtitle
                </label>
                <input
                  type="text"
                  maxLength={150}
                  value={configPageInput}
                  onChange={(e) => setConfigPageInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 border rounded-xl text-sm theme-input"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold theme-text-secondary mb-1">
                  Payment Submit Button Text
                </label>
                <input
                  type="text"
                  maxLength={60}
                  value={configBtnInput}
                  onChange={(e) => setConfigBtnInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 border rounded-xl text-sm theme-input"
                  required
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(false)}
                  className="px-4 py-2 text-xs font-semibold theme-surface border rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingConfig}
                  className="px-4 py-2 text-xs font-semibold theme-btn-primary rounded-lg cursor-pointer"
                >
                  {isSavingConfig ? 'Saving...' : 'Save Configuration'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
