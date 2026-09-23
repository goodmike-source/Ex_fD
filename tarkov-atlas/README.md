# Tarkov Atlas

An original, Russian-language offline Windows companion for Escape from Tarkov. This is a new desktop application, not a modified Tarkov MoA binary and not an affiliated TarkovHead app.

## Implemented in v0.1.0

- 11 offline vector maps, independently zoomable and draggable, with local artwork
- 517 localized quest records from a clearly dated, embedded 2026-08-27 snapshot
- Quest objectives from the snapshot rendered on compatible maps when coordinates are available
- Custom map pins with notes and per-map click-to-draw routes
- Manual quest completion with trader/map/Kappa filters
- Custom item checklists and manually tracked hideout module levels
- Screenshot-filename GPS from a user-selected EFT screenshots directory; never changes or deletes screenshot files
- Local progress saved as JSON under LOCALAPPDATA/Tarkov Atlas; import/export backups

## Limits (not a full TarkovHead clone)

No realtime flea-market prices, no automatic content updates, no squad sync, no multi-floor cartography, and no Icebreaker map image. Quest coordinates and descriptions reflect the embedded snapshot and may become outdated after game patches. GPS requires compatible screenshot filenames with XYZ and quaternion data, and **the current game map must be selected manually**.

## Build on Windows

1. Python 3.12: pip install pywebview pyinstaller
2. Place 11 licensed SVG assets under web/maps and the offline quest data under vendor/Tarkov-moa-0.9.0/data/snapshot.
3. Run python tools/build_data.py and python app.py --self-test
4. Build: pyinstaller --noconfirm --windowed --onedir --collect-all webview --hidden-import webview.platforms.edgechromium --add-data "web;web" --name TarkovAtlas app.py
5. Use installer.nsi with NSIS to build Setup.exe.

See GitHub Actions workflow for a reproducible asset-fetching build.

## Licenses and credits

App source: MIT, see LICENSE.
Unmodified SVG map artwork: [the-hideout/tarkov-dev-svg-maps](https://github.com/the-hideout/tarkov-dev-svg-maps), CC BY-NC-SA 4.0. Each shipped installer includes the license in web/maps/LICENSE.md and attribution.
Quest snapshot and map world-coordinate metadata: [mopocop/Tarkov-moa](https://github.com/mopocop/Tarkov-moa) (MIT), based on community tarkov.dev data. Dataset is frozen at 2026-08-27.

Not affiliated with or endorsed by Battlestate Games, TarkovHead, or the authors of the credited open-source datasets. Artwork is not licensed for commercial use.
