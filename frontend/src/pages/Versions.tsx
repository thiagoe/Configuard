import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GitBranch, GitCommit, Download, Eye, Clock, RefreshCw, AlertCircle, FileText } from "lucide-react";
import { format } from "date-fns";
import { ptBR, enUS } from "date-fns/locale";
import { getConfigurations } from "@/services/configurations";
import { getDevices } from "@/services/devices";

const Versions = () => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation("backups");
  const dateFnsLocale = i18n.language === "pt-BR" ? ptBR : enUS;

  const [selectedDevice, setSelectedDevice] = useState("all");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const { data: devicesData } = useQuery({
    queryKey: ["devices", { page: 1, page_size: 100 }],
    queryFn: () => getDevices({ page: 1, page_size: 100 }),
  });
  const devices = devicesData?.items || [];

  const { data: configurationsData, isLoading, refetch } = useQuery({
    queryKey: ["configurations", { device_id: selectedDevice !== "all" ? selectedDevice : undefined, page, page_size: pageSize }],
    queryFn: () => getConfigurations({
      device_id: selectedDevice !== "all" ? selectedDevice : undefined,
      page,
      page_size: pageSize,
    }),
  });

  const configurations = configurationsData?.items || [];
  const totalPages = configurationsData?.total_pages || 1;
  const totalConfigs = configurationsData?.total || 0;

  const totalSizeBytes = configurations.reduce((acc, c) => acc + (c.size_bytes || 0), 0);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  const getCommitHash = (id: string) => id.substring(0, 7);

  const downloadConfig = async (configId: string, deviceName: string, version: number) => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8000/api";
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
      a.download = `${deviceName}_v${version}_${format(new Date(), "yyyy-MM-dd_HH-mm")}.txt`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Error downloading config:", error);
    }
  };

  const latestByDevice = new Map<string, string>();
  configurations.forEach((config) => {
    if (!latestByDevice.has(config.device_id)) {
      latestByDevice.set(config.device_id, config.id);
    }
  });

  const getMethodLabel = (method: string) => {
    if (method === "ssh" || method === "telnet") return t("versions.method.manual");
    if (method === "scheduled") return t("versions.method.scheduled");
    return method;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t("versions.title")}</h1>
        <p className="text-muted-foreground">{t("versions.subtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <GitBranch className="h-5 w-5" />
              {t("versions.historyTitle")}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Select value={selectedDevice} onValueChange={(value) => { setSelectedDevice(value); setPage(1); }}>
                <SelectTrigger className="w-full sm:w-[250px]">
                  <SelectValue placeholder={t("versions.selectDevice")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("versions.allDevices")}</SelectItem>
                  {devices.map((device) => (
                    <SelectItem key={device.id} value={device.id}>
                      {device.name} ({device.ip_address})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              {t("versions.loading")}
            </div>
          ) : configurations.length === 0 ? (
            <div className="text-center py-12 space-y-4">
              <AlertCircle className="h-16 w-16 mx-auto text-muted-foreground opacity-50" />
              <div>
                <p className="text-lg font-medium text-foreground">{t("versions.none")}</p>
                <p className="text-sm text-muted-foreground mt-1">{t("versions.noneDesc")}</p>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                {configurations.map((config, index) => {
                  const isLatest = latestByDevice.get(config.device_id) === config.id;

                  return (
                    <div
                      key={config.id}
                      className="relative flex items-start gap-4 p-4 rounded-lg border hover:bg-muted/50 transition-colors"
                    >
                      {index < configurations.length - 1 && (
                        <div className="absolute left-[27px] top-14 bottom-[-16px] w-0.5 bg-border" />
                      )}

                      <div className="flex flex-col items-center gap-2">
                        <div className="p-2 rounded-full bg-primary/10">
                          <GitCommit className="h-4 w-4 text-primary" />
                        </div>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4 mb-2">
                          <div>
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <h3 className="font-semibold">
                                {config.device?.name || t("versions.device")} - {t("versions.version")} {config.version}
                              </h3>
                              <Badge variant="outline" className="text-xs">
                                v{config.version}
                              </Badge>
                              {isLatest && (
                                <Badge className="text-xs">{t("versions.latest")}</Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                              <span className="font-mono">{getCommitHash(config.id)}</span>
                              <span>•</span>
                              <span>{config.device?.name}</span>
                              <span>•</span>
                              <span>{config.device?.ip_address}</span>
                              {config.size_bytes && (
                                <>
                                  <span>•</span>
                                  <span>{formatFileSize(config.size_bytes)}</span>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => navigate(`/devices/${config.device_id}/history`)}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              {t("versions.view")}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => downloadConfig(config.id, config.device?.name || "config", config.version)}
                            >
                              <Download className="h-4 w-4 mr-2" />
                              {t("versions.download")}
                            </Button>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-sm flex-wrap">
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            <span>{format(new Date(config.collected_at), "dd/MM/yyyy HH:mm:ss", { locale: dateFnsLocale })}</span>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {getMethodLabel(config.collection_method)}
                          </Badge>
                          {config.lines_count && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <FileText className="h-3 w-3" />
                              <span>{t("versions.lines", { count: config.lines_count })}</span>
                            </div>
                          )}
                          {config.version > 1 ? (
                            config.changes_detected ? (
                              <Badge variant="default" className="text-xs bg-amber-500 hover:bg-amber-600">
                                {t("versions.changed")}
                              </Badge>
                            ) : (
                              <Badge variant="default" className="text-xs bg-emerald-500 hover:bg-emerald-600">
                                {t("versions.unchanged")}
                              </Badge>
                            )
                          ) : (
                            <Badge variant="default" className="text-xs bg-blue-500 hover:bg-blue-600">
                              {t("versions.initial")}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-6">
                  <p className="text-sm text-muted-foreground">
                    {t("versions.pagination.page", { page, total: totalPages, count: totalConfigs })}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(page - 1)}
                      disabled={page <= 1}
                    >
                      {t("versions.pagination.prev")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(page + 1)}
                      disabled={page >= totalPages}
                    >
                      {t("versions.pagination.next")}
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-3xl font-bold">{totalConfigs}</p>
              <p className="text-sm text-muted-foreground mt-1">{t("versions.stats.totalVersions")}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-3xl font-bold">{devices.length}</p>
              <p className="text-sm text-muted-foreground mt-1">{t("versions.stats.versionedDevices")}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-3xl font-bold">{formatFileSize(totalSizeBytes)}</p>
              <p className="text-sm text-muted-foreground mt-1">{t("versions.stats.totalSize")}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Versions;
