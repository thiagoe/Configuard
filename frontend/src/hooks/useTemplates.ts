import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  BackupTemplateCreate,
  BackupTemplateUpdate,
} from "@/services/templates";

export const useTemplates = () => {
  return useQuery({
    queryKey: ["templates"],
    queryFn: getTemplates,
  });
};

export const useCreateTemplate = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: BackupTemplateCreate) => createTemplate(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["templates"] }),
  });
};

export const useUpdateTemplate = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: BackupTemplateUpdate }) => updateTemplate(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["templates"] }),
  });
};

export const useDeleteTemplate = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteTemplate(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["templates"] }),
  });
};
