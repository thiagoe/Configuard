import { useState } from "react";
import { useCreateCredential, useCredentials, useDeleteCredential, useUpdateCredential } from "@/hooks/useCredentials";
import { Credential, CredentialCreate, CredentialUpdate } from "@/services/credentials";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Key, KeyRound } from "lucide-react";
import { useTranslation } from "react-i18next";

const Credentials = () => {
  const { t } = useTranslation("admin");
  const { t: tc } = useTranslation("common");

  const { data: credentials = [], isLoading } = useCredentials();
  const createMutation = useCreateCredential();
  const updateMutation = useUpdateCredential();
  const deleteMutation = useDeleteCredential();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCredential, setEditingCredential] = useState<Credential | null>(null);
  const [useSSHKey, setUseSSHKey] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    username: "",
    password: "",
    private_key: "",
    passphrase: "",
    description: "",
  });

  const resetForm = () => {
    setFormData({
      name: "",
      username: "",
      password: "",
      private_key: "",
      passphrase: "",
      description: "",
    });
    setUseSSHKey(false);
  };

  const openDialog = (credential?: Credential) => {
    if (credential) {
      setEditingCredential(credential);
      setFormData({
        name: credential.name,
        username: credential.username,
        password: "",
        private_key: "",
        passphrase: "",
        description: credential.description || "",
      });
      setUseSSHKey(credential.has_private_key);
    } else {
      setEditingCredential(null);
      resetForm();
    }
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingCredential(null);
    resetForm();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (editingCredential) {
      const payload: CredentialUpdate = {
        name: formData.name,
        username: formData.username,
        description: formData.description || undefined,
      };

      if (formData.password) payload.password = formData.password;
      if (useSSHKey && formData.private_key) payload.private_key = formData.private_key;
      if (useSSHKey && formData.passphrase) payload.passphrase = formData.passphrase;

      updateMutation.mutate(
        { id: editingCredential.id, data: payload },
        {
          onSuccess: () => {
            toast.success(t("credentials.updated"));
            closeDialog();
          },
          onError: (error: any) => toast.error(error.response?.data?.detail || error.message),
        }
      );
      return;
    }

    const payload: CredentialCreate = {
      name: formData.name,
      username: formData.username,
      description: formData.description || undefined,
    };

    if (formData.password) payload.password = formData.password;
    if (useSSHKey && formData.private_key) payload.private_key = formData.private_key;
    if (useSSHKey && formData.passphrase) payload.passphrase = formData.passphrase;

    createMutation.mutate(payload, {
      onSuccess: () => {
        toast.success(t("credentials.created"));
        closeDialog();
      },
      onError: (error: any) => toast.error(error.response?.data?.detail || error.message),
    });
  };

  const handleDelete = (id: string) => {
    if (!confirm(t("credentials.confirmDelete"))) return;
    deleteMutation.mutate(id, {
      onSuccess: () => toast.success(t("credentials.deleted")),
      onError: (error: any) => toast.error(error.response?.data?.detail || error.message),
    });
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">{t("credentials.title")}</h1>
            <p className="text-muted-foreground">{t("credentials.subtitle")}</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => openDialog()}>
                <Plus className="h-4 w-4 mr-2" />
                {t("credentials.new")}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editingCredential ? t("credentials.edit") : t("credentials.new")}
                </DialogTitle>
                <DialogDescription>
                  {editingCredential ? t("credentials.edit") : t("credentials.new")}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">{t("credentials.fields.name")}</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder={t("credentials.fields.namePlaceholder")}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="username">{t("credentials.fields.username")}</Label>
                    <Input
                      id="username"
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      placeholder={t("credentials.fields.usernamePlaceholder")}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">
                    {t("credentials.fields.password")}
                    {editingCredential && (
                      <span className="text-xs text-muted-foreground ml-1">
                        {t("credentials.fields.passwordHint")}
                      </span>
                    )}
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder={t("credentials.fields.passwordPlaceholder")}
                  />
                </div>

                {/* SSH Key Toggle */}
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <Label htmlFor="use-ssh-key" className="text-sm font-medium cursor-pointer">
                      {t("credentials.fields.useSSHKey")}
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {t("credentials.fields.useSSHKeyDesc")}
                    </p>
                  </div>
                  <Switch
                    id="use-ssh-key"
                    checked={useSSHKey}
                    onCheckedChange={setUseSSHKey}
                  />
                </div>

                {/* SSH Key fields — only visible when toggle is on */}
                {useSSHKey && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="private_key">
                        {t("credentials.fields.privateKey")}
                        {editingCredential && (
                          <span className="text-xs text-muted-foreground ml-1">
                            {t("credentials.fields.privateKeyHint")}
                          </span>
                        )}
                      </Label>
                      <Textarea
                        id="private_key"
                        value={formData.private_key}
                        onChange={(e) => setFormData({ ...formData, private_key: e.target.value })}
                        placeholder={t("credentials.fields.privateKeyPlaceholder")}
                        rows={5}
                        className="font-mono text-xs"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="passphrase">{t("credentials.fields.passphrase")}</Label>
                      <Input
                        id="passphrase"
                        type="password"
                        value={formData.passphrase}
                        onChange={(e) => setFormData({ ...formData, passphrase: e.target.value })}
                        placeholder={t("credentials.fields.passphrasePlaceholder")}
                      />
                    </div>
                  </>
                )}

                <div className="space-y-2">
                  <Label htmlFor="description">{t("credentials.fields.description")}</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder={t("credentials.fields.descriptionPlaceholder")}
                    rows={2}
                  />
                </div>

                <Button type="submit" className="w-full" disabled={isPending}>
                  {isPending
                    ? t("credentials.saving")
                    : editingCredential
                    ? t("credentials.saveChanges")
                    : t("credentials.create")}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t("credentials.listTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-sm text-muted-foreground">{t("credentials.loading")}</div>
            ) : credentials.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-8">
                {t("credentials.none")}
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("credentials.columns.name")}</TableHead>
                      <TableHead>{t("credentials.columns.username")}</TableHead>
                      <TableHead>{t("credentials.columns.auth")}</TableHead>
                      <TableHead>{t("credentials.columns.description")}</TableHead>
                      <TableHead className="text-right">{t("credentials.columns.actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {credentials.map((credential) => (
                      <TableRow key={credential.id}>
                        <TableCell className="font-medium">{credential.name}</TableCell>
                        <TableCell>{credential.username}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {credential.has_password && (
                              <Badge variant="outline" className="gap-1">
                                <Key className="h-3 w-3" />
                                {t("credentials.auth.password")}
                              </Badge>
                            )}
                            {credential.has_private_key && (
                              <Badge variant="outline" className="gap-1">
                                <KeyRound className="h-3 w-3" />
                                {t("credentials.auth.key")}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-xs truncate">
                          {credential.description || "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="sm" onClick={() => openDialog(credential)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDelete(credential.id)}>
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
      </main>
    </div>
  );
};

export default Credentials;
