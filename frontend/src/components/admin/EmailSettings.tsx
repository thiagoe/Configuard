import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Mail, Server, Send } from "lucide-react";
import { toast } from "sonner";
import {
  getEmailSettings,
  updateEmailSettings,
  sendTestEmail,
  EmailSettings,
} from "@/services/admin";

export function EmailSettings() {
  const { t } = useTranslation("admin");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const [settings, setSettings] = useState<EmailSettings>({
    email_enabled: false,
    smtp_host: "",
    smtp_port: 587,
    smtp_use_tls: true,
    smtp_username: "",
    smtp_password_set: false,
    email_sender: "",
    email_recipients: "",
    notify_backup_failed: true,
    notify_backup_success: false,
    notify_device_disabled: true,
    notify_device_deleted: true,
  });

  const [newPassword, setNewPassword] = useState("");
  const [originalSettings, setOriginalSettings] = useState<EmailSettings | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const data = await getEmailSettings();
      setSettings(data);
      setOriginalSettings(data);
    } catch {
      toast.error(t("email.loadError"));
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSmtp = async () => {
    try {
      setSaving(true);
      const updated = await updateEmailSettings({
        ...settings,
        smtp_password: newPassword || undefined,
      });
      setSettings(updated);
      setOriginalSettings(updated);
      setNewPassword("");
      toast.success(t("email.smtpSaved"));
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || t("email.saveError"));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveNotifications = async () => {
    try {
      setSaving(true);
      const updated = await updateEmailSettings({
        ...settings,
        smtp_password: undefined,
      });
      setSettings(updated);
      setOriginalSettings(updated);
      toast.success(t("email.prefsSaved"));
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || t("email.savePrefsError"));
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    try {
      setTesting(true);
      const result = await sendTestEmail();
      toast.success(result.message);
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || t("email.testError"));
    } finally {
      setTesting(false);
    }
  };

  const smtpConfigured = settings.smtp_host && settings.email_recipients;

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
      {/* SMTP Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            {t("email.smtp.title")}
          </CardTitle>
          <CardDescription>
            {t("email.smtp.desc")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-3">
            <Switch
              id="email-enabled"
              checked={settings.email_enabled}
              onCheckedChange={(checked) => setSettings({ ...settings, email_enabled: checked })}
            />
            <Label htmlFor="email-enabled" className="cursor-pointer">
              {t("email.smtp.enable")}
            </Label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="smtp-host">{t("email.smtp.server")}</Label>
              <Input
                id="smtp-host"
                value={settings.smtp_host}
                onChange={(e) => setSettings({ ...settings, smtp_host: e.target.value })}
                placeholder="smtp.gmail.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="smtp-port">{t("email.smtp.port")}</Label>
              <Input
                id="smtp-port"
                type="number"
                value={settings.smtp_port}
                onChange={(e) => setSettings({ ...settings, smtp_port: parseInt(e.target.value) || 587 })}
                placeholder="587"
                className="max-w-xs"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Switch
              id="smtp-tls"
              checked={settings.smtp_use_tls}
              onCheckedChange={(checked) => setSettings({ ...settings, smtp_use_tls: checked })}
            />
            <Label htmlFor="smtp-tls" className="cursor-pointer">
              {t("email.smtp.tls")}
            </Label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="smtp-user">{t("email.smtp.username")}</Label>
              <Input
                id="smtp-user"
                value={settings.smtp_username}
                onChange={(e) => setSettings({ ...settings, smtp_username: e.target.value })}
                placeholder="usuario@empresa.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="smtp-pass">
                {t("email.smtp.password")}
                {settings.smtp_password_set && (
                  <span className="text-xs text-muted-foreground ml-1">{t("email.smtp.passwordSet")}</span>
                )}
              </Label>
              <Input
                id="smtp-pass"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={settings.smtp_password_set ? "••••••••" : t("email.smtp.passwordPlaceholder")}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email-sender">{t("email.smtp.sender")}</Label>
            <Input
              id="email-sender"
              type="email"
              value={settings.email_sender}
              onChange={(e) => setSettings({ ...settings, email_sender: e.target.value })}
              placeholder="configuard@empresa.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email-recipients">
              {t("email.smtp.recipients")}
              <span className="text-xs text-muted-foreground ml-1">{t("email.smtp.recipientsHint")}</span>
            </Label>
            <Textarea
              id="email-recipients"
              value={settings.email_recipients}
              onChange={(e) => setSettings({ ...settings, email_recipients: e.target.value })}
              placeholder="ti@empresa.com; noc@empresa.com; admin@empresa.com"
              rows={2}
            />
          </div>

          <div className="flex gap-3">
            <Button onClick={handleSaveSmtp} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t("email.smtp.save")}
            </Button>
            <Button
              variant="outline"
              onClick={handleTest}
              disabled={testing || !smtpConfigured}
              title={!smtpConfigured ? t("email.configureFirst") : ""}
            >
              {testing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              {t("email.smtp.sendTest")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Notification Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            {t("email.notifications.title")}
          </CardTitle>
          <CardDescription>
            {t("email.notifications.desc")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Checkbox
                id="notify-failed"
                checked={settings.notify_backup_failed}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, notify_backup_failed: !!checked })
                }
              />
              <Label htmlFor="notify-failed" className="cursor-pointer">
                {t("email.notifications.backupFailed")}
              </Label>
            </div>

            <div className="flex items-center gap-3">
              <Checkbox
                id="notify-success"
                checked={settings.notify_backup_success}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, notify_backup_success: !!checked })
                }
              />
              <Label htmlFor="notify-success" className="cursor-pointer">
                {t("email.notifications.backupSuccess")}
              </Label>
            </div>

            <div className="flex items-center gap-3">
              <Checkbox
                id="notify-disabled"
                checked={settings.notify_device_disabled}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, notify_device_disabled: !!checked })
                }
              />
              <Label htmlFor="notify-disabled" className="cursor-pointer">
                {t("email.notifications.deviceDisabled")}
              </Label>
            </div>

            <div className="flex items-center gap-3">
              <Checkbox
                id="notify-deleted"
                checked={settings.notify_device_deleted}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, notify_device_deleted: !!checked })
                }
              />
              <Label htmlFor="notify-deleted" className="cursor-pointer">
                {t("email.notifications.deviceDeleted")}
              </Label>
            </div>
          </div>

          <Button onClick={handleSaveNotifications} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {t("email.notifications.save")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
