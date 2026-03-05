'use client'
import { User } from '@supabase/supabase-js';
import React, { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

interface StripePricingTableProps extends React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> {
  'pricing-table-id': string;
  'publishable-key': string;
}

// Extend JSX namespace for Stripe pricing table
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      'stripe-pricing-table': StripePricingTableProps;
    }
  }
}

type Props = {
  user: User;
}

const StripePricingTable = ({ user }: Props) => {
  const searchParams = useSearchParams();
  const accountId = searchParams.get('accountId');

  useEffect(() => {
    const script = document.createElement('script');
    script.src = "https://js.stripe.com/v3/pricing-table.js";
    script.async = true;

    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    }
  }, []);

  // Use accountId if available, otherwise fall back to user.id
  const clientReferenceId = accountId ? `${accountId}:${user.id}` : user.id;

  return (
    <div className='flex flex-1 flex-col w-full'>
      <stripe-pricing-table
          pricing-table-id="prctbl_1P0TL0C3ic5Sd20TGpWOU2Fi"
          publishable-key="pk_live_51P0SikC3ic5Sd20T9QRaRKIkqy8l951LDgeOxcP24ZRXHnQzjnOFM7tfhsYdWksn1wNBdejJzvaxXGq0yRAxm14A00Py0XreGk"
          client-reference-id={clientReferenceId}
          customer-email={user.email}
      >
      </stripe-pricing-table>
    </div>
  );
}

export default StripePricingTable;
