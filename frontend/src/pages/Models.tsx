import { useState } from "react";
import { useTranslation } from "react-i18next";
import { DeviceModel, DeviceModelCreate } from "@/services/deviceModels";
import { useDeviceModels, useCreateDeviceModel, useUpdateDeviceModel, useDeleteDeviceModel } from "@/hooks/useDeviceModels";
import { useBrands } from "@/hooks/useBrands";
import { useCategories } from "@/hooks/useCategories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Search, Package } from "lucide-react";

const Models = () => {
  const { t } = useTranslation("devices");
  const { t: tc } = useTranslation("common");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingModel, setEditingModel] = useState<DeviceModel | null>(null);
  const [formData, setFormData] = useState<DeviceModelCreate>({
    name: "",
    description: "",
    brand_id: undefined,
    category_id: undefined,
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [brandFilter, setBrandFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const { data: models = [], isLoading } = useDeviceModels({
    search: searchTerm || undefined,
    brand_id: brandFilter !== "all" ? brandFilter : undefined,
    category_id: categoryFilter !== "all" ? categoryFilter : undefined,
  });
  const { data: brands = [] } = useBrands();
  const { data: categories = [] } = useCategories();
  const createMutation = useCreateDeviceModel();
  const updateMutation = useUpdateDeviceModel();
  const deleteMutation = useDeleteDeviceModel();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const submitData = {
      ...formData,
      brand_id: formData.brand_id || undefined,
      category_id: formData.category_id || undefined,
    };

    if (editingModel) {
      updateMutation.mutate(
        { id: editingModel.id, data: submitData },
        {
          onSuccess: () => {
            toast.success(t("models.updated"));
            closeDialog();
          },
          onError: (error: any) => {
            toast.error(error.response?.data?.detail || error.message);
          },
        }
      );
    } else {
      createMutation.mutate(submitData, {
        onSuccess: () => {
          toast.success(t("models.created"));
          closeDialog();
        },
        onError: (error: any) => {
          toast.error(error.response?.data?.detail || error.message);
        },
      });
    }
  };

  const handleDelete = (id: string) => {
    if (!confirm(t("models.confirmDelete"))) return;
    deleteMutation.mutate(id, {
      onSuccess: () => {
        toast.success(t("models.deleted"));
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.detail || error.message);
      },
    });
  };

  const openDialog = (model?: DeviceModel) => {
    if (model) {
      setEditingModel(model);
      setFormData({
        name: model.name,
        description: model.description || "",
        brand_id: model.brand_id || undefined,
        category_id: model.category_id || undefined,
      });
    } else {
      setEditingModel(null);
      setFormData({
        name: "",
        description: "",
        brand_id: undefined,
        category_id: undefined,
      });
    }
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setFormData({
      name: "",
      description: "",
      brand_id: undefined,
      category_id: undefined,
    });
    setEditingModel(null);
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Package className="h-8 w-8" />
              {t("models.title")}
            </h1>
            <p className="text-muted-foreground">{t("models.subtitle")}</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => openDialog()}>
                <Plus className="h-4 w-4 mr-2" />
                {t("models.new")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingModel ? `${tc("edit")} ${t("models.entity")}` : t("models.new")}
                </DialogTitle>
                <DialogDescription>
                  {t("models.formDesc")}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">{t("models.fields.name")}</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder={t("models.fields.namePlaceholder")}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="brand">{t("models.fields.brand")}</Label>
                  <Select
                    value={formData.brand_id || "none"}
                    onValueChange={(value) => setFormData({ ...formData, brand_id: value === "none" ? undefined : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("models.fields.selectBrand")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{tc("none")}</SelectItem>
                      {brands.map((brand) => (
                        <SelectItem key={brand.id} value={brand.id}>
                          {brand.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">{t("models.fields.category")}</Label>
                  <Select
                    value={formData.category_id || "none"}
                    onValueChange={(value) => setFormData({ ...formData, category_id: value === "none" ? undefined : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("models.fields.selectCategory")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{tc("none")}</SelectItem>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">{tc("description")}</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder={t("models.fields.descriptionPlaceholder")}
                    rows={3}
                  />
                </div>

                <Button type="submit" className="w-full" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editingModel ? tc("update") : tc("create")}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t("models.list")}</CardTitle>
            <CardDescription>{t("models.total", { count: models.length })}</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Filtros */}
            <div className="flex flex-wrap gap-3 mb-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t("models.searchPlaceholder")}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={brandFilter} onValueChange={setBrandFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder={t("models.filterBrand")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("models.allBrands")}</SelectItem>
                  {brands.map((brand) => (
                    <SelectItem key={brand.id} value={brand.id}>
                      {brand.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder={t("models.filterCategory")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("models.allCategories")}</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isLoading ? (
              <p>{tc("loading")}</p>
            ) : models.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                {searchTerm || brandFilter !== "all" || categoryFilter !== "all"
                  ? t("models.noneFiltered")
                  : t("models.none")}
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("models.columns.model")}</TableHead>
                    <TableHead>{t("models.columns.brand")}</TableHead>
                    <TableHead>{t("models.columns.category")}</TableHead>
                    <TableHead>{tc("description")}</TableHead>
                    <TableHead className="text-right">{tc("actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {models.map((model) => (
                    <TableRow key={model.id}>
                      <TableCell className="font-medium">{model.name}</TableCell>
                      <TableCell>
                        {model.brand ? (
                          <Badge variant="outline">{model.brand.name}</Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {model.category ? (
                          <Badge variant="secondary">{model.category.name}</Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[300px] truncate">
                        {model.description || "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openDialog(model)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(model.id)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
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

export default Models;
