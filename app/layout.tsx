import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ZapMail — Support Agent Dashboard",
  description:
    "ZapMail Agent Hub provides support agents with a comprehensive dashboard for managing customer interactions and intelligence.",
  openGraph: {
    title: "ZapMail — Support Agent Dashboard",
    description: "AI-powered support workspace for ZapMail agents.",
    type: "website",
    images: [
      {
        url: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/536e5b2c-cbc5-4c2b-93e7-aac0ac68836c/id-preview-4e0abaa7--0f45d7a2-5bf6-423f-bf3d-4e9d3fb82a26.lovable.app-1781087930992.png",
      },
    ],
  },
  twitter: {
    card: "summary",
    site: "@Lovable",
    title: "ZapMail — Support Agent Dashboard",
    description: "AI-powered support workspace for ZapMail agents.",
    images: [
      "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/536e5b2c-cbc5-4c2b-93e7-aac0ac68836c/id-preview-4e0abaa7--0f45d7a2-5bf6-423f-bf3d-4e9d3fb82a26.lovable.app-1781087930992.png",
    ],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
