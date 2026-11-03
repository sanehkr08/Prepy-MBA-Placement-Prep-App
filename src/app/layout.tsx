import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Prepy · Interview prep from your own story",
  description:
    "Upload your resume, add any job description, and get a fit map, a role prep kit and scored practice.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
