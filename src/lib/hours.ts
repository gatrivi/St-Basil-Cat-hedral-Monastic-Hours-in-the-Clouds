import { addDays, isAfter, isBefore, parse, startOfDay, format } from 'date-fns';
import { es } from 'date-fns/locale';

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

// ─── Fallback Prayers (work offline / without API key) ───

export function getFallbackPrayer(hour: HourName, date: Date): string {
  const dayName = format(date, 'EEEE', { locale: es });
  const dateStr = format(date, "d 'de' MMMM", { locale: es });

  const prayers: Record<HourName, string> = {
    Maitines: `## Oficio de Lectura — ${dayName}, ${dateStr}

**V.** Dios mio, ven en mi auxilio.
**R.** Senor, date prisa en socorrerme.

**Lectura:**
>En la quietud de la noche, el alma despierta a la presencia del Eterno. Dichosos los que velan, porque veran el amanecer. El Senor es mi pastor, nada me falta. Me hace descansar en verdes praderas, me conduce hacia aguas tranquilas, restaura mi alma.

**Responsorio:**
>El Senor ha liberado a su pueblo, aleluya.
>*De sus pecados, aleluya, aleluya.*

**Oracion:**
>Oh Dios, que por tu Palabra iluminas la noche de nuestras almas, concedenos levantarnos con Cristo en la luz de la manana. Por el mismo Cristo nuestro Senor. **Amen.**`,

    Laudes: `## Oracion de la Manana — ${dayName}, ${dateStr}

**V.** Dios mio, ven en mi auxilio.
**R.** Senor, date prisa en socorrerme.

**Lectura:**
>Este es el dia que hizo el Senor; gocemonos y alegremos en el. Los cielos cuentan la gloria de Dios, y el firmamento anuncia la obra de sus manos. Por la manana, Senor, escuchas mi voz; por la manana te presento mi sacrificio y te espero.

**Responsorio:**
>Ha resplandecido sobre nosotros la luz de Cristo,
>*Y las tinieblas de la noche ya no son.*

**Oracion:**
>Oh Senor, al salir el sol sobre este nuevo dia, llena nuestros corazones con la luz de tu gracia. Que caminemos por el sendero de tus mandamientos todos los dias de nuestra vida. Por Cristo nuestro Senor. **Amen.**`,

    Tercia: `## Oracion de Media Manana — ${dayName}, ${dateStr}

**V.** Ven, Espiritu Santo, llena los corazones de tus fieles.
**R.** Y enciende en ellos el fuego de tu amor.

**Lectura:**
>A la hora tercia, el Espiritu Santo descendio sobre los discipulos. Asi ocurre con nosotros: el Espiritu viene en medio de nuestro trabajo diario para santificar nuestro labor. Hagais lo que hagais, trabajad de buena gana, como para el Senor y no para los hombres.

**Responsorio:**
>El Espiritu del Senor llena toda la tierra,
>*Y sostiene todas las cosas.*

**Oracion:**
>Oh Espiritu Santo, santifica el trabajo de nuestras manos y los pensamientos de nuestra mente. Que todo lo que hagamos sea para gloria de Dios y servicio del projimo. **Amen.**`,

    Sexta: `## Oracion del Mediodia — ${dayName}, ${dateStr}

**V.** En medio de la vida estamos en la muerte; a quien acudiremos sino a ti, Senor?
**R.** Ten piedad de nosotros, Senor, ten piedad.

**Lectura:**
>A la hora sexta, la tierra se cubrio de tinieblas, y a la hora nona Jesus dio un fuerte grito y entrego el espiritu. Acordaos del tiempo. Vivid cada hora como un don. Mirad que ahora es el momento favorable; mirad que ahora es el dia de la salvacion.

**Responsorio:**
>Cristo murio por todos, para que los que viven ya no vivan para si,
>*Sino para aquel que murio y resucito por ellos.*

**Oracion:**
>Oh Cristo, que a la hora sexta colgaste de la cruz por nuestra salvacion, derrama tu misericordia sobre nosotros a este mediodia. Que crucifiquemos nuestra carne con sus pasiones y deseos, y resucitemos contigo en novedad de vida. **Amen.**`,

    Nona: `## Oracion de Media Tarde — ${dayName}, ${dateStr}

**V.** Inclina, Senor, mi corazon segun tu voluntad.
**R.** Que yo busque solo tu rostro.

**Lectura:**
>El dia declina, pero el calor del mundo aun pesa sobre nosotros. En la frescura de la tarde, que encontremos refrigerio en tu Palabra. El Senor peleara por vosotros; solo estad tranquilos. Echad sobre el Senor vuestra carga, y el os sustentara.

**Responsorio:**
>El Senor es mi fuerza y mi cantico,
>*Y el se ha convertido en mi salvacion.*

**Oracion:**
>Oh Dios, al acercarse la tarde, fortalecenos contra el cansancio de la carne y las tentaciones del mundo. Que tu gracia sea nuestro escudo y tu misericordia nuestro descanso. Por Cristo nuestro Senor. **Amen.**`,

    Vísperas: `## Oracion de la Tarde — ${dayName}, ${dateStr}

**V.** Proclama mi alma la grandeza del Senor.
**R.** Y mi espiritu se alegra en Dios mi Salvador.

**Lectura:**
>El dia ya ha terminado; la noche esta cerca. Demos gracias por los dones de este dia y encomendemos la noche a la proteccion del Senor. El Senor es mi luz y mi salvacion; a quien temere? El Senor es la defensa de mi vida; de quien he de atemorizarme?

**Responsorio:**
>En tus manos, Senor, encomiendo mi espiritu,
>*Tu nos has redimido, Senor, Dios de verdad.*

**Oracion:**
>Oh Senor, al declinar la luz y caer la tarde, acepta nuestra accion de gracias por las bendiciones de este dia. Guardanos seguros a traves de la oscuridad de la noche, y levantanos para saludar la luz de la manana. Por Cristo nuestro Senor. **Amen.**`,

    Completas: `## Oracion de la Noche — ${dayName}, ${dateStr}

**V.** Guianos, Senor, como a la nina de tus ojos; ocultanenos a la sombra de tus alas.
**R.** Que descansemos en paz, y que nuestro sueno sea santo.

**Lectura:**
>Ahora me acuesto a dormir. La noche esta muy avanzada; el dia esta cerca. Despojemonos de las obras de tinieblas y vistamonos con la armadura de luz. En paz me acostare y dormire, porque solo tu, Senor, me haces habitar en seguridad.

**Responsorio:**
>Protegenos, Senor, mientras estamos despiertos,
>*Y guardanos mientras dormimos, para que despiertos velemos con Cristo, y dormidos descansemos en su paz.*

**Oracion:**
>Oh Senor, concedenos una noche tranquila y una muerte apacible. Que la Santisima Virgen Maria, todos los angeles y santos, y especialmente San Jose, rueguen por nosotros. Que el Senor Todopoderoso nos conceda una noche bendita y un descanso santo. **Amen.**`,
  };

  return prayers[hour] || prayers.Maitines;
}
