"use client";

import { CreditCard, Settings, FileText } from 'lucide-react';

type TabType = 'credits' | 'billing' | 'invoices';

interface BillingLayoutProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  children: React.ReactNode;
  isAccountOwner?: boolean;
}

export function BillingLayout({
  activeTab,
  onTabChange,
  children,
  isAccountOwner = true
}: BillingLayoutProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[16rem_1fr] gap-6 lg:gap-8">
        <aside className="lg:sticky lg:top-6 self-start">
          <nav className="space-y-1 rounded-2xl border border-border/60 bg-card/60 p-2 shadow-sm backdrop-blur">
            <button
              onClick={() => onTabChange('credits')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-sm font-medium transition-colors ${
                activeTab === 'credits' ? 'bg-primary/10 text-foreground shadow-sm' : 'hover:bg-accent/60 text-muted-foreground hover:text-foreground'
              }`}
            >
              <CreditCard className="h-4 w-4" />
              <span>Credits</span>
            </button>

            {isAccountOwner && (
              <button
                onClick={() => onTabChange('billing')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-sm font-medium transition-colors ${
                  activeTab === 'billing' ? 'bg-primary/10 text-foreground shadow-sm' : 'hover:bg-accent/60 text-muted-foreground hover:text-foreground'
                }`}
              >
                <Settings className="h-4 w-4" />
                <span>Billing</span>
              </button>
            )}

            {isAccountOwner && (
              <button
                onClick={() => onTabChange('invoices')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-sm font-medium transition-colors ${
                  activeTab === 'invoices' ? 'bg-primary/10 text-foreground shadow-sm' : 'hover:bg-accent/60 text-muted-foreground hover:text-foreground'
                }`}
              >
                <FileText className="h-4 w-4" />
                <span>Invoices</span>
              </button>
            )}

          
          </nav>
        </aside>

        <main className="min-w-0">
          {children}
        </main>
    </div>
  );
}
