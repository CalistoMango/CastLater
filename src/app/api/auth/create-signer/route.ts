import { NextRequest, NextResponse } from 'next/server';
import { neynarClient } from '~/lib/neynar';
import { supabase } from '~/lib/supabase';
import { mnemonicToAccount } from 'viem/accounts';
import {
  SIGNED_KEY_REQUEST_TYPE,
  SIGNED_KEY_REQUEST_VALIDATOR_EIP_712_DOMAIN,
} from '~/lib/constants';
import { env } from '~/lib/env.server';
import { AxiosError } from 'axios';

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

    console.log('=== DIAGNOSTIC 1: createSigner() response ===', {
      hasSignerApprovalUrl: !!signer.signer_approval_url,
      signerApprovalUrlValue: signer.signer_approval_url,
      signerUuid: signer.signer_uuid,
      publicKeyPrefix: signer.public_key?.substring(0, 20) + '...',
      allResponseKeys: Object.keys(signer),
      signerStatus: (signer as any).status,
    });

    let signerApprovalUrl = signer.signer_approval_url;

    if (!signerApprovalUrl) {
      console.log('=== DIAGNOSTIC 2: signer_approval_url is missing, entering fallback path ===');
      const seedPhrase = env.SEED_PHRASE;

      if (!seedPhrase) {
        console.error('SEED_PHRASE is required to register signer key');
        return NextResponse.json(
          { error: 'Server configuration missing for signer registration' },
          { status: 500 },
        );
      }

      const account = mnemonicToAccount(seedPhrase);

      console.log('=== DIAGNOSTIC 3: Derived account from SEED_PHRASE ===', {
        custodyAddress: account.address,
      });

      const shouldSponsor = env.SPONSOR_SIGNER === 'true';

      let appFid = env.FARCASTER_DEVELOPER_FID;

      console.log('=== DIAGNOSTIC 4: App FID configuration ===', {
        FARCASTER_DEVELOPER_FID: appFid,
        willLookupFromCustody: appFid === undefined,
      });

      if (appFid === undefined) {
        try {
          console.log('=== DIAGNOSTIC 5: Looking up FID from custody address ===', {
            custodyAddress: account.address,
          });

          const {
            user: { fid },
          } = await neynarClient.lookupUserByCustodyAddress({
            custodyAddress: account.address,
          });
          appFid = fid;

          console.log('=== DIAGNOSTIC 6: Custody lookup succeeded ===', {
            resolvedFid: appFid,
          });
        } catch (lookupError) {
          console.error('=== DIAGNOSTIC 7: Custody lookup FAILED ===', lookupError);
          return NextResponse.json(
            {
              error:
                'Failed to resolve app FID. Set FARCASTER_DEVELOPER_FID or ensure SEED_PHRASE corresponds to a registered Farcaster account.',
            },
            { status: 500 },
          );
        }
      }

      const deadline = Math.floor(Date.now() / 1000) + 86_400; // 24 hours

      console.log('=== DIAGNOSTIC 8: Signing EIP-712 message ===', {
        appFid,
        signerPublicKey: signer.public_key,
        deadline,
        deadlineDate: new Date(deadline * 1000).toISOString(),
      });

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

      console.log('=== DIAGNOSTIC 9: Signature created, calling registerSignedKey ===', {
        signerUuid: signer.signer_uuid,
        appFid,
        deadline,
        signatureLength: signature.length,
        shouldSponsor,
      });

      try {
        const registeredSigner = await neynarClient.registerSignedKey({
          signerUuid: signer.signer_uuid,
          appFid,
          deadline,
          signature,
          ...(shouldSponsor && { sponsor: { sponsored_by_neynar: true } }),
        });

        console.log('=== DIAGNOSTIC 10: registerSignedKey SUCCESS ===', {
          hasApprovalUrl: !!registeredSigner.signer_approval_url,
          approvalUrlValue: registeredSigner.signer_approval_url,
          allResponseKeys: Object.keys(registeredSigner),
        });

        signerApprovalUrl = registeredSigner.signer_approval_url;

        if (!signerApprovalUrl) {
          throw new Error('Signer approval URL missing after registration');
        }
      } catch (registerError) {
        console.error('=== DIAGNOSTIC 11: registerSignedKey FAILED ===');
        if (registerError instanceof AxiosError) {
          console.error('Axios error details:', {
            status: registerError.response?.status,
            statusText: registerError.response?.statusText,
            data: registerError.response?.data,
            headers: registerError.response?.headers,
          });
          console.error('Full response data:', JSON.stringify(registerError.response?.data, null, 2));
        } else {
          console.error('Non-Axios error:', registerError);
        }
        throw registerError;
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

    console.log('=== DIAGNOSTIC 12: SUCCESS - Returning response ===', {
      hasSignerApprovalUrl: !!signerApprovalUrl,
      signerApprovalUrl,
    });

    return NextResponse.json({
      signer_uuid: signer.signer_uuid,
      signer_approval_url: signerApprovalUrl,
      public_key: signer.public_key,
      user,
    });
  } catch (error) {
    console.error('=== DIAGNOSTIC 13: FATAL ERROR in main try block ===');
    console.error('Error details:', error);
    return NextResponse.json(
      { error: 'Failed to create signer' },
      { status: 500 },
    );
  }
}
