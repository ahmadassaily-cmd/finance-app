import { createBrowserClient } from "@supabase/ssr";

const REMEMBER_KEY = "fos_remember";

function activeStore(): Storage {
  const remember = typeof window !== "undefined" && localStorage.getItem(REMEMBER_KEY) !== "0";
  return remember ? localStorage : sessionStorage;
}

const rememberAwareStorage = {
  getItem: (key: string) => activeStore().getItem(key),
  setItem: (key: string, value: string) => activeStore().setItem(key, value),
  removeItem: (key: string) => {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  },
};

export function setRememberMe(remember: boolean) {
  if (typeof window === "undefined") return;
  localStorage.setItem(REMEMBER_KEY, remember ? "1" : "0");
}

export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  { auth: { storage: rememberAwareStorage } }
);
