import './globals.css';
import Navigation from '@/components/Navigation';

export const metadata = {
  title: 'Comp Calculator',
  description: 'Track your sales commissions and compare with paychecks',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50">
        <div className="flex min-h-screen">
          <Navigation />
          <main className="flex-1 ml-64 min-h-screen">
            <div className="p-8">
              {children}
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}
