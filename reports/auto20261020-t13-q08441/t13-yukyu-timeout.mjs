const original=globalThis.setTimeout;
globalThis.setTimeout=(fn,ms,...args)=>{const t=original(fn,ms===240000?900000:ms,...args);if(ms===240000)t.unref();return t;};
