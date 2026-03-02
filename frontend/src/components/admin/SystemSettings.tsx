import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Server, Shield, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getSystemSettings, updateRetentionVersions, updateAuditRetentionDays } from "@/services/admin";

export function SystemSettings() {
  const { t } = useTranslation("admin");
  const [loading, setLoading] = useState(true);
  const [savingRetention, setSavingRetention] = useState(false);
  const [savingAudit, setSavingAudit] = useState(false);
  const [retentionVersions, setRetentionVersions] = useState(10);
  const [originalRetention, setOriginalRetention] = useState(10);
  const [auditRetentionDays, setAuditRetentionDays] = useState(90);
  const [originalAuditRetention, setOriginalAuditRetention] = useState(90);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const settings = await getSystemSettings();
      setRetentionVersions(settings.retention_versions);
      setOriginalRetention(settings.retention_versions);
      setAuditRetentionDays(settings.audit_retention_days);
      setOriginalAuditRetention(settings.audit_retention_days);
    } catch (error) {
      console.error("Failed to load settings:", error);
      toast.error(t("settings.loadError"));
    } finally {
      setLoading(false);
    }
  };

  const handleSaveRetention = async () => {
    if (retentionVersions < 1 || retentionVersions > 1000) {
      toast.error(t("settings.retention.validationError"));
      return;
    }

    try {
      setSavingRetention(true);
      await updateRetentionVersions(retentionVersions);
      setOriginalRetention(retentionVersions);
      toast.success(t("settings.retention.saved"));
    } catch (error) {
      console.error("Failed to save settings:", error);
      toast.error(t("settings.saveError"));
    } finally {
      setSavingRetention(false);
    }
  };

  const handleSaveAuditRetention = async () => {
    if (auditRetentionDays < 1 || auditRetentionDays > 3650) {
      toast.error(t("settings.audit.validationError"));
      return;
    }

    try {
      setSavingAudit(true);
      await updateAuditRetentionDays(auditRetentionDays);
      setOriginalAuditRetention(auditRetentionDays);
      toast.success(t("settings.audit.saved"));
    } catch (error) {
      console.error("Failed to save settings:", error);
      toast.error(t("settings.saveError"));
    } finally {
      setSavingAudit(false);
    }
  };

  const hasRetentionChanges = retentionVersions !== originalRetention;
  const hasAuditChanges = auditRetentionDays !== originalAuditRetention;

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            {t("settings.retention.title")}
          </CardTitle>
          <CardDescription>
            {t("settings.retention.desc")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="retention-versions">{t("settings.retention.label")}</Label>
            <Input
              id="retention-versions"
              type="number"
              min={1}
              max={1000}
              value={retentionVersions}
              onChange={(e) => setRetentionVersions(parseInt(e.target.value) || 1)}
              className="max-w-xs"
            />
            <p className="text-sm text-muted-foreground">
              {t("settings.retention.hint")}
            </p>
          </div>

          <Button onClick={handleSaveRetention} disabled={savingRetention || !hasRetentionChanges}>
            {savingRetention && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {t("settings.save")}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            {t("settings.audit.title")}
          </CardTitle>
          <CardDescription>
            {t("settings.audit.desc")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="audit-retention">{t("settings.audit.label")}</Label>
            <Input
              id="audit-retention"
              type="number"
              min={1}
              max={3650}
              value={auditRetentionDays}
              onChange={(e) => setAuditRetentionDays(parseInt(e.target.value) || 90)}
              className="max-w-xs"
            />
            <p className="text-sm text-muted-foreground">
              {t("settings.audit.hint")}
            </p>
          </div>

          <Button onClick={handleSaveAuditRetention} disabled={savingAudit || !hasAuditChanges}>
            {savingAudit && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {t("settings.save")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
