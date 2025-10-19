import { NextRequest, NextResponse } from 'next/server';
import { neynarClient } from '~/lib/neynar';
import { supabase } from '~/lib/supabase';

interface CreateSignerBody {
  fid?: number;
  username?: string;
  display_name?: string;
  pfp_url?: string;
  custody_address?: string;
}

export async function POST(req: NextRequest) {
  try {
    const { fid, username, display_name, pfp_url, custody_address }: CreateSignerBody =
      await req.json();

    if (!fid) {
      return NextResponse.json({ error: 'FID is required' }, { status: 400 });
    }

    const signer = await neynarClient.createSigner();

    const now = new Date().toISOString();

    const { data: user, error } = await supabase
      .from('users')
      .upsert(
        {
          fid,
          username,
          display_name,
          pfp_url,
          custody_address,
          signer_uuid: signer.signer_uuid,
          updated_at: now,
        },
        { onConflict: 'fid' },
      )
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({
      signer_uuid: signer.signer_uuid,
      signer_approval_url: signer.signer_approval_url,
      public_key: signer.public_key,
      user,
    });
  } catch (error) {
    console.error('Create signer error:', error);
    return NextResponse.json(
      { error: 'Failed to create signer' },
      { status: 500 },
    );
  }
}
