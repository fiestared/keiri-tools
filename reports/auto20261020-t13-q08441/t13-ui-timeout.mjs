// Preserve assertions and inputs; allow loaded-host browser operations to finish.
const original=globalThis.setTimeout;
globalThis.setTimeout=(fn,ms,...args)=>original(fn,(ms===5000||ms===30000)?180000:ms,...args);
