import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./useAuth";
import { community, type Roles } from "@/lib/community";

export function useRoles() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["roles", user?.id],
    enabled: !!user,
    queryFn: () => community<Roles>("giro_roles"),
  });
}
