import type { Metadata } from "next";
import { Lora, DM_Mono, Crimson_Pro, Geist } from "next/font/google";
import { NeonAuthUIProvider } from "@neondatabase/auth/react";
import { authClient } from "@/lib/auth-client";
import { PageTransitionProvider } from "@/components/ui/page-transition";
import { ThemeProvider } from "next-themes";

import "./globals.css";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const lora = Lora({
  variable: "--font-lora",
  subsets: ["latin"],
  weight: ["400", "500"],
  style: ["normal", "italic"],
});

const dmMono = DM_Mono({
  variable: "--font-dm-mono",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
});

const crimsonPro = Crimson_Pro({
  variable: "--font-crimson-pro",
  subsets: ["latin"],
  weight: ["300", "400"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "Rele",
  description:
    "Sensible configuration, zero setup pain. The easiest way to get a capable agent running.",
  icons: {},
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={cn("font-sans", geist.variable)}>
      <body
        className={`${lora.variable} ${dmMono.variable} ${crimsonPro.variable} antialiased`}
      >
        <NeonAuthUIProvider
          authClient={authClient}
          redirectTo="/console"
          localization={{
            EMAIL_PLACEHOLDER: "you@example.com",
          }}
          basePath="/"
          viewPaths={{
            SIGN_IN: "sign-in",
            SIGN_UP: "sign-up",
          }}
          social={{
            providers: ["github", "google"],
          }}
        >
          <PageTransitionProvider><ThemeProvider attribute="class" defaultTheme="system" enableSystem>{children}</ThemeProvider></PageTransitionProvider>
        </NeonAuthUIProvider>
      </body>
    </html>
  );
}
