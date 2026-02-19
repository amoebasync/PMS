import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Noto_Sans_JP } from "next/font/google";
import "./globals.css";
// Sidebarの直接インポートは不要になり、LayoutWrapperをインポートします
import LayoutWrapper from "@/components/LayoutWrapper";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains" });
const notojp = Noto_Sans_JP({
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  variable: "--font-notojp",
});

export const metadata: Metadata = {
  title: "PMS Pro System",
  description: "Property Management System",
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      {/* bodyタグからは背景色やレイアウト関連のクラスを外し、フォント設定のみ残します */}
      {/* 実際の背景色やレイアウトはLayoutWrapper側で制御します */}
      <body className={`${inter.variable} ${jetbrains.variable} ${notojp.variable} font-sans antialiased text-slate-900 m-0 p-0`}>
        <LayoutWrapper>
          {children}
        </LayoutWrapper>
      </body>
    </html>
  );
}