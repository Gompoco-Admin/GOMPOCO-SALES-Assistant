# Gompoco Sales Assistant — Security Specification

## 1. Data Invariants

1. **Authenticated & Verified Access Only**: Every read and write across all collections requires a signed-in user with `request.auth.token.email_verified == true`.
2. **Role Separation (No Self-Assigned Admin)**: Regular users can only register a `/staff/{uid}` profile with `role == 'salesperson'` and cannot modify `role` or `active` fields after creation. Only the bootstrapped administrator (`admin.gompoco@gmail.com`) or users holding a document in `/admins/{uid}` have administrator privileges.
3. **PII & Ownership Isolation**: A salesperson may only read, list, create, or update customer records, assessments, attachments, quotations, invoices, and WhatsApp logs where `ownerUid == request.auth.uid` (and `active == true`).
4. **Parent Existence & Relational Integrity**:
   - Assessments, quotations, and WhatsApp logs cannot exist without a valid existing `/customers/{customerId}` document.
   - Assessment attachments require a valid parent `/assessments/{assessmentId}` owned by the caller (Master Gate).
   - Invoices cannot be created unless the referenced `/quotations/{quotationId}` exists and has `status == 'Approved'`, and `paymentStatus` on invoice creation must start as `'Unpaid'`.
5. **Document & Quotation Lifecycle Integrity**:
   - Quotations cannot have line items or pricing altered once `status` leaves `'Draft'`.
   - Terminal quotation statuses (`'Approved'`, `'Declined'`, `'Expired'`) and terminal invoice status (`'Paid'`) are locked against non-admin mutations.
6. **Temporal & Immutable Field Integrity**: `ownerUid` and `createdAt` are immutable after creation; `createdAt` and `updatedAt` must equal `request.time`.

## 2. The "Dirty Dozen" Adversarial Payloads

1. **Unverified Email Spoofing**: User signs in with `email == 'admin.gompoco@gmail.com'` but `email_verified == false` attempting to read `/customers`. -> `PERMISSION_DENIED`.
2. **Self-Assigned Admin Escalation**: Non-admin user writes `/staff/{uid}` with `role: 'admin'` or `/admins/{uid}`. -> `PERMISSION_DENIED`.
3. **Profile Role/Active Tampering**: Salesperson updates `/staff/{uid}` modifying `role` to `'admin'` or `active` to `true` after suspension. -> `PERMISSION_DENIED`.
4. **Cross-Owner Customer PII Read**: Salesperson A calls `get` on `/customers/{customerId}` owned by Salesperson B. -> `PERMISSION_DENIED`.
5. **Unfiltered List Query Scraping**: Salesperson executes `getDocs(collection(db, 'customers'))` without `where('ownerUid', '==', uid)`. -> `PERMISSION_DENIED`.
6. **Shadow / Ghost Field Injection**: User creates `/customers/{customerId}` containing an extra unvalidated field `isVipApproved: true`. -> `PERMISSION_DENIED`.
7. **ID Poisoning**: User attempts to write `/customers/` with a 300-character or invalid-symbol document ID (`../admin`). -> `PERMISSION_DENIED`.
8. **Orphaned Assessment / Quotation**: User creates `/assessments/{id}` referencing a non-existent `customerId`. -> `PERMISSION_DENIED`.
9. **Unapproved Quotation Invoice Generation**: User creates `/invoices/{id}` referencing a quotation whose `status` is `'Draft'` or `'Sent'`. -> `PERMISSION_DENIED`.
10. **Auto-Paid Invoice Injection**: User creates `/invoices/{id}` with `paymentStatus: 'Paid'` directly on creation. -> `PERMISSION_DENIED`.
11. **Post-Sent Quotation Price Tampering**: Salesperson updates `lineItems` or `grandTotal` on a quotation whose `status` is `'Sent'`. -> `PERMISSION_DENIED`.
12. **Client Timestamp Spoofing**: User writes `createdAt: new Date('2020-01-01')` instead of `serverTimestamp()` (`request.time`). -> `PERMISSION_DENIED`.
