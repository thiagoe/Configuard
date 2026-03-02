import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Search, CheckCircle2, XCircle, Clock, AlertCircle, Eye, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { ptBR, enUS } from "date-fns/locale";
import { getBackupExecutions, BackupExecution } from "@/services/backupExecutions";
import { getDevices } from "@/services/devices";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";

const Backups = () => {
  const navigate = useNavigate();
  const { locale } = useAuth();
  const { t } = useTranslation("backups");
  const { t: tc } = useTranslation("common");
  const dateFnsLocale = locale === "pt-BR" ? ptBR : enUS;
  const [searchTerm, setSearchTerm] = useState("");
  const [deviceFilter, setDeviceFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Fetch devices for filter dropdown
  const { data: devicesData } = useQuery({
    queryKey: ["devices", { page: 1, page_size: 100 }],
    queryFn: () => getDevices({ page: 1, page_size: 100 }),
  });
  const devices = devicesData?.items || [];

  // Fetch backup executions (all attempts, not just config changes)
  const { data: executionsData, isLoading, refetch } = useQuery({
    queryKey: ["backup-executions-page", {
      device_id: deviceFilter !== "all" ? deviceFilter : undefined,
      status: statusFilter !== "all" ? statusFilter : undefined,
      page,
      page_size: pageSize,
    }],
    queryFn: () => getBackupExecutions({
      device_id: deviceFilter !== "all" ? deviceFilter : undefined,
      status: statusFilter !== "all" ? statusFilter as any : undefined,
      page,
      page_size: pageSize,
    }),
  });

  const executions = executionsData?.items || [];
  const totalPages = executionsData?.total_pages || 1;

  // Filter by search term (device name or IP)
  const filteredExecutions = executions.filter((exec) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      exec.device?.name?.toLowerCase().includes(term) ||
      exec.device?.ip_address?.includes(term)
    );
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "success":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "timeout":
        return <Clock className="h-4 w-4 text-yellow-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "success":
        return <Badge variant="outline" className="border-green-500 text-green-500">{t("status.success")}</Badge>;
      case "failed":
        return <Badge variant="outline" className="border-red-500 text-red-500">{t("status.failed")}</Badge>;
      case "timeout":
        return <Badge variant="outline" className="border-yellow-500 text-yellow-500">{t("status.timeout")}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getMethodBadge = (exec: BackupExecution) => {
    if (exec.triggered_by === "scheduled") {
      return <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20">{t("method.scheduled")}</Badge>;
    }
    return (
      <Badge variant="outline" className="bg-purple-500/10 text-purple-500 border-purple-500/20">
        {t("method.manual")}
      </Badge>
    );
  };

  const getChangeBadge = (exec: BackupExecution) => {
    if (exec.status !== "success") return "-";
    if (exec.config_changed) {
      return <Badge variant="outline" className="border-blue-500 text-blue-500">{t("changed")}</Badge>;
    }
    return <Badge variant="outline" className="text-muted-foreground">{t("unchanged")}</Badge>;
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "-";
    if (seconds < 1) return "<1s";
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const min = Math.floor(seconds / 60);
    const sec = Math.round(seconds % 60);
    return `${min}m ${sec}s`;
  };

  const downloadConfig = async (configId: string, deviceName: string) => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
      const response = await fetch(`${apiUrl}/configurations/${configId}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("access_token")}`,
        },
      });
      const data = await response.json();

      const blob = new Blob([data.config_data], { type: "text/plain" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${deviceName}_v${data.version}_${format(new Date(), "yyyy-MM-dd_HH-mm")}.txt`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Error downloading config:", error);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <CardTitle>{t("historyTitle")}</CardTitle>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              {tc("refresh")}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("searchPlaceholder")}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={deviceFilter} onValueChange={(value) => { setDeviceFilter(value); setPage(1); }}>
              <SelectTrigger className="w-full sm:w-[250px]">
                <SelectValue placeholder={t("filterDevice")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("allDevices")}</SelectItem>
                {devices.map((device) => (
                  <SelectItem key={device.id} value={device.id}>
                    {device.name} ({device.ip_address})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(value) => { setStatusFilter(value); setPage(1); }}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder={t("filterStatus")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("allStatuses")}</SelectItem>
                <SelectItem value="success">{t("status.success")}</SelectItem>
                <SelectItem value="failed">{t("status.failed")}</SelectItem>
                <SelectItem value="timeout">{t("status.timeout")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              {t("loading")}
            </div>
          ) : filteredExecutions.length === 0 ? (
            <div className="text-center py-12 space-y-4">
              <AlertCircle className="h-16 w-16 mx-auto text-muted-foreground opacity-50" />
              <div>
                <p className="text-lg font-medium text-foreground">{t("none")}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {t("noneDesc")}
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("columns.status")}</TableHead>
                      <TableHead>{t("columns.device")}</TableHead>
                      <TableHead>{t("columns.ip")}</TableHead>
                      <TableHead>{t("columns.datetime")}</TableHead>
                      <TableHead>{t("columns.duration")}</TableHead>
                      <TableHead>{t("columns.changed")}</TableHead>
                      <TableHead>{t("columns.method")}</TableHead>
                      <TableHead className="text-center">{t("columns.actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredExecutions.map((exec) => (
                      <TableRow key={exec.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getStatusIcon(exec.status)}
                            {getStatusBadge(exec.status)}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">
                          {exec.device?.name || "-"}
                        </TableCell>
                        <TableCell className="text-muted-foreground font-mono text-sm">
                          {exec.device?.ip_address || "-"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {format(new Date(exec.started_at), "dd/MM/yyyy HH:mm:ss", { locale: dateFnsLocale })}
                        </TableCell>
                        <TableCell className="text-sm">
                          {formatDuration(exec.duration_seconds)}
                        </TableCell>
                        <TableCell>
                          {getChangeBadge(exec)}
                        </TableCell>
                        <TableCell>{getMethodBadge(exec)}</TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => navigate(`/devices/${exec.device_id}/history`)}
                              title={t("viewDeviceHistory")}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {exec.configuration_id && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => downloadConfig(exec.configuration_id!, exec.device?.name || "config")}
                                title={t("downloadConfig")}
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    {tc("pagination", { current: page, total: totalPages, count: executionsData?.total || 0 })}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(page - 1)}
                      disabled={page <= 1}
                    >
                      {tc("previous")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(page + 1)}
                      disabled={page >= totalPages}
                    >
                      {tc("next")}
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Backups;
