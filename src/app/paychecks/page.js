import { supabase } from '@/lib/supabase';
import PaychecksClient from './PaychecksClient';

async function getPaychecks() {
  const { data, error } = await supabase
    .from('paychecks')
    .select('*')
    .order('pay_date', { ascending: false });

  if (error) return [];
  return data || [];
}

export default async function PaychecksPage() {
  const paychecks = await getPaychecks();
  return <PaychecksClient initialPaychecks={paychecks} />;
}
