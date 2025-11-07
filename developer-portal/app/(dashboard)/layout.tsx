'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { DashboardSidebar } from '@/components/dashboard/DashboardSidebar';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { ImpersonationBanner } from '@/components/admin/ImpersonationBanner';
import { EmailVerificationBanner } from '@/components/auth/EmailVerificationBanner';
import { useImpersonation } from '@/hooks/use-impersonation';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const {
    isImpersonating,
    merchantId,
    companyName,
    impersonatedBy,
    stopImpersonation,
  } = useImpersonation();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  if (status === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  const handleExitImpersonation = () => {
    stopImpersonation();
    router.push('/admin/merchants');
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <DashboardSidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <DashboardHeader />
        <main className="flex-1 overflow-y-auto p-6">
          {isImpersonating && merchantId && companyName && impersonatedBy && (
            <ImpersonationBanner
              merchantId={merchantId}
              companyName={companyName}
              impersonatedBy={impersonatedBy}
              onExit={handleExitImpersonation}
            />
          )}
          {session.user.emailVerified === false && session.user.email && (
            <EmailVerificationBanner email={session.user.email} />
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
