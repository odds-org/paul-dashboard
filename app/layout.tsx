import type { Metadata } from 'next'
import { Barlow_Condensed, JetBrains_Mono } from 'next/font/google'
import './globals.css'

const barlow = Barlow_Condensed({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-barlow',
  display: 'swap',
})

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Paul Monitor',
  description: 'Real-time analytics for Paul Agent — DoradoBet',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${barlow.variable} ${jetbrains.variable}`}>
      <body>{children}</body>
    </html>
  )
}
