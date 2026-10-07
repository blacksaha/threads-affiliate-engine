import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Threads Affiliate Engine',
    short_name: 'ThreadsEngine',
    description: 'Autonomous Affiliate Content Engine for Threads, X, and Facebook',
    start_url: '/',
    display: 'standalone',
    background_color: '#fdfbf7',
    theme_color: '#ffb347',
    orientation: 'portrait-primary',
    icons: [
      {
        src: '/icons/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icons/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/icons/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
