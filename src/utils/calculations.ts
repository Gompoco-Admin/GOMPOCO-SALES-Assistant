import { QuotationLineItem } from '@/src/types/gompoco';

export const VAT_RATE = 0.15;

export function roundCurrency(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function formatZAR(amount: number): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safe);
}

export interface QuoteFinancialSummary {
  lineItemsTotal: number;
  additionalChargesTotal: number;
  subtotal: number;
  discountAmount: number;
  netBeforeVat: number;
  vatAmount: number;
  grandTotal: number;
}

export function calculateQuotationTotals(params: {
  lineItems: QuotationLineItem[];
  labourCost: number;
  materialsCost: number;
  travelFee: number;
  additionalServicesCost: number;
  discountAmount: number;
  vatApplicable: boolean;
}): QuoteFinancialSummary {
  const lineItemsTotal = roundCurrency(
    params.lineItems.reduce((sum, item) => sum + roundCurrency(item.quantity * item.unitPrice), 0)
  );
  const additionalChargesTotal = roundCurrency(
    Math.max(0, params.labourCost) +
      Math.max(0, params.materialsCost) +
      Math.max(0, params.travelFee) +
      Math.max(0, params.additionalServicesCost)
  );
  const subtotal = roundCurrency(lineItemsTotal + additionalChargesTotal);
  const discountAmount = roundCurrency(Math.min(subtotal, Math.max(0, params.discountAmount)));
  const netBeforeVat = roundCurrency(Math.max(0, subtotal - discountAmount));
  const vatAmount = params.vatApplicable ? roundCurrency(netBeforeVat * VAT_RATE) : 0;
  const grandTotal = roundCurrency(netBeforeVat + vatAmount);

  return {
    lineItemsTotal,
    additionalChargesTotal,
    subtotal,
    discountAmount,
    netBeforeVat,
    vatAmount,
    grandTotal,
  };
}

export function getTodayIsoDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDaysIsoDate(isoDate: string, days: number): string {
  const base = isoDate ? new Date(`${isoDate}T00:00:00`) : new Date();
  if (Number.isNaN(base.getTime())) return getTodayIsoDate();
  base.setDate(base.getDate() + days);
  const y = base.getFullYear();
  const m = String(base.getMonth() + 1).padStart(2, '0');
  const d = String(base.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Generates guaranteed-unique, human-readable document numbers:
 * GMP-Q-YYYYMMDD-XXXX or GMP-INV-YYYYMMDD-XXXX
 */
export function generateUniqueDocumentNumber(
  prefix: 'GMP-Q' | 'GMP-INV',
  existingNumbers: string[] = []
): string {
  const datePart = getTodayIsoDate().replace(/-/g, '');
  const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const existingSet = new Set(existingNumbers.map((n) => n.toUpperCase()));

  for (let attempt = 0; attempt < 20; attempt++) {
    let suffix = '';
    for (let i = 0; i < 4; i++) {
      suffix += charset[Math.floor(Math.random() * charset.length)];
    }
    const candidate = `${prefix}-${datePart}-${suffix}`;
    if (!existingSet.has(candidate)) {
      return candidate;
    }
  }

  return `${prefix}-${datePart}-${Date.now().toString(36).toUpperCase().slice(-5)}`;
}

/**
 * Compresses an uploaded image file in the browser so it stays well within
 * Firestore attachment boundaries (< 200KB).
 */
export function compressImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the selected image file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Unsupported or corrupted image file.'));
      img.onload = () => {
        const maxWidth = 720;
        const maxHeight = 720;
        let { width, height } = img;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context unavailable for image compression.'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);

        let quality = 0.72;
        let dataUrl = canvas.toDataURL('image/jpeg', quality);
        while (dataUrl.length > 220000 && quality > 0.3) {
          quality -= 0.12;
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }

        if (dataUrl.length > 240000) {
          reject(new Error('Image remains too large after compression. Choose a smaller photo.'));
          return;
        }

        resolve(dataUrl);
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
