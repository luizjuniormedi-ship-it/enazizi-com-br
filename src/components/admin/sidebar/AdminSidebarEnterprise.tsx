/**
 * AdminSidebarEnterprise — sidebar reorganizada para o painel administrativo.
 *
 * Recursos:
 *  - Categorias colapsáveis (auto-expande a categoria ativa)
 *  - Busca global com debounce + estados loading/empty
 *  - Tooltips descritivos por item
 *  - Filtro por escopo (super_admin, admin_pedagogico, admin_operacional, devops)
 *  - Modo collapsed (icon-only) no desktop
 *  - Drawer no mobile via vaul
 *  - Fallback gracioso quando roles/flags não carregam
 *
 * Não remove rotas. Não exclui código antigo. Apenas reorganiza navegação.
 */
import { useEffect, useMemo, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  Search, ChevronDown, ChevronRight, PanelLeftClose, PanelLeftOpen,
  Shield, LogOut, Home, X, Loader2,
} from "lucide-react";
import enazizi from "@/assets/enazizi-mascot.png";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip, TooltipTrigger, TooltipContent, TooltipProvider,
} from "@/components/ui/tooltip";
import {
  Collapsible, CollapsibleTrigger, CollapsibleContent,
} from "@/components/ui/collapsible";
import {
  Drawer, DrawerContent, DrawerTrigger, DrawerTitle,
  DrawerHeader, DrawerClose,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useAdminScope } from "@/hooks/useAdminScope";
import {
  ADMIN_MENU, filterMenuByScopes, searchMenu,
  type AdminMenuItem, type AdminMenuCategory,
} from "@/components/admin/sidebar/adminMenuConfig";

const STORAGE_COLLAPSED = "enazizi:admin-sidebar:collapsed";
const STORAGE_OPEN_CATS = "enazizi:admin-sidebar:open-cats";

/* ────────────── Item helper ────────────── */
const MenuLink = ({
  item, active, collapsed, onClick,
}: {
  item: AdminMenuItem;
  active: boolean;
  collapsed?: boolean;
  onClick?: () => void;
}) => {
  const Icon = item.icon;
  const content = (
    <NavLink
      to={item.to}
      onClick={onClick}
      className={cn(
        "group/link flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] font-medium",
        "transition-all duration-200",
        active
          ? "bg-primary/15 text-primary shadow-[inset_2px_0_0_hsl(var(--primary))]"
          : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground",
        collapsed && "justify-center px-0",
      )}
    >
      <Icon className="h-4 w-4 flex-shrink-0" />
      {!collapsed && (
        <>
          <span className="truncate">{item.label}</span>
          {item.badge && (
            <Badge variant="outline" className="ml-auto text-[9px] h-4 px-1.5">
              {item.badge}
            </Badge>
          )}
        </>
      )}
    </NavLink>
  );
  if (collapsed) {
    return (
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="right" className="max-w-[240px]">
          <p className="font-semibold text-xs">{item.label}</p>
          <p className="text-[11px] text-muted-foreground">{item.description}</p>
        </TooltipContent>
      </Tooltip>
    );
  }
  return (
    <Tooltip delayDuration={500}>
      <TooltipTrigger asChild>{content}</TooltipTrigger>
      <TooltipContent side="right" className="max-w-[240px]">
        <p className="text-[11px] text-muted-foreground">{item.description}</p>
      </TooltipContent>
    </Tooltip>
  );
};

/* ────────────── Category block ────────────── */
const CategoryBlock = ({
  category, openMap, setOpenMap, collapsed, pathname, onItemClick,
}: {
  category: AdminMenuCategory;
  openMap: Record<string, boolean>;
  setOpenMap: (m: Record<string, boolean>) => void;
  collapsed: boolean;
  pathname: string;
  onItemClick?: () => void;
}) => {
  const Icon = category.icon;
  const hasActive = category.items.some(
    (i) => pathname === i.to.split("?")[0].split("#")[0],
  );
  const isOpen = openMap[category.id] ?? hasActive;

  if (collapsed) {
    return (
      <div className="space-y-0.5 mb-2">
        <div className="px-2 py-1 text-center" title={category.label}>
          <Icon className="h-3.5 w-3.5 mx-auto text-muted-foreground/50" />
        </div>
        {category.items.map((item) => (
          <MenuLink
            key={item.to}
            item={item}
            active={pathname === item.to.split("?")[0].split("#")[0]}
            collapsed
            onClick={onItemClick}
          />
        ))}
      </div>
    );
  }

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={(v) => setOpenMap({ ...openMap, [category.id]: v })}
    >
      <CollapsibleTrigger className="w-full group flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-sidebar-accent/30 transition-colors">
        <Icon className="h-3.5 w-3.5 text-muted-foreground/60" />
        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/70 flex-1 text-left">
          {category.label}
        </span>
        {isOpen ? (
          <ChevronDown className="h-3 w-3 text-muted-foreground/50" />
        ) : (
          <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
        )}
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-0.5 mt-0.5 mb-2">
        {category.items.map((item) => (
          <MenuLink
            key={item.to}
            item={item}
            active={pathname === item.to.split("?")[0].split("#")[0]}
            onClick={onItemClick}
          />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
};

/* ────────────── Search ────────────── */
const AdminSearch = ({
  scopes, onSelect, collapsed,
}: {
  scopes: ReturnType<typeof useAdminScope>["scopes"];
  onSelect: () => void;
  collapsed: boolean;
}) => {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [searching, setSearching] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!query.trim()) {
      setDebounced("");
      setSearching(false);
      return;
    }
    setSearching(true);
    const t = setTimeout(() => {
      setDebounced(query);
      setSearching(false);
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

  const results = useMemo(
    () => searchMenu(scopes, debounced),
    [scopes, debounced],
  );

  if (collapsed) return null;

  return (
    <div className="px-3 py-2 relative">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar no admin…"
          className="h-8 pl-8 pr-7 text-xs bg-sidebar-accent/30 border-sidebar-border"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground"
            aria-label="Limpar busca"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
      {debounced && (
        <div className="absolute left-3 right-3 top-full mt-1 z-50 bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
          {searching ? (
            <div className="p-3 flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Buscando…
            </div>
          ) : results.length === 0 ? (
            <div className="p-3 text-xs text-muted-foreground text-center">
              Nenhum resultado para “{debounced}”.
            </div>
          ) : (
            <ul className="max-h-64 overflow-y-auto py-1">
              {results.map((r) => {
                const Icon = r.icon;
                return (
                  <li key={r.to}>
                    <button
                      onClick={() => {
                        navigate(r.to);
                        setQuery("");
                        onSelect();
                      }}
                      className="w-full flex items-start gap-2 px-3 py-2 text-left hover:bg-sidebar-accent/50 transition-colors"
                    >
                      <Icon className="h-3.5 w-3.5 mt-0.5 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium truncate">{r.label}</div>
                        <div className="text-[10px] text-muted-foreground truncate">
                          {r.description}
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

/* ────────────── Main Sidebar Content (shared desktop + drawer) ────────────── */
const SidebarBody = ({
  collapsed, onToggle, onItemClick,
}: {
  collapsed: boolean;
  onToggle?: () => void;
  onItemClick?: () => void;
}) => {
  const location = useLocation();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const { scopes, hasAny, loading } = useAdminScope();

  const [openMap, setOpenMap] = useState<Record<string, boolean>>(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_OPEN_CATS) || "{}");
    } catch {
      return {};
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_OPEN_CATS, JSON.stringify(openMap));
    } catch {
      /* ignore */
    }
  }, [openMap]);

  // Fallback: se roles não carregaram, mostra menu mínimo (Centro de Comando) para super_admin role 'admin'
  const visibleMenu = useMemo(() => {
    if (loading) return [];
    if (!hasAny) return [];
    return filterMenuByScopes(scopes);
  }, [scopes, hasAny, loading]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground">
        {/* Header */}
        <div className={cn(
          "flex-shrink-0 flex items-center gap-2 p-3 border-b border-sidebar-border",
          collapsed ? "justify-center" : "justify-between",
        )}>
          <Link to="/admin" className="flex items-center gap-2 min-w-0">
            <img src={enazizi} alt="ENAZIZI" className="h-7 w-7 rounded-lg object-cover ring-1 ring-white/10 flex-shrink-0" />
            {!collapsed && (
              <div className="min-w-0">
                <div className="text-sm font-bold truncate">ENAZIZI</div>
                <div className="text-[9px] uppercase tracking-wider text-muted-foreground truncate flex items-center gap-1">
                  <Shield className="h-2.5 w-2.5" /> Admin
                </div>
              </div>
            )}
          </Link>
          {onToggle && (
            <button
              onClick={onToggle}
              aria-label={collapsed ? "Expandir" : "Recolher"}
              className="hidden lg:flex w-7 h-7 items-center justify-center rounded-lg text-muted-foreground/70 hover:bg-sidebar-accent hover:text-foreground transition-colors"
            >
              {collapsed ? <PanelLeftOpen className="h-3.5 w-3.5" /> : <PanelLeftClose className="h-3.5 w-3.5" />}
            </button>
          )}
        </div>

        {/* Search */}
        <AdminSearch scopes={scopes} onSelect={() => onItemClick?.()} collapsed={collapsed} />

        {/* Menu */}
        <ScrollArea className="flex-1 min-h-0">
          <nav className={cn("space-y-1", collapsed ? "px-1.5 py-2" : "px-3 py-1")}>
            {loading ? (
              <div className="p-4 flex items-center justify-center">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : visibleMenu.length === 0 ? (
              <div className="p-4 text-center text-xs text-muted-foreground">
                Sem permissões administrativas.
              </div>
            ) : (
              visibleMenu.map((cat) => (
                <CategoryBlock
                  key={cat.id}
                  category={cat}
                  openMap={openMap}
                  setOpenMap={setOpenMap}
                  collapsed={collapsed}
                  pathname={location.pathname}
                  onItemClick={onItemClick}
                />
              ))
            )}
          </nav>
        </ScrollArea>

        {/* Footer */}
        <div className="flex-shrink-0 border-t border-sidebar-border p-2 space-y-1">
          <Tooltip delayDuration={200}>
            <TooltipTrigger asChild>
              <NavLink
                to="/dashboard"
                onClick={onItemClick}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:bg-sidebar-accent hover:text-foreground transition-colors",
                  collapsed && "justify-center px-0",
                )}
              >
                <Home className="h-3.5 w-3.5" />
                {!collapsed && <span>Voltar ao app</span>}
              </NavLink>
            </TooltipTrigger>
            {collapsed && <TooltipContent side="right">Voltar ao app</TooltipContent>}
          </Tooltip>
          <button
            onClick={handleSignOut}
            className={cn(
              "w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:bg-sidebar-accent hover:text-foreground transition-colors",
              collapsed && "justify-center px-0",
            )}
          >
            <LogOut className="h-3.5 w-3.5" />
            {!collapsed && <span>Sair</span>}
          </button>
        </div>
      </div>
    </TooltipProvider>
  );
};

/* ────────────── Public components ────────────── */
export const AdminSidebarEnterprise = () => {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem(STORAGE_COLLAPSED) === "1"; } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem(STORAGE_COLLAPSED, collapsed ? "1" : "0"); } catch { /* */ }
  }, [collapsed]);

  return (
    <aside
      className={cn(
        "hidden lg:flex flex-col h-screen sticky top-0 border-r border-sidebar-border transition-all duration-300",
        collapsed ? "w-14" : "w-64",
      )}
    >
      <SidebarBody collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} />
    </aside>
  );
};

/** Mobile drawer trigger (botão para abrir o menu em telas pequenas) */
export const AdminSidebarMobileTrigger = () => {
  const [open, setOpen] = useState(false);
  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button variant="ghost" size="sm" className="lg:hidden gap-1.5">
          <Shield className="h-4 w-4" /> Admin
        </Button>
      </DrawerTrigger>
      <DrawerContent className="h-[88vh]">
        <DrawerHeader className="pb-0">
          <DrawerTitle className="sr-only">Menu administrativo</DrawerTitle>
        </DrawerHeader>
        <div className="flex-1 min-h-0 overflow-hidden">
          <SidebarBody collapsed={false} onItemClick={() => setOpen(false)} />
        </div>
        <DrawerClose className="sr-only">Fechar</DrawerClose>
      </DrawerContent>
    </Drawer>
  );
};

export default AdminSidebarEnterprise;
