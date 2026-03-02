import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getDeviceModels,
  createDeviceModel,
  updateDeviceModel,
  deleteDeviceModel,
  DeviceModelCreate,
  DeviceModelUpdate,
} from "@/services/deviceModels";

export const useDeviceModels = (params?: {
  search?: string;
  brand_id?: string;
  category_id?: string;
}) => {
  return useQuery({
    queryKey: ["device-models", params],
    queryFn: () => getDeviceModels(params),
  });
};

export const useCreateDeviceModel = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: DeviceModelCreate) => createDeviceModel(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["device-models"] }),
  });
};

export const useUpdateDeviceModel = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: DeviceModelUpdate }) => updateDeviceModel(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["device-models"] }),
  });
};

export const useDeleteDeviceModel = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteDeviceModel(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["device-models"] }),
  });
};
