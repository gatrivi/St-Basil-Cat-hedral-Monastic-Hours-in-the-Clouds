import { addDays, isAfter, isBefore, parse, startOfDay } from 'date-fns';

export type HourName = 'Matins' | 'Lauds' | 'Terce' | 'Sext' | 'None' | 'Vespers' | 'Compline';

export interface LiturgicalHour {
  name: HourName;
  timeString: string; // HH:mm
  description: string;
}

export const HOURS_SCHEDULE: LiturgicalHour[] = [
  { name: 'Matins', timeString: '00:00', description: 'Office of Readings' },
  { name: 'Lauds', timeString: '06:00', description: 'Morning Prayer' },
  { name: 'Terce', timeString: '09:00', description: 'Mid-Morning Prayer' },
  { name: 'Sext', timeString: '12:00', description: 'Midday Prayer' },
  { name: 'None', timeString: '15:00', description: 'Mid-Afternoon Prayer' },
  { name: 'Vespers', timeString: '18:00', description: 'Evening Prayer' },
  { name: 'Compline', timeString: '21:00', description: 'Night Prayer' },
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
