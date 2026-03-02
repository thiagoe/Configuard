import { useQuery } from "@tanstack/react-query";
import {
  getDeviceConfigurations,
  getConfiguration,
  getConfigurationDiff,
} from "@/services/devices";

export const useDeviceConfigurations = (deviceId?: string) => {
  return useQuery({
    queryKey: ["configurations", deviceId],
    queryFn: () => getDeviceConfigurations(deviceId!),
    enabled: !!deviceId,
  });
};

export const useConfiguration = (configId?: string) => {
  return useQuery({
    queryKey: ["configuration", configId],
    queryFn: () => getConfiguration(configId!),
    enabled: !!configId,
  });
};

export const useConfigurationDiff = (fromId?: string, toId?: string) => {
  return useQuery({
    queryKey: ["configuration-diff", fromId, toId],
    queryFn: () => getConfigurationDiff(fromId!, toId!),
    enabled: !!fromId && !!toId,
  });
};
