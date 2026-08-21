import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Finance OS",
    short_name: "Finance OS",
    description: "Track company revenue, personal spending, subscriptions, and debts in one place.",
    start_url: "/",
    display: "standalone",
    background_color: "#070B16",
    theme_color: "#070B16",
    icons: [
      { src: "/icon1", sizes: "192x192", type: "image/png" },
      { src: "/icon2", sizes: "512x512", type: "image/png" },
    ],
  };
}
