import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('http://localhost:13000'),
  title: 'AI Employee OS · CoolAir HVAC',
  description: 'The AI operations platform for HVAC service teams. Every employee, customer, and workflow stays connected.',
  icons: {
    icon: '/brand/favicon.svg',
    shortcut: '/brand/app-icon-light-48.png',
    apple: '/brand/app-icon-light-180.png',
  },
  openGraph: {
    title: 'AI Employee OS · HVAC Field Service',
    description: 'Your service team, connected from the first call to the final follow-up.',
    images: [{ url: '/marketing/open-graph.webp', width: 1200, height: 630, alt: 'AI Employee OS for HVAC field service' }],
  },
  twitter: {
    card: 'summary_large_image',
    images: ['/marketing/open-graph.webp'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
