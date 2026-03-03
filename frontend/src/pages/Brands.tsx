import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "react-i18next";
import { Brand, BrandCreate } from "@/services/brands";
import { useBrands, useCreateBrand, useUpdateBrand, useDeleteBrand } from "@/hooks/useBrands";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";

const Brands = () => {
  const { isModerator } = useAuth();
  const { t } = useTranslation("devices");
  const { t: tc } = useTranslation("common");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
  const [formData, setFormData] = useState({ name: "", description: "" });

  const { data: brands = [], isLoading } = useBrands();
  const createMutation = useCreateBrand();
  const updateMutation = useUpdateBrand();
  const deleteMutation = useDeleteBrand();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingBrand) {
      updateMutation.mutate(
        { id: editingBrand.id, data: formData },
        {
          onSuccess: () => {
            toast.success(t("brands.updated"));
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
          toast.success(t("brands.created"));
          closeDialog();
        },
        onError: (error: any) => {
          toast.error(error.response?.data?.detail || error.message);
        },
      });
    }
  };

  const handleDelete = (id: string) => {
    if (!confirm(t("brands.confirmDelete"))) return;
    deleteMutation.mutate(id, {
      onSuccess: () => {
        toast.success(t("brands.deleted"));
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.detail || error.message);
      },
    });
  };

  const openDialog = (brand?: Brand) => {
    if (brand) {
      setEditingBrand(brand);
      setFormData({ name: brand.name, description: brand.description || "" });
    } else {
      setEditingBrand(null);
      setFormData({ name: "", description: "" });
    }
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setFormData({ name: "", description: "" });
    setEditingBrand(null);
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">{t("brands.title")}</h1>
            <p className="text-muted-foreground">{t("brands.subtitle")}</p>
          </div>
          {isModerator && <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => openDialog()}>
                <Plus className="h-4 w-4 mr-2" />
                {t("brands.new")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingBrand ? `${tc("edit")} ${t("brands.entity")}` : t("brands.new")}
                </DialogTitle>
                <DialogDescription>
                  {t("brands.formDesc")}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">{t("brands.fields.name")}</Label>
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
                  {editingBrand ? tc("update") : tc("create")}
                </Button>
              </form>
            </DialogContent>
          </Dialog>}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t("brands.list")}</CardTitle>
            <CardDescription>{t("brands.total", { count: brands.length })}</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p>{tc("loading")}</p>
            ) : brands.length === 0 ? (
              <p className="text-muted-foreground">{t("brands.none")}</p>
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
                  {brands.map((brand) => (
                    <TableRow key={brand.id}>
                      <TableCell className="font-medium">{brand.name}</TableCell>
                      <TableCell>{brand.description || "-"}</TableCell>
                      <TableCell className="text-right">
                        {isModerator && <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openDialog(brand)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(brand.id)}
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

export default Brands;
