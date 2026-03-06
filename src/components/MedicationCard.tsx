import React from 'react';
import { Check, Sun, Moon } from 'lucide-react';
import type { Medication } from '@/types';

interface MedicationCardProps {
  medication: Medication;
  time: string;
  completed: boolean;
  onToggleComplete: () => void;
}

const getTimeIcon = (time: string) => {
  const hour = parseInt(time.split(':')[0], 10);
  if (hour >= 5 && hour < 17) {
    return <Sun className="w-4 h-4 text-amber-500" />;
  }
  return <Moon className="w-4 h-4 text-indigo-400" />;
};

const MedicationCard: React.FC<MedicationCardProps> = ({
  medication,
  time,
  completed,
  onToggleComplete,
}) => {
  return (
    <div className={`bg-card rounded-xl px-3 py-2.5 card-shadow border transition-all duration-200 ${completed ? 'opacity-60 border-success/30' : 'border-border'}`}>
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleComplete}
          className={`w-7 h-7 rounded-full border-2 flex items-center justify-center shrink-0 transition-all duration-200
            ${completed
              ? 'bg-success border-success'
              : 'border-primary/40 hover:border-primary hover:bg-primary/10'
            }`}
        >
          {completed && <Check className="w-3.5 h-3.5 text-success-foreground" />}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className={`font-semibold text-[15px] text-card-foreground leading-tight ${completed ? 'line-through' : ''}`}>
              {medication.name}
            </h3>
            {medication.dosage && (
              <span className="text-xs text-muted-foreground">{medication.dosage}</span>
            )}
          </div>
          {medication.instruction && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {medication.instruction}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {getTimeIcon(time)}
          <span className="text-sm font-medium text-muted-foreground">{time}</span>
        </div>
      </div>
    </div>
  );
};

export default MedicationCard;
