import { NextRequest, NextResponse } from 'next/server';
import { neynarClient } from '~/lib/neynar';
import { supabase } from '~/lib/supabase';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const signerUuid = searchParams.get('signer_uuid');

  if (!signerUuid) {
    return NextResponse.json({ error: 'Missing signer_uuid' }, { status: 400 });
  }

  try {
    const signer = await neynarClient.lookupSigner({ signerUuid });

    if (signer.status === 'approved') {
      const { error } = await supabase
        .from('users')
        .update({ signer_uuid: signerUuid, updated_at: new Date().toISOString() })
        .eq('fid', signer.fid);

      if (error) {
        console.error('Failed to update user signer status:', error);
      }
    }

    return NextResponse.json({
      status: signer.status,
      fid: signer.fid,
    });
  } catch (error) {
    console.error('Signer status error:', error);
    return NextResponse.json(
      { error: 'Failed to check signer status' },
      { status: 500 },
    );
  }
}
