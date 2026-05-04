import type { Metadata } from 'next'
import './globals.css'
import { Navigation } from '@/components/layout/Navigation'
import { Toaster } from '@/components/ui/sonner'

export const metadata: Metadata = {
  title: 'Baubegehungsberichte',
  description: 'KI-gestütztes Berichtstool für Baustellenbegehungen',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="de">
      <body className="antialiased">
        <Navigation />
        {children}
        <Toaster />
      </body>
    </html>
  )
}
