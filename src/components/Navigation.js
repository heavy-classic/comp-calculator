'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Briefcase,
  Receipt,
  BarChart3,
  DollarSign,
  TrendingUp,
  FileText,
  Shield,
  LogOut,
  User,
  Building2,
} from 'lucide-react';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/deals', label: 'Deals', icon: Briefcase },
  { href: '/paychecks', label: 'Paychecks', icon: Receipt },
  { href: '/comparison', label: 'Comparison', icon: BarChart3 },
  { href: '/analytics', label: 'Analytics', icon: TrendingUp },
  { href: '/reports', label: 'Reports', icon: FileText },
];

export default function Navigation({ user, isAdmin }) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    await fetch('/api/auth/signout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-slate-900 text-white flex flex-col z-50">
      {/* Logo */}
      <div className="p-6 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-500 rounded-lg flex items-center justify-center">
            <DollarSign className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-white text-sm">Comp Calculator</h1>
            <p className="text-slate-400 text-xs">Commission Tracker</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = href === '/'
            ? pathname === '/'
            : pathname.startsWith(href);

          return (
            <Link
              key={href}
              href={href}
              className={`
                flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                ${isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }
              `}
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          );
        })}

        {/* Admin section */}
        {isAdmin && (
          <>
            <div className="pt-4 pb-1">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide px-3">
                Admin
              </p>
            </div>
            <Link
              href="/admin/users"
              className={`
                flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                ${pathname === '/admin/users'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }
              `}
            >
              <Shield className="w-4 h-4" />
              Users
            </Link>
            <Link
              href="/admin/customers"
              className={`
                flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                ${pathname === '/admin/customers'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }
              `}
            >
              <Building2 className="w-4 h-4" />
              Customers
            </Link>
          </>
        )}
      </nav>

      {/* Commission Rate Reference */}
      <div className="p-4 border-t border-slate-700">
        <p className="text-xs font-medium text-slate-400 mb-2 uppercase tracking-wide">
          Commission Rates
        </p>
        <div className="space-y-1 text-xs text-slate-500">
          <div className="flex justify-between">
            <span>IdeaGen Impl.</span>
            <span className="text-slate-300 font-medium">10%</span>
          </div>
          <div className="flex justify-between">
            <span>IdeaGen Renewal</span>
            <span className="text-slate-300 font-medium">5%</span>
          </div>
          <div className="flex justify-between">
            <span>Other Impl.</span>
            <span className="text-slate-300 font-medium">4%</span>
          </div>
          <div className="flex justify-between">
            <span>Other Renewal</span>
            <span className="text-slate-300 font-medium">2%</span>
          </div>
          <div className="flex justify-between">
            <span>SW Resale Yr1</span>
            <span className="text-slate-300 font-medium">35%</span>
          </div>
          <div className="flex justify-between">
            <span>SW Resale Yr2+</span>
            <span className="text-slate-300 font-medium">15%</span>
          </div>
        </div>
      </div>

      {/* User / Sign out */}
      <div className="p-4 border-t border-slate-700">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-7 h-7 bg-slate-700 rounded-full flex items-center justify-center flex-shrink-0">
            <User className="w-3.5 h-3.5 text-slate-300" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-slate-300 font-medium truncate">
              {user?.email ?? ''}
            </p>
            {isAdmin && (
              <p className="text-xs text-purple-400">Admin</p>
            )}
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
