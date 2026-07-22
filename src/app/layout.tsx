import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import type { ReactNode } from "react";

import { ThemeToggle } from "@/components/theme-toggle";
import "./globals.css";

// Runs before first paint: sets <html data-theme> from the saved choice, or
// the OS preference otherwise. Inlined (not a component) so there is no
// flash of the wrong theme on load. Kept dependency-free and tiny.
const themeInitScript = `
(function(){try{
  var t = localStorage.getItem('digivixo-theme');
  if(t!=='light'&&t!=='dark'){
    t = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  document.documentElement.dataset.theme = t;
}catch(e){document.documentElement.dataset.theme='light';}})();
`;

// Two type roles per the design doc: a grotesk with character for
// display/headers, a highly legible workhorse for body and dense tables.
// next/font self-hosts both at build time — no runtime font requests.
const display = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "600", "700"],
});

const body = Inter({
  subsets: ["latin"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: "Digivixo",
  description: "Managed voice AI platform",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${body.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        {children}
        <ThemeToggle />
      </body>
    </html>
  );
}
