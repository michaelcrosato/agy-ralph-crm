import type React from "react";
import "./globals.css";

export const metadata = {
  title: "Modular CRM Core Dashboard",
  description: "Ralph Premium Modular CRM Core Dashboard Portal",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
