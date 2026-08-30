import type { NextConfig } from "next";

// O navegador só fala com a própria origem do Next.js — o rewrite encaminha
// /api/* pro backend real por trás. Isso evita que o front e a API fiquem em
// domínios diferentes, o que quebraria os cookies httpOnly (SameSite bloqueia
// cookies em requisições cross-site vindas do navegador).
const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:3001";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${BACKEND_URL}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
