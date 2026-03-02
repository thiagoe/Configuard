import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getBrands,
  createBrand,
  updateBrand,
  deleteBrand,
  BrandCreate,
  BrandUpdate,
} from "@/services/brands";

export const useBrands = () => {
  return useQuery({
    queryKey: ["brands"],
    queryFn: getBrands,
  });
};

export const useCreateBrand = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: BrandCreate) => createBrand(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["brands"] }),
  });
};

export const useUpdateBrand = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: BrandUpdate }) => updateBrand(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["brands"] }),
  });
};

export const useDeleteBrand = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteBrand(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["brands"] }),
  });
};
