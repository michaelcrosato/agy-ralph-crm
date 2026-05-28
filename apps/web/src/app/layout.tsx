import type React from "react";

export const metadata = {
  title: "Modular CRM Core",
  description: "Ralph Modular CRM Core Operating System shell",
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
