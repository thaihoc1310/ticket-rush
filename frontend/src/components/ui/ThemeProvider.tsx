import { createContext, useContext, useEffect, type ReactNode } from "react";

interface ThemeContextType {
  theme: "light";
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "light",
});

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    document.documentElement.removeAttribute("data-theme");
  }, []);

  return (
    <ThemeContext.Provider value={{ theme: "light" }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function ThemeToggle() {
  return null;
}
