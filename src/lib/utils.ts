"use strict";
// utils.civet

import {
	undef, defined, notdefined,
	isString, isNonEmptyString, isBoolean, isNumber, isInteger,
	isArray, isArrayOfStrings, isHash, isObject, isRegExp,
	isEmpty, nonEmpty,
	hash, optionspec,
	} from './datatypes.ts'
import {
	pass, OL, ML, getOptions, croak, assert, strToHash,
	removeEmptyKeys, keys, hasKey, hasKeys, merge,
	spaces, tabs,
	} from './llutils.ts'
import {
	isFile, isDir, fileExt, withExt,
	rmFile, getPathType, getStats, parsePath,
	allFilesMatching, allLinesIn, watchFile, watchFiles,
	normalizePath, mkpath, relpath, newerDestFileExists,
	pathSubDirs, clearDir, mkDir, mkDirsForFile,
	slurp, barf, myself, removeFilesMatching,
	} from './fs.ts'
import {
	setLogLevel, pushLogLevel, popLogLevel,
	curLogLevel, clearLog, getLog,
	INDENT, UNDENT, CLEAR,
	DBG, LOG, WARN, ERR,
	} from './logger.ts'
import {
	execCmd, execCmdSync, cmdSucceeds,
	execCmdResult,
	} from './exec-utils.ts'
import {
	hCompilerConfig, findSourceFile, compileFile, isDirSpec,
	compileResult,
	} from './compile-config.ts'

export {
	undef, defined, notdefined, pass,
	setLogLevel, pushLogLevel, popLogLevel,
	curLogLevel, clearLog, getLog,
	INDENT, UNDENT, CLEAR,
	DBG, LOG, WARN, ERR,
	OL, ML, croak, assert, getOptions,
	removeEmptyKeys, keys, hasKey, hasKeys, merge,
	spaces, tabs,
	isString, isNonEmptyString, isBoolean, isNumber, isInteger,
	isArray, isArrayOfStrings, isHash, isObject, isRegExp,
	isEmpty, nonEmpty,
	isFile, isDir, fileExt, withExt,
	rmFile, getPathType, getStats, parsePath,
	allFilesMatching, allLinesIn, watchFile, watchFiles,
	normalizePath, mkpath, relpath, newerDestFileExists,
	pathSubDirs, clearDir, mkDir, mkDirsForFile,
	slurp, barf, myself, removeFilesMatching,
	compileFile, execCmd, execCmdSync, cmdSucceeds,
	isDirSpec,
	}
export type {
	execCmdResult, compileResult,
	}

/**
 * @module llutils - low level utilities
 */

export type blockSpec = string | string[]

// ---------------------------------------------------------------------------

/**
 * Splits a string on whitespace into an array,
 * ignoring any leading or trailing whitespace
 */

export const wsSplit = (str: string): string[] => {

	const newstr = str.trim()
	if (newstr === '') {
		return []
	}
	else {
		return newstr.split(/\s+/)
	}
}

// ---------------------------------------------------------------------------

/**
 * splits each string on whitespace ignoring any leading
 * or trailing whitespace, and returns an array of
 * all substrings obtained
 */

export const words = (...lStrings: string[]): string[] => {

	let lWords = []
	for (const str of lStrings) {
		for (const word of wsSplit(str)) {
			lWords.push(word)
		}
	}
	return lWords
}

// ---------------------------------------------------------------------------

/**
 * A generator that yields integers starting with 0 and
 * continuing to n-1
 */

export const range = function*(n: number): Generator<number, void, unknown> {

	let i = 0
	while (i < n) {
		yield i
		i = i + 1
	}
	return
}

// ---------------------------------------------------------------------------

/**
 * converts x to a string, removing any carriage returns
 * and removing leading and trailing whitespace
 */

export const normalizeStr = (x: any): string => {

	return x.toString().replaceAll('\r', '').trim()
}

// ---------------------------------------------------------------------------

/**
 * calculates the number of extra characters needed to
 * make the given string have the given length.
 * If not possible, returns 0
 */

export var getNExtra = (str: string, len: number): number => {

	const extra = len - str.length
	return (extra > 0) ? extra : 0
}

// ---------------------------------------------------------------------------

/**
 * pads the given string on the right with
 * the given character, to the given length
 */

export const rpad = (str: string, len: number, ch: string=' '): string => {

	assert((ch.length === 1), "Not a char")
	const extra = getNExtra(str, len)
	return str + ch.repeat(extra)
}

// ---------------------------------------------------------------------------

/**
 * pads the given string on the left with
 * the given character, to the given length
 */

export const lpad = (str: string, len: number, ch: string=' '): string => {

	assert((ch.length === 1), "Not a char")
	const extra = getNExtra(str, len)
	return ch.repeat(extra) + str
}

// ---------------------------------------------------------------------------
// --- valid options:
//        char - char to use on left and right
//        buffer - num spaces around text when char <> ' '

/**
 * pads the given string on both the left and right
 * with the given character, to the given length
 * but with the given number of buffer chars surrounding
 * the text
 */

export const centered = (
	text: string,
	width: number,
	char: string = ' ',
	numBuffer: number = 2
	): string => {

	const totSpaces = width - text.length
	if (totSpaces <= 0) {
		return text
	}
	const numLeft = Math.floor(totSpaces / 2)
	const numRight = totSpaces - numLeft
	if (char === ' ') {
		return spaces(numLeft) + text + spaces(numRight)
	}
	else {
		const buf = ' '.repeat(numBuffer)
		const left = char.repeat(numLeft - numBuffer)
		const right = char.repeat(numRight - numBuffer)
		return left + buf + text + buf + right
	}
}

// ---------------------------------------------------------------------------

/**
 * pad a string on the left, right, or both
 * to the given width
 */

export const alignString = function(
	str: string,
	width: number,
	align: string
	): string {

	assert(isString(str), `str not a string: ${OL(str)}`)
	assert(isString(align), `align not a string: ${OL(align)}`)
	switch(align) {
		case 'left':case 'l': {
			return rpad(str, width)
		}
		case 'center':case 'c': {
			return centered(str, width)
		}
		case 'right':case 'r': {
			return lpad(str, width)
		}
		default: {
			throw new Error(`Unknown align: ${OL(align)}`)
		}
	}
}

// ---------------------------------------------------------------------------

/**
 * converts the given number to a string, then pads on the left
 * with zeros to achieve the given length
 */

export const zpad = (n: number, len: number): string => {

	return lpad(n.toString(), len, '0')
}

// ---------------------------------------------------------------------------

/**
 * convert a multi-line string to an array
 * of single line strings
 */

export var blockToArray = (block: string): string[] => {

	assert(isString(block), `block is: ${OL(block)}`)
	if (isEmpty(block)) {
		return []
	}
	else {
		return block.split(/\r?\n/)
	}
}

// ---------------------------------------------------------------------------

/**
 * return an array as is, convert a multi-line string
 * to an array of single line strings
 */

export var toArray = (strOrArray: blockSpec): string[] => {

	if (Array.isArray(strOrArray)) {
		return strOrArray
	}
	else {
		return blockToArray(strOrArray)
	}
}

// ---------------------------------------------------------------------------

/**
 * convert an array of strings to a single multi-line string
 */

export var arrayToBlock = (lLines: string[]): string => {

	assert(isArray(lLines), `lLines is not an array: ${OL(lLines)}`)
	return lLines.filter((line) => defined(line)).join("\n")
}

// ---------------------------------------------------------------------------

/**
 * return a string as is, convert an array of strings
 * to a single multi-line string
 */

export var toBlock = (strOrArray: blockSpec): string => {

	if (isString(strOrArray)) {
		return strOrArray
	}
	else {
		return arrayToBlock(strOrArray)
	}
}

// ---------------------------------------------------------------------------

/**
 * Remove lines from a string or array
 * pat can be a string or a regular expression
 */

export const removeLines = (
	strOrArray: string | string[],
	pat: string | RegExp
	): string | string[] => {

	assert(isString(pat) || isRegExp(pat),  `Bad arg 2: ${OL(pat)}`)
	const lLines = isString(strOrArray) ? blockToArray(strOrArray) : strOrArray
	const lNewLines = (
		(typeof pat === 'string'?
			lLines.filter((line) => (line !== pat))
		:
			lLines.filter((line) => (line.match(pat) === null)))
		)
	if (isString(strOrArray)) {
		return lNewLines.join('\n')
	}
	else {
		return lNewLines
	}
}

// ---------------------------------------------------------------------------

/**
 * replace these characters with single unicode chars:
 *    carriage return
 *    newline
 *    TAB
 *    space
 * Optionally, add a character to indicate a particular
 * position in the string
 * Valid options:
 *    offset - indicate position of offset
 *    poschar - char to use to indicate position
 */

export const escapeStr = (
	str: string,
	hReplace: hash = {
		"\r": '←',
		"\n": '↓',
		"\t": '→',
		" ": '˳'
		},
	hOptions: optionspec = {}
	): string => {

	const {offset, poschar} = getOptions(hOptions, {
		offset: undef,
		poschar: '┊'
		})

	const lParts = []
	let i1 = 0;for (const ch of str.split('')) {const i = i1++;
		if (defined(offset) && (i === offset)) {
			lParts.push(poschar)
		}
		const newch = hReplace[ch]
		if (defined(newch)) {
			lParts.push(newch)
		}
		else {
			lParts.push(ch)
		}
	}
	if (offset === str.length) {
		lParts.push(poschar)
	}
	return lParts.join('')
}

// ---------------------------------------------------------------------------

/**
 * replace these characters with single unicode chars:
 *    carriage return
 *    TAB
 *    space
 * Optionally, add a character to indicate a particular
 * position in the string
 */

export var escapeBlock = (
	block: string,
	hReplace: hash = {
		"\r": '←',
		"\t": '→',
		" ": '˳'
		},
	hOptions: optionspec = {}
	): string => {

	return escapeStr(block, hReplace, hOptions)
}

// ---------------------------------------------------------------------------

export const getPattern = (): string => {

	const lKeys = Object.keys(hCompilerConfig.hCompilers)
	if (lKeys.length === 1) {
		return `**/*${lKeys[0]}`
	}
	else {
		return `**/*{${lKeys.join(',')}}`
	}
}

// ---------------------------------------------------------------------------
// --- A generator - yields {path, status, outPath}

export const compileAllFiles = function*(
	pattern: (string | undefined) = undef,
	): Generator<compileResult, void, unknown> {

	const hGlobOptions = {
		exclude: [
			'node_modules/**',
			'.git/**',
			'**/*.temp.*'  // --- don't compile temp files
			]
		}

	const globPattern = defined(pattern) ? pattern : getPattern()
	DBG(`compiling all files, pat=${OL(globPattern)}`)
	for (const {path} of allFilesMatching(globPattern, hGlobOptions)) {
		const hResult = compileFile(path)
		if (hResult.status === 'compiled') {
			yield hResult
		}
	}
	return
}

// ---------------------------------------------------------------------------

export const ensureCompiled = (
	dirspec: string,
	stub: string,
	purpose: (string | undefined) = undef
	): (string | undefined) => {

	const h = findSourceFile(dirspec, stub, purpose)
	if ((h === undef) || (h.path === undef) || !isFile(h.path)) {
		DBG(`Not compiling: no such file: ${dirspec}/${stub}/${purpose}`)
		return undef
	}
	else {
		const {status, outPath} = compileFile(h.path)
		if (outPath === undef) {
			WARN(`Compile of lib ${h.path} failed with status ${status}`)
			return undef
		}
		else {
			assert(isFile(outPath),
					`compileFile() succeeded, but ${OL(outPath)} does not exist!`)
			return outPath
		}
	}
}

// ---------------------------------------------------------------------------

type unitTestResult = {
	stub: string
	success: boolean
	msg?: string
	code?: number
	signal?: string
	}

export const runUnitTest = (
	stub: string,
	): unitTestResult => {

	DBG(`Running unit test ${stub}`)

	ensureCompiled('libDir', stub)
	ensureCompiled('binDir', stub)

	// --- This is the path to the test to be run
	const testOutPath = ensureCompiled('testDir', stub, 'test')
	if (testOutPath === undef) {
		WARN(`Compile of ${stub} unit test failed`)
		return {
			stub,
			success: false,
			msg: `Compile of ${stub} unit test failed`
			}
	}
	else {
		DBG(`testOutPath = ${OL(testOutPath)}`)
	}

	// --- Compile all files in subdir if it exists
	if (isDir(`test/${stub}`)) {
		for (const {path, status, outPath} of compileAllFiles(`test/${stub}/*`)) {
			if (notdefined(outPath)) {
				WARN(`File ${OL(path)} not compiled`)
			}
		}
	}

	// --- Run the unit test, return return code
	assert(isFile(testOutPath), `No such file: ${OL(testOutPath)}`)

	// --- Return value has keys success, code, signal
	const h = execCmdSync('deno', [
			'test',
			'-qA',
			testOutPath
			])
//	hResult.stub = stub
	return {
		stub,
		success: h.success,
		code: h.code,
		signal: h.signal
		}
}

// ---------------------------------------------------------------------------
// --- a generator

export const runAllUnitTests = function*(): Generator<unitTestResult, void, unknown> {

	const hGlobOptions = {
		exclude: ['node_modules/**', '.git/**']
		}

	const pattern = 'test/*.test.js'
	DBG(`pattern = ${OL(pattern)}`)
	for (const {path} of allFilesMatching(pattern, hGlobOptions)) {
		const {stub} = parsePath(path)
		if (stub === undef) {
			WARN(`No stub found in ${OL(path)}`)
		}
		else {
			DBG(`TEST: ${path}`)
			yield runUnitTest(stub)
		}
	}
	return
}

// ---------------------------------------------------------------------------

const hKeyToLogger: hash = {
	P: 'profile',
	D: 'debug',
	Q: 'quiet',
	S: 'silent'
	}

export const setLoggerFromArgs = (lArgs: string[]): void => {

	for (const str of lArgs) {
		const lMatches = str.match(/^-([A-Za-z0-9_-]*)(=)?/)
		if (lMatches === null) {
			pass()
		}
		else {
			const keyStr = lMatches[1]
			const hasEq = lMatches[2]
			if (isEmpty(hasEq)) {
				for (const key of keys(hKeyToLogger)) {
					if (keyStr.includes(key)) {
						setLogLevel(hKeyToLogger[key])
					}
				}
			}
		}
	}
	return
}

// ---------------------------------------------------------------------------

/**
 * Parse command line arguments, optionally specifying which
 * options to expect and/or the expected number of non-options
 *
 * There are 3 kinds of items allowed on the command line:
 *
 * 1. flags, e.g.
 * 	`-fnx` - sets flags `f`, 'n' and `x` to true
 *    flags must be upper or lower case letters
 *
 * 2. an option with a value, e.g.
 * 	`-label=mylabel` - sets option `label` to `'mylabel'`
 * 	if the value contains a space char, it must be quoted
 * 	if the value looks like a number, it's set to a number
 *
 * 3. anything else is a non-option, e.g.
 * 	c:/temp/temp.txt
 * 	if it includes a space char or starts with `-`,
 * 		it must be quoted
 *
 * the 1st argument to getCmdArgs() is optional, and is a hash
 * of information about the expected arguments.
 *
 * If key '_' is present, it must be a hash possibly including keys:
 *    'range' - either an integer specifying the exact number of
 *              non-options expected, of an array of 2 integers
 *              specifying the minimum and maximum number of
 *              non-options expected. The 2nd of these may be
 *              the string 'inf' to indicate no maximum number
 *    'desc' - a text description of what non-options are
 *
 * All other keys are names of options allowed, and the associated value
 * must be a hash with possibly these keys:
 *    type - the type of value expected (defaults to 'boolean')
 *    desc - a text description of the option (used on help screens)
 *
 * the 2nd argument to getCmdArgs() is an array of string arguments
 * from the command line (defaults to Deno.args)
 *
 * the 3rd argument to getCmdArgs() is a hash of possible options:
 *    doSetLogger - defaults to true - if false, then options
 *                  -P, -D, -Q and -S no longer set logging options and
 *                  may therefore be used for other purposes
 *
 * By default, the following flags are recognized, and therefore
 * cannot be included in hDesc (this behavior can be
 * disabled by setting hOptions.doSetLogger to false):
 *
 * `-P` - set the current log level to 'profile'
 * `-D` - set the current log level to 'debug'
 * `-Q` - set the current log level to 'warn'
 * `-S` - set the current log level to 'silent'
 *
 * (see library @jdeighan/logger)
 */

export const getCmdArgs = (
	hDesc: (hash | undefined) = undef,
	lArgs: string[] = Deno.args,
	hOptions: optionspec = {}
	): hash => {

	if (notdefined(hDesc)) {
		pass()
	}
	else {
		assert(isHash(hDesc), `Bad hDesc: ${OL(hDesc)}`)
	}
	assert(isArrayOfStrings(lArgs), `Bad lArgs: ${OL(lArgs)}`)

	if ((lArgs.length === 1) && (lArgs[0] === '-h')) {}
	if ((lArgs.length === 1)
			&& ['-h','--h','-help','--help'].includes(lArgs[0])
			) {
		if (notdefined(hDesc)) {
			LOG("No help available")
		}
		else {
			showHelp(hDesc)
		}
		Deno.exit()
	}

	// --- Currently, there is only one possible option
	const {doSetLogger} = getOptions(hOptions, {
		doSetLogger: true
		})

	if (doSetLogger) {
		if (notdefined(hDesc)) {
			pass()
		}
		else {
			for (const key of keys(hKeyToLogger)) {
				assert(notdefined(hDesc[key]),
						`invalid key ${OL(key)} set in hDesc`)
			}
		}
		setLoggerFromArgs(lArgs)
	}

	const hResult: hash = { _: [] }

	// --- Utility functions

	// --- Even gets called for -D, -Q, -P, -S
	const addOption = (name: string, value: any) => {
		DBG(`addOption(${OL(name)}, ${OL(value)})`)
		assert(isString(name), `Not a string: ${OL(name)}`)
		assert(!hasKey(hResult, name),
				`dup key ${name}, hResult = ${OL(hResult)}`)

		if (doSetLogger) {
			const logger = hKeyToLogger[name]
			if (defined(logger)) {
				hResult[name] = true
				setLogLevel(logger)
				return
			}
		}

		if (notdefined(hDesc)) {
			hResult[name] = value
			return
		}
		const {type} = getOptionInfo(hDesc, name)

		// --- type checking
		if (isArray(type)) {
			assert(type.includes(value), "type not an array")
			hResult[name] = value
		}
		else {
			switch(type) {
				case 'string': {
					hResult[name] = value;break;
				}
				case 'boolean': {
					hResult[name] = (
						  (value === 'true')  ? true
						: (value === 'false') ? false
						:                      value
						);break;
				}
				case 'number':case 'float': {
					hResult[name] = parseFloat(value);break;
				}
				case 'integer': {
					hResult[name] = parseInt(value);break;
				}
			}
		}
		return
	}

	const addNonOption = (str: string) => {
		DBG(`addNonOption(${OL(str)})`)
		hResult._.push(str)
	}

	for (const str of lArgs) {
		// --- ignore '--'
		if (str === '--') {
			DBG("skipping --")
			continue
		}

		// --- check if it's an option
		const lMatches = str.match(/^-([A-Za-z0-9_-]*)(?:(=)(.*))?$/)
		if (lMatches === null) {
			// --- it's a non-option
			addNonOption(str)
		}
		else {
			// --- it's an option
			const [_, optStr, eqStr, value] = lMatches
			if (eqStr) {
				addOption(optStr, value)
			}
			else {
				for (const ch of optStr.split('')) {
					addOption(ch, true)
				}
			}
		}
	}

	// --- if hDesc is set, then
	//     Fill in default values if available

	if (notdefined(hDesc)) {
		pass()
	}
	else {
		for (const name of keys(hDesc, 'except=_')) {
			if (notdefined(hResult[name])) {
				const {defaultVal} = getOptionInfo(hDesc, name)
				if (defined(defaultVal)) {
					hResult[name] = defaultVal
				}
			}
		}

		// --- Check of there's a restriction on the number of non-options

		if (hasKey(hDesc, '_')) {
			const hInfo = getNonOptionInfo(hDesc)
			if (hInfo !== undef) {
				const {range} = hInfo
				const [min, max] = range
				const len = hResult._.length
				assert((len >= min), `${len} non-options < min (${min})`)
				assert((len <= max), `${len} non-options > max (${max})`)
			}
		}
	}

	DBG(`hResult = ${OL(hResult)}`)
	return hResult
}

// ---------------------------------------------------------------------------

export const getOptionInfo = (hDesc: hash, name: string): hash => {

	// --- Return value is a hash with keys: type, desc

	assert(defined(hDesc), "hDesc is not defined in getOptionInfo()")
	assert(isHash(hDesc), `hDesc is not a hash in getOptionInfo(): ${OL(hDesc)}`)
	assert((name !== '_'), "getOptionInfo(hDesc, '_') called")
	assert(hasKey(hDesc, name), `No such option: -${name}`)
	const h = isHash(hDesc[name]) ? hDesc[name] : {desc: hDesc[name]}
	if (notdefined(h.type)) {
		h.type = (name.length === 1) ? 'boolean' : 'string'
	}
	if (notdefined(h.desc)) {
		h.desc = '<no description available>'
	}
	if (!hasKey(h, 'defaultVal') && (h.type === 'boolean')) {
		h.defaultVal = false
	}
	return h
}

// ---------------------------------------------------------------------------
// --- returns undef if no '_' key in hDesc

type rangeType = [number, number]

type nonOptionInfo = {
	type: 'array'
	desc: string
	range: rangeType
	}

export const getNonOptionInfo = (hDesc: hash): (nonOptionInfo | undefined) => {

	// --- Return value is a hash with keys:
	//        type = 'array'
	//        desc
	//        range as [min, max]

	assert(defined(hDesc), "hDesc is not defined in getNonOptionInfo()")
	if (!hasKey(hDesc, '_')) {
		return undef
	}
	const desc = hDesc.desc || '<no description available>'
	let range: rangeType = [0, Infinity]
	if (hasKey(hDesc, 'range')) {
		const r = hDesc.range
		if (isInteger(r)) {
			range = [r, r]
		}
		else if (Array.isArray(r)) {
			assert((r.length === 2), `Bad '_' key: ${OL(r)}`)
			const [min, max] = r
			assert(isInteger(min), "range min not an integer")
			if (max === 'inf') {
				[min, Infinity]
			}
			else {
				assert(isInteger(max), "range max not an integer");
				[min, max]
			}
		}
		else {
			throw new Error(`Invalid range: ${OL(r)}`)
		}
	}

	return {
		type: 'array',
		desc,
		range
		}
}

// ---------------------------------------------------------------------------

export const showHelp = (hDesc: hash): void => {

	LOG("Available options:")
	for (const name of keys(hDesc, 'except=_')) {
		const {type, desc} = getOptionInfo(hDesc, name)
		LOG(`   -${name}: ${type} - ${desc}`)
	}
	if (defined(hDesc._)) {
		LOG("Available non-options:")
		if (isHash(hDesc._)) {
			const {range, desc} = hDesc._
			if (defined(range)) {
				if (isInteger(range)) {
					LOG(`   There must be exactly ${range} non-options`)
				}
				else if (isArray(range)) {
					const [min, max] = range
					if (min > 0) {
						LOG(`   There must be at least ${min} non-options`)
					}
					if (max !== 'inf') {
						LOG(`   There must be at most ${max} non-options`)
					}
				}
			}
		}
		const desc = (
			  isString(hDesc._) ? hDesc._
			: isHash(hDesc._) ? (hDesc._.desc || '<no description available>')
			: croak(`Bad descriptor for non-options: ${OL(hDesc._)}`)
			)
		LOG(desc)
	}
	return
}

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3JjL2xpYi91dGlscy5jaXZldC50c3giLCJzb3VyY2VzIjpbInNyYy9saWIvdXRpbHMuY2l2ZXQiXSwibWFwcGluZ3MiOiI7QUFBQSxjQUFhO0FBQ2IsQUFBQTtBQUNBLEFBQUEsTUFBTSxDQUFDLENBQUM7QUFDUixDQUFDLEtBQUssQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLFVBQVUsQ0FBQztBQUM1QixDQUFDLFFBQVEsQ0FBQyxDQUFDLGdCQUFnQixDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsU0FBUyxDQUFDO0FBQzVELENBQUMsT0FBTyxDQUFDLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxRQUFRLENBQUM7QUFDdkQsQ0FBQyxPQUFPLENBQUMsQ0FBQyxRQUFRLENBQUM7QUFDbkIsQ0FBQyxJQUFJLENBQUMsQ0FBQyxVQUFVLENBQUM7QUFDbEIsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLGdCQUFnQjtBQUN4QixBQUFBLEFBQUEsTUFBTSxDQUFDLENBQUM7QUFDUixDQUFDLElBQUksQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLFNBQVMsQ0FBQztBQUNwRCxDQUFDLGVBQWUsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLEtBQUssQ0FBQztBQUMvQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksQ0FBQztBQUNkLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxjQUFjO0FBQ3RCLEFBQUEsQUFBQSxNQUFNLENBQUMsQ0FBQztBQUNSLENBQUMsTUFBTSxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsT0FBTyxDQUFDO0FBQ2pDLENBQUMsTUFBTSxDQUFDLENBQUMsV0FBVyxDQUFDLENBQUMsUUFBUSxD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Q0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLE1BQU07QUFDMUIsQUFBQSxDQUFDLE1BQU0sQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQztBQUFDLENBQUE7QUFDL0IsQUFBQTtBQUNBLEFBQUEsOEVBQTZFO0FBQzdFLEFBQUE7QUFDQSxBQUFBO0FBQ0E7QUFDQTtBQUNBLEdBQUc7QUFDSCxBQUFBO0FBQ0EsQUFBQSxBQUFBLE1BQU0sQ0FBSyxNQUFKLElBQUksQ0FBQyxDQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFBLENBQUE7QUFDcEUsQUFBQTtBQUNBLEFBQUEsQ0FBQyxNQUFNLENBQUEsQUFBQyxDQUFDLEVBQUUsQ0FBQyxNQUFNLENBQUMsR0FBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsWUFBWSxDQUFBO0FBQ3RDLEFBQUEsQ0FBTSxNQUFMLEtBQUssQ0FBQyxDQUFFLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQztBQUM3QixBQUFBLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxLQUFLLEM7QUFBQyxDQUFBO0FBQzlCLEFBQUE7QUFDQSxBQUFBLDhFQUE2RTtBQUM3RSxBQUFBO0FBQ0EsQUFBQTtBQUNBO0FBQ0E7QUFDQSxHQUFHO0FBQ0gsQUFBQTtBQUNBLEFBQUEsQUFBQSxNQUFNLENBQUssTUFBSixJQUFJLENBQUMsQ0FBRSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFD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LENBQUEsQ0FBQSxDQUFBO0FBQ3BCLEFBQUEsSUFBSSxHQUFHLENBQUMsQ0FBQSxNQUFBLEdBQUcsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFBLENBQUEsQ0FBQTtBQUNqQyxBQUFBLEtBQUssR0FBRyxDQUFBLE1BQU0sQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUEsQ0FBQSxDQUFBO0FBQzVCLEFBQUEsTUFBTSxXQUFXLENBQUEsQUFBQyxZQUFZLENBQUMsR0FBRyxDQUFDLEM7S0FBQSxDO0lBQUEsQztHQUFBLEM7RUFBQSxDO0NBQUEsQ0FBQTtBQUNuQyxBQUFBLENBQUMsTTtBQUFNLENBQUE7QUFDUCxBQUFBO0FBQ0EsQUFBQSw4RUFBNkU7QUFDN0UsQUFBQTtBQUNBLEFBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsR0FBRztBQUNILEFBQUE7QUFDQSxBQUFBLEFBQUEsTUFBTSxDQUFXLE1BQVYsVUFBVSxDQUFDLENBQUUsQ0FBQyxDQUFDO0FBQ3RCLEFBQUEsQ0FBQyxLQUFLLEMsQyxDQUFDLEFBQUMsSSxZLENBQUssQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDO0FBQ3RCLEFBQUEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDO0FBQzdCLEFBQUEsQ0FBQyxRQUFRLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUMx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Q0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUM7QUFDaEMsR0FBRyxDQUFDLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsNEJBQTRCLENBQUM7QUFDckUsR0FBRyxDQUFDLENBQUMsS0FBSyxDQUFBLEFBQUMsQ0FBQyxnQ0FBZ0MsRUFBRSxFQUFFLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUMzRCxHQUFHLENBQUM7QUFDSixBQUFBLEVBQUUsR0FBRyxDQUFBLEFBQUMsSUFBSSxDO0NBQUEsQ0FBQTtBQUNWLEFBQUEsQ0FBQyxNO0FBQU0sQ0FBQTtBQUNQIiwibmFtZXMiOltdLCJzb3VyY2VzQ29udGVudCI6WyIjIHV0aWxzLmNpdmV0XG5cbmltcG9ydCB7XG5cdHVuZGVmLCBkZWZpbmVkLCBub3RkZWZpbmVkLFxuXHRpc1N0cmluZywgaXNOb25FbXB0eVN0cmluZywgaXNCb29sZWFuLCBpc051bWJlciwgaXNJbnRlZ2VyLFxuXHRpc0FycmF5LCBpc0FycmF5T2ZTdHJpbmdzLCBpc0hhc2gsIGlzT2JqZWN0LCBpc1JlZ0V4cCxcblx0aXNFbXB0eSwgbm9uRW1wdHksXG5cdGhhc2gsIG9wdGlvbnNwZWMsXG5cdH0gZnJvbSAnLi9kYXRhdHlwZXMudHMnXG5pbXBvcnQge1xuXHRwYXNzLCBPTCwgTUwsIGdldE9wdGlvbnMsIGNyb2FrLCBhc3NlcnQsIHN0clRvSGFzaCxcblx0cmVtb3ZlRW1wdHlLZXlzLCBrZXlzLCBoYXNLZXksIGhhc0tleXMsIG1lcmdlLFxuXHRzcGFjZXMsIHRhYnMsXG5cdH0gZnJvbSAnLi9sbHV0aWxzLnRzJ1xuaW1wb3J0IHtcblx0aXNGaWxlLCBpc0RpciwgZmlsZUV4dCwgd2l0aEV4dCxcblx0cm1GaWxlLCBnZXRQYXRoVHlwZSwgZ2V0U3RhdHMsIHBhcnNlUGF0aCxcblx0YWxsRmlsZXNNYXRjaGluZywgYWxsTGluZXNJbiwgd2F0Y2hGaWxlLCB3YXRjaEZpbGVzLFxuXHRub3JtYWxpemVQYXRoLCBta3BhdGgsIHJlbHBhdGgsIG5ld2VyRGVzdEZpbGVFeGlzdHMsXG5cdHBhdGhTdWJEaXJzLCBjbGVhckRpciwgbWtEaXIsIG1rRGlyc0ZvckZpbGUsXG5cdHNsdXJwLCBiYXJmLCBteXNlbGYsIHJlbW92ZUZpbGVzTWF0Y2hpbmcsXG5cdH0gZnJvbSAnLi9mcy50cydcbmltcG9ydCB7XG5cdHNldExvZ0xldmVsLCBwdXNoTG9nTGV2ZWwsIHBvcExvZ0xldmVsLFxuXHRjdXJMb2dMZXZlbCwgY2xlYXJMb2csIGdldExvZyxcblx0SU5ERU5ULCBVTkRFTlQsIENMRUFSLFxuXHREQkcsIExPRywgV0FSTiwgRVJSLFxuXHR9IGZyb20gJy4vbG9nZ2VyLnRzJ1xuaW1wb3J0IHtcblx0ZXhlY0NtZCwgZXhlY0NtZFN5bmMsIGNtZFN1Y2NlZWRzLFxuXHRleGVjQ21kUmVzdWx0LFxuXHR9IGZyb20gJy4vZXhlYy11dGlscy50cydcbmltcG9ydCB7XG5cdGhDb21waWxlckNvbmZpZywgZmluZFNvdXJjZUZpbGUsIGNvbXBpbGVGaWxlLCBpc0RpclNwZWMsXG5cdGNvbXBpbGVSZXN1bHQsXG5cdH0gZnJvbSAnLi9jb21waWxlLWNvbmZpZy50cydcblxuZXhwb3J0IHtcblx0dW5kZWYsIGRlZmluZWQsIG5vdGRlZmluZWQsIHBhc3MsXG5cdHNldExvZ0xldmVsLCBwdXNoTG9nTGV2ZWwsIHBvcExvZ0xldmVsLFxuXHRjdXJMb2dMZXZlbCwgY2xlYXJMb2csIGdldExvZyxcblx0SU5ERU5ULCBVTkRFTlQsIENMRUFSLFxuXHREQkcsIExPRywgV0FSTiwgRVJSLFxuXHRPTCwgTUwsIGNyb2FrLCBhc3NlcnQsIGdldE9wdGlvbnMsXG5cdHJlbW92ZUVtcHR5S2V5cywga2V5cywgaGFzS2V5LCBoYXNLZXlzLCBtZXJnZSxcblx0c3BhY2VzLCB0YWJzLFxuXHRpc1N0cmluZywgaXNOb25FbXB0eVN0cmluZywgaXNCb29sZWFuLCBpc051bWJlciwgaXNJbnRlZ2VyLFxuXHRpc0FycmF5LCBpc0FycmF5T2ZTdHJpbmdzLCBpc0hhc2gsIGlzT2JqZWN0LCBpc1JlZ0V4cCxcblx0aXNFbXB0eSwgbm9uRW1wdHksXG5cdGlzRmlsZSwgaXNEaXIsIGZpbGVFeHQsIHdpdGhFeHQsXG5cdHJtRmlsZSwgZ2V0UGF0aFR5cGUsIGdldFN0YXRzLCBwYXJzZVBhdGgsXG5cdGFsbEZpbGVzTWF0Y2hpbmcsIGFsbExpbmVzSW4sIHdhdGNoRmlsZSwgd2F0Y2hGaWxlcyxcblx0bm9ybWFsaXplUGF0aCwgbWtwYXRoLCByZWxwYXRoLCBuZXdlckRlc3RGaWxlRXhpc3RzLFxuXHRwYXRoU3ViRGlycywgY2xlYXJEaXIsIG1rRGlyLCBta0RpcnNGb3JGaWxlLFxuXHRzbHVycCwgYmFyZiwgbXlzZWxmLCByZW1vdmVGaWxlc01hdGNoaW5nLFxuXHRjb21waWxlRmlsZSwgZXhlY0NtZCwgZXhlY0NtZFN5bmMsIGNtZFN1Y2NlZWRzLFxuXHRpc0RpclNwZWMsXG5cdH1cbmV4cG9ydCB0eXBlIHtcblx0ZXhlY0NtZFJlc3VsdCwgY29tcGlsZVJlc3VsdCxcblx0fVxuXG4vKipcbiAqIEBtb2R1bGUgbGx1dGlscyAtIGxvdyBsZXZlbCB1dGlsaXRpZXNcbiAqL1xuXG5leHBvcnQgdHlwZSBibG9ja1NwZWMgPSBzdHJpbmcgfCBzdHJpbmdbXVxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKipcbiAqIFNwbGl0cyBhIHN0cmluZyBvbiB3aGl0ZXNwYWNlIGludG8gYW4gYXJyYXksXG4gKiBpZ25vcmluZyBhbnkgbGVhZGluZyBvciB0cmFpbGluZyB3aGl0ZXNwYWNlXG4gKi9cblxuZXhwb3J0IHdzU3BsaXQgOj0gKHN0cjogc3RyaW5nKTogc3RyaW5nW10gPT5cblxuXHRuZXdzdHIgOj0gc3RyLnRyaW0oKVxuXHRpZiAobmV3c3RyID09ICcnKVxuXHRcdHJldHVybiBbXVxuXHRlbHNlXG5cdFx0cmV0dXJuIG5ld3N0ci5zcGxpdCgvXFxzKy8pXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogc3BsaXRzIGVhY2ggc3RyaW5nIG9uIHdoaXRlc3BhY2UgaWdub3JpbmcgYW55IGxlYWRpbmdcbiAqIG9yIHRyYWlsaW5nIHdoaXRlc3BhY2UsIGFuZCByZXR1cm5zIGFuIGFycmF5IG9mXG4gKiBhbGwgc3Vic3RyaW5ncyBvYnRhaW5lZFxuICovXG5cbmV4cG9ydCB3b3JkcyA6PSAoLi4ubFN0cmluZ3M6IHN0cmluZ1tdKTogc3RyaW5nW10gPT5cblxuXHRsZXQgbFdvcmRzID0gW11cblx0Zm9yIHN0ciBvZiBsU3RyaW5nc1xuXHRcdGZvciB3b3JkIG9mIHdzU3BsaXQoc3RyKVxuXHRcdFx0bFdvcmRzLnB1c2ggd29yZFxuXHRyZXR1cm4gbFdvcmRzXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogQSBnZW5lcmF0b3IgdGhhdCB5aWVsZHMgaW50ZWdlcnMgc3RhcnRpbmcgd2l0aCAwIGFuZFxuICogY29udGludWluZyB0byBuLTFcbiAqL1xuXG5leHBvcnQgcmFuZ2UgOj0gKG46IG51bWJlcik6IEdlbmVyYXRvcjxudW1iZXIsIHZvaWQsIHVua25vd24+IC0+XG5cblx0bGV0IGkgPSAwXG5cdHdoaWxlIChpIDwgbilcblx0XHR5aWVsZCBpXG5cdFx0aSA9IGkgKyAxXG5cdHJldHVyblxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKipcbiAqIGNvbnZlcnRzIHggdG8gYSBzdHJpbmcsIHJlbW92aW5nIGFueSBjYXJyaWFnZSByZXR1cm5zXG4gKiBhbmQgcmVtb3ZpbmcgbGVhZGluZyBhbmQgdHJhaWxpbmcgd2hpdGVzcGFjZVxuICovXG5cbmV4cG9ydCBub3JtYWxpemVTdHIgOj0gKHg6IGFueSk6IHN0cmluZyA9PlxuXG5cdHJldHVybiB4LnRvU3RyaW5nKCkucmVwbGFjZUFsbCgnXFxyJywgJycpLnRyaW0oKVxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKipcbiAqIGNhbGN1bGF0ZXMgdGhlIG51bWJlciBvZiBleHRyYSBjaGFyYWN0ZXJzIG5lZWRlZCB0b1xuICogbWFrZSB0aGUgZ2l2ZW4gc3RyaW5nIGhhdmUgdGhlIGdpdmVuIGxlbmd0aC5cbiAqIElmIG5vdCBwb3NzaWJsZSwgcmV0dXJucyAwXG4gKi9cblxuZXhwb3J0IGdldE5FeHRyYSA9IChzdHI6IHN0cmluZywgbGVuOiBudW1iZXIpOiBudW1iZXIgPT5cblxuXHRleHRyYSA6PSBsZW4gLSBzdHIubGVuZ3RoXG5cdHJldHVybiAoZXh0cmEgPiAwKSA/IGV4dHJhIDogMFxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKipcbiAqIHBhZHMgdGhlIGdpdmVuIHN0cmluZyBvbiB0aGUgcmlnaHQgd2l0aFxuICogdGhlIGdpdmVuIGNoYXJhY3RlciwgdG8gdGhlIGdpdmVuIGxlbmd0aFxuICovXG5cbmV4cG9ydCBycGFkIDo9IChzdHI6IHN0cmluZywgbGVuOiBudW1iZXIsIGNoOiBzdHJpbmc9JyAnKTogc3RyaW5nID0+XG5cblx0YXNzZXJ0IChjaC5sZW5ndGggPT0gMSksIFwiTm90IGEgY2hhclwiXG5cdGV4dHJhIDo9IGdldE5FeHRyYShzdHIsIGxlbilcblx0cmV0dXJuIHN0ciArIGNoLnJlcGVhdChleHRyYSlcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuLyoqXG4gKiBwYWRzIHRoZSBnaXZlbiBzdHJpbmcgb24gdGhlIGxlZnQgd2l0aFxuICogdGhlIGdpdmVuIGNoYXJhY3RlciwgdG8gdGhlIGdpdmVuIGxlbmd0aFxuICovXG5cbmV4cG9ydCBscGFkIDo9IChzdHI6IHN0cmluZywgbGVuOiBudW1iZXIsIGNoOiBzdHJpbmc9JyAnKTogc3RyaW5nID0+XG5cblx0YXNzZXJ0IChjaC5sZW5ndGggPT0gMSksIFwiTm90IGEgY2hhclwiXG5cdGV4dHJhIDo9IGdldE5FeHRyYShzdHIsIGxlbilcblx0cmV0dXJuIGNoLnJlcGVhdChleHRyYSkgKyBzdHJcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiMgLS0tIHZhbGlkIG9wdGlvbnM6XG4jICAgICAgICBjaGFyIC0gY2hhciB0byB1c2Ugb24gbGVmdCBhbmQgcmlnaHRcbiMgICAgICAgIGJ1ZmZlciAtIG51bSBzcGFjZXMgYXJvdW5kIHRleHQgd2hlbiBjaGFyIDw+ICcgJ1xuXG4vKipcbiAqIHBhZHMgdGhlIGdpdmVuIHN0cmluZyBvbiBib3RoIHRoZSBsZWZ0IGFuZCByaWdodFxuICogd2l0aCB0aGUgZ2l2ZW4gY2hhcmFjdGVyLCB0byB0aGUgZ2l2ZW4gbGVuZ3RoXG4gKiBidXQgd2l0aCB0aGUgZ2l2ZW4gbnVtYmVyIG9mIGJ1ZmZlciBjaGFycyBzdXJyb3VuZGluZ1xuICogdGhlIHRleHRcbiAqL1xuXG5leHBvcnQgY2VudGVyZWQgOj0gKFxuXHR0ZXh0OiBzdHJpbmcsXG5cdHdpZHRoOiBudW1iZXIsXG5cdGNoYXI6IHN0cmluZyA9ICcgJyxcblx0bnVtQnVmZmVyOiBudW1iZXIgPSAyXG5cdCk6IHN0cmluZyA9PlxuXG5cdHRvdFNwYWNlcyA6PSB3aWR0aCAtIHRleHQubGVuZ3RoXG5cdGlmICh0b3RTcGFjZXMgPD0gMClcblx0XHRyZXR1cm4gdGV4dFxuXHRudW1MZWZ0IDo9IE1hdGguZmxvb3IodG90U3BhY2VzIC8gMilcblx0bnVtUmlnaHQgOj0gdG90U3BhY2VzIC0gbnVtTGVmdFxuXHRpZiAoY2hhciA9PSAnICcpXG5cdFx0cmV0dXJuIHNwYWNlcyhudW1MZWZ0KSArIHRleHQgKyBzcGFjZXMobnVtUmlnaHQpXG5cdGVsc2Vcblx0XHRidWYgOj0gJyAnLnJlcGVhdChudW1CdWZmZXIpXG5cdFx0bGVmdCA6PSBjaGFyLnJlcGVhdChudW1MZWZ0IC0gbnVtQnVmZmVyKVxuXHRcdHJpZ2h0IDo9IGNoYXIucmVwZWF0KG51bVJpZ2h0IC0gbnVtQnVmZmVyKVxuXHRcdHJldHVybiBsZWZ0ICsgYnVmICsgdGV4dCArIGJ1ZiArIHJpZ2h0XG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogcGFkIGEgc3RyaW5nIG9uIHRoZSBsZWZ0LCByaWdodCwgb3IgYm90aFxuICogdG8gdGhlIGdpdmVuIHdpZHRoXG4gKi9cblxuZXhwb3J0IGFsaWduU3RyaW5nIDo9IChcblx0c3RyOiBzdHJpbmcsXG5cdHdpZHRoOiBudW1iZXIsXG5cdGFsaWduOiBzdHJpbmdcblx0KTogc3RyaW5nIC0+XG5cblx0YXNzZXJ0IGlzU3RyaW5nKHN0ciksIFwic3RyIG5vdCBhIHN0cmluZzogI3tPTChzdHIpfVwiXG5cdGFzc2VydCBpc1N0cmluZyhhbGlnbiksIFwiYWxpZ24gbm90IGEgc3RyaW5nOiAje09MKGFsaWduKX1cIlxuXHRzd2l0Y2ggYWxpZ25cblx0XHR3aGVuICdsZWZ0JywgJ2wnXG5cdFx0XHRyZXR1cm4gcnBhZChzdHIsIHdpZHRoKVxuXHRcdHdoZW4gJ2NlbnRlcicsICdjJ1xuXHRcdFx0cmV0dXJuIGNlbnRlcmVkKHN0ciwgd2lkdGgpXG5cdFx0d2hlbiAncmlnaHQnLCAncidcblx0XHRcdHJldHVybiBscGFkKHN0ciwgd2lkdGgpXG5cdFx0ZWxzZVxuXHRcdFx0dGhyb3cgbmV3IEVycm9yIFwiVW5rbm93biBhbGlnbjogI3tPTChhbGlnbil9XCJcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuLyoqXG4gKiBjb252ZXJ0cyB0aGUgZ2l2ZW4gbnVtYmVyIHRvIGEgc3RyaW5nLCB0aGVuIHBhZHMgb24gdGhlIGxlZnRcbiAqIHdpdGggemVyb3MgdG8gYWNoaWV2ZSB0aGUgZ2l2ZW4gbGVuZ3RoXG4gKi9cblxuZXhwb3J0IHpwYWQgOj0gKG46IG51bWJlciwgbGVuOiBudW1iZXIpOiBzdHJpbmcgPT5cblxuXHRyZXR1cm4gbHBhZChuLnRvU3RyaW5nKCksIGxlbiwgJzAnKVxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKipcbiAqIGNvbnZlcnQgYSBtdWx0aS1saW5lIHN0cmluZyB0byBhbiBhcnJheVxuICogb2Ygc2luZ2xlIGxpbmUgc3RyaW5nc1xuICovXG5cbmV4cG9ydCBibG9ja1RvQXJyYXkgPSAoYmxvY2s6IHN0cmluZyk6IHN0cmluZ1tdID0+XG5cblx0YXNzZXJ0IGlzU3RyaW5nKGJsb2NrKSwgXCJibG9jayBpczogI3tPTChibG9jayl9XCJcblx0aWYgaXNFbXB0eShibG9jaylcblx0XHRyZXR1cm4gW11cblx0ZWxzZVxuXHRcdHJldHVybiBibG9jay5zcGxpdCgvXFxyP1xcbi8pXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogcmV0dXJuIGFuIGFycmF5IGFzIGlzLCBjb252ZXJ0IGEgbXVsdGktbGluZSBzdHJpbmdcbiAqIHRvIGFuIGFycmF5IG9mIHNpbmdsZSBsaW5lIHN0cmluZ3NcbiAqL1xuXG5leHBvcnQgdG9BcnJheSA9IChzdHJPckFycmF5OiBibG9ja1NwZWMpOiBzdHJpbmdbXSA9PlxuXG5cdGlmIEFycmF5LmlzQXJyYXkoc3RyT3JBcnJheSlcblx0XHRyZXR1cm4gc3RyT3JBcnJheVxuXHRlbHNlXG5cdFx0cmV0dXJuIGJsb2NrVG9BcnJheShzdHJPckFycmF5KVxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKipcbiAqIGNvbnZlcnQgYW4gYXJyYXkgb2Ygc3RyaW5ncyB0byBhIHNpbmdsZSBtdWx0aS1saW5lIHN0cmluZ1xuICovXG5cbmV4cG9ydCBhcnJheVRvQmxvY2sgPSAobExpbmVzOiBzdHJpbmdbXSk6IHN0cmluZyA9PlxuXG5cdGFzc2VydCBpc0FycmF5KGxMaW5lcyksIFwibExpbmVzIGlzIG5vdCBhbiBhcnJheTogI3tPTChsTGluZXMpfVwiXG5cdHJldHVybiBsTGluZXMuZmlsdGVyKChsaW5lKSA9PiBkZWZpbmVkKGxpbmUpKS5qb2luKFwiXFxuXCIpXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogcmV0dXJuIGEgc3RyaW5nIGFzIGlzLCBjb252ZXJ0IGFuIGFycmF5IG9mIHN0cmluZ3NcbiAqIHRvIGEgc2luZ2xlIG11bHRpLWxpbmUgc3RyaW5nXG4gKi9cblxuZXhwb3J0IHRvQmxvY2sgPSAoc3RyT3JBcnJheTogYmxvY2tTcGVjKTogc3RyaW5nID0+XG5cblx0aWYgaXNTdHJpbmcoc3RyT3JBcnJheSlcblx0XHRyZXR1cm4gc3RyT3JBcnJheVxuXHRlbHNlXG5cdFx0cmV0dXJuIGFycmF5VG9CbG9jayhzdHJPckFycmF5KVxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKipcbiAqIFJlbW92ZSBsaW5lcyBmcm9tIGEgc3RyaW5nIG9yIGFycmF5XG4gKiBwYXQgY2FuIGJlIGEgc3RyaW5nIG9yIGEgcmVndWxhciBleHByZXNzaW9uXG4gKi9cblxuZXhwb3J0IHJlbW92ZUxpbmVzIDo9IChcblx0c3RyT3JBcnJheTogc3RyaW5nIHwgc3RyaW5nW10sXG5cdHBhdDogc3RyaW5nIHwgUmVnRXhwXG5cdCk6IHN0cmluZyB8IHN0cmluZ1tdID0+XG5cblx0YXNzZXJ0IGlzU3RyaW5nKHBhdCkgfHwgaXNSZWdFeHAocGF0KSwgIFwiQmFkIGFyZyAyOiAje09MKHBhdCl9XCJcblx0bExpbmVzIDo9IGlzU3RyaW5nKHN0ck9yQXJyYXkpID8gYmxvY2tUb0FycmF5KHN0ck9yQXJyYXkpIDogc3RyT3JBcnJheVxuXHRsTmV3TGluZXMgOj0gKFxuXHRcdGlmICh0eXBlb2YgcGF0ID09ICdzdHJpbmcnKVxuXHRcdFx0bExpbmVzLmZpbHRlcigobGluZSkgPT4gKGxpbmUgIT0gcGF0KSlcblx0XHRlbHNlXG5cdFx0XHRsTGluZXMuZmlsdGVyKChsaW5lKSA9PiAobGluZS5tYXRjaChwYXQpID09IG51bGwpKVxuXHRcdClcblx0aWYgaXNTdHJpbmcoc3RyT3JBcnJheSlcblx0XHRyZXR1cm4gbE5ld0xpbmVzLmpvaW4oJ1xcbicpXG5cdGVsc2Vcblx0XHRyZXR1cm4gbE5ld0xpbmVzXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogcmVwbGFjZSB0aGVzZSBjaGFyYWN0ZXJzIHdpdGggc2luZ2xlIHVuaWNvZGUgY2hhcnM6XG4gKiAgICBjYXJyaWFnZSByZXR1cm5cbiAqICAgIG5ld2xpbmVcbiAqICAgIFRBQlxuICogICAgc3BhY2VcbiAqIE9wdGlvbmFsbHksIGFkZCBhIGNoYXJhY3RlciB0byBpbmRpY2F0ZSBhIHBhcnRpY3VsYXJcbiAqIHBvc2l0aW9uIGluIHRoZSBzdHJpbmdcbiAqIFZhbGlkIG9wdGlvbnM6XG4gKiAgICBvZmZzZXQgLSBpbmRpY2F0ZSBwb3NpdGlvbiBvZiBvZmZzZXRcbiAqICAgIHBvc2NoYXIgLSBjaGFyIHRvIHVzZSB0byBpbmRpY2F0ZSBwb3NpdGlvblxuICovXG5cbmV4cG9ydCBlc2NhcGVTdHIgOj0gKFxuXHRzdHI6IHN0cmluZyxcblx0aFJlcGxhY2U6IGhhc2ggPSB7XG5cdFx0XCJcXHJcIjogJ+KGkCdcblx0XHRcIlxcblwiOiAn4oaTJ1xuXHRcdFwiXFx0XCI6ICfihpInXG5cdFx0XCIgXCI6ICfLsydcblx0XHR9LFxuXHRoT3B0aW9uczogb3B0aW9uc3BlYyA9IHt9XG5cdCk6IHN0cmluZyA9PlxuXG5cdHtvZmZzZXQsIHBvc2NoYXJ9IDo9IGdldE9wdGlvbnMgaE9wdGlvbnMsIHtcblx0XHRvZmZzZXQ6IHVuZGVmXG5cdFx0cG9zY2hhcjogJ+KUiidcblx0XHR9XG5cblx0bFBhcnRzIDo9IFtdXG5cdGZvciBjaCxpIG9mIHN0ci5zcGxpdCgnJylcblx0XHRpZiBkZWZpbmVkKG9mZnNldCkgJiYgKGkgPT0gb2Zmc2V0KVxuXHRcdFx0bFBhcnRzLnB1c2ggcG9zY2hhclxuXHRcdG5ld2NoIDo9IGhSZXBsYWNlW2NoXVxuXHRcdGlmIGRlZmluZWQobmV3Y2gpXG5cdFx0XHRsUGFydHMucHVzaCBuZXdjaFxuXHRcdGVsc2Vcblx0XHRcdGxQYXJ0cy5wdXNoIGNoXG5cdGlmIChvZmZzZXQgPT0gc3RyLmxlbmd0aClcblx0XHRsUGFydHMucHVzaCBwb3NjaGFyXG5cdHJldHVybiBsUGFydHMuam9pbignJylcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuLyoqXG4gKiByZXBsYWNlIHRoZXNlIGNoYXJhY3RlcnMgd2l0aCBzaW5nbGUgdW5pY29kZSBjaGFyczpcbiAqICAgIGNhcnJpYWdlIHJldHVyblxuICogICAgVEFCXG4gKiAgICBzcGFjZVxuICogT3B0aW9uYWxseSwgYWRkIGEgY2hhcmFjdGVyIHRvIGluZGljYXRlIGEgcGFydGljdWxhclxuICogcG9zaXRpb24gaW4gdGhlIHN0cmluZ1xuICovXG5cbmV4cG9ydCBlc2NhcGVCbG9jayA9IChcblx0YmxvY2s6IHN0cmluZyxcblx0aFJlcGxhY2U6IGhhc2ggPSB7XG5cdFx0XCJcXHJcIjogJ+KGkCdcblx0XHRcIlxcdFwiOiAn4oaSJ1xuXHRcdFwiIFwiOiAny7MnXG5cdFx0fSxcblx0aE9wdGlvbnM6IG9wdGlvbnNwZWMgPSB7fVxuXHQpOiBzdHJpbmcgPT5cblxuXHRyZXR1cm4gZXNjYXBlU3RyKGJsb2NrLCBoUmVwbGFjZSwgaE9wdGlvbnMpXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbmV4cG9ydCBnZXRQYXR0ZXJuIDo9ICgpOiBzdHJpbmcgPT5cblxuXHRsS2V5cyA6PSBPYmplY3Qua2V5cyhoQ29tcGlsZXJDb25maWcuaENvbXBpbGVycylcblx0aWYgKGxLZXlzLmxlbmd0aCA9PSAxKVxuXHRcdHJldHVybiBcIioqLyoje2xLZXlzWzBdfVwiXG5cdGVsc2Vcblx0XHRyZXR1cm4gXCIqKi8qeyN7bEtleXMuam9pbignLCcpfX1cIlxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuIyAtLS0gQSBnZW5lcmF0b3IgLSB5aWVsZHMge3BhdGgsIHN0YXR1cywgb3V0UGF0aH1cblxuZXhwb3J0IGNvbXBpbGVBbGxGaWxlcyA6PSAoXG5cdHBhdHRlcm46IHN0cmluZz8gPSB1bmRlZixcblx0KTogR2VuZXJhdG9yPGNvbXBpbGVSZXN1bHQsIHZvaWQsIHVua25vd24+IC0+XG5cblx0aEdsb2JPcHRpb25zIDo9IHtcblx0XHRleGNsdWRlOiBbXG5cdFx0XHQnbm9kZV9tb2R1bGVzLyoqJ1xuXHRcdFx0Jy5naXQvKionXG5cdFx0XHQnKiovKi50ZW1wLionICAjIC0tLSBkb24ndCBjb21waWxlIHRlbXAgZmlsZXNcblx0XHRcdF1cblx0XHR9XG5cblx0Z2xvYlBhdHRlcm4gOj0gZGVmaW5lZChwYXR0ZXJuKSA/IHBhdHRlcm4gOiBnZXRQYXR0ZXJuKClcblx0REJHIFwiY29tcGlsaW5nIGFsbCBmaWxlcywgcGF0PSN7T0woZ2xvYlBhdHRlcm4pfVwiXG5cdGZvciB7cGF0aH0gb2YgYWxsRmlsZXNNYXRjaGluZyhnbG9iUGF0dGVybiwgaEdsb2JPcHRpb25zKVxuXHRcdGhSZXN1bHQgOj0gY29tcGlsZUZpbGUgcGF0aFxuXHRcdGlmIChoUmVzdWx0LnN0YXR1cyA9PSAnY29tcGlsZWQnKVxuXHRcdFx0eWllbGQgaFJlc3VsdFxuXHRyZXR1cm5cblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuZXhwb3J0IGVuc3VyZUNvbXBpbGVkIDo9IChcblx0ZGlyc3BlYzogc3RyaW5nLFxuXHRzdHViOiBzdHJpbmcsXG5cdHB1cnBvc2U6IHN0cmluZz8gPSB1bmRlZlxuXHQpOiBzdHJpbmc/ID0+XG5cblx0aCA6PSBmaW5kU291cmNlRmlsZSBkaXJzcGVjLCBzdHViLCBwdXJwb3NlXG5cdGlmIChoID09IHVuZGVmKSB8fCAoaC5wYXRoID09IHVuZGVmKSB8fCBub3QgaXNGaWxlKGgucGF0aClcblx0XHREQkcgXCJOb3QgY29tcGlsaW5nOiBubyBzdWNoIGZpbGU6ICN7ZGlyc3BlY30vI3tzdHVifS8je3B1cnBvc2V9XCJcblx0XHRyZXR1cm4gdW5kZWZcblx0ZWxzZVxuXHRcdHtzdGF0dXMsIG91dFBhdGh9IDo9IGNvbXBpbGVGaWxlIGgucGF0aFxuXHRcdGlmIChvdXRQYXRoID09IHVuZGVmKVxuXHRcdFx0V0FSTiBcIkNvbXBpbGUgb2YgbGliICN7aC5wYXRofSBmYWlsZWQgd2l0aCBzdGF0dXMgI3tzdGF0dXN9XCJcblx0XHRcdHJldHVybiB1bmRlZlxuXHRcdGVsc2Vcblx0XHRcdGFzc2VydCBpc0ZpbGUob3V0UGF0aCksXG5cdFx0XHRcdFx0XCJjb21waWxlRmlsZSgpIHN1Y2NlZWRlZCwgYnV0ICN7T0wob3V0UGF0aCl9IGRvZXMgbm90IGV4aXN0IVwiXG5cdFx0XHRyZXR1cm4gb3V0UGF0aFxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG50eXBlIHVuaXRUZXN0UmVzdWx0ID0ge1xuXHRzdHViOiBzdHJpbmdcblx0c3VjY2VzczogYm9vbGVhblxuXHRtc2c/OiBzdHJpbmdcblx0Y29kZT86IG51bWJlclxuXHRzaWduYWw/OiBzdHJpbmdcblx0fVxuXG5leHBvcnQgcnVuVW5pdFRlc3QgOj0gKFxuXHRzdHViOiBzdHJpbmcsXG5cdCk6IHVuaXRUZXN0UmVzdWx0ID0+XG5cblx0REJHIFwiUnVubmluZyB1bml0IHRlc3QgI3tzdHVifVwiXG5cblx0ZW5zdXJlQ29tcGlsZWQgJ2xpYkRpcicsIHN0dWJcblx0ZW5zdXJlQ29tcGlsZWQgJ2JpbkRpcicsIHN0dWJcblxuXHQjIC0tLSBUaGlzIGlzIHRoZSBwYXRoIHRvIHRoZSB0ZXN0IHRvIGJlIHJ1blxuXHR0ZXN0T3V0UGF0aCA6PSBlbnN1cmVDb21waWxlZCAndGVzdERpcicsIHN0dWIsICd0ZXN0J1xuXHRpZiAodGVzdE91dFBhdGggPT0gdW5kZWYpXG5cdFx0V0FSTiBcIkNvbXBpbGUgb2YgI3tzdHVifSB1bml0IHRlc3QgZmFpbGVkXCJcblx0XHRyZXR1cm4ge1xuXHRcdFx0c3R1YlxuXHRcdFx0c3VjY2VzczogZmFsc2Vcblx0XHRcdG1zZzogXCJDb21waWxlIG9mICN7c3R1Yn0gdW5pdCB0ZXN0IGZhaWxlZFwiXG5cdFx0XHR9XG5cdGVsc2Vcblx0XHREQkcgXCJ0ZXN0T3V0UGF0aCA9ICN7T0wodGVzdE91dFBhdGgpfVwiXG5cblx0IyAtLS0gQ29tcGlsZSBhbGwgZmlsZXMgaW4gc3ViZGlyIGlmIGl0IGV4aXN0c1xuXHRpZiBpc0RpcihcInRlc3QvI3tzdHVifVwiKVxuXHRcdGZvciB7cGF0aCwgc3RhdHVzLCBvdXRQYXRofSBvZiBjb21waWxlQWxsRmlsZXMoXCJ0ZXN0LyN7c3R1Yn0vKlwiKVxuXHRcdFx0aWYgbm90ZGVmaW5lZChvdXRQYXRoKVxuXHRcdFx0XHRXQVJOIFwiRmlsZSAje09MKHBhdGgpfSBub3QgY29tcGlsZWRcIlxuXG5cdCMgLS0tIFJ1biB0aGUgdW5pdCB0ZXN0LCByZXR1cm4gcmV0dXJuIGNvZGVcblx0YXNzZXJ0IGlzRmlsZSh0ZXN0T3V0UGF0aCksIFwiTm8gc3VjaCBmaWxlOiAje09MKHRlc3RPdXRQYXRoKX1cIlxuXG5cdCMgLS0tIFJldHVybiB2YWx1ZSBoYXMga2V5cyBzdWNjZXNzLCBjb2RlLCBzaWduYWxcblx0aCA6PSBleGVjQ21kU3luYyAnZGVubycsIFtcblx0XHRcdCd0ZXN0Jyxcblx0XHRcdCctcUEnLFxuXHRcdFx0dGVzdE91dFBhdGhcblx0XHRcdF1cbiNcdGhSZXN1bHQuc3R1YiA9IHN0dWJcblx0cmV0dXJuIHtcblx0XHRzdHViXG5cdFx0c3VjY2VzczogaC5zdWNjZXNzXG5cdFx0Y29kZTogaC5jb2RlXG5cdFx0c2lnbmFsOiBoLnNpZ25hbFxuXHRcdH1cblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiMgLS0tIGEgZ2VuZXJhdG9yXG5cbmV4cG9ydCBydW5BbGxVbml0VGVzdHMgOj0gKCk6IEdlbmVyYXRvcjx1bml0VGVzdFJlc3VsdCwgdm9pZCwgdW5rbm93bj4gLT5cblxuXHRoR2xvYk9wdGlvbnMgOj0ge1xuXHRcdGV4Y2x1ZGU6IFsnbm9kZV9tb2R1bGVzLyoqJywgJy5naXQvKionXVxuXHRcdH1cblxuXHRwYXR0ZXJuIDo9ICd0ZXN0LyoudGVzdC5qcydcblx0REJHIFwicGF0dGVybiA9ICN7T0wocGF0dGVybil9XCJcblx0Zm9yIHtwYXRofSBvZiBhbGxGaWxlc01hdGNoaW5nKHBhdHRlcm4sIGhHbG9iT3B0aW9ucylcblx0XHR7c3R1Yn0gOj0gcGFyc2VQYXRoKHBhdGgpXG5cdFx0aWYgKHN0dWIgPT0gdW5kZWYpXG5cdFx0XHRXQVJOIFwiTm8gc3R1YiBmb3VuZCBpbiAje09MKHBhdGgpfVwiXG5cdFx0ZWxzZVxuXHRcdFx0REJHIFwiVEVTVDogI3twYXRofVwiXG5cdFx0XHR5aWVsZCBydW5Vbml0VGVzdChzdHViKVxuXHRyZXR1cm5cblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuaEtleVRvTG9nZ2VyOiBoYXNoIDo9IHtcblx0UDogJ3Byb2ZpbGUnXG5cdEQ6ICdkZWJ1Zydcblx0UTogJ3F1aWV0J1xuXHRTOiAnc2lsZW50J1xuXHR9XG5cbmV4cG9ydCBzZXRMb2dnZXJGcm9tQXJncyA6PSAobEFyZ3M6IHN0cmluZ1tdKTogdm9pZCA9PlxuXG5cdGZvciBzdHIgb2YgbEFyZ3Ncblx0XHRsTWF0Y2hlcyA6PSBzdHIubWF0Y2goLy8vXlxuXHRcdFx0LVxuXHRcdFx0KFtBLVphLXowLTlfLV0qKVxuXHRcdFx0KD0pP1xuXHRcdFx0Ly8vKVxuXHRcdGlmIChsTWF0Y2hlcyA9PSBudWxsKVxuXHRcdFx0cGFzcygpXG5cdFx0ZWxzZVxuXHRcdFx0a2V5U3RyIDo9IGxNYXRjaGVzWzFdXG5cdFx0XHRoYXNFcSA6PSBsTWF0Y2hlc1syXVxuXHRcdFx0aWYgaXNFbXB0eShoYXNFcSlcblx0XHRcdFx0Zm9yIGtleSBvZiBrZXlzKGhLZXlUb0xvZ2dlcilcblx0XHRcdFx0XHRpZiBrZXlTdHIuaW5jbHVkZXMoa2V5KVxuXHRcdFx0XHRcdFx0c2V0TG9nTGV2ZWwgaEtleVRvTG9nZ2VyW2tleV1cblx0cmV0dXJuXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogUGFyc2UgY29tbWFuZCBsaW5lIGFyZ3VtZW50cywgb3B0aW9uYWxseSBzcGVjaWZ5aW5nIHdoaWNoXG4gKiBvcHRpb25zIHRvIGV4cGVjdCBhbmQvb3IgdGhlIGV4cGVjdGVkIG51bWJlciBvZiBub24tb3B0aW9uc1xuICpcbiAqIFRoZXJlIGFyZSAzIGtpbmRzIG9mIGl0ZW1zIGFsbG93ZWQgb24gdGhlIGNvbW1hbmQgbGluZTpcbiAqXG4gKiAxLiBmbGFncywgZS5nLlxuICogXHRgLWZueGAgLSBzZXRzIGZsYWdzIGBmYCwgJ24nIGFuZCBgeGAgdG8gdHJ1ZVxuICogICAgZmxhZ3MgbXVzdCBiZSB1cHBlciBvciBsb3dlciBjYXNlIGxldHRlcnNcbiAqXG4gKiAyLiBhbiBvcHRpb24gd2l0aCBhIHZhbHVlLCBlLmcuXG4gKiBcdGAtbGFiZWw9bXlsYWJlbGAgLSBzZXRzIG9wdGlvbiBgbGFiZWxgIHRvIGAnbXlsYWJlbCdgXG4gKiBcdGlmIHRoZSB2YWx1ZSBjb250YWlucyBhIHNwYWNlIGNoYXIsIGl0IG11c3QgYmUgcXVvdGVkXG4gKiBcdGlmIHRoZSB2YWx1ZSBsb29rcyBsaWtlIGEgbnVtYmVyLCBpdCdzIHNldCB0byBhIG51bWJlclxuICpcbiAqIDMuIGFueXRoaW5nIGVsc2UgaXMgYSBub24tb3B0aW9uLCBlLmcuXG4gKiBcdGM6L3RlbXAvdGVtcC50eHRcbiAqIFx0aWYgaXQgaW5jbHVkZXMgYSBzcGFjZSBjaGFyIG9yIHN0YXJ0cyB3aXRoIGAtYCxcbiAqIFx0XHRpdCBtdXN0IGJlIHF1b3RlZFxuICpcbiAqIHRoZSAxc3QgYXJndW1lbnQgdG8gZ2V0Q21kQXJncygpIGlzIG9wdGlvbmFsLCBhbmQgaXMgYSBoYXNoXG4gKiBvZiBpbmZvcm1hdGlvbiBhYm91dCB0aGUgZXhwZWN0ZWQgYXJndW1lbnRzLlxuICpcbiAqIElmIGtleSAnXycgaXMgcHJlc2VudCwgaXQgbXVzdCBiZSBhIGhhc2ggcG9zc2libHkgaW5jbHVkaW5nIGtleXM6XG4gKiAgICAncmFuZ2UnIC0gZWl0aGVyIGFuIGludGVnZXIgc3BlY2lmeWluZyB0aGUgZXhhY3QgbnVtYmVyIG9mXG4gKiAgICAgICAgICAgICAgbm9uLW9wdGlvbnMgZXhwZWN0ZWQsIG9mIGFuIGFycmF5IG9mIDIgaW50ZWdlcnNcbiAqICAgICAgICAgICAgICBzcGVjaWZ5aW5nIHRoZSBtaW5pbXVtIGFuZCBtYXhpbXVtIG51bWJlciBvZlxuICogICAgICAgICAgICAgIG5vbi1vcHRpb25zIGV4cGVjdGVkLiBUaGUgMm5kIG9mIHRoZXNlIG1heSBiZVxuICogICAgICAgICAgICAgIHRoZSBzdHJpbmcgJ2luZicgdG8gaW5kaWNhdGUgbm8gbWF4aW11bSBudW1iZXJcbiAqICAgICdkZXNjJyAtIGEgdGV4dCBkZXNjcmlwdGlvbiBvZiB3aGF0IG5vbi1vcHRpb25zIGFyZVxuICpcbiAqIEFsbCBvdGhlciBrZXlzIGFyZSBuYW1lcyBvZiBvcHRpb25zIGFsbG93ZWQsIGFuZCB0aGUgYXNzb2NpYXRlZCB2YWx1ZVxuICogbXVzdCBiZSBhIGhhc2ggd2l0aCBwb3NzaWJseSB0aGVzZSBrZXlzOlxuICogICAgdHlwZSAtIHRoZSB0eXBlIG9mIHZhbHVlIGV4cGVjdGVkIChkZWZhdWx0cyB0byAnYm9vbGVhbicpXG4gKiAgICBkZXNjIC0gYSB0ZXh0IGRlc2NyaXB0aW9uIG9mIHRoZSBvcHRpb24gKHVzZWQgb24gaGVscCBzY3JlZW5zKVxuICpcbiAqIHRoZSAybmQgYXJndW1lbnQgdG8gZ2V0Q21kQXJncygpIGlzIGFuIGFycmF5IG9mIHN0cmluZyBhcmd1bWVudHNcbiAqIGZyb20gdGhlIGNvbW1hbmQgbGluZSAoZGVmYXVsdHMgdG8gRGVuby5hcmdzKVxuICpcbiAqIHRoZSAzcmQgYXJndW1lbnQgdG8gZ2V0Q21kQXJncygpIGlzIGEgaGFzaCBvZiBwb3NzaWJsZSBvcHRpb25zOlxuICogICAgZG9TZXRMb2dnZXIgLSBkZWZhdWx0cyB0byB0cnVlIC0gaWYgZmFsc2UsIHRoZW4gb3B0aW9uc1xuICogICAgICAgICAgICAgICAgICAtUCwgLUQsIC1RIGFuZCAtUyBubyBsb25nZXIgc2V0IGxvZ2dpbmcgb3B0aW9ucyBhbmRcbiAqICAgICAgICAgICAgICAgICAgbWF5IHRoZXJlZm9yZSBiZSB1c2VkIGZvciBvdGhlciBwdXJwb3Nlc1xuICpcbiAqIEJ5IGRlZmF1bHQsIHRoZSBmb2xsb3dpbmcgZmxhZ3MgYXJlIHJlY29nbml6ZWQsIGFuZCB0aGVyZWZvcmVcbiAqIGNhbm5vdCBiZSBpbmNsdWRlZCBpbiBoRGVzYyAodGhpcyBiZWhhdmlvciBjYW4gYmVcbiAqIGRpc2FibGVkIGJ5IHNldHRpbmcgaE9wdGlvbnMuZG9TZXRMb2dnZXIgdG8gZmFsc2UpOlxuICpcbiAqIGAtUGAgLSBzZXQgdGhlIGN1cnJlbnQgbG9nIGxldmVsIHRvICdwcm9maWxlJ1xuICogYC1EYCAtIHNldCB0aGUgY3VycmVudCBsb2cgbGV2ZWwgdG8gJ2RlYnVnJ1xuICogYC1RYCAtIHNldCB0aGUgY3VycmVudCBsb2cgbGV2ZWwgdG8gJ3dhcm4nXG4gKiBgLVNgIC0gc2V0IHRoZSBjdXJyZW50IGxvZyBsZXZlbCB0byAnc2lsZW50J1xuICpcbiAqIChzZWUgbGlicmFyeSBAamRlaWdoYW4vbG9nZ2VyKVxuICovXG5cbmV4cG9ydCBnZXRDbWRBcmdzIDo9IChcblx0aERlc2M6IGhhc2g/ID0gdW5kZWYsXG5cdGxBcmdzOiBzdHJpbmdbXSA9IERlbm8uYXJncyxcblx0aE9wdGlvbnM6IG9wdGlvbnNwZWMgPSB7fVxuXHQpOiBoYXNoID0+XG5cblx0aWYgbm90ZGVmaW5lZChoRGVzYylcblx0XHRwYXNzKClcblx0ZWxzZVxuXHRcdGFzc2VydCBpc0hhc2goaERlc2MpLCBcIkJhZCBoRGVzYzogI3tPTChoRGVzYyl9XCJcblx0YXNzZXJ0IGlzQXJyYXlPZlN0cmluZ3MobEFyZ3MpLCBcIkJhZCBsQXJnczogI3tPTChsQXJncyl9XCJcblxuXHRpZiAobEFyZ3MubGVuZ3RoID09IDEpICYmIChsQXJnc1swXSA9PSAnLWgnKVxuXHRpZiAoKGxBcmdzLmxlbmd0aCA9PSAxKVxuXHRcdFx0JiYgWyctaCcsJy0taCcsJy1oZWxwJywnLS1oZWxwJ10uaW5jbHVkZXMobEFyZ3NbMF0pXG5cdFx0XHQpXG5cdFx0aWYgbm90ZGVmaW5lZChoRGVzYylcblx0XHRcdExPRyBcIk5vIGhlbHAgYXZhaWxhYmxlXCJcblx0XHRlbHNlXG5cdFx0XHRzaG93SGVscChoRGVzYylcblx0XHREZW5vLmV4aXQoKVxuXG5cdCMgLS0tIEN1cnJlbnRseSwgdGhlcmUgaXMgb25seSBvbmUgcG9zc2libGUgb3B0aW9uXG5cdHtkb1NldExvZ2dlcn0gOj0gZ2V0T3B0aW9ucyBoT3B0aW9ucywge1xuXHRcdGRvU2V0TG9nZ2VyOiB0cnVlXG5cdFx0fVxuXG5cdGlmIGRvU2V0TG9nZ2VyXG5cdFx0aWYgbm90ZGVmaW5lZChoRGVzYylcblx0XHRcdHBhc3MoKVxuXHRcdGVsc2Vcblx0XHRcdGZvciBrZXkgb2Yga2V5cyhoS2V5VG9Mb2dnZXIpXG5cdFx0XHRcdGFzc2VydCBub3RkZWZpbmVkKGhEZXNjW2tleV0pLFxuXHRcdFx0XHRcdFx0XCJpbnZhbGlkIGtleSAje09MKGtleSl9IHNldCBpbiBoRGVzY1wiXG5cdFx0c2V0TG9nZ2VyRnJvbUFyZ3MobEFyZ3MpXG5cblx0aFJlc3VsdDogaGFzaCA6PSB7IF86IFtdIH1cblxuXHQjIC0tLSBVdGlsaXR5IGZ1bmN0aW9uc1xuXG5cdCMgLS0tIEV2ZW4gZ2V0cyBjYWxsZWQgZm9yIC1ELCAtUSwgLVAsIC1TXG5cdGFkZE9wdGlvbiA6PSAobmFtZTogc3RyaW5nLCB2YWx1ZTogYW55KSA9PlxuXHRcdERCRyBcImFkZE9wdGlvbigje09MKG5hbWUpfSwgI3tPTCh2YWx1ZSl9KVwiXG5cdFx0YXNzZXJ0IGlzU3RyaW5nKG5hbWUpLCBcIk5vdCBhIHN0cmluZzogI3tPTChuYW1lKX1cIlxuXHRcdGFzc2VydCBub3QgaGFzS2V5KGhSZXN1bHQsIG5hbWUpLFxuXHRcdFx0XHRcImR1cCBrZXkgI3tuYW1lfSwgaFJlc3VsdCA9ICN7T0woaFJlc3VsdCl9XCJcblxuXHRcdGlmIGRvU2V0TG9nZ2VyXG5cdFx0XHRsb2dnZXIgOj0gaEtleVRvTG9nZ2VyW25hbWVdXG5cdFx0XHRpZiBkZWZpbmVkKGxvZ2dlcilcblx0XHRcdFx0aFJlc3VsdFtuYW1lXSA9IHRydWVcblx0XHRcdFx0c2V0TG9nTGV2ZWwgbG9nZ2VyXG5cdFx0XHRcdHJldHVyblxuXG5cdFx0aWYgbm90ZGVmaW5lZChoRGVzYylcblx0XHRcdGhSZXN1bHRbbmFtZV0gPSB2YWx1ZVxuXHRcdFx0cmV0dXJuXG5cdFx0e3R5cGV9IDo9IGdldE9wdGlvbkluZm8oaERlc2MsIG5hbWUpXG5cblx0XHQjIC0tLSB0eXBlIGNoZWNraW5nXG5cdFx0aWYgaXNBcnJheSh0eXBlKVxuXHRcdFx0YXNzZXJ0IHR5cGUuaW5jbHVkZXModmFsdWUpLCBcInR5cGUgbm90IGFuIGFycmF5XCJcblx0XHRcdGhSZXN1bHRbbmFtZV0gPSB2YWx1ZVxuXHRcdGVsc2Vcblx0XHRcdHN3aXRjaCB0eXBlXG5cdFx0XHRcdHdoZW4gJ3N0cmluZydcblx0XHRcdFx0XHRoUmVzdWx0W25hbWVdID0gdmFsdWVcblx0XHRcdFx0d2hlbiAnYm9vbGVhbidcblx0XHRcdFx0XHRoUmVzdWx0W25hbWVdID0gKFxuXHRcdFx0XHRcdFx0ICAodmFsdWUgPT0gJ3RydWUnKSAgPyB0cnVlXG5cdFx0XHRcdFx0XHQ6ICh2YWx1ZSA9PSAnZmFsc2UnKSA/IGZhbHNlXG5cdFx0XHRcdFx0XHQ6ICAgICAgICAgICAgICAgICAgICAgIHZhbHVlXG5cdFx0XHRcdFx0XHQpXG5cdFx0XHRcdHdoZW4gJ251bWJlcicsJ2Zsb2F0J1xuXHRcdFx0XHRcdGhSZXN1bHRbbmFtZV0gPSBwYXJzZUZsb2F0KHZhbHVlKVxuXHRcdFx0XHR3aGVuICdpbnRlZ2VyJ1xuXHRcdFx0XHRcdGhSZXN1bHRbbmFtZV0gPSBwYXJzZUludCh2YWx1ZSlcblx0XHRyZXR1cm5cblxuXHRhZGROb25PcHRpb24gOj0gKHN0cjogc3RyaW5nKSA9PlxuXHRcdERCRyBcImFkZE5vbk9wdGlvbigje09MKHN0cil9KVwiXG5cdFx0aFJlc3VsdC5fLnB1c2ggc3RyXG5cblx0Zm9yIHN0ciBvZiBsQXJnc1xuXHRcdCMgLS0tIGlnbm9yZSAnLS0nXG5cdFx0aWYgKHN0ciA9PSAnLS0nKVxuXHRcdFx0REJHIFwic2tpcHBpbmcgLS1cIlxuXHRcdFx0Y29udGludWVcblxuXHRcdCMgLS0tIGNoZWNrIGlmIGl0J3MgYW4gb3B0aW9uXG5cdFx0bE1hdGNoZXMgOj0gc3RyLm1hdGNoKC8vL15cblx0XHRcdC1cblx0XHRcdChbQS1aYS16MC05Xy1dKilcblx0XHRcdCg/OlxuXHRcdFx0XHQoPSlcblx0XHRcdFx0KC4qKVxuXHRcdFx0XHQpP1xuXHRcdFx0JC8vLylcblx0XHRpZiAobE1hdGNoZXMgPT0gbnVsbClcblx0XHRcdCMgLS0tIGl0J3MgYSBub24tb3B0aW9uXG5cdFx0XHRhZGROb25PcHRpb24gc3RyXG5cdFx0ZWxzZVxuXHRcdFx0IyAtLS0gaXQncyBhbiBvcHRpb25cblx0XHRcdFtfLCBvcHRTdHIsIGVxU3RyLCB2YWx1ZV0gOj0gbE1hdGNoZXNcblx0XHRcdGlmIGVxU3RyXG5cdFx0XHRcdGFkZE9wdGlvbiBvcHRTdHIsIHZhbHVlXG5cdFx0XHRlbHNlXG5cdFx0XHRcdGZvciBjaCBvZiBvcHRTdHIuc3BsaXQoJycpXG5cdFx0XHRcdFx0YWRkT3B0aW9uIGNoLCB0cnVlXG5cblx0IyAtLS0gaWYgaERlc2MgaXMgc2V0LCB0aGVuXG5cdCMgICAgIEZpbGwgaW4gZGVmYXVsdCB2YWx1ZXMgaWYgYXZhaWxhYmxlXG5cblx0aWYgbm90ZGVmaW5lZChoRGVzYylcblx0XHRwYXNzKClcblx0ZWxzZVxuXHRcdGZvciBuYW1lIG9mIGtleXMoaERlc2MsICdleGNlcHQ9XycpXG5cdFx0XHRpZiBub3RkZWZpbmVkKGhSZXN1bHRbbmFtZV0pXG5cdFx0XHRcdHtkZWZhdWx0VmFsfSA6PSBnZXRPcHRpb25JbmZvKGhEZXNjLCBuYW1lKVxuXHRcdFx0XHRpZiBkZWZpbmVkKGRlZmF1bHRWYWwpXG5cdFx0XHRcdFx0aFJlc3VsdFtuYW1lXSA9IGRlZmF1bHRWYWxcblxuXHRcdCMgLS0tIENoZWNrIG9mIHRoZXJlJ3MgYSByZXN0cmljdGlvbiBvbiB0aGUgbnVtYmVyIG9mIG5vbi1vcHRpb25zXG5cblx0XHRpZiBoYXNLZXkoaERlc2MsICdfJylcblx0XHRcdGhJbmZvIDo9IGdldE5vbk9wdGlvbkluZm8oaERlc2MpXG5cdFx0XHRpZiAoaEluZm8gIT0gdW5kZWYpXG5cdFx0XHRcdHtyYW5nZX0gOj0gaEluZm9cblx0XHRcdFx0W21pbiwgbWF4XSA6PSByYW5nZVxuXHRcdFx0XHRsZW4gOj0gaFJlc3VsdC5fLmxlbmd0aFxuXHRcdFx0XHRhc3NlcnQgKGxlbiA+PSBtaW4pLCBcIiN7bGVufSBub24tb3B0aW9ucyA8IG1pbiAoI3ttaW59KVwiXG5cdFx0XHRcdGFzc2VydCAobGVuIDw9IG1heCksIFwiI3tsZW59IG5vbi1vcHRpb25zID4gbWF4ICgje21heH0pXCJcblxuXHREQkcgXCJoUmVzdWx0ID0gI3tPTChoUmVzdWx0KX1cIlxuXHRyZXR1cm4gaFJlc3VsdFxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG5leHBvcnQgZ2V0T3B0aW9uSW5mbyA6PSAoaERlc2M6IGhhc2gsIG5hbWU6IHN0cmluZyk6IGhhc2ggPT5cblxuXHQjIC0tLSBSZXR1cm4gdmFsdWUgaXMgYSBoYXNoIHdpdGgga2V5czogdHlwZSwgZGVzY1xuXG5cdGFzc2VydCBkZWZpbmVkKGhEZXNjKSwgXCJoRGVzYyBpcyBub3QgZGVmaW5lZCBpbiBnZXRPcHRpb25JbmZvKClcIlxuXHRhc3NlcnQgaXNIYXNoKGhEZXNjKSwgXCJoRGVzYyBpcyBub3QgYSBoYXNoIGluIGdldE9wdGlvbkluZm8oKTogI3tPTChoRGVzYyl9XCJcblx0YXNzZXJ0IChuYW1lICE9ICdfJyksIFwiZ2V0T3B0aW9uSW5mbyhoRGVzYywgJ18nKSBjYWxsZWRcIlxuXHRhc3NlcnQgaGFzS2V5KGhEZXNjLCBuYW1lKSwgXCJObyBzdWNoIG9wdGlvbjogLSN7bmFtZX1cIlxuXHRoIDo9IGlzSGFzaChoRGVzY1tuYW1lXSkgPyBoRGVzY1tuYW1lXSA6IHtkZXNjOiBoRGVzY1tuYW1lXX1cblx0aWYgbm90ZGVmaW5lZChoLnR5cGUpXG5cdFx0aC50eXBlID0gKG5hbWUubGVuZ3RoID09IDEpID8gJ2Jvb2xlYW4nIDogJ3N0cmluZydcblx0aWYgbm90ZGVmaW5lZChoLmRlc2MpXG5cdFx0aC5kZXNjID0gJzxubyBkZXNjcmlwdGlvbiBhdmFpbGFibGU+J1xuXHRpZiBub3QgaGFzS2V5KGgsICdkZWZhdWx0VmFsJykgJiYgKGgudHlwZSA9PSAnYm9vbGVhbicpXG5cdFx0aC5kZWZhdWx0VmFsID0gZmFsc2Vcblx0cmV0dXJuIGhcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiMgLS0tIHJldHVybnMgdW5kZWYgaWYgbm8gJ18nIGtleSBpbiBoRGVzY1xuXG50eXBlIHJhbmdlVHlwZSA9IFtudW1iZXIsIG51bWJlcl1cblxudHlwZSBub25PcHRpb25JbmZvID0ge1xuXHR0eXBlOiAnYXJyYXknXG5cdGRlc2M6IHN0cmluZ1xuXHRyYW5nZTogcmFuZ2VUeXBlXG5cdH1cblxuZXhwb3J0IGdldE5vbk9wdGlvbkluZm8gOj0gKGhEZXNjOiBoYXNoKTogbm9uT3B0aW9uSW5mbz8gPT5cblxuXHQjIC0tLSBSZXR1cm4gdmFsdWUgaXMgYSBoYXNoIHdpdGgga2V5czpcblx0IyAgICAgICAgdHlwZSA9ICdhcnJheSdcblx0IyAgICAgICAgZGVzY1xuXHQjICAgICAgICByYW5nZSBhcyBbbWluLCBtYXhdXG5cblx0YXNzZXJ0IGRlZmluZWQoaERlc2MpLCBcImhEZXNjIGlzIG5vdCBkZWZpbmVkIGluIGdldE5vbk9wdGlvbkluZm8oKVwiXG5cdGlmIG5vdCBoYXNLZXkoaERlc2MsICdfJylcblx0XHRyZXR1cm4gdW5kZWZcblx0ZGVzYyA6PSBoRGVzYy5kZXNjIHx8ICc8bm8gZGVzY3JpcHRpb24gYXZhaWxhYmxlPidcblx0bGV0IHJhbmdlOiByYW5nZVR5cGUgPSBbMCwgSW5maW5pdHldXG5cdGlmIGhhc0tleShoRGVzYywgJ3JhbmdlJylcblx0XHRyIDo9IGhEZXNjLnJhbmdlXG5cdFx0aWYgaXNJbnRlZ2VyKHIpXG5cdFx0XHRyYW5nZSA9IFtyLCByXVxuXHRcdGVsc2UgaWYgQXJyYXkuaXNBcnJheShyKVxuXHRcdFx0YXNzZXJ0IChyLmxlbmd0aCA9PSAyKSwgXCJCYWQgJ18nIGtleTogI3tPTChyKX1cIlxuXHRcdFx0W21pbiwgbWF4XSA6PSByXG5cdFx0XHRhc3NlcnQgaXNJbnRlZ2VyKG1pbiksIFwicmFuZ2UgbWluIG5vdCBhbiBpbnRlZ2VyXCJcblx0XHRcdGlmIChtYXggPT0gJ2luZicpXG5cdFx0XHRcdFttaW4sIEluZmluaXR5XVxuXHRcdFx0ZWxzZVxuXHRcdFx0XHRhc3NlcnQgaXNJbnRlZ2VyKG1heCksIFwicmFuZ2UgbWF4IG5vdCBhbiBpbnRlZ2VyXCJcblx0XHRcdFx0W21pbiwgbWF4XVxuXHRcdGVsc2Vcblx0XHRcdHRocm93IG5ldyBFcnJvciBcIkludmFsaWQgcmFuZ2U6ICN7T0wocil9XCJcblxuXHRyZXR1cm4ge1xuXHRcdHR5cGU6ICdhcnJheSdcblx0XHRkZXNjXG5cdFx0cmFuZ2Vcblx0XHR9XG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbmV4cG9ydCBzaG93SGVscCA6PSAoaERlc2M6IGhhc2gpOiB2b2lkID0+XG5cblx0TE9HIFwiQXZhaWxhYmxlIG9wdGlvbnM6XCJcblx0Zm9yIG5hbWUgb2Yga2V5cyhoRGVzYywgJ2V4Y2VwdD1fJylcblx0XHR7dHlwZSwgZGVzY30gOj0gZ2V0T3B0aW9uSW5mbyhoRGVzYywgbmFtZSlcblx0XHRMT0cgXCIgICAtI3tuYW1lfTogI3t0eXBlfSAtICN7ZGVzY31cIlxuXHRpZiBkZWZpbmVkKGhEZXNjLl8pXG5cdFx0TE9HIFwiQXZhaWxhYmxlIG5vbi1vcHRpb25zOlwiXG5cdFx0aWYgaXNIYXNoKGhEZXNjLl8pXG5cdFx0XHR7cmFuZ2UsIGRlc2N9IDo9IGhEZXNjLl9cblx0XHRcdGlmIGRlZmluZWQocmFuZ2UpXG5cdFx0XHRcdGlmIGlzSW50ZWdlcihyYW5nZSlcblx0XHRcdFx0XHRMT0cgXCIgICBUaGVyZSBtdXN0IGJlIGV4YWN0bHkgI3tyYW5nZX0gbm9uLW9wdGlvbnNcIlxuXHRcdFx0XHRlbHNlIGlmIGlzQXJyYXkocmFuZ2UpXG5cdFx0XHRcdFx0W21pbiwgbWF4XSA6PSByYW5nZVxuXHRcdFx0XHRcdGlmIChtaW4gPiAwKVxuXHRcdFx0XHRcdFx0TE9HIFwiICAgVGhlcmUgbXVzdCBiZSBhdCBsZWFzdCAje21pbn0gbm9uLW9wdGlvbnNcIlxuXHRcdFx0XHRcdGlmIChtYXggIT0gJ2luZicpXG5cdFx0XHRcdFx0XHRMT0cgXCIgICBUaGVyZSBtdXN0IGJlIGF0IG1vc3QgI3ttYXh9IG5vbi1vcHRpb25zXCJcblx0XHRkZXNjIDo9IChcblx0XHRcdCAgaXNTdHJpbmcoaERlc2MuXykgPyBoRGVzYy5fXG5cdFx0XHQ6IGlzSGFzaChoRGVzYy5fKSA/IChoRGVzYy5fLmRlc2MgfHwgJzxubyBkZXNjcmlwdGlvbiBhdmFpbGFibGU+Jylcblx0XHRcdDogY3JvYWsgXCJCYWQgZGVzY3JpcHRvciBmb3Igbm9uLW9wdGlvbnM6ICN7T0woaERlc2MuXyl9XCJcblx0XHRcdClcblx0XHRMT0cgZGVzY1xuXHRyZXR1cm5cbiJdfQ==