#!/usr/bin/env node
/**
 * OXI E16 Scene Generator
 *
 * Generates valid .oxie16 files from simplified scene definitions.
 *
 * Usage:
 *   node generate-scene.js <input.json> [output.oxie16]
 *
 * Input format: See examples below or scene-input-schema.json
 */

const fs = require('fs');
const path = require('path');

// === Instrument Definition Loader ===

function loadInstrumentDef(filePath, basePath = '.') {
  if (!filePath) return null;

  // Try multiple locations: basePath first, then current directory, then scenes/
  const searchPaths = [
    path.resolve(basePath, filePath),
    path.resolve('.', filePath),
    path.resolve('./scenes', filePath)
  ];

  let fullPath = null;
  for (const p of searchPaths) {
    if (fs.existsSync(p)) {
      fullPath = p;
      break;
    }
  }

  if (!fullPath) {
    console.warn(`Warning: Instrument definition not found: ${filePath}`);
    console.warn(`  Searched: ${searchPaths.join(', ')}`);
    return null;
  }

  const def = JSON.parse(fs.readFileSync(fullPath, 'utf8'));

  // Build lookup maps by CC and NRPN
  const ccMap = new Map();  // cc number -> param def
  const nrpnMap = new Map(); // "msb:lsb" -> param def

  for (const param of def.parameters || []) {
    if (param.type === 'cc') {
      ccMap.set(param.nr1, param);
    } else if (param.type === 'nrpn') {
      nrpnMap.set(`${param.nr2}:${param.nr1}`, param);
    }
  }

  console.log(`Loaded instrument: ${def.name} (${def.parameters?.length || 0} parameters)`);
  return { ccMap, nrpnMap, raw: def };
}

// === Templates ===

const DISABLED_PUSH = {
  instrument: 127, parameter: 0, type: 0, display: 0, mode: 0,
  channel: 0, lower: 0, upper: 127, nr1: 0, nr2: 0, output: 12
};

const DEFAULT_PUSH = {
  instrument: 127, parameter: 0, type: 4, display: 0, mode: 0,
  channel: 0, lower: 0, upper: 127, nr1: 0, nr2: 0, output: 12
};

const DISABLED_TURN = {
  instrument: 127, parameter: 0, type: 0, display: 10, mode: 3,
  channel: 0, lower: 0, upper: 127, defaultValue: 0, nr1: 0, nr2: 0, output: 12
};

const DEFAULT_ICON = [56,28,84,34,146,69,146,73,130,65,68,34,56,28,0,0,0,0,56,28,68,34,162,65,146,73,130,69,68,34,56,28];

// === Validation ===

function validateIcon(icon) {
  if (!Array.isArray(icon)) {
    throw new Error('Icon must be an array');
  }
  if (icon.length !== 32) {
    throw new Error(`Icon must be exactly 32 bytes, got ${icon.length}`);
  }
  for (let i = 0; i < icon.length; i++) {
    const val = icon[i];
    if (!Number.isInteger(val) || val < 0 || val > 255) {
      throw new Error(`Icon byte ${i} must be integer 0-255, got ${val}`);
    }
  }
  return icon;
}

// === Builder Functions ===

function buildTurnAction(def, instrumentDef = null) {
  if (!def || def.type === 'off') return DISABLED_TURN;

  // Look up defaults from instrument definition
  let paramDef = null;
  if (instrumentDef) {
    if (def.type === 'cc' || def.type === 'cc_rel1' || def.type === 'cc_rel2' || def.type === 'cc14') {
      paramDef = instrumentDef.ccMap.get(def.cc);
    } else if (def.type === 'nrpn') {
      paramDef = instrumentDef.nrpnMap.get(`${def.msb}:${def.lsb}`);
    }
  }

  // Note: We don't use paramDef for min/max because the instrument definition
  // has overlapping CC numbers across different synth engines. Using 0-127 is safer.
  const base = {
    instrument: 127,
    parameter: 0,
    display: def.display ?? 10,
    mode: def.mode ?? 3,
    channel: def.channel ?? 0,
    lower: def.lower ?? 0,
    upper: def.upper ?? 127,
    defaultValue: def.defaultValue ?? paramDef?.default_value ?? 0,
    output: def.output ?? 12
  };

  switch (def.type) {
    case 'nrpn':
      return { ...base, type: 9, nr1: def.lsb, nr2: def.msb };
    case 'cc':
      return { ...base, type: 3, nr1: def.cc, nr2: 0 };
    case 'cc14':
      return { ...base, type: 4, nr1: def.cc, nr2: 0, upper: def.upper ?? 16383 };
    case 'cc_rel1':
      return { ...base, type: 1, nr1: def.cc, nr2: 0 };
    case 'cc_rel2':
      return { ...base, type: 2, nr1: def.cc, nr2: 0 };
    case 'pc':
      return { ...base, type: 5, nr1: 0, nr2: 0 };
    case 'pb':
      return { ...base, type: 6, nr1: 0, nr2: 0, upper: 16383 };
    case 'at':
      return { ...base, type: 7, nr1: 0, nr2: 0 };
    case 'note':
      return { ...base, type: 8, nr1: def.note ?? 60, nr2: 0 };
    default:
      return DISABLED_TURN;
  }
}

function buildPushAction(def) {
  if (!def || def.type === 'off') return DISABLED_PUSH;

  const base = {
    instrument: 127,
    parameter: 0,
    display: def.display ?? 0,
    mode: def.mode ?? 0,
    channel: def.channel ?? 0,
    lower: def.lower ?? 0,
    upper: def.upper ?? 127,
    output: def.output ?? 12
  };

  switch (def.type) {
    case 'note':
      return { ...base, type: 1, nr1: def.note ?? 60, nr2: def.velocity ?? 127 };
    case 'cc':
      return { ...base, type: 2, nr1: def.cc, nr2: def.value ?? 127 };
    case 'pc':
      return { ...base, type: 3, nr1: def.program ?? 0, nr2: 0 };
    case 'default':
      return { ...base, type: 4, nr1: 0, nr2: 0 };
    case 'at':
      return { ...base, type: 5, nr1: 0, nr2: 0 };
    case 'page':
      return { ...base, type: 6, nr1: def.page ?? 0, nr2: 0 };
    default:
      return DISABLED_PUSH;
  }
}

// === Color Assignment ===

// Auto-assign colors based on parameter abbreviation/name
// Color scheme: by parameter type with highlighted performance params
function getColorForParam(abbr, name) {
  const a = (abbr || '').toUpperCase();
  const n = (name || '').toLowerCase();

  // Performance params - BRIGHT colors
  if (a === 'VOL' || a === 'SLEV' || a === 'TLEV' || a === 'PVOL' || a === 'ELVL' ||
      a.match(/^LEV[0-9]?$/) || a.match(/^.LEV$/) || a === 'NLEV' || a === 'BLEV' ||
      a === 'ALEV' || a === 'TRLV' || a.match(/^LV[0-9]$/) || a.match(/VOL[0-9]$/)) {
    return 93; // Bright green
  }
  if (a === 'PAN' || a.match(/^PAN[0-9]$/) || a.match(/^PN[0-9]$/) || a === 'ELPN' || a === 'ERPN') {
    return 49; // Yellow - stands out
  }
  if (a === 'FREQ' || a === 'CUT' || a === 'LPCT' || a === 'HPCT') {
    return 84; // Bright cyan - filter cutoff
  }

  // Delay - purple
  if (a === 'DELT' || a === 'DELF' || a === 'DELM' || a === 'TIME' || a === 'FDBK' ||
      a === 'PING' || a === 'RDLY' || a === 'RDEC' || n.includes('dly') || n.includes('delay')) {
    return 71; // Purple
  }
  if (a === 'DEL' || a.match(/DEL$/) || a.match(/^.DEL$/)) {
    return 72; // Delay send - slightly different
  }

  // Reverb - dark purple
  if (a === 'REVP' || a === 'REVD' || a === 'REVM' || a === 'PDLY' || a === 'DECY' ||
      a === 'SHFQ' || a === 'SHGN' || a === 'RSHF' || a === 'RSHG' || a === 'RHPF' ||
      a === 'RLPF' || a === 'RMIX' || a === 'SIZE' || n.includes('rev ') || n.includes('reverb')) {
    return 0; // Dark purple
  }
  if (a === 'REV' || a.match(/REV$/) || a === 'RSND' || a === 'EREV') {
    return 1; // Reverb send
  }

  // Chorus - lavender
  if (a === 'CHRD' || a === 'CHRS' || a === 'CHRM' || a === 'CDPT' || a === 'CSPD' ||
      a === 'CHPF' || a === 'CWTH' || a === 'DEPT' || a === 'SPED' || a === 'WDTH' ||
      n.includes('chor')) {
    return 18; // Lavender
  }
  if (a === 'CHR' || a === 'ECHR' || a.match(/^.CHR$/)) {
    return 17; // Chorus send
  }

  // Filter envelope - orange
  if (a === 'FATK' || a === 'FDEC' || a === 'FSUS' || a === 'FREL' || a === 'FDLY' ||
      a === 'FRST' || a === 'FENV' || a === 'FTRK') {
    return 46; // Orange
  }

  // Amp envelope - salmon/pink
  if (a === 'AATK' || a === 'AHLD' || a === 'ADEC' || a === 'ASUS' || a === 'AREL' ||
      a === 'ARST' || a === 'MODE' || a === 'ATIM') {
    return 55; // Salmon
  }

  // LFOs - magenta
  if (a.match(/^SPD[0-9]$/) || a.match(/^MUL[0-9]$/) || a.match(/^FAD[0-9]$/) ||
      a.match(/^DST[0-9]$/) || a.match(/^WAV[0-9]$/) || a.match(/^PHS[0-9]$/) ||
      a.match(/^TRG[0-9]$/) || a.match(/^DPT[0-9]$/) || n.includes('lfo') || n.includes('lf1') || n.includes('lf2') || n.includes('lf3')) {
    return 74; // Magenta
  }

  // Oscillators - blue
  if (a === 'TUNE' || a.match(/^TUN[0-9]$/) || a.match(/^WAV[0-9]$/) || a.match(/^PD[0-9]$/) ||
      a.match(/^LEV[0-9]$/) || a.match(/^LIN[0-9]$/) || a === 'OMOD' || a === 'DRIF' ||
      a === 'HARM' || a === 'DETN' || a === 'ALGO' || a.match(/^RAT[A-Z]$/) || a === 'MIX' ||
      a === 'WAVE' || a === 'OSC2' || a === 'GLID' || a === 'VLVL' ||
      a === 'SWAV' || a === 'MWAV' || a === 'SDTN' || a === 'SMIX' || a === 'MOCT' || a === 'SANI' ||
      n.includes('osc') || n.includes('tune')) {
    return 5; // Blue
  }

  // Filter (non-envelope) - teal
  if (a === 'RESO' || a === 'TYPE' || a === 'BASE' || a === 'HPF' || a === 'LPF' ||
      a === 'HPRS' || a === 'HPCT' || n.includes('filt') || n.includes('res')) {
    return 83; // Teal
  }

  // Noise - brown
  if (a === 'NATK' || a === 'NDEC' || a === 'NLEV' || a === 'NCHR' || a === 'NMOD' ||
      a === 'NWID' || a === 'NOIS' || n.includes('noise') || n.includes('nois')) {
    return 35; // Brown
  }

  // Overdrive/Distortion - red
  if (a === 'OVER' || a === 'ORTE' || a === 'BR' || a === 'SRR' || a === 'SRTE' ||
      a === 'DRIV' || a === 'CRSH' || a === 'FOLD' || n.includes('overdrive') || n.includes('bit')) {
    return 51; // Red
  }

  // Compressor - rust
  if (a === 'CTHR' || a === 'CATK' || a === 'CREL' || a === 'CRAT' || a === 'CMKP' ||
      a === 'CSSR' || a === 'CSFL' || a === 'CMIX' || a === 'COMP' || n.includes('comp')) {
    return 32; // Rust
  }

  // External inputs - slate
  if (a === 'ELLV' || a === 'ERLV' || a.match(/^E.LV$/) || a.match(/^E.PN$/) ||
      n.includes('ext')) {
    return 25; // Slate
  }

  // FM Drum specific - light blue
  if (a === 'SWTM' || a === 'SWDP' || a === 'CWAV' || a === 'ABWV' || a === 'BHLD' ||
      a === 'BDEC' || a === 'TRNS' || a === 'NWID') {
    return 6; // Light blue
  }

  // Sends (generic) - use brown
  if (a.match(/^SND[0-9]$/) || a.match(/^.SND$/) || n.includes('send')) {
    return 34; // Brown for generic sends
  }

  // Default - gray/slate
  return 22;
}

function buildEncoder(def, pageDefaults = {}, instrumentDef = null) {
  // Object format: {abbr, name, cc, channel?, default?, lower?, upper?, msb?, lsb?}
  // Push action is set to "Set to Default" (type 4) for all mapped encoders
  // If instrumentDef provided, defaults are looked up automatically

  if (!def || typeof def !== 'object') {
    return emptyEncoder();
  }

  const type = pageDefaults.type ?? (def.cc !== undefined ? 'cc' : 'nrpn');

  // Simple object format: {abbr, name, cc} or {abbr, name, msb, lsb}
  if (def.cc !== undefined || def.msb !== undefined) {
    const turnDef = {
      type,
      cc: def.cc,
      msb: def.msb,
      lsb: def.lsb,
      channel: def.channel ?? 0,
      defaultValue: def.default,
      lower: def.lower,
      upper: def.upper
    };

    const autoColor = getColorForParam(def.abbr, def.name);
    return {
      name: def.name ?? def.abbr ?? "",
      abbr: def.abbr ?? "",
      color: def.color ?? autoColor,
      push_action: DEFAULT_PUSH,
      turn_actions: [
        buildTurnAction(turnDef, instrumentDef),
        DISABLED_TURN
      ],
      bipolar: def.bipolar ?? false
    };
  }

  // Full verbose format with nested turn/push objects
  const autoColor = getColorForParam(def.abbr, def.name);
  return {
    name: def.name ?? "",
    abbr: def.abbr ?? "",
    color: def.color ?? autoColor,
    push_action: buildPushAction(def.push),
    turn_actions: [
      buildTurnAction(def.turn ?? def.primary, instrumentDef),
      buildTurnAction(def.secondary, instrumentDef)
    ],
    bipolar: def.bipolar ?? false
  };
}

function emptyEncoder() {
  return {
    name: "", abbr: "", color: 0,
    push_action: DISABLED_PUSH,
    turn_actions: [DISABLED_TURN, DISABLED_TURN],
    bipolar: false
  };
}

function buildPage(def, instrumentDef = null) {
  const pageDefaults = { type: def.type ?? 'nrpn' };
  const encoders = (def.encoders || []).map(e => buildEncoder(e, pageDefaults, instrumentDef));
  while (encoders.length < 16) encoders.push(emptyEncoder());

  return {
    title: def.title ?? "",
    output: def.output ?? 0,
    channel: def.channel ?? 1,
    encoders
  };
}

function emptyPage() {
  const encoders = [];
  for (let i = 0; i < 16; i++) encoders.push(emptyEncoder());
  return { title: "", output: 0, channel: 1, encoders };
}

function buildScene(def, basePath = '.') {
  // Load instrument definition if specified
  const instrumentDef = def.instrument ? loadInstrumentDef(def.instrument, basePath) : null;

  const pages = (def.pages || []).map(p => buildPage(p, instrumentDef));
  while (pages.length < 12) pages.push(emptyPage());

  const icon = def.icon ? validateIcon(def.icon) : DEFAULT_ICON;

  return {
    title: def.title ?? "New Scene",
    icon,
    selectedPreset: def.selectedPreset ?? 0,
    code: { code: def.code ?? "" },
    pages
  };
}

// === CLI ===

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`
OXI E16 Scene Generator

Usage: node generate-scene.js <input.json> [output.oxie16]

Encoder format:
  {abbr, name, cc}                    - Basic CC
  {abbr, name, cc, channel}           - CC with channel override
  {abbr, name, cc, default}           - CC with reset value
  {abbr, name, cc, lower, upper}      - CC with range
  {abbr, name, msb, lsb}              - NRPN

Features:
  - Push encoder = reset to default value
  - Specify "instrument" to load .oxiindef for defaults
  - Page "type": "cc" or "nrpn" sets default for encoders

Example:
{
  "title": "My Synth",
  "instrument": "My Synth.oxiindef",
  "pages": [
    { "title": "Filter", "channel": 10, "type": "cc", "encoders": [
      {"abbr": "FREQ", "name": "Flt Freq", "cc": 16},
      {"abbr": "RESO", "name": "Flt Res", "cc": 17},
      {"abbr": "PAN", "name": "Pan", "cc": 89, "default": 64}
    ]}
  ]
}
`);
    process.exit(0);
  }

  const inputPath = args[0];
  const outputPath = args[1] || inputPath.replace(/\.json$/, '.oxie16');
  const basePath = path.dirname(path.resolve(inputPath));

  const input = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  const scene = buildScene(input, basePath);

  fs.writeFileSync(outputPath, JSON.stringify(scene));
  console.log(`Generated: ${outputPath}`);
}

// === Module exports for programmatic use ===

module.exports = {
  buildScene,
  buildPage,
  buildEncoder,
  buildTurnAction,
  buildPushAction,
  validateIcon,
  DISABLED_PUSH,
  DISABLED_TURN,
  DEFAULT_ICON
};

if (require.main === module) {
  main();
}
