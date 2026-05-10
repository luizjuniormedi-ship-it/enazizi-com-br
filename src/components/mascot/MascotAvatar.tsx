import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MascotState } from './MascotEngine';
import tutorAvatar from "@/assets/tutor-cinematic-avatar.png";
import { 
  Brain, 
  Sparkles, 
  GraduationCap, 
  CheckCircle2, 
  AlertCircle, 
  Coffee, 
  Trophy, 
  Target,
  ShieldAlert
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
    sm: 'w-10 h-10',
    md: 'w-14 h-14',
    lg: 'w-28 h-28',
    xl: 'w-40 h-40'
  };

  const getIcon = () => {
    switch (state) {
      case 'thinking': return <Brain className="text-indigo-400 animate-pulse w-full h-full" />;
      case 'teaching': return <GraduationCap className="text-indigo-400 w-full h-full" />;
      case 'success': return <CheckCircle2 className="text-emerald-400 w-full h-full" />;
      case 'warning': return <AlertCircle className="text-rose-500 w-full h-full" />;
      case 'fatigue': return <Coffee className="text-blue-400 w-full h-full" />;
      case 'celebration': return <Trophy className="text-yellow-400 animate-bounce w-full h-full" />;
      case 'focus': return <Target className="text-rose-400 w-full h-full" />;
      case 'alert': return <ShieldAlert className="text-amber-500 w-full h-full" />;
      case 'correcting': return <CheckCircle2 className="text-indigo-400 w-full h-full" />;
      default: return <Sparkles className="text-indigo-400 w-full h-full" />;
    }
  };



  const glowColors = {
    idle: 'rgba(99, 102, 241, 0.2)', // indigo
    thinking: 'rgba(168, 85, 247, 0.4)', // purple
    teaching: 'rgba(79, 70, 229, 0.4)', // indigo-600
    success: 'rgba(16, 185, 129, 0.4)', // emerald
    warning: 'rgba(245, 158, 11, 0.4)', // amber
    fatigue: 'rgba(59, 130, 246, 0.4)', // blue
    celebration: 'rgba(234, 179, 8, 0.4)', // yellow
    focus: 'rgba(225, 29, 72, 0.4)', // rose
    alert: 'rgba(239, 68, 68, 0.4)', // red
    correcting: 'rgba(99, 102, 241, 0.4)' // indigo
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
        className="relative z-10 w-full h-full bg-slate-900/60 backdrop-blur-xl rounded-[2.5rem] border border-white/10 shadow-2xl flex items-center justify-center overflow-hidden group ring-1 ring-white/5"
      >
        <div className="absolute inset-0 flex items-center justify-center p-2">
          <motion.img 
            src={tutorAvatar} 
            alt="Tutor ENAZIZI"
            className="w-full h-full object-contain"
            animate={state === 'thinking' ? {
              scale: [1, 1.05, 1],
              rotate: [0, 1, -1, 0]
            } : state === 'celebration' ? {
              scale: [1, 1.2, 1],
              y: [0, -10, 0]
            } : {
              y: [0, -4, 0]
            }}
            transition={{
              duration: state === 'thinking' ? 2 : 4,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
        </div>
        
        {/* State Icon Overlay */}
        <div className="absolute bottom-1 right-1 w-1/3 h-1/3 bg-background/90 rounded-full border border-primary/20 flex items-center justify-center p-1 shadow-lg z-20">
          {getIcon()}
        </div>
      </motion.div>
    </div>
  );
};
