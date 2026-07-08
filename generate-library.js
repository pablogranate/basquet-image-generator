const fs = require('fs');
const path = require('path');

const ROOT = __dirname;

function readExistingLibrary() {
  const file = path.join(ROOT, 'library.js');
  if (!fs.existsSync(file)) return null;
  const raw = fs.readFileSync(file, 'utf8');
  const match = raw.match(/const\s+LIBRARY\s*=\s*([\s\S]*?);\s*$/);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch (e) {
    return null;
  }
}

const EXISTING_LIBRARY = readExistingLibrary();

function readDir(relPath) {
  const full = path.join(ROOT, relPath);
  if (!fs.existsSync(full)) return [];
  return fs.readdirSync(full);
}

function isImageFile(name) {
  return /\.(png|jpg|jpeg|webp|svg|PNG|JPG)$/i.test(name);
}

// ─── LIGA NACIONAL ───

const LN_LOGO = 'LOGOS LIGAS/4 - LOGOS LIGAS/LIGA NACIONAL.png';
const LN_LOGOS_DIR = 'LOGOS LN';
const LN_MEDIADAY_DIR = 'MEDIA DAY LIGA NACIONAL/MEDIA DAY';

// Map mediaday folder name → logo filename (without .png)
const LN_FOLDER_TO_LOGO = {
  'Argentino (J)':     'ARGENTINO',
  'Atenas':            'ATENAS',
  'Boca Juniors':      'BOCA',
  'Ferro':             'FERRO',
  'Gimnasia CR':       'GIMNASIA',
  'Independiente (O)': 'INDEPENDIENTE',
  'Instituto':         'INSTITUTO',
  'La Unión':          'LA UNION',
  'Oberá':             'OBERA',
  'Obras':             'OBRAS',
  'Olímpico':          'OLIMPICO',
  'Peñarol':           'PEÑAROL',
  'Platense':          'PLATENSE',
  'Quimsa':            'QUIMSA',
  'Racing (CH)':       'RACING CH',
  'Regatas':           'REGATAS',
  'San Lorenzo':       'SANLORE',
  'San Martín':        'SAN MARTIN',
  'Unión':             'UNION',
};

function parseLNPlayer(filename, teamFolder) {
  // Patterns:
  // "3 - Santiago Ferreyra.png"
  // "03-Lucas-Faggiano.png"
  // "1.png" (number only)
  // "LOVING, MARC CRANDALL.png" (name only, no number)
  // "chequear.png" (skip non-player files? include as name-only)
  // "17 - Cristian Cardo x2.png" (variant, include as-is)

  const base = filename.replace(/\.png$/i, '');

  // Pattern: number - name (with spaces around dash)
  let m = base.match(/^(\d+)\s*-\s*(.+)$/);
  if (m) {
    const number = String(parseInt(m[1], 10)); // strip leading zeros
    const name = m[2].replace(/-/g, ' ').trim();
    return { name, number };
  }

  // Pattern: number only
  if (/^\d+$/.test(base)) {
    return { name: '', number: base };
  }

  // Name only (no number)
  return { name: base.replace(/-/g, ' ').trim(), number: '' };
}

function buildLNTeams() {
  const teams = {};
  const logoFiles = readDir(LN_LOGOS_DIR).filter(isImageFile);
  const mediadayFolders = readDir(LN_MEDIADAY_DIR);

  // Build logo lookup: name (no ext) → filename
  const logoMap = {};
  for (const f of logoFiles) {
    logoMap[f.replace(/\.png$/i, '')] = f;
  }

  for (const folder of mediadayFolders) {
    const fullFolder = path.join(ROOT, LN_MEDIADAY_DIR, folder);
    if (!fs.statSync(fullFolder).isDirectory()) continue;

    // Logo lookup: use mapping or fall back to folder name (uppercase)
    const logoBaseName = LN_FOLDER_TO_LOGO[folder] || folder.toUpperCase();
    const logoFile = logoMap[logoBaseName];

    if (!logoFile) {
      console.warn(`WARNING: No logo found for LN team folder "${folder}" (looked for "${logoBaseName}")`);
    }

    // Players are inside a PNG subfolder
    const pngDirRaw = path.join(LN_MEDIADAY_DIR, folder, 'PNG');
    const pngDirFull = path.join(ROOT, pngDirRaw);
    const sourceDirRaw = fs.existsSync(pngDirFull) ? pngDirRaw : path.join(LN_MEDIADAY_DIR, folder);
    const sourceDir = sourceDirRaw.replace(/\\/g, '/');

    const players = [];
    const entries = readDir(sourceDir);
    for (const entry of entries) {
      if (entry === 'BAJAS') continue;
      const entryPath = path.join(ROOT, sourceDir, entry);
      if (fs.statSync(entryPath).isDirectory()) continue;
      if (!isImageFile(entry)) continue;

      const { name, number } = parseLNPlayer(entry, folder);
      players.push({
        name,
        number,
        file: `${sourceDir}/${entry}`
      });
    }

    // Sort players by number (numeric), then by name
    players.sort((a, b) => {
      const na = a.number ? parseInt(a.number) : 9999;
      const nb = b.number ? parseInt(b.number) : 9999;
      if (na !== nb) return na - nb;
      return a.name.localeCompare(b.name);
    });

    // Use folder name as display name
    teams[folder] = {
      logo: logoFile ? `${LN_LOGOS_DIR}/${logoFile}` : '',
      players
    };
  }

  return teams;
}

// ─── LUB ───

const LUB_LOGO = 'LOGOS LIGAS/4 - LOGOS LIGAS/LUB.png';
const LUB_LOGOS_DIR = 'ESCUDOS LUB';
const LUB_MEDIADAY_DIR = 'MEDIA DAY LUB/ALINEACIONES';

// Map mediaday folder name → logo filename (without .png)
const LUB_FOLDER_TO_LOGO = {
  'DEFENSOR': 'DEFENSOR SPORTING',
  'HEBRAICA': 'HEBRAICA MACABI',
  'UNION ATLETICA': 'UNION ATLÉTICA',
};

function parseLUBPlayer(filename) {
  const base = filename.replace(/\.png$/i, '');
  // LUB files are just names: "CLARK.png", "ALAN HERNDON.png", "M. FERNANDEZ.png"
  return { name: base.trim(), number: '' };
}

function buildLUBTeams() {
  const teams = {};
  const logoFiles = readDir(LUB_LOGOS_DIR).filter(isImageFile);
  const mediadayFolders = readDir(LUB_MEDIADAY_DIR);

  const logoMap = {};
  for (const f of logoFiles) {
    logoMap[f.replace(/\.png$/i, '')] = f;
  }

  for (const folder of mediadayFolders) {
    const fullFolder = path.join(ROOT, LUB_MEDIADAY_DIR, folder);
    if (!fs.statSync(fullFolder).isDirectory()) continue;

    const logoName = LUB_FOLDER_TO_LOGO[folder] || folder;
    const logoFile = logoMap[logoName];

    if (!logoFile) {
      console.warn(`WARNING: No logo found for LUB team folder "${folder}" (looked for "${logoName}")`);
    }

    const players = [];
    const entries = readDir(path.join(LUB_MEDIADAY_DIR, folder));
    for (const entry of entries) {
      // Skip NO/no subfolders
      if (entry === 'NO' || entry === 'no') continue;
      const entryPath = path.join(ROOT, LUB_MEDIADAY_DIR, folder, entry);
      if (fs.statSync(entryPath).isDirectory()) continue;
      if (!isImageFile(entry)) continue;

      const { name, number } = parseLUBPlayer(entry);
      players.push({
        name,
        number,
        file: `${LUB_MEDIADAY_DIR}/${folder}/${entry}`
      });
    }

    // Sort alphabetically by name
    players.sort((a, b) => a.name.localeCompare(b.name));

    teams[logoName] = {
      logo: logoFile ? `${LUB_LOGOS_DIR}/${logoFile}` : '',
      players
    };
  }

  return teams;
}

// ─── LIGA FEMENINA ───

const LF_LOGO = 'LOGOS LIGAS/4 - LOGOS LIGAS/LIGA FEMENINA.png';
const LF_LOGOS_DIR = 'ESCUDOS LIGA FEMENINA';
const LF_MEDIADAY_DIR = 'MEDIADAY LIGA FEMENINA/MEDIADAY';

const LF_FOLDER_TO_LOGO = {
  'berazategui': 'Berazategui',
  'bochas': 'Bochas',
  'chañares': 'Chanares',
  'el bigua': 'EL BIGUA (NEUQUEN)',
  'el talar': 'El Talar',
  'ferro': 'Ferro',
  'fusion riojana': 'Fusion Riojana',
  'gorriones': 'Gorriones',
  'hindu': 'HINDÚ (CÓRDOBA)',
  'independiente': 'Independiente',
  'INSTITUTO': 'Instituto',
  'lanus': 'Lanus',
  'nautico': 'Nautico Santa Fe',
  'obras': 'Obras',
  'quimsa': 'Quimsa',
  'rocamora': 'Rocamora',
  'san jose': 'Union Deportiva San Jose',
  'uflo': 'Uf',
};

function buildLFTeams() {
  const teams = {};
  const logoFiles = readDir(LF_LOGOS_DIR).filter(isImageFile);
  const mediadayFolders = readDir(LF_MEDIADAY_DIR);

  const logoMap = {};
  for (const f of logoFiles) {
    const name = f.replace(/\.(png|jpg|jpeg|webp|svg)$/i, '');
    logoMap[name] = f;
  }

  for (const folder of mediadayFolders) {
    const fullFolder = path.join(ROOT, LF_MEDIADAY_DIR, folder);
    if (!fs.statSync(fullFolder).isDirectory()) continue;

    const logoName = LF_FOLDER_TO_LOGO[folder] || folder;
    const logoFile = logoMap[logoName];

    if (!logoFile) {
      console.warn(`WARNING: No logo found for LF team folder "${folder}" (looked for "${logoName}")`);
    }

    const players = [];
    const entries = readDir(path.join(LF_MEDIADAY_DIR, folder));
    for (const entry of entries) {
      if (entry === 'BAJAS' || entry === 'bajas' || entry === 'NO' || entry === 'no') continue;
      const entryPath = path.join(ROOT, LF_MEDIADAY_DIR, folder, entry);
      if (fs.statSync(entryPath).isDirectory()) continue;
      if (!isImageFile(entry)) continue;

      const base = entry.replace(/\.(png|jpg|jpeg|webp)$/i, '');
      // Parse: "3 - Name.png" or just "Name.png"
      let m = base.match(/^(\d+)\s*-\s*(.+)$/);
      if (m) {
        players.push({ name: m[2].trim(), number: String(parseInt(m[1])), file: `${LF_MEDIADAY_DIR}/${folder}/${entry}` });
      } else {
        players.push({ name: base.trim(), number: '', file: `${LF_MEDIADAY_DIR}/${folder}/${entry}` });
      }
    }

    players.sort((a, b) => a.name.localeCompare(b.name, 'es'));

    teams[logoName] = {
      logo: logoFile ? `${LF_LOGOS_DIR}/${logoFile}` : '',
      players
    };
  }

  return teams;
}

// ─── LIGA ARGENTINA ───

const LA_LOGO = 'LOGOS LIGAS/4 - LOGOS LIGAS/LIGA ARGENTINA.png';
const LA_LOGOS_DIR = 'ESCUDOS LIGA ARGENTINA';
const LA_MEDIADAY_DIR = 'MEDIA DAY LIGA ARGENTINA';

const LA_FOLDER_TO_LOGO = {
  'Bochas': 'logo bochas modificado PNG',
  'Centenario de Venado Tuerto': 'Centenario',
  'Central Entrerriano': 'Central Enterriano',
  'Ciclista Juninense': 'Ciclista',
  'Colón': 'Colon sf',
  'Deportivo Viedma': 'Viedma',
  'Estudiantes de Tucuman': 'Estudiantes TUC',
  'Fusión Riojana': 'Fusion Riojana',
  'Hindu': 'Hindu Cordoba',
  'Huracán': 'Huracan Las Heras',
  'Huracan': 'Huracan Las Heras',
  'Independiente BBC': 'Independiente',
  'La Unión de Colón': 'La unión C',
  'Lanús': 'Lanus',
  'Pergamino Básquet': 'Pergamino',
  'Racing': 'Racing AVE',
  'Rivadavia Basquet': 'Rivadavia',
  'Salta Basquet': 'Salta basket',
  'San Isidro': 'San Isidro SF',
  'Santa Paula': 'SantaPaula',
  'Sportivo Suardi': 'Suardi',
  'Unión MdP': 'Unión MDP',
  'Villa San Martín de Resistencia': 'Villa San Martin',
};

function buildLATeams() {
  const teams = {};
  const logoFiles = readDir(LA_LOGOS_DIR).filter(isImageFile);
  const mediadayFolders = readDir(LA_MEDIADAY_DIR);

  const logoMap = {};
  for (const f of logoFiles) {
    const name = f.replace(/\.(png|jpg|jpeg|webp|svg|PNG)$/i, '');
    logoMap[name] = f;
  }

  for (const folder of mediadayFolders) {
    const fullFolder = path.join(ROOT, LA_MEDIADAY_DIR, folder);
    if (!fs.statSync(fullFolder).isDirectory()) continue;

    const logoName = LA_FOLDER_TO_LOGO[folder] || folder;
    const logoFile = logoMap[logoName];

    if (!logoFile) {
      console.warn(`WARNING: No logo found for LA team folder "${folder}" (looked for "${logoName}")`);
    }

    const players = [];
    const entries = readDir(path.join(LA_MEDIADAY_DIR, folder));
    for (const entry of entries) {
      if (entry === 'BAJAS' || entry === 'bajas' || entry === 'NO' || entry === 'no') continue;
      const entryPath = path.join(ROOT, LA_MEDIADAY_DIR, folder, entry);
      if (fs.statSync(entryPath).isDirectory()) continue;
      if (!isImageFile(entry)) continue;

      const base = entry.replace(/\.(png|jpg|jpeg|webp|PNG)$/i, '');
      let m = base.match(/^(\d+)\s*-\s*(.+)$/);
      if (m) {
        players.push({ name: m[2].trim(), number: String(parseInt(m[1])), file: `${LA_MEDIADAY_DIR}/${folder}/${entry}` });
      } else {
        players.push({ name: base.trim(), number: '', file: `${LA_MEDIADAY_DIR}/${folder}/${entry}` });
      }
    }

    players.sort((a, b) => a.name.localeCompare(b.name, 'es'));

    teams[logoName] = {
      logo: logoFile ? `${LA_LOGOS_DIR}/${logoFile}` : '',
      players
    };
  }

  return teams;
}

// ─── LNB CHILE (Liga BásquetPro) ───

const CHILE_LOGO = 'LOGOS LIGAS/4 - LOGOS LIGAS/LIGA CHERY.png';
const CHILE_LOGOS_DIR = 'LOGOS CHERY';
const CHILE_MEDIADAY_DIR = 'MEDIA DAY CHILE';

const CHILE_FOLDER_TO_LOGO = {
  'BASKET UC': 'CD UNIV.CATOLICA',
  'BOSTON COLLEGE': 'BOSTON COLLEGE',
  'CD LEONES': 'COLEGIO LOS LEONES',
  'CDV': 'CD VALDIVIA',
  'ESPAÑOL OSORNO': 'COOLBET ESPAÑOL DE OSORNO',
  'MUN PUENTE ALTO': 'MUNICIPAL PUENTE ALTO',
  'PUERTO VARAS BASKET': 'PUERTO VARAS',
  'UDEC': 'CD.UNIV.CONCEPCION',
};

function buildChileTeams() {
  const teams = {};
  const logoFiles = readDir(CHILE_LOGOS_DIR).filter(isImageFile);
  const mediadayFolders = readDir(CHILE_MEDIADAY_DIR);

  const logoMap = {};
  for (const f of logoFiles) {
    const name = f.replace(/\.(png|jpg|jpeg|webp|svg|PNG)$/i, '');
    logoMap[name] = f;
  }

  // First add teams with media day
  for (const folder of mediadayFolders) {
    const fullFolder = path.join(ROOT, CHILE_MEDIADAY_DIR, folder);
    if (!fs.statSync(fullFolder).isDirectory()) continue;

    const logoName = CHILE_FOLDER_TO_LOGO[folder] || folder;
    const logoFile = logoMap[logoName];

    if (!logoFile) {
      console.warn(`WARNING: No logo found for Chile team folder "${folder}" (looked for "${logoName}")`);
    }

    const players = [];
    const entries = readDir(path.join(CHILE_MEDIADAY_DIR, folder));
    for (const entry of entries) {
      if (entry === 'BAJAS' || entry === 'bajas' || entry === 'NO' || entry === 'no') continue;
      const entryPath = path.join(ROOT, CHILE_MEDIADAY_DIR, folder, entry);
      if (fs.statSync(entryPath).isDirectory()) continue;
      if (!isImageFile(entry)) continue;

      const base = entry.replace(/\.(png|jpg|jpeg|webp|PNG)$/i, '');
      let m = base.match(/^(\d+)\s*-\s*(.+)$/);
      if (m) {
        players.push({ name: m[2].trim(), number: String(parseInt(m[1])), file: `${CHILE_MEDIADAY_DIR}/${folder}/${entry}` });
      } else {
        players.push({ name: base.trim(), number: '', file: `${CHILE_MEDIADAY_DIR}/${folder}/${entry}` });
      }
    }

    players.sort((a, b) => a.name.localeCompare(b.name, 'es'));

    teams[logoName] = {
      logo: logoFile ? `${CHILE_LOGOS_DIR}/${logoFile}` : '',
      players
    };

    // Remove from logoMap so we know which are logo-only
    if (logoFile) delete logoMap[logoName];
  }

  // Add remaining logo-only teams (no media day)
  for (const [name, file] of Object.entries(logoMap)) {
    teams[name] = {
      logo: `${CHILE_LOGOS_DIR}/${file}`,
      players: []
    };
  }

  return teams;
}

// ─── FONDOS ───

function buildBackgrounds() {
  const dir = 'FONDOS';
  const thumbDir = 'FONDOS_THUMBS';
  const files = readDir(dir).filter(isImageFile).sort((a, b) => a.localeCompare(b, 'es'));
  return files.map(f => {
    const full = `${dir}/${f}`;
    const thumbFile = f.replace(/\.[^.]+$/, '.jpg');
    const thumb = fs.existsSync(path.join(ROOT, thumbDir, thumbFile)) ? `${thumbDir}/${thumbFile}` : full;
    return { full, thumb };
  });
}

// ─── LOGO-ONLY LEAGUES (no media day) ───

function buildLogoOnlyLeague(logosDir) {
  const teams = {};
  const files = readDir(logosDir).filter(isImageFile);
  for (const f of files) {
    const name = f.replace(/\.(png|jpg|jpeg|webp|svg)$/i, '');
    teams[name] = {
      logo: `${logosDir}/${f}`,
      players: []
    };
  }
  return teams;
}

function buildLeagueWithFallback(name, logo, teams) {
  if (teams && Object.keys(teams).length) return { logo, teams };
  const existing = EXISTING_LIBRARY?.leagues?.[name];
  if (existing && Object.keys(existing.teams || {}).length) return existing;
  return { logo, teams: teams || {} };
}

const LOGO_ONLY_LEAGUES = [
  { name: 'LIGA FEDERAL',  logosDir: 'ESCUDOS LIGA FEDERAL',       logoFile: 'LOGOS LIGAS/4 - LOGOS LIGAS/LIGA FEDERAL.png' },
  { name: 'LIGA DOS',      logosDir: 'Escudos LIGA DOS',            logoFile: 'LOGOS LIGAS/4 - LOGOS LIGAS/LIGA DOS.png' },
  { name: 'LBP FEMENINA',  logosDir: 'LOGOS BASQUETPRO FEMENINA',   logoFile: 'LOGOS LIGAS/4 - LOGOS LIGAS/LBP FEMENINA.PNG' },
  { name: 'LDA',           logosDir: 'ESCUDOS LDA',                 logoFile: 'LOGOS LIGAS/4 - LOGOS LIGAS/LDA.png' },
  { name: 'LIGA ENDESA',   logosDir: 'ESCUDOS ENDESA',             logoFile: 'LOGOS LIGAS/4 - LOGOS LIGAS/LIGA ENDESA.png' },
  { name: 'EUROLIGA',      logosDir: 'ESCUDOS EUROLIGA',           logoFile: 'LOGOS LIGAS/4 - LOGOS LIGAS/EUROLIGA.png' },
  { name: 'LBA',           logosDir: 'ESCUDOS LBA',                 logoFile: 'LOGOS LIGAS/4 - LOGOS LIGAS/LBA 2.png' },
  { name: 'PRIMERA FEB',   logosDir: 'ESCUDOS PRIMERA FEB',        logoFile: 'LOGOS LIGAS/4 - LOGOS LIGAS/FEB.png' },
  { name: 'LIBO',          logosDir: 'ESCUDOS LIBO',                logoFile: 'LOGOS LIGAS/4 - LOGOS LIGAS/LIBO-BASQUET.png' },
  { name: 'LBP MASCULINA', logosDir: 'ESCUDOS LBP MASCULINA',      logoFile: 'LOGOS LIGAS/4 - LOGOS LIGAS/LBP Masculina.png' },
  { name: 'LNF CHILE',     logosDir: 'ESCUDOS LNF CHILE',          logoFile: 'LOGOS LIGAS/4 - LOGOS LIGAS/LNF Chile.png' },
];

// ─── Build and write ───

const library = {
  leagues: {
    'LIGA NACIONAL': buildLeagueWithFallback('LIGA NACIONAL', LN_LOGO, buildLNTeams()),
    'LUB': buildLeagueWithFallback('LUB', LUB_LOGO, buildLUBTeams()),
    'LIGA FEMENINA': buildLeagueWithFallback('LIGA FEMENINA', LF_LOGO, buildLFTeams()),
    'LIGA ARGENTINA': buildLeagueWithFallback('LIGA ARGENTINA', LA_LOGO, buildLATeams()),
    'LNB CHILE': buildLeagueWithFallback('LNB CHILE', CHILE_LOGO, buildChileTeams())
  },
  backgrounds: buildBackgrounds()
};

// Add logo-only leagues
for (const l of LOGO_ONLY_LEAGUES) {
  library.leagues[l.name] = {
    logo: l.logoFile,
    teams: buildLogoOnlyLeague(l.logosDir)
  };
}

// Stats
for (const [league, data] of Object.entries(library.leagues)) {
  const teamNames = Object.keys(data.teams);
  const totalPlayers = teamNames.reduce((sum, t) => sum + data.teams[t].players.length, 0);
  console.log(`${league}: ${teamNames.length} teams, ${totalPlayers} players`);
  for (const t of teamNames.sort()) {
    console.log(`  ${t}: ${data.teams[t].players.length} players, logo: ${data.teams[t].logo || 'MISSING'}`);
  }
}

const output = `const LIBRARY = ${JSON.stringify(library, null, 2)};\n`;
fs.writeFileSync(path.join(ROOT, 'library.js'), output, 'utf-8');
console.log('\nlibrary.js written successfully.');
