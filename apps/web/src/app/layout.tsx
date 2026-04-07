import type { Metadata } from 'next'
import { Space_Grotesk, Inter, JetBrains_Mono } from 'next/font/google'
import './globals.css'

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--loaded-headline',
  display: 'swap',
})
const inter = Inter({
  subsets: ['latin'],
  variable: '--loaded-body',
  display: 'swap',
})
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--loaded-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Remotty',
  description: 'Agent Orchestrator',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${inter.variable} ${jetbrainsMono.variable}`}>
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0"
        />
      </head>
      <body className="bg-background text-on-surface font-body antialiased">
        {children}
      </body>
    </html>
  )
}
