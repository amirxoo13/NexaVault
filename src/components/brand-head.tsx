import { useEffect } from "react";
import { useSite } from "@/lib/site-store";

export function BrandHead() {
  const name = useSite((s) => s.brandName);
  const tagline = useSite((s) => s.tagline);
  useEffect(() => {
    document.title = name;
    const apple = document.querySelector('meta[name="apple-mobile-web-app-title"]');
    if (apple) apple.setAttribute("content", name);
    const desc = document.querySelector('meta[name="description"]');
    if (desc) desc.setAttribute("content", `${name} — ${tagline}`);
  }, [name, tagline]);
  return null;
}
