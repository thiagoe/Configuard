import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { FileText, Download, GitCompare } from "lucide-react";
import ConfigDiffViewer from "@/components/ConfigDiffViewer";
import { useDevices } from "@/hooks/useDevices";
import { useDeviceConfigurations, useConfigurationDiff, useConfiguration } from "@/hooks/useConfigurations";
import { format } from "date-fns";
import { ptBR, enUS } from "date-fns/locale";

const Diff = () => {
  const { t, i18n } = useTranslation("backups");
  const dateFnsLocale = i18n.language === "pt-BR" ? ptBR : enUS;
  const { data: devicesData, isLoading: devicesLoading } = useDevices();
  const devices = devicesData?.items ?? [];
  const [selectedDevice, setSelectedDevice] = useState<string>("");
  const [version1, setVersion1] = useState<string>("");
  const [version2, setVersion2] = useState<string>("");
  const [viewMode, setViewMode] = useState("unified");
  const [showFull, setShowFull] = useState(false);
  const { data: configurations = [], isLoading: configsLoading } = useDeviceConfigurations(selectedDevice || undefined);
  const selectedConfigIds = useMemo(() => {
    if (!version1 || !version2) return { fromId: undefined, toId: undefined };
    return { fromId: version1, toId: version2 };
  }, [version1, version2]);
  const { data: diffData, isLoading: diffLoading } = useConfigurationDiff(selectedConfigIds.fromId, selectedConfigIds.toId);
  const { data: configA } = useConfiguration(showFull ? selectedConfigIds.fromId : undefined);
  const { data: configB } = useConfiguration(showFull ? selectedConfigIds.toId : undefined);

  const versions = useMemo(
    () =>
      configurations.map((config) => ({
        id: config.id,
        label: `v${config.version}`,
        date: config.collected_at,
      })),
    [configurations]
  );

  const handleSelectDevice = (value: string) => {
    setSelectedDevice(value);
    setVersion1("");
    setVersion2("");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t("diff.title")}</h1>
        <p className="text-muted-foreground">{t("diff.subtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitCompare className="h-5 w-5" />
            {t("diff.selectTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("diff.device")}</label>
              <Select value={selectedDevice} onValueChange={handleSelectDevice}>
                <SelectTrigger>
                  <SelectValue placeholder={devicesLoading ? t("diff.loading") : t("diff.select")} />
                </SelectTrigger>
                <SelectContent>
                  {devices.map((device) => (
                    <SelectItem key={device.id} value={device.id}>
                      {device.name} ({device.ip_address})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t("diff.oldVersion")}</label>
              <Select value={version1} onValueChange={setVersion1} disabled={!selectedDevice || configsLoading}>
                <SelectTrigger>
                  <SelectValue placeholder={configsLoading ? t("diff.loading") : t("diff.select")} />
                </SelectTrigger>
                <SelectContent>
                  {versions.map((version) => (
                    <SelectItem key={version.id} value={version.id}>
                      {version.label} ({format(new Date(version.date), "dd/MM/yyyy HH:mm", { locale: dateFnsLocale })})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t("diff.newVersion")}</label>
              <Select value={version2} onValueChange={setVersion2} disabled={!selectedDevice || configsLoading}>
                <SelectTrigger>
                  <SelectValue placeholder={configsLoading ? t("diff.loading") : t("diff.select")} />
                </SelectTrigger>
                <SelectContent>
                  {versions.map((version) => (
                    <SelectItem key={version.id} value={version.id}>
                      {version.label} ({format(new Date(version.date), "dd/MM/yyyy HH:mm", { locale: dateFnsLocale })})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm">
                <FileText className="h-4 w-4 mr-2" />
                {t("diff.viewOriginal")}
              </Button>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                {t("diff.downloadPatch")}
              </Button>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">{t("diff.fullFile")}</span>
                <Switch checked={showFull} onCheckedChange={setShowFull} />
              </div>
              <Tabs value={viewMode} onValueChange={setViewMode}>
                <TabsList>
                  <TabsTrigger value="unified">Unified</TabsTrigger>
                  <TabsTrigger value="split">Split</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>
        </CardContent>
      </Card>

      {diffLoading ? (
        <div className="py-8 text-center text-muted-foreground">{t("diff.loadingDiff")}</div>
      ) : diffData ? (
        <ConfigDiffViewer
          diffText={diffData.diff}
          oldConfig={showFull ? configA?.config_data || "" : undefined}
          newConfig={showFull ? configB?.config_data || "" : undefined}
          oldVersion={diffData.from_version}
          newVersion={diffData.to_version}
          addedLines={diffData.added_lines}
          removedLines={diffData.removed_lines}
          viewMode={viewMode as "unified" | "split"}
          showAllLines={showFull}
        />
      ) : (
        <div className="py-8 text-center text-muted-foreground">{t("diff.selectHint")}</div>
      )}

      {diffData && (
        <Card>
          <CardHeader>
            <CardTitle>{t("diff.summaryTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 text-sm">
              <Badge variant="outline">{t("diff.addedLines", { count: diffData.added_lines })}</Badge>
              <Badge variant="outline">{t("diff.removedLines", { count: diffData.removed_lines })}</Badge>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Diff;
