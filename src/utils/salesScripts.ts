import {
  AssessmentRecord,
  CompanySettings,
  CustomerRecord,
  DEFAULT_ASSESSMENT_EXPLANATION,
  GOMPOCO_PAYMENT_DETAILS,
  QuotationRecord,
  WhatsAppMessageType,
} from '@/src/types/gompoco';
import { formatZAR } from '@/src/utils/calculations';

export interface MessageGeneratorContext {
  messageType: WhatsAppMessageType;
  customer?: CustomerRecord | null;
  assessment?: AssessmentRecord | null;
  quotation?: QuotationRecord | null;
  company?: CompanySettings | null;
  salespersonName?: string;
}

const DEFAULT_WHATSAPP_PROPOSED_WORK =
  'Targeted treatment of the affected areas, including appropriate safety measures and aftercare guidance.';

function getPestSummary(customer?: CustomerRecord | null, assessment?: AssessmentRecord | null): string {
  if (assessment?.pestIdentified) {
    return assessment.pestIdentified;
  }
  const cats = customer?.discovery?.pestCategories || [];
  if (cats.length > 0) {
    const first = cats[0];
    if (first === 'Other' && customer?.discovery?.otherPestDescription) {
      return customer.discovery.otherPestDescription;
    }
    return first;
  }
  return 'pest control';
}

function buildPaymentDetailsText(): string {
  return `*Payment Details*
To proceed, please make payment using the following details:

- *Bank:* ${GOMPOCO_PAYMENT_DETAILS.bank}
- *Account Holder:* ${GOMPOCO_PAYMENT_DETAILS.accountHolder}
- *Account Type:* ${GOMPOCO_PAYMENT_DETAILS.accountType}
- *Account Number:* ${GOMPOCO_PAYMENT_DETAILS.accountNumber}
- *Branch Code:* ${GOMPOCO_PAYMENT_DETAILS.branchCode}

*Proof of Payment*
Please WhatsApp your proof of payment to *074 247 8857*.`;
}

export function generateWhatsAppMessage(ctx: MessageGeneratorContext): string {
  const customerName = ctx.customer?.fullName || '[customer name]';
  const area = ctx.customer?.suburb || '[Area]';
  const address = ctx.customer?.propertyAddress || '[customer address]';
  const pest = getPestSummary(ctx.customer, ctx.assessment);
  const signature = `Kind regards,\n*Gompoco Home Care*\n_Always There, Home Care._`;

  const qNum = ctx.quotation?.quotationNumber || '[Quotation Number]';
  const qTotal = ctx.quotation ? formatZAR(ctx.quotation.grandTotal) : '';
  const validItems = ctx.quotation?.lineItems?.filter((i) => i.description.trim().length > 0) || [];
  const totalWithService =
    validItems.length === 1
      ? `${validItems[0].description} (${formatZAR(validItems[0].lineTotal)})`
      : validItems.length > 1
      ? `${validItems.map((i) => i.description).join(', ')} (${qTotal})`
      : qTotal || '[selected service]';

  const rawObs = ctx.assessment?.infestationObservations?.trim() || '';
  const proposedWorkExplanation =
    rawObs && rawObs !== DEFAULT_ASSESSMENT_EXPLANATION
      ? rawObs
      : DEFAULT_WHATSAPP_PROPOSED_WORK;

  const paymentDetails = buildPaymentDetailsText();

  switch (ctx.messageType) {
    case 'Quotation proposal':
      return `Good day, ${customerName}.\n\nThank you for choosing Gompoco for your pest control needs in ${address}.\n\n*Quotation:* ${qNum}\n*Total:* ${totalWithService}\n\n*Proposed Work*\n${proposedWorkExplanation}\n\n${paymentDetails}\n\n${signature}`;

    case 'Quotation follow-up':
      return `Good day, ${customerName}.\n\nI'm following up on your Gompoco quotation for ${address}.\n\n*Quotation:* ${qNum}\n*Total:* ${totalWithService}\n\n${paymentDetails}\n\n${signature}`;

    case 'Assessment confirmation':
      return `Good day, ${customerName}.\n\nThank you for contacting Gompoco regarding ${pest.toLowerCase()} activity at ${address}, ${area}.\n\nOur initial assessment is complimentary. Following the assessment, we will confirm the exact treatment required and provide a clear written quotation.\n\nPlease let us know a day and time that suits you for the assessment.\n\n${signature}`;

    case 'General customer communication':
    default:
      return `Good day, ${customerName}.\n\nThank you for contacting Gompoco regarding your property in ${area}.\n\n[Enter your message here]\n\n${signature}`;
  }
}
