import React from 'react';
import { Pill, Clock, Check } from 'lucide-react';
import type { Medication } from '@/types';

interface MedicationCardProps {
  medication: Medication;
  time: string;
  completed: boolean;
  onToggleComplete: () => void;
}

const MedicationCard: React.FC<MedicationCardProps> = ({
  medication,
  time,
  completed,
  onToggleComplete,
}) => {
  return (
    <div className={`bg-card rounded-2xl p-4 card-shadow border transition-all duration-200 ${completed ? 'opacity-70 border-success/30' : 'border-border'}`}>
      <div className="flex items-start gap-3">
        <button
          onClick={onToggleComplete}
          className={`mt-0.5 w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0 transition-all duration-200
            ${completed
              ? 'bg-success border-success'
              : 'border-primary/40 hover:border-primary hover:bg-primary/10'
            }`}
        >
          {completed && <Check className="w-4 h-4 text-success-foreground" />}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Pill className="w-4 h-4 text-primary shrink-0" />
            <h3 className={`font-semibold text-base text-card-foreground ${completed ? 'line-through' : ''}`}>
              {medication.name}
            </h3>
          </div>

          <div className="flex items-center gap-1.5 text-muted-foreground text-sm mb-1.5">
            <Clock className="w-3.5 h-3.5" />
            <span>{time}</span>
            <span className="mx-1">•</span>
            <span>{medication.dosage}</span>
          </div>

          {medication.instruction && (
            <p className="text-xs text-accent-foreground bg-accent rounded-lg px-2.5 py-1.5 mt-1">
              {medication.instruction}
            </p>
          )}

          <div className="flex gap-3 text-xs text-muted-foreground mt-2">
            <span>מ: {medication.startDate}</span>
            <span>עד: {medication.endDate}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MedicationCard;
