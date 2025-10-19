import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '~/lib/supabase';

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

    return NextResponse.json({ user });
  } catch (error) {
    console.error('Get user error:', error);
    return NextResponse.json(
      { error: 'Failed to get user' },
      { status: 500 },
    );
  }
}
