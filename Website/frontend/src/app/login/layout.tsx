import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In — Ramachandra Traders",
  description: "Sign in to access your account, cart, orders, and checkout.",
};

export default function LoginLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
