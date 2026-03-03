import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar, Plus, Edit, Trash2, FolderTree, Monitor, ChevronRight, Check, Minus } from "lucide-react";
import { getSchedules, updateSchedule, deleteSchedule, createSchedule, Schedule, ScheduleCreate, ScheduleUpdate } from "@/services/schedules";
import { useDevices } from "@/hooks/useDevices";
import { useCategories } from "@/hooks/useCategories";
import { useTranslation } from "react-i18next";

const Schedules = () => {
  const queryClient = useQueryClient();
  const { data: devicesData } = useDevices();
  const devices = devicesData?.items ?? [];
  const { data: categories = [] } = useCategories();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Schedule | null>(null);
  const [formData, setFormData] = useState<ScheduleCreate>({
    name: "",
    description: "",
    schedule_type: "daily",
    time_of_day: "02:00",
    device_ids: [],
    category_ids: [],
    is_active: true,
  });
  // which category is focused in the left panel (to show its devices on right)
  const [focusedCategoryId, setFocusedCategoryId] = useState<string | null>(null);
  // right panel tab: "categories" or "devices"
  const [rightTab, setRightTab] = useState<"categories" | "devices">("categories");

  const { t } = useTranslation("schedules");
  const { t: tc } = useTranslation("common");

  const formatFrequency = (schedule: Schedule): string => {
    switch (schedule.schedule_type) {
      case "daily": return t("frequency.daily");
      case "weekly": return schedule.day_of_week !== undefined ? t("frequency.weekly", { day: schedule.day_of_week }) : t("types.weekly");
      case "monthly": return schedule.day_of_month ? t("frequency.monthly", { day: schedule.day_of_month }) : t("types.monthly");
      case "cron": return t("frequency.cron");
      default: return t("types.custom");
    }
  };

  const formatTime = (schedule: Schedule): string => {
    if (schedule.schedule_type === "cron" && schedule.cron_expression) return schedule.cron_expression;
    return schedule.time_of_day || "--:--";
  };

  const { data: schedules = [], isLoading } = useQuery({ queryKey: ["schedules"], queryFn: getSchedules });

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) => updateSchedule(id, { is_active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["schedules"] }),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteSchedule(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["schedules"] }),
  });
  const createMutation = useMutation({
    mutationFn: (data: ScheduleCreate) => createSchedule(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["schedules"] }),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ScheduleUpdate }) => updateSchedule(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["schedules"] }),
  });

  const schedulesView = useMemo(() => schedules.map((s) => ({
    ...s, frequency: formatFrequency(s), timeLabel: formatTime(s),
    lastRun: s.last_run_at || "-", nextRun: s.next_run_at || "-",
  })), [schedules, t]);

  const resetDialog = () => {
    setFocusedCategoryId(null);
    setRightTab("categories");
  };

  const openCreate = () => {
    setEditing(null);
    resetDialog();
    setFormData({ name: "", description: "", schedule_type: "daily", time_of_day: "02:00", device_ids: [], category_ids: [], is_active: true });
    setDialogOpen(true);
  };

  const openEdit = (schedule: Schedule) => {
    setEditing(schedule);
    resetDialog();
    if ((schedule.category_ids || []).length > 0) {
      setFocusedCategoryId(schedule.category_ids[0]);
      setRightTab("categories");
    } else {
      setRightTab("devices");
    }
    setFormData({
      name: schedule.name,
      description: schedule.description || "",
      schedule_type: schedule.schedule_type,
      cron_expression: schedule.cron_expression || "",
      time_of_day: schedule.time_of_day || "",
      day_of_week: schedule.day_of_week,
      day_of_month: schedule.day_of_month,
      is_active: schedule.is_active,
      device_ids: schedule.device_ids || [],
      category_ids: schedule.category_ids || [],
    });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    const payload: ScheduleCreate | ScheduleUpdate = {
      name: formData.name.trim(),
      description: formData.description?.trim() || undefined,
      schedule_type: formData.schedule_type,
      is_active: formData.is_active,
      device_ids: formData.device_ids,
      category_ids: formData.category_ids,
    };
    if (formData.schedule_type === "cron") {
      payload.cron_expression = formData.cron_expression?.trim();
    } else {
      payload.time_of_day = formData.time_of_day || "02:00";
    }
    if (formData.schedule_type === "weekly") payload.day_of_week = formData.day_of_week;
    if (formData.schedule_type === "monthly") payload.day_of_month = formData.day_of_month;

    if (editing) {
      updateMutation.mutate({ id: editing.id, data: payload as ScheduleUpdate }, { onSuccess: () => setDialogOpen(false) });
    } else {
      createMutation.mutate(payload as ScheduleCreate, { onSuccess: () => setDialogOpen(false) });
    }
  };

  const selectedDevices = new Set(formData.device_ids);
  const selectedCategories = new Set(formData.category_ids);

  const toggleDevice = (id: string) => {
    const next = new Set(selectedDevices);
    next.has(id) ? next.delete(id) : next.add(id);
    setFormData({ ...formData, device_ids: Array.from(next) });
  };

  const toggleCategory = (id: string) => {
    const next = new Set(selectedCategories);
    next.has(id) ? next.delete(id) : next.add(id);
    setFormData({ ...formData, category_ids: Array.from(next) });
  };

  const getDeviceLabel = (id: string) => devices.find(d => d.id === id)?.name || id;
  const getCategoryLabel = (id: string) => categories.find(c => c.id === id)?.name || id;

  const devicesCoveredByCategories = useMemo(() => {
    const ids = new Set<string>();
    for (const catId of selectedCategories) {
      devices.filter(d => d.category_id === catId).forEach(d => ids.add(d.id));
    }
    return ids;
  }, [selectedCategories, devices]);

  // For each category: how many of its devices are individually selected (without selecting the whole category)
  const categoryPartialState = useMemo(() => {
    const result: Record<string, "none" | "partial" | "all"> = {};
    for (const category of categories) {
      if (selectedCategories.has(category.id)) {
        result[category.id] = "all";
        continue;
      }
      const catDevices = devices.filter(d => d.category_id === category.id);
      if (catDevices.length === 0) { result[category.id] = "none"; continue; }
      const selectedCount = catDevices.filter(d => selectedDevices.has(d.id)).length;
      if (selectedCount === 0) result[category.id] = "none";
      else if (selectedCount === catDevices.length) result[category.id] = "partial"; // all devices selected individually but not category itself
      else result[category.id] = "partial";
    }
    return result;
  }, [categories, devices, selectedCategories, selectedDevices]);

  const focusedCategoryDevices = useMemo(
    () => focusedCategoryId ? devices.filter(d => d.category_id === focusedCategoryId) : [],
    [focusedCategoryId, devices]
  );

  const uncoveredDevices = useMemo(
    () => devices.filter(d => !devicesCoveredByCategories.has(d.id)),
    [devices, devicesCoveredByCategories]
  );

  const isFormValid = () => {
    if (!formData.name.trim()) return false;
    if (selectedDevices.size === 0 && selectedCategories.size === 0) return false;
    if (formData.schedule_type === "cron" && !formData.cron_expression?.trim()) return false;
    if (formData.schedule_type === "weekly" && formData.day_of_week === undefined) return false;
    if (formData.schedule_type === "monthly" && !formData.day_of_month) return false;
    if (formData.schedule_type !== "cron" && !formData.time_of_day) return false;
    return true;
  };

  const totalSelected = selectedCategories.size + selectedDevices.size;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              {t("active")}
            </CardTitle>
            {isModerator && (
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4 mr-2" />
                {t("create")}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("columns.name")}</TableHead>
                  <TableHead>{t("columns.categories")}</TableHead>
                  <TableHead>{t("columns.devices")}</TableHead>
                  <TableHead>{t("columns.frequency")}</TableHead>
                  <TableHead>{t("columns.time")}</TableHead>
                  <TableHead>{t("columns.lastRun")}</TableHead>
                  <TableHead>{t("columns.nextRun")}</TableHead>
                  <TableHead>{t("columns.status")}</TableHead>
                  <TableHead>{t("columns.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schedulesView.map((schedule) => (
                  <TableRow key={schedule.id}>
                    <TableCell className="font-medium">{schedule.name}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(schedule.category_ids || []).slice(0, 2).map(id => (
                          <Badge key={id} variant="outline" className="text-xs">
                            <FolderTree className="h-3 w-3 mr-1" />{getCategoryLabel(id)}
                          </Badge>
                        ))}
                        {(schedule.category_ids || []).length > 2 && <Badge variant="outline" className="text-xs">+{schedule.category_ids.length - 2}</Badge>}
                        {(schedule.category_ids || []).length === 0 && <span className="text-muted-foreground text-xs">-</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {schedule.device_ids.slice(0, 2).map(id => (
                          <Badge key={id} variant="secondary" className="text-xs">{getDeviceLabel(id)}</Badge>
                        ))}
                        {schedule.device_ids.length > 2 && <Badge variant="secondary" className="text-xs">+{schedule.device_ids.length - 2}</Badge>}
                        {schedule.device_ids.length === 0 && <span className="text-muted-foreground text-xs">-</span>}
                      </div>
                    </TableCell>
                    <TableCell>{schedule.frequency}</TableCell>
                    <TableCell className="font-mono text-sm">{schedule.timeLabel}</TableCell>
                    <TableCell className="text-sm">{schedule.lastRun}</TableCell>
                    <TableCell className="text-sm">{schedule.nextRun}</TableCell>
                    <TableCell>
                      <Switch
                        checked={schedule.is_active}
                        onCheckedChange={(checked) => toggleMutation.mutate({ id: schedule.id, is_active: checked })}
                      />
                    </TableCell>
                    <TableCell>
                      {isModerator && <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(schedule)}><Edit className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate(schedule.id)}><Trash2 className="h-4 w-4" /></Button>
                      </div>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {isLoading && <div className="p-4 text-sm text-muted-foreground">{t("loading")}</div>}
          </div>
        </CardContent>
      </Card>

      {/* ── Create / Edit Dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-5xl p-0 gap-0 overflow-hidden max-h-[90vh] flex flex-col">
          {/* Header */}
          <DialogHeader className="px-6 py-4 border-b shrink-0">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-lg">
                {editing ? tc("edit") : t("create")}
              </DialogTitle>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>{t("fields.active")}</span>
                <Switch
                  checked={formData.is_active ?? true}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
              </div>
            </div>
          </DialogHeader>

          {/* Body — two columns */}
          <div className="flex flex-1 overflow-hidden">

            {/* ── Left column: schedule config ── */}
            <div className="w-80 shrink-0 border-r flex flex-col">
              <ScrollArea className="flex-1">
                <div className="p-6 space-y-5">
                  {/* Name */}
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">{t("fields.name")} *</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder={t("types.daily")}
                    />
                  </div>

                  {/* Description */}
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">{t("fields.description")}</Label>
                    <Textarea
                      value={formData.description || ""}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder={t("fields.descriptionPlaceholder")}
                      rows={2}
                      className="resize-none"
                    />
                  </div>

                  {/* Divider */}
                  <div className="border-t pt-4 space-y-4">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("fields.scheduleType")}</p>

                    {/* Type */}
                    <div className="space-y-1.5">
                      <Select
                        value={formData.schedule_type}
                        onValueChange={(value) => {
                          const schedule_type = value as ScheduleCreate["schedule_type"];
                          setFormData({
                            ...formData, schedule_type,
                            cron_expression: schedule_type === "cron" ? formData.cron_expression || "" : "",
                            time_of_day: schedule_type === "cron" ? "" : formData.time_of_day || "02:00",
                            day_of_week: schedule_type === "weekly" ? formData.day_of_week : undefined,
                            day_of_month: schedule_type === "monthly" ? formData.day_of_month : undefined,
                          });
                        }}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="daily">{t("types.daily")}</SelectItem>
                          <SelectItem value="weekly">{t("types.weekly")}</SelectItem>
                          <SelectItem value="monthly">{t("types.monthly")}</SelectItem>
                          <SelectItem value="cron">{t("types.cron")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Time — daily / weekly / monthly */}
                    {formData.schedule_type !== "cron" && (
                      <div className="space-y-1.5">
                        <Label className="text-sm">{t("fields.time")}</Label>
                        <Input
                          type="time"
                          value={formData.time_of_day || ""}
                          onChange={(e) => setFormData({ ...formData, time_of_day: e.target.value })}
                        />
                      </div>
                    )}

                    {/* Day of week */}
                    {formData.schedule_type === "weekly" && (
                      <div className="space-y-1.5">
                        <Label className="text-sm">{t("fields.dayOfWeek")}</Label>
                        <Select
                          value={formData.day_of_week !== undefined ? String(formData.day_of_week) : ""}
                          onValueChange={(v) => setFormData({ ...formData, day_of_week: Number(v) })}
                        >
                          <SelectTrigger><SelectValue placeholder={tc("select")} /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0">{t("weekdays.sunday")}</SelectItem>
                            <SelectItem value="1">{t("weekdays.monday")}</SelectItem>
                            <SelectItem value="2">{t("weekdays.tuesday")}</SelectItem>
                            <SelectItem value="3">{t("weekdays.wednesday")}</SelectItem>
                            <SelectItem value="4">{t("weekdays.thursday")}</SelectItem>
                            <SelectItem value="5">{t("weekdays.friday")}</SelectItem>
                            <SelectItem value="6">{t("weekdays.saturday")}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {/* Day of month */}
                    {formData.schedule_type === "monthly" && (
                      <div className="space-y-1.5">
                        <Label className="text-sm">{t("fields.dayOfMonth")}</Label>
                        <Input
                          type="number" min={1} max={31}
                          value={formData.day_of_month ?? ""}
                          onChange={(e) => setFormData({ ...formData, day_of_month: Number(e.target.value) })}
                        />
                      </div>
                    )}

                    {/* Cron expression */}
                    {formData.schedule_type === "cron" && (
                      <div className="space-y-1.5">
                        <Label className="text-sm">{t("fields.cronExpression")}</Label>
                        <Input
                          value={formData.cron_expression || ""}
                          onChange={(e) => setFormData({ ...formData, cron_expression: e.target.value })}
                          placeholder={t("fields.cronPlaceholder")}
                          className="font-mono"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </ScrollArea>
            </div>

            {/* ── Right column: target selection ── */}
            <div className="flex-1 flex flex-col min-w-0">
              {/* Tab bar */}
              <div className="flex border-b shrink-0">
                <button
                  type="button"
                  onClick={() => setRightTab("categories")}
                  className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                    rightTab === "categories"
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <FolderTree className="h-4 w-4" />
                  {t("fields.categories")}
                  {selectedCategories.size > 0 && (
                    <Badge className="h-5 px-1.5 text-xs">{selectedCategories.size}</Badge>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => { setRightTab("devices"); setFocusedCategoryId(null); }}
                  className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                    rightTab === "devices"
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Monitor className="h-4 w-4" />
                  {t("fields.individualDevices")}
                  {selectedDevices.size > 0 && (
                    <Badge className="h-5 px-1.5 text-xs">{selectedDevices.size}</Badge>
                  )}
                </button>
              </div>

              {/* Tab: Categories */}
              {rightTab === "categories" && (
                <div className="flex flex-1 overflow-hidden">
                  {/* Category list */}
                  <div className="w-56 shrink-0 border-r flex flex-col">
                    <div className="px-4 py-2 bg-muted/40 border-b">
                      <p className="text-xs font-medium text-muted-foreground">{t("fields.categories")}</p>
                    </div>
                    <ScrollArea className="flex-1">
                      {categories.length === 0 ? (
                        <div className="p-4 text-sm text-muted-foreground">{t("fields.noCategories")}</div>
                      ) : (
                        <div className="py-1">
                          {categories.map((category) => {
                            const count = devices.filter(d => d.category_id === category.id).length;
                            const isChecked = selectedCategories.has(category.id);
                            const partialState = categoryPartialState[category.id] ?? "none";
                            const isPartial = !isChecked && partialState === "partial";
                            const isFocused = focusedCategoryId === category.id;
                            return (
                              <div
                                key={category.id}
                                onClick={() => setFocusedCategoryId(category.id)}
                                className={`flex items-center gap-2 px-3 py-2.5 cursor-pointer transition-colors ${
                                  isFocused ? "bg-accent text-accent-foreground" : "hover:bg-muted/50"
                                }`}
                              >
                                <div
                                  onClick={(e) => { e.stopPropagation(); toggleCategory(category.id); }}
                                  className={`h-4 w-4 shrink-0 rounded border flex items-center justify-center cursor-pointer transition-colors ${
                                    isChecked
                                      ? "bg-primary border-primary"
                                      : isPartial
                                        ? "bg-primary/20 border-primary"
                                        : "border-input bg-background"
                                  }`}
                                >
                                  {isChecked && <Check className="h-3 w-3 text-primary-foreground" />}
                                  {isPartial && <Minus className="h-3 w-3 text-primary" />}
                                </div>
                                <span className="text-sm font-medium flex-1 truncate">{category.name}</span>
                                <span className="text-xs text-muted-foreground shrink-0">{count}</span>
                                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </ScrollArea>
                  </div>

                  {/* Device list for focused category */}
                  <div className="flex-1 flex flex-col min-w-0">
                    {focusedCategoryId ? (
                      <>
                        <div className="px-4 py-2 bg-muted/40 border-b flex items-center gap-2">
                          <p className="text-xs font-medium text-muted-foreground truncate">
                            {categories.find(c => c.id === focusedCategoryId)?.name}
                          </p>
                          {selectedCategories.has(focusedCategoryId) && (
                            <Badge variant="secondary" className="text-xs shrink-0">{t("fields.coveredByCategory")}</Badge>
                          )}
                        </div>
                        <ScrollArea className="flex-1">
                          {focusedCategoryDevices.length === 0 ? (
                            <div className="p-4 text-sm text-muted-foreground">{t("fields.noDevices")}</div>
                          ) : (
                            <div className="py-1">
                              {focusedCategoryDevices.map((device) => {
                                const covered = selectedCategories.has(focusedCategoryId!);
                                const explicit = selectedDevices.has(device.id);
                                const active = covered || explicit;
                                return (
                                  <label
                                    key={device.id}
                                    className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${covered ? "opacity-60" : "hover:bg-muted/50"}`}
                                  >
                                    <div
                                      className={`h-4 w-4 shrink-0 rounded border flex items-center justify-center ${
                                        active ? "bg-primary border-primary" : "border-input bg-background"
                                      }`}
                                    >
                                      {active && <Check className="h-3 w-3 text-primary-foreground" />}
                                    </div>
                                    <input
                                      type="checkbox"
                                      className="sr-only"
                                      checked={active}
                                      disabled={covered}
                                      onChange={() => !covered && toggleDevice(device.id)}
                                    />
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium truncate">{device.name}</p>
                                      <p className="text-xs text-muted-foreground font-mono">{device.ip_address}</p>
                                    </div>
                                  </label>
                                );
                              })}
                            </div>
                          )}
                        </ScrollArea>
                      </>
                    ) : (
                      <div className="flex-1 flex items-center justify-center">
                        <div className="text-center space-y-2 p-6">
                          <FolderTree className="h-8 w-8 text-muted-foreground/40 mx-auto" />
                          <p className="text-sm text-muted-foreground">{t("fields.categoriesHint")}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Tab: Individual devices */}
              {rightTab === "devices" && (
                <div className="flex flex-col flex-1 overflow-hidden">
                  <div className="px-4 py-2 bg-muted/40 border-b">
                    <p className="text-xs font-medium text-muted-foreground">{t("fields.individualDevices")}</p>
                  </div>
                  <ScrollArea className="flex-1">
                    {uncoveredDevices.length === 0 && devices.length > 0 ? (
                      <div className="p-4 text-sm text-muted-foreground italic">{t("fields.allDevicesCovered")}</div>
                    ) : devices.length === 0 ? (
                      <div className="p-4 text-sm text-muted-foreground">{t("fields.noDevices")}</div>
                    ) : (
                      <div className="py-1">
                        {uncoveredDevices.map((device) => {
                          const checked = selectedDevices.has(device.id);
                          return (
                            <label key={device.id} className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-muted/50 transition-colors">
                              <div className={`h-4 w-4 shrink-0 rounded border flex items-center justify-center ${checked ? "bg-primary border-primary" : "border-input bg-background"}`}>
                                {checked && <Check className="h-3 w-3 text-primary-foreground" />}
                              </div>
                              <input type="checkbox" className="sr-only" checked={checked} onChange={() => toggleDevice(device.id)} />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{device.name}</p>
                                <p className="text-xs text-muted-foreground font-mono">{device.ip_address}</p>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </ScrollArea>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-3 border-t bg-muted/20 shrink-0 flex items-center justify-between gap-4">
            <div className="text-sm text-muted-foreground">
              {totalSelected === 0
                ? <span className="text-amber-600">{t("validation.selectTarget")}</span>
                : <span>{selectedCategories.size > 0 && `${selectedCategories.size} ${t("fields.categories").toLowerCase()}`}{selectedCategories.size > 0 && selectedDevices.size > 0 && " · "}{selectedDevices.size > 0 && `${selectedDevices.size} ${t("fields.individualDevices").toLowerCase()}`}</span>
              }
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>{tc("cancel")}</Button>
              <Button onClick={handleSubmit} disabled={!isFormValid()}>
                {editing ? tc("update") : tc("create")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default Schedules;
