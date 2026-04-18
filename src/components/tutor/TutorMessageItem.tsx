import { memo } from "react";
import { User, Copy } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import tutorAvatar from "@/assets/tutor-avatar-hd.png";
import MultimediaControls from "@/components/agents/MultimediaControls";
import type { Msg } from "@/components/tutor/TutorConstants";

/** Convert bare URLs in text to markdown links so ReactMarkdown renders them clickable */
function linkifyBareUrls(text: string): string {
  return text.replace(
    /(?<!\]\()(?<!\()(https?:\/\/[^\s\)>\]]+)/g,
    (url) => `[${url.includes("pubmed") ? "Ver no PubMed" : url.includes("doi.org") ? "Ver DOI" : "Abrir link"}](${url})`
  );
}

function sanitizeReferenceUrl(href?: string): string {
  if (!href) return "https://pubmed.ncbi.nlm.nih.gov/";
  const trimmed = href.trim();
  const lower = trimmed.toLowerCase();
  const hasPlaceholder = ["url_do_pubmed", "url_do_doi", "/pmid", "/doi", "termo+de+busca"].some((token) =>
    lower.includes(token)
  );
  if (hasPlaceholder) {
    if (lower.includes("doi")) return "https://doi.org/";
    return "https://pubmed.ncbi.nlm.nih.gov/?term=medicina";
  }
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  if (trimmed.startsWith("www.")) return `https://${trimmed}`;
  return "https://pubmed.ncbi.nlm.nih.gov/";
}

interface TutorMessageItemProps {
  msg: Msg;
  onCopy: (text: string) => void;
}

const TutorMessageItem = memo(({ msg, onCopy }: TutorMessageItemProps) => (
  <div className={`flex gap-2 sm:gap-3 ${msg.role === "user" ? "justify-end" : ""} animate-fade-in`}>
    {msg.role === "assistant" && (
      <div className="h-12 w-9 sm:h-14 sm:w-11 rounded-xl overflow-hidden flex-shrink-0 tutor-glow bot-breathing ring-1 ring-primary/25 shadow-md">
        <img src={tutorAvatar} alt="Tutor" className="h-full w-full object-contain" />
      </div>
    )}
    <div className={`rounded-xl px-3 py-2 sm:px-4 sm:py-3 text-xs sm:text-sm leading-relaxed relative group ${
      msg.role === "user"
        ? "max-w-[85%] sm:max-w-[75%] bg-gradient-to-br from-primary to-primary/80 text-primary-foreground"
        : "w-full bg-secondary/80 backdrop-blur-sm text-secondary-foreground relative gradient-border-subtle"
    }`}>
      {msg.role === "assistant" ? (
        <>
          <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 text-xs sm:text-sm prose-p:my-3 prose-headings:mt-5 prose-headings:mb-2 prose-ul:my-3 prose-ol:my-3 prose-li:my-1 [&_p:has(+ul)]:mb-1 [&_p:has(+ol)]:mb-1 [&>p+p]:mt-4 [&_strong]:text-foreground [&_hr]:my-4 [&_blockquote]:my-3">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                a: ({ href, children, ...props }) => {
                  const safeHref = sanitizeReferenceUrl(href);
                  return (
                    <a href={safeHref} target="_blank" rel="noopener noreferrer" className="text-primary underline hover:text-primary/80" {...props}>
                      {children}
                    </a>
                  );
                },
              }}
            >{linkifyBareUrls(msg.content)}</ReactMarkdown>
          </div>
          <MultimediaControls text={msg.content} />
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
            <button onClick={() => onCopy(msg.content)} className="p-1.5 rounded-lg hover:bg-background/50 backdrop-blur-sm" title="Copiar">
              <Copy className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </div>
        </>
      ) : (
        <span className="whitespace-pre-wrap">{msg.content}</span>
      )}
    </div>
    {msg.role === "user" && (
      <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-xl bg-accent/20 flex items-center justify-center flex-shrink-0">
        <User className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-accent" />
      </div>
    )}
  </div>
), (prev, next) => prev.msg.content === next.msg.content && prev.msg.role === next.msg.role && prev.onCopy === next.onCopy);

TutorMessageItem.displayName = "TutorMessageItem";

export default TutorMessageItem;
