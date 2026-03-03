import { useState, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DeviceCreate, DeviceUpdate, toggleDeviceBackup, updateDevice } from "@/services/devices";
import { getBrands, Brand } from "@/services/brands";
import { getCategories, Category } from "@/services/categories";
import { Credential } from "@/services/credentials";
import { useCredentials } from "@/hooks/useCredentials";
import { getTemplates, BackupTemplate } from "@/services/templates";
import { getDeviceModels, DeviceModel } from "@/services/deviceModels";
import { useDevices, useCreateDevice, useUpdateDevice, useDeleteDevice, useToggleDeviceBackup, useExecuteDeviceBackup } from "@/hooks/useDevices";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Server, Search, RefreshCw, History, Power, FileText, Play, Pencil, PowerOff, Loader2, Trash2, Archive, Copy } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { getSystemSettings } from "@/services/admin";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import { ptBR, enUS } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";

const DEVICE_SEARCH_KEY = "configuard_device_search";

const DeviceList = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isModerator } = useAuth();
  const { t, i18n } = useTranslation("devices");
  const dateFnsLocale = i18n.language === "pt-BR" ? ptBR : enUS;
  const [searchTerm, setSearchTerm] = useState(() => {
    return localStorage.getItem(DEVICE_SEARCH_KEY) || "";
  });
  const [brandFilter, setBrandFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [modelFilter, setModelFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<any>(null);
  const [runningDeviceId, setRunningDeviceId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deviceToDelete, setDeviceToDelete] = useState<any>(null);
  const [selectedDevices, setSelectedDevices] = useState<Set<string>>(new Set());
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [bulkToggleLoading, setBulkToggleLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    ip_address: "",
    hostname: "",
    protocol: "ssh" as "ssh" | "telnet",
    port: "22",
    brand_id: "",
    category_id: "",
    model_id: "",
    credential_id: "",
    backup_template_id: "",
    notes: "",
    custom_retention: false,
    retention_versions: 10,
  });
  const [editFormData, setEditFormData] = useState({
    name: "",
    ip_address: "",
    hostname: "",
    protocol: "ssh" as "ssh" | "telnet",
    port: "22",
    brand_id: "",
    category_id: "",
    model_id: "",
    credential_id: "",
    backup_template_id: "",
    notes: "",
    status: "active",
    custom_retention: false,
    retention_versions: 10,
  });
  const [globalRetention, setGlobalRetention] = useState(10);

  // Fetch brands, categories, credentials, templates
  const { data: brands = [] } = useQuery({
    queryKey: ["brands"],
    queryFn: getBrands,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: getCategories,
  });

  const { data: credentials = [] } = useCredentials();

  const { data: templates = [] } = useQuery({
    queryKey: ["templates"],
    queryFn: getTemplates,
  });

  const { data: deviceModels = [] } = useQuery({
    queryKey: ["device-models"],
    queryFn: () => getDeviceModels(),
  });

  // Load global retention setting
  const { data: systemSettings } = useQuery({
    queryKey: ["system-settings"],
    queryFn: getSystemSettings,
  });

  // Update global retention when settings load
  useEffect(() => {
    if (systemSettings?.retention_versions) {
      setGlobalRetention(systemSettings.retention_versions);
    }
  }, [systemSettings]);

  // Persist search term in localStorage
  useEffect(() => {
    if (searchTerm) {
      localStorage.setItem(DEVICE_SEARCH_KEY, searchTerm);
    } else {
      localStorage.removeItem(DEVICE_SEARCH_KEY);
    }
  }, [searchTerm]);

  // Fetch devices
  const { data: devicesData, isLoading, refetch } = useDevices({
    brand_id: brandFilter !== "all" ? brandFilter : undefined,
    category_id: categoryFilter !== "all" ? categoryFilter : undefined,
    model_id: modelFilter !== "all" ? modelFilter : undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
    page: 1,
    page_size: 100,
  });

  const devices = devicesData?.items || [];

  const createMutation = useCreateDevice();

  const updateMutation = useUpdateDevice();

  const toggleBackupMutation = useToggleDeviceBackup();

  const executeBackupMutation = useExecuteDeviceBackup();

  const deleteMutation = useDeleteDevice();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const deviceData: DeviceCreate = {
      name: formData.name,
      ip_address: formData.ip_address,
      hostname: formData.hostname || undefined,
      port: parseInt(formData.port),
      brand_id: formData.brand_id || undefined,
      category_id: formData.category_id || undefined,
      model_id: formData.model_id || undefined,
      credential_id: formData.credential_id || undefined,
      backup_template_id: formData.backup_template_id || undefined,
      notes: formData.notes || undefined,
      custom_retention: formData.custom_retention,
      retention_versions: formData.custom_retention ? formData.retention_versions : undefined,
    };
    createMutation.mutate(deviceData, {
      onSuccess: () => {
        toast.success(t("toast.added"));
        setDialogOpen(false);
        setFormData({
          name: "",
          ip_address: "",
          hostname: "",
          protocol: "ssh",
          port: "22",
          brand_id: "",
          category_id: "",
          model_id: "",
          credential_id: "",
          backup_template_id: "",
          notes: "",
          custom_retention: false,
          retention_versions: globalRetention,
        });
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.detail || error.message);
      },
    });
  };

  const filteredDevices = devices.filter((device) => {
    const matchesSearch =
      device.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      device.ip_address.includes(searchTerm) ||
      device.hostname?.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesSearch;
  });

  const toggleBackup = (deviceId: string, currentState: boolean) => {
    toggleBackupMutation.mutate(
      { id: deviceId, enabled: !currentState },
      {
        onSuccess: () => {
          toast.success(!currentState ? t("toast.backupEnabled") : t("toast.backupDisabled"));
        },
        onError: (error: any) => {
          toast.error(error.response?.data?.detail || error.message);
        },
      }
    );
  };

  const executeBackup = (deviceId: string, deviceName: string) => {
    toast.info(t("toast.backupRunning", { name: deviceName }));
    setRunningDeviceId(deviceId);
    executeBackupMutation.mutate(deviceId, {
      onSuccess: () => {
        toast.success(t("toast.backupSuccess"));
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.detail || error.message);
      },
      onSettled: () => {
        setRunningDeviceId(null);
      },
    });
  };

  const openDeleteDialog = (device: any) => {
    setDeviceToDelete(device);
    setDeleteDialogOpen(true);
  };

  const handleDeleteDevice = () => {
    if (!deviceToDelete) return;
    deleteMutation.mutate(deviceToDelete.id, {
      onSuccess: () => {
        toast.success(t("toast.deleted"));
        setDeleteDialogOpen(false);
        setDeviceToDelete(null);
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.detail || error.message);
      },
    });
  };

  const openEditDialog = (device: any) => {
    setEditingDevice(device);
    // Detect protocol from port (22=SSH, 23=Telnet)
    const port = device.port?.toString() || "22";
    const detectedProtocol = port === "23" ? "telnet" : "ssh";
    setEditFormData({
      name: device.name || "",
      ip_address: device.ip_address || "",
      hostname: device.hostname || "",
      protocol: detectedProtocol,
      port: port,
      brand_id: device.brand_id || "",
      category_id: device.category_id || "",
      model_id: device.model_id || "",
      credential_id: device.credential_id || "",
      backup_template_id: device.backup_template_id || "",
      notes: device.notes || "",
      status: device.status || "active",
      custom_retention: device.custom_retention || false,
      retention_versions: device.retention_versions || globalRetention,
    });
    setEditDialogOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDevice) return;

    const deviceData: DeviceUpdate = {
      name: editFormData.name,
      ip_address: editFormData.ip_address,
      hostname: editFormData.hostname || undefined,
      port: parseInt(editFormData.port),
      brand_id: editFormData.brand_id || null,
      category_id: editFormData.category_id || null,
      model_id: editFormData.model_id || null,
      credential_id: editFormData.credential_id || null,
      backup_template_id: editFormData.backup_template_id || null,
      notes: editFormData.notes || undefined,
      status: editFormData.status,
      custom_retention: editFormData.custom_retention,
      retention_versions: editFormData.custom_retention ? editFormData.retention_versions : null,
    };
    updateMutation.mutate(
      { id: editingDevice.id, data: deviceData },
      {
        onSuccess: () => {
          toast.success(t("toast.updated"));
          setEditDialogOpen(false);
          setEditingDevice(null);
          queryClient.invalidateQueries({ queryKey: ["devices"] });
        },
        onError: (error: any) => {
          toast.error(error.response?.data?.detail || error.message);
        },
      }
    );
  };

  // Selection functions
  const toggleDeviceSelection = (deviceId: string) => {
    const newSelection = new Set(selectedDevices);
    if (newSelection.has(deviceId)) {
      newSelection.delete(deviceId);
    } else {
      newSelection.add(deviceId);
    }
    setSelectedDevices(newSelection);
  };

  const toggleSelectAll = () => {
    if (selectedDevices.size === filteredDevices.length) {
      setSelectedDevices(new Set());
    } else {
      setSelectedDevices(new Set(filteredDevices.map((d) => d.id)));
    }
  };

  const clearSelection = () => {
    setSelectedDevices(new Set());
  };

  // Clone single device
  const handleCloneDevice = async () => {
    if (selectedDevices.size !== 1) return;

    const deviceId = Array.from(selectedDevices)[0];
    const device = devices.find((d) => d.id === deviceId);
    if (!device) return;

    const cloneData: DeviceCreate = {
      name: `${device.name} (Cópia)`,
      ip_address: device.ip_address,
      hostname: device.hostname || undefined,
      port: device.port,
      brand_id: device.brand_id || undefined,
      category_id: device.category_id || undefined,
      model_id: device.model_id || undefined,
      credential_id: device.credential_id || undefined,
      backup_template_id: device.backup_template_id || undefined,
      notes: device.notes || undefined,
      custom_retention: device.custom_retention,
      retention_versions: device.retention_versions || undefined,
    };

    createMutation.mutate(cloneData, {
      onSuccess: () => {
        toast.success(t("toast.cloned", { name: device.name }));
        clearSelection();
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.detail || error.message);
      },
    });
  };

  // Bulk delete
  const handleBulkDelete = async () => {
    const deviceIds = Array.from(selectedDevices);
    let successCount = 0;
    let errorCount = 0;

    for (const id of deviceIds) {
      try {
        await deleteMutation.mutateAsync(id);
        successCount++;
      } catch {
        errorCount++;
      }
    }

    if (successCount > 0) {
      toast.success(t("toast.bulkDeleted", { count: successCount }));
    }
    if (errorCount > 0) {
      toast.error(t("toast.bulkDeleteFailed", { count: errorCount }));
    }

    setBulkDeleteDialogOpen(false);
    clearSelection();
  };

  // Check if should show "Ativar" or "Desativar" button
  // Returns true if should activate (any inactive or mixed), false if should deactivate (all active)
  const shouldActivateSelected = (): boolean => {
    const selectedDevicesList = filteredDevices.filter((d) => selectedDevices.has(d.id));
    if (selectedDevicesList.length === 0) return true;
    // If ALL are active, show "Desativar". Otherwise show "Ativar"
    const allActive = selectedDevicesList.every((d) => d.status === "active");
    return !allActive;
  };

  // Bulk toggle status - enable or disable all selected devices
  const handleBulkToggleStatus = async () => {
    const setActive = shouldActivateSelected();
    setBulkToggleLoading(true);
    const deviceIds = Array.from(selectedDevices);
    let successCount = 0;
    let errorCount = 0;

    try {
      // Run updates sequentially to avoid race conditions
      for (const id of deviceIds) {
        try {
          await updateDevice(id, { status: setActive ? "active" : "inactive" });
          successCount++;
        } catch (error) {
          console.error(`Failed to toggle device ${id}:`, error);
          errorCount++;
        }
      }

      // Invalidate all device queries to force refetch
      await queryClient.invalidateQueries({ queryKey: ["devices"] });

      if (successCount > 0) {
        toast.success(t("toast.bulkToggled", { count: successCount, action: setActive ? t("toast.activated") : t("toast.deactivated") }));
      }
      if (errorCount > 0) {
        toast.error(t("toast.bulkToggleFailed", { count: errorCount }));
      }

      clearSelection();
    } finally {
      setBulkToggleLoading(false);
    }
  };

  // Auto-fill brand/category when model is selected (create form)
  const handleModelChange = useCallback((modelId: string) => {
    const selectedModel = deviceModels.find((m) => m.id === modelId);
    setFormData((prev) => ({
      ...prev,
      model_id: modelId,
      brand_id: selectedModel?.brand_id ? selectedModel.brand_id : prev.brand_id,
      category_id: selectedModel?.category_id ? selectedModel.category_id : prev.category_id,
    }));
  }, [deviceModels]);

  // Auto-fill brand/category when model is selected (edit form)
  const handleEditModelChange = useCallback((modelId: string) => {
    const selectedModel = deviceModels.find((m) => m.id === modelId);
    setEditFormData((prev) => ({
      ...prev,
      model_id: modelId === "none" ? "" : modelId,
      ...(selectedModel?.brand_id ? { brand_id: selectedModel.brand_id } : {}),
      ...(selectedModel?.category_id ? { category_id: selectedModel.category_id } : {}),
    }));
  }, [deviceModels]);

  return (
    <Card className="border-border bg-card shadow-[var(--shadow-card)]">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Server className="h-5 w-5 text-primary" />
            <CardTitle>{t("title")}</CardTitle>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="border-border"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            {isModerator && <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  size="sm"
                  className="bg-primary hover:bg-primary/90"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {t("addDevice")}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>{t("addDevice")}</DialogTitle>
                  <DialogDescription>
                    {t("addDeviceDesc")}
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">{t("fields.name")}</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Ex: SW-CORE-01"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ip_address">{t("fields.ip")}</Label>
                      <Input
                        id="ip_address"
                        value={formData.ip_address}
                        onChange={(e) => setFormData({ ...formData, ip_address: e.target.value })}
                        placeholder="Ex: 192.168.1.1"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="hostname">{t("fields.hostname")}</Label>
                      <Input
                        id="hostname"
                        value={formData.hostname}
                        onChange={(e) => setFormData({ ...formData, hostname: e.target.value })}
                        placeholder="Ex: core-switch-01"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="protocol">{t("protocol")}</Label>
                      <Select
                        value={formData.protocol}
                        onValueChange={(value: "ssh" | "telnet") => {
                          const defaultPort = value === "ssh" ? "22" : "23";
                          setFormData({
                            ...formData,
                            protocol: value,
                            port: defaultPort,
                          });
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ssh">SSH</SelectItem>
                          <SelectItem value="telnet">Telnet</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="port">{t("fields.port")}</Label>
                      <Input
                        id="port"
                        type="number"
                        value={formData.port}
                        onChange={(e) => setFormData({ ...formData, port: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="model_id">{t("fields.model")}</Label>
                      <Select
                        value={formData.model_id || "none"}
                        onValueChange={(value) => handleModelChange(value === "none" ? "" : value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={t("modelOptional")} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">{t("noModel")}</SelectItem>
                          {deviceModels.map((model) => (
                            <SelectItem key={model.id} value={model.id}>
                              {model.name}
                              {model.brand?.name ? ` — ${model.brand.name}` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="brand_id">{t("fields.brand")}</Label>
                      <Select
                        value={formData.brand_id || "none"}
                        onValueChange={(value) => setFormData({ ...formData, brand_id: value === "none" ? "" : value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={t("selectBrand")} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">{t("noBrand")}</SelectItem>
                          {brands.map((brand) => (
                            <SelectItem key={brand.id} value={brand.id}>
                              {brand.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="category_id">{t("fields.category")}</Label>
                      <Select
                        value={formData.category_id || "none"}
                        onValueChange={(value) => setFormData({ ...formData, category_id: value === "none" ? "" : value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={t("selectCategory")} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">{t("noCategory")}</SelectItem>
                          {categories.map((category) => (
                            <SelectItem key={category.id} value={category.id}>
                              {category.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="credential_id">{t("fields.credential")} *</Label>
                      <Select
                        value={formData.credential_id}
                        onValueChange={(value) => setFormData({ ...formData, credential_id: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={t("selectCredential")} />
                        </SelectTrigger>
                        <SelectContent>
                          {credentials.length === 0 ? (
                            <SelectItem value="none" disabled>
                              {t("noCredentials")}
                            </SelectItem>
                          ) : (
                            credentials.map((cred) => (
                              <SelectItem key={cred.id} value={cred.id}>
                                {cred.name} ({cred.username})
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="backup_template_id">{t("fields.template")}</Label>
                      <Select
                        value={formData.backup_template_id}
                        onValueChange={(value) => setFormData({ ...formData, backup_template_id: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={t("selectTemplate")} />
                        </SelectTrigger>
                        <SelectContent>
                          {templates.length === 0 ? (
                            <SelectItem value="none" disabled>
                              {t("noTemplates")}
                            </SelectItem>
                          ) : (
                            templates.map((template) => (
                              <SelectItem key={template.id} value={template.id}>
                                {template.name}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="notes">{t("observations")}</Label>
                      <Textarea
                        id="notes"
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        rows={2}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="custom_retention" className="flex items-center gap-2">
                        <Archive className="h-4 w-4" />
                        {t("retention")}
                        <span className="text-xs text-muted-foreground font-normal">
                          {t("retentionDefault", { count: globalRetention })}
                        </span>
                      </Label>
                      <div className="flex items-center gap-2 h-9">
                        <Switch
                          id="custom_retention"
                          checked={formData.custom_retention}
                          onCheckedChange={(checked) => setFormData({
                            ...formData,
                            custom_retention: checked,
                            retention_versions: checked ? formData.retention_versions : globalRetention
                          })}
                        />
                        <span className="text-sm text-muted-foreground">{t("customize")}</span>
                        {formData.custom_retention && (
                          <Input
                            id="retention_versions"
                            type="number"
                            min={1}
                            max={1000}
                            value={formData.retention_versions}
                            onChange={(e) => setFormData({ ...formData, retention_versions: parseInt(e.target.value) || 1 })}
                            className="w-20"
                          />
                        )}
                      </div>
                    </div>
                  </div>

                  <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                    {createMutation.isPending ? t("adding") : t("addDevice")}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("searchPlaceholderFull")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-input border-border"
            />
          </div>

          <div className="grid grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="brand-filter">{t("filters.brand")}</Label>
              <Select value={brandFilter} onValueChange={setBrandFilter}>
                <SelectTrigger id="brand-filter">
                  <SelectValue placeholder={t("filters.allBrands")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("filters.allBrands")}</SelectItem>
                  {brands.map((brand) => (
                    <SelectItem key={brand.id} value={brand.id}>
                      {brand.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="category-filter">{t("filters.category")}</Label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger id="category-filter">
                  <SelectValue placeholder={t("filters.allCategories")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("filters.allCategories")}</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="model-filter">{t("filters.model")}</Label>
              <Select value={modelFilter} onValueChange={setModelFilter}>
                <SelectTrigger id="model-filter">
                  <SelectValue placeholder={t("filters.allModels")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("filters.allModels")}</SelectItem>
                  {deviceModels.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      {model.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status-filter">{t("filters.status")}</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger id="status-filter">
                  <SelectValue placeholder={t("filters.allStatuses")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("filters.allStatuses")}</SelectItem>
                  <SelectItem value="active">{t("status.active")}</SelectItem>
                  <SelectItem value="inactive">{t("status.inactive")}</SelectItem>
                  <SelectItem value="maintenance">{t("status.maintenance")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Bulk actions bar */}
          {selectedDevices.size > 0 && isModerator && (
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <span className="text-sm font-medium">
                {t("bulk.selected", { count: selectedDevices.size })}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCloneDevice}
                  disabled={selectedDevices.size !== 1 || createMutation.isPending}
                  title={selectedDevices.size !== 1 ? t("bulk.cloneTitle") : t("bulk.cloneTitleOk")}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  {t("bulk.clone")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBulkToggleStatus}
                  disabled={bulkToggleLoading}
                  title={shouldActivateSelected() ? t("bulk.activateTitle") : t("bulk.deactivateTitle")}
                >
                  {bulkToggleLoading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : shouldActivateSelected() ? (
                    <Power className="h-4 w-4 mr-2" />
                  ) : (
                    <PowerOff className="h-4 w-4 mr-2" />
                  )}
                  {shouldActivateSelected() ? t("bulk.activate") : t("bulk.deactivate")}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setBulkDeleteDialogOpen(true)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {t("bulk.delete", { count: selectedDevices.size })}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearSelection}
                >
                  {t("bulk.clearSelection")}
                </Button>
              </div>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">
            {t("loading")}
          </div>
        ) : filteredDevices && filteredDevices.length > 0 ? (
          <div className="rounded-md border border-border overflow-hidden">
            <Table>
              <TableHeader className="bg-muted">
                <TableRow className="hover:bg-muted border-border">
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedDevices.size === filteredDevices.length && filteredDevices.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead className="text-foreground">{t("columns.deviceName")}</TableHead>
                  <TableHead className="text-foreground">{t("columns.ipAddress")}</TableHead>
                  <TableHead className="text-foreground">{t("columns.brand")}</TableHead>
                  <TableHead className="text-foreground">{t("columns.category")}</TableHead>
                  <TableHead className="text-foreground">{t("columns.lastBackup")}</TableHead>
                  <TableHead className="text-foreground">{t("columns.status")}</TableHead>
                  <TableHead className="text-foreground text-center">{t("columns.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDevices.map((device) => (
                  <TableRow
                    key={device.id}
                    className="cursor-pointer hover:bg-secondary/50 border-border transition-colors"
                    onClick={() => navigate(`/devices/${device.id}`)}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedDevices.has(device.id)}
                        onCheckedChange={() => toggleDeviceSelection(device.id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{device.name}</TableCell>
                    <TableCell className="font-mono text-sm">{device.ip_address}</TableCell>
                    <TableCell>
                      {device.brand?.name || "-"}
                    </TableCell>
                    <TableCell>
                      {device.category?.name || "-"}
                    </TableCell>
                    <TableCell>
                      {device.last_backup_at
                        ? format(new Date(device.last_backup_at), "PPp", { locale: dateFnsLocale })
                        : t("never")}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={
                          device.status === "active"
                            ? "bg-accent/20 text-accent border-accent/30"
                            : "bg-muted text-muted-foreground border-border"
                        }
                      >
                        {device.status}
                      </Badge>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-accent hover:text-accent/80 hover:bg-accent/10"
                          onClick={() => executeBackup(device.id, device.name)}
                          title={t("tooltips.runBackup")}
                          disabled={runningDeviceId === device.id}
                        >
                          {runningDeviceId === device.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Play className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-primary hover:text-primary/80 hover:bg-primary/10"
                          onClick={() => navigate(`/devices/${device.id}/history`)}
                          title={t("tooltips.history")}
                        >
                          <History className="h-4 w-4" />
                        </Button>
                        {isModerator && <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-blue-500 hover:text-blue-400 hover:bg-blue-500/10"
                          onClick={() => openEditDialog(device)}
                          title={t("tooltips.edit")}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 hover:bg-muted"
                          onClick={() => navigate(`/devices/${device.id}/logs`)}
                          title={t("tooltips.logs")}
                        >
                          <FileText className="h-4 w-4" />
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
            <Server className="h-16 w-16 mx-auto text-muted-foreground opacity-50" />
            <div>
              <p className="text-lg font-medium text-foreground">{t("noneFound")}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {searchTerm ? t("noneFoundSearch") : t("noneFoundEmpty")}
              </p>
            </div>
          </div>
        )}
      </CardContent>

      {/* Edit Device Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("edit")}</DialogTitle>
            <DialogDescription>
              {t("editDeviceDesc")}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">{t("fields.name")}</Label>
                <Input
                  id="edit-name"
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  placeholder="Ex: SW-CORE-01"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-ip_address">{t("fields.ip")}</Label>
                <Input
                  id="edit-ip_address"
                  value={editFormData.ip_address}
                  onChange={(e) => setEditFormData({ ...editFormData, ip_address: e.target.value })}
                  placeholder="Ex: 192.168.1.1"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-hostname">{t("fields.hostname")}</Label>
                <Input
                  id="edit-hostname"
                  value={editFormData.hostname}
                  onChange={(e) => setEditFormData({ ...editFormData, hostname: e.target.value })}
                  placeholder="Ex: core-switch-01"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-protocol">{t("protocol")}</Label>
                <Select
                  value={editFormData.protocol}
                  onValueChange={(value: "ssh" | "telnet") => {
                    const defaultPort = value === "ssh" ? "22" : "23";
                    setEditFormData({
                      ...editFormData,
                      protocol: value,
                      port: defaultPort,
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ssh">SSH</SelectItem>
                    <SelectItem value="telnet">Telnet</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-port">{t("fields.port")}</Label>
                <Input
                  id="edit-port"
                  type="number"
                  value={editFormData.port}
                  onChange={(e) => setEditFormData({ ...editFormData, port: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-model_id">{t("fields.model")}</Label>
                <Select
                  value={editFormData.model_id || "none"}
                  onValueChange={handleEditModelChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("modelOptional")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("noModel")}</SelectItem>
                    {deviceModels.map((model) => (
                      <SelectItem key={model.id} value={model.id}>
                        {model.name}
                        {model.brand?.name ? ` — ${model.brand.name}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-brand_id">{t("fields.brand")}</Label>
                <Select
                  value={editFormData.brand_id || "none"}
                  onValueChange={(value) => setEditFormData({ ...editFormData, brand_id: value === "none" ? "" : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("selectBrand")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("noBrand")}</SelectItem>
                    {brands.map((brand) => (
                      <SelectItem key={brand.id} value={brand.id}>
                        {brand.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-category_id">{t("fields.category")}</Label>
                <Select
                  value={editFormData.category_id || "none"}
                  onValueChange={(value) => setEditFormData({ ...editFormData, category_id: value === "none" ? "" : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("selectCategory")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("noCategory")}</SelectItem>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-credential_id">{t("fields.credential")}</Label>
                <Select
                  value={editFormData.credential_id || "none"}
                  onValueChange={(value) => setEditFormData({ ...editFormData, credential_id: value === "none" ? "" : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("selectCredential")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("noCredential")}</SelectItem>
                    {credentials.map((cred) => (
                      <SelectItem key={cred.id} value={cred.id}>
                        {cred.name} ({cred.username})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-backup_template_id">{t("fields.template")}</Label>
                <Select
                  value={editFormData.backup_template_id || "none"}
                  onValueChange={(value) =>
                    setEditFormData({ ...editFormData, backup_template_id: value === "none" ? "" : value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("selectTemplate")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("noTemplateOpt")}</SelectItem>
                    {templates.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-status">{t("columns.status")}</Label>
                <Select
                  value={editFormData.status}
                  onValueChange={(value) => setEditFormData({ ...editFormData, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("selectStatus")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">{t("status.active")}</SelectItem>
                    <SelectItem value="inactive">{t("status.inactive")}</SelectItem>
                    <SelectItem value="maintenance">{t("status.maintenance")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-retention" className="flex items-center gap-1">
                  {t("retention")}
                  <span className="text-xs text-muted-foreground ml-1">
                    ({editFormData.custom_retention ? t("retentionCustom") : t("retentionGlobal", { count: globalRetention })})
                  </span>
                </Label>
                <div className="flex items-center gap-2">
                  <Switch
                    id="edit-custom-retention"
                    checked={editFormData.custom_retention}
                    onCheckedChange={(checked) => setEditFormData({
                      ...editFormData,
                      custom_retention: checked,
                      retention_versions: checked ? editFormData.retention_versions : globalRetention
                    })}
                  />
                  {editFormData.custom_retention && (
                    <Input
                      id="edit-retention"
                      type="number"
                      min={1}
                      max={1000}
                      value={editFormData.retention_versions}
                      onChange={(e) => setEditFormData({
                        ...editFormData,
                        retention_versions: parseInt(e.target.value) || 1
                      })}
                      className="w-20"
                    />
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-notes">{t("observations")}</Label>
              <Textarea
                id="edit-notes"
                value={editFormData.notes}
                onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                rows={3}
              />
            </div>

            <Button type="submit" className="w-full" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? t("saving") : t("saveChanges")}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteDialog.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteDialog.desc", { name: deviceToDelete?.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeviceToDelete(null)}>{t("common:cancel", { defaultValue: "Cancelar" })}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteDevice}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? t("deleteDialog.deleting") : t("deleteDialog.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Confirmation Dialog */}
      <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("bulkDeleteDialog.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("bulkDeleteDialog.desc", { count: selectedDevices.size })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common:cancel", { defaultValue: "Cancelar" })}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? t("bulkDeleteDialog.deleting") : t("bulkDeleteDialog.confirm", { count: selectedDevices.size })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};

export default DeviceList;
