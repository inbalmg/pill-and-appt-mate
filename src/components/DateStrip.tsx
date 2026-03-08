import React, { useMemo, useRef, useEffect, useCallback } from 'react';
import { format, addDays, isSameDay, isToday, startOfDay } from 'date-fns';
import { he } from 'date-fns/locale';

interface DateStripProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  rangeStart: Date;
  onShiftRange: (direction: 'forward' | 'backward') => void;
  onGoToToday: () => void;
  showTodayButton: boolean;
}

const DAY_NAMES_HE = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];

// Total days to render (centered around rangeStart)
const TOTAL_DAYS = 35;
const BUFFER_BEFORE = 14;

const DayButton = React.memo(({
  day,
  isSelected,
  isTodayDate,
  onSelect,
}: {
  day: Date;
  isSelected: boolean;
  isTodayDate: boolean;
  onSelect: () => void;
}) => (
  <button
    data-date={format(day, 'yyyy-MM-dd')}
    onClick={onSelect}
    className={`flex flex-col items-center py-2 px-2.5 rounded-xl transition-all duration-200 min-w-[44px] shrink-0
      ${isSelected
        ? 'bg-primary-foreground text-primary scale-105 shadow-lg'
        : isTodayDate
          ? 'bg-primary-foreground/25 text-primary-foreground'
          : 'text-primary-foreground/80 hover:bg-primary-foreground/15'
      }`}
  >
    <span className="text-xs font-medium mb-0.5 text-center">
      {DAY_NAMES_HE[day.getDay()]}
    </span>
    <span className="text-lg font-bold">
      {format(day, 'd')}
    </span>
    <div className="h-1.5 mt-0.5 flex items-center justify-center">
      {isTodayDate && (
        <div className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-primary' : 'bg-primary-foreground'}`} />
      )}
    </div>
  </button>
));

DayButton.displayName = 'DayButton';

const DateStrip: React.FC<DateStripProps> = ({ selectedDate, onSelectDate, rangeStart, onShiftRange, onGoToToday, showTodayButton }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isInitialScroll = useRef(true);

  const days = useMemo(() => {
    const start = addDays(rangeStart, -BUFFER_BEFORE);
    return Array.from({ length: TOTAL_DAYS }, (_, i) => addDays(start, i));
  }, [rangeStart]);

  // Scroll to selected date
  const scrollToSelected = useCallback((smooth: boolean) => {
    if (!scrollRef.current) return;
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const el = scrollRef.current.querySelector(`[data-date="${dateStr}"]`) as HTMLElement | null;
    if (el) {
      el.scrollIntoView({
        behavior: smooth ? 'smooth' : 'auto',
        block: 'nearest',
        inline: 'center',
      });
    }
  }, [selectedDate]);

  // Initial scroll (no animation) and smooth scroll on subsequent changes
  useEffect(() => {
    // Small delay to ensure DOM is ready
    const timer = setTimeout(() => {
      if (isInitialScroll.current) {
        scrollToSelected(false);
        isInitialScroll.current = false;
      } else {
        scrollToSelected(true);
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [scrollToSelected]);

  // Extend range when scrolling near edges
  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    // RTL: scrollLeft is negative in RTL
    const scrollRight = Math.abs(scrollLeft);
    const maxScroll = scrollWidth - clientWidth;

    if (scrollRight > maxScroll - 50) {
      onShiftRange('backward');
    } else if (scrollRight < 50) {
      onShiftRange('forward');
    }
  }, [onShiftRange]);

  return (
    <div className="medical-gradient rounded-b-2xl px-3 pt-4 pb-5 card-shadow">
      <div className="flex items-center justify-center mb-3 px-1">
        <div className="flex items-center gap-2">
          <h2 className="text-primary-foreground font-semibold text-lg">
            {format(selectedDate, 'MMMM yyyy', { locale: he })}
          </h2>
          {showTodayButton && (
            <button
              onClick={onGoToToday}
              className="text-xs font-medium bg-primary-foreground/25 hover:bg-primary-foreground/35 text-primary-foreground px-2.5 py-1 rounded-full transition-colors"
            >
              היום
            </button>
          )}
        </div>
      </div>

      <div
        ref={scrollRef}
        dir="rtl"
        onScroll={handleScroll}
        className="flex gap-1.5 overflow-x-auto scrollbar-hide scroll-smooth"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {days.map((day) => (
          <DayButton
            key={day.toISOString()}
            day={day}
            isSelected={isSameDay(day, selectedDate)}
            isTodayDate={isToday(day)}
            onSelect={() => onSelectDate(day)}
          />
        ))}
      </div>
    </div>
  );
};

export default React.memo(DateStrip);
