import { NextRequest, NextResponse } from 'next/server';
import { neynarClient } from '~/lib/neynar';

interface GetFidRequestBody {
  address?: string;
}

export async function POST(req: NextRequest) {
  try {
    const { address }: GetFidRequestBody = await req.json();

    if (!address) {
      return NextResponse.json({ error: 'Address required' }, { status: 400 });
    }

    const normalizedAddress = address.toLowerCase();

    const response = await neynarClient.searchUser({ q: address });

    const user = response.result.users.find((u) => {
      const custody = u.custody_address?.toLowerCase();
      const verified =
        u.verified_addresses?.eth_addresses?.some(
          (addr: string) => addr.toLowerCase() === normalizedAddress,
        ) ?? false;

      return custody === normalizedAddress || verified;
    });

    if (!user) {
      return NextResponse.json(
        { error: 'No Farcaster account found for this address' },
        { status: 404 },
      );
    }

    return NextResponse.json({
      fid: user.fid,
      username: user.username,
      display_name: user.display_name,
      pfp_url: user.pfp_url,
      custody_address: user.custody_address,
      verified_addresses: user.verified_addresses,
    });
  } catch (error) {
    console.error('Get FID error:', error);
    return NextResponse.json({ error: 'Failed to get FID' }, { status: 500 });
  }
}
