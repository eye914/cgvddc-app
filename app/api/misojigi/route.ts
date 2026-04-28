import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('misojigi')
    .select('*')
    .eq('active', true)
    .order('name');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const result = data.map(row => ({
    name: row.name,
    pos: row.pos ? row.pos.split(',').map((p: string) => p.trim()) : [],
    hours: row.hours,
  }));

  return NextResponse.json(result);
}
