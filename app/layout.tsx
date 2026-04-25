import type { Metadata } from "next";
import "./globals.css";
import Footer from "../components/Footer";
import AuthProvider from "../components/AuthProvider";
import { Lora, Plus_Jakarta_Sans } from "next/font/google";
import StickyHeader from "@/components/dashboard/StickyHeader";
import { cookies } from "next/headers";

const lora = Lora({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-serif",
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Filmood",
  description:
    "Tell Filmood how you want to feel. It tells you what to watch — alone or as a group.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Theme applied server-side from cookie — Next 16 / React 19 flag the
  // pre-paint <script> tag pattern, this avoids both the warning and a flash.
  const cookieStore = await cookies();
  const themeCookie = cookieStore.get("theme")?.value;
  const theme: "light" | "dark" =
    themeCookie === "light" ? "light" : "dark";

  return (
    <html
      lang="en"
      data-theme={theme}
      suppressHydrationWarning
      className={`${lora.variable} ${jakarta.variable}`}
    >
      <body className="antialiased">
        <AuthProvider>
          <StickyHeader />

          {children}
          <Footer />
        </AuthProvider>
      </body>
    </html>
  );
}
