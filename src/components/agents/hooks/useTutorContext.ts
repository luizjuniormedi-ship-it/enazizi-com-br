import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Upload, Msg } from "../agentChatTypes";

interface UseTutorContextOptions {
  user: { id: string } | null;
  welcomeMessageWithUploads?: string;
  messages: Msg[];
  setMessages: (messages: Msg[] | ((prev: Msg[]) => Msg[])) => void;
  previousContentLoader?: () => Promise<string>;
}

/**
 * useTutorContext
 * Owns: uploads (RAG materials), upload selection, upload search, welcome-with-uploads
 * one-shot, previousContent anti-repetition loader, and buildUserContext composer.
 *
 * Behavior is preserved 1:1 from the previous monolithic useAgentChat.
 */
export function useTutorContext({
  user,
  welcomeMessageWithUploads,
  messages,
  setMessages,
  previousContentLoader,
}: UseTutorContextOptions) {
  const [availableUploads, setAvailableUploads] = useState<Upload[]>([]);
  const [selectedUploadIds, setSelectedUploadIds] = useState<Set<string>>(new Set());
  const [showUploads, setShowUploads] = useState(false);
  const [uploadSearch, setUploadSearch] = useState("");
  const [hasShownUploadWelcome, setHasShownUploadWelcome] = useState(false);

  const previousContentRef = useRef<string>("");
  const previousContentLoadedRef = useRef(false);

  // Load previous content for anti-repetition
  useEffect(() => {
    if (!user || !previousContentLoader || previousContentLoadedRef.current) return;
    previousContentLoadedRef.current = true;
    previousContentLoader()
      .then((c) => {
        previousContentRef.current = c;
      })
      .catch(() => {});
  }, [user, previousContentLoader]);

  const reloadPreviousContent = useCallback(() => {
    if (!previousContentLoader) return;
    previousContentLoader()
      .then((c) => {
        previousContentRef.current = c;
      })
      .catch(() => {});
  }, [previousContentLoader]);

  // Load uploads
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("uploads")
        .select("id, filename, extracted_text, category")
        .eq("user_id", user.id)
        .eq("status", "processed")
        .not("extracted_text", "is", null)
        .order("created_at", { ascending: false })
        .limit(20);
      if (data && data.length > 0) {
        setAvailableUploads(data);
        setSelectedUploadIds(new Set());
      }
    })();
  }, [user]);

  // Welcome with uploads (one-shot)
  useEffect(() => {
    if (hasShownUploadWelcome || !welcomeMessageWithUploads) return;
    if (
      availableUploads.length > 0 &&
      selectedUploadIds.size > 0 &&
      messages.length === 1 &&
      messages[0].role === "assistant"
    ) {
      const selectedUploads = availableUploads.filter((u) => selectedUploadIds.has(u.id));
      const materialNames = selectedUploads
        .map((u) => u.filename)
        .slice(0, 3)
        .join(", ");
      const suffix = selectedUploads.length > 3 ? ` e mais ${selectedUploads.length - 3}` : "";
      const contextMsg = welcomeMessageWithUploads
        .replace("{materiais}", materialNames + suffix)
        .replace("{count}", String(selectedUploadIds.size));
      setMessages([{ role: "assistant", content: contextMsg }]);
      setHasShownUploadWelcome(true);
    }
  }, [
    availableUploads,
    selectedUploadIds,
    hasShownUploadWelcome,
    welcomeMessageWithUploads,
    messages,
    setMessages,
  ]);

  const buildUserContext = useCallback(
    (extraContext?: string) => {
      let ctx = "";
      if (extraContext) ctx += extraContext;
      if (previousContentRef.current) ctx += "\n\n" + previousContentRef.current;
      if (selectedUploadIds.size === 0) return ctx.trim();
      for (const upload of availableUploads) {
        if (!selectedUploadIds.has(upload.id)) continue;
        const snippet = upload.extracted_text?.slice(0, 3000) || "";
        if (ctx.length + snippet.length > 15000) break;
        ctx += `\n\n📄 ${upload.filename} (${upload.category || "material"}):\n${snippet}`;
      }
      return ctx.trim();
    },
    [availableUploads, selectedUploadIds]
  );

  const toggleUpload = useCallback((id: string) => {
    setSelectedUploadIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelectedUploadIds((prev) => {
      if (prev.size === availableUploads.length) return new Set();
      return new Set(availableUploads.map((u) => u.id));
    });
  }, [availableUploads]);

  return {
    // State
    availableUploads,
    selectedUploadIds,
    showUploads,
    uploadSearch,
    hasShownUploadWelcome,
    // Refs (exposed for parity with v1 API)
    previousContentRef,
    // Setters
    setAvailableUploads,
    setSelectedUploadIds,
    setShowUploads,
    setUploadSearch,
    // Handlers
    buildUserContext,
    toggleUpload,
    toggleAll,
    reloadPreviousContent,
    // Computed
    selectedCount: selectedUploadIds.size,
    totalUploads: availableUploads.length,
  };
}
