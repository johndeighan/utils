"use strict";
// symbols.lib.civet

import {
	undef, defined, notdefined, assert,
	hash, hashof, isEmpty, nonEmpty,
	} from './datatypes.lib.ts'
import {
	pass, OL, ML, croak, o, getOptions, hasKey, keys,
	} from './llutils.lib.ts'
import {LOG, DBG, DBGVALUE, ERR} from './logger.lib.ts'
import {resetOneIndent} from './indent.lib.ts'
import {
	TPLLToken, TTokenGenerator, allTokensInBlock,
	} from './pll.lib.ts'
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

// --- {<sym>: <lib>, ...}
const symbolsPath = 'src/.symbols'

// --- holds symbols in symbolsPath,
//     but only loaded when needed
//     and only if file exists
const symbolMap = new Map<string,string>()

// ---------------------------------------------------------------------------

export const loadSymbols = (
		block: string,
		aMap = new Map<string,string>(),
		hOptions: hash={}
		): Map<string,string> => {

	DBG("in loadSymbols()")

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
			ERR(`level = ${level}`)
			croak(`level = ${level}`)
		}
		return
	}

	let curLib: (string | undefined) = undef
	for (const {kind, str} of allTokensInBlock(block, symGen)) {
		DBG(`TOKEN: ${kind}`)
		switch(kind) {
			case 'indent': {
				level += 1;break;
			}
			case 'undent': {
				level -= 1;break;
			}
			case 'lib': {
				DBG(`Set curLib to ${OL(str)}`)
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
					aMap.set(str, curLib)
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
	return aMap
}

// ---------------------------------------------------------------------------

export const sourceLib = (
		symbol: string,
		m: Map<string,string> = symbolMap  // use global symbolMap by default
		): (string | undefined) => {

	if ((m === symbolMap) && (symbolMap.size === 0)) {
		const contents = slurp(symbolsPath)
		loadSymbols(contents, symbolMap, o`checkFiles`)
	}
	return m.get(symbol)
}

// ---------------------------------------------------------------------------

export const libsAndSymbols = (
		lSymbols: string[]
		): hashof<string[]> => {

	if ((symbolMap.size === 0) && isFile(symbolsPath)) {
		const contents = slurp(symbolsPath)
		loadSymbols(contents, symbolMap, o`checkFiles`)
	}

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

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3JjL2xpYi9zeW1ib2xzLmxpYi5jaXZldC50c3giLCJzb3VyY2VzIjpbInNyYy9saWIvc3ltYm9scy5saWIuY2l2ZXQiXSwibWFwcGluZ3MiOiI7QUFBQSxvQkFBbUI7QUFDbkIsQUFBQTtBQUNBLEFBQUEsTUFBTSxDQUFDLENBQUM7QUFDUixDQUFDLEtBQUssQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDLE1BQU0sQ0FBQztBQUNwQyxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLFFBQVEsQ0FBQztBQUNqQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsb0JBQW9CO0FBQzVCLEFBQUEsQUFBQSxNQUFNLENBQUMsQ0FBQztBQUNSLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsSUFBSSxDQUFDO0FBQ2xELENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxrQkFBa0I7QUFDMUIsQUFBQSxBQUFBLE1BQU0sQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxpQkFBaUI7QUFDdkQsQUFBQSxBQUFBLE1BQU0sQ0FBQyxDQUFDLGNBQWMsQ0FBQyxDQUFDLElBQUksQ0FBQyxpQkFBaUI7QUFDOUMsQUFBQSxBQUFBLE1BQU0sQ0FBQyxDQUFDO0FBQ1IsQ0FBQyxTQUFTLENBQUMsQ0FBQyxlQUFlLENBQUMsQ0FBQyxnQkFBZ0IsQ0FBQztBQUM5QyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsY0FBYztBQUN0QixBQUFBLEFBQUEsTUFBTSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFDLGFBQWE7QUFDekMsQUFBQTtBQUNBLEFB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LENBQUM7QUFDbEMsQUFBQSxDQUFDLFFBQVEsQ0FBQSxBQUFDLE9BQU8sQ0FBQyxDQUFDLEtBQUssQ0FBQTtBQUN4QixBQUFBLEMsSyxDLE8sRyxDQUFXLEdBQUcsQ0FBQyxDQUFBLE1BQUEsR0FBRyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUEsQ0FBQSxDQUFBO0FBQ2pDLEFBQUEsRUFBTyxNQUFMLEtBQUssQ0FBQyxDQUFFLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQztBQUNyQixBQUFBLEVBQVMsTUFBUCxPQUFPLENBQUMsQ0FBRSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDO0FBQzdCLEFBQUEsRUFBRSxHQUFHLENBQUEsR0FBRyxDQUFDLEtBQUssQ0FBQyx5QkFBeUIsQ0FBQyxDQUFBLENBQUEsQ0FBQTtBQUN6QyxBQUFBLEcsTyxNQUFHLENBQUMsUUFBUSxFQUFFLE9BQU8sQ0FBQyxRQUFRLEVBQUUsR0FBRyxDQUFDLEVBQUUsQyxDO0VBQUMsQ0FBQTtBQUN2QyxBQUFBLEVBQUUsSUFBSSxDQUFDLEdBQUcsQ0FBQSxHQUFHLENBQUMsS0FBSyxDQUFDLFdBQVcsQ0FBQyxDQUFBLENBQUEsQ0FBQTtBQUNoQyxBQUFBLEcsTyxNQUFHLENBQUMsUUFBUSxFQUFFLE9BQU8sQ0FBQyxRQUFRLEVBQUUsR0FBRyxDQUFDLEVBQUUsQyxDO0VBQUMsQ0FBQTtBQUN2QyxBQUFBLEVBQUUsSUFBSSxDQUFBLENBQUE7QUFDTixBQUFBLEcsTyxNQUFHLENBQUMsUUFBUSxFQUFFLE9BQU8sQ0FBQyxVQUFVLEVBQUUsR0FBRyxDQUFDLEVBQUUsQyxDO0VBQUMsQztDQUFBLEMsQ0FSbEMsTUFBTixNQUFNLENBQUMsQyxPQVFpQztBQUN6QyxBQUFBLENBQUMsTUFBTSxDQUFDLE07QUFBTSxDQUFBO0FBQ2QiLCJuYW1lcyI6W10sInNvdXJjZXNDb250ZW50IjpbIiMgc3ltYm9scy5saWIuY2l2ZXRcclxuXHJcbmltcG9ydCB7XHJcblx0dW5kZWYsIGRlZmluZWQsIG5vdGRlZmluZWQsIGFzc2VydCxcclxuXHRoYXNoLCBoYXNob2YsIGlzRW1wdHksIG5vbkVtcHR5LFxyXG5cdH0gZnJvbSAnLi9kYXRhdHlwZXMubGliLnRzJ1xyXG5pbXBvcnQge1xyXG5cdHBhc3MsIE9MLCBNTCwgY3JvYWssIG8sIGdldE9wdGlvbnMsIGhhc0tleSwga2V5cyxcclxuXHR9IGZyb20gJy4vbGx1dGlscy5saWIudHMnXHJcbmltcG9ydCB7TE9HLCBEQkcsIERCR1ZBTFVFLCBFUlJ9IGZyb20gJy4vbG9nZ2VyLmxpYi50cydcclxuaW1wb3J0IHtyZXNldE9uZUluZGVudH0gZnJvbSAnLi9pbmRlbnQubGliLnRzJ1xyXG5pbXBvcnQge1xyXG5cdFRQTExUb2tlbiwgVFRva2VuR2VuZXJhdG9yLCBhbGxUb2tlbnNJbkJsb2NrLFxyXG5cdH0gZnJvbSAnLi9wbGwubGliLnRzJ1xyXG5pbXBvcnQge2lzRmlsZSwgc2x1cnB9IGZyb20gJy4vZnMubGliLnRzJ1xyXG5cclxuLyoqXHJcbiAqIEBtb2R1bGUgc3ltYm9scyAtIGxvY2F0ZSBjb21tb24gc3ltYm9sc1xyXG4gKiAgICBwYXJzZXMgYSBmaWxlIChkZWZhdWx0OiBzcmMvLnN5bWJvbHMpIHRoYXQgbG9va3MgbGlrZTpcclxuICogICAgICAgc3JjL2xpYi9pbmRlbnQubGliLnRzXHJcbiAqICAgICAgICAgIG9uZUluZGVudCByZXNldE9uZUluZGVudCBpbmRlbnRMZXZlbFxyXG4gKiAgICAgICAgICBsaW5lRGVzYyBzcGxpdExpbmUgaW5kZW50ZWRcclxuICogICAgICAgc3JjL2xpYi9mcy5saWIudHNcclxuICogICAgICAgICAgaXNGaWxlIGlzRGlyXHJcbiAqICAgICAgICAgIGZpbGVFeHQgd2l0aEV4dFxyXG4gKlxyXG4gKiAgICBhbmQgaW1wbGVtZW50cyBmdW5jdGlvbjpcclxuICogICAgICAgc291cmNlTGliIDo9IChzeW1ib2w6IHN0cmluZyk6IHN0cmluZz9cclxuICovXHJcblxyXG4jIC0tLSBub3QgZXhwb3J0ZWQhXHJcblxyXG4jIC0tLSB7PHN5bT46IDxsaWI+LCAuLi59XHJcbnN5bWJvbHNQYXRoIDo9ICdzcmMvLnN5bWJvbHMnXHJcblxyXG4jIC0tLSBob2xkcyBzeW1ib2xzIGluIHN5bWJvbHNQYXRoLFxyXG4jICAgICBidXQgb25seSBsb2FkZWQgd2hlbiBuZWVkZWRcclxuIyAgICAgYW5kIG9ubHkgaWYgZmlsZSBleGlzdHNcclxuc3ltYm9sTWFwIDo9IG5ldyBNYXA8c3RyaW5nLHN0cmluZz4oKVxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbmV4cG9ydCBsb2FkU3ltYm9scyA6PSAoXHJcblx0XHRibG9jazogc3RyaW5nXHJcblx0XHRhTWFwID0gbmV3IE1hcDxzdHJpbmcsc3RyaW5nPigpXHJcblx0XHRoT3B0aW9uczogaGFzaD17fVxyXG5cdFx0KTogTWFwPHN0cmluZyxzdHJpbmc+ID0+XHJcblxyXG5cdERCRyBcImluIGxvYWRTeW1ib2xzKClcIlxyXG5cclxuXHQjIC0tLSBDaGVjayBpZiBsaWJyYXJpZXMgYWN0dWFsbHkgZXhpc3RcclxuXHR7Y2hlY2tGaWxlc30gOj0gZ2V0T3B0aW9ucyBoT3B0aW9ucywge1xyXG5cdFx0Y2hlY2tGaWxlczogZmFsc2VcclxuXHRcdH1cclxuXHJcblx0bGV0IGxldmVsID0gMCAgICMgLS0tIHN5bUdlbiBtdXN0IGtub3cgdGhlIGN1cnJlbnQgbGV2ZWxcclxuXHJcblx0c3ltR2VuOiBUVG9rZW5HZW5lcmF0b3IgOj0gKGxpbmU6IHN0cmluZykgLT5cclxuXHJcblx0XHRpZiAobGV2ZWwgPT0gMClcclxuXHRcdFx0eWllbGQge2tpbmQ6ICdsaWInLCBzdHI6IGxpbmV9XHJcblx0XHRlbHNlIGlmIChsZXZlbCA9PSAxKVxyXG5cdFx0XHRmb3Igc3RyIG9mIGxpbmUuc3BsaXQoL1xccysvKVxyXG5cdFx0XHRcdHlpZWxkIHtraW5kOiAnc3ltYm9sJywgc3RyfVxyXG5cdFx0ZWxzZVxyXG5cdFx0XHRFUlIgXCJsZXZlbCA9ICN7bGV2ZWx9XCJcclxuXHRcdFx0Y3JvYWsgXCJsZXZlbCA9ICN7bGV2ZWx9XCJcclxuXHRcdHJldHVyblxyXG5cclxuXHRsZXQgY3VyTGliOiBzdHJpbmc/ID0gdW5kZWZcclxuXHRmb3Ige2tpbmQsIHN0cn0gb2YgYWxsVG9rZW5zSW5CbG9jayhibG9jaywgc3ltR2VuKVxyXG5cdFx0REJHIFwiVE9LRU46ICN7a2luZH1cIlxyXG5cdFx0c3dpdGNoIGtpbmRcclxuXHRcdFx0d2hlbiAnaW5kZW50J1xyXG5cdFx0XHRcdGxldmVsICs9IDFcclxuXHRcdFx0d2hlbiAndW5kZW50J1xyXG5cdFx0XHRcdGxldmVsIC09IDFcclxuXHRcdFx0d2hlbiAnbGliJ1xyXG5cdFx0XHRcdERCRyBcIlNldCBjdXJMaWIgdG8gI3tPTChzdHIpfVwiXHJcblx0XHRcdFx0Y3VyTGliID0gc3RyXHJcblx0XHRcdHdoZW4gJ3N5bWJvbCcsICdndWFyZCdcclxuXHRcdFx0XHRhc3NlcnQgZGVmaW5lZChzdHIpLCBcInVuZGVmaW5lZCBzdHIhXCJcclxuXHRcdFx0XHRpZiAobGV2ZWwgPT0gMClcclxuXHRcdFx0XHRcdGlmIGNoZWNrRmlsZXNcclxuXHRcdFx0XHRcdFx0YXNzZXJ0IGlzRmlsZShzdHIpLCBcIk5vIHN1Y2ggZmlsZTogI3tzdHJ9XCJcclxuXHRcdFx0XHRcdGN1ckxpYiA9IHN0clxyXG5cdFx0XHRcdGVsc2UgaWYgZGVmaW5lZChjdXJMaWIpXHJcblx0XHRcdFx0XHREQkcgXCJBREQgI3tzdHJ9IGZyb20gI3tjdXJMaWJ9XCJcclxuXHRcdFx0XHRcdGFNYXAuc2V0IHN0ciwgY3VyTGliXHJcblx0XHRcdFx0ZWxzZVxyXG5cdFx0XHRcdFx0Y3JvYWsgXCJjdXJMaWIgZW1wdHkgYXQgbGV2ZWwgPiAwXCJcclxuXHRcdFx0ZWxzZVxyXG5cdFx0XHRcdGNyb2FrIFwiVW5rbm93biBraW5kOiAje2tpbmR9XCJcclxuXHRyZXNldE9uZUluZGVudCgpXHJcblx0cmV0dXJuIGFNYXBcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgc291cmNlTGliIDo9IChcclxuXHRcdHN5bWJvbDogc3RyaW5nXHJcblx0XHRtOiBNYXA8c3RyaW5nLHN0cmluZz4gPSBzeW1ib2xNYXAgICMgdXNlIGdsb2JhbCBzeW1ib2xNYXAgYnkgZGVmYXVsdFxyXG5cdFx0KTogc3RyaW5nPyA9PlxyXG5cclxuXHRpZiAobSA9PSBzeW1ib2xNYXApICYmIChzeW1ib2xNYXAuc2l6ZSA9PSAwKVxyXG5cdFx0Y29udGVudHMgOj0gc2x1cnAoc3ltYm9sc1BhdGgpXHJcblx0XHRsb2FkU3ltYm9scyhjb250ZW50cywgc3ltYm9sTWFwLCBvXCJjaGVja0ZpbGVzXCIpXHJcblx0cmV0dXJuIG0uZ2V0KHN5bWJvbClcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgbGlic0FuZFN5bWJvbHMgOj0gKFxyXG5cdFx0bFN5bWJvbHM6IHN0cmluZ1tdXHJcblx0XHQpOiBoYXNob2Y8c3RyaW5nW10+ID0+XHJcblxyXG5cdGlmIChzeW1ib2xNYXAuc2l6ZSA9PSAwKSAmJiBpc0ZpbGUoc3ltYm9sc1BhdGgpXHJcblx0XHRjb250ZW50cyA6PSBzbHVycChzeW1ib2xzUGF0aClcclxuXHRcdGxvYWRTeW1ib2xzKGNvbnRlbnRzLCBzeW1ib2xNYXAsIG8nY2hlY2tGaWxlcycpXHJcblxyXG5cdGhMaWJzOiBoYXNob2Y8c3RyaW5nW10+IDo9IHt9XHJcblx0Zm9yIHN5bSBvZiBsU3ltYm9sc1xyXG5cdFx0c3JjTGliIDo9IHNvdXJjZUxpYihzeW0pXHJcblx0XHRpZiBkZWZpbmVkKHNyY0xpYilcclxuXHRcdFx0aWYgaGFzS2V5KGhMaWJzLCBzcmNMaWIpXHJcblx0XHRcdFx0aExpYnNbc3JjTGliXS5wdXNoIHN5bVxyXG5cdFx0XHRlbHNlXHJcblx0XHRcdFx0aExpYnNbc3JjTGliXSA9IFtzeW1dXHJcblx0cmV0dXJuIGhMaWJzXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuZXhwb3J0IGdldE5lZWRlZEltcG9ydFN0bXRzIDo9IChcclxuXHRcdGxTeW1ib2xzOiBzdHJpbmdbXVxyXG5cdFx0KTogc3RyaW5nW10gPT5cclxuXHJcblx0REJHIFwiQ0FMTCBnZXROZWVkZWRJbXBvcnRTdG10cygje09MKGxTeW1ib2xzKX0pXCJcclxuXHRoTGlicyA6PSBsaWJzQW5kU3ltYm9scyhsU3ltYm9scylcclxuXHREQkdWQUxVRSAnaExpYnMnLCBoTGlic1xyXG5cdGxTdG10cyA6PSBmb3IgbGliIG9mIGtleXMoaExpYnMpXHJcblx0XHRsU3ltcyA6PSBoTGlic1tsaWJdXHJcblx0XHRzdHJTeW1zIDo9IGxTeW1zLmpvaW4oJywgJylcclxuXHRcdGlmIGxpYi5tYXRjaCgvXltBLVphLXpdW0EtWmEtejAtOV9dKiQvKVxyXG5cdFx0XHRcImltcG9ydCB7I3tzdHJTeW1zfX0gZnJvbSAnI3tsaWJ9JztcIlxyXG5cdFx0ZWxzZSBpZiBsaWIubWF0Y2goL15bXFxAXFwuXFwvXS8pXHJcblx0XHRcdFwiaW1wb3J0IHsje3N0clN5bXN9fSBmcm9tICcje2xpYn0nO1wiXHJcblx0XHRlbHNlXHJcblx0XHRcdFwiaW1wb3J0IHsje3N0clN5bXN9fSBmcm9tICcuLyN7bGlifSc7XCJcclxuXHRyZXR1cm4gbFN0bXRzXHJcbiJdfQ==