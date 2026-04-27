/**
 * Hook that checks for available invisible mnemonics and provides
 * state for displaying them at the right moment.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "./useAuth";
import { useCoreData } from "./useCoreData";
import {
  getInvisibleMnemonicToShow,
  markInvisibleShown,
  markInvisibleIgnored,
  type ServableMnemonic,
} from "@/lib/mnemonicInvisibleService";

interface UseInvisibleMnemonicOptions {
  /** Current topic being studied — prioritizes topic-relevant mnemonics */
  currentTopic?: string;
  /** Disable the hook (e.g. during exams) */
  enabled?: boolean;
}

export function useInvisibleMnemonic(opts: UseInvisibleMnemonicOptions = {}) {
  const { currentTopic, enabled = true } = opts;
  const { user } = useAuth();
  const { data: coreData } = useCoreData();
  const [mnemonic, setMnemonic] = useState<ServableMnemonic | null>(null);
  const [visible, setVisible] = useState(false);
  const checkedRef = useRef(false);
  const resetAt = coreData?.profile.last_study_plan_reset_at ?? null;

  // Check for pending mnemonics on mount / topic change
  useEffect(() => {
    if (!user?.id || !enabled) return;

    // Debounce: don't re-check within the same render cycle
    checkedRef.current = false;
    const timer = setTimeout(async () => {
      if (checkedRef.current) return;
      checkedRef.current = true;

      try {
        const result = await getInvisibleMnemonicToShow(user.id, currentTopic, resetAt);
        if (result) {
          setMnemonic(result);
          // Slight delay before showing to not interrupt flow
          setTimeout(() => setVisible(true), 2000);
        }
      } catch {
        // fail-closed: silently ignore
      }
    }, 3000); // Wait 3s after topic change before checking

    return () => clearTimeout(timer);
  }, [user?.id, currentTopic, enabled, resetAt]);

  const handleDismiss = useCallback(() => {
    if (mnemonic && user?.id) {
      markInvisibleIgnored(user.id, mnemonic.topic);
    }
    setVisible(false);
    // Allow re-check after dismissal cooldown
    setTimeout(() => setMnemonic(null), 500);
  }, [mnemonic, user?.id]);

  const handleShown = useCallback(() => {
    if (mnemonic && user?.id) {
      markInvisibleShown(mnemonic.linkId, user.id);
    }
  }, [mnemonic, user?.id]);

  return {
    mnemonic: visible ? mnemonic : null,
    isVisible: visible,
    dismiss: handleDismiss,
    markShown: handleShown,
  };
}
