import { z } from "zod";
export const themes = {
  mishka: {
    name: "Mishka",
    note: "The coziest court",
    sky: "#dcd6c9",
    floor: "#c9bca5",
    court: "#849075",
    line: "#ebe7d6",
    accent: "#b4c875",
    light: "#fff1d8",
    shirts: ["#b2c47c", "#b7987f"],
  },
  lab: {
    name: "Rally Lab",
    note: "Quiet focus",
    sky: "#18342f",
    floor: "#18342f",
    court: "#286557",
    line: "#e6eee0",
    accent: "#e6a76e",
    light: "#eaf5e3",
    shirts: ["#ed8658", "#64bfb0"],
  },
  wii: {
    name: "Wii Resort",
    note: "A little island time",
    sky: "#a5ddef",
    floor: "#ddf0cc",
    court: "#49a5db",
    line: "#ffffff",
    accent: "#ffb94c",
    light: "#fff5d9",
    shirts: ["#fa714c", "#429ee8"],
  },
  open: {
    name: "US Open",
    note: "Under the stadium lights",
    sky: "#121c39",
    floor: "#304565",
    court: "#3367cd",
    line: "#ecf2ff",
    accent: "#d5f15e",
    light: "#e1ebff",
    shirts: ["#cfa957", "#67b7cf"],
  },
  neon: {
    name: "Neon Nights",
    note: "After-hours practice",
    sky: "#100b23",
    floor: "#1a1230",
    court: "#513377",
    line: "#deacf6",
    accent: "#ff80c3",
    light: "#cab0ff",
    shirts: ["#ff8bc2", "#55e0db"],
  },
  club: {
    name: "Club House",
    note: "Back to your home court",
    sky: "#dfd9c8",
    floor: "#bf956a",
    court: "#2b6855",
    line: "#efe8d6",
    accent: "#e5a347",
    light: "#fff1ce",
    shirts: ["#edb56a", "#71a895"],
  },
} as const;
export const themeSchema = z.enum(["lab", "wii", "open", "neon", "club", "mishka"]);
export type ThemeId = z.infer<typeof themeSchema>;
export type Theme = (typeof themes)[ThemeId];
export function readTheme(): ThemeId {
  const parsed = themeSchema.safeParse(localStorage.getItem("rallylab-theme"));
  return parsed.success ? parsed.data : "lab";
}
