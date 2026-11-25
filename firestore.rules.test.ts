/**
 * Adversarial Security Rules Specification Tests ("Dirty Dozen")
 * Documents expected PERMISSION_DENIED assertions against firestore.rules.
 */
export interface DirtyDozenCase {
  id: number;
  name: string;
  collectionPath: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  expectedResult: 'PERMISSION_DENIED';
  description: string;
  payload?: Record<string, unknown>;
}

export const DIRTY_DOZEN_TESTS: DirtyDozenCase[] = [
  {
    id: 1,
    name: 'Unverified Email Spoofing',
    collectionPath: 'customers/cust_1',
    operation: 'get',
    expectedResult: 'PERMISSION_DENIED',
    description: 'User with email admin.gompoco@gmail.com and email_verified=false is denied.',
  },
  {
    id: 2,
    name: 'Self-Assigned Admin Escalation',
    collectionPath: 'staff/sales_uid_1',
    operation: 'create',
    expectedResult: 'PERMISSION_DENIED',
    description: 'Non-admin salesperson attempts to create staff profile with role="admin".',
    payload: { uid: 'sales_uid_1', role: 'admin', active: true },
  },
  {
    id: 3,
    name: 'Profile Role/Active Tampering',
    collectionPath: 'staff/sales_uid_1',
    operation: 'update',
    expectedResult: 'PERMISSION_DENIED',
    description: 'Salesperson attempts to alter their own role or re-enable active=true.',
    payload: { role: 'admin', active: true },
  },
  {
    id: 4,
    name: 'Cross-Owner Customer PII Read',
    collectionPath: 'customers/cust_of_sales_2',
    operation: 'get',
    expectedResult: 'PERMISSION_DENIED',
    description: 'Salesperson 1 attempts to read customer owned by Salesperson 2.',
  },
  {
    id: 5,
    name: 'Unfiltered List Query Scraping',
    collectionPath: 'customers',
    operation: 'list',
    expectedResult: 'PERMISSION_DENIED',
    description: 'Salesperson executes collection list without ownerUid == auth.uid constraint.',
  },
  {
    id: 6,
    name: 'Shadow Ghost Field Injection',
    collectionPath: 'customers/cust_1',
    operation: 'create',
    expectedResult: 'PERMISSION_DENIED',
    description: 'Payload includes unexpected shadow field isVipApproved=true.',
    payload: { ownerUid: 'sales_uid_1', fullName: 'Test', isVipApproved: true },
  },
  {
    id: 7,
    name: 'ID Poisoning',
    collectionPath: 'customers/..invalid$id',
    operation: 'create',
    expectedResult: 'PERMISSION_DENIED',
    description: 'Document ID fails ^[a-zA-Z0-9_\\-]+$ regex guard.',
  },
  {
    id: 8,
    name: 'Orphaned Assessment',
    collectionPath: 'assessments/assess_orphan',
    operation: 'create',
    expectedResult: 'PERMISSION_DENIED',
    description: 'Assessment references non-existent customerId.',
    payload: { customerId: 'non_existent_customer' },
  },
  {
    id: 9,
    name: 'Unapproved Quotation Invoice Generation',
    collectionPath: 'invoices/inv_unapproved',
    operation: 'create',
    expectedResult: 'PERMISSION_DENIED',
    description: 'Invoice references a quotation whose status is Draft instead of Approved.',
    payload: { quotationId: 'draft_quote_id', paymentStatus: 'Unpaid', amountPaid: 0 },
  },
  {
    id: 10,
    name: 'Auto-Paid Invoice Injection',
    collectionPath: 'invoices/inv_autopaid',
    operation: 'create',
    expectedResult: 'PERMISSION_DENIED',
    description: 'Invoice creation attempts to set paymentStatus="Paid" automatically.',
    payload: { paymentStatus: 'Paid', amountPaid: 1500 },
  },
  {
    id: 11,
    name: 'Post-Sent Quotation Price Tampering',
    collectionPath: 'quotations/quote_sent_1',
    operation: 'update',
    expectedResult: 'PERMISSION_DENIED',
    description: 'Salesperson attempts to alter lineItems or grandTotal after status is Sent.',
    payload: { grandTotal: 100 },
  },
  {
    id: 12,
    name: 'Client Timestamp Spoofing',
    collectionPath: 'customers/cust_spoof',
    operation: 'create',
    expectedResult: 'PERMISSION_DENIED',
    description: 'Payload supplies client-forged timestamp instead of request.time.',
  },
];
