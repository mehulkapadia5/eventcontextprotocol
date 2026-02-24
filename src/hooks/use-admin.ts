import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./use-auth";

export function useAdmin() {
  const { session, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Wait for auth to finish loading first
    if (authLoading) return;

    if (!session?.user?.id) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    (supabase.rpc as any)("has_role", { _user_id: session.user.id, _role: "admin" })
      .then(({ data, error }: { data: boolean | null; error: any }) => {
        if (error) {
          console.error("has_role check failed:", error);
          setIsAdmin(false);
        } else {
          setIsAdmin(!!data);
        }
        setLoading(false);
      });
  }, [session?.user?.id, authLoading]);

  return { isAdmin, loading };
}
