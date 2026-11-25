import React, { useEffect, useMemo, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { AlertTriangle, ArrowLeft, Check, Lock, Search, Shield, Trash2, Unlock } from 'lucide-react';
import { db, OperationType } from '@/src/firebase/client';
import { useAppData } from '@/src/context/AuthContext';
import { CompanySettings, StaffMember, StaffRole } from '@/src/types/gompoco';
import { formatZAR } from '@/src/utils/calculations';

interface AdminDashboardViewProps {
  unlocked: boolean;
  onUnlock: () => void;
  onLockAndExit: () => void;
  onSelectCustomerInSales: (customerId: string) => void;
  onDataCleared?: () => void;
}

export function AdminDashboardView({
  unlocked,
  onUnlock,
  onLockAndExit,
  onSelectCustomerInSales,
  onDataCleared,
}: AdminDashboardViewProps) {
  const {
    user,
    isAdmin,
    isBootstrappedAdmin,
    customers,
    assessments,
    quotations,
    invoices,
    whatsappLogs,
    staffList,
    companySettings,
    reportFirestoreWriteError,
  } = useAppData();

  const [adminSearch, setAdminSearch] = useState('');
  const [bizForm, setBizForm] = useState<Omit<CompanySettings, 'updatedBy' | 'updatedAt'>>(
    companySettings
  );
  const [savingSettings, setSavingSettings] = useState(false);
  const [confirmResetText, setConfirmResetText] = useState('');
  const [clearingDb, setClearingDb] = useState(false);
  const [confirmDeleteCustomerId, setConfirmDeleteCustomerId] = useState<string | null>(null);
  const [deletingCustomerId, setDeletingCustomerId] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setBizForm({
      businessName: companySettings.businessName,
      slogan: companySettings.slogan,
      phone: companySettings.phone,
      email: companySettings.email,
      address: companySettings.address,
      vatNumber: companySettings.vatNumber,
      bankName: companySettings.bankName,
      accountHolder: companySettings.accountHolder,
      accountNumber: companySettings.accountNumber,
      branchCode: companySettings.branchCode,
      paymentTerms: companySettings.paymentTerms,
    });
  }, [companySettings]);

  const filteredAllCustomers = useMemo(() => {
    const q = adminSearch.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) => {
      const custQuotes = quotations.filter((qt) => qt.customerId === c.id);
      return (
        c.fullName.toLowerCase().includes(q) ||
        c.suburb.toLowerCase().includes(q) ||
        c.salespersonName.toLowerCase().includes(q) ||
        c.phoneNormalized.includes(q.replace(/\D/g, '') || '__none__') ||
        custQuotes.some((qt) => qt.quotationNumber.toLowerCase().includes(q))
      );
    });
  }, [customers, quotations, adminSearch]);

  if (!isAdmin) {
    return (
      <div className="max-w-lg mx-auto my-12 border border-black bg-white p-6 space-y-4">
        <div className="flex items-center gap-2 font-bold text-black">
          <Lock className="w-5 h-5" />
          <span>Administrator Access Required</span>
        </div>
        <p className="text-sm text-neutral-700">
          This area is restricted to Gompoco administrators.
        </p>
        <button
          type="button"
          onClick={onLockAndExit}
          className="min-h-[44px] px-5 py-2.5 bg-black text-white text-sm font-semibold cursor-pointer"
        >
          Return to Sales Workspace
        </button>
      </div>
    );
  }

  // Explicit Admin Gate before exposing company-wide records, staff controls, and company settings
  if (!unlocked) {
    return (
      <div className="max-w-lg mx-auto my-10 border border-black bg-white p-6 sm:p-8 space-y-5">
        <div className="inline-flex items-center gap-2 bg-[#FFFA2A] border border-black px-3 py-1 text-xs font-bold uppercase tracking-wide text-black">
          <Shield className="w-3.5 h-3.5" />
          <span>Restricted Admin Gate</span>
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-bold text-black">Gompoco Administrator Dashboard</h1>
          <p className="text-sm text-neutral-700 leading-relaxed">
            You are signed in with verified administrator credentials (
            <span className="font-mono text-black">{user?.email}</span>). Unlocking this gate
            provides access to all company customer records, staff role controls, and Gompoco
            company settings.
          </p>
        </div>

        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="button"
            onClick={onUnlock}
            className="min-h-[48px] px-5 py-3 bg-[#FFFA2A] text-black border border-black text-sm font-bold flex items-center gap-2 hover:bg-yellow-300 cursor-pointer"
          >
            <Unlock className="w-4 h-4" />
            <span>Unlock Admin Dashboard</span>
          </button>

          <button
            type="button"
            onClick={onLockAndExit}
            className="min-h-[48px] px-5 py-3 bg-white text-black border border-black text-sm font-semibold flex items-center gap-2 hover:bg-neutral-100 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Sales Page</span>
          </button>
        </div>
      </div>
    );
  }

  const handleSaveCompanySettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setErrorMsg(null);
    setStatusMsg(null);
    setSavingSettings(true);
    try {
      await setDoc(doc(db, 'settings', 'company'), {
        businessName: (bizForm.businessName || 'Gompoco').trim().slice(0, 120),
        slogan: bizForm.slogan.trim().slice(0, 160),
        phone: bizForm.phone.trim().slice(0, 32),
        email: bizForm.email.trim().slice(0, 254),
        address: bizForm.address.trim().slice(0, 300),
        vatNumber: bizForm.vatNumber.trim().slice(0, 40),
        bankName: bizForm.bankName.trim().slice(0, 100),
        accountHolder: bizForm.accountHolder.trim().slice(0, 120),
        accountNumber: bizForm.accountNumber.trim().slice(0, 40),
        branchCode: bizForm.branchCode.trim().slice(0, 30),
        paymentTerms: bizForm.paymentTerms.trim().slice(0, 500),
        updatedBy: user.uid,
        updatedAt: serverTimestamp(),
      });
      setStatusMsg('Company details saved.');
    } catch (err) {
      const msg = reportFirestoreWriteError(err, OperationType.WRITE, 'settings/company');
      setErrorMsg(msg);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleToggleStaffActive = async (member: StaffMember) => {
    setErrorMsg(null);
    setStatusMsg(null);
    try {
      await updateDoc(doc(db, 'staff', member.uid), {
        active: !member.active,
        updatedAt: serverTimestamp(),
      });
      setStatusMsg(`Updated access for ${member.displayName}.`);
    } catch (err) {
      const msg = reportFirestoreWriteError(err, OperationType.UPDATE, `staff/${member.uid}`);
      setErrorMsg(msg);
    }
  };

  const handleChangeStaffRole = async (member: StaffMember, nextRole: StaffRole) => {
    if (!user) return;
    setErrorMsg(null);
    setStatusMsg(null);
    try {
      await updateDoc(doc(db, 'staff', member.uid), {
        role: nextRole,
        updatedAt: serverTimestamp(),
      });
      if (nextRole === 'admin') {
        await setDoc(doc(db, 'admins', member.uid), {
          uid: member.uid,
          email: member.email,
          grantedBy: user.uid,
          createdAt: serverTimestamp(),
        });
      } else {
        await deleteDoc(doc(db, 'admins', member.uid));
      }
      setStatusMsg(`Updated role for ${member.displayName} to ${nextRole}.`);
    } catch (err) {
      const msg = reportFirestoreWriteError(err, OperationType.UPDATE, `staff/${member.uid}`);
      setErrorMsg(msg);
    }
  };

  const commitDeleteRefs = async (refs: ReturnType<typeof doc>[]) => {
    for (let i = 0; i < refs.length; i += 400) {
      const batch = writeBatch(db);
      refs.slice(i, i + 400).forEach((ref) => batch.delete(ref));
      await batch.commit();
    }
  };

  const handleDeleteSingleCustomer = async (customerId: string, customerName: string) => {
    if (!user || !isAdmin) return;
    setErrorMsg(null);
    setStatusMsg(null);
    setDeletingCustomerId(customerId);
    try {
      const refsToDelete: ReturnType<typeof doc>[] = [];

      for (const l of whatsappLogs.filter((x) => x.customerId === customerId)) {
        refsToDelete.push(doc(db, 'whatsappLogs', l.id));
      }
      for (const inv of invoices.filter((x) => x.customerId === customerId)) {
        refsToDelete.push(doc(db, 'invoices', inv.id));
      }
      for (const q of quotations.filter((x) => x.customerId === customerId)) {
        refsToDelete.push(doc(db, 'quotations', q.id));
      }
      for (const a of assessments.filter((x) => x.customerId === customerId)) {
        const attQuery = isBootstrappedAdmin
          ? collection(db, 'assessments', a.id, 'attachments')
          : query(
              collection(db, 'assessments', a.id, 'attachments'),
              where('ownerUid', '==', user.uid)
            );
        const attSnap = await getDocs(attQuery);
        attSnap.docs.forEach((d) => refsToDelete.push(d.ref));
        refsToDelete.push(doc(db, 'assessments', a.id));
      }
      refsToDelete.push(doc(db, 'customers', customerId));

      await commitDeleteRefs(refsToDelete);
      setConfirmDeleteCustomerId(null);
      onDataCleared?.();
      setStatusMsg(`Deleted ${customerName} and all linked records.`);
    } catch (err) {
      const msg = reportFirestoreWriteError(err, OperationType.DELETE, `customers/${customerId}`);
      setErrorMsg(msg);
    } finally {
      setDeletingCustomerId(null);
    }
  };

  const handleClearAllDatabase = async () => {
    if (!user || !isBootstrappedAdmin) return;
    if (confirmResetText.trim().toUpperCase() !== 'RESET') {
      setErrorMsg('Type RESET in the confirmation box to clear all database records.');
      return;
    }

    setErrorMsg(null);
    setStatusMsg(null);
    setClearingDb(true);
    try {
      const refsToDelete: ReturnType<typeof doc>[] = [];

      const logsSnap = await getDocs(collection(db, 'whatsappLogs'));
      logsSnap.docs.forEach((d) => refsToDelete.push(d.ref));

      const invSnap = await getDocs(collection(db, 'invoices'));
      invSnap.docs.forEach((d) => refsToDelete.push(d.ref));

      const quoteSnap = await getDocs(collection(db, 'quotations'));
      quoteSnap.docs.forEach((d) => refsToDelete.push(d.ref));

      const assessSnap = await getDocs(collection(db, 'assessments'));
      for (const aDoc of assessSnap.docs) {
        const attSnap = await getDocs(collection(db, 'assessments', aDoc.id, 'attachments'));
        attSnap.docs.forEach((d) => refsToDelete.push(d.ref));
        refsToDelete.push(aDoc.ref);
      }

      const custSnap = await getDocs(collection(db, 'customers'));
      custSnap.docs.forEach((d) => refsToDelete.push(d.ref));

      await commitDeleteRefs(refsToDelete);
      setConfirmResetText('');
      onDataCleared?.();
      setStatusMsg(
        `Database cleared (${refsToDelete.length} record${
          refsToDelete.length === 1 ? '' : 's'
        } removed). Ready to start from zero.`
      );
    } catch (err) {
      const msg = reportFirestoreWriteError(err, OperationType.DELETE, 'customers');
      setErrorMsg(msg);
    } finally {
      setClearingDb(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-8">
      <div className="border-b border-black pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="text-xs font-bold uppercase tracking-wide text-neutral-600">
            Administrator Dashboard
          </div>
          <h1 className="text-2xl font-bold text-black">
            Company Records, Staff Access &amp; Settings
          </h1>
        </div>
        <button
          type="button"
          onClick={onLockAndExit}
          className="min-h-[44px] px-4 py-2 bg-black text-[#FFFA2A] text-xs font-bold flex items-center gap-2 hover:bg-neutral-900 cursor-pointer self-start sm:self-auto"
        >
          <Lock className="w-3.5 h-3.5" />
          <span>Lock Admin &amp; Return to Sales Page</span>
        </button>
      </div>

      {errorMsg && (
        <div role="alert" className="border border-red-700 bg-red-50 p-3.5 text-sm text-red-900">
          {errorMsg}
        </div>
      )}

      {statusMsg && (
        <div className="border border-black bg-[#FFFA2A]/30 p-3.5 text-sm text-black flex items-center gap-2 font-medium">
          <Check className="w-4 h-4 shrink-0" />
          <span>{statusMsg}</span>
        </div>
      )}

      {/* Summary Counts */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        <div className="border border-black p-3.5">
          <div className="text-xs text-neutral-600">Total Customers</div>
          <div className="text-xl font-bold font-mono tabular-nums mt-0.5">{customers.length}</div>
        </div>
        <div className="border border-black p-3.5">
          <div className="text-xs text-neutral-600">Total Quotations</div>
          <div className="text-xl font-bold font-mono tabular-nums mt-0.5">
            {quotations.length}
          </div>
        </div>
        <div className="border border-black p-3.5">
          <div className="text-xs text-neutral-600">Approved Quotes</div>
          <div className="text-xl font-bold font-mono tabular-nums mt-0.5">
            {quotations.filter((q) => q.status === 'Approved').length}
          </div>
        </div>
        <div className="border border-black p-3.5">
          <div className="text-xs text-neutral-600">Staff Accounts</div>
          <div className="text-xl font-bold font-mono tabular-nums mt-0.5">{staffList.length}</div>
        </div>
      </div>

      {/* All Company Customer Records */}
      <section className="border border-black p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h2 className="text-base font-bold text-black">All Customer &amp; Quotation Records</h2>
          <div className="relative sm:w-80">
            <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={adminSearch}
              onChange={(e) => setAdminSearch(e.target.value)}
              placeholder="Search customer, salesperson, or GMP-Q-..."
              className="w-full min-h-[40px] border border-neutral-400 pl-9 pr-3 py-1.5 text-xs text-black"
            />
          </div>
        </div>

        {filteredAllCustomers.length === 0 ? (
          <p className="text-sm text-neutral-600">No customer records found.</p>
        ) : (
          <div className="divide-y divide-neutral-200 border border-neutral-300 max-h-96 overflow-y-auto">
            {filteredAllCustomers.map((cust) => {
              const custQuotes = quotations.filter((q) => q.customerId === cust.id);
              return (
                <div
                  key={cust.id}
                  className="p-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs"
                >
                  <div className="space-y-0.5">
                    <div className="font-bold text-sm text-black">
                      {cust.fullName}{' '}
                      <span className="font-normal text-neutral-600">({cust.category})</span>
                    </div>
                    <div className="text-neutral-700">
                      {cust.suburb} · +{cust.phoneNormalized} · Salesperson: {cust.salespersonName}
                    </div>
                    {custQuotes.length > 0 && (
                      <div className="font-mono text-black">
                        {custQuotes
                          .map((q) => `${q.quotationNumber} (${q.status}) ${formatZAR(q.grandTotal)}`)
                          .join(' | ')}
                      </div>
                    )}
                  </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0 self-start sm:self-auto">
                      <button
                        type="button"
                        onClick={() => onSelectCustomerInSales(cust.id)}
                        className="min-h-[38px] px-3 py-1.5 border border-black bg-white text-black font-semibold hover:bg-neutral-100 cursor-pointer"
                      >
                        Open in Sales Page
                      </button>
                      {confirmDeleteCustomerId === cust.id ? (
                        <>
                          <button
                            type="button"
                            disabled={deletingCustomerId === cust.id}
                            onClick={() => handleDeleteSingleCustomer(cust.id, cust.fullName)}
                            className="min-h-[38px] px-3 py-1.5 border border-red-700 bg-red-700 text-white font-semibold hover:bg-red-800 cursor-pointer"
                          >
                            {deletingCustomerId === cust.id ? 'Deleting...' : 'Confirm Delete'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteCustomerId(null)}
                            className="min-h-[38px] px-2.5 py-1.5 border border-neutral-400 bg-white text-black font-semibold hover:bg-neutral-100 cursor-pointer"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteCustomerId(cust.id)}
                          aria-label={`Delete ${cust.fullName}`}
                          className="min-h-[38px] px-2.5 py-1.5 border border-neutral-300 bg-white text-neutral-700 hover:border-red-700 hover:text-red-700 cursor-pointer flex items-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

      {/* Staff Access Management */}
      {isBootstrappedAdmin && (
        <section className="border border-black p-5 space-y-4">
          <h2 className="text-base font-bold text-black">
            Staff Access &amp; Role Management ({staffList.length})
          </h2>
          <div className="divide-y divide-neutral-200 border border-neutral-300">
            {staffList.map((member) => (
              <div
                key={member.uid}
                className="p-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
              >
                <div>
                  <div className="text-sm font-bold text-black">{member.displayName}</div>
                  <div className="text-xs text-neutral-600">
                    {member.email} · Role: {member.role} · {member.active ? 'Active' : 'Suspended'}
                  </div>
                </div>
                {member.email.toLowerCase() !== 'admin.gompoco@gmail.com' && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        handleChangeStaffRole(
                          member,
                          member.role === 'admin' ? 'salesperson' : 'admin'
                        )
                      }
                      className="min-h-[38px] px-3 py-1.5 border border-black text-xs font-semibold bg-white hover:bg-neutral-100 cursor-pointer"
                    >
                      {member.role === 'admin' ? 'Set Salesperson' : 'Promote to Admin'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleStaffActive(member)}
                      className="min-h-[38px] px-3 py-1.5 border border-black text-xs font-semibold bg-white hover:bg-neutral-100 cursor-pointer"
                    >
                      {member.active ? 'Suspend Access' : 'Restore Access'}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Company Settings */}
      <form onSubmit={handleSaveCompanySettings} className="border border-black p-5 space-y-4">
        <h2 className="text-base font-bold text-black">Gompoco Company Details</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-black mb-1">Business name</label>
            <input
              type="text"
              required
              maxLength={120}
              value={bizForm.businessName}
              onChange={(e) => setBizForm({ ...bizForm, businessName: e.target.value })}
              className="w-full min-h-[44px] border border-neutral-400 px-3 py-2 text-sm text-black"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-black mb-1">Slogan</label>
            <input
              type="text"
              maxLength={160}
              value={bizForm.slogan}
              onChange={(e) => setBizForm({ ...bizForm, slogan: e.target.value })}
              className="w-full min-h-[44px] border border-neutral-400 px-3 py-2 text-sm text-black"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-black mb-1">Contact phone</label>
            <input
              type="text"
              maxLength={32}
              value={bizForm.phone}
              onChange={(e) => setBizForm({ ...bizForm, phone: e.target.value })}
              className="w-full min-h-[44px] border border-neutral-400 px-3 py-2 text-sm font-mono text-black"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-black mb-1">Contact email</label>
            <input
              type="email"
              maxLength={254}
              value={bizForm.email}
              onChange={(e) => setBizForm({ ...bizForm, email: e.target.value })}
              className="w-full min-h-[44px] border border-neutral-400 px-3 py-2 text-sm text-black"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-black mb-1">Business address</label>
            <input
              type="text"
              maxLength={300}
              value={bizForm.address}
              onChange={(e) => setBizForm({ ...bizForm, address: e.target.value })}
              className="w-full min-h-[44px] border border-neutral-400 px-3 py-2 text-sm text-black"
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={savingSettings}
          className="min-h-[44px] px-5 py-2.5 bg-[#FFFA2A] text-black border border-black text-sm font-bold hover:bg-yellow-300 cursor-pointer"
        >
          {savingSettings ? 'Saving...' : 'Save Company Details'}
        </button>
      </form>

      {/* Clear App Database (Start from Zero) */}
      {isBootstrappedAdmin && (
        <section className="border-2 border-red-700 bg-red-50/40 p-5 space-y-4">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-red-700 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h2 className="text-base font-bold text-black">
                Clear App Database (Start from Zero)
              </h2>
              <p className="text-xs sm:text-sm text-neutral-700">
                Permanently deletes all customer records ({customers.length}), assessments (
                {assessments.length}), quotations ({quotations.length}), invoices ({invoices.length}
                ), and WhatsApp logs ({whatsappLogs.length}) from Firestore. Staff accounts and
                company settings remain intact.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-end gap-3">
            <div className="flex-1 max-w-xs">
              <label
                htmlFor="admin-reset-confirm"
                className="block text-xs font-semibold text-black mb-1"
              >
                Type <span className="font-mono font-bold">RESET</span> to confirm
              </label>
              <input
                id="admin-reset-confirm"
                type="text"
                value={confirmResetText}
                onChange={(e) => setConfirmResetText(e.target.value)}
                placeholder="RESET"
                className="w-full min-h-[44px] border border-red-700 bg-white px-3 py-2 text-sm font-mono text-black focus:outline-none"
              />
            </div>

            <button
              type="button"
              disabled={clearingDb || confirmResetText.trim().toUpperCase() !== 'RESET'}
              onClick={handleClearAllDatabase}
              className="min-h-[44px] px-5 py-2.5 bg-red-700 text-white text-sm font-bold hover:bg-red-800 disabled:opacity-50 cursor-pointer"
            >
              {clearingDb ? 'Clearing Database...' : 'Clear All Database Records'}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
