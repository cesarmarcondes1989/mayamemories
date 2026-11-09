import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    serverActions: { bodySizeLimit: "1mb" },
  },
  async headers() {
    const noindex = [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }];
    // Vitrine (/, /comecar, /demo, /tutoriais, /privacidade) pode aparecer no Google; o resto não
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/:path((?!$|comecar|demo$|tutoriais|privacidade).*)", headers: noindex },
    ];
  },
};

export default nextConfig;
