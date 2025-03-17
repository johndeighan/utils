/**
 * utils - utility functions
 * @module
 */

// utils.civet

"use strict";
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

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3JjL2xpYi91dGlscy5jaXZldC50c3giLCJzb3VyY2VzIjpbInNyYy9saWIvdXRpbHMuY2l2ZXQiXSwibWFwcGluZ3MiOiJBQUFBO0FBQ0E7QUFDQTtBQUNBLEdBQUc7QUFDSCxBQUFBO0FBQ0EsQUFBQSxjQUFhO0FBQ2IsQUFBQTtBQUNBO0FBQUEsTUFBTSxDQUFDLENBQUM7QUFDUixDQUFDLEtBQUssQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLFVBQVUsQ0FBQztBQUM1QixDQUFDLFFBQVEsQ0FBQyxDQUFDLGdCQUFnQixDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsU0FBUyxDQUFDO0FBQzVELENBQUMsT0FBTyxDQUFDLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxRQUFRLENBQUM7QUFDdkQsQ0FBQyxPQUFPLENBQUMsQ0FBQyxRQUFRLENBQUM7QUFDbkIsQ0FBQyxJQUFJLENBQUMsQ0FBQyxVQUFVLENBQUM7QUFDbEIsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLGdCQUFnQjtBQUN4QixBQUFBLEFBQUEsTUFBTSxDQUFDLENBQUM7QUFDUixDQUFDLElBQUksQ0FBQyxDQUFDLFlBQVksQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLFdBQVcsQ0FBQztBQUNwRSxDQUFDLFNBQVMsQ0FBQyxDQUFDLGVBQWUsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLEtBQUssQ0FBQztBQUMxRCxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLFVBQVUsQ0FBQztBQUNqQyxDQUFDLFlBQVksQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLFlBQVksQ0FBQyxDQUFDLE9BQU8sQ0FBQztBQUM5QyxDQUFDLFNB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QUFFLEtBQUssQ0FBQyxDQUFDO0FBQ1QsQUFBQSxFQUFFLENBQUMsQyxDQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDO0NBQUMsQ0FBQTtBQUNYLEFBQUEsQ0FBQyxNO0FBQU0sQ0FBQTtBQUNQLEFBQUE7QUFDQSxBQUFBLDhFQUE2RTtBQUM3RSxBQUFBO0FBQ0EsQUFBQTtBQUNBO0FBQ0E7QUFDQSxHQUFHO0FBQ0gsQUFBQTtBQUNBLEFBQUEsQUFBQSxNQUFNLENBQWEsTUFBWixZQUFZLENBQUMsQ0FBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFBLENBQUE7QUFDMUMsQUFBQTtBQUNBLEFBQUEsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxDO0FBQUMsQ0FBQTtBQUNoRCxBQUFBO0FBQ0EsQUFBQSw4RUFBNkU7QUFDN0UsQUFBQTtBQUNBLEFBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQSxHQUFHO0FBQ0gsQUFBQTtBQUNBLEFBQUEsQUFBQSxNQUFNLENBQUMsSUFBQSxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFBLENBQUE7QUFDeEQsQUFBQTtBQUNBLEFBQUEsQ0FBTSxNQUFMLEtBQUssQ0FBQyxDQUFFLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsTUFBTTtBQUMxQixBQUFBLENBQUMsTUFBTSxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDO0FBQUMsQ0FBQTtBQUMvQixBQUFBO0FBQ0EsQUFBQSw4RUFBNkU7QUFDN0UsQUFBQTtBQUNBLEFBQUE7QUFDQTtBQUNBO0FBQ0EsR0FBRztBQUNILEFBQUE7QUFDQSxBQUFBLEFBQUEsTUFBTSxDQUFLLE1BQUosSUFBSSxDQUFDLENBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUEsQ0FBQTtBQUNwRSxBQUFBO0FBQ0EsQUFBQSxDQUFDLE1BQU0sQ0FBQSxBQUFDLENBQUMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxHQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxZQUFZLENBQUE7QUFDdEMsQUFBQSxDQUFNLE1BQUwsS0FBSyxDQUFDLENBQUUsQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBRyxDQUFDO0FBQzdCLEFBQUEsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsTUFBTSxDQUFDLEtBQUssQztBQUFDLENBQUE7QUFDOUIsQUFBQTtBQUNBLEFBQUEsOEVBQTZFO0FBQzdFLEFBQUE7QUFDQSxBQUFBO0FBQ0E7QUFDQTtBQUNBLEdBQUc7QUFDSCxBQUFBO0FBQ0EsQUFBQSxBQUFBLE1BQU0sQ0FBSyxNQUFKLElBQUksQ0FBQyxDQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFBLENBQUE7QUFDcEUsQUFBQTtBQUNBLEFBQUEsQ0FBQyxNQUFNLENBQUEsQUFBQyxDQUFDLEVBQUUsQ0FBQyxNQUFNLENBQUMsR0FBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsWUFBWSxDQUFBO0FBQ3RDLEFBQUEsQ0FBTSxNQUFMLEtBQUssQ0FBQyxDQUFFLENBQUMsU0FBUyxD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QUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxHQUFHO0FBQ0gsQUFBQTtBQUNBLEFBQUEsQUFBQSxNQUFNLENBQVcsTUFBVixVQUFVLENBQUMsQ0FBRSxDQUFDLENBQUM7QUFDdEIsQUFBQSxDQUFDLEtBQUssQyxDLENBQUMsQUFBQyxJLFksQ0FBSyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUM7QUFDdEIsQUFBQSxDQUFDLEtBQUssQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUM7QUFDN0IsQUFBQSxDQUFDLFFBQVEsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQzFCLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQSxDQUFBO0FBQ1gsQUFBQTtBQUNBLEFBQUEsQ0FBQyxHQUFHLENBQUEsVUFBVSxDQUFDLEtBQUssQ0FBQyxDQUFBLENBQUEsQ0FBQTtBQUNyQixBQUFBLEVBQUUsSUFBSSxDQUFDLEM7Q0FBQyxDQUFBO0FBQ1IsQUFBQSxDQUFDLElBQUksQ0FBQSxDQUFBO0FBQ0wsQUFBQSxFQUFFLE1BQU0sQ0FBQSxBQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsV0FBVyxFQUFFLEVBQUUsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEM7Q0FBQSxDQUFBO0FBQ2pELEFBQUEsQ0FBQyxNQUFNLENBQUEsQUFBQyxnQkFBZ0IsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsV0FBVyxFQUFFLEVBQUUsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDMUQsQUFBQTtBQUNBLEFBQUEsQ0FBQyxHQUFHLENBQUEsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLEdBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMs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QUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUEsQ0FBQTtBQUM1RCxBQUFBO0FBQ0EsQUFBQSxDQUFDLG1EQUFrRDtBQUNuRCxBQUFBO0FBQ0EsQUFBQSxDQUFDLE1BQU0sQ0FBQSxBQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLHlDQUF5QyxDQUFBO0FBQ2pFLEFBQUEsQ0FBQyxNQUFNLENBQUEsQUFBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLHdDQUF3QyxFQUFFLEVBQUUsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDN0UsQUFBQSxDQUFDLE1BQU0sQ0FBQSxBQUFDLENBQUMsSUFBSSxDQUFDLEdBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLGtDQUFrQyxDQUFBO0FBQ3pELEFBQUEsQ0FBQyxNQUFNLENBQUEsQUFBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLGlCQUFpQixFQUFFLElBQUksQ0FBQyxDQUFDLENBQUE7QUFDdkQsQUFBQSxDQUFFLE1BQUQsQ0FBQyxDQUFDLENBQUUsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDN0QsQUFBQSxDQUFDLEdBQUcsQ0FBQSxVQUFVLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFBLENBQUEsQ0FBQTtBQUN0QixBQUFBLEVBQUUsQ0FBQyxDQUFDLElBQUksQyxDQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxRO0NBQVEsQ0FBQTtBQUNwRCxBQUFBLENBQUMsR0FB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Q3pDLEFBQUE7QUFDQSxBQUFBLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQSxBQUFDLGVBQWUsQztBQUFBLENBQUE7QUFDNUIiLCJuYW1lcyI6W10sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogdXRpbHMgLSB1dGlsaXR5IGZ1bmN0aW9uc1xuICogQG1vZHVsZVxuICovXG5cbiMgdXRpbHMuY2l2ZXRcblxuaW1wb3J0IHtcblx0dW5kZWYsIGRlZmluZWQsIG5vdGRlZmluZWQsXG5cdGlzU3RyaW5nLCBpc05vbkVtcHR5U3RyaW5nLCBpc0Jvb2xlYW4sIGlzTnVtYmVyLCBpc0ludGVnZXIsXG5cdGlzQXJyYXksIGlzQXJyYXlPZlN0cmluZ3MsIGlzSGFzaCwgaXNPYmplY3QsIGlzUmVnRXhwLFxuXHRpc0VtcHR5LCBub25FbXB0eSxcblx0aGFzaCwgb3B0aW9uc3BlYyxcblx0fSBmcm9tICcuL2RhdGF0eXBlcy50cydcbmltcG9ydCB7XG5cdHBhc3MsIGRlZXBseUVxdWFscywgT0wsIE1MLCBnZXRPcHRpb25zLCBjcm9haywgYXNzZXJ0LCB0aHJvd3NFcnJvcixcblx0c3RyVG9IYXNoLCByZW1vdmVFbXB0eUtleXMsIGtleXMsIGhhc0tleSwgaGFzS2V5cywgbWVyZ2UsXG5cdHNwYWNlcywgdGFicywgcnRyaW0sIGNvdW50Q2hhcnMsXG5cdGJsb2NrVG9BcnJheSwgdG9BcnJheSwgYXJyYXlUb0Jsb2NrLCB0b0Jsb2NrLFxuXHRlc2NhcGVTdHIsIGVzY2FwZUJsb2NrLFxuXHR9IGZyb20gJy4vbGx1dGlscy50cydcbmltcG9ydCB7XG5cdGlzRmlsZSwgaXNEaXIsIGZpbGVFeHQsIHdpdGhFeHQsXG5cdHJtRmlsZSwgZ2V0UGF0aFR5cGUsIGdldFN0YXRzLCBwYXJzZVBhdGgsXG5cdGFsbEZpbGVzTWF0Y2hpbmcsIGFsbExpbmVzSW4sIHdhdGNoRmlsZSwgd2F0Y2hGaWxlcyxcblx0bm9ybWFsaXplUGF0aCwgbWtwYXRoLCByZWxwYXRoLCBuZXdlckRlc3RGaWxlRXhpc3RzLFxuXHRwYXRoU3ViRGlycywgY2xlYXJEaXIsIG1rRGlyLCBta0RpcnNGb3JGaWxlLFxuXHRzbHVycCwgYmFyZiwgbXlzZWxmLCByZW1vdmVGaWxlc01hdGNoaW5nLFxuXHR9IGZyb20gJy4vZnMudHMnXG5pbXBvcnQge1xuXHRMb2dnZXJFeCwgbG9nZ2VyLCBzZXRMb2dMZXZlbCwgcHVzaExvZ0xldmVsLCBwb3BMb2dMZXZlbCxcblx0Y3VyTG9nTGV2ZWwsIGNsZWFyTG9nLCBnZXRMb2csIGdldEZ1bGxMb2csXG5cdElOREVOVCwgVU5ERU5ULCBDTEVBUixcblx0REJHLCBMT0csIFdBUk4sIEVSUixcblx0fSBmcm9tICcuL2xvZ2dlci50cydcbmltcG9ydCB7XG5cdG9uZUluZGVudCwgcmVzZXRPbmVJbmRlbnQsIGluZGVudExldmVsLCBzcGxpdExpbmUsXG5cdGluZGVudGVkLCB1bmRlbnRlZCxcblx0fSBmcm9tICcuL2luZGVudC50cydcbmltcG9ydCB7XG5cdGV4ZWNDbWQsIGV4ZWNDbWRTeW5jLCBjbWRTdWNjZWVkcyxcblx0ZXhlY0NtZFJlc3VsdCwgbWtzdHIsIGdldENtZExpbmUsIGdldFByb2NPcHQsIGdldEZpbmFsUmVzdWx0LFxuXHR9IGZyb20gJy4vZXhlYy11dGlscy50cydcbmltcG9ydCB7XG5cdGhDb21waWxlckNvbmZpZywgZmluZFNvdXJjZUZpbGUsIGNvbXBpbGVGaWxlLCBpc0RpclNwZWMsXG5cdGNvbXBpbGVSZXN1bHQsXG5cdH0gZnJvbSAnLi9jb21waWxlLWNvbmZpZy50cydcblxuZXhwb3J0IHtcblx0dW5kZWYsIGRlZmluZWQsIG5vdGRlZmluZWQsIHBhc3MsIGRlZXBseUVxdWFscyxcblx0TG9nZ2VyRXgsIGxvZ2dlciwgc2V0TG9nTGV2ZWwsIHB1c2hMb2dMZXZlbCwgcG9wTG9nTGV2ZWwsXG5cdGN1ckxvZ0xldmVsLCBjbGVhckxvZywgZ2V0TG9nLCBnZXRGdWxsTG9nLFxuXHRJTkRFTlQsIFVOREVOVCwgQ0xFQVIsXG5cdERCRywgTE9HLCBXQVJOLCBFUlIsXG5cdG9uZUluZGVudCwgcmVzZXRPbmVJbmRlbnQsIGluZGVudExldmVsLCBzcGxpdExpbmUsXG5cdGluZGVudGVkLCB1bmRlbnRlZCxcblx0T0wsIE1MLCBjcm9haywgYXNzZXJ0LCB0aHJvd3NFcnJvciwgZ2V0T3B0aW9ucyxcblx0cmVtb3ZlRW1wdHlLZXlzLCBrZXlzLCBoYXNLZXksIGhhc0tleXMsIG1lcmdlLFxuXHRzcGFjZXMsIHRhYnMsIHJ0cmltLCBjb3VudENoYXJzLFxuXHRibG9ja1RvQXJyYXksIHRvQXJyYXksIGFycmF5VG9CbG9jaywgdG9CbG9jayxcblx0ZXNjYXBlU3RyLCBlc2NhcGVCbG9jayxcblx0aXNTdHJpbmcsIGlzTm9uRW1wdHlTdHJpbmcsIGlzQm9vbGVhbiwgaXNOdW1iZXIsIGlzSW50ZWdlcixcblx0aXNBcnJheSwgaXNBcnJheU9mU3RyaW5ncywgaXNIYXNoLCBpc09iamVjdCwgaXNSZWdFeHAsXG5cdGlzRW1wdHksIG5vbkVtcHR5LFxuXHRpc0ZpbGUsIGlzRGlyLCBmaWxlRXh0LCB3aXRoRXh0LFxuXHRybUZpbGUsIGdldFBhdGhUeXBlLCBnZXRTdGF0cywgcGFyc2VQYXRoLFxuXHRhbGxGaWxlc01hdGNoaW5nLCBhbGxMaW5lc0luLCB3YXRjaEZpbGUsIHdhdGNoRmlsZXMsXG5cdG5vcm1hbGl6ZVBhdGgsIG1rcGF0aCwgcmVscGF0aCwgbmV3ZXJEZXN0RmlsZUV4aXN0cyxcblx0cGF0aFN1YkRpcnMsIGNsZWFyRGlyLCBta0RpciwgbWtEaXJzRm9yRmlsZSxcblx0c2x1cnAsIGJhcmYsIG15c2VsZiwgcmVtb3ZlRmlsZXNNYXRjaGluZyxcblx0Y29tcGlsZUZpbGUsIGV4ZWNDbWQsIGV4ZWNDbWRTeW5jLCBjbWRTdWNjZWVkcyxcblx0aXNEaXJTcGVjLFxuXHRta3N0ciwgZ2V0Q21kTGluZSwgZ2V0UHJvY09wdCwgZ2V0RmluYWxSZXN1bHQsXG5cdH1cbmV4cG9ydCB0eXBlIHtcblx0ZXhlY0NtZFJlc3VsdCwgY29tcGlsZVJlc3VsdCxcblx0fVxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKipcbiAqIFNwbGl0cyBhIHN0cmluZyBvbiB3aGl0ZXNwYWNlIGludG8gYW4gYXJyYXksXG4gKiBpZ25vcmluZyBhbnkgbGVhZGluZyBvciB0cmFpbGluZyB3aGl0ZXNwYWNlXG4gKi9cblxuZXhwb3J0IHdzU3BsaXQgOj0gKHN0cjogc3RyaW5nKTogc3RyaW5nW10gPT5cblxuXHRuZXdzdHIgOj0gc3RyLnRyaW0oKVxuXHRpZiAobmV3c3RyID09ICcnKVxuXHRcdHJldHVybiBbXVxuXHRlbHNlXG5cdFx0cmV0dXJuIG5ld3N0ci5zcGxpdCgvXFxzKy8pXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogc3BsaXRzIGVhY2ggc3RyaW5nIG9uIHdoaXRlc3BhY2UgaWdub3JpbmcgYW55IGxlYWRpbmdcbiAqIG9yIHRyYWlsaW5nIHdoaXRlc3BhY2UsIGFuZCByZXR1cm5zIGFuIGFycmF5IG9mXG4gKiBhbGwgc3Vic3RyaW5ncyBvYnRhaW5lZFxuICovXG5cbmV4cG9ydCB3b3JkcyA6PSAoLi4ubFN0cmluZ3M6IHN0cmluZ1tdKTogc3RyaW5nW10gPT5cblxuXHRsZXQgbFdvcmRzID0gW11cblx0Zm9yIHN0ciBvZiBsU3RyaW5nc1xuXHRcdGZvciB3b3JkIG9mIHdzU3BsaXQoc3RyKVxuXHRcdFx0bFdvcmRzLnB1c2ggd29yZFxuXHRyZXR1cm4gbFdvcmRzXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogQSBnZW5lcmF0b3IgdGhhdCB5aWVsZHMgaW50ZWdlcnMgc3RhcnRpbmcgd2l0aCAwIGFuZFxuICogY29udGludWluZyB0byBuLTFcbiAqL1xuXG5leHBvcnQgcmFuZ2UgOj0gKG46IG51bWJlcik6IEdlbmVyYXRvcjxudW1iZXIsIHZvaWQsIHVua25vd24+IC0+XG5cblx0bGV0IGkgPSAwXG5cdHdoaWxlIChpIDwgbilcblx0XHR5aWVsZCBpXG5cdFx0aSA9IGkgKyAxXG5cdHJldHVyblxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKipcbiAqIGNvbnZlcnRzIHggdG8gYSBzdHJpbmcsIHJlbW92aW5nIGFueSBjYXJyaWFnZSByZXR1cm5zXG4gKiBhbmQgcmVtb3ZpbmcgbGVhZGluZyBhbmQgdHJhaWxpbmcgd2hpdGVzcGFjZVxuICovXG5cbmV4cG9ydCBub3JtYWxpemVTdHIgOj0gKHg6IGFueSk6IHN0cmluZyA9PlxuXG5cdHJldHVybiB4LnRvU3RyaW5nKCkucmVwbGFjZUFsbCgnXFxyJywgJycpLnRyaW0oKVxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKipcbiAqIGNhbGN1bGF0ZXMgdGhlIG51bWJlciBvZiBleHRyYSBjaGFyYWN0ZXJzIG5lZWRlZCB0b1xuICogbWFrZSB0aGUgZ2l2ZW4gc3RyaW5nIGhhdmUgdGhlIGdpdmVuIGxlbmd0aC5cbiAqIElmIG5vdCBwb3NzaWJsZSwgcmV0dXJucyAwXG4gKi9cblxuZXhwb3J0IGdldE5FeHRyYSA9IChzdHI6IHN0cmluZywgbGVuOiBudW1iZXIpOiBudW1iZXIgPT5cblxuXHRleHRyYSA6PSBsZW4gLSBzdHIubGVuZ3RoXG5cdHJldHVybiAoZXh0cmEgPiAwKSA/IGV4dHJhIDogMFxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKipcbiAqIHBhZHMgdGhlIGdpdmVuIHN0cmluZyBvbiB0aGUgcmlnaHQgd2l0aFxuICogdGhlIGdpdmVuIGNoYXJhY3RlciwgdG8gdGhlIGdpdmVuIGxlbmd0aFxuICovXG5cbmV4cG9ydCBycGFkIDo9IChzdHI6IHN0cmluZywgbGVuOiBudW1iZXIsIGNoOiBzdHJpbmc9JyAnKTogc3RyaW5nID0+XG5cblx0YXNzZXJ0IChjaC5sZW5ndGggPT0gMSksIFwiTm90IGEgY2hhclwiXG5cdGV4dHJhIDo9IGdldE5FeHRyYShzdHIsIGxlbilcblx0cmV0dXJuIHN0ciArIGNoLnJlcGVhdChleHRyYSlcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuLyoqXG4gKiBwYWRzIHRoZSBnaXZlbiBzdHJpbmcgb24gdGhlIGxlZnQgd2l0aFxuICogdGhlIGdpdmVuIGNoYXJhY3RlciwgdG8gdGhlIGdpdmVuIGxlbmd0aFxuICovXG5cbmV4cG9ydCBscGFkIDo9IChzdHI6IHN0cmluZywgbGVuOiBudW1iZXIsIGNoOiBzdHJpbmc9JyAnKTogc3RyaW5nID0+XG5cblx0YXNzZXJ0IChjaC5sZW5ndGggPT0gMSksIFwiTm90IGEgY2hhclwiXG5cdGV4dHJhIDo9IGdldE5FeHRyYShzdHIsIGxlbilcblx0cmV0dXJuIGNoLnJlcGVhdChleHRyYSkgKyBzdHJcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiMgLS0tIHZhbGlkIG9wdGlvbnM6XG4jICAgICAgICBjaGFyIC0gY2hhciB0byB1c2Ugb24gbGVmdCBhbmQgcmlnaHRcbiMgICAgICAgIGJ1ZmZlciAtIG51bSBzcGFjZXMgYXJvdW5kIHRleHQgd2hlbiBjaGFyIDw+ICcgJ1xuXG4vKipcbiAqIHBhZHMgdGhlIGdpdmVuIHN0cmluZyBvbiBib3RoIHRoZSBsZWZ0IGFuZCByaWdodFxuICogd2l0aCB0aGUgZ2l2ZW4gY2hhcmFjdGVyLCB0byB0aGUgZ2l2ZW4gbGVuZ3RoXG4gKiBidXQgd2l0aCB0aGUgZ2l2ZW4gbnVtYmVyIG9mIGJ1ZmZlciBjaGFycyBzdXJyb3VuZGluZ1xuICogdGhlIHRleHRcbiAqL1xuXG5leHBvcnQgY2VudGVyZWQgOj0gKFxuXHR0ZXh0OiBzdHJpbmcsXG5cdHdpZHRoOiBudW1iZXIsXG5cdGNoYXI6IHN0cmluZyA9ICcgJyxcblx0bnVtQnVmZmVyOiBudW1iZXIgPSAyXG5cdCk6IHN0cmluZyA9PlxuXG5cdHRvdFNwYWNlcyA6PSB3aWR0aCAtIHRleHQubGVuZ3RoXG5cdGlmICh0b3RTcGFjZXMgPD0gMClcblx0XHRyZXR1cm4gdGV4dFxuXHRudW1MZWZ0IDo9IE1hdGguZmxvb3IodG90U3BhY2VzIC8gMilcblx0bnVtUmlnaHQgOj0gdG90U3BhY2VzIC0gbnVtTGVmdFxuXHRpZiAoY2hhciA9PSAnICcpXG5cdFx0cmV0dXJuIHNwYWNlcyhudW1MZWZ0KSArIHRleHQgKyBzcGFjZXMobnVtUmlnaHQpXG5cdGVsc2Vcblx0XHRidWYgOj0gJyAnLnJlcGVhdChudW1CdWZmZXIpXG5cdFx0bGVmdCA6PSBjaGFyLnJlcGVhdChudW1MZWZ0IC0gbnVtQnVmZmVyKVxuXHRcdHJpZ2h0IDo9IGNoYXIucmVwZWF0KG51bVJpZ2h0IC0gbnVtQnVmZmVyKVxuXHRcdHJldHVybiBsZWZ0ICsgYnVmICsgdGV4dCArIGJ1ZiArIHJpZ2h0XG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogcGFkIGEgc3RyaW5nIG9uIHRoZSBsZWZ0LCByaWdodCwgb3IgYm90aFxuICogdG8gdGhlIGdpdmVuIHdpZHRoXG4gKi9cblxuZXhwb3J0IGFsaWduU3RyaW5nIDo9IChcblx0c3RyOiBzdHJpbmcsXG5cdHdpZHRoOiBudW1iZXIsXG5cdGFsaWduOiBzdHJpbmdcblx0KTogc3RyaW5nIC0+XG5cblx0YXNzZXJ0IGlzU3RyaW5nKHN0ciksIFwic3RyIG5vdCBhIHN0cmluZzogI3tPTChzdHIpfVwiXG5cdGFzc2VydCBpc1N0cmluZyhhbGlnbiksIFwiYWxpZ24gbm90IGEgc3RyaW5nOiAje09MKGFsaWduKX1cIlxuXHRzd2l0Y2ggYWxpZ25cblx0XHR3aGVuICdsZWZ0JywgJ2wnXG5cdFx0XHRyZXR1cm4gcnBhZChzdHIsIHdpZHRoKVxuXHRcdHdoZW4gJ2NlbnRlcicsICdjJ1xuXHRcdFx0cmV0dXJuIGNlbnRlcmVkKHN0ciwgd2lkdGgpXG5cdFx0d2hlbiAncmlnaHQnLCAncidcblx0XHRcdHJldHVybiBscGFkKHN0ciwgd2lkdGgpXG5cdFx0ZWxzZVxuXHRcdFx0dGhyb3cgbmV3IEVycm9yIFwiVW5rbm93biBhbGlnbjogI3tPTChhbGlnbil9XCJcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuLyoqXG4gKiBjb252ZXJ0cyB0aGUgZ2l2ZW4gbnVtYmVyIHRvIGEgc3RyaW5nLCB0aGVuIHBhZHMgb24gdGhlIGxlZnRcbiAqIHdpdGggemVyb3MgdG8gYWNoaWV2ZSB0aGUgZ2l2ZW4gbGVuZ3RoXG4gKi9cblxuZXhwb3J0IHpwYWQgOj0gKG46IG51bWJlciwgbGVuOiBudW1iZXIpOiBzdHJpbmcgPT5cblxuXHRyZXR1cm4gbHBhZChuLnRvU3RyaW5nKCksIGxlbiwgJzAnKVxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKipcbiAqIFJlbW92ZSBsaW5lcyBmcm9tIGEgc3RyaW5nIG9yIGFycmF5XG4gKiBwYXQgY2FuIGJlIGEgc3RyaW5nIG9yIGEgcmVndWxhciBleHByZXNzaW9uXG4gKi9cblxuZXhwb3J0IHJlbW92ZUxpbmVzIDo9IChcblx0c3RyT3JBcnJheTogc3RyaW5nIHwgc3RyaW5nW10sXG5cdHBhdDogc3RyaW5nIHwgUmVnRXhwXG5cdCk6IHN0cmluZyB8IHN0cmluZ1tdID0+XG5cblx0YXNzZXJ0IGlzU3RyaW5nKHBhdCkgfHwgaXNSZWdFeHAocGF0KSwgIFwiQmFkIGFyZyAyOiAje09MKHBhdCl9XCJcblx0bExpbmVzIDo9IGlzU3RyaW5nKHN0ck9yQXJyYXkpID8gYmxvY2tUb0FycmF5KHN0ck9yQXJyYXkpIDogc3RyT3JBcnJheVxuXHRsTmV3TGluZXMgOj0gKFxuXHRcdGlmICh0eXBlb2YgcGF0ID09ICdzdHJpbmcnKVxuXHRcdFx0bExpbmVzLmZpbHRlcigobGluZSkgPT4gKGxpbmUgIT0gcGF0KSlcblx0XHRlbHNlXG5cdFx0XHRsTGluZXMuZmlsdGVyKChsaW5lKSA9PiAobGluZS5tYXRjaChwYXQpID09IG51bGwpKVxuXHRcdClcblx0aWYgaXNTdHJpbmcoc3RyT3JBcnJheSlcblx0XHRyZXR1cm4gbE5ld0xpbmVzLmpvaW4oJ1xcbicpXG5cdGVsc2Vcblx0XHRyZXR1cm4gbE5ld0xpbmVzXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbmV4cG9ydCBnZXRQYXR0ZXJuIDo9ICgpOiBzdHJpbmcgPT5cblxuXHRsS2V5cyA6PSBPYmplY3Qua2V5cyhoQ29tcGlsZXJDb25maWcuaENvbXBpbGVycylcblx0aWYgKGxLZXlzLmxlbmd0aCA9PSAxKVxuXHRcdHJldHVybiBcIioqLyoje2xLZXlzWzBdfVwiXG5cdGVsc2Vcblx0XHRyZXR1cm4gXCIqKi8qeyN7bEtleXMuam9pbignLCcpfX1cIlxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuIyAtLS0gQSBnZW5lcmF0b3IgLSB5aWVsZHMge3BhdGgsIHN0YXR1cywgb3V0UGF0aH1cblxuZXhwb3J0IGNvbXBpbGVBbGxGaWxlcyA6PSAoXG5cdHBhdHRlcm46IHN0cmluZz8gPSB1bmRlZixcblx0KTogR2VuZXJhdG9yPGNvbXBpbGVSZXN1bHQsIHZvaWQsIHVua25vd24+IC0+XG5cblx0aEdsb2JPcHRpb25zIDo9IHtcblx0XHRleGNsdWRlOiBbXG5cdFx0XHQnbm9kZV9tb2R1bGVzLyoqJ1xuXHRcdFx0Jy5naXQvKionXG5cdFx0XHQnKiovKi50ZW1wLionICAjIC0tLSBkb24ndCBjb21waWxlIHRlbXAgZmlsZXNcblx0XHRcdF1cblx0XHR9XG5cblx0Z2xvYlBhdHRlcm4gOj0gZGVmaW5lZChwYXR0ZXJuKSA/IHBhdHRlcm4gOiBnZXRQYXR0ZXJuKClcblx0REJHIFwiY29tcGlsaW5nIGFsbCBmaWxlcywgcGF0PSN7T0woZ2xvYlBhdHRlcm4pfVwiXG5cdGZvciB7cGF0aH0gb2YgYWxsRmlsZXNNYXRjaGluZyhnbG9iUGF0dGVybiwgaEdsb2JPcHRpb25zKVxuXHRcdGhSZXN1bHQgOj0gY29tcGlsZUZpbGUgcGF0aFxuXHRcdGlmIChoUmVzdWx0LnN0YXR1cyA9PSAnY29tcGlsZWQnKVxuXHRcdFx0eWllbGQgaFJlc3VsdFxuXHRyZXR1cm5cblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuZXhwb3J0IGVuc3VyZUNvbXBpbGVkIDo9IChcblx0ZGlyc3BlYzogc3RyaW5nLFxuXHRzdHViOiBzdHJpbmcsXG5cdHB1cnBvc2U6IHN0cmluZz8gPSB1bmRlZlxuXHQpOiBzdHJpbmc/ID0+XG5cblx0aCA6PSBmaW5kU291cmNlRmlsZSBkaXJzcGVjLCBzdHViLCBwdXJwb3NlXG5cdGlmIChoID09IHVuZGVmKSB8fCAoaC5wYXRoID09IHVuZGVmKSB8fCBub3QgaXNGaWxlKGgucGF0aClcblx0XHREQkcgXCJOb3QgY29tcGlsaW5nOiBubyBzdWNoIGZpbGU6ICN7ZGlyc3BlY30vI3tzdHVifS8je3B1cnBvc2V9XCJcblx0XHRyZXR1cm4gdW5kZWZcblx0ZWxzZVxuXHRcdHtzdGF0dXMsIG91dFBhdGh9IDo9IGNvbXBpbGVGaWxlIGgucGF0aFxuXHRcdGlmIChvdXRQYXRoID09IHVuZGVmKVxuXHRcdFx0V0FSTiBcIkNvbXBpbGUgb2YgbGliICN7aC5wYXRofSBmYWlsZWQgd2l0aCBzdGF0dXMgI3tzdGF0dXN9XCJcblx0XHRcdHJldHVybiB1bmRlZlxuXHRcdGVsc2Vcblx0XHRcdGFzc2VydCBpc0ZpbGUob3V0UGF0aCksXG5cdFx0XHRcdFx0XCJjb21waWxlRmlsZSgpIHN1Y2NlZWRlZCwgYnV0ICN7T0wob3V0UGF0aCl9IGRvZXMgbm90IGV4aXN0IVwiXG5cdFx0XHRyZXR1cm4gb3V0UGF0aFxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG50eXBlIHVuaXRUZXN0UmVzdWx0ID0ge1xuXHRzdHViOiBzdHJpbmdcblx0c3VjY2VzczogYm9vbGVhblxuXHRtc2c/OiBzdHJpbmdcblx0Y29kZT86IG51bWJlclxuXHRzaWduYWw/OiBzdHJpbmdcblx0fVxuXG5leHBvcnQgcnVuVW5pdFRlc3QgOj0gKFxuXHRzdHViOiBzdHJpbmcsXG5cdCk6IHVuaXRUZXN0UmVzdWx0ID0+XG5cblx0REJHIFwiUnVubmluZyB1bml0IHRlc3QgI3tzdHVifVwiXG5cblx0ZW5zdXJlQ29tcGlsZWQgJ2xpYkRpcicsIHN0dWJcblx0ZW5zdXJlQ29tcGlsZWQgJ2JpbkRpcicsIHN0dWJcblxuXHQjIC0tLSBUaGlzIGlzIHRoZSBwYXRoIHRvIHRoZSB0ZXN0IHRvIGJlIHJ1blxuXHR0ZXN0T3V0UGF0aCA6PSBlbnN1cmVDb21waWxlZCAndGVzdERpcicsIHN0dWIsICd0ZXN0J1xuXHRpZiAodGVzdE91dFBhdGggPT0gdW5kZWYpXG5cdFx0V0FSTiBcIkNvbXBpbGUgb2YgI3tzdHVifSB1bml0IHRlc3QgZmFpbGVkXCJcblx0XHRyZXR1cm4ge1xuXHRcdFx0c3R1YlxuXHRcdFx0c3VjY2VzczogZmFsc2Vcblx0XHRcdG1zZzogXCJDb21waWxlIG9mICN7c3R1Yn0gdW5pdCB0ZXN0IGZhaWxlZFwiXG5cdFx0XHR9XG5cdGVsc2Vcblx0XHREQkcgXCJ0ZXN0T3V0UGF0aCA9ICN7T0wodGVzdE91dFBhdGgpfVwiXG5cblx0IyAtLS0gQ29tcGlsZSBhbGwgZmlsZXMgaW4gc3ViZGlyIGlmIGl0IGV4aXN0c1xuXHRpZiBpc0RpcihcInRlc3QvI3tzdHVifVwiKVxuXHRcdGZvciB7cGF0aCwgc3RhdHVzLCBvdXRQYXRofSBvZiBjb21waWxlQWxsRmlsZXMoXCJ0ZXN0LyN7c3R1Yn0vKlwiKVxuXHRcdFx0aWYgbm90ZGVmaW5lZChvdXRQYXRoKVxuXHRcdFx0XHRXQVJOIFwiRmlsZSAje09MKHBhdGgpfSBub3QgY29tcGlsZWRcIlxuXG5cdCMgLS0tIFJ1biB0aGUgdW5pdCB0ZXN0LCByZXR1cm4gcmV0dXJuIGNvZGVcblx0YXNzZXJ0IGlzRmlsZSh0ZXN0T3V0UGF0aCksIFwiTm8gc3VjaCBmaWxlOiAje09MKHRlc3RPdXRQYXRoKX1cIlxuXG5cdCMgLS0tIFJldHVybiB2YWx1ZSBoYXMga2V5cyBzdWNjZXNzLCBjb2RlLCBzaWduYWxcblx0aCA6PSBleGVjQ21kU3luYyAnZGVubycsIFtcblx0XHRcdCd0ZXN0Jyxcblx0XHRcdCctcUEnLFxuXHRcdFx0dGVzdE91dFBhdGhcblx0XHRcdF1cbiNcdGhSZXN1bHQuc3R1YiA9IHN0dWJcblx0cmV0dXJuIHtcblx0XHRzdHViXG5cdFx0c3VjY2VzczogaC5zdWNjZXNzXG5cdFx0Y29kZTogaC5jb2RlXG5cdFx0c2lnbmFsOiBoLnNpZ25hbFxuXHRcdH1cblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiMgLS0tIGEgZ2VuZXJhdG9yXG5cbmV4cG9ydCBydW5BbGxVbml0VGVzdHMgOj0gKCk6IEdlbmVyYXRvcjx1bml0VGVzdFJlc3VsdCwgdm9pZCwgdW5rbm93bj4gLT5cblxuXHRoR2xvYk9wdGlvbnMgOj0ge1xuXHRcdGV4Y2x1ZGU6IFsnbm9kZV9tb2R1bGVzLyoqJywgJy5naXQvKionXVxuXHRcdH1cblxuXHRwYXR0ZXJuIDo9ICd0ZXN0LyoudGVzdC5qcydcblx0REJHIFwicGF0dGVybiA9ICN7T0wocGF0dGVybil9XCJcblx0Zm9yIHtwYXRofSBvZiBhbGxGaWxlc01hdGNoaW5nKHBhdHRlcm4sIGhHbG9iT3B0aW9ucylcblx0XHR7c3R1Yn0gOj0gcGFyc2VQYXRoKHBhdGgpXG5cdFx0aWYgKHN0dWIgPT0gdW5kZWYpXG5cdFx0XHRXQVJOIFwiTm8gc3R1YiBmb3VuZCBpbiAje09MKHBhdGgpfVwiXG5cdFx0ZWxzZVxuXHRcdFx0REJHIFwiVEVTVDogI3twYXRofVwiXG5cdFx0XHR5aWVsZCBydW5Vbml0VGVzdChzdHViKVxuXHRyZXR1cm5cblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuaEtleVRvTG9nZ2VyOiBoYXNoIDo9IHtcblx0STogJ2luZm8nXG5cdFA6ICdwcm9maWxlJ1xuXHREOiAnZGVidWcnXG5cdFE6ICdxdWlldCdcblx0UzogJ3NpbGVudCdcblx0fVxuXG5leHBvcnQgc2V0TG9nZ2VyRnJvbUFyZ3MgOj0gKGxBcmdzOiBzdHJpbmdbXSk6IHZvaWQgPT5cblxuXHRmb3Igc3RyIG9mIGxBcmdzXG5cdFx0bE1hdGNoZXMgOj0gc3RyLm1hdGNoKC8vL15cblx0XHRcdC1cblx0XHRcdChbQS1aYS16MC05Xy1dKilcblx0XHRcdCg9KT9cblx0XHRcdC8vLylcblx0XHRpZiAobE1hdGNoZXMgPT0gbnVsbClcblx0XHRcdHBhc3MoKVxuXHRcdGVsc2Vcblx0XHRcdGtleVN0ciA6PSBsTWF0Y2hlc1sxXVxuXHRcdFx0aGFzRXEgOj0gbE1hdGNoZXNbMl1cblx0XHRcdGlmIGlzRW1wdHkoaGFzRXEpXG5cdFx0XHRcdGZvciBrZXkgb2Yga2V5cyhoS2V5VG9Mb2dnZXIpXG5cdFx0XHRcdFx0aWYga2V5U3RyLmluY2x1ZGVzKGtleSlcblx0XHRcdFx0XHRcdHNldExvZ0xldmVsIGhLZXlUb0xvZ2dlcltrZXldXG5cdHJldHVyblxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKipcbiAqIFBhcnNlIGNvbW1hbmQgbGluZSBhcmd1bWVudHMsIG9wdGlvbmFsbHkgc3BlY2lmeWluZyB3aGljaFxuICogb3B0aW9ucyB0byBleHBlY3QgYW5kL29yIHRoZSBleHBlY3RlZCBudW1iZXIgb2Ygbm9uLW9wdGlvbnNcbiAqXG4gKiBUaGVyZSBhcmUgMyBraW5kcyBvZiBpdGVtcyBhbGxvd2VkIG9uIHRoZSBjb21tYW5kIGxpbmU6XG4gKlxuICogMS4gZmxhZ3MsIGUuZy5cbiAqIFx0YC1mbnhgIC0gc2V0cyBmbGFncyBgZmAsICduJyBhbmQgYHhgIHRvIHRydWVcbiAqICAgIGZsYWdzIG11c3QgYmUgdXBwZXIgb3IgbG93ZXIgY2FzZSBsZXR0ZXJzXG4gKlxuICogMi4gYW4gb3B0aW9uIHdpdGggYSB2YWx1ZSwgZS5nLlxuICogXHRgLWxhYmVsPW15bGFiZWxgIC0gc2V0cyBvcHRpb24gYGxhYmVsYCB0byBgJ215bGFiZWwnYFxuICogXHRpZiB0aGUgdmFsdWUgY29udGFpbnMgYSBzcGFjZSBjaGFyLCBpdCBtdXN0IGJlIHF1b3RlZFxuICogXHRpZiB0aGUgdmFsdWUgbG9va3MgbGlrZSBhIG51bWJlciwgaXQncyBzZXQgdG8gYSBudW1iZXJcbiAqXG4gKiAzLiBhbnl0aGluZyBlbHNlIGlzIGEgbm9uLW9wdGlvbiwgZS5nLlxuICogXHRjOi90ZW1wL3RlbXAudHh0XG4gKiBcdGlmIGl0IGluY2x1ZGVzIGEgc3BhY2UgY2hhciBvciBzdGFydHMgd2l0aCBgLWAsXG4gKiBcdFx0aXQgbXVzdCBiZSBxdW90ZWRcbiAqXG4gKiB0aGUgMXN0IGFyZ3VtZW50IHRvIGdldENtZEFyZ3MoKSBpcyBvcHRpb25hbCwgYW5kIGlzIGEgaGFzaFxuICogb2YgaW5mb3JtYXRpb24gYWJvdXQgdGhlIGV4cGVjdGVkIGFyZ3VtZW50cy5cbiAqXG4gKiBJZiBrZXkgJ18nIGlzIHByZXNlbnQsIGl0IG11c3QgYmUgYSBoYXNoIHBvc3NpYmx5IGluY2x1ZGluZyBrZXlzOlxuICogICAgJ3JhbmdlJyAtIGVpdGhlciBhbiBpbnRlZ2VyIHNwZWNpZnlpbmcgdGhlIGV4YWN0IG51bWJlciBvZlxuICogICAgICAgICAgICAgIG5vbi1vcHRpb25zIGV4cGVjdGVkLCBvZiBhbiBhcnJheSBvZiAyIGludGVnZXJzXG4gKiAgICAgICAgICAgICAgc3BlY2lmeWluZyB0aGUgbWluaW11bSBhbmQgbWF4aW11bSBudW1iZXIgb2ZcbiAqICAgICAgICAgICAgICBub24tb3B0aW9ucyBleHBlY3RlZC4gVGhlIDJuZCBvZiB0aGVzZSBtYXkgYmVcbiAqICAgICAgICAgICAgICB0aGUgc3RyaW5nICdpbmYnIHRvIGluZGljYXRlIG5vIG1heGltdW0gbnVtYmVyXG4gKiAgICAnZGVzYycgLSBhIHRleHQgZGVzY3JpcHRpb24gb2Ygd2hhdCBub24tb3B0aW9ucyBhcmVcbiAqXG4gKiBBbGwgb3RoZXIga2V5cyBhcmUgbmFtZXMgb2Ygb3B0aW9ucyBhbGxvd2VkLCBhbmQgdGhlIGFzc29jaWF0ZWQgdmFsdWVcbiAqIG11c3QgYmUgYSBoYXNoIHdpdGggcG9zc2libHkgdGhlc2Uga2V5czpcbiAqICAgIHR5cGUgLSB0aGUgdHlwZSBvZiB2YWx1ZSBleHBlY3RlZCAoZGVmYXVsdHMgdG8gJ2Jvb2xlYW4nKVxuICogICAgZGVzYyAtIGEgdGV4dCBkZXNjcmlwdGlvbiBvZiB0aGUgb3B0aW9uICh1c2VkIG9uIGhlbHAgc2NyZWVucylcbiAqXG4gKiB0aGUgMm5kIGFyZ3VtZW50IHRvIGdldENtZEFyZ3MoKSBpcyBhbiBhcnJheSBvZiBzdHJpbmcgYXJndW1lbnRzXG4gKiBmcm9tIHRoZSBjb21tYW5kIGxpbmUgKGRlZmF1bHRzIHRvIERlbm8uYXJncylcbiAqXG4gKiB0aGUgM3JkIGFyZ3VtZW50IHRvIGdldENtZEFyZ3MoKSBpcyBhIGhhc2ggb2YgcG9zc2libGUgb3B0aW9uczpcbiAqICAgIGRvU2V0TG9nZ2VyIC0gZGVmYXVsdHMgdG8gdHJ1ZSAtIGlmIGZhbHNlLCB0aGVuIG9wdGlvbnNcbiAqICAgICAgICAgICAgICAgICAgLVAsIC1ELCAtUSwgLUkgYW5kIC1TIG5vIGxvbmdlciBzZXQgbG9nZ2luZyBvcHRpb25zXG4gKiAgICAgICAgICAgICAgICAgIGFuZCBtYXkgdGhlcmVmb3JlIGJlIHVzZWQgZm9yIG90aGVyIHB1cnBvc2VzXG4gKlxuICogQnkgZGVmYXVsdCwgdGhlIGZvbGxvd2luZyBmbGFncyBhcmUgcmVjb2duaXplZCwgYW5kIHRoZXJlZm9yZVxuICogY2Fubm90IGJlIGluY2x1ZGVkIGluIGhEZXNjICh0aGlzIGJlaGF2aW9yIGNhbiBiZVxuICogZGlzYWJsZWQgYnkgc2V0dGluZyBoT3B0aW9ucy5kb1NldExvZ2dlciB0byBmYWxzZSk6XG4gKlxuICogYC1QYCAtIHNldCB0aGUgY3VycmVudCBsb2cgbGV2ZWwgdG8gJ3Byb2ZpbGUnXG4gKiBgLURgIC0gc2V0IHRoZSBjdXJyZW50IGxvZyBsZXZlbCB0byAnZGVidWcnXG4gKiBgLVFgIC0gc2V0IHRoZSBjdXJyZW50IGxvZyBsZXZlbCB0byAnd2FybidcbiAqIGAtSWAgLSBzZXQgdGhlIGN1cnJlbnQgbG9nIGxldmVsIHRvICdpbmZvJ1xuICogYC1TYCAtIHNldCB0aGUgY3VycmVudCBsb2cgbGV2ZWwgdG8gJ3NpbGVudCdcbiAqXG4gKiAoc2VlIGxpYnJhcnkgQGpkZWlnaGFuL2xvZ2dlcilcbiAqL1xuXG5leHBvcnQgZ2V0Q21kQXJncyA6PSAoXG5cdGhEZXNjOiBoYXNoPyA9IHVuZGVmLFxuXHRsQXJnczogc3RyaW5nW10gPSBEZW5vLmFyZ3MsXG5cdGhPcHRpb25zOiBvcHRpb25zcGVjID0ge31cblx0KTogaGFzaCA9PlxuXG5cdGlmIG5vdGRlZmluZWQoaERlc2MpXG5cdFx0cGFzcygpXG5cdGVsc2Vcblx0XHRhc3NlcnQgaXNIYXNoKGhEZXNjKSwgXCJCYWQgaERlc2M6ICN7T0woaERlc2MpfVwiXG5cdGFzc2VydCBpc0FycmF5T2ZTdHJpbmdzKGxBcmdzKSwgXCJCYWQgbEFyZ3M6ICN7T0wobEFyZ3MpfVwiXG5cblx0aWYgKGxBcmdzLmxlbmd0aCA9PSAxKSAmJiAobEFyZ3NbMF0gPT0gJy1oJylcblx0aWYgKChsQXJncy5sZW5ndGggPT0gMSlcblx0XHRcdCYmIFsnLWgnLCctLWgnLCctaGVscCcsJy0taGVscCddLmluY2x1ZGVzKGxBcmdzWzBdKVxuXHRcdFx0KVxuXHRcdGlmIG5vdGRlZmluZWQoaERlc2MpXG5cdFx0XHRMT0cgXCJObyBoZWxwIGF2YWlsYWJsZVwiXG5cdFx0ZWxzZVxuXHRcdFx0c2hvd0hlbHAoaERlc2MpXG5cdFx0RGVuby5leGl0KClcblxuXHQjIC0tLSBDdXJyZW50bHksIHRoZXJlIGlzIG9ubHkgb25lIHBvc3NpYmxlIG9wdGlvblxuXHR7ZG9TZXRMb2dnZXJ9IDo9IGdldE9wdGlvbnMgaE9wdGlvbnMsIHtcblx0XHRkb1NldExvZ2dlcjogdHJ1ZVxuXHRcdH1cblxuXHRpZiBkb1NldExvZ2dlclxuXHRcdGlmIG5vdGRlZmluZWQoaERlc2MpXG5cdFx0XHRwYXNzKClcblx0XHRlbHNlXG5cdFx0XHRmb3Iga2V5IG9mIGtleXMoaEtleVRvTG9nZ2VyKVxuXHRcdFx0XHRhc3NlcnQgbm90ZGVmaW5lZChoRGVzY1trZXldKSxcblx0XHRcdFx0XHRcdFwiaW52YWxpZCBrZXkgI3tPTChrZXkpfSBzZXQgaW4gaERlc2NcIlxuXHRcdHNldExvZ2dlckZyb21BcmdzKGxBcmdzKVxuXG5cdGhSZXN1bHQ6IGhhc2ggOj0geyBfOiBbXSB9XG5cblx0IyAtLS0gVXRpbGl0eSBmdW5jdGlvbnNcblxuXHQjIC0tLSBFdmVuIGdldHMgY2FsbGVkIGZvciAtRCwgLVEsIC1QLCAtU1xuXHRhZGRPcHRpb24gOj0gKG5hbWU6IHN0cmluZywgdmFsdWU6IGFueSkgPT5cblx0XHREQkcgXCJhZGRPcHRpb24oI3tPTChuYW1lKX0sICN7T0wodmFsdWUpfSlcIlxuXHRcdGFzc2VydCBpc1N0cmluZyhuYW1lKSwgXCJOb3QgYSBzdHJpbmc6ICN7T0wobmFtZSl9XCJcblx0XHRhc3NlcnQgbm90IGhhc0tleShoUmVzdWx0LCBuYW1lKSxcblx0XHRcdFx0XCJkdXAga2V5ICN7bmFtZX0sIGhSZXN1bHQgPSAje09MKGhSZXN1bHQpfVwiXG5cblx0XHRpZiBkb1NldExvZ2dlclxuXHRcdFx0bG9nZ2VyIDo9IGhLZXlUb0xvZ2dlcltuYW1lXVxuXHRcdFx0aWYgZGVmaW5lZChsb2dnZXIpXG5cdFx0XHRcdGhSZXN1bHRbbmFtZV0gPSB0cnVlXG5cdFx0XHRcdHNldExvZ0xldmVsIGxvZ2dlclxuXHRcdFx0XHRyZXR1cm5cblxuXHRcdGlmIG5vdGRlZmluZWQoaERlc2MpXG5cdFx0XHRoUmVzdWx0W25hbWVdID0gdmFsdWVcblx0XHRcdHJldHVyblxuXHRcdHt0eXBlfSA6PSBnZXRPcHRpb25JbmZvKGhEZXNjLCBuYW1lKVxuXG5cdFx0IyAtLS0gdHlwZSBjaGVja2luZ1xuXHRcdGlmIGlzQXJyYXkodHlwZSlcblx0XHRcdGFzc2VydCB0eXBlLmluY2x1ZGVzKHZhbHVlKSwgXCJ0eXBlIG5vdCBhbiBhcnJheVwiXG5cdFx0XHRoUmVzdWx0W25hbWVdID0gdmFsdWVcblx0XHRlbHNlXG5cdFx0XHRzd2l0Y2ggdHlwZVxuXHRcdFx0XHR3aGVuICdzdHJpbmcnXG5cdFx0XHRcdFx0aFJlc3VsdFtuYW1lXSA9IHZhbHVlXG5cdFx0XHRcdHdoZW4gJ2Jvb2xlYW4nXG5cdFx0XHRcdFx0aFJlc3VsdFtuYW1lXSA9IChcblx0XHRcdFx0XHRcdCAgKHZhbHVlID09ICd0cnVlJykgID8gdHJ1ZVxuXHRcdFx0XHRcdFx0OiAodmFsdWUgPT0gJ2ZhbHNlJykgPyBmYWxzZVxuXHRcdFx0XHRcdFx0OiAgICAgICAgICAgICAgICAgICAgICB2YWx1ZVxuXHRcdFx0XHRcdFx0KVxuXHRcdFx0XHR3aGVuICdudW1iZXInLCdmbG9hdCdcblx0XHRcdFx0XHRoUmVzdWx0W25hbWVdID0gcGFyc2VGbG9hdCh2YWx1ZSlcblx0XHRcdFx0d2hlbiAnaW50ZWdlcidcblx0XHRcdFx0XHRoUmVzdWx0W25hbWVdID0gcGFyc2VJbnQodmFsdWUpXG5cdFx0cmV0dXJuXG5cblx0YWRkTm9uT3B0aW9uIDo9IChzdHI6IHN0cmluZykgPT5cblx0XHREQkcgXCJhZGROb25PcHRpb24oI3tPTChzdHIpfSlcIlxuXHRcdGhSZXN1bHQuXy5wdXNoIHN0clxuXG5cdGZvciBzdHIgb2YgbEFyZ3Ncblx0XHQjIC0tLSBpZ25vcmUgJy0tJ1xuXHRcdGlmIChzdHIgPT0gJy0tJylcblx0XHRcdERCRyBcInNraXBwaW5nIC0tXCJcblx0XHRcdGNvbnRpbnVlXG5cblx0XHQjIC0tLSBjaGVjayBpZiBpdCdzIGFuIG9wdGlvblxuXHRcdGxNYXRjaGVzIDo9IHN0ci5tYXRjaCgvLy9eXG5cdFx0XHQtXG5cdFx0XHQoW0EtWmEtejAtOV8tXSopXG5cdFx0XHQoPzpcblx0XHRcdFx0KD0pXG5cdFx0XHRcdCguKilcblx0XHRcdFx0KT9cblx0XHRcdCQvLy8pXG5cdFx0aWYgKGxNYXRjaGVzID09IG51bGwpXG5cdFx0XHQjIC0tLSBpdCdzIGEgbm9uLW9wdGlvblxuXHRcdFx0YWRkTm9uT3B0aW9uIHN0clxuXHRcdGVsc2Vcblx0XHRcdCMgLS0tIGl0J3MgYW4gb3B0aW9uXG5cdFx0XHRbXywgb3B0U3RyLCBlcVN0ciwgdmFsdWVdIDo9IGxNYXRjaGVzXG5cdFx0XHRpZiBlcVN0clxuXHRcdFx0XHRhZGRPcHRpb24gb3B0U3RyLCB2YWx1ZVxuXHRcdFx0ZWxzZVxuXHRcdFx0XHRmb3IgY2ggb2Ygb3B0U3RyLnNwbGl0KCcnKVxuXHRcdFx0XHRcdGFkZE9wdGlvbiBjaCwgdHJ1ZVxuXG5cdCMgLS0tIGlmIGhEZXNjIGlzIHNldCwgdGhlblxuXHQjICAgICBGaWxsIGluIGRlZmF1bHQgdmFsdWVzIGlmIGF2YWlsYWJsZVxuXG5cdGlmIG5vdGRlZmluZWQoaERlc2MpXG5cdFx0cGFzcygpXG5cdGVsc2Vcblx0XHRmb3IgbmFtZSBvZiBrZXlzKGhEZXNjLCAnZXhjZXB0PV8nKVxuXHRcdFx0aWYgbm90ZGVmaW5lZChoUmVzdWx0W25hbWVdKVxuXHRcdFx0XHR7ZGVmYXVsdFZhbH0gOj0gZ2V0T3B0aW9uSW5mbyhoRGVzYywgbmFtZSlcblx0XHRcdFx0aWYgZGVmaW5lZChkZWZhdWx0VmFsKVxuXHRcdFx0XHRcdGhSZXN1bHRbbmFtZV0gPSBkZWZhdWx0VmFsXG5cblx0XHQjIC0tLSBDaGVjayBvZiB0aGVyZSdzIGEgcmVzdHJpY3Rpb24gb24gdGhlIG51bWJlciBvZiBub24tb3B0aW9uc1xuXG5cdFx0aWYgaGFzS2V5KGhEZXNjLCAnXycpXG5cdFx0XHRoSW5mbyA6PSBnZXROb25PcHRpb25JbmZvKGhEZXNjKVxuXHRcdFx0aWYgKGhJbmZvICE9IHVuZGVmKVxuXHRcdFx0XHR7cmFuZ2V9IDo9IGhJbmZvXG5cdFx0XHRcdFttaW4sIG1heF0gOj0gcmFuZ2Vcblx0XHRcdFx0bGVuIDo9IGhSZXN1bHQuXy5sZW5ndGhcblx0XHRcdFx0YXNzZXJ0IChsZW4gPj0gbWluKSwgXCIje2xlbn0gbm9uLW9wdGlvbnMgPCBtaW4gKCN7bWlufSlcIlxuXHRcdFx0XHRhc3NlcnQgKGxlbiA8PSBtYXgpLCBcIiN7bGVufSBub24tb3B0aW9ucyA+IG1heCAoI3ttYXh9KVwiXG5cblx0REJHIFwiaFJlc3VsdCA9ICN7T0woaFJlc3VsdCl9XCJcblx0cmV0dXJuIGhSZXN1bHRcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuZXhwb3J0IGdldE9wdGlvbkluZm8gOj0gKGhEZXNjOiBoYXNoLCBuYW1lOiBzdHJpbmcpOiBoYXNoID0+XG5cblx0IyAtLS0gUmV0dXJuIHZhbHVlIGlzIGEgaGFzaCB3aXRoIGtleXM6IHR5cGUsIGRlc2NcblxuXHRhc3NlcnQgZGVmaW5lZChoRGVzYyksIFwiaERlc2MgaXMgbm90IGRlZmluZWQgaW4gZ2V0T3B0aW9uSW5mbygpXCJcblx0YXNzZXJ0IGlzSGFzaChoRGVzYyksIFwiaERlc2MgaXMgbm90IGEgaGFzaCBpbiBnZXRPcHRpb25JbmZvKCk6ICN7T0woaERlc2MpfVwiXG5cdGFzc2VydCAobmFtZSAhPSAnXycpLCBcImdldE9wdGlvbkluZm8oaERlc2MsICdfJykgY2FsbGVkXCJcblx0YXNzZXJ0IGhhc0tleShoRGVzYywgbmFtZSksIFwiTm8gc3VjaCBvcHRpb246IC0je25hbWV9XCJcblx0aCA6PSBpc0hhc2goaERlc2NbbmFtZV0pID8gaERlc2NbbmFtZV0gOiB7ZGVzYzogaERlc2NbbmFtZV19XG5cdGlmIG5vdGRlZmluZWQoaC50eXBlKVxuXHRcdGgudHlwZSA9IChuYW1lLmxlbmd0aCA9PSAxKSA/ICdib29sZWFuJyA6ICdzdHJpbmcnXG5cdGlmIG5vdGRlZmluZWQoaC5kZXNjKVxuXHRcdGguZGVzYyA9ICc8bm8gZGVzY3JpcHRpb24gYXZhaWxhYmxlPidcblx0aWYgbm90IGhhc0tleShoLCAnZGVmYXVsdFZhbCcpICYmIChoLnR5cGUgPT0gJ2Jvb2xlYW4nKVxuXHRcdGguZGVmYXVsdFZhbCA9IGZhbHNlXG5cdHJldHVybiBoXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4jIC0tLSByZXR1cm5zIHVuZGVmIGlmIG5vICdfJyBrZXkgaW4gaERlc2NcblxudHlwZSByYW5nZVR5cGUgPSBbbnVtYmVyLCBudW1iZXJdXG5cbnR5cGUgbm9uT3B0aW9uSW5mbyA9IHtcblx0dHlwZTogJ2FycmF5J1xuXHRkZXNjOiBzdHJpbmdcblx0cmFuZ2U6IHJhbmdlVHlwZVxuXHR9XG5cbmV4cG9ydCBnZXROb25PcHRpb25JbmZvIDo9IChoRGVzYzogaGFzaCk6IG5vbk9wdGlvbkluZm8/ID0+XG5cblx0IyAtLS0gUmV0dXJuIHZhbHVlIGlzIGEgaGFzaCB3aXRoIGtleXM6XG5cdCMgICAgICAgIHR5cGUgPSAnYXJyYXknXG5cdCMgICAgICAgIGRlc2Ncblx0IyAgICAgICAgcmFuZ2UgYXMgW21pbiwgbWF4XVxuXG5cdGFzc2VydCBkZWZpbmVkKGhEZXNjKSwgXCJoRGVzYyBpcyBub3QgZGVmaW5lZCBpbiBnZXROb25PcHRpb25JbmZvKClcIlxuXHRpZiBub3QgaGFzS2V5KGhEZXNjLCAnXycpXG5cdFx0cmV0dXJuIHVuZGVmXG5cdGRlc2MgOj0gaERlc2MuZGVzYyB8fCAnPG5vIGRlc2NyaXB0aW9uIGF2YWlsYWJsZT4nXG5cdGxldCByYW5nZTogcmFuZ2VUeXBlID0gWzAsIEluZmluaXR5XVxuXHRpZiBoYXNLZXkoaERlc2MsICdyYW5nZScpXG5cdFx0ciA6PSBoRGVzYy5yYW5nZVxuXHRcdGlmIGlzSW50ZWdlcihyKVxuXHRcdFx0cmFuZ2UgPSBbciwgcl1cblx0XHRlbHNlIGlmIEFycmF5LmlzQXJyYXkocilcblx0XHRcdGFzc2VydCAoci5sZW5ndGggPT0gMiksIFwiQmFkICdfJyBrZXk6ICN7T0wocil9XCJcblx0XHRcdFttaW4sIG1heF0gOj0gclxuXHRcdFx0YXNzZXJ0IGlzSW50ZWdlcihtaW4pLCBcInJhbmdlIG1pbiBub3QgYW4gaW50ZWdlclwiXG5cdFx0XHRpZiAobWF4ID09ICdpbmYnKVxuXHRcdFx0XHRbbWluLCBJbmZpbml0eV1cblx0XHRcdGVsc2Vcblx0XHRcdFx0YXNzZXJ0IGlzSW50ZWdlcihtYXgpLCBcInJhbmdlIG1heCBub3QgYW4gaW50ZWdlclwiXG5cdFx0XHRcdFttaW4sIG1heF1cblx0XHRlbHNlXG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IgXCJJbnZhbGlkIHJhbmdlOiAje09MKHIpfVwiXG5cblx0cmV0dXJuIHtcblx0XHR0eXBlOiAnYXJyYXknXG5cdFx0ZGVzY1xuXHRcdHJhbmdlXG5cdFx0fVxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG5leHBvcnQgc2hvd0hlbHAgOj0gKGhEZXNjOiBoYXNoKTogdm9pZCA9PlxuXG5cdExPRyBcIkF2YWlsYWJsZSBvcHRpb25zOlwiXG5cdGZvciBuYW1lIG9mIGtleXMoaERlc2MsICdleGNlcHQ9XycpXG5cdFx0e3R5cGUsIGRlc2N9IDo9IGdldE9wdGlvbkluZm8oaERlc2MsIG5hbWUpXG5cdFx0TE9HIFwiICAgLSN7bmFtZX06ICN7dHlwZX0gLSAje2Rlc2N9XCJcblx0aWYgZGVmaW5lZChoRGVzYy5fKVxuXHRcdExPRyBcIkF2YWlsYWJsZSBub24tb3B0aW9uczpcIlxuXHRcdGlmIGlzSGFzaChoRGVzYy5fKVxuXHRcdFx0e3JhbmdlLCBkZXNjfSA6PSBoRGVzYy5fXG5cdFx0XHRpZiBkZWZpbmVkKHJhbmdlKVxuXHRcdFx0XHRpZiBpc0ludGVnZXIocmFuZ2UpXG5cdFx0XHRcdFx0TE9HIFwiICAgVGhlcmUgbXVzdCBiZSBleGFjdGx5ICN7cmFuZ2V9IG5vbi1vcHRpb25zXCJcblx0XHRcdFx0ZWxzZSBpZiBpc0FycmF5KHJhbmdlKVxuXHRcdFx0XHRcdFttaW4sIG1heF0gOj0gcmFuZ2Vcblx0XHRcdFx0XHRpZiAobWluID4gMClcblx0XHRcdFx0XHRcdExPRyBcIiAgIFRoZXJlIG11c3QgYmUgYXQgbGVhc3QgI3ttaW59IG5vbi1vcHRpb25zXCJcblx0XHRcdFx0XHRpZiAobWF4ICE9ICdpbmYnKVxuXHRcdFx0XHRcdFx0TE9HIFwiICAgVGhlcmUgbXVzdCBiZSBhdCBtb3N0ICN7bWF4fSBub24tb3B0aW9uc1wiXG5cdFx0ZGVzYyA6PSAoXG5cdFx0XHQgIGlzU3RyaW5nKGhEZXNjLl8pID8gaERlc2MuX1xuXHRcdFx0OiBpc0hhc2goaERlc2MuXykgPyAoaERlc2MuXy5kZXNjIHx8ICc8bm8gZGVzY3JpcHRpb24gYXZhaWxhYmxlPicpXG5cdFx0XHQ6IGNyb2FrIFwiQmFkIGRlc2NyaXB0b3IgZm9yIG5vbi1vcHRpb25zOiAje09MKGhEZXNjLl8pfVwiXG5cdFx0XHQpXG5cdFx0TE9HIGRlc2Ncblx0cmV0dXJuXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbmV4cG9ydCBzZXREaXIgOj0gKGJsb2NrOiBzdHJpbmcpOiB2b2lkID0+XG5cblx0Y29uc29sZS5sb2cgXCJXb3JraW5nIG9uIGl0XCJcbiJdfQ==