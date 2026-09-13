import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TRẠM COWORKING SPACE — Quản lý đặt chỗ",
    short_name: "TRẠM",
    description: "Hệ thống quản lý đặt chỗ TRẠM COWORKING SPACE",
    start_url: "/",
    display: "standalone",
    background_color: "#f3efda",
    theme_color: "#2c4a38",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
