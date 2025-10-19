import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '~/lib/supabase';
import { neynarClient } from '~/lib/neynar';

type PendingCast = {
  id: string;
  fid: number;
  content: string;
  scheduled_time: string;
  users: {
    signer_uuid: string;
    plan: string;
  };
};

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');

  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const now = new Date().toISOString();

    const { data: pendingCasts, error: fetchError } = await supabase
      .from('scheduled_casts')
      .select(
        `
        *,
        users!inner(signer_uuid, plan)
      `,
      )
      .eq('status', 'pending')
      .lte('scheduled_time', now)
      .limit(50);

    if (fetchError) {
      throw fetchError;
    }

    const results: Array<{ cast_id: string; status: string; hash?: string }> =
      [];

    if (!pendingCasts || pendingCasts.length === 0) {
      return NextResponse.json({
        success: true,
        processed: 0,
        results,
        timestamp: new Date().toISOString(),
      });
    }

    console.log(`[CRON] Found ${pendingCasts.length} casts to send`);

    for (const cast of pendingCasts as PendingCast[]) {
      try {
        const publishedCast = await neynarClient.publishCast({
          signerUuid: cast.users.signer_uuid,
          text: cast.content,
        });

        await supabase
          .from('scheduled_casts')
          .update({
            status: 'sent',
            cast_hash: publishedCast.cast.hash,
            sent_at: new Date().toISOString(),
          })
          .eq('id', cast.id);

        if (cast.users.plan === 'free') {
          const { error: rpcError } = await supabase.rpc(
            'increment_casts_used',
            { user_fid: cast.fid },
          );

          if (rpcError) {
            console.error(
              `[CRON] Failed to increment casts_used for ${cast.fid}:`,
              rpcError,
            );
          }
        }

        console.log(`[CRON] ✓ Sent cast ${cast.id} for FID ${cast.fid}`);
        results.push({
          cast_id: cast.id,
          status: 'sent',
          hash: publishedCast.cast.hash,
        });
      } catch (error) {
        console.error(`[CRON] ✗ Failed to send cast ${cast.id}:`, error);

        await supabase
          .from('scheduled_casts')
          .update({
            status: 'failed',
            error_message:
              error instanceof Error ? error.message : 'Unknown error',
            updated_at: new Date().toISOString(),
          })
          .eq('id', cast.id);

        results.push({ cast_id: cast.id, status: 'failed' });
      }
    }

    return NextResponse.json({
      success: true,
      processed: results.length,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[CRON] Job failed:', error);
    return NextResponse.json(
      {
        error: 'Cron job failed',
        details: error instanceof Error ? error.message : 'Unknown',
      },
      { status: 500 },
    );
  }
}
