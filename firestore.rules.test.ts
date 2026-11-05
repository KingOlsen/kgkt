/**
 * Security Rules Red-Team Test Specification (Dirty Dozen Payloads)
 * Verifies that all 12 adversarial payloads in security_spec.md return PERMISSION_DENIED.
 */

export interface DirtyDozenScenario {
  id: number;
  name: string;
  collectionPath: string;
  operation: 'create' | 'update' | 'list';
  payload: Record<string, unknown>;
  expectedResult: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_TESTS: DirtyDozenScenario[] = [
  {
    id: 1,
    name: 'Invalid Workspace ID Payload (ownerId Regex Failure)',
    collectionPath: '/members/mem_1',
    operation: 'create',
    payload: {
      memberName: 'AHMAD FAIZAL',
      ownerId: 'bad$owner!id',
      createdAt: 'REQUEST_TIME',
      updatedAt: 'REQUEST_TIME',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Missing Required Field Payload',
    collectionPath: '/members/mem_1',
    operation: 'create',
    payload: {
      memberName: 'AHMAD FAIZAL',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Shadow Field Injection on Create',
    collectionPath: '/members/mem_1',
    operation: 'create',
    payload: {
      memberName: 'AHMAD FAIZAL',
      ownerId: 'skas_kgkt_shared',
      isAdmin: true,
      createdAt: 'REQUEST_TIME',
      updatedAt: 'REQUEST_TIME',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Orphaned Payment Creation (memberId Non-Existent)',
    collectionPath: '/payments/pay_1',
    operation: 'create',
    payload: {
      memberId: 'non_existent_member',
      memberName: 'AHMAD FAIZAL',
      months: 'January, February',
      feeAmount: 40,
      paymentDate: '2026-03-01',
      ownerId: 'skas_kgkt_shared',
      createdAt: 'REQUEST_TIME',
      updatedAt: 'REQUEST_TIME',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Invalid Payment Date Format',
    collectionPath: '/payments/pay_1',
    operation: 'create',
    payload: {
      memberId: 'mem_1',
      memberName: 'AHMAD FAIZAL',
      months: 'January',
      feeAmount: 20,
      paymentDate: '05/11/2026',
      ownerId: 'skas_kgkt_shared',
      createdAt: 'REQUEST_TIME',
      updatedAt: 'REQUEST_TIME',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Temporal Forgery on Create',
    collectionPath: '/transactions/tx_1',
    operation: 'create',
    payload: {
      transactionType: 'income',
      category: 'DONATIONS',
      amount: 100,
      description: 'CLUB DONATION',
      transactionDate: '2026-03-01',
      ownerId: 'skas_kgkt_shared',
      createdAt: '2020-01-01T00:00:00Z',
      updatedAt: 'REQUEST_TIME',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Immortal Field Mutation on Update',
    collectionPath: '/members/mem_1',
    operation: 'update',
    payload: {
      memberName: 'AHMAD FAIZAL',
      ownerId: 'hijacked_workspace',
      updatedAt: 'REQUEST_TIME',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Shadow Field Injection on Update',
    collectionPath: '/transactions/tx_1',
    operation: 'update',
    payload: {
      description: 'UPDATED DESC',
      approvedBy: 'system',
      updatedAt: 'REQUEST_TIME',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Value Poisoning on Update',
    collectionPath: '/payments/pay_1',
    operation: 'update',
    payload: {
      feeAmount: -50,
      updatedAt: 'REQUEST_TIME',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Denial-of-Wallet Oversized String',
    collectionPath: '/transactions/tx_1',
    operation: 'create',
    payload: {
      transactionType: 'expense',
      category: 'SUPPLIES',
      amount: 50,
      description: 'A'.repeat(5000),
      transactionDate: '2026-03-01',
      ownerId: 'skas_kgkt_shared',
      createdAt: 'REQUEST_TIME',
      updatedAt: 'REQUEST_TIME',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Path ID Poisoning',
    collectionPath: '/members/invalid$id!with*bad*chars',
    operation: 'create',
    payload: {
      memberName: 'AHMAD FAIZAL',
      ownerId: 'skas_kgkt_shared',
      createdAt: 'REQUEST_TIME',
      updatedAt: 'REQUEST_TIME',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Invalid Transaction Enum Type',
    collectionPath: '/transactions/tx_1',
    operation: 'create',
    payload: {
      transactionType: 'transfer',
      category: 'SUPPLIES',
      amount: 50,
      description: 'INVALID TYPE',
      transactionDate: '2026-03-01',
      ownerId: 'skas_kgkt_shared',
      createdAt: 'REQUEST_TIME',
      updatedAt: 'REQUEST_TIME',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
];
