import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { DeepDiveBlock as DeepDiveBlockType } from "@/types/tutor";

interface Props {
  block: DeepDiveBlockType;
}

/**
 * DeepDiveBlock — encapsula markdown técnico aprofundado.
 * Mantém o mesmo visual do renderer markdown legado do Tutor.
 */
export function DeepDiveBlock({ block }: Props) {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none text-foreground">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {block.payload.markdown}
      </ReactMarkdown>
      {block.payload.refs && block.payload.refs.length > 0 && (
        <div className="mt-3 border-t border-border pt-2 text-xs text-muted-foreground">
          <strong>Referências:</strong>
          <ul className="mt-1 list-disc pl-4">
            {block.payload.refs.map((r, i) => (
              <li key={i}>
                {r.url ? (
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline"
                  >
                    {r.source}
                  </a>
                ) : (
                  r.source
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
