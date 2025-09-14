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
	pass, stringify, o, OL, keys, getOptions, spaces,
	} from 'llutils'
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
								const line = indented(tok.str, level)
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

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQzpcXFVzZXJzXFxqb2huZFxcdXRpbHNcXHNyY1xcbGliXFx1bml0LXRlc3QubGliLmNpdmV0LnRzeCIsInNvdXJjZXMiOlsiQzpcXFVzZXJzXFxqb2huZFxcdXRpbHNcXHNyY1xcbGliXFx1bml0LXRlc3QubGliLmNpdmV0Il0sIm1hcHBpbmdzIjoiO0FBQUEsc0JBQXFCO0FBQ3JCLEFBQUE7QUFDQSxBQUFBLE1BQU0sQ0FBQyxDQUFDO0FBQ1IsQ0FBQyxNQUFNLENBQUMsQ0FBQyxZQUFZLENBQUMsQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDLGVBQWUsQ0FBQztBQUMzRCxDQUFDLGlCQUFpQixDQUFDO0FBQ25CLENBQUMsb0JBQW9CLENBQUMsQ0FBQyxXQUFXLENBQUMsQ0FBQyxtQkFBbUIsQ0FBQztBQUN4RCxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsYUFBYTtBQUNyQixBQUFBO0FBQ0EsQUFBQSxBQUFBLE1BQU0sQ0FBQyxDQUFDO0FBQ1IsQ0FBQyxLQUFLLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxRQUFRLENBQUM7QUFDL0MsQ0FBQyxLQUFLLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxJQUFJLENBQUM7QUFDakQsQ0FBQyxNQUFNLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxPQUFPLENBQUM7QUFDbEQsQ0FBQyxlQUFlLENBQUMsQ0FBQyxZQUFZLENBQUMsQ0FBQyxhQUFhLENBQUM7QUFDOUMsQ0FBQyxhQUFhLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxLQUFLLENBQUM7QUFDaEMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFdBQVc7QUFDbkIsQUFBQSxBQUFBLE1BQU0sQ0FBQyxDQUFDO0FBQ1IsQ0FBQyxJQUFJLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxD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QTtBQUNBO0FBQ0E7QUFDQSxHQUFHO0FBQ0gsQUFBQTtBQUNBLEFBQUEsQUFBQSxNQUFNLENBQU8sTUFBTixNQUFNLENBQUMsQ0FBRSxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFBLENBQUE7QUFDMUMsQUFBQTtBQUNBLEFBQUEsQ0FBSyxNQUFKLElBQUksQ0FBQyxDQUFFLENBQUMsV0FBVyxDQUFDLENBQUM7QUFDdEIsQUFBQSxDQUFDLEdBQUcsQ0FBQSxBQUFDLENBQUMsT0FBTyxFQUFFLFNBQVMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQzNDLEFBQUEsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFBLEFBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLE1BQU0sQ0FBQSxBQUFDLEtBQUssQ0FBQSxDQUFBO0FBQ25DLEFBQUEsQ0FBQyxNO0FBQU0sQ0FBQTtBQUNQLEFBQUE7QUFDQSxBQUFBLDhFQUE2RTtBQUM3RSxBQUFBO0FBQ0EsQUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxHQUFHO0FBQ0gsQUFBQTtBQUNBLEFBQUEsQUFBQSxNQUFNLENBQU0sTUFBTCxLQUFLLENBQUMsQ0FBRSxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFBLENBQUE7QUFDekMsQUFBQTtBQUNBLEFBQUEsQ0FBSyxNQUFKLElBQUksQ0FBQyxDQUFFLENBQUMsV0FBVyxDQUFDLENBQUM7QUFDdEIsQUFBQSxDQUFDLEdBQUcsQ0FBQSxBQUFDLENBQUMsTUFBTSxFQUFFLFNBQVMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQzFDLEFBQUEsQ0FBQyxJQUFJLENBQUMsSUFBSSxD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LENBQUEsQ0FBQSxDQUFBO0FBQ2pCLEFBQUEsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFBLENBQUEsQ0FBQTtBQUNmLEFBQUEsSUFBSSxFQUFFLENBQUMsSUFBSSxDQUFBLEFBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQSxPO0dBQUEsQ0FBQTtBQUMzQixBQUFBLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQSxDQUFBLENBQUE7QUFDZCxBQUFBLElBQUksRUFBRSxDQUFDLElBQUksQ0FBQSxBQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUE7QUFDMUIsQUFBQSxJQUFJLEdBQUcsQ0FBQSxRQUFRLENBQUEsQ0FBQSxDQUFBO0FBQ2YsQUFBQSxLQUFLLEdBQUcsQ0FBQyxDQUFBLE1BQUEsSUFBSSxDQUFDLEVBQUUsQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFBLENBQUEsQ0FBQTtBQUNyQyxBQUFBLE1BQU0sRUFBRSxDQUFDLElBQUksQ0FBQSxBQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDO0tBQUEsQztJQUFBLENBQUEsTztHQUFBLEM7RUFBQSxDO0NBQUEsQ0FBQTtBQUNqRCxBQUFBLENBQUMsRUFBRSxDQUFDLE9BQU8sQ0FBQyxDQUFDO0FBQ2IsQUFBQSxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsUUFBUSxDQUFDLEM7QUFBQyxDQUFBO0FBQ3JCO0FBQ0EsQUFBQSw4RUFBNkU7QUFDN0UiLCJuYW1lcyI6W10sInNvdXJjZXNDb250ZW50IjpbIiMgdW5pdC10ZXN0LmxpYi5jaXZldFxyXG5cclxuaW1wb3J0IHtcclxuXHRhc3NlcnQsIGFzc2VydEVxdWFscywgYXNzZXJ0U3RyaWN0RXF1YWxzLCBhc3NlcnROb3RFcXVhbHMsXHJcblx0YXNzZXJ0T2JqZWN0TWF0Y2gsXHJcblx0YXNzZXJ0U3RyaW5nSW5jbHVkZXMsIGFzc2VydE1hdGNoLCBhc3NlcnRBcnJheUluY2x1ZGVzLFxyXG5cdH0gZnJvbSAnQHN0ZC9hc3NlcnQnXHJcblxyXG5pbXBvcnQge1xyXG5cdHVuZGVmLCBkZWZpbmVkLCBub3RkZWZpbmVkLCBpc0VtcHR5LCBub25FbXB0eSxcclxuXHRhcnJheSwgYXJyYXlvZiwgaXNBcnJheSwgaXNIYXNoLCBpc1N0cmluZywgaGFzaCxcclxuXHRoYXNob2YsIGlzSXRlcmFibGUsIGRlZXBFcXVhbCwgaGFzaExpa2UsIGludGVnZXIsXHJcblx0VE9iakNvbXBhcmVGdW5jLCBUT2JqTGlrZUZ1bmMsIFRUb1N0cmluZ0Z1bmMsXHJcblx0bm9ybWFsaXplQ29kZSwgdm9pZEZ1bmMsIGNyb2FrLFxyXG5cdH0gZnJvbSAnZGF0YXR5cGVzJ1xyXG5pbXBvcnQge1xyXG5cdHBhc3MsIHN0cmluZ2lmeSwgbywgT0wsIGtleXMsIGdldE9wdGlvbnMsIHNwYWNlcyxcclxuXHR9IGZyb20gJ2xsdXRpbHMnXHJcbmltcG9ydCB7aW5kZW50ZWR9IGZyb20gJ2luZGVudCdcclxuaW1wb3J0IHtUZXh0VGFibGV9IGZyb20gJ3RleHQtdGFibGUnXHJcbmltcG9ydCB7XHJcblx0cHVzaExvZ0xldmVsLCBwb3BMb2dMZXZlbCxcclxuXHREQkcsIExPRywgTE9HVkFMVUUsIERCR1ZBTFVFLCBJTkRFTlQsIFVOREVOVCxcclxuXHR9IGZyb20gJ2xvZ2dlcidcclxuaW1wb3J0IHtyZWxwYXRoLCBta0RpciwgYmFyZiwgZ2V0UGF0aFR5cGUsIGZpbGVFeHR9IGZyb20gJ2ZzeXMnXHJcbmltcG9ydCB7VFBMTFRva2VuLCBpc0tpbmQsIGFsbFRva2Vuc0luQmxvY2ssIHRva2VuVGFibGV9IGZyb20gJ3BsbCdcclxuaW1wb3J0IHtjaGVja1R5cGV9IGZyb20gJ3R5cGVzY3JpcHQnXHJcbmltcG9ydCB7Y2l2ZXQydHNGaWxlfSBmcm9tICdjaXZldCdcclxuaW1wb3J0IHtnZXRNeU91dHNpZGVDYWxsZXJ9IGZyb20gJ3Y4LXN0YWNrJ1xyXG5pbXBvcnQge1xyXG5cdHNvdXJjZUxpYiwgZ2V0TmVlZGVkSW1wb3J0U3RtdHMsXHJcblx0fSBmcm9tICdzeW1ib2xzJ1xyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbi8qKlxyXG4gKiBHZW5lcmF0ZSBhIHRlc3QgbmFtZSB1c2luZyB0aGUgc291cmNlIGxpbmUgbnVtYmVyXHJcbiAqL1xyXG5cclxuZ2V0VGVzdE5hbWUgOj0gKCk6IHN0cmluZyA9PlxyXG5cclxuXHRwdXNoTG9nTGV2ZWwgJ3NpbGVudCdcclxuXHRmcmFtZSA6PSBnZXRNeU91dHNpZGVDYWxsZXIoKVxyXG5cdGxpbmUgOj0gKGZyYW1lID09IHVuZGVmKSA/IDAgOiBmcmFtZS5saW5lXHJcblx0cG9wTG9nTGV2ZWwoKVxyXG5cdERCRyBcIlRFU1QgTkFNRTogbGluZSAje2xpbmV9XCJcclxuXHRyZXR1cm4gXCJsaW5lICN7bGluZX1cIlxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbi8qKlxyXG4gKiBJbiBhIHVuaXQgdGVzdCwgY2hlY2tzIGlmICB2YWx1ZSBpcyBkZWVwbHkgZXF1YWwgdG9cclxuICogdGhlIGV4cGVjdGVkIHZhbHVlLiBSZXBvcnRzIGxpbmUgbnVtYmVyIG9mIHRoZSB0ZXN0LlxyXG4gKlxyXG4gKiBAcGFyYW0ge2FueX0gdmFsdWUgLSBhbnkgSmF2YVNjcmlwdCB2YWx1ZVxyXG4gKiBAcGFyYW0ge2FueX0gZXhwZWN0ZWQgLSBhbnkgSmF2YVNjcmlwdCB2YWx1ZVxyXG4gKiBAcmV0dXJucyB7dm9pZH0gLSBub3RoaW5nXHJcbiAqXHJcbiAqIEBleGFtcGxlXHJcbiAqIGBgYGpzXHJcbiAqIGVxdWFsIDIrMiwgNFxyXG4gKiBgYGBcclxuICogVGhpcyB0ZXN0IHdpbGwgcGFzcy5cclxuICovXHJcblxyXG5leHBvcnQgZXF1YWwgOj0gKHZhbHVlOiB1bmtub3duLCBleHBlY3RlZDogdW5rbm93bikgOiB2b2lkID0+XHJcblxyXG5cdG5hbWUgOj0gZ2V0VGVzdE5hbWUoKVxyXG5cdERCRyBcImVxdWFsID8sICN7c3RyaW5naWZ5KGV4cGVjdGVkKX0gKCN7bmFtZX0pXCJcclxuXHREZW5vLnRlc3QgbmFtZSwgKCkgPT4gYXNzZXJ0RXF1YWxzKHZhbHVlLCBleHBlY3RlZClcclxuXHRyZXR1cm5cclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgc2FtZSA6PSAodmFsdWU6IHVua25vd24sIGV4cGVjdGVkOiB1bmtub3duKSA6IHZvaWQgPT5cclxuXHJcblx0bmFtZSA6PSBnZXRUZXN0TmFtZSgpXHJcblx0REJHIFwic2FtZSA/LCAje3N0cmluZ2lmeShleHBlY3RlZCl9ICgje25hbWV9KVwiXHJcblx0RGVuby50ZXN0IG5hbWUsICgpID0+IGFzc2VydFN0cmljdEVxdWFscyh2YWx1ZSwgZXhwZWN0ZWQpXHJcblx0cmV0dXJuXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuLyoqXHJcbiAqIEluIGEgdW5pdCB0ZXN0LCB0ZXN0cyBpZiB2YWx1ZSBpcyB0cnV0aHlcclxuICogUmVwb3J0cyBsaW5lIG51bWJlciBvZiB0aGUgdGVzdC5cclxuXHJcbiAqIEBwYXJhbSB7YW55fSB2YWx1ZSAtIGFueSBKYXZhU2NyaXB0IHZhbHVlXHJcbiAqIEByZXR1cm5zIHt2b2lkfSAtIG5vdGhpbmdcclxuICpcclxuICogQGV4YW1wbGVcclxuICogYGBganNcclxuICogdHJ1dGh5IGlzU3RyaW5nKCdhYmMnKVxyXG4gKiBgYGBcclxuICogVGhpcyB0ZXN0IHdpbGwgcGFzcy5cclxuICovXHJcblxyXG5leHBvcnQgdHJ1dGh5IDo9ICh2YWx1ZTogdW5rbm93bik6IHZvaWQgPT5cclxuXHJcblx0bmFtZSA6PSBnZXRUZXN0TmFtZSgpXHJcblx0REJHIFwidHJ1dGh5ICN7c3RyaW5naWZ5KHZhbHVlKX0gKCN7bmFtZX0pXCJcclxuXHREZW5vLnRlc3QgbmFtZSwgKCkgPT4gYXNzZXJ0IHZhbHVlXHJcblx0cmV0dXJuXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuLyoqXHJcbiAqIEluIGEgdW5pdCB0ZXN0LCB0ZXN0cyBpZiB2YWx1ZSBpcyBmYWxzeVxyXG4gKiBSZXBvcnRzIGxpbmUgbnVtYmVyIG9mIHRoZSB0ZXN0LlxyXG4gKlxyXG4gKiBAcGFyYW0ge2FueX0gdmFsdWUgLSBhbnkgSmF2YVNjcmlwdCB2YWx1ZVxyXG4gKiBAcmV0dXJucyB7dm9pZH0gLSBub3RoaW5nXHJcbiAqXHJcbiAqIEBleGFtcGxlXHJcbiAqIGBgYGpzXHJcbiAqIGZhbHN5IGlzU3RyaW5nKDQyKVxyXG4gKiBgYGBcclxuICogVGhpcyB0ZXN0IHdpbGwgcGFzcy5cclxuICovXHJcblxyXG5leHBvcnQgZmFsc3kgOj0gKHZhbHVlOiB1bmtub3duKTogdm9pZCA9PlxyXG5cclxuXHRuYW1lIDo9IGdldFRlc3ROYW1lKClcclxuXHREQkcgXCJmYWxzeSAje3N0cmluZ2lmeSh2YWx1ZSl9ICgje25hbWV9KVwiXHJcblx0RGVuby50ZXN0IG5hbWUsICgpID0+IGFzc2VydCAobm90IHZhbHVlKVxyXG5cdHJldHVyblxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbi8qKlxyXG4gKiBJbiBhIHVuaXQgdGVzdCwgdGVzdHMgaWYgY2FsbGluZyB0aGUgcHJvdmlkZWQgZnVuY3Rpb25cclxuICogdGhyb3dzIGFuIGV4Y2VwdGlvbi4gUmVwb3J0cyBsaW5lIG51bWJlciBvZiB0aGUgdGVzdC5cclxuICpcclxuICogQHBhcmFtIHthbnkgPT4gYW55fSBmdW5jIC0gYW55IEphdmFTY3JpcHQgZnVuY3Rpb25cclxuICogQHJldHVybnMge3ZvaWR9IC0gbm90aGluZ1xyXG4gKlxyXG4gKiBAZXhhbXBsZVxyXG4gKiBgYGBqc1xyXG4gKiBmYWlscyAoKSA9PiB0aHJvdyBuZXcgRXJyb3IoJ2JhZCcpXHJcbiAqIGBgYFxyXG4gKiBUaGlzIHRlc3Qgd2lsbCBwYXNzLlxyXG4gKi9cclxuXHJcbmV4cG9ydCBmYWlscyA6PSAoZnVuYzogdm9pZEZ1bmMpOiB2b2lkID0+XHJcblxyXG5cdHB1c2hMb2dMZXZlbCAnc2lsZW50JyAgICAjIC0tLSBzaWxlbmNlIGFueSBlcnJvcnMgZ2VuZXJhdGVkXHJcblx0bmFtZSA6PSBnZXRUZXN0TmFtZSgpXHJcblx0REJHIFwiZmFpbHMgPGZ1bmM+ICgje25hbWV9KVwiXHJcblx0RGVuby50ZXN0IG5hbWUsICgpID0+XHJcblx0XHR0cnlcclxuXHRcdFx0ZnVuYygpXHJcblx0XHRcdHBvcExvZ0xldmVsKClcclxuXHRcdFx0dGhyb3cgbmV3IEVycm9yKFwiVGVzdCBGYWlsdXJlIC0gZnVuY3Rpb24gc3VjY2VlZHMhISFcIilcclxuXHRcdGNhdGNoIGVyclxyXG5cdFx0XHRwb3BMb2dMZXZlbCgpXHJcblxyXG5cdHJldHVyblxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbi8qKlxyXG4gKiBJbiBhIHVuaXQgdGVzdCwgdGVzdHMgaWYgY2FsbGluZyB0aGUgcHJvdmlkZWQgZnVuY3Rpb25cclxuICogcnVucyB3aXRob3V0IHRocm93aW5nIGFuIGV4Y2VwdGlvbi5cclxuICogUmVwb3J0cyBsaW5lIG51bWJlciBvZiB0aGUgdGVzdC5cclxuICpcclxuICogQHBhcmFtIHthbnkgPT4gYW55fSBmdW5jIC0gYW55IEphdmFTY3JpcHQgZnVuY3Rpb25cclxuICogQHJldHVybnMge3ZvaWR9IC0gbm90aGluZ1xyXG4gKlxyXG4gKiBAZXhhbXBsZVxyXG4gKiBgYGBqc1xyXG4gKiBzdWNjZWVkcyAoKSA9PiByZXR1cm4gNDJcclxuICogYGBgXHJcbiAqIFRoaXMgdGVzdCB3aWxsIHBhc3MuXHJcbiAqL1xyXG5cclxuZXhwb3J0IHN1Y2NlZWRzIDo9IChmdW5jOiB2b2lkRnVuYyk6IHZvaWQgPT5cclxuXHJcblx0YXNzZXJ0ICh0eXBlb2YgZnVuYyA9PSAnZnVuY3Rpb24nKSwgXCJ0ZXN0IHN1Y2NlZWRzKCkgcGFzc2VkIG5vbi1mdW5jdGlvblwiXHJcblx0bmFtZSA6PSBnZXRUZXN0TmFtZSgpXHJcblx0REJHIFwic3VjY2VlZHMgPGZ1bmM+ICgje25hbWV9KVwiXHJcblx0RGVuby50ZXN0IG5hbWUsICgpID0+XHJcblx0XHR0cnlcclxuXHRcdFx0ZnVuYygpXHJcblx0XHRjYXRjaCBlcnJcclxuXHRcdFx0IyBAdHMtaWdub3JlXHJcblx0XHRcdG1zZyA6PSBlcnIubWVzc2FnZVxyXG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoXCJGQUlMIC0gZnVuYyB0aHJvd3MgKCN7bXNnfSlcIilcclxuXHRyZXR1cm5cclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgaXRlckVxdWFsIDo9IChpdGVyOiBJdGVyYWJsZTx1bmtub3duPiwgZXhwZWN0ZWQ6IHVua25vd25bXSkgPT5cclxuXHJcblx0bmFtZSA6PSBnZXRUZXN0TmFtZSgpXHJcblx0REJHIFwiaXRlckVxdWFsID8sICN7c3RyaW5naWZ5KGV4cGVjdGVkKX0gKCN7bmFtZX0pXCJcclxuXHREZW5vLnRlc3QgbmFtZSwgKCkgPT4gYXNzZXJ0RXF1YWxzIEFycmF5LmZyb20oaXRlciksIGV4cGVjdGVkXHJcblx0cmV0dXJuXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuZXhwb3J0IGl0ZXJMaWtlIDo9IChpdGVyOiBJdGVyYWJsZTxoYXNoPiwgZXhwZWN0ZWQ6IGhhc2hbXSkgPT5cclxuXHJcblx0bmFtZSA6PSBnZXRUZXN0TmFtZSgpXHJcblx0REJHIFwiaXRlckVxdWFsID8sICN7c3RyaW5naWZ5KGV4cGVjdGVkKX0gKCN7bmFtZX0pXCJcclxuXHJcblx0bEl0ZW1zIDo9IEFycmF5LmZyb20oaXRlcilcclxuXHRsZW4gOj0gbEl0ZW1zLmxlbmd0aFxyXG5cdERlbm8udGVzdCBcIiN7bmFtZX0vbGVuXCIsICgpID0+IGFzc2VydEVxdWFscyBsZW4sIGV4cGVjdGVkLmxlbmd0aFxyXG5cdGZvciBpIG9mIFswLi5sZW4tMV1cclxuXHRcdCMgQHRzLWlnbm9yZVxyXG5cdFx0RGVuby50ZXN0IFwiI3tuYW1lfS8je2l9XCIsICgpID0+IGFzc2VydE9iamVjdE1hdGNoIGxJdGVtc1tpXSwgZXhwZWN0ZWRbaV1cclxuXHRyZXR1cm5cclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG4vKipcclxuICogSW4gYSB1bml0IHRlc3QsIHRlc3RzIGEgdmFsdWUsIHdoaWNoIG11c3QgYmUgYSBzdHJpbmcsXHJcbiAqIG1hdGNoZXMgZWl0aGVyIGEgc3Vic3RyaW5nIG9yIGEgcmVndWxhciBleHByZXNzaW9uLlxyXG4gKiBSZXBvcnRzIGxpbmUgbnVtYmVyIG9mIHRoZSB0ZXN0LlxyXG4gKlxyXG4gKiBAcGFyYW0ge2FueX0gdmFsdWUgLSBhbnkgSmF2YVNjcmlwdCB2YWx1ZVxyXG4gKiBAcGFyYW0ge2FueX0gZXhwZWN0ZWQgLSBhbnkgSmF2YVNjcmlwdCB2YWx1ZVxyXG4gKiBAcmV0dXJucyB7dm9pZH0gLSBub3RoaW5nXHJcbiAqXHJcbiAqIEBleGFtcGxlXHJcbiAqIGBgYGpzXHJcbiAqIG1hdGNoZXMgJ2FiY2RlJywgJ2JjZSdcclxuICogYGBgXHJcbiAqIFRoaXMgdGVzdCB3aWxsIHBhc3MuXHJcbiAqXHJcbiAqIEBleGFtcGxlXHJcbiAqIGBgYGpzXHJcbiAqIG1hdGNoZXMgJ2FhYmJjYycsIC9hK2IrYysvXHJcbiAqIGBgYFxyXG4gKiBUaGlzIHRlc3Qgd2lsbCBwYXNzLlxyXG4gKi9cclxuXHJcbmV4cG9ydCBtYXRjaGVzIDo9ICh2YWx1ZTogdW5rbm93biwgZXhwZWN0ZWQ6IHVua25vd24pID0+XHJcblxyXG5cdGFzc2VydCBpc1N0cmluZyh2YWx1ZSksIFwiTm90IGEgc3RyaW5nOiAje3ZhbHVlfVwiXHJcblx0bmFtZSA6PSBnZXRUZXN0TmFtZSgpXHJcblx0REJHIFwibWF0Y2hlcyA/LCAje3N0cmluZ2lmeShleHBlY3RlZCl9ICgje25hbWV9KVwiXHJcblx0aWYgaXNTdHJpbmcoZXhwZWN0ZWQpXHJcblx0XHREZW5vLnRlc3QgbmFtZSwgKCkgPT4gYXNzZXJ0U3RyaW5nSW5jbHVkZXMgdmFsdWUsIGV4cGVjdGVkXHJcblx0ZWxzZSBpZiAoZXhwZWN0ZWQgaW5zdGFuY2VvZiBSZWdFeHApXHJcblx0XHREZW5vLnRlc3QgbmFtZSwgKCkgPT4gYXNzZXJ0TWF0Y2ggdmFsdWUsIGV4cGVjdGVkXHJcblx0ZWxzZVxyXG5cdFx0RGVuby50ZXN0IG5hbWUsICgpID0+IGFzc2VydCBmYWxzZVxyXG5cdHJldHVyblxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbi8qKlxyXG4gKiBJbiBhIHVuaXQgdGVzdCwgdGVzdHMgaWYgb25lIGhhc2ggbWF0Y2hlcyBhbm90aGVyIGhhc2guXHJcbiAqIHRoZSBmaXJzdCBoYXNoIG11c3QgaGF2ZSBhbGwgdGhlIHByb3BlcnRpZXMgaW4gdGhlIHNlY29uZCBoYXNoLFxyXG4gKiBidXQgZXh0cmEgcHJvcGVydGllcyBhcmUgYWxsb3dlZC5cclxuICogUmVwb3J0cyBsaW5lIG51bWJlciBvZiB0aGUgdGVzdC5cclxuICpcclxuICogQHBhcmFtIHtoYXNofSB2YWx1ZSAtIGFueSBKYXZhU2NyaXB0IG9iamVjdFxyXG4gKiBAcGFyYW0ge2hhc2h9IGV4cGVjdGVkIC0gYW55IEphdmFTY3JpcHQgb2JqZWN0XHJcbiAqIEByZXR1cm5zIHt2b2lkfSAtIG5vdGhpbmdcclxuICpcclxuICogQGV4YW1wbGVcclxuICogYGBganNcclxuICogbGlrZSB7YToxLCBiOjIsIGM6M30sIHthOjEsIGM6M31cclxuICogYGBgXHJcbiAqIFRoaXMgdGVzdCB3aWxsIHBhc3MuXHJcbiAqL1xyXG5cclxuZXhwb3J0IGxpa2UgOj0gKHZhbHVlOiBvYmplY3Q/LCBleHBlY3RlZDogaGFzaCk6IHZvaWQgPT5cclxuXHJcblx0bmFtZSA6PSBnZXRUZXN0TmFtZSgpXHJcblx0REJHIFwibGlrZSA/LCAje3N0cmluZ2lmeShleHBlY3RlZCl9ICgje25hbWV9KVwiXHJcblx0aWYgbm90ZGVmaW5lZCh2YWx1ZSlcclxuXHRcdERlbm8udGVzdCBuYW1lLCAoKSA9PiBhc3NlcnRFcXVhbHMgdmFsdWUsIHVuZGVmXHJcblx0ZWxzZVxyXG5cdFx0RGVuby50ZXN0IG5hbWUsICgpID0+IGFzc2VydE9iamVjdE1hdGNoIHZhbHVlLCBleHBlY3RlZFxyXG5cdHJldHVyblxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbmV4cG9ydCBjb2RlTGlrZSA6PSAodmFsdWU6IHN0cmluZywgZXhwZWN0ZWQ6IHN0cmluZyk6IHZvaWQgPT5cclxuXHJcblx0bmFtZSA6PSBnZXRUZXN0TmFtZSgpXHJcblx0REJHIFwiY29kZUxpa2UgPywgI3tzdHJpbmdpZnkoZXhwZWN0ZWQpfSAoI3tuYW1lfSlcIlxyXG5cdERlbm8udGVzdCBuYW1lLCAoKSA9PlxyXG5cdFx0YXNzZXJ0RXF1YWxzIG5vcm1hbGl6ZUNvZGUodmFsdWUpLCBub3JtYWxpemVDb2RlKGV4cGVjdGVkKVxyXG5cdHJldHVyblxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbmV4cG9ydCBzdHJMaXN0TGlrZSA6PSAoXHJcblx0XHR2YWx1ZTogc3RyaW5nW11cclxuXHRcdGV4cGVjdGVkOiBzdHJpbmdbXVxyXG5cdFx0KTogdm9pZCA9PlxyXG5cclxuXHRuYW1lIDo9IGdldFRlc3ROYW1lKClcclxuXHREQkcgXCJzdHJMaXN0TGlrZSA/LCAje3N0cmluZ2lmeShleHBlY3RlZCwge3RydW5jOiA2NH0pfVwiXHJcblxyXG5cdGxlbiA6PSB2YWx1ZS5sZW5ndGhcclxuXHREZW5vLnRlc3QgXCIje25hbWV9L2xlblwiLCAoKSA9PiBhc3NlcnRFcXVhbHMgbGVuLCBleHBlY3RlZC5sZW5ndGhcclxuXHJcblx0aWYgKGxlbiA9PSAwKVxyXG5cdFx0cmV0dXJuXHJcblxyXG5cdGxWYWx1ZXMgOj0gdmFsdWUudG9Tb3J0ZWQoKVxyXG5cdGxFeHBlY3RlZCA6PSBleHBlY3RlZC50b1NvcnRlZCgpXHJcblx0Zm9yIGkgb2YgWzAuLmxlbi0xXVxyXG5cdFx0dmFsIDo9IGxWYWx1ZXNbaV1cclxuXHRcdGV4cCA6PSBsRXhwZWN0ZWRbaV1cclxuXHRcdCMgQHRzLWlnbm9yZVxyXG5cdFx0RGVuby50ZXN0IFwiI3tuYW1lfS8je2l9XCIsICgpID0+IGFzc2VydEVxdWFscyh2YWwsIGV4cClcclxuXHRyZXR1cm5cclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG4vKipcclxuICogSW4gYSB1bml0IHRlc3QsIHRlc3RzIGlmIGVhY2ggT2JqZWN0IGluIGFuIGFycmF5IG1hdGNoZXNcclxuICogZWFjaCBvYmplY3QgaW4gYW5vdGhlciBhcnJheS4gVGhlIDIgYXJyYXlzIG11c3QgYmUgb2YgdGhlXHJcbiAqIHNhbWUgbGVuZ3RoLiBJZiBhIGZ1bmN0aW9uIGlzIHBhc3NlZCBhcyB0aGUgM3JkIHBhcmFtZXRlcixcclxuICogdGhlbiBlYWNoIGFycmF5IGlzIGZpcnN0IHNvcnRlZCBieSB1c2luZyB0aGUgZnVuY3Rpb24gdG9cclxuICogY29udmVydCBlYWNoIG9iamVjdCB0byBhIHN0cmluZywgdGhlbiBzb3J0aW5nIHRoZSBhcnJheVxyXG4gKiB1c2luZyB0aG9zZSBzdHJpbmdzLlxyXG4gKiBBIG1hdGNoaW5nIGZ1bmN0aW9uIGNhbiBhbHNvIGJlIHByb3ZpZGVkIGFzIHRoZSA0dGggYXJndW1lbnQuXHJcbiAqIEJ5IGRlZmF1bHQsIHRoZSBmdW5jdGlvbiBoYXNoTGlrZSAoZnJvbSBsbHV0aWxzLmxpYikgaXMgdXNlZC5cclxuICogUmVwb3J0cyBsaW5lIG51bWJlciBvZiB0aGUgdGVzdC5cclxuICpcclxuICogQHBhcmFtIHthcnJheSB8IG9iamVjdH0gdmFsdWUgLSBhbnkgSmF2YVNjcmlwdCB2YWx1ZVxyXG4gKiBAcGFyYW0ge2FycmF5IHwgb2JqZWN0fSBleHBlY3RlZCAtIGFueSBKYXZhU2NyaXB0IHZhbHVlXHJcbiAqIEByZXR1cm5zIHt2b2lkfSAtIG5vdGhpbmdcclxuICpcclxuICogQGV4YW1wbGVcclxuICogYGBganNcclxuICogbGlrZSB7YToxLCBiOjIsIGM6M30sIHthOjEsIGM6M31cclxuICogYGBgXHJcbiAqIFRoaXMgdGVzdCB3aWxsIHBhc3MuXHJcbiAqXHJcbiAqIEBleGFtcGxlXHJcbiAqIGBgYGpzXHJcbiAqIGxpa2UgW3thOjEsIGI6MiwgYzozfSwge2E6MywgYjo1LCBjOjIzfV0sIFt7YToxLCBiOjJ9XVxyXG4gKiBgYGBcclxuICogVGhpcyB0ZXN0IHdpbGwgcGFzcy5cclxuICovXHJcblxyXG5leHBvcnQgb2JqTGlzdExpa2UgOj0gKFxyXG5cdFx0dmFsdWU6IGhhc2hbXVxyXG5cdFx0ZXhwZWN0ZWQ6IGhhc2hbXVxyXG5cdFx0c3RyRnVuYzogVFRvU3RyaW5nRnVuYz8gPSB1bmRlZiAgICAgIyB1c2VkIGZvciBzb3J0aW5nIGlmIGRlZmluZWRcclxuXHRcdGxpa2VGdW5jOiBUT2JqTGlrZUZ1bmMgPSBoYXNoTGlrZSAgICMgdXNlZCBmb3IgY29tcGFyaXNvblxyXG5cdFx0KTogdm9pZCA9PlxyXG5cclxuXHRuYW1lIDo9IGdldFRlc3ROYW1lKClcclxuXHREQkcgXCJvYmpMaXN0TGlrZSA/LCAje3N0cmluZ2lmeShleHBlY3RlZCwge3RydW5jOiA2NH0pfVwiXHJcblx0REJHIFwic3RyRnVuYyBpcyAje09MKHN0ckZ1bmMpfVwiXHJcblxyXG5cdGxlbiA6PSB2YWx1ZS5sZW5ndGhcclxuXHREZW5vLnRlc3QgXCIje25hbWV9L2xlblwiLCAoKSA9PiBhc3NlcnRFcXVhbHMgbGVuLCBleHBlY3RlZC5sZW5ndGhcclxuXHJcblx0aWYgKGxlbiA9PSAwKVxyXG5cdFx0cmV0dXJuXHJcblxyXG5cdCMgLS0tIGNyZWF0ZSB0aGUgYXJyYXlzIHRvIGFjdHVhbGx5IGJlIGNvbXBhcmVkXHJcblx0bGV0IGxWYWxzOiBoYXNoW10gPSB2YWx1ZVxyXG5cclxuXHRpZiBkZWZpbmVkKHN0ckZ1bmMpXHJcblx0XHRjb21wYXJlRnVuYzogVE9iakNvbXBhcmVGdW5jIDo9IChhOiBoYXNoLCBiOiBoYXNoKSA9PlxyXG5cdFx0XHRzdHIxIDo9IHN0ckZ1bmMoYSlcclxuXHRcdFx0c3RyMiA6PSBzdHJGdW5jKGIpXHJcblx0XHRcdHJldHVybiAoc3RyMSA8IHN0cjIpID8gLTEgOiAoc3RyMSA+IHN0cjIpID8gMSA6IDBcclxuXHRcdGxWYWxzID0gdmFsdWUudG9Tb3J0ZWQoY29tcGFyZUZ1bmMpXHJcblxyXG5cdG5WYWxzIDo9IGxWYWxzLmxlbmd0aFxyXG5cdERCRyBcImxWYWxzIGlzIGFycmF5IG9mIGxlbmd0aCAje25WYWxzfVwiXHJcblxyXG5cdGxldCBsRXhwOiBoYXNoW10gPSB2YWx1ZVxyXG5cdGlmIGRlZmluZWQoc3RyRnVuYylcclxuXHRcdERCRyBcInN0ckZ1bmMgZGVmaW5lZFwiXHJcblx0XHRjb21wYXJlRnVuYzogVE9iakNvbXBhcmVGdW5jIDo9IChhOiBoYXNoLCBiOiBoYXNoKSA9PlxyXG5cdFx0XHRzdHIxIDo9IHN0ckZ1bmMoYSlcclxuXHRcdFx0c3RyMiA6PSBzdHJGdW5jKGIpXHJcblx0XHRcdHJldHVybiAoc3RyMSA8IHN0cjIpID8gLTEgOiAoc3RyMSA+IHN0cjIpID8gMSA6IDBcclxuXHRcdGxFeHAgPSBleHBlY3RlZC50b1NvcnRlZChjb21wYXJlRnVuYylcclxuXHJcblx0bkV4cCA6PSBsRXhwLmxlbmd0aFxyXG5cdERCRyBcImxFeHAgaXMgYXJyYXkgb2YgbGVuZ3RoICN7bkV4cH1cIlxyXG5cclxuXHRmb3IgaSBvZiBbMC4ubGVuLTFdXHJcblx0XHQjIEB0cy1pZ25vcmVcclxuXHRcdERlbm8udGVzdCBcIiN7bmFtZX0vI3tpfVwiLCAoKSA9PiBhc3NlcnQgbGlrZUZ1bmMobFZhbHNbaV0sIGxFeHBbaV0pXHJcblx0cmV0dXJuXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuLyoqXHJcbiAqIEluIGEgdW5pdCB0ZXN0LCB0ZXN0cyBhIHZhbHVlLCB3aGljaCBtdXN0IGJlIGFuIGFycmF5LFxyXG4gKiBpbmNsdWRlcyB0aGUgZXhwZWN0ZWQgdmFsdWUuXHJcbiAqIFJlcG9ydHMgbGluZSBudW1iZXIgb2YgdGhlIHRlc3RcclxuICpcclxuICogQHBhcmFtIHtBcnJheTxhbnk+fSB2YWx1ZSAtIGFuIGFycmF5XHJcbiAqIEBwYXJhbSB7YW55fSBleHBlY3RlZCAtIGFueSBKYXZhU2NyaXB0IHZhbHVlXHJcbiAqIEByZXR1cm5zIHt2b2lkfSAtIG5vdGhpbmdcclxuICpcclxuICogQGV4YW1wbGVcclxuICogYGBganNcclxuICogaW5jbHVkZXMgWydhJywgJ2InLCAnYyddLCAnYidcclxuICogYGBgXHJcbiAqIFRoaXMgdGVzdCB3aWxsIHBhc3MuXHJcbiAqL1xyXG5cclxuZXhwb3J0IGluY2x1ZGVzIDo9IChcclxuXHRcdHZhbHVlOiB1bmtub3duLFxyXG5cdFx0ZXhwZWN0ZWQ6IHVua25vd25cclxuXHRcdCk6IHZvaWQgPT5cclxuXHJcblx0YXNzZXJ0IEFycmF5LmlzQXJyYXkodmFsdWUpLCBcIm5vdCBhbiBhcnJheTogI3t2YWx1ZX1cIlxyXG5cdG5hbWUgOj0gZ2V0VGVzdE5hbWUoKVxyXG5cdERCRyBcImluY2x1ZGVzID8sICN7c3RyaW5naWZ5KGV4cGVjdGVkKX0gKCN7bmFtZX0pXCJcclxuXHREZW5vLnRlc3QgbmFtZSwgKCkgPT4gYXNzZXJ0QXJyYXlJbmNsdWRlcyh2YWx1ZSwgW2V4cGVjdGVkXSlcclxuXHRyZXR1cm5cclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG4vKipcclxuICogSW4gYSB1bml0IHRlc3QsIHRlc3RzIGEgdmFsdWUsIHdoaWNoIG11c3QgYmUgYW4gYXJyYXksXHJcbiAqIGluY2x1ZGVzIGFsbCBvZiB0aGUgaXRlbXMgaW4gdGhlIGV4cGVjdGVkIGFycmF5LlxyXG4gKiBSZXBvcnRzIGxpbmUgbnVtYmVyIG9mIHRoZSB0ZXN0XHJcbiAqXHJcbiAqIEBwYXJhbSB7QXJyYXk8YW55Pn0gdmFsdWUgLSBhbiBhcnJheVxyXG4gKiBAcGFyYW0ge0FycmF5PGFueT59IGV4cGVjdGVkIC0gYW4gYXJyYXlcclxuICogQHJldHVybnMge3ZvaWR9IC0gbm90aGluZ1xyXG4gKlxyXG4gKiBAZXhhbXBsZVxyXG4gKiBgYGBqc1xyXG4gKiBpbmNsdWRlc0FsbCBbJ2EnLCAnYicsICdjJ10sIFsnYicsICdjJ11cclxuICogYGBgXHJcbiAqIFRoaXMgdGVzdCB3aWxsIHBhc3MuXHJcbiAqL1xyXG5cclxuZXhwb3J0IGluY2x1ZGVzQWxsIDo9IChcclxuXHRcdHZhbHVlOiB1bmtub3duLFxyXG5cdFx0ZXhwZWN0ZWQ6IHVua25vd25cclxuXHRcdCk6IHZvaWQgPT5cclxuXHJcblx0YXNzZXJ0IEFycmF5LmlzQXJyYXkodmFsdWUpLCBcIm5vdCBhbiBhcnJheTogI3t2YWx1ZX1cIlxyXG5cdGFzc2VydCBBcnJheS5pc0FycmF5KGV4cGVjdGVkKSwgXCJub3QgYW4gYXJyYXk6ICN7ZXhwZWN0ZWR9XCJcclxuXHRuYW1lIDo9IGdldFRlc3ROYW1lKClcclxuXHREQkcgXCJpbmNsdWRlc0FsbCA/LCAje3N0cmluZ2lmeShleHBlY3RlZCl9ICgje25hbWV9KVwiXHJcblx0RGVuby50ZXN0IG5hbWUsICgpID0+IGFzc2VydEFycmF5SW5jbHVkZXModmFsdWUsIGV4cGVjdGVkKVxyXG5cdHJldHVyblxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbi8qKlxyXG4gKiBJbiBhIHVuaXQgdGVzdCwgdGVzdHMgaWYgYSB2YWx1ZSBpcyBvZiBhIGdpdmVuIHR5cGUuXHJcbiAqIFJlbGllcyBvbiBhIC5zeW1ib2xzIGZpbGUgYmVpbmcgY29ycmVjdGx5IHNldCB1cCwgYW5kXHJcbiAqIGl0IGNvbnRhaW5pbmcgdGhlIHR5cGUgd2UncmUgdGVzdGluZyB3aGVuIHRlc3RpbmdcclxuICogYSBub24tYnVpbGRpbiB0eXBlXHJcbiAqXHJcbiAqIEBwYXJhbSB7c3RyaW5nfSB0eXBlU3RyIC0gYSB0eXBlIGFzIGEgc3RyaW5nXHJcbiAqIEBwYXJhbSB7YW55fSB2YWx1ZSAtIGFueSBKYXZhU2NyaXB0IHZhbHVlXHJcbiAqIEByZXR1cm5zIHt2b2lkfSAtIG5vdGhpbmdcclxuICpcclxuICogQGV4YW1wbGVcclxuICogYGBganNcclxuICogaXNUeXBlICdzdHJpbmcnLCAnYWJjJ1xyXG4gKiBgYGBcclxuICogVGhpcyB0ZXN0IHdpbGwgcGFzcy5cclxuICpcclxuICogQGV4YW1wbGVcclxuICogYGBganNcclxuICogaXNUeXBlICdudW1iZXInLCAnYWJjJ1xyXG4gKiBgYGBcclxuICogVGhpcyB0ZXN0IHdpbGwgZmFpbC5cclxuICovXHJcblxyXG5leHBvcnQgaXNUeXBlIDo9IChcclxuXHRcdHR5cGVTdHI6IHN0cmluZ1xyXG5cdFx0dmFsdWU6IHVua25vd25cclxuXHRcdGlzT2ZUeXBlOiBGdW5jdGlvbj89dW5kZWZcclxuXHRcdCk6IHZvaWQgPT5cclxuXHJcblx0bmFtZSA6PSBnZXRUZXN0TmFtZSgpXHJcblx0aWYgZGVmaW5lZChpc09mVHlwZSlcclxuXHRcdERCRyBcIlVzaW5nIHR5cGUgZ3VhcmRcIlxyXG5cdFx0RGVuby50ZXN0IG5hbWUsICgpID0+IGFzc2VydCBpc09mVHlwZSh2YWx1ZSlcclxuXHRlbHNlXHJcblx0XHREQkcgSU5ERU5UXHJcblx0XHRsRGlhZ25vc3RpY3MgOj0gY2hlY2tUeXBlKHZhbHVlLCB0eXBlU3RyLCB0cnVlKVxyXG5cdFx0aWYgZGVmaW5lZChsRGlhZ25vc3RpY3MpXHJcblx0XHRcdGZvciBtc2cgb2YgbERpYWdub3N0aWNzXHJcblx0XHRcdFx0Y29uc29sZS5sb2cgbXNnXHJcblx0XHREQkcgVU5ERU5UXHJcblx0XHREZW5vLnRlc3QgbmFtZSwgKCkgPT4gYXNzZXJ0IGlzRW1wdHkobERpYWdub3N0aWNzKVxyXG5cdHJldHVyblxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbi8qKlxyXG4gKiBJbiBhIHVuaXQgdGVzdCwgdGVzdHMgaWYgYSB2YWx1ZSBpcyBub3Qgb2YgYSBnaXZlbiB0eXBlLlxyXG4gKlxyXG4gKiBAcGFyYW0ge3N0cmluZ30gdHlwZVN0ciAtIGEgdHlwZSBhcyBhIHN0cmluZ1xyXG4gKiBAcGFyYW0ge2FueX0gdmFsdWUgLSBhbnkgSmF2YVNjcmlwdCB2YWx1ZVxyXG4gKiBAcmV0dXJucyB7dm9pZH0gLSBub3RoaW5nXHJcbiAqXHJcbiAqIEBleGFtcGxlXHJcbiAqIGBgYGpzXHJcbiAqIG5vdFR5cGUgJ3N0cmluZycsICdhYmMnXHJcbiAqIGBgYFxyXG4gKiBUaGlzIHRlc3Qgd2lsbCBmYWlsLlxyXG4gKlxyXG4gKiBAZXhhbXBsZVxyXG4gKiBgYGBqc1xyXG4gKiBub3RUeXBlICdudW1iZXInLCAnYWJjJ1xyXG4gKiBgYGBcclxuICogVGhpcyB0ZXN0IHdpbGwgcGFzcy5cclxuICovXHJcblxyXG5leHBvcnQgbm90VHlwZSA6PSAoXHJcblx0XHR0eXBlU3RyOiBzdHJpbmdcclxuXHRcdHZhbHVlOiB1bmtub3duXHJcblx0XHRpc09mVHlwZTogRnVuY3Rpb24/PXVuZGVmXHJcblx0XHQpID0+XHJcblxyXG5cdG5hbWUgOj0gZ2V0VGVzdE5hbWUoKVxyXG5cdGlmIGRlZmluZWQoaXNPZlR5cGUpXHJcblx0XHREQkcgXCJVc2luZyB0eXBlIGd1YXJkXCJcclxuXHRcdERlbm8udGVzdCBuYW1lLCAoKSA9PiBhc3NlcnQgbm90IGlzT2ZUeXBlKHZhbHVlKVxyXG5cdGVsc2VcclxuXHRcdERCRyBJTkRFTlRcclxuXHRcdGxEaWFnbm9zdGljcyA6PSBjaGVja1R5cGUodmFsdWUsIHR5cGVTdHIsIGZhbHNlKVxyXG5cdFx0REJHIFVOREVOVFxyXG5cdFx0RGVuby50ZXN0IG5hbWUsICgpID0+IGFzc2VydCBub25FbXB0eShsRGlhZ25vc3RpY3MpXHJcblx0cmV0dXJuXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4jIC0tLSBVc2VzIGEgcmVjdXJzaXZlIGRlc2NlbnQgcGFyc2VyXHJcblxyXG5leHBvcnQgdHlwZSBURmlsZU9wID0ge1xyXG5cdGZ1bmNOYW1lOiAnbWtEaXInIHwgJ2JhcmYnXHJcblx0cGF0aDogc3RyaW5nXHJcblx0Y29udGVudHM/OiBzdHJpbmdcclxuXHR9XHJcblxyXG5leHBvcnQgc2V0RGlyVHJlZSA6PSAoXHJcblx0XHRjdXJyZW50RGlyOiBzdHJpbmcsXHJcblx0XHRjb250ZW50czogc3RyaW5nLFxyXG5cdFx0aE9wdGlvbnM6IGhhc2ggPSB7fVxyXG5cdFx0KTogVEZpbGVPcFtdID0+XHJcblxyXG5cdCMgLS0tIEV4dHJhY3Qgb3B0aW9uc1xyXG5cdHR5cGUgb3B0ID0ge1xyXG5cdFx0ZGVidWc6IGJvb2xlYW5cclxuXHRcdGNsZWFyOiBib29sZWFuXHJcblx0XHRjb21waWxlOiBib29sZWFuXHJcblx0XHRzY2FmZm9sZDogYm9vbGVhblxyXG5cdFx0fVxyXG5cdHtkZWJ1ZywgY2xlYXIsIGNvbXBpbGUsIHNjYWZmb2xkfSA6PSBnZXRPcHRpb25zPG9wdD4gaE9wdGlvbnMsIHtcclxuXHRcdGRlYnVnOiBmYWxzZVxyXG5cdFx0Y2xlYXI6IGZhbHNlXHJcblx0XHRjb21waWxlOiBmYWxzZVxyXG5cdFx0c2NhZmZvbGQ6IGZhbHNlXHJcblx0XHR9XHJcblxyXG5cdGlmIG5vdCBkZWJ1Z1xyXG5cdFx0cHVzaExvZ0xldmVsICdpbmZvJ1xyXG5cdGxldCBsZXZlbDogaW50ZWdlciA9IDBcclxuXHJcblx0IyAtLS0gcmV0dXJuIGNhbGxzIG1hZGVcclxuXHRsRmlsZU9wczogVEZpbGVPcFtdIDo9IFtdXHJcblxyXG5cdCMgLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLlxyXG5cclxuXHRkYmdFbnRlciA6PSAobmFtZTogc3RyaW5nLCAuLi5sQXJnczogdW5rbm93bltdKSA9PlxyXG5cdFx0c3RyQXJncyA6PSAoXHJcblx0XHRcdGZvciBhcmcgb2YgbEFyZ3NcclxuXHRcdFx0XHRPTChhcmcpXHJcblx0XHRcdCkuam9pbignLCAnKVxyXG5cdFx0REJHIFwiI3snICAgJy5yZXBlYXQobGV2ZWwpfS0+ICN7bmFtZX0oI3tzdHJBcmdzfSlcIlxyXG5cdFx0bGV2ZWwgKz0gMVxyXG5cdFx0cmV0dXJuXHJcblxyXG5cdCMgLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLlxyXG5cclxuXHRkYmdFeGl0IDo9IChuYW1lOiBzdHJpbmcsIC4uLmxBcmdzOiB1bmtub3duW10pID0+XHJcblx0XHRzdHJBcmdzIDo9IChcclxuXHRcdFx0Zm9yIGFyZyBvZiBsQXJnc1xyXG5cdFx0XHRcdE9MKGFyZylcclxuXHRcdFx0KS5qb2luKCcsICcpXHJcblx0XHRsZXZlbCAtPSAxXHJcblx0XHREQkcgXCIjeycgICAnLnJlcGVhdChsZXZlbCl9PC0gI3tuYW1lfSgje3N0ckFyZ3N9KVwiXHJcblx0XHRyZXR1cm5cclxuXHJcblx0IyAuLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uXHJcblxyXG5cdGRiZyA6PSAobGluZTogc3RyaW5nKSA9PlxyXG5cdFx0REJHIFwiI3snICAgJy5yZXBlYXQobGV2ZWwpfS0tICN7T0wobGluZSl9XCJcclxuXHRcdHJldHVyblxyXG5cclxuXHQjIC4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi5cclxuXHJcblx0ZG9NYWtlRGlyIDo9IChcclxuXHRcdFx0ZGlyUGF0aDogc3RyaW5nXHJcblx0XHRcdCk6IHZvaWQgPT5cclxuXHJcblx0XHRwYXRoIDo9IHJlbHBhdGgoZGlyUGF0aClcclxuXHRcdGxGaWxlT3BzLnB1c2gge1xyXG5cdFx0XHRmdW5jTmFtZTogJ21rRGlyJ1xyXG5cdFx0XHRwYXRoXHJcblx0XHRcdH1cclxuXHRcdGlmIG5vdCBzY2FmZm9sZFxyXG5cdFx0XHRta0RpciBwYXRoLCBjbGVhclxyXG5cdFx0cmV0dXJuXHJcblxyXG5cdCMgLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLlxyXG5cclxuXHRkb0JhcmYgOj0gKFxyXG5cdFx0XHRwYXRoOiBzdHJpbmcsXHJcblx0XHRcdGNvbnRlbnRzOiBzdHJpbmdcclxuXHRcdFx0KTogdm9pZCA9PlxyXG5cclxuXHRcdGxGaWxlT3BzLnB1c2gge1xyXG5cdFx0XHRmdW5jTmFtZTogXCJiYXJmXCJcclxuXHRcdFx0cGF0aDogcmVscGF0aChwYXRoKVxyXG5cdFx0XHRjb250ZW50c1xyXG5cdFx0XHR9XHJcblx0XHRpZiBub3Qgc2NhZmZvbGRcclxuXHRcdFx0YmFyZiBwYXRoLCBjb250ZW50c1xyXG5cdFx0XHRpZiAoZmlsZUV4dChwYXRoKSA9PSAnLmNpdmV0JykgJiYgY29tcGlsZVxyXG5cdFx0XHRcdGNpdmV0MnRzRmlsZSBwYXRoXHJcblx0XHRyZXR1cm5cclxuXHJcblx0IyAuLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uXHJcblxyXG5cdGZpbGVIYW5kbGVyIDo9IChcclxuXHRcdFx0cGF0aDogc3RyaW5nLFxyXG5cdFx0XHRsVG9rZW5zOiBUUExMVG9rZW5bXVxyXG5cdFx0XHQpOiB2b2lkID0+XHJcblxyXG5cdFx0ZGJnRW50ZXIgJ2ZpbGVIYW5kbGVyJywgcGF0aFxyXG5cdFx0Y29udGVudHMgOj0gaWYgaXNLaW5kKGxUb2tlbnNbMF0sICdpbmRlbnQnKVxyXG5cdFx0XHRsVG9rZW5zLnNoaWZ0KClcclxuXHRcdFx0bExpbmVzIDo9IFtdXHJcblx0XHRcdGxldCBsZXZlbCA9IDBcclxuXHRcdFx0IyBAdHMtaWdub3JlXHJcblx0XHRcdHdoaWxlIChsZXZlbCA+IDApIHx8IG5vdCBpc0tpbmQobFRva2Vuc1swXSwgJ3VuZGVudCcpXHJcblx0XHRcdFx0dG9rIDo9IGxUb2tlbnMuc2hpZnQoKVxyXG5cdFx0XHRcdGlmIG5vdGRlZmluZWQodG9rKVxyXG5cdFx0XHRcdFx0Y3JvYWsgXCJObyAndW5kZW50JyBpbiBibG9ja1wiXHJcblx0XHRcdFx0ZWxzZVxyXG5cdFx0XHRcdFx0c3dpdGNoIHRvay5raW5kXHJcblx0XHRcdFx0XHRcdHdoZW4gJ2luZGVudCdcclxuXHRcdFx0XHRcdFx0XHRsZXZlbCArPSAxXHJcblx0XHRcdFx0XHRcdHdoZW4gJ3VuZGVudCdcclxuXHRcdFx0XHRcdFx0XHRsZXZlbCAtPSAxXHJcblx0XHRcdFx0XHRcdFx0YXNzZXJ0IChsZXZlbCA+PSAwKSwgXCJOZWdhdGl2ZSBsZXZlbCBpbiBzZXREaXJUcmVlKClcIlxyXG5cdFx0XHRcdFx0XHR3aGVuICdlbXB0eSdcclxuXHRcdFx0XHRcdFx0XHRsTGluZXMucHVzaCAnJ1xyXG5cdFx0XHRcdFx0XHRlbHNlXHJcblx0XHRcdFx0XHRcdFx0aWYgZGVmaW5lZCh0b2suc3RyKVxyXG5cdFx0XHRcdFx0XHRcdFx0bGluZSA6PSBpbmRlbnRlZCh0b2suc3RyLCBsZXZlbClcclxuXHRcdFx0XHRcdFx0XHRcdGRiZyBsaW5lXHJcblx0XHRcdFx0XHRcdFx0XHRsTGluZXMucHVzaCBsaW5lXHJcblxyXG5cdFx0XHQjIC0tLSBIRVJFOiAobGV2ZWwgPT0gMCkgQU5EIChsVG9rZW5zWzBdLmtpbmQgPT0gJ3VuZGVudCcpXHJcblx0XHRcdGFzc2VydCAobGV2ZWwgPT0gMCksIFwiYWZ0ZXIgZmlsZSBjb250ZW50cywgbGV2ZWwgPSAje09MKGxldmVsKX1cIlxyXG5cdFx0XHRhc3NlcnQgKGxUb2tlbnNbMF0ua2luZCA9PSAndW5kZW50JyksXHJcblx0XHRcdFx0XHRcIlVOREVOVCBleHBlY3RlZCBhZnRlciBjb250ZW50cywgZ290ICN7T0wobFRva2Vuc1swXSl9XCJcclxuXHRcdFx0bFRva2Vucy5zaGlmdCgpXHJcblx0XHRcdGxMaW5lcy5qb2luKCdcXG4nKVxyXG5cdFx0ZWxzZVxyXG5cdFx0XHQnJ1xyXG5cdFx0ZG9CYXJmIHBhdGgsIGNvbnRlbnRzXHJcblx0XHRkYmdFeGl0ICdmaWxlSGFuZGxlcicsIHBhdGhcclxuXHRcdHJldHVyblxyXG5cclxuXHQjIC4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi5cclxuXHJcblx0ZGlySGFuZGxlciA6PSAoXHJcblx0XHRcdHBhdGg6IHN0cmluZyxcclxuXHRcdFx0bFRva2VuczogVFBMTFRva2VuW11cclxuXHRcdFx0KTogdm9pZCA9PlxyXG5cclxuXHRcdGRiZ0VudGVyICdkaXJIYW5kbGVyJywgcGF0aFxyXG5cdFx0ZG9NYWtlRGlyIHBhdGhcclxuXHRcdGlmIChsVG9rZW5zLmxlbmd0aCA+IDApICYmIGlzS2luZChsVG9rZW5zWzBdLCAnaW5kZW50JylcclxuXHRcdFx0bFRva2Vucy5zaGlmdCgpXHJcblx0XHRcdGJsb2NrSGFuZGxlcihwYXRoLCBsVG9rZW5zKVxyXG5cdFx0XHQjIEB0cy1pZ25vcmVcclxuXHRcdFx0YXNzZXJ0IGlzS2luZChsVG9rZW5zWzBdLCAndW5kZW50JyksIFwiTWlzc2luZyBVTkRFTlQgaW4gZGlySGFuZGxlclwiXHJcblx0XHRcdGxUb2tlbnMuc2hpZnQoKVxyXG5cdFx0ZGJnRXhpdCAnZGlySGFuZGxlcicsIHBhdGhcclxuXHRcdHJldHVyblxyXG5cclxuXHQjIC4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi5cclxuXHJcblx0YmxvY2tIYW5kbGVyIDo9IChkaXJQYXRoOiBzdHJpbmcsIGxUb2tlbnM6IFRQTExUb2tlbltdKSA9PlxyXG5cdFx0ZGJnRW50ZXIgJ2Jsb2NrSGFuZGxlcicsIGRpclBhdGhcclxuXHRcdHdoaWxlIChsVG9rZW5zLmxlbmd0aCA+IDApICYmIChsVG9rZW5zWzBdLmtpbmQgIT0gJ3VuZGVudCcpXHJcblx0XHRcdHRvazogVFBMTFRva2VuIDo9IGxUb2tlbnNbMF1cclxuXHRcdFx0bFRva2Vucy5zaGlmdCgpXHJcblx0XHRcdHtraW5kLCBzdHJ9IDo9IHRva1xyXG5cdFx0XHRzd2l0Y2gga2luZFxyXG5cdFx0XHRcdHdoZW4gJ2luZGVudCdcclxuXHRcdFx0XHRcdGNyb2FrIFwiVW5leHBlY3RlZCBJTkRFTlRcIlxyXG5cdFx0XHRcdGVsc2VcclxuXHRcdFx0XHRcdGlmIGRlZmluZWQoc3RyKSAmJiBzdHIuc3RhcnRzV2l0aCgnLycpXHJcblx0XHRcdFx0XHRcdGRpckhhbmRsZXIgXCIje2RpclBhdGh9I3t0b2suc3RyfVwiLCBsVG9rZW5zXHJcblx0XHRcdFx0XHRlbHNlXHJcblx0XHRcdFx0XHRcdGZpbGVIYW5kbGVyIFwiI3tkaXJQYXRofS8je3Rvay5zdHJ9XCIsIGxUb2tlbnNcclxuXHRcdGRiZ0V4aXQgJ2Jsb2NrSGFuZGxlcidcclxuXHRcdHJldHVyblxyXG5cclxuXHQjIC4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi5cclxuXHJcblx0cHR5cGUgOj0gZ2V0UGF0aFR5cGUoY3VycmVudERpcilcclxuXHRhc3NlcnQgKHB0eXBlID09ICdkaXInKSB8fCAocHR5cGUgPT0gJ21pc3NpbmcnKSxcclxuXHRcdFx0XCJjdXJyZW50RGlyIGlzIGEgI3twdHlwZX1cIlxyXG5cclxuXHQjIC0tLSBDbGVhciB0aGUgZGlyZWN0b3J5IGlmIGl0IGV4aXN0c1xyXG5cdGRvTWFrZURpciBjdXJyZW50RGlyXHJcblxyXG5cdGxUb2tlbnMgOj0gQXJyYXkuZnJvbShhbGxUb2tlbnNJbkJsb2NrKGNvbnRlbnRzKSlcclxuXHREQkcgdG9rZW5UYWJsZShsVG9rZW5zKVxyXG5cclxuXHRibG9ja0hhbmRsZXIoY3VycmVudERpciwgbFRva2VucylcclxuXHRhc3NlcnQgKGxUb2tlbnMubGVuZ3RoID09IDApLFxyXG5cdFx0XHRcIlRva2VucyByZW1haW5pbmcgYWZ0ZXIgcGFyc2U6ICN7T0wobFRva2Vucyl9XCJcclxuXHRpZiBub3QgZGVidWdcclxuXHRcdHBvcExvZ0xldmVsKClcclxuXHRyZXR1cm4gbEZpbGVPcHNcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgZmlsZU9wc1RhYmxlIDo9IChsRmlsZU9wczogVEZpbGVPcFtdKTogc3RyaW5nID0+XHJcblxyXG5cdHR0IDo9IG5ldyBUZXh0VGFibGUoXCJsIGxcIilcclxuXHR0dC5mdWxsc2VwKClcclxuXHR0dC50aXRsZSAnRklMRSBPUFMnXHJcblx0dHQuZnVsbHNlcCgpXHJcblx0Zm9yIHtmdW5jTmFtZSwgcGF0aCwgY29udGVudHN9IG9mIGxGaWxlT3BzXHJcblx0XHRzd2l0Y2ggZnVuY05hbWVcclxuXHRcdFx0d2hlbiAnbWtEaXInXHJcblx0XHRcdFx0dHQuZGF0YSBbJ21rZGlyJywgcGF0aF1cclxuXHRcdFx0d2hlbiAnYmFyZidcclxuXHRcdFx0XHR0dC5kYXRhIFsnYmFyZicsIHBhdGhdXHJcblx0XHRcdFx0aWYgY29udGVudHNcclxuXHRcdFx0XHRcdGZvciBsaW5lIG9mIGNvbnRlbnRzLnNwbGl0KCdcXG4nKVxyXG5cdFx0XHRcdFx0XHR0dC5kYXRhIFsnJywgbGluZS5yZXBsYWNlKCdcXHQnLCBzcGFjZXMoMykpXVxyXG5cdHR0LmZ1bGxzZXAoKVxyXG5cdHJldHVybiB0dC5hc1N0cmluZygpXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4iXX0=