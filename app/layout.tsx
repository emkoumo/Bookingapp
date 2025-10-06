import type { Metadata } from "next";
import { Geologica } from 'next/font/google'
import "./globals.css";

const geologica = Geologica({
  subsets: ['latin', 'greek'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: "Booking Management",
  description: "Internal booking management system for Evaggelia & Elegancia",
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="el">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" />
        <meta name="theme-color" content="#3b82f6" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Booking App" />
      </head>
      <body className={`${geologica.className} antialiased`}>
        {children}
      </body>
    </html>
  );
}
