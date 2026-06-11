import React, { createContext, useContext, useState } from "react";
import { UserDTO, AccountType } from "@shared/api";
import { toast } from "sonner";
import { useLanguage } from "@/context/LanguageContext";

interface AuthContextType {
  user: UserDTO | null;
  isLoading: boolean;
  login: (phone: string, type?: AccountType, pin?: string) => Promise<boolean>;
  register: (phone: string, pin: string, type: AccountType) => Promise<boolean>;
  logout: () => void;
  updateUser: (updatedUser: Partial<UserDTO>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserDTO | null>(() => {
    const saved = sessionStorage.getItem("takymed_user");
    return saved ? JSON.parse(saved) : null;
  });
  const [isLoading, setIsLoading] = useState(false);
  const { t } = useLanguage();

  const login = async (
    phone: string,
    type?: AccountType,
    pin?: string,
  ): Promise<boolean> => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ phone, type, pin }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        const message = errorData?.error || "Authentication failed";
        if (errorData?.pinRegenerated) {
          toast.info(message);
        } else {
          throw new Error(message);
        }
        return false;
      }

      const userData: UserDTO = await response.json();
      setUser(userData);
      sessionStorage.setItem("takymed_user", JSON.stringify(userData));
      return true;
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : t("auth.genericError"),
      );
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (
    phone: string,
    pin: string,
    type: AccountType,
  ): Promise<boolean> => {
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ phone, pin, type }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || "Register failed");
      }

      return true;
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : t("auth.genericError"),
      );
      return false;
    }
  };

  const logout = () => {
    setUser(null);
    sessionStorage.removeItem("takymed_user");
  };

  const updateUser = (updatedUser: Partial<UserDTO>) => {
    if (user) {
      const newUser = { ...user, ...updatedUser };
      setUser(newUser);
      sessionStorage.setItem("takymed_user", JSON.stringify(newUser));
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
