export default function Badge({ label, colorMap, className = '' }: {
  label: string;
  colorMap: Record<string, string>;
  className?: string;
}) {
  const color = colorMap[label] || 'bg-gray-100 text-gray-700';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${color} ${className}`}>
      {label}
    </span>
  );
}
