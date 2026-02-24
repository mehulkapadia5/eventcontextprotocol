import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./use-auth";

export function useAdmin() {
  const { session } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
  }, [session?.user?.id]);

  return { isAdmin, loading };
}
