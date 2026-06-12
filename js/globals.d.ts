// Ambient declarations shared across the hand-authored TypeScript modules.
//
// The tasmee modules ship as classic browser scripts but also expose a CommonJS
// export (`module.exports = ...`) so they can be required from Node-based tests.
// `module` only exists under Node; in the browser the `typeof module !== 'undefined'`
// guard skips it. Declare it here so `tsc --noEmit` understands the guarded usage
// without pulling in the full `@types/node` surface.
declare const module: { exports: any } | undefined;
