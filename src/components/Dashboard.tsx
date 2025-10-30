'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  CheckCircle,
  Clock,
  Send,
  Trash2,
  Zap,
} from 'lucide-react';
import { format } from 'date-fns';
import { parseUnits } from 'viem';
import { base } from 'viem/chains';
import {
  useAccount,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from 'wagmi';
import { APP_NAME, ERC20_ABI, PAYMENT_CONFIG } from '~/lib/constants';
import { apiFetch } from '~/lib/api';

type PlanType = 'free' | 'unlimited' | string | null;

export interface UserRecord {
  fid: number;
  username?: string;
  display_name?: string;
  pfp_url?: string;
  plan?: PlanType;
  casts_used?: number;
  max_free_casts?: number;
  signer_uuid?: string;
}

interface ScheduledCast {
  id: string;
  fid: number;
  content: string;
  scheduled_time: string;
  status: 'pending' | 'sent' | 'failed' | 'cancelled';
  cast_hash?: string | null;
  error_message?: string | null;
}

interface DashboardProps {
  user: UserRecord;
  onUserUpdate: (user: UserRecord) => void;
  onRefreshUser?: () => Promise<void>;
}

export default function Dashboard({
  user,
  onUserUpdate,
  onRefreshUser,
}: DashboardProps) {
  const { address, chainId } = useAccount();
  const { switchChainAsync, isPending: isSwitchingChain } = useSwitchChain();
  const { writeContractAsync, isPending: isWritingContract } =
    useWriteContract();

  const [casts, setCasts] = useState<ScheduledCast[]>([]);
  const [castsLoading, setCastsLoading] = useState(true);
  const [castsError, setCastsError] = useState<string | null>(null);

  const [castContent, setCastContent] = useState('');
  const [castDate, setCastDate] = useState('');
  const [castTime, setCastTime] = useState('');
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [scheduleSuccess, setScheduleSuccess] = useState<string | null>(null);
  const [isScheduling, setIsScheduling] = useState(false);

  const [paymentHash, setPaymentHash] = useState<`0x${string}` | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState<string | null>(null);
  const [isRecordingPayment, setIsRecordingPayment] = useState(false);

  const {
    isLoading: isPaymentConfirming,
    isSuccess: isPaymentConfirmed,
  } = useWaitForTransactionReceipt({
    hash: paymentHash ?? undefined,
    chainId: base.id,
    query: {
      enabled: Boolean(paymentHash),
    },
  });

  const fetchCasts = useCallback(async () => {
    if (!user?.fid) return;
    setCastsLoading(true);
    setCastsError(null);
    try {
      // FID is now derived from authenticated session on server-side
      const res = await apiFetch('/api/casts/list');
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? 'Failed to load casts');
      }
      setCasts(data.casts ?? []);
    } catch (error) {
      console.error('List casts error:', error);
      setCastsError(
        error instanceof Error ? error.message : 'Failed to fetch casts',
      );
    } finally {
      setCastsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchCasts();
  }, [fetchCasts]);

  const remainingCasts = useMemo(() => {
    if (user.plan === 'unlimited') {
      return '∞';
    }
    const used = user.casts_used ?? 0;
    const max = user.max_free_casts ?? 0;
    return Math.max(0, max - used);
  }, [user.casts_used, user.max_free_casts, user.plan]);

  const formatScheduledTime = useCallback((isoString: string) => {
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) {
      return 'Invalid date';
    }
    return format(date, 'MMM d, h:mm a');
  }, []);

  const scheduleCast = useCallback(async () => {
    if (isScheduling) return;
    setScheduleError(null);
    setScheduleSuccess(null);

    if (!castContent.trim()) {
      setScheduleError('Cast content is required.');
      return;
    }
    if (!castDate || !castTime) {
      setScheduleError('Please select a date and time.');
      return;
    }

    const scheduledAt = new Date(`${castDate}T${castTime}`);
    if (Number.isNaN(scheduledAt.getTime())) {
      setScheduleError('Invalid date or time.');
      return;
    }

    setIsScheduling(true);

    try {
      // FID is now derived from authenticated session on server-side
      const res = await apiFetch('/api/casts/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: castContent.trim(),
          scheduled_time: scheduledAt.toISOString(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data.error ?? 'Failed to schedule cast. Please try again.',
        );
      }

      setScheduleSuccess('Cast scheduled successfully!');
      setCastContent('');
      setCastDate('');
      setCastTime('');

      await fetchCasts();
      if (onRefreshUser) {
        await onRefreshUser();
      }
    } catch (error) {
      console.error('Schedule cast error:', error);
      setScheduleError(
        error instanceof Error ? error.message : 'Failed to schedule cast.',
      );
    } finally {
      setIsScheduling(false);
    }
  }, [
    castContent,
    castDate,
    castTime,
    fetchCasts,
    isScheduling,
    onRefreshUser,
  ]);

  const cancelCast = useCallback(
    async (castId: string) => {
      try {
        // FID is now derived from authenticated session on server-side
        const res = await apiFetch('/api/casts/cancel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cast_id: castId }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error ?? 'Failed to cancel cast');
        }

        await fetchCasts();
      } catch (error) {
        console.error('Cancel cast error:', error);
        setCastsError(
          error instanceof Error ? error.message : 'Failed to cancel cast.',
        );
      }
    },
    [fetchCasts],
  );

  const recordPayment = useCallback(
    async (hash: `0x${string}`) => {
      if (!address) return;
      if (isRecordingPayment) return;

      setIsRecordingPayment(true);
      setPaymentError(null);

      try {
        const res = await apiFetch('/api/payments/record', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fid: user.fid,
            txHash: hash,
            address,
          }),
        });
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error ?? 'Failed to record payment');
        }

        setPaymentSuccess(
          data.message ?? 'Payment verified and plan upgraded.',
        );
        setPaymentHash(null);

        if (onRefreshUser) {
          await onRefreshUser();
        } else {
          onUserUpdate({ ...user, plan: 'unlimited' });
        }
      } catch (error) {
        console.error('Record payment error:', error);
        setPaymentError(
          error instanceof Error ? error.message : 'Failed to record payment.',
        );
      } finally {
        setIsRecordingPayment(false);
      }
    },
    [address, isRecordingPayment, onRefreshUser, onUserUpdate, user],
  );

  useEffect(() => {
    if (paymentHash && isPaymentConfirmed) {
      recordPayment(paymentHash);
    }
  }, [isPaymentConfirmed, paymentHash, recordPayment]);

  const handleUpgrade = useCallback(async () => {
    setPaymentError(null);
    setPaymentSuccess(null);

    if (!address) {
      setPaymentError('Connect your wallet to upgrade.');
      return;
    }

    if (!PAYMENT_CONFIG.RECEIVER) {
      setPaymentError(
        'Payment receiver address is not configured. Please contact support.',
      );
      return;
    }

    try {
      if (chainId !== base.id) {
        await switchChainAsync({ chainId: base.id });
      }

      const hash = await writeContractAsync({
        abi: ERC20_ABI,
        address: PAYMENT_CONFIG.USDC_BASE as `0x${string}`,
        functionName: 'transfer',
        args: [
          PAYMENT_CONFIG.RECEIVER as `0x${string}`,
          parseUnits(PAYMENT_CONFIG.PRICE, PAYMENT_CONFIG.DECIMALS),
        ],
      });

      setPaymentHash(hash);
      setPaymentSuccess('Payment submitted. Waiting for confirmation...');
    } catch (error) {
      console.error('Upgrade error:', error);
      setPaymentError(
        error instanceof Error ? error.message : 'Failed to start payment.',
      );
    }
  }, [address, chainId, switchChainAsync, writeContractAsync]);

  const isFreeLimitReached =
    user.plan !== 'unlimited' &&
    typeof user.casts_used === 'number' &&
    typeof user.max_free_casts === 'number' &&
    user.casts_used >= user.max_free_casts;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 p-4">
      <div className="mx-auto flex max-w-4xl flex-col space-y-6">
        <header className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              {user.pfp_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.pfp_url}
                  alt={user.username ?? 'Profile'}
                  className="h-14 w-14 rounded-full border border-indigo-100 object-cover"
                />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-purple-400 to-indigo-500 text-xl font-bold text-white">
                  {(user.username ?? user.display_name ?? 'C')[0]?.toUpperCase()}
                </div>
              )}
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {APP_NAME}
                </h1>
                {user.username && (
                  <p className="text-sm text-gray-500">@{user.username}</p>
                )}
              </div>
            </div>

            <div className="text-right">
              <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700">
                <Zap className="h-4 w-4" />
                {user.plan === 'unlimited' ? 'Unlimited' : 'Free Plan'}
              </div>
              <p className="mt-1 text-xs text-gray-500">
                {remainingCasts} casts remaining
              </p>
            </div>
          </div>
        </header>

        <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-xl font-bold text-gray-900">
            <Send className="h-5 w-5 text-indigo-600" />
            Schedule a Cast
          </h2>

          <div className="space-y-4">
            {scheduleError && (
              <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
                <div>{scheduleError}</div>
              </div>
            )}

            {scheduleSuccess && (
              <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
                <CheckCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
                <div>{scheduleSuccess}</div>
              </div>
            )}

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Cast Content
              </label>
              <textarea
                value={castContent}
                onChange={(event) => setCastContent(event.target.value)}
                placeholder="What do you want to share?"
                maxLength={320}
                rows={4}
                className="w-full resize-none rounded-xl border border-gray-200 px-4 py-3 text-sm shadow-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <div className="mt-2 flex justify-between text-xs text-gray-500">
                <span>{castContent.length}/320 characters</span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700">
                  <Calendar className="h-4 w-4" />
                  Date
                </label>
                <input
                  type="date"
                  value={castDate}
                  onChange={(event) => setCastDate(event.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm shadow-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700">
                  <Clock className="h-4 w-4" />
                  Time
                </label>
                <input
                  type="time"
                  value={castTime}
                  onChange={(event) => setCastTime(event.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm shadow-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {isFreeLimitReached ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="mt-0.5 h-5 w-5 text-amber-600" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-amber-900">
                      Free limit reached
                    </h3>
                    <p className="mt-1 text-sm text-amber-700">
                      Upgrade to unlimited for just 10 USDC to schedule as many
                      casts as you want.
                    </p>
                    <button
                      onClick={handleUpgrade}
                      disabled={
                        isWritingContract ||
                        isSwitchingChain ||
                        isPaymentConfirming ||
                        isRecordingPayment
                      }
                      className="mt-3 inline-flex items-center justify-center rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2 text-sm font-medium text-white transition-all hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Upgrade to Unlimited - 10 USDC
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <button
                onClick={scheduleCast}
                disabled={isScheduling}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:from-indigo-700 hover:to-purple-700 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isScheduling ? (
                  <span>Scheduling...</span>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Schedule Cast
                  </>
                )}
              </button>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-xl font-bold text-gray-900">
            <Calendar className="h-5 w-5 text-indigo-600" />
            Scheduled Casts
          </h2>

          {castsError && (
            <div className="mb-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
              <div>{castsError}</div>
            </div>
          )}

          {castsLoading ? (
            <div className="flex items-center justify-center py-12 text-gray-500">
              <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-indigo-600" />
            </div>
          ) : casts.length === 0 ? (
            <div className="py-12 text-center text-gray-400">
              <Calendar className="mx-auto mb-3 h-12 w-12 opacity-50" />
              <p>No scheduled casts yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {casts.map((cast) => {
                const statusStyles =
                  cast.status === 'pending'
                    ? 'bg-blue-50 text-blue-700'
                    : cast.status === 'sent'
                    ? 'bg-emerald-50 text-emerald-700'
                    : cast.status === 'failed'
                    ? 'bg-red-50 text-red-700'
                    : 'bg-gray-100 text-gray-600';

                return (
                  <div
                    key={cast.id}
                    className="rounded-xl border border-gray-200 p-4 transition-colors hover:border-indigo-300"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <p className="text-sm text-gray-900">{cast.content}</p>
                        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            {formatScheduledTime(cast.scheduled_time)}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-1 font-medium ${statusStyles}`}
                          >
                            {cast.status === 'pending' && (
                              <Clock className="h-3 w-3" />
                            )}
                            {cast.status === 'sent' && (
                              <CheckCircle className="h-3 w-3" />
                            )}
                            {cast.status === 'failed' && (
                              <AlertCircle className="h-3 w-3" />
                            )}
                            {cast.status.charAt(0).toUpperCase() +
                              cast.status.slice(1)}
                          </span>
                          {cast.cast_hash && (
                            <span className="truncate text-xs text-gray-400">
                              Hash: {cast.cast_hash}
                            </span>
                          )}
                        </div>
                        {cast.status === 'failed' && cast.error_message && (
                          <p className="mt-2 text-xs text-red-500">
                            {cast.error_message}
                          </p>
                        )}
                      </div>
                      {cast.status === 'pending' && (
                        <button
                          onClick={() => cancelCast(cast.id)}
                          className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {user.plan !== 'unlimited' && (
          <section className="rounded-2xl border border-indigo-100 bg-white p-6 shadow-sm">
            <h2 className="mb-3 text-lg font-semibold text-gray-900">
              Upgrade for Unlimited Scheduling
            </h2>
            <p className="text-sm text-gray-600">
              Send 10 USDC on Base to unlock unlimited scheduled casts and
              remove the free tier limit.
            </p>

            <div className="mt-4 space-y-3">
              <button
                onClick={handleUpgrade}
                disabled={
                  isWritingContract ||
                  isSwitchingChain ||
                  isPaymentConfirming ||
                  isRecordingPayment
                }
                className="w-full rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-3 text-sm font-semibold text-white transition-all hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSwitchingChain
                  ? 'Switching to Base...'
                  : isWritingContract
                  ? 'Awaiting wallet confirmation...'
                  : isPaymentConfirming || isRecordingPayment
                  ? 'Verifying payment...'
                  : 'Upgrade for 10 USDC'}
              </button>

              {paymentError && (
                <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
                  <div>{paymentError}</div>
                </div>
              )}

              {paymentSuccess && (
                <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
                  <CheckCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
                  <div>{paymentSuccess}</div>
                </div>
              )}
            </div>
          </section>
        )}

        <footer className="pb-8 text-center text-sm text-gray-500">
          Powered by Neynar • Built on Farcaster
        </footer>
      </div>
    </div>
  );
}
