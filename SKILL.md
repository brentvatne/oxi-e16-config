---
name: oxi-e16
description: OXI E16 MIDI controller scene configuration. Use when creating, editing, or analyzing .oxie16 scene files for the OXI E16 controller. Handles MIDI CC, NRPN, and 14-bit mappings for synthesizers and other MIDI gear.
---

# OXI E16 Scene Configuration

Create and edit `.oxie16` scene files for the OXI E16 MIDI controller.

## File Format

Scene files are JSON with this structure.

### Title Length Limit

Scene titles truncate to ~7 characters on the E16 display. Use common abbreviations:

| Device | Abbreviation |
|--------|--------------|
| Digitone II | DN2 |
| Digitakt II | DT2 |
| Syntakt | SYN |
| Analog Four | A4 |
| Analog Rytm | AR |
| Octatrack | OT |
| Model:Cycles | MC |
| Model:Samples | MS |

### Elektron MIDI Channels

Elektron devices have special MIDI channels (configurable in device settings):

| Channel | Default | Purpose |
|---------|---------|---------|
| Auto Channel | 10 | Controls the currently selected/active track |
| FX Control | 9 | Controls global FX parameters (Delay, Reverb, Chorus) |
| Tracks 1-8 | 1-8 | Individual track control |

**Auto Channel** is useful for E16 scenes - instead of hardcoding track 1, use the auto channel so the controller follows your track selection on the device.

**FX Control Channel** controls the master FX block (delay/reverb parameters, not per-track sends). Per-track sends use the track's channel.

### Icon Format

Icons are 16×16 1-bit bitmaps stored as **exactly 32 bytes** (2 bytes per row):
- Byte 0 = pixels 0-7, Byte 1 = pixels 8-15
- Bit 7 = leftmost pixel in each byte (MSB = left)
- Row 0 at bytes 0-1, Row 1 at bytes 2-3, etc.

**CRITICAL:** Icon must be exactly 32 bytes or the scene will fail to load silently.

#### Designing Icons

To convert ASCII art to bytes:
```
Row: ##....## ○○○○....
     ││    ││ ││││
     Byte 0   Byte 1

##....## = 11000011 = 195
○○○○.... = 11110000 = 240
→ [195, 240]
```

#### Icon Ideas

| Style | Description |
|-------|-------------|
| Device face | Mini representation of the synth (screen, knobs, buttons) |
| Waveform | Sine wave, FM modulation, or other synthesis waveform |
| Text | Device abbreviation like "DN" + "II" (limited space) |
| Track grid | 8 squares representing tracks/pads |
| Knob | Single large encoder/knob icon |

#### Example: Sine Wave
```
[0,0,8,0,20,0,34,0,0,0,65,0,0,0,128,128,0,0,0,65,0,0,0,34,0,20,0,8,0,0,0,0]
```

#### Example: Device Face (Digitone II style)
```
[255,255,192,3,222,171,222,3,222,171,192,3,255,255,192,3,219,219,219,219,192,3,219,219,219,219,192,3,255,255,0,0]
```

```json
{
  "title": "Scene Name",
  "icon": [32 bytes],
  "selectedPreset": 0,
  "code": {"code": ""},
  "pages": [12 pages]
}
```

### Page Structure

```json
{
  "title": "Page Name",
  "output": 0,
  "channel": 1,
  "encoders": [16 encoders]
}
```

- `channel`: Default MIDI channel for the page (1-16)
- `output`: MIDI output (0 = default)

### Encoder Structure

```json
{
  "name": "Display Name (8 char max)",
  "abbr": "Abbr (4 char)",
  "color": 0,
  "push_action": {...},
  "turn_actions": [{primary}, {secondary}],
  "bipolar": false
}
```

**CRITICAL:** Field order matters! The `bipolar` field must come AFTER `turn_actions`, not before.

#### Color Values

10x10 palette (0-99), indexed left-to-right, top-to-bottom:
- 0-9: Blues, 10-19: Blues/Purples, 20-29: Violets
- 30-39: Purple/Brown, 40-49: Olive/Yellow, 50-59: Reds/Orange
- 60-69: Reds/Pink, 70-79: Magentas, 80-89: Cyans/Teal, 90-99: Greens

### Turn Action (MIDI Mapping)

**CRITICAL:** All action objects (push_action, turn_actions[0], turn_actions[1]) must include ALL fields. Do NOT use shorthand like `{"type": 0}` — the app will fail to load the scene silently.

```json
{
  "instrument": 127,
  "parameter": 0,
  "type": 9,
  "display": 10,
  "mode": 3,
  "channel": 0,
  "lower": 0,
  "upper": 127,
  "defaultValue": 0,
  "nr1": 73,
  "nr2": 1,
  "output": 12
}
```

**Disabled action template** (use this instead of `{"type": 0}`):
```json
{
  "instrument": 127,
  "parameter": 0,
  "type": 0,
  "display": 0,
  "mode": 0,
  "channel": 0,
  "lower": 0,
  "upper": 127,
  "defaultValue": 0,
  "nr1": 0,
  "nr2": 0,
  "output": 12
}
```

#### Type Values

| Type | Mode |
|------|------|
| 0 | OFF (disabled) |
| 1 | CC Rel 1 (relative) |
| 2 | CC Rel 2 (relative) |
| 3 | CC Abs (absolute) |
| 4 | CC14 (14-bit high res) |
| 5 | PC (Program Change) |
| 6 | PB (Pitch Bend) |
| 7 | AT (Aftertouch) |
| 8 | NOTE |
| 9 | NRPN |
| 10 | SNAPSHOT |

#### NRPN Fields

- `nr1`: **LSB** (CC#98 value)
- `nr2`: **MSB** (CC#99 value)

Example: NRPN MSB 1, LSB 73 → `nr1: 73, nr2: 1`

#### CC Fields

- `nr1`: CC number (0-127)
- `nr2`: 0 (unused)

#### Other Fields

| Field | Value | Meaning |
|-------|-------|---------|
| `channel` | 0 | Use page channel |
| `channel` | 1-16 | Override to specific channel |
| `lower` | 0 | Minimum value |
| `upper` | 127 | Maximum value (7-bit) |
| `upper` | 16383 | Maximum value (14-bit) |
| `display` | 10 | Standard display |
| `mode` | 3-7 | Acc0-Acc4 (acceleration modes) |
| `output` | 12 | Page (inherit from page) |
| `instrument` | 127 | Generic/custom |

#### Output Values

| Output | Value |
|--------|-------|
| ALL | 0 |
| TRS1 | 1 |
| TRS2 | 2 (likely) |
| USB1 | 3 (likely) |
| USB2 | 4 (likely) |
| USB3 | 5 |
| BLE | 6 |
| Page | 12 |
| ALL -BLE | 13 |
| ALL -USB | 14 |

#### Display Values

| Display | Value |
|---------|-------|
| OFF | 0 |
| 127 | 1 |
| 100 | 2 (likely) |
| 1000 | 3 |
| B63 | 4 |
| 9999 | 8 |
| Standard | 10 |
| High Res | 11 |

### Push Action (Encoder Press)

Same structure as turn_action but different type values. Note: push_action does NOT have `defaultValue` field.

**Disabled push_action template:**
```json
{
  "instrument": 127,
  "parameter": 0,
  "type": 0,
  "display": 0,
  "mode": 0,
  "channel": 0,
  "lower": 0,
  "upper": 127,
  "nr1": 0,
  "nr2": 0,
  "output": 12
}
```

| Type | Push Action |
|------|-------------|
| 0 | Off |
| 1 | Note |
| 2 | CC |
| 3 | PC (Program Change) |
| 4 | Set to Default |
| 5 | AT (Aftertouch) |
| 6 | Page |
| 7 | Record |
| 8 | Play/Pause Rec |

## Creating a Scene

1. Start with the base structure (12 pages, 16 encoders each)
2. Set page titles and channels
3. Configure each encoder's turn_actions[0] for primary mapping
4. For unused actions, use the full disabled action template (type: 0 with all fields)
5. Ensure field order in encoders: name, abbr, color, push_action, turn_actions, bipolar
6. Save as minified single-line JSON with `.oxie16` extension

**Common mistakes that cause silent load failures:**
- Using shorthand `{"type": 0}` instead of full action objects
- Wrong field order in encoder objects
- Missing required fields in any action object

## Scene Generator

Use `generate-scene.js` to create valid `.oxie16` files from compact input:

```bash
node generate-scene.js input.json output.oxie16
```

### Compact Input Format

Encoders use array format: `[abbr, name, msb, lsb, channel?]`

```json
{"title":"My Synth","pages":[
  {"title":"Osc","channel":1,"encoders":[
    ["TUN1","Osc1 Tune",1,73],
    ["WAV1","Osc1 Wave",1,74],
    ["FREQ","Filter",1,20,16]
  ]}
]}
```

- `channel` in array overrides page channel (use for FX params on ch16)
- Empty encoders auto-padded to 16 per page, 12 pages total
- All action objects fully populated with correct field order

## References

- `generate-scene.js` — Scene generator (compact JSON → .oxie16)
- `references/scene-schema.json` — Full JSON Schema for validation
- `references/scene-template.json` — Minimal starting template

## Elektron Abbreviation Conventions

Elektron devices use **UPPERCASE** 4-character abbreviations. Follow these conventions for consistency:

### Standard Parameters

| Parameter | Abbreviation |
|-----------|--------------|
| Tune | TUNE |
| Wave | WAV (or WAV1/WAV2) |
| Level | LEV (or LEV1/LEV2) |
| Frequency | FREQ |
| Resonance | RESO |
| Type | TYPE |
| Pan | PAN |
| Volume | VOL |
| Mix | MIX |

### Envelopes (ADSR/AHDR)

| Parameter | Filter | Amp |
|-----------|--------|-----|
| Attack | FATK | AATK |
| Decay | FDEC | ADEC |
| Sustain | FSUS | — |
| Hold | — | AHLD |
| Release | FREL | AREL |
| Env Depth | FENV | — |

### Effects

| Effect | Send | Time | Feedback | Mix | Other |
|--------|------|------|----------|-----|-------|
| Delay | DEL | DELT | DELF | DELM | — |
| Reverb | REV | — | — | REVM | REVP (PreDly), REVD (Decay) |
| Chorus | CHR | — | — | CHRM | CHRD (Depth), CHRS (Speed) |
| Overdrive | OVER | — | — | — | — |
| Bit Reduce | BR | — | — | — | — |
| Sample Rate | SRR | — | — | — | — |

### Numbered Parameters

Put numbers at the **end**, not the start:
- `TUN1`, `TUN2` (not `1TUN`)
- `WAV1`, `WAV2`
- `LEV1`, `LEV2`
- `LIN1`, `LIN2`
- `OFS1`, `OFS2` (offset)
- `TBL1`, `TBL2` (wavetable)

### LFO Parameters

| LFO 1 | LFO 2 | Parameter |
|-------|-------|-----------|
| SPD1 | SPD2 | Speed |
| MUL1 | MUL2 | Multiplier |
| FAD1 | FAD2 | Fade |
| DST1 | DST2 | Destination |
| WAV1 | WAV2 | Waveform |
| PHS1 | PHS2 | Phase |
| TRG1 | TRG2 | Trigger |
| DPT1 | DPT2 | Depth |

### Other Common

| Parameter | Abbreviation |
|-----------|--------------|
| Algorithm | ALGO |
| Harmonic | HARM |
| Detune | DETN |
| Feedback | FDBK |
| Drift | DRIF |
| Mode | MODE |
| Reset | RSET |
| Track Level | TLEV |
| Pattern Volume | PVOL |

## Example: Elektron Digitone II

For NRPN-based synths like the Digitone II:
- Use `type: 9` for all mappings
- Set page `channel` to the track's MIDI channel
- Use `channel: 16` in turn_action for FX parameters (if FX channel = 16)
- NRPN addresses: `nr1` = LSB, `nr2` = MSB

Sample page layout for Wavetone engine:
```
TUN1  WAV1  PD1   LEV1
TUN2  WAV2  PD2   LEV2
LIN1  LIN2  OMOD  DRIF
NATK  NDEC  NLEV  NCHR
```
