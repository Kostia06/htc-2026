# Assets and licences

Everything the VR room ships that was not written for this repo.

| Asset | Where | Source | Licence |
|---|---|---|---|
| Interviewer avatar (`Business_Male_01`) | `public/avatars/interviewer.glb` | [Microsoft Rocketbox](https://github.com/microsoft/Microsoft-Rocketbox) | MIT — see `public/avatars/ATTRIBUTION.md` |
| Inter Regular | `public/fonts/Inter-Regular.woff` | [Inter](https://github.com/rsms/inter) | SIL Open Font License 1.1 |
| Inter SemiBold, Bold (latin subset) | `public/fonts/Inter-SemiBold.woff`, `Inter-Bold.woff` | [Inter](https://github.com/rsms/inter) via [@fontsource/inter 5.1.0](https://www.npmjs.com/package/@fontsource/inter) | SIL Open Font License 1.1 |
| Nunito ExtraBold (latin subset) | `public/fonts/Nunito-ExtraBold.woff` | [Nunito](https://github.com/googlefonts/nunito) via [@fontsource/nunito 5.1.0](https://www.npmjs.com/package/@fontsource/nunito) | SIL Open Font License 1.1 |
| Skillit mark | drawn from `docs/brand/skillit-logo.svg` (`src/theme/logo.js`) | this project | ours |
| Interview audio clips | `public/audio/` | rendered by `scripts/render-speech.mjs` | ours |
| Room textures (wood, carpet, walls, skyline, books, paintings) | generated at runtime on a canvas (`src/scene/textures.js`) | procedural | ours, no files shipped |
| Plants, furniture, panels, keys | built from three.js primitives in code | procedural | ours |

Inter stands in for SF Pro and Nunito for SF Rounded, the phone's fonts: Apple's
fonts cannot be redistributed in a web app.

Dev-only, not shipped in the production bundle: Meta's Immersive Web Emulator
Runtime, [`iwer`](https://github.com/meta-quest/immersive-web-emulation-runtime)
and `@iwer/devui` 2.8.0, MIT.
