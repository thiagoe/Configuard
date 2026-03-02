import { NavLink, useLocation } from "react-router-dom";
import {
  Server,
  LayoutDashboard,
  HardDrive,
  Settings,
  Shield,
  Tag,
  FolderTree,
  Key,
  FileCode,
  ChevronDown,
  Database,
  GitBranch,
  FileText,
  Search,
  Calendar,
  Users,
  Package,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useTranslation } from "react-i18next";

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const { t } = useTranslation("sidebar");
  const { t: tc } = useTranslation("common");
  const currentPath = location.pathname;
  const collapsed = state === "collapsed";

  const mainItems = [
    { title: t("items.dashboard"), url: "/", icon: LayoutDashboard },
    { title: t("items.devices"), url: "/devices", icon: HardDrive },
    { title: t("items.backups"), url: "/backups", icon: Database },
    { title: t("items.versions"), url: "/versions", icon: GitBranch },
    { title: t("items.diff"), url: "/diff", icon: FileText },
    { title: t("items.search"), url: "/search", icon: Search },
  ];

  const configItems = [
    { title: t("items.templates"), url: "/templates", icon: FileCode },
    { title: t("items.schedules"), url: "/schedules", icon: Calendar },
    { title: t("items.brands"), url: "/brands", icon: Tag },
    { title: t("items.categories"), url: "/categories", icon: FolderTree },
    { title: t("items.models"), url: "/models", icon: Package },
    { title: t("items.credentials"), url: "/credentials", icon: Key },
  ];

  const adminItems = [
    { title: t("items.admin"), url: "/admin", icon: Shield },
    { title: t("items.audit"), url: "/audit", icon: Users },
  ];

  const isActive = (path: string) => currentPath === path;
  const getNavCls = (active: boolean) =>
    active
      ? "bg-primary text-primary-foreground hover:bg-primary/90"
      : "hover:bg-accent hover:text-accent-foreground";

  const isConfigActive = configItems.some((item) => isActive(item.url));

  return (
    <Sidebar collapsible="icon" className="border-r border-border">
      <SidebarContent className="bg-card">
        <div className="px-4 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Server className="h-6 w-6 text-primary" />
            {!collapsed && (
              <div>
                <h2 className="text-sm font-bold">{tc("appName")}</h2>
                <p className="text-xs text-muted-foreground">{tc("appSlogan")}</p>
              </div>
            )}
          </div>
        </div>

        <SidebarGroup>
          <SidebarGroupLabel>{t("sections.main")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild className={getNavCls(isActive(item.url))}>
                    <NavLink to={item.url}>
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>{t("sections.config")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <Collapsible defaultOpen={isConfigActive}>
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton
                      className={getNavCls(isConfigActive)}
                    >
                      <Settings className="h-4 w-4" />
                      {!collapsed && (
                        <>
                          <span>{t("sections.config")}</span>
                          <ChevronDown className="ml-auto h-4 w-4" />
                        </>
                      )}
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  {!collapsed && (
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {configItems.map((item) => (
                          <SidebarMenuSubItem key={item.url}>
                            <SidebarMenuSubButton
                              asChild
                              className={getNavCls(isActive(item.url))}
                            >
                              <NavLink to={item.url}>
                                <item.icon className="h-4 w-4" />
                                <span>{item.title}</span>
                              </NavLink>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  )}
                </SidebarMenuItem>
              </Collapsible>

              {collapsed &&
                configItems.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild className={getNavCls(isActive(item.url))}>
                      <NavLink to={item.url}>
                        <item.icon className="h-4 w-4" />
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>{t("sections.admin")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {adminItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild className={getNavCls(isActive(item.url))}>
                    <NavLink to={item.url}>
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
