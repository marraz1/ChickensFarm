"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    // redirect: false + manual navigation keeps the flow robust across
    // next-auth option-name changes and lets us refresh server state.
    await signOut({ redirect: false });
    router.push("/login");
    router.refresh();
  }

  return (
    <Button
      type="button"
      variant="outline"
      className="h-11 w-full"
      disabled={loading}
      onClick={handleLogout}
    >
      <LogOut size={16} aria-hidden />
      {loading ? "Atsijungiama..." : "Atsijungti"}
    </Button>
  );
}
