"use strict";
// compile.cmd.civet

import {
	undef, defined, notdefined, pass, OL, assert, croak,
	getCmdArgs, watchFiles, allFilesMatching,
	DBG, LOG, WARN, ERR,
	getCompilerGlobPattern, compileFile, TCompileResult,
	} from '../lib/utils.lib.ts'

const {_, w: watch} = getCmdArgs({
	_: `files to compile, as one of the following:
	'<stub>.lib'  - file <stub>.lib.<ext>
	'<stub>.cmd'  - file <stub>.cmd.<ext>
	'<stub>.lib.test'  - file <stub>.lib.test.<ext>
	'<stub>.cmd.test'  - file <stub>.cmd.test.<ext>
	- a full or relative file path
where <ext> is a valid extension to compile`,
	w:    "watch for and recompile files if they change"
	})

let numCompiled = 0

// ---------------------------------------------------------------------------

const logResult = (hResult: TCompileResult): void => {

	const {relPath, status, outPath} = hResult
	switch(status) {
		case 'compiled': {
			LOG(`COMPILED: ${OL(relPath)}`)
			numCompiled += 1;break;
		}
		case 'exists': {
			pass();break;
		}
		default: {
			ERR(`NOT COMPILED: ${OL(relPath)}`)
		}
	}
	return
}

// ---------------------------------------------------------------------------

if (_.length === 0) {
	const pattern = getCompilerGlobPattern()
	DBG("=====  Compiling all files  =====")
	DBG(`   pattern = ${OL(pattern)}`)
	for (const {path} of allFilesMatching(pattern)) {
		const hResult = compileFile(path)
		logResult(hResult)
	}
}

else {
	// --- Files can be specified as:
	//        - <stub>.(lib|cmd)
	//        - <stub>.(lib|cmd).test
	//        - a full or relative path
	//     Multiple files can be comma-separated

	for (const item of _) {const str: string = item;
		DBG(`non-option: ${OL(str)}`)
		for (const item1 of str.split(',')) {const str: string = item1;
			let ref;let ref1;if ((ref = str.match(/^([A-Za-z0-9_-]+)\.(lib|cmd)$/))) {const lMatches = ref;
				const [_, stub, purpose] = lMatches
				const pat = `**/${stub}.${purpose}.*`
				for (const {path} of allFilesMatching(pat)) {
					DBG(`compile file ${OL(path)}`)
					logResult(compileFile(path))
				}
			}
			else if ((ref1 = str.match(/^([A-Za-z0-9_-]+)\.(lib|cmd)\.test$/))) {const lMatches = ref1;
				const [_, stub, purpose] = lMatches
				const pat = `**/${stub}.${purpose}.test.*`
				for (const {path} of allFilesMatching(pat)) {
					DBG(`compile file ${OL(path)}`)
					logResult(compileFile(path))
				}
			}
			else {
				DBG(`compile file ${OL(str)}`)
				logResult(compileFile(str))
			}
		}
	}
}

LOG(`(${numCompiled} files compiled)`)

if (watch) {
	watchFiles(Deno.cwd(), ({kind, path}) => {
		console.log(`EVENT: ${kind} ${path}`)
		return false
	})
}

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3JjL2NtZC9jb21waWxlLmNtZC5jaXZldC50c3giLCJzb3VyY2VzIjpbInNyYy9jbWQvY29tcGlsZS5jbWQuY2l2ZXQiXSwibWFwcGluZ3MiOiI7QUFBQSxvQkFBbUI7QUFDbkIsQUFBQTtBQUNBLEFBQUEsTUFBTSxDQUFDLENBQUM7QUFDUixDQUFDLEtBQUssQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEtBQUssQ0FBQztBQUNyRCxDQUFDLFVBQVUsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDLGdCQUFnQixDQUFDO0FBQzFDLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDO0FBQ3JCLENBQUMsc0JBQXNCLENBQUMsQ0FBQyxXQUFXLENBQUMsQ0FBQyxjQUFjLENBQUM7QUFDckQsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLHFCQUFxQjtBQUM3QixBQUFBO0FBQ0EsQUFBQSxBQUFhLE1BQWIsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFFLENBQUMsVUFBVSxDQUFBLEFBQUMsQ0FBQztBQUM3QixBQUFBLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBRztBQUNQO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSwyQ0FFRSxDQUFHLENBQUE7QUFDTCxBQUFBLENBQUMsQ0FBQyxDQUFDLElBQUksOENBQThDO0FBQ3JELENBQUMsQ0FBQyxDQUFBO0FBQ0YsQUFBQTtBQUNBLEFBQUEsQUFBQSxHQUFHLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ25CLEFBQUE7QUFDQSxBQUFBLDhFQUE2RTtBQUM3RSxBQUFBO0FBQ0EsQUFBQSxBQUFTLE1BQVQsU0FBUyxDQUFDLENBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLGNBQWMsQ0FBQyxDQUFDLENB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Q3ZDLEFBQUEsS0FBSyxHQUFHLENBQUEsQUFBQyxDQUFDLGFBQWEsRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQ25DLEFBQUEsS0FBSyxTQUFTLENBQUEsQUFBQyxXQUFXLENBQUMsSUFBSSxDQUFDLEM7SUFBQSxDO0dBQUEsQ0FBQTtBQUNoQyxBQUFBLEdBQUcsSUFBSSxDQUFBLENBQUE7QUFDUCxBQUFBLElBQUksR0FBRyxDQUFBLEFBQUMsQ0FBQyxhQUFhLEVBQUUsRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUNqQyxBQUFBLElBQUksU0FBUyxDQUFBLEFBQUMsV0FBVyxDQUFDLEdBQUcsQ0FBQyxDO0dBQUEsQztFQUFBLEM7Q0FBQSxDO0FBQUEsQ0FBQTtBQUM5QixBQUFBO0FBQ0EsQUFBQSxBQUFBLEdBQUcsQ0FBQSxBQUFDLENBQUMsQ0FBQyxFQUFFLFdBQVcsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFBO0FBQ3JDLEFBQUE7QUFDQSxBQUFBLEFBQUEsR0FBRyxDQUFBLEtBQUssQ0FBQSxDQUFBLENBQUE7QUFDUixBQUFBLENBQUMsVUFBVSxDQUFBLEFBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUEsQ0FBQTtBQUN6QyxBQUFBLEVBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQSxBQUFDLENBQUMsT0FBTyxFQUFFLElBQUksQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQTtBQUN0QyxBQUFBLEVBQUUsTUFBTSxDQUFDLEs7Q0FBSyxDQUFBLEM7QUFBQSxDQUFBO0FBQ2QiLCJuYW1lcyI6W10sInNvdXJjZXNDb250ZW50IjpbIiMgY29tcGlsZS5jbWQuY2l2ZXRcblxuaW1wb3J0IHtcblx0dW5kZWYsIGRlZmluZWQsIG5vdGRlZmluZWQsIHBhc3MsIE9MLCBhc3NlcnQsIGNyb2FrLFxuXHRnZXRDbWRBcmdzLCB3YXRjaEZpbGVzLCBhbGxGaWxlc01hdGNoaW5nLFxuXHREQkcsIExPRywgV0FSTiwgRVJSLFxuXHRnZXRDb21waWxlckdsb2JQYXR0ZXJuLCBjb21waWxlRmlsZSwgVENvbXBpbGVSZXN1bHQsXG5cdH0gZnJvbSAnLi4vbGliL3V0aWxzLmxpYi50cydcblxue18sIHc6IHdhdGNofSA6PSBnZXRDbWRBcmdzIHtcblx0XzogXCJcIlwiXG5cdFx0ZmlsZXMgdG8gY29tcGlsZSwgYXMgb25lIG9mIHRoZSBmb2xsb3dpbmc6XG5cdFx0XHQnPHN0dWI+LmxpYicgIC0gZmlsZSA8c3R1Yj4ubGliLjxleHQ+XG5cdFx0XHQnPHN0dWI+LmNtZCcgIC0gZmlsZSA8c3R1Yj4uY21kLjxleHQ+XG5cdFx0XHQnPHN0dWI+LmxpYi50ZXN0JyAgLSBmaWxlIDxzdHViPi5saWIudGVzdC48ZXh0PlxuXHRcdFx0JzxzdHViPi5jbWQudGVzdCcgIC0gZmlsZSA8c3R1Yj4uY21kLnRlc3QuPGV4dD5cblx0XHRcdC0gYSBmdWxsIG9yIHJlbGF0aXZlIGZpbGUgcGF0aFxuXHRcdHdoZXJlIDxleHQ+IGlzIGEgdmFsaWQgZXh0ZW5zaW9uIHRvIGNvbXBpbGVcblx0XHRcIlwiXCJcblx0dzogICAgXCJ3YXRjaCBmb3IgYW5kIHJlY29tcGlsZSBmaWxlcyBpZiB0aGV5IGNoYW5nZVwiXG5cdH1cblxubGV0IG51bUNvbXBpbGVkID0gMFxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG5sb2dSZXN1bHQgOj0gKGhSZXN1bHQ6IFRDb21waWxlUmVzdWx0KTogdm9pZCA9PlxuXG5cdHtyZWxQYXRoLCBzdGF0dXMsIG91dFBhdGh9IDo9IGhSZXN1bHRcblx0c3dpdGNoIHN0YXR1c1xuXHRcdHdoZW4gJ2NvbXBpbGVkJ1xuXHRcdFx0TE9HIFwiQ09NUElMRUQ6ICN7T0wocmVsUGF0aCl9XCJcblx0XHRcdG51bUNvbXBpbGVkICs9IDFcblx0XHR3aGVuICdleGlzdHMnXG5cdFx0XHRwYXNzKClcblx0XHRlbHNlXG5cdFx0XHRFUlIgXCJOT1QgQ09NUElMRUQ6ICN7T0wocmVsUGF0aCl9XCJcblx0cmV0dXJuXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbmlmIChfLmxlbmd0aCA9PSAwKVxuXHRwYXR0ZXJuIDo9IGdldENvbXBpbGVyR2xvYlBhdHRlcm4oKVxuXHREQkcgXCI9PT09PSAgQ29tcGlsaW5nIGFsbCBmaWxlcyAgPT09PT1cIlxuXHREQkcgXCIgICBwYXR0ZXJuID0gI3tPTChwYXR0ZXJuKX1cIlxuXHRmb3Ige3BhdGh9IG9mIGFsbEZpbGVzTWF0Y2hpbmcocGF0dGVybilcblx0XHRoUmVzdWx0IDo9IGNvbXBpbGVGaWxlIHBhdGhcblx0XHRsb2dSZXN1bHQgaFJlc3VsdFxuXG5lbHNlXG5cdCMgLS0tIEZpbGVzIGNhbiBiZSBzcGVjaWZpZWQgYXM6XG5cdCMgICAgICAgIC0gPHN0dWI+LihsaWJ8Y21kKVxuXHQjICAgICAgICAtIDxzdHViPi4obGlifGNtZCkudGVzdFxuXHQjICAgICAgICAtIGEgZnVsbCBvciByZWxhdGl2ZSBwYXRoXG5cdCMgICAgIE11bHRpcGxlIGZpbGVzIGNhbiBiZSBjb21tYS1zZXBhcmF0ZWRcblxuXHRmb3Igc3RyOiBzdHJpbmcgb2YgX1xuXHRcdERCRyBcIm5vbi1vcHRpb246ICN7T0woc3RyKX1cIlxuXHRcdGZvciBzdHI6IHN0cmluZyBvZiBzdHIuc3BsaXQoJywnKVxuXHRcdFx0aWYgbE1hdGNoZXMgOj0gc3RyLm1hdGNoKC8vL15cblx0XHRcdFx0XHQoW0EtWmEtejAtOV8tXSspXG5cdFx0XHRcdFx0XFwuXG5cdFx0XHRcdFx0KGxpYnxjbWQpXG5cdFx0XHRcdFx0JC8vLylcblx0XHRcdFx0W18sIHN0dWIsIHB1cnBvc2VdIDo9IGxNYXRjaGVzXG5cdFx0XHRcdHBhdCA6PSBcIioqLyN7c3R1Yn0uI3twdXJwb3NlfS4qXCJcblx0XHRcdFx0Zm9yIHtwYXRofSBvZiBhbGxGaWxlc01hdGNoaW5nKHBhdClcblx0XHRcdFx0XHREQkcgXCJjb21waWxlIGZpbGUgI3tPTChwYXRoKX1cIlxuXHRcdFx0XHRcdGxvZ1Jlc3VsdCBjb21waWxlRmlsZShwYXRoKVxuXHRcdFx0ZWxzZSBpZiBsTWF0Y2hlcyA6PSBzdHIubWF0Y2goLy8vXlxuXHRcdFx0XHRcdChbQS1aYS16MC05Xy1dKylcblx0XHRcdFx0XHRcXC5cblx0XHRcdFx0XHQobGlifGNtZClcblx0XHRcdFx0XHRcXC5cblx0XHRcdFx0XHR0ZXN0XG5cdFx0XHRcdFx0JC8vLylcblx0XHRcdFx0W18sIHN0dWIsIHB1cnBvc2VdIDo9IGxNYXRjaGVzXG5cdFx0XHRcdHBhdCA6PSBcIioqLyN7c3R1Yn0uI3twdXJwb3NlfS50ZXN0LipcIlxuXHRcdFx0XHRmb3Ige3BhdGh9IG9mIGFsbEZpbGVzTWF0Y2hpbmcocGF0KVxuXHRcdFx0XHRcdERCRyBcImNvbXBpbGUgZmlsZSAje09MKHBhdGgpfVwiXG5cdFx0XHRcdFx0bG9nUmVzdWx0IGNvbXBpbGVGaWxlKHBhdGgpXG5cdFx0XHRlbHNlXG5cdFx0XHRcdERCRyBcImNvbXBpbGUgZmlsZSAje09MKHN0cil9XCJcblx0XHRcdFx0bG9nUmVzdWx0IGNvbXBpbGVGaWxlKHN0cilcblxuTE9HIFwiKCN7bnVtQ29tcGlsZWR9IGZpbGVzIGNvbXBpbGVkKVwiXG5cbmlmIHdhdGNoXG5cdHdhdGNoRmlsZXMgRGVuby5jd2QoKSwgKHtraW5kLCBwYXRofSkgPT5cblx0XHRjb25zb2xlLmxvZyBcIkVWRU5UOiAje2tpbmR9ICN7cGF0aH1cIlxuXHRcdHJldHVybiBmYWxzZVxuIl19