"use strict";
// symbols.lib.civet

import {
	undef, defined, notdefined, assert,
	hash, hashof, nonEmpty,
	} from './datatypes.lib.ts'
import {
	pass, OL, ML, croak, o, getOptions, hasKey, keys,
	} from './llutils.lib.ts'
import {LOG, DBG, DBGVALUE} from './logger.lib.ts'
import {resetOneIndent} from './indent.lib.ts'
import {
	Token, TTokenGenerator, allTokensInBlock,
	} from './tokens.lib.ts'
import {isFile, slurp} from './fs.lib.ts'

/**
 * @module symbols - locate common symbols
 *    parses a file (default: src/.symbols) that looks like:
 *       src/lib/indent.lib.ts
 *          oneIndent resetOneIndent indentLevel
 *          lineDesc splitLine indented
 *       src/lib/fs.lib.ts
 *          isFile isDir
 *          fileExt withExt
 *
 *    and implements function:
 *       sourceLib := (symbol: string): string?
 */

// --- not exported!
let hSymbols: hashof<string> = {}     // --- {<sym>: <lib>, ...}

// ---------------------------------------------------------------------------

export const loadSymbols = (
		strSymbols: string,
		hOptions: hash={}
		): hashof<string> => {

	// --- Check if libraries actually exist
	const {checkFiles} = getOptions(hOptions, {
		checkFiles: false
		})

	let level = 0   // --- symGen must know the current level

	const symGen: TTokenGenerator = function*(line: string) {

		if (level === 0) {
			yield {kind: 'lib', str: line}
		}
		else if (level === 1) {
			for (const str of line.split(/\s+/)) {
				yield {kind: 'symbol', str}
			}
		}
		else {
			croak(`level = ${level}`)
		}
		return
	}

	const hSymbols: hashof<string> = {}  // --- {<symbol>: <lib>, ...}
	let curLib: (string | undefined) = undef
	for (const {kind, str} of allTokensInBlock(strSymbols, symGen)) {
		switch(kind) {
			case 'indent': {
				level += 1;break;
			}
			case 'undent': {
				level -= 1;break;
			}
			case 'lib': {
				curLib = str;break;
			}
			case 'symbol':case 'guard': {
				assert(defined(str), "undefined str!")
				if (level === 0) {
					if (checkFiles) {
						assert(isFile(str), `No such file: ${str}`)
					}
					curLib = str
				}
				else if (defined(curLib)) {
					DBG(`ADD ${str} from ${curLib}`)
					hSymbols[str] = curLib
				}
				else {
					croak("curLib empty at level > 0")
				};break;
			}
			default: {
				croak(`Unknown kind: ${kind}`)
			}
		}
	}
	resetOneIndent()
	return hSymbols
}

// ---------------------------------------------------------------------------

export const sourceLib = (
		symbol: string,
		h: hashof<string>=hSymbols
		): string => {

	return h[symbol]
}

// ---------------------------------------------------------------------------

export const libsAndSymbols = (
		lSymbols: string[]
		): hashof<string[]> => {

	const hLibs: hashof<string[]> = {}
	for (const sym of lSymbols) {
		const srcLib = sourceLib(sym)
		if (defined(srcLib)) {
			if (hasKey(hLibs, srcLib)) {
				hLibs[srcLib].push(sym)
			}
			else {
				hLibs[srcLib] = [sym]
			}
		}
	}
	return hLibs
}

// ---------------------------------------------------------------------------

export const getNeededImportStmts = (
		lSymbols: string[]
		): string[] => {

	DBG(`CALL getNeededImportStmts(${OL(lSymbols)})`)
	const hLibs = libsAndSymbols(lSymbols)
	DBGVALUE('hLibs', hLibs)
	const results=[];for (const lib of keys(hLibs)) {
		const lSyms = hLibs[lib]
		const strSyms = lSyms.join(', ')
		if (lib.match(/^[A-Za-z][A-Za-z0-9_]*$/)) {
			results.push(`import {${strSyms}} from '${lib}';`)
		}
		else if (lib.match(/^[\@\.\/]/)) {
			results.push(`import {${strSyms}} from '${lib}';`)
		}
		else {
			results.push(`import {${strSyms}} from './${lib}';`)
		}
	};const lStmts =results
	return lStmts
}

// ---------------------------------------------------------------------------

if (isFile('src/.symbols')) {
	const contents = slurp('src/.symbols')
	hSymbols = loadSymbols(contents, o`checkFiles`)
}

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3JjL2xpYi9zeW1ib2xzLmxpYi5jaXZldC50c3giLCJzb3VyY2VzIjpbInNyYy9saWIvc3ltYm9scy5saWIuY2l2ZXQiXSwibWFwcGluZ3MiOiI7QUFBQSxvQkFBbUI7QUFDbkIsQUFBQTtBQUNBLEFBQUEsTUFBTSxDQUFDLENBQUM7QUFDUixDQUFDLEtBQUssQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDLE1BQU0sQ0FBQztBQUNwQyxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLFFBQVEsQ0FBQztBQUN4QixDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsb0JBQW9CO0FBQzVCLEFBQUEsQUFBQSxNQUFNLENBQUMsQ0FBQztBQUNSLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsSUFBSSxDQUFDO0FBQ2xELENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxrQkFBa0I7QUFDMUIsQUFBQSxBQUFBLE1BQU0sQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLElBQUksQ0FBQyxpQkFBaUI7QUFDbEQsQUFBQSxBQUFBLE1BQU0sQ0FBQyxDQUFDLGNBQWMsQ0FBQyxDQUFDLElBQUksQ0FBQyxpQkFBaUI7QUFDOUMsQUFBQSxBQUFBLE1BQU0sQ0FBQyxDQUFDO0FBQ1IsQ0FBQyxLQUFLLENBQUMsQ0FBQyxlQUFlLENBQUMsQ0FBQyxnQkFBZ0IsQ0FBQztBQUMxQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsaUJBQWlCO0FBQ3pCLEFBQUEsQUFBQSxNQUFNLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLENBQUMsYUFBYTtBQUN6QyxBQUFBO0FBQ0EsQUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7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QyxDQUFBO0FBQ2hEIiwibmFtZXMiOltdLCJzb3VyY2VzQ29udGVudCI6WyIjIHN5bWJvbHMubGliLmNpdmV0XHJcblxyXG5pbXBvcnQge1xyXG5cdHVuZGVmLCBkZWZpbmVkLCBub3RkZWZpbmVkLCBhc3NlcnQsXHJcblx0aGFzaCwgaGFzaG9mLCBub25FbXB0eSxcclxuXHR9IGZyb20gJy4vZGF0YXR5cGVzLmxpYi50cydcclxuaW1wb3J0IHtcclxuXHRwYXNzLCBPTCwgTUwsIGNyb2FrLCBvLCBnZXRPcHRpb25zLCBoYXNLZXksIGtleXMsXHJcblx0fSBmcm9tICcuL2xsdXRpbHMubGliLnRzJ1xyXG5pbXBvcnQge0xPRywgREJHLCBEQkdWQUxVRX0gZnJvbSAnLi9sb2dnZXIubGliLnRzJ1xyXG5pbXBvcnQge3Jlc2V0T25lSW5kZW50fSBmcm9tICcuL2luZGVudC5saWIudHMnXHJcbmltcG9ydCB7XHJcblx0VG9rZW4sIFRUb2tlbkdlbmVyYXRvciwgYWxsVG9rZW5zSW5CbG9jayxcclxuXHR9IGZyb20gJy4vdG9rZW5zLmxpYi50cydcclxuaW1wb3J0IHtpc0ZpbGUsIHNsdXJwfSBmcm9tICcuL2ZzLmxpYi50cydcclxuXHJcbi8qKlxyXG4gKiBAbW9kdWxlIHN5bWJvbHMgLSBsb2NhdGUgY29tbW9uIHN5bWJvbHNcclxuICogICAgcGFyc2VzIGEgZmlsZSAoZGVmYXVsdDogc3JjLy5zeW1ib2xzKSB0aGF0IGxvb2tzIGxpa2U6XHJcbiAqICAgICAgIHNyYy9saWIvaW5kZW50LmxpYi50c1xyXG4gKiAgICAgICAgICBvbmVJbmRlbnQgcmVzZXRPbmVJbmRlbnQgaW5kZW50TGV2ZWxcclxuICogICAgICAgICAgbGluZURlc2Mgc3BsaXRMaW5lIGluZGVudGVkXHJcbiAqICAgICAgIHNyYy9saWIvZnMubGliLnRzXHJcbiAqICAgICAgICAgIGlzRmlsZSBpc0RpclxyXG4gKiAgICAgICAgICBmaWxlRXh0IHdpdGhFeHRcclxuICpcclxuICogICAgYW5kIGltcGxlbWVudHMgZnVuY3Rpb246XHJcbiAqICAgICAgIHNvdXJjZUxpYiA6PSAoc3ltYm9sOiBzdHJpbmcpOiBzdHJpbmc/XHJcbiAqL1xyXG5cclxuIyAtLS0gbm90IGV4cG9ydGVkIVxyXG5sZXQgaFN5bWJvbHM6IGhhc2hvZjxzdHJpbmc+ID0ge30gICAgICMgLS0tIHs8c3ltPjogPGxpYj4sIC4uLn1cclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgbG9hZFN5bWJvbHMgOj0gKFxyXG5cdFx0c3RyU3ltYm9sczogc3RyaW5nXHJcblx0XHRoT3B0aW9uczogaGFzaD17fVxyXG5cdFx0KTogaGFzaG9mPHN0cmluZz4gPT5cclxuXHJcblx0IyAtLS0gQ2hlY2sgaWYgbGlicmFyaWVzIGFjdHVhbGx5IGV4aXN0XHJcblx0e2NoZWNrRmlsZXN9IDo9IGdldE9wdGlvbnMgaE9wdGlvbnMsIHtcclxuXHRcdGNoZWNrRmlsZXM6IGZhbHNlXHJcblx0XHR9XHJcblxyXG5cdGxldCBsZXZlbCA9IDAgICAjIC0tLSBzeW1HZW4gbXVzdCBrbm93IHRoZSBjdXJyZW50IGxldmVsXHJcblxyXG5cdHN5bUdlbjogVFRva2VuR2VuZXJhdG9yIDo9IChsaW5lOiBzdHJpbmcpIC0+XHJcblxyXG5cdFx0aWYgKGxldmVsID09IDApXHJcblx0XHRcdHlpZWxkIHtraW5kOiAnbGliJywgc3RyOiBsaW5lfVxyXG5cdFx0ZWxzZSBpZiAobGV2ZWwgPT0gMSlcclxuXHRcdFx0Zm9yIHN0ciBvZiBsaW5lLnNwbGl0KC9cXHMrLylcclxuXHRcdFx0XHR5aWVsZCB7a2luZDogJ3N5bWJvbCcsIHN0cn1cclxuXHRcdGVsc2VcclxuXHRcdFx0Y3JvYWsgXCJsZXZlbCA9ICN7bGV2ZWx9XCJcclxuXHRcdHJldHVyblxyXG5cclxuXHRoU3ltYm9sczogaGFzaG9mPHN0cmluZz4gOj0ge30gICMgLS0tIHs8c3ltYm9sPjogPGxpYj4sIC4uLn1cclxuXHRsZXQgY3VyTGliOiBzdHJpbmc/ID0gdW5kZWZcclxuXHRmb3Ige2tpbmQsIHN0cn0gb2YgYWxsVG9rZW5zSW5CbG9jayhzdHJTeW1ib2xzLCBzeW1HZW4pXHJcblx0XHRzd2l0Y2gga2luZFxyXG5cdFx0XHR3aGVuICdpbmRlbnQnXHJcblx0XHRcdFx0bGV2ZWwgKz0gMVxyXG5cdFx0XHR3aGVuICd1bmRlbnQnXHJcblx0XHRcdFx0bGV2ZWwgLT0gMVxyXG5cdFx0XHR3aGVuICdsaWInXHJcblx0XHRcdFx0Y3VyTGliID0gc3RyXHJcblx0XHRcdHdoZW4gJ3N5bWJvbCcsICdndWFyZCdcclxuXHRcdFx0XHRhc3NlcnQgZGVmaW5lZChzdHIpLCBcInVuZGVmaW5lZCBzdHIhXCJcclxuXHRcdFx0XHRpZiAobGV2ZWwgPT0gMClcclxuXHRcdFx0XHRcdGlmIGNoZWNrRmlsZXNcclxuXHRcdFx0XHRcdFx0YXNzZXJ0IGlzRmlsZShzdHIpLCBcIk5vIHN1Y2ggZmlsZTogI3tzdHJ9XCJcclxuXHRcdFx0XHRcdGN1ckxpYiA9IHN0clxyXG5cdFx0XHRcdGVsc2UgaWYgZGVmaW5lZChjdXJMaWIpXHJcblx0XHRcdFx0XHREQkcgXCJBREQgI3tzdHJ9IGZyb20gI3tjdXJMaWJ9XCJcclxuXHRcdFx0XHRcdGhTeW1ib2xzW3N0cl0gPSBjdXJMaWJcclxuXHRcdFx0XHRlbHNlXHJcblx0XHRcdFx0XHRjcm9hayBcImN1ckxpYiBlbXB0eSBhdCBsZXZlbCA+IDBcIlxyXG5cdFx0XHRlbHNlXHJcblx0XHRcdFx0Y3JvYWsgXCJVbmtub3duIGtpbmQ6ICN7a2luZH1cIlxyXG5cdHJlc2V0T25lSW5kZW50KClcclxuXHRyZXR1cm4gaFN5bWJvbHNcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgc291cmNlTGliIDo9IChcclxuXHRcdHN5bWJvbDogc3RyaW5nXHJcblx0XHRoOiBoYXNob2Y8c3RyaW5nPj1oU3ltYm9sc1xyXG5cdFx0KTogc3RyaW5nID0+XHJcblxyXG5cdHJldHVybiBoW3N5bWJvbF1cclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgbGlic0FuZFN5bWJvbHMgOj0gKFxyXG5cdFx0bFN5bWJvbHM6IHN0cmluZ1tdXHJcblx0XHQpOiBoYXNob2Y8c3RyaW5nW10+ID0+XHJcblxyXG5cdGhMaWJzOiBoYXNob2Y8c3RyaW5nW10+IDo9IHt9XHJcblx0Zm9yIHN5bSBvZiBsU3ltYm9sc1xyXG5cdFx0c3JjTGliIDo9IHNvdXJjZUxpYihzeW0pXHJcblx0XHRpZiBkZWZpbmVkKHNyY0xpYilcclxuXHRcdFx0aWYgaGFzS2V5KGhMaWJzLCBzcmNMaWIpXHJcblx0XHRcdFx0aExpYnNbc3JjTGliXS5wdXNoIHN5bVxyXG5cdFx0XHRlbHNlXHJcblx0XHRcdFx0aExpYnNbc3JjTGliXSA9IFtzeW1dXHJcblx0cmV0dXJuIGhMaWJzXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuZXhwb3J0IGdldE5lZWRlZEltcG9ydFN0bXRzIDo9IChcclxuXHRcdGxTeW1ib2xzOiBzdHJpbmdbXVxyXG5cdFx0KTogc3RyaW5nW10gPT5cclxuXHJcblx0REJHIFwiQ0FMTCBnZXROZWVkZWRJbXBvcnRTdG10cygje09MKGxTeW1ib2xzKX0pXCJcclxuXHRoTGlicyA6PSBsaWJzQW5kU3ltYm9scyhsU3ltYm9scylcclxuXHREQkdWQUxVRSAnaExpYnMnLCBoTGlic1xyXG5cdGxTdG10cyA6PSBmb3IgbGliIG9mIGtleXMoaExpYnMpXHJcblx0XHRsU3ltcyA6PSBoTGlic1tsaWJdXHJcblx0XHRzdHJTeW1zIDo9IGxTeW1zLmpvaW4oJywgJylcclxuXHRcdGlmIGxpYi5tYXRjaCgvXltBLVphLXpdW0EtWmEtejAtOV9dKiQvKVxyXG5cdFx0XHRcImltcG9ydCB7I3tzdHJTeW1zfX0gZnJvbSAnI3tsaWJ9JztcIlxyXG5cdFx0ZWxzZSBpZiBsaWIubWF0Y2goL15bXFxAXFwuXFwvXS8pXHJcblx0XHRcdFwiaW1wb3J0IHsje3N0clN5bXN9fSBmcm9tICcje2xpYn0nO1wiXHJcblx0XHRlbHNlXHJcblx0XHRcdFwiaW1wb3J0IHsje3N0clN5bXN9fSBmcm9tICcuLyN7bGlifSc7XCJcclxuXHRyZXR1cm4gbFN0bXRzXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuaWYgaXNGaWxlKCdzcmMvLnN5bWJvbHMnKVxyXG5cdGNvbnRlbnRzIDo9IHNsdXJwKCdzcmMvLnN5bWJvbHMnKVxyXG5cdGhTeW1ib2xzID0gbG9hZFN5bWJvbHMoY29udGVudHMsIG9cImNoZWNrRmlsZXNcIilcclxuIl19