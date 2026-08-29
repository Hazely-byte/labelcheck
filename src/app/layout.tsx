import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LabelCheck — Indian Product Label Compliance Flagging",
  description:
    "Upload a photo of any Indian retail product label and instantly check mandatory declarations under Legal Metrology (Packaged Commodities) Rules, 2011.",
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
