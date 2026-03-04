import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { format, addDays, isSameDay, isToday, isTomorrow, parseISO, getDay, startOfDay } from 'date-fns';
import { Plus, Pill, Stethoscope, CalendarDays, Edit, Trash2, RotateCcw } from 'lucide-react';
import DateStrip from '@/components/DateStrip';
import MedicationCard from '@/components/MedicationCard';
import AppointmentCard from '@/components/AppointmentCard';
import AddMedicationForm from '@/components/AddMedicationForm';
import AddAppointmentForm from '@/components/AddAppointmentForm';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { defaultMedications, defaultAppointments } from '@/data/seedData';
import type { Medication, Appointment, CompletionRecord, ArrivalRecord, MedicationInstance } from '@/types';

const SEED_KEY = 'data_seeded';

const Index = () => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [rangeStart, setRangeStart] = useState(() => addDays(new Date(), -2));
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showMedForm, setShowMedForm] = useState(false);
  const [showApptForm, setShowApptForm] = useState(false);
  const [editingMed, setEditingMed] = useState<Medication | null>(null);
  const [editingAppt, setEditingAppt] = useState<Appointment | null>(null);

  const [medications, setMedications] = useLocalStorage<Medication[]>('medications', []);
  const [appointments, setAppointments] = useLocalStorage<Appointment[]>('appointments', []);
  const [completions, setCompletions] = useLocalStorage<CompletionRecord>('completions', {});
  const [arrivals, setArrivals] = useLocalStorage<ArrivalRecord>('arrivals', {});

  // Seed data once on first load
  useEffect(() => {
    if (!localStorage.getItem(SEED_KEY)) {
      setMedications(defaultMedications);
      setAppointments(defaultAppointments);
      localStorage.setItem(SEED_KEY, 'true');
    }
  }, []);

  const handleReset = () => {
    if (window.confirm('האם לאפס את כל הנתונים למצב הראשוני?')) {
      setMedications(defaultMedications);
      setAppointments(defaultAppointments);
      setCompletions({});
      setArrivals({});
    }
  };

  // Reset to today when returning
  useEffect(() => {
    const handleFocus = () => {
      const now = new Date();
      if (!isToday(selectedDate)) {
        setSelectedDate(now);
        setRangeStart(addDays(now, -2));
      }
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [selectedDate]);

  const dateKey = format(selectedDate, 'yyyy-MM-dd');

  const shiftRange = useCallback((direction: 'forward' | 'backward') => {
    setRangeStart(prev => addDays(prev, direction === 'forward' ? 7 : -7));
  }, []);

  // Filter medications for selected date
  const dailyMedInstances = useMemo((): MedicationInstance[] => {
    const instances: MedicationInstance[] = [];
    const selDate = selectedDate;
    const selDateStr = format(selDate, 'yyyy-MM-dd');

    medications.forEach(med => {
      if (selDateStr < med.startDate) return;
      if (med.endDate && selDateStr > med.endDate) return;

      if (med.frequency === 'daily') {
        med.times.forEach(time => {
          instances.push({ medicationId: med.id, time, medication: med });
        });
      } else if (med.frequency === 'weekly') {
        if (getDay(selDate) === med.weekDay) {
          med.times.forEach(time => {
            instances.push({ medicationId: med.id, time, medication: med });
          });
        }
      } else if (med.frequency === 'once') {
        if (selDateStr === med.startDate) {
          med.times.forEach(time => {
            instances.push({ medicationId: med.id, time, medication: med });
          });
        }
      }
    });

    return instances.sort((a, b) => a.time.localeCompare(b.time));
  }, [medications, selectedDate]);

  // Filter appointments for selected date
  const dailyAppointments = useMemo(() => {
    return appointments
      .filter(a => a.date === dateKey)
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [appointments, dateKey]);

  const toggleCompletion = (medId: string, time: string) => {
    const key = `${medId}_${time}`;
    setCompletions(prev => ({
      ...prev,
      [dateKey]: {
        ...prev[dateKey],
        [key]: !prev[dateKey]?.[key],
      },
    }));
  };

  const toggleArrival = (apptId: string) => {
    setArrivals(prev => ({
      ...prev,
      [dateKey]: {
        ...prev[dateKey],
        [apptId]: !prev[dateKey]?.[apptId],
      },
    }));
  };

  const saveMedication = (med: Medication) => {
    setMedications(prev => {
      const exists = prev.findIndex(m => m.id === med.id);
      if (exists >= 0) {
        const updated = [...prev];
        updated[exists] = med;
        return updated;
      }
      return [...prev, med];
    });
    setShowMedForm(false);
    setEditingMed(null);
  };

  const saveAppointment = (appt: Appointment) => {
    setAppointments(prev => {
      const exists = prev.findIndex(a => a.id === appt.id);
      if (exists >= 0) {
        const updated = [...prev];
        updated[exists] = appt;
        return updated;
      }
      return [...prev, appt];
    });
    setShowApptForm(false);
    setEditingAppt(null);
  };

  const deleteMedication = (id: string) => {
    setMedications(prev => prev.filter(m => m.id !== id));
  };

  const deleteAppointment = (id: string) => {
    setAppointments(prev => prev.filter(a => a.id !== id));
  };

  const canMarkArrival = (appt: Appointment): boolean => {
    if (appt.date !== format(new Date(), 'yyyy-MM-dd')) return false;
    const now = new Date();
    const [h, m] = appt.time.split(':').map(Number);
    const apptTime = new Date();
    apptTime.setHours(h, m, 0, 0);
    return now >= apptTime;
  };

  const hasEvents = dailyMedInstances.length > 0 || dailyAppointments.length > 0;

  return (
    <div className="min-h-screen bg-background pb-24 max-w-md mx-auto">
      {/* Header */}
      <DateStrip
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
        rangeStart={rangeStart}
        onShiftRange={shiftRange}
      />

      {/* Content */}
      <div className="px-4 mt-5 space-y-3">
        <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
          <CalendarDays className="w-5 h-5 text-primary" />
          {(() => {
            const MONTH_NAMES_HE = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
            const DAY_NAMES_HE = ["יום א'", "יום ב'", "יום ג'", "יום ד'", "יום ה'", "יום ו'", 'שבת'];
            const day = selectedDate.getDate();
            const monthName = MONTH_NAMES_HE[selectedDate.getMonth()];
            const datePart = `${day} ב${monthName}`;
            const today = startOfDay(new Date());
            const sel = startOfDay(selectedDate);
            if (isToday(sel)) return `היום, ${datePart}`;
            if (isTomorrow(sel)) return `מחר, ${datePart}`;
            return `${DAY_NAMES_HE[sel.getDay()]}, ${datePart}`;
          })()}
          <span className="text-sm font-normal text-muted-foreground mr-auto">
            {format(selectedDate, 'dd-MM-yyyy')}
          </span>
        </h1>

        {!hasEvents && (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
              <CalendarDays className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground text-base">אין אירועים ליום זה</p>
            <p className="text-muted-foreground/60 text-sm mt-1">לחץ על + להוספת תרופה או תור</p>
          </div>
        )}

        {/* Medications */}
        {dailyMedInstances.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
              <Pill className="w-4 h-4" /> תרופות
            </h2>
            {dailyMedInstances.map((inst) => (
              <div key={`${inst.medicationId}_${inst.time}`} className="relative group">
                <MedicationCard
                  medication={inst.medication}
                  time={inst.time}
                  completed={!!completions[dateKey]?.[`${inst.medicationId}_${inst.time}`]}
                  onToggleComplete={() => toggleCompletion(inst.medicationId, inst.time)}
                />
                <div className="absolute top-3 left-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => { setEditingMed(inst.medication); setShowMedForm(true); }}
                    className="p-1.5 rounded-lg bg-muted hover:bg-secondary transition-colors"
                  >
                    <Edit className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                  <button
                    onClick={() => deleteMedication(inst.medicationId)}
                    className="p-1.5 rounded-lg bg-muted hover:bg-destructive/10 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Appointments */}
        {dailyAppointments.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
              <Stethoscope className="w-4 h-4" /> תורים
            </h2>
            {dailyAppointments.map((appt) => (
              <div key={appt.id} className="relative group">
                <AppointmentCard
                  appointment={appt}
                  canMarkArrival={canMarkArrival(appt)}
                  arrived={!!arrivals[dateKey]?.[appt.id]}
                  onMarkArrival={() => toggleArrival(appt.id)}
                />
                <div className="absolute top-3 left-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => { setEditingAppt(appt); setShowApptForm(true); }}
                    className="p-1.5 rounded-lg bg-muted hover:bg-secondary transition-colors"
                  >
                    <Edit className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                  <button
                    onClick={() => deleteAppointment(appt.id)}
                    className="p-1.5 rounded-lg bg-muted hover:bg-destructive/10 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* FAB */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40">
        {showAddMenu && (
          <div className="absolute bottom-16 left-1/2 -translate-x-1/2 flex flex-col gap-2 animate-in fade-in slide-in-from-bottom-4 duration-200">
            <button
              onClick={() => { setShowAddMenu(false); setEditingMed(null); setShowMedForm(true); }}
              className="flex items-center gap-2 bg-card px-5 py-3 rounded-2xl card-shadow border border-border whitespace-nowrap hover:bg-secondary transition-colors"
            >
              <Pill className="w-5 h-5 text-primary" />
              <span className="font-medium text-sm">הוספת תרופה</span>
            </button>
            <button
              onClick={() => { setShowAddMenu(false); setEditingAppt(null); setShowApptForm(true); }}
              className="flex items-center gap-2 bg-card px-5 py-3 rounded-2xl card-shadow border border-border whitespace-nowrap hover:bg-secondary transition-colors"
            >
              <Stethoscope className="w-5 h-5 text-medical" />
              <span className="font-medium text-sm">הוספת תור</span>
            </button>
          </div>
        )}

        <button
          onClick={() => setShowAddMenu(!showAddMenu)}
          className={`w-14 h-14 rounded-full medical-gradient shadow-lg flex items-center justify-center transition-transform duration-200 hover:scale-105
            ${showAddMenu ? 'rotate-45' : ''}`}
        >
          <Plus className="w-7 h-7 text-primary-foreground" />
        </button>
      </div>

      {/* Overlay to close menu */}
      {showAddMenu && (
        <div className="fixed inset-0 z-30" onClick={() => setShowAddMenu(false)} />
      )}

      {/* Forms */}
      {showMedForm && (
        <AddMedicationForm
          onSave={saveMedication}
          onClose={() => { setShowMedForm(false); setEditingMed(null); }}
          editingMedication={editingMed}
        />
      )}
      {showApptForm && (
        <AddAppointmentForm
          onSave={saveAppointment}
          onClose={() => { setShowApptForm(false); setEditingAppt(null); }}
          editingAppointment={editingAppt}
          defaultDate={dateKey}
        />
      )}
    </div>
  );
};

export default Index;
