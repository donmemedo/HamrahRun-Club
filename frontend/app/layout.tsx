import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import "@fontsource-variable/vazirmatn";
import "@fontsource-variable/inter";
import "./globals.css";
import { Nav, Providers, TabBar } from "@/components/ui";
import type { Lang } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "همراه‌ران | HamrahRun Club",
  description: "باشگاه خدمات و مزایای خودرو — تخفیف شرکا، امداد ۲۴ ساعته، کارشناسی و بازار خودرو اعضا.",
  appleWebApp: { capable: true, title: "همراه‌ران", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f5f7" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const jar = await cookies();
  const lang: Lang = jar.get("lang")?.value === "en" ? "en" : "fa";
  const theme = jar.get("theme")?.value;
  return (
    <html lang={lang} dir={lang === "fa" ? "rtl" : "ltr"} data-theme={theme === "dark" || theme === "light" ? theme : undefined} suppressHydrationWarning>
      <body className="min-h-dvh overflow-x-clip">
        <Providers lang={lang}>
          <Nav />
          <main className="pb-28 md:pb-0">{children}</main>
          <TabBar />
        </Providers>
      </body>
    </html>
  );
}
