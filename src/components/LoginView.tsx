import React, { useState } from 'react';
import { ShieldCheck, LogIn } from 'lucide-react';

interface LoginViewProps {
  onSignIn: () => Promise<void>;
  connectionOffline: boolean;
}

export function LoginView({ onSignIn, connectionOffline }: LoginViewProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      await onSignIn();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sign-in was cancelled or failed.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-black flex flex-col justify-between">
      <header className="bg-black text-white px-6 py-4 border-b border-neutral-800">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <span className="text-lg font-bold tracking-tight whitespace-nowrap">GOMPOCO</span>
          <span className="text-xs font-medium text-[#FFFA2A] whitespace-nowrap">
            Internal Sales System
          </span>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md border border-black bg-white p-6 sm:p-8 space-y-6">
          <div className="space-y-2">
            <div className="inline-block bg-[#FFFA2A] px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-black">
              Always There, Home Care.
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-black">
              Gompoco Sales Assistant
            </h1>
            <p className="text-sm text-neutral-700 leading-relaxed">
              Sign in with your authorised Google account to capture customer enquiries, run pest
              discovery, schedule assessments, prepare ZAR quotations, and send WhatsApp updates.
            </p>
          </div>

          {connectionOffline && (
            <div className="border border-red-600 bg-red-50 p-3 text-xs text-red-900">
              Unable to reach Firestore right now. Check your network connection and Firebase
              configuration before signing in.
            </div>
          )}

          {error && (
            <div className="border border-red-600 bg-red-50 p-3 text-xs text-red-900">
              {error}
            </div>
          )}

          <button
            type="button"
            disabled={loading}
            onClick={handleLogin}
            className="w-full min-h-[48px] bg-[#FFFA2A] text-black border border-black font-bold text-sm px-5 py-3 flex items-center justify-center gap-2.5 hover:bg-yellow-300 active:scale-[0.99] transition-colors disabled:opacity-60 cursor-pointer"
          >
            <LogIn className="w-4 h-4 shrink-0" />
            <span>{loading ? 'Signing in...' : 'Sign in with Google'}</span>
          </button>

          <div className="pt-4 border-t border-neutral-200 flex items-start gap-2.5 text-xs text-neutral-600">
            <ShieldCheck className="w-4 h-4 shrink-0 text-black mt-0.5" />
            <p className="leading-relaxed">
              Access is restricted to authenticated Gompoco salespeople and administrators.
              Customer records and pricing remain isolated by staff account and role.
            </p>
          </div>
        </div>
      </main>

      <footer className="px-6 py-4 border-t border-neutral-200 text-xs text-neutral-500 text-center">
        Gompoco · Pest Control &amp; Preventative Home Care · South Africa (ZAR)
      </footer>
    </div>
  );
}
