import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AI Employee OS · CoolAir HVAC',
  description: 'Your HVAC team, with digital employees that get work done.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
