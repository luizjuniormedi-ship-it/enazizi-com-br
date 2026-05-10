import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface MascotBubbleProps {
  speech: string | null;
  className?: string;
}

export const MascotBubble: React.FC<MascotBubbleProps> = ({ speech, className = '' }) => {
  return (
    <AnimatePresence>
      {speech && (
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 5, scale: 0.9 }}
          className={`relative bg-background/90 backdrop-blur-md border border-primary/20 p-3 rounded-2xl shadow-lg max-w-[200px] text-sm text-foreground ${className}`}
        >
          {speech}
          {/* Bubble Tail */}
          <div className="absolute -bottom-2 left-4 w-4 h-4 bg-background border-r border-b border-primary/20 rotate-45 transform" />
        </motion.div>
      )}
    </AnimatePresence>
  );
};
