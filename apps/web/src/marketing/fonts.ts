import localFont from "next/font/local";
const inter = localFont({
  src: "./font-assets/inter-latin.woff2",
  display: "swap",
  weight: "100 900",
  variable: "--font-marketing-sans",
});
const instrumentSerif = localFont({
  src: "./font-assets/instrument-serif-italic-latin.woff2",
  display: "swap",
  style: "italic",
  weight: "400",
  variable: "--font-marketing-serif",
});
export const marketingFontClassName = `${inter.variable} ${instrumentSerif.variable} ${inter.className}`;
