import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CEH AI | ClearPath Edu Hub - Graduation Ceremony 2026",
  description: "CEH AI - Official AI Assistant for ClearPath Edu Hub's End of Year / Graduation Ceremony. Featuring AI Chat, Face Recognition Attendance, and Cybersecurity Quiz Challenge.",
  keywords: ["CEH", "ClearPath Edu Hub", "Graduation Ceremony", "AI Assistant", "Cybersecurity Quiz"],
  authors: [{ name: "ClearPath Students" }],
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🎓</text></svg>",
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[#fdf8f0] text-gray-900`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
