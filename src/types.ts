export const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

export type MonthName = (typeof MONTHS)[number];

export interface MemberRecord {
  id: string;
  memberName: string;
  ownerId: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface PaymentRecord {
  id: string;
  memberId: string;
  memberName: string;
  months: string;
  feeAmount: number;
  paymentDate: string;
  ownerId: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface TransactionRecord {
  id: string;
  transactionType: 'income' | 'expense';
  category: string;
  amount: number;
  description: string;
  transactionDate: string;
  ownerId: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ClubConfigRecord {
  clubTitle: string;
  pageTitle: string;
  buttonText: string;
  ownerId: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export const INCOME_CATEGORIES = [
  'MEMBERSHIP FEES',
  'DONATIONS',
  'FUNDRAISING',
  'OTHER INCOME',
] as const;

export const EXPENSE_CATEGORIES = [
  'VENUE RENTAL',
  'EQUIPMENT',
  'SUPPLIES',
  'FOOD & BEVERAGES',
  'MARKETING',
  'TRANSPORTATION',
  'OTHER EXPENSES',
] as const;

// Validation Constants synchronized with firebase-blueprint.json & firestore.rules
export const VALIDATION_RULES = {
  ID_MAX_LEN: 128,
  ID_REGEX: /^[a-zA-Z0-9_-]+$/,
  MEMBER_NAME_MAX_LEN: 100,
  MEMBER_NAME_REGEX: /^[A-Z0-9 .,'&()\-/]+$/,
  MONTHS_MAX_LEN: 200,
  MONTHS_REGEX: /^[A-Za-z, ]+$/,
  DATE_REGEX: /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/,
  CATEGORY_MAX_LEN: 100,
  CATEGORY_REGEX: /^[A-Z0-9 &.,'()\-/]+$/,
  DESCRIPTION_MAX_LEN: 300,
  DESCRIPTION_REGEX: /^[A-Z0-9 &.,'()\-/#$:;!?+]+$/,
  MAX_FEE_AMOUNT: 1000000,
  MAX_TX_AMOUNT: 10000000,
};

export function sanitizeUppercaseText(input: string, maxLen: number, allowedRegex?: RegExp): string {
  const upper = input.toUpperCase().trim().slice(0, maxLen);
  if (!allowedRegex) return upper;
  // Strip any disallowed characters so payload never fails strict regex rules
  return upper.replace(/[^A-Z0-9 &.,'()\-/#$:;!?+]/g, '').trim();
}

export function sanitizeMemberName(input: string): string {
  return input
    .toUpperCase()
    .replace(/[^A-Z0-9 .,'&()\-/]/g, '')
    .trim()
    .slice(0, VALIDATION_RULES.MEMBER_NAME_MAX_LEN);
}

export function sanitizeCategoryName(input: string): string {
  return input
    .toUpperCase()
    .replace(/[^A-Z0-9 &.,'()\-/]/g, '')
    .trim()
    .slice(0, VALIDATION_RULES.CATEGORY_MAX_LEN);
}
