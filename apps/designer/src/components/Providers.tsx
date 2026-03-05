"use client";

import { AuthProvider } from '@/contexts/AuthContext';
import { AccountProvider } from '@/contexts/AccountContext';
import { CreditProvider } from '@/contexts/CreditContext';
import { InstanceProvider } from '@/contexts/InstanceContext';
import { ThemeProvider } from '@/components/homepage/theme-provider';
import { UserAccountRelationshipProvider } from '@/contexts/UserAccountRelationshipContext';

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <AuthProvider>
      <UserAccountRelationshipProvider>
        <AccountProvider>
          <CreditProvider>
            <InstanceProvider>
              <ThemeProvider attribute="class" defaultTheme="light" disableTransitionOnChange>
                {children}
              </ThemeProvider>
            </InstanceProvider>
          </CreditProvider>
        </AccountProvider>
      </UserAccountRelationshipProvider>
    </AuthProvider>
  );
} 
