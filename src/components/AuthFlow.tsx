'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, Clock } from 'lucide-react';
import { useMiniApp } from '@neynar/react';
import sdk from '@farcaster/miniapp-sdk';
import { APP_NAME } from '~/lib/constants';

interface AuthFlowProps {
  fid: number;
  onComplete: () => Promise<void> | void;
}

type AuthStep = 'init' | 'approve' | 'polling';

export default function AuthFlow({ fid, onComplete }: AuthFlowProps) {
  const { context } = useMiniApp();
  const isInMiniapp = context !== undefined;

  const [step, setStep] = useState<AuthStep>('init');
  const [signerUrl, setSignerUrl] = useState<string>('');
  const [signerUuid, setSignerUuid] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    if (pollingTimeoutRef.current) {
      clearTimeout(pollingTimeoutRef.current);
      pollingTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => clearPolling, [clearPolling]);

  const openSignerUrl = useCallback(
    async (url: string) => {
      if (isInMiniapp) {
        // In Warpcast miniapp, use SDK to open URL
        await sdk.actions.openUrl(url);
      } else {
        // In regular browser, use window.open
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    },
    [isInMiniapp],
  );

  const startAuth = useCallback(async () => {
    try {
      setError(null);
      setStep('init');
      setSignerUrl('');
      setSignerUuid('');

      const signerRes = await fetch('/api/auth/create-signer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fid }),
      });

      if (!signerRes.ok) {
        const data = await signerRes.json().catch(() => ({}));
        setError(data.error ?? 'Failed to create signer.');
        return;
      }

      const { signer_approval_url, signer_uuid } = await signerRes.json();

      setSignerUrl(signer_approval_url);
      setSignerUuid(signer_uuid);
      setStep('approve');

      await openSignerUrl(signer_approval_url);
    } catch (err) {
      console.error('Auth start error:', err);
      setError('Failed to start authentication. Please try again.');
    }
  }, [fid, openSignerUrl]);

  const checkStatus = useCallback(async () => {
    if (!signerUuid) {
      setError('No signer request in progress.');
      return;
    }

    setStep('polling');
    setError(null);

    const poll = async () => {
      try {
        const res = await fetch(
          `/api/auth/signer-status?signer_uuid=${signerUuid}`,
        );
        if (!res.ok) {
          throw new Error('Failed to check signer status');
        }
        const { status } = await res.json();
        if (status === 'approved') {
          clearPolling();
          setStep('init');
          setSignerUrl('');
          setSignerUuid('');
          await onComplete();
        }
      } catch (err) {
        console.error('Status check error:', err);
      }
    };

    poll();
    pollingIntervalRef.current = setInterval(poll, 2000);
    pollingTimeoutRef.current = setTimeout(clearPolling, 300_000);
  }, [signerUuid, onComplete, clearPolling]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            Connect Your Farcaster Account
          </h2>
          <p className="text-gray-600 mt-2">
            Grant {APP_NAME} permission to post scheduled casts on your behalf.
          </p>
        </div>

        {error && (
          <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
            <div>{error}</div>
          </div>
        )}

        {step === 'init' && (
          <div className="space-y-4">
            <button
              onClick={startAuth}
              className="w-full rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 py-3 text-sm font-semibold text-white transition-all hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2"
            >
              Connect Farcaster
            </button>
          </div>
        )}

        {step === 'approve' && (
          <div className="space-y-4">
            <div className="text-center">
              <Clock className="mx-auto mb-4 h-12 w-12 text-indigo-600" />
              <p className="text-gray-600">
                Approve the signer in Warpcast to finish connecting your account.
              </p>
              <button
                onClick={() => openSignerUrl(signerUrl)}
                className="mt-4 inline-block text-sm font-medium text-indigo-600 underline hover:text-indigo-800 focus:outline-none"
              >
                Open approval link again
              </button>
            </div>
            <button
              onClick={checkStatus}
              className="w-full rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white transition-all hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2"
            >
              I&apos;ve Approved
            </button>
          </div>
        )}

        {step === 'polling' && (
          <div className="space-y-4 text-center">
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-indigo-600" />
            <p className="text-gray-600">Checking approval status...</p>
          </div>
        )}
      </div>
    </div>
  );
}
