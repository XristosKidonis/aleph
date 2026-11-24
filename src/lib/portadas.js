// Portadas de libro: lo que se lee al abrir un libro, en renglones grandes a la izquierda
// (el nombre, una frase partida en tres y el versículo donde empieza) y una nota chica por renglón
// a la derecha (número de libro, sección, autor, capítulos y versículos, de qué trata).

import { LIBROS, nombreLibro, abrevLibro } from './libros.js';
import { VERSICULOS } from './conteos.js';
import { t, idioma, locale } from './i18n.svelte.js';

// Secciones del canon: [desde, hasta, español, inglés]
const SECCIONES = [
  [1, 5, 'Torá · Pentateuco', 'Torah · Pentateuch'],
  [6, 17, 'Libros históricos', 'Historical books'],
  [18, 22, 'Poesía y sabiduría', 'Poetry and wisdom'],
  [23, 27, 'Profetas mayores', 'Major prophets'],
  [28, 39, 'Profetas menores', 'Minor prophets'],
  [40, 43, 'Evangelios', 'Gospels'],
  [44, 44, 'Historia de la iglesia', 'Church history'],
  [45, 57, 'Cartas de Pablo', 'Letters of Paul'],
  [58, 65, 'Cartas generales', 'General letters'],
  [66, 66, 'Profecía', 'Prophecy'],
];

// Autores: los que la Biblia no nombra van «según la tradición» o como anónimos.
const TRAD = ['{a}, según la tradición', '{a}, by tradition'];
const AUTORES = {
  moises: ['Moisés', 'Moses', true], josue: ['Josué', 'Joshua', true], samuel: ['Samuel', 'Samuel', true],
  anon: ['Anónimo', 'Anonymous'], jeremias_t: ['Jeremías', 'Jeremiah', true], esdras_t: ['Esdras', 'Ezra', true],
  esdras: ['Esdras', 'Ezra'], nehemias: ['Nehemías', 'Nehemiah'], david: ['David y otros salmistas', 'David and other psalmists'],
  salomon: ['Salomón y otros sabios', 'Solomon and other sages'], salomon_t: ['Salomón', 'Solomon', true],
  isaias: ['Isaías', 'Isaiah'], jeremias: ['Jeremías', 'Jeremiah'], ezequiel: ['Ezequiel', 'Ezekiel'], daniel: ['Daniel', 'Daniel'],
  oseas: ['Oseas', 'Hosea'], joel: ['Joel', 'Joel'], amos: ['Amós', 'Amos'], abdias: ['Abdías', 'Obadiah'],
  miqueas: ['Miqueas', 'Micah'], nahum: ['Nahúm', 'Nahum'], habacuc: ['Habacuc', 'Habakkuk'], sofonias: ['Sofonías', 'Zephaniah'],
  hageo: ['Hageo', 'Haggai'], zacarias: ['Zacarías', 'Zechariah'], malaquias: ['Malaquías', 'Malachi'],
  mateo: ['Mateo', 'Matthew'], marcos: ['Marcos', 'Mark'], lucas: ['Lucas', 'Luke'], juan: ['Juan', 'John'],
  pablo: ['Pablo', 'Paul'], santiago: ['Santiago', 'James'], pedro: ['Pedro', 'Peter'], judas: ['Judas', 'Jude'],
};

// Por libro: autor, frase en tres renglones (es, en) y de qué trata (es, en)
const P = [
  ['moises', ['El libro', 'de los', 'comienzos'], ['The book', 'of', 'beginnings'], 'De la creación a José en Egipto', 'From creation to Joseph in Egypt'],
  ['moises', ['La salida', 'hacia la', 'libertad'], ['The way', 'out to', 'freedom'], 'De la esclavitud al Sinaí', 'From slavery to Sinai'],
  ['moises', ['Santos', 'porque Dios', 'es santo'], ['Holy', 'because God', 'is holy'], 'Leyes de culto y santidad', 'Laws of worship and holiness'],
  ['moises', ['Cuarenta', 'años en el', 'desierto'], ['Forty', 'years in the', 'wilderness'], 'El viaje por el desierto', 'The journey through the wilderness'],
  ['moises', ['Recuerda', 'el camino', 'recorrido'], ['Remember', 'the road', 'behind you'], 'Los discursos de Moisés en Moab', "Moses' speeches in Moab"],
  ['josue', ['La tierra', 'de la', 'promesa'], ['The land', 'of the', 'promise'], 'La entrada en Canaán', 'The entry into Canaan'],
  ['samuel', ['Cuando', 'no había', 'rey'], ['When there', 'was no', 'king'], 'Ciclos de caída y rescate', 'Cycles of failure and rescue'],
  ['samuel', ['Adonde', 'tú vayas', 'iré yo'], ['Where', 'you go', 'I will go'], 'Una extranjera en la familia de David', "A foreigner in David's family"],
  ['anon', ['Habla,', 'que tu siervo', 'escucha'], ['Speak,', 'your servant', 'is listening'], 'De Samuel a Saúl y David', 'From Samuel to Saul and David'],
  ['anon', ['El reino', 'de', 'David'], ['The kingdom', 'of', 'David'], 'El reinado de David', 'The reign of David'],
  ['jeremias_t', ['Sabiduría,', 'templo', 'y división'], ['Wisdom,', 'temple', 'and division'], 'De Salomón al reino dividido', 'From Solomon to the divided kingdom'],
  ['jeremias_t', ['Reinos', 'que caen', 'al exilio'], ['Kingdoms', 'falling into', 'exile'], 'Hasta la caída de Jerusalén', 'To the fall of Jerusalem'],
  ['esdras_t', ['La historia', 'vuelta a', 'contar'], ['History', 'told', 'again'], 'Genealogías y el reino de David', "Genealogies and David's kingdom"],
  ['esdras_t', ['Buscar', 'a Dios', 'y volver'], ['Seek', 'God', 'and return'], 'De Salomón al exilio', 'From Solomon to the exile'],
  ['esdras', ['El regreso', 'y el', 'templo'], ['The return', 'and the', 'temple'], 'El regreso desde Babilonia', 'The return from Babylon'],
  ['nehemias', ['Levantar', 'los', 'muros'], ['Rebuild', 'the', 'walls'], 'La reconstrucción de Jerusalén', 'The rebuilding of Jerusalem'],
  ['anon', ['Para', 'un momento', 'como este'], ['For', 'such a time', 'as this'], 'Una reina salva a su pueblo', 'A queen saves her people'],
  ['anon', ['El dolor', 'y la', 'pregunta'], ['Pain', 'and the', 'question'], 'Un justo que sufre y pregunta', 'A righteous man suffers and asks'],
  ['david', ['Cantos', 'para toda', 'la vida'], ['Songs', 'for all', 'of life'], '150 cantos y oraciones', '150 songs and prayers'],
  ['salomon', ['Sabiduría', 'para cada', 'día'], ['Wisdom', 'for every', 'day'], 'Dichos para vivir con sabiduría', 'Sayings for wise living'],
  ['salomon_t', ['Todo', 'tiene su', 'tiempo'], ['A time', 'for', 'everything'], 'El sentido de la vida bajo el sol', 'The meaning of life under the sun'],
  ['salomon_t', ['El cantar', 'del', 'amor'], ['The song', 'of', 'love'], 'Un poema de amor', 'A love poem'],
  ['isaias', ['Consuelen', 'a mi', 'pueblo'], ['Comfort,', 'comfort', 'my people'], 'Juicio, consuelo y el Siervo', 'Judgment, comfort and the Servant'],
  ['jeremias', ['Antes', 'de formarte', 'te conocí'], ['Before', 'you were born', 'I knew you'], 'Advertencias antes del exilio', 'Warnings before the exile'],
  ['jeremias_t', ['Nuevas', 'cada', 'mañana'], ['New', 'every', 'morning'], 'Lamento por Jerusalén', 'A lament for Jerusalem'],
  ['ezequiel', ['Huesos', 'secos que', 'reviven'], ['Dry bones', 'that', 'live again'], 'Visiones desde el exilio', 'Visions from exile'],
  ['daniel', ['Fieles', 'en tierra', 'extraña'], ['Faithful', 'in a', 'foreign land'], 'Fidelidad en Babilonia', 'Faithfulness in Babylon'],
  ['oseas', ['Un amor', 'que no se', 'rinde'], ['A love', "that won't", 'let go'], 'Un matrimonio como parábola', 'A marriage as a parable'],
  ['joel', ['El día', 'del', 'Señor'], ['The day', 'of the', 'Lord'], 'Langostas, arrepentimiento y el Espíritu', 'Locusts, repentance and the Spirit'],
  ['amos', ['Que fluya', 'la', 'justicia'], ['Let justice', 'roll', 'down'], 'Un pastor contra la injusticia', 'A shepherd against injustice'],
  ['abdias', ['El orgullo', 'que', 'cae'], ['Pride', 'before', 'the fall'], 'Juicio contra Edom', 'Judgment on Edom'],
  ['anon', ['El profeta', 'que', 'huyó'], ['The prophet', 'who', 'ran'], 'La misericordia llega a Nínive', 'Mercy reaches Nineveh'],
  ['miqueas', ['Justicia,', 'misericordia,', 'humildad'], ['Justice,', 'mercy,', 'humility'], 'Juicio y un rey desde Belén', 'Judgment and a king from Bethlehem'],
  ['nahum', ['Dios', 'es', 'refugio'], ['God', 'is a', 'refuge'], 'La caída de Nínive', 'The fall of Nineveh'],
  ['habacuc', ['El justo', 'vivirá', 'por la fe'], ['The righteous', 'will live', 'by faith'], 'Un profeta discute con Dios', 'A prophet argues with God'],
  ['sofonias', ['Se alegrará', 'por ti', 'con cantos'], ['He will', 'rejoice over', 'you'], 'El día del Señor y un remanente', 'The day of the Lord and a remnant'],
  ['hageo', ['Pongan', 'atención a', 'sus caminos'], ['Consider', 'your', 'ways'], 'Reconstruir el templo', 'Rebuilding the temple'],
  ['zacarias', ['Tu rey', 'viene', 'a ti'], ['Your king', 'is', 'coming'], 'Visiones del rey que viene', 'Visions of the coming king'],
  ['malaquias', ['El sol', 'de', 'justicia'], ['The sun', 'of', 'righteousness'], 'La última voz antes del silencio', 'The last voice before the silence'],
  ['mateo', ['El rey', 'que fue', 'prometido'], ['The king', 'who was', 'promised'], 'Jesús, el Mesías prometido', 'Jesus, the promised Messiah'],
  ['marcos', ['Vino', 'a', 'servir'], ['He came', 'to', 'serve'], 'El evangelio más breve', 'The shortest gospel'],
  ['lucas', ['Buscar', 'a los', 'perdidos'], ['To seek', 'the', 'lost'], 'Un relato ordenado de Jesús', 'An orderly account of Jesus'],
  ['juan', ['El Verbo', 'se hizo', 'carne'], ['The Word', 'became', 'flesh'], 'Siete señales para creer', 'Seven signs to believe'],
  ['lucas', ['Hasta', 'lo último de', 'la tierra'], ['To the', 'ends of', 'the earth'], 'La iglesia, de Jerusalén a Roma', 'The church, from Jerusalem to Rome'],
  ['pablo', ['Justificados', 'por', 'la fe'], ['Justified', 'by', 'faith'], 'El evangelio explicado', 'The gospel explained'],
  ['pablo', ['El amor', 'nunca', 'se acaba'], ['Love', 'never', 'fails'], 'Una iglesia dividida', 'A divided church'],
  ['pablo', ['Poder', 'en la', 'debilidad'], ['Strength', 'in', 'weakness'], 'Un ministerio en la debilidad', 'A ministry in weakness'],
  ['pablo', ['Libres', 'en', 'Cristo'], ['Free', 'in', 'Christ'], 'Gracia, no ley', 'Grace, not law'],
  ['pablo', ['Por gracia', 'mediante', 'la fe'], ['By grace', 'through', 'faith'], 'La iglesia, un solo cuerpo', 'The church, one body'],
  ['pablo', ['Alégrense', 'siempre', 'en el Señor'], ['Rejoice', 'in the Lord', 'always'], 'Gozo desde la cárcel', 'Joy from prison'],
  ['pablo', ['Cristo', 'sobre', 'todo'], ['Christ', 'above', 'all'], 'La supremacía de Cristo', 'The supremacy of Christ'],
  ['pablo', ['Esperanza', 'en su', 'venida'], ['Hope', 'in his', 'coming'], 'Ánimo a una iglesia joven', 'Encouragement for a young church'],
  ['pablo', ['Firmes', 'mientras', 'esperan'], ['Stand firm', 'while', 'you wait'], 'Esperar trabajando', 'Waiting while working'],
  ['pablo', ['Pelea', 'la buena', 'batalla'], ['Fight', 'the good', 'fight'], 'Orden en la iglesia', 'Order in the church'],
  ['pablo', ['He', 'terminado', 'la carrera'], ['I have', 'finished', 'the race'], 'La última carta de Pablo', "Paul's last letter"],
  ['pablo', ['La gracia', 'que', 'transforma'], ['Grace', 'that', 'transforms'], 'Instrucciones para Creta', 'Instructions for Crete'],
  ['pablo', ['Más que', 'un', 'esclavo'], ['More than', 'a', 'slave'], 'Perdón para Onésimo', 'Forgiveness for Onesimus'],
  ['anon', ['Jesús,', 'mejor', 'que todo'], ['Jesus,', 'better', 'than all'], 'Cristo, el gran sumo sacerdote', 'Christ, the great high priest'],
  ['santiago', ['Una fe', 'que', 'obra'], ['Faith', 'that', 'works'], 'La fe se ve en las obras', 'Faith shows in deeds'],
  ['pedro', ['Esperanza', 'en medio', 'del dolor'], ['Hope', 'in the', 'fire'], 'Extranjeros con esperanza', 'Strangers with hope'],
  ['pedro', ['Crezcan', 'en la', 'gracia'], ['Grow', 'in', 'grace'], 'Contra los falsos maestros', 'Against false teachers'],
  ['juan', ['Dios', 'es', 'amor'], ['God', 'is', 'love'], 'Luz, amor y verdad', 'Light, love and truth'],
  ['juan', ['Andar', 'en la', 'verdad'], ['Walk', 'in the', 'truth'], 'A la señora elegida', 'To the chosen lady'],
  ['juan', ['Colaborar', 'con la', 'verdad'], ['Workers', 'for the', 'truth'], 'Carta a Gayo', 'A letter to Gaius'],
  ['judas', ['Contender', 'por', 'la fe'], ['Contend', 'for the', 'faith'], 'Alerta contra los infiltrados', 'A warning about intruders'],
  ['juan', ['Hago', 'nuevas', 'todas las cosas'], ['I make', 'all things', 'new'], 'Visiones del fin y del nuevo comienzo', 'Visions of the end and a new beginning'],
];

function autor(id, en) {
  const [es, ing, tradicion] = AUTORES[id];
  const nombre = en ? ing : es;
  return tradicion ? TRAD[en ? 1 : 0].replace('{a}', nombre) : nombre;
}

// Renglones de la portada del libro n (1–66) en el idioma actual: [{ grande, nota }]
export function portada(n) {
  const libro = LIBROS[n - 1];
  const [idAutor, fraseEs, fraseEn, deQueEs, deQueEn] = P[n - 1];
  const en = idioma() === 'en';
  const seccion = SECCIONES.find(([a, b]) => n >= a && n <= b);
  const versos = VERSICULOS[n - 1].reduce((a, b) => a + b, 0).toLocaleString(locale());
  const caps = libro.capitulos;
  const frase = en ? fraseEn : fraseEs;
  return [
    { grande: nombreLibro(libro), nota: t('pt.libro', { n: String(n).padStart(2, '0') }) },
    { grande: frase[0], nota: en ? seccion[3] : seccion[2] },
    { grande: frase[1], nota: autor(idAutor, en) },
    { grande: frase[2], nota: t(caps === 1 ? 'pt.cap1' : 'pt.caps', { c: caps, v: versos }) },
    { grande: `${abrevLibro(libro)} 1:1`, nota: en ? deQueEn : deQueEs },
  ];
}
