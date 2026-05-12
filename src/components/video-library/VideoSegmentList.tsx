/**
 * VideoSegmentList — FASE 2 Adaptive Video
 *
 * Renderiza a lista de segmentos da videoaula com:
 *  - segmento atual destacado
 *  - indicador "Trecho com dificuldade provável" (Smart Replay)
 *  - botões: "Perguntar ao Tutor neste trecho" / "Revisar este trecho"
 *
 * Compatível com vídeos sem segmentação: o componente devolve null e
 * o player exibe o estado padrão (single segment fallback).
 */
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, MessageSquare, RotateCcw, Play, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SegmentAnalytics } from "@/hooks/useVideoSegmentAnalytics";

export interface VideoSegment {
  id: string;
  title: string | null;
  summary: string | null;
  key_points: unknown;
  start_second: number | null;
  end_second: number | null;
  ordem: number;
  segment_type?: string | null;
  has_flashcards?: boolean;
}

interface Props {
  segments: VideoSegment[];
  currentSegmentId: string | null;
  onSelectSegment: (segment: VideoSegment) => void;
  onAskTutor: (segment: VideoSegment) => void;
  onReplaySegment: (segment: VideoSegment) => void;
  getAnalytics: (segmentId: string | null) => SegmentAnalytics | null;
  smartReplayEnabled: boolean;
  tutorTemporalEnabled: boolean;
}

function formatTime(seconds: number | null): string {
  if (seconds == null || isNaN(seconds)) return "--:--";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}


export function VideoSegmentList({
  segments,
  currentSegmentId,
  onSelectSegment,
  onAskTutor,
  onReplaySegment,
  getAnalytics,
  smartReplayEnabled,
  tutorTemporalEnabled,
}: Props) {
  if (!segments || segments.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Layers className="h-4 w-4 text-primary" />
          Segmentos da Aula
          <Badge variant="outline" className="ml-auto text-[10px]">
            {segments.length} {segments.length === 1 ? "trecho" : "trechos"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 max-h-[500px] overflow-y-auto">
        {segments.map((seg) => {
          const isCurrent = seg.id === currentSegmentId;
          const analytics = getAnalytics(seg.id);
          const showDifficulty = smartReplayEnabled && analytics?.difficultyLikely;

          return (
            <div
              key={seg.id}
              className={cn(
                "rounded-lg border p-3 space-y-2 transition-colors",
                isCurrent ? "border-primary bg-primary/5" : "border-border hover:border-primary/40",
                showDifficulty && "border-amber-500/50 bg-amber-500/5"
              )}
            >
              <button
                type="button"
                onClick={() => onSelectSegment(seg)}
                className="w-full text-left space-y-1"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge variant={isCurrent ? "default" : "secondary"} className="text-[10px] flex-shrink-0">
                      {String(seg.ordem).padStart(2, "0")}
                    </Badge>
                    <span className="font-medium text-sm truncate">
                      {seg.title || `Trecho ${seg.ordem}`}
                    </span>
                  </div>
                  <span className="text-[11px] text-muted-foreground tabular-nums flex-shrink-0">
                    {formatTime(seg.start_second)}
                  </span>
                </div>
                {seg.summary && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{seg.summary}</p>
                )}
              </button>

              {showDifficulty && (
                <div className={cn(
                  "flex items-center gap-1.5 text-[11px] rounded px-2 py-1",
                  analytics.difficultyLevel === "alta" ? "text-red-700 dark:text-red-400 bg-red-500/10" :
                  analytics.difficultyLevel === "média" ? "text-amber-700 dark:text-amber-400 bg-amber-500/10" :
                  "text-blue-700 dark:text-blue-400 bg-blue-500/10"
                )}>
                  <AlertTriangle className="h-3 w-3" />
                  <span>Dificuldade {analytics.difficultyLevel} detectada</span>
                </div>
              )}

              {analytics?.suggestedActions && analytics.suggestedActions.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {analytics.suggestedActions.includes("revisar_trecho") && (
                    <Badge variant="outline" className="text-[9px] py-0 h-4 border-amber-200 text-amber-600 bg-amber-50">Sugerido: Revisar</Badge>
                  )}
                  {analytics.suggestedActions.includes("abrir_tutor") && (
                    <Badge variant="outline" className="text-[9px] py-0 h-4 border-blue-200 text-blue-600 bg-blue-50">Sugerido: Tutor</Badge>
                  )}
                </div>
              )}

              <div className="flex flex-wrap gap-1.5 pt-1">
                {!isCurrent && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-[11px] gap-1"
                    onClick={() => onSelectSegment(seg)}
                  >
                    <Play className="h-3 w-3" /> Ir
                  </Button>
                )}
                {tutorTemporalEnabled && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-[11px] gap-1"
                    onClick={() => onAskTutor(seg)}
                  >
                    <MessageSquare className="h-3 w-3" /> Perguntar ao Tutor
                  </Button>
                )}
                {smartReplayEnabled && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-[11px] gap-1"
                    onClick={() => onReplaySegment(seg)}
                  >
                    <RotateCcw className="h-3 w-3" /> Revisar
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
