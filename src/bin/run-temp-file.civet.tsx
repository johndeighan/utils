// run-temp-file.civet

import {
	undef, getCmdArgs, assert, compileFile,
	DBG, LOG, isFile, execCmd,
	} from "../lib/llutils.js"

const {compile} = getCmdArgs(Deno.args, {
	hArgs: {
		c: {alias: 'compile'}
		},
	doSetLogger: true
	})

// ---------------------------------------------------------------------------

console.log("in run-temp-file")
if (compile) {
	await execCmd('compile')
}
else {
	compileFile(['test', 'temp'])
}

assert(isFile('test/temp.js'), "Compile of temp script failed")
const {code} = await execCmd('deno', [
	'run',
	'-A',
	'test/temp.js',
	...Deno.args
	])
DBG(`Final result code from temp file: ${code}`)
