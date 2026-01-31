# OXI E16 Configuration

A Claude skill for creating and editing `.oxie16` scene files for the [OXI E16](https://oxiinstruments.com/e16/) MIDI controller.

## What it does

This skill teaches Claude how to work with OXI E16 scene files, enabling you to:

- Create new scenes from scratch with custom encoder mappings
- Edit existing `.oxie16` files
- Configure MIDI CC, NRPN, and 14-bit parameter mappings
- Set up pages and encoders for specific synthesizers

The skill includes detailed documentation about the `.oxie16` file format, including encoder types, color palettes, NRPN addressing, and output routing.

## Installation

```bash
npx skills add brentvatne/oxi-e16-config -g
```

## Usage

Once installed, Claude will automatically use this skill when you ask it to create or edit OXI E16 scenes. For example:

- "Create an OXI E16 scene for my Digitone II"
- "Add a page for filter controls with NRPN mappings"
- "Change encoder 3 to control CC 74 on channel 2"

## What's included

- `skills/oxi-e16/SKILL.md` - Complete documentation of the `.oxie16` file format
- `skills/oxi-e16/references/scene-template.json` - Minimal starting template
- `skills/oxi-e16/references/scene-schema.json` - JSON schema for validation

## License

MIT
