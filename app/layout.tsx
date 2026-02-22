import "./globals.css";
import PrototypeNote from "@/components/PrototypeNote";
import AdBanner from "@/components/AdBanner";

export const metadata = {
  title: "どこでもオモチカメラ",
  description: "おもいでシェアカメラ だれでもオモチカメラ",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <body className="appBody" suppressHydrationWarning>
        {children}

        {/* 全ページ共通 */}
{/* <AdBanner /> */}
<PrototypeNote />
      </body>
    </html>
  );
}