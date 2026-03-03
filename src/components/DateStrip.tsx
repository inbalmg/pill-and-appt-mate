import React, { useMemo } from 'react';
import { format, addDays, isSameDay, isToday } from 'date-fns';
import { he } from 'date-fns/locale';
import { ChevronRight, ChevronLeft } from 'lucide-react';

interface DateStripProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  rangeStart: Date;
  onShiftRange: (direction: 'forward' | 'backward') => void;
}

const DAY_NAMES_HE = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];

const DateStrip: React.FC<DateStripProps> = ({ selectedDate, onSelectDate, rangeStart, onShiftRange }) => {
  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(rangeStart, i));
  }, [rangeStart]);

  return (
    <div className="medical-gradient rounded-b-2xl px-3 pt-4 pb-5 card-shadow">
      <div className="flex items-center justify-between mb-3 px-1">
        <button
          onClick={() => onShiftRange('backward')}
          className="p-1.5 rounded-full bg-primary-foreground/20 hover:bg-primary-foreground/30 transition-colors"
        >
          <ChevronRight className="w-5 h-5 text-primary-foreground" />
        </button>
        <h2 className="text-primary-foreground font-semibold text-lg">
          {format(selectedDate, 'MMMM yyyy', { locale: he })}
        </h2>
        <button
          onClick={() => onShiftRange('forward')}
          className="p-1.5 rounded-full bg-primary-foreground/20 hover:bg-primary-foreground/30 transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-primary-foreground" />
        </button>
      </div>

      <div className="flex gap-1.5 justify-between">
        {days.map((day) => {
          const isSelected = isSameDay(day, selectedDate);
          const isTodayDate = isToday(day);

          return (
            <button
              key={day.toISOString()}
              onClick={() => onSelectDate(day)}
              className={`flex flex-col items-center py-2 px-2.5 rounded-xl transition-all duration-200 min-w-[44px]
                ${isSelected
                  ? 'bg-primary-foreground text-primary scale-105 shadow-lg'
                  : isTodayDate
                    ? 'bg-primary-foreground/25 text-primary-foreground'
                    : 'text-primary-foreground/80 hover:bg-primary-foreground/15'
                }`}
            >
              <span className="text-xs font-medium mb-0.5">
                {DAY_NAMES_HE[day.getDay()]}
              </span>
              <span className={`text-lg font-bold ${isSelected ? '' : ''}`}>
                {format(day, 'd')}
              </span>
              {isTodayDate && !isSelected && (
                <div className="w-1.5 h-1.5 rounded-full bg-primary-foreground mt-0.5" />
              )}
              {isTodayDate && isSelected && (
                <div className="w-1.5 h-1.5 rounded-full bg-primary mt-0.5" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default DateStrip;
