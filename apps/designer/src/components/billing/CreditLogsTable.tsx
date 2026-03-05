"use client";

import { useEffect, useMemo, useState } from 'react';

type CreditTxn = {
  id: string;
  account_id: string;
  user_id: string | null;
  instance_id: string | null;
  delta_credits: number; // positive for add, negative for consume
  balance_after: number | null;
  type: string; // e.g., manual_purchase, auto_purchase, generation_charge, refund
  description: string | null;
  created_at: string;
};

interface Props {
  accountId: string;
}

export function CreditLogsTable({ accountId }: Props) {
  const [transactions, setTransactions] = useState<CreditTxn[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>('all');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/user-subscriptions/credit-transactions?accountId=${accountId}`);
        if (!res.ok) throw new Error('Failed to load credit transactions');
        const data = await res.json();
        setTransactions(data.transactions || []);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    };
    if (accountId) load();
  }, [accountId]);

  const filtered = useMemo(() => {
    if (filterType === 'all') return transactions;
    return transactions.filter(t => t.type === filterType);
  }, [transactions, filterType]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {loading ? 'Loading transactions…' : `${filtered.length} transactions`}
          {error && <span className="text-red-600 ml-2">{error}</span>}
        </div>
        <div className="flex items-center gap-2">
          <select
            className="h-8 rounded border border-border bg-background text-sm px-2"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="all">All</option>
            <option value="credit_reload">Credit Reloads</option>
            <option value="image_gen">Image Generation</option>
            <option value="email_lead">Email Leads</option>
            <option value="phone_lead">Phone Leads</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto rounded border border-border max-h-[60vh] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted sticky top-0 z-10">
            <tr>
              <th className="text-left p-2 font-medium">When</th>
              <th className="text-left p-2 font-medium">Type</th>
              <th className="text-right p-2 font-medium">Credits</th>
              <th className="text-left p-2 font-medium">Instance</th>
              <th className="text-left p-2 font-medium">Description</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(tx => {
              const deltaFmt = (tx.delta_credits >= 0 ? '+' : '') + tx.delta_credits;
              const when = new Date(tx.created_at).toLocaleString();
              return (
                <tr key={tx.id} className="border-t border-border">
                  <td className="p-2 whitespace-nowrap">{when}</td>
                  <td className="p-2 whitespace-nowrap">{tx.type}</td>
                  <td className={`p-2 text-right whitespace-nowrap ${tx.delta_credits >= 0 ? 'text-green-600' : 'text-red-600'}`}>{deltaFmt}</td>
                  <td className="p-2 whitespace-nowrap">{tx.instance_id ?? '-'}</td>
                  <td className="p-2">{tx.description ?? '-'}</td>
                </tr>
              )
            })}
            {filtered.length === 0 && !loading && (
              <tr>
                <td colSpan={5} className="p-4 text-center text-muted-foreground">No transactions</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}


