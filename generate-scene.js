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

// === Templates ===

const DISABLED_PUSH = {
  instrument: 127, parameter: 0, type: 0, display: 0, mode: 0,
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

function buildTurnAction(def) {
  if (!def || def.type === 'off') return DISABLED_TURN;

  const base = {
    instrument: 127,
    parameter: 0,
    display: def.display ?? 10,
    mode: def.mode ?? 3,
    channel: def.channel ?? 0,
    lower: def.lower ?? 0,
    upper: def.upper ?? 127,
    defaultValue: def.defaultValue ?? 0,
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

function buildEncoder(def, pageDefaults = {}) {
  // Compact array format: [abbr, name, msb, lsb, channel?]
  // Or even shorter: [abbr, msb, lsb] with name = abbr
  if (Array.isArray(def)) {
    const [abbr, arg2, arg3, arg4, arg5] = def;
    let name, msb, lsb, channel;

    if (typeof arg2 === 'string') {
      // [abbr, name, msb, lsb, channel?]
      [name, msb, lsb, channel] = [arg2, arg3, arg4, arg5];
    } else {
      // [abbr, msb, lsb, channel?]
      [name, msb, lsb, channel] = [abbr, arg2, arg3, arg4];
    }

    const type = pageDefaults.type ?? 'nrpn';
    return {
      name: name ?? "",
      abbr: abbr ?? "",
      color: 0,
      push_action: DISABLED_PUSH,
      turn_actions: [
        buildTurnAction({ type, msb, lsb, channel: channel ?? 0 }),
        DISABLED_TURN
      ],
      bipolar: false
    };
  }

  // Object format (original)
  return {
    name: def.name ?? "",
    abbr: def.abbr ?? "",
    color: def.color ?? 0,
    push_action: buildPushAction(def.push),
    turn_actions: [
      buildTurnAction(def.turn ?? def.primary),
      buildTurnAction(def.secondary)
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

function buildPage(def) {
  const pageDefaults = { type: def.type ?? 'nrpn' };
  const encoders = (def.encoders || []).map(e => buildEncoder(e, pageDefaults));
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

function buildScene(def) {
  const pages = (def.pages || []).map(buildPage);
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

Compact format (NRPN): [abbr, name, msb, lsb, channel?]
Shortest format:       [abbr, msb, lsb, channel?]  (name = abbr)

Example:
{
  "title": "My Synth",
  "pages": [
    { "title": "Osc", "channel": 1, "encoders": [
      ["O1Tn", "Osc1 Tune", 1, 73],
      ["O1Wv", "Osc1 Wave", 1, 74],
      ["FFreq", 1, 20, 16]
    ]}
  ]
}

Verbose format also supported - see source for details.
`);
    process.exit(0);
  }

  const inputPath = args[0];
  const outputPath = args[1] || inputPath.replace(/\.json$/, '.oxie16');

  const input = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  const scene = buildScene(input);

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
