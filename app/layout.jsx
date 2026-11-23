import '../src/styles.css';

export const metadata = {
  title: 'Coy · Discover',
  description: 'Discover people, like privately, and connect when the feeling is mutual.',
  icons: { icon: '/favicon.svg' },
  openGraph: {
    title: 'Coy · Discover',
    description: 'Discover people and connect when the feeling is mutual.',
    type: 'website',
  },
};

export const viewport = { width: 'device-width', initialScale: 1, themeColor: '#ffffff' };

export default function RootLayout({ children }) {
  return <html lang="en" data-type="software" data-radius="round">
    <head>
      <meta name="page-type" content="software" />
      <meta name="site-kind" content="software" />
      <link rel="stylesheet" href="/fonts/dm-sans.css" />
      <link rel="stylesheet" href="/fonts/manrope.css" />
    </head>
    <body>
      <a className="skip-link" href="#main">Skip to content</a>
      {children}
    </body>
  </html>;
}
