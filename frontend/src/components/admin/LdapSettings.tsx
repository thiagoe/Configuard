import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Network, Users, Search, Shield, Zap, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  getLdapSettings,
  updateLdapSettings,
  testLdapConnection,
  LdapSettings,
  LdapGroupMapping,
} from "@/services/admin";

const DEFAULT_SETTINGS: LdapSettings = {
  ldap_enabled: false,
  ldap_server: "",
  ldap_port: 389,
  ldap_use_ssl: false,
  ldap_use_starttls: false,
  ldap_bind_dn: "",
  ldap_bind_password_set: false,
  ldap_base_dn: "",
  ldap_user_filter: "(&(objectClass=person)(sAMAccountName={username}))",
  ldap_username_attr: "sAMAccountName",
  ldap_email_attr: "mail",
  ldap_display_name_attr: "displayName",
  ldap_group_search_base: "",
  ldap_group_search_filter: "(&(objectClass=group)(member={dn}))",
  ldap_group_mappings: [],
  ldap_default_role: "user",
  ldap_access_token_ttl: 480,
};

export function LdapSettings() {
  const { t } = useTranslation("admin");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testUsername, setTestUsername] = useState("");
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const [settings, setSettings] = useState<LdapSettings>(DEFAULT_SETTINGS);
  const [newBindPassword, setNewBindPassword] = useState("");

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const data = await getLdapSettings();
      setSettings(data);
    } catch {
      toast.error(t("ldap.loadError"));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const updated = await updateLdapSettings({
        ...settings,
        ldap_bind_password: newBindPassword || undefined,
      });
      setSettings(updated);
      setNewBindPassword("");
      toast.success(t("ldap.saved"));
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || t("ldap.saveError"));
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    try {
      setTesting(true);
      setTestResult(null);
      const result = await testLdapConnection(testUsername || undefined);
      setTestResult(result);
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    } catch (error: any) {
      const msg = error?.response?.data?.detail || t("ldap.testError");
      setTestResult({ success: false, message: msg });
      toast.error(msg);
    } finally {
      setTesting(false);
    }
  };

  const addGroupMapping = () => {
    setSettings({
      ...settings,
      ldap_group_mappings: [
        ...settings.ldap_group_mappings,
        { group_dn: "", role: "user" },
      ],
    });
  };

  const removeGroupMapping = (index: number) => {
    const mappings = [...settings.ldap_group_mappings];
    mappings.splice(index, 1);
    setSettings({ ...settings, ldap_group_mappings: mappings });
  };

  const updateGroupMapping = (index: number, field: keyof LdapGroupMapping, value: string) => {
    const mappings = [...settings.ldap_group_mappings];
    mappings[index] = { ...mappings[index], [field]: value };
    setSettings({ ...settings, ldap_group_mappings: mappings });
  };

  const set = (key: keyof LdapSettings, value: any) =>
    setSettings((prev) => ({ ...prev, [key]: value }));

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

      {/* Card 1 — Connection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Network className="h-5 w-5" />
            {t("ldap.connection.title")}
          </CardTitle>
          <CardDescription>
            {t("ldap.connection.desc")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center gap-3">
            <Switch
              id="ldap-enabled"
              checked={settings.ldap_enabled}
              onCheckedChange={(v) => set("ldap_enabled", v)}
            />
            <Label htmlFor="ldap-enabled" className="cursor-pointer font-medium">
              {t("ldap.connection.enable")}
            </Label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="ldap-server">{t("ldap.connection.server")}</Label>
              <Input
                id="ldap-server"
                value={settings.ldap_server}
                onChange={(e) => set("ldap_server", e.target.value)}
                placeholder="ldap.empresa.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ldap-port">{t("ldap.connection.port")}</Label>
              <Input
                id="ldap-port"
                type="number"
                value={settings.ldap_port}
                onChange={(e) => set("ldap_port", parseInt(e.target.value) || 389)}
                placeholder="389"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-6">
            <div className="flex items-center gap-2">
              <Checkbox
                id="ldap-ssl"
                checked={settings.ldap_use_ssl}
                onCheckedChange={(v) => {
                  set("ldap_use_ssl", !!v);
                  if (v) set("ldap_use_starttls", false);
                }}
              />
              <Label htmlFor="ldap-ssl" className="cursor-pointer">
                {t("ldap.connection.ssl")}
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="ldap-starttls"
                checked={settings.ldap_use_starttls}
                onCheckedChange={(v) => {
                  set("ldap_use_starttls", !!v);
                  if (v) set("ldap_use_ssl", false);
                }}
              />
              <Label htmlFor="ldap-starttls" className="cursor-pointer">
                {t("ldap.connection.starttls")}
              </Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Card 2 — Service Account */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {t("ldap.serviceAccount.title")}
          </CardTitle>
          <CardDescription>
            {t("ldap.serviceAccount.desc")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ldap-bind-dn">{t("ldap.serviceAccount.bindDn")}</Label>
            <Input
              id="ldap-bind-dn"
              value={settings.ldap_bind_dn}
              onChange={(e) => set("ldap_bind_dn", e.target.value)}
              placeholder="CN=svc-configuard,OU=Service Accounts,DC=empresa,DC=com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ldap-bind-pass">
              {t("ldap.serviceAccount.password")}
              {settings.ldap_bind_password_set && (
                <span className="text-xs text-muted-foreground ml-1">
                  {t("ldap.serviceAccount.passwordSet")}
                </span>
              )}
            </Label>
            <Input
              id="ldap-bind-pass"
              type="password"
              value={newBindPassword}
              onChange={(e) => setNewBindPassword(e.target.value)}
              placeholder={settings.ldap_bind_password_set ? "••••••••" : t("ldap.serviceAccount.passwordPlaceholder")}
            />
          </div>
        </CardContent>
      </Card>

      {/* Card 3 — User Search */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            {t("ldap.userSearch.title")}
          </CardTitle>
          <CardDescription>
            {t("ldap.userSearch.desc")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ldap-base-dn">{t("ldap.userSearch.baseDn")}</Label>
            <Input
              id="ldap-base-dn"
              value={settings.ldap_base_dn}
              onChange={(e) => set("ldap_base_dn", e.target.value)}
              placeholder="DC=empresa,DC=com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ldap-user-filter">{t("ldap.userSearch.userFilter")}</Label>
            <Input
              id="ldap-user-filter"
              value={settings.ldap_user_filter}
              onChange={(e) => set("ldap_user_filter", e.target.value)}
              placeholder="(&(objectClass=person)(sAMAccountName={username}))"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ldap-user-attr">{t("ldap.userSearch.usernameAttr")}</Label>
              <Input
                id="ldap-user-attr"
                value={settings.ldap_username_attr}
                onChange={(e) => set("ldap_username_attr", e.target.value)}
                placeholder="sAMAccountName"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ldap-email-attr">{t("ldap.userSearch.emailAttr")}</Label>
              <Input
                id="ldap-email-attr"
                value={settings.ldap_email_attr}
                onChange={(e) => set("ldap_email_attr", e.target.value)}
                placeholder="mail"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ldap-name-attr">{t("ldap.userSearch.nameAttr")}</Label>
              <Input
                id="ldap-name-attr"
                value={settings.ldap_display_name_attr}
                onChange={(e) => set("ldap_display_name_attr", e.target.value)}
                placeholder="displayName"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Card 4 — Group → Role Mapping */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            {t("ldap.groupMapping.title")}
          </CardTitle>
          <CardDescription>
            {t("ldap.groupMapping.desc")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ldap-group-base">{t("ldap.groupMapping.groupBaseDn")}</Label>
              <Input
                id="ldap-group-base"
                value={settings.ldap_group_search_base}
                onChange={(e) => set("ldap_group_search_base", e.target.value)}
                placeholder="OU=Groups,DC=empresa,DC=com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ldap-group-filter">{t("ldap.groupMapping.groupFilter")}</Label>
              <Input
                id="ldap-group-filter"
                value={settings.ldap_group_search_filter}
                onChange={(e) => set("ldap_group_search_filter", e.target.value)}
                placeholder="(&(objectClass=group)(member={dn}))"
              />
            </div>
          </div>

          <div className="space-y-3">
            {settings.ldap_group_mappings.length === 0 && (
              <p className="text-sm text-muted-foreground">
                {t("ldap.groupMapping.noMappings")}
              </p>
            )}
            {settings.ldap_group_mappings.map((mapping, index) => (
              <div key={index} className="flex items-center gap-3">
                <Input
                  value={mapping.group_dn}
                  onChange={(e) => updateGroupMapping(index, "group_dn", e.target.value)}
                  placeholder="CN=Configuard-Admins,OU=Groups,DC=empresa,DC=com"
                  className="flex-1"
                />
                <span className="text-muted-foreground text-sm shrink-0">→</span>
                <Select
                  value={mapping.role}
                  onValueChange={(v) => updateGroupMapping(index, "role", v)}
                >
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="moderator">{t("ldap.groupMapping.roleModerator")}</SelectItem>
                    <SelectItem value="user">{t("ldap.groupMapping.roleUser")}</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeGroupMapping(index)}
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addGroupMapping}>
              <Plus className="h-4 w-4 mr-2" />
              {t("ldap.groupMapping.addMapping")}
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t">
            <div className="space-y-2">
              <Label htmlFor="ldap-default-role">{t("ldap.groupMapping.defaultRole")}</Label>
              <Select
                value={settings.ldap_default_role}
                onValueChange={(v) => set("ldap_default_role", v)}
              >
                <SelectTrigger id="ldap-default-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("ldap.groupMapping.roleBlocked")}</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="moderator">{t("ldap.groupMapping.roleModerator")}</SelectItem>
                  <SelectItem value="user">{t("ldap.groupMapping.roleUser")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ldap-ttl">{t("ldap.groupMapping.tokenTtl")}</Label>
              <Input
                id="ldap-ttl"
                type="number"
                value={settings.ldap_access_token_ttl}
                onChange={(e) => set("ldap_access_token_ttl", parseInt(e.target.value) || 480)}
                placeholder="480"
              />
              <p className="text-xs text-muted-foreground">
                {t("ldap.groupMapping.tokenTtlHint")}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Card 5 — Test Connection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            {t("ldap.test.title")}
          </CardTitle>
          <CardDescription>
            {t("ldap.test.desc")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3">
            <Input
              value={testUsername}
              onChange={(e) => setTestUsername(e.target.value)}
              placeholder={t("ldap.test.usernamePlaceholder")}
              className="max-w-xs"
            />
            <Button
              variant="outline"
              onClick={handleTest}
              disabled={testing || !settings.ldap_server}
              title={!settings.ldap_server ? t("ldap.test.configureFirst") : ""}
            >
              {testing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Zap className="h-4 w-4 mr-2" />
              )}
              {t("ldap.test.button")}
            </Button>
          </div>

          {testResult && (
            <div
              className={`rounded-md p-3 text-sm ${
                testResult.success
                  ? "bg-green-500/10 text-green-700 dark:text-green-400 border border-green-500/20"
                  : "bg-destructive/10 text-destructive border border-destructive/20"
              }`}
            >
              {testResult.message}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Save button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} size="lg">
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {t("ldap.save")}
        </Button>
      </div>
    </div>
  );
}
