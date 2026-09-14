import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TRẠM COWORKING SPACE — Quản lý đặt chỗ",
  description: "Hệ thống quản lý đặt chỗ TRẠM COWORKING SPACE",
  appleWebApp: {
    title: "TRẠM",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="vi" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
