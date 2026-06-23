import type { MetadataRoute } from "next";

// Lets cadets "Add to Home Screen" and launch FitRep without browser chrome (no URL bar/nav).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FitRep — OCS Fitness Coach",
    short_name: "FitRep",
    description: "Your personal fitness coach.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#F5F7FA",
    theme_color: "#F5F7FA",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
