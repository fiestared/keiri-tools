import {execFileSync} from 'node:child_process';
import {ROOT} from './layout/browser.mjs';
execFileSync(process.execPath,['tools/gen_layout_markup.mjs','--check'],{cwd:ROOT,stdio:'inherit'});
