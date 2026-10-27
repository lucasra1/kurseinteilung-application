import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  reactCompiler: true,
  // The admin area used to live under /admin; old links (also in sent emails) keep working.
  redirects() {
    return [
      { source: "/admin", destination: "/termine", permanent: false },
      {
        source: "/admin/termine/:id",
        destination: "/termine?termin=:id",
        permanent: false,
      },
      {
        source: "/admin/kurse/neu",
        destination: "/kurse/neu",
        permanent: false,
      },
      {
        source: "/admin/kurse/:id",
        destination: "/kurse/:id",
        permanent: false,
      },
      { source: "/admin/personen", destination: "/personen", permanent: false },
      {
        source: "/admin/einstellungen",
        destination: "/personen",
        permanent: false,
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
