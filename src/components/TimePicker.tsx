import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Clock } from 'lucide-react';

interface TimePickerProps {
  value: string; // "HH:mm"
  onChange: (value: string) => void;
  className?: string;
}

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));

const ITEM_HEIGHT = 48;
const VISIBLE_ITEMS = 5;

const ScrollColumn: React.FC<{
  items: string[];
  selected: string;
  onSelect: (val: string) => void;
  label: string;
}> = ({ items, selected, onSelect, label }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isScrollingRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const scrollToItem = useCallback((index: number, smooth = true) => {
    if (!containerRef.current) return;
    const top = index * ITEM_HEIGHT;
    containerRef.current.scrollTo({ top, behavior: smooth ? 'smooth' : 'auto' });
  }, []);

  useEffect(() => {
    const idx = items.indexOf(selected);
    if (idx >= 0) scrollToItem(idx, false);
  }, []);

  const handleScroll = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    isScrollingRef.current = true;
    timeoutRef.current = setTimeout(() => {
      isScrollingRef.current = false;
      if (!containerRef.current) return;
      const scrollTop = containerRef.current.scrollTop;
      const idx = Math.round(scrollTop / ITEM_HEIGHT);
      const clampedIdx = Math.max(0, Math.min(idx, items.length - 1));
      scrollToItem(clampedIdx);
      onSelect(items[clampedIdx]);
    }, 80);
  };

  const paddingTop = Math.floor(VISIBLE_ITEMS / 2) * ITEM_HEIGHT;

  return (
    <div className="flex flex-col items-center flex-1">
      <span className="text-xs text-muted-foreground mb-1 font-medium">{label}</span>
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="relative overflow-y-auto scrollbar-hide"
        style={{
          height: VISIBLE_ITEMS * ITEM_HEIGHT,
          scrollSnapType: 'y mandatory',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {/* Top/bottom padding for centering */}
        <div style={{ height: paddingTop }} />
        {items.map((item) => {
          const isSelected = item === selected;
          return (
            <div
              key={item}
              onClick={() => {
                onSelect(item);
                scrollToItem(items.indexOf(item));
              }}
              className={`flex items-center justify-center cursor-pointer transition-all duration-150 select-none
                ${isSelected
                  ? 'text-primary font-bold text-2xl scale-110'
                  : 'text-muted-foreground text-lg opacity-50'
                }`}
              style={{
                height: ITEM_HEIGHT,
                scrollSnapAlign: 'center',
              }}
            >
              {item}
            </div>
          );
        })}
        <div style={{ height: paddingTop }} />
      </div>
    </div>
  );
};

const TimePicker: React.FC<TimePickerProps> = ({ value, onChange, className }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [h, m] = value.split(':');
  const hour = h || '08';
  // Snap minute to nearest 5
  const rawMin = parseInt(m || '0', 10);
  const snappedMin = String(Math.round(rawMin / 5) * 5).padStart(2, '0');
  const minute = MINUTES.includes(snappedMin) ? snappedMin : '00';

  const [tempHour, setTempHour] = useState(hour);
  const [tempMinute, setTempMinute] = useState(minute);

  useEffect(() => {
    if (isOpen) {
      setTempHour(hour);
      setTempMinute(minute);
    }
  }, [isOpen]);

  const handleConfirm = () => {
    onChange(`${tempHour}:${tempMinute}`);
    setIsOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={`flex items-center justify-between w-full rounded-xl border border-input bg-background px-3 py-2.5 text-base shadow-sm transition-colors hover:bg-accent/50 ${className || ''}`}
      >
        <span className="font-semibold text-foreground text-lg">{value}</span>
        <Clock className="w-5 h-5 text-muted-foreground" />
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[60] bg-foreground/40 flex items-end sm:items-center justify-center" onClick={() => setIsOpen(false)}>
          <div
            className="bg-background w-full sm:max-w-xs rounded-t-3xl sm:rounded-3xl p-5 animate-in slide-in-from-bottom duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-foreground text-center mb-4">בחירת שעה</h3>

            <div className="flex items-center justify-center gap-2">
              <ScrollColumn
                items={MINUTES}
                selected={tempMinute}
                onSelect={setTempMinute}
                label="דקות"
              />
              <span className="text-3xl font-bold text-primary mt-5">:</span>
              <ScrollColumn
                items={HOURS}
                selected={tempHour}
                onSelect={setTempHour}
                label="שעה"
              />
            </div>

            {/* Selection indicator */}
            <div className="relative pointer-events-none" style={{ marginTop: -VISIBLE_ITEMS * ITEM_HEIGHT - 16 }}>
              <div
                className="absolute left-4 right-4 border-y-2 border-primary/30 rounded-lg bg-primary/5"
                style={{
                  top: Math.floor(VISIBLE_ITEMS / 2) * ITEM_HEIGHT + 28,
                  height: ITEM_HEIGHT,
                }}
              />
            </div>

            <div className="flex gap-3 mt-4">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="flex-1 py-3 rounded-xl text-sm font-medium bg-secondary text-secondary-foreground hover:bg-muted transition-colors"
              >
                ביטול
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className="flex-1 py-3 rounded-xl text-sm font-bold medical-gradient text-primary-foreground shadow-md hover:opacity-90 transition-opacity"
              >
                אישור
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default TimePicker;
