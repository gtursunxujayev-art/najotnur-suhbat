import './globals.css';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'Telegram QR Bot',
  description: 'Telegram QR bot with admin panel'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-100">
        {children}
      </body>
    </html>
  );
}
