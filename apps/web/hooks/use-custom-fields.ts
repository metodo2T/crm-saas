'use client';
import { useAuth, useOrganization } from '@clerk/nextjs';
import { useQuery } from '@tanstack/react-query';
import { getCustomFields, CustomFieldDef, CustomFieldEntity } from '@/lib/api/custom-fields';

export function useCustomFields(entity: CustomFieldEntity) {
  const { getToken } = useAuth();
  const { organization } = useOrganization();

  const { data: fields = [], isLoading } = useQuery<CustomFieldDef[]>({
    queryKey: ['custom-fields', organization?.id, entity],
    queryFn: async () => {
      const token = await getToken();
      return getCustomFields(token!, entity);
    },
    enabled: !!organization?.id,
  });

  return { fields, isLoading };
}
