"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Settings, Receipt } from 'lucide-react';

interface InvoicesTabProps {
  hasStripeCustomer: boolean;
  loading: boolean;
  onManageBilling: () => Promise<void>;
}

export function InvoicesTab({
  hasStripeCustomer,
  loading,
  onManageBilling
}: InvoicesTabProps) {
  return (
    <div className="max-w-4xl mx-auto">
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl">Invoices</CardTitle>
              <CardDescription>View and download your billing history</CardDescription>
            </div>
            {hasStripeCustomer && (
              <Button onClick={onManageBilling} disabled={loading} variant="outline" className="h-9">
                <Settings className="h-4 w-4 mr-2" />
                Billing Portal
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Placeholder table until invoices are stored or fetched from Stripe */}
          <div className="rounded border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-2 font-medium">Date</th>
                  <th className="text-left p-2 font-medium">Description</th>
                  <th className="text-right p-2 font-medium">Amount</th>
                  <th className="text-right p-2 font-medium">Status</th>
                  <th className="text-right p-2 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={5} className="p-6 text-center text-muted-foreground">
                    No invoices yet. Once you have billing activity, invoices will appear here.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          {!hasStripeCustomer && (
            <div className="text-center text-xs text-muted-foreground">Add a payment method to start generating invoices.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 