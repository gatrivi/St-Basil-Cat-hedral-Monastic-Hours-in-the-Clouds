import { HourName } from './hours';

export interface LiturgicalFragment {
  title: string;
  subtitle?: string;
  text: string;
}

// Rotate every 3 minutes so a user sees ~5 fragments per hour
export const ROTATION_MINUTES = 3;

export const FRAGMENTS_BY_HOUR: Record<HourName, LiturgicalFragment[]> = {
  Maitines: [
    {
      title: 'Salmo 63',
      subtitle: 'Vigilia nocturna',
      text: `**Dios mío, yo te busco de madrugada.**  
Mi alma tiene sed de ti.  
Mi carne te anhela,  
como tierra reseca y sin agua.

Cómo te contemplaba en el santuario,  
viendo tu fuerza y tu gloria.  
Tu misericordia vale más que la vida:  
te alabarán mis labios.

Toda mi vida te bendeciré,  
alzando las manos en tu nombre.  
Mi alma quedará saciada,  
cmo de manjares exquisitos.`,
    },
    {
      title: 'Benedictus',
      subtitle: 'Cántico de Zacarías',
      text: `**Bendito el Señor, Dios de Israel,**  
porque ha visitado y redimido a su pueblo.

Nos ha suscitado una fuerza de salvación  
en la casa de David, su siervo,  
según lo había predicho desde antiguo  
por boca de sus santos profetas.

Es la salvación que nos libra de nuestros enemigos  
y de la mano de todos los que nos odian;  
ha realizado así la misericordia que tuvo con nuestros padres,  
recordando su santa alianza.`,
    },
    {
      title: 'Salmo 91',
      subtitle: 'Bajo la protección del Altísimo',
      text: `**Tú que habitas al abrigo del Altísimo,**  
que vives a la sombra del Omnipotente,  
di al Señor: «Refugio mío y alcázar,  
mi Dios en quien confío».

Él te librará de la red del cazador,  
de la peste funesta;  
te cubrirá con sus plumas,  
bajo sus alas te refugiarás.

No temerás el terror nocturno,  
ni la flecha que vuela de día,  
ni la peste que se desliza en las tinieblas,  
ni la epidemia que devasta a mediodía.`,
    },
    {
      title: 'Salmo 42',
      subtitle: 'Como busca la cierva',
      text: `**Como busca la cierva**  
los arroyos de agua,  
así mi alma te busca a ti,  
Dios mío.

Tengo sed de Dios, del Dios vivo:  
¿cuándo podré entrar a ver  
el rostro de Dios?

Las lágrimas son mi pan de día y de noche,  
mientras todo el día me repiten:  
«¿Dónde está tu Dios?»

Recuerdo cómo iba con la multitud,  
guiándola en procesión a la casa de Dios,  
entre gritos de alegría y alabanza.`,
    },
    {
      title: 'Oración',
      subtitle: 'Maitines',
      text: `**Señor Dios nuestro,**  
despierta nuestros corazones en esta vigilia  
para que, velando con Cristo,  
contemplemos tu gloria.

Tú que eres luz verdadera,  
ilumina las tinieblas de nuestra noche;  
tú que eres la estrella de la mañana,  
no dejes que la sombra de la muerte nos sorprenda.

Por Jesucristo, nuestro Señor.  
**Amén.**`,
    },
  ],
  Laudes: [
    {
      title: 'Salmo 95',
      subtitle: 'Invitación a la alabanza',
      text: `**Venid, aclamemos al Señor,**  
demos vítores a la Roca que nos salva.  
Entremos a su presencia dándole gracias,  
aclamándolo con cantos.

Porque el Señor es un Dios grande,  
soberano de todos los dioses.  
Tiene en su mano las simas de la tierra,  
son suyas las cumbres de los montes.

Es suyo el mar, porque Él lo hizo,  
la tierra firme que modelaron sus manos.  
Venid, postrémonos por tierra,  
bendiciendo al Señor, nuestro creador.`,
    },
    {
      title: 'Benedictus',
      subtitle: 'Cántico de la mañana',
      text: `**Bendito el Señor, Dios de Israel,**  
porque ha visitado y redimido a su pueblo.

Nos ha suscitado una fuerza de salvación  
en la casa de David, su siervo,  
según lo había predicho desde antiguo  
por boca de sus santos profetas.

Juramento que hizo a nuestro padre Abraham:  
concedernos que, libres de temor,  
arrancados de manos de los enemigos,  
le sirvamos con santidad y justicia.`,
    },
    {
      title: 'Salmo 100',
      subtitle: 'Entrad en la casa del Señor',
      text: `**Aclama al Señor, tierra entera,**  
servid al Señor con alegría,  
entrad en su presencia con aclamaciones.

Sabed que el Señor es Dios:  
Él nos hizo y somos suyos,  
su pueblo y ovejas de su rebaño.

Entrad por sus puertas con acción de gracias,  
por sus atrios con himnos,  
dándole gracias y bendiciendo su nombre.

El Señor es bueno,  
eterna es su misericordia,  
su fidelidad por todas las edades.`,
    },
    {
      title: 'Salmo 5',
      subtitle: 'Oración matutina',
      text: `**Escucha, Señor, mis palabras,**  
atiende a mis gemidos.  
Haz caso de mis gritos de auxilio,  
Rey mío y Dios mío.

De mañana me presentas mis deseos,  
y de mañana te escuchas mi voz.  
De mañana me pongo en tu presencia  
y te espero.

Tú no eres un Dios que ame la maldad,  
ní el malvado es tu huésped.  
Los arrogantes no se mantienen en pie  
ante tu mirada.`,
    },
    {
      title: 'Himno',
      subtitle: 'Al amanecer',
      text: `**Ya asoma el aurora,**  
rompe el alba en luz,  
salta de gozo la tierra  
al ver al sol que surge.

Nuestros corazones despierten  
de la noche del pecado;  
que brille en nosotros el fuego  
de la luz verdadera.

Oh Cristo, sol de justicia,  
disipa las tinieblas;  
que tu Espíritu santo  
encierre nuestros sentidos.

**Amén.**`,
    },
  ],
  Tercia: [
    {
      title: 'Salmo 119',
      subtitle: 'Lámpara para mis pasos',
      text: `**Lámpara es tu palabra para mis pasos,**  
luz en mi camino.  
Lo juro y lo cumpliré:  
guardar tus justos mandamientos.

Estoy muy afligido:  
vivifícame, Señor, según tu promesa.  
Acepta, Señor, los votos de mi boca,  
y enséñame tus leyes.

Mi vida está siempre en peligro,  
pero no olvido tu voluntad.  
Los malvados me tendieron una trampa,  
pero no me desvié de tus decretos.`,
    },
    {
      title: 'Cántico de Isaías',
      subtitle: 'Is 12, 1-6',
      text: `**Te doy gracias, Señor,**  
porque estabas airado contra mí,  
pero ha cesado tu ira  
y me has consolado.

Él es mi salvación y mi alegría:  
confiado, sin temor alguno,  
diré: «El Señor es mi fuerza,  
mi canto es el Señor; Él es mi salvación».

Sacaré agua con alegría  
de las fuentes de la salvación.  
Aquel día diré:  
«Dad gracias al Señor, invocad su nombre».

Cantad al Señor, que ha hecho proezas:  
anunciadlas a toda la tierra.`,
    },
    {
      title: 'Salmo 126',
      subtitle: 'Cuando el Señor cambió la suerte',
      text: `**Cuando el Señor cambió la suerte de Sión,**  
nos parecía soñar:  
la boca se nos llenaba de risas,  
la lengua de gritos de alegría.

Hasta los gentiles decían:  
«El Señor ha estado grande con ellos.»  
El Señor ha estado grande con nosotros,  
y estamos alegres.

Cambia, Señor, nuestra suerte,  
como los torrentes del Neguev.  
Los que sembraban con lágrimas,  
cosechan entre cantares.`,
    },
    {
      title: 'Lectura breve',
      subtitle: '1 Tes 5, 16-18',
      text: `**Estad siempre alegres.**  
Orad sin cesar.  
Dad gracias en todo,  
porque esta es la voluntad de Dios para con vosotros en Cristo Jesús.`,
    },
    {
      title: 'Oración',
      subtitle: 'Tercia',
      text: `**Señor Jesucristo,**  
que a la hora tercia fuiste elevado en la cruz  
por la salvación del mundo,  
concédenos vivir siempre crucificados al pecado  
y glorificados en tu resurrección.

Tú que vives y reinas por los siglos de los siglos.  
**Amén.**`,
    },
  ],
  Sexta: [
    {
      title: 'Salmo 122',
      subtitle: 'Alegría en la casa del Señor',
      text: `**Me alegro con los que me decían:**  
«Vamos a la casa del Señor.»  
Ya están pisando nuestros pies  
tus umbrales, Jerusalén.

Jerusalén está construida  
como ciudad bien compacta.  
Allá suben las tribus,  
las tribus del Señor.

Según la costumbre de Israel,  
a celebrar el nombre del Señor.  
Allí están los tribunales de justicia,  
en el palacio de David.

Pedid la paz para Jerusalén:  
vivan seguros los que te aman.`,
    },
    {
      title: 'Salmo 123',
      subtitle: 'Los ojos puestos en el Señor',
      text: `**A ti levanto mis ojos,**  
a ti que habitas en el cielo.  
Como están los ojos de los esclavos  
fijos en las manos de sus señores.

Como están los ojos de la esclava  
fijos en las manos de su señora,  
así nuestros ojos miran al Señor Dios,  
aguardando su misericordia.

Misericordia, Señor, misericordia,  
que estamos saciados de desprecios;  
estamos hartos el alma  
de la burla de los arrogantes.`,
    },
    {
      title: 'Cántico de Ezequías',
      subtitle: 'Is 38, 10-14',
      text: `**Yo pensé: en medio de mis días**  
tengo que marchar hacia las puertas del abismo;  
me privan del resto de mis años.

Yo pensé: ya no veré más al Señor  
en la tierra de los vivos;  
ya no miraré a nadie  
entre los habitantes del mundo.

Mi morada me la han quitado y me la han llevado,  
como un pajarero;  
como una rueca he enrollado mi vida,  
y Él me corta la trama.

Día y noche me das la caza,  
con sollozos me deshago los huesos.  
Como golondrina grazno,  
como paloma gimo.`,
    },
    {
      title: 'Lectura breve',
      subtitle: 'Jn 4, 23-24',
      text: `**Llega la hora —y ahora es—**  
en que los verdaderos adoradores adorarán al Padre en espíritu y en verdad;  
pues el Padre busca tales adoradores.

Dios es espíritu,  
y los que lo adoran,  
en espíritu y en verdad deben adorar.`,
    },
    {
      title: 'Oración',
      subtitle: 'Sexta',
      text: `**Señor Jesucristo,**  
que a la hora sexta subiste a la cruz  
por nuestra salvación,  
para que, purificados de nuestros pecados,  
volvamos los ojos a la contemplación del cielo.

Tú que vives y reinas por los siglos de los siglos.  
**Amén.**`,
    },
  ],
  Nona: [
    {
      title: 'Salmo 124',
      subtitle: 'Nuestro auxilio es el Señor',
      text: `**Si el Señor no hubiera estado de nuestra parte**  
—que lo diga Israel—:  
si el Señor no hubiera estado de nuestra parte,  
cuando nos asaltaban los hombres.

Nos habrían tragado vivos:  
tanto ardía su ira contra nosotros.  
Nos habrían arrollado las aguas,  
llegándonos el torrente hasta el cuello.

Bendito sea el Señor,  
que no nos entregó como presa a sus dientes.  
Hemos salvado la vida como un pájaro  
de la trampa del cazador.`,
    },
    {
      title: 'Salmo 125',
      subtitle: 'Como el monte Sión',
      text: `**Los que confían en el Señor**  
son como el monte Sión:  
no tiembla, está asentado para siempre.

Jerusalén está rodeada de montes,  
y el Señor rodea a su pueblo  
ahora y por siempre.

No dominará el cetro de los malvados  
sobre el lote de los justos,  
no sea que los justos extiendan sus manos  
hacia la maldad.

Señor, concede bienes a los buenos,  
a los hombres de corazón sincero.`,
    },
    {
      title: 'Salmo 127',
      subtitle: 'A menos que el Señor construya',
      text: `**A menos que el Señor construya la casa,**  
en vano se cansan los albañiles.  
A menos que el Señor guarde la ciudad,  
en vano vigilan los centinelas.

Es inútil que os levantéis de madrugada,  
que acostéis tarde,  
que comáis un pan de fatigas:  
Él concede el sueño a sus amados.

Los hijos son una herencia del Señor,  
un premio es el fruto de las entrañas.  
Como flechas en mano del guerrero,  
son los hijos de la juventud.`,
    },
    {
      title: 'Lectura breve',
      subtitle: 'Ga 6, 9-10',
      text: `**No nos cansemos, pues, de hacer el bien;**  
que a su tiempo cosecharemos,  
si no desmayamos.

Así que, en tanto tengamos oportunidad,  
hagamos bien a todos.`,
    },
    {
      title: 'Oración',
      subtitle: 'Nona',
      text: `**Señor Jesucristo,**  
que a la hora nona entregaste el espíritu en la cruz  
para que, muerto el pecado,  
la humanidad recobrara la vida,  
concédenos descansar en tu corazón abierto  
y resucitar contigo en la gloria.

Tú que vives y reinas por los siglos de los siglos.  
**Amén.**`,
    },
  ],
  Vísperas: [
    {
      title: 'Magnificat',
      subtitle: 'Cántico de María',
      text: `**Proclama mi alma la grandeza del Señor,**  
se alegra mi espíritu en Dios, mi salvador;  
porque ha mirado la humillación de su esclava.

Desde ahora me felicitarán todas las generaciones,  
porque el Poderoso ha hecho obras grandes por mí:  
su nombre es santo,  
y su misericordia llega a sus fieles  
de generación en generación.

Ha derribado del trono a los poderosos,  
y ha exaltado a los humildes.  
Ha colmado de bienes a los hambrientos,  
y ha despedido a los ricos vacíos.

Ha auxiliado a Israel, su siervo,  
acordándose de su misericordia.  
Como había prometido a nuestros padres,  
a Abraham y a su descendencia por siempre.`,
    },
    {
      title: 'Salmo 141',
      subtitle: 'Oración vespertina',
      text: `**Señor, a ti grito;**  
date prisa en acudir a mí;  
escucha mi voz cuando te grito.  
Suba mi oración como incienso ante ti,  
como ofrenda de la tarde.

Pon, Señor, una guardia en mi boca,  
un centinela a la puerta de mis labios.  
No dejes que mi corazón se incline a la maldad,  
a cometer crímenes con los malhechores.

Que el justo me golpee,  
que el piadoso me corrija;  
pero que el perfume del malvado  
no unja mi cabeza.`,
    },
    {
      title: 'Salmo 116',
      subtitle: 'Cálzate, alma mía',
      text: `**Amo al Señor, porque escucha**  
mi voz suplicante;  
inclina su oído hacia mí  
el día en que lo invoco.

Me envolvían redes de muerte,  
me alcanzaron los lazos del abismo,  
caí en tristeza y angustia.  
Invoqué el nombre del Señor:  
«Te ruego, Señor, sálvame.»

El Señor es justo y misericordioso,  
nuestro Dios es compasivo.  
El Señor guarda a los sencillos:  
estaba yo desfallecido y me salvó.`,
    },
    {
      title: 'Salmo 143',
      subtitle: 'Al atardecer',
      text: `**Señor, escucha mi oración;**  
tú que eres fiel, atiende a mi súplica;  
tú que eres justo, escúchame.  
No llames a juicio a tu siervo,  
que ningún viviente es justo ante ti.

El enemigo me persigue a muerte,  
empuja mi vida al polvo,  
me hace habitar en tinieblas  
como los muertos desde antiguo.

Estoy agotado de espíritu;  
dentro de mí se desolaba mi corazón.  
Recuerdo los días de antaño,  
medito todas tus gestas.`,
    },
    {
      title: 'Himno',
      subtitle: 'Cuando cae la tarde',
      text: `**Cristo, luz del cielo,**  
sol de justicia sin ocaso,  
reflejo del Padre, imagen suya,  
infinito en tu esplendor.

Tú alumbras la mañana con rosas,  
el mediodía con celestes fulgores,  
y cuando la tarde se viste de púrpura,  
tú despiertas el canto de las aves.

Oh luz eterna, oh luz divina,  
acrecienta la fe de quienes te adoran;  
oye la oración que al final del día  
te eleva la Iglesia, tu esposa fiel.

**Amén.**`,
    },
  ],
  Completas: [
    {
      title: 'Nunc Dimittis',
      subtitle: 'Cántico de Simeón',
      text: `**Ahora, Señor, según tu promesa,**  
puedes dejar a tu siervo irse en paz.  
Porque mis ojos han visto a tu Salvador,  
a quien has presentado ante todos los pueblos.

Luz para alumbrar a las naciones  
y gloria de tu pueblo Israel.`,
    },
    {
      title: 'Salmo 4',
      subtitle: 'Acción de gracias',
      text: `**Escúchame cuando te invoco, Dios, defensor mío;**  
tú que en el aprieto me diste anchura,  
ten piedad de mí y escucha mi oración.

Y vosotros, ¿hasta cuándo ultrajaréis mi honor,  
amaréis la falsedad y buscaréis el engaño?

Sabed que el Señor hizo milagros conmigo:  
el Señor me escuchará cuando lo invoque.

Iraos, pero no pequéis;  
hablad en vuestro corazón, en vuestra cama,  
y callad.  
Ofreced sacrificios con justicia  
y confiad en el Señor.`,
    },
    {
      title: 'Salmo 31',
      subtitle: 'En tus manos encomiendo mi espíritu',
      text: `**A ti, Señor, me refugio:**  
que no quede yo nunca defraudado;  
tú que eres justo, ponme a salvo,  
inclina tu oído para librarme.

Sé para mí una roca de refugio,  
un baluarte donde me salve,  
porque tú eres mi roca y mi baluarte;  
por tu nombre dirige mis pasos.

En tus manos encomiendo mi espíritu:  
tú me rescatas, Señor, Dios leal.  
Detesto a los que rinden culto a ídolos vanos,  
y yo confío en el Señor.`,
    },
    {
      title: 'Salmo 91',
      subtitle: 'Protección nocturna',
      text: `**Tú que habitas al abrigo del Altísimo,**  
que vives a la sombra del Omnipotente,  
di al Señor: «Refugio mío y alcázar,  
mi Dios en quien confío».

Él te librará de la red del cazador,  
de la peste funesta;  
te cubrirá con sus plumas,  
bajo sus alas te refugiarás.

Si caminas entre leones,  
y serpientes pisas, no te harán daño;  
porque a mí se acoge: lo libraré,  
lo protegeré, porque conoce mi nombre.`,
    },
    {
      title: 'Oración',
      subtitle: 'Completas',
      text: `**Señor, Dios nuestro,**  
concede que nuestro descanso  
no nos aparte de tu vigilancia,  
sino que, mientras el cuerpo duerme,  
nuestro espíritu velé despierto contigo.

Por Cristo nuestro Señor.  
**Amén.**`,
    },
  ],
};

export function getFragmentForHour(hour: HourName, date: Date = new Date()): LiturgicalFragment {
  const fragments = FRAGMENTS_BY_HOUR[hour];
  if (!fragments || fragments.length === 0) {
    return { title: 'Oración', text: '**Amén.**' };
  }
  // Rotate every ROTATION_MINUTES based on minutes elapsed in the day
  const minutesOfDay = date.getHours() * 60 + date.getMinutes();
  const index = Math.floor(minutesOfDay / ROTATION_MINUTES) % fragments.length;
  return fragments[index];
}
