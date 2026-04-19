import { memo, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Paperclip, ChevronDown, Search, Upload, Loader2, FileText } from "lucide-react";
import type { Upload as UploadType } from "./agentChatTypes";

interface AgentUploadsPickerProps {
  totalUploads: number;
  selectedCount: number;
  showUploads: boolean;
  onToggleShow: () => void;
  showUploadButton?: boolean;
  isUploading: boolean;
  onUploadClick: () => void;
  uploadSearch: string;
  onSearchChange: (v: string) => void;
  availableUploads: UploadType[];
  selectedUploadIds: Set<string>;
  onToggleUpload: (id: string) => void;
  onToggleAll: () => void;
}

const AgentUploadsPicker = memo(({
  totalUploads, selectedCount, showUploads, onToggleShow,
  showUploadButton, isUploading, onUploadClick,
  uploadSearch, onSearchChange, availableUploads, selectedUploadIds,
  onToggleUpload, onToggleAll,
}: AgentUploadsPickerProps) => {
  const filtered = useMemo(
    () => availableUploads.filter((u) => !uploadSearch || u.filename.toLowerCase().includes(uploadSearch.toLowerCase())),
    [availableUploads, uploadSearch]
  );

  if (totalUploads === 0 && !showUploadButton) return null;

  return (
    <div className="mb-2">
      <div className="flex gap-1.5">
        <button
          onClick={() => totalUploads > 0 && onToggleShow()}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-medium transition-colors flex-1 ${
            selectedCount > 0
              ? "bg-gradient-to-r from-primary/10 to-accent/10 text-primary border border-primary/20"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
          disabled={totalUploads === 0}
        >
          <Paperclip className="h-3 w-3 flex-shrink-0" />
          {totalUploads === 0 ? "Nenhum material" : selectedCount > 0 ? `${selectedCount} material(is) selecionado(s)` : `Selecionar materiais (${totalUploads})`}
          {totalUploads > 0 && <ChevronDown className={`h-3 w-3 ml-auto transition-transform ${showUploads ? "rotate-180" : ""}`} />}
        </button>
        {showUploadButton && (
          <Button variant="outline" size="sm" className="h-7 px-2.5 gap-1 text-[10px] sm:text-xs flex-shrink-0" disabled={isUploading} onClick={onUploadClick}>
            {isUploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
            Enviar
          </Button>
        )}
      </div>

      {showUploads && totalUploads > 0 && (
        <div className="glass-card p-2.5 mt-1.5 space-y-1.5">
          {totalUploads > 5 && (
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar..."
                value={uploadSearch}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full pl-6 pr-3 py-1 rounded-md border border-input bg-background text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          )}
          <button onClick={onToggleAll} className="flex items-center gap-2 px-2 py-1 text-[10px] font-medium text-primary hover:text-primary/80 transition-colors w-full rounded-md hover:bg-primary/5">
            <Checkbox checked={selectedCount === totalUploads} className="h-3 w-3" onCheckedChange={onToggleAll} />
            {selectedCount === totalUploads ? "Desmarcar todos" : `Selecionar todos (${totalUploads})`}
          </button>
          <div className="max-h-28 overflow-y-auto space-y-0.5">
            {filtered.map((u) => (
              <label
                key={u.id}
                className={`flex items-center gap-2 px-2 py-1 rounded-md cursor-pointer text-[10px] sm:text-xs transition-colors ${
                  selectedUploadIds.has(u.id) ? "bg-primary/5" : "hover:bg-secondary"
                }`}
              >
                <Checkbox checked={selectedUploadIds.has(u.id)} onCheckedChange={() => onToggleUpload(u.id)} className="h-3 w-3" />
                <FileText className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                <span className="truncate flex-1">{u.filename}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});
AgentUploadsPicker.displayName = "AgentUploadsPicker";
export default AgentUploadsPicker;
