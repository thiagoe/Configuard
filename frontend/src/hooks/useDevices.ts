import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getDevices,
  getDevice,
  createDevice,
  updateDevice,
  deleteDevice,
  toggleDeviceBackup,
  executeDeviceBackup,
  DeviceCreate,
  DeviceUpdate,
  DeviceFilters,
} from "@/services/devices";

export const useDevices = (filters?: DeviceFilters) => {
  return useQuery({
    queryKey: ["devices", filters],
    queryFn: () => getDevices(filters),
  });
};

export const useDevice = (id?: string) => {
  return useQuery({
    queryKey: ["device", id],
    queryFn: () => getDevice(id!),
    enabled: !!id,
  });
};

export const useCreateDevice = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: DeviceCreate) => createDevice(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["devices"] }),
  });
};

export const useUpdateDevice = () => {
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: DeviceUpdate }) => updateDevice(id, data),
  });
};

export const useDeleteDevice = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteDevice(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["devices"] }),
  });
};

export const useToggleDeviceBackup = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => toggleDeviceBackup(id, enabled),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["devices"] }),
  });
};

export const useExecuteDeviceBackup = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => executeDeviceBackup(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["devices"] }),
  });
};
