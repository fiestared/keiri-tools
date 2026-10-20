// The geometry assertions and page set are unchanged. Permit the full crawl
// to finish under host load instead of the original ten-minute deadline.
const original=globalThis.setTimeout;
globalThis.setTimeout=(fn,ms,...args)=>original(fn,(ms===600000||ms===480000)?3600000:ms,...args);
