'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAccount, useConnect } from 'wagmi';
import { useMiniApp } from '@neynar/react';
import AuthFlow from '~/components/AuthFlow';
import Dashboard, { type UserRecord } from '~/components/Dashboard';
import { APP_NAME, APP_URL } from '~/lib/constants';

export default function HomePage() {
  const { isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { context } = useMiniApp();

  const [user, setUser] = useState<UserRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fid, setFid] = useState<number | null>(null);
  const [signerApproved, setSignerApproved] = useState<boolean | null>(null);

  // Check if we're running in Farcaster client
  const isInFarcasterClient = typeof window !== 'undefined' &&
    (window as unknown as { farcaster?: unknown }).farcaster !== undefined;

  // Auto-connect Farcaster Frame wallet when context is available
  useEffect(() => {
    if (context?.user?.fid && !isConnected && connectors.length > 0 && isInFarcasterClient) {
      console.log('Auto-connecting Farcaster Frame wallet...');
      console.log('- User FID:', context.user.fid);
      console.log('- Available connectors:', connectors.map((c, i) => `${i}: ${c.name}`));

      // Use the first connector (farcasterFrame) for auto-connection
      try {
        connect({ connector: connectors[0] });
      } catch (error) {
        console.error('Auto-connection failed:', error);
      }
    }
  }, [context?.user?.fid, isConnected, connectors, connect, isInFarcasterClient]);

  const fetchUserByFid = useCallback(
    async (targetFid: number) => {
      const res = await fetch(`${APP_URL}/api/users/${targetFid}`);

      // 401 means not authenticated - need to show AuthFlow
      if (res.status === 401) {
        setUser(null);
        return null;
      }

      // 404 means user doesn't exist yet - need to show AuthFlow to create
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
    // Get FID from Farcaster miniapp context if available
    const contextFid = context?.user?.fid;

    if (!contextFid) {
      setUser(null);
      setFid(null);
      setSignerApproved(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      setFid(contextFid);
      const fetchedUser = await fetchUserByFid(contextFid);

      // Check signer approval status if user has a signer
      if (fetchedUser?.signer_uuid) {
        try {
          const statusRes = await fetch(`${APP_URL}/api/auth/signer-status?signer_uuid=${encodeURIComponent(fetchedUser.signer_uuid)}`);
          if (statusRes.ok) {
            const { status } = await statusRes.json();
            setSignerApproved(status === 'approved');
          } else {
            setSignerApproved(false);
          }
        } catch (signerErr) {
          console.error('Signer status check error:', signerErr);
          setSignerApproved(false);
        }
      } else {
        setSignerApproved(false);
      }
    } catch (err) {
      console.error('Auth check error:', err);
      setError('Failed to load user data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [context?.user?.fid, fetchUserByFid]);

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

  // No Farcaster context available - show connect prompt
  if (!context?.user?.fid) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50">
        <div className="text-center">
          <h1 className="mb-4 text-4xl font-bold text-gray-900">
            {APP_NAME}
          </h1>
          <p className="mb-8 text-gray-600">
            Open this app in Warpcast to get started.
          </p>
          {!isInFarcasterClient && (
            <div className="mt-4 text-sm text-gray-500">
              <p>This is a Farcaster mini app.</p>
              <p>It needs to be opened from within the Warpcast app.</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Have FID but no user record - show auth flow
  if (!user || !fid) {
    return (
      <div className="relative">
        {error && (
          <div className="absolute inset-x-0 top-4 z-10 mx-auto w-full max-w-md rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow">
            {error}
          </div>
        )}
        <AuthFlow
          fid={context.user.fid}
          onComplete={async () => {
            await checkUserAuth();
          }}
        />
      </div>
    );
  }

  // User exists but signer not approved - show auth flow
  if (user.signer_uuid && signerApproved === false) {
    return (
      <div className="relative">
        {error && (
          <div className="absolute inset-x-0 top-4 z-10 mx-auto w-full max-w-md rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow">
            {error}
          </div>
        )}
        <AuthFlow
          fid={context.user.fid}
          onComplete={async () => {
            await checkUserAuth();
          }}
        />
      </div>
    );
  }

  // User is authenticated with approved signer - show dashboard
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
