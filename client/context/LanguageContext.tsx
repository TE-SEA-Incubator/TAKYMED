import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import fr from "@/locales/fr.json";
import en from "@/locales/en.json";

type Language = "fr" | "en";

const translations: Record<Language, Record<string, any>> = { fr, en };

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
  toggleLanguage: () => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

function getNestedValue(obj: any, key: string): string {
  return key.split(".").reduce((o, k) => (o && o[k] !== undefined ? o[k] : key), obj);
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem("takymed_lang");
    return (saved === "en" || saved === "fr") ? saved : "fr";
  });

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem("takymed_lang", lang);
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguage(language === "fr" ? "en" : "fr");
  }, [language, setLanguage]);

  const t = useCallback((key: string): string => {
    return getNestedValue(translations[language], key);
  }, [language]);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, toggleLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
