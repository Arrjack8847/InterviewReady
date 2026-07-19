import { useEffect, useState } from "react";

function readVisibility() {
  return typeof document === "undefined" || document.visibilityState !== "hidden";
}

export function usePageVisibility() {
  const [visible, setVisible] = useState(readVisibility);

  useEffect(() => {
    const update = () => setVisible(readVisibility());
    document.addEventListener("visibilitychange", update);
    window.addEventListener("pageshow", update);
    window.addEventListener("pagehide", update);
    return () => {
      document.removeEventListener("visibilitychange", update);
      window.removeEventListener("pageshow", update);
      window.removeEventListener("pagehide", update);
    };
  }, []);

  return visible;
}
