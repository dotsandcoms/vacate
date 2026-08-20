import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import AppShell from "@/components/AppShell";
import { getCurrentUser } from "@/lib/auth";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "UTF-Leave — Urban Task Force Leave Management System  ",
  description:
    "UTF-Leave is a zero-touch leave management system for Urban Task Force. It is a web application that allows employees to apply for leave, view their leave balance, and manage their leave requests.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getCurrentUser();
  return (
    <html lang="en" className={jakarta.variable}>
      <body className="font-sans">
        <AppShell user={user}>{children}</AppShell>
      </body>
    </html>
  );
}
