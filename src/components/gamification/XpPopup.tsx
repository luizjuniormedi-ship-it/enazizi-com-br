import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap } from "lucide-react";

interface XpPopupProps {
  xpAmount: number;
  onDone?: () => void;
}

/**
 * Floating XP popup that animates upward and fades out.
 * Trigger by setting xpAmount > 0.
 */
const XpPopup = ({ xpAmount, onDone }: XpPopupProps) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (xpAmount > 0) {
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
        onDone?.();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [xpAmount, onDone]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.8 }}
          animate={{ opacity: 1, y: -30, scale: 1 }}
          exit={{ opacity: 0, y: -60, scale: 0.6 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="fixed bottom-24 right-6 z-50 pointer-events-none"
        >
          <div className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 text-white font-bold text-sm shadow-lg shadow-amber-500/30">
            <Zap className="h-4 w-4" />
            +{xpAmount} XP
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default XpPopup;
