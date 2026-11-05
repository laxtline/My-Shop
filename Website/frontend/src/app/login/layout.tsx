import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sign In — Ramachandra Traders",
  description: "Sign in to access your account, cart, orders, and checkout.",
};

export default function LoginLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link
          rel="preload"
          href="/fonts/open-sans-latin-wght-normal.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body className="antialiased bg-slate-50">
        {children}
      </body>
    </html>
  );
}