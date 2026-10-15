import { useEffect, useState } from "react";
import { Toaster as Sonner } from "sonner";
import { getStoredTheme, THEME_CHANGE_EVENT, type Theme } from "@/lib/theme";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  // Toasts follow the app's theme toggle, not only the system setting.
  const [theme, setTheme] = useState<Theme>(getStoredTheme);
  useEffect(() => {
    const follow = () => setTheme(getStoredTheme());
    window.addEventListener(THEME_CHANGE_EVENT, follow);
    return () => window.removeEventListener(THEME_CHANGE_EVENT, follow);
  }, []);

  return (
    <Sonner
      theme={theme}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-secondary group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
