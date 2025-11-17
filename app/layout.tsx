import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/theme-provider";

import "./globals.css";

import { SessionProvider } from "next-auth/react";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.welthra.ai"),
  title: {
    default:
      "Welthra | Your Agent Copilot for Life Insurance & Wealth Planning",
    template: "%s | Welthra",
  },
  description:
    "Welthra is your AI-powered copilot built exclusively for insurance agents. Structure policies, run premium calculations, catch compliance issues, and generate client-ready proposals in minutes—not hours.",
  keywords: [
    "Welthra",
    "Welthra Co-Pilot",
    "agent copilot",
    "insurance agents",
    "life insurance",
    "IUL",
    "wealth planning",
    "insurance CRM",
    "AI for insurance",
    "policy structuring",
    "premium calculations",
    "compliance guardrails",
  ],
  applicationName: "Welthra",
  authors: [{ name: "Welthra", url: "https://www.welthra.ai" }],
  creator: "Welthra",
  publisher: "Welthra",

  alternates: {
    canonical: "https://www.welthra.ai",
  },

  openGraph: {
    type: "website",
    url: "https://www.welthra.ai",
    siteName: "Welthra",
    title: "Welthra Co-Pilot – AI Copilot for Insurance Agents",
    description:
      "Write high-quality, compliant life insurance policies in minutes. Welthra Co-Pilot helps agents structure cases, compare carriers, run premium estimates, and generate client-ready proposals with built-in compliance guardrails.",
    images: [
      {
        url: "/images/logo.png", // cámbialo a la ruta real de tu imagen
        width: 1200,
        height: 630,
        alt: "Welthra Co-Pilot – AI Copilot for Insurance Agents",
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    title: "Welthra Co-Pilot – AI Copilot for Insurance Agents",
    description:
      "Your AI copilot for life insurance & wealth planning. Structure policies, check carrier-specific requirements, and eliminate compliance guesswork while you close more cases.",
    site: "@tu_handle_aqui", // opcional, si tienes @welthra o similar
    creator: "@tu_handle_aqui", // idem
    images: ["/images/logo.png"],
  },

  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },

  category: "finance",
};

export const viewport = {
  maximumScale: 1, // Disable auto-zoom on mobile Safari
};

const geist = Geist({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-geist",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-geist-mono",
});

const LIGHT_THEME_COLOR = "hsl(0 0% 100%)";
const DARK_THEME_COLOR = "hsl(240deg 10% 3.92%)";
const THEME_COLOR_SCRIPT = `\
(function() {
  var html = document.documentElement;
  var meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    document.head.appendChild(meta);
  }
  function updateThemeColor() {
    var isDark = html.classList.contains('dark');
    meta.setAttribute('content', isDark ? '${DARK_THEME_COLOR}' : '${LIGHT_THEME_COLOR}');
  }
  var observer = new MutationObserver(updateThemeColor);
  observer.observe(html, { attributes: true, attributeFilter: ['class'] });
  updateThemeColor();
})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      className={`${geist.variable} ${geistMono.variable}`}
      lang="en"
      suppressHydrationWarning
    >
      <head>
        <script
          // biome-ignore lint/security/noDangerouslySetInnerHtml: "Required"
          dangerouslySetInnerHTML={{
            __html: THEME_COLOR_SCRIPT,
          }}
        />
      </head>
      <body className="antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          disableTransitionOnChange
          enableSystem
        >
          <Toaster position="top-center" />
          <SessionProvider>{children}</SessionProvider>
        </ThemeProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
