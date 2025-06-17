import {TTokenGenerator} from './src/lib/pll.lib.ts';
const x: TTokenGenerator = function*(line){for(const ch of line){yield{kind:"char",str:ch}}return}