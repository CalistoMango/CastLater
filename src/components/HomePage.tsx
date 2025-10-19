'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import AuthFlow from '~/components/AuthFlow';
import Dashboard, { type UserRecord } from '~/components/Dashboard';
import ConnectButton from '~/components/ConnectButton';
import { APP_NAME } from '~/lib/constants';

export default function HomePage() {
  const { address, isConnected } = useAccount();

  const [user, setUser] = useState<UserRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fid, setFid] = useState<number | null>(null);

  const fetchUserByFid = useCallback(
    async (targetFid: number) => {
      const res = await fetch(`/api/users/${targetFid}`);
      if (res.status === 404) {
        setUser(null);
        return null;
      }
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? 'Failed to load user');
      }
      setUser(data.user);
      return data.user as UserRecord;
    },
    [],
  );

  const checkUserAuth = useCallback(async () => {
    if (!isConnected || !address) {
      setUser(null);
      setFid(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const fidRes = await fetch('/api/auth/get-fid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address }),
      });

      if (!fidRes.ok) {
        const data = await fidRes.json().catch(() => ({}));
        setError(
          data.error ??
            'No Farcaster account found for the connected wallet address.',
        );
        setUser(null);
        setFid(null);
        return;
      }

      const fidPayload = await fidRes.json();
      setFid(fidPayload.fid);
      await fetchUserByFid(fidPayload.fid);
    } catch (err) {
      console.error('Auth check error:', err);
      setError('Failed to verify Farcaster account. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [address, fetchUserByFid, isConnected]);

  useEffect(() => {
    checkUserAuth();
  }, [checkUserAuth]);

  const renderLoading = () => (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-indigo-600" />
        <p className="mt-4 text-gray-600">Loading...</p>
      </div>
    </div>
  );

  if (loading) {
    return renderLoading();
  }

  if (!isConnected || !address) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50">
        <div className="text-center">
          <h1 className="mb-4 text-4xl font-bold text-gray-900">
            {APP_NAME}
          </h1>
          <p className="mb-8 text-gray-600">
            Connect your wallet to get started.
          </p>
          <ConnectButton />
        </div>
      </div>
    );
  }

  if (!user || !fid) {
    return (
      <div className="relative">
        {error && (
          <div className="absolute inset-x-0 top-4 z-10 mx-auto w-full max-w-md rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow">
            {error}
          </div>
        )}
        <AuthFlow
          address={address}
          onComplete={async () => {
            await checkUserAuth();
          }}
        />
      </div>
    );
  }

  return (
    <Dashboard
      user={user}
      onUserUpdate={setUser}
      onRefreshUser={async () => {
        if (fid) {
          await fetchUserByFid(fid);
        }
      }}
    />
  );
}
