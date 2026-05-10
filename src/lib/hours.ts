import { addDays, isAfter, isBefore, parse, startOfDay, format } from 'date-fns';

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

// ─── Fallback Prayers (work offline / without API key) ───

export function getFallbackPrayer(hour: HourName, date: Date): string {
  const dayName = format(date, 'EEEE');
  const dateStr = format(date, 'MMMM do');

  const prayers: Record<HourName, string> = {
    Matins: `## Office of Readings — ${dayName}, ${dateStr}

**Verse:** O Lord, open my lips, and my mouth shall proclaim your praise.

**Reading:**
>In the stillness of the night, the soul awakens to the presence of the Eternal. Blessed are those who keep watch, for they shall see the dawn. The Lord is my shepherd; I shall not want. He makes me lie down in green pastures. He leads me beside still waters. He restores my soul.

**Responsory:**
>The Lord has freed his people, alleluia.
>*From their sins, alleluia, alleluia.*

**Concluding Prayer:**
>O God, who through your Word enlighten the night of our souls, grant that we may rise with Christ in the morning light. Through the same Christ our Lord. **Amen.**`,

    Lauds: `## Morning Prayer — ${dayName}, ${dateStr}

**Verse:** God, come to my assistance. Lord, make haste to help me.

**Reading:**
>This is the day that the Lord has made; let us rejoice and be glad in it. The heavens declare the glory of God, and the sky above proclaims his handiwork. In the morning, O Lord, you hear my voice; in the morning I prepare a sacrifice for you and watch.

**Responsory:**
>The splendor of Christ has risen upon us,
>*And the darkness of night is no more.*

**Concluding Prayer:**
>O Lord, as the sun rises upon this new day, fill our hearts with the light of your grace. May we walk in the way of your commandments all the days of our life. Through Christ our Lord. **Amen.**`,

    Terce: `## Mid-Morning Prayer — ${dayName}, ${dateStr}

**Verse:** Come, Holy Spirit, fill the hearts of your faithful.

**Reading:**
>At the third hour, the Holy Spirit descended upon the disciples. So it is with us: the Spirit comes in the midst of our daily work to sanctify our labor. Whatever you do, work heartily, as for the Lord and not for men.

**Responsory:**
>The Spirit of the Lord fills the whole world,
>*And holds all things together.*

**Concluding Prayer:**
>O Holy Spirit, sanctify the work of our hands and the thoughts of our minds. May everything we do be done for the glory of God and the service of our neighbor. **Amen.**`,

    Sext: `## Midday Prayer — ${dayName}, ${dateStr}

**Verse:** In the midst of life we are in death; to whom shall we turn but to you, O Lord?

**Reading:**
>At the sixth hour, darkness covered the land, and at the ninth hour Jesus cried out and gave up his spirit. Remember the time. Live each hour as a gift. Behold, now is the acceptable time; behold, now is the day of salvation.

**Responsory:**
>Christ died for all, that those who live might live no longer for themselves,
>*But for him who died and rose again.*

**Concluding Prayer:**
>O Christ, who hung upon the cross at the sixth hour for our salvation, pour forth your mercy upon us at this midday. May we crucify our flesh with its passions and desires, and rise with you in newness of life. **Amen.**`,

    None: `## Mid-Afternoon Prayer — ${dayName}, ${dateStr}

**Verse:** Incline my heart according to your will, O God.

**Reading:**
>The day declines, yet the heat of the world still presses upon us. In the cool of the evening, may we find refreshment in your Word. The Lord will fight for you; you need only be still. Cast your burden on the Lord, and he will sustain you.

**Responsory:**
>The Lord is my strength and my song,
>*And he has become my salvation.*

**Concluding Prayer:**
>O God, as the day draws toward evening, strengthen us against the weariness of the flesh and the temptations of the world. Let your grace be our shield and your mercy our rest. Through Christ our Lord. **Amen.**`,

    Vespers: `## Evening Prayer — ${dayName}, ${dateStr}

**Verse:** My soul magnifies the Lord, and my spirit rejoices in God my Savior.

**Reading:**
>The day is now over; night is at hand. Let us give thanks for the gifts of this day and entrust the night to the Lord's protection. The Lord is my light and my salvation; whom shall I fear? The Lord is the stronghold of my life; of whom shall I be afraid?

**Responsory:**
>Into your hands, O Lord, I commend my spirit,
>*You have redeemed us, O Lord, God of truth.*

**Concluding Prayer:**
>O Lord, as the light fades and evening falls, accept our thanksgiving for the blessings of this day. Keep us safe through the darkness of night, and raise us up to greet the morning light. Through Christ our Lord. **Amen.**`,

    Compline: `## Night Prayer — ${dayName}, ${dateStr}

**Verse:** Keep us, O Lord, as the apple of your eye; hide us in the shadow of your wings.

**Reading:**
>Now I lay me down to sleep. The night is far gone; the day is at hand. Cast off the works of darkness and put on the armor of light. In peace I will both lie down and sleep; for you alone, O Lord, make me dwell in safety.

**Responsory:**
>Protect us, Lord, while we are awake,
>*And guard us while we sleep, that awake we may keep watch with Christ, and asleep rest in his peace.*

**Concluding Prayer:**
>O Lord, grant us a restful night and a peaceful death. May the Blessed Virgin Mary, all the angels and saints, and especially Saint Joseph, pray for us. May the Almighty Lord grant us a blessed night and a holy rest. **Amen.**`,
  };

  return prayers[hour] || prayers.Matins;
}
