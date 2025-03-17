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
	pass, deeplyEquals, OL, ML, getOptions, croak, assert, throwsError,
	strToHash, removeEmptyKeys, keys, hasKey, hasKeys, merge,
	spaces, tabs, rtrim, countChars,
	blockToArray, toArray, arrayToBlock, toBlock,
	escapeStr, escapeBlock,
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
	LoggerEx, logger, setLogLevel, pushLogLevel, popLogLevel,
	curLogLevel, clearLog, getLog, getFullLog,
	INDENT, UNDENT, CLEAR,
	DBG, LOG, WARN, ERR,
	} from './logger.ts'
import {
	oneIndent, resetOneIndent, indentLevel, splitLine,
	indented, undented,
	} from './indent.ts'
import {
	execCmd, execCmdSync, cmdSucceeds,
	execCmdResult, mkstr, getCmdLine, getProcOpt, getFinalResult,
	} from './exec-utils.ts'
import {
	hCompilerConfig, findSourceFile, compileFile, isDirSpec,
	compileResult,
	} from './compile-config.ts'

export {
	undef, defined, notdefined, pass, deeplyEquals,
	LoggerEx, logger, setLogLevel, pushLogLevel, popLogLevel,
	curLogLevel, clearLog, getLog, getFullLog,
	INDENT, UNDENT, CLEAR,
	DBG, LOG, WARN, ERR,
	oneIndent, resetOneIndent, indentLevel, splitLine,
	indented, undented,
	OL, ML, croak, assert, throwsError, getOptions,
	removeEmptyKeys, keys, hasKey, hasKeys, merge,
	spaces, tabs, rtrim, countChars,
	blockToArray, toArray, arrayToBlock, toBlock,
	escapeStr, escapeBlock,
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
	mkstr, getCmdLine, getProcOpt, getFinalResult,
	}
export type {
	execCmdResult, compileResult,
	}

/**
 * utils - utility functions
 * @module
 */

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
	I: 'info',
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
 *                  -P, -D, -Q, -I and -S no longer set logging options
 *                  and may therefore be used for other purposes
 *
 * By default, the following flags are recognized, and therefore
 * cannot be included in hDesc (this behavior can be
 * disabled by setting hOptions.doSetLogger to false):
 *
 * `-P` - set the current log level to 'profile'
 * `-D` - set the current log level to 'debug'
 * `-Q` - set the current log level to 'warn'
 * `-I` - set the current log level to 'info'
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

// ---------------------------------------------------------------------------

export const setDir = (block: string): void => {

	console.log("Working on it")
}

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3JjL2xpYi91dGlscy5jaXZldC50c3giLCJzb3VyY2VzIjpbInNyYy9saWIvdXRpbHMuY2l2ZXQiXSwibWFwcGluZ3MiOiI7QUFBQSxjQUFhO0FBQ2IsQUFBQTtBQUNBLEFBQUEsTUFBTSxDQUFDLENBQUM7QUFDUixDQUFDLEtBQUssQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLFVBQVUsQ0FBQztBQUM1QixDQUFDLFFBQVEsQ0FBQyxDQUFDLGdCQUFnQixDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsU0FBUyxDQUFDO0FBQzVELENBQUMsT0FBTyxDQUFDLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxRQUFRLENBQUM7QUFDdkQsQ0FBQyxPQUFPLENBQUMsQ0FBQyxRQUFRLENBQUM7QUFDbkIsQ0FBQyxJQUFJLENBQUMsQ0FBQyxVQUFVLENBQUM7QUFDbEIsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLGdCQUFnQjtBQUN4QixBQUFBLEFBQUEsTUFBTSxDQUFDLENBQUM7QUFDUixDQUFDLElBQUksQ0FBQyxDQUFDLFlBQVksQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLFdBQVcsQ0FBQztBQUNwRSxDQUFDLFNBQVMsQ0FBQyxDQUFDLGVBQWUsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLEtBQUssQ0FBQztBQUMxRCxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLFVBQVUsQ0FBQztBQUNqQyxDQUFDLFlBQVksQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLFlBQVksQ0FBQyxDQUFDLE9BQU8sQ0FBQztBQUM5QyxDQUFDLFNBQVMsQ0FBQyxDQUFDLFdBQVcsQ0FBQztBQUN4QixDQUFDLENBQUMs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RUFBRSxLQUFLLENBQUMsQ0FBQztBQUNULEFBQUEsRUFBRSxDQUFDLEMsQ0FBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQztDQUFDLENBQUE7QUFDWCxBQUFBLENBQUMsTTtBQUFNLENBQUE7QUFDUCxBQUFBO0FBQ0EsQUFBQSw4RUFBNkU7QUFDN0UsQUFBQTtBQUNBLEFBQUE7QUFDQTtBQUNBO0FBQ0EsR0FBRztBQUNILEFBQUE7QUFDQSxBQUFBLEFBQUEsTUFBTSxDQUFhLE1BQVosWUFBWSxDQUFDLENBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQSxDQUFBO0FBQzFDLEFBQUE7QUFDQSxBQUFBLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsQztBQUFDLENBQUE7QUFDaEQsQUFBQTtBQUNBLEFBQUEsOEVBQTZFO0FBQzdFLEFBQUE7QUFDQSxBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsR0FBRztBQUNILEFBQUE7QUFDQSxBQUFBLEFBQUEsTUFBTSxDQUFDLElBQUEsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQSxDQUFBO0FBQ3hELEFBQUE7QUFDQSxBQUFBLENBQU0sTUFBTCxLQUFLLENBQUMsQ0FBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLE1BQU07QUFDMUIsQUFBQSxDQUFDLE1BQU0sQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQztBQUFDLENBQUE7QUFDL0IsQUFBQTtBQUNBLEFBQUEsOEVBQTZFO0FBQzdFLEFBQUE7QUFDQSxBQUFBO0FBQ0E7QUFDQTtBQUNBLEdBQUc7QUFDSCxBQUFBO0FBQ0EsQUFBQSxBQUFBLE1BQU0sQ0FBSyxNQUFKLElBQUksQ0FBQyxDQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFBLENBQUE7QUFDcEUsQUFBQTtBQUNBLEFBQUEsQ0FBQyxNQUFNLENBQUEsQUFBQyxDQUFDLEVBQUUsQ0FBQyxNQUFNLENBQUMsR0FBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsWUFBWSxDQUFBO0FBQ3RDLEFBQUEsQ0FBTSxNQUFMLEtBQUssQ0FBQyxDQUFFLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQztBQUM3QixBQUFBLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxLQUFLLEM7QUFBQyxDQUFBO0FBQzlCLEFBQUE7QUFDQSxBQUFBLDhFQUE2RTtBQUM3RSxBQUFBO0FBQ0EsQUFBQTtBQUNBO0FBQ0E7QUFDQSxHQUFHO0FBQ0gsQUFBQTtBQUNBLEFBQUEsQUFBQSxNQUFNLENBQUssTUFBSixJQUFJLENBQUMsQ0FBRSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQSxDQUFBO0FBQ3BFLEFBQUE7QUFDQSxBQUFBLENBQUMsTUFBTSxDQUFBLEFBQUMsQ0FBQyxFQUFFLENBQUMsTUFBTSxDQUFDLEdBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFlBQVksQ0FBQTtBQUN0QyxBQUFBLENBQU0sTUFBTCxLQUFLLENBQUMsQ0FBRSxDQUFDLFNBQVMs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QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsR0FBRztBQUNILEFBQUE7QUFDQSxBQUFBLEFBQUEsTUFBTSxDQUFXLE1BQVYsVUFBVSxDQUFDLENBQUUsQ0FBQyxDQUFDO0FBQ3RCLEFBQUEsQ0FBQyxLQUFLLEMsQyxDQUFDLEFBQUMsSSxZLENBQUssQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDO0FBQ3RCLEFBQUEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDO0FBQzdCLEFBQUEsQ0FBQyxRQUFRLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUMxQixDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUEsQ0FBQTtBQUNYLEFBQUE7QUFDQSxBQUFBLENBQUMsR0FBRyxDQUFBLFVBQVUsQ0FBQyxLQUFLLENBQUMsQ0FBQSxDQUFBLENBQUE7QUFDckIsQUFBQSxFQUFFLElBQUksQ0FBQyxDO0NBQUMsQ0FBQTtBQUNSLEFBQUEsQ0FBQyxJQUFJLENBQUEsQ0FBQTtBQUNMLEFBQUEsRUFBRSxNQUFNLENBQUEsQUFBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLFdBQVcsRUFBRSxFQUFFLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDO0NBQUEsQ0FBQTtBQUNqRCxBQUFBLENBQUMsTUFBTSxDQUFBLEFBQUMsZ0JBQWdCLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLFdBQVcsRUFBRSxFQUFFLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQzFELEFBQUE7QUFDQSxBQUFBLENBQUMsR0FBRyxDQUFBLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxHQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFD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Q0FBQyxLQUFLLEM7R0FBQSxDQUFBO0FBQzNCLEFBQUEsR0FBRyxJQUFJLENBQUEsQ0FBQTtBQUNQLEFBQUEsSUFBSSxHQUFHLENBQUMsQ0FBQSxNQUFBLEVBQUUsQ0FBQyxFQUFFLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsQ0FBQSxDQUFBLENBQUE7QUFDOUIsQUFBQSxLQUFLLFNBQVMsQ0FBQSxBQUFDLEVBQUUsQ0FBQyxDQUFDLElBQUksQztJQUFBLEM7R0FBQSxDO0VBQUEsQztDQUFBLENBQUE7QUFDdkIsQUFBQTtBQUNBLEFBQUEsQ0FBQyw0QkFBMkI7QUFDNUIsQUFBQSxDQUFDLDBDQUF5QztBQUMxQyxBQUFBO0FBQ0EsQUFBQSxDQUFDLEdBQUcsQ0FBQSxVQUFVLENBQUMsS0FBSyxDQUFDLENBQUEsQ0FBQSxDQUFBO0FBQ3JCLEFBQUEsRUFBRSxJQUFJLENBQUMsQztDQUFDLENBQUE7QUFDUixBQUFBLENBQUMsSUFBSSxDQUFBLENBQUE7QUFDTCxBQUFBLEVBQUUsR0FBRyxDQUFDLENBQUEsTUFBQSxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQSxDQUFBLENBQUE7QUFDckMsQUFBQSxHQUFHLEdBQUcsQ0FBQSxVQUFVLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUEsQ0FBQSxDQUFBO0FBQy9CLEFBQUEsSUFBZ0IsTUFBWixDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUUsQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFDO0FBQzlDLEFBQUEsSUFBSSxHQUFHLENBQUEsT0FBTyxDQUFDLFVBQVUsQ0FBQyxDQUFBLENBQUEsQ0FBQTtBQUMxQixBQUFBLEtBQUssT0FBTyxDQUFDLElBQUksQ0FBQyxDLENBQUUsQ0FBQyxVO0lBQVUsQztHQUFBLEM7RUFBQSxDQUFBO0FBQy9CLEFBQUE7QUFDQSxBQUFBLEVBQUUsa0VBQWlFO0FBQ25FLEFBQUE7QUFDQSxBQUFBLEVBQUUsR0FBRyxD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QUN6QyxBQUFBO0FBQ0EsQUFBQSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUEsQUFBQyxlQUFlLEM7QUFBQSxDQUFBO0FBQzVCIiwibmFtZXMiOltdLCJzb3VyY2VzQ29udGVudCI6WyIjIHV0aWxzLmNpdmV0XG5cbmltcG9ydCB7XG5cdHVuZGVmLCBkZWZpbmVkLCBub3RkZWZpbmVkLFxuXHRpc1N0cmluZywgaXNOb25FbXB0eVN0cmluZywgaXNCb29sZWFuLCBpc051bWJlciwgaXNJbnRlZ2VyLFxuXHRpc0FycmF5LCBpc0FycmF5T2ZTdHJpbmdzLCBpc0hhc2gsIGlzT2JqZWN0LCBpc1JlZ0V4cCxcblx0aXNFbXB0eSwgbm9uRW1wdHksXG5cdGhhc2gsIG9wdGlvbnNwZWMsXG5cdH0gZnJvbSAnLi9kYXRhdHlwZXMudHMnXG5pbXBvcnQge1xuXHRwYXNzLCBkZWVwbHlFcXVhbHMsIE9MLCBNTCwgZ2V0T3B0aW9ucywgY3JvYWssIGFzc2VydCwgdGhyb3dzRXJyb3IsXG5cdHN0clRvSGFzaCwgcmVtb3ZlRW1wdHlLZXlzLCBrZXlzLCBoYXNLZXksIGhhc0tleXMsIG1lcmdlLFxuXHRzcGFjZXMsIHRhYnMsIHJ0cmltLCBjb3VudENoYXJzLFxuXHRibG9ja1RvQXJyYXksIHRvQXJyYXksIGFycmF5VG9CbG9jaywgdG9CbG9jayxcblx0ZXNjYXBlU3RyLCBlc2NhcGVCbG9jayxcblx0fSBmcm9tICcuL2xsdXRpbHMudHMnXG5pbXBvcnQge1xuXHRpc0ZpbGUsIGlzRGlyLCBmaWxlRXh0LCB3aXRoRXh0LFxuXHRybUZpbGUsIGdldFBhdGhUeXBlLCBnZXRTdGF0cywgcGFyc2VQYXRoLFxuXHRhbGxGaWxlc01hdGNoaW5nLCBhbGxMaW5lc0luLCB3YXRjaEZpbGUsIHdhdGNoRmlsZXMsXG5cdG5vcm1hbGl6ZVBhdGgsIG1rcGF0aCwgcmVscGF0aCwgbmV3ZXJEZXN0RmlsZUV4aXN0cyxcblx0cGF0aFN1YkRpcnMsIGNsZWFyRGlyLCBta0RpciwgbWtEaXJzRm9yRmlsZSxcblx0c2x1cnAsIGJhcmYsIG15c2VsZiwgcmVtb3ZlRmlsZXNNYXRjaGluZyxcblx0fSBmcm9tICcuL2ZzLnRzJ1xuaW1wb3J0IHtcblx0TG9nZ2VyRXgsIGxvZ2dlciwgc2V0TG9nTGV2ZWwsIHB1c2hMb2dMZXZlbCwgcG9wTG9nTGV2ZWwsXG5cdGN1ckxvZ0xldmVsLCBjbGVhckxvZywgZ2V0TG9nLCBnZXRGdWxsTG9nLFxuXHRJTkRFTlQsIFVOREVOVCwgQ0xFQVIsXG5cdERCRywgTE9HLCBXQVJOLCBFUlIsXG5cdH0gZnJvbSAnLi9sb2dnZXIudHMnXG5pbXBvcnQge1xuXHRvbmVJbmRlbnQsIHJlc2V0T25lSW5kZW50LCBpbmRlbnRMZXZlbCwgc3BsaXRMaW5lLFxuXHRpbmRlbnRlZCwgdW5kZW50ZWQsXG5cdH0gZnJvbSAnLi9pbmRlbnQudHMnXG5pbXBvcnQge1xuXHRleGVjQ21kLCBleGVjQ21kU3luYywgY21kU3VjY2VlZHMsXG5cdGV4ZWNDbWRSZXN1bHQsIG1rc3RyLCBnZXRDbWRMaW5lLCBnZXRQcm9jT3B0LCBnZXRGaW5hbFJlc3VsdCxcblx0fSBmcm9tICcuL2V4ZWMtdXRpbHMudHMnXG5pbXBvcnQge1xuXHRoQ29tcGlsZXJDb25maWcsIGZpbmRTb3VyY2VGaWxlLCBjb21waWxlRmlsZSwgaXNEaXJTcGVjLFxuXHRjb21waWxlUmVzdWx0LFxuXHR9IGZyb20gJy4vY29tcGlsZS1jb25maWcudHMnXG5cbmV4cG9ydCB7XG5cdHVuZGVmLCBkZWZpbmVkLCBub3RkZWZpbmVkLCBwYXNzLCBkZWVwbHlFcXVhbHMsXG5cdExvZ2dlckV4LCBsb2dnZXIsIHNldExvZ0xldmVsLCBwdXNoTG9nTGV2ZWwsIHBvcExvZ0xldmVsLFxuXHRjdXJMb2dMZXZlbCwgY2xlYXJMb2csIGdldExvZywgZ2V0RnVsbExvZyxcblx0SU5ERU5ULCBVTkRFTlQsIENMRUFSLFxuXHREQkcsIExPRywgV0FSTiwgRVJSLFxuXHRvbmVJbmRlbnQsIHJlc2V0T25lSW5kZW50LCBpbmRlbnRMZXZlbCwgc3BsaXRMaW5lLFxuXHRpbmRlbnRlZCwgdW5kZW50ZWQsXG5cdE9MLCBNTCwgY3JvYWssIGFzc2VydCwgdGhyb3dzRXJyb3IsIGdldE9wdGlvbnMsXG5cdHJlbW92ZUVtcHR5S2V5cywga2V5cywgaGFzS2V5LCBoYXNLZXlzLCBtZXJnZSxcblx0c3BhY2VzLCB0YWJzLCBydHJpbSwgY291bnRDaGFycyxcblx0YmxvY2tUb0FycmF5LCB0b0FycmF5LCBhcnJheVRvQmxvY2ssIHRvQmxvY2ssXG5cdGVzY2FwZVN0ciwgZXNjYXBlQmxvY2ssXG5cdGlzU3RyaW5nLCBpc05vbkVtcHR5U3RyaW5nLCBpc0Jvb2xlYW4sIGlzTnVtYmVyLCBpc0ludGVnZXIsXG5cdGlzQXJyYXksIGlzQXJyYXlPZlN0cmluZ3MsIGlzSGFzaCwgaXNPYmplY3QsIGlzUmVnRXhwLFxuXHRpc0VtcHR5LCBub25FbXB0eSxcblx0aXNGaWxlLCBpc0RpciwgZmlsZUV4dCwgd2l0aEV4dCxcblx0cm1GaWxlLCBnZXRQYXRoVHlwZSwgZ2V0U3RhdHMsIHBhcnNlUGF0aCxcblx0YWxsRmlsZXNNYXRjaGluZywgYWxsTGluZXNJbiwgd2F0Y2hGaWxlLCB3YXRjaEZpbGVzLFxuXHRub3JtYWxpemVQYXRoLCBta3BhdGgsIHJlbHBhdGgsIG5ld2VyRGVzdEZpbGVFeGlzdHMsXG5cdHBhdGhTdWJEaXJzLCBjbGVhckRpciwgbWtEaXIsIG1rRGlyc0ZvckZpbGUsXG5cdHNsdXJwLCBiYXJmLCBteXNlbGYsIHJlbW92ZUZpbGVzTWF0Y2hpbmcsXG5cdGNvbXBpbGVGaWxlLCBleGVjQ21kLCBleGVjQ21kU3luYywgY21kU3VjY2VlZHMsXG5cdGlzRGlyU3BlYyxcblx0bWtzdHIsIGdldENtZExpbmUsIGdldFByb2NPcHQsIGdldEZpbmFsUmVzdWx0LFxuXHR9XG5leHBvcnQgdHlwZSB7XG5cdGV4ZWNDbWRSZXN1bHQsIGNvbXBpbGVSZXN1bHQsXG5cdH1cblxuLyoqXG4gKiB1dGlscyAtIHV0aWxpdHkgZnVuY3Rpb25zXG4gKiBAbW9kdWxlXG4gKi9cblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuLyoqXG4gKiBTcGxpdHMgYSBzdHJpbmcgb24gd2hpdGVzcGFjZSBpbnRvIGFuIGFycmF5LFxuICogaWdub3JpbmcgYW55IGxlYWRpbmcgb3IgdHJhaWxpbmcgd2hpdGVzcGFjZVxuICovXG5cbmV4cG9ydCB3c1NwbGl0IDo9IChzdHI6IHN0cmluZyk6IHN0cmluZ1tdID0+XG5cblx0bmV3c3RyIDo9IHN0ci50cmltKClcblx0aWYgKG5ld3N0ciA9PSAnJylcblx0XHRyZXR1cm4gW11cblx0ZWxzZVxuXHRcdHJldHVybiBuZXdzdHIuc3BsaXQoL1xccysvKVxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKipcbiAqIHNwbGl0cyBlYWNoIHN0cmluZyBvbiB3aGl0ZXNwYWNlIGlnbm9yaW5nIGFueSBsZWFkaW5nXG4gKiBvciB0cmFpbGluZyB3aGl0ZXNwYWNlLCBhbmQgcmV0dXJucyBhbiBhcnJheSBvZlxuICogYWxsIHN1YnN0cmluZ3Mgb2J0YWluZWRcbiAqL1xuXG5leHBvcnQgd29yZHMgOj0gKC4uLmxTdHJpbmdzOiBzdHJpbmdbXSk6IHN0cmluZ1tdID0+XG5cblx0bGV0IGxXb3JkcyA9IFtdXG5cdGZvciBzdHIgb2YgbFN0cmluZ3Ncblx0XHRmb3Igd29yZCBvZiB3c1NwbGl0KHN0cilcblx0XHRcdGxXb3Jkcy5wdXNoIHdvcmRcblx0cmV0dXJuIGxXb3Jkc1xuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKipcbiAqIEEgZ2VuZXJhdG9yIHRoYXQgeWllbGRzIGludGVnZXJzIHN0YXJ0aW5nIHdpdGggMCBhbmRcbiAqIGNvbnRpbnVpbmcgdG8gbi0xXG4gKi9cblxuZXhwb3J0IHJhbmdlIDo9IChuOiBudW1iZXIpOiBHZW5lcmF0b3I8bnVtYmVyLCB2b2lkLCB1bmtub3duPiAtPlxuXG5cdGxldCBpID0gMFxuXHR3aGlsZSAoaSA8IG4pXG5cdFx0eWllbGQgaVxuXHRcdGkgPSBpICsgMVxuXHRyZXR1cm5cblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuLyoqXG4gKiBjb252ZXJ0cyB4IHRvIGEgc3RyaW5nLCByZW1vdmluZyBhbnkgY2FycmlhZ2UgcmV0dXJuc1xuICogYW5kIHJlbW92aW5nIGxlYWRpbmcgYW5kIHRyYWlsaW5nIHdoaXRlc3BhY2VcbiAqL1xuXG5leHBvcnQgbm9ybWFsaXplU3RyIDo9ICh4OiBhbnkpOiBzdHJpbmcgPT5cblxuXHRyZXR1cm4geC50b1N0cmluZygpLnJlcGxhY2VBbGwoJ1xccicsICcnKS50cmltKClcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuLyoqXG4gKiBjYWxjdWxhdGVzIHRoZSBudW1iZXIgb2YgZXh0cmEgY2hhcmFjdGVycyBuZWVkZWQgdG9cbiAqIG1ha2UgdGhlIGdpdmVuIHN0cmluZyBoYXZlIHRoZSBnaXZlbiBsZW5ndGguXG4gKiBJZiBub3QgcG9zc2libGUsIHJldHVybnMgMFxuICovXG5cbmV4cG9ydCBnZXRORXh0cmEgPSAoc3RyOiBzdHJpbmcsIGxlbjogbnVtYmVyKTogbnVtYmVyID0+XG5cblx0ZXh0cmEgOj0gbGVuIC0gc3RyLmxlbmd0aFxuXHRyZXR1cm4gKGV4dHJhID4gMCkgPyBleHRyYSA6IDBcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuLyoqXG4gKiBwYWRzIHRoZSBnaXZlbiBzdHJpbmcgb24gdGhlIHJpZ2h0IHdpdGhcbiAqIHRoZSBnaXZlbiBjaGFyYWN0ZXIsIHRvIHRoZSBnaXZlbiBsZW5ndGhcbiAqL1xuXG5leHBvcnQgcnBhZCA6PSAoc3RyOiBzdHJpbmcsIGxlbjogbnVtYmVyLCBjaDogc3RyaW5nPScgJyk6IHN0cmluZyA9PlxuXG5cdGFzc2VydCAoY2gubGVuZ3RoID09IDEpLCBcIk5vdCBhIGNoYXJcIlxuXHRleHRyYSA6PSBnZXRORXh0cmEoc3RyLCBsZW4pXG5cdHJldHVybiBzdHIgKyBjaC5yZXBlYXQoZXh0cmEpXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogcGFkcyB0aGUgZ2l2ZW4gc3RyaW5nIG9uIHRoZSBsZWZ0IHdpdGhcbiAqIHRoZSBnaXZlbiBjaGFyYWN0ZXIsIHRvIHRoZSBnaXZlbiBsZW5ndGhcbiAqL1xuXG5leHBvcnQgbHBhZCA6PSAoc3RyOiBzdHJpbmcsIGxlbjogbnVtYmVyLCBjaDogc3RyaW5nPScgJyk6IHN0cmluZyA9PlxuXG5cdGFzc2VydCAoY2gubGVuZ3RoID09IDEpLCBcIk5vdCBhIGNoYXJcIlxuXHRleHRyYSA6PSBnZXRORXh0cmEoc3RyLCBsZW4pXG5cdHJldHVybiBjaC5yZXBlYXQoZXh0cmEpICsgc3RyXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4jIC0tLSB2YWxpZCBvcHRpb25zOlxuIyAgICAgICAgY2hhciAtIGNoYXIgdG8gdXNlIG9uIGxlZnQgYW5kIHJpZ2h0XG4jICAgICAgICBidWZmZXIgLSBudW0gc3BhY2VzIGFyb3VuZCB0ZXh0IHdoZW4gY2hhciA8PiAnICdcblxuLyoqXG4gKiBwYWRzIHRoZSBnaXZlbiBzdHJpbmcgb24gYm90aCB0aGUgbGVmdCBhbmQgcmlnaHRcbiAqIHdpdGggdGhlIGdpdmVuIGNoYXJhY3RlciwgdG8gdGhlIGdpdmVuIGxlbmd0aFxuICogYnV0IHdpdGggdGhlIGdpdmVuIG51bWJlciBvZiBidWZmZXIgY2hhcnMgc3Vycm91bmRpbmdcbiAqIHRoZSB0ZXh0XG4gKi9cblxuZXhwb3J0IGNlbnRlcmVkIDo9IChcblx0dGV4dDogc3RyaW5nLFxuXHR3aWR0aDogbnVtYmVyLFxuXHRjaGFyOiBzdHJpbmcgPSAnICcsXG5cdG51bUJ1ZmZlcjogbnVtYmVyID0gMlxuXHQpOiBzdHJpbmcgPT5cblxuXHR0b3RTcGFjZXMgOj0gd2lkdGggLSB0ZXh0Lmxlbmd0aFxuXHRpZiAodG90U3BhY2VzIDw9IDApXG5cdFx0cmV0dXJuIHRleHRcblx0bnVtTGVmdCA6PSBNYXRoLmZsb29yKHRvdFNwYWNlcyAvIDIpXG5cdG51bVJpZ2h0IDo9IHRvdFNwYWNlcyAtIG51bUxlZnRcblx0aWYgKGNoYXIgPT0gJyAnKVxuXHRcdHJldHVybiBzcGFjZXMobnVtTGVmdCkgKyB0ZXh0ICsgc3BhY2VzKG51bVJpZ2h0KVxuXHRlbHNlXG5cdFx0YnVmIDo9ICcgJy5yZXBlYXQobnVtQnVmZmVyKVxuXHRcdGxlZnQgOj0gY2hhci5yZXBlYXQobnVtTGVmdCAtIG51bUJ1ZmZlcilcblx0XHRyaWdodCA6PSBjaGFyLnJlcGVhdChudW1SaWdodCAtIG51bUJ1ZmZlcilcblx0XHRyZXR1cm4gbGVmdCArIGJ1ZiArIHRleHQgKyBidWYgKyByaWdodFxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKipcbiAqIHBhZCBhIHN0cmluZyBvbiB0aGUgbGVmdCwgcmlnaHQsIG9yIGJvdGhcbiAqIHRvIHRoZSBnaXZlbiB3aWR0aFxuICovXG5cbmV4cG9ydCBhbGlnblN0cmluZyA6PSAoXG5cdHN0cjogc3RyaW5nLFxuXHR3aWR0aDogbnVtYmVyLFxuXHRhbGlnbjogc3RyaW5nXG5cdCk6IHN0cmluZyAtPlxuXG5cdGFzc2VydCBpc1N0cmluZyhzdHIpLCBcInN0ciBub3QgYSBzdHJpbmc6ICN7T0woc3RyKX1cIlxuXHRhc3NlcnQgaXNTdHJpbmcoYWxpZ24pLCBcImFsaWduIG5vdCBhIHN0cmluZzogI3tPTChhbGlnbil9XCJcblx0c3dpdGNoIGFsaWduXG5cdFx0d2hlbiAnbGVmdCcsICdsJ1xuXHRcdFx0cmV0dXJuIHJwYWQoc3RyLCB3aWR0aClcblx0XHR3aGVuICdjZW50ZXInLCAnYydcblx0XHRcdHJldHVybiBjZW50ZXJlZChzdHIsIHdpZHRoKVxuXHRcdHdoZW4gJ3JpZ2h0JywgJ3InXG5cdFx0XHRyZXR1cm4gbHBhZChzdHIsIHdpZHRoKVxuXHRcdGVsc2Vcblx0XHRcdHRocm93IG5ldyBFcnJvciBcIlVua25vd24gYWxpZ246ICN7T0woYWxpZ24pfVwiXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogY29udmVydHMgdGhlIGdpdmVuIG51bWJlciB0byBhIHN0cmluZywgdGhlbiBwYWRzIG9uIHRoZSBsZWZ0XG4gKiB3aXRoIHplcm9zIHRvIGFjaGlldmUgdGhlIGdpdmVuIGxlbmd0aFxuICovXG5cbmV4cG9ydCB6cGFkIDo9IChuOiBudW1iZXIsIGxlbjogbnVtYmVyKTogc3RyaW5nID0+XG5cblx0cmV0dXJuIGxwYWQobi50b1N0cmluZygpLCBsZW4sICcwJylcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuLyoqXG4gKiBSZW1vdmUgbGluZXMgZnJvbSBhIHN0cmluZyBvciBhcnJheVxuICogcGF0IGNhbiBiZSBhIHN0cmluZyBvciBhIHJlZ3VsYXIgZXhwcmVzc2lvblxuICovXG5cbmV4cG9ydCByZW1vdmVMaW5lcyA6PSAoXG5cdHN0ck9yQXJyYXk6IHN0cmluZyB8IHN0cmluZ1tdLFxuXHRwYXQ6IHN0cmluZyB8IFJlZ0V4cFxuXHQpOiBzdHJpbmcgfCBzdHJpbmdbXSA9PlxuXG5cdGFzc2VydCBpc1N0cmluZyhwYXQpIHx8IGlzUmVnRXhwKHBhdCksICBcIkJhZCBhcmcgMjogI3tPTChwYXQpfVwiXG5cdGxMaW5lcyA6PSBpc1N0cmluZyhzdHJPckFycmF5KSA/IGJsb2NrVG9BcnJheShzdHJPckFycmF5KSA6IHN0ck9yQXJyYXlcblx0bE5ld0xpbmVzIDo9IChcblx0XHRpZiAodHlwZW9mIHBhdCA9PSAnc3RyaW5nJylcblx0XHRcdGxMaW5lcy5maWx0ZXIoKGxpbmUpID0+IChsaW5lICE9IHBhdCkpXG5cdFx0ZWxzZVxuXHRcdFx0bExpbmVzLmZpbHRlcigobGluZSkgPT4gKGxpbmUubWF0Y2gocGF0KSA9PSBudWxsKSlcblx0XHQpXG5cdGlmIGlzU3RyaW5nKHN0ck9yQXJyYXkpXG5cdFx0cmV0dXJuIGxOZXdMaW5lcy5qb2luKCdcXG4nKVxuXHRlbHNlXG5cdFx0cmV0dXJuIGxOZXdMaW5lc1xuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG5leHBvcnQgZ2V0UGF0dGVybiA6PSAoKTogc3RyaW5nID0+XG5cblx0bEtleXMgOj0gT2JqZWN0LmtleXMoaENvbXBpbGVyQ29uZmlnLmhDb21waWxlcnMpXG5cdGlmIChsS2V5cy5sZW5ndGggPT0gMSlcblx0XHRyZXR1cm4gXCIqKi8qI3tsS2V5c1swXX1cIlxuXHRlbHNlXG5cdFx0cmV0dXJuIFwiKiovKnsje2xLZXlzLmpvaW4oJywnKX19XCJcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiMgLS0tIEEgZ2VuZXJhdG9yIC0geWllbGRzIHtwYXRoLCBzdGF0dXMsIG91dFBhdGh9XG5cbmV4cG9ydCBjb21waWxlQWxsRmlsZXMgOj0gKFxuXHRwYXR0ZXJuOiBzdHJpbmc/ID0gdW5kZWYsXG5cdCk6IEdlbmVyYXRvcjxjb21waWxlUmVzdWx0LCB2b2lkLCB1bmtub3duPiAtPlxuXG5cdGhHbG9iT3B0aW9ucyA6PSB7XG5cdFx0ZXhjbHVkZTogW1xuXHRcdFx0J25vZGVfbW9kdWxlcy8qKidcblx0XHRcdCcuZ2l0LyoqJ1xuXHRcdFx0JyoqLyoudGVtcC4qJyAgIyAtLS0gZG9uJ3QgY29tcGlsZSB0ZW1wIGZpbGVzXG5cdFx0XHRdXG5cdFx0fVxuXG5cdGdsb2JQYXR0ZXJuIDo9IGRlZmluZWQocGF0dGVybikgPyBwYXR0ZXJuIDogZ2V0UGF0dGVybigpXG5cdERCRyBcImNvbXBpbGluZyBhbGwgZmlsZXMsIHBhdD0je09MKGdsb2JQYXR0ZXJuKX1cIlxuXHRmb3Ige3BhdGh9IG9mIGFsbEZpbGVzTWF0Y2hpbmcoZ2xvYlBhdHRlcm4sIGhHbG9iT3B0aW9ucylcblx0XHRoUmVzdWx0IDo9IGNvbXBpbGVGaWxlIHBhdGhcblx0XHRpZiAoaFJlc3VsdC5zdGF0dXMgPT0gJ2NvbXBpbGVkJylcblx0XHRcdHlpZWxkIGhSZXN1bHRcblx0cmV0dXJuXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbmV4cG9ydCBlbnN1cmVDb21waWxlZCA6PSAoXG5cdGRpcnNwZWM6IHN0cmluZyxcblx0c3R1Yjogc3RyaW5nLFxuXHRwdXJwb3NlOiBzdHJpbmc/ID0gdW5kZWZcblx0KTogc3RyaW5nPyA9PlxuXG5cdGggOj0gZmluZFNvdXJjZUZpbGUgZGlyc3BlYywgc3R1YiwgcHVycG9zZVxuXHRpZiAoaCA9PSB1bmRlZikgfHwgKGgucGF0aCA9PSB1bmRlZikgfHwgbm90IGlzRmlsZShoLnBhdGgpXG5cdFx0REJHIFwiTm90IGNvbXBpbGluZzogbm8gc3VjaCBmaWxlOiAje2RpcnNwZWN9LyN7c3R1Yn0vI3twdXJwb3NlfVwiXG5cdFx0cmV0dXJuIHVuZGVmXG5cdGVsc2Vcblx0XHR7c3RhdHVzLCBvdXRQYXRofSA6PSBjb21waWxlRmlsZSBoLnBhdGhcblx0XHRpZiAob3V0UGF0aCA9PSB1bmRlZilcblx0XHRcdFdBUk4gXCJDb21waWxlIG9mIGxpYiAje2gucGF0aH0gZmFpbGVkIHdpdGggc3RhdHVzICN7c3RhdHVzfVwiXG5cdFx0XHRyZXR1cm4gdW5kZWZcblx0XHRlbHNlXG5cdFx0XHRhc3NlcnQgaXNGaWxlKG91dFBhdGgpLFxuXHRcdFx0XHRcdFwiY29tcGlsZUZpbGUoKSBzdWNjZWVkZWQsIGJ1dCAje09MKG91dFBhdGgpfSBkb2VzIG5vdCBleGlzdCFcIlxuXHRcdFx0cmV0dXJuIG91dFBhdGhcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxudHlwZSB1bml0VGVzdFJlc3VsdCA9IHtcblx0c3R1Yjogc3RyaW5nXG5cdHN1Y2Nlc3M6IGJvb2xlYW5cblx0bXNnPzogc3RyaW5nXG5cdGNvZGU/OiBudW1iZXJcblx0c2lnbmFsPzogc3RyaW5nXG5cdH1cblxuZXhwb3J0IHJ1blVuaXRUZXN0IDo9IChcblx0c3R1Yjogc3RyaW5nLFxuXHQpOiB1bml0VGVzdFJlc3VsdCA9PlxuXG5cdERCRyBcIlJ1bm5pbmcgdW5pdCB0ZXN0ICN7c3R1Yn1cIlxuXG5cdGVuc3VyZUNvbXBpbGVkICdsaWJEaXInLCBzdHViXG5cdGVuc3VyZUNvbXBpbGVkICdiaW5EaXInLCBzdHViXG5cblx0IyAtLS0gVGhpcyBpcyB0aGUgcGF0aCB0byB0aGUgdGVzdCB0byBiZSBydW5cblx0dGVzdE91dFBhdGggOj0gZW5zdXJlQ29tcGlsZWQgJ3Rlc3REaXInLCBzdHViLCAndGVzdCdcblx0aWYgKHRlc3RPdXRQYXRoID09IHVuZGVmKVxuXHRcdFdBUk4gXCJDb21waWxlIG9mICN7c3R1Yn0gdW5pdCB0ZXN0IGZhaWxlZFwiXG5cdFx0cmV0dXJuIHtcblx0XHRcdHN0dWJcblx0XHRcdHN1Y2Nlc3M6IGZhbHNlXG5cdFx0XHRtc2c6IFwiQ29tcGlsZSBvZiAje3N0dWJ9IHVuaXQgdGVzdCBmYWlsZWRcIlxuXHRcdFx0fVxuXHRlbHNlXG5cdFx0REJHIFwidGVzdE91dFBhdGggPSAje09MKHRlc3RPdXRQYXRoKX1cIlxuXG5cdCMgLS0tIENvbXBpbGUgYWxsIGZpbGVzIGluIHN1YmRpciBpZiBpdCBleGlzdHNcblx0aWYgaXNEaXIoXCJ0ZXN0LyN7c3R1Yn1cIilcblx0XHRmb3Ige3BhdGgsIHN0YXR1cywgb3V0UGF0aH0gb2YgY29tcGlsZUFsbEZpbGVzKFwidGVzdC8je3N0dWJ9LypcIilcblx0XHRcdGlmIG5vdGRlZmluZWQob3V0UGF0aClcblx0XHRcdFx0V0FSTiBcIkZpbGUgI3tPTChwYXRoKX0gbm90IGNvbXBpbGVkXCJcblxuXHQjIC0tLSBSdW4gdGhlIHVuaXQgdGVzdCwgcmV0dXJuIHJldHVybiBjb2RlXG5cdGFzc2VydCBpc0ZpbGUodGVzdE91dFBhdGgpLCBcIk5vIHN1Y2ggZmlsZTogI3tPTCh0ZXN0T3V0UGF0aCl9XCJcblxuXHQjIC0tLSBSZXR1cm4gdmFsdWUgaGFzIGtleXMgc3VjY2VzcywgY29kZSwgc2lnbmFsXG5cdGggOj0gZXhlY0NtZFN5bmMgJ2Rlbm8nLCBbXG5cdFx0XHQndGVzdCcsXG5cdFx0XHQnLXFBJyxcblx0XHRcdHRlc3RPdXRQYXRoXG5cdFx0XHRdXG4jXHRoUmVzdWx0LnN0dWIgPSBzdHViXG5cdHJldHVybiB7XG5cdFx0c3R1YlxuXHRcdHN1Y2Nlc3M6IGguc3VjY2Vzc1xuXHRcdGNvZGU6IGguY29kZVxuXHRcdHNpZ25hbDogaC5zaWduYWxcblx0XHR9XG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4jIC0tLSBhIGdlbmVyYXRvclxuXG5leHBvcnQgcnVuQWxsVW5pdFRlc3RzIDo9ICgpOiBHZW5lcmF0b3I8dW5pdFRlc3RSZXN1bHQsIHZvaWQsIHVua25vd24+IC0+XG5cblx0aEdsb2JPcHRpb25zIDo9IHtcblx0XHRleGNsdWRlOiBbJ25vZGVfbW9kdWxlcy8qKicsICcuZ2l0LyoqJ11cblx0XHR9XG5cblx0cGF0dGVybiA6PSAndGVzdC8qLnRlc3QuanMnXG5cdERCRyBcInBhdHRlcm4gPSAje09MKHBhdHRlcm4pfVwiXG5cdGZvciB7cGF0aH0gb2YgYWxsRmlsZXNNYXRjaGluZyhwYXR0ZXJuLCBoR2xvYk9wdGlvbnMpXG5cdFx0e3N0dWJ9IDo9IHBhcnNlUGF0aChwYXRoKVxuXHRcdGlmIChzdHViID09IHVuZGVmKVxuXHRcdFx0V0FSTiBcIk5vIHN0dWIgZm91bmQgaW4gI3tPTChwYXRoKX1cIlxuXHRcdGVsc2Vcblx0XHRcdERCRyBcIlRFU1Q6ICN7cGF0aH1cIlxuXHRcdFx0eWllbGQgcnVuVW5pdFRlc3Qoc3R1Yilcblx0cmV0dXJuXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbmhLZXlUb0xvZ2dlcjogaGFzaCA6PSB7XG5cdEk6ICdpbmZvJ1xuXHRQOiAncHJvZmlsZSdcblx0RDogJ2RlYnVnJ1xuXHRROiAncXVpZXQnXG5cdFM6ICdzaWxlbnQnXG5cdH1cblxuZXhwb3J0IHNldExvZ2dlckZyb21BcmdzIDo9IChsQXJnczogc3RyaW5nW10pOiB2b2lkID0+XG5cblx0Zm9yIHN0ciBvZiBsQXJnc1xuXHRcdGxNYXRjaGVzIDo9IHN0ci5tYXRjaCgvLy9eXG5cdFx0XHQtXG5cdFx0XHQoW0EtWmEtejAtOV8tXSopXG5cdFx0XHQoPSk/XG5cdFx0XHQvLy8pXG5cdFx0aWYgKGxNYXRjaGVzID09IG51bGwpXG5cdFx0XHRwYXNzKClcblx0XHRlbHNlXG5cdFx0XHRrZXlTdHIgOj0gbE1hdGNoZXNbMV1cblx0XHRcdGhhc0VxIDo9IGxNYXRjaGVzWzJdXG5cdFx0XHRpZiBpc0VtcHR5KGhhc0VxKVxuXHRcdFx0XHRmb3Iga2V5IG9mIGtleXMoaEtleVRvTG9nZ2VyKVxuXHRcdFx0XHRcdGlmIGtleVN0ci5pbmNsdWRlcyhrZXkpXG5cdFx0XHRcdFx0XHRzZXRMb2dMZXZlbCBoS2V5VG9Mb2dnZXJba2V5XVxuXHRyZXR1cm5cblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuLyoqXG4gKiBQYXJzZSBjb21tYW5kIGxpbmUgYXJndW1lbnRzLCBvcHRpb25hbGx5IHNwZWNpZnlpbmcgd2hpY2hcbiAqIG9wdGlvbnMgdG8gZXhwZWN0IGFuZC9vciB0aGUgZXhwZWN0ZWQgbnVtYmVyIG9mIG5vbi1vcHRpb25zXG4gKlxuICogVGhlcmUgYXJlIDMga2luZHMgb2YgaXRlbXMgYWxsb3dlZCBvbiB0aGUgY29tbWFuZCBsaW5lOlxuICpcbiAqIDEuIGZsYWdzLCBlLmcuXG4gKiBcdGAtZm54YCAtIHNldHMgZmxhZ3MgYGZgLCAnbicgYW5kIGB4YCB0byB0cnVlXG4gKiAgICBmbGFncyBtdXN0IGJlIHVwcGVyIG9yIGxvd2VyIGNhc2UgbGV0dGVyc1xuICpcbiAqIDIuIGFuIG9wdGlvbiB3aXRoIGEgdmFsdWUsIGUuZy5cbiAqIFx0YC1sYWJlbD1teWxhYmVsYCAtIHNldHMgb3B0aW9uIGBsYWJlbGAgdG8gYCdteWxhYmVsJ2BcbiAqIFx0aWYgdGhlIHZhbHVlIGNvbnRhaW5zIGEgc3BhY2UgY2hhciwgaXQgbXVzdCBiZSBxdW90ZWRcbiAqIFx0aWYgdGhlIHZhbHVlIGxvb2tzIGxpa2UgYSBudW1iZXIsIGl0J3Mgc2V0IHRvIGEgbnVtYmVyXG4gKlxuICogMy4gYW55dGhpbmcgZWxzZSBpcyBhIG5vbi1vcHRpb24sIGUuZy5cbiAqIFx0YzovdGVtcC90ZW1wLnR4dFxuICogXHRpZiBpdCBpbmNsdWRlcyBhIHNwYWNlIGNoYXIgb3Igc3RhcnRzIHdpdGggYC1gLFxuICogXHRcdGl0IG11c3QgYmUgcXVvdGVkXG4gKlxuICogdGhlIDFzdCBhcmd1bWVudCB0byBnZXRDbWRBcmdzKCkgaXMgb3B0aW9uYWwsIGFuZCBpcyBhIGhhc2hcbiAqIG9mIGluZm9ybWF0aW9uIGFib3V0IHRoZSBleHBlY3RlZCBhcmd1bWVudHMuXG4gKlxuICogSWYga2V5ICdfJyBpcyBwcmVzZW50LCBpdCBtdXN0IGJlIGEgaGFzaCBwb3NzaWJseSBpbmNsdWRpbmcga2V5czpcbiAqICAgICdyYW5nZScgLSBlaXRoZXIgYW4gaW50ZWdlciBzcGVjaWZ5aW5nIHRoZSBleGFjdCBudW1iZXIgb2ZcbiAqICAgICAgICAgICAgICBub24tb3B0aW9ucyBleHBlY3RlZCwgb2YgYW4gYXJyYXkgb2YgMiBpbnRlZ2Vyc1xuICogICAgICAgICAgICAgIHNwZWNpZnlpbmcgdGhlIG1pbmltdW0gYW5kIG1heGltdW0gbnVtYmVyIG9mXG4gKiAgICAgICAgICAgICAgbm9uLW9wdGlvbnMgZXhwZWN0ZWQuIFRoZSAybmQgb2YgdGhlc2UgbWF5IGJlXG4gKiAgICAgICAgICAgICAgdGhlIHN0cmluZyAnaW5mJyB0byBpbmRpY2F0ZSBubyBtYXhpbXVtIG51bWJlclxuICogICAgJ2Rlc2MnIC0gYSB0ZXh0IGRlc2NyaXB0aW9uIG9mIHdoYXQgbm9uLW9wdGlvbnMgYXJlXG4gKlxuICogQWxsIG90aGVyIGtleXMgYXJlIG5hbWVzIG9mIG9wdGlvbnMgYWxsb3dlZCwgYW5kIHRoZSBhc3NvY2lhdGVkIHZhbHVlXG4gKiBtdXN0IGJlIGEgaGFzaCB3aXRoIHBvc3NpYmx5IHRoZXNlIGtleXM6XG4gKiAgICB0eXBlIC0gdGhlIHR5cGUgb2YgdmFsdWUgZXhwZWN0ZWQgKGRlZmF1bHRzIHRvICdib29sZWFuJylcbiAqICAgIGRlc2MgLSBhIHRleHQgZGVzY3JpcHRpb24gb2YgdGhlIG9wdGlvbiAodXNlZCBvbiBoZWxwIHNjcmVlbnMpXG4gKlxuICogdGhlIDJuZCBhcmd1bWVudCB0byBnZXRDbWRBcmdzKCkgaXMgYW4gYXJyYXkgb2Ygc3RyaW5nIGFyZ3VtZW50c1xuICogZnJvbSB0aGUgY29tbWFuZCBsaW5lIChkZWZhdWx0cyB0byBEZW5vLmFyZ3MpXG4gKlxuICogdGhlIDNyZCBhcmd1bWVudCB0byBnZXRDbWRBcmdzKCkgaXMgYSBoYXNoIG9mIHBvc3NpYmxlIG9wdGlvbnM6XG4gKiAgICBkb1NldExvZ2dlciAtIGRlZmF1bHRzIHRvIHRydWUgLSBpZiBmYWxzZSwgdGhlbiBvcHRpb25zXG4gKiAgICAgICAgICAgICAgICAgIC1QLCAtRCwgLVEsIC1JIGFuZCAtUyBubyBsb25nZXIgc2V0IGxvZ2dpbmcgb3B0aW9uc1xuICogICAgICAgICAgICAgICAgICBhbmQgbWF5IHRoZXJlZm9yZSBiZSB1c2VkIGZvciBvdGhlciBwdXJwb3Nlc1xuICpcbiAqIEJ5IGRlZmF1bHQsIHRoZSBmb2xsb3dpbmcgZmxhZ3MgYXJlIHJlY29nbml6ZWQsIGFuZCB0aGVyZWZvcmVcbiAqIGNhbm5vdCBiZSBpbmNsdWRlZCBpbiBoRGVzYyAodGhpcyBiZWhhdmlvciBjYW4gYmVcbiAqIGRpc2FibGVkIGJ5IHNldHRpbmcgaE9wdGlvbnMuZG9TZXRMb2dnZXIgdG8gZmFsc2UpOlxuICpcbiAqIGAtUGAgLSBzZXQgdGhlIGN1cnJlbnQgbG9nIGxldmVsIHRvICdwcm9maWxlJ1xuICogYC1EYCAtIHNldCB0aGUgY3VycmVudCBsb2cgbGV2ZWwgdG8gJ2RlYnVnJ1xuICogYC1RYCAtIHNldCB0aGUgY3VycmVudCBsb2cgbGV2ZWwgdG8gJ3dhcm4nXG4gKiBgLUlgIC0gc2V0IHRoZSBjdXJyZW50IGxvZyBsZXZlbCB0byAnaW5mbydcbiAqIGAtU2AgLSBzZXQgdGhlIGN1cnJlbnQgbG9nIGxldmVsIHRvICdzaWxlbnQnXG4gKlxuICogKHNlZSBsaWJyYXJ5IEBqZGVpZ2hhbi9sb2dnZXIpXG4gKi9cblxuZXhwb3J0IGdldENtZEFyZ3MgOj0gKFxuXHRoRGVzYzogaGFzaD8gPSB1bmRlZixcblx0bEFyZ3M6IHN0cmluZ1tdID0gRGVuby5hcmdzLFxuXHRoT3B0aW9uczogb3B0aW9uc3BlYyA9IHt9XG5cdCk6IGhhc2ggPT5cblxuXHRpZiBub3RkZWZpbmVkKGhEZXNjKVxuXHRcdHBhc3MoKVxuXHRlbHNlXG5cdFx0YXNzZXJ0IGlzSGFzaChoRGVzYyksIFwiQmFkIGhEZXNjOiAje09MKGhEZXNjKX1cIlxuXHRhc3NlcnQgaXNBcnJheU9mU3RyaW5ncyhsQXJncyksIFwiQmFkIGxBcmdzOiAje09MKGxBcmdzKX1cIlxuXG5cdGlmIChsQXJncy5sZW5ndGggPT0gMSkgJiYgKGxBcmdzWzBdID09ICctaCcpXG5cdGlmICgobEFyZ3MubGVuZ3RoID09IDEpXG5cdFx0XHQmJiBbJy1oJywnLS1oJywnLWhlbHAnLCctLWhlbHAnXS5pbmNsdWRlcyhsQXJnc1swXSlcblx0XHRcdClcblx0XHRpZiBub3RkZWZpbmVkKGhEZXNjKVxuXHRcdFx0TE9HIFwiTm8gaGVscCBhdmFpbGFibGVcIlxuXHRcdGVsc2Vcblx0XHRcdHNob3dIZWxwKGhEZXNjKVxuXHRcdERlbm8uZXhpdCgpXG5cblx0IyAtLS0gQ3VycmVudGx5LCB0aGVyZSBpcyBvbmx5IG9uZSBwb3NzaWJsZSBvcHRpb25cblx0e2RvU2V0TG9nZ2VyfSA6PSBnZXRPcHRpb25zIGhPcHRpb25zLCB7XG5cdFx0ZG9TZXRMb2dnZXI6IHRydWVcblx0XHR9XG5cblx0aWYgZG9TZXRMb2dnZXJcblx0XHRpZiBub3RkZWZpbmVkKGhEZXNjKVxuXHRcdFx0cGFzcygpXG5cdFx0ZWxzZVxuXHRcdFx0Zm9yIGtleSBvZiBrZXlzKGhLZXlUb0xvZ2dlcilcblx0XHRcdFx0YXNzZXJ0IG5vdGRlZmluZWQoaERlc2Nba2V5XSksXG5cdFx0XHRcdFx0XHRcImludmFsaWQga2V5ICN7T0woa2V5KX0gc2V0IGluIGhEZXNjXCJcblx0XHRzZXRMb2dnZXJGcm9tQXJncyhsQXJncylcblxuXHRoUmVzdWx0OiBoYXNoIDo9IHsgXzogW10gfVxuXG5cdCMgLS0tIFV0aWxpdHkgZnVuY3Rpb25zXG5cblx0IyAtLS0gRXZlbiBnZXRzIGNhbGxlZCBmb3IgLUQsIC1RLCAtUCwgLVNcblx0YWRkT3B0aW9uIDo9IChuYW1lOiBzdHJpbmcsIHZhbHVlOiBhbnkpID0+XG5cdFx0REJHIFwiYWRkT3B0aW9uKCN7T0wobmFtZSl9LCAje09MKHZhbHVlKX0pXCJcblx0XHRhc3NlcnQgaXNTdHJpbmcobmFtZSksIFwiTm90IGEgc3RyaW5nOiAje09MKG5hbWUpfVwiXG5cdFx0YXNzZXJ0IG5vdCBoYXNLZXkoaFJlc3VsdCwgbmFtZSksXG5cdFx0XHRcdFwiZHVwIGtleSAje25hbWV9LCBoUmVzdWx0ID0gI3tPTChoUmVzdWx0KX1cIlxuXG5cdFx0aWYgZG9TZXRMb2dnZXJcblx0XHRcdGxvZ2dlciA6PSBoS2V5VG9Mb2dnZXJbbmFtZV1cblx0XHRcdGlmIGRlZmluZWQobG9nZ2VyKVxuXHRcdFx0XHRoUmVzdWx0W25hbWVdID0gdHJ1ZVxuXHRcdFx0XHRzZXRMb2dMZXZlbCBsb2dnZXJcblx0XHRcdFx0cmV0dXJuXG5cblx0XHRpZiBub3RkZWZpbmVkKGhEZXNjKVxuXHRcdFx0aFJlc3VsdFtuYW1lXSA9IHZhbHVlXG5cdFx0XHRyZXR1cm5cblx0XHR7dHlwZX0gOj0gZ2V0T3B0aW9uSW5mbyhoRGVzYywgbmFtZSlcblxuXHRcdCMgLS0tIHR5cGUgY2hlY2tpbmdcblx0XHRpZiBpc0FycmF5KHR5cGUpXG5cdFx0XHRhc3NlcnQgdHlwZS5pbmNsdWRlcyh2YWx1ZSksIFwidHlwZSBub3QgYW4gYXJyYXlcIlxuXHRcdFx0aFJlc3VsdFtuYW1lXSA9IHZhbHVlXG5cdFx0ZWxzZVxuXHRcdFx0c3dpdGNoIHR5cGVcblx0XHRcdFx0d2hlbiAnc3RyaW5nJ1xuXHRcdFx0XHRcdGhSZXN1bHRbbmFtZV0gPSB2YWx1ZVxuXHRcdFx0XHR3aGVuICdib29sZWFuJ1xuXHRcdFx0XHRcdGhSZXN1bHRbbmFtZV0gPSAoXG5cdFx0XHRcdFx0XHQgICh2YWx1ZSA9PSAndHJ1ZScpICA/IHRydWVcblx0XHRcdFx0XHRcdDogKHZhbHVlID09ICdmYWxzZScpID8gZmFsc2Vcblx0XHRcdFx0XHRcdDogICAgICAgICAgICAgICAgICAgICAgdmFsdWVcblx0XHRcdFx0XHRcdClcblx0XHRcdFx0d2hlbiAnbnVtYmVyJywnZmxvYXQnXG5cdFx0XHRcdFx0aFJlc3VsdFtuYW1lXSA9IHBhcnNlRmxvYXQodmFsdWUpXG5cdFx0XHRcdHdoZW4gJ2ludGVnZXInXG5cdFx0XHRcdFx0aFJlc3VsdFtuYW1lXSA9IHBhcnNlSW50KHZhbHVlKVxuXHRcdHJldHVyblxuXG5cdGFkZE5vbk9wdGlvbiA6PSAoc3RyOiBzdHJpbmcpID0+XG5cdFx0REJHIFwiYWRkTm9uT3B0aW9uKCN7T0woc3RyKX0pXCJcblx0XHRoUmVzdWx0Ll8ucHVzaCBzdHJcblxuXHRmb3Igc3RyIG9mIGxBcmdzXG5cdFx0IyAtLS0gaWdub3JlICctLSdcblx0XHRpZiAoc3RyID09ICctLScpXG5cdFx0XHREQkcgXCJza2lwcGluZyAtLVwiXG5cdFx0XHRjb250aW51ZVxuXG5cdFx0IyAtLS0gY2hlY2sgaWYgaXQncyBhbiBvcHRpb25cblx0XHRsTWF0Y2hlcyA6PSBzdHIubWF0Y2goLy8vXlxuXHRcdFx0LVxuXHRcdFx0KFtBLVphLXowLTlfLV0qKVxuXHRcdFx0KD86XG5cdFx0XHRcdCg9KVxuXHRcdFx0XHQoLiopXG5cdFx0XHRcdCk/XG5cdFx0XHQkLy8vKVxuXHRcdGlmIChsTWF0Y2hlcyA9PSBudWxsKVxuXHRcdFx0IyAtLS0gaXQncyBhIG5vbi1vcHRpb25cblx0XHRcdGFkZE5vbk9wdGlvbiBzdHJcblx0XHRlbHNlXG5cdFx0XHQjIC0tLSBpdCdzIGFuIG9wdGlvblxuXHRcdFx0W18sIG9wdFN0ciwgZXFTdHIsIHZhbHVlXSA6PSBsTWF0Y2hlc1xuXHRcdFx0aWYgZXFTdHJcblx0XHRcdFx0YWRkT3B0aW9uIG9wdFN0ciwgdmFsdWVcblx0XHRcdGVsc2Vcblx0XHRcdFx0Zm9yIGNoIG9mIG9wdFN0ci5zcGxpdCgnJylcblx0XHRcdFx0XHRhZGRPcHRpb24gY2gsIHRydWVcblxuXHQjIC0tLSBpZiBoRGVzYyBpcyBzZXQsIHRoZW5cblx0IyAgICAgRmlsbCBpbiBkZWZhdWx0IHZhbHVlcyBpZiBhdmFpbGFibGVcblxuXHRpZiBub3RkZWZpbmVkKGhEZXNjKVxuXHRcdHBhc3MoKVxuXHRlbHNlXG5cdFx0Zm9yIG5hbWUgb2Yga2V5cyhoRGVzYywgJ2V4Y2VwdD1fJylcblx0XHRcdGlmIG5vdGRlZmluZWQoaFJlc3VsdFtuYW1lXSlcblx0XHRcdFx0e2RlZmF1bHRWYWx9IDo9IGdldE9wdGlvbkluZm8oaERlc2MsIG5hbWUpXG5cdFx0XHRcdGlmIGRlZmluZWQoZGVmYXVsdFZhbClcblx0XHRcdFx0XHRoUmVzdWx0W25hbWVdID0gZGVmYXVsdFZhbFxuXG5cdFx0IyAtLS0gQ2hlY2sgb2YgdGhlcmUncyBhIHJlc3RyaWN0aW9uIG9uIHRoZSBudW1iZXIgb2Ygbm9uLW9wdGlvbnNcblxuXHRcdGlmIGhhc0tleShoRGVzYywgJ18nKVxuXHRcdFx0aEluZm8gOj0gZ2V0Tm9uT3B0aW9uSW5mbyhoRGVzYylcblx0XHRcdGlmIChoSW5mbyAhPSB1bmRlZilcblx0XHRcdFx0e3JhbmdlfSA6PSBoSW5mb1xuXHRcdFx0XHRbbWluLCBtYXhdIDo9IHJhbmdlXG5cdFx0XHRcdGxlbiA6PSBoUmVzdWx0Ll8ubGVuZ3RoXG5cdFx0XHRcdGFzc2VydCAobGVuID49IG1pbiksIFwiI3tsZW59IG5vbi1vcHRpb25zIDwgbWluICgje21pbn0pXCJcblx0XHRcdFx0YXNzZXJ0IChsZW4gPD0gbWF4KSwgXCIje2xlbn0gbm9uLW9wdGlvbnMgPiBtYXggKCN7bWF4fSlcIlxuXG5cdERCRyBcImhSZXN1bHQgPSAje09MKGhSZXN1bHQpfVwiXG5cdHJldHVybiBoUmVzdWx0XG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbmV4cG9ydCBnZXRPcHRpb25JbmZvIDo9IChoRGVzYzogaGFzaCwgbmFtZTogc3RyaW5nKTogaGFzaCA9PlxuXG5cdCMgLS0tIFJldHVybiB2YWx1ZSBpcyBhIGhhc2ggd2l0aCBrZXlzOiB0eXBlLCBkZXNjXG5cblx0YXNzZXJ0IGRlZmluZWQoaERlc2MpLCBcImhEZXNjIGlzIG5vdCBkZWZpbmVkIGluIGdldE9wdGlvbkluZm8oKVwiXG5cdGFzc2VydCBpc0hhc2goaERlc2MpLCBcImhEZXNjIGlzIG5vdCBhIGhhc2ggaW4gZ2V0T3B0aW9uSW5mbygpOiAje09MKGhEZXNjKX1cIlxuXHRhc3NlcnQgKG5hbWUgIT0gJ18nKSwgXCJnZXRPcHRpb25JbmZvKGhEZXNjLCAnXycpIGNhbGxlZFwiXG5cdGFzc2VydCBoYXNLZXkoaERlc2MsIG5hbWUpLCBcIk5vIHN1Y2ggb3B0aW9uOiAtI3tuYW1lfVwiXG5cdGggOj0gaXNIYXNoKGhEZXNjW25hbWVdKSA/IGhEZXNjW25hbWVdIDoge2Rlc2M6IGhEZXNjW25hbWVdfVxuXHRpZiBub3RkZWZpbmVkKGgudHlwZSlcblx0XHRoLnR5cGUgPSAobmFtZS5sZW5ndGggPT0gMSkgPyAnYm9vbGVhbicgOiAnc3RyaW5nJ1xuXHRpZiBub3RkZWZpbmVkKGguZGVzYylcblx0XHRoLmRlc2MgPSAnPG5vIGRlc2NyaXB0aW9uIGF2YWlsYWJsZT4nXG5cdGlmIG5vdCBoYXNLZXkoaCwgJ2RlZmF1bHRWYWwnKSAmJiAoaC50eXBlID09ICdib29sZWFuJylcblx0XHRoLmRlZmF1bHRWYWwgPSBmYWxzZVxuXHRyZXR1cm4gaFxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuIyAtLS0gcmV0dXJucyB1bmRlZiBpZiBubyAnXycga2V5IGluIGhEZXNjXG5cbnR5cGUgcmFuZ2VUeXBlID0gW251bWJlciwgbnVtYmVyXVxuXG50eXBlIG5vbk9wdGlvbkluZm8gPSB7XG5cdHR5cGU6ICdhcnJheSdcblx0ZGVzYzogc3RyaW5nXG5cdHJhbmdlOiByYW5nZVR5cGVcblx0fVxuXG5leHBvcnQgZ2V0Tm9uT3B0aW9uSW5mbyA6PSAoaERlc2M6IGhhc2gpOiBub25PcHRpb25JbmZvPyA9PlxuXG5cdCMgLS0tIFJldHVybiB2YWx1ZSBpcyBhIGhhc2ggd2l0aCBrZXlzOlxuXHQjICAgICAgICB0eXBlID0gJ2FycmF5J1xuXHQjICAgICAgICBkZXNjXG5cdCMgICAgICAgIHJhbmdlIGFzIFttaW4sIG1heF1cblxuXHRhc3NlcnQgZGVmaW5lZChoRGVzYyksIFwiaERlc2MgaXMgbm90IGRlZmluZWQgaW4gZ2V0Tm9uT3B0aW9uSW5mbygpXCJcblx0aWYgbm90IGhhc0tleShoRGVzYywgJ18nKVxuXHRcdHJldHVybiB1bmRlZlxuXHRkZXNjIDo9IGhEZXNjLmRlc2MgfHwgJzxubyBkZXNjcmlwdGlvbiBhdmFpbGFibGU+J1xuXHRsZXQgcmFuZ2U6IHJhbmdlVHlwZSA9IFswLCBJbmZpbml0eV1cblx0aWYgaGFzS2V5KGhEZXNjLCAncmFuZ2UnKVxuXHRcdHIgOj0gaERlc2MucmFuZ2Vcblx0XHRpZiBpc0ludGVnZXIocilcblx0XHRcdHJhbmdlID0gW3IsIHJdXG5cdFx0ZWxzZSBpZiBBcnJheS5pc0FycmF5KHIpXG5cdFx0XHRhc3NlcnQgKHIubGVuZ3RoID09IDIpLCBcIkJhZCAnXycga2V5OiAje09MKHIpfVwiXG5cdFx0XHRbbWluLCBtYXhdIDo9IHJcblx0XHRcdGFzc2VydCBpc0ludGVnZXIobWluKSwgXCJyYW5nZSBtaW4gbm90IGFuIGludGVnZXJcIlxuXHRcdFx0aWYgKG1heCA9PSAnaW5mJylcblx0XHRcdFx0W21pbiwgSW5maW5pdHldXG5cdFx0XHRlbHNlXG5cdFx0XHRcdGFzc2VydCBpc0ludGVnZXIobWF4KSwgXCJyYW5nZSBtYXggbm90IGFuIGludGVnZXJcIlxuXHRcdFx0XHRbbWluLCBtYXhdXG5cdFx0ZWxzZVxuXHRcdFx0dGhyb3cgbmV3IEVycm9yIFwiSW52YWxpZCByYW5nZTogI3tPTChyKX1cIlxuXG5cdHJldHVybiB7XG5cdFx0dHlwZTogJ2FycmF5J1xuXHRcdGRlc2Ncblx0XHRyYW5nZVxuXHRcdH1cblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuZXhwb3J0IHNob3dIZWxwIDo9IChoRGVzYzogaGFzaCk6IHZvaWQgPT5cblxuXHRMT0cgXCJBdmFpbGFibGUgb3B0aW9uczpcIlxuXHRmb3IgbmFtZSBvZiBrZXlzKGhEZXNjLCAnZXhjZXB0PV8nKVxuXHRcdHt0eXBlLCBkZXNjfSA6PSBnZXRPcHRpb25JbmZvKGhEZXNjLCBuYW1lKVxuXHRcdExPRyBcIiAgIC0je25hbWV9OiAje3R5cGV9IC0gI3tkZXNjfVwiXG5cdGlmIGRlZmluZWQoaERlc2MuXylcblx0XHRMT0cgXCJBdmFpbGFibGUgbm9uLW9wdGlvbnM6XCJcblx0XHRpZiBpc0hhc2goaERlc2MuXylcblx0XHRcdHtyYW5nZSwgZGVzY30gOj0gaERlc2MuX1xuXHRcdFx0aWYgZGVmaW5lZChyYW5nZSlcblx0XHRcdFx0aWYgaXNJbnRlZ2VyKHJhbmdlKVxuXHRcdFx0XHRcdExPRyBcIiAgIFRoZXJlIG11c3QgYmUgZXhhY3RseSAje3JhbmdlfSBub24tb3B0aW9uc1wiXG5cdFx0XHRcdGVsc2UgaWYgaXNBcnJheShyYW5nZSlcblx0XHRcdFx0XHRbbWluLCBtYXhdIDo9IHJhbmdlXG5cdFx0XHRcdFx0aWYgKG1pbiA+IDApXG5cdFx0XHRcdFx0XHRMT0cgXCIgICBUaGVyZSBtdXN0IGJlIGF0IGxlYXN0ICN7bWlufSBub24tb3B0aW9uc1wiXG5cdFx0XHRcdFx0aWYgKG1heCAhPSAnaW5mJylcblx0XHRcdFx0XHRcdExPRyBcIiAgIFRoZXJlIG11c3QgYmUgYXQgbW9zdCAje21heH0gbm9uLW9wdGlvbnNcIlxuXHRcdGRlc2MgOj0gKFxuXHRcdFx0ICBpc1N0cmluZyhoRGVzYy5fKSA/IGhEZXNjLl9cblx0XHRcdDogaXNIYXNoKGhEZXNjLl8pID8gKGhEZXNjLl8uZGVzYyB8fCAnPG5vIGRlc2NyaXB0aW9uIGF2YWlsYWJsZT4nKVxuXHRcdFx0OiBjcm9hayBcIkJhZCBkZXNjcmlwdG9yIGZvciBub24tb3B0aW9uczogI3tPTChoRGVzYy5fKX1cIlxuXHRcdFx0KVxuXHRcdExPRyBkZXNjXG5cdHJldHVyblxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG5leHBvcnQgc2V0RGlyIDo9IChibG9jazogc3RyaW5nKTogdm9pZCA9PlxuXG5cdGNvbnNvbGUubG9nIFwiV29ya2luZyBvbiBpdFwiXG4iXX0=