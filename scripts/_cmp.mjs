// node _cmp.mjs a.png b.png → prints number of differing bytes
import fs from "node:fs";
import { decodePNG } from "./_png.mjs";
const [a, b] = process.argv.slice(2).map((f) => decodePNG(fs.readFileSync(f)));
let d = 0;
for (let i = 0; i < a.data.length; i++) if (a.data[i] !== b.data[i]) d++;
console.log(`${process.argv[2]}: ${a.width}x${a.height} diff bytes ${d}`);
