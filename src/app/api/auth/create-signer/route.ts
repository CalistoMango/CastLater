import { NextRequest, NextResponse } from 'next/server';
import { neynarClient } from '~/lib/neynar';
import { supabase } from '~/lib/supabase';
import { mnemonicToAccount } from 'viem/accounts';
import {
  SIGNED_KEY_REQUEST_TYPE,
  SIGNED_KEY_REQUEST_VALIDATOR_EIP_712_DOMAIN,
} from '~/lib/constants';
import { env } from '~/lib/env.server';

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

    let signerApprovalUrl = signer.signer_approval_url;

    if (!signerApprovalUrl) {
      const seedPhrase = env.SEED_PHRASE;

      if (!seedPhrase) {
        console.error('SEED_PHRASE is required to register signer key');
        return NextResponse.json(
          { error: 'Server configuration missing for signer registration' },
          { status: 500 },
        );
      }

      const account = mnemonicToAccount(seedPhrase);

      const shouldSponsor = env.SPONSOR_SIGNER === 'true';

      const {
        user: { fid: appFid },
      } = await neynarClient.lookupUserByCustodyAddress({
        custodyAddress: account.address,
      });

      const deadline = Math.floor(Date.now() / 1000) + 86_400; // 24 hours

      const signature = await account.signTypedData({
        domain: SIGNED_KEY_REQUEST_VALIDATOR_EIP_712_DOMAIN,
        types: {
          SignedKeyRequest: SIGNED_KEY_REQUEST_TYPE,
        },
        primaryType: 'SignedKeyRequest',
        message: {
          requestFid: BigInt(appFid),
          key: signer.public_key,
          deadline: BigInt(deadline),
        },
      });

      const registeredSigner = await neynarClient.registerSignedKey({
        signerUuid: signer.signer_uuid,
        appFid,
        deadline,
        signature,
        ...(shouldSponsor && { sponsor: { sponsored_by_neynar: true } }),
      });

      signerApprovalUrl = registeredSigner.signer_approval_url;

      if (!signerApprovalUrl) {
        throw new Error('Signer approval URL missing after registration');
      }
    }

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
      signer_approval_url: signerApprovalUrl,
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
