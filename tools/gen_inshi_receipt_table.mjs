/** Compatibility entry: receipt HTML and XLSX share the same canonical JSON. */
import { execFileSync } from 'node:child_process';
const root = new URL('../', import.meta.url).pathname;
execFileSync('python3', ['tools/gen_print_tables.py', '--only', 'inshi', ...process.argv.slice(2)], { cwd: root, stdio: 'inherit' });
