interface BillDocumentPreviewProps {
  url: string;
  filePath: string;
}

export function BillDocumentPreview({
  url,
  filePath,
}: BillDocumentPreviewProps) {
  const isPdf = filePath.endsWith(".pdf");

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="card p-4 flex items-center gap-3 hover:bg-gray-50 transition-colors group"
    >
      <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-lg shrink-0">
        {isPdf ? "📄" : "🖼️"}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900">
          {isPdf ? "PDF Document" : "Bill Image"}
        </p>
        {/* <p className="text-xs text-gray-500 truncate">{filePath}</p> */}
      </div>
      <span className="text-sm text-gray-400 group-hover:text-brand-600 transition-colors">
        Open ↗
      </span>
    </a>
  );
}
