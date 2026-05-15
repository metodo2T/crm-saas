import { CustomFieldsManager } from '@/components/custom-fields-manager';

export default function CustomFieldsDealsPage() {
  return (
    <div className="p-6">
      <h1 className="text-xl font-bold text-slate-100 mb-1">Campos Deals</h1>
      <p className="text-sm text-slate-500 mb-6">
        Campos extras exibidos na aba &quot;Campos extras&quot; de cada deal.
      </p>
      <CustomFieldsManager entity="DEAL" />
    </div>
  );
}
