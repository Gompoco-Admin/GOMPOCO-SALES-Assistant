import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import {
  auth,
  db,
  handleFirestoreError,
  OperationType,
  signInWithGooglePopup,
  signOutUser,
  testConnection,
} from '@/src/firebase/client';
import {
  AssessmentRecord,
  CompanySettings,
  CustomerRecord,
  DEFAULT_COMPANY_SETTINGS,
  FIELD_LIMITS,
  InvoiceRecord,
  QuotationRecord,
  StaffMember,
  WhatsAppLogRecord,
} from '@/src/types/gompoco';

const BOOTSTRAP_ADMIN_EMAIL = 'admin.gompoco@gmail.com';

interface AuthContextValue {
  user: User | null;
  staffProfile: StaffMember | null;
  isAdmin: boolean;
  isBootstrappedAdmin: boolean;
  authReady: boolean;
  dataLoading: boolean;
  connectionOffline: boolean;
  quotaError: string | null;
  companySettings: CompanySettings;
  customers: CustomerRecord[];
  assessments: AssessmentRecord[];
  quotations: QuotationRecord[];
  invoices: InvoiceRecord[];
  whatsappLogs: WhatsAppLogRecord[];
  staffList: StaffMember[];
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  clearQuotaError: () => void;
  reportFirestoreWriteError: (error: unknown, op: OperationType, path: string) => string;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function extractReadableError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  if (raw.includes('Quota exceeded')) {
    return 'Daily Firestore free-tier quota exceeded. Quota resets tomorrow; check Firebase Spark/Enterprise limits in the Firebase console.';
  }
  return raw;
}

export function FirebaseProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [staffProfile, setStaffProfile] = useState<StaffMember | null>(null);
  const [hasAdminDoc, setHasAdminDoc] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [staffReady, setStaffReady] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);
  const [connectionOffline, setConnectionOffline] = useState(false);
  const [quotaError, setQuotaError] = useState<string | null>(null);
  const [fatalError, setFatalError] = useState<Error | null>(null);

  const [companySettings, setCompanySettings] = useState<CompanySettings>({
    ...DEFAULT_COMPANY_SETTINGS,
    updatedBy: 'system',
  });
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [assessments, setAssessments] = useState<AssessmentRecord[]>([]);
  const [quotations, setQuotations] = useState<QuotationRecord[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [whatsappLogs, setWhatsappLogs] = useState<WhatsAppLogRecord[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);

  if (fatalError) {
    throw fatalError;
  }

  useEffect(() => {
    testConnection().then((res) => {
      if (res.offlineError) {
        setConnectionOffline(true);
      }
    });
  }, []);

  const isBootstrappedAdmin =
    Boolean(user?.emailVerified) && user?.email?.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL;

  const isAdmin = isBootstrappedAdmin || hasAdminDoc || staffProfile?.role === 'admin';

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      setStaffReady(false);

      if (!nextUser) {
        setStaffProfile(null);
        setHasAdminDoc(false);
        setCustomers([]);
        setAssessments([]);
        setQuotations([]);
        setInvoices([]);
        setWhatsappLogs([]);
        setStaffList([]);
        setAuthReady(true);
        return;
      }

      if (!nextUser.emailVerified) {
        setStaffProfile(null);
        setAuthReady(true);
        return;
      }

      try {
        const staffRef = doc(db, 'staff', nextUser.uid);
        const snap = await getDoc(staffRef);

        if (!snap.exists()) {
          const isBootAdmin = nextUser.email?.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL;
          const displayName = (
            nextUser.displayName ||
            nextUser.email?.split('@')[0] ||
            'Gompoco Staff'
          ).slice(0, FIELD_LIMITS.salespersonMax);

          const payload = {
            uid: nextUser.uid,
            email: (nextUser.email || '').slice(0, FIELD_LIMITS.emailMax),
            displayName,
            role: isBootAdmin ? 'admin' : 'salesperson',
            active: true,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          };
          await setDoc(staffRef, payload);
          setStaffProfile({
            uid: payload.uid,
            email: payload.email,
            displayName: payload.displayName,
            role: payload.role as 'admin' | 'salesperson',
            active: true,
          });
        } else {
          setStaffProfile(snap.data() as StaffMember);
        }

        // Check admin grant doc
        try {
          const adminSnap = await getDoc(doc(db, 'admins', nextUser.uid));
          setHasAdminDoc(adminSnap.exists());
        } catch {
          setHasAdminDoc(false);
        }

        setStaffReady(true);
      } catch (err) {
        const msg = extractReadableError(err);
        if (msg.includes('quota')) {
          setQuotaError(msg);
        } else {
          try {
            handleFirestoreError(err, OperationType.GET, `staff/${nextUser.uid}`);
          } catch (wrapped) {
            setFatalError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
          }
        }
      } finally {
        setAuthReady(true);
      }
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    if (!authReady || !staffReady || !user || !user.emailVerified) return;
    if (staffProfile && !staffProfile.active && !isBootstrappedAdmin) return;

    setDataLoading(true);
    const unsubs: (() => void)[] = [];

    const captureSnapshotError = (err: unknown, path: string) => {
      const msg = extractReadableError(err);
      if (msg.includes('quota')) {
        setQuotaError(msg);
        setDataLoading(false);
        return;
      }
      try {
        handleFirestoreError(err, OperationType.LIST, path);
      } catch (wrapped) {
        setFatalError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    };

    // Staff self listener (and full staff list for bootstrapped admin)
    if (isBootstrappedAdmin) {
      unsubs.push(
        onSnapshot(
          collection(db, 'staff'),
          (snap) => {
            const list = snap.docs.map((d) => d.data() as StaffMember);
            list.sort((a, b) => a.displayName.localeCompare(b.displayName));
            setStaffList(list);
          },
          (err) => captureSnapshotError(err, 'staff')
        )
      );
    } else {
      unsubs.push(
        onSnapshot(
          doc(db, 'staff', user.uid),
          (snap) => {
            if (snap.exists()) {
              setStaffProfile(snap.data() as StaffMember);
            }
          },
          (err) => captureSnapshotError(err, `staff/${user.uid}`)
        )
      );
    }

    // Company settings
    unsubs.push(
      onSnapshot(
        doc(db, 'settings', 'company'),
        (snap) => {
          if (snap.exists()) {
            setCompanySettings(snap.data() as CompanySettings);
          }
        },
        (err) => captureSnapshotError(err, 'settings/company')
      )
    );

    const buildScopedQuery = (colName: string) => {
      const colRef = collection(db, colName);
      return isBootstrappedAdmin ? colRef : query(colRef, where('ownerUid', '==', user.uid));
    };

    unsubs.push(
      onSnapshot(
        buildScopedQuery('customers'),
        (snap) => {
          const rows = snap.docs.map((d) => ({ ...(d.data() as CustomerRecord), id: d.id }));
          rows.sort((a, b) => {
            const ta = a.updatedAt?.toMillis?.() || 0;
            const tb = b.updatedAt?.toMillis?.() || 0;
            return tb - ta;
          });
          setCustomers(rows);
          setDataLoading(false);
        },
        (err) => captureSnapshotError(err, 'customers')
      )
    );

    unsubs.push(
      onSnapshot(
        buildScopedQuery('assessments'),
        (snap) => {
          const rows = snap.docs.map((d) => ({ ...(d.data() as AssessmentRecord), id: d.id }));
          rows.sort((a, b) => {
            const ta = a.createdAt?.toMillis?.() || 0;
            const tb = b.createdAt?.toMillis?.() || 0;
            return tb - ta;
          });
          setAssessments(rows);
        },
        (err) => captureSnapshotError(err, 'assessments')
      )
    );

    unsubs.push(
      onSnapshot(
        buildScopedQuery('quotations'),
        (snap) => {
          const rows = snap.docs.map((d) => ({ ...(d.data() as QuotationRecord), id: d.id }));
          rows.sort((a, b) => {
            const ta = a.createdAt?.toMillis?.() || 0;
            const tb = b.createdAt?.toMillis?.() || 0;
            return tb - ta;
          });
          setQuotations(rows);
        },
        (err) => captureSnapshotError(err, 'quotations')
      )
    );

    unsubs.push(
      onSnapshot(
        buildScopedQuery('invoices'),
        (snap) => {
          const rows = snap.docs.map((d) => ({ ...(d.data() as InvoiceRecord), id: d.id }));
          rows.sort((a, b) => {
            const ta = a.createdAt?.toMillis?.() || 0;
            const tb = b.createdAt?.toMillis?.() || 0;
            return tb - ta;
          });
          setInvoices(rows);
        },
        (err) => captureSnapshotError(err, 'invoices')
      )
    );

    unsubs.push(
      onSnapshot(
        buildScopedQuery('whatsappLogs'),
        (snap) => {
          const rows = snap.docs.map((d) => ({ ...(d.data() as WhatsAppLogRecord), id: d.id }));
          rows.sort((a, b) => {
            const ta = a.createdAt?.toMillis?.() || 0;
            const tb = b.createdAt?.toMillis?.() || 0;
            return tb - ta;
          });
          setWhatsappLogs(rows);
        },
        (err) => captureSnapshotError(err, 'whatsappLogs')
      )
    );

    return () => {
      unsubs.forEach((fn) => fn());
    };
  }, [authReady, staffReady, user, isBootstrappedAdmin, staffProfile?.active]);

  const signIn = useCallback(async () => {
    await signInWithGooglePopup();
  }, []);

  const signOut = useCallback(async () => {
    await signOutUser();
  }, []);

  const clearQuotaError = useCallback(() => setQuotaError(null), []);

  const reportFirestoreWriteError = useCallback(
    (error: unknown, op: OperationType, path: string): string => {
      const msg = extractReadableError(error);
      if (msg.includes('quota')) {
        setQuotaError(msg);
        return msg;
      }
      try {
        handleFirestoreError(error, op, path);
      } catch (wrapped) {
        return wrapped instanceof Error ? wrapped.message : msg;
      }
      return msg;
    },
    []
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        staffProfile,
        isAdmin,
        isBootstrappedAdmin,
        authReady,
        dataLoading,
        connectionOffline,
        quotaError,
        companySettings,
        customers,
        assessments,
        quotations,
        invoices,
        whatsappLogs,
        staffList,
        signIn,
        signOut,
        clearQuotaError,
        reportFirestoreWriteError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAppData(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAppData must be used inside FirebaseProvider.');
  }
  return ctx;
}
