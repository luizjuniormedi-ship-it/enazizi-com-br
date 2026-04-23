import { Link, useLocation } from "react-router-dom";
import { Home, GraduationCap, Clapperboard, Bot, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useState, useEffect, useRef } from "react";

const BottomTabBar = () => {
  const location = useLocation();
  const { user } = useAuth();
  const [hidden, setHidden] = useState(false);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const main = document.querySelector(".dashboard-main");
    if (!main) return;
    const onScroll = () => {
      const y = main.scrollTop;
      setHidden(y > lastScrollY.current && y > 60);
      lastScrollY.current = y;
    };
    main.addEventListener("scroll", onScroll, { passive: true });
    return () => main.removeEventListener("scroll", onScroll);
  }, []);

  const { data: pendingCount } = useQuery({
    queryKey: ["bottom-tab-pending", user?.id],
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      const { count } = await supabase
        .from("revisoes")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user!.id)
        .eq("status", "pendente");
      return count || 0;
    },
  });

  const { data: unreadMessages } = useQuery({
    queryKey: ["bottom-tab-messages", user?.id],
    enabled: !!user,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data: reads } = await supabase
        .from("admin_message_reads")
        .select("message_id")
        .eq("user_id", user!.id);
      const readIds = (reads || []).map(r => r.message_id);

      let query = supabase
        .from("admin_messages")
        .select("id", { count: "exact", head: true });
      
      if (readIds.length > 0) {
        query = query.not("id", "in", `(${readIds.join(",")})`);
      }
      
      const { count } = await query;
      return count || 0;
    },
  });

  // Bottom nav minimalista: 5 áreas — Visão Geral / Estudar / ENAFLIX / IA / Perfil.
  // Visão Geral = panorama (entender). Estudar = execução (fazer).
  const tabs = [
    { to: "/dashboard", icon: Home, label: "Visão Geral", badge: 0 },
    { to: "/dashboard/sessao-estudo", icon: GraduationCap, label: "Estudar", badge: pendingCount || 0 },
    { to: "/enaflix", icon: Clapperboard, label: "ENAFLIX", badge: 0 },
    { to: "/dashboard/chatgpt", icon: Bot, label: "IA", badge: 0 },
    { to: "/dashboard/perfil", icon: User, label: "Perfil", badge: unreadMessages || 0 },
  ];

  return (
    <nav className={cn("landscape-tablet:hidden lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-md border-t border-border safe-area-bottom transition-transform duration-300", hidden && "translate-y-full")}>
      <div className="flex items-center justify-around h-16">
        {tabs.map((tab) => {
          const active =
            tab.to === "/enaflix"
              ? location.pathname.startsWith("/enaflix")
              : location.pathname === tab.to;
          return (
            <Link
              key={tab.to}
              to={tab.to}
              className={cn(
                "relative flex h-full min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 text-[9px] font-medium leading-none transition-all group active:scale-95",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              {/* Active indicator dot */}
              {active && (
                <div className="absolute top-1 w-1 h-1 rounded-full bg-primary animate-in fade-in duration-200" />
              )}
              <div className="relative mt-1">
                <tab.icon className={cn(
                  "h-5 w-5 transition-all duration-200",
                  active ? "text-primary scale-110" : "group-hover:text-foreground/70"
                )} />
                {tab.badge > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold animate-in zoom-in duration-200 shadow-sm">
                    {tab.badge > 99 ? "99+" : tab.badge}
                  </span>
                )}
              </div>
              <span className={cn(
                "text-center leading-[1.05] transition-all duration-200",
                active ? "font-semibold" : ""
              )}>
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomTabBar;
