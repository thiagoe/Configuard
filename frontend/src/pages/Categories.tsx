import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "react-i18next";
import { Category, CategoryCreate } from "@/services/categories";
import { BackupTemplate } from "@/services/templates";
import { useCategories, useCreateCategory, useUpdateCategory, useDeleteCategory } from "@/hooks/useCategories";
import { useTemplates } from "@/hooks/useTemplates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";

const Categories = () => {
  const { isModerator } = useAuth();
  const { t } = useTranslation("devices");
  const { t: tc } = useTranslation("common");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
  });

  const { data: categories = [], isLoading } = useCategories();
  const { data: templates = [] } = useTemplates();
  const createMutation = useCreateCategory();
  const updateMutation = useUpdateCategory();
  const deleteMutation = useDeleteCategory();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingCategory) {
      updateMutation.mutate(
        { id: editingCategory.id, data: formData },
        {
          onSuccess: () => {
            toast.success(t("categories.updated"));
            closeDialog();
          },
          onError: (error: any) => {
            toast.error(error.response?.data?.detail || error.message);
          },
        }
      );
    } else {
      createMutation.mutate(formData, {
        onSuccess: () => {
          toast.success(t("categories.created"));
          closeDialog();
        },
        onError: (error: any) => {
          toast.error(error.response?.data?.detail || error.message);
        },
      });
    }
  };

  const handleDelete = (id: string) => {
    if (!confirm(t("categories.confirmDelete"))) return;
    deleteMutation.mutate(id, {
      onSuccess: () => {
        toast.success(t("categories.deleted"));
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.detail || error.message);
      },
    });
  };

  const openDialog = (category?: Category) => {
    if (category) {
      setEditingCategory(category);
      setFormData({
        name: category.name,
        description: category.description || "",
      });
    } else {
      setEditingCategory(null);
      setFormData({ name: "", description: "" });
    }
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setFormData({ name: "", description: "" });
    setEditingCategory(null);
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">{t("categories.title")}</h1>
            <p className="text-muted-foreground">{t("categories.subtitle")}</p>
          </div>
          {isModerator && <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => openDialog()}>
                <Plus className="h-4 w-4 mr-2" />
                {t("categories.new")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingCategory ? `${tc("edit")} ${t("categories.entity")}` : t("categories.new")}
                </DialogTitle>
                <DialogDescription>
                  {t("categories.formDesc")}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">{tc("name")} *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">{tc("description")}</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editingCategory ? tc("update") : tc("create")}
                </Button>
              </form>
            </DialogContent>
          </Dialog>}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t("categories.list")}</CardTitle>
            <CardDescription>{t("categories.total", { count: categories.length })}</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p>{tc("loading")}</p>
            ) : categories.length === 0 ? (
              <p className="text-muted-foreground">{t("categories.none")}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{tc("name")}</TableHead>
                    <TableHead>{tc("description")}</TableHead>
                    <TableHead className="text-right">{tc("actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.map((category) => (
                    <TableRow key={category.id}>
                      <TableCell className="font-medium">{category.name}</TableCell>
                      <TableCell>{category.description || "-"}</TableCell>
                      <TableCell className="text-right">
                        {isModerator && <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openDialog(category)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(category.id)}
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Categories;
