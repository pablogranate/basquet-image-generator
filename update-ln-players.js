// update-ln-players.js
// Reenlaza MEDIA DAY LIGA NACIONAL a los equipos de LIGA NACIONAL en library.js

const fs = require('fs');
const path = require('path');

const BASE = path.join(__dirname, 'MEDIA DAY LIGA NACIONAL', 'MEDIA DAY');
const LIB  = path.join(__dirname, 'library.js');

// Mapping: carpeta → clave en library.js
const FOLDER_TO_KEY = {
  'Argentino (J)': 'ARGENTINO',
  'Atenas':        'ATENAS',
  'Boca Juniors':  'BOCA',
  'Ferro':         'FERRO',
  'Gimnasia CR':   'GIMNASIA',
  'Independiente (O)': 'INDEPENDIENTE',
  'Instituto':     'INSTITUTO',
  'La Unión':      'LA UNION',
  'Oberá':         'OBERA',
  'Obras':         'OBRAS',
  'Olímpico':      'OLIMPICO',
  'Peñarol':       'PEÑAROL',
  'Platense':      'PLATENSE',
  'Quimsa':        'QUIMSA',
  'Racing (CH)':   'RACING CH',
  'Regatas':       'REGATAS',
  'San Lorenzo':   'SANLORE',
  'San Martín':    'SAN MARTIN',
  'Unión':         'UNION',
};

// Extrae un nombre legible del nombre de archivo
function parseName(filename) {
  let n = filename.replace(/\.png$/i, '');
  // Quitar variantes tipo (2), (3), (10), (11), etc al final
  n = n.replace(/\s*\(\d+\)\s*$/, '');
  // Quitar variante tipo " b", " a", " 1".." 14" al final
  n = n.replace(/\s+[a-b]$/i, '').replace(/\s+\d+$/, '');
  // Quitar número de camiseta al inicio: "10 JOSE" → "JOSE", "1-Juan" → "Juan"
  n = n.replace(/^\d+\s*[-\s]\s*/, '');
  // Quitar prefijos tipo "15BERRA" → "BERRA"
  n = n.replace(/^\d+/, '');
  // Limpiar underscores y guiones
  n = n.replace(/_/g, ' ').replace(/-/g, ' ').trim();
  // Capitalizar
  n = n.replace(/\b\w/g, c => c.toUpperCase()).trim();
  return n || filename.replace(/\.png$/i, '');
}

// Escanea la carpeta de un equipo y devuelve array de players
function scanTeam(folderName) {
  const dir = path.join(BASE, folderName, 'PNG');
  if (!fs.existsSync(dir)) { console.warn(`  ⚠ No existe: ${dir}`); return []; }

  const files = fs.readdirSync(dir)
    .filter(f => /\.png$/i.test(f))
    .sort();

  return files.map(f => ({
    name: parseName(f),
    number: '',
    file: `MEDIA DAY LIGA NACIONAL/MEDIA DAY/${folderName}/PNG/${f}`
  }));
}

// Leer library.js
let src = fs.readFileSync(LIB, 'utf8');

let totalPlayers = 0;

for (const [folder, teamKey] of Object.entries(FOLDER_TO_KEY)) {
  const players = scanTeam(folder);
  console.log(`${teamKey}: ${players.length} fotos (${folder})`);
  totalPlayers += players.length;

  if (!players.length) continue;

  const playersJSON = JSON.stringify(players, null, 10)
    .replace(/\n {10}/g, '\n            ')
    .replace(/^\[/, '')
    .replace(/\]$/, '');

  // Buscar el bloque "players": [...] dentro del equipo en LIGA NACIONAL
  // Estrategia: buscar el teamKey seguido de su players array y reemplazarlo
  const teamRegex = new RegExp(
    `("${teamKey}"\\s*:\\s*\\{[^}]*?"players"\\s*:\\s*\\[)[^\\]]*\\]`,
    's'
  );

  if (teamRegex.test(src)) {
    src = src.replace(teamRegex, (match, prefix) => {
      return prefix + '\n            ' + playersJSON + '\n          ]';
    });
    console.log(`  ✓ Actualizado en library.js`);
  } else {
    console.warn(`  ⚠ No se encontró "${teamKey}" con players en library.js`);
  }
}

fs.writeFileSync(LIB, src, 'utf8');
console.log(`\n✅ library.js actualizado — ${totalPlayers} fotos totales en Liga Nacional`);
