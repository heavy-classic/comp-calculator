import './globals.css';
import Navigation from '@/components/Navigation';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export const metadata = {
  title: 'Comp Calculator',
  description: 'Track your sales commissions and compare with paychecks',
};

export default async function RootLayout({ children }) {
  let user = null;
  let isAdmin = false;

  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getUser();
    user = data?.user ?? null;
    isAdmin = user?.app_metadata?.role === 'admin';
  } catch {
    // No session — login page will render without nav
  }

  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50">
        {user ? (
          <div className="flex min-h-screen">
            <Navigation user={user} isAdmin={isAdmin} />
            <main className="flex-1 ml-64 min-h-screen">
              <div className="p-8">{children}</div>
            </main>
          </div>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
