import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ToastProvider } from '@/components/ui/toast';

export const metadata: Metadata = {
  title: {
    default: 'Rotaract Event Reporting CRM',
    template: '%s · Rotaract CRM',
  },
  description:
    'Report a Rotaract event in a few minutes: answer a handful of questions, add photos, and the club gets structured data, an organised Google Drive and reports on demand.',
};

export const viewport: Viewport = {
  themeColor: '#cd2a63',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
