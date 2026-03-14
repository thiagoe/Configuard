import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, HardDrive, CheckCircle2, XCircle, Clock, AlertTriangle, RefreshCw, TrendingUp } from "lucide-react";
import { useDevices } from "@/hooks/useDevices";
import { getSchedules } from "@/services/schedules";
import { getBackupExecutions, getBackupExecutionStats } from "@/services/backupExecutions";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { ptBR, enUS } from "date-fns/locale";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";

const Dashboard = () => {
  const { locale } = useAuth();
  const { t } = useTranslation("dashboard");
  const dateFnsLocale = locale === "pt-BR" ? ptBR : enUS;

  const { data: devicesData, isLoading: devicesLoading } = useDevices({ page: 1, page_size: 100 });
  const { data: schedules = [] } = useQuery({
    queryKey: ["schedules"],
    queryFn: getSchedules,
    staleTime: 5 * 60 * 1000, // schedules rarely change — cache 5 min
  });

  // Fetch backup execution statistics (last 7 days)
  const { data: execStats } = useQuery({
    queryKey: ["backup-execution-stats"],
    queryFn: () => getBackupExecutionStats({ days: 7 }),
    staleTime: 60 * 1000, // stats: refresh every 1 min
    refetchInterval: 60 * 1000,
  });

  // Fetch recent backup executions
  const { data: recentExecutions, isLoading: executionsLoading } = useQuery({
    queryKey: ["backup-executions-recent"],
    queryFn: () => getBackupExecutions({ page: 1, page_size: 10 }),
    staleTime: 30 * 1000, // executions: refresh every 30s
    refetchInterval: 30 * 1000,
  });

  // Fetch recent failed executions separately for alerts
  const { data: failedExecutions } = useQuery({
    queryKey: ["backup-executions-failed"],
    queryFn: () => getBackupExecutions({ page: 1, page_size: 20, status: "failed" }),
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000,
  });

  const devices = devicesData?.items || [];

  const stats = useMemo(() => {
    const totalDevices = devicesData?.total ?? devices.length;
    const scheduledActive = schedules.filter((s) => s.is_active).length;

    // Use execution stats for backup metrics
    const totalExecutions = execStats?.total_executions ?? 0;
    const successRate = execStats?.success_rate ?? 0;
    const changeRate = execStats?.change_rate ?? 0;
    const failures = execStats?.failed_executions ?? 0;

    return [
      { label: t("stats.devices"), value: totalDevices.toString(), icon: HardDrive, color: "text-blue-500" },
      { label: t("stats.executions"), value: totalExecutions.toString(), icon: RefreshCw, color: "text-purple-500" },
      { label: t("stats.successRate"), value: `${successRate}%`, icon: TrendingUp, color: "text-green-500" },
      { label: t("stats.failures"), value: failures.toString(), icon: XCircle, color: failures > 0 ? "text-red-500" : "text-muted-foreground" },
      { label: t("stats.schedules"), value: scheduledActive.toString(), icon: Clock, color: "text-orange-500" },
      { label: t("stats.changeRate"), value: `${changeRate}%`, icon: Activity, color: "text-cyan-500" },
    ];
  }, [devices, devicesData?.total, schedules, execStats, t]);

  const recentJobs = useMemo(() => {
    if (!recentExecutions?.items) return [];

    return recentExecutions.items.slice(0, 8).map((exec) => ({
      id: exec.id,
      device: exec.device?.name ?? "Device",
      status: exec.status,
      configChanged: exec.config_changed,
      time: exec.started_at ? format(parseISO(exec.started_at), "HH:mm", { locale: dateFnsLocale }) : "--:--",
      date: exec.started_at ? format(parseISO(exec.started_at), "dd/MM", { locale: dateFnsLocale }) : "",
      duration: exec.duration_seconds ? `${exec.duration_seconds}s` : "-",
      triggeredBy: exec.triggered_by,
      errorMessage: exec.error_message,
    }));
  }, [recentExecutions, dateFnsLocale]);

  const alerts = useMemo(() => {
    const items = failedExecutions?.items ?? [];
    return items.slice(0, 20).map((exec) => ({
      id: exec.id,
      device: exec.device?.name ?? "Device",
      message: exec.status === "failed" ? t("failed") : t("timeout"),
      severity: "high",
      details: exec.error_message,
      time: exec.started_at ? format(parseISO(exec.started_at), "dd/MM HH:mm", { locale: dateFnsLocale }) : "",
    }));
  }, [failedExecutions, t, dateFnsLocale]);

  const isLoading = devicesLoading || executionsLoading;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center">
                <stat.icon className={`h-6 w-6 ${stat.color} mb-2`} />
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Jobs */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              {t("recentExecutions")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {isLoading ? (
                <div className="text-sm text-muted-foreground">{t("loading")}</div>
              ) : recentJobs.length > 0 ? (
                recentJobs.map((job) => (
                  <div key={job.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-3">
                      {job.status === "success" && (
                        <CheckCircle2 className={`h-4 w-4 ${job.configChanged ? "text-green-500" : "text-blue-500"}`} />
                      )}
                      {job.status === "failed" && <XCircle className="h-4 w-4 text-red-500" />}
                      {job.status === "timeout" && <Clock className="h-4 w-4 text-orange-500" />}
                      <div>
                        <p className="font-medium text-sm">{job.device}</p>
                        <p className="text-xs text-muted-foreground">
                          {job.date} {job.time}
                          {job.triggeredBy === "scheduled" && ` ${t("scheduled")}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {job.status === "success" && (
                        <Badge variant={job.configChanged ? "default" : "secondary"} className="text-xs">
                          {job.configChanged ? t("changed") : t("unchanged")}
                        </Badge>
                      )}
                      {job.status === "failed" && (
                        <Badge variant="destructive" className="text-xs">{t("failed")}</Badge>
                      )}
                      {job.status === "timeout" && (
                        <Badge variant="outline" className="text-xs text-orange-500">{t("timeout")}</Badge>
                      )}
                      <span className="text-xs text-muted-foreground w-8 text-right">{job.duration}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-muted-foreground">{t("noExecutions")}</div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Alerts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              {t("alerts")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {isLoading ? (
                <div className="text-sm text-muted-foreground">{t("loading")}</div>
              ) : alerts.length > 0 ? (
                alerts.map((alert) => (
                  <div key={alert.id} className="p-3 rounded-lg border border-destructive/20 bg-destructive/5">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{alert.device}</p>
                          <span className="text-xs text-muted-foreground">{alert.time}</span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {alert.details || alert.message}
                        </p>
                      </div>
                      <Badge variant="destructive" className="shrink-0 ml-2">high</Badge>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <CheckCircle2 className="h-12 w-12 text-green-500 mb-3" />
                  <p className="text-sm text-muted-foreground">{t("noAlerts")}</p>
                  <p className="text-xs text-muted-foreground mt-1">{t("allBackupsOk")}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
