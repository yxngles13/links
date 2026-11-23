import type { Metadata } from "next";
import { Fredoka, Nunito } from "next/font/google";
import "./globals.css";

// Fredoka for headings, numbers and the wordmark; Nunito for everything else.
const fredoka = Fredoka({
  weight: ["500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-fredoka",
});
const nunito = Nunito({
  weight: ["400", "600", "700"],
  subsets: ["latin"],
  variable: "--font-nunito",
});

export const metadata: Metadata = {
  title: "Links",
  description: "Career copilot for research and networking.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${fredoka.variable} ${nunito.variable}`}>
      <body>{children}</body>
    </html>
  );
}
