import { createSupabaseServerClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import CustomersClient from './CustomersClient';

export const dynamic = 'force-dynamic';

export default async function AdminCustomersPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || user.app_metadata?.role !== 'admin') {
    redirect('/');
  }

  return <CustomersClient />;
}
