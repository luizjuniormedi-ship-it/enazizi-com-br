
export type MascotState = 
  | 'idle' 
  | 'thinking' 
  | 'teaching' 
  | 'success' 
  | 'warning' 
  | 'fatigue' 
  | 'celebration' 
  | 'focus'
  | 'alert'
  | 'correcting';

export interface MascotInteraction {
  id: string;
  type: 'welcome' | 'motivation' | 'feedback' | 'celebration' | 'alert' | 'explanation';
  speech?: string;
  state: MascotState;
  timestamp: number;
}
