import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MascotState } from './MascotEngine';
import { 
  Brain, 
  Sparkles, 
  GraduationCap, 
  CheckCircle2, 
  AlertCircle, 
  Coffee, 
  Trophy, 
  Target 
} from 'lucide-react';

interface MascotAvatarProps {
  state: MascotState;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export const MascotAvatar: React.FC<MascotAvatarProps> = ({ 
  state, 
  size = 'md',
  className = '' 
}) => {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-24 h-24',
    xl: 'w-32 h-32'
  };

  const getIcon = () => {
    switch (state) {
      case 'thinking': return <Brain className="text-primary animate-pulse" />;
      case 'teaching': return <GraduationCap className="text-primary" />;
      case 'success': return <CheckCircle2 className="text-green-500" />;
      case 'warning': return <AlertCircle className="text-yellow-500" />;
      case 'fatigue': return <Coffee className="text-blue-400" />;
      case 'celebration': return <Trophy className="text-amber-500 animate-bounce" />;
      case 'focus': return <Target className="text-red-500" />;
      default: return <Sparkles className="text-primary" />;
    }
  };

  const glowColors = {
    idle: 'rgba(59, 130, 246, 0.2)',
    thinking: 'rgba(139, 92, 246, 0.4)',
    teaching: 'rgba(59, 130, 246, 0.4)',
    success: 'rgba(34, 197, 94, 0.4)',
    warning: 'rgba(234, 179, 8, 0.4)',
    fatigue: 'rgba(96, 165, 250, 0.4)',
    celebration: 'rgba(245, 158, 11, 0.4)',
    focus: 'rgba(239, 68, 68, 0.4)'
  };

  return (
    <div className={`relative flex items-center justify-center ${sizeClasses[size]} ${className}`}>
      {/* Glow Effect */}
      <motion.div
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.6, 0.3],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: "easeInOut"
        }}
        className="absolute inset-0 rounded-full blur-xl"
        style={{ backgroundColor: glowColors[state] }}
      />
      
      {/* Main Body */}
      <motion.div
        key={state}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.8, opacity: 0 }}
        className="relative z-10 w-full h-full bg-background/80 backdrop-blur-md rounded-2xl border border-primary/20 shadow-xl flex items-center justify-center overflow-hidden"
      >
        <div className="w-1/2 h-1/2 transition-all duration-500 transform scale-125">
          {getIcon()}
        </div>
        
        {/* Animated Eyes/Sensors */}
        <div className="absolute top-1/4 left-1/4 right-1/4 flex justify-between px-2">
          <motion.div 
            animate={{ scaleY: [1, 0.1, 1] }}
            transition={{ duration: 4, repeat: Infinity, times: [0, 0.1, 0.2] }}
            className="w-1.5 h-1.5 bg-primary rounded-full" 
          />
          <motion.div 
            animate={{ scaleY: [1, 0.1, 1] }}
            transition={{ duration: 4, repeat: Infinity, times: [0, 0.1, 0.2], delay: 0.1 }}
            className="w-1.5 h-1.5 bg-primary rounded-full" 
          />
        </div>
      </motion.div>
    </div>
  );
};
