import React from "react";
import logoImg from "./images/takymed1.png";
import "../logo.css";
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  size?: "nav" | "small" | "medium" | "large" | "xl";
  badge?: boolean;
}

const Logo: React.FC<LogoProps> = ({ className, size = "nav", badge = false }) => {
  const image = (
    <img
      src={logoImg}
      alt="TAKYMED Logo"
      className={cn("logo-image", `logo-${size}`, className)}
    />
  );

  if (badge) {
    return <div className={cn("logo-badge", className)}>{image}</div>;
  }

  return <div className="logo-container">{image}</div>;
};

export default Logo;
