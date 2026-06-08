import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Activity, HardDrive, CheckCircle2, XCircle, Clock,
  AlertTriangle, RefreshCw, TrendingUp, Calendar, ChevronRight,
  WifiOff,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { useDevices } from "@/hooks/useDevices";
import { getSchedules } from "@/services/schedules";
import { getBackupExecutions, getBackupExecutionStats } from "@/services/backupExecutions";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO, differenceInDays, subDays, startOfDay } from "date-fns";
import { ptBR, enUS } from "date-fns/locale";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";

type PeriodDays = 7 | 30 | 90;

const Dashboard = () => {
  const { locale } = useAuth();
  const { t } = useTranslation("dashboard");
  const navigate = useNavigate();
  const dateFnsLocale = locale === "pt-BR" ? ptBR : enUS;

  const [period, setPeriod] = useState<PeriodDays>(7);

  const { data: devicesData } = useDevices({ page: 1, page_size: 200 });

  const { data: schedules = [] } = useQuery({
    queryKey: ["schedules"],
    queryFn: getSchedules,
    staleTime: 5 * 60 * 1000,
  });

  const { data: execStats } = useQuery({
    queryKey: ["backup-execution-stats", period],
    queryFn: () => getBackupExecutionStats({ days: period }),
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
  });

  const { data: recentExecutions, isLoading: executionsLoading } = useQuery({
    queryKey: ["backup-executions-recent"],
    queryFn: () => getBackupExecutions({ page: 1, page_size: 10 }),
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000,
  });

  // Fetch enough for trend chart
  const { data: allRecentExecutions } = useQuery({
    queryKey: ["backup-executions-trend", period],
    queryFn: () => getBackupExecutions({ page: 1, page_size: 500 }),
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
  });

  const { data: failedExecutions } = useQuery({
    queryKey: ["backup-executions-failed"],
    queryFn: () => getBackupExecutions({ page: 1, page_size: 50, status: "failed" }),
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000,
  });

  const devices = devicesData?.items || [];

  // ── Stats cards (4 cards) ───────────────────────────────────────────────
  const stats = useMemo(() => {
    const totalDevices = devicesData?.total ?? devices.length;
    const scheduledActive = schedules.filter((s) => s.is_active).length;
    const successRate = execStats?.success_rate ?? 0;
    const changeRate = execStats?.change_rate ?? 0;
    const failures = execStats?.failed_executions ?? 0;

    return [
      {
        label: t("stats.devices"),
        value: totalDevices.toString(),
        icon: HardDrive,
        color: "text-blue-500",
        bg: "bg-blue-500/10",
        onClick: () => navigate("/devices"),
      },
      {
        label: t("stats.successRate"),
        value: `${successRate}%`,
        icon: TrendingUp,
        color: successRate >= 90 ? "text-green-500" : successRate >= 70 ? "text-yellow-500" : "text-red-500",
        bg: successRate >= 90 ? "bg-green-500/10" : successRate >= 70 ? "bg-yellow-500/10" : "bg-red-500/10",
        onClick: undefined,
      },
      {
        label: t("stats.changeRate"),
        value: `${changeRate}%`,
        icon: Activity,
        color: "text-cyan-500",
        bg: "bg-cyan-500/10",
        onClick: undefined,
      },
      {
        label: t("stats.failures", { period }),
        value: failures.toString(),
        icon: XCircle,
        color: failures > 0 ? "text-red-500" : "text-muted-foreground",
        bg: failures > 0 ? "bg-red-500/10" : "bg-muted/30",
        onClick: undefined,
      },
      {
        label: t("stats.schedules"),
        value: scheduledActive.toString(),
        icon: Clock,
        color: "text-orange-500",
        bg: "bg-orange-500/10",
        onClick: () => navigate("/schedules"),
      },
    ];
  }, [devices, devicesData?.total, schedules, execStats, t, period, navigate]);

  // ── Trend chart data ────────────────────────────────────────────────────
  const trendData = useMemo(() => {
    const executions = allRecentExecutions?.items ?? [];
    const cutoff = startOfDay(subDays(new Date(), period - 1));
    const days: Record<string, { success: number; failed: number }> = {};

    for (let i = period - 1; i >= 0; i--) {
      const d = format(subDays(new Date(), i), "dd/MM");
      days[d] = { success: 0, failed: 0 };
    }

    for (const exec of executions) {
      if (!exec.started_at) continue;
      const date = parseISO(exec.started_at);
      if (date < cutoff) continue;
      const key = format(date, "dd/MM");
      if (!days[key]) continue;
      if (exec.status === "success") days[key].success++;
      else days[key].failed++;
    }

    return Object.entries(days).map(([date, v]) => ({ date, ...v }));
  }, [allRecentExecutions, period]);

  // ── Recent executions ───────────────────────────────────────────────────
  const recentJobs = useMemo(() => {
    if (!recentExecutions?.items) return [];
    return recentExecutions.items.slice(0, 8).map((exec) => ({
      id: exec.id,
      deviceId: exec.device_id,
      device: exec.device?.name ?? "Device",
      status: exec.status,
      configChanged: exec.config_changed,
      time: exec.started_at ? format(parseISO(exec.started_at), "HH:mm", { locale: dateFnsLocale }) : "--:--",
      date: exec.started_at ? format(parseISO(exec.started_at), "dd/MM", { locale: dateFnsLocale }) : "",
      duration: exec.duration_seconds != null ? `${exec.duration_seconds}s` : "-",
      triggeredBy: exec.triggered_by,
      errorMessage: exec.error_message,
    }));
  }, [recentExecutions, dateFnsLocale]);

  // ── Stale devices — usa last_backup_at direto do model de device ────────
  const staleDevices = useMemo(() => {
    return devices
      .map((dev) => {
        const lastBackup = dev.last_backup_at ? parseISO(dev.last_backup_at) : null;
        const daysAgo = lastBackup ? differenceInDays(new Date(), lastBackup) : null;
        return { id: dev.id, name: dev.name, daysAgo };
      })
      .filter((d) => d.daysAgo === null || d.daysAgo > 7)
      .sort((a, b) => {
        if (a.daysAgo === null && b.daysAgo === null) return 0;
        if (a.daysAgo === null) return -1;
        if (b.daysAgo === null) return 1;
        return b.daysAgo - a.daysAgo;
      })
      .slice(0, 8);
  }, [devices]);

  // ── Alerts: grouped by device ──────────────────────────────────────────
  const groupedAlerts = useMemo(() => {
    const items = failedExecutions?.items ?? [];
    const groups: Record<string, { deviceId: string; device: string; count: number; lastTime: string; lastError: string | null }> = {};
    for (const exec of items) {
      const key = exec.device_id;
      if (!groups[key]) {
        groups[key] = {
          deviceId: exec.device_id,
          device: exec.device?.name ?? "Device",
          count: 0,
          lastTime: exec.started_at ? format(parseISO(exec.started_at), "dd/MM HH:mm", { locale: dateFnsLocale }) : "",
          lastError: exec.error_message,
        };
      }
      groups[key].count++;
    }
    return Object.values(groups).sort((a, b) => b.count - a.count).slice(0, 8);
  }, [failedExecutions, dateFnsLocale]);

  // ── Next schedules ──────────────────────────────────────────────────────
  const nextSchedules = useMemo(() => {
    return schedules
      .filter((s) => s.is_active && s.next_run_at)
      .sort((a, b) => new Date(a.next_run_at!).getTime() - new Date(b.next_run_at!).getTime())
      .slice(0, 4)
      .map((s) => ({
        id: s.id,
        name: s.name,
        nextRun: s.next_run_at ? format(parseISO(s.next_run_at), "dd/MM HH:mm", { locale: dateFnsLocale }) : "",
        type: s.schedule_type,
      }));
  }, [schedules, dateFnsLocale]);

  const periodLabel = { 7: "7d", 30: "30d", 90: "90d" } as const;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t("title")}</h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>
        {/* Period selector */}
        <div className="flex gap-1 rounded-lg border p-1 bg-muted/30">
          {([7, 30, 90] as PeriodDays[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                period === p
                  ? "bg-background shadow-sm font-medium text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {periodLabel[p]}
            </button>
          ))}
        </div>
      </div>

      {/* Stats — 4 cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {stats.map((stat) => (
          <Card
            key={stat.label}
            className={stat.onClick ? "cursor-pointer hover:shadow-md transition-shadow" : ""}
            onClick={stat.onClick}
          >
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className={`rounded-lg p-2 ${stat.bg}`}>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold leading-tight">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Trend chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4" />
            {t("trend")} — {period}d
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={trendData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gSuccess" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gFailed" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11 }}
                interval={period === 7 ? 0 : period === 30 ? 4 : 13}
                className="fill-muted-foreground"
              />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} className="fill-muted-foreground" />
              <Tooltip
                contentStyle={{ fontSize: 12 }}
                formatter={(val: number, name: string) => [val, name === "success" ? t("success") : t("failed")]}
              />
              <Area type="monotone" dataKey="success" stroke="#22c55e" strokeWidth={2} fill="url(#gSuccess)" />
              <Area type="monotone" dataKey="failed" stroke="#ef4444" strokeWidth={2} fill="url(#gFailed)" />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Row 2: Recent executions + Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent executions */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4" />
                {t("recentExecutions")}
              </span>
              <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => navigate("/backups")}>
                {t("viewAll")} <ChevronRight className="h-3 w-3 ml-1" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {executionsLoading ? (
                <p className="text-sm text-muted-foreground">{t("loading")}</p>
              ) : recentJobs.length > 0 ? (
                recentJobs.map((job) => (
                  <div
                    key={job.id}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/devices/${job.deviceId}`)}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {job.status === "success" && (
                        <CheckCircle2 className={`h-4 w-4 shrink-0 ${job.configChanged ? "text-green-500" : "text-blue-400"}`} />
                      )}
                      {job.status === "failed" && <XCircle className="h-4 w-4 shrink-0 text-red-500" />}
                      {job.status === "timeout" && <Clock className="h-4 w-4 shrink-0 text-orange-500" />}
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{job.device}</p>
                        <p className="text-xs text-muted-foreground">
                          {job.date} {job.time}
                          {job.triggeredBy === "scheduled" && ` · ${t("scheduled")}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
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
                <p className="text-sm text-muted-foreground">{t("noExecutions")}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Alerts — grouped by device */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                {t("alerts")}
                {groupedAlerts.length > 0 && (
                  <Badge variant="destructive" className="text-xs h-5">{groupedAlerts.length}</Badge>
                )}
              </span>
              {groupedAlerts.length > 0 && (
                <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => navigate("/backups?status=failed")}>
                  {t("viewAll")} <ChevronRight className="h-3 w-3 ml-1" />
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {groupedAlerts.length > 0 ? (
                groupedAlerts.map((alert) => (
                  <div
                    key={alert.deviceId}
                    className="flex items-start justify-between p-2 rounded-lg border border-destructive/20 bg-destructive/5 hover:bg-destructive/10 cursor-pointer transition-colors"
                    onClick={() => navigate(`/devices/${alert.deviceId}`)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm truncate">{alert.device}</p>
                        <span className="text-xs text-muted-foreground shrink-0">{alert.lastTime}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                        {alert.lastError || t("failed")}
                      </p>
                    </div>
                    <Badge variant="destructive" className="shrink-0 ml-2 text-xs">
                      {alert.count}x
                    </Badge>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <CheckCircle2 className="h-10 w-10 text-green-500 mb-2" />
                  <p className="text-sm font-medium">{t("noAlerts")}</p>
                  <p className="text-xs text-muted-foreground mt-1">{t("allBackupsOk")}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Row 3: Stale devices + Next schedules */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Devices without recent backup */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2">
                <WifiOff className="h-4 w-4 text-yellow-500" />
                {t("staleDevices")}
                {staleDevices.length > 0 && (
                  <Badge variant="outline" className="text-xs h-5 text-yellow-600 border-yellow-500/50">
                    {staleDevices.length}
                  </Badge>
                )}
              </span>
              <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => navigate("/devices")}>
                {t("viewAll")} <ChevronRight className="h-3 w-3 ml-1" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {staleDevices.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <CheckCircle2 className="h-10 w-10 text-green-500 mb-2" />
                <p className="text-sm font-medium">{t("allDevicesRecent")}</p>
              </div>
            ) : (
              <div className="space-y-1">
                {staleDevices.map((dev) => (
                  <div
                    key={dev.id}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/devices/${dev.id}`)}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <HardDrive className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <p className="text-sm font-medium truncate">{dev.name}</p>
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-xs shrink-0 ${
                        dev.daysAgo === null
                          ? "text-red-500 border-red-500/50"
                          : dev.daysAgo > 30
                          ? "text-orange-500 border-orange-500/50"
                          : "text-yellow-600 border-yellow-500/50"
                      }`}
                    >
                      {dev.daysAgo === null ? t("neverBacked") : t("daysAgo", { count: dev.daysAgo })}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upcoming schedules */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-blue-500" />
                {t("upcomingSchedules")}
              </span>
              <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => navigate("/schedules")}>
                {t("viewAll")} <ChevronRight className="h-3 w-3 ml-1" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {nextSchedules.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Clock className="h-10 w-10 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">{t("noSchedules")}</p>
              </div>
            ) : (
              <div className="space-y-1">
                {nextSchedules.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => navigate("/schedules")}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Clock className="h-4 w-4 shrink-0 text-orange-400" />
                      <p className="text-sm font-medium truncate">{s.name}</p>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">{s.nextRun}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
