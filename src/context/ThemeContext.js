import React, { createContext, useContext, useState, useEffect } from "react";

export const THEMES = {
  rainbow: {
    id: "rainbow", label: "🌈 Rainbow",
    sidebar: "linear-gradient(160deg,#312e81 0%,#4f46e5 50%,#7c3aed 100%)",
    loginBg: "linear-gradient(145deg,#312e81 0%,#4f46e5 40%,#7c3aed 70%,#be185d 100%)",
    bodyBg: "#fef9ff", primary: "#6366f1", dot: "#6366f1",
  },
  ocean: {
    id: "ocean", label: "🌊 Ocean",
    sidebar: "linear-gradient(160deg,#0c4a6e 0%,#0369a1 50%,#0891b2 100%)",
    loginBg: "linear-gradient(145deg,#0c4a6e 0%,#0369a1 40%,#0891b2 70%,#06b6d4 100%)",
    bodyBg: "#f0fbff", primary: "#0891b2", dot: "#0891b2",
  },
  forest: {
    id: "forest", label: "🌲 Forest",
    sidebar: "linear-gradient(160deg,#14532d 0%,#15803d 50%,#16a34a 100%)",
    loginBg: "linear-gradient(145deg,#14532d 0%,#15803d 40%,#16a34a 70%,#22c55e 100%)",
    bodyBg: "#f0fff4", primary: "#16a34a", dot: "#16a34a",
  },
  candy: {
    id: "candy", label: "🌸 Candy",
    sidebar: "linear-gradient(160deg,#831843 0%,#be185d 50%,#ec4899 100%)",
    loginBg: "linear-gradient(145deg,#831843 0%,#be185d 40%,#ec4899 70%,#f9a8d4 100%)",
    bodyBg: "#fff0f8", primary: "#ec4899", dot: "#ec4899",
  },
  space: {
    id: "space", label: "🚀 Space",
    sidebar: "linear-gradient(160deg,#0a0514 0%,#1e1040 50%,#2d1b69 100%)",
    loginBg: "linear-gradient(145deg,#050210 0%,#1e1040 40%,#4c1d95 70%,#7c3aed 100%)",
    bodyBg: "#f5f0ff", primary: "#8b5cf6", dot: "#8b5cf6",
  },
};

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [themeId, setThemeId] = useState(() => {
    const saved = localStorage.getItem("vvv_theme");
    return THEMES[saved] ? saved : "rainbow";
  });

  useEffect(() => {
    document.body.style.backgroundColor = THEMES[themeId].bodyBg;
    localStorage.setItem("vvv_theme", themeId);
  }, [themeId]);

  return (
    <ThemeContext.Provider value={{ themeId, setThemeId, themeConfig: THEMES[themeId], THEMES }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() { return useContext(ThemeContext); }
