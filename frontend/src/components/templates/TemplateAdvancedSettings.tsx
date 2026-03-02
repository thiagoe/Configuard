import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Settings2,
  Terminal,
  AlertTriangle,
  Key,
  FileText,
  Clock
} from "lucide-react";
import { useTranslation } from "react-i18next";

export interface TemplateAdvancedConfig {
  prompt_pattern: string;
  prompt_enabled: boolean;
  login_prompt: string;
  login_prompt_enabled: boolean;
  password_prompt: string;
  password_prompt_enabled: boolean;
  enable_prompt: string;
  enable_prompt_enabled: boolean;
  enable_required: boolean;
  enable_password_required: boolean;
  connection_timeout: number;
  connection_timeout_enabled: boolean;
  command_timeout: number;
  command_timeout_enabled: boolean;
  pagination_pattern: string;
  pagination_enabled: boolean;
  pagination_key: string;
  pagination_key_enabled: boolean;
  pre_commands: string;
  pre_commands_enabled: boolean;
  post_commands: string;
  post_commands_enabled: boolean;
  error_patterns: string;
  error_patterns_enabled: boolean;
  output_cleanup_patterns: string;
  output_cleanup_patterns_enabled: boolean;
  line_ending: "\n" | "\r\n";
}

interface TemplateAdvancedSettingsProps {
  config: TemplateAdvancedConfig;
  onChange: (config: TemplateAdvancedConfig) => void;
}

const TemplateAdvancedSettings = ({ config, onChange }: TemplateAdvancedSettingsProps) => {
  const { t } = useTranslation("templates");
  const { t: tc } = useTranslation("common");

  const updateConfig = (updates: Partial<TemplateAdvancedConfig>) => {
    onChange({ ...config, ...updates });
  };

  return (
    <Tabs defaultValue="prompts" className="space-y-2">
      <TabsList className="grid grid-cols-4 w-full h-8">
        <TabsTrigger value="prompts" className="text-xs gap-1 px-1">
          <Terminal className="h-3.5 w-3.5" />
          {t("advanced.tabs.prompts")}
        </TabsTrigger>
        <TabsTrigger value="auth" className="text-xs gap-1 px-1">
          <Key className="h-3.5 w-3.5" />
          {t("advanced.tabs.auth")}
        </TabsTrigger>
        <TabsTrigger value="timing" className="text-xs gap-1 px-1">
          <Clock className="h-3.5 w-3.5" />
          {t("advanced.tabs.timeouts")}
        </TabsTrigger>
        <TabsTrigger value="commands" className="text-xs gap-1 px-1">
          <FileText className="h-3.5 w-3.5" />
          {t("advanced.tabs.commands")}
        </TabsTrigger>
      </TabsList>

      {/* Prompts Tab */}
      <TabsContent value="prompts" className="space-y-3 mt-0">
        <Card className="border-muted">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Terminal className="h-4 w-4" />
              {t("advanced.promptPatterns")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 px-4 pb-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">{t("advanced.mainPrompt")}</Label>
                <Switch
                  checked={config.prompt_enabled}
                  onCheckedChange={(checked) =>
                    updateConfig({
                      prompt_enabled: checked,
                      prompt_pattern: checked && !config.prompt_pattern ? "#|>|\$" : config.prompt_pattern,
                    })
                  }
                />
              </div>
              <Input
                value={config.prompt_pattern}
                onChange={(e) => updateConfig({ prompt_pattern: e.target.value })}
                placeholder="#|>|\$"
                className="font-mono h-8 text-sm"
                disabled={!config.prompt_enabled}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">{t("advanced.paginationPattern")}</Label>
                  <Switch
                    checked={config.pagination_enabled}
                    onCheckedChange={(checked) =>
                      updateConfig({
                        pagination_enabled: checked,
                        pagination_pattern: checked && !config.pagination_pattern ? "--More--|<--- More --->" : config.pagination_pattern,
                      })
                    }
                  />
                </div>
                <Input
                  value={config.pagination_pattern}
                  onChange={(e) => updateConfig({ pagination_pattern: e.target.value })}
                  placeholder="--More--|<--- More --->"
                  className="font-mono h-8 text-sm"
                  disabled={!config.pagination_enabled}
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">{t("advanced.paginationKey")}</Label>
                  <Switch
                    checked={config.pagination_key_enabled}
                    onCheckedChange={(checked) =>
                      updateConfig({
                        pagination_key_enabled: checked,
                        pagination_key: checked && !config.pagination_key ? " " : config.pagination_key,
                      })
                    }
                  />
                </div>
                <Input
                  value={config.pagination_key}
                  onChange={(e) => updateConfig({ pagination_key: e.target.value })}
                  placeholder=" "
                  className="font-mono h-8 text-sm"
                  disabled={!config.pagination_key_enabled}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">{t("advanced.lineEnding")}</Label>
              <Select
                modal={false}
                value={config.line_ending}
                onValueChange={(value: "\n" | "\r\n") => updateConfig({ line_ending: value })}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder={tc("select")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="\n">{t("advanced.lfDefault")}</SelectItem>
                  <SelectItem value="\r\n">{t("advanced.crlfMikrotik")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Authentication Tab */}
      <TabsContent value="auth" className="space-y-3 mt-0">
        <Card className="border-muted">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Key className="h-4 w-4" />
              {t("advanced.authentication")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 px-4 pb-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">{t("advanced.loginPrompt")}</Label>
                  <Switch
                    checked={config.login_prompt_enabled}
                    onCheckedChange={(checked) =>
                      updateConfig({
                        login_prompt_enabled: checked,
                        login_prompt: checked && !config.login_prompt ? "Username:|Login:" : config.login_prompt,
                      })
                    }
                  />
                </div>
                <Input
                  value={config.login_prompt}
                  onChange={(e) => updateConfig({ login_prompt: e.target.value })}
                  placeholder="Username:|Login:"
                  className="font-mono h-8 text-sm"
                  disabled={!config.login_prompt_enabled}
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">{t("advanced.passwordPrompt")}</Label>
                  <Switch
                    checked={config.password_prompt_enabled}
                    onCheckedChange={(checked) =>
                      updateConfig({
                        password_prompt_enabled: checked,
                        password_prompt: checked && !config.password_prompt ? "Password:" : config.password_prompt,
                      })
                    }
                  />
                </div>
                <Input
                  value={config.password_prompt}
                  onChange={(e) => updateConfig({ password_prompt: e.target.value })}
                  placeholder="Password:"
                  className="font-mono h-8 text-sm"
                  disabled={!config.password_prompt_enabled}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">{t("advanced.enablePrompt")}</Label>
                <Switch
                  checked={config.enable_prompt_enabled}
                  onCheckedChange={(checked) =>
                    updateConfig({
                      enable_prompt_enabled: checked,
                      enable_prompt: checked && !config.enable_prompt ? "Password:" : config.enable_prompt,
                    })
                  }
                />
              </div>
              <Input
                value={config.enable_prompt || ""}
                onChange={(e) => updateConfig({ enable_prompt: e.target.value })}
                placeholder="Password:"
                className="font-mono h-8 text-sm"
                disabled={!config.enable_prompt_enabled}
              />
            </div>

            <div className="flex items-center justify-between py-1">
              <Label className="text-xs">{t("advanced.enableNoPassword")}</Label>
              <Switch
                checked={config.enable_required}
                onCheckedChange={(checked) => updateConfig({ enable_required: checked })}
              />
            </div>

            <div className="flex items-center justify-between py-1">
              <Label className="text-xs">{t("advanced.enablePasswordRequired")}</Label>
              <Switch
                checked={config.enable_password_required}
                onCheckedChange={(checked) => updateConfig({ enable_password_required: checked })}
              />
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Timing Tab */}
      <TabsContent value="timing" className="space-y-3 mt-0">
        <Card className="border-muted">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="h-4 w-4" />
              {t("advanced.tabs.timeouts")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 px-4 pb-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">{t("advanced.connectionSec")}</Label>
                  <Switch
                    checked={config.connection_timeout_enabled}
                    onCheckedChange={(checked) =>
                      updateConfig({
                        connection_timeout_enabled: checked,
                        connection_timeout: checked && !config.connection_timeout ? 30 : config.connection_timeout,
                      })
                    }
                  />
                </div>
                <Input
                  type="number"
                  value={config.connection_timeout}
                  onChange={(e) => updateConfig({ connection_timeout: parseInt(e.target.value) || 30 })}
                  min={5}
                  max={300}
                  className="h-8 text-sm"
                  disabled={!config.connection_timeout_enabled}
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">{t("advanced.commandSec")}</Label>
                  <Switch
                    checked={config.command_timeout_enabled}
                    onCheckedChange={(checked) =>
                      updateConfig({
                        command_timeout_enabled: checked,
                        command_timeout: checked && !config.command_timeout ? 60 : config.command_timeout,
                      })
                    }
                  />
                </div>
                <Input
                  type="number"
                  value={config.command_timeout}
                  onChange={(e) => updateConfig({ command_timeout: parseInt(e.target.value) || 60 })}
                  min={5}
                  max={600}
                  className="h-8 text-sm"
                  disabled={!config.command_timeout_enabled}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Commands Tab */}
      <TabsContent value="commands" className="space-y-3 mt-0">
        <Card className="border-muted">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileText className="h-4 w-4" />
              {t("advanced.prePostCommands")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 px-4 pb-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">{t("advanced.preExecution")}</Label>
                <Switch
                  checked={config.pre_commands_enabled}
                  onCheckedChange={(checked) =>
                    updateConfig({ pre_commands_enabled: checked })
                  }
                />
              </div>
              <Textarea
                value={config.pre_commands || ""}
                onChange={(e) => updateConfig({ pre_commands: e.target.value })}
                placeholder="terminal length 0"
                className="font-mono text-xs"
                rows={2}
                disabled={!config.pre_commands_enabled}
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">{t("advanced.postExecution")}</Label>
                <Switch
                  checked={config.post_commands_enabled}
                  onCheckedChange={(checked) =>
                    updateConfig({ post_commands_enabled: checked })
                  }
                />
              </div>
              <Textarea
                value={config.post_commands || ""}
                onChange={(e) => updateConfig({ post_commands: e.target.value })}
                placeholder="exit"
                className="font-mono text-xs"
                rows={2}
                disabled={!config.post_commands_enabled}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-muted">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Settings2 className="h-4 w-4" />
              {t("advanced.outputCleanup")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 px-4 pb-4">
            <div className="flex items-center justify-between">
              <Label className="text-xs">{t("advanced.enable")}</Label>
              <Switch
                checked={config.output_cleanup_patterns_enabled}
                onCheckedChange={(checked) =>
                  updateConfig({ output_cleanup_patterns_enabled: checked })
                }
              />
            </div>
            <Textarea
              value={config.output_cleanup_patterns || ""}
              onChange={(e) => updateConfig({ output_cleanup_patterns: e.target.value })}
              placeholder="^#\s+\w{3}/\d{1,2}/\d{4}.*"
              className="font-mono text-xs"
              rows={3}
              disabled={!config.output_cleanup_patterns_enabled}
            />
            <p className="text-[10px] text-muted-foreground">
              {t("advanced.regexHint")}
            </p>
          </CardContent>
        </Card>

        <Card className="border-muted">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              {t("advanced.errorPatterns")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 px-4 pb-4">
            <div className="flex items-center justify-between">
              <Label className="text-xs">{t("advanced.enable")}</Label>
              <Switch
                checked={config.error_patterns_enabled}
                onCheckedChange={(checked) =>
                  updateConfig({ error_patterns_enabled: checked })
                }
              />
            </div>
            <Textarea
              value={config.error_patterns || ""}
              onChange={(e) => updateConfig({ error_patterns: e.target.value })}
              placeholder="% Invalid|Error:|Failed"
              className="font-mono text-xs"
              rows={2}
              disabled={!config.error_patterns_enabled}
            />
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
};

export default TemplateAdvancedSettings;
