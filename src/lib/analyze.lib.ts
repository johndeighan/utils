"use strict";
// analyze.lib.civet

import {
	undef, allLinesIn, LOG, LOGVALUE, DBG, OL, DBGVALUE, croak,
	defined, notdefined, isEmpty, nonEmpty, assert, words, hashof,
	hash, isHash, integer, TextTable, hasKey, hasKeys, allMatches,
	} from './utils.lib.ts'

// ---------------------------------------------------------------------------

export type symbolKind = 'const'|'var'|'function'|'type'|'interface'|'enum'|'class'

export const isSymbolKind = (x: any): x is symbolKind => {

	return ['const','var','function','type','interface','enum','class'].includes(x)
}

export type symbolDesc = {
	kind: symbolKind
	name: string
	guardFor?: string   // for functions
	numTests?: integer
	status?: string
	}

export const isSymbolDesc = (x: any): x is symbolDesc => {

	if (!isHash(x)) {
		return false
	}
	if (!hasKeys(x, 'name', 'kind', 'numTests')) {
		return false
	}
	return (x.numTests >= 0)
}

export type testDesc = {
	kind: symbolKind
	name: string
	numTests: integer
	}

// ---------------------------------------------------------------------------

/**
 * parses line that begins with 'export',
 * except 'export {' or 'export type {'
 * returns a symbolDesc
 */

export const parseExportLine = (
	line: string
	): (symbolDesc | undefined) => {

	if (line.match(/^export(?:\s+type)?\s*\{/)) {
		DBG(`ignoring line ${OL(line)}`)
		return undef
	}

	// --- check for functions
	let ref;let ref1;if ((ref = line.match(/^export\s+([A-Za-z][A-Za-z0-9_]*)\s*(?:\:\s*[A-Za-z][A-Za-z0-9_]*\s*)?(\:?\=)\s*\((.*)$/))) {const lMatches = ref;
		const [_, name, sym, rest] = lMatches
		if (sym === '=') {
			LOG(`WARNING: function ${name} uses '=', not ':='`)
		}
		let ref2;if ((ref2 = rest.match(/\sis\s([A-Za-z][A-Za-z0-9_]*(?:\[\])?)/))) {const lGuard = ref2;
			return {
				name,
				kind: 'function',
				guardFor: lGuard[1]
				}
		}
		else {
			return {
				name,
				kind: 'function'
				}
		}
	}

	else if ((ref1 = line.match(/^export\s+(?:(let|var|const|type|function|interface|enum|class)\s+)?([A-Za-z0-9_]+(?:\<[A-Za-z]+\>)?)(.*)$/))) {const lMatches = ref1;
		DBG(`LINE: ${OL(line)}`)
		const [_, knd, name, tail] = lMatches
		const kind = (
			  notdefined(knd) ? 'const'
			: (knd === 'let')  ? 'var'
			:                  knd
			)
		if (isSymbolKind(kind)) {
			const lTailMatches = tail.match(/\s*\:?\=\s*\(([A-Za-z0-9_]+)\:\s*any\):\s*([A-Za-z0-9_]+)\s+is\s+([A-Za-z0-9_]+(?:\[\])?)/)
			if (defined(lTailMatches)) {
				const [_, var1, var2, typeName] = lTailMatches
				assert((var1 === var2),
						"var name mismatch in type guard")
				DBG(`   EXPORT: ${OL(name)}, kind = ${kind}, guard = ${name}`)
				return {
					name,
					kind
					}
			}
			else {
				DBG(`   EXPORT: ${OL(name)}, kind = ${kind}`)
				return {
					name,
					kind
					}
			}
		}
		else {
			croak(`Bad kind: ${kind}`)
		}
	}
	else {
		return undef
	}
}

// ---------------------------------------------------------------------------
// ASYNC GENERATOR

/**
 * yields symbolDesc objects for a civet file
 */

export const allExportsIn = async function*(
		path: string
		): AsyncGenerator<symbolDesc,void,void> {

	DBG("CALL allExportsIn()")

	// --- There might be multiple lines like 'export function X'
	//     due to function overloading

	const setYielded = new Set()

	for await (const line of allLinesIn(path)) {
		const h = parseExportLine(line)
		if (defined(h) && !setYielded.has(h.name)) {
			yield h
			setYielded.add(h.name)
		}
	}
	return
}

// ---------------------------------------------------------------------------
// ASYNC GENERATOR

export const allUnitTestsIn = async function*(
		path: string
		): AsyncGenerator<testDesc,void,void> {

	let lCurSymbols: testDesc[] = []
	let lineNum = 0
	for await (const line of allLinesIn(path)) {
		lineNum += 1
		if (line.indexOf('DBG ') === 0) {

			DBG(`LINE: '${line}'`)

			// --- Yield all current symbols, then reset array
			for (const sym of lCurSymbols) {
				yield sym
			}
			lCurSymbols = []

			// --- process all quoted strings on line
			for (const [_, lq, desc, rq] of allMatches(line, /(["'])([^"']*)(["'])/)) {
				assert((lq === rq), "Mismatched quotes")
				DBGVALUE('desc', desc)
				const errMsg = `Bad unit test header ${OL(desc)} at ${path}:${lineNum}`
				const lMatches = desc.trim().match(/^(?:(type|const|interface|enum|class|function)\s+)?([A-Za-z0-9_]+)(\(.*\))?(\<T\>)?(.*)$/)
				DBGVALUE("lMatches", lMatches)
				if (defined(lMatches)) {
					const [_, knd, name, funcArgs, subTypes, rest] = lMatches
					assert(isEmpty(rest),
								`${errMsg} - nonempty rest`)
					if (isEmpty(funcArgs)) {
						assert(nonEmpty(knd),
								`${errMsg} - no kind or funcArgs`)
					}
					else {
						assert((isEmpty(knd) || (knd === 'function')),
								`${errMsg} - funcArgs + nonempty kind but not 'function'`)
					}
					const kind = knd || 'function'
					const fullName = defined(subTypes) ? `${name}<T>` : name
					if (isSymbolKind(kind)) {
						lCurSymbols.push({
							name: fullName,
							kind,
							numTests: 0
							})
					}
					else {
						croak(`Bad kind: ${kind}`)
					}
				}
				else {
					LOG(`${errMsg} - no match`)
				}
			}
		}
		else {
			let ref3;if ((ref3 = line.match(/\b(equal|truthy|falsy|fails|succeeds|matches|like|listLike|includes|includesAll|isType|notType)\b/))) {const lMatches2 = ref3;
				DBG(`      - unit test ${lMatches2[1]}`)
				for (const h of lCurSymbols) {
					h.numTests += 1
				}
			}
		}
	}

	// --- Yield any remaining symbols
	for (const sym of lCurSymbols) {
		yield sym
	}
	return
}

// ---------------------------------------------------------------------------

/**
 * Returns an array of symbolDesc objects, including:
 * 	- objects in lExports that don't appear in lTests
 * 		with status = 'missing'
 * 	- objects in lTests that don't appear in lExports
 * 		with status = 'extra'
 */

export const mergeAnalyses = (
		lExports: symbolDesc[],
		lTests: testDesc[]
		): symbolDesc[] => {

	// --- Keep track of all type guard names so we can
	//     remove those functions from the returned list

	const results=[];for (const sym of lExports) {
		const {name, kind} = sym

		// --- find the corresponding testDesc, if any

		const utsym = lTests.find((h) => (h.name === sym.name))
		if (defined(utsym)) {
			results.push(({
				name,
				kind,
				numTests: utsym.numTests,
				status: (utsym.numTests === 0) ? 'missing' : 'ok'
				}))
		}
		else {
			results.push(({
				name,
				kind,
				numTests: 0,
				status: 'missing'
				}))
		}
	};const lResult: symbolDesc[] =results

	// --- find tested symbols, not exported from library
	for (const sym of lTests) {
		const {name, kind, numTests} = sym
		const exsym = lExports.find((h) => (h.name === sym.name))
		if (notdefined(exsym)) {
			lResult.push({
				name,
				kind,
				numTests,
				status: 'extra'
				})
		}
	}

	// --- Filter out any functions which are type guards
	return lResult
}

// ---------------------------------------------------------------------------

/**
 * logs a table of number of unit tests for each symbol
 * returns number of missing tests
 */

export const dumpSymbols = (
		label: string,
		lSymbols: symbolDesc[]
		): integer => {

	const table = new TextTable('l l l r%d')
	table.title(label)
	table.fullsep()
	table.labels(['name','kind','guardFor','# tests'])
	table.sep()
	let numMissing = 0
	for (const {name, kind, guardFor, numTests} of lSymbols) {
		if (numTests === 0) {
			numMissing += 1
		}
		if (kind === 'function') {
			table.data([name, kind, guardFor, numTests || 'missing'])
		}
		else {
			table.data([name, kind, guardFor, numTests || 'missing'])
		}
	}
	console.log(table.asString())
	return numMissing
}

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3JjL2xpYi9hbmFseXplLmxpYi5jaXZldC50c3giLCJzb3VyY2VzIjpbInNyYy9saWIvYW5hbHl6ZS5saWIuY2l2ZXQiXSwibWFwcGluZ3MiOiI7QUFBQSxvQkFBbUI7QUFDbkIsQUFBQTtBQUNBLEFBQUEsTUFBTSxDQUFDLENBQUM7QUFDUixDQUFDLEtBQUssQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLEtBQUssQ0FBQztBQUM1RCxDQUFDLE9BQU8sQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLE1BQU0sQ0FBQztBQUMvRCxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLFVBQVUsQ0FBQztBQUMvRCxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsZ0JBQWdCO0FBQ3hCLEFBQUE7QUFDQSxBQUFBLDhFQUE2RTtBQUM3RSxBQUFBO0FBQ0EsQUFBQSxBQUFBLE1BQU0sQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLFVBQVUsQ0FBQyxNQUFNLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxPQUFPO0FBQ25GLEFBQUE7QUFDQSxBQUFBLEFBQUEsTUFBTSxDQUFhLE1BQVosWUFBWSxDQUFDLENBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFBLENBQUE7QUFDbkQsQUFBQTtBQUNBLEFBQUEsQ0FBQyxNQUFNLENBQUMsQ0FBQyxPQUFPLENBQUMsS0FBSyxD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Q0FBQyxDQUFDO0FBQ25CLEFBQUEsQ0FBQyxHQUFHLENBQUMsQ0FBQSxNQUFBLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsRUFBRSxDQUFDLFFBQVEsQ0FBQSxDQUFBLENBQUE7QUFDakQsQUFBQSxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsR0FBRSxDQUFDLENBQUMsQ0FBQyxDQUFBLENBQUE7QUFDcEIsQUFBQSxHQUFHLFVBQVUsQyxFQUFHLENBQUMsQztFQUFDLENBQUE7QUFDbEIsQUFBQSxFQUFFLEdBQUcsQ0FBQyxJQUFJLENBQUMsR0FBRSxDQUFDLFVBQVUsQ0FBQyxDQUFBLENBQUE7QUFDekIsQUFBQSxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUEsQUFBQyxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUMsU0FBUyxDQUFDLEM7RUFBQSxDQUFBO0FBQzNELEFBQUEsRUFBRSxJQUFJLENBQUEsQ0FBQTtBQUNOLEFBQUEsR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFBLEFBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDLFNBQVMsQ0FBQyxDO0VBQUEsQztDQUFBLENBQUE7QUFDM0QsQUFBQSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUEsQUFBQyxLQUFLLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQTtBQUM3QixBQUFBLENBQUMsTUFBTSxDQUFDLFU7QUFBVSxDQUFBO0FBQ2xCIiwibmFtZXMiOltdLCJzb3VyY2VzQ29udGVudCI6WyIjIGFuYWx5emUubGliLmNpdmV0XG5cbmltcG9ydCB7XG5cdHVuZGVmLCBhbGxMaW5lc0luLCBMT0csIExPR1ZBTFVFLCBEQkcsIE9MLCBEQkdWQUxVRSwgY3JvYWssXG5cdGRlZmluZWQsIG5vdGRlZmluZWQsIGlzRW1wdHksIG5vbkVtcHR5LCBhc3NlcnQsIHdvcmRzLCBoYXNob2YsXG5cdGhhc2gsIGlzSGFzaCwgaW50ZWdlciwgVGV4dFRhYmxlLCBoYXNLZXksIGhhc0tleXMsIGFsbE1hdGNoZXMsXG5cdH0gZnJvbSAnLi91dGlscy5saWIudHMnXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbmV4cG9ydCB0eXBlIHN5bWJvbEtpbmQgPSAnY29uc3QnfCd2YXInfCdmdW5jdGlvbid8J3R5cGUnfCdpbnRlcmZhY2UnfCdlbnVtJ3wnY2xhc3MnXG5cbmV4cG9ydCBpc1N5bWJvbEtpbmQgOj0gKHg6IGFueSk6IHggaXMgc3ltYm9sS2luZCA9PlxuXG5cdHJldHVybiBbJ2NvbnN0JywndmFyJywnZnVuY3Rpb24nLCd0eXBlJywnaW50ZXJmYWNlJywnZW51bScsJ2NsYXNzJ10uaW5jbHVkZXMoeClcblxuZXhwb3J0IHR5cGUgc3ltYm9sRGVzYyA9IHtcblx0a2luZDogc3ltYm9sS2luZFxuXHRuYW1lOiBzdHJpbmdcblx0Z3VhcmRGb3I/OiBzdHJpbmcgICAjIGZvciBmdW5jdGlvbnNcblx0bnVtVGVzdHM/OiBpbnRlZ2VyXG5cdHN0YXR1cz86IHN0cmluZ1xuXHR9XG5cbmV4cG9ydCBpc1N5bWJvbERlc2MgOj0gKHg6IGFueSk6IHggaXMgc3ltYm9sRGVzYyA9PlxuXG5cdGlmIG5vdCBpc0hhc2goeClcblx0XHRyZXR1cm4gZmFsc2Vcblx0aWYgbm90IGhhc0tleXMoeCwgJ25hbWUnLCAna2luZCcsICdudW1UZXN0cycpXG5cdFx0cmV0dXJuIGZhbHNlXG5cdHJldHVybiAoeC5udW1UZXN0cyA+PSAwKVxuXG5leHBvcnQgdHlwZSB0ZXN0RGVzYyA9IHtcblx0a2luZDogc3ltYm9sS2luZFxuXHRuYW1lOiBzdHJpbmdcblx0bnVtVGVzdHM6IGludGVnZXJcblx0fVxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKipcbiAqIHBhcnNlcyBsaW5lIHRoYXQgYmVnaW5zIHdpdGggJ2V4cG9ydCcsXG4gKiBleGNlcHQgJ2V4cG9ydCB7JyBvciAnZXhwb3J0IHR5cGUgeydcbiAqIHJldHVybnMgYSBzeW1ib2xEZXNjXG4gKi9cblxuZXhwb3J0IHBhcnNlRXhwb3J0TGluZSA6PSAoXG5cdGxpbmU6IHN0cmluZ1xuXHQpOiBzeW1ib2xEZXNjPyA9PlxuXG5cdGlmIGxpbmUubWF0Y2goLy8vXlxuXHRcdFx0ZXhwb3J0XG5cdFx0XHQoPzogXFxzKyB0eXBlKT9cblx0XHRcdFxccypcblx0XHRcdFxce1xuXHRcdFx0Ly8vKVxuXHRcdERCRyBcImlnbm9yaW5nIGxpbmUgI3tPTChsaW5lKX1cIlxuXHRcdHJldHVybiB1bmRlZlxuXG5cdCMgLS0tIGNoZWNrIGZvciBmdW5jdGlvbnNcblx0aWYgbE1hdGNoZXMgOj0gbGluZS5tYXRjaCgvLy9eXG5cdFx0XHRleHBvcnRcblx0XHRcdFxccytcblx0XHRcdChbQS1aYS16XVtBLVphLXowLTlfXSopXG5cdFx0XHRcXHMqXG5cdFx0XHQoPzpcblx0XHRcdFx0XFw6XG5cdFx0XHRcdFxccypcblx0XHRcdFx0W0EtWmEtel1bQS1aYS16MC05X10qXG5cdFx0XHRcdFxccypcblx0XHRcdFx0KT9cblx0XHRcdChcXDo/IFxcPSlcblx0XHRcdFxccypcblx0XHRcdFxcKFxuXHRcdFx0KC4qKVxuXHRcdFx0JC8vLylcblx0XHRbXywgbmFtZSwgc3ltLCByZXN0XSA6PSBsTWF0Y2hlc1xuXHRcdGlmIChzeW0gPT0gJz0nKVxuXHRcdFx0TE9HIFwiV0FSTklORzogZnVuY3Rpb24gI3tuYW1lfSB1c2VzICc9Jywgbm90ICc6PSdcIlxuXHRcdGlmIGxHdWFyZCA6PSByZXN0Lm1hdGNoKC8vL1xuXHRcdFx0XHRcXHNcblx0XHRcdFx0aXNcblx0XHRcdFx0XFxzXG5cdFx0XHRcdCggW0EtWmEtel1bQS1aYS16MC05X10qICg/OiBcXFsgXFxdKT8gKVxuXHRcdFx0XHQvLy8pXG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRuYW1lXG5cdFx0XHRcdGtpbmQ6ICdmdW5jdGlvbidcblx0XHRcdFx0Z3VhcmRGb3I6IGxHdWFyZFsxXVxuXHRcdFx0XHR9XG5cdFx0ZWxzZVxuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0bmFtZVxuXHRcdFx0XHRraW5kOiAnZnVuY3Rpb24nXG5cdFx0XHRcdH1cblxuXHRlbHNlIGlmIGxNYXRjaGVzIDo9IGxpbmUubWF0Y2goLy8vXlxuXHRcdFx0ZXhwb3J0ICAgICAgICAgICAgICMgdGhlIHdvcmQgJ2V4cG9ydCdcblx0XHRcdFxccysgICAgICAgICAgICAgICAgIyB3aGl0ZXNwYWNlXG5cdFx0XHQoPzpcblx0XHRcdFx0KGxldCB8IHZhciB8IGNvbnN0IHwgdHlwZSB8IGZ1bmN0aW9uIHwgaW50ZXJmYWNlIHwgZW51bSB8IGNsYXNzKVxuXHRcdFx0XHRcXHMrXG5cdFx0XHRcdCk/XG5cdFx0XHQoXG5cdFx0XHRcdFtBLVphLXowLTlfXSsgICAjIGFuIGlkZW50aWZpZXJcblx0XHRcdFx0KD86XG5cdFx0XHRcdFx0XFw8IFtBLVphLXpdKyBcXD5cblx0XHRcdFx0XHQpP1xuXHRcdFx0XHQpXG5cdFx0XHQoLiopXG5cdFx0XHQkLy8vKVxuXHRcdERCRyBcIkxJTkU6ICN7T0wobGluZSl9XCJcblx0XHRbXywga25kLCBuYW1lLCB0YWlsXSA6PSBsTWF0Y2hlc1xuXHRcdGtpbmQgOj0gKFxuXHRcdFx0ICBub3RkZWZpbmVkKGtuZCkgPyAnY29uc3QnXG5cdFx0XHQ6IChrbmQgPT0gJ2xldCcpICA/ICd2YXInXG5cdFx0XHQ6ICAgICAgICAgICAgICAgICAga25kXG5cdFx0XHQpXG5cdFx0aWYgaXNTeW1ib2xLaW5kKGtpbmQpXG5cdFx0XHRsVGFpbE1hdGNoZXMgOj0gdGFpbC5tYXRjaCgvLy9cblx0XHRcdFx0XHRcdFxccyogICAgICAgICAgICAgIyBvcHRpb25hbCB3aGl0ZXNwYWNlXG5cdFx0XHRcdFx0XHRcXDo/IFxcPSAgICAgICAgICAjIDo9XG5cdFx0XHRcdFx0XHRcXHMqICAgICAgICAgICAgICMgb3B0aW9uYWwgd2hpdGVzcGFjZVxuXHRcdFx0XHRcdFx0XFwoICAgICAgICAgICAgICAjIHN0YXJ0IG9mIGFyZyBsaXN0XG5cdFx0XHRcdFx0XHRcdChbQS1aYS16MC05X10rKVxuXHRcdFx0XHRcdFx0XHRcXDpcblx0XHRcdFx0XHRcdFx0XFxzKlxuXHRcdFx0XHRcdFx0XHRhbnlcblx0XHRcdFx0XHRcdFx0XFwpXG5cdFx0XHRcdFx0XHQ6XG5cdFx0XHRcdFx0XHRcXHMqXG5cdFx0XHRcdFx0XHQoW0EtWmEtejAtOV9dKylcblx0XHRcdFx0XHRcdFxccysgaXMgXFxzK1xuXHRcdFx0XHRcdFx0KCBbQS1aYS16MC05X10rICg/OiBcXFsgXFxdKT8gKVxuXHRcdFx0XHRcdFx0Ly8vKVxuXHRcdFx0aWYgZGVmaW5lZChsVGFpbE1hdGNoZXMpXG5cdFx0XHRcdFtfLCB2YXIxLCB2YXIyLCB0eXBlTmFtZV0gOj0gbFRhaWxNYXRjaGVzXG5cdFx0XHRcdGFzc2VydCAodmFyMSA9PSB2YXIyKSxcblx0XHRcdFx0XHRcdFwidmFyIG5hbWUgbWlzbWF0Y2ggaW4gdHlwZSBndWFyZFwiXG5cdFx0XHRcdERCRyBcIiAgIEVYUE9SVDogI3tPTChuYW1lKX0sIGtpbmQgPSAje2tpbmR9LCBndWFyZCA9ICN7bmFtZX1cIlxuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdG5hbWVcblx0XHRcdFx0XHRraW5kXG5cdFx0XHRcdFx0fVxuXHRcdFx0ZWxzZVxuXHRcdFx0XHREQkcgXCIgICBFWFBPUlQ6ICN7T0wobmFtZSl9LCBraW5kID0gI3traW5kfVwiXG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0bmFtZVxuXHRcdFx0XHRcdGtpbmRcblx0XHRcdFx0XHR9XG5cdFx0ZWxzZVxuXHRcdFx0Y3JvYWsgXCJCYWQga2luZDogI3traW5kfVwiXG5cdGVsc2Vcblx0XHRyZXR1cm4gdW5kZWZcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiMgQVNZTkMgR0VORVJBVE9SXG5cbi8qKlxuICogeWllbGRzIHN5bWJvbERlc2Mgb2JqZWN0cyBmb3IgYSBjaXZldCBmaWxlXG4gKi9cblxuZXhwb3J0IGFsbEV4cG9ydHNJbiA6PSAoXG5cdFx0cGF0aDogc3RyaW5nXG5cdFx0KTogQXN5bmNHZW5lcmF0b3I8c3ltYm9sRGVzYyx2b2lkLHZvaWQ+IC0+XG5cblx0REJHIFwiQ0FMTCBhbGxFeHBvcnRzSW4oKVwiXG5cblx0IyAtLS0gVGhlcmUgbWlnaHQgYmUgbXVsdGlwbGUgbGluZXMgbGlrZSAnZXhwb3J0IGZ1bmN0aW9uIFgnXG5cdCMgICAgIGR1ZSB0byBmdW5jdGlvbiBvdmVybG9hZGluZ1xuXG5cdHNldFlpZWxkZWQgOj0gbmV3IFNldCgpXG5cblx0Zm9yIGF3YWl0IGxpbmUgb2YgYWxsTGluZXNJbihwYXRoKVxuXHRcdGggOj0gcGFyc2VFeHBvcnRMaW5lKGxpbmUpXG5cdFx0aWYgZGVmaW5lZChoKSAmJiBub3Qgc2V0WWllbGRlZC5oYXMoaC5uYW1lKVxuXHRcdFx0eWllbGQgaFxuXHRcdFx0c2V0WWllbGRlZC5hZGQoaC5uYW1lKVxuXHRyZXR1cm5cblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiMgQVNZTkMgR0VORVJBVE9SXG5cbmV4cG9ydCBhbGxVbml0VGVzdHNJbiA6PSAoXG5cdFx0cGF0aDogc3RyaW5nXG5cdFx0KTogQXN5bmNHZW5lcmF0b3I8dGVzdERlc2Msdm9pZCx2b2lkPiAtPlxuXG5cdGxldCBsQ3VyU3ltYm9sczogdGVzdERlc2NbXSA9IFtdXG5cdGxldCBsaW5lTnVtID0gMFxuXHRmb3IgYXdhaXQgbGluZSBvZiBhbGxMaW5lc0luKHBhdGgpXG5cdFx0bGluZU51bSArPSAxXG5cdFx0aWYgKGxpbmUuaW5kZXhPZignREJHICcpID09IDApXG5cblx0XHRcdERCRyBcIkxJTkU6ICcje2xpbmV9J1wiXG5cblx0XHRcdCMgLS0tIFlpZWxkIGFsbCBjdXJyZW50IHN5bWJvbHMsIHRoZW4gcmVzZXQgYXJyYXlcblx0XHRcdGZvciBzeW0gb2YgbEN1clN5bWJvbHNcblx0XHRcdFx0eWllbGQgc3ltXG5cdFx0XHRsQ3VyU3ltYm9scyA9IFtdXG5cblx0XHRcdCMgLS0tIHByb2Nlc3MgYWxsIHF1b3RlZCBzdHJpbmdzIG9uIGxpbmVcblx0XHRcdGZvciBbXywgbHEsIGRlc2MsIHJxXSBvZiBhbGxNYXRjaGVzKGxpbmUsIC8vL1xuXHRcdFx0XHRcdChbXCInXSlcblx0XHRcdFx0XHQoW15cIiddKilcblx0XHRcdFx0XHQoW1wiJ10pXG5cdFx0XHRcdFx0Ly8vKVxuXHRcdFx0XHRhc3NlcnQgKGxxID09IHJxKSwgXCJNaXNtYXRjaGVkIHF1b3Rlc1wiXG5cdFx0XHRcdERCR1ZBTFVFICdkZXNjJywgZGVzY1xuXHRcdFx0XHRlcnJNc2cgOj0gXCJCYWQgdW5pdCB0ZXN0IGhlYWRlciAje09MKGRlc2MpfSBhdCAje3BhdGh9OiN7bGluZU51bX1cIlxuXHRcdFx0XHRsTWF0Y2hlcyA6PSBkZXNjLnRyaW0oKS5tYXRjaCgvLy9eXG5cdFx0XHRcdFx0XHQoPzpcblx0XHRcdFx0XHRcdFx0KFxuXHRcdFx0XHRcdFx0XHRcdCAgdHlwZVxuXHRcdFx0XHRcdFx0XHRcdHwgY29uc3Rcblx0XHRcdFx0XHRcdFx0XHR8IGludGVyZmFjZVxuXHRcdFx0XHRcdFx0XHRcdHwgZW51bVxuXHRcdFx0XHRcdFx0XHRcdHwgY2xhc3Ncblx0XHRcdFx0XHRcdFx0XHR8IGZ1bmN0aW9uXG5cdFx0XHRcdFx0XHRcdFx0KVxuXHRcdFx0XHRcdFx0XHRcXHMrXG5cdFx0XHRcdFx0XHRcdCk/XG5cdFx0XHRcdFx0XHQoW0EtWmEtejAtOV9dKykgICAjIGFuIGlkZW50aWZpZXJcblx0XHRcdFx0XHRcdChcblx0XHRcdFx0XHRcdFx0XFwoICAgICAgICAgICAgICMgYXJndW1lbnQgbGlzdFxuXHRcdFx0XHRcdFx0XHQuKlxuXHRcdFx0XHRcdFx0XHRcXClcblx0XHRcdFx0XHRcdFx0KT9cblx0XHRcdFx0XHRcdChcblx0XHRcdFx0XHRcdFx0XFw8ICAgICAgICAgICAgICMgc3VidHlwZXNcblx0XHRcdFx0XHRcdFx0VFxuXHRcdFx0XHRcdFx0XHRcXD5cblx0XHRcdFx0XHRcdFx0KT9cblx0XHRcdFx0XHRcdCguKilcblx0XHRcdFx0XHRcdCQvLy8pXG5cdFx0XHRcdERCR1ZBTFVFIFwibE1hdGNoZXNcIiwgbE1hdGNoZXNcblx0XHRcdFx0aWYgZGVmaW5lZChsTWF0Y2hlcylcblx0XHRcdFx0XHRbXywga25kLCBuYW1lLCBmdW5jQXJncywgc3ViVHlwZXMsIHJlc3RdIDo9IGxNYXRjaGVzXG5cdFx0XHRcdFx0YXNzZXJ0IGlzRW1wdHkocmVzdCksXG5cdFx0XHRcdFx0XHRcdFx0XCIje2Vyck1zZ30gLSBub25lbXB0eSByZXN0XCJcblx0XHRcdFx0XHRpZiBpc0VtcHR5KGZ1bmNBcmdzKVxuXHRcdFx0XHRcdFx0YXNzZXJ0IG5vbkVtcHR5KGtuZCksXG5cdFx0XHRcdFx0XHRcdFx0XCIje2Vyck1zZ30gLSBubyBraW5kIG9yIGZ1bmNBcmdzXCJcblx0XHRcdFx0XHRlbHNlXG5cdFx0XHRcdFx0XHRhc3NlcnQgKGlzRW1wdHkoa25kKSB8fCAoa25kID09ICdmdW5jdGlvbicpKSxcblx0XHRcdFx0XHRcdFx0XHRcIiN7ZXJyTXNnfSAtIGZ1bmNBcmdzICsgbm9uZW1wdHkga2luZCBidXQgbm90ICdmdW5jdGlvbidcIlxuXHRcdFx0XHRcdGtpbmQgOj0ga25kIHx8ICdmdW5jdGlvbidcblx0XHRcdFx0XHRmdWxsTmFtZSA6PSBkZWZpbmVkKHN1YlR5cGVzKSA/IFwiI3tuYW1lfTxUPlwiIDogbmFtZVxuXHRcdFx0XHRcdGlmIGlzU3ltYm9sS2luZChraW5kKVxuXHRcdFx0XHRcdFx0bEN1clN5bWJvbHMucHVzaCB7XG5cdFx0XHRcdFx0XHRcdG5hbWU6IGZ1bGxOYW1lXG5cdFx0XHRcdFx0XHRcdGtpbmRcblx0XHRcdFx0XHRcdFx0bnVtVGVzdHM6IDBcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGVsc2Vcblx0XHRcdFx0XHRcdGNyb2FrIFwiQmFkIGtpbmQ6ICN7a2luZH1cIlxuXHRcdFx0XHRlbHNlXG5cdFx0XHRcdFx0TE9HIFwiI3tlcnJNc2d9IC0gbm8gbWF0Y2hcIlxuXHRcdGVsc2Vcblx0XHRcdGlmIGxNYXRjaGVzMiA6PSBsaW5lLm1hdGNoKC8vL1xuXHRcdFx0XHRcdFxcYlxuXHRcdFx0XHRcdChcblx0XHRcdFx0XHRcdCAgZXF1YWxcblx0XHRcdFx0XHRcdHwgdHJ1dGh5XG5cdFx0XHRcdFx0XHR8IGZhbHN5XG5cdFx0XHRcdFx0XHR8IGZhaWxzXG5cdFx0XHRcdFx0XHR8IHN1Y2NlZWRzXG5cdFx0XHRcdFx0XHR8IG1hdGNoZXNcblx0XHRcdFx0XHRcdHwgbGlrZVxuXHRcdFx0XHRcdFx0fCBsaXN0TGlrZVxuXHRcdFx0XHRcdFx0fCBpbmNsdWRlc1xuXHRcdFx0XHRcdFx0fCBpbmNsdWRlc0FsbFxuXHRcdFx0XHRcdFx0fCBpc1R5cGVcblx0XHRcdFx0XHRcdHwgbm90VHlwZVxuXHRcdFx0XHRcdFx0KVxuXHRcdFx0XHRcdFxcYlxuXHRcdFx0XHRcdC8vLylcblx0XHRcdFx0REJHIFwiICAgICAgLSB1bml0IHRlc3QgI3tsTWF0Y2hlczJbMV19XCJcblx0XHRcdFx0Zm9yIGggb2YgbEN1clN5bWJvbHNcblx0XHRcdFx0XHRoLm51bVRlc3RzICs9IDFcblxuXHQjIC0tLSBZaWVsZCBhbnkgcmVtYWluaW5nIHN5bWJvbHNcblx0Zm9yIHN5bSBvZiBsQ3VyU3ltYm9sc1xuXHRcdHlpZWxkIHN5bVxuXHRyZXR1cm5cblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuLyoqXG4gKiBSZXR1cm5zIGFuIGFycmF5IG9mIHN5bWJvbERlc2Mgb2JqZWN0cywgaW5jbHVkaW5nOlxuICogXHQtIG9iamVjdHMgaW4gbEV4cG9ydHMgdGhhdCBkb24ndCBhcHBlYXIgaW4gbFRlc3RzXG4gKiBcdFx0d2l0aCBzdGF0dXMgPSAnbWlzc2luZydcbiAqIFx0LSBvYmplY3RzIGluIGxUZXN0cyB0aGF0IGRvbid0IGFwcGVhciBpbiBsRXhwb3J0c1xuICogXHRcdHdpdGggc3RhdHVzID0gJ2V4dHJhJ1xuICovXG5cbmV4cG9ydCBtZXJnZUFuYWx5c2VzIDo9IChcblx0XHRsRXhwb3J0czogc3ltYm9sRGVzY1tdLFxuXHRcdGxUZXN0czogdGVzdERlc2NbXVxuXHRcdCk6IHN5bWJvbERlc2NbXSA9PlxuXG5cdCMgLS0tIEtlZXAgdHJhY2sgb2YgYWxsIHR5cGUgZ3VhcmQgbmFtZXMgc28gd2UgY2FuXG5cdCMgICAgIHJlbW92ZSB0aG9zZSBmdW5jdGlvbnMgZnJvbSB0aGUgcmV0dXJuZWQgbGlzdFxuXG5cdGxSZXN1bHQ6IHN5bWJvbERlc2NbXSA6PSBmb3Igc3ltIG9mIGxFeHBvcnRzXG5cdFx0e25hbWUsIGtpbmR9IDo9IHN5bVxuXG5cdFx0IyAtLS0gZmluZCB0aGUgY29ycmVzcG9uZGluZyB0ZXN0RGVzYywgaWYgYW55XG5cblx0XHR1dHN5bSA6PSBsVGVzdHMuZmluZCgoaCkgPT4gKGgubmFtZSA9PSBzeW0ubmFtZSkpXG5cdFx0aWYgZGVmaW5lZCh1dHN5bSlcblx0XHRcdHtcblx0XHRcdFx0bmFtZVxuXHRcdFx0XHRraW5kXG5cdFx0XHRcdG51bVRlc3RzOiB1dHN5bS5udW1UZXN0c1xuXHRcdFx0XHRzdGF0dXM6ICh1dHN5bS5udW1UZXN0cyA9PSAwKSA/ICdtaXNzaW5nJyA6ICdvaydcblx0XHRcdFx0fVxuXHRcdGVsc2Vcblx0XHRcdHtcblx0XHRcdFx0bmFtZVxuXHRcdFx0XHRraW5kXG5cdFx0XHRcdG51bVRlc3RzOiAwXG5cdFx0XHRcdHN0YXR1czogJ21pc3NpbmcnXG5cdFx0XHRcdH1cblxuXHQjIC0tLSBmaW5kIHRlc3RlZCBzeW1ib2xzLCBub3QgZXhwb3J0ZWQgZnJvbSBsaWJyYXJ5XG5cdGZvciBzeW0gb2YgbFRlc3RzXG5cdFx0e25hbWUsIGtpbmQsIG51bVRlc3RzfSA6PSBzeW1cblx0XHRleHN5bSA6PSBsRXhwb3J0cy5maW5kKChoKSA9PiAoaC5uYW1lID09IHN5bS5uYW1lKSlcblx0XHRpZiBub3RkZWZpbmVkKGV4c3ltKVxuXHRcdFx0bFJlc3VsdC5wdXNoIHtcblx0XHRcdFx0bmFtZVxuXHRcdFx0XHRraW5kXG5cdFx0XHRcdG51bVRlc3RzXG5cdFx0XHRcdHN0YXR1czogJ2V4dHJhJ1xuXHRcdFx0XHR9XG5cblx0IyAtLS0gRmlsdGVyIG91dCBhbnkgZnVuY3Rpb25zIHdoaWNoIGFyZSB0eXBlIGd1YXJkc1xuXHRyZXR1cm4gbFJlc3VsdFxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKipcbiAqIGxvZ3MgYSB0YWJsZSBvZiBudW1iZXIgb2YgdW5pdCB0ZXN0cyBmb3IgZWFjaCBzeW1ib2xcbiAqIHJldHVybnMgbnVtYmVyIG9mIG1pc3NpbmcgdGVzdHNcbiAqL1xuXG5leHBvcnQgZHVtcFN5bWJvbHMgOj0gKFxuXHRcdGxhYmVsOiBzdHJpbmcsXG5cdFx0bFN5bWJvbHM6IHN5bWJvbERlc2NbXVxuXHRcdCk6IGludGVnZXIgPT5cblxuXHR0YWJsZSA6PSBuZXcgVGV4dFRhYmxlKCdsIGwgbCByJWQnKVxuXHR0YWJsZS50aXRsZSBsYWJlbFxuXHR0YWJsZS5mdWxsc2VwKClcblx0dGFibGUubGFiZWxzIFsnbmFtZScsJ2tpbmQnLCdndWFyZEZvcicsJyMgdGVzdHMnXVxuXHR0YWJsZS5zZXAoKVxuXHRsZXQgbnVtTWlzc2luZyA9IDBcblx0Zm9yIHtuYW1lLCBraW5kLCBndWFyZEZvciwgbnVtVGVzdHN9IG9mIGxTeW1ib2xzXG5cdFx0aWYgKG51bVRlc3RzID09IDApXG5cdFx0XHRudW1NaXNzaW5nICs9IDFcblx0XHRpZiAoa2luZCA9PSAnZnVuY3Rpb24nKVxuXHRcdFx0dGFibGUuZGF0YSBbbmFtZSwga2luZCwgZ3VhcmRGb3IsIG51bVRlc3RzIHx8ICdtaXNzaW5nJ11cblx0XHRlbHNlXG5cdFx0XHR0YWJsZS5kYXRhIFtuYW1lLCBraW5kLCBndWFyZEZvciwgbnVtVGVzdHMgfHwgJ21pc3NpbmcnXVxuXHRjb25zb2xlLmxvZyB0YWJsZS5hc1N0cmluZygpXG5cdHJldHVybiBudW1NaXNzaW5nXG4iXX0=