import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "react-i18next";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Shield, Database, Settings, Mail, Network, Languages, ArrowLeftRight } from "lucide-react";
import UserManagement from "@/components/admin/UserManagement";
import DatabaseStats from "@/components/admin/DatabaseStats";
import { SystemSettings } from "@/components/admin/SystemSettings";
import { EmailSettings } from "@/components/admin/EmailSettings";
import { LdapSettings } from "@/components/admin/LdapSettings";
import { LanguageSettings } from "@/components/admin/LanguageSettings";
import { DevicesImportExport } from "@/components/admin/DevicesImportExport";
import { useQuery } from "@tanstack/react-query";
import { getDbStats } from "@/services/admin";

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

const OverviewTab = ({ t, tc }: { t: (k: string) => string; tc: (k: string) => string }) => {
  const { data: dbStats, isLoading: dbLoading } = useQuery({
    queryKey: ["db-stats"],
    queryFn: getDbStats,
  });

  const dbStatsList = [
    { label: t("database.stats.users"), value: dbStats?.users ?? 0 },
    { label: t("database.stats.devices"), value: dbStats?.devices ?? 0 },
    { label: t("database.stats.configurations"), value: dbStats?.configurations ?? 0 },
    { label: t("database.stats.templates"), value: dbStats?.templates ?? 0 },
    { label: t("database.stats.credentials"), value: dbStats?.credentials ?? 0 },
    { label: t("database.stats.brands"), value: dbStats?.brands ?? 0 },
    { label: t("database.stats.categories"), value: dbStats?.categories ?? 0 },
    { label: t("database.stats.schedules"), value: dbStats?.schedules ?? 0 },
    { label: t("database.stats.audit"), value: dbStats?.audit_logs ?? 0 },
  ];

  return (
    <div className="space-y-6">
      {/* Status cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("overview.activeUsers")}</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dbStats?.users ?? "-"}</div>
            <p className="text-xs text-muted-foreground">{t("overview.administrator")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("overview.systemStatus")}</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{t("overview.online")}</div>
            <p className="text-xs text-muted-foreground">{t("overview.allServicesOk")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("overview.database")}</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{t("overview.connected")}</div>
            <p className="text-xs text-muted-foreground">
              {dbStats?.db_size_bytes ? formatBytes(dbStats.db_size_bytes) : "PostgreSQL"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("overview.version")}</CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1.0.0</div>
            <p className="text-xs text-muted-foreground">{tc("appName")}</p>
          </CardContent>
        </Card>
      </div>

      {/* Database stats + System settings side by side */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Database stats */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              {t("database.title")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dbLoading ? (
              <div className="text-sm text-muted-foreground">{t("database.loading")}</div>
            ) : (
              <div className="space-y-3">
                {/* Total size highlight */}
                <div className="rounded-md border border-primary/20 bg-primary/5 px-4 py-3 flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">{t("database.stats.totalSize")}</span>
                  <span className="text-lg font-bold">
                    {dbStats?.db_size_bytes ? formatBytes(dbStats.db_size_bytes) : "-"}
                  </span>
                </div>
                <div className="grid gap-3 grid-cols-3">
                  {dbStatsList.map((stat) => (
                    <div key={stat.label} className="rounded-md border p-3">
                      <div className="text-xs text-muted-foreground">{stat.label}</div>
                      <div className="text-xl font-semibold">{stat.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* System settings (security) */}
        <SystemSettings />
      </div>
    </div>
  );
};

const Admin = () => {
  const { user } = useAuth();
  const { t } = useTranslation("admin");
  const { t: tc } = useTranslation("common");

  if (!user || user.role !== "admin") {
    return (
      <div className="min-h-screen bg-background p-6">
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Shield className="h-16 w-16 mx-auto mb-4 opacity-50" />
            <h2 className="text-xl font-semibold mb-2">{tc("accessDenied")}</h2>
            <p>{tc("accessDeniedDesc")}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">{t("title")}</h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">
              <Settings className="h-4 w-4 mr-2" />
              {t("tabs.overview")}
            </TabsTrigger>
            <TabsTrigger value="users">
              <Users className="h-4 w-4 mr-2" />
              {t("tabs.users")}
            </TabsTrigger>
            <TabsTrigger value="email">
              <Mail className="h-4 w-4 mr-2" />
              {t("tabs.email")}
            </TabsTrigger>
            <TabsTrigger value="ldap">
              <Network className="h-4 w-4 mr-2" />
              {t("tabs.ldap")}
            </TabsTrigger>
            <TabsTrigger value="language">
              <Languages className="h-4 w-4 mr-2" />
              {t("tabs.language")}
            </TabsTrigger>
            <TabsTrigger value="importExport">
              <ArrowLeftRight className="h-4 w-4 mr-2" />
              {t("tabs.importExport")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <OverviewTab t={t} tc={tc} />
          </TabsContent>

          <TabsContent value="users">
            <UserManagement />
          </TabsContent>

          <TabsContent value="email">
            <EmailSettings />
          </TabsContent>

          <TabsContent value="ldap">
            <LdapSettings />
          </TabsContent>

          <TabsContent value="language">
            <LanguageSettings />
          </TabsContent>

          <TabsContent value="importExport">
            <DevicesImportExport />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Admin;
