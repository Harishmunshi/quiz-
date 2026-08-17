import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { SCHOOL_LOGO_URL } from "@/lib/theme";
import { Toaster } from "@/components/ui/toaster";

/**
 * Inter carries every word anyone actually reads — questions, names, admin
 * forms. It was drawn for screens, holds up at small sizes on a cheap phone,
 * and its tabular numerals keep the leaderboard from jittering as scores tick.
 */
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

/**
 * Space Grotesk takes the headlines and the big numerals: tight, geometric,
 * slightly mechanical. It is what gives the projector its presence. Used only
 * at large sizes, where its character is an asset rather than a distraction.
 */
const spaceGrotesk = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Islamic Quiz Competition - M.E.S. English Medium School",
  description: "Live quiz competition platform for M.E.S. English Medium School Islamic Quiz Competition.",
  icons: {
    icon: SCHOOL_LOGO_URL,
  },
  // Belt and braces alongside robots.ts: even if a page is reached by a crawler
  // that skipped robots.txt, it asks not to be indexed or cached. A school
  // competition with real students' names on a leaderboard has no business
  // turning up in search results.
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false, noimageindex: true },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${spaceGrotesk.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}