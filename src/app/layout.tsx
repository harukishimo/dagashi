import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";

const title = "駄菓子 おかいもの体験";
const description = "子どもが自分で選び、買い物と10秒チャレンジを楽しむ駄菓子のおかいもの体験アプリ";
const deploymentHost = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;

export const metadata: Metadata = {
  metadataBase: new URL(deploymentHost ? `https://${deploymentHost}` : "http://localhost:3000"),
  title,
  description,
  icons: {
    icon: "/brand/dagashi-app-icon.png",
    apple: "/brand/dagashi-app-icon.png",
  },
  openGraph: {
    type: "website",
    locale: "ja_JP",
    title,
    description,
    images: [
      {
        url: "/brand/dagashi-app-overview.png",
        width: 1200,
        height: 630,
        alt: "駄菓子のおかいもの、10秒チャレンジ、スタンプを楽しむ子ども向け体験アプリ",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/brand/dagashi-app-overview.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
