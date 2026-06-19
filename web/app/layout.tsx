import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EyS Bitacora",
  description: "Registro de horas y atenciones"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
