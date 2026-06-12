import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EyS Aplicaciones",
  description: "Aplicacion web para registro y administracion de horas"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
