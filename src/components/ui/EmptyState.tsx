interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
}

export default function EmptyState({ icon = 'bi-inbox', title, description }: EmptyStateProps) {
  return (
    <tr>
      <td colSpan={999} className="px-4 py-16 text-center">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <i className={`${icon} text-4xl`} />
          <p className="text-sm font-medium">{title}</p>
          {description && <p className="text-xs text-slate-500">{description}</p>}
        </div>
      </td>
    </tr>
  );
}
