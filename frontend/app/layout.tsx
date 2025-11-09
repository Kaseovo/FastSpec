import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FastSpec - OpenAPI Editor",
  description: "Create, edit, and validate your OpenAPI specifications",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
