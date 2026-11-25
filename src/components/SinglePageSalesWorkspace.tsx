import React, { useEffect, useMemo, useState } from 'react';
import { doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import {
  AlertTriangle,
  Check,
  Copy,
  CopyPlus,
  ExternalLink,
  Lock,
  MessageSquare,
  Plus,
  Printer,
  Search,
  Trash2,
  UserPlus,
} from 'lucide-react';
import { db, OperationType } from '@/src/firebase/client';
import { useAppData } from '@/src/context/AuthContext';
import {
  AREAS_AFFECTED_OPTIONS,
  AssessmentRecord,
  CustomerCategory,
  CustomerRecord,
  DEFAULT_ASSESSMENT_EXPLANATION,
  EMPTY_BOOKING,
  EMPTY_DISCOVERY,
  FIELD_LIMITS,
  FREQUENCY_OPTIONS,
  GOMPOCO_PAYMENT_DETAILS,
  IDENTIFIED_PEST_OPTIONS,
  PEST_CATEGORIES,
  PestDiscoveryData,
  QUOTATION_STATUSES,
  QuotationLineItem,
  QuotationRecord,
  QuotationStatus,
  RECOMMENDED_SERVICE_OPTIONS,
  SERVICE_TIERS,
  WHATSAPP_MESSAGE_TYPES,
  WhatsAppMessageType,
} from '@/src/types/gompoco';
import {
  formatZAR,
  generateUniqueDocumentNumber,
  getTodayIsoDate,
  roundCurrency,
} from '@/src/utils/calculations';
import { buildWhatsAppClickToChatUrl, normalizeSouthAfricanPhone } from '@/src/utils/phone';
import { generateWhatsAppMessage } from '@/src/utils/salesScripts';

interface SinglePageSalesWorkspaceProps {
  selectedCustomerId: string | null;
  onSelectCustomerId: (id: string | null) => void;
}

const CUSTOMER_TYPES: CustomerCategory[] = ['Residential', 'Commercial'];
const SEVERITY_OPTIONS = ['Low', 'Moderate', 'High', 'Severe'];
const WHERE_APPEARING_OPTIONS = [
  'Kitchen & pantry',
  'Bathrooms & drains',
  'Bedrooms & living areas',
  'Cupboards & skirting boards',
  'Ceiling / roof void',
  'Garage & storeroom',
  'Garden & exterior perimeter',
  'Entire property',
  'Commercial / office space',
  'Other',
];

export function SinglePageSalesWorkspace({
  selectedCustomerId,
  onSelectCustomerId,
}: SinglePageSalesWorkspaceProps) {
  const {
    user,
    staffProfile,
    isAdmin,
    dataLoading,
    customers,
    assessments,
    quotations,
    whatsappLogs,
    companySettings,
    reportFirestoreWriteError,
  } = useAppData();

  const defaultSalesperson = staffProfile?.displayName || user?.displayName || 'Gompoco Sales';

  const activeCustomer = useMemo(
    () => (selectedCustomerId ? customers.find((c) => c.id === selectedCustomerId) || null : null),
    [customers, selectedCustomerId]
  );

  const customerAssessments = useMemo(
    () => (activeCustomer ? assessments.filter((a) => a.customerId === activeCustomer.id) : []),
    [assessments, activeCustomer]
  );

  const customerQuotations = useMemo(
    () => (activeCustomer ? quotations.filter((q) => q.customerId === activeCustomer.id) : []),
    [quotations, activeCustomer]
  );

  const customerLogs = useMemo(
    () => (activeCustomer ? whatsappLogs.filter((l) => l.customerId === activeCustomer.id) : []),
    [whatsappLogs, activeCustomer]
  );

  const existingQuoteNumbers = useMemo(
    () => quotations.map((q) => q.quotationNumber),
    [quotations]
  );

  // Selected sub-records when viewing an existing customer
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<string | null>(null);
  const [selectedQuotationId, setSelectedQuotationId] = useState<string | null>(null);
  const [creatingNewQuote, setCreatingNewQuote] = useState(false);

  const activeAssessment =
    customerAssessments.find((a) => a.id === selectedAssessmentId) || customerAssessments[0] || null;
  const activeQuote = !creatingNewQuote
    ? customerQuotations.find((q) => q.id === selectedQuotationId) || customerQuotations[0] || null
    : null;

  // Section 01: Customer Info
  const [fullName, setFullName] = useState('');
  const [phoneRaw, setPhoneRaw] = useState('');
  const [email, setEmail] = useState('');
  const [propertyAddress, setPropertyAddress] = useState('');
  const [suburb, setSuburb] = useState('');
  const [customerType, setCustomerType] = useState<CustomerCategory>('Residential');
  const [salespersonName, setSalespersonName] = useState(defaultSalesperson);

  // Section 02: Pest Problem
  const [pestType, setPestType] = useState('');
  const [otherPestDescription, setOtherPestDescription] = useState('');
  const [whereNoticed, setWhereNoticed] = useState('');
  const [otherWhereDescription, setOtherWhereDescription] = useState('');
  const [frequency, setFrequency] = useState('');
  const [otherFrequencyDescription, setOtherFrequencyDescription] = useState('');
  const [severity, setSeverity] = useState('');
  const [affectedAreas, setAffectedAreas] = useState('');
  const [otherAreasDescription, setOtherAreasDescription] = useState('');

  // Section 03: Assessment Details
  const [pestIdentified, setPestIdentified] = useState('');
  const [otherPestIdentifiedDescription, setOtherPestIdentifiedDescription] = useState('');
  const [assessmentDate, setAssessmentDate] = useState(getTodayIsoDate());
  const [assessorName, setAssessorName] = useState(defaultSalesperson);
  const [assessmentAffectedAreas, setAssessmentAffectedAreas] = useState('');
  const [otherAssessmentAreasDescription, setOtherAssessmentAreasDescription] = useState('');
  const [recommendedTreatment, setRecommendedTreatment] = useState('');
  const [otherRecommendedTreatmentDescription, setOtherRecommendedTreatmentDescription] =
    useState('');
  const [infestationObservations, setInfestationObservations] = useState(
    DEFAULT_ASSESSMENT_EXPLANATION
  );

  // Section 04: Quotation Builder
  const [quotationNumber, setQuotationNumber] = useState(() =>
    generateUniqueDocumentNumber('GMP-Q', [])
  );
  const [quoteStatus, setQuoteStatus] = useState<QuotationStatus>('Draft');
  const [lineItems, setLineItems] = useState<QuotationLineItem[]>([
    { description: '', quantity: 1, unitPrice: 0, lineTotal: 0 },
  ]);
  const [quoteNotes, setQuoteNotes] = useState('');
  const [sentDate, setSentDate] = useState('');
  const [copiedAccountNumber, setCopiedAccountNumber] = useState(false);

  // Section 05: WhatsApp Message
  const [whatsAppType, setWhatsAppType] = useState<WhatsAppMessageType>('Quotation proposal');
  const [messageText, setMessageText] = useState('');
  const [messageEditedManually, setMessageEditedManually] = useState(false);
  const [copied, setCopied] = useState(false);
  const [openedWhatsApp, setOpenedWhatsApp] = useState(false);
  const [logNotes, setLogNotes] = useState('');
  const [loggingSent, setLoggingSent] = useState(false);
  const [logSuccess, setLogSuccess] = useState<string | null>(null);

  // Section 06: Search & Records
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'All' | 'Residential' | 'Commercial'>('All');

  // Form save status
  const [savingAll, setSavingAll] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const resetAllToNewCustomer = () => {
    onSelectCustomerId(null);
    setSelectedAssessmentId(null);
    setSelectedQuotationId(null);
    setCreatingNewQuote(false);

    setFullName('');
    setPhoneRaw('');
    setEmail('');
    setPropertyAddress('');
    setSuburb('');
    setCustomerType('Residential');
    setSalespersonName(defaultSalesperson);

    setPestType('');
    setOtherPestDescription('');
    setWhereNoticed('');
    setOtherWhereDescription('');
    setFrequency('');
    setOtherFrequencyDescription('');
    setSeverity('');
    setAffectedAreas('');
    setOtherAreasDescription('');

    setPestIdentified('');
    setOtherPestIdentifiedDescription('');
    setAssessmentDate(getTodayIsoDate());
    setAssessorName(defaultSalesperson);
    setAssessmentAffectedAreas('');
    setOtherAssessmentAreasDescription('');
    setRecommendedTreatment('');
    setOtherRecommendedTreatmentDescription('');
    setInfestationObservations(DEFAULT_ASSESSMENT_EXPLANATION);

    setQuotationNumber(generateUniqueDocumentNumber('GMP-Q', existingQuoteNumbers));
    setQuoteStatus('Draft');
    setLineItems([{ description: '', quantity: 1, unitPrice: 0, lineTotal: 0 }]);
    setQuoteNotes('');
    setSentDate('');

    setMessageEditedManually(false);
    setOpenedWhatsApp(false);
    setLogSuccess(null);
    setFormError(null);
    setFormSuccess(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Sync form fields when switching selected customer
  useEffect(() => {
    if (!activeCustomer) return;

    setFullName(activeCustomer.fullName);
    setPhoneRaw(activeCustomer.phoneRaw);
    setEmail(activeCustomer.email || '');
    setPropertyAddress(activeCustomer.propertyAddress);
    setSuburb(activeCustomer.suburb);
    setCustomerType(activeCustomer.category === 'Commercial' ? 'Commercial' : 'Residential');
    setSalespersonName(activeCustomer.salespersonName || defaultSalesperson);

    const d = activeCustomer.discovery || EMPTY_DISCOVERY;
    setPestType(d.pestCategories?.[0] || '');
    setOtherPestDescription(d.otherPestDescription || '');
    const savedWhere = (d.whereNoticed || '').trim();
    if (!savedWhere) {
      setWhereNoticed('');
      setOtherWhereDescription('');
    } else if (WHERE_APPEARING_OPTIONS.includes(savedWhere) && savedWhere !== 'Other') {
      setWhereNoticed(savedWhere);
      setOtherWhereDescription('');
    } else {
      setWhereNoticed('Other');
      setOtherWhereDescription(savedWhere === 'Other' ? '' : savedWhere);
    }

    const savedFreq = (d.frequency || '').trim();
    if (!savedFreq) {
      setFrequency('');
      setOtherFrequencyDescription('');
    } else if (FREQUENCY_OPTIONS.includes(savedFreq) && savedFreq !== 'Other') {
      setFrequency(savedFreq);
      setOtherFrequencyDescription('');
    } else {
      setFrequency('Other');
      setOtherFrequencyDescription(savedFreq === 'Other' ? '' : savedFreq);
    }

    setSeverity(d.severity || '');

    const savedAreas = (d.affectedAreas || '').trim();
    if (!savedAreas) {
      setAffectedAreas('');
      setOtherAreasDescription('');
    } else if (AREAS_AFFECTED_OPTIONS.includes(savedAreas) && savedAreas !== 'Other') {
      setAffectedAreas(savedAreas);
      setOtherAreasDescription('');
    } else {
      setAffectedAreas('Other');
      setOtherAreasDescription(savedAreas === 'Other' ? '' : savedAreas);
    }

    setMessageEditedManually(false);
    setFormError(null);
    setFormSuccess(null);
    setLogSuccess(null);
    setOpenedWhatsApp(false);
  }, [activeCustomer?.id]);

  // Sync assessment fields when customer or selectedAssessment changes
  useEffect(() => {
    if (!activeCustomer) return;
    if (activeAssessment) {
      const savedIdentified = (activeAssessment.pestIdentified || '').trim();
      if (!savedIdentified) {
        setPestIdentified('');
        setOtherPestIdentifiedDescription('');
      } else if (IDENTIFIED_PEST_OPTIONS.includes(savedIdentified) && savedIdentified !== 'Other') {
        setPestIdentified(savedIdentified);
        setOtherPestIdentifiedDescription('');
      } else {
        setPestIdentified('Other');
        setOtherPestIdentifiedDescription(savedIdentified === 'Other' ? '' : savedIdentified);
      }
      setAssessmentDate(activeAssessment.assessmentDate);
      setAssessorName(activeAssessment.assessorName);
      const savedAssAreas = (activeAssessment.affectedAreas || '').trim();
      if (!savedAssAreas) {
        setAssessmentAffectedAreas('');
        setOtherAssessmentAreasDescription('');
      } else if (AREAS_AFFECTED_OPTIONS.includes(savedAssAreas) && savedAssAreas !== 'Other') {
        setAssessmentAffectedAreas(savedAssAreas);
        setOtherAssessmentAreasDescription('');
      } else {
        setAssessmentAffectedAreas('Other');
        setOtherAssessmentAreasDescription(savedAssAreas === 'Other' ? '' : savedAssAreas);
      }
      const savedRec = (activeAssessment.recommendedTreatment || '').trim();
      if (!savedRec) {
        setRecommendedTreatment('');
        setOtherRecommendedTreatmentDescription('');
      } else if (RECOMMENDED_SERVICE_OPTIONS.includes(savedRec) && savedRec !== 'Other') {
        setRecommendedTreatment(savedRec);
        setOtherRecommendedTreatmentDescription('');
      } else {
        setRecommendedTreatment('Other');
        setOtherRecommendedTreatmentDescription(savedRec === 'Other' ? '' : savedRec);
      }
      setInfestationObservations(
        activeAssessment.infestationObservations || DEFAULT_ASSESSMENT_EXPLANATION
      );
    } else {
      const pestChoice = activeCustomer.discovery?.pestCategories?.[0] || '';
      if (!pestChoice) {
        setPestIdentified('');
        setOtherPestIdentifiedDescription('');
      } else if (IDENTIFIED_PEST_OPTIONS.includes(pestChoice) && pestChoice !== 'Other') {
        setPestIdentified(pestChoice);
        setOtherPestIdentifiedDescription('');
      } else {
        setPestIdentified('Other');
        setOtherPestIdentifiedDescription(
          activeCustomer.discovery?.otherPestDescription || (pestChoice === 'Other' ? '' : pestChoice)
        );
      }
      setAssessmentDate(getTodayIsoDate());
      setAssessorName(activeCustomer.salespersonName || defaultSalesperson);
      const discAreas = (activeCustomer.discovery?.affectedAreas || '').trim();
      if (!discAreas) {
        setAssessmentAffectedAreas('');
        setOtherAssessmentAreasDescription('');
      } else if (AREAS_AFFECTED_OPTIONS.includes(discAreas) && discAreas !== 'Other') {
        setAssessmentAffectedAreas(discAreas);
        setOtherAssessmentAreasDescription('');
      } else {
        setAssessmentAffectedAreas('Other');
        setOtherAssessmentAreasDescription(discAreas === 'Other' ? '' : discAreas);
      }
      setRecommendedTreatment('');
      setOtherRecommendedTreatmentDescription('');
      setInfestationObservations(DEFAULT_ASSESSMENT_EXPLANATION);
    }
  }, [activeCustomer?.id, activeAssessment?.id]);

  // Sync quotation fields when customer or selectedQuotation changes
  useEffect(() => {
    if (!activeCustomer) return;
    if (activeQuote) {
      setQuotationNumber(activeQuote.quotationNumber);
      const normalizedStatus: QuotationStatus = QUOTATION_STATUSES.includes(
        activeQuote.status as QuotationStatus
      )
        ? (activeQuote.status as QuotationStatus)
        : 'Sent';
      setQuoteStatus(normalizedStatus);
      setLineItems(
        activeQuote.lineItems?.length
          ? activeQuote.lineItems.map((item) => ({
              description: item.description,
              quantity: 1,
              unitPrice: roundCurrency(item.lineTotal),
              lineTotal: roundCurrency(item.lineTotal),
            }))
          : [{ description: '', quantity: 1, unitPrice: 0, lineTotal: 0 }]
      );
      setQuoteNotes(activeQuote.notes || '');
      setSentDate(activeQuote.sentDate || '');
    } else {
      setQuotationNumber(generateUniqueDocumentNumber('GMP-Q', existingQuoteNumbers));
      setQuoteStatus('Draft');
      setLineItems([{ description: '', quantity: 1, unitPrice: 0, lineTotal: 0 }]);
      setQuoteNotes('');
      setSentDate('');
    }
  }, [activeCustomer?.id, activeQuote?.id, creatingNewQuote]);

  const phoneCheck = useMemo(() => normalizeSouthAfricanPhone(phoneRaw), [phoneRaw]);

  const subtotal = useMemo(
    () =>
      roundCurrency(
        lineItems.reduce((sum, item) => sum + Math.max(0, Number(item.lineTotal) || 0), 0)
      ),
    [lineItems]
  );

  const resolvedFrequency =
    frequency === 'Other' ? otherFrequencyDescription.trim() : frequency;
  const resolvedAffectedAreas =
    affectedAreas === 'Other' ? otherAreasDescription.trim() : affectedAreas;
  const resolvedPestIdentified =
    pestIdentified === 'Other' ? otherPestIdentifiedDescription.trim() : pestIdentified;
  const resolvedAssessmentAreas =
    assessmentAffectedAreas === 'Other'
      ? otherAssessmentAreasDescription.trim()
      : assessmentAffectedAreas;
  const resolvedRecommendedTreatment =
    recommendedTreatment === 'Other'
      ? otherRecommendedTreatmentDescription.trim()
      : recommendedTreatment;

  // Live preview objects so WhatsApp Message on the same page updates instantaneously
  const liveCustomerPreview: CustomerRecord = useMemo(
    () => ({
      id: activeCustomer?.id || 'draft',
      ownerUid: activeCustomer?.ownerUid || user?.uid || '',
      fullName: fullName.trim() || '[Customer Name]',
      phoneRaw,
      phoneNormalized: phoneCheck.normalized,
      email,
      propertyAddress: propertyAddress.trim() || '[Property Address]',
      suburb: suburb.trim() || '[Area]',
      category: customerType,
      preferredContactMethod: 'WhatsApp',
      enquiryDate: activeCustomer?.enquiryDate || getTodayIsoDate(),
      salespersonName: salespersonName.trim() || defaultSalesperson,
      notes: '',
      discovery: {
        ...EMPTY_DISCOVERY,
        pestCategories: pestType ? [pestType] : [],
        otherPestDescription,
        whereNoticed:
          whereNoticed === 'Other' ? otherWhereDescription.trim() : whereNoticed,
        frequency: resolvedFrequency,
        severity,
        affectedAreas: resolvedAffectedAreas,
      },
      booking: activeCustomer?.booking || EMPTY_BOOKING,
    }),
    [
      activeCustomer,
      user?.uid,
      fullName,
      phoneRaw,
      phoneCheck.normalized,
      email,
      propertyAddress,
      suburb,
      customerType,
      salespersonName,
      defaultSalesperson,
      pestType,
      otherPestDescription,
      whereNoticed,
      otherWhereDescription,
      resolvedFrequency,
      severity,
      resolvedAffectedAreas,
    ]
  );

  const liveAssessmentPreview: AssessmentRecord | null = useMemo(() => {
    if (!resolvedPestIdentified && !resolvedRecommendedTreatment && !infestationObservations) return null;
    return {
      id: activeAssessment?.id || 'draft',
      ownerUid: user?.uid || '',
      customerId: activeCustomer?.id || 'draft',
      customerName: fullName.trim() || '[Customer Name]',
      assessmentDate,
      assessorName,
      pestIdentified: resolvedPestIdentified || pestType || 'Pest problem',
      infestationObservations,
      affectedAreas: resolvedAssessmentAreas || resolvedAffectedAreas,
      recommendedTreatment: resolvedRecommendedTreatment,
      treatmentMethod: '',
      proposedProducts: '',
      labourRequirements: '',
      safetyPrecautions: '',
      customerPreparation: '',
      aftercareInstructions: '',
      additionalRecommendations: '',
    };
  }, [
    activeAssessment?.id,
    activeCustomer?.id,
    user?.uid,
    fullName,
    assessmentDate,
    assessorName,
    resolvedPestIdentified,
    pestType,
    infestationObservations,
    resolvedAssessmentAreas,
    resolvedAffectedAreas,
    resolvedRecommendedTreatment,
  ]);

  const liveQuotationPreview: QuotationRecord | null = useMemo(() => {
    const validItems = lineItems.filter((i) => i.description.trim().length > 0);
    if (!validItems.length && !activeQuote) return null;
    return {
      id: activeQuote?.id || 'draft',
      ownerUid: user?.uid || '',
      customerId: activeCustomer?.id || 'draft',
      customerName: fullName.trim() || '[Customer Name]',
      customerPhone: phoneCheck.normalized,
      customerArea: suburb.trim() || '[Area]',
      customerAddress: propertyAddress.trim() || '[Property Address]',
      assessmentId: activeAssessment?.id || '',
      quotationNumber,
      status: quoteStatus,
      lineItems: validItems.length ? validItems : lineItems,
      labourCost: 0,
      materialsCost: 0,
      travelFee: 0,
      additionalServicesCost: 0,
      discountAmount: 0,
      vatApplicable: false,
      subtotal,
      vatAmount: 0,
      grandTotal: subtotal,
      notes: quoteNotes,
      customerApprovalName: activeQuote?.customerApprovalName || '',
      customerApprovalMethod: activeQuote?.customerApprovalMethod || '',
      customerApprovalDate: activeQuote?.customerApprovalDate || '',
      customerApprovalNotes: activeQuote?.customerApprovalNotes || '',
      sentDate,
    };
  }, [
    activeQuote,
    activeCustomer?.id,
    activeAssessment?.id,
    user?.uid,
    fullName,
    phoneCheck.normalized,
    suburb,
    propertyAddress,
    quotationNumber,
    quoteStatus,
    lineItems,
    subtotal,
    quoteNotes,
    sentDate,
  ]);

  // Keep WhatsApp message auto-synced unless salesperson manually edited it
  useEffect(() => {
    if (messageEditedManually) return;
    const generated = generateWhatsAppMessage({
      messageType: whatsAppType,
      customer: liveCustomerPreview,
      assessment: liveAssessmentPreview,
      quotation: liveQuotationPreview,
      company: companySettings,
      salespersonName: salespersonName.trim() || defaultSalesperson,
    });
    setMessageText(generated);
  }, [
    messageEditedManually,
    whatsAppType,
    liveCustomerPreview,
    liveAssessmentPreview,
    liveQuotationPreview,
    companySettings,
    salespersonName,
    defaultSalesperson,
  ]);

  const isSavedQuote = Boolean(activeQuote);
  const originalQuoteStatus = isSavedQuote ? activeQuote!.status : 'Draft';
  const isDraftEditable = !isSavedQuote || originalQuoteStatus === 'Draft' || isAdmin;
  const isTerminalLocked =
    isSavedQuote && (originalQuoteStatus === 'Approved' || originalQuoteStatus === 'Declined') && !isAdmin;

  const selectServiceTier = (index: number, tierName: string) => {
    setLineItems((prev) =>
      prev.map((item, idx) => {
        if (idx !== index) return item;
        const matchedTier = SERVICE_TIERS.find((t) => t.name === tierName);
        if (matchedTier) {
          return {
            description: matchedTier.name,
            quantity: 1,
            unitPrice: matchedTier.price,
            lineTotal: matchedTier.price,
          };
        }
        return {
          description: '',
          quantity: 1,
          unitPrice: 0,
          lineTotal: 0,
        };
      })
    );
  };

  const addServiceItem = () => {
    if (lineItems.length >= FIELD_LIMITS.lineItemsMax) return;
    setLineItems((prev) => [...prev, { description: '', quantity: 1, unitPrice: 0, lineTotal: 0 }]);
  };

  const removeServiceItem = (index: number) => {
    if (lineItems.length <= 1) return;
    setLineItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleStartNewQuote = () => {
    setCreatingNewQuote(true);
    setSelectedQuotationId(null);
    setQuotationNumber(generateUniqueDocumentNumber('GMP-Q', existingQuoteNumbers));
    setQuoteStatus('Draft');
    setLineItems([{ description: '', quantity: 1, unitPrice: 0, lineTotal: 0 }]);
    setQuoteNotes('');
    setSentDate('');
    setMessageEditedManually(false);
  };

  const handleCreateRevisedQuotation = () => {
    handleStartNewQuote();
    setLineItems(
      lineItems.map((i) => ({
        description: i.description,
        quantity: 1,
        unitPrice: i.lineTotal,
        lineTotal: i.lineTotal,
      }))
    );
    setQuoteNotes(quoteNotes);
    setFormSuccess('Created a new revised Draft quotation. Update items and click Save All.');
  };

  const handleCopyAccountNumber = async () => {
    try {
      await navigator.clipboard.writeText(GOMPOCO_PAYMENT_DETAILS.accountNumber);
      setCopiedAccountNumber(true);
      setTimeout(() => setCopiedAccountNumber(false), 1800);
    } catch {
      setFormError('Could not copy account number automatically.');
    }
  };

  // Unified Single-Page Save Handler
  const handleSaveAll = async (overrideQuoteStatus?: QuotationStatus) => {
    if (!user) return;
    setFormError(null);
    setFormSuccess(null);

    const trimmedName = fullName.trim().slice(0, FIELD_LIMITS.fullNameMax);
    const trimmedEmail = email.trim().slice(0, FIELD_LIMITS.emailMax);
    const trimmedAddress = propertyAddress.trim().slice(0, FIELD_LIMITS.addressMax);
    const trimmedSuburb = suburb.trim().slice(0, FIELD_LIMITS.suburbMax);
    const trimmedSalesperson = salespersonName.trim().slice(0, FIELD_LIMITS.salespersonMax);

    if (!trimmedName) {
      setFormError('Customer full name is required (Section 01).');
      return;
    }
    if (!phoneCheck.valid) {
      setFormError(phoneCheck.error || 'Enter a valid South African WhatsApp/mobile number.');
      return;
    }
    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setFormError('Enter a valid email address or leave it blank.');
      return;
    }
    if (!trimmedAddress) {
      setFormError('Property address is required (Section 01).');
      return;
    }
    if (!trimmedSuburb) {
      setFormError('Suburb / area is required (Section 01).');
      return;
    }
    if (!trimmedSalesperson) {
      setFormError('Salesperson name is required (Section 01).');
      return;
    }
    if (pestType === 'Other' && !otherPestDescription.trim()) {
      setFormError('Specify the pest type when "Other" is selected (Section 02).');
      return;
    }
    if (whereNoticed === 'Other' && !otherWhereDescription.trim()) {
      setFormError('Specify where pests are appearing when "Other" is selected (Section 02).');
      return;
    }
    if (frequency === 'Other' && !otherFrequencyDescription.trim()) {
      setFormError('Specify the frequency when "Other" is selected (Section 02).');
      return;
    }
    if (affectedAreas === 'Other' && !otherAreasDescription.trim()) {
      setFormError('Specify the areas affected when "Other" is selected (Section 02).');
      return;
    }
    if (pestIdentified === 'Other' && !otherPestIdentifiedDescription.trim()) {
      setFormError('Specify the identified pest problem when "Other" is selected (Section 03).');
      return;
    }
    if (assessmentAffectedAreas === 'Other' && !otherAssessmentAreasDescription.trim()) {
      setFormError('Specify the assessment areas observed when "Other" is selected (Section 03).');
      return;
    }
    if (recommendedTreatment === 'Other' && !otherRecommendedTreatmentDescription.trim()) {
      setFormError('Specify the recommended service when "Other" is selected (Section 03).');
      return;
    }

    const cleanedItems: QuotationLineItem[] = lineItems
      .map((item) => {
        const matchedTier = SERVICE_TIERS.find((t) => t.name === item.description.trim());
        const amount = matchedTier
          ? matchedTier.price
          : roundCurrency(Math.max(0, Number(item.lineTotal) || 0));
        return {
          description: item.description.trim().slice(0, FIELD_LIMITS.lineDescriptionMax),
          quantity: 1,
          unitPrice: amount,
          lineTotal: amount,
        };
      })
      .filter((item) => item.description.length > 0);

    if (overrideQuoteStatus && cleanedItems.length === 0) {
      setFormError('Select at least one service option (Lite, Regular, or Tuff) before updating quotation status.');
      return;
    }

    setSavingAll(true);
    try {
      // 1. Save / Update Customer & Pest Problem
      const baseDiscovery = activeCustomer?.discovery || EMPTY_DISCOVERY;
      const resolvedWhereNoticed =
        whereNoticed === 'Other' ? otherWhereDescription.trim() : whereNoticed.trim();
      const sanitizedDiscovery: PestDiscoveryData = {
        ...EMPTY_DISCOVERY,
        ...baseDiscovery,
        pestCategories: pestType ? [pestType] : [],
        otherPestDescription:
          pestType === 'Other'
            ? otherPestDescription.trim().slice(0, FIELD_LIMITS.shortTextMax)
            : '',
        whereNoticed: resolvedWhereNoticed.slice(0, FIELD_LIMITS.mediumTextMax),
        frequency: resolvedFrequency.slice(0, FIELD_LIMITS.shortTextMax),
        severity: severity.trim().slice(0, 80),
        affectedAreas: resolvedAffectedAreas.slice(0, FIELD_LIMITS.mediumTextMax),
      };

      let targetCustomerId = activeCustomer?.id || '';
      const customerOwnerUid = activeCustomer?.ownerUid || user.uid;

      if (!activeCustomer) {
        targetCustomerId = `cust_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        await setDoc(doc(db, 'customers', targetCustomerId), {
          ownerUid: customerOwnerUid,
          fullName: trimmedName,
          phoneRaw: phoneRaw.trim().slice(0, FIELD_LIMITS.phoneRawMax),
          phoneNormalized: phoneCheck.normalized,
          email: trimmedEmail,
          propertyAddress: trimmedAddress,
          suburb: trimmedSuburb,
          category: customerType,
          preferredContactMethod: 'WhatsApp',
          enquiryDate: getTodayIsoDate(),
          salespersonName: trimmedSalesperson,
          notes: '',
          discovery: sanitizedDiscovery,
          booking: {
            ...EMPTY_BOOKING,
            propertyAddress: trimmedAddress,
          },
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        onSelectCustomerId(targetCustomerId);
      } else {
        await updateDoc(doc(db, 'customers', targetCustomerId), {
          fullName: trimmedName,
          phoneRaw: phoneRaw.trim().slice(0, FIELD_LIMITS.phoneRawMax),
          phoneNormalized: phoneCheck.normalized,
          email: trimmedEmail,
          propertyAddress: trimmedAddress,
          suburb: trimmedSuburb,
          category: customerType,
          preferredContactMethod: activeCustomer.preferredContactMethod || 'WhatsApp',
          enquiryDate: activeCustomer.enquiryDate || getTodayIsoDate(),
          salespersonName: trimmedSalesperson,
          notes: activeCustomer.notes || '',
          discovery: sanitizedDiscovery,
          updatedAt: serverTimestamp(),
        });
      }

      // 2. Save / Update Assessment Details (when filled in or already exists)
      let targetAssessmentId = activeAssessment?.id || '';
      const hasAssessmentInput =
        Boolean(resolvedPestIdentified) ||
        Boolean(resolvedRecommendedTreatment) ||
        Boolean(infestationObservations.trim());

      if (hasAssessmentInput) {
        const resolvedPest =
          resolvedPestIdentified ||
          (pestType === 'Other' ? otherPestDescription.trim() : pestType) ||
          'Pest problem';
        const resolvedRec =
          resolvedRecommendedTreatment ||
          cleanedItems[0]?.description ||
          `${resolvedPest} treatment`;

        const assessPayload = {
          customerName: trimmedName,
          assessmentDate: assessmentDate || getTodayIsoDate(),
          assessorName: (assessorName.trim() || trimmedSalesperson).slice(
            0,
            FIELD_LIMITS.salespersonMax
          ),
          pestIdentified: resolvedPest.slice(0, FIELD_LIMITS.shortTextMax),
          infestationObservations: infestationObservations
            .trim()
            .slice(0, FIELD_LIMITS.assessmentTextMax),
          affectedAreas: (resolvedAssessmentAreas || resolvedAffectedAreas)
            .trim()
            .slice(0, FIELD_LIMITS.longTextMax),
          recommendedTreatment: resolvedRec.slice(0, FIELD_LIMITS.treatmentTextMax),
          treatmentMethod: activeAssessment?.treatmentMethod || '',
          proposedProducts: activeAssessment?.proposedProducts || '',
          labourRequirements: activeAssessment?.labourRequirements || '',
          safetyPrecautions: activeAssessment?.safetyPrecautions || '',
          customerPreparation: activeAssessment?.customerPreparation || '',
          aftercareInstructions: activeAssessment?.aftercareInstructions || '',
          additionalRecommendations: activeAssessment?.additionalRecommendations || '',
        };

        if (activeAssessment) {
          await updateDoc(doc(db, 'assessments', activeAssessment.id), {
            ...assessPayload,
            updatedAt: serverTimestamp(),
          });
        } else {
          targetAssessmentId = `assess_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
          await setDoc(doc(db, 'assessments', targetAssessmentId), {
            ...assessPayload,
            ownerUid: customerOwnerUid,
            customerId: targetCustomerId,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          setSelectedAssessmentId(targetAssessmentId);
        }
      }

      // 3. Save / Update Quotation (when service items exist or updating an existing quote)
      const nextQuoteStatus = overrideQuoteStatus || quoteStatus;
      if (cleanedItems.length > 0 && !isTerminalLocked) {
        const computedSubtotal = roundCurrency(
          cleanedItems.reduce((sum, item) => sum + item.lineTotal, 0)
        );
        const effectiveSentDate =
          nextQuoteStatus !== 'Draft' && !sentDate ? getTodayIsoDate() : sentDate;
        const effectiveOutcomeDate =
          (nextQuoteStatus === 'Approved' || nextQuoteStatus === 'Declined')
            ? activeQuote?.customerApprovalDate || getTodayIsoDate()
            : activeQuote?.customerApprovalDate || '';
        const preservedApprovalName = (activeQuote?.customerApprovalName || '').slice(
          0,
          FIELD_LIMITS.fullNameMax
        );
        const preservedApprovalNotes = (activeQuote?.customerApprovalNotes || '').slice(
          0,
          FIELD_LIMITS.longTextMax
        );
        const resolvedApprovalMethod =
          nextQuoteStatus === 'Approved' || nextQuoteStatus === 'Declined'
            ? 'Customer response'
            : activeQuote?.customerApprovalMethod || '';

        if (activeQuote && !creatingNewQuote) {
          if (originalQuoteStatus !== 'Draft' && !isAdmin) {
            await updateDoc(doc(db, 'quotations', activeQuote.id), {
              status: nextQuoteStatus,
              sentDate: effectiveSentDate,
              customerApprovalName: preservedApprovalName,
              customerApprovalMethod: resolvedApprovalMethod,
              customerApprovalDate: effectiveOutcomeDate,
              customerApprovalNotes: preservedApprovalNotes,
              updatedAt: serverTimestamp(),
            });
          } else {
            await updateDoc(doc(db, 'quotations', activeQuote.id), {
              customerName: trimmedName,
              customerPhone: phoneCheck.normalized,
              customerArea: trimmedSuburb,
              customerAddress: trimmedAddress,
              assessmentId: targetAssessmentId.slice(0, FIELD_LIMITS.idMax),
              status: nextQuoteStatus,
              lineItems: cleanedItems,
              labourCost: 0,
              materialsCost: 0,
              travelFee: 0,
              additionalServicesCost: 0,
              discountAmount: 0,
              vatApplicable: false,
              subtotal: computedSubtotal,
              vatAmount: 0,
              grandTotal: computedSubtotal,
              notes: quoteNotes.trim().slice(0, FIELD_LIMITS.notesMax),
              sentDate: effectiveSentDate,
              customerApprovalName: preservedApprovalName,
              customerApprovalMethod: resolvedApprovalMethod,
              customerApprovalDate: effectiveOutcomeDate,
              customerApprovalNotes: preservedApprovalNotes,
              updatedAt: serverTimestamp(),
            });
          }
          setQuoteStatus(nextQuoteStatus);
          setSentDate(effectiveSentDate);
        } else {
          const newQuoteId = `quote_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
          const qNum =
            quotationNumber || generateUniqueDocumentNumber('GMP-Q', existingQuoteNumbers);
          await setDoc(doc(db, 'quotations', newQuoteId), {
            ownerUid: customerOwnerUid,
            customerId: targetCustomerId,
            customerName: trimmedName,
            customerPhone: phoneCheck.normalized,
            customerArea: trimmedSuburb,
            customerAddress: trimmedAddress,
            assessmentId: targetAssessmentId.slice(0, FIELD_LIMITS.idMax),
            quotationNumber: qNum,
            status: nextQuoteStatus,
            lineItems: cleanedItems,
            labourCost: 0,
            materialsCost: 0,
            travelFee: 0,
            additionalServicesCost: 0,
            discountAmount: 0,
            vatApplicable: false,
            subtotal: computedSubtotal,
            vatAmount: 0,
            grandTotal: computedSubtotal,
            notes: quoteNotes.trim().slice(0, FIELD_LIMITS.notesMax),
            sentDate: effectiveSentDate,
            customerApprovalName: '',
            customerApprovalMethod:
              nextQuoteStatus === 'Approved' || nextQuoteStatus === 'Declined'
                ? 'Customer response'
                : '',
            customerApprovalDate:
              nextQuoteStatus === 'Approved' || nextQuoteStatus === 'Declined'
                ? getTodayIsoDate()
                : '',
            customerApprovalNotes: '',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          setCreatingNewQuote(false);
          setSelectedQuotationId(newQuoteId);
          setQuoteStatus(nextQuoteStatus);
          setSentDate(effectiveSentDate);
        }
      }

      setFormSuccess(
        `Saved all details for ${trimmedName}${
          cleanedItems.length > 0 ? ` · Quotation ${quotationNumber} (${nextQuoteStatus})` : ''
        }.`
      );
    } catch (err) {
      const msg = reportFirestoreWriteError(err, OperationType.WRITE, 'customers');
      setFormError(msg);
    } finally {
      setSavingAll(false);
    }
  };

  const canLaunchWhatsApp = phoneCheck.valid && messageText.trim().length > 0;
  const waUrl = canLaunchWhatsApp
    ? buildWhatsAppClickToChatUrl(phoneCheck.normalized, messageText)
    : '#';

  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(messageText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setFormError('Could not copy automatically. Select the message and copy manually.');
    }
  };

  const handleMarkWhatsAppSent = async () => {
    if (!user || !activeCustomer) {
      setFormError('Save the customer first before recording a WhatsApp message as sent.');
      return;
    }
    if (!phoneCheck.valid || !messageText.trim()) return;

    setLogSuccess(null);
    setFormError(null);
    setLoggingSent(true);
    try {
      const logId = `walog_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      await setDoc(doc(db, 'whatsappLogs', logId), {
        ownerUid: activeCustomer.ownerUid || user.uid,
        customerId: activeCustomer.id,
        customerName: activeCustomer.fullName.slice(0, FIELD_LIMITS.fullNameMax),
        recipientPhone: phoneCheck.normalized,
        messageType: whatsAppType,
        messageText: messageText.trim().slice(0, FIELD_LIMITS.whatsappMessageMax),
        notes: logNotes.trim().slice(0, FIELD_LIMITS.mediumTextMax),
        markedSentBy: (staffProfile?.displayName || user.displayName || 'Salesperson').slice(
          0,
          FIELD_LIMITS.salespersonMax
        ),
        createdAt: serverTimestamp(),
      });
      setLogNotes('');
      setOpenedWhatsApp(false);
      setLogSuccess(`Recorded "${whatsAppType}" as manually sent to +${phoneCheck.normalized}.`);
    } catch (err) {
      const msg = reportFirestoreWriteError(err, OperationType.CREATE, 'whatsappLogs');
      setFormError(msg);
    } finally {
      setLoggingSent(false);
    }
  };

  const filteredCustomers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const digitsOnly = q.replace(/\D/g, '');
    return customers.filter((cust) => {
      if (categoryFilter !== 'All' && cust.category !== categoryFilter) return false;
      if (!q) return true;
      const custQuotes = quotations.filter((qt) => qt.customerId === cust.id);
      return (
        cust.fullName.toLowerCase().includes(q) ||
        cust.suburb.toLowerCase().includes(q) ||
        cust.phoneRaw.toLowerCase().includes(q) ||
        cust.phoneNormalized.includes(q) ||
        (digitsOnly.length >= 3 && cust.phoneNormalized.includes(digitsOnly)) ||
        custQuotes.some((qt) => qt.quotationNumber.toLowerCase().includes(q))
      );
    });
  }, [customers, quotations, searchQuery, categoryFilter]);

  const loadCustomerIntoPage = (customerId: string, quotationId?: string) => {
    onSelectCustomerId(customerId);
    setSelectedAssessmentId(null);
    setSelectedQuotationId(quotationId || null);
    setCreatingNewQuote(false);
    setMessageEditedManually(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-10">
      {/* Top Context & Quick Switcher */}
      <div className="border border-black bg-neutral-50 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 no-print">
        <div className="min-w-0">
          <div className="text-[11px] font-bold uppercase tracking-wide text-neutral-600">
            Single-Page Sales &amp; Quotation Workspace
          </div>
          <div className="text-sm font-bold text-black truncate mt-0.5">
            {activeCustomer
              ? `Editing: ${activeCustomer.fullName} · ${activeCustomer.suburb} · +${activeCustomer.phoneNormalized}`
              : 'New Customer Enquiry'}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {customers.length > 0 && (
            <select
              aria-label="Load saved customer"
              value={activeCustomer?.id || ''}
              onChange={(e) => {
                if (e.target.value) {
                  loadCustomerIntoPage(e.target.value);
                } else {
                  resetAllToNewCustomer();
                }
              }}
              className="min-h-[40px] border border-black bg-white px-3 py-1.5 text-xs font-semibold text-black max-w-[220px]"
            >
              <option value="">-- New Customer --</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.fullName} ({c.suburb})
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={resetAllToNewCustomer}
            className="min-h-[40px] px-3.5 py-2 bg-[#FFFA2A] text-black border border-black text-xs font-bold flex items-center gap-1.5 hover:bg-yellow-300 cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>New Customer</span>
          </button>
        </div>
      </div>

      {/* Print Header */}
      <div className="hidden print-only border-b-2 border-black pb-4 mb-4">
        <div className="flex justify-between items-start">
          <div>
            <div className="text-2xl font-bold text-black">{companySettings.businessName}</div>
            <div className="text-xs font-semibold">{companySettings.slogan}</div>
            <div className="text-xs text-neutral-700 mt-1">{companySettings.address}</div>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold">QUOTATION</div>
            <div className="text-sm font-mono">{quotationNumber}</div>
            <div className="text-xs text-neutral-600 mt-1">Status: {quoteStatus}</div>
          </div>
        </div>
        <div className="mt-4 text-xs">
          <strong>Prepared for:</strong> {fullName} · {propertyAddress}, {suburb} ·{' '}
          {phoneCheck.valid ? `+${phoneCheck.normalized}` : phoneRaw}
        </div>
      </div>

      {/* Global Form Feedback */}
      {formError && (
        <div role="alert" className="border border-red-700 bg-red-50 p-3.5 text-sm text-red-900 no-print">
          {formError}
        </div>
      )}
      {formSuccess && (
        <div className="border border-black bg-[#FFFA2A]/35 p-3.5 text-sm text-black flex items-center gap-2 font-medium no-print">
          <Check className="w-4 h-4 shrink-0" />
          <span>{formSuccess}</span>
        </div>
      )}

      {/* UNIFIED ONE-PAGE FORM (Sections 01 to 04) */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSaveAll();
        }}
        className="space-y-10"
        noValidate
      >
        {/* SECTION 01: CUSTOMER INFORMATION */}
        <section id="sec-customer" className="space-y-4 scroll-mt-16">
          <div className="border-b border-black pb-2">
            <h2 className="text-lg font-bold text-black">01. Customer Information</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="sp-fullName" className="block text-sm font-semibold text-black mb-1">
                Customer full name <span className="text-red-700">*</span>
              </label>
              <input
                id="sp-fullName"
                type="text"
                required
                maxLength={FIELD_LIMITS.fullNameMax}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Thabo Mokoena"
                className="w-full min-h-[44px] border border-neutral-400 bg-white px-3.5 py-2 text-sm text-black focus:border-black focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="sp-phone" className="block text-sm font-semibold text-black mb-1">
                WhatsApp / mobile number <span className="text-red-700">*</span>
              </label>
              <input
                id="sp-phone"
                type="tel"
                required
                maxLength={FIELD_LIMITS.phoneRawMax}
                value={phoneRaw}
                onChange={(e) => setPhoneRaw(e.target.value)}
                placeholder="0821234567 or +27821234567"
                className="w-full min-h-[44px] border border-neutral-400 bg-white px-3.5 py-2 text-sm font-mono tabular-nums text-black focus:border-black focus:outline-none"
              />
              {phoneRaw.trim() === '' ? (
                <div className="mt-1 text-xs">
                  <span className="text-neutral-500">
                    Accepts 0821234567, 27821234567, or +27821234567
                  </span>
                </div>
              ) : !phoneCheck.valid ? (
                <div className="mt-1 text-xs">
                  <span className="text-red-700 font-medium">{phoneCheck.error}</span>
                </div>
              ) : null}
            </div>

            <div>
              <label htmlFor="sp-email" className="block text-sm font-semibold text-black mb-1">
                Email address (optional)
              </label>
              <input
                id="sp-email"
                type="email"
                maxLength={FIELD_LIMITS.emailMax}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="customer@example.co.za"
                className="w-full min-h-[44px] border border-neutral-400 bg-white px-3.5 py-2 text-sm text-black focus:border-black focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="sp-suburb" className="block text-sm font-semibold text-black mb-1">
                Suburb / area <span className="text-red-700">*</span>
              </label>
              <input
                id="sp-suburb"
                type="text"
                required
                maxLength={FIELD_LIMITS.suburbMax}
                value={suburb}
                onChange={(e) => setSuburb(e.target.value)}
                placeholder="e.g. Sandton / Randburg"
                className="w-full min-h-[44px] border border-neutral-400 bg-white px-3.5 py-2 text-sm text-black focus:border-black focus:outline-none"
              />
            </div>

            <div className="md:col-span-2">
              <label htmlFor="sp-address" className="block text-sm font-semibold text-black mb-1">
                Property address <span className="text-red-700">*</span>
              </label>
              <input
                id="sp-address"
                type="text"
                required
                maxLength={FIELD_LIMITS.addressMax}
                value={propertyAddress}
                onChange={(e) => setPropertyAddress(e.target.value)}
                placeholder="Street number, street name, unit or complex"
                className="w-full min-h-[44px] border border-neutral-400 bg-white px-3.5 py-2 text-sm text-black focus:border-black focus:outline-none"
              />
            </div>

            <div>
              <span className="block text-sm font-semibold text-black mb-1">
                Customer type <span className="text-red-700">*</span>
              </span>
              <div className="grid grid-cols-2 gap-2">
                {CUSTOMER_TYPES.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setCustomerType(type)}
                    className={`min-h-[44px] px-4 py-2 text-sm font-semibold border cursor-pointer ${
                      customerType === type
                        ? 'bg-black text-[#FFFA2A] border-black'
                        : 'bg-white text-black border-neutral-400 hover:border-black'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label
                htmlFor="sp-salesperson"
                className="block text-sm font-semibold text-black mb-1"
              >
                Salesperson name <span className="text-red-700">*</span>
              </label>
              <input
                id="sp-salesperson"
                type="text"
                required
                maxLength={FIELD_LIMITS.salespersonMax}
                value={salespersonName}
                onChange={(e) => setSalespersonName(e.target.value)}
                className="w-full min-h-[44px] border border-neutral-400 bg-white px-3.5 py-2 text-sm text-black focus:border-black focus:outline-none"
              />
            </div>
          </div>
        </section>

        {/* SECTION 02: PEST PROBLEM */}
        <section id="sec-pest" className="space-y-4 scroll-mt-16">
          <div className="border-b border-black pb-2">
            <h2 className="text-lg font-bold text-black">02. Pest Problem</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="sp-pest-type" className="block text-sm font-semibold text-black mb-1">
                Pest type
              </label>
              <select
                id="sp-pest-type"
                value={pestType}
                onChange={(e) => setPestType(e.target.value)}
                className="w-full min-h-[44px] border border-neutral-400 bg-white px-3.5 py-2 text-sm text-black focus:border-black focus:outline-none"
              >
                <option value="">Select pest type...</option>
                {PEST_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="sp-where" className="block text-sm font-semibold text-black mb-1">
                Where pests are appearing
              </label>
              <select
                id="sp-where"
                value={whereNoticed}
                onChange={(e) => setWhereNoticed(e.target.value)}
                className="w-full min-h-[44px] border border-neutral-400 bg-white px-3.5 py-2 text-sm text-black focus:border-black focus:outline-none"
              >
                <option value="">Select where pests are appearing...</option>
                {WHERE_APPEARING_OPTIONS.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
            </div>

            {pestType === 'Other' && (
              <div className="md:col-span-2">
                <label
                  htmlFor="sp-pest-other"
                  className="block text-sm font-semibold text-black mb-1"
                >
                  Specify other pest <span className="text-red-700">*</span>
                </label>
                <input
                  id="sp-pest-other"
                  type="text"
                  maxLength={FIELD_LIMITS.shortTextMax}
                  value={otherPestDescription}
                  onChange={(e) => setOtherPestDescription(e.target.value)}
                  placeholder="e.g. Wasps, fleas, silverfish"
                  className="w-full min-h-[44px] border border-neutral-400 bg-white px-3.5 py-2 text-sm text-black focus:border-black focus:outline-none"
                />
              </div>
            )}

            {whereNoticed === 'Other' && (
              <div className="md:col-span-2">
                <label
                  htmlFor="sp-where-other"
                  className="block text-sm font-semibold text-black mb-1"
                >
                  Specify where pests are appearing <span className="text-red-700">*</span>
                </label>
                <input
                  id="sp-where-other"
                  type="text"
                  maxLength={FIELD_LIMITS.mediumTextMax}
                  value={otherWhereDescription}
                  onChange={(e) => setOtherWhereDescription(e.target.value)}
                  placeholder="e.g. Basement server room, patio deck, warehouse racking"
                  className="w-full min-h-[44px] border border-neutral-400 bg-white px-3.5 py-2 text-sm text-black focus:border-black focus:outline-none"
                />
              </div>
            )}

            <div>
              <label htmlFor="sp-frequency" className="block text-sm font-semibold text-black mb-1">
                Frequency
              </label>
              <select
                id="sp-frequency"
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
                className="w-full min-h-[44px] border border-neutral-400 bg-white px-3.5 py-2 text-sm text-black focus:border-black focus:outline-none"
              >
                <option value="">Select frequency...</option>
                {FREQUENCY_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <span className="block text-sm font-semibold text-black mb-1">Severity</span>
              <div className="grid grid-cols-4 gap-1.5">
                {SEVERITY_OPTIONS.map((sev) => (
                  <button
                    key={sev}
                    type="button"
                    onClick={() => setSeverity(sev)}
                    className={`min-h-[44px] px-2 py-2 text-xs font-semibold border cursor-pointer ${
                      severity === sev
                        ? 'bg-black text-[#FFFA2A] border-black'
                        : 'bg-white text-black border-neutral-400 hover:border-black'
                    }`}
                  >
                    {sev}
                  </button>
                ))}
              </div>
            </div>

            {frequency === 'Other' && (
              <div className="md:col-span-2">
                <label
                  htmlFor="sp-frequency-other"
                  className="block text-sm font-semibold text-black mb-1"
                >
                  Specify frequency <span className="text-red-700">*</span>
                </label>
                <input
                  id="sp-frequency-other"
                  type="text"
                  maxLength={FIELD_LIMITS.shortTextMax}
                  value={otherFrequencyDescription}
                  onChange={(e) => setOtherFrequencyDescription(e.target.value)}
                  placeholder="e.g. Only after rain, every two weeks"
                  className="w-full min-h-[44px] border border-neutral-400 bg-white px-3.5 py-2 text-sm text-black focus:border-black focus:outline-none"
                />
              </div>
            )}

            <div className="md:col-span-2">
              <label htmlFor="sp-areas" className="block text-sm font-semibold text-black mb-1">
                Areas affected
              </label>
              <select
                id="sp-areas"
                value={affectedAreas}
                onChange={(e) => setAffectedAreas(e.target.value)}
                className="w-full min-h-[44px] border border-neutral-400 bg-white px-3.5 py-2 text-sm text-black focus:border-black focus:outline-none"
              >
                <option value="">Select areas affected...</option>
                {AREAS_AFFECTED_OPTIONS.map((areaOpt) => (
                  <option key={areaOpt} value={areaOpt}>
                    {areaOpt}
                  </option>
                ))}
              </select>
            </div>

            {affectedAreas === 'Other' && (
              <div className="md:col-span-2">
                <label
                  htmlFor="sp-areas-other"
                  className="block text-sm font-semibold text-black mb-1"
                >
                  Specify areas affected <span className="text-red-700">*</span>
                </label>
                <input
                  id="sp-areas-other"
                  type="text"
                  maxLength={FIELD_LIMITS.mediumTextMax}
                  value={otherAreasDescription}
                  onChange={(e) => setOtherAreasDescription(e.target.value)}
                  placeholder="e.g. Laundry room, staff canteen, loft storage"
                  className="w-full min-h-[44px] border border-neutral-400 bg-white px-3.5 py-2 text-sm text-black focus:border-black focus:outline-none"
                />
              </div>
            )}
          </div>
        </section>

        {/* SECTION 03: ASSESSMENT DETAILS */}
        <section id="sec-assessment" className="space-y-4 scroll-mt-16">
          <div className="border-b border-black pb-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <h2 className="text-lg font-bold text-black">03. Assessment Details</h2>
            <span className="text-xs font-bold bg-[#FFFA2A] border border-black px-2.5 py-1 text-black self-start sm:self-auto">
              The initial assessment is complimentary.
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label htmlFor="sp-ass-pest" className="block text-sm font-semibold text-black mb-1">
                Identified pest problem
              </label>
              <select
                id="sp-ass-pest"
                value={pestIdentified}
                onChange={(e) => setPestIdentified(e.target.value)}
                className="w-full min-h-[44px] border border-neutral-400 bg-white px-3.5 py-2 text-sm text-black focus:border-black focus:outline-none"
              >
                <option value="">Select identified pest problem...</option>
                {IDENTIFIED_PEST_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            {pestIdentified === 'Other' && (
              <div className="md:col-span-2">
                <label
                  htmlFor="sp-ass-pest-other"
                  className="block text-sm font-semibold text-black mb-1"
                >
                  Specify identified pest problem <span className="text-red-700">*</span>
                </label>
                <input
                  id="sp-ass-pest-other"
                  type="text"
                  maxLength={FIELD_LIMITS.shortTextMax}
                  value={otherPestIdentifiedDescription}
                  onChange={(e) => setOtherPestIdentifiedDescription(e.target.value)}
                  placeholder="e.g. German cockroach activity in kitchen cupboards"
                  className="w-full min-h-[44px] border border-neutral-400 bg-white px-3.5 py-2 text-sm text-black focus:border-black focus:outline-none"
                />
              </div>
            )}

            <div>
              <label htmlFor="sp-ass-date" className="block text-sm font-semibold text-black mb-1">
                Assessment date
              </label>
              <input
                id="sp-ass-date"
                type="date"
                value={assessmentDate}
                onChange={(e) => setAssessmentDate(e.target.value)}
                className="w-full min-h-[44px] border border-neutral-400 bg-white px-3.5 py-2 text-sm font-mono tabular-nums text-black focus:border-black focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="sp-ass-name" className="block text-sm font-semibold text-black mb-1">
                Assessor name
              </label>
              <input
                id="sp-ass-name"
                type="text"
                maxLength={FIELD_LIMITS.salespersonMax}
                value={assessorName}
                onChange={(e) => setAssessorName(e.target.value)}
                className="w-full min-h-[44px] border border-neutral-400 bg-white px-3.5 py-2 text-sm text-black focus:border-black focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="sp-ass-areas" className="block text-sm font-semibold text-black mb-1">
                Assessment areas observed
              </label>
              <select
                id="sp-ass-areas"
                value={assessmentAffectedAreas}
                onChange={(e) => setAssessmentAffectedAreas(e.target.value)}
                className="w-full min-h-[44px] border border-neutral-400 bg-white px-3.5 py-2 text-sm text-black focus:border-black focus:outline-none"
              >
                <option value="">Select assessment areas observed...</option>
                {AREAS_AFFECTED_OPTIONS.map((areaOpt) => (
                  <option key={areaOpt} value={areaOpt}>
                    {areaOpt}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="sp-ass-rec" className="block text-sm font-semibold text-black mb-1">
                Recommended service
              </label>
              <select
                id="sp-ass-rec"
                value={recommendedTreatment}
                onChange={(e) => setRecommendedTreatment(e.target.value)}
                className="w-full min-h-[44px] border border-neutral-400 bg-white px-3.5 py-2 text-sm text-black focus:border-black focus:outline-none"
              >
                <option value="">Select recommended service...</option>
                {RECOMMENDED_SERVICE_OPTIONS.map((recOpt) => (
                  <option key={recOpt} value={recOpt}>
                    {recOpt}
                  </option>
                ))}
              </select>
            </div>

            {assessmentAffectedAreas === 'Other' && (
              <div className="md:col-span-2">
                <label
                  htmlFor="sp-ass-areas-other"
                  className="block text-sm font-semibold text-black mb-1"
                >
                  Specify assessment areas observed <span className="text-red-700">*</span>
                </label>
                <input
                  id="sp-ass-areas-other"
                  type="text"
                  maxLength={FIELD_LIMITS.longTextMax}
                  value={otherAssessmentAreasDescription}
                  onChange={(e) => setOtherAssessmentAreasDescription(e.target.value)}
                  placeholder="Areas inspected on site"
                  className="w-full min-h-[44px] border border-neutral-400 bg-white px-3.5 py-2 text-sm text-black focus:border-black focus:outline-none"
                />
              </div>
            )}

            {recommendedTreatment === 'Other' && (
              <div className="md:col-span-2">
                <label
                  htmlFor="sp-ass-rec-other"
                  className="block text-sm font-semibold text-black mb-1"
                >
                  Specify recommended service <span className="text-red-700">*</span>
                </label>
                <input
                  id="sp-ass-rec-other"
                  type="text"
                  maxLength={FIELD_LIMITS.treatmentTextMax}
                  value={otherRecommendedTreatmentDescription}
                  onChange={(e) => setOtherRecommendedTreatmentDescription(e.target.value)}
                  placeholder="e.g. Interior gel baiting & exterior perimeter spray"
                  className="w-full min-h-[44px] border border-neutral-400 bg-white px-3.5 py-2 text-sm text-black focus:border-black focus:outline-none"
                />
              </div>
            )}

            <div className="md:col-span-2">
              <label htmlFor="sp-ass-obs" className="block text-sm font-semibold text-black mb-1">
                Short explanation of proposed work &amp; assessment findings
              </label>
              <textarea
                id="sp-ass-obs"
                rows={3}
                maxLength={FIELD_LIMITS.assessmentTextMax}
                value={infestationObservations}
                onChange={(e) => setInfestationObservations(e.target.value)}
                className="w-full border border-neutral-400 bg-white px-3.5 py-2 text-sm text-black focus:border-black focus:outline-none"
              />
            </div>
          </div>
        </section>

        {/* SECTION 04: QUOTATION BUILDER */}
        <section id="sec-quotation" className="space-y-4 scroll-mt-16">
          <div className="border-b border-black pb-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 no-print">
            <h2 className="text-lg font-bold text-black">04. Quotation Builder</h2>
            <div className="flex flex-wrap gap-2">
              {customerQuotations.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    if (creatingNewQuote) {
                      setCreatingNewQuote(false);
                    } else {
                      handleStartNewQuote();
                    }
                  }}
                  className="min-h-[38px] px-3 py-1.5 bg-white text-black border border-black text-xs font-semibold hover:bg-neutral-100 cursor-pointer"
                >
                  {creatingNewQuote ? 'View Saved Quote' : '+ New Quotation'}
                </button>
              )}
              <button
                type="button"
                onClick={() => window.print()}
                className="min-h-[38px] px-3 py-1.5 bg-white text-black border border-black text-xs font-semibold flex items-center gap-1.5 hover:bg-neutral-100 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print</span>
              </button>
            </div>
          </div>

          {customerQuotations.length > 0 && !creatingNewQuote && (
            <div className="flex flex-wrap items-center gap-2 border border-neutral-300 p-3 bg-neutral-50 no-print">
              <span className="text-xs font-semibold text-neutral-700">Customer Quotations:</span>
              {customerQuotations.map((q) => (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => {
                    setSelectedQuotationId(q.id);
                    setCreatingNewQuote(false);
                    setMessageEditedManually(false);
                  }}
                  className={`min-h-[36px] px-3 py-1 text-xs font-semibold border cursor-pointer font-mono tabular-nums ${
                    activeQuote?.id === q.id
                      ? 'bg-black text-[#FFFA2A] border-black'
                      : 'bg-white text-black border-neutral-400 hover:border-black'
                  }`}
                >
                  {q.quotationNumber} · {q.status} · {formatZAR(q.grandTotal)}
                </button>
              ))}
            </div>
          )}

          {isSavedQuote && originalQuoteStatus !== 'Draft' && (
            <div className="border border-black bg-neutral-100 p-3.5 text-xs sm:text-sm text-black flex flex-wrap items-center justify-between gap-3 no-print">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 shrink-0" />
                <span>
                  Quotation <strong>{quotationNumber}</strong> is <strong>{originalQuoteStatus}</strong>.
                  Editing service items requires a revised quotation.
                </span>
              </div>
              <button
                type="button"
                onClick={handleCreateRevisedQuotation}
                className="min-h-[38px] px-3.5 py-1.5 bg-[#FFFA2A] text-black border border-black text-xs font-bold flex items-center gap-1.5 hover:bg-yellow-300 cursor-pointer"
              >
                <CopyPlus className="w-3.5 h-3.5" />
                <span>Create Revised Quotation</span>
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 no-print">
            <div>
              <label htmlFor="sp-qnum" className="block text-xs font-semibold text-black mb-1">
                Quotation number
              </label>
              <input
                id="sp-qnum"
                type="text"
                readOnly
                value={quotationNumber}
                className="w-full min-h-[44px] border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm font-mono tabular-nums text-black"
              />
            </div>

            <div>
              <label htmlFor="sp-qstatus" className="block text-xs font-semibold text-black mb-1">
                Quotation status
              </label>
              <select
                id="sp-qstatus"
                disabled={isTerminalLocked}
                value={quoteStatus}
                onChange={(e) => setQuoteStatus(e.target.value as QuotationStatus)}
                className="w-full min-h-[44px] border border-neutral-400 bg-white px-3 py-2 text-sm font-semibold text-black disabled:bg-neutral-100"
              >
                {QUOTATION_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wide text-black">
                Service Items
              </span>
              {isDraftEditable && (
                <button
                  type="button"
                  onClick={addServiceItem}
                  className="min-h-[38px] px-3 py-1.5 bg-white text-black border border-black text-xs font-semibold flex items-center gap-1.5 hover:bg-neutral-100 cursor-pointer no-print"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Service Item</span>
                </button>
              )}
            </div>

            <div className="border border-neutral-300 divide-y divide-neutral-300">
              {lineItems.map((item, idx) => {
                const isLegacyCustomItem =
                  Boolean(item.description) &&
                  !SERVICE_TIERS.some((tier) => tier.name === item.description);
                return (
                  <div
                    key={idx}
                    className="p-3 grid grid-cols-1 sm:grid-cols-12 gap-3 items-end bg-white"
                  >
                    <div className="sm:col-span-8">
                      <label
                        htmlFor={`sp-service-tier-${idx}`}
                        className="block text-xs font-semibold text-neutral-700 mb-1"
                      >
                        Service option
                      </label>
                      <select
                        id={`sp-service-tier-${idx}`}
                        disabled={!isDraftEditable}
                        value={item.description}
                        onChange={(e) => selectServiceTier(idx, e.target.value)}
                        className="w-full min-h-[44px] border border-neutral-400 bg-white px-3 py-2 text-sm text-black disabled:bg-neutral-100 focus:border-black focus:outline-none"
                      >
                        <option value="">Select service option...</option>
                        {SERVICE_TIERS.map((tier) => (
                          <option key={tier.name} value={tier.name}>
                            {tier.name} — {formatZAR(tier.price)}
                          </option>
                        ))}
                        {isLegacyCustomItem && (
                          <option value={item.description}>
                            {item.description} — {formatZAR(item.lineTotal)}
                          </option>
                        )}
                      </select>
                    </div>
                    <div className="sm:col-span-3">
                      <label className="block text-xs font-semibold text-neutral-700 mb-1">
                        Price (ZAR)
                      </label>
                      <input
                        type="text"
                        readOnly
                        tabIndex={-1}
                        aria-label={`Price for service item ${idx + 1}`}
                        value={formatZAR(item.lineTotal)}
                        className="w-full min-h-[44px] border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm font-mono tabular-nums font-semibold text-black select-none"
                      />
                    </div>
                    <div className="sm:col-span-1 flex justify-end no-print">
                      {isDraftEditable && lineItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeServiceItem(idx)}
                          aria-label="Remove service item"
                          className="min-h-[44px] min-w-[44px] flex items-center justify-center border border-neutral-300 text-neutral-700 hover:text-red-700 hover:border-red-700 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="border border-black bg-neutral-50 p-4 flex items-center justify-between">
              <span className="text-sm sm:text-base font-bold text-black">Quotation Total (ZAR)</span>
              <span className="text-lg sm:text-xl font-bold font-mono tabular-nums text-black">
                {formatZAR(subtotal)}
              </span>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label htmlFor="sp-qnotes" className="block text-sm font-semibold text-black mb-1">
                Additional scope notes (optional)
              </label>
              <input
                id="sp-qnotes"
                type="text"
                disabled={!isDraftEditable}
                maxLength={FIELD_LIMITS.notesMax}
                value={quoteNotes}
                onChange={(e) => setQuoteNotes(e.target.value)}
                placeholder="Additional scope notes or preparation instructions"
                className="w-full min-h-[44px] border border-neutral-400 bg-white px-3.5 py-2 text-sm text-black disabled:bg-neutral-100"
              />
            </div>

            {/* Payment Instructions & Next Steps (on generated quotation & print) */}
            <div className="border border-black bg-neutral-50 p-4 space-y-3">
              <div className="border-b border-neutral-300 pb-2">
                <h3 className="text-sm font-bold text-black uppercase tracking-wide">
                  Payment Instructions &amp; Next Steps
                </h3>
                <p className="text-sm text-black mt-1">{GOMPOCO_PAYMENT_DETAILS.intro}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="space-y-1.5">
                  <div className="text-xs font-bold uppercase tracking-wide text-neutral-700">
                    Gompoco Banking Details
                  </div>
                  <dl className="space-y-1 text-xs sm:text-sm">
                    <div className="flex justify-between gap-2">
                      <dt className="text-neutral-600">Bank:</dt>
                      <dd className="font-semibold text-black">{GOMPOCO_PAYMENT_DETAILS.bank}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-neutral-600">Account Holder:</dt>
                      <dd className="font-semibold text-black">
                        {GOMPOCO_PAYMENT_DETAILS.accountHolder}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-neutral-600">Account Type:</dt>
                      <dd className="font-semibold text-black">
                        {GOMPOCO_PAYMENT_DETAILS.accountType}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <dt className="text-neutral-600">Account Number:</dt>
                      <dd className="flex items-center gap-2">
                        <span className="font-mono tabular-nums font-bold text-black">
                          {GOMPOCO_PAYMENT_DETAILS.accountNumber}
                        </span>
                        <button
                          type="button"
                          onClick={handleCopyAccountNumber}
                          className="min-h-[28px] px-2 py-0.5 bg-white border border-black text-[11px] font-semibold flex items-center gap-1 hover:bg-[#FFFA2A] cursor-pointer no-print"
                        >
                          <Copy className="w-3 h-3" />
                          <span>{copiedAccountNumber ? 'Copied' : 'Copy'}</span>
                        </button>
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-neutral-600">Branch Code:</dt>
                      <dd className="font-mono tabular-nums font-semibold text-black">
                        {GOMPOCO_PAYMENT_DETAILS.branchCode}
                      </dd>
                    </div>
                  </dl>
                </div>

                <div className="space-y-1.5 border-t md:border-t-0 md:border-l border-neutral-300 pt-3 md:pt-0 md:pl-4">
                  <div className="text-xs font-bold uppercase tracking-wide text-neutral-700">
                    Proof of Payment (POP)
                  </div>
                  <p className="text-xs sm:text-sm font-medium text-black">
                    {GOMPOCO_PAYMENT_DETAILS.popInstruction}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* UNIFIED SUBMIT BAR */}
          <div className="border-t-2 border-black pt-5 flex flex-wrap gap-3 no-print">
            <button
              type="submit"
              disabled={savingAll}
              className="min-h-[48px] px-6 py-3 bg-[#FFFA2A] text-black border border-black font-bold text-sm hover:bg-yellow-300 transition-colors disabled:opacity-60 cursor-pointer"
            >
              {savingAll
                ? 'Saving...'
                : activeCustomer
                ? 'Save All Updates'
                : 'Save Customer, Assessment & Quotation'}
            </button>

            {!isTerminalLocked && (
              <>
                {originalQuoteStatus === 'Draft' && (
                  <button
                    type="button"
                    disabled={savingAll}
                    onClick={() => handleSaveAll('Sent')}
                    className="min-h-[48px] px-4 py-3 bg-black text-white text-sm font-semibold hover:bg-neutral-800 cursor-pointer"
                  >
                    Save &amp; Mark Quote Sent
                  </button>
                )}
                <button
                  type="button"
                  disabled={savingAll}
                  onClick={() => handleSaveAll('Approved')}
                  className="min-h-[48px] px-4 py-3 bg-white text-black border border-black text-sm font-semibold hover:bg-neutral-100 cursor-pointer"
                >
                  Mark Approved
                </button>
                <button
                  type="button"
                  disabled={savingAll}
                  onClick={() => handleSaveAll('Declined')}
                  className="min-h-[48px] px-4 py-3 bg-white text-black border border-black text-sm font-semibold hover:bg-neutral-100 cursor-pointer"
                >
                  Mark Declined
                </button>
              </>
            )}
          </div>
        </section>
      </form>

      {/* SECTION 05: WHATSAPP MESSAGE (Live on the Same Page) */}
      <section id="sec-whatsapp" className="space-y-4 border-t-2 border-black pt-8 scroll-mt-16 no-print">
        <div className="border-b border-black pb-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-black">05. WhatsApp Message</h2>
            <p className="text-xs text-neutral-600">
              Automatically reflects the details above. Review or edit before opening WhatsApp.
            </p>
          </div>
          <div className="text-xs font-mono tabular-nums text-black">
            {phoneCheck.valid ? `Target: +${phoneCheck.normalized}` : 'Valid SA number needed'}
          </div>
        </div>

        {!phoneCheck.valid && (
          <div className="border border-red-700 bg-red-50 p-3.5 text-xs text-red-900 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>
              Enter a valid South African phone number in Section 01 to enable Open WhatsApp.
            </span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div className="sm:w-72">
            <label htmlFor="sp-wa-type" className="block text-xs font-semibold text-black mb-1">
              Message template
            </label>
            <select
              id="sp-wa-type"
              value={whatsAppType}
              onChange={(e) => {
                setWhatsAppType(e.target.value as WhatsAppMessageType);
                setMessageEditedManually(false);
              }}
              className="w-full min-h-[42px] border border-neutral-400 bg-white px-3 py-2 text-sm text-black"
            >
              {WHATSAPP_MESSAGE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          {messageEditedManually && (
            <button
              type="button"
              onClick={() => setMessageEditedManually(false)}
              className="min-h-[42px] px-3.5 py-2 bg-white text-black border border-black text-xs font-semibold hover:bg-neutral-100 cursor-pointer self-start sm:self-auto"
            >
              Sync Message from Form Again
            </button>
          )}
        </div>

        <textarea
          aria-label="WhatsApp message composer"
          rows={11}
          maxLength={FIELD_LIMITS.whatsappMessageMax}
          value={messageText}
          onChange={(e) => {
            setMessageEditedManually(true);
            setMessageText(e.target.value);
          }}
          className="w-full border border-black bg-white p-4 text-sm text-black leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#FFFA2A]"
        />

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleCopyMessage}
            disabled={!messageText.trim()}
            className="min-h-[48px] px-5 py-3 bg-white text-black border border-black text-sm font-semibold flex items-center gap-2 hover:bg-neutral-100 disabled:opacity-50 cursor-pointer"
          >
            <Copy className="w-4 h-4" />
            <span>{copied ? 'Copied' : 'Copy Message'}</span>
          </button>

          {canLaunchWhatsApp ? (
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpenedWhatsApp(true)}
              className="min-h-[48px] px-6 py-3 bg-[#FFFA2A] text-black border border-black text-sm font-bold flex items-center gap-2 hover:bg-yellow-300"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Open WhatsApp</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          ) : (
            <button
              type="button"
              disabled
              className="min-h-[48px] px-6 py-3 bg-neutral-200 text-neutral-500 border border-neutral-300 text-sm font-bold flex items-center gap-2 cursor-not-allowed"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Open WhatsApp</span>
            </button>
          )}
        </div>

        {/* Manual Sent Logging */}
        <div className="border border-black bg-neutral-50 p-4 space-y-3">
          <div className="text-sm font-bold text-black">Record WhatsApp Status Manually</div>
          <p className="text-xs text-neutral-700">
            Messages are never marked sent automatically. Record below only after you press Send in
            WhatsApp.
          </p>
          {openedWhatsApp && (
            <div className="text-xs font-semibold text-black bg-[#FFFA2A]/40 border border-black px-3 py-2">
              WhatsApp opened for +{phoneCheck.normalized}. Record below once sent.
            </div>
          )}
          {logSuccess && (
            <div className="text-xs font-semibold text-black bg-[#FFFA2A]/40 border border-black px-3 py-2 flex items-center gap-2">
              <Check className="w-3.5 h-3.5" />
              <span>{logSuccess}</span>
            </div>
          )}
          <div className="flex flex-col sm:flex-row gap-2.5">
            <input
              type="text"
              maxLength={FIELD_LIMITS.mediumTextMax}
              value={logNotes}
              onChange={(e) => setLogNotes(e.target.value)}
              placeholder="Optional note (e.g. Sent quotation on WhatsApp)"
              className="flex-1 min-h-[44px] border border-neutral-400 bg-white px-3 py-2 text-sm text-black"
            />
            <button
              type="button"
              disabled={loggingSent || !activeCustomer || !canLaunchWhatsApp}
              onClick={handleMarkWhatsAppSent}
              className="min-h-[44px] px-5 py-2.5 bg-black text-white text-xs sm:text-sm font-semibold hover:bg-neutral-800 disabled:opacity-50 cursor-pointer whitespace-nowrap"
            >
              {loggingSent
                ? 'Recording...'
                : !activeCustomer
                ? 'Save Customer First to Log'
                : 'Mark Message as Sent'}
            </button>
          </div>
        </div>

        {/* Communication History for Active Customer */}
        {activeCustomer && (
          <div className="space-y-2">
            <h3 className="text-sm font-bold text-black">
              Communication History for {activeCustomer.fullName} ({customerLogs.length})
            </h3>
            {customerLogs.length === 0 ? (
              <p className="text-xs text-neutral-600">No messages recorded as sent yet.</p>
            ) : (
              <div className="divide-y divide-neutral-200 border border-neutral-300 bg-white">
                {customerLogs.map((log) => (
                  <div key={log.id} className="p-3 space-y-1 text-xs">
                    <div className="flex justify-between font-bold text-black">
                      <span>{log.messageType}</span>
                      <span className="font-mono tabular-nums text-neutral-600">
                        +{log.recipientPhone} ·{' '}
                        {log.createdAt?.toDate
                          ? log.createdAt.toDate().toLocaleString('en-ZA')
                          : 'Recorded'}
                      </span>
                    </div>
                    <div className="text-neutral-700 whitespace-pre-line line-clamp-3">
                      {log.messageText}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* SECTION 06: SAVED CUSTOMER RECORDS & QUOTATIONS */}
      <section id="sec-records" className="space-y-4 border-t-2 border-black pt-8 scroll-mt-16 no-print">
        <div className="border-b border-black pb-2">
          <h2 className="text-lg font-bold text-black">
            06. Saved Customer Records &amp; Quotations ({customers.length})
          </h2>
          <p className="text-xs text-neutral-600">
            Search and click any customer or quotation to load all details into the form above.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by customer name, mobile number, suburb, or GMP-Q-..."
              className="w-full min-h-[44px] border border-black bg-white pl-10 pr-3.5 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-[#FFFA2A]"
            />
          </div>
          <div className="flex gap-1.5">
            {(['All', 'Residential', 'Commercial'] as const).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={`min-h-[44px] px-3.5 py-2 text-xs font-semibold border cursor-pointer whitespace-nowrap ${
                  categoryFilter === cat
                    ? 'bg-black text-[#FFFA2A] border-black'
                    : 'bg-white text-black border-neutral-400 hover:border-black'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {dataLoading ? (
          <div className="border border-neutral-300 p-4 text-sm text-neutral-600">
            Loading saved customer records...
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="border border-neutral-300 p-4 text-sm text-neutral-600">
            {customers.length === 0
              ? 'No customer records saved yet. Fill in Section 01 above and click Save.'
              : 'No customer records matched your search.'}
          </div>
        ) : (
          <div className="border border-neutral-300 divide-y divide-neutral-200 bg-white">
            {filteredCustomers.map((cust) => {
              const isSelected = activeCustomer?.id === cust.id;
              const custQuotes = quotations.filter((q) => q.customerId === cust.id);
              const custAssess = assessments.filter((a) => a.customerId === cust.id);
              const custLogs = whatsappLogs.filter((l) => l.customerId === cust.id);
              const pestLabel =
                cust.discovery?.pestCategories?.[0] === 'Other' &&
                cust.discovery?.otherPestDescription
                  ? cust.discovery.otherPestDescription
                  : cust.discovery?.pestCategories?.[0] || 'Not recorded';

              return (
                <div
                  key={cust.id}
                  className={`p-4 space-y-2 ${isSelected ? 'bg-[#FFFA2A]/20' : 'bg-white'}`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                      <div className="font-bold text-sm text-black">
                        {cust.fullName}{' '}
                        <span className="font-normal text-xs text-neutral-600">
                          · {cust.category} · {cust.suburb} · +{cust.phoneNormalized}
                        </span>
                      </div>
                      <div className="text-xs text-neutral-700 mt-0.5">
                        Pest: {pestLabel} · Assessments: {custAssess.length} · Messages logged:{' '}
                        {custLogs.length} · Salesperson: {cust.salespersonName}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => loadCustomerIntoPage(cust.id)}
                      className="min-h-[38px] px-3.5 py-1.5 bg-black text-white text-xs font-semibold hover:bg-neutral-800 cursor-pointer shrink-0 self-start sm:self-auto"
                    >
                      {isSelected ? 'Loaded Above' : 'Load Customer'}
                    </button>
                  </div>

                  {custQuotes.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {custQuotes.map((q) => (
                        <button
                          key={q.id}
                          type="button"
                          onClick={() => loadCustomerIntoPage(cust.id, q.id)}
                          className="min-h-[34px] px-2.5 py-1 border border-black bg-white text-xs font-mono tabular-nums text-black hover:bg-[#FFFA2A]/40 cursor-pointer"
                        >
                          {q.quotationNumber} · {q.status} · {formatZAR(q.grandTotal)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
