import { useState, useEffect } from "react";
import yaml from "js-yaml";
import { useTranslation } from "react-i18next";
import { BackupTemplate, BackupTemplateCreate, BackupTemplateUpdate } from "@/services/templates";
import { useTemplates, useCreateTemplate, useUpdateTemplate, useDeleteTemplate } from "@/hooks/useTemplates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Settings2, Terminal, ListOrdered, Eye, Upload, Download, Copy, Search } from "lucide-react";
import TemplateStepEditor, { type TemplateStep } from "@/components/templates/TemplateStepEditor";
import TemplateAdvancedSettings, { type TemplateAdvancedConfig } from "@/components/templates/TemplateAdvancedSettings";
import { type TemplateStepCreate } from "@/services/templates";
import { useAuth } from "@/contexts/AuthContext";

const TEMPLATE_SEARCH_KEY = "configuard_template_search";

const defaultAdvancedConfig: TemplateAdvancedConfig = {
  prompt_pattern: "#|>|\\$",
  prompt_enabled: true,
  login_prompt: "Username:|Login:",
  login_prompt_enabled: true,
  password_prompt: "Password:",
  password_prompt_enabled: true,
  enable_prompt: "",
  enable_prompt_enabled: false,
  enable_required: false,
  enable_password_required: false,
  connection_timeout: 30,
  connection_timeout_enabled: true,
  command_timeout: 60,
  command_timeout_enabled: true,
  pagination_pattern: "--More--|<--- More --->",
  pagination_enabled: true,
  pagination_key: " ",
  pagination_key_enabled: true,
  pre_commands: "",
  pre_commands_enabled: false,
  post_commands: "",
  post_commands_enabled: false,
  error_patterns: "",
  error_patterns_enabled: false,
  output_cleanup_patterns: "",
  output_cleanup_patterns_enabled: false,
  line_ending: "\\n",
  telnet_sync_enabled: false,
  telnet_sync_idle_ms: 0,
};

interface FormData {
  name: string;
  description: string;
  commands: string;
  use_steps: boolean;
}

const BackupTemplates = () => {
  const { isModerator } = useAuth();
  const { t } = useTranslation("templates");
  const { t: tc } = useTranslation("common");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<BackupTemplate | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<BackupTemplate | null>(null);
  const [selectedTemplates, setSelectedTemplates] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState(() => {
    return localStorage.getItem(TEMPLATE_SEARCH_KEY) || "";
  });

  const [formData, setFormData] = useState<FormData>({
    name: "",
    description: "",
    commands: "",
    use_steps: false,
  });

  const [advancedConfig, setAdvancedConfig] = useState<TemplateAdvancedConfig>(defaultAdvancedConfig);
  const [steps, setSteps] = useState<TemplateStep[]>([]);
  const [activeTab, setActiveTab] = useState("basic");

  const { data: templates = [], isLoading } = useTemplates();
  const createMutation = useCreateTemplate();
  const updateMutation = useUpdateTemplate();
  const deleteMutation = useDeleteTemplate();

  // Persist search term in localStorage
  useEffect(() => {
    if (searchTerm) {
      localStorage.setItem(TEMPLATE_SEARCH_KEY, searchTerm);
    } else {
      localStorage.removeItem(TEMPLATE_SEARCH_KEY);
    }
  }, [searchTerm]);

  // Filter templates by search term
  const filteredTemplates = templates.filter((template) => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      template.name.toLowerCase().includes(searchLower) ||
      template.description?.toLowerCase().includes(searchLower) ||
      template.commands?.toLowerCase().includes(searchLower)
    );
  });

  const toggleTemplateSelection = (id: string) => {
    const newSelection = new Set(selectedTemplates);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedTemplates(newSelection);
  };

  const toggleSelectAll = () => {
    if (selectedTemplates.size === filteredTemplates.length) {
      setSelectedTemplates(new Set());
    } else {
      setSelectedTemplates(new Set(filteredTemplates.map(t => t.id)));
    }
  };

  const clearSelection = () => {
    setSelectedTemplates(new Set());
  };

  const resetForm = () => {
    setFormData({ name: "", description: "", commands: "", use_steps: false });
    setAdvancedConfig(defaultAdvancedConfig);
    setSteps([]);
    setEditingTemplate(null);
    setActiveTab("basic");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.use_steps) {
      for (const step of steps) {
        if ((step.step_type === "command" || step.step_type === "enter_mode") && !step.command) {
          toast.error(t("validation.commandRequired"));
          return;
        }
        if ((step.step_type === "expect" || step.step_type === "set_prompt") && !step.expect_pattern) {
          toast.error(t("validation.patternRequired"));
          return;
        }
        if (step.step_type === "pause" && (!step.delay_ms || step.delay_ms <= 0)) {
          toast.error(t("validation.pauseRequired"));
          return;
        }
      }
    }

    const stepsPayload: TemplateStepCreate[] | undefined = formData.use_steps
      ? steps.map((step, idx) => {
          const mappedType = step.step_type === "enter_mode" ? "command" : step.step_type;
          if (step.step_type === "pause") {
            return {
              order: idx + 1,
              step_type: "pause",
              content: "pause",
              timeout: Math.max(1, Math.round(step.delay_ms / 1000)),
              on_failure: step.on_error,
              max_retries: step.retry_count,
              capture_output: false,
            };
          }

          if (step.step_type === "send_key") {
            return {
              order: idx + 1,
              step_type: "send_key" as TemplateStepCreate["step_type"],
              content: step.command || "enter",
              timeout: step.timeout_seconds || 1,
              on_failure: step.on_error,
              max_retries: 0,
              capture_output: false,
            };
          }

          const content =
            step.step_type === "expect" || step.step_type === "set_prompt"
              ? step.expect_pattern || ".*"
              : step.command || " ";

          return {
            order: idx + 1,
            step_type: mappedType as TemplateStepCreate["step_type"],
            content,
            timeout: step.timeout_seconds,
            expect_pattern: step.expect_pattern || undefined,
            on_failure: step.on_error,
            max_retries: step.retry_count,
            condition: undefined,
            capture_output: step.capture_output,
            variable_name: undefined,
          };
        })
      : undefined;

    const payload: BackupTemplateCreate | BackupTemplateUpdate = {
      name: formData.name,
      commands: formData.use_steps ? "" : formData.commands,
      description: formData.description,
      use_steps: formData.use_steps,
      steps: stepsPayload,
      prompt_pattern: advancedConfig.prompt_enabled ? advancedConfig.prompt_pattern : "",
      login_prompt: advancedConfig.login_prompt_enabled ? advancedConfig.login_prompt : "",
      password_prompt: advancedConfig.password_prompt_enabled ? advancedConfig.password_prompt : "",
      enable_prompt: advancedConfig.enable_prompt_enabled ? advancedConfig.enable_prompt : "",
      enable_required: advancedConfig.enable_required,
      enable_password_required: advancedConfig.enable_password_required,
      connection_timeout: advancedConfig.connection_timeout_enabled ? advancedConfig.connection_timeout : 30,
      command_timeout: advancedConfig.command_timeout_enabled ? advancedConfig.command_timeout : 60,
      pagination_pattern: advancedConfig.pagination_enabled ? advancedConfig.pagination_pattern : "",
      pagination_key: advancedConfig.pagination_key_enabled ? advancedConfig.pagination_key : "",
      pre_commands: advancedConfig.pre_commands_enabled ? advancedConfig.pre_commands : "",
      post_commands: advancedConfig.post_commands_enabled ? advancedConfig.post_commands : "",
      output_cleanup_patterns: advancedConfig.output_cleanup_patterns_enabled ? advancedConfig.output_cleanup_patterns : "",
      error_patterns: advancedConfig.error_patterns_enabled ? advancedConfig.error_patterns : "",
      line_ending: advancedConfig.line_ending,
      transport_options: {
        telnet_sync: {
          enabled: advancedConfig.telnet_sync_enabled,
          ...(advancedConfig.telnet_sync_enabled ? { idle_ms: advancedConfig.telnet_sync_idle_ms } : {}),
        },
      },
    };

    if (editingTemplate) {
      updateMutation.mutate(
        { id: editingTemplate.id, data: payload },
        {
          onSuccess: () => {
            toast.success(t("toast.updated"));
            setDialogOpen(false);
            resetForm();
          },
          onError: (error: any) => {
            const detail = error.response?.data?.detail;
            const message =
              typeof detail === "string"
                ? detail
                : detail
                ? JSON.stringify(detail)
                : error.message;
            toast.error(message);
          },
        }
      );
    } else {
      createMutation.mutate(payload as BackupTemplateCreate, {
        onSuccess: () => {
          toast.success(t("toast.created"));
          setDialogOpen(false);
          resetForm();
        },
        onError: (error: any) => {
          const detail = error.response?.data?.detail;
          const message =
            typeof detail === "string"
              ? detail
              : detail
              ? JSON.stringify(detail)
              : error.message;
          toast.error(message);
        },
      });
    }
  };

  const openDialog = (template?: BackupTemplate) => {
    if (template) {
      setEditingTemplate(template);
      setFormData({
        name: template.name,
        description: template.description || "",
        commands: template.commands || "",
        use_steps: template.use_steps || false,
      });
      setAdvancedConfig({
        prompt_pattern: template.prompt_pattern ?? defaultAdvancedConfig.prompt_pattern,
        prompt_enabled: template.prompt_pattern !== null && template.prompt_pattern !== undefined ? template.prompt_pattern !== "" : true,
        login_prompt: template.login_prompt ?? defaultAdvancedConfig.login_prompt,
        login_prompt_enabled: template.login_prompt !== null && template.login_prompt !== undefined ? template.login_prompt !== "" : true,
        password_prompt: template.password_prompt ?? defaultAdvancedConfig.password_prompt,
        password_prompt_enabled: template.password_prompt !== null && template.password_prompt !== undefined ? template.password_prompt !== "" : true,
        enable_prompt: template.enable_prompt ?? "",
        enable_prompt_enabled: template.enable_prompt !== null && template.enable_prompt !== undefined ? template.enable_prompt !== "" : false,
        enable_required: template.enable_required ?? false,
        enable_password_required: template.enable_password_required ?? false,
        connection_timeout: template.connection_timeout || 30,
        connection_timeout_enabled: true,
        command_timeout: template.command_timeout || 60,
        command_timeout_enabled: true,
        pagination_pattern: template.pagination_pattern ?? defaultAdvancedConfig.pagination_pattern,
        pagination_enabled: template.pagination_pattern !== null && template.pagination_pattern !== undefined ? template.pagination_pattern !== "" : true,
        pagination_key: template.pagination_key ?? " ",
        pagination_key_enabled: template.pagination_key !== null && template.pagination_key !== undefined ? template.pagination_key !== "" : true,
        pre_commands: template.pre_commands ?? "",
        pre_commands_enabled: !!(template.pre_commands && template.pre_commands.trim()),
        post_commands: template.post_commands ?? "",
        post_commands_enabled: !!(template.post_commands && template.post_commands.trim()),
        error_patterns: template.error_patterns ?? "",
        error_patterns_enabled: !!(template.error_patterns && template.error_patterns.trim()),
        output_cleanup_patterns: template.output_cleanup_patterns ?? "",
        output_cleanup_patterns_enabled: !!(template.output_cleanup_patterns && template.output_cleanup_patterns.trim()),
        line_ending: template.line_ending ?? "\\n",
        telnet_sync_enabled: template.transport_options?.telnet_sync?.enabled ?? false,
        telnet_sync_idle_ms: template.transport_options?.telnet_sync?.idle_ms ?? 400,
      });
      if (template.steps && template.steps.length > 0) {
        setSteps(
          template.steps.map((step) => ({
            id: step.id,
            template_id: step.template_id,
            step_order: step.order,
            step_type: step.step_type === "conditional" ? "command" : step.step_type,
            command: step.step_type === "expect" || step.step_type === "set_prompt" ? null : step.content,
            expect_pattern: step.step_type === "expect" || step.step_type === "set_prompt" ? step.content : step.expect_pattern || null,
            timeout_seconds: step.step_type === "pause" ? 30 : (step.timeout || 30),
            delay_ms: step.step_type === "pause" ? (step.timeout || 1) * 1000 : 0,
            capture_output: step.capture_output ?? true,
            on_error: (step.on_failure as TemplateStep["on_error"]) || "continue",
            retry_count: step.max_retries || 0,
            description: null,
            enabled: true,
          }))
        );
      } else {
        setSteps([]);
      }
    } else {
      resetForm();
    }
    setDialogOpen(true);
  };

  const openPreview = (template: BackupTemplate) => {
    setPreviewTemplate(template);
    setPreviewDialogOpen(true);
  };

  const templateToExportFormat = (template: BackupTemplate) => {
    const exportTemplate: Record<string, unknown> = {
      name: template.name,
      description: template.description || null,
      use_steps: template.use_steps,
      commands: template.commands || null,
      prompt_pattern: template.prompt_pattern || null,
      login_prompt: template.login_prompt || null,
      password_prompt: template.password_prompt || null,
      enable_prompt: template.enable_prompt || null,
      enable_required: template.enable_required ?? false,
      enable_password_required: template.enable_password_required ?? false,
      connection_timeout: template.connection_timeout || 30,
      command_timeout: template.command_timeout || 60,
      pagination_pattern: template.pagination_pattern || null,
      pagination_key: template.pagination_key || null,
      pre_commands: template.pre_commands || null,
      post_commands: template.post_commands || null,
      output_cleanup_patterns: template.output_cleanup_patterns || null,
      error_patterns: template.error_patterns || null,
      line_ending: template.line_ending || "\\n",
      transport_options: template.transport_options || null,
    };

    if (template.use_steps && template.steps && template.steps.length > 0) {
      exportTemplate.steps = template.steps.map((step) => ({
        order: step.order,
        step_type: step.step_type,
        content: step.content,
        timeout: step.timeout || null,
        expect_pattern: step.expect_pattern || null,
        on_failure: step.on_failure || "continue",
        max_retries: step.max_retries || 0,
        condition: step.condition || null,
        capture_output: step.capture_output ?? true,
        variable_name: step.variable_name || null,
      }));
    }

    return exportTemplate;
  };

  const handleExportAllTemplates = () => {
    const exportData = {
      version: "1.0",
      exported_at: new Date().toISOString(),
      total_templates: templates.length,
      templates: templates.map((t) => templateToExportFormat(t)),
    };

    const yamlContent = yaml.dump(exportData, {
      indent: 2,
      lineWidth: -1,
      noRefs: true,
      quotingType: '"',
    });

    const blob = new Blob([yamlContent], { type: "application/x-yaml" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `all-templates-${new Date().toISOString().split("T")[0]}.yaml`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(t("toast.exported", { count: templates.length }));
  };

  const handleExportSelected = () => {
    const selectedList = templates.filter(t => selectedTemplates.has(t.id));
    if (selectedList.length === 0) {
      toast.error(t("toast.exportNone"));
      return;
    }

    // Se apenas 1 selecionado, exporta como template único
    const template = selectedList[0];
    const exportData = {
      version: "1.0",
      exported_at: new Date().toISOString(),
      template: templateToExportFormat(template),
    };

    const yamlContent = yaml.dump(exportData, {
      indent: 2,
      lineWidth: -1,
      noRefs: true,
      quotingType: '"',
    });

    const blob = new Blob([yamlContent], { type: "application/x-yaml" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `template-${template.name.toLowerCase().replace(/\s+/g, "-")}.yaml`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(t("toast.exported", { count: 1 }));
    clearSelection();
  };

  const handleDeleteSelected = async () => {
    if (selectedTemplates.size === 0) {
      toast.error(t("toast.deleteNone"));
      return;
    }

    if (!window.confirm(t("toast.confirmDelete", { count: selectedTemplates.size }))) return;

    let deletedCount = 0;
    let failedCount = 0;
    for (const id of selectedTemplates) {
      try {
        await deleteMutation.mutateAsync(id);
        deletedCount++;
      } catch (e: any) {
        failedCount++;
        const detail = e?.response?.data?.detail || tc("error");
        toast.error(detail);
      }
    }

    if (deletedCount > 0) {
      toast.success(t("toast.deleted", { count: deletedCount }));
    }
    if (deletedCount > 0) {
      clearSelection();
    }
  };

  const handleCloneSelected = async () => {
    if (selectedTemplates.size === 0) {
      toast.error(t("toast.cloneNone"));
      return;
    }

    const selectedList = templates.filter(t => selectedTemplates.has(t.id));
    let clonedCount = 0;
    for (const template of selectedList) {
      try {
        // Preparar steps se existirem
        const stepsPayload: TemplateStepCreate[] | undefined =
          template.use_steps && template.steps && template.steps.length > 0
            ? template.steps.map((step, idx) => ({
                order: step.order ?? idx + 1,
                step_type: step.step_type,
                content: step.content,
                timeout: step.timeout || undefined,
                expect_pattern: step.expect_pattern || undefined,
                on_failure: step.on_failure || "continue",
                max_retries: step.max_retries || 0,
                condition: step.condition || undefined,
                capture_output: step.capture_output ?? true,
                variable_name: step.variable_name || undefined,
              }))
            : undefined;

        await createMutation.mutateAsync({
          name: `${template.name} (${t("toast.cloneSuffix")})`,
          commands: template.commands || "",
          description: template.description || undefined,
          use_steps: template.use_steps || false,
          steps: stepsPayload,
          prompt_pattern: template.prompt_pattern || undefined,
          login_prompt: template.login_prompt || undefined,
          password_prompt: template.password_prompt || undefined,
          enable_prompt: template.enable_prompt || undefined,
          enable_required: template.enable_required ?? undefined,
          enable_password_required: template.enable_password_required ?? undefined,
          connection_timeout: template.connection_timeout || undefined,
          command_timeout: template.command_timeout || undefined,
          pagination_pattern: template.pagination_pattern || undefined,
          pagination_key: template.pagination_key || undefined,
          pre_commands: template.pre_commands || undefined,
          post_commands: template.post_commands || undefined,
          output_cleanup_patterns: template.output_cleanup_patterns || undefined,
          error_patterns: template.error_patterns || undefined,
          line_ending: template.line_ending || undefined,
          transport_options: template.transport_options || undefined,
        });
        clonedCount++;
      } catch (e) {
        console.error("Error cloning template:", e);
      }
    }

    toast.success(t("toast.cloned", { count: clonedCount }));
    clearSelection();
  };

  const handleImportTemplates = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      let data: any;

      // Tenta parsear como YAML (que também suporta JSON)
      try {
        data = yaml.load(text);
      } catch {
        // Fallback para JSON puro
        data = JSON.parse(text);
      }

      let templatesToImport: any[] = [];
      if (data.templates && Array.isArray(data.templates)) {
        templatesToImport = data.templates;
      } else if (data.template) {
        templatesToImport = [data.template];
      } else {
        throw new Error(t("toast.importInvalid"));
      }

      let importedCount = 0;
      for (const templateData of templatesToImport) {
        try {
          // Preparar steps se existirem
          const stepsPayload: TemplateStepCreate[] | undefined =
            templateData.use_steps && templateData.steps && Array.isArray(templateData.steps)
              ? templateData.steps.map((step: any, idx: number) => ({
                  order: step.order ?? idx + 1,
                  step_type: step.step_type || "command",
                  content: step.content || "",
                  timeout: step.timeout || undefined,
                  expect_pattern: step.expect_pattern || undefined,
                  on_failure: step.on_failure || "continue",
                  max_retries: step.max_retries || 0,
                  condition: step.condition || undefined,
                  capture_output: step.capture_output ?? true,
                  variable_name: step.variable_name || undefined,
                }))
              : undefined;

          await createMutation.mutateAsync({
            name: templateData.name,
            commands: templateData.commands || "",
            description: templateData.description || undefined,
            use_steps: templateData.use_steps || false,
            steps: stepsPayload,
            prompt_pattern: templateData.prompt_pattern || undefined,
            login_prompt: templateData.login_prompt || undefined,
            password_prompt: templateData.password_prompt || undefined,
            enable_prompt: templateData.enable_prompt || undefined,
            enable_required: templateData.enable_required ?? undefined,
            enable_password_required: templateData.enable_password_required ?? undefined,
            connection_timeout: templateData.connection_timeout || undefined,
            command_timeout: templateData.command_timeout || undefined,
            pagination_pattern: templateData.pagination_pattern || undefined,
            pagination_key: templateData.pagination_key || undefined,
            pre_commands: templateData.pre_commands || undefined,
            post_commands: templateData.post_commands || undefined,
            output_cleanup_patterns: templateData.output_cleanup_patterns || undefined,
            error_patterns: templateData.error_patterns || undefined,
            line_ending: templateData.line_ending || undefined,
            transport_options: templateData.transport_options || undefined,
          });
          importedCount++;
        } catch (e) {
          console.error("Error importing template:", e);
        }
      }

      toast.success(t("toast.imported", { count: importedCount }));
    } catch (error: any) {
      toast.error(error.message || t("toast.importError"));
    }

    event.target.value = "";
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto p-6 space-y-6">
        <div className="flex justify-between items-center flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold">{t("title")}</h1>
            <p className="text-muted-foreground">{t("subtitle")}</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {isModerator && <>
              <input
                type="file"
                accept=".yaml,.yml,.json"
                onChange={handleImportTemplates}
                className="hidden"
                id="import-templates-input"
              />
              <Button variant="outline" onClick={() => document.getElementById("import-templates-input")?.click()}>
                <Upload className="h-4 w-4 mr-2" />
                {tc("import")}
              </Button>
            </>}
            {templates.length > 0 && (
              <Button variant="outline" onClick={handleExportAllTemplates}>
                <Download className="h-4 w-4 mr-2" />
                {tc("exportAll")}
              </Button>
            )}
            {isModerator && (
              <Button onClick={() => openDialog()}>
                <Plus className="h-4 w-4 mr-2" />
                {t("create")}
              </Button>
            )}
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{t("list")}</CardTitle>
                <CardDescription>
                  {searchTerm
                    ? t("showing", { count: filteredTemplates.length, total: templates.length })
                    : t("total", { count: templates.length })}
                </CardDescription>
              </div>
              {selectedTemplates.size > 0 && isModerator && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    {selectedTemplates.size} {tc("selected")}
                  </span>
                  {selectedTemplates.size === 1 && (
                    <>
                      <Button variant="outline" size="sm" onClick={handleExportSelected}>
                        <Download className="h-4 w-4 mr-2" />
                        {tc("export")}
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleCloneSelected}>
                        <Copy className="h-4 w-4 mr-2" />
                        {tc("clone")}
                      </Button>
                    </>
                  )}
                  <Button variant="destructive" size="sm" onClick={handleDeleteSelected}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    {tc("delete")}
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t("searchPlaceholder")}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            {isLoading ? (
              <p>{tc("loading")}</p>
            ) : templates.length === 0 ? (
              <div className="text-center py-8">
                <Terminal className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">{t("none")}</p>
                {isModerator && (
                  <Button variant="outline" onClick={() => openDialog()}>
                    <Plus className="h-4 w-4 mr-2" />
                    {t("create")}
                  </Button>
                )}
              </div>
            ) : filteredTemplates.length === 0 ? (
              <div className="text-center py-8">
                <Terminal className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">{t("noneSearch")}</p>
                <p className="text-sm text-muted-foreground">
                  {t("noneSearchDesc")}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedTemplates.size === filteredTemplates.length && filteredTemplates.length > 0}
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                    <TableHead>{t("columns.name")}</TableHead>
                    <TableHead>{t("columns.mode")}</TableHead>
                    <TableHead>{t("columns.description")}</TableHead>
                    <TableHead className="text-right">{t("columns.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTemplates.map((template) => (
                    <TableRow key={template.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedTemplates.has(template.id)}
                          onCheckedChange={() => toggleTemplateSelection(template.id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{template.name}</TableCell>
                      <TableCell>
                        <Badge variant={template.use_steps ? "default" : "secondary"}>
                          {template.use_steps ? (
                            <>
                              <ListOrdered className="h-3 w-3 mr-1" /> {t("mode.steps")}
                            </>
                          ) : (
                            <>
                              <Terminal className="h-3 w-3 mr-1" /> {t("mode.simple")}
                            </>
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate">{template.description || "-"}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => openPreview(template)} title={tc("view")}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        {isModerator && (
                          <Button variant="ghost" size="sm" onClick={() => openDialog(template)} title={tc("edit")}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Main Edit/Create Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-4xl h-[90vh] overflow-hidden flex flex-col p-0">
            <DialogHeader className="px-6 py-4 border-b shrink-0">
              <DialogTitle>{editingTemplate ? tc("edit") : t("create")} Template</DialogTitle>
              <DialogDescription className="text-xs">{t("createDesc")}</DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="flex-1 overflow-hidden flex flex-col">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden flex flex-col">
                <TabsList className="grid grid-cols-3 mx-6 mt-4 mb-2 h-9">
                  <TabsTrigger value="basic" className="text-xs gap-1 px-2">
                    <Terminal className="h-3.5 w-3.5" />
                    {t("tabs.basic")}
                  </TabsTrigger>
                  <TabsTrigger value="steps" className="text-xs gap-1 px-2" disabled={!formData.use_steps}>
                    <ListOrdered className="h-3.5 w-3.5" />
                    {t("tabs.steps")}
                  </TabsTrigger>
                  <TabsTrigger value="advanced" className="text-xs gap-1 px-2">
                    <Settings2 className="h-3.5 w-3.5" />
                    {t("tabs.advanced")}
                  </TabsTrigger>
                </TabsList>

                <ScrollArea className="flex-1 px-6">
                  <TabsContent value="basic" className="space-y-4 mt-0 pb-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">{t("fields.name")}</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                      />
                    </div>

                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <Label>{t("fields.useSteps")}</Label>
                        <p className="text-sm text-muted-foreground">{t("fields.useStepsDesc")}</p>
                      </div>
                      <Switch
                        checked={formData.use_steps}
                        onCheckedChange={(checked) => {
                          setFormData({ ...formData, use_steps: checked });
                          if (checked) setActiveTab("steps");
                        }}
                      />
                    </div>

                    {!formData.use_steps && (
                      <div className="space-y-2">
                        <Label htmlFor="commands">{t("fields.commands")}</Label>
                        <Textarea
                          id="commands"
                          value={formData.commands}
                          onChange={(e) => setFormData({ ...formData, commands: e.target.value })}
                          rows={8}
                          placeholder={t("fields.commandsPlaceholder")}
                          className="font-mono text-sm"
                          required={!formData.use_steps}
                        />
                        <p className="text-xs text-muted-foreground">{t("fields.commandsHint")}</p>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="description">{t("fields.description")}</Label>
                      <Textarea
                        id="description"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        rows={2}
                      />
                    </div>
                  </TabsContent>

                  <TabsContent value="steps" className="mt-0 pb-4">
                    <TemplateStepEditor steps={steps} onStepsChange={setSteps} templateId={editingTemplate?.id || "new"} />
                  </TabsContent>

                  <TabsContent value="advanced" className="mt-0 pb-4">
                    <TemplateAdvancedSettings config={advancedConfig} onChange={setAdvancedConfig} />
                  </TabsContent>
                </ScrollArea>
              </Tabs>

              <div className="flex justify-end gap-2 px-6 py-4 border-t shrink-0">
                <Button type="button" variant="outline" size="sm" onClick={() => setDialogOpen(false)}>
                  {tc("cancel")}
                </Button>
                <Button type="submit" size="sm" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editingTemplate ? tc("update") : tc("create")}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Preview Dialog */}
        <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
            <DialogHeader>
              <DialogTitle>{t("viewTitle", { name: previewTemplate?.name })}</DialogTitle>
            </DialogHeader>
            {previewTemplate && (
              <div className="space-y-4">
                <div>
                  <Label className="text-muted-foreground">{t("columns.mode")}</Label>
                  <p>{previewTemplate.use_steps ? t("mode.steps") : t("mode.simple")}</p>
                </div>

                {previewTemplate.description && (
                  <div>
                    <Label className="text-muted-foreground">{t("fields.description")}</Label>
                    <p>{previewTemplate.description}</p>
                  </div>
                )}

                <div>
                  <Label className="text-muted-foreground">{t("commandsLabel")}</Label>
                  <pre className="mt-2 p-4 bg-muted rounded font-mono text-sm whitespace-pre-wrap">{previewTemplate.commands || t("noCommands")}</pre>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">{t("fields.connectionTimeout")}</Label>
                    <p>{previewTemplate.connection_timeout || 30}s</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">{t("fields.commandTimeout")}</Label>
                    <p>{previewTemplate.command_timeout || 60}s</p>
                  </div>
                </div>

                {previewTemplate.pre_commands && (
                  <div>
                    <Label className="text-muted-foreground">{t("fields.preCommands")}</Label>
                    <pre className="mt-1 p-2 bg-muted rounded font-mono text-xs">{previewTemplate.pre_commands}</pre>
                  </div>
                )}

                {previewTemplate.post_commands && (
                  <div>
                    <Label className="text-muted-foreground">{t("fields.postCommands")}</Label>
                    <pre className="mt-1 p-2 bg-muted rounded font-mono text-xs">{previewTemplate.post_commands}</pre>
                  </div>
                )}

                {previewTemplate.transport_options?.telnet_sync?.enabled && (
                  <div>
                    <Label className="text-muted-foreground">{t("advanced.telnetSync.title")}</Label>
                    <div className="mt-1 p-3 bg-muted rounded text-xs space-y-1">
                      <p>{t("advanced.telnetSync.idleMs")}: {previewTemplate.transport_options.telnet_sync.idle_ms ?? defaultAdvancedConfig.telnet_sync_idle_ms}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

export default BackupTemplates;
