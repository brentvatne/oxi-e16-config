---
name: oxi-e16
description: OXI E16 MIDI controller scene configuration. Use when creating, editing, or analyzing .oxie16 scene files for the OXI E16 controller. Handles MIDI CC, NRPN, and 14-bit mappings for synthesizers and other MIDI gear.
---

# OXI E16 Scene Configuration

Create and edit `.oxie16` scene files for the OXI E16 MIDI controller.

## File Format

Scene files are JSON with this structure:

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
  "bipolar": false,
  "push_action": {...},
  "turn_actions": [{primary}, {secondary}]
}
```

#### Color Values

10x10 palette (0-99), indexed left-to-right, top-to-bottom:
- 0-9: Blues, 10-19: Blues/Purples, 20-29: Violets
- 30-39: Purple/Brown, 40-49: Olive/Yellow, 50-59: Reds/Orange
- 60-69: Reds/Pink, 70-79: Magentas, 80-89: Cyans/Teal, 90-99: Greens

### Turn Action (MIDI Mapping)

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

Same structure as turn_action but different type values:

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
4. Set turn_actions[1] type to 0 if unused
5. Save as `.oxie16` file

## Template

See `references/scene-template.json` for a minimal starting template.

## Example: Elektron Digitone II

For NRPN-based synths like the Digitone II:
- Use `type: 9` for all mappings
- Set page `channel` to the track's MIDI channel
- Use `channel: 16` in turn_action for FX parameters (if FX channel = 16)
- NRPN addresses: `nr1` = LSB, `nr2` = MSB
