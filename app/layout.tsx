import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import { SettingsMenu } from "./settings-menu";
import { themeBootScript } from "./theme";

export const metadata: Metadata = {
  title: "Simple Finance",
  description: "Your private monthly budget.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "light dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Script id="theme-boot" strategy="beforeInteractive">{themeBootScript}</Script>
        <main>{children}</main>
        <SettingsMenu />
      </body>
    </html>
  );
}
