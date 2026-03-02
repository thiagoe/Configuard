import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getAdminUsers,
  createAdminUser,
  updateAdminUser,
  deleteAdminUser,
  AdminUser,
  AdminUserCreate,
} from "@/services/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { toast } from "sonner";
import { Search, UserPlus, Pencil, Trash2 } from "lucide-react";

type DialogMode = "create" | "edit" | null;

const EMPTY_FORM = { full_name: "", email: "", password: "", role: "user" as const };

const UserManagement = () => {
  const { t } = useTranslation("admin");
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-users", search, roleFilter],
    queryFn: () =>
      getAdminUsers({
        page: 1,
        page_size: 200,
        search: search || undefined,
        role: roleFilter !== "all" ? roleFilter : undefined,
      }),
  });

  const createMutation = useMutation({
    mutationFn: (data: AdminUserCreate) => createAdminUser(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setDialogMode(null);
      toast.success(t("users.toast.created"));
    },
    onError: (error: any) => toast.error(error.response?.data?.detail || error.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      updateAdminUser(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (error: any) => toast.error(error.response?.data?.detail || error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteAdminUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setDeleteTarget(null);
      toast.success(t("users.toast.deleted"));
    },
    onError: (error: any) => toast.error(error.response?.data?.detail || error.message),
  });

  const users = data?.items || [];
  const isSaving = createMutation.isPending || updateMutation.isPending;

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setEditingUser(null);
    setDialogMode("create");
  };

  const openEdit = (user: AdminUser) => {
    setForm({
      full_name: user.full_name || "",
      email: user.email,
      password: "",
      role: (user.role as any) || "user",
    });
    setEditingUser(user);
    setDialogMode("edit");
  };

  const handleSubmit = () => {
    if (dialogMode === "create") {
      if (!form.email || !form.password) return;
      createMutation.mutate({
        email: form.email,
        password: form.password,
        full_name: form.full_name || undefined,
        role: form.role as "admin" | "moderator" | "user",
      });
    } else if (dialogMode === "edit" && editingUser) {
      const payload: Record<string, unknown> = {
        full_name: form.full_name || null,
        role: form.role,
      };
      if (form.password) payload.password = form.password;
      updateMutation.mutate(
        { id: editingUser.id, data: payload },
        { onSuccess: () => { setDialogMode(null); toast.success(t("users.toast.updated")); } }
      );
    }
  };

  const handleRoleChange = (user: AdminUser, role: string) => {
    updateMutation.mutate(
      { id: user.id, data: { role } },
      { onSuccess: () => toast.success(t("users.toast.roleUpdated")) }
    );
  };

  const handleActiveToggle = (user: AdminUser, active: boolean) => {
    updateMutation.mutate(
      { id: user.id, data: { is_active: active } },
      {
        onSuccess: () =>
          toast.success(active ? t("users.toast.activated") : t("users.toast.deactivated")),
      }
    );
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{t("users.title")}</CardTitle>
            <Button size="sm" onClick={openCreate}>
              <UserPlus className="h-4 w-4 mr-2" />
              {t("users.newUser")}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="relative w-full md:w-64">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("users.searchPlaceholder")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder={t("users.roleFilter")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("users.allRoles")}</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="moderator">Moderator</SelectItem>
                <SelectItem value="user">User</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              onClick={() => queryClient.invalidateQueries({ queryKey: ["admin-users"] })}
            >
              {t("users.refresh")}
            </Button>
          </div>

          {isLoading ? (
            <div className="text-sm text-muted-foreground">{t("users.loading")}</div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("users.columns.name")}</TableHead>
                    <TableHead>{t("users.columns.email")}</TableHead>
                    <TableHead>{t("users.columns.role")}</TableHead>
                    <TableHead>{t("users.columns.status")}</TableHead>
                    <TableHead className="w-24">{t("users.columns.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>{user.full_name || "-"}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Select
                          value={user.role || "user"}
                          onValueChange={(value) => handleRoleChange(user, value)}
                        >
                          <SelectTrigger className="w-36">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="moderator">Moderator</SelectItem>
                            <SelectItem value="user">User</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={user.is_active}
                          onCheckedChange={(checked) => handleActiveToggle(user, checked)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEdit(user)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => setDeleteTarget(user)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogMode !== null} onOpenChange={(open) => !open && setDialogMode(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {dialogMode === "create" ? t("users.create.title") : t("users.edit.title")}
            </DialogTitle>
            <DialogDescription>
              {dialogMode === "create" ? t("users.create.desc") : t("users.edit.desc")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>{t("users.fields.fullName")}</Label>
              <Input
                placeholder={t("users.fields.fullNamePlaceholder")}
                value={form.full_name}
                onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
              />
            </div>

            <div className="space-y-1">
              <Label>{t("users.fields.email")}</Label>
              {dialogMode === "create" ? (
                <Input
                  type="email"
                  placeholder={t("users.fields.emailPlaceholder")}
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
              ) : (
                <Input value={form.email} disabled className="bg-muted" />
              )}
            </div>

            <div className="space-y-1">
              <Label>
                {dialogMode === "create" ? t("users.fields.password") : t("users.fields.passwordEdit")}
              </Label>
              <Input
                type="password"
                placeholder={
                  dialogMode === "create"
                    ? t("users.fields.passwordPlaceholder")
                    : t("users.fields.passwordEditHint")
                }
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              />
              {dialogMode === "edit" && (
                <p className="text-xs text-muted-foreground">{t("users.fields.passwordEditHint")}</p>
              )}
            </div>

            <div className="space-y-1">
              <Label>{t("users.fields.role")}</Label>
              <Select
                value={form.role}
                onValueChange={(v) => setForm((f) => ({ ...f, role: v as any }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="moderator">Moderator</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogMode(null)} disabled={isSaving}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={isSaving}>
              {isSaving
                ? t("users.saving")
                : dialogMode === "create"
                ? t("users.create_btn")
                : t("users.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("users.edit.title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("users.confirmDelete")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default UserManagement;
