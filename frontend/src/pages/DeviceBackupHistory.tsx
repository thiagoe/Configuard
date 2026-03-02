import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Configuration, getConfiguration } from "@/services/devices";
import { useDevice } from "@/hooks/useDevices";
import { useDeviceConfigurations, useConfigurationDiff } from "@/hooks/useConfigurations";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, History, Download, GitCompare, FileText, Calendar } from "lucide-react";
import { format } from "date-fns";
import { ptBR, enUS } from "date-fns/locale";
import { toast } from "sonner";
import ConfigDiffViewer from "@/components/ConfigDiffViewer";
import { Checkbox } from "@/components/ui/checkbox";

const DeviceBackupHistory = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation("backups");
  const dateFnsLocale = i18n.language === "pt-BR" ? ptBR : enUS;
  const [selectedVersions, setSelectedVersions] = useState<string[]>([]);
  const [compareDialogOpen, setCompareDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedConfig, setSelectedConfig] = useState<Configuration | null>(null);

  const { data: device } = useDevice(id);
  const { data: configurations, isLoading } = useDeviceConfigurations(id);

  const handleVersionSelect = (configId: string, isChecked: boolean) => {
    if (isChecked) {
      if (selectedVersions.length >= 2) {
        toast.error(t("history.toast.maxVersions"));
        return;
      }
      setSelectedVersions([...selectedVersions, configId]);
    } else {
      setSelectedVersions(selectedVersions.filter(v => v !== configId));
    }
  };

  const handleCompare = () => {
    if (selectedVersions.length !== 2) {
      toast.error(t("history.toast.exactVersions"));
      return;
    }
    setCompareDialogOpen(true);
  };

  const handleDownload = async (config: Configuration) => {
    try {
      const fullConfig = config.config_data ? config : await getConfiguration(config.id);
      const blob = new Blob([fullConfig.config_data || ""], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${device?.name}-v${config.version}-${format(new Date(config.collected_at), "yyyyMMdd-HHmmss")}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success(t("history.toast.downloadSuccess"));
    } catch (error: any) {
      toast.error(error.response?.data?.detail || error.message || t("history.toast.downloadError"));
    }
  };

  const handleView = async (config: Configuration) => {
    try {
      const fullConfig = config.config_data ? config : await getConfiguration(config.id);
      setSelectedConfig(fullConfig);
      setViewDialogOpen(true);
    } catch (error: any) {
      toast.error(error.response?.data?.detail || error.message || t("history.toast.loadError"));
    }
  };

  const getCompareConfigs = () => {
    if (selectedVersions.length !== 2 || !configurations) {
      return { config1: null, config2: null };
    }
    const config1 = configurations.find(c => c.id === selectedVersions[0]);
    const config2 = configurations.find(c => c.id === selectedVersions[1]);

    // Ensure older version is first
    if (config1 && config2 && config1.version > config2.version) {
      return { config1: config2, config2: config1 };
    }
    return { config1, config2 };
  };

  const { config1, config2 } = getCompareConfigs();
  const { data: diffData, isLoading: diffLoading } = useConfigurationDiff(
    config1?.id,
    config2?.id
  );

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/devices")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{t("history.title")}</h1>
            <p className="text-muted-foreground">
              {device?.name} ({device?.ip_address})
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="h-5 w-5 text-primary" />
                <CardTitle>{t("history.configVersions")}</CardTitle>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCompare}
                  disabled={selectedVersions.length !== 2}
                >
                  <GitCompare className="h-4 w-4 mr-2" />
                  {t("history.compareSelected")}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                {t("history.loading")}
              </div>
            ) : configurations && configurations.length > 0 ? (
              <div className="rounded-md border border-border overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted">
                    <TableRow className="hover:bg-muted border-border">
                      <TableHead className="w-12"></TableHead>
                      <TableHead className="text-foreground">{t("history.columns.version")}</TableHead>
                      <TableHead className="text-foreground">{t("history.columns.collectedAt")}</TableHead>
                      <TableHead className="text-foreground">{t("history.columns.method")}</TableHead>
                      <TableHead className="text-foreground">{t("history.columns.changes")}</TableHead>
                      <TableHead className="text-foreground">{t("history.columns.hash")}</TableHead>
                      <TableHead className="text-foreground text-right">{t("history.columns.actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {configurations.map((config) => (
                      <TableRow
                        key={config.id}
                        className="hover:bg-secondary/50 border-border transition-colors"
                      >
                        <TableCell>
                          <Checkbox
                            checked={selectedVersions.includes(config.id)}
                            onCheckedChange={(checked) =>
                              handleVersionSelect(config.id, checked as boolean)
                            }
                          />
                        </TableCell>
                        <TableCell className="font-bold">
                          v{config.version}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            {format(new Date(config.collected_at), "dd/MM/yyyy HH:mm:ss", { locale: dateFnsLocale })}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {config.collection_method}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {config.changes_detected ? (
                            <Badge className="bg-accent/20 text-accent border-accent/30">
                              {t("history.changesDetected")}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground">
                              {t("history.noChanges")}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {config.config_hash.substring(0, 8)}...
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleView(config)}
                              title={t("history.viewConfig")}
                            >
                              <FileText className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleDownload(config)}
                              title={t("history.downloadBackup")}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-12 space-y-4">
                <History className="h-16 w-16 mx-auto text-muted-foreground opacity-50" />
                <div>
                  <p className="text-lg font-medium text-foreground">{t("history.none")}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t("history.noneDesc")}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Compare Dialog */}
        <Dialog open={compareDialogOpen} onOpenChange={setCompareDialogOpen}>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t("history.compareDialog.title")}</DialogTitle>
              <DialogDescription>
                {t("history.compareDialog.desc", { v1: config1?.version, v2: config2?.version })}
              </DialogDescription>
            </DialogHeader>
            {config1 && config2 && (
              diffLoading ? (
                <div className="py-8 text-center text-muted-foreground">{t("history.compareDialog.loading")}</div>
              ) : (
                <ConfigDiffViewer
                  diffText={diffData?.diff}
                  addedLines={diffData?.added_lines}
                  removedLines={diffData?.removed_lines}
                  oldVersion={config1.version}
                  newVersion={config2.version}
                />
              )
            )}
          </DialogContent>
        </Dialog>

        {/* View Dialog */}
        <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>{t("history.viewDialog.title", { version: selectedConfig?.version })}</DialogTitle>
              <DialogDescription>
                {selectedConfig && t("history.viewDialog.collectedAt", {
                  date: format(new Date(selectedConfig.collected_at), "dd/MM/yyyy HH:mm:ss", { locale: dateFnsLocale })
                })}
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-md border border-border overflow-hidden bg-background">
              <div className="overflow-x-auto max-h-[60vh]">
                <pre className="font-mono text-sm p-4 whitespace-pre-wrap">
                  {selectedConfig?.config_data}
                </pre>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => selectedConfig && handleDownload(selectedConfig)}
              >
                <Download className="h-4 w-4 mr-2" />
                {t("history.download")}
              </Button>
              <Button onClick={() => setViewDialogOpen(false)}>
                {t("history.close")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

export default DeviceBackupHistory;
