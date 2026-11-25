import React, { useState } from 'react';
import { Lock, LogOut, Menu, Shield, X } from 'lucide-react';
import { ErrorBoundary } from '@/src/components/ErrorBoundary';
import { FirebaseProvider, useAppData } from '@/src/context/AuthContext';
import { LoginView } from '@/src/components/LoginView';
import { SinglePageSalesWorkspace } from '@/src/components/SinglePageSalesWorkspace';
import { AdminDashboardView } from '@/src/components/AdminDashboardView';

const SINGLE_PAGE_NAV = [
  { anchor: 'sec-customer', label: 'Customer', mobileLabel: '01. Customer Information' },
  { anchor: 'sec-pest', label: 'Pest', mobileLabel: '02. Pest Problem' },
  { anchor: 'sec-assessment', label: 'Assessment', mobileLabel: '03. Assessment Details' },
  { anchor: 'sec-quotation', label: 'Quotation', mobileLabel: '04. Quotation Builder' },
  { anchor: 'sec-whatsapp', label: 'WhatsApp', mobileLabel: '05. WhatsApp Message' },
  { anchor: 'sec-records', label: 'Records', mobileLabel: '06. Saved Records & Quotations' },
];

function GompocoWorkspace() {
  const {
    user,
    staffProfile,
    isAdmin,
    isBootstrappedAdmin,
    authReady,
    connectionOffline,
    quotaError,
    clearQuotaError,
    signIn,
    signOut,
  } = useAppData();

  const [viewMode, setViewMode] = useState<'sales' | 'admin'>('sales');
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (!authReady) {
    return (
      <div className="min-h-screen bg-white text-black flex items-center justify-center p-6">
        <div className="text-sm font-semibold">Loading Gompoco Sales Assistant...</div>
      </div>
    );
  }

  if (!user) {
    return <LoginView onSignIn={signIn} connectionOffline={connectionOffline} />;
  }

  if (!user.emailVerified) {
    return (
      <div className="min-h-screen bg-white text-black flex items-center justify-center p-6">
        <div className="max-w-md border border-black p-6 space-y-4">
          <h1 className="text-lg font-bold">Email Verification Required</h1>
          <p className="text-sm text-neutral-700">
            Your Google account must have a verified email address to access Gompoco customer
            records.
          </p>
          <button
            type="button"
            onClick={signOut}
            className="min-h-[44px] px-5 py-2.5 bg-black text-white text-sm font-semibold cursor-pointer"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  if (staffProfile && !staffProfile.active && !isBootstrappedAdmin) {
    return (
      <div className="min-h-screen bg-white text-black flex items-center justify-center p-6">
        <div className="max-w-md border border-black p-6 space-y-4">
          <h1 className="text-lg font-bold">Account Suspended</h1>
          <p className="text-sm text-neutral-700">
            Your access to Gompoco Sales Assistant has been suspended by an administrator.
          </p>
          <button
            type="button"
            onClick={signOut}
            className="min-h-[44px] px-5 py-2.5 bg-black text-white text-sm font-semibold cursor-pointer"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  const scrollToSection = (anchorId: string) => {
    setMobileMenuOpen(false);
    const wasAdmin = viewMode !== 'sales';
    if (wasAdmin) {
      setAdminUnlocked(false);
      setViewMode('sales');
      window.setTimeout(() => {
        document.getElementById(anchorId)?.scrollIntoView({ behavior: 'smooth' });
      }, 40);
    } else {
      document.getElementById(anchorId)?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleOpenAdminGate = () => {
    setMobileMenuOpen(false);
    setAdminUnlocked(false);
    setViewMode('admin');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleReturnToSalesTop = () => {
    setMobileMenuOpen(false);
    setAdminUnlocked(false);
    setViewMode('sales');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-white text-black flex flex-col">
      {/* Top Bar: 3-zone contract */}
      <header className="sticky top-0 z-30 bg-black text-white border-b border-neutral-800 h-14 px-4 sm:px-6 flex items-center justify-between gap-4 no-print">
        <button
          type="button"
          onClick={handleReturnToSalesTop}
          className="text-base sm:text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0 cursor-pointer"
        >
          Gompoco Sales Assistant
        </button>

        <nav className="hidden md:flex items-center gap-5 text-xs lg:text-sm font-medium">
          {SINGLE_PAGE_NAV.map((item) => (
            <button
              key={item.anchor}
              type="button"
              onClick={() => scrollToSection(item.anchor)}
              className="whitespace-nowrap shrink-0 py-1 text-neutral-300 hover:text-[#FFFA2A] transition-colors cursor-pointer"
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-2.5 shrink-0">
          {isAdmin && (
            <button
              type="button"
              onClick={
                viewMode === 'admin' ? handleReturnToSalesTop : handleOpenAdminGate
              }
              className={`hidden md:inline-flex min-h-[36px] px-3 py-1.5 text-xs font-bold items-center gap-1.5 border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                viewMode === 'admin'
                  ? 'bg-[#FFFA2A] text-black border-[#FFFA2A]'
                  : 'bg-neutral-900 text-[#FFFA2A] border-neutral-700 hover:border-[#FFFA2A]'
              }`}
            >
              {viewMode === 'admin' ? (
                <>
                  <Lock className="w-3.5 h-3.5" />
                  <span>Sales Page</span>
                </>
              ) : (
                <>
                  <Shield className="w-3.5 h-3.5" />
                  <span>Admin Gate</span>
                </>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={signOut}
            className="hidden md:inline-flex min-h-[36px] px-3 py-1.5 border border-neutral-700 text-white text-xs font-semibold items-center gap-1.5 hover:border-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-label="Open navigation menu"
            className="md:hidden min-h-[40px] min-w-[40px] px-2.5 flex items-center justify-center gap-1.5 border border-neutral-700 text-white text-xs font-semibold cursor-pointer"
          >
            {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            <span>Menu</span>
          </button>
        </div>
      </header>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-x-0 top-14 bottom-0 z-40 bg-white border-t border-black overflow-y-auto p-4 space-y-4 no-print">
          <div className="text-xs font-bold uppercase tracking-wide text-neutral-600">
            Jump to Section
          </div>
          <div className="grid grid-cols-1 gap-1.5">
            {SINGLE_PAGE_NAV.map((item) => (
              <button
                key={item.anchor}
                type="button"
                onClick={() => scrollToSection(item.anchor)}
                className="min-h-[46px] px-4 py-2.5 text-left text-sm font-semibold border border-neutral-300 bg-white text-black hover:border-black cursor-pointer"
              >
                {item.mobileLabel}
              </button>
            ))}
          </div>

          {isAdmin && (
            <div className="pt-2 border-t border-neutral-300">
              <button
                type="button"
                onClick={handleOpenAdminGate}
                className="w-full min-h-[46px] px-4 py-2.5 bg-[#FFFA2A] text-black border border-black text-sm font-bold flex items-center justify-center gap-2 cursor-pointer"
              >
                <Shield className="w-4 h-4" />
                <span>Open Admin Gate</span>
              </button>
            </div>
          )}

          <div className="pt-4 border-t border-neutral-300 flex items-center justify-between text-xs">
            <div>
              <div className="font-bold text-black">
                {staffProfile?.displayName || user.displayName}
              </div>
              <div className="text-neutral-600">
                {isAdmin ? 'Administrator' : 'Salesperson'} · {user.email}
              </div>
            </div>
            <button
              type="button"
              onClick={signOut}
              className="min-h-[40px] px-3.5 py-2 border border-black text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}

      {quotaError && (
        <div className="bg-red-50 border-b border-red-700 px-4 py-3 text-xs sm:text-sm text-red-900 flex items-center justify-between gap-3 no-print">
          <span>{quotaError}</span>
          <button
            type="button"
            onClick={clearQuotaError}
            className="underline font-semibold shrink-0 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      <main className="flex-1 w-full">
        {viewMode === 'admin' && isAdmin ? (
          <AdminDashboardView
            unlocked={adminUnlocked}
            onUnlock={() => setAdminUnlocked(true)}
            onLockAndExit={handleReturnToSalesTop}
            onDataCleared={() => setSelectedCustomerId(null)}
            onSelectCustomerInSales={(id) => {
              setSelectedCustomerId(id);
              setAdminUnlocked(false);
              setViewMode('sales');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        ) : (
          <SinglePageSalesWorkspace
            selectedCustomerId={selectedCustomerId}
            onSelectCustomerId={setSelectedCustomerId}
          />
        )}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <FirebaseProvider>
        <GompocoWorkspace />
      </FirebaseProvider>
    </ErrorBoundary>
  );
}
