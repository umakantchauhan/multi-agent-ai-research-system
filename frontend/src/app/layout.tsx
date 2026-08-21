import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ResearchForge — Multi-Agent AI Research System",
  description:
    "Autonomous research agents: Search → Read → Write → Critic. Enter any topic and get a structured report with sources and expert critique.",
  keywords: ["AI Research", "Multi-Agent", "LangChain", "Gemini", "Tavily", "Next.js"],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${mono.variable}`}>
      <body className="antialiased bg-[#fafaf9] dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 selection:bg-violet-200 selection:text-violet-900 dark:selection:bg-violet-900 dark:selection:text-violet-100">
        {children}
      </body>
    </html>
  );
}
