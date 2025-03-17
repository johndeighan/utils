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
 * @module llutils - low level utilities
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

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3JjL2xpYi91dGlscy5jaXZldC50c3giLCJzb3VyY2VzIjpbInNyYy9saWIvdXRpbHMuY2l2ZXQiXSwibWFwcGluZ3MiOiI7QUFBQSxjQUFhO0FBQ2IsQUFBQTtBQUNBLEFBQUEsTUFBTSxDQUFDLENBQUM7QUFDUixDQUFDLEtBQUssQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLFVBQVUsQ0FBQztBQUM1QixDQUFDLFFBQVEsQ0FBQyxDQUFDLGdCQUFnQixDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsU0FBUyxDQUFDO0FBQzVELENBQUMsT0FBTyxDQUFDLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxRQUFRLENBQUM7QUFDdkQsQ0FBQyxPQUFPLENBQUMsQ0FBQyxRQUFRLENBQUM7QUFDbkIsQ0FBQyxJQUFJLENBQUMsQ0FBQyxVQUFVLENBQUM7QUFDbEIsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLGdCQUFnQjtBQUN4QixBQUFBLEFBQUEsTUFBTSxDQUFDLENBQUM7QUFDUixDQUFDLElBQUksQ0FBQyxDQUFDLFlBQVksQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLFdBQVcsQ0FBQztBQUNwRSxDQUFDLFNBQVMsQ0FBQyxDQUFDLGVBQWUsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLEtBQUssQ0FBQztBQUMxRCxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLFVBQVUsQ0FBQztBQUNqQyxDQUFDLFlBQVksQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLFlBQVksQ0FBQyxDQUFDLE9BQU8sQ0FBQztBQUM5QyxDQUFDLFNBQVMsQ0FBQyxDQUFDLFdBQVcsQ0FBQztBQUN4QixDQUFDLENBQUMs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QUNBO0FBQ0E7QUFDQSxHQUFHO0FBQ0gsQUFBQTtBQUNBLEFBQUEsQUFBQSxNQUFNLENBQUssTUFBSixJQUFJLENBQUMsQ0FBRSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQSxDQUFBO0FBQ3BFLEFBQUE7QUFDQSxBQUFBLENBQUMsTUFBTSxDQUFBLEFBQUMsQ0FBQyxFQUFFLENBQUMsTUFBTSxDQUFDLEdBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFlBQVksQ0FBQTtBQUN0QyxBQUFBLENBQU0sTUFBTCxLQUFLLENBQUMsQ0FBRSxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUM7QUFDN0IsQUFBQSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxNQUFNLENBQUMsS0FBSyxDO0FBQUMsQ0FBQTtBQUM5QixBQUFBO0FBQ0EsQUFBQSw4RUFBNkU7QUFDN0UsQUFBQTtBQUNBLEFBQUE7QUFDQTtBQUNBO0FBQ0EsR0FBRztBQUNILEFBQUE7QUFDQSxBQUFBLEFBQUEsTUFBTSxDQUFLLE1BQUosSUFBSSxDQUFDLENBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUEsQ0FBQTtBQUNwRSxBQUFBO0FBQ0EsQUFBQSxDQUFDLE1BQU0sQ0FBQSxBQUFDLENBQUMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxHQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxZQUFZLENBQUE7QUFDdEMsQUFBQSxDQUFNLE1BQUwsS0FBSyxDQUFDLENBQUUsQ0FBQyxTQUFTLENBQUMs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QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLEdBQUc7QUFDSCxBQUFBO0FBQ0EsQUFBQSxBQUFBLE1BQU0sQ0FBVyxNQUFWLFVBQVUsQ0FBQyxDQUFFLENBQUMsQ0FBQztBQUN0QixBQUFBLENBQUMsS0FBSyxDLEMsQ0FBQyxBQUFDLEksWSxDQUFLLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQztBQUN0QixBQUFBLENBQUMsS0FBSyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQztBQUM3QixBQUFBLENBQUMsUUFBUSxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDMUIsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFBLENBQUE7QUFDWCxBQUFBO0FBQ0EsQUFBQSxDQUFDLEdBQUcsQ0FBQSxVQUFVLENBQUMsS0FBSyxDQUFDLENBQUEsQ0FBQSxDQUFBO0FBQ3JCLEFBQUEsRUFBRSxJQUFJLENBQUMsQztDQUFDLENBQUE7QUFDUixBQUFBLENBQUMsSUFBSSxDQUFBLENBQUE7QUFDTCxBQUFBLEVBQUUsTUFBTSxDQUFBLEFBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxXQUFXLEVBQUUsRUFBRSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQztDQUFBLENBQUE7QUFDakQsQUFBQSxDQUFDLE1BQU0sQ0FBQSxBQUFDLGdCQUFnQixDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxXQUFXLEVBQUUsRUFBRSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUMxRCxBQUFBO0FBQ0EsQUFBQSxDQUFDLEdBQUcsQ0FBQSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsR0FBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFD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Q0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQSxDQUFBO0FBQzVELEFBQUE7QUFDQSxBQUFBLENBQUMsbURBQWtEO0FBQ25ELEFBQUE7QUFDQSxBQUFBLENBQUMsTUFBTSxDQUFBLEFBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMseUNBQXlDLENBQUE7QUFDakUsQUFBQSxDQUFDLE1BQU0sQ0FBQSxBQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsd0NBQXdDLEVBQUUsRUFBRSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUM3RSxBQUFBLENBQUMsTUFBTSxDQUFBLEFBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsa0NBQWtDLENBQUE7QUFDekQsQUFBQSxDQUFDLE1BQU0sQ0FBQSxBQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsaUJBQWlCLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQTtBQUN2RCxBQUFBLENBQUUsTUFBRCxDQUFDLENBQUMsQ0FBRSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUM3RCxBQUFBLENBQUMsR0FBRyxDQUFBLFVBQVUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUEsQ0FBQSxDQUFBO0FBQ3RCLEFBQUEsRUFBRSxDQUFDLENBQUMsSUFBSSxDLENBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLFE7Q0FBUSxDQUFBO0FBQ3BELEFBQUEsQ0FBQyxHQUFHLENBQUEsVUFBVSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQSxDQUFBLENBQUE7QUFDdEIsQUFBQSxFQUFFLENBQUMsQ0FBQyxJQUFJLEMsQ0FBRSxDQUFDLDRCO0NBQTRCLENBQUE7QUFDdkMsQUFBQSxDQUFDLEdBQUcsQ0FBQSxDQUFJLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxZQUFZLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUUsQ0FBQyxTQUFTLENBQUMsQ0FBQSxDQUFBLENBQUE7QUFDeEQsQUFBQSxFQUFFLENBQUMsQ0FBQyxVQUFVLEMsQ0FBRSxDQUFDLEs7Q0FBSyxDQUFBO0FBQ3RCLEFBQUEsQ0FBQyxNQUFNLENBQUMsQztBQUFDLENBQUE7QUFDVCxBQUFBO0FBQ0EsQUFBQSw4RUFBNkU7QUFDN0UsQUFBQSwyQ0FBMEM7QUFDMUMsQUFBQTtBQUNBLEFBQUEsQUFBQSxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLE1BQU0sQ0FBQztBQUNqQyxBQUFBO0FBQ0EsQUFBQSxBQUFBLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDdEIsQUFBQSxDQUFDLElBQUksQ0FBQyxDQUFDLE9BQU87QUFDZCxBQUFBLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTTtBQUNiLEFBQUEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxTQUFTO0FBQ2pCLENBQUMsQ0FBQztBQUNGLEFBQUE7QUFDQSxBQUFBLEFBQUEsTUFBTSxDQUFpQixNQUFoQixnQkFBZ0IsQ0FBQyxDQUFFLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLENBQUMsQyxDLENBQUMsQUFBQyxhLFksQ0FBYyxDQUFDLEVBQUUsQ0FBQSxDQUFBO0FBQzNELEFBQUE7QUFDQSxBQUFBLENBQUMsd0NBQXVDO0FBQ3hDLEFBQUEsQ0FBQyx3QkFBdUI7QUFDeEIsQUFBQSxDQUFDLGNBQWE7QUFDZCxBQUFBLENBQUMsNkJBQTRCO0FBQzdCLEFBQUE7QUFDQSxBQUFBLENBQUMsTUFBTSxDQUFBLEFBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsNENBQTRDLENBQUE7QUFDcEUsQUFBQSxDQUFDLEdBQUcsQ0FBQSxDQUFJLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQSxDQUFBLENBQUE7QUFDMUIsQUFBQSxFQUFFLE1BQU0sQ0FBQyxLO0NBQUssQ0FBQTtBQUNkLEFBQUEsQ0FBSyxNQUFKLElBQUksQ0FBQyxDQUFFLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsNEJBQTRCO0FBQ25ELEFBQUEsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQztBQUNyQyxBQUFBLENBQUMsR0FBRyxDQUFBLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQSxDQUFBLENBQUE7QUFDMUIsQUFBQSxFQUFHLE1BQUQsQ0FBQyxDQUFDLENBQUUsQ0FBQyxLQUFLLENBQUMsS0FBSztBQUNsQixBQUFBLEVBQUUsR0FBRyxDQUFBLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQSxDQUFBLENBQUE7QUFDakIsQUFBQSxHQUFHLEtBQUssQyxDQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEM7RUFBQyxDQUFBO0FBQ2pCLEFBQUEsRUFBRSxJQUFJLENBQUMsR0FBRyxDQUFBLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUEsQ0FBQSxDQUFBO0FBQzFCLEFBQUEsR0FBRyxNQUFNLENBQUEsQUFBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsR0FBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxhQUFhLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUNsRCxBQUFBLEdBQWEsTUFBVixDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUUs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QUFBQTtBQUNBLEFBQUEsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFBLEFBQUMsZUFBZSxDO0FBQUEsQ0FBQTtBQUM1QiIsIm5hbWVzIjpbXSwic291cmNlc0NvbnRlbnQiOlsiIyB1dGlscy5jaXZldFxuXG5pbXBvcnQge1xuXHR1bmRlZiwgZGVmaW5lZCwgbm90ZGVmaW5lZCxcblx0aXNTdHJpbmcsIGlzTm9uRW1wdHlTdHJpbmcsIGlzQm9vbGVhbiwgaXNOdW1iZXIsIGlzSW50ZWdlcixcblx0aXNBcnJheSwgaXNBcnJheU9mU3RyaW5ncywgaXNIYXNoLCBpc09iamVjdCwgaXNSZWdFeHAsXG5cdGlzRW1wdHksIG5vbkVtcHR5LFxuXHRoYXNoLCBvcHRpb25zcGVjLFxuXHR9IGZyb20gJy4vZGF0YXR5cGVzLnRzJ1xuaW1wb3J0IHtcblx0cGFzcywgZGVlcGx5RXF1YWxzLCBPTCwgTUwsIGdldE9wdGlvbnMsIGNyb2FrLCBhc3NlcnQsIHRocm93c0Vycm9yLFxuXHRzdHJUb0hhc2gsIHJlbW92ZUVtcHR5S2V5cywga2V5cywgaGFzS2V5LCBoYXNLZXlzLCBtZXJnZSxcblx0c3BhY2VzLCB0YWJzLCBydHJpbSwgY291bnRDaGFycyxcblx0YmxvY2tUb0FycmF5LCB0b0FycmF5LCBhcnJheVRvQmxvY2ssIHRvQmxvY2ssXG5cdGVzY2FwZVN0ciwgZXNjYXBlQmxvY2ssXG5cdH0gZnJvbSAnLi9sbHV0aWxzLnRzJ1xuaW1wb3J0IHtcblx0aXNGaWxlLCBpc0RpciwgZmlsZUV4dCwgd2l0aEV4dCxcblx0cm1GaWxlLCBnZXRQYXRoVHlwZSwgZ2V0U3RhdHMsIHBhcnNlUGF0aCxcblx0YWxsRmlsZXNNYXRjaGluZywgYWxsTGluZXNJbiwgd2F0Y2hGaWxlLCB3YXRjaEZpbGVzLFxuXHRub3JtYWxpemVQYXRoLCBta3BhdGgsIHJlbHBhdGgsIG5ld2VyRGVzdEZpbGVFeGlzdHMsXG5cdHBhdGhTdWJEaXJzLCBjbGVhckRpciwgbWtEaXIsIG1rRGlyc0ZvckZpbGUsXG5cdHNsdXJwLCBiYXJmLCBteXNlbGYsIHJlbW92ZUZpbGVzTWF0Y2hpbmcsXG5cdH0gZnJvbSAnLi9mcy50cydcbmltcG9ydCB7XG5cdExvZ2dlckV4LCBsb2dnZXIsIHNldExvZ0xldmVsLCBwdXNoTG9nTGV2ZWwsIHBvcExvZ0xldmVsLFxuXHRjdXJMb2dMZXZlbCwgY2xlYXJMb2csIGdldExvZywgZ2V0RnVsbExvZyxcblx0SU5ERU5ULCBVTkRFTlQsIENMRUFSLFxuXHREQkcsIExPRywgV0FSTiwgRVJSLFxuXHR9IGZyb20gJy4vbG9nZ2VyLnRzJ1xuaW1wb3J0IHtcblx0b25lSW5kZW50LCByZXNldE9uZUluZGVudCwgaW5kZW50TGV2ZWwsIHNwbGl0TGluZSxcblx0aW5kZW50ZWQsIHVuZGVudGVkLFxuXHR9IGZyb20gJy4vaW5kZW50LnRzJ1xuaW1wb3J0IHtcblx0ZXhlY0NtZCwgZXhlY0NtZFN5bmMsIGNtZFN1Y2NlZWRzLFxuXHRleGVjQ21kUmVzdWx0LCBta3N0ciwgZ2V0Q21kTGluZSwgZ2V0UHJvY09wdCwgZ2V0RmluYWxSZXN1bHQsXG5cdH0gZnJvbSAnLi9leGVjLXV0aWxzLnRzJ1xuaW1wb3J0IHtcblx0aENvbXBpbGVyQ29uZmlnLCBmaW5kU291cmNlRmlsZSwgY29tcGlsZUZpbGUsIGlzRGlyU3BlYyxcblx0Y29tcGlsZVJlc3VsdCxcblx0fSBmcm9tICcuL2NvbXBpbGUtY29uZmlnLnRzJ1xuXG5leHBvcnQge1xuXHR1bmRlZiwgZGVmaW5lZCwgbm90ZGVmaW5lZCwgcGFzcywgZGVlcGx5RXF1YWxzLFxuXHRMb2dnZXJFeCwgbG9nZ2VyLCBzZXRMb2dMZXZlbCwgcHVzaExvZ0xldmVsLCBwb3BMb2dMZXZlbCxcblx0Y3VyTG9nTGV2ZWwsIGNsZWFyTG9nLCBnZXRMb2csIGdldEZ1bGxMb2csXG5cdElOREVOVCwgVU5ERU5ULCBDTEVBUixcblx0REJHLCBMT0csIFdBUk4sIEVSUixcblx0b25lSW5kZW50LCByZXNldE9uZUluZGVudCwgaW5kZW50TGV2ZWwsIHNwbGl0TGluZSxcblx0aW5kZW50ZWQsIHVuZGVudGVkLFxuXHRPTCwgTUwsIGNyb2FrLCBhc3NlcnQsIHRocm93c0Vycm9yLCBnZXRPcHRpb25zLFxuXHRyZW1vdmVFbXB0eUtleXMsIGtleXMsIGhhc0tleSwgaGFzS2V5cywgbWVyZ2UsXG5cdHNwYWNlcywgdGFicywgcnRyaW0sIGNvdW50Q2hhcnMsXG5cdGJsb2NrVG9BcnJheSwgdG9BcnJheSwgYXJyYXlUb0Jsb2NrLCB0b0Jsb2NrLFxuXHRlc2NhcGVTdHIsIGVzY2FwZUJsb2NrLFxuXHRpc1N0cmluZywgaXNOb25FbXB0eVN0cmluZywgaXNCb29sZWFuLCBpc051bWJlciwgaXNJbnRlZ2VyLFxuXHRpc0FycmF5LCBpc0FycmF5T2ZTdHJpbmdzLCBpc0hhc2gsIGlzT2JqZWN0LCBpc1JlZ0V4cCxcblx0aXNFbXB0eSwgbm9uRW1wdHksXG5cdGlzRmlsZSwgaXNEaXIsIGZpbGVFeHQsIHdpdGhFeHQsXG5cdHJtRmlsZSwgZ2V0UGF0aFR5cGUsIGdldFN0YXRzLCBwYXJzZVBhdGgsXG5cdGFsbEZpbGVzTWF0Y2hpbmcsIGFsbExpbmVzSW4sIHdhdGNoRmlsZSwgd2F0Y2hGaWxlcyxcblx0bm9ybWFsaXplUGF0aCwgbWtwYXRoLCByZWxwYXRoLCBuZXdlckRlc3RGaWxlRXhpc3RzLFxuXHRwYXRoU3ViRGlycywgY2xlYXJEaXIsIG1rRGlyLCBta0RpcnNGb3JGaWxlLFxuXHRzbHVycCwgYmFyZiwgbXlzZWxmLCByZW1vdmVGaWxlc01hdGNoaW5nLFxuXHRjb21waWxlRmlsZSwgZXhlY0NtZCwgZXhlY0NtZFN5bmMsIGNtZFN1Y2NlZWRzLFxuXHRpc0RpclNwZWMsXG5cdG1rc3RyLCBnZXRDbWRMaW5lLCBnZXRQcm9jT3B0LCBnZXRGaW5hbFJlc3VsdCxcblx0fVxuZXhwb3J0IHR5cGUge1xuXHRleGVjQ21kUmVzdWx0LCBjb21waWxlUmVzdWx0LFxuXHR9XG5cbi8qKlxuICogQG1vZHVsZSBsbHV0aWxzIC0gbG93IGxldmVsIHV0aWxpdGllc1xuICovXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogU3BsaXRzIGEgc3RyaW5nIG9uIHdoaXRlc3BhY2UgaW50byBhbiBhcnJheSxcbiAqIGlnbm9yaW5nIGFueSBsZWFkaW5nIG9yIHRyYWlsaW5nIHdoaXRlc3BhY2VcbiAqL1xuXG5leHBvcnQgd3NTcGxpdCA6PSAoc3RyOiBzdHJpbmcpOiBzdHJpbmdbXSA9PlxuXG5cdG5ld3N0ciA6PSBzdHIudHJpbSgpXG5cdGlmIChuZXdzdHIgPT0gJycpXG5cdFx0cmV0dXJuIFtdXG5cdGVsc2Vcblx0XHRyZXR1cm4gbmV3c3RyLnNwbGl0KC9cXHMrLylcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuLyoqXG4gKiBzcGxpdHMgZWFjaCBzdHJpbmcgb24gd2hpdGVzcGFjZSBpZ25vcmluZyBhbnkgbGVhZGluZ1xuICogb3IgdHJhaWxpbmcgd2hpdGVzcGFjZSwgYW5kIHJldHVybnMgYW4gYXJyYXkgb2ZcbiAqIGFsbCBzdWJzdHJpbmdzIG9idGFpbmVkXG4gKi9cblxuZXhwb3J0IHdvcmRzIDo9ICguLi5sU3RyaW5nczogc3RyaW5nW10pOiBzdHJpbmdbXSA9PlxuXG5cdGxldCBsV29yZHMgPSBbXVxuXHRmb3Igc3RyIG9mIGxTdHJpbmdzXG5cdFx0Zm9yIHdvcmQgb2Ygd3NTcGxpdChzdHIpXG5cdFx0XHRsV29yZHMucHVzaCB3b3JkXG5cdHJldHVybiBsV29yZHNcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuLyoqXG4gKiBBIGdlbmVyYXRvciB0aGF0IHlpZWxkcyBpbnRlZ2VycyBzdGFydGluZyB3aXRoIDAgYW5kXG4gKiBjb250aW51aW5nIHRvIG4tMVxuICovXG5cbmV4cG9ydCByYW5nZSA6PSAobjogbnVtYmVyKTogR2VuZXJhdG9yPG51bWJlciwgdm9pZCwgdW5rbm93bj4gLT5cblxuXHRsZXQgaSA9IDBcblx0d2hpbGUgKGkgPCBuKVxuXHRcdHlpZWxkIGlcblx0XHRpID0gaSArIDFcblx0cmV0dXJuXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogY29udmVydHMgeCB0byBhIHN0cmluZywgcmVtb3ZpbmcgYW55IGNhcnJpYWdlIHJldHVybnNcbiAqIGFuZCByZW1vdmluZyBsZWFkaW5nIGFuZCB0cmFpbGluZyB3aGl0ZXNwYWNlXG4gKi9cblxuZXhwb3J0IG5vcm1hbGl6ZVN0ciA6PSAoeDogYW55KTogc3RyaW5nID0+XG5cblx0cmV0dXJuIHgudG9TdHJpbmcoKS5yZXBsYWNlQWxsKCdcXHInLCAnJykudHJpbSgpXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogY2FsY3VsYXRlcyB0aGUgbnVtYmVyIG9mIGV4dHJhIGNoYXJhY3RlcnMgbmVlZGVkIHRvXG4gKiBtYWtlIHRoZSBnaXZlbiBzdHJpbmcgaGF2ZSB0aGUgZ2l2ZW4gbGVuZ3RoLlxuICogSWYgbm90IHBvc3NpYmxlLCByZXR1cm5zIDBcbiAqL1xuXG5leHBvcnQgZ2V0TkV4dHJhID0gKHN0cjogc3RyaW5nLCBsZW46IG51bWJlcik6IG51bWJlciA9PlxuXG5cdGV4dHJhIDo9IGxlbiAtIHN0ci5sZW5ndGhcblx0cmV0dXJuIChleHRyYSA+IDApID8gZXh0cmEgOiAwXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogcGFkcyB0aGUgZ2l2ZW4gc3RyaW5nIG9uIHRoZSByaWdodCB3aXRoXG4gKiB0aGUgZ2l2ZW4gY2hhcmFjdGVyLCB0byB0aGUgZ2l2ZW4gbGVuZ3RoXG4gKi9cblxuZXhwb3J0IHJwYWQgOj0gKHN0cjogc3RyaW5nLCBsZW46IG51bWJlciwgY2g6IHN0cmluZz0nICcpOiBzdHJpbmcgPT5cblxuXHRhc3NlcnQgKGNoLmxlbmd0aCA9PSAxKSwgXCJOb3QgYSBjaGFyXCJcblx0ZXh0cmEgOj0gZ2V0TkV4dHJhKHN0ciwgbGVuKVxuXHRyZXR1cm4gc3RyICsgY2gucmVwZWF0KGV4dHJhKVxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKipcbiAqIHBhZHMgdGhlIGdpdmVuIHN0cmluZyBvbiB0aGUgbGVmdCB3aXRoXG4gKiB0aGUgZ2l2ZW4gY2hhcmFjdGVyLCB0byB0aGUgZ2l2ZW4gbGVuZ3RoXG4gKi9cblxuZXhwb3J0IGxwYWQgOj0gKHN0cjogc3RyaW5nLCBsZW46IG51bWJlciwgY2g6IHN0cmluZz0nICcpOiBzdHJpbmcgPT5cblxuXHRhc3NlcnQgKGNoLmxlbmd0aCA9PSAxKSwgXCJOb3QgYSBjaGFyXCJcblx0ZXh0cmEgOj0gZ2V0TkV4dHJhKHN0ciwgbGVuKVxuXHRyZXR1cm4gY2gucmVwZWF0KGV4dHJhKSArIHN0clxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuIyAtLS0gdmFsaWQgb3B0aW9uczpcbiMgICAgICAgIGNoYXIgLSBjaGFyIHRvIHVzZSBvbiBsZWZ0IGFuZCByaWdodFxuIyAgICAgICAgYnVmZmVyIC0gbnVtIHNwYWNlcyBhcm91bmQgdGV4dCB3aGVuIGNoYXIgPD4gJyAnXG5cbi8qKlxuICogcGFkcyB0aGUgZ2l2ZW4gc3RyaW5nIG9uIGJvdGggdGhlIGxlZnQgYW5kIHJpZ2h0XG4gKiB3aXRoIHRoZSBnaXZlbiBjaGFyYWN0ZXIsIHRvIHRoZSBnaXZlbiBsZW5ndGhcbiAqIGJ1dCB3aXRoIHRoZSBnaXZlbiBudW1iZXIgb2YgYnVmZmVyIGNoYXJzIHN1cnJvdW5kaW5nXG4gKiB0aGUgdGV4dFxuICovXG5cbmV4cG9ydCBjZW50ZXJlZCA6PSAoXG5cdHRleHQ6IHN0cmluZyxcblx0d2lkdGg6IG51bWJlcixcblx0Y2hhcjogc3RyaW5nID0gJyAnLFxuXHRudW1CdWZmZXI6IG51bWJlciA9IDJcblx0KTogc3RyaW5nID0+XG5cblx0dG90U3BhY2VzIDo9IHdpZHRoIC0gdGV4dC5sZW5ndGhcblx0aWYgKHRvdFNwYWNlcyA8PSAwKVxuXHRcdHJldHVybiB0ZXh0XG5cdG51bUxlZnQgOj0gTWF0aC5mbG9vcih0b3RTcGFjZXMgLyAyKVxuXHRudW1SaWdodCA6PSB0b3RTcGFjZXMgLSBudW1MZWZ0XG5cdGlmIChjaGFyID09ICcgJylcblx0XHRyZXR1cm4gc3BhY2VzKG51bUxlZnQpICsgdGV4dCArIHNwYWNlcyhudW1SaWdodClcblx0ZWxzZVxuXHRcdGJ1ZiA6PSAnICcucmVwZWF0KG51bUJ1ZmZlcilcblx0XHRsZWZ0IDo9IGNoYXIucmVwZWF0KG51bUxlZnQgLSBudW1CdWZmZXIpXG5cdFx0cmlnaHQgOj0gY2hhci5yZXBlYXQobnVtUmlnaHQgLSBudW1CdWZmZXIpXG5cdFx0cmV0dXJuIGxlZnQgKyBidWYgKyB0ZXh0ICsgYnVmICsgcmlnaHRcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuLyoqXG4gKiBwYWQgYSBzdHJpbmcgb24gdGhlIGxlZnQsIHJpZ2h0LCBvciBib3RoXG4gKiB0byB0aGUgZ2l2ZW4gd2lkdGhcbiAqL1xuXG5leHBvcnQgYWxpZ25TdHJpbmcgOj0gKFxuXHRzdHI6IHN0cmluZyxcblx0d2lkdGg6IG51bWJlcixcblx0YWxpZ246IHN0cmluZ1xuXHQpOiBzdHJpbmcgLT5cblxuXHRhc3NlcnQgaXNTdHJpbmcoc3RyKSwgXCJzdHIgbm90IGEgc3RyaW5nOiAje09MKHN0cil9XCJcblx0YXNzZXJ0IGlzU3RyaW5nKGFsaWduKSwgXCJhbGlnbiBub3QgYSBzdHJpbmc6ICN7T0woYWxpZ24pfVwiXG5cdHN3aXRjaCBhbGlnblxuXHRcdHdoZW4gJ2xlZnQnLCAnbCdcblx0XHRcdHJldHVybiBycGFkKHN0ciwgd2lkdGgpXG5cdFx0d2hlbiAnY2VudGVyJywgJ2MnXG5cdFx0XHRyZXR1cm4gY2VudGVyZWQoc3RyLCB3aWR0aClcblx0XHR3aGVuICdyaWdodCcsICdyJ1xuXHRcdFx0cmV0dXJuIGxwYWQoc3RyLCB3aWR0aClcblx0XHRlbHNlXG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IgXCJVbmtub3duIGFsaWduOiAje09MKGFsaWduKX1cIlxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKipcbiAqIGNvbnZlcnRzIHRoZSBnaXZlbiBudW1iZXIgdG8gYSBzdHJpbmcsIHRoZW4gcGFkcyBvbiB0aGUgbGVmdFxuICogd2l0aCB6ZXJvcyB0byBhY2hpZXZlIHRoZSBnaXZlbiBsZW5ndGhcbiAqL1xuXG5leHBvcnQgenBhZCA6PSAobjogbnVtYmVyLCBsZW46IG51bWJlcik6IHN0cmluZyA9PlxuXG5cdHJldHVybiBscGFkKG4udG9TdHJpbmcoKSwgbGVuLCAnMCcpXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogUmVtb3ZlIGxpbmVzIGZyb20gYSBzdHJpbmcgb3IgYXJyYXlcbiAqIHBhdCBjYW4gYmUgYSBzdHJpbmcgb3IgYSByZWd1bGFyIGV4cHJlc3Npb25cbiAqL1xuXG5leHBvcnQgcmVtb3ZlTGluZXMgOj0gKFxuXHRzdHJPckFycmF5OiBzdHJpbmcgfCBzdHJpbmdbXSxcblx0cGF0OiBzdHJpbmcgfCBSZWdFeHBcblx0KTogc3RyaW5nIHwgc3RyaW5nW10gPT5cblxuXHRhc3NlcnQgaXNTdHJpbmcocGF0KSB8fCBpc1JlZ0V4cChwYXQpLCAgXCJCYWQgYXJnIDI6ICN7T0wocGF0KX1cIlxuXHRsTGluZXMgOj0gaXNTdHJpbmcoc3RyT3JBcnJheSkgPyBibG9ja1RvQXJyYXkoc3RyT3JBcnJheSkgOiBzdHJPckFycmF5XG5cdGxOZXdMaW5lcyA6PSAoXG5cdFx0aWYgKHR5cGVvZiBwYXQgPT0gJ3N0cmluZycpXG5cdFx0XHRsTGluZXMuZmlsdGVyKChsaW5lKSA9PiAobGluZSAhPSBwYXQpKVxuXHRcdGVsc2Vcblx0XHRcdGxMaW5lcy5maWx0ZXIoKGxpbmUpID0+IChsaW5lLm1hdGNoKHBhdCkgPT0gbnVsbCkpXG5cdFx0KVxuXHRpZiBpc1N0cmluZyhzdHJPckFycmF5KVxuXHRcdHJldHVybiBsTmV3TGluZXMuam9pbignXFxuJylcblx0ZWxzZVxuXHRcdHJldHVybiBsTmV3TGluZXNcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuZXhwb3J0IGdldFBhdHRlcm4gOj0gKCk6IHN0cmluZyA9PlxuXG5cdGxLZXlzIDo9IE9iamVjdC5rZXlzKGhDb21waWxlckNvbmZpZy5oQ29tcGlsZXJzKVxuXHRpZiAobEtleXMubGVuZ3RoID09IDEpXG5cdFx0cmV0dXJuIFwiKiovKiN7bEtleXNbMF19XCJcblx0ZWxzZVxuXHRcdHJldHVybiBcIioqLyp7I3tsS2V5cy5qb2luKCcsJyl9fVwiXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4jIC0tLSBBIGdlbmVyYXRvciAtIHlpZWxkcyB7cGF0aCwgc3RhdHVzLCBvdXRQYXRofVxuXG5leHBvcnQgY29tcGlsZUFsbEZpbGVzIDo9IChcblx0cGF0dGVybjogc3RyaW5nPyA9IHVuZGVmLFxuXHQpOiBHZW5lcmF0b3I8Y29tcGlsZVJlc3VsdCwgdm9pZCwgdW5rbm93bj4gLT5cblxuXHRoR2xvYk9wdGlvbnMgOj0ge1xuXHRcdGV4Y2x1ZGU6IFtcblx0XHRcdCdub2RlX21vZHVsZXMvKionXG5cdFx0XHQnLmdpdC8qKidcblx0XHRcdCcqKi8qLnRlbXAuKicgICMgLS0tIGRvbid0IGNvbXBpbGUgdGVtcCBmaWxlc1xuXHRcdFx0XVxuXHRcdH1cblxuXHRnbG9iUGF0dGVybiA6PSBkZWZpbmVkKHBhdHRlcm4pID8gcGF0dGVybiA6IGdldFBhdHRlcm4oKVxuXHREQkcgXCJjb21waWxpbmcgYWxsIGZpbGVzLCBwYXQ9I3tPTChnbG9iUGF0dGVybil9XCJcblx0Zm9yIHtwYXRofSBvZiBhbGxGaWxlc01hdGNoaW5nKGdsb2JQYXR0ZXJuLCBoR2xvYk9wdGlvbnMpXG5cdFx0aFJlc3VsdCA6PSBjb21waWxlRmlsZSBwYXRoXG5cdFx0aWYgKGhSZXN1bHQuc3RhdHVzID09ICdjb21waWxlZCcpXG5cdFx0XHR5aWVsZCBoUmVzdWx0XG5cdHJldHVyblxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG5leHBvcnQgZW5zdXJlQ29tcGlsZWQgOj0gKFxuXHRkaXJzcGVjOiBzdHJpbmcsXG5cdHN0dWI6IHN0cmluZyxcblx0cHVycG9zZTogc3RyaW5nPyA9IHVuZGVmXG5cdCk6IHN0cmluZz8gPT5cblxuXHRoIDo9IGZpbmRTb3VyY2VGaWxlIGRpcnNwZWMsIHN0dWIsIHB1cnBvc2Vcblx0aWYgKGggPT0gdW5kZWYpIHx8IChoLnBhdGggPT0gdW5kZWYpIHx8IG5vdCBpc0ZpbGUoaC5wYXRoKVxuXHRcdERCRyBcIk5vdCBjb21waWxpbmc6IG5vIHN1Y2ggZmlsZTogI3tkaXJzcGVjfS8je3N0dWJ9LyN7cHVycG9zZX1cIlxuXHRcdHJldHVybiB1bmRlZlxuXHRlbHNlXG5cdFx0e3N0YXR1cywgb3V0UGF0aH0gOj0gY29tcGlsZUZpbGUgaC5wYXRoXG5cdFx0aWYgKG91dFBhdGggPT0gdW5kZWYpXG5cdFx0XHRXQVJOIFwiQ29tcGlsZSBvZiBsaWIgI3toLnBhdGh9IGZhaWxlZCB3aXRoIHN0YXR1cyAje3N0YXR1c31cIlxuXHRcdFx0cmV0dXJuIHVuZGVmXG5cdFx0ZWxzZVxuXHRcdFx0YXNzZXJ0IGlzRmlsZShvdXRQYXRoKSxcblx0XHRcdFx0XHRcImNvbXBpbGVGaWxlKCkgc3VjY2VlZGVkLCBidXQgI3tPTChvdXRQYXRoKX0gZG9lcyBub3QgZXhpc3QhXCJcblx0XHRcdHJldHVybiBvdXRQYXRoXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbnR5cGUgdW5pdFRlc3RSZXN1bHQgPSB7XG5cdHN0dWI6IHN0cmluZ1xuXHRzdWNjZXNzOiBib29sZWFuXG5cdG1zZz86IHN0cmluZ1xuXHRjb2RlPzogbnVtYmVyXG5cdHNpZ25hbD86IHN0cmluZ1xuXHR9XG5cbmV4cG9ydCBydW5Vbml0VGVzdCA6PSAoXG5cdHN0dWI6IHN0cmluZyxcblx0KTogdW5pdFRlc3RSZXN1bHQgPT5cblxuXHREQkcgXCJSdW5uaW5nIHVuaXQgdGVzdCAje3N0dWJ9XCJcblxuXHRlbnN1cmVDb21waWxlZCAnbGliRGlyJywgc3R1YlxuXHRlbnN1cmVDb21waWxlZCAnYmluRGlyJywgc3R1YlxuXG5cdCMgLS0tIFRoaXMgaXMgdGhlIHBhdGggdG8gdGhlIHRlc3QgdG8gYmUgcnVuXG5cdHRlc3RPdXRQYXRoIDo9IGVuc3VyZUNvbXBpbGVkICd0ZXN0RGlyJywgc3R1YiwgJ3Rlc3QnXG5cdGlmICh0ZXN0T3V0UGF0aCA9PSB1bmRlZilcblx0XHRXQVJOIFwiQ29tcGlsZSBvZiAje3N0dWJ9IHVuaXQgdGVzdCBmYWlsZWRcIlxuXHRcdHJldHVybiB7XG5cdFx0XHRzdHViXG5cdFx0XHRzdWNjZXNzOiBmYWxzZVxuXHRcdFx0bXNnOiBcIkNvbXBpbGUgb2YgI3tzdHVifSB1bml0IHRlc3QgZmFpbGVkXCJcblx0XHRcdH1cblx0ZWxzZVxuXHRcdERCRyBcInRlc3RPdXRQYXRoID0gI3tPTCh0ZXN0T3V0UGF0aCl9XCJcblxuXHQjIC0tLSBDb21waWxlIGFsbCBmaWxlcyBpbiBzdWJkaXIgaWYgaXQgZXhpc3RzXG5cdGlmIGlzRGlyKFwidGVzdC8je3N0dWJ9XCIpXG5cdFx0Zm9yIHtwYXRoLCBzdGF0dXMsIG91dFBhdGh9IG9mIGNvbXBpbGVBbGxGaWxlcyhcInRlc3QvI3tzdHVifS8qXCIpXG5cdFx0XHRpZiBub3RkZWZpbmVkKG91dFBhdGgpXG5cdFx0XHRcdFdBUk4gXCJGaWxlICN7T0wocGF0aCl9IG5vdCBjb21waWxlZFwiXG5cblx0IyAtLS0gUnVuIHRoZSB1bml0IHRlc3QsIHJldHVybiByZXR1cm4gY29kZVxuXHRhc3NlcnQgaXNGaWxlKHRlc3RPdXRQYXRoKSwgXCJObyBzdWNoIGZpbGU6ICN7T0wodGVzdE91dFBhdGgpfVwiXG5cblx0IyAtLS0gUmV0dXJuIHZhbHVlIGhhcyBrZXlzIHN1Y2Nlc3MsIGNvZGUsIHNpZ25hbFxuXHRoIDo9IGV4ZWNDbWRTeW5jICdkZW5vJywgW1xuXHRcdFx0J3Rlc3QnLFxuXHRcdFx0Jy1xQScsXG5cdFx0XHR0ZXN0T3V0UGF0aFxuXHRcdFx0XVxuI1x0aFJlc3VsdC5zdHViID0gc3R1YlxuXHRyZXR1cm4ge1xuXHRcdHN0dWJcblx0XHRzdWNjZXNzOiBoLnN1Y2Nlc3Ncblx0XHRjb2RlOiBoLmNvZGVcblx0XHRzaWduYWw6IGguc2lnbmFsXG5cdFx0fVxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuIyAtLS0gYSBnZW5lcmF0b3JcblxuZXhwb3J0IHJ1bkFsbFVuaXRUZXN0cyA6PSAoKTogR2VuZXJhdG9yPHVuaXRUZXN0UmVzdWx0LCB2b2lkLCB1bmtub3duPiAtPlxuXG5cdGhHbG9iT3B0aW9ucyA6PSB7XG5cdFx0ZXhjbHVkZTogWydub2RlX21vZHVsZXMvKionLCAnLmdpdC8qKiddXG5cdFx0fVxuXG5cdHBhdHRlcm4gOj0gJ3Rlc3QvKi50ZXN0LmpzJ1xuXHREQkcgXCJwYXR0ZXJuID0gI3tPTChwYXR0ZXJuKX1cIlxuXHRmb3Ige3BhdGh9IG9mIGFsbEZpbGVzTWF0Y2hpbmcocGF0dGVybiwgaEdsb2JPcHRpb25zKVxuXHRcdHtzdHVifSA6PSBwYXJzZVBhdGgocGF0aClcblx0XHRpZiAoc3R1YiA9PSB1bmRlZilcblx0XHRcdFdBUk4gXCJObyBzdHViIGZvdW5kIGluICN7T0wocGF0aCl9XCJcblx0XHRlbHNlXG5cdFx0XHREQkcgXCJURVNUOiAje3BhdGh9XCJcblx0XHRcdHlpZWxkIHJ1blVuaXRUZXN0KHN0dWIpXG5cdHJldHVyblxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG5oS2V5VG9Mb2dnZXI6IGhhc2ggOj0ge1xuXHRJOiAnaW5mbydcblx0UDogJ3Byb2ZpbGUnXG5cdEQ6ICdkZWJ1Zydcblx0UTogJ3F1aWV0J1xuXHRTOiAnc2lsZW50J1xuXHR9XG5cbmV4cG9ydCBzZXRMb2dnZXJGcm9tQXJncyA6PSAobEFyZ3M6IHN0cmluZ1tdKTogdm9pZCA9PlxuXG5cdGZvciBzdHIgb2YgbEFyZ3Ncblx0XHRsTWF0Y2hlcyA6PSBzdHIubWF0Y2goLy8vXlxuXHRcdFx0LVxuXHRcdFx0KFtBLVphLXowLTlfLV0qKVxuXHRcdFx0KD0pP1xuXHRcdFx0Ly8vKVxuXHRcdGlmIChsTWF0Y2hlcyA9PSBudWxsKVxuXHRcdFx0cGFzcygpXG5cdFx0ZWxzZVxuXHRcdFx0a2V5U3RyIDo9IGxNYXRjaGVzWzFdXG5cdFx0XHRoYXNFcSA6PSBsTWF0Y2hlc1syXVxuXHRcdFx0aWYgaXNFbXB0eShoYXNFcSlcblx0XHRcdFx0Zm9yIGtleSBvZiBrZXlzKGhLZXlUb0xvZ2dlcilcblx0XHRcdFx0XHRpZiBrZXlTdHIuaW5jbHVkZXMoa2V5KVxuXHRcdFx0XHRcdFx0c2V0TG9nTGV2ZWwgaEtleVRvTG9nZ2VyW2tleV1cblx0cmV0dXJuXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogUGFyc2UgY29tbWFuZCBsaW5lIGFyZ3VtZW50cywgb3B0aW9uYWxseSBzcGVjaWZ5aW5nIHdoaWNoXG4gKiBvcHRpb25zIHRvIGV4cGVjdCBhbmQvb3IgdGhlIGV4cGVjdGVkIG51bWJlciBvZiBub24tb3B0aW9uc1xuICpcbiAqIFRoZXJlIGFyZSAzIGtpbmRzIG9mIGl0ZW1zIGFsbG93ZWQgb24gdGhlIGNvbW1hbmQgbGluZTpcbiAqXG4gKiAxLiBmbGFncywgZS5nLlxuICogXHRgLWZueGAgLSBzZXRzIGZsYWdzIGBmYCwgJ24nIGFuZCBgeGAgdG8gdHJ1ZVxuICogICAgZmxhZ3MgbXVzdCBiZSB1cHBlciBvciBsb3dlciBjYXNlIGxldHRlcnNcbiAqXG4gKiAyLiBhbiBvcHRpb24gd2l0aCBhIHZhbHVlLCBlLmcuXG4gKiBcdGAtbGFiZWw9bXlsYWJlbGAgLSBzZXRzIG9wdGlvbiBgbGFiZWxgIHRvIGAnbXlsYWJlbCdgXG4gKiBcdGlmIHRoZSB2YWx1ZSBjb250YWlucyBhIHNwYWNlIGNoYXIsIGl0IG11c3QgYmUgcXVvdGVkXG4gKiBcdGlmIHRoZSB2YWx1ZSBsb29rcyBsaWtlIGEgbnVtYmVyLCBpdCdzIHNldCB0byBhIG51bWJlclxuICpcbiAqIDMuIGFueXRoaW5nIGVsc2UgaXMgYSBub24tb3B0aW9uLCBlLmcuXG4gKiBcdGM6L3RlbXAvdGVtcC50eHRcbiAqIFx0aWYgaXQgaW5jbHVkZXMgYSBzcGFjZSBjaGFyIG9yIHN0YXJ0cyB3aXRoIGAtYCxcbiAqIFx0XHRpdCBtdXN0IGJlIHF1b3RlZFxuICpcbiAqIHRoZSAxc3QgYXJndW1lbnQgdG8gZ2V0Q21kQXJncygpIGlzIG9wdGlvbmFsLCBhbmQgaXMgYSBoYXNoXG4gKiBvZiBpbmZvcm1hdGlvbiBhYm91dCB0aGUgZXhwZWN0ZWQgYXJndW1lbnRzLlxuICpcbiAqIElmIGtleSAnXycgaXMgcHJlc2VudCwgaXQgbXVzdCBiZSBhIGhhc2ggcG9zc2libHkgaW5jbHVkaW5nIGtleXM6XG4gKiAgICAncmFuZ2UnIC0gZWl0aGVyIGFuIGludGVnZXIgc3BlY2lmeWluZyB0aGUgZXhhY3QgbnVtYmVyIG9mXG4gKiAgICAgICAgICAgICAgbm9uLW9wdGlvbnMgZXhwZWN0ZWQsIG9mIGFuIGFycmF5IG9mIDIgaW50ZWdlcnNcbiAqICAgICAgICAgICAgICBzcGVjaWZ5aW5nIHRoZSBtaW5pbXVtIGFuZCBtYXhpbXVtIG51bWJlciBvZlxuICogICAgICAgICAgICAgIG5vbi1vcHRpb25zIGV4cGVjdGVkLiBUaGUgMm5kIG9mIHRoZXNlIG1heSBiZVxuICogICAgICAgICAgICAgIHRoZSBzdHJpbmcgJ2luZicgdG8gaW5kaWNhdGUgbm8gbWF4aW11bSBudW1iZXJcbiAqICAgICdkZXNjJyAtIGEgdGV4dCBkZXNjcmlwdGlvbiBvZiB3aGF0IG5vbi1vcHRpb25zIGFyZVxuICpcbiAqIEFsbCBvdGhlciBrZXlzIGFyZSBuYW1lcyBvZiBvcHRpb25zIGFsbG93ZWQsIGFuZCB0aGUgYXNzb2NpYXRlZCB2YWx1ZVxuICogbXVzdCBiZSBhIGhhc2ggd2l0aCBwb3NzaWJseSB0aGVzZSBrZXlzOlxuICogICAgdHlwZSAtIHRoZSB0eXBlIG9mIHZhbHVlIGV4cGVjdGVkIChkZWZhdWx0cyB0byAnYm9vbGVhbicpXG4gKiAgICBkZXNjIC0gYSB0ZXh0IGRlc2NyaXB0aW9uIG9mIHRoZSBvcHRpb24gKHVzZWQgb24gaGVscCBzY3JlZW5zKVxuICpcbiAqIHRoZSAybmQgYXJndW1lbnQgdG8gZ2V0Q21kQXJncygpIGlzIGFuIGFycmF5IG9mIHN0cmluZyBhcmd1bWVudHNcbiAqIGZyb20gdGhlIGNvbW1hbmQgbGluZSAoZGVmYXVsdHMgdG8gRGVuby5hcmdzKVxuICpcbiAqIHRoZSAzcmQgYXJndW1lbnQgdG8gZ2V0Q21kQXJncygpIGlzIGEgaGFzaCBvZiBwb3NzaWJsZSBvcHRpb25zOlxuICogICAgZG9TZXRMb2dnZXIgLSBkZWZhdWx0cyB0byB0cnVlIC0gaWYgZmFsc2UsIHRoZW4gb3B0aW9uc1xuICogICAgICAgICAgICAgICAgICAtUCwgLUQsIC1RLCAtSSBhbmQgLVMgbm8gbG9uZ2VyIHNldCBsb2dnaW5nIG9wdGlvbnNcbiAqICAgICAgICAgICAgICAgICAgYW5kIG1heSB0aGVyZWZvcmUgYmUgdXNlZCBmb3Igb3RoZXIgcHVycG9zZXNcbiAqXG4gKiBCeSBkZWZhdWx0LCB0aGUgZm9sbG93aW5nIGZsYWdzIGFyZSByZWNvZ25pemVkLCBhbmQgdGhlcmVmb3JlXG4gKiBjYW5ub3QgYmUgaW5jbHVkZWQgaW4gaERlc2MgKHRoaXMgYmVoYXZpb3IgY2FuIGJlXG4gKiBkaXNhYmxlZCBieSBzZXR0aW5nIGhPcHRpb25zLmRvU2V0TG9nZ2VyIHRvIGZhbHNlKTpcbiAqXG4gKiBgLVBgIC0gc2V0IHRoZSBjdXJyZW50IGxvZyBsZXZlbCB0byAncHJvZmlsZSdcbiAqIGAtRGAgLSBzZXQgdGhlIGN1cnJlbnQgbG9nIGxldmVsIHRvICdkZWJ1ZydcbiAqIGAtUWAgLSBzZXQgdGhlIGN1cnJlbnQgbG9nIGxldmVsIHRvICd3YXJuJ1xuICogYC1JYCAtIHNldCB0aGUgY3VycmVudCBsb2cgbGV2ZWwgdG8gJ2luZm8nXG4gKiBgLVNgIC0gc2V0IHRoZSBjdXJyZW50IGxvZyBsZXZlbCB0byAnc2lsZW50J1xuICpcbiAqIChzZWUgbGlicmFyeSBAamRlaWdoYW4vbG9nZ2VyKVxuICovXG5cbmV4cG9ydCBnZXRDbWRBcmdzIDo9IChcblx0aERlc2M6IGhhc2g/ID0gdW5kZWYsXG5cdGxBcmdzOiBzdHJpbmdbXSA9IERlbm8uYXJncyxcblx0aE9wdGlvbnM6IG9wdGlvbnNwZWMgPSB7fVxuXHQpOiBoYXNoID0+XG5cblx0aWYgbm90ZGVmaW5lZChoRGVzYylcblx0XHRwYXNzKClcblx0ZWxzZVxuXHRcdGFzc2VydCBpc0hhc2goaERlc2MpLCBcIkJhZCBoRGVzYzogI3tPTChoRGVzYyl9XCJcblx0YXNzZXJ0IGlzQXJyYXlPZlN0cmluZ3MobEFyZ3MpLCBcIkJhZCBsQXJnczogI3tPTChsQXJncyl9XCJcblxuXHRpZiAobEFyZ3MubGVuZ3RoID09IDEpICYmIChsQXJnc1swXSA9PSAnLWgnKVxuXHRpZiAoKGxBcmdzLmxlbmd0aCA9PSAxKVxuXHRcdFx0JiYgWyctaCcsJy0taCcsJy1oZWxwJywnLS1oZWxwJ10uaW5jbHVkZXMobEFyZ3NbMF0pXG5cdFx0XHQpXG5cdFx0aWYgbm90ZGVmaW5lZChoRGVzYylcblx0XHRcdExPRyBcIk5vIGhlbHAgYXZhaWxhYmxlXCJcblx0XHRlbHNlXG5cdFx0XHRzaG93SGVscChoRGVzYylcblx0XHREZW5vLmV4aXQoKVxuXG5cdCMgLS0tIEN1cnJlbnRseSwgdGhlcmUgaXMgb25seSBvbmUgcG9zc2libGUgb3B0aW9uXG5cdHtkb1NldExvZ2dlcn0gOj0gZ2V0T3B0aW9ucyBoT3B0aW9ucywge1xuXHRcdGRvU2V0TG9nZ2VyOiB0cnVlXG5cdFx0fVxuXG5cdGlmIGRvU2V0TG9nZ2VyXG5cdFx0aWYgbm90ZGVmaW5lZChoRGVzYylcblx0XHRcdHBhc3MoKVxuXHRcdGVsc2Vcblx0XHRcdGZvciBrZXkgb2Yga2V5cyhoS2V5VG9Mb2dnZXIpXG5cdFx0XHRcdGFzc2VydCBub3RkZWZpbmVkKGhEZXNjW2tleV0pLFxuXHRcdFx0XHRcdFx0XCJpbnZhbGlkIGtleSAje09MKGtleSl9IHNldCBpbiBoRGVzY1wiXG5cdFx0c2V0TG9nZ2VyRnJvbUFyZ3MobEFyZ3MpXG5cblx0aFJlc3VsdDogaGFzaCA6PSB7IF86IFtdIH1cblxuXHQjIC0tLSBVdGlsaXR5IGZ1bmN0aW9uc1xuXG5cdCMgLS0tIEV2ZW4gZ2V0cyBjYWxsZWQgZm9yIC1ELCAtUSwgLVAsIC1TXG5cdGFkZE9wdGlvbiA6PSAobmFtZTogc3RyaW5nLCB2YWx1ZTogYW55KSA9PlxuXHRcdERCRyBcImFkZE9wdGlvbigje09MKG5hbWUpfSwgI3tPTCh2YWx1ZSl9KVwiXG5cdFx0YXNzZXJ0IGlzU3RyaW5nKG5hbWUpLCBcIk5vdCBhIHN0cmluZzogI3tPTChuYW1lKX1cIlxuXHRcdGFzc2VydCBub3QgaGFzS2V5KGhSZXN1bHQsIG5hbWUpLFxuXHRcdFx0XHRcImR1cCBrZXkgI3tuYW1lfSwgaFJlc3VsdCA9ICN7T0woaFJlc3VsdCl9XCJcblxuXHRcdGlmIGRvU2V0TG9nZ2VyXG5cdFx0XHRsb2dnZXIgOj0gaEtleVRvTG9nZ2VyW25hbWVdXG5cdFx0XHRpZiBkZWZpbmVkKGxvZ2dlcilcblx0XHRcdFx0aFJlc3VsdFtuYW1lXSA9IHRydWVcblx0XHRcdFx0c2V0TG9nTGV2ZWwgbG9nZ2VyXG5cdFx0XHRcdHJldHVyblxuXG5cdFx0aWYgbm90ZGVmaW5lZChoRGVzYylcblx0XHRcdGhSZXN1bHRbbmFtZV0gPSB2YWx1ZVxuXHRcdFx0cmV0dXJuXG5cdFx0e3R5cGV9IDo9IGdldE9wdGlvbkluZm8oaERlc2MsIG5hbWUpXG5cblx0XHQjIC0tLSB0eXBlIGNoZWNraW5nXG5cdFx0aWYgaXNBcnJheSh0eXBlKVxuXHRcdFx0YXNzZXJ0IHR5cGUuaW5jbHVkZXModmFsdWUpLCBcInR5cGUgbm90IGFuIGFycmF5XCJcblx0XHRcdGhSZXN1bHRbbmFtZV0gPSB2YWx1ZVxuXHRcdGVsc2Vcblx0XHRcdHN3aXRjaCB0eXBlXG5cdFx0XHRcdHdoZW4gJ3N0cmluZydcblx0XHRcdFx0XHRoUmVzdWx0W25hbWVdID0gdmFsdWVcblx0XHRcdFx0d2hlbiAnYm9vbGVhbidcblx0XHRcdFx0XHRoUmVzdWx0W25hbWVdID0gKFxuXHRcdFx0XHRcdFx0ICAodmFsdWUgPT0gJ3RydWUnKSAgPyB0cnVlXG5cdFx0XHRcdFx0XHQ6ICh2YWx1ZSA9PSAnZmFsc2UnKSA/IGZhbHNlXG5cdFx0XHRcdFx0XHQ6ICAgICAgICAgICAgICAgICAgICAgIHZhbHVlXG5cdFx0XHRcdFx0XHQpXG5cdFx0XHRcdHdoZW4gJ251bWJlcicsJ2Zsb2F0J1xuXHRcdFx0XHRcdGhSZXN1bHRbbmFtZV0gPSBwYXJzZUZsb2F0KHZhbHVlKVxuXHRcdFx0XHR3aGVuICdpbnRlZ2VyJ1xuXHRcdFx0XHRcdGhSZXN1bHRbbmFtZV0gPSBwYXJzZUludCh2YWx1ZSlcblx0XHRyZXR1cm5cblxuXHRhZGROb25PcHRpb24gOj0gKHN0cjogc3RyaW5nKSA9PlxuXHRcdERCRyBcImFkZE5vbk9wdGlvbigje09MKHN0cil9KVwiXG5cdFx0aFJlc3VsdC5fLnB1c2ggc3RyXG5cblx0Zm9yIHN0ciBvZiBsQXJnc1xuXHRcdCMgLS0tIGlnbm9yZSAnLS0nXG5cdFx0aWYgKHN0ciA9PSAnLS0nKVxuXHRcdFx0REJHIFwic2tpcHBpbmcgLS1cIlxuXHRcdFx0Y29udGludWVcblxuXHRcdCMgLS0tIGNoZWNrIGlmIGl0J3MgYW4gb3B0aW9uXG5cdFx0bE1hdGNoZXMgOj0gc3RyLm1hdGNoKC8vL15cblx0XHRcdC1cblx0XHRcdChbQS1aYS16MC05Xy1dKilcblx0XHRcdCg/OlxuXHRcdFx0XHQoPSlcblx0XHRcdFx0KC4qKVxuXHRcdFx0XHQpP1xuXHRcdFx0JC8vLylcblx0XHRpZiAobE1hdGNoZXMgPT0gbnVsbClcblx0XHRcdCMgLS0tIGl0J3MgYSBub24tb3B0aW9uXG5cdFx0XHRhZGROb25PcHRpb24gc3RyXG5cdFx0ZWxzZVxuXHRcdFx0IyAtLS0gaXQncyBhbiBvcHRpb25cblx0XHRcdFtfLCBvcHRTdHIsIGVxU3RyLCB2YWx1ZV0gOj0gbE1hdGNoZXNcblx0XHRcdGlmIGVxU3RyXG5cdFx0XHRcdGFkZE9wdGlvbiBvcHRTdHIsIHZhbHVlXG5cdFx0XHRlbHNlXG5cdFx0XHRcdGZvciBjaCBvZiBvcHRTdHIuc3BsaXQoJycpXG5cdFx0XHRcdFx0YWRkT3B0aW9uIGNoLCB0cnVlXG5cblx0IyAtLS0gaWYgaERlc2MgaXMgc2V0LCB0aGVuXG5cdCMgICAgIEZpbGwgaW4gZGVmYXVsdCB2YWx1ZXMgaWYgYXZhaWxhYmxlXG5cblx0aWYgbm90ZGVmaW5lZChoRGVzYylcblx0XHRwYXNzKClcblx0ZWxzZVxuXHRcdGZvciBuYW1lIG9mIGtleXMoaERlc2MsICdleGNlcHQ9XycpXG5cdFx0XHRpZiBub3RkZWZpbmVkKGhSZXN1bHRbbmFtZV0pXG5cdFx0XHRcdHtkZWZhdWx0VmFsfSA6PSBnZXRPcHRpb25JbmZvKGhEZXNjLCBuYW1lKVxuXHRcdFx0XHRpZiBkZWZpbmVkKGRlZmF1bHRWYWwpXG5cdFx0XHRcdFx0aFJlc3VsdFtuYW1lXSA9IGRlZmF1bHRWYWxcblxuXHRcdCMgLS0tIENoZWNrIG9mIHRoZXJlJ3MgYSByZXN0cmljdGlvbiBvbiB0aGUgbnVtYmVyIG9mIG5vbi1vcHRpb25zXG5cblx0XHRpZiBoYXNLZXkoaERlc2MsICdfJylcblx0XHRcdGhJbmZvIDo9IGdldE5vbk9wdGlvbkluZm8oaERlc2MpXG5cdFx0XHRpZiAoaEluZm8gIT0gdW5kZWYpXG5cdFx0XHRcdHtyYW5nZX0gOj0gaEluZm9cblx0XHRcdFx0W21pbiwgbWF4XSA6PSByYW5nZVxuXHRcdFx0XHRsZW4gOj0gaFJlc3VsdC5fLmxlbmd0aFxuXHRcdFx0XHRhc3NlcnQgKGxlbiA+PSBtaW4pLCBcIiN7bGVufSBub24tb3B0aW9ucyA8IG1pbiAoI3ttaW59KVwiXG5cdFx0XHRcdGFzc2VydCAobGVuIDw9IG1heCksIFwiI3tsZW59IG5vbi1vcHRpb25zID4gbWF4ICgje21heH0pXCJcblxuXHREQkcgXCJoUmVzdWx0ID0gI3tPTChoUmVzdWx0KX1cIlxuXHRyZXR1cm4gaFJlc3VsdFxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG5leHBvcnQgZ2V0T3B0aW9uSW5mbyA6PSAoaERlc2M6IGhhc2gsIG5hbWU6IHN0cmluZyk6IGhhc2ggPT5cblxuXHQjIC0tLSBSZXR1cm4gdmFsdWUgaXMgYSBoYXNoIHdpdGgga2V5czogdHlwZSwgZGVzY1xuXG5cdGFzc2VydCBkZWZpbmVkKGhEZXNjKSwgXCJoRGVzYyBpcyBub3QgZGVmaW5lZCBpbiBnZXRPcHRpb25JbmZvKClcIlxuXHRhc3NlcnQgaXNIYXNoKGhEZXNjKSwgXCJoRGVzYyBpcyBub3QgYSBoYXNoIGluIGdldE9wdGlvbkluZm8oKTogI3tPTChoRGVzYyl9XCJcblx0YXNzZXJ0IChuYW1lICE9ICdfJyksIFwiZ2V0T3B0aW9uSW5mbyhoRGVzYywgJ18nKSBjYWxsZWRcIlxuXHRhc3NlcnQgaGFzS2V5KGhEZXNjLCBuYW1lKSwgXCJObyBzdWNoIG9wdGlvbjogLSN7bmFtZX1cIlxuXHRoIDo9IGlzSGFzaChoRGVzY1tuYW1lXSkgPyBoRGVzY1tuYW1lXSA6IHtkZXNjOiBoRGVzY1tuYW1lXX1cblx0aWYgbm90ZGVmaW5lZChoLnR5cGUpXG5cdFx0aC50eXBlID0gKG5hbWUubGVuZ3RoID09IDEpID8gJ2Jvb2xlYW4nIDogJ3N0cmluZydcblx0aWYgbm90ZGVmaW5lZChoLmRlc2MpXG5cdFx0aC5kZXNjID0gJzxubyBkZXNjcmlwdGlvbiBhdmFpbGFibGU+J1xuXHRpZiBub3QgaGFzS2V5KGgsICdkZWZhdWx0VmFsJykgJiYgKGgudHlwZSA9PSAnYm9vbGVhbicpXG5cdFx0aC5kZWZhdWx0VmFsID0gZmFsc2Vcblx0cmV0dXJuIGhcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiMgLS0tIHJldHVybnMgdW5kZWYgaWYgbm8gJ18nIGtleSBpbiBoRGVzY1xuXG50eXBlIHJhbmdlVHlwZSA9IFtudW1iZXIsIG51bWJlcl1cblxudHlwZSBub25PcHRpb25JbmZvID0ge1xuXHR0eXBlOiAnYXJyYXknXG5cdGRlc2M6IHN0cmluZ1xuXHRyYW5nZTogcmFuZ2VUeXBlXG5cdH1cblxuZXhwb3J0IGdldE5vbk9wdGlvbkluZm8gOj0gKGhEZXNjOiBoYXNoKTogbm9uT3B0aW9uSW5mbz8gPT5cblxuXHQjIC0tLSBSZXR1cm4gdmFsdWUgaXMgYSBoYXNoIHdpdGgga2V5czpcblx0IyAgICAgICAgdHlwZSA9ICdhcnJheSdcblx0IyAgICAgICAgZGVzY1xuXHQjICAgICAgICByYW5nZSBhcyBbbWluLCBtYXhdXG5cblx0YXNzZXJ0IGRlZmluZWQoaERlc2MpLCBcImhEZXNjIGlzIG5vdCBkZWZpbmVkIGluIGdldE5vbk9wdGlvbkluZm8oKVwiXG5cdGlmIG5vdCBoYXNLZXkoaERlc2MsICdfJylcblx0XHRyZXR1cm4gdW5kZWZcblx0ZGVzYyA6PSBoRGVzYy5kZXNjIHx8ICc8bm8gZGVzY3JpcHRpb24gYXZhaWxhYmxlPidcblx0bGV0IHJhbmdlOiByYW5nZVR5cGUgPSBbMCwgSW5maW5pdHldXG5cdGlmIGhhc0tleShoRGVzYywgJ3JhbmdlJylcblx0XHRyIDo9IGhEZXNjLnJhbmdlXG5cdFx0aWYgaXNJbnRlZ2VyKHIpXG5cdFx0XHRyYW5nZSA9IFtyLCByXVxuXHRcdGVsc2UgaWYgQXJyYXkuaXNBcnJheShyKVxuXHRcdFx0YXNzZXJ0IChyLmxlbmd0aCA9PSAyKSwgXCJCYWQgJ18nIGtleTogI3tPTChyKX1cIlxuXHRcdFx0W21pbiwgbWF4XSA6PSByXG5cdFx0XHRhc3NlcnQgaXNJbnRlZ2VyKG1pbiksIFwicmFuZ2UgbWluIG5vdCBhbiBpbnRlZ2VyXCJcblx0XHRcdGlmIChtYXggPT0gJ2luZicpXG5cdFx0XHRcdFttaW4sIEluZmluaXR5XVxuXHRcdFx0ZWxzZVxuXHRcdFx0XHRhc3NlcnQgaXNJbnRlZ2VyKG1heCksIFwicmFuZ2UgbWF4IG5vdCBhbiBpbnRlZ2VyXCJcblx0XHRcdFx0W21pbiwgbWF4XVxuXHRcdGVsc2Vcblx0XHRcdHRocm93IG5ldyBFcnJvciBcIkludmFsaWQgcmFuZ2U6ICN7T0wocil9XCJcblxuXHRyZXR1cm4ge1xuXHRcdHR5cGU6ICdhcnJheSdcblx0XHRkZXNjXG5cdFx0cmFuZ2Vcblx0XHR9XG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbmV4cG9ydCBzaG93SGVscCA6PSAoaERlc2M6IGhhc2gpOiB2b2lkID0+XG5cblx0TE9HIFwiQXZhaWxhYmxlIG9wdGlvbnM6XCJcblx0Zm9yIG5hbWUgb2Yga2V5cyhoRGVzYywgJ2V4Y2VwdD1fJylcblx0XHR7dHlwZSwgZGVzY30gOj0gZ2V0T3B0aW9uSW5mbyhoRGVzYywgbmFtZSlcblx0XHRMT0cgXCIgICAtI3tuYW1lfTogI3t0eXBlfSAtICN7ZGVzY31cIlxuXHRpZiBkZWZpbmVkKGhEZXNjLl8pXG5cdFx0TE9HIFwiQXZhaWxhYmxlIG5vbi1vcHRpb25zOlwiXG5cdFx0aWYgaXNIYXNoKGhEZXNjLl8pXG5cdFx0XHR7cmFuZ2UsIGRlc2N9IDo9IGhEZXNjLl9cblx0XHRcdGlmIGRlZmluZWQocmFuZ2UpXG5cdFx0XHRcdGlmIGlzSW50ZWdlcihyYW5nZSlcblx0XHRcdFx0XHRMT0cgXCIgICBUaGVyZSBtdXN0IGJlIGV4YWN0bHkgI3tyYW5nZX0gbm9uLW9wdGlvbnNcIlxuXHRcdFx0XHRlbHNlIGlmIGlzQXJyYXkocmFuZ2UpXG5cdFx0XHRcdFx0W21pbiwgbWF4XSA6PSByYW5nZVxuXHRcdFx0XHRcdGlmIChtaW4gPiAwKVxuXHRcdFx0XHRcdFx0TE9HIFwiICAgVGhlcmUgbXVzdCBiZSBhdCBsZWFzdCAje21pbn0gbm9uLW9wdGlvbnNcIlxuXHRcdFx0XHRcdGlmIChtYXggIT0gJ2luZicpXG5cdFx0XHRcdFx0XHRMT0cgXCIgICBUaGVyZSBtdXN0IGJlIGF0IG1vc3QgI3ttYXh9IG5vbi1vcHRpb25zXCJcblx0XHRkZXNjIDo9IChcblx0XHRcdCAgaXNTdHJpbmcoaERlc2MuXykgPyBoRGVzYy5fXG5cdFx0XHQ6IGlzSGFzaChoRGVzYy5fKSA/IChoRGVzYy5fLmRlc2MgfHwgJzxubyBkZXNjcmlwdGlvbiBhdmFpbGFibGU+Jylcblx0XHRcdDogY3JvYWsgXCJCYWQgZGVzY3JpcHRvciBmb3Igbm9uLW9wdGlvbnM6ICN7T0woaERlc2MuXyl9XCJcblx0XHRcdClcblx0XHRMT0cgZGVzY1xuXHRyZXR1cm5cblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuZXhwb3J0IHNldERpciA6PSAoYmxvY2s6IHN0cmluZyk6IHZvaWQgPT5cblxuXHRjb25zb2xlLmxvZyBcIldvcmtpbmcgb24gaXRcIlxuIl19