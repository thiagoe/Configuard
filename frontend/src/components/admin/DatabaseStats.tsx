import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { getDbStats } from "@/services/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Database } from "lucide-react";

const DatabaseStats = () => {
  const { t } = useTranslation("admin");
  const { data, isLoading } = useQuery({
    queryKey: ["db-stats"],
    queryFn: getDbStats,
  });

  const stats = [
    { label: t("database.stats.users"), value: data?.users ?? 0 },
    { label: t("database.stats.devices"), value: data?.devices ?? 0 },
    { label: t("database.stats.configurations"), value: data?.configurations ?? 0 },
    { label: t("database.stats.templates"), value: data?.templates ?? 0 },
    { label: t("database.stats.credentials"), value: data?.credentials ?? 0 },
    { label: t("database.stats.brands"), value: data?.brands ?? 0 },
    { label: t("database.stats.categories"), value: data?.categories ?? 0 },
    { label: t("database.stats.schedules"), value: data?.schedules ?? 0 },
    { label: t("database.stats.audit"), value: data?.audit_logs ?? 0 },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-4 w-4" />
          {t("database.title")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-sm text-muted-foreground">{t("database.loading")}</div>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {stats.map((stat) => (
              <div key={stat.label} className="rounded-md border p-3">
                <div className="text-sm text-muted-foreground">{stat.label}</div>
                <div className="text-2xl font-semibold">{stat.value}</div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DatabaseStats;
