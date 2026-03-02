import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getCredentials,
  createCredential,
  updateCredential,
  deleteCredential,
  CredentialCreate,
  CredentialUpdate,
} from "@/services/credentials";

export const useCredentials = () => {
  return useQuery({
    queryKey: ["credentials"],
    queryFn: getCredentials,
  });
};

export const useCreateCredential = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CredentialCreate) => createCredential(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["credentials"] }),
  });
};

export const useUpdateCredential = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: CredentialUpdate }) => updateCredential(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["credentials"] }),
  });
};

export const useDeleteCredential = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteCredential(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["credentials"] }),
  });
};
