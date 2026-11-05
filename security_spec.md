# Security Specification (`security_spec.md`)

## 1. Data Invariants

1. **Cross-Device Shared Workspace Invariant**: The application operates as a shared, login-free club ledger (`ownerId` workspace tag) syncing in real time across all devices. Every document in `/members`, `/payments`, `/transactions`, and `/settings` must carry a valid `ownerId` string (`^[a-zA-Z0-9_\-]+$`, 1..128 chars), and `ownerId` is strictly immutable on updates.
2. **Relational Member Sync Invariant (Master Gate)**: A payment document in `/payments/{paymentId}` can only be created or updated if its `memberId` references an existing document `/members/$(incoming().memberId)`.
3. **Temporal Integrity Invariant**: All documents require `createdAt == request.time` and `updatedAt == request.time` on creation. On update, `createdAt == resource.data.createdAt` (immutable) and `updatedAt == request.time`.
4. **Strict Key & Schema Blueprint Invariant**: All writes enforce `hasAll` and `hasOnly` key allowlists along with explicit type, boundary size, and regex pattern checks inside dedicated `isValid[Entity]` helpers, plus action-based `affectedKeys().hasOnly(...)` checks on updates.

## 2. The "Dirty Dozen" Payloads

1. **Invalid Workspace ID Payload (`ownerId` Regex Failure)**: Attempting to create `/members/mem_1` with `ownerId: "bad$owner!id"`.
2. **Missing Required Field Payload**: Attempting to create `/members/mem_1` without `ownerId` or `createdAt`.
3. **Shadow Field Injection on Create**: Creating `/members/mem_1` with required fields plus unauthorized field `"isAdmin": true`.
4. **Orphaned Payment Creation (`memberId` Non-Existent)**: Creating `/payments/pay_1` pointing to a `memberId` that does not exist in `/members`.
5. **Invalid Payment Date Format**: Creating `/payments/pay_1` with `paymentDate: "05/11/2026"` instead of `YYYY-MM-DD`.
6. **Temporal Forgery on Create**: Creating `/transactions/tx_1` with a client-forged past `createdAt` timestamp instead of `request.time`.
7. **Immortal Field Mutation on Update**: Updating `/members/mem_1` to change `ownerId` or `createdAt`.
8. **Shadow Field Injection on Update**: Updating `/transactions/tx_1` with `description` plus an unapproved key `"approvedBy": "system"`.
9. **Value Poisoning on Update**: Updating `/payments/pay_1` `feeAmount` with a negative number (`-50`) or string (`"100"`).
10. **Denial-of-Wallet Oversized String**: Creating `/transactions/tx_1` with a 5,000-character `description` exceeding `maxLength: 300`.
11. **Path ID Poisoning**: Creating `/members/invalid$id!with*bad*chars` that violates `^[a-zA-Z0-9_\-]+$`.
12. **Invalid Transaction Enum Type**: Creating `/transactions/tx_1` with `transactionType: "transfer"` instead of `"income"` or `"expense"`.
