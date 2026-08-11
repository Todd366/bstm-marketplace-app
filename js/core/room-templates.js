// js/core/room-templates.js
// Single source of truth for category visual identity — used by both
// room.html (full storefront) and marketplace.html (directory preview
// cards), so a room always looks the same everywhere it appears.

export const ROOM_TEMPLATES = {
  "fresh-produce": {
    label: "Market Stall",
    bodyBg: "#FBF6EC",
    bannerBg: "linear-gradient(135deg, #166534 0%, #15803D 100%)",
    accent: "#166534",
    font: "'Georgia', serif",
    cardGrid: "grid-cols-2 md:grid-cols-3",
    cardStyle: "market",
    tagline: "🌾 Farm Fresh",
  },
  agriculture: {
    label: "Market Stall",
    bodyBg: "#FBF6EC",
    bannerBg: "linear-gradient(135deg, #166534 0%, #15803D 100%)",
    accent: "#166534",
    font: "'Georgia', serif",
    cardGrid: "grid-cols-2 md:grid-cols-3",
    cardStyle: "market",
    tagline: "🌾 Farm Fresh",
  },
  electronics: {
    label: "Tech Store",
    bodyBg: "#0B1120",
    bannerBg: "linear-gradient(135deg, #1E1B4B 0%, #312E81 100%)",
    accent: "#818CF8",
    font: "'Courier New', monospace",
    cardGrid: "grid-cols-2 md:grid-cols-4",
    cardStyle: "tech",
    tagline: "⚡ Latest Tech",
    dark: true,
  },
  fashion: {
    label: "Boutique",
    bodyBg: "#FDF2F8",
    bannerBg: "linear-gradient(135deg, #831843 0%, #BE185D 100%)",
    accent: "#BE185D",
    font: "'Georgia', serif",
    cardGrid: "grid-cols-2 md:grid-cols-3",
    cardStyle: "boutique",
    tagline: "✨ Curated Style",
  },
  home: {
    label: "Home Store",
    bodyBg: "#FEF7ED",
    bannerBg: "linear-gradient(135deg, #9A3412 0%, #C2410C 100%)",
    accent: "#C2410C",
    font: "'Georgia', serif",
    cardGrid: "grid-cols-2 md:grid-cols-3",
    cardStyle: "catalog",
    tagline: "🏡 For Your Home",
  },
  vehicles: {
    label: "Showroom",
    bodyBg: "#111827",
    bannerBg: "linear-gradient(135deg, #18181B 0%, #3F3F46 100%)",
    accent: "#F59E0B",
    font: "'Arial', sans-serif",
    cardGrid: "grid-cols-1 md:grid-cols-2",
    cardStyle: "showroom",
    tagline: "🚗 Showroom",
    dark: true,
  },
  services: {
    label: "Services",
    bodyBg: "#F0F9FF",
    bannerBg: "linear-gradient(135deg, #075985 0%, #0284C7 100%)",
    accent: "#0284C7",
    font: "'Arial', sans-serif",
    cardGrid: "grid-cols-1",
    cardStyle: "service-list",
    tagline: "🔧 Professional Services",
  },
};

export const DEFAULT_ROOM_TEMPLATE = {
  label: "General Store",
  bodyBg: "#F9FAFB",
  bannerBg: "linear-gradient(135deg, #7C3AED 0%, #4F46E5 100%)",
  accent: "#7C3AED",
  font: "'Arial', sans-serif",
  cardGrid: "grid-cols-2 md:grid-cols-4",
  cardStyle: "catalog",
  tagline: "🏪 Welcome",
};

export function getRoomTemplate(category) {
  return ROOM_TEMPLATES[category] || DEFAULT_ROOM_TEMPLATE;
}
