// js/core/room-templates.js
// Single source of truth for category LAYOUT — used by both room.html (full storefront) and
// marketplace.html (directory preview cards), so a room always looks the same everywhere it appears.
// Colours and font are NOT per category any more: every room uses the one BSTM theme
// (css/bstm-theme.css). A category only chooses its card layout, grid, label and tagline.

const THEME = {
  bodyBg: "var(--bstm-bg)",
  bannerBg: "var(--bstm-grad)",
  accent: "#00708E",
  font: "inherit",
};

export const ROOM_TEMPLATES = {
  "fresh-produce": {
    ...THEME,
    label: "Market Stall",
    cardGrid: "grid-cols-2 md:grid-cols-3",
    cardStyle: "market",
    tagline: "🌾 Farm Fresh",
  },
  agriculture: {
    ...THEME,
    label: "Market Stall",
    cardGrid: "grid-cols-2 md:grid-cols-3",
    cardStyle: "market",
    tagline: "🌾 Farm Fresh",
  },
  electronics: {
    ...THEME,
    label: "Tech Store",
    cardGrid: "grid-cols-2 md:grid-cols-4",
    cardStyle: "tech",
    tagline: "⚡ Latest Tech",
  },
  fashion: {
    ...THEME,
    label: "Boutique",
    cardGrid: "grid-cols-2 md:grid-cols-3",
    cardStyle: "boutique",
    tagline: "✨ Curated Style",
  },
  home: {
    ...THEME,
    label: "Home Store",
    cardGrid: "grid-cols-2 md:grid-cols-3",
    cardStyle: "catalog",
    tagline: "🏡 For Your Home",
  },
  vehicles: {
    ...THEME,
    label: "Showroom",
    cardGrid: "grid-cols-1 md:grid-cols-2",
    cardStyle: "showroom",
    tagline: "🚗 Showroom",
  },
  services: {
    ...THEME,
    label: "Services",
    cardGrid: "grid-cols-1",
    cardStyle: "service-list",
    tagline: "🔧 Professional Services",
  },
  "food-beverage": {
    ...THEME,
    label: "Food & Drink",
    cardGrid: "grid-cols-2 md:grid-cols-3",
    cardStyle: "market",
    tagline: "☕ Fresh Every Day",
  },
  catering: {
    ...THEME,
    label: "Catering",
    cardGrid: "grid-cols-1 md:grid-cols-2",
    cardStyle: "service-list",
    tagline: "🍽️ Events & Orders",
  },
  retail: {
    ...THEME,
    label: "Shop",
    cardGrid: "grid-cols-2 md:grid-cols-4",
    cardStyle: "catalog",
    tagline: "🛍️ Everyday Essentials",
  },
  "car-wash": {
    ...THEME,
    label: "Car Wash",
    cardGrid: "grid-cols-1",
    cardStyle: "service-list",
    tagline: "🚿 Shine On",
  },
};

export const DEFAULT_ROOM_TEMPLATE = {
  ...THEME,
  label: "General Store",
  cardGrid: "grid-cols-2 md:grid-cols-4",
  cardStyle: "catalog",
  tagline: "🏪 Welcome",
};

export function getRoomTemplate(category) {
  return ROOM_TEMPLATES[category] || DEFAULT_ROOM_TEMPLATE;
}
