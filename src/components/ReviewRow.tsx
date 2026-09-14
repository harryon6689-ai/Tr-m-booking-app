export default function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-brand-forest/10 py-2 text-sm last:border-0">
      <span className="text-brand-forest/60">{label}</span>
      <span className="text-right font-medium text-brand-forest">{value}</span>
    </div>
  );
}
