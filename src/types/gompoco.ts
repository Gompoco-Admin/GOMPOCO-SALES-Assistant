import { Timestamp } from 'firebase/firestore';

export type StaffRole = 'admin' | 'salesperson';

export type CustomerCategory = 'Residential' | 'Commercial' | 'Industrial';

export type ContactMethod = 'WhatsApp' | 'Phone Call' | 'Email';

export type PestCategory =
  | 'Cockroaches'
  | 'Ants'
  | 'Termites'
  | 'Rats'
  | 'Mice'
  | 'Bed bugs'
  | 'Flies'
  | 'Mosquitoes'
  | 'Spiders'
  | 'Other';

export const PEST_CATEGORIES: PestCategory[] = [
  'Cockroaches',
  'Ants',
  'Termites',
  'Rats',
  'Mice',
  'Bed bugs',
  'Flies',
  'Mosquitoes',
  'Spiders',
  'Other',
];

export const FREQUENCY_OPTIONS: string[] = [
  'Daily',
  'Multiple times a day',
  'Several times a week',
  'Weekly',
  'Occasionally / Monthly',
  'Seasonal / First sighting',
  'Other',
];

export const AREAS_AFFECTED_OPTIONS: string[] = [
  'Kitchen & pantry',
  'Bathrooms & plumbing areas',
  'Bedrooms & living areas',
  'Kitchen, pantry & bathrooms',
  'Cupboards & skirting boards',
  'Roof void / ceiling',
  'Garage & outbuildings',
  'Garden & exterior perimeter',
  'Entire residential property',
  'Commercial / office premises',
  'Other',
];

export const IDENTIFIED_PEST_OPTIONS: string[] = [
  'Cockroaches',
  'Ants',
  'Termites',
  'Rats',
  'Mice',
  'Bed bugs',
  'Flies',
  'Mosquitoes',
  'Spiders',
  'Preventative pest management',
  'Other',
];

export const RECOMMENDED_SERVICE_OPTIONS: string[] = [
  'Lite (R250.00)',
  'Regular (R500.00)',
  'Tuff (R750.00)',
  'Interior gel baiting & exterior perimeter spray',
  'Residual spray & crack-and-crevice treatment',
  'Rodent bait stations & entry-point proofing',
  'Termite soil & barrier treatment',
  'Bed bug targeted treatment',
  'Fly & mosquito misting control',
  'Preventative pest management',
  'Other',
];

export const DEFAULT_ASSESSMENT_EXPLANATION =
  'The assessment identified pest activity requiring attention. The proposed work includes treatment of the affected areas using an appropriate method, together with relevant safety precautions and aftercare guidance.';

export const SERVICE_TIERS = [
  { name: 'Lite', price: 250 },
  { name: 'Regular', price: 500 },
  { name: 'Tuff', price: 750 },
] as const;

export const GOMPOCO_PAYMENT_DETAILS = {
  intro: 'Happy with the quotation? Please proceed with payment using the banking details below.',
  bank: 'Capitec Business',
  accountHolder: 'GOMPOCO (PTY) LTD',
  accountType: 'Current Account',
  accountNumber: '1055918345',
  branchCode: '450105',
  popInstruction: 'Please send proof of payment to WhatsApp: 074 247 8857.',
} as const;

export type BookingConfirmationStatus =
  | 'Not Scheduled'
  | 'Pending'
  | 'Confirmed'
  | 'Rescheduled'
  | 'Completed'
  | 'Cancelled';

export type QuotationStatus = 'Draft' | 'Sent' | 'Approved' | 'Declined';

export const QUOTATION_STATUSES: QuotationStatus[] = [
  'Draft',
  'Sent',
  'Approved',
  'Declined',
];

export type InvoicePaymentStatus =
  | 'Unpaid'
  | 'Partially paid'
  | 'Paid'
  | 'Overdue';

export type WhatsAppMessageType =
  | 'Quotation proposal'
  | 'Quotation follow-up'
  | 'Assessment confirmation'
  | 'General customer communication';

export const WHATSAPP_MESSAGE_TYPES: WhatsAppMessageType[] = [
  'Quotation proposal',
  'Quotation follow-up',
  'Assessment confirmation',
  'General customer communication',
];

export type AppSectionId =
  | 'customer'
  | 'pest-problem'
  | 'assessment'
  | 'quotation'
  | 'whatsapp'
  | 'records';

export interface AppSectionMeta {
  id: AppSectionId;
  number: string;
  label: string;
  shortLabel: string;
}

export const APP_SECTIONS: AppSectionMeta[] = [
  { id: 'customer', number: '01', label: 'Customer Information', shortLabel: 'Customer' },
  { id: 'pest-problem', number: '02', label: 'Pest Problem', shortLabel: 'Pest' },
  { id: 'assessment', number: '03', label: 'Assessment Details', shortLabel: 'Assessment' },
  { id: 'quotation', number: '04', label: 'Quotation Builder', shortLabel: 'Quotation' },
  { id: 'whatsapp', number: '05', label: 'WhatsApp Message', shortLabel: 'WhatsApp' },
  { id: 'records', number: '06', label: 'Customer Records', shortLabel: 'Records' },
];

export const FIELD_LIMITS = {
  idMax: 128,
  fullNameMax: 150,
  phoneRawMax: 30,
  phoneNormalizedMax: 15,
  emailMax: 254,
  addressMax: 300,
  suburbMax: 120,
  salespersonMax: 120,
  notesMax: 2000,
  shortTextMax: 200,
  mediumTextMax: 500,
  longTextMax: 1000,
  assessmentTextMax: 3000,
  treatmentTextMax: 2000,
  attachmentDataUrlMax: 250000,
  lineItemsMax: 25,
  lineDescriptionMax: 300,
  whatsappMessageMax: 4000,
} as const;

export const FIELD_PATTERNS = {
  id: /^[a-zA-Z0-9_-]+$/,
  phoneNormalized: /^27[1-9][0-9]{8}$/,
  isoDate: /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/,
  quotationNumber: /^GMP-Q-[A-Z0-9-]+$/,
  invoiceNumber: /^GMP-INV-[A-Z0-9-]+$/,
} as const;

export interface StaffMember {
  uid: string;
  email: string;
  displayName: string;
  role: StaffRole;
  active: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface CompanySettings {
  businessName: string;
  slogan: string;
  phone: string;
  email: string;
  address: string;
  vatNumber: string;
  bankName: string;
  accountHolder: string;
  accountNumber: string;
  branchCode: string;
  paymentTerms: string;
  updatedBy: string;
  updatedAt?: Timestamp;
}

export const DEFAULT_COMPANY_SETTINGS: Omit<CompanySettings, 'updatedBy' | 'updatedAt'> = {
  businessName: 'Gompoco',
  slogan: 'Always There, Home Care.',
  phone: '',
  email: '',
  address: 'South Africa',
  vatNumber: '',
  bankName: '',
  accountHolder: 'Gompoco',
  accountNumber: '',
  branchCode: '',
  paymentTerms: 'Payment due by EFT using the quotation or reference number.',
};

export interface PestDiscoveryData {
  pestCategories: string[];
  otherPestDescription: string;
  whereNoticed: string;
  duration: string;
  frequency: string;
  severity: string;
  previousTreatments: string;
  productsUsed: string;
  dailyImpact: string;
  childrenOrPets: string;
  affectedAreas: string;
  additionalObservations: string;
}

export const EMPTY_DISCOVERY: PestDiscoveryData = {
  pestCategories: [],
  otherPestDescription: '',
  whereNoticed: '',
  duration: '',
  frequency: '',
  severity: '',
  previousTreatments: '',
  productsUsed: '',
  dailyImpact: '',
  childrenOrPets: '',
  affectedAreas: '',
  additionalObservations: '',
};

export interface AssessmentBookingData {
  preferredDate: string;
  preferredTime: string;
  propertyAddress: string;
  assessorAssigned: string;
  confirmationStatus: BookingConfirmationStatus;
  notes: string;
}

export const EMPTY_BOOKING: AssessmentBookingData = {
  preferredDate: '',
  preferredTime: '',
  propertyAddress: '',
  assessorAssigned: '',
  confirmationStatus: 'Not Scheduled',
  notes: '',
};

export interface CustomerRecord {
  id: string;
  ownerUid: string;
  fullName: string;
  phoneRaw: string;
  phoneNormalized: string;
  email: string;
  propertyAddress: string;
  suburb: string;
  category: CustomerCategory;
  preferredContactMethod: ContactMethod;
  enquiryDate: string;
  salespersonName: string;
  notes: string;
  discovery: PestDiscoveryData;
  booking: AssessmentBookingData;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface AssessmentRecord {
  id: string;
  ownerUid: string;
  customerId: string;
  customerName: string;
  assessmentDate: string;
  assessorName: string;
  pestIdentified: string;
  infestationObservations: string;
  affectedAreas: string;
  recommendedTreatment: string;
  treatmentMethod: string;
  proposedProducts: string;
  labourRequirements: string;
  safetyPrecautions: string;
  customerPreparation: string;
  aftercareInstructions: string;
  additionalRecommendations: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface QuotationLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface QuotationRecord {
  id: string;
  ownerUid: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerArea: string;
  customerAddress: string;
  assessmentId: string;
  quotationNumber: string;
  status: QuotationStatus;
  lineItems: QuotationLineItem[];
  labourCost: number;
  materialsCost: number;
  travelFee: number;
  additionalServicesCost: number;
  discountAmount: number;
  vatApplicable: boolean;
  subtotal: number;
  vatAmount: number;
  grandTotal: number;
  notes: string;
  customerApprovalName: string;
  customerApprovalMethod: string;
  customerApprovalDate: string;
  customerApprovalNotes: string;
  sentDate: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface InvoiceRecord {
  id: string;
  ownerUid: string;
  customerId: string;
  quotationId: string;
  quotationNumber: string;
  invoiceNumber: string;
  billingMilestone: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  customerAddress: string;
  customerSuburb: string;
  invoiceDate: string;
  dueDate: string;
  lineItems: QuotationLineItem[];
  labourCost: number;
  materialsCost: number;
  travelFee: number;
  additionalServicesCost: number;
  discountAmount: number;
  vatApplicable: boolean;
  subtotal: number;
  vatAmount: number;
  totalAmount: number;
  amountPaid: number;
  paymentStatus: InvoicePaymentStatus;
  paymentInstructions: string;
  paymentReference: string;
  notes: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface WhatsAppLogRecord {
  id: string;
  ownerUid: string;
  customerId: string;
  customerName: string;
  recipientPhone: string;
  messageType: WhatsAppMessageType | string;
  messageText: string;
  notes: string;
  markedSentBy: string;
  createdAt?: Timestamp;
}
