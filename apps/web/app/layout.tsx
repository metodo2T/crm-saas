import { ClerkProvider } from '@clerk/nextjs';
import { QueryProvider } from '@/lib/query-client';
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CRM — Tráfego Pago',
  description: 'CRM para agências de tráfego pago',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="pt-BR">
        <body>
          <QueryProvider>{children}</QueryProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
