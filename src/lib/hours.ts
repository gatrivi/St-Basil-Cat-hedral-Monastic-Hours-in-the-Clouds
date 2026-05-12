import { addDays, isAfter, isBefore, parse, startOfDay } from 'date-fns';

export type HourName = 'Maitines' | 'Laudes' | 'Tercia' | 'Sexta' | 'Nona' | 'Vísperas' | 'Completas';

export interface LiturgicalHour {
  name: HourName;
  timeString: string; // HH:mm
  description: string;
}

export const HOURS_SCHEDULE: LiturgicalHour[] = [
  { name: 'Maitines', timeString: '00:00', description: 'Oficio de Lectura' },
  { name: 'Laudes', timeString: '06:00', description: 'Oración de la Mañana' },
  { name: 'Tercia', timeString: '09:00', description: 'Oración de Media Mañana' },
  { name: 'Sexta', timeString: '12:00', description: 'Oración del Mediodía' },
  { name: 'Nona', timeString: '15:00', description: 'Oración de Media Tarde' },
  { name: 'Vísperas', timeString: '18:00', description: 'Oración de la Tarde' },
  { name: 'Completas', timeString: '21:00', description: 'Oración de la Noche' },
];

export function getCurrentAndNextHour(now: Date = new Date()) {
  const today = startOfDay(now);
  
  // Create Date objects for today's schedule
  const scheduleToday = HOURS_SCHEDULE.map(hour => ({
    ...hour,
    date: parse(hour.timeString, 'HH:mm', today)
  }));

  let currentHour = scheduleToday[scheduleToday.length - 1]; // Default to last hour of previous day
  let nextHour = { ...scheduleToday[0], date: addDays(scheduleToday[0].date, 1) }; // Default to first hour of next day

  for (let i = 0; i < scheduleToday.length; i++) {
    if (isBefore(now, scheduleToday[i].date)) {
      nextHour = scheduleToday[i];
      currentHour = i > 0 ? scheduleToday[i - 1] : { ...scheduleToday[scheduleToday.length - 1], date: addDays(scheduleToday[scheduleToday.length - 1].date, -1) };
      break;
    }
  }

  // If we are past the last hour of the day
  if (isAfter(now, scheduleToday[scheduleToday.length - 1].date) || now.getTime() === scheduleToday[scheduleToday.length - 1].date.getTime()) {
    currentHour = scheduleToday[scheduleToday.length - 1];
    nextHour = { ...scheduleToday[0], date: addDays(scheduleToday[0].date, 1) };
  }

  return { currentHour, nextHour };
}
