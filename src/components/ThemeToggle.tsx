"use client";

import { Sun, Moon } from "lucide-react";
import { useTheme } from "./ThemeProvider";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-lg text-tx3 hover:bg-hover hover:text-tx transition"
      title={theme === "dark" ? "Modo claro" : "Modo escuro"}
    >
      {theme === "dark" ? <Sun className="w-[1.15rem] h-[1.15rem]" strokeWidth={1.9} /> : <Moon className="w-[1.15rem] h-[1.15rem]" strokeWidth={1.9} />}
    </button>
  );
}
