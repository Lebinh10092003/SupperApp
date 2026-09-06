export const safeId=(v:string)=>v.replace(/[^a-zA-Z0-9._-]/g,'_').slice(0,500);
