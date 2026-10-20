import './globals.css';

export const metadata = {
  title: 'Rentacar JC — Panel Administrativo',
  description: 'Sistema integral de administración de alquiler de motos y carros',
  icons: {
    icon: '/logo.png',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
