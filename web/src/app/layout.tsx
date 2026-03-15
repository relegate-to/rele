import type { Metadata } from "next";
import { Lora, DM_Mono, Crimson_Pro } from "next/font/google";
import { NeonAuthUIProvider } from "@neondatabase/auth/react";
import { authClient } from "@/lib/auth-client";
import { PageTransitionProvider } from "@/components/page-transition";
import "./globals.css";

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
  icons: {
    }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${lora.variable} ${dmMono.variable} ${crimsonPro.variable} antialiased`}
      >
        <NeonAuthUIProvider authClient={authClient} redirectTo="/home" defaultTheme="dark">
          <PageTransitionProvider>{children}</PageTransitionProvider>
        </NeonAuthUIProvider>
      </body>
    </html>
  );
}
