import './global.css';
import { Providers } from './providers';
import { Layout } from '@/components/layout';
import clsx from 'clsx';
import { Nunito } from 'next/font/google';
import { siteConfig } from '@/config/site';
import type { Metadata } from 'next';

const nunito = Nunito({
  subsets: ['latin'],
  variable: '--font-nunito',
  display: 'swap',
  weight: ['200', '300', '400', '500', '600', '700', '800', '900'],
});

export const metadata: Metadata = {
  title: siteConfig.name,
  description: siteConfig.description,
  icons: {
    icon: siteConfig.icon,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={nunito.variable} suppressHydrationWarning>
      <head>
        <link rel="stylesheet" href="https://use.typekit.net/kgm2xsf.css" />
      </head>
      <body
        className={clsx('min-h-screen bg-background antialiased')}
        suppressHydrationWarning
      >
        <Providers>
          <Layout>{children}</Layout>
        </Providers>
      </body>
    </html>
  );
}
