import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '~/lib/supabase';
import { getSession } from '~/auth';

type RouteContext = {
  params: Promise<{
    fid: string;
  }>;
};

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const { fid: fidString } = await context.params;
    const fid = Number.parseInt(fidString, 10);

    if (Number.isNaN(fid)) {
      return NextResponse.json({ error: 'Invalid fid' }, { status: 400 });
    }

    // Require authentication for all user profile access
    const session = await getSession();
    if (!session || !session.user?.fid) {
      return NextResponse.json(
        { error: 'Unauthorized - Please sign in to view user data' },
        { status: 401 },
      );
    }

    const isOwner = session.user.fid === fid;

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('fid', fid)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      throw error;
    }

    // If user is viewing their own profile, return full data
    if (isOwner) {
      return NextResponse.json({ user });
    }

    // Authenticated users can view public information of other users
    // (enables future social features like viewing other users' profiles)
    const publicUser = {
      fid: user.fid,
      username: user.username,
      display_name: user.display_name,
      pfp_url: user.pfp_url,
    };

    return NextResponse.json({ user: publicUser });
  } catch (error) {
    console.error('Get user error:', error);
    return NextResponse.json(
      { error: 'Failed to get user' },
      { status: 500 },
    );
  }
}
