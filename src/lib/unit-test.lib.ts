"use strict";
// unit-test.lib.civet

import {
	assert, assertEquals, assertStrictEquals, assertNotEquals,
	assertObjectMatch,
	assertStringIncludes, assertMatch, assertArrayIncludes,
	} from '@std/assert'

import {
	undef, defined, notdefined, isEmpty, nonEmpty,
	array, arrayof, isArray, isHash, isString, hash,
	hashof, isIterable, deepEqual, hashLike, integer,
	TObjCompareFunc, TObjLikeFunc, TToStringFunc,
	normalizeCode, voidFunc, croak,
	} from 'datatypes'
import {
	pass, stringify, o, keys, getOptions, spaces,
	} from 'llutils'
import {OL} from 'to-nice'
import {indented} from 'indent'
import {TextTable} from 'text-table'
import {
	pushLogLevel, popLogLevel,
	DBG, LOG, LOGVALUE, DBGVALUE, INDENT, UNDENT,
	} from 'logger'
import {relpath, mkDir, barf, getPathType, fileExt} from 'fsys'
import {TPLLToken, isKind, allTokensInBlock, tokenTable} from 'pll'
import {checkType} from 'typescript'
import {civet2tsFile} from 'civet'
import {getMyOutsideCaller} from 'v8-stack'
import {
	sourceLib, getNeededImportStmts,
	} from 'symbols'

// ---------------------------------------------------------------------------

/**
 * Generate a test name using the source line number
 */

const getTestName = (): string => {

	pushLogLevel('silent')
	const frame = getMyOutsideCaller()
	const line = (frame === undef) ? 0 : frame.line
	popLogLevel()
	DBG(`TEST NAME: line ${line}`)
	return `line ${line}`
}

// ---------------------------------------------------------------------------

/**
 * In a unit test, checks if  value is deeply equal to
 * the expected value. Reports line number of the test.
 *
 * @param {any} value - any JavaScript value
 * @param {any} expected - any JavaScript value
 * @returns {void} - nothing
 *
 * @example
 * ```js
 * equal 2+2, 4
 * ```
 * This test will pass.
 */

export const equal = (value: unknown, expected: unknown) : void => {

	const name = getTestName()
	DBG(`equal ?, ${stringify(expected)} (${name})`)
	Deno.test(name, () => assertEquals(value, expected))
	return
}

// ---------------------------------------------------------------------------

export const same = (value: unknown, expected: unknown) : void => {

	const name = getTestName()
	DBG(`same ?, ${stringify(expected)} (${name})`)
	Deno.test(name, () => assertStrictEquals(value, expected))
	return
}

// ---------------------------------------------------------------------------

/**
 * In a unit test, tests if value is truthy
 * Reports line number of the test.

 * @param {any} value - any JavaScript value
 * @returns {void} - nothing
 *
 * @example
 * ```js
 * truthy isString('abc')
 * ```
 * This test will pass.
 */

export const truthy = (value: unknown): void => {

	const name = getTestName()
	DBG(`truthy ${stringify(value)} (${name})`)
	Deno.test(name, () => assert(value))
	return
}

// ---------------------------------------------------------------------------

/**
 * In a unit test, tests if value is falsy
 * Reports line number of the test.
 *
 * @param {any} value - any JavaScript value
 * @returns {void} - nothing
 *
 * @example
 * ```js
 * falsy isString(42)
 * ```
 * This test will pass.
 */

export const falsy = (value: unknown): void => {

	const name = getTestName()
	DBG(`falsy ${stringify(value)} (${name})`)
	Deno.test(name, () => assert((!value)))
	return
}

// ---------------------------------------------------------------------------

/**
 * In a unit test, tests if calling the provided function
 * throws an exception. Reports line number of the test.
 *
 * @param {any => any} func - any JavaScript function
 * @returns {void} - nothing
 *
 * @example
 * ```js
 * fails () => throw new Error('bad')
 * ```
 * This test will pass.
 */

export const fails = (func: voidFunc): void => {

	pushLogLevel('silent')    // --- silence any errors generated
	const name = getTestName()
	DBG(`fails <func> (${name})`)
	Deno.test(name, () => {
		try {
			func()
			popLogLevel()
			throw new Error("Test Failure - function succeeds!!!")
		}
		catch (err) {
			popLogLevel()
		}
	})

	return
}

// ---------------------------------------------------------------------------

/**
 * In a unit test, tests if calling the provided function
 * runs without throwing an exception.
 * Reports line number of the test.
 *
 * @param {any => any} func - any JavaScript function
 * @returns {void} - nothing
 *
 * @example
 * ```js
 * succeeds () => return 42
 * ```
 * This test will pass.
 */

export const succeeds = (func: voidFunc): void => {

	assert((typeof func === 'function'), "test succeeds() passed non-function")
	const name = getTestName()
	DBG(`succeeds <func> (${name})`)
	Deno.test(name, () => {
		try {
			func()
		}
		catch (err) {
			// @ts-ignore
			const msg = err.message
			throw new Error(`FAIL - func throws (${msg})`)
		}
	})
	return
}

// ---------------------------------------------------------------------------

export const iterEqual = (iter: Iterable<unknown>, expected: unknown[]) => {

	const name = getTestName()
	DBG(`iterEqual ?, ${stringify(expected)} (${name})`)
	Deno.test(name, () => assertEquals(Array.from(iter), expected))
	return
}

// ---------------------------------------------------------------------------

export const iterLike = (iter: Iterable<hash>, expected: hash[]) => {

	const name = getTestName()
	DBG(`iterEqual ?, ${stringify(expected)} (${name})`)

	const lItems = Array.from(iter)
	const len = lItems.length
	Deno.test(`${name}/len`, () => assertEquals(len, expected.length))
	for (let end = (len-1), i1 = 0; i1 <= end; ++i1) {const i = i1;
		// @ts-ignore
		Deno.test(`${name}/${i}`, () => assertObjectMatch(lItems[i], expected[i]))
	}
	return
}

// ---------------------------------------------------------------------------

/**
 * In a unit test, tests a value, which must be a string,
 * matches either a substring or a regular expression.
 * Reports line number of the test.
 *
 * @param {any} value - any JavaScript value
 * @param {any} expected - any JavaScript value
 * @returns {void} - nothing
 *
 * @example
 * ```js
 * matches 'abcde', 'bce'
 * ```
 * This test will pass.
 *
 * @example
 * ```js
 * matches 'aabbcc', /a+b+c+/
 * ```
 * This test will pass.
 */

export const matches = (value: unknown, expected: unknown) => {

	assert(isString(value), `Not a string: ${value}`)
	const name = getTestName()
	DBG(`matches ?, ${stringify(expected)} (${name})`)
	if (isString(expected)) {
		Deno.test(name, () => assertStringIncludes(value, expected))
	}
	else if (expected instanceof RegExp) {
		Deno.test(name, () => assertMatch(value, expected))
	}
	else {
		Deno.test(name, () => assert(false))
	}
	return
}

// ---------------------------------------------------------------------------

/**
 * In a unit test, tests if one hash matches another hash.
 * the first hash must have all the properties in the second hash,
 * but extra properties are allowed.
 * Reports line number of the test.
 *
 * @param {hash} value - any JavaScript object
 * @param {hash} expected - any JavaScript object
 * @returns {void} - nothing
 *
 * @example
 * ```js
 * like {a:1, b:2, c:3}, {a:1, c:3}
 * ```
 * This test will pass.
 */

export const like = (value: (object | undefined), expected: hash): void => {

	const name = getTestName()
	DBG(`like ?, ${stringify(expected)} (${name})`)
	if (notdefined(value)) {
		Deno.test(name, () => assertEquals(value, undef))
	}
	else {
		Deno.test(name, () => assertObjectMatch(value, expected))
	}
	return
}

// ---------------------------------------------------------------------------

export const codeLike = (value: string, expected: string): void => {

	const name = getTestName()
	DBG(`codeLike ?, ${stringify(expected)} (${name})`)
	Deno.test(name, () => {
		assertEquals(normalizeCode(value), normalizeCode(expected))
	})
	return
}

// ---------------------------------------------------------------------------

export const strListLike = (
		value: string[],
		expected: string[]
		): void => {

	const name = getTestName()
	DBG(`strListLike ?, ${stringify(expected, {trunc: 64})}`)

	const len = value.length
	Deno.test(`${name}/len`, () => assertEquals(len, expected.length))

	if (len === 0) {
		return
	}

	const lValues = value.toSorted()
	const lExpected = expected.toSorted()
	for (let end1 = (len-1), i2 = 0; i2 <= end1; ++i2) {const i = i2;
		const val = lValues[i]
		const exp = lExpected[i]
		// @ts-ignore
		Deno.test(`${name}/${i}`, () => assertEquals(val, exp))
	}
	return
}

// ---------------------------------------------------------------------------

/**
 * In a unit test, tests if each Object in an array matches
 * each object in another array. The 2 arrays must be of the
 * same length. If a function is passed as the 3rd parameter,
 * then each array is first sorted by using the function to
 * convert each object to a string, then sorting the array
 * using those strings.
 * A matching function can also be provided as the 4th argument.
 * By default, the function hashLike (from llutils.lib) is used.
 * Reports line number of the test.
 *
 * @param {array | object} value - any JavaScript value
 * @param {array | object} expected - any JavaScript value
 * @returns {void} - nothing
 *
 * @example
 * ```js
 * like {a:1, b:2, c:3}, {a:1, c:3}
 * ```
 * This test will pass.
 *
 * @example
 * ```js
 * like [{a:1, b:2, c:3}, {a:3, b:5, c:23}], [{a:1, b:2}]
 * ```
 * This test will pass.
 */

export const objListLike = (
		value: hash[],
		expected: hash[],
		strFunc: (TToStringFunc | undefined) = undef,     // used for sorting if defined
		likeFunc: TObjLikeFunc = hashLike   // used for comparison
		): void => {

	const name = getTestName()
	DBG(`objListLike ?, ${stringify(expected, {trunc: 64})}`)
	DBG(`strFunc is ${OL(strFunc)}`)

	const len = value.length
	Deno.test(`${name}/len`, () => assertEquals(len, expected.length))

	if (len === 0) {
		return
	}

	// --- create the arrays to actually be compared
	let lVals: hash[] = value

	if (defined(strFunc)) {
		const compareFunc: TObjCompareFunc = (a: hash, b: hash) => {
			const str1 = strFunc(a)
			const str2 = strFunc(b)
			return (str1 < str2) ? -1 : (str1 > str2) ? 1 : 0
		}
		lVals = value.toSorted(compareFunc)
	}

	const nVals = lVals.length
	DBG(`lVals is array of length ${nVals}`)

	let lExp: hash[] = value
	if (defined(strFunc)) {
		DBG("strFunc defined")
		const compareFunc: TObjCompareFunc = (a: hash, b: hash) => {
			const str1 = strFunc(a)
			const str2 = strFunc(b)
			return (str1 < str2) ? -1 : (str1 > str2) ? 1 : 0
		}
		lExp = expected.toSorted(compareFunc)
	}

	const nExp = lExp.length
	DBG(`lExp is array of length ${nExp}`)

	for (let end2 = (len-1), i3 = 0; i3 <= end2; ++i3) {const i = i3;
		// @ts-ignore
		Deno.test(`${name}/${i}`, () => assert(likeFunc(lVals[i], lExp[i])))
	}
	return
}

// ---------------------------------------------------------------------------

/**
 * In a unit test, tests a value, which must be an array,
 * includes the expected value.
 * Reports line number of the test
 *
 * @param {Array<any>} value - an array
 * @param {any} expected - any JavaScript value
 * @returns {void} - nothing
 *
 * @example
 * ```js
 * includes ['a', 'b', 'c'], 'b'
 * ```
 * This test will pass.
 */

export const includes = (
		value: unknown,
		expected: unknown
		): void => {

	assert(Array.isArray(value), `not an array: ${value}`)
	const name = getTestName()
	DBG(`includes ?, ${stringify(expected)} (${name})`)
	Deno.test(name, () => assertArrayIncludes(value, [expected]))
	return
}

// ---------------------------------------------------------------------------

/**
 * In a unit test, tests a value, which must be an array,
 * includes all of the items in the expected array.
 * Reports line number of the test
 *
 * @param {Array<any>} value - an array
 * @param {Array<any>} expected - an array
 * @returns {void} - nothing
 *
 * @example
 * ```js
 * includesAll ['a', 'b', 'c'], ['b', 'c']
 * ```
 * This test will pass.
 */

export const includesAll = (
		value: unknown,
		expected: unknown
		): void => {

	assert(Array.isArray(value), `not an array: ${value}`)
	assert(Array.isArray(expected), `not an array: ${expected}`)
	const name = getTestName()
	DBG(`includesAll ?, ${stringify(expected)} (${name})`)
	Deno.test(name, () => assertArrayIncludes(value, expected))
	return
}

// ---------------------------------------------------------------------------

/**
 * In a unit test, tests if a value is of a given type.
 * Relies on a .symbols file being correctly set up, and
 * it containing the type we're testing when testing
 * a non-buildin type
 *
 * @param {string} typeStr - a type as a string
 * @param {any} value - any JavaScript value
 * @returns {void} - nothing
 *
 * @example
 * ```js
 * isType 'string', 'abc'
 * ```
 * This test will pass.
 *
 * @example
 * ```js
 * isType 'number', 'abc'
 * ```
 * This test will fail.
 */

export const isType = (
		typeStr: string,
		value: unknown,
		isOfType: (Function | undefined)=undef
		): void => {

	const name = getTestName()
	if (defined(isOfType)) {
		DBG("Using type guard")
		Deno.test(name, () => assert(isOfType(value)))
	}
	else {
		DBG(INDENT)
		const lDiagnostics = checkType(value, typeStr, true)
		if (defined(lDiagnostics)) {
			for (const msg of lDiagnostics) {
				console.log(msg)
			}
		}
		DBG(UNDENT)
		Deno.test(name, () => assert(isEmpty(lDiagnostics)))
	}
	return
}

// ---------------------------------------------------------------------------

/**
 * In a unit test, tests if a value is not of a given type.
 *
 * @param {string} typeStr - a type as a string
 * @param {any} value - any JavaScript value
 * @returns {void} - nothing
 *
 * @example
 * ```js
 * notType 'string', 'abc'
 * ```
 * This test will fail.
 *
 * @example
 * ```js
 * notType 'number', 'abc'
 * ```
 * This test will pass.
 */

export const notType = (
		typeStr: string,
		value: unknown,
		isOfType: (Function | undefined)=undef
		) => {

	const name = getTestName()
	if (defined(isOfType)) {
		DBG("Using type guard")
		Deno.test(name, () => assert(!isOfType(value)))
	}
	else {
		DBG(INDENT)
		const lDiagnostics = checkType(value, typeStr, false)
		DBG(UNDENT)
		Deno.test(name, () => assert(nonEmpty(lDiagnostics)))
	}
	return
}

// ---------------------------------------------------------------------------
// --- Uses a recursive descent parser

export type TFileOp = {
	funcName: 'mkDir' | 'barf'
	path: string
	contents?: string
	}

export const setDirTree = (
		currentDir: string,
		contents: string,
		hOptions: hash = {}
		): TFileOp[] => {

	// --- Extract options
	type opt = {
		debug: boolean
		clear: boolean
		compile: boolean
		scaffold: boolean
		}
	const {debug, clear, compile, scaffold} = getOptions<opt>(hOptions, {
		debug: false,
		clear: false,
		compile: false,
		scaffold: false
		})

	if (!debug) {
		pushLogLevel('info')
	}
	let level: integer = 0

	// --- return calls made
	const lFileOps: TFileOp[] = []

	// ..........................................................

	const dbgEnter = (name: string, ...lArgs: unknown[]) => {
		const strArgs = (
			(()=>{const results=[];for (const arg of lArgs) {
				results.push(OL(arg))
			}return results})()
			).join(', ')
		DBG(`${'   '.repeat(level)}-> ${name}(${strArgs})`)
		level += 1
		return
	}

	// ..........................................................

	const dbgExit = (name: string, ...lArgs: unknown[]) => {
		const strArgs = (
			(()=>{const results1=[];for (const arg of lArgs) {
				results1.push(OL(arg))
			}return results1})()
			).join(', ')
		level -= 1
		DBG(`${'   '.repeat(level)}<- ${name}(${strArgs})`)
		return
	}

	// ..........................................................

	const dbg = (line: string) => {
		DBG(`${'   '.repeat(level)}-- ${OL(line)}`)
		return
	}

	// ..........................................................

	const doMakeDir = (
			dirPath: string
			): void => {

		const path = relpath(dirPath)
		lFileOps.push({
			funcName: 'mkDir',
			path
			})
		if (!scaffold) {
			mkDir(path, clear)
		}
		return
	}

	// ..........................................................

	const doBarf = (
			path: string,
			contents: string
			): void => {

		lFileOps.push({
			funcName: "barf",
			path: relpath(path),
			contents
			})
		if (!scaffold) {
			barf(path, contents)
			if ((fileExt(path) === '.civet') && compile) {
				civet2tsFile(path)
			}
		}
		return
	}

	// ..........................................................

	const fileHandler = (
			path: string,
			lTokens: TPLLToken[]
			): void => {

		dbgEnter('fileHandler', path)
		let ref;if (isKind(lTokens[0], 'indent')) {
			lTokens.shift()
			const lLines = []
			let level = 0
			// @ts-ignore
			while ((level > 0) || !isKind(lTokens[0], 'undent')) {
				const tok = lTokens.shift()
				if (notdefined(tok)) {
					croak("No 'undent' in block")
				}
				else {
					switch(tok.kind) {
						case 'indent': {
							level += 1;break;
						}
						case 'undent': {
							level -= 1
							assert((level >= 0), "Negative level in setDirTree()");break;
						}
						case 'empty': {
							lLines.push('');break;
						}
						default: {
							if (defined(tok.str)) {
								const line = indented(tok.str, {level})
								dbg(line)
								lLines.push(line)
							}
						}
					}
				}
			}

			// --- HERE: (level == 0) AND (lTokens[0].kind == 'undent')
			assert((level === 0), `after file contents, level = ${OL(level)}`)
			assert((lTokens[0].kind === 'undent'),
					`UNDENT expected after contents, got ${OL(lTokens[0])}`)
			lTokens.shift()
			ref = lLines.join('\n')
		}
		else {
			ref = ''
		};const contents =ref
		doBarf(path, contents)
		dbgExit('fileHandler', path)
		return
	}

	// ..........................................................

	const dirHandler = (
			path: string,
			lTokens: TPLLToken[]
			): void => {

		dbgEnter('dirHandler', path)
		doMakeDir(path)
		if ((lTokens.length > 0) && isKind(lTokens[0], 'indent')) {
			lTokens.shift()
			blockHandler(path, lTokens)
			// @ts-ignore
			assert(isKind(lTokens[0], 'undent'), "Missing UNDENT in dirHandler")
			lTokens.shift()
		}
		dbgExit('dirHandler', path)
		return
	}

	// ..........................................................

	const blockHandler = (dirPath: string, lTokens: TPLLToken[]) => {
		dbgEnter('blockHandler', dirPath)
		while ((lTokens.length > 0) && (lTokens[0].kind !== 'undent')) {
			const tok: TPLLToken = lTokens[0]
			lTokens.shift()
			const {kind, str} = tok
			switch(kind) {
				case 'indent': {
					croak("Unexpected INDENT");break;
				}
				default: {
					if (defined(str) && str.startsWith('/')) {
						dirHandler(`${dirPath}${tok.str}`, lTokens)
					}
					else {
						fileHandler(`${dirPath}/${tok.str}`, lTokens)
					}
				}
			}
		}
		dbgExit('blockHandler')
		return
	}

	// ..........................................................

	const ptype = getPathType(currentDir)
	assert((ptype === 'dir') || (ptype === 'missing'),
			`currentDir is a ${ptype}`)

	// --- Clear the directory if it exists
	doMakeDir(currentDir)

	const lTokens = Array.from(allTokensInBlock(contents))
	DBG(tokenTable(lTokens))

	blockHandler(currentDir, lTokens)
	assert((lTokens.length === 0),
			`Tokens remaining after parse: ${OL(lTokens)}`)
	if (!debug) {
		popLogLevel()
	}
	return lFileOps
}

// ---------------------------------------------------------------------------

export const fileOpsTable = (lFileOps: TFileOp[]): string => {

	const tt = new TextTable("l l")
	tt.fullsep()
	tt.title('FILE OPS')
	tt.fullsep()
	for (const {funcName, path, contents} of lFileOps) {
		switch(funcName) {
			case 'mkDir': {
				tt.data(['mkdir', path]);break;
			}
			case 'barf': {
				tt.data(['barf', path])
				if (contents) {
					for (const line of contents.split('\n')) {
						tt.data(['', line.replace('\t', spaces(3))])
					}
				};break;
			}
		}
	}
	tt.fullsep()
	return tt.asString()
}

// ---------------------------------------------------------------------------

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQzpcXFVzZXJzXFxqb2huZFxcdXRpbHNcXHNyY1xcbGliXFx1bml0LXRlc3QubGliLmNpdmV0LnRzeCIsInNvdXJjZXMiOlsiQzpcXFVzZXJzXFxqb2huZFxcdXRpbHNcXHNyY1xcbGliXFx1bml0LXRlc3QubGliLmNpdmV0Il0sIm1hcHBpbmdzIjoiO0FBQUEsc0JBQXFCO0FBQ3JCLEFBQUE7QUFDQSxBQUFBLE1BQU0sQ0FBQyxDQUFDO0FBQ1IsQ0FBQyxNQUFNLENBQUMsQ0FBQyxZQUFZLENBQUMsQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDLGVBQWUsQ0FBQztBQUMzRCxDQUFDLGlCQUFpQixDQUFDO0FBQ25CLENBQUMsb0JBQW9CLENBQUMsQ0FBQyxXQUFXLENBQUMsQ0FBQyxtQkFBbUIsQ0FBQztBQUN4RCxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsYUFBYTtBQUNyQixBQUFBO0FBQ0EsQUFBQSxBQUFBLE1BQU0sQ0FBQyxDQUFDO0FBQ1IsQ0FBQyxLQUFLLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxRQUFRLENBQUM7QUFDL0MsQ0FBQyxLQUFLLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxJQUFJLENBQUM7QUFDakQsQ0FBQyxNQUFNLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxPQUFPLENBQUM7QUFDbEQsQ0FBQyxlQUFlLENBQUMsQ0FBQyxZQUFZLENBQUMsQ0FBQyxhQUFhLENBQUM7QUFDOUMsQ0FBQyxhQUFhLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxLQUFLLENBQUM7QUFDaEMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFdBQVc7QUFDbkIsQUFBQSxBQUFBLE1BQU0sQ0FBQyxDQUFDO0FBQ1IsQ0FBQyxJQUFJLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxD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QUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsR0FBRztBQUNILEFBQUE7QUFDQSxBQUFBLEFBQUEsTUFBTSxDQUFPLE1BQU4sTUFBTSxDQUFDLENBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQSxDQUFBO0FBQzFDLEFBQUE7QUFDQSxBQUFBLENBQUssTUFBSixJQUFJLENBQUMsQ0FBRSxDQUFDLFdBQVcsQ0FBQyxDQUFDO0FBQ3RCLEFBQUEsQ0FBQyxHQUFHLENBQUEsQUFBQyxDQUFDLE9BQU8sRUFBRSxTQUFTLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUMzQyxBQUFBLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQSxBQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxNQUFNLENBQUEsQUFBQyxLQUFLLENBQUEsQ0FBQTtBQUNuQyxBQUFBLENBQUMsTTtBQUFNLENBQUE7QUFDUCxBQUFBO0FBQ0EsQUFBQSw4RUFBNkU7QUFDN0UsQUFBQTtBQUNBLEFBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsR0FBRztBQUNILEFBQUE7QUFDQSxBQUFBLEFBQUEsTUFBTSxDQUFNLE1BQUwsS0FBSyxDQUFDLENBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQSxDQUFBO0FBQ3pDLEFBQUE7QUFDQSxBQUFBLENBQUssTUFBSixJQUFJLENBQUMsQ0FBRSxDQUFDLFdBQVcsQ0FBQyxDQUFDO0FBQ3RCLEFBQUEsQ0FBQyxHQUFHLENBQUEsQUFBQyxDQUFDLE1BQU0sRUFBRSxTQUFTLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSxFQUFFLElBQUksQ0FBQyxD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LFFBQVEsQ0FBQSxDQUFBLENBQUE7QUFDM0MsQUFBQSxFQUFFLE1BQU0sQ0FBQSxBQUFDLFFBQVEsQ0FBQSxDQUFBLENBQUE7QUFDakIsQUFBQSxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUEsQ0FBQSxDQUFBO0FBQ2YsQUFBQSxJQUFJLEVBQUUsQ0FBQyxJQUFJLENBQUEsQUFBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFBLE87R0FBQSxDQUFBO0FBQzNCLEFBQUEsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFBLENBQUEsQ0FBQTtBQUNkLEFBQUEsSUFBSSxFQUFFLENBQUMsSUFBSSxDQUFBLEFBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQTtBQUMxQixBQUFBLElBQUksR0FBRyxDQUFBLFFBQVEsQ0FBQSxDQUFBLENBQUE7QUFDZixBQUFBLEtBQUssR0FBRyxDQUFDLENBQUEsTUFBQSxJQUFJLENBQUMsRUFBRSxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUEsQ0FBQSxDQUFBO0FBQ3JDLEFBQUEsTUFBTSxFQUFFLENBQUMsSUFBSSxDQUFBLEFBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEM7S0FBQSxDO0lBQUEsQ0FBQSxPO0dBQUEsQztFQUFBLEM7Q0FBQSxDQUFBO0FBQ2pELEFBQUEsQ0FBQyxFQUFFLENBQUMsT0FBTyxDQUFDLENBQUM7QUFDYixBQUFBLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxRQUFRLENBQUMsQztBQUFDLENBQUE7QUFDckI7QUFDQSxBQUFBLDhFQUE2RTtBQUM3RSIsIm5hbWVzIjpbXSwic291cmNlc0NvbnRlbnQiOlsiIyB1bml0LXRlc3QubGliLmNpdmV0XHJcblxyXG5pbXBvcnQge1xyXG5cdGFzc2VydCwgYXNzZXJ0RXF1YWxzLCBhc3NlcnRTdHJpY3RFcXVhbHMsIGFzc2VydE5vdEVxdWFscyxcclxuXHRhc3NlcnRPYmplY3RNYXRjaCxcclxuXHRhc3NlcnRTdHJpbmdJbmNsdWRlcywgYXNzZXJ0TWF0Y2gsIGFzc2VydEFycmF5SW5jbHVkZXMsXHJcblx0fSBmcm9tICdAc3RkL2Fzc2VydCdcclxuXHJcbmltcG9ydCB7XHJcblx0dW5kZWYsIGRlZmluZWQsIG5vdGRlZmluZWQsIGlzRW1wdHksIG5vbkVtcHR5LFxyXG5cdGFycmF5LCBhcnJheW9mLCBpc0FycmF5LCBpc0hhc2gsIGlzU3RyaW5nLCBoYXNoLFxyXG5cdGhhc2hvZiwgaXNJdGVyYWJsZSwgZGVlcEVxdWFsLCBoYXNoTGlrZSwgaW50ZWdlcixcclxuXHRUT2JqQ29tcGFyZUZ1bmMsIFRPYmpMaWtlRnVuYywgVFRvU3RyaW5nRnVuYyxcclxuXHRub3JtYWxpemVDb2RlLCB2b2lkRnVuYywgY3JvYWssXHJcblx0fSBmcm9tICdkYXRhdHlwZXMnXHJcbmltcG9ydCB7XHJcblx0cGFzcywgc3RyaW5naWZ5LCBvLCBrZXlzLCBnZXRPcHRpb25zLCBzcGFjZXMsXHJcblx0fSBmcm9tICdsbHV0aWxzJ1xyXG5pbXBvcnQge09MfSBmcm9tICd0by1uaWNlJ1xyXG5pbXBvcnQge2luZGVudGVkfSBmcm9tICdpbmRlbnQnXHJcbmltcG9ydCB7VGV4dFRhYmxlfSBmcm9tICd0ZXh0LXRhYmxlJ1xyXG5pbXBvcnQge1xyXG5cdHB1c2hMb2dMZXZlbCwgcG9wTG9nTGV2ZWwsXHJcblx0REJHLCBMT0csIExPR1ZBTFVFLCBEQkdWQUxVRSwgSU5ERU5ULCBVTkRFTlQsXHJcblx0fSBmcm9tICdsb2dnZXInXHJcbmltcG9ydCB7cmVscGF0aCwgbWtEaXIsIGJhcmYsIGdldFBhdGhUeXBlLCBmaWxlRXh0fSBmcm9tICdmc3lzJ1xyXG5pbXBvcnQge1RQTExUb2tlbiwgaXNLaW5kLCBhbGxUb2tlbnNJbkJsb2NrLCB0b2tlblRhYmxlfSBmcm9tICdwbGwnXHJcbmltcG9ydCB7Y2hlY2tUeXBlfSBmcm9tICd0eXBlc2NyaXB0J1xyXG5pbXBvcnQge2NpdmV0MnRzRmlsZX0gZnJvbSAnY2l2ZXQnXHJcbmltcG9ydCB7Z2V0TXlPdXRzaWRlQ2FsbGVyfSBmcm9tICd2OC1zdGFjaydcclxuaW1wb3J0IHtcclxuXHRzb3VyY2VMaWIsIGdldE5lZWRlZEltcG9ydFN0bXRzLFxyXG5cdH0gZnJvbSAnc3ltYm9scydcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG4vKipcclxuICogR2VuZXJhdGUgYSB0ZXN0IG5hbWUgdXNpbmcgdGhlIHNvdXJjZSBsaW5lIG51bWJlclxyXG4gKi9cclxuXHJcbmdldFRlc3ROYW1lIDo9ICgpOiBzdHJpbmcgPT5cclxuXHJcblx0cHVzaExvZ0xldmVsICdzaWxlbnQnXHJcblx0ZnJhbWUgOj0gZ2V0TXlPdXRzaWRlQ2FsbGVyKClcclxuXHRsaW5lIDo9IChmcmFtZSA9PSB1bmRlZikgPyAwIDogZnJhbWUubGluZVxyXG5cdHBvcExvZ0xldmVsKClcclxuXHREQkcgXCJURVNUIE5BTUU6IGxpbmUgI3tsaW5lfVwiXHJcblx0cmV0dXJuIFwibGluZSAje2xpbmV9XCJcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG4vKipcclxuICogSW4gYSB1bml0IHRlc3QsIGNoZWNrcyBpZiAgdmFsdWUgaXMgZGVlcGx5IGVxdWFsIHRvXHJcbiAqIHRoZSBleHBlY3RlZCB2YWx1ZS4gUmVwb3J0cyBsaW5lIG51bWJlciBvZiB0aGUgdGVzdC5cclxuICpcclxuICogQHBhcmFtIHthbnl9IHZhbHVlIC0gYW55IEphdmFTY3JpcHQgdmFsdWVcclxuICogQHBhcmFtIHthbnl9IGV4cGVjdGVkIC0gYW55IEphdmFTY3JpcHQgdmFsdWVcclxuICogQHJldHVybnMge3ZvaWR9IC0gbm90aGluZ1xyXG4gKlxyXG4gKiBAZXhhbXBsZVxyXG4gKiBgYGBqc1xyXG4gKiBlcXVhbCAyKzIsIDRcclxuICogYGBgXHJcbiAqIFRoaXMgdGVzdCB3aWxsIHBhc3MuXHJcbiAqL1xyXG5cclxuZXhwb3J0IGVxdWFsIDo9ICh2YWx1ZTogdW5rbm93biwgZXhwZWN0ZWQ6IHVua25vd24pIDogdm9pZCA9PlxyXG5cclxuXHRuYW1lIDo9IGdldFRlc3ROYW1lKClcclxuXHREQkcgXCJlcXVhbCA/LCAje3N0cmluZ2lmeShleHBlY3RlZCl9ICgje25hbWV9KVwiXHJcblx0RGVuby50ZXN0IG5hbWUsICgpID0+IGFzc2VydEVxdWFscyh2YWx1ZSwgZXhwZWN0ZWQpXHJcblx0cmV0dXJuXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuZXhwb3J0IHNhbWUgOj0gKHZhbHVlOiB1bmtub3duLCBleHBlY3RlZDogdW5rbm93bikgOiB2b2lkID0+XHJcblxyXG5cdG5hbWUgOj0gZ2V0VGVzdE5hbWUoKVxyXG5cdERCRyBcInNhbWUgPywgI3tzdHJpbmdpZnkoZXhwZWN0ZWQpfSAoI3tuYW1lfSlcIlxyXG5cdERlbm8udGVzdCBuYW1lLCAoKSA9PiBhc3NlcnRTdHJpY3RFcXVhbHModmFsdWUsIGV4cGVjdGVkKVxyXG5cdHJldHVyblxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbi8qKlxyXG4gKiBJbiBhIHVuaXQgdGVzdCwgdGVzdHMgaWYgdmFsdWUgaXMgdHJ1dGh5XHJcbiAqIFJlcG9ydHMgbGluZSBudW1iZXIgb2YgdGhlIHRlc3QuXHJcblxyXG4gKiBAcGFyYW0ge2FueX0gdmFsdWUgLSBhbnkgSmF2YVNjcmlwdCB2YWx1ZVxyXG4gKiBAcmV0dXJucyB7dm9pZH0gLSBub3RoaW5nXHJcbiAqXHJcbiAqIEBleGFtcGxlXHJcbiAqIGBgYGpzXHJcbiAqIHRydXRoeSBpc1N0cmluZygnYWJjJylcclxuICogYGBgXHJcbiAqIFRoaXMgdGVzdCB3aWxsIHBhc3MuXHJcbiAqL1xyXG5cclxuZXhwb3J0IHRydXRoeSA6PSAodmFsdWU6IHVua25vd24pOiB2b2lkID0+XHJcblxyXG5cdG5hbWUgOj0gZ2V0VGVzdE5hbWUoKVxyXG5cdERCRyBcInRydXRoeSAje3N0cmluZ2lmeSh2YWx1ZSl9ICgje25hbWV9KVwiXHJcblx0RGVuby50ZXN0IG5hbWUsICgpID0+IGFzc2VydCB2YWx1ZVxyXG5cdHJldHVyblxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbi8qKlxyXG4gKiBJbiBhIHVuaXQgdGVzdCwgdGVzdHMgaWYgdmFsdWUgaXMgZmFsc3lcclxuICogUmVwb3J0cyBsaW5lIG51bWJlciBvZiB0aGUgdGVzdC5cclxuICpcclxuICogQHBhcmFtIHthbnl9IHZhbHVlIC0gYW55IEphdmFTY3JpcHQgdmFsdWVcclxuICogQHJldHVybnMge3ZvaWR9IC0gbm90aGluZ1xyXG4gKlxyXG4gKiBAZXhhbXBsZVxyXG4gKiBgYGBqc1xyXG4gKiBmYWxzeSBpc1N0cmluZyg0MilcclxuICogYGBgXHJcbiAqIFRoaXMgdGVzdCB3aWxsIHBhc3MuXHJcbiAqL1xyXG5cclxuZXhwb3J0IGZhbHN5IDo9ICh2YWx1ZTogdW5rbm93bik6IHZvaWQgPT5cclxuXHJcblx0bmFtZSA6PSBnZXRUZXN0TmFtZSgpXHJcblx0REJHIFwiZmFsc3kgI3tzdHJpbmdpZnkodmFsdWUpfSAoI3tuYW1lfSlcIlxyXG5cdERlbm8udGVzdCBuYW1lLCAoKSA9PiBhc3NlcnQgKG5vdCB2YWx1ZSlcclxuXHRyZXR1cm5cclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG4vKipcclxuICogSW4gYSB1bml0IHRlc3QsIHRlc3RzIGlmIGNhbGxpbmcgdGhlIHByb3ZpZGVkIGZ1bmN0aW9uXHJcbiAqIHRocm93cyBhbiBleGNlcHRpb24uIFJlcG9ydHMgbGluZSBudW1iZXIgb2YgdGhlIHRlc3QuXHJcbiAqXHJcbiAqIEBwYXJhbSB7YW55ID0+IGFueX0gZnVuYyAtIGFueSBKYXZhU2NyaXB0IGZ1bmN0aW9uXHJcbiAqIEByZXR1cm5zIHt2b2lkfSAtIG5vdGhpbmdcclxuICpcclxuICogQGV4YW1wbGVcclxuICogYGBganNcclxuICogZmFpbHMgKCkgPT4gdGhyb3cgbmV3IEVycm9yKCdiYWQnKVxyXG4gKiBgYGBcclxuICogVGhpcyB0ZXN0IHdpbGwgcGFzcy5cclxuICovXHJcblxyXG5leHBvcnQgZmFpbHMgOj0gKGZ1bmM6IHZvaWRGdW5jKTogdm9pZCA9PlxyXG5cclxuXHRwdXNoTG9nTGV2ZWwgJ3NpbGVudCcgICAgIyAtLS0gc2lsZW5jZSBhbnkgZXJyb3JzIGdlbmVyYXRlZFxyXG5cdG5hbWUgOj0gZ2V0VGVzdE5hbWUoKVxyXG5cdERCRyBcImZhaWxzIDxmdW5jPiAoI3tuYW1lfSlcIlxyXG5cdERlbm8udGVzdCBuYW1lLCAoKSA9PlxyXG5cdFx0dHJ5XHJcblx0XHRcdGZ1bmMoKVxyXG5cdFx0XHRwb3BMb2dMZXZlbCgpXHJcblx0XHRcdHRocm93IG5ldyBFcnJvcihcIlRlc3QgRmFpbHVyZSAtIGZ1bmN0aW9uIHN1Y2NlZWRzISEhXCIpXHJcblx0XHRjYXRjaCBlcnJcclxuXHRcdFx0cG9wTG9nTGV2ZWwoKVxyXG5cclxuXHRyZXR1cm5cclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG4vKipcclxuICogSW4gYSB1bml0IHRlc3QsIHRlc3RzIGlmIGNhbGxpbmcgdGhlIHByb3ZpZGVkIGZ1bmN0aW9uXHJcbiAqIHJ1bnMgd2l0aG91dCB0aHJvd2luZyBhbiBleGNlcHRpb24uXHJcbiAqIFJlcG9ydHMgbGluZSBudW1iZXIgb2YgdGhlIHRlc3QuXHJcbiAqXHJcbiAqIEBwYXJhbSB7YW55ID0+IGFueX0gZnVuYyAtIGFueSBKYXZhU2NyaXB0IGZ1bmN0aW9uXHJcbiAqIEByZXR1cm5zIHt2b2lkfSAtIG5vdGhpbmdcclxuICpcclxuICogQGV4YW1wbGVcclxuICogYGBganNcclxuICogc3VjY2VlZHMgKCkgPT4gcmV0dXJuIDQyXHJcbiAqIGBgYFxyXG4gKiBUaGlzIHRlc3Qgd2lsbCBwYXNzLlxyXG4gKi9cclxuXHJcbmV4cG9ydCBzdWNjZWVkcyA6PSAoZnVuYzogdm9pZEZ1bmMpOiB2b2lkID0+XHJcblxyXG5cdGFzc2VydCAodHlwZW9mIGZ1bmMgPT0gJ2Z1bmN0aW9uJyksIFwidGVzdCBzdWNjZWVkcygpIHBhc3NlZCBub24tZnVuY3Rpb25cIlxyXG5cdG5hbWUgOj0gZ2V0VGVzdE5hbWUoKVxyXG5cdERCRyBcInN1Y2NlZWRzIDxmdW5jPiAoI3tuYW1lfSlcIlxyXG5cdERlbm8udGVzdCBuYW1lLCAoKSA9PlxyXG5cdFx0dHJ5XHJcblx0XHRcdGZ1bmMoKVxyXG5cdFx0Y2F0Y2ggZXJyXHJcblx0XHRcdCMgQHRzLWlnbm9yZVxyXG5cdFx0XHRtc2cgOj0gZXJyLm1lc3NhZ2VcclxuXHRcdFx0dGhyb3cgbmV3IEVycm9yKFwiRkFJTCAtIGZ1bmMgdGhyb3dzICgje21zZ30pXCIpXHJcblx0cmV0dXJuXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuZXhwb3J0IGl0ZXJFcXVhbCA6PSAoaXRlcjogSXRlcmFibGU8dW5rbm93bj4sIGV4cGVjdGVkOiB1bmtub3duW10pID0+XHJcblxyXG5cdG5hbWUgOj0gZ2V0VGVzdE5hbWUoKVxyXG5cdERCRyBcIml0ZXJFcXVhbCA/LCAje3N0cmluZ2lmeShleHBlY3RlZCl9ICgje25hbWV9KVwiXHJcblx0RGVuby50ZXN0IG5hbWUsICgpID0+IGFzc2VydEVxdWFscyBBcnJheS5mcm9tKGl0ZXIpLCBleHBlY3RlZFxyXG5cdHJldHVyblxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbmV4cG9ydCBpdGVyTGlrZSA6PSAoaXRlcjogSXRlcmFibGU8aGFzaD4sIGV4cGVjdGVkOiBoYXNoW10pID0+XHJcblxyXG5cdG5hbWUgOj0gZ2V0VGVzdE5hbWUoKVxyXG5cdERCRyBcIml0ZXJFcXVhbCA/LCAje3N0cmluZ2lmeShleHBlY3RlZCl9ICgje25hbWV9KVwiXHJcblxyXG5cdGxJdGVtcyA6PSBBcnJheS5mcm9tKGl0ZXIpXHJcblx0bGVuIDo9IGxJdGVtcy5sZW5ndGhcclxuXHREZW5vLnRlc3QgXCIje25hbWV9L2xlblwiLCAoKSA9PiBhc3NlcnRFcXVhbHMgbGVuLCBleHBlY3RlZC5sZW5ndGhcclxuXHRmb3IgaSBvZiBbMC4ubGVuLTFdXHJcblx0XHQjIEB0cy1pZ25vcmVcclxuXHRcdERlbm8udGVzdCBcIiN7bmFtZX0vI3tpfVwiLCAoKSA9PiBhc3NlcnRPYmplY3RNYXRjaCBsSXRlbXNbaV0sIGV4cGVjdGVkW2ldXHJcblx0cmV0dXJuXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuLyoqXHJcbiAqIEluIGEgdW5pdCB0ZXN0LCB0ZXN0cyBhIHZhbHVlLCB3aGljaCBtdXN0IGJlIGEgc3RyaW5nLFxyXG4gKiBtYXRjaGVzIGVpdGhlciBhIHN1YnN0cmluZyBvciBhIHJlZ3VsYXIgZXhwcmVzc2lvbi5cclxuICogUmVwb3J0cyBsaW5lIG51bWJlciBvZiB0aGUgdGVzdC5cclxuICpcclxuICogQHBhcmFtIHthbnl9IHZhbHVlIC0gYW55IEphdmFTY3JpcHQgdmFsdWVcclxuICogQHBhcmFtIHthbnl9IGV4cGVjdGVkIC0gYW55IEphdmFTY3JpcHQgdmFsdWVcclxuICogQHJldHVybnMge3ZvaWR9IC0gbm90aGluZ1xyXG4gKlxyXG4gKiBAZXhhbXBsZVxyXG4gKiBgYGBqc1xyXG4gKiBtYXRjaGVzICdhYmNkZScsICdiY2UnXHJcbiAqIGBgYFxyXG4gKiBUaGlzIHRlc3Qgd2lsbCBwYXNzLlxyXG4gKlxyXG4gKiBAZXhhbXBsZVxyXG4gKiBgYGBqc1xyXG4gKiBtYXRjaGVzICdhYWJiY2MnLCAvYStiK2MrL1xyXG4gKiBgYGBcclxuICogVGhpcyB0ZXN0IHdpbGwgcGFzcy5cclxuICovXHJcblxyXG5leHBvcnQgbWF0Y2hlcyA6PSAodmFsdWU6IHVua25vd24sIGV4cGVjdGVkOiB1bmtub3duKSA9PlxyXG5cclxuXHRhc3NlcnQgaXNTdHJpbmcodmFsdWUpLCBcIk5vdCBhIHN0cmluZzogI3t2YWx1ZX1cIlxyXG5cdG5hbWUgOj0gZ2V0VGVzdE5hbWUoKVxyXG5cdERCRyBcIm1hdGNoZXMgPywgI3tzdHJpbmdpZnkoZXhwZWN0ZWQpfSAoI3tuYW1lfSlcIlxyXG5cdGlmIGlzU3RyaW5nKGV4cGVjdGVkKVxyXG5cdFx0RGVuby50ZXN0IG5hbWUsICgpID0+IGFzc2VydFN0cmluZ0luY2x1ZGVzIHZhbHVlLCBleHBlY3RlZFxyXG5cdGVsc2UgaWYgKGV4cGVjdGVkIGluc3RhbmNlb2YgUmVnRXhwKVxyXG5cdFx0RGVuby50ZXN0IG5hbWUsICgpID0+IGFzc2VydE1hdGNoIHZhbHVlLCBleHBlY3RlZFxyXG5cdGVsc2VcclxuXHRcdERlbm8udGVzdCBuYW1lLCAoKSA9PiBhc3NlcnQgZmFsc2VcclxuXHRyZXR1cm5cclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG4vKipcclxuICogSW4gYSB1bml0IHRlc3QsIHRlc3RzIGlmIG9uZSBoYXNoIG1hdGNoZXMgYW5vdGhlciBoYXNoLlxyXG4gKiB0aGUgZmlyc3QgaGFzaCBtdXN0IGhhdmUgYWxsIHRoZSBwcm9wZXJ0aWVzIGluIHRoZSBzZWNvbmQgaGFzaCxcclxuICogYnV0IGV4dHJhIHByb3BlcnRpZXMgYXJlIGFsbG93ZWQuXHJcbiAqIFJlcG9ydHMgbGluZSBudW1iZXIgb2YgdGhlIHRlc3QuXHJcbiAqXHJcbiAqIEBwYXJhbSB7aGFzaH0gdmFsdWUgLSBhbnkgSmF2YVNjcmlwdCBvYmplY3RcclxuICogQHBhcmFtIHtoYXNofSBleHBlY3RlZCAtIGFueSBKYXZhU2NyaXB0IG9iamVjdFxyXG4gKiBAcmV0dXJucyB7dm9pZH0gLSBub3RoaW5nXHJcbiAqXHJcbiAqIEBleGFtcGxlXHJcbiAqIGBgYGpzXHJcbiAqIGxpa2Uge2E6MSwgYjoyLCBjOjN9LCB7YToxLCBjOjN9XHJcbiAqIGBgYFxyXG4gKiBUaGlzIHRlc3Qgd2lsbCBwYXNzLlxyXG4gKi9cclxuXHJcbmV4cG9ydCBsaWtlIDo9ICh2YWx1ZTogb2JqZWN0PywgZXhwZWN0ZWQ6IGhhc2gpOiB2b2lkID0+XHJcblxyXG5cdG5hbWUgOj0gZ2V0VGVzdE5hbWUoKVxyXG5cdERCRyBcImxpa2UgPywgI3tzdHJpbmdpZnkoZXhwZWN0ZWQpfSAoI3tuYW1lfSlcIlxyXG5cdGlmIG5vdGRlZmluZWQodmFsdWUpXHJcblx0XHREZW5vLnRlc3QgbmFtZSwgKCkgPT4gYXNzZXJ0RXF1YWxzIHZhbHVlLCB1bmRlZlxyXG5cdGVsc2VcclxuXHRcdERlbm8udGVzdCBuYW1lLCAoKSA9PiBhc3NlcnRPYmplY3RNYXRjaCB2YWx1ZSwgZXhwZWN0ZWRcclxuXHRyZXR1cm5cclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgY29kZUxpa2UgOj0gKHZhbHVlOiBzdHJpbmcsIGV4cGVjdGVkOiBzdHJpbmcpOiB2b2lkID0+XHJcblxyXG5cdG5hbWUgOj0gZ2V0VGVzdE5hbWUoKVxyXG5cdERCRyBcImNvZGVMaWtlID8sICN7c3RyaW5naWZ5KGV4cGVjdGVkKX0gKCN7bmFtZX0pXCJcclxuXHREZW5vLnRlc3QgbmFtZSwgKCkgPT5cclxuXHRcdGFzc2VydEVxdWFscyBub3JtYWxpemVDb2RlKHZhbHVlKSwgbm9ybWFsaXplQ29kZShleHBlY3RlZClcclxuXHRyZXR1cm5cclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgc3RyTGlzdExpa2UgOj0gKFxyXG5cdFx0dmFsdWU6IHN0cmluZ1tdXHJcblx0XHRleHBlY3RlZDogc3RyaW5nW11cclxuXHRcdCk6IHZvaWQgPT5cclxuXHJcblx0bmFtZSA6PSBnZXRUZXN0TmFtZSgpXHJcblx0REJHIFwic3RyTGlzdExpa2UgPywgI3tzdHJpbmdpZnkoZXhwZWN0ZWQsIHt0cnVuYzogNjR9KX1cIlxyXG5cclxuXHRsZW4gOj0gdmFsdWUubGVuZ3RoXHJcblx0RGVuby50ZXN0IFwiI3tuYW1lfS9sZW5cIiwgKCkgPT4gYXNzZXJ0RXF1YWxzIGxlbiwgZXhwZWN0ZWQubGVuZ3RoXHJcblxyXG5cdGlmIChsZW4gPT0gMClcclxuXHRcdHJldHVyblxyXG5cclxuXHRsVmFsdWVzIDo9IHZhbHVlLnRvU29ydGVkKClcclxuXHRsRXhwZWN0ZWQgOj0gZXhwZWN0ZWQudG9Tb3J0ZWQoKVxyXG5cdGZvciBpIG9mIFswLi5sZW4tMV1cclxuXHRcdHZhbCA6PSBsVmFsdWVzW2ldXHJcblx0XHRleHAgOj0gbEV4cGVjdGVkW2ldXHJcblx0XHQjIEB0cy1pZ25vcmVcclxuXHRcdERlbm8udGVzdCBcIiN7bmFtZX0vI3tpfVwiLCAoKSA9PiBhc3NlcnRFcXVhbHModmFsLCBleHApXHJcblx0cmV0dXJuXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuLyoqXHJcbiAqIEluIGEgdW5pdCB0ZXN0LCB0ZXN0cyBpZiBlYWNoIE9iamVjdCBpbiBhbiBhcnJheSBtYXRjaGVzXHJcbiAqIGVhY2ggb2JqZWN0IGluIGFub3RoZXIgYXJyYXkuIFRoZSAyIGFycmF5cyBtdXN0IGJlIG9mIHRoZVxyXG4gKiBzYW1lIGxlbmd0aC4gSWYgYSBmdW5jdGlvbiBpcyBwYXNzZWQgYXMgdGhlIDNyZCBwYXJhbWV0ZXIsXHJcbiAqIHRoZW4gZWFjaCBhcnJheSBpcyBmaXJzdCBzb3J0ZWQgYnkgdXNpbmcgdGhlIGZ1bmN0aW9uIHRvXHJcbiAqIGNvbnZlcnQgZWFjaCBvYmplY3QgdG8gYSBzdHJpbmcsIHRoZW4gc29ydGluZyB0aGUgYXJyYXlcclxuICogdXNpbmcgdGhvc2Ugc3RyaW5ncy5cclxuICogQSBtYXRjaGluZyBmdW5jdGlvbiBjYW4gYWxzbyBiZSBwcm92aWRlZCBhcyB0aGUgNHRoIGFyZ3VtZW50LlxyXG4gKiBCeSBkZWZhdWx0LCB0aGUgZnVuY3Rpb24gaGFzaExpa2UgKGZyb20gbGx1dGlscy5saWIpIGlzIHVzZWQuXHJcbiAqIFJlcG9ydHMgbGluZSBudW1iZXIgb2YgdGhlIHRlc3QuXHJcbiAqXHJcbiAqIEBwYXJhbSB7YXJyYXkgfCBvYmplY3R9IHZhbHVlIC0gYW55IEphdmFTY3JpcHQgdmFsdWVcclxuICogQHBhcmFtIHthcnJheSB8IG9iamVjdH0gZXhwZWN0ZWQgLSBhbnkgSmF2YVNjcmlwdCB2YWx1ZVxyXG4gKiBAcmV0dXJucyB7dm9pZH0gLSBub3RoaW5nXHJcbiAqXHJcbiAqIEBleGFtcGxlXHJcbiAqIGBgYGpzXHJcbiAqIGxpa2Uge2E6MSwgYjoyLCBjOjN9LCB7YToxLCBjOjN9XHJcbiAqIGBgYFxyXG4gKiBUaGlzIHRlc3Qgd2lsbCBwYXNzLlxyXG4gKlxyXG4gKiBAZXhhbXBsZVxyXG4gKiBgYGBqc1xyXG4gKiBsaWtlIFt7YToxLCBiOjIsIGM6M30sIHthOjMsIGI6NSwgYzoyM31dLCBbe2E6MSwgYjoyfV1cclxuICogYGBgXHJcbiAqIFRoaXMgdGVzdCB3aWxsIHBhc3MuXHJcbiAqL1xyXG5cclxuZXhwb3J0IG9iakxpc3RMaWtlIDo9IChcclxuXHRcdHZhbHVlOiBoYXNoW11cclxuXHRcdGV4cGVjdGVkOiBoYXNoW11cclxuXHRcdHN0ckZ1bmM6IFRUb1N0cmluZ0Z1bmM/ID0gdW5kZWYgICAgICMgdXNlZCBmb3Igc29ydGluZyBpZiBkZWZpbmVkXHJcblx0XHRsaWtlRnVuYzogVE9iakxpa2VGdW5jID0gaGFzaExpa2UgICAjIHVzZWQgZm9yIGNvbXBhcmlzb25cclxuXHRcdCk6IHZvaWQgPT5cclxuXHJcblx0bmFtZSA6PSBnZXRUZXN0TmFtZSgpXHJcblx0REJHIFwib2JqTGlzdExpa2UgPywgI3tzdHJpbmdpZnkoZXhwZWN0ZWQsIHt0cnVuYzogNjR9KX1cIlxyXG5cdERCRyBcInN0ckZ1bmMgaXMgI3tPTChzdHJGdW5jKX1cIlxyXG5cclxuXHRsZW4gOj0gdmFsdWUubGVuZ3RoXHJcblx0RGVuby50ZXN0IFwiI3tuYW1lfS9sZW5cIiwgKCkgPT4gYXNzZXJ0RXF1YWxzIGxlbiwgZXhwZWN0ZWQubGVuZ3RoXHJcblxyXG5cdGlmIChsZW4gPT0gMClcclxuXHRcdHJldHVyblxyXG5cclxuXHQjIC0tLSBjcmVhdGUgdGhlIGFycmF5cyB0byBhY3R1YWxseSBiZSBjb21wYXJlZFxyXG5cdGxldCBsVmFsczogaGFzaFtdID0gdmFsdWVcclxuXHJcblx0aWYgZGVmaW5lZChzdHJGdW5jKVxyXG5cdFx0Y29tcGFyZUZ1bmM6IFRPYmpDb21wYXJlRnVuYyA6PSAoYTogaGFzaCwgYjogaGFzaCkgPT5cclxuXHRcdFx0c3RyMSA6PSBzdHJGdW5jKGEpXHJcblx0XHRcdHN0cjIgOj0gc3RyRnVuYyhiKVxyXG5cdFx0XHRyZXR1cm4gKHN0cjEgPCBzdHIyKSA/IC0xIDogKHN0cjEgPiBzdHIyKSA/IDEgOiAwXHJcblx0XHRsVmFscyA9IHZhbHVlLnRvU29ydGVkKGNvbXBhcmVGdW5jKVxyXG5cclxuXHRuVmFscyA6PSBsVmFscy5sZW5ndGhcclxuXHREQkcgXCJsVmFscyBpcyBhcnJheSBvZiBsZW5ndGggI3tuVmFsc31cIlxyXG5cclxuXHRsZXQgbEV4cDogaGFzaFtdID0gdmFsdWVcclxuXHRpZiBkZWZpbmVkKHN0ckZ1bmMpXHJcblx0XHREQkcgXCJzdHJGdW5jIGRlZmluZWRcIlxyXG5cdFx0Y29tcGFyZUZ1bmM6IFRPYmpDb21wYXJlRnVuYyA6PSAoYTogaGFzaCwgYjogaGFzaCkgPT5cclxuXHRcdFx0c3RyMSA6PSBzdHJGdW5jKGEpXHJcblx0XHRcdHN0cjIgOj0gc3RyRnVuYyhiKVxyXG5cdFx0XHRyZXR1cm4gKHN0cjEgPCBzdHIyKSA/IC0xIDogKHN0cjEgPiBzdHIyKSA/IDEgOiAwXHJcblx0XHRsRXhwID0gZXhwZWN0ZWQudG9Tb3J0ZWQoY29tcGFyZUZ1bmMpXHJcblxyXG5cdG5FeHAgOj0gbEV4cC5sZW5ndGhcclxuXHREQkcgXCJsRXhwIGlzIGFycmF5IG9mIGxlbmd0aCAje25FeHB9XCJcclxuXHJcblx0Zm9yIGkgb2YgWzAuLmxlbi0xXVxyXG5cdFx0IyBAdHMtaWdub3JlXHJcblx0XHREZW5vLnRlc3QgXCIje25hbWV9LyN7aX1cIiwgKCkgPT4gYXNzZXJ0IGxpa2VGdW5jKGxWYWxzW2ldLCBsRXhwW2ldKVxyXG5cdHJldHVyblxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbi8qKlxyXG4gKiBJbiBhIHVuaXQgdGVzdCwgdGVzdHMgYSB2YWx1ZSwgd2hpY2ggbXVzdCBiZSBhbiBhcnJheSxcclxuICogaW5jbHVkZXMgdGhlIGV4cGVjdGVkIHZhbHVlLlxyXG4gKiBSZXBvcnRzIGxpbmUgbnVtYmVyIG9mIHRoZSB0ZXN0XHJcbiAqXHJcbiAqIEBwYXJhbSB7QXJyYXk8YW55Pn0gdmFsdWUgLSBhbiBhcnJheVxyXG4gKiBAcGFyYW0ge2FueX0gZXhwZWN0ZWQgLSBhbnkgSmF2YVNjcmlwdCB2YWx1ZVxyXG4gKiBAcmV0dXJucyB7dm9pZH0gLSBub3RoaW5nXHJcbiAqXHJcbiAqIEBleGFtcGxlXHJcbiAqIGBgYGpzXHJcbiAqIGluY2x1ZGVzIFsnYScsICdiJywgJ2MnXSwgJ2InXHJcbiAqIGBgYFxyXG4gKiBUaGlzIHRlc3Qgd2lsbCBwYXNzLlxyXG4gKi9cclxuXHJcbmV4cG9ydCBpbmNsdWRlcyA6PSAoXHJcblx0XHR2YWx1ZTogdW5rbm93bixcclxuXHRcdGV4cGVjdGVkOiB1bmtub3duXHJcblx0XHQpOiB2b2lkID0+XHJcblxyXG5cdGFzc2VydCBBcnJheS5pc0FycmF5KHZhbHVlKSwgXCJub3QgYW4gYXJyYXk6ICN7dmFsdWV9XCJcclxuXHRuYW1lIDo9IGdldFRlc3ROYW1lKClcclxuXHREQkcgXCJpbmNsdWRlcyA/LCAje3N0cmluZ2lmeShleHBlY3RlZCl9ICgje25hbWV9KVwiXHJcblx0RGVuby50ZXN0IG5hbWUsICgpID0+IGFzc2VydEFycmF5SW5jbHVkZXModmFsdWUsIFtleHBlY3RlZF0pXHJcblx0cmV0dXJuXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuLyoqXHJcbiAqIEluIGEgdW5pdCB0ZXN0LCB0ZXN0cyBhIHZhbHVlLCB3aGljaCBtdXN0IGJlIGFuIGFycmF5LFxyXG4gKiBpbmNsdWRlcyBhbGwgb2YgdGhlIGl0ZW1zIGluIHRoZSBleHBlY3RlZCBhcnJheS5cclxuICogUmVwb3J0cyBsaW5lIG51bWJlciBvZiB0aGUgdGVzdFxyXG4gKlxyXG4gKiBAcGFyYW0ge0FycmF5PGFueT59IHZhbHVlIC0gYW4gYXJyYXlcclxuICogQHBhcmFtIHtBcnJheTxhbnk+fSBleHBlY3RlZCAtIGFuIGFycmF5XHJcbiAqIEByZXR1cm5zIHt2b2lkfSAtIG5vdGhpbmdcclxuICpcclxuICogQGV4YW1wbGVcclxuICogYGBganNcclxuICogaW5jbHVkZXNBbGwgWydhJywgJ2InLCAnYyddLCBbJ2InLCAnYyddXHJcbiAqIGBgYFxyXG4gKiBUaGlzIHRlc3Qgd2lsbCBwYXNzLlxyXG4gKi9cclxuXHJcbmV4cG9ydCBpbmNsdWRlc0FsbCA6PSAoXHJcblx0XHR2YWx1ZTogdW5rbm93bixcclxuXHRcdGV4cGVjdGVkOiB1bmtub3duXHJcblx0XHQpOiB2b2lkID0+XHJcblxyXG5cdGFzc2VydCBBcnJheS5pc0FycmF5KHZhbHVlKSwgXCJub3QgYW4gYXJyYXk6ICN7dmFsdWV9XCJcclxuXHRhc3NlcnQgQXJyYXkuaXNBcnJheShleHBlY3RlZCksIFwibm90IGFuIGFycmF5OiAje2V4cGVjdGVkfVwiXHJcblx0bmFtZSA6PSBnZXRUZXN0TmFtZSgpXHJcblx0REJHIFwiaW5jbHVkZXNBbGwgPywgI3tzdHJpbmdpZnkoZXhwZWN0ZWQpfSAoI3tuYW1lfSlcIlxyXG5cdERlbm8udGVzdCBuYW1lLCAoKSA9PiBhc3NlcnRBcnJheUluY2x1ZGVzKHZhbHVlLCBleHBlY3RlZClcclxuXHRyZXR1cm5cclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG4vKipcclxuICogSW4gYSB1bml0IHRlc3QsIHRlc3RzIGlmIGEgdmFsdWUgaXMgb2YgYSBnaXZlbiB0eXBlLlxyXG4gKiBSZWxpZXMgb24gYSAuc3ltYm9scyBmaWxlIGJlaW5nIGNvcnJlY3RseSBzZXQgdXAsIGFuZFxyXG4gKiBpdCBjb250YWluaW5nIHRoZSB0eXBlIHdlJ3JlIHRlc3Rpbmcgd2hlbiB0ZXN0aW5nXHJcbiAqIGEgbm9uLWJ1aWxkaW4gdHlwZVxyXG4gKlxyXG4gKiBAcGFyYW0ge3N0cmluZ30gdHlwZVN0ciAtIGEgdHlwZSBhcyBhIHN0cmluZ1xyXG4gKiBAcGFyYW0ge2FueX0gdmFsdWUgLSBhbnkgSmF2YVNjcmlwdCB2YWx1ZVxyXG4gKiBAcmV0dXJucyB7dm9pZH0gLSBub3RoaW5nXHJcbiAqXHJcbiAqIEBleGFtcGxlXHJcbiAqIGBgYGpzXHJcbiAqIGlzVHlwZSAnc3RyaW5nJywgJ2FiYydcclxuICogYGBgXHJcbiAqIFRoaXMgdGVzdCB3aWxsIHBhc3MuXHJcbiAqXHJcbiAqIEBleGFtcGxlXHJcbiAqIGBgYGpzXHJcbiAqIGlzVHlwZSAnbnVtYmVyJywgJ2FiYydcclxuICogYGBgXHJcbiAqIFRoaXMgdGVzdCB3aWxsIGZhaWwuXHJcbiAqL1xyXG5cclxuZXhwb3J0IGlzVHlwZSA6PSAoXHJcblx0XHR0eXBlU3RyOiBzdHJpbmdcclxuXHRcdHZhbHVlOiB1bmtub3duXHJcblx0XHRpc09mVHlwZTogRnVuY3Rpb24/PXVuZGVmXHJcblx0XHQpOiB2b2lkID0+XHJcblxyXG5cdG5hbWUgOj0gZ2V0VGVzdE5hbWUoKVxyXG5cdGlmIGRlZmluZWQoaXNPZlR5cGUpXHJcblx0XHREQkcgXCJVc2luZyB0eXBlIGd1YXJkXCJcclxuXHRcdERlbm8udGVzdCBuYW1lLCAoKSA9PiBhc3NlcnQgaXNPZlR5cGUodmFsdWUpXHJcblx0ZWxzZVxyXG5cdFx0REJHIElOREVOVFxyXG5cdFx0bERpYWdub3N0aWNzIDo9IGNoZWNrVHlwZSh2YWx1ZSwgdHlwZVN0ciwgdHJ1ZSlcclxuXHRcdGlmIGRlZmluZWQobERpYWdub3N0aWNzKVxyXG5cdFx0XHRmb3IgbXNnIG9mIGxEaWFnbm9zdGljc1xyXG5cdFx0XHRcdGNvbnNvbGUubG9nIG1zZ1xyXG5cdFx0REJHIFVOREVOVFxyXG5cdFx0RGVuby50ZXN0IG5hbWUsICgpID0+IGFzc2VydCBpc0VtcHR5KGxEaWFnbm9zdGljcylcclxuXHRyZXR1cm5cclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG4vKipcclxuICogSW4gYSB1bml0IHRlc3QsIHRlc3RzIGlmIGEgdmFsdWUgaXMgbm90IG9mIGEgZ2l2ZW4gdHlwZS5cclxuICpcclxuICogQHBhcmFtIHtzdHJpbmd9IHR5cGVTdHIgLSBhIHR5cGUgYXMgYSBzdHJpbmdcclxuICogQHBhcmFtIHthbnl9IHZhbHVlIC0gYW55IEphdmFTY3JpcHQgdmFsdWVcclxuICogQHJldHVybnMge3ZvaWR9IC0gbm90aGluZ1xyXG4gKlxyXG4gKiBAZXhhbXBsZVxyXG4gKiBgYGBqc1xyXG4gKiBub3RUeXBlICdzdHJpbmcnLCAnYWJjJ1xyXG4gKiBgYGBcclxuICogVGhpcyB0ZXN0IHdpbGwgZmFpbC5cclxuICpcclxuICogQGV4YW1wbGVcclxuICogYGBganNcclxuICogbm90VHlwZSAnbnVtYmVyJywgJ2FiYydcclxuICogYGBgXHJcbiAqIFRoaXMgdGVzdCB3aWxsIHBhc3MuXHJcbiAqL1xyXG5cclxuZXhwb3J0IG5vdFR5cGUgOj0gKFxyXG5cdFx0dHlwZVN0cjogc3RyaW5nXHJcblx0XHR2YWx1ZTogdW5rbm93blxyXG5cdFx0aXNPZlR5cGU6IEZ1bmN0aW9uPz11bmRlZlxyXG5cdFx0KSA9PlxyXG5cclxuXHRuYW1lIDo9IGdldFRlc3ROYW1lKClcclxuXHRpZiBkZWZpbmVkKGlzT2ZUeXBlKVxyXG5cdFx0REJHIFwiVXNpbmcgdHlwZSBndWFyZFwiXHJcblx0XHREZW5vLnRlc3QgbmFtZSwgKCkgPT4gYXNzZXJ0IG5vdCBpc09mVHlwZSh2YWx1ZSlcclxuXHRlbHNlXHJcblx0XHREQkcgSU5ERU5UXHJcblx0XHRsRGlhZ25vc3RpY3MgOj0gY2hlY2tUeXBlKHZhbHVlLCB0eXBlU3RyLCBmYWxzZSlcclxuXHRcdERCRyBVTkRFTlRcclxuXHRcdERlbm8udGVzdCBuYW1lLCAoKSA9PiBhc3NlcnQgbm9uRW1wdHkobERpYWdub3N0aWNzKVxyXG5cdHJldHVyblxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuIyAtLS0gVXNlcyBhIHJlY3Vyc2l2ZSBkZXNjZW50IHBhcnNlclxyXG5cclxuZXhwb3J0IHR5cGUgVEZpbGVPcCA9IHtcclxuXHRmdW5jTmFtZTogJ21rRGlyJyB8ICdiYXJmJ1xyXG5cdHBhdGg6IHN0cmluZ1xyXG5cdGNvbnRlbnRzPzogc3RyaW5nXHJcblx0fVxyXG5cclxuZXhwb3J0IHNldERpclRyZWUgOj0gKFxyXG5cdFx0Y3VycmVudERpcjogc3RyaW5nLFxyXG5cdFx0Y29udGVudHM6IHN0cmluZyxcclxuXHRcdGhPcHRpb25zOiBoYXNoID0ge31cclxuXHRcdCk6IFRGaWxlT3BbXSA9PlxyXG5cclxuXHQjIC0tLSBFeHRyYWN0IG9wdGlvbnNcclxuXHR0eXBlIG9wdCA9IHtcclxuXHRcdGRlYnVnOiBib29sZWFuXHJcblx0XHRjbGVhcjogYm9vbGVhblxyXG5cdFx0Y29tcGlsZTogYm9vbGVhblxyXG5cdFx0c2NhZmZvbGQ6IGJvb2xlYW5cclxuXHRcdH1cclxuXHR7ZGVidWcsIGNsZWFyLCBjb21waWxlLCBzY2FmZm9sZH0gOj0gZ2V0T3B0aW9uczxvcHQ+IGhPcHRpb25zLCB7XHJcblx0XHRkZWJ1ZzogZmFsc2VcclxuXHRcdGNsZWFyOiBmYWxzZVxyXG5cdFx0Y29tcGlsZTogZmFsc2VcclxuXHRcdHNjYWZmb2xkOiBmYWxzZVxyXG5cdFx0fVxyXG5cclxuXHRpZiBub3QgZGVidWdcclxuXHRcdHB1c2hMb2dMZXZlbCAnaW5mbydcclxuXHRsZXQgbGV2ZWw6IGludGVnZXIgPSAwXHJcblxyXG5cdCMgLS0tIHJldHVybiBjYWxscyBtYWRlXHJcblx0bEZpbGVPcHM6IFRGaWxlT3BbXSA6PSBbXVxyXG5cclxuXHQjIC4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi5cclxuXHJcblx0ZGJnRW50ZXIgOj0gKG5hbWU6IHN0cmluZywgLi4ubEFyZ3M6IHVua25vd25bXSkgPT5cclxuXHRcdHN0ckFyZ3MgOj0gKFxyXG5cdFx0XHRmb3IgYXJnIG9mIGxBcmdzXHJcblx0XHRcdFx0T0woYXJnKVxyXG5cdFx0XHQpLmpvaW4oJywgJylcclxuXHRcdERCRyBcIiN7JyAgICcucmVwZWF0KGxldmVsKX0tPiAje25hbWV9KCN7c3RyQXJnc30pXCJcclxuXHRcdGxldmVsICs9IDFcclxuXHRcdHJldHVyblxyXG5cclxuXHQjIC4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi5cclxuXHJcblx0ZGJnRXhpdCA6PSAobmFtZTogc3RyaW5nLCAuLi5sQXJnczogdW5rbm93bltdKSA9PlxyXG5cdFx0c3RyQXJncyA6PSAoXHJcblx0XHRcdGZvciBhcmcgb2YgbEFyZ3NcclxuXHRcdFx0XHRPTChhcmcpXHJcblx0XHRcdCkuam9pbignLCAnKVxyXG5cdFx0bGV2ZWwgLT0gMVxyXG5cdFx0REJHIFwiI3snICAgJy5yZXBlYXQobGV2ZWwpfTwtICN7bmFtZX0oI3tzdHJBcmdzfSlcIlxyXG5cdFx0cmV0dXJuXHJcblxyXG5cdCMgLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLlxyXG5cclxuXHRkYmcgOj0gKGxpbmU6IHN0cmluZykgPT5cclxuXHRcdERCRyBcIiN7JyAgICcucmVwZWF0KGxldmVsKX0tLSAje09MKGxpbmUpfVwiXHJcblx0XHRyZXR1cm5cclxuXHJcblx0IyAuLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uXHJcblxyXG5cdGRvTWFrZURpciA6PSAoXHJcblx0XHRcdGRpclBhdGg6IHN0cmluZ1xyXG5cdFx0XHQpOiB2b2lkID0+XHJcblxyXG5cdFx0cGF0aCA6PSByZWxwYXRoKGRpclBhdGgpXHJcblx0XHRsRmlsZU9wcy5wdXNoIHtcclxuXHRcdFx0ZnVuY05hbWU6ICdta0RpcidcclxuXHRcdFx0cGF0aFxyXG5cdFx0XHR9XHJcblx0XHRpZiBub3Qgc2NhZmZvbGRcclxuXHRcdFx0bWtEaXIgcGF0aCwgY2xlYXJcclxuXHRcdHJldHVyblxyXG5cclxuXHQjIC4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi5cclxuXHJcblx0ZG9CYXJmIDo9IChcclxuXHRcdFx0cGF0aDogc3RyaW5nLFxyXG5cdFx0XHRjb250ZW50czogc3RyaW5nXHJcblx0XHRcdCk6IHZvaWQgPT5cclxuXHJcblx0XHRsRmlsZU9wcy5wdXNoIHtcclxuXHRcdFx0ZnVuY05hbWU6IFwiYmFyZlwiXHJcblx0XHRcdHBhdGg6IHJlbHBhdGgocGF0aClcclxuXHRcdFx0Y29udGVudHNcclxuXHRcdFx0fVxyXG5cdFx0aWYgbm90IHNjYWZmb2xkXHJcblx0XHRcdGJhcmYgcGF0aCwgY29udGVudHNcclxuXHRcdFx0aWYgKGZpbGVFeHQocGF0aCkgPT0gJy5jaXZldCcpICYmIGNvbXBpbGVcclxuXHRcdFx0XHRjaXZldDJ0c0ZpbGUgcGF0aFxyXG5cdFx0cmV0dXJuXHJcblxyXG5cdCMgLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLlxyXG5cclxuXHRmaWxlSGFuZGxlciA6PSAoXHJcblx0XHRcdHBhdGg6IHN0cmluZyxcclxuXHRcdFx0bFRva2VuczogVFBMTFRva2VuW11cclxuXHRcdFx0KTogdm9pZCA9PlxyXG5cclxuXHRcdGRiZ0VudGVyICdmaWxlSGFuZGxlcicsIHBhdGhcclxuXHRcdGNvbnRlbnRzIDo9IGlmIGlzS2luZChsVG9rZW5zWzBdLCAnaW5kZW50JylcclxuXHRcdFx0bFRva2Vucy5zaGlmdCgpXHJcblx0XHRcdGxMaW5lcyA6PSBbXVxyXG5cdFx0XHRsZXQgbGV2ZWwgPSAwXHJcblx0XHRcdCMgQHRzLWlnbm9yZVxyXG5cdFx0XHR3aGlsZSAobGV2ZWwgPiAwKSB8fCBub3QgaXNLaW5kKGxUb2tlbnNbMF0sICd1bmRlbnQnKVxyXG5cdFx0XHRcdHRvayA6PSBsVG9rZW5zLnNoaWZ0KClcclxuXHRcdFx0XHRpZiBub3RkZWZpbmVkKHRvaylcclxuXHRcdFx0XHRcdGNyb2FrIFwiTm8gJ3VuZGVudCcgaW4gYmxvY2tcIlxyXG5cdFx0XHRcdGVsc2VcclxuXHRcdFx0XHRcdHN3aXRjaCB0b2sua2luZFxyXG5cdFx0XHRcdFx0XHR3aGVuICdpbmRlbnQnXHJcblx0XHRcdFx0XHRcdFx0bGV2ZWwgKz0gMVxyXG5cdFx0XHRcdFx0XHR3aGVuICd1bmRlbnQnXHJcblx0XHRcdFx0XHRcdFx0bGV2ZWwgLT0gMVxyXG5cdFx0XHRcdFx0XHRcdGFzc2VydCAobGV2ZWwgPj0gMCksIFwiTmVnYXRpdmUgbGV2ZWwgaW4gc2V0RGlyVHJlZSgpXCJcclxuXHRcdFx0XHRcdFx0d2hlbiAnZW1wdHknXHJcblx0XHRcdFx0XHRcdFx0bExpbmVzLnB1c2ggJydcclxuXHRcdFx0XHRcdFx0ZWxzZVxyXG5cdFx0XHRcdFx0XHRcdGlmIGRlZmluZWQodG9rLnN0cilcclxuXHRcdFx0XHRcdFx0XHRcdGxpbmUgOj0gaW5kZW50ZWQodG9rLnN0ciwge2xldmVsfSlcclxuXHRcdFx0XHRcdFx0XHRcdGRiZyBsaW5lXHJcblx0XHRcdFx0XHRcdFx0XHRsTGluZXMucHVzaCBsaW5lXHJcblxyXG5cdFx0XHQjIC0tLSBIRVJFOiAobGV2ZWwgPT0gMCkgQU5EIChsVG9rZW5zWzBdLmtpbmQgPT0gJ3VuZGVudCcpXHJcblx0XHRcdGFzc2VydCAobGV2ZWwgPT0gMCksIFwiYWZ0ZXIgZmlsZSBjb250ZW50cywgbGV2ZWwgPSAje09MKGxldmVsKX1cIlxyXG5cdFx0XHRhc3NlcnQgKGxUb2tlbnNbMF0ua2luZCA9PSAndW5kZW50JyksXHJcblx0XHRcdFx0XHRcIlVOREVOVCBleHBlY3RlZCBhZnRlciBjb250ZW50cywgZ290ICN7T0wobFRva2Vuc1swXSl9XCJcclxuXHRcdFx0bFRva2Vucy5zaGlmdCgpXHJcblx0XHRcdGxMaW5lcy5qb2luKCdcXG4nKVxyXG5cdFx0ZWxzZVxyXG5cdFx0XHQnJ1xyXG5cdFx0ZG9CYXJmIHBhdGgsIGNvbnRlbnRzXHJcblx0XHRkYmdFeGl0ICdmaWxlSGFuZGxlcicsIHBhdGhcclxuXHRcdHJldHVyblxyXG5cclxuXHQjIC4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi5cclxuXHJcblx0ZGlySGFuZGxlciA6PSAoXHJcblx0XHRcdHBhdGg6IHN0cmluZyxcclxuXHRcdFx0bFRva2VuczogVFBMTFRva2VuW11cclxuXHRcdFx0KTogdm9pZCA9PlxyXG5cclxuXHRcdGRiZ0VudGVyICdkaXJIYW5kbGVyJywgcGF0aFxyXG5cdFx0ZG9NYWtlRGlyIHBhdGhcclxuXHRcdGlmIChsVG9rZW5zLmxlbmd0aCA+IDApICYmIGlzS2luZChsVG9rZW5zWzBdLCAnaW5kZW50JylcclxuXHRcdFx0bFRva2Vucy5zaGlmdCgpXHJcblx0XHRcdGJsb2NrSGFuZGxlcihwYXRoLCBsVG9rZW5zKVxyXG5cdFx0XHQjIEB0cy1pZ25vcmVcclxuXHRcdFx0YXNzZXJ0IGlzS2luZChsVG9rZW5zWzBdLCAndW5kZW50JyksIFwiTWlzc2luZyBVTkRFTlQgaW4gZGlySGFuZGxlclwiXHJcblx0XHRcdGxUb2tlbnMuc2hpZnQoKVxyXG5cdFx0ZGJnRXhpdCAnZGlySGFuZGxlcicsIHBhdGhcclxuXHRcdHJldHVyblxyXG5cclxuXHQjIC4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi5cclxuXHJcblx0YmxvY2tIYW5kbGVyIDo9IChkaXJQYXRoOiBzdHJpbmcsIGxUb2tlbnM6IFRQTExUb2tlbltdKSA9PlxyXG5cdFx0ZGJnRW50ZXIgJ2Jsb2NrSGFuZGxlcicsIGRpclBhdGhcclxuXHRcdHdoaWxlIChsVG9rZW5zLmxlbmd0aCA+IDApICYmIChsVG9rZW5zWzBdLmtpbmQgIT0gJ3VuZGVudCcpXHJcblx0XHRcdHRvazogVFBMTFRva2VuIDo9IGxUb2tlbnNbMF1cclxuXHRcdFx0bFRva2Vucy5zaGlmdCgpXHJcblx0XHRcdHtraW5kLCBzdHJ9IDo9IHRva1xyXG5cdFx0XHRzd2l0Y2gga2luZFxyXG5cdFx0XHRcdHdoZW4gJ2luZGVudCdcclxuXHRcdFx0XHRcdGNyb2FrIFwiVW5leHBlY3RlZCBJTkRFTlRcIlxyXG5cdFx0XHRcdGVsc2VcclxuXHRcdFx0XHRcdGlmIGRlZmluZWQoc3RyKSAmJiBzdHIuc3RhcnRzV2l0aCgnLycpXHJcblx0XHRcdFx0XHRcdGRpckhhbmRsZXIgXCIje2RpclBhdGh9I3t0b2suc3RyfVwiLCBsVG9rZW5zXHJcblx0XHRcdFx0XHRlbHNlXHJcblx0XHRcdFx0XHRcdGZpbGVIYW5kbGVyIFwiI3tkaXJQYXRofS8je3Rvay5zdHJ9XCIsIGxUb2tlbnNcclxuXHRcdGRiZ0V4aXQgJ2Jsb2NrSGFuZGxlcidcclxuXHRcdHJldHVyblxyXG5cclxuXHQjIC4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi5cclxuXHJcblx0cHR5cGUgOj0gZ2V0UGF0aFR5cGUoY3VycmVudERpcilcclxuXHRhc3NlcnQgKHB0eXBlID09ICdkaXInKSB8fCAocHR5cGUgPT0gJ21pc3NpbmcnKSxcclxuXHRcdFx0XCJjdXJyZW50RGlyIGlzIGEgI3twdHlwZX1cIlxyXG5cclxuXHQjIC0tLSBDbGVhciB0aGUgZGlyZWN0b3J5IGlmIGl0IGV4aXN0c1xyXG5cdGRvTWFrZURpciBjdXJyZW50RGlyXHJcblxyXG5cdGxUb2tlbnMgOj0gQXJyYXkuZnJvbShhbGxUb2tlbnNJbkJsb2NrKGNvbnRlbnRzKSlcclxuXHREQkcgdG9rZW5UYWJsZShsVG9rZW5zKVxyXG5cclxuXHRibG9ja0hhbmRsZXIoY3VycmVudERpciwgbFRva2VucylcclxuXHRhc3NlcnQgKGxUb2tlbnMubGVuZ3RoID09IDApLFxyXG5cdFx0XHRcIlRva2VucyByZW1haW5pbmcgYWZ0ZXIgcGFyc2U6ICN7T0wobFRva2Vucyl9XCJcclxuXHRpZiBub3QgZGVidWdcclxuXHRcdHBvcExvZ0xldmVsKClcclxuXHRyZXR1cm4gbEZpbGVPcHNcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgZmlsZU9wc1RhYmxlIDo9IChsRmlsZU9wczogVEZpbGVPcFtdKTogc3RyaW5nID0+XHJcblxyXG5cdHR0IDo9IG5ldyBUZXh0VGFibGUoXCJsIGxcIilcclxuXHR0dC5mdWxsc2VwKClcclxuXHR0dC50aXRsZSAnRklMRSBPUFMnXHJcblx0dHQuZnVsbHNlcCgpXHJcblx0Zm9yIHtmdW5jTmFtZSwgcGF0aCwgY29udGVudHN9IG9mIGxGaWxlT3BzXHJcblx0XHRzd2l0Y2ggZnVuY05hbWVcclxuXHRcdFx0d2hlbiAnbWtEaXInXHJcblx0XHRcdFx0dHQuZGF0YSBbJ21rZGlyJywgcGF0aF1cclxuXHRcdFx0d2hlbiAnYmFyZidcclxuXHRcdFx0XHR0dC5kYXRhIFsnYmFyZicsIHBhdGhdXHJcblx0XHRcdFx0aWYgY29udGVudHNcclxuXHRcdFx0XHRcdGZvciBsaW5lIG9mIGNvbnRlbnRzLnNwbGl0KCdcXG4nKVxyXG5cdFx0XHRcdFx0XHR0dC5kYXRhIFsnJywgbGluZS5yZXBsYWNlKCdcXHQnLCBzcGFjZXMoMykpXVxyXG5cdHR0LmZ1bGxzZXAoKVxyXG5cdHJldHVybiB0dC5hc1N0cmluZygpXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4iXX0=