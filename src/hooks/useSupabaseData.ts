import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import type { Medication, Appointment } from '@/types';

// Convert DB row to Medication type
function rowToMedication(row: any): Medication {
  return {
    id: row.id,
    name: row.name,
    dosage: row.dosage || undefined,
    times: row.times || [],
    frequency: row.frequency as Medication['frequency'],
    weekDay: row.week_day ?? undefined,
    intervalDays: row.interval_days ?? undefined,
    startDate: row.start_date,
    endDate: row.end_date || undefined,
    notes: row.notes || '',
    reminderMinutes: row.reminder_minutes,
    instruction: row.instruction || undefined,
  };
}

// Convert DB row to Appointment type
function rowToAppointment(row: any): Appointment {
  return {
    id: row.id,
    type: row.type,
    date: row.date,
    time: row.time,
    doctor: row.doctor || '',
    location: row.location || '',
    notes: row.notes || '',
    reminderMinutes: row.reminder_minutes,
  };
}

export function useSupabaseData() {
  const { user } = useAuth();
  const [medications, setMedications] = useState<Medication[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [completions, setCompletions] = useState<Record<string, Record<string, boolean>>>({});
  const [arrivals, setArrivals] = useState<Record<string, Record<string, boolean>>>({});
  const [loading, setLoading] = useState(true);

  // Fetch all data
  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const [medsRes, apptsRes, compsRes, arrsRes] = await Promise.all([
      supabase.from('medications').select('*').eq('user_id', user.id),
      supabase.from('appointments').select('*').eq('user_id', user.id),
      supabase.from('completions').select('*').eq('user_id', user.id),
      supabase.from('arrivals').select('*').eq('user_id', user.id),
    ]);

    if (medsRes.data) setMedications(medsRes.data.map(rowToMedication));
    if (apptsRes.data) setAppointments(apptsRes.data.map(rowToAppointment));

    // Build completions record
    if (compsRes.data) {
      const rec: Record<string, Record<string, boolean>> = {};
      compsRes.data.forEach((c: any) => {
        if (!rec[c.date]) rec[c.date] = {};
        rec[c.date][`${c.medication_id}_${c.time}`] = c.completed;
      });
      setCompletions(rec);
    }

    // Build arrivals record
    if (arrsRes.data) {
      const rec: Record<string, Record<string, boolean>> = {};
      arrsRes.data.forEach((a: any) => {
        if (!rec[a.date]) rec[a.date] = {};
        rec[a.date][a.appointment_id] = a.arrived;
      });
      setArrivals(rec);
    }

    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Save medication
  const saveMedication = useCallback(async (med: Medication) => {
    if (!user) return;
    const payload = {
      id: med.id,
      user_id: user.id,
      name: med.name,
      dosage: med.dosage || null,
      times: med.times,
      frequency: med.frequency,
      week_day: med.weekDay ?? null,
      interval_days: med.intervalDays ?? null,
      start_date: med.startDate,
      end_date: med.endDate || null,
      notes: med.notes,
      reminder_minutes: med.reminderMinutes,
      instruction: med.instruction || null,
    };

    const { error } = await supabase.from('medications').upsert(payload, { onConflict: 'id' });
    if (!error) {
      setMedications(prev => {
        const idx = prev.findIndex(m => m.id === med.id);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = med;
          return updated;
        }
        return [...prev, med];
      });
    }
    return error;
  }, [user]);

  // Save appointment
  const saveAppointment = useCallback(async (appt: Appointment) => {
    if (!user) return;
    const payload = {
      id: appt.id,
      user_id: user.id,
      type: appt.type,
      date: appt.date,
      time: appt.time,
      doctor: appt.doctor,
      location: appt.location,
      notes: appt.notes,
      reminder_minutes: appt.reminderMinutes,
    };

    const { error } = await supabase.from('appointments').upsert(payload, { onConflict: 'id' });
    if (!error) {
      setAppointments(prev => {
        const idx = prev.findIndex(a => a.id === appt.id);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = appt;
          return updated;
        }
        return [...prev, appt];
      });
    }
    return error;
  }, [user]);

  // Delete medication
  const deleteMedication = useCallback(async (id: string) => {
    const { error } = await supabase.from('medications').delete().eq('id', id);
    if (!error) setMedications(prev => prev.filter(m => m.id !== id));
  }, []);

  // Delete appointment
  const deleteAppointment = useCallback(async (id: string) => {
    const { error } = await supabase.from('appointments').delete().eq('id', id);
    if (!error) setAppointments(prev => prev.filter(a => a.id !== id));
  }, []);

  // Toggle completion
  const toggleCompletion = useCallback(async (medId: string, time: string, dateKey: string) => {
    if (!user) return;
    const key = `${medId}_${time}`;
    const current = !!completions[dateKey]?.[key];

    if (current) {
      // Remove completion
      await supabase.from('completions').delete()
        .eq('user_id', user.id)
        .eq('medication_id', medId)
        .eq('date', dateKey)
        .eq('time', time);
    } else {
      // Add completion
      await supabase.from('completions').upsert({
        user_id: user.id,
        medication_id: medId,
        date: dateKey,
        time: time,
        completed: true,
      }, { onConflict: 'user_id,medication_id,date,time' });
    }

    setCompletions(prev => ({
      ...prev,
      [dateKey]: {
        ...prev[dateKey],
        [key]: !current,
      },
    }));
  }, [user, completions]);

  // Toggle arrival
  const toggleArrival = useCallback(async (apptId: string, dateKey: string) => {
    if (!user) return;
    const current = !!arrivals[dateKey]?.[apptId];

    if (current) {
      await supabase.from('arrivals').delete()
        .eq('user_id', user.id)
        .eq('appointment_id', apptId)
        .eq('date', dateKey);
    } else {
      await supabase.from('arrivals').upsert({
        user_id: user.id,
        appointment_id: apptId,
        date: dateKey,
        arrived: true,
      }, { onConflict: 'user_id,appointment_id,date' });
    }

    setArrivals(prev => ({
      ...prev,
      [dateKey]: {
        ...prev[dateKey],
        [apptId]: !current,
      },
    }));
  }, [user, arrivals]);

  // Bulk import medications
  const importMedications = useCallback(async (meds: Medication[]) => {
    if (!user) return;
    const payloads = meds.map(med => ({
      id: med.id,
      user_id: user.id,
      name: med.name,
      dosage: med.dosage || null,
      times: med.times,
      frequency: med.frequency,
      week_day: med.weekDay ?? null,
      interval_days: med.intervalDays ?? null,
      start_date: med.startDate,
      end_date: med.endDate || null,
      notes: med.notes,
      reminder_minutes: med.reminderMinutes,
      instruction: med.instruction || null,
    }));
    const { error } = await supabase.from('medications').insert(payloads);
    if (error) throw error;
    setMedications(prev => [...prev, ...meds]);
  }, [user]);

  // Bulk import appointments
  const importAppointments = useCallback(async (appts: Appointment[]) => {
    if (!user) return;
    const payloads = appts.map(appt => ({
      id: appt.id,
      user_id: user.id,
      type: appt.type,
      date: appt.date,
      time: appt.time,
      doctor: appt.doctor,
      location: appt.location,
      notes: appt.notes,
      reminder_minutes: appt.reminderMinutes,
    }));
    const { error } = await supabase.from('appointments').insert(payloads);
    if (error) throw error;
    setAppointments(prev => [...prev, ...appts]);
  }, [user]);

  return {
    medications,
    appointments,
    completions,
    arrivals,
    loading,
    saveMedication,
    saveAppointment,
    deleteMedication,
    deleteAppointment,
    toggleCompletion,
    toggleArrival,
    importMedications,
    importAppointments,
  };
}
