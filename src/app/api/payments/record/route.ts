import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http } from 'viem';
import { base } from 'viem/chains';
import { supabase } from '~/lib/supabase';

interface RecordPaymentBody {
  fid?: number;
  txHash?: string;
  address?: string;
}

export async function POST(req: NextRequest) {
  try {
    const { fid, txHash, address }: RecordPaymentBody = await req.json();

    if (!fid || !txHash || !address) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 },
      );
    }

    const {
      data: existing,
      error: existingError,
    } = await supabase
      .from('payments')
      .select('id')
      .eq('transaction_hash', txHash)
      .maybeSingle();

    if (existingError && existingError.code !== 'PGRST116') {
      throw existingError;
    }

    if (existing) {
      return NextResponse.json(
        { error: 'Payment already recorded' },
        { status: 400 },
      );
    }

    await new Promise((resolve) => setTimeout(resolve, 3000));

    const client = createPublicClient({
      chain: base,
      transport: http(),
    });

    const receipt = await client.getTransactionReceipt({
      hash: txHash as `0x${string}`,
    });

    if (receipt.status !== 'success') {
      return NextResponse.json(
        { error: 'Transaction failed' },
        { status: 400 },
      );
    }

    const { error: insertError } = await supabase.from('payments').insert({
      fid,
      transaction_hash: txHash,
      from_address: address,
      amount: 10,
      token: 'USDC',
      network: 'base',
      status: 'completed',
      completed_at: new Date().toISOString(),
    });

    if (insertError) {
      throw insertError;
    }

    const { error: upgradeError } = await supabase
      .from('users')
      .update({ plan: 'unlimited', updated_at: new Date().toISOString() })
      .eq('fid', fid);

    if (upgradeError) {
      throw upgradeError;
    }

    return NextResponse.json({
      success: true,
      message: 'Payment verified and user upgraded to unlimited!',
    });
  } catch (error) {
    console.error('Record payment error:', error);
    return NextResponse.json(
      { error: 'Failed to record payment' },
      { status: 500 },
    );
  }
}
