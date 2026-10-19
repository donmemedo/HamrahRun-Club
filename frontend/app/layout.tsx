import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { cookies } from "next/headers";
import "./globals.css";
import { Nav, Providers, TabBar } from "@/components/ui";
import { dicts } from "@/lib/i18n";
import { getLang } from "@/lib/server";

// One 46 KB variable file covers every Persian weight; Latin glyphs fall through to the system font.
const vazir = localFont({
  src: "../node_modules/@fontsource-variable/vazirmatn/files/vazirmatn-arabic-wght-normal.woff2",
  weight: "100 900",
  variable: "--font-vazir",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const d = dicts[await getLang()];
  return {
    title: { default: d.meta.title, template: `%s · ${d.brand}` },
    description: d.meta.description,
    appleWebApp: { capable: true, title: d.brand, statusBarStyle: "black-translucent" },
  };
}

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
  const lang = await getLang();
  const theme = jar.get("theme")?.value;
  return (
    <html lang={lang} dir={lang === "fa" ? "rtl" : "ltr"} className={vazir.variable}
      data-theme={theme === "dark" || theme === "light" ? theme : undefined} suppressHydrationWarning>
      <body className="min-h-dvh overflow-x-clip">
        <Providers lang={lang} authed={jar.has("hr_session")}>
          <Nav />
          <main id="main" className="pb-28 md:pb-0">{children}</main>
          <TabBar />
        </Providers>
      </body>
    </html>
  );
}
