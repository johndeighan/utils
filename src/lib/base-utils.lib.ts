"use strict";
// base-utils.lib.civet

type AutoPromise<T> = Promise<Awaited<T>>;
import {assert} from 'jsr:@std/assert'
import {relative, parse} from 'node:path'
import {existsSync} from 'jsr:@std/fs'
import {statSync} from 'node:fs'
import {expandGlobSync} from 'jsr:@std/fs/expand-glob'

export {assert}
const decoder = new TextDecoder()
const decode = (x: Uint8Array<ArrayBuffer>) => {
	return decoder.decode(x)
}

export const DIR = (x: unknown): void => {
	console.dir(x, {depth: null})
}

export type TConstructor<T> = new (...args: any[]) => T

let hasClear = false

// ---------------------------------------------------------------------------

export const checkSetup = (): void => {

	const rootDir: (string | undefined) = Deno.env.get('PROJECT_ROOT_DIR')
	assertIsDefined(rootDir)
	assert(existsSync(rootDir) && statSync(rootDir).isDirectory(),
		"Please set env var PROJECT_ROOT_DIR to a valid directory")
	return
}

// ---------------------------------------------------------------------------

export const condClear = (
		lCmdArgs: string[] = Deno.args
		): void => {

	if (Deno.args.at(-1) === '!') {
		hasClear = true
		execCmd('clear')
	}
	return
}

// ---------------------------------------------------------------------------

export const stdChecks = (): void => {

	checkSetup()
	condClear()
	return
}

// ---------------------------------------------------------------------------

export const FAIL = (errMsg: string, n: number = 99): never => {

	console.log(errMsg)
	Deno.exit(n)
}

// ---------------------------------------------------------------------------

export const SUCCEED = (msg: (string | undefined) = undef): never => {

	if (defined(msg)) {
		console.log(msg)
	}
	Deno.exit(0)
}

// ---------------------------------------------------------------------------
//             cmd-args
// ---------------------------------------------------------------------------

export const flag = (
		ch: string,
		lCmdArgs: string[] = Deno.args
		): boolean => {

	assert((ch.length === 1), `Bad flag arg: ${ch}`)
	const re = new RegExp(`^-[a-z]*${ch}[a-z]*$`)
	for (const str of lCmdArgs) {
		if (re.test(str)) {
			return true
		}
	}
	return false
}

// ---------------------------------------------------------------------------

export const nonOption = (
		pos: number,
		lCmdArgs: string[] = Deno.args
		): (string | undefined) => {

	for (const str of lCmdArgs) {
		if (!/^-/.test(str)) {
			if (pos === 0) {
				return hasClear && (str === '!') ? undef : str
			}
			else {
				pos -= 1
			}
		}
	}
	return undef
}


// ---------------------------------------------------------------------------
//             logger
// ---------------------------------------------------------------------------

export const LOG = console.log

export const DBG = (msg: string): void => {
	if (flag('D')) {
		LOG(msg)
	}
	return
}

// ---------------------------------------------------------------------------

export const LLOG = (
		label: string,
		msg: string
		): void => {

	const labelLen = 15
	if (label.length <= labelLen) {
		const spaces = ' '.repeat(labelLen-label.length)
		LOG(`${label}${spaces} ${msg}`)
	}
	else {
		LOG(`${label.substring(0, labelLen)} ${msg}`)
	}
	return
}

// ---------------------------------------------------------------------------

export const ILOG = (msg: string): void => {

	LOG(`   ${msg}`)
	return
}

// ---------------------------------------------------------------------------
//             datatypes
// ---------------------------------------------------------------------------

export type hash = {
	[key: string | symbol]: unknown
}

export type TDefined = NonNullable<unknown>
export type TNotDefined = null | undefined

export const undef = undefined

// ---------------------------------------------------------------------------

export const defined = (x: unknown): x is TDefined => {

	return (x !== undef) && (x !== null)
}

// ---------------------------------------------------------------------------

export const notdefined = (x: unknown): x is TNotDefined => {

	return (x === undef) || (x === null)
}

// ---------------------------------------------------------------------------

export function assertIsDefined(
		value: unknown,
		name: string = ''
		): asserts value is TDefined { () => {

	if (notdefined(value)) {
		throw new Error("value is not defined")
	}
	return
} }

// ---------------------------------------------------------------------------

export function assertNotDefined(
		value: unknown,
		name: string = ''
		): asserts value is TNotDefined { () => {

	if (defined(value)) {
		throw new Error("value is defined")
	}
	return
} }

// ---------------------------------------------------------------------------

export const croak = (msg: string): never => {

	throw new Error(msg)
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------

export const replaceInArray = (
	lStrings: string[],
	hReplace: {[key: string]: string}
	): string[] => {

	return (()=>{const results=[];for (const str of lStrings) {
		if (hReplace.hasOwnProperty(str)) {
			results.push(hReplace[str])
		}
		else {
			results.push(str)
		}
	}return results})()
}

// ---------------------------------------------------------------------------
//             fsys
// ---------------------------------------------------------------------------

export const isFile = (path: string): boolean => {

	return existsSync(path) && statSync(path).isFile()
}

// ---------------------------------------------------------------------------

export const slurp = (path: string): string => {

	const data = Deno.readFileSync(path)
	return decoder.decode(data).replaceAll('\r', '')
}

// ---------------------------------------------------------------------------

export const rmFile = (path: string): void => {

	if (existsSync(path)) {
		Deno.removeSync(path)
	}
	return
}

// ---------------------------------------------------------------------------

export const fileExt = (path: string): string => {

	let ref;if ((ref = path.match(/\.[^\.]+$/))) {const lMatches = ref;
		return lMatches[0]
	}
	else {
		return ''
	}
}

// ---------------------------------------------------------------------------

export const withExt = (path: string, ext: string): string => {

	const lMatches = path.match(/^(.*)(\.[^\.]+)$/)
	if (lMatches === null) {
		croak(`Bad path: '${path}'`)
		return ''
	}
	else {
		const [_, headStr, orgExt] = lMatches
		return `${headStr}${ext}`
	}
}

// ---------------------------------------------------------------------------

export const normalizePath = (path: string): string => {

	const npath = path.replaceAll('\\', '/')
	if (npath.charAt(1) === ':') {
		return npath.charAt(0).toUpperCase() + npath.substring(1)
	}
	else {
		return npath
	}
}

// ---------------------------------------------------------------------------

export const relpath = (path: string): string => {

	return normalizePath(relative('', path))
}

// ---------------------------------------------------------------------------

export const buildFileName = (
		stub: string,
		purpose: (string | undefined),
		ext: string
		) => {

	return (
		purpose ? `${stub}.${purpose}${ext}`
		        : `${stub}${ext}`
		)
}

// ---------------------------------------------------------------------------

export const buildTestFileName = (
		stub: string,
		purpose: (string | undefined),
		ext: string
		) => {

	return (
		purpose ? `${stub}.${purpose}.test${ext}`
		        : `${stub}.test${ext}`
		)
}

// ---------------------------------------------------------------------------

export type TPathInfo = {
	root: string
	dir: string
	fileName: string

	stub: string
	purpose: (string | undefined)
	ext: string
	}

export const parsePath = (
		path: string
		): TPathInfo => {

	const {root, dir, base} = parse(path)

	const lParts = base.split('.')
	assert((lParts.length > 2), `Bad path: ${path}`)
	return {
		root: normalizePath(root),
		dir: normalizePath(dir),
		fileName: base,

		stub:    lParts.slice(0, -2).join('.'),
		purpose: lParts.at(-2),
		ext:     `.${lParts.at(-1)}`
		}
}

// ---------------------------------------------------------------------------

export type TExecResult = {
	success: boolean
	code: number
	signal?: Deno.Signal | null
	stdout?: string
	stderr?: string
	}

export type TReplaceHash = {
	[key: string]: string
	}

// ---------------------------------------------------------------------------
// ASYNC

export const execCmd = async (
	cmdName: string,
	lCmdArgs: string[] = [],
	hReplace: TReplaceHash = {},
	capture: boolean = false
	): AutoPromise<TExecResult> => {

	const child = new Deno.Command(cmdName, {
		args: replaceInArray(lCmdArgs, hReplace),
		stdout: capture ? 'piped' : 'inherit',
		stderr: capture ? 'piped' : 'inherit'
		})
	if (capture) {
		const {success, code, signal, stdout, stderr} = await child.output()
		return {
			success, code,
			signal: signal || undef,
			stdout: decode(stdout),
			stderr: decode(stderr)
			}
	}
	else {
		const {success, code, signal} = await child.output()
		return {
			success,
			code,
			signal: signal || undef
			}
	}
}

// ---------------------------------------------------------------------------

export const newerDestFileExists = (
		path: string,
		ext: string
		): boolean => {

	const destPath = withExt(path, ext)
	if (!existsSync(destPath)) {
		return false
	}
	const srcMS = statSync(path).mtimeMs
	const destMS = statSync(destPath).mtimeMs
	return (destMS > srcMS)
}

// ---------------------------------------------------------------------------

export const cmdSucceeds = (
		cmdName: string,
		lArgs: string[] = []
		): boolean => {

	const child = new Deno.Command(cmdName, {
		args: lArgs,
		stdout: 'piped',
		stderr: 'piped'
		})
	return child.outputSync().success
}

// ---------------------------------------------------------------------------

export const splitPatterns = (
		lAllPats: string | string[]
		): [string[], string[]] => {

	const lPosPats: string[] = []
	const lNegPats: string[] = []

	if (typeof lAllPats === 'string') {
		// --- A single string can't be a negative pattern
		assert(!lAllPats.match(/^\!/), `Bad glob pattern: ${lAllPats}`)
		lPosPats.push(lAllPats)
	}
	else {
		for (const pat of lAllPats) {
			const lMatches = pat.match(/^(\!\s*)?(.*)$/)
			if (lMatches) {
				if (lMatches[1]) {
					lNegPats.push(lMatches[2])
				}
				else {
					lPosPats.push(lMatches[2])
				}
			}
		}
	}
	return [lPosPats, lNegPats]
}

// ---------------------------------------------------------------------------
// GENERATOR
//
//    Use like:
//       for path of allFilesMatching(lPats)
//          OR
//       lPaths := Array.from(allFilesMatching(lPats))
//
//    NOTE: By default, searches from ./src

export const allFilesMatching = function*(
		lPatterns: string | string[],
		hGlobOptions = {
			root: './src',
			includeDirs: false
			}
		): Generator<string, void, void> {

	const [lPosPats, lNegPats] = splitPatterns(lPatterns)
	if (flag('D')) {
		LOG("PATTERNS:")
		for (const pat of lPosPats) {
			ILOG(`POS: ${pat}`)
		}
		for (const pat of lNegPats) {
			ILOG(`NEG: ${pat}`)
		}
	}

	const setSkip = new Set<string>()
	for (const pat of lNegPats) {
		for (const {path} of expandGlobSync(pat, hGlobOptions)) {
			setSkip.add(path)
		}
	}

	for (const pat of lPosPats) {
		for (const {path} of expandGlobSync(pat, hGlobOptions)) {
			if (!setSkip.has(path)) {
				DBG(`PATH: ${path}`)
				yield path
				setSkip.add(path)
			}
		}
	}
	return
}

// ---------------------------------------------------------------------------

export const findFile = (fileName: string): (string | undefined) => {

	const lPaths = Array.from(allFilesMatching(`**/${fileName}`))
	switch(lPaths.length) {
		case 1: {
			return lPaths[0]
		}
		case 0: {
			return undef
		}
		default: {
			for (const path of lPaths) {
				console.log(path)
			}
			croak(`Multiple files with name ${fileName}`)
			return ''
		}
	}
}

// ---------------------------------------------------------------------------
// ASYNC

export type TProcFunc = (path: string) => Promise<unknown>
export type TProcResult = { [path: string]: unknown }

export const procFiles = async (
		lPatterns: string | string[],
		procFunc: TProcFunc
		): AutoPromise<[
			TProcResult,     // paths succeeded
			TProcResult?    // paths failed
			]> => {

	// --- We need the paths for later
	const lPaths = Array.from(allFilesMatching(lPatterns))

	const results1=[];for (const path of lPaths) {
		results1.push(procFunc(path))
	};const lPromises =results1
	const lResults = await Promise.allSettled(lPromises)

	const hSucceeded: TProcResult = {}
	const hFailed:    TProcResult = {}

	// --- lResults are in the same order as lPaths
	let hasFailed = false
	let i1 = 0;for (const res of lResults) {const i = i1++;
		const path = lPaths[i]
		if (res.status === 'fulfilled') {
			hSucceeded[path] = res.value
		}
		else {
			hasFailed = true
			hFailed[path] = res.reason
		}
	}

	return [
		hSucceeded,
		hasFailed ? hFailed : undef
		]
}

// ---------------------------------------------------------------------------

type TFileRunner = (
		stub: string,
		purpose: (string | undefined),
		lArgs?: string[],
		hOptions?: hash
		) => Promise<void>

// ---------------------------------------------------------------------------

export const getStringOption = (
		hOptions: hash,
		key: string,
		defVal: (string | undefined) = undef
		): (string | undefined) => {

	if (hOptions.hasOwnProperty(key)) {
		const val = hOptions[key]
		assert((typeof val === 'string'), `Not a string: ${val}`)
		return val
	}
	else {
		return defVal
	}
}

// ---------------------------------------------------------------------------

export const getBooleanOption = (
		hOptions: hash,
		key: string,
		defVal: boolean = false
		): boolean => {

	if (hOptions.hasOwnProperty(key)) {
		const val = hOptions[key]
		assert((typeof val === 'boolean'), `Not a boolean: ${val}`)
		return val
	}
	else {
		return defVal
	}
}

// ---------------------------------------------------------------------------
// ASYNC

export const tryCmd = async (
		func: TFileRunner,
		stub: string,
		purpose: (string | undefined),
		lArgs: string[] = [],
		hOptions: hash = {}
		): AutoPromise<void> => {

	try {
		await func(stub, purpose, lArgs, hOptions)
	}
	catch (err) {
		console.error(err)
		if (getBooleanOption(hOptions, 'exitOnFail', true)) {
			Deno.exit(99)
		}
		return
	}
}

// ---------------------------------------------------------------------------
//      RUNNERS (all ASYNC)
//      when run using tryCmd()
//         - false return will exit the script
//         - false return will cause a log message
// ---------------------------------------------------------------------------
// ASYNC

export const civet2tsFile = async (
		stub: string,
		purpose: (string | undefined)
		): AutoPromise<void> => {

	const fileName = buildFileName(stub, purpose, '.civet')
	LLOG('COMPILE', fileName)

	const path = findFile(fileName)
	assert(path, `No such file: ${fileName}`)

	if (newerDestFileExists(path, '.ts')) {
		ILOG("already compiled")
		return
	}

	const {success} = await execCmd('deno', [
		'run',
		'-A',
		'npm:@danielx/civet',
		'--inline-map',
		'-o', '.ts',
		'-c', path
		])
	if (success) {
		ILOG("OK")
	}
	else {
		ILOG("FAILED")
		rmFile(withExt(fileName, '.ts'))
		croak(`Compile of ${fileName} failed`)
	}

	// --- Type check the *.ts file
	LOG(`TYPE CHECK: ${fileName}`)
	const h = await execCmd('deno', [
		'check',
		withExt(path, '.ts')
		])

	if (h.success) {
		ILOG("OK")
	}
	else {
		ILOG("FAILED")
		rmFile(withExt(fileName, '.ts'))
		croak(`Type Check of ${fileName} failed`)
	}
	return
}

// ---------------------------------------------------------------------------
// ASYNC

export const doUnitTest = async (
		stub: string,
		purpose: (string | undefined),      // purpose of the file being tested
		lArgs: string[] = []
		): AutoPromise<void> => {

	const fileName = buildTestFileName(stub, purpose, '.civet')
	LLOG("UNIT TEST", fileName)

	const testPath = findFile(fileName)
	if (notdefined(testPath)) {
		ILOG(`There is no unit test for ${fileName}`)
		return
	}
	DBG(`TEST FILE: ${relpath(testPath)}`)

	if (!newerDestFileExists(testPath, '.ts')) {
		LLOG('COMPILE', relpath(testPath))
		const {success} = await execCmd('deno', [
			'run',
			'-A',
			'npm:@danielx/civet',
			'--inline-map',
			'-o', '.ts',
			'-c', testPath
			])
		assert(success, `   Compile of ${testPath} failed`)
	}

	const tsTestPath = relpath(withExt(testPath, '.ts'))
	const verbose = flag('v')
	const lCmdArgs = (
		  verbose
		? ['test', '-A', '--coverage-raw-data-only', tsTestPath]
		: ['test', '-A', '--coverage-raw-data-only', '--reporter', 'dot', tsTestPath]
		)

	const h = await execCmd('deno', lCmdArgs)
	assert(h.success, "   FAILED")
	return
}

// ---------------------------------------------------------------------------
// ASYNC

export const doInstallCmd = async (
		stub: string,
		purpose: (string | undefined) = 'cmd',
		lArgs: string[] = [],
		hOptions: hash = {}
		): AutoPromise<void> => {

	const fileName = buildFileName(stub, purpose, '.ts')
	LOG(`INSTALL CMD: ${fileName}`)

	const path = findFile(fileName)
	assert(path, `No such file: ${fileName}`)

	const name = getStringOption(hOptions, 'name') || parsePath(path).stub
	const h = await execCmd('deno', [
		'install',
		'-fgA',
		'-n', name,
		'--no-config',
		'--import-map', 'import_map.jsonc',
		path
		])
	assert(h.success, "   FAILED")
	LOG("   OK")
	return
}

// ---------------------------------------------------------------------------
// ASYNC

export const doRun = async (
		stub: string,
		purpose: (string | undefined),
		lArgs: string[] = [],
		hOptions: hash = {}
		): AutoPromise<void> => {

	const fileName = buildFileName(stub, purpose, '.ts')
	LOG(centered(`RUN: ${fileName}`, 64, '-'))

	const path = findFile(fileName)
	assert(path, `No such file: ${fileName}`)

	const h = (
		  getBooleanOption(hOptions, 'debug')
		? await execCmd('deno', [
			'run',
			'-A',
			'--inspect-brk',
			path,
			'--',
			...lArgs
			])
		: await execCmd('deno', [
			'run',
			'-A',
			path,
			'--',
			...lArgs
			])
		)
	assert(h.success, "   FAILED")
	return
}

// ---------------------------------------------------------------------------

export const sep = (
		width: number = 64,
		char: string = '-'
		): string => {

	return char.repeat(width)
}

// ---------------------------------------------------------------------------
// --- valid options:
//        char - char to use on left and right
//        buffer - num spaces around text when char <> ' '

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
		return ' '.repeat(numLeft) + text + ' '.repeat(numRight)
	}
	else {
		const buf = ' '.repeat(numBuffer)
		const left = char.repeat(numLeft - numBuffer)
		const right = char.repeat(numRight - numBuffer)
		return left + buf + text + buf + right
	}
}

// ---------------------------------------------------------------------------

export const lAllLibs = [
	'base-utils', 'datatypes', 'llutils', 'db', 'indent', 'unicode',
	'to-nice', 'extract', 'log-levels', 'log-formatter', 'logger', 'text-table',

	'parser', 'cmd-args',
	'walker', 'fsys', 'pll', 'exec', 'from-nice',

	'source-map', 'symbols', 'typescript', 'civet', 'cielo',
	'automate', 'v8-stack', 'unit-test',
	]

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQzpcXFVzZXJzXFxqb2huZFxcdXRpbHNcXHNyY1xcbGliXFxiYXNlLXV0aWxzLmxpYi5jaXZldC50c3giLCJzb3VyY2VzIjpbIkM6XFxVc2Vyc1xcam9obmRcXHV0aWxzXFxzcmNcXGxpYlxcYmFzZS11dGlscy5saWIuY2l2ZXQiXSwibWFwcGluZ3MiOiI7QUFBQSx1QkFBc0I7QUFDdEIsQUFBQTtBQUNBLEssVyx5QjtBQUFBLE1BQU0sQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksQ0FBQyxpQkFBaUI7QUFDdEMsQUFBQSxBQUFBLE1BQU0sQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxXQUFXO0FBQ3pDLEFBQUEsQUFBQSxNQUFNLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxJQUFJLENBQUMsYUFBYTtBQUN0QyxBQUFBLEFBQUEsTUFBTSxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsSUFBSSxDQUFDLFNBQVM7QUFDaEMsQUFBQSxBQUFBLE1BQU0sQ0FBQyxDQUFDLGNBQWMsQ0FBQyxDQUFDLElBQUksQ0FBQyx5QkFBeUI7QUFDdEQsQUFBQTtBQUNBLEFBQUEsQUFBQSxNQUFNLENBQUMsQ0FBQyxNQUFNLENBQUM7QUFDZixBQUFBLEFBQU8sTUFBUCxPQUFPLENBQUMsQ0FBRSxDQUFDLEdBQUcsQ0FBQyxXQUFXLENBQUMsQ0FBQztBQUM1QixBQUFBLEFBQU0sTUFBTixNQUFNLENBQUMsQ0FBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFBLENBQUE7QUFDekMsQUFBQSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUMsQztBQUFDLENBQUE7QUFDekIsQUFBQTtBQUNBLEFBQUEsQUFBQSxNQUFNLENBQUksTUFBSCxHQUFHLENBQUMsQ0FBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxJ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RyxDQUFDLENBQUEsTUFBQSxHQUFHLENBQUMsRUFBRSxDQUFDLFFBQVEsQ0FBQSxDQUFBLENBQUE7QUFDcEIsQUFBQSxFQUFFLEdBQUcsQ0FBQSxFQUFFLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFBLENBQUEsQ0FBQTtBQUNqQixBQUFBLEdBQUcsTUFBTSxDQUFDLEk7RUFBSSxDO0NBQUEsQ0FBQTtBQUNkLEFBQUEsQ0FBQyxNQUFNLENBQUMsSztBQUFLLENBQUE7QUFDYixBQUFBO0FBQ0EsQUFBQSw4RUFBNkU7QUFDN0UsQUFBQTtBQUNBLEFBQUEsQUFBQSxNQUFNLENBQVUsTUFBVCxTQUFTLENBQUMsQ0FBRSxDQUFDLENBQUM7QUFDckIsQUFBQSxFQUFFLEdBQUcsQ0FBQyxDQUFDLE1BQU0sQ0FBQztBQUNkLEFBQUEsRUFBRSxRQUFRLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSTtBQUNoQyxFQUFFLENBQUMsQyxDLENBQUMsQUFBQyxNLFksQ0FBTyxDQUFDLEVBQUUsQ0FBQSxDQUFBO0FBQ2YsQUFBQTtBQUNBLEFBQUEsQ0FBQyxHQUFHLENBQUMsQ0FBQSxNQUFBLEdBQUcsQ0FBQyxFQUFFLENBQUMsUUFBUSxDQUFBLENBQUEsQ0FBQTtBQUNwQixBQUFBLEVBQUUsR0FBRyxDQUFBLENBQUksSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQSxDQUFBLENBQUE7QUFDdkIsQUFBQSxHQUFHLEdBQUcsQ0FBQyxHQUFHLENBQUMsR0FBRSxDQUFDLENBQUMsQ0FBQyxDQUFBLENBQUE7QUFDaEIsQUFBQSxJQUFJLE1BQU0sQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLEdBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxHO0dBQUcsQ0FBQTtBQUNqRCxBQUFBLEdBQUcsSUFBSSxDQUFBLENBQUE7QUFDUCxBQUFBLElBQUksR0FBRyxDLEVBQUcsQ0FBQyxDO0dB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QUM7QUFDdEIsQUFBQSxDQUFDLFFBQVEsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLFdBQVcsQ0FBQTtBQUM3QyxBQUFBO0FBQ0EsQUFBQSxDQUFDLFlBQVksQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLFlBQVksQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLE9BQU8sQ0FBQztBQUN6RCxBQUFBLENBQUMsVUFBVSxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsV0FBVyxDQUFDO0FBQ3JDLEFBQUEsQ0FBQyxDQUFDO0FBQ0YiLCJuYW1lcyI6W10sInNvdXJjZXNDb250ZW50IjpbIiMgYmFzZS11dGlscy5saWIuY2l2ZXRcclxuXHJcbmltcG9ydCB7YXNzZXJ0fSBmcm9tICdqc3I6QHN0ZC9hc3NlcnQnXHJcbmltcG9ydCB7cmVsYXRpdmUsIHBhcnNlfSBmcm9tICdub2RlOnBhdGgnXHJcbmltcG9ydCB7ZXhpc3RzU3luY30gZnJvbSAnanNyOkBzdGQvZnMnXHJcbmltcG9ydCB7c3RhdFN5bmN9IGZyb20gJ25vZGU6ZnMnXHJcbmltcG9ydCB7ZXhwYW5kR2xvYlN5bmN9IGZyb20gJ2pzcjpAc3RkL2ZzL2V4cGFuZC1nbG9iJ1xyXG5cclxuZXhwb3J0IHthc3NlcnR9XHJcbmRlY29kZXIgOj0gbmV3IFRleHREZWNvZGVyKClcclxuZGVjb2RlIDo9ICh4OiBVaW50OEFycmF5PEFycmF5QnVmZmVyPikgPT5cclxuXHRyZXR1cm4gZGVjb2Rlci5kZWNvZGUoeClcclxuXHJcbmV4cG9ydCBESVIgOj0gKHg6IHVua25vd24pOiB2b2lkID0+XHJcblx0Y29uc29sZS5kaXIgeCwge2RlcHRoOiBudWxsfVxyXG5cclxuZXhwb3J0IHR5cGUgVENvbnN0cnVjdG9yPFQ+ID0gbmV3ICguLi5hcmdzOiBhbnlbXSkgPT4gVFxyXG5cclxubGV0IGhhc0NsZWFyID0gZmFsc2VcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgY2hlY2tTZXR1cCA6PSAoKTogdm9pZCA9PlxyXG5cclxuXHRyb290RGlyOiBzdHJpbmc/IDo9IERlbm8uZW52LmdldCgnUFJPSkVDVF9ST09UX0RJUicpXHJcblx0YXNzZXJ0SXNEZWZpbmVkKHJvb3REaXIpXHJcblx0YXNzZXJ0IGV4aXN0c1N5bmMocm9vdERpcikgJiYgc3RhdFN5bmMocm9vdERpcikuaXNEaXJlY3RvcnkoKSxcclxuXHRcdFwiUGxlYXNlIHNldCBlbnYgdmFyIFBST0pFQ1RfUk9PVF9ESVIgdG8gYSB2YWxpZCBkaXJlY3RvcnlcIlxyXG5cdHJldHVyblxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbmV4cG9ydCBjb25kQ2xlYXIgOj0gKFxyXG5cdFx0bENtZEFyZ3M6IHN0cmluZ1tdID0gRGVuby5hcmdzXHJcblx0XHQpOiB2b2lkID0+XHJcblxyXG5cdGlmIChEZW5vLmFyZ3MuYXQoLTEpID09ICchJylcclxuXHRcdGhhc0NsZWFyID0gdHJ1ZVxyXG5cdFx0ZXhlY0NtZCAnY2xlYXInXHJcblx0cmV0dXJuXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuZXhwb3J0IHN0ZENoZWNrcyA6PSAoKTogdm9pZCA9PlxyXG5cclxuXHRjaGVja1NldHVwKClcclxuXHRjb25kQ2xlYXIoKVxyXG5cdHJldHVyblxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbmV4cG9ydCBGQUlMIDo9IChlcnJNc2c6IHN0cmluZywgbjogbnVtYmVyID0gOTkpOiBuZXZlciA9PlxyXG5cclxuXHRjb25zb2xlLmxvZyBlcnJNc2dcclxuXHREZW5vLmV4aXQobilcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgU1VDQ0VFRCA6PSAobXNnOiBzdHJpbmc/ID0gdW5kZWYpOiBuZXZlciA9PlxyXG5cclxuXHRpZiBkZWZpbmVkKG1zZylcclxuXHRcdGNvbnNvbGUubG9nIG1zZ1xyXG5cdERlbm8uZXhpdCgwKVxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuIyAgICAgICAgICAgICBjbWQtYXJnc1xyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuZXhwb3J0IGZsYWcgOj0gKFxyXG5cdFx0Y2g6IHN0cmluZ1xyXG5cdFx0bENtZEFyZ3M6IHN0cmluZ1tdID0gRGVuby5hcmdzXHJcblx0XHQpOiBib29sZWFuID0+XHJcblxyXG5cdGFzc2VydCAoY2gubGVuZ3RoID09IDEpLCBcIkJhZCBmbGFnIGFyZzogI3tjaH1cIlxyXG5cdHJlIDo9IG5ldyBSZWdFeHAoXCJeLVthLXpdKiN7Y2h9W2Etel0qJFwiKVxyXG5cdGZvciBzdHIgb2YgbENtZEFyZ3NcclxuXHRcdGlmIHJlLnRlc3Qoc3RyKVxyXG5cdFx0XHRyZXR1cm4gdHJ1ZVxyXG5cdHJldHVybiBmYWxzZVxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbmV4cG9ydCBub25PcHRpb24gOj0gKFxyXG5cdFx0cG9zOiBudW1iZXIsXHJcblx0XHRsQ21kQXJnczogc3RyaW5nW10gPSBEZW5vLmFyZ3NcclxuXHRcdCk6IHN0cmluZz8gPT5cclxuXHJcblx0Zm9yIHN0ciBvZiBsQ21kQXJnc1xyXG5cdFx0aWYgbm90IC9eLS8udGVzdChzdHIpXHJcblx0XHRcdGlmIChwb3MgPT0gMClcclxuXHRcdFx0XHRyZXR1cm4gaGFzQ2xlYXIgJiYgKHN0ciA9PSAnIScpID8gdW5kZWYgOiBzdHJcclxuXHRcdFx0ZWxzZVxyXG5cdFx0XHRcdHBvcyAtPSAxXHJcblx0cmV0dXJuIHVuZGVmXHJcblxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuIyAgICAgICAgICAgICBsb2dnZXJcclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbmV4cG9ydCBMT0cgOj0gY29uc29sZS5sb2dcclxuXHJcbmV4cG9ydCBEQkcgOj0gKG1zZzogc3RyaW5nKTogdm9pZCA9PlxyXG5cdGlmIGZsYWcoJ0QnKVxyXG5cdFx0TE9HIG1zZ1xyXG5cdHJldHVyblxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbmV4cG9ydCBMTE9HIDo9IChcclxuXHRcdGxhYmVsOiBzdHJpbmdcclxuXHRcdG1zZzogc3RyaW5nXHJcblx0XHQpOiB2b2lkID0+XHJcblxyXG5cdGxhYmVsTGVuIDo9IDE1XHJcblx0aWYgKGxhYmVsLmxlbmd0aCA8PSBsYWJlbExlbilcclxuXHRcdHNwYWNlcyA6PSAnICcucmVwZWF0KGxhYmVsTGVuLWxhYmVsLmxlbmd0aClcclxuXHRcdExPRyBcIiN7bGFiZWx9I3tzcGFjZXN9ICN7bXNnfVwiXHJcblx0ZWxzZVxyXG5cdFx0TE9HIFwiI3tsYWJlbC5zdWJzdHJpbmcoMCwgbGFiZWxMZW4pfSAje21zZ31cIlxyXG5cdHJldHVyblxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbmV4cG9ydCBJTE9HIDo9IChtc2c6IHN0cmluZyk6IHZvaWQgPT5cclxuXHJcblx0TE9HIFwiICAgI3ttc2d9XCJcclxuXHRyZXR1cm5cclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbiMgICAgICAgICAgICAgZGF0YXR5cGVzXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgdHlwZSBoYXNoXHJcblx0W2tleTogc3RyaW5nIHwgc3ltYm9sXTogdW5rbm93blxyXG5cclxuZXhwb3J0IHR5cGUgVERlZmluZWQgPSBOb25OdWxsYWJsZTx1bmtub3duPlxyXG5leHBvcnQgdHlwZSBUTm90RGVmaW5lZCA9IG51bGwgfCB1bmRlZmluZWRcclxuXHJcbmV4cG9ydCB1bmRlZiA6PSB1bmRlZmluZWRcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgZGVmaW5lZCA6PSAoeDogdW5rbm93bik6IHggaXMgVERlZmluZWQgPT5cclxuXHJcblx0cmV0dXJuICh4ICE9IHVuZGVmKSAmJiAoeCAhPSBudWxsKVxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbmV4cG9ydCBub3RkZWZpbmVkIDo9ICh4OiB1bmtub3duKTogeCBpcyBUTm90RGVmaW5lZCA9PlxyXG5cclxuXHRyZXR1cm4gKHggPT0gdW5kZWYpIHx8ICh4ID09IG51bGwpXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGFzc2VydElzRGVmaW5lZChcclxuXHRcdHZhbHVlOiB1bmtub3duXHJcblx0XHRuYW1lOiBzdHJpbmcgPSAnJ1xyXG5cdFx0KTogYXNzZXJ0cyB2YWx1ZSBpcyBURGVmaW5lZCA9PlxyXG5cclxuXHRpZiBub3RkZWZpbmVkKHZhbHVlKVxyXG5cdFx0dGhyb3cgbmV3IEVycm9yKFwidmFsdWUgaXMgbm90IGRlZmluZWRcIilcclxuXHRyZXR1cm5cclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgZnVuY3Rpb24gYXNzZXJ0Tm90RGVmaW5lZChcclxuXHRcdHZhbHVlOiB1bmtub3duXHJcblx0XHRuYW1lOiBzdHJpbmcgPSAnJ1xyXG5cdFx0KTogYXNzZXJ0cyB2YWx1ZSBpcyBUTm90RGVmaW5lZCA9PlxyXG5cclxuXHRpZiBkZWZpbmVkKHZhbHVlKVxyXG5cdFx0dGhyb3cgbmV3IEVycm9yKFwidmFsdWUgaXMgZGVmaW5lZFwiKVxyXG5cdHJldHVyblxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbmV4cG9ydCBjcm9hayA6PSAobXNnOiBzdHJpbmcpOiBuZXZlciA9PlxyXG5cclxuXHR0aHJvdyBuZXcgRXJyb3IobXNnKVxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbmV4cG9ydCByZXBsYWNlSW5BcnJheSA6PSAoXHJcblx0bFN0cmluZ3M6IHN0cmluZ1tdXHJcblx0aFJlcGxhY2U6IHtba2V5OiBzdHJpbmddOiBzdHJpbmd9XHJcblx0KTogc3RyaW5nW10gPT5cclxuXHJcblx0cmV0dXJuIGZvciBzdHIgb2YgbFN0cmluZ3NcclxuXHRcdGlmIGhSZXBsYWNlLmhhc093blByb3BlcnR5KHN0cilcclxuXHRcdFx0aFJlcGxhY2Vbc3RyXVxyXG5cdFx0ZWxzZVxyXG5cdFx0XHRzdHJcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbiMgICAgICAgICAgICAgZnN5c1xyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuZXhwb3J0IGlzRmlsZSA6PSAocGF0aDogc3RyaW5nKTogYm9vbGVhbiA9PlxyXG5cclxuXHRyZXR1cm4gZXhpc3RzU3luYyhwYXRoKSAmJiBzdGF0U3luYyhwYXRoKS5pc0ZpbGUoKVxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbmV4cG9ydCBzbHVycCA6PSAocGF0aDogc3RyaW5nKTogc3RyaW5nID0+XHJcblxyXG5cdGRhdGEgOj0gRGVuby5yZWFkRmlsZVN5bmMgcGF0aFxyXG5cdHJldHVybiBkZWNvZGVyLmRlY29kZShkYXRhKS5yZXBsYWNlQWxsKCdcXHInLCAnJylcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgcm1GaWxlIDo9IChwYXRoOiBzdHJpbmcpOiB2b2lkID0+XHJcblxyXG5cdGlmIGV4aXN0c1N5bmMgcGF0aFxyXG5cdFx0RGVuby5yZW1vdmVTeW5jIHBhdGhcclxuXHRyZXR1cm5cclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgZmlsZUV4dCA6PSAocGF0aDogc3RyaW5nKTogc3RyaW5nID0+XHJcblxyXG5cdGlmIGxNYXRjaGVzIDo9IHBhdGgubWF0Y2goL1xcLlteXFwuXSskLylcclxuXHRcdHJldHVybiBsTWF0Y2hlc1swXVxyXG5cdGVsc2VcclxuXHRcdHJldHVybiAnJ1xyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbmV4cG9ydCB3aXRoRXh0IDo9IChwYXRoOiBzdHJpbmcsIGV4dDogc3RyaW5nKTogc3RyaW5nID0+XHJcblxyXG5cdGxNYXRjaGVzIDo9IHBhdGgubWF0Y2ggL14oLiopKFxcLlteXFwuXSspJC9cclxuXHRpZiAobE1hdGNoZXMgPT0gbnVsbClcclxuXHRcdGNyb2FrIFwiQmFkIHBhdGg6ICcje3BhdGh9J1wiXHJcblx0XHRyZXR1cm4gJydcclxuXHRlbHNlXHJcblx0XHRbXywgaGVhZFN0ciwgb3JnRXh0XSA6PSBsTWF0Y2hlc1xyXG5cdFx0cmV0dXJuIFwiI3toZWFkU3RyfSN7ZXh0fVwiXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuZXhwb3J0IG5vcm1hbGl6ZVBhdGggOj0gKHBhdGg6IHN0cmluZyk6IHN0cmluZyA9PlxyXG5cclxuXHRucGF0aCA6PSBwYXRoLnJlcGxhY2VBbGwoJ1xcXFwnLCAnLycpXHJcblx0aWYgKG5wYXRoLmNoYXJBdCgxKSA9PSAnOicpXHJcblx0XHRyZXR1cm4gbnBhdGguY2hhckF0KDApLnRvVXBwZXJDYXNlKCkgKyBucGF0aC5zdWJzdHJpbmcoMSlcclxuXHRlbHNlXHJcblx0XHRyZXR1cm4gbnBhdGhcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgcmVscGF0aCA6PSAocGF0aDogc3RyaW5nKTogc3RyaW5nID0+XHJcblxyXG5cdHJldHVybiBub3JtYWxpemVQYXRoKHJlbGF0aXZlKCcnLCBwYXRoKSlcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgYnVpbGRGaWxlTmFtZSA6PSAoXHJcblx0XHRzdHViOiBzdHJpbmdcclxuXHRcdHB1cnBvc2U6IHN0cmluZz9cclxuXHRcdGV4dDogc3RyaW5nXHJcblx0XHQpID0+XHJcblxyXG5cdHJldHVybiAoXHJcblx0XHRwdXJwb3NlID8gXCIje3N0dWJ9LiN7cHVycG9zZX0je2V4dH1cIlxyXG5cdFx0ICAgICAgICA6IFwiI3tzdHVifSN7ZXh0fVwiXHJcblx0XHQpXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuZXhwb3J0IGJ1aWxkVGVzdEZpbGVOYW1lIDo9IChcclxuXHRcdHN0dWI6IHN0cmluZ1xyXG5cdFx0cHVycG9zZTogc3RyaW5nP1xyXG5cdFx0ZXh0OiBzdHJpbmdcclxuXHRcdCkgPT5cclxuXHJcblx0cmV0dXJuIChcclxuXHRcdHB1cnBvc2UgPyBcIiN7c3R1Yn0uI3twdXJwb3NlfS50ZXN0I3tleHR9XCJcclxuXHRcdCAgICAgICAgOiBcIiN7c3R1Yn0udGVzdCN7ZXh0fVwiXHJcblx0XHQpXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuZXhwb3J0IHR5cGUgVFBhdGhJbmZvID0ge1xyXG5cdHJvb3Q6IHN0cmluZ1xyXG5cdGRpcjogc3RyaW5nXHJcblx0ZmlsZU5hbWU6IHN0cmluZ1xyXG5cclxuXHRzdHViOiBzdHJpbmdcclxuXHRwdXJwb3NlOiBzdHJpbmc/XHJcblx0ZXh0OiBzdHJpbmdcclxuXHR9XHJcblxyXG5leHBvcnQgcGFyc2VQYXRoIDo9IChcclxuXHRcdHBhdGg6IHN0cmluZ1xyXG5cdFx0KTogVFBhdGhJbmZvID0+XHJcblxyXG5cdHtyb290LCBkaXIsIGJhc2V9IDo9IHBhcnNlKHBhdGgpXHJcblxyXG5cdGxQYXJ0cyA6PSBiYXNlLnNwbGl0KCcuJylcclxuXHRhc3NlcnQgKGxQYXJ0cy5sZW5ndGggPiAyKSwgXCJCYWQgcGF0aDogI3twYXRofVwiXHJcblx0cmV0dXJuIHtcclxuXHRcdHJvb3Q6IG5vcm1hbGl6ZVBhdGgocm9vdClcclxuXHRcdGRpcjogbm9ybWFsaXplUGF0aChkaXIpXHJcblx0XHRmaWxlTmFtZTogYmFzZVxyXG5cclxuXHRcdHN0dWI6ICAgIGxQYXJ0cy5zbGljZSgwLCAtMikuam9pbignLicpXHJcblx0XHRwdXJwb3NlOiBsUGFydHMuYXQoLTIpXHJcblx0XHRleHQ6ICAgICBcIi4je2xQYXJ0cy5hdCgtMSl9XCJcclxuXHRcdH1cclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgdHlwZSBURXhlY1Jlc3VsdCA9IHtcclxuXHRzdWNjZXNzOiBib29sZWFuXHJcblx0Y29kZTogbnVtYmVyXHJcblx0c2lnbmFsPzogRGVuby5TaWduYWwgfCBudWxsXHJcblx0c3Rkb3V0Pzogc3RyaW5nXHJcblx0c3RkZXJyPzogc3RyaW5nXHJcblx0fVxyXG5cclxuZXhwb3J0IHR5cGUgVFJlcGxhY2VIYXNoID0ge1xyXG5cdFtrZXk6IHN0cmluZ106IHN0cmluZ1xyXG5cdH1cclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbiMgQVNZTkNcclxuXHJcbmV4cG9ydCBleGVjQ21kIDo9IChcclxuXHRjbWROYW1lOiBzdHJpbmdcclxuXHRsQ21kQXJnczogc3RyaW5nW10gPSBbXVxyXG5cdGhSZXBsYWNlOiBUUmVwbGFjZUhhc2ggPSB7fVxyXG5cdGNhcHR1cmU6IGJvb2xlYW4gPSBmYWxzZVxyXG5cdCk6IFRFeGVjUmVzdWx0ID0+XHJcblxyXG5cdGNoaWxkIDo9IG5ldyBEZW5vLkNvbW1hbmQoY21kTmFtZSwge1xyXG5cdFx0YXJnczogcmVwbGFjZUluQXJyYXkobENtZEFyZ3MsIGhSZXBsYWNlKVxyXG5cdFx0c3Rkb3V0OiBjYXB0dXJlID8gJ3BpcGVkJyA6ICdpbmhlcml0J1xyXG5cdFx0c3RkZXJyOiBjYXB0dXJlID8gJ3BpcGVkJyA6ICdpbmhlcml0J1xyXG5cdFx0fSlcclxuXHRpZiBjYXB0dXJlXHJcblx0XHR7c3VjY2VzcywgY29kZSwgc2lnbmFsLCBzdGRvdXQsIHN0ZGVycn0gOj0gYXdhaXQgY2hpbGQub3V0cHV0KClcclxuXHRcdHJldHVybiB7XHJcblx0XHRcdHN1Y2Nlc3MsIGNvZGVcclxuXHRcdFx0c2lnbmFsOiBzaWduYWwgfHwgdW5kZWZcclxuXHRcdFx0c3Rkb3V0OiBkZWNvZGUoc3Rkb3V0KVxyXG5cdFx0XHRzdGRlcnI6IGRlY29kZShzdGRlcnIpXHJcblx0XHRcdH1cclxuXHRlbHNlXHJcblx0XHR7c3VjY2VzcywgY29kZSwgc2lnbmFsfSA6PSBhd2FpdCBjaGlsZC5vdXRwdXQoKVxyXG5cdFx0cmV0dXJuIHtcclxuXHRcdFx0c3VjY2Vzc1xyXG5cdFx0XHRjb2RlXHJcblx0XHRcdHNpZ25hbDogc2lnbmFsIHx8IHVuZGVmXHJcblx0XHRcdH1cclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgbmV3ZXJEZXN0RmlsZUV4aXN0cyA6PSAoXHJcblx0XHRwYXRoOiBzdHJpbmdcclxuXHRcdGV4dDogc3RyaW5nXHJcblx0XHQpOiBib29sZWFuID0+XHJcblxyXG5cdGRlc3RQYXRoIDo9IHdpdGhFeHQgcGF0aCwgZXh0XHJcblx0aWYgbm90IGV4aXN0c1N5bmMoZGVzdFBhdGgpXHJcblx0XHRyZXR1cm4gZmFsc2VcclxuXHRzcmNNUyA6PSBzdGF0U3luYyhwYXRoKS5tdGltZU1zXHJcblx0ZGVzdE1TIDo9IHN0YXRTeW5jKGRlc3RQYXRoKS5tdGltZU1zXHJcblx0cmV0dXJuIChkZXN0TVMgPiBzcmNNUylcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgY21kU3VjY2VlZHMgOj0gKFxyXG5cdFx0Y21kTmFtZTogc3RyaW5nXHJcblx0XHRsQXJnczogc3RyaW5nW10gPSBbXVxyXG5cdFx0KTogYm9vbGVhbiA9PlxyXG5cclxuXHRjaGlsZCA6PSBuZXcgRGVuby5Db21tYW5kIGNtZE5hbWUsIHtcclxuXHRcdGFyZ3M6IGxBcmdzXHJcblx0XHRzdGRvdXQ6ICdwaXBlZCdcclxuXHRcdHN0ZGVycjogJ3BpcGVkJ1xyXG5cdFx0fVxyXG5cdHJldHVybiBjaGlsZC5vdXRwdXRTeW5jKCkuc3VjY2Vzc1xyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbmV4cG9ydCBzcGxpdFBhdHRlcm5zIDo9IChcclxuXHRcdGxBbGxQYXRzOiBzdHJpbmcgfCBzdHJpbmdbXVxyXG5cdFx0KTogW3N0cmluZ1tdLCBzdHJpbmdbXV0gPT5cclxuXHJcblx0bFBvc1BhdHM6IHN0cmluZ1tdIDo9IFtdXHJcblx0bE5lZ1BhdHM6IHN0cmluZ1tdIDo9IFtdXHJcblxyXG5cdGlmICh0eXBlb2YgbEFsbFBhdHMgPT0gJ3N0cmluZycpXHJcblx0XHQjIC0tLSBBIHNpbmdsZSBzdHJpbmcgY2FuJ3QgYmUgYSBuZWdhdGl2ZSBwYXR0ZXJuXHJcblx0XHRhc3NlcnQgbm90IGxBbGxQYXRzLm1hdGNoKC9eXFwhLyksIFwiQmFkIGdsb2IgcGF0dGVybjogI3tsQWxsUGF0c31cIlxyXG5cdFx0bFBvc1BhdHMucHVzaCBsQWxsUGF0c1xyXG5cdGVsc2VcclxuXHRcdGZvciBwYXQgb2YgbEFsbFBhdHNcclxuXHRcdFx0bE1hdGNoZXMgOj0gcGF0Lm1hdGNoKC9eKFxcIVxccyopPyguKikkLylcclxuXHRcdFx0aWYgbE1hdGNoZXNcclxuXHRcdFx0XHRpZiBsTWF0Y2hlc1sxXVxyXG5cdFx0XHRcdFx0bE5lZ1BhdHMucHVzaCBsTWF0Y2hlc1syXVxyXG5cdFx0XHRcdGVsc2VcclxuXHRcdFx0XHRcdGxQb3NQYXRzLnB1c2ggbE1hdGNoZXNbMl1cclxuXHRyZXR1cm4gW2xQb3NQYXRzLCBsTmVnUGF0c11cclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbiMgR0VORVJBVE9SXHJcbiNcclxuIyAgICBVc2UgbGlrZTpcclxuIyAgICAgICBmb3IgcGF0aCBvZiBhbGxGaWxlc01hdGNoaW5nKGxQYXRzKVxyXG4jICAgICAgICAgIE9SXHJcbiMgICAgICAgbFBhdGhzIDo9IEFycmF5LmZyb20oYWxsRmlsZXNNYXRjaGluZyhsUGF0cykpXHJcbiNcclxuIyAgICBOT1RFOiBCeSBkZWZhdWx0LCBzZWFyY2hlcyBmcm9tIC4vc3JjXHJcblxyXG5leHBvcnQgYWxsRmlsZXNNYXRjaGluZyA6PSAoXHJcblx0XHRsUGF0dGVybnM6IHN0cmluZyB8IHN0cmluZ1tdXHJcblx0XHRoR2xvYk9wdGlvbnMgPSB7XHJcblx0XHRcdHJvb3Q6ICcuL3NyYydcclxuXHRcdFx0aW5jbHVkZURpcnM6IGZhbHNlXHJcblx0XHRcdH1cclxuXHRcdCk6IEdlbmVyYXRvcjxzdHJpbmcsIHZvaWQsIHZvaWQ+IC0+XHJcblxyXG5cdFtsUG9zUGF0cywgbE5lZ1BhdHNdIDo9IHNwbGl0UGF0dGVybnMgbFBhdHRlcm5zXHJcblx0aWYgZmxhZygnRCcpXHJcblx0XHRMT0cgXCJQQVRURVJOUzpcIlxyXG5cdFx0Zm9yIHBhdCBvZiBsUG9zUGF0c1xyXG5cdFx0XHRJTE9HIFwiUE9TOiAje3BhdH1cIlxyXG5cdFx0Zm9yIHBhdCBvZiBsTmVnUGF0c1xyXG5cdFx0XHRJTE9HIFwiTkVHOiAje3BhdH1cIlxyXG5cclxuXHRzZXRTa2lwIDo9IG5ldyBTZXQ8c3RyaW5nPigpXHJcblx0Zm9yIHBhdCBvZiBsTmVnUGF0c1xyXG5cdFx0Zm9yIHtwYXRofSBvZiBleHBhbmRHbG9iU3luYyhwYXQsIGhHbG9iT3B0aW9ucylcclxuXHRcdFx0c2V0U2tpcC5hZGQgcGF0aFxyXG5cclxuXHRmb3IgcGF0IG9mIGxQb3NQYXRzXHJcblx0XHRmb3Ige3BhdGh9IG9mIGV4cGFuZEdsb2JTeW5jKHBhdCwgaEdsb2JPcHRpb25zKVxyXG5cdFx0XHRpZiBub3Qgc2V0U2tpcC5oYXMgcGF0aFxyXG5cdFx0XHRcdERCRyBcIlBBVEg6ICN7cGF0aH1cIlxyXG5cdFx0XHRcdHlpZWxkIHBhdGhcclxuXHRcdFx0XHRzZXRTa2lwLmFkZCBwYXRoXHJcblx0cmV0dXJuXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuZXhwb3J0IGZpbmRGaWxlIDo9IChmaWxlTmFtZTogc3RyaW5nKTogc3RyaW5nPyA9PlxyXG5cclxuXHRsUGF0aHMgOj0gQXJyYXkuZnJvbSBhbGxGaWxlc01hdGNoaW5nKFwiKiovI3tmaWxlTmFtZX1cIilcclxuXHRzd2l0Y2ggbFBhdGhzLmxlbmd0aFxyXG5cdFx0d2hlbiAxXHJcblx0XHRcdHJldHVybiBsUGF0aHNbMF1cclxuXHRcdHdoZW4gMFxyXG5cdFx0XHRyZXR1cm4gdW5kZWZcclxuXHRcdGVsc2VcclxuXHRcdFx0Zm9yIHBhdGggb2YgbFBhdGhzXHJcblx0XHRcdFx0Y29uc29sZS5sb2cgcGF0aFxyXG5cdFx0XHRjcm9hayBcIk11bHRpcGxlIGZpbGVzIHdpdGggbmFtZSAje2ZpbGVOYW1lfVwiXHJcblx0XHRcdHJldHVybiAnJ1xyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuIyBBU1lOQ1xyXG5cclxuZXhwb3J0IHR5cGUgVFByb2NGdW5jID0gKHBhdGg6IHN0cmluZykgPT4gUHJvbWlzZTx1bmtub3duPlxyXG5leHBvcnQgdHlwZSBUUHJvY1Jlc3VsdCA9IHsgW3BhdGg6IHN0cmluZ106IHVua25vd24gfVxyXG5cclxuZXhwb3J0IHByb2NGaWxlcyA6PSAoXHJcblx0XHRsUGF0dGVybnM6IHN0cmluZyB8IHN0cmluZ1tdXHJcblx0XHRwcm9jRnVuYzogVFByb2NGdW5jXHJcblx0XHQpOiBbXHJcblx0XHRcdFRQcm9jUmVzdWx0ICAgICAjIHBhdGhzIHN1Y2NlZWRlZFxyXG5cdFx0XHRUUHJvY1Jlc3VsdD8gICAgIyBwYXRocyBmYWlsZWRcclxuXHRcdFx0XSA9PlxyXG5cclxuXHQjIC0tLSBXZSBuZWVkIHRoZSBwYXRocyBmb3IgbGF0ZXJcclxuXHRsUGF0aHMgOj0gQXJyYXkuZnJvbShhbGxGaWxlc01hdGNoaW5nKGxQYXR0ZXJucykpXHJcblxyXG5cdGxQcm9taXNlcyA6PSBmb3IgcGF0aCBvZiBsUGF0aHNcclxuXHRcdHByb2NGdW5jIHBhdGhcclxuXHRsUmVzdWx0cyA6PSBhd2FpdCBQcm9taXNlLmFsbFNldHRsZWQobFByb21pc2VzKVxyXG5cclxuXHRoU3VjY2VlZGVkOiBUUHJvY1Jlc3VsdCA6PSB7fVxyXG5cdGhGYWlsZWQ6ICAgIFRQcm9jUmVzdWx0IDo9IHt9XHJcblxyXG5cdCMgLS0tIGxSZXN1bHRzIGFyZSBpbiB0aGUgc2FtZSBvcmRlciBhcyBsUGF0aHNcclxuXHRsZXQgaGFzRmFpbGVkID0gZmFsc2VcclxuXHRmb3IgcmVzLGkgb2YgbFJlc3VsdHNcclxuXHRcdHBhdGggOj0gbFBhdGhzW2ldXHJcblx0XHRpZiAocmVzLnN0YXR1cyA9PSAnZnVsZmlsbGVkJylcclxuXHRcdFx0aFN1Y2NlZWRlZFtwYXRoXSA9IHJlcy52YWx1ZVxyXG5cdFx0ZWxzZVxyXG5cdFx0XHRoYXNGYWlsZWQgPSB0cnVlXHJcblx0XHRcdGhGYWlsZWRbcGF0aF0gPSByZXMucmVhc29uXHJcblxyXG5cdHJldHVybiBbXHJcblx0XHRoU3VjY2VlZGVkLFxyXG5cdFx0aGFzRmFpbGVkID8gaEZhaWxlZCA6IHVuZGVmXHJcblx0XHRdXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxudHlwZSBURmlsZVJ1bm5lciA9IChcclxuXHRcdHN0dWI6IHN0cmluZ1xyXG5cdFx0cHVycG9zZTogc3RyaW5nP1xyXG5cdFx0bEFyZ3M/OiBzdHJpbmdbXVxyXG5cdFx0aE9wdGlvbnM/OiBoYXNoXHJcblx0XHQpID0+IFByb21pc2U8dm9pZD5cclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgZ2V0U3RyaW5nT3B0aW9uIDo9IChcclxuXHRcdGhPcHRpb25zOiBoYXNoXHJcblx0XHRrZXk6IHN0cmluZ1xyXG5cdFx0ZGVmVmFsOiBzdHJpbmc/ID0gdW5kZWZcclxuXHRcdCk6IHN0cmluZz8gPT5cclxuXHJcblx0aWYgaE9wdGlvbnMuaGFzT3duUHJvcGVydHkga2V5XHJcblx0XHR2YWwgOj0gaE9wdGlvbnNba2V5XVxyXG5cdFx0YXNzZXJ0ICh0eXBlb2YgdmFsID09ICdzdHJpbmcnKSwgXCJOb3QgYSBzdHJpbmc6ICN7dmFsfVwiXHJcblx0XHRyZXR1cm4gdmFsXHJcblx0ZWxzZVxyXG5cdFx0cmV0dXJuIGRlZlZhbFxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbmV4cG9ydCBnZXRCb29sZWFuT3B0aW9uIDo9IChcclxuXHRcdGhPcHRpb25zOiBoYXNoXHJcblx0XHRrZXk6IHN0cmluZ1xyXG5cdFx0ZGVmVmFsOiBib29sZWFuID0gZmFsc2VcclxuXHRcdCk6IGJvb2xlYW4gPT5cclxuXHJcblx0aWYgaE9wdGlvbnMuaGFzT3duUHJvcGVydHkga2V5XHJcblx0XHR2YWwgOj0gaE9wdGlvbnNba2V5XVxyXG5cdFx0YXNzZXJ0ICh0eXBlb2YgdmFsID09ICdib29sZWFuJyksIFwiTm90IGEgYm9vbGVhbjogI3t2YWx9XCJcclxuXHRcdHJldHVybiB2YWxcclxuXHRlbHNlXHJcblx0XHRyZXR1cm4gZGVmVmFsXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4jIEFTWU5DXHJcblxyXG5leHBvcnQgdHJ5Q21kIDo9IChcclxuXHRcdGZ1bmM6IFRGaWxlUnVubmVyXHJcblx0XHRzdHViOiBzdHJpbmdcclxuXHRcdHB1cnBvc2U6IHN0cmluZz9cclxuXHRcdGxBcmdzOiBzdHJpbmdbXSA9IFtdXHJcblx0XHRoT3B0aW9uczogaGFzaCA9IHt9XHJcblx0XHQpOiB2b2lkID0+XHJcblxyXG5cdHRyeVxyXG5cdFx0YXdhaXQgZnVuYyhzdHViLCBwdXJwb3NlLCBsQXJncywgaE9wdGlvbnMpXHJcblx0Y2F0Y2ggZXJyXHJcblx0XHRjb25zb2xlLmVycm9yIGVyclxyXG5cdFx0aWYgZ2V0Qm9vbGVhbk9wdGlvbiBoT3B0aW9ucywgJ2V4aXRPbkZhaWwnLCB0cnVlXHJcblx0XHRcdERlbm8uZXhpdCg5OSlcclxuXHRcdHJldHVyblxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuIyAgICAgIFJVTk5FUlMgKGFsbCBBU1lOQylcclxuIyAgICAgIHdoZW4gcnVuIHVzaW5nIHRyeUNtZCgpXHJcbiMgICAgICAgICAtIGZhbHNlIHJldHVybiB3aWxsIGV4aXQgdGhlIHNjcmlwdFxyXG4jICAgICAgICAgLSBmYWxzZSByZXR1cm4gd2lsbCBjYXVzZSBhIGxvZyBtZXNzYWdlXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbiMgQVNZTkNcclxuXHJcbmV4cG9ydCBjaXZldDJ0c0ZpbGUgOj0gKFxyXG5cdFx0c3R1Yjogc3RyaW5nXHJcblx0XHRwdXJwb3NlOiBzdHJpbmc/XHJcblx0XHQpOiB2b2lkID0+XHJcblxyXG5cdGZpbGVOYW1lIDo9IGJ1aWxkRmlsZU5hbWUgc3R1YiwgcHVycG9zZSwgJy5jaXZldCdcclxuXHRMTE9HICdDT01QSUxFJywgZmlsZU5hbWVcclxuXHJcblx0cGF0aCA6PSBmaW5kRmlsZSBmaWxlTmFtZVxyXG5cdGFzc2VydCBwYXRoLCBcIk5vIHN1Y2ggZmlsZTogI3tmaWxlTmFtZX1cIlxyXG5cclxuXHRpZiBuZXdlckRlc3RGaWxlRXhpc3RzIHBhdGgsICcudHMnXHJcblx0XHRJTE9HIFwiYWxyZWFkeSBjb21waWxlZFwiXHJcblx0XHRyZXR1cm5cclxuXHJcblx0e3N1Y2Nlc3N9IDo9IGF3YWl0IGV4ZWNDbWQgJ2Rlbm8nLCBbXHJcblx0XHQncnVuJ1xyXG5cdFx0Jy1BJ1xyXG5cdFx0J25wbTpAZGFuaWVseC9jaXZldCdcclxuXHRcdCctLWlubGluZS1tYXAnXHJcblx0XHQnLW8nLCAnLnRzJ1xyXG5cdFx0Jy1jJywgcGF0aFxyXG5cdFx0XVxyXG5cdGlmIHN1Y2Nlc3NcclxuXHRcdElMT0cgXCJPS1wiXHJcblx0ZWxzZVxyXG5cdFx0SUxPRyBcIkZBSUxFRFwiXHJcblx0XHRybUZpbGUgd2l0aEV4dChmaWxlTmFtZSwgJy50cycpXHJcblx0XHRjcm9hayBcIkNvbXBpbGUgb2YgI3tmaWxlTmFtZX0gZmFpbGVkXCJcclxuXHJcblx0IyAtLS0gVHlwZSBjaGVjayB0aGUgKi50cyBmaWxlXHJcblx0TE9HIFwiVFlQRSBDSEVDSzogI3tmaWxlTmFtZX1cIlxyXG5cdGggOj0gYXdhaXQgZXhlY0NtZCAnZGVubycsIFtcclxuXHRcdCdjaGVjaycsXHJcblx0XHR3aXRoRXh0KHBhdGgsICcudHMnKVxyXG5cdFx0XVxyXG5cclxuXHRpZiBoLnN1Y2Nlc3NcclxuXHRcdElMT0cgXCJPS1wiXHJcblx0ZWxzZVxyXG5cdFx0SUxPRyBcIkZBSUxFRFwiXHJcblx0XHRybUZpbGUgd2l0aEV4dChmaWxlTmFtZSwgJy50cycpXHJcblx0XHRjcm9hayBcIlR5cGUgQ2hlY2sgb2YgI3tmaWxlTmFtZX0gZmFpbGVkXCJcclxuXHRyZXR1cm5cclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbiMgQVNZTkNcclxuXHJcbmV4cG9ydCBkb1VuaXRUZXN0IDo9IChcclxuXHRcdHN0dWI6IHN0cmluZ1xyXG5cdFx0cHVycG9zZTogc3RyaW5nPyAgICAgICMgcHVycG9zZSBvZiB0aGUgZmlsZSBiZWluZyB0ZXN0ZWRcclxuXHRcdGxBcmdzOiBzdHJpbmdbXSA9IFtdXHJcblx0XHQpOiB2b2lkID0+XHJcblxyXG5cdGZpbGVOYW1lIDo9IGJ1aWxkVGVzdEZpbGVOYW1lIHN0dWIsIHB1cnBvc2UsICcuY2l2ZXQnXHJcblx0TExPRyBcIlVOSVQgVEVTVFwiLCBmaWxlTmFtZVxyXG5cclxuXHR0ZXN0UGF0aCA6PSBmaW5kRmlsZSBmaWxlTmFtZVxyXG5cdGlmIG5vdGRlZmluZWQodGVzdFBhdGgpXHJcblx0XHRJTE9HIFwiVGhlcmUgaXMgbm8gdW5pdCB0ZXN0IGZvciAje2ZpbGVOYW1lfVwiXHJcblx0XHRyZXR1cm5cclxuXHREQkcgXCJURVNUIEZJTEU6ICN7cmVscGF0aCh0ZXN0UGF0aCl9XCJcclxuXHJcblx0aWYgbm90IG5ld2VyRGVzdEZpbGVFeGlzdHModGVzdFBhdGgsICcudHMnKVxyXG5cdFx0TExPRyAnQ09NUElMRScsIHJlbHBhdGgodGVzdFBhdGgpXHJcblx0XHR7c3VjY2Vzc30gOj0gYXdhaXQgZXhlY0NtZCAnZGVubycsIFtcclxuXHRcdFx0J3J1bidcclxuXHRcdFx0Jy1BJ1xyXG5cdFx0XHQnbnBtOkBkYW5pZWx4L2NpdmV0J1xyXG5cdFx0XHQnLS1pbmxpbmUtbWFwJ1xyXG5cdFx0XHQnLW8nLCAnLnRzJ1xyXG5cdFx0XHQnLWMnLCB0ZXN0UGF0aFxyXG5cdFx0XHRdXHJcblx0XHRhc3NlcnQgc3VjY2VzcywgXCIgICBDb21waWxlIG9mICN7dGVzdFBhdGh9IGZhaWxlZFwiXHJcblxyXG5cdHRzVGVzdFBhdGggOj0gcmVscGF0aCh3aXRoRXh0KHRlc3RQYXRoLCAnLnRzJykpXHJcblx0dmVyYm9zZSA6PSBmbGFnKCd2JylcclxuXHRsQ21kQXJncyA6PSAoXHJcblx0XHQgIHZlcmJvc2VcclxuXHRcdD8gWyd0ZXN0JywgJy1BJywgJy0tY292ZXJhZ2UtcmF3LWRhdGEtb25seScsIHRzVGVzdFBhdGhdXHJcblx0XHQ6IFsndGVzdCcsICctQScsICctLWNvdmVyYWdlLXJhdy1kYXRhLW9ubHknLCAnLS1yZXBvcnRlcicsICdkb3QnLCB0c1Rlc3RQYXRoXVxyXG5cdFx0KVxyXG5cclxuXHRoIDo9IGF3YWl0IGV4ZWNDbWQgJ2Rlbm8nLCBsQ21kQXJnc1xyXG5cdGFzc2VydCBoLnN1Y2Nlc3MsIFwiICAgRkFJTEVEXCJcclxuXHRyZXR1cm5cclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbiMgQVNZTkNcclxuXHJcbmV4cG9ydCBkb0luc3RhbGxDbWQgOj0gKFxyXG5cdFx0c3R1Yjogc3RyaW5nLFxyXG5cdFx0cHVycG9zZTogc3RyaW5nPyA9ICdjbWQnXHJcblx0XHRsQXJnczogc3RyaW5nW10gPSBbXVxyXG5cdFx0aE9wdGlvbnM6IGhhc2ggPSB7fVxyXG5cdFx0KTogdm9pZCA9PlxyXG5cclxuXHRmaWxlTmFtZSA6PSBidWlsZEZpbGVOYW1lIHN0dWIsIHB1cnBvc2UsICcudHMnXHJcblx0TE9HIFwiSU5TVEFMTCBDTUQ6ICN7ZmlsZU5hbWV9XCJcclxuXHJcblx0cGF0aCA6PSBmaW5kRmlsZSBmaWxlTmFtZVxyXG5cdGFzc2VydCBwYXRoLCBcIk5vIHN1Y2ggZmlsZTogI3tmaWxlTmFtZX1cIlxyXG5cclxuXHRuYW1lIDo9IGdldFN0cmluZ09wdGlvbihoT3B0aW9ucywgJ25hbWUnKSB8fCBwYXJzZVBhdGgocGF0aCkuc3R1YlxyXG5cdGggOj0gYXdhaXQgZXhlY0NtZCAnZGVubycsIFtcclxuXHRcdCdpbnN0YWxsJyxcclxuXHRcdCctZmdBJyxcclxuXHRcdCctbicsIG5hbWUsXHJcblx0XHQnLS1uby1jb25maWcnLFxyXG5cdFx0Jy0taW1wb3J0LW1hcCcsICdpbXBvcnRfbWFwLmpzb25jJyxcclxuXHRcdHBhdGhcclxuXHRcdF1cclxuXHRhc3NlcnQgaC5zdWNjZXNzLCBcIiAgIEZBSUxFRFwiXHJcblx0TE9HIFwiICAgT0tcIlxyXG5cdHJldHVyblxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuIyBBU1lOQ1xyXG5cclxuZXhwb3J0IGRvUnVuIDo9IChcclxuXHRcdHN0dWI6IHN0cmluZ1xyXG5cdFx0cHVycG9zZTogc3RyaW5nP1xyXG5cdFx0bEFyZ3M6IHN0cmluZ1tdID0gW11cclxuXHRcdGhPcHRpb25zOiBoYXNoID0ge31cclxuXHRcdCk6IHZvaWQgPT5cclxuXHJcblx0ZmlsZU5hbWUgOj0gYnVpbGRGaWxlTmFtZSBzdHViLCBwdXJwb3NlLCAnLnRzJ1xyXG5cdExPRyBjZW50ZXJlZChcIlJVTjogI3tmaWxlTmFtZX1cIiwgNjQsICctJylcclxuXHJcblx0cGF0aCA6PSBmaW5kRmlsZSBmaWxlTmFtZVxyXG5cdGFzc2VydCBwYXRoLCBcIk5vIHN1Y2ggZmlsZTogI3tmaWxlTmFtZX1cIlxyXG5cclxuXHRoIDo9IChcclxuXHRcdCAgZ2V0Qm9vbGVhbk9wdGlvbihoT3B0aW9ucywgJ2RlYnVnJylcclxuXHRcdD8gYXdhaXQgZXhlY0NtZCAnZGVubycsIFtcclxuXHRcdFx0J3J1bidcclxuXHRcdFx0Jy1BJ1xyXG5cdFx0XHQnLS1pbnNwZWN0LWJyaydcclxuXHRcdFx0cGF0aFxyXG5cdFx0XHQnLS0nXHJcblx0XHRcdGxBcmdzLi4uXHJcblx0XHRcdF1cclxuXHRcdDogYXdhaXQgZXhlY0NtZCAnZGVubycsIFtcclxuXHRcdFx0J3J1bidcclxuXHRcdFx0Jy1BJ1xyXG5cdFx0XHRwYXRoXHJcblx0XHRcdCctLSdcclxuXHRcdFx0bEFyZ3MuLi5cclxuXHRcdFx0XVxyXG5cdFx0KVxyXG5cdGFzc2VydCBoLnN1Y2Nlc3MsIFwiICAgRkFJTEVEXCJcclxuXHRyZXR1cm5cclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgc2VwIDo9IChcclxuXHRcdHdpZHRoOiBudW1iZXIgPSA2NFxyXG5cdFx0Y2hhcjogc3RyaW5nID0gJy0nXHJcblx0XHQpOiBzdHJpbmcgPT5cclxuXHJcblx0cmV0dXJuIGNoYXIucmVwZWF0KHdpZHRoKVxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuIyAtLS0gdmFsaWQgb3B0aW9uczpcclxuIyAgICAgICAgY2hhciAtIGNoYXIgdG8gdXNlIG9uIGxlZnQgYW5kIHJpZ2h0XHJcbiMgICAgICAgIGJ1ZmZlciAtIG51bSBzcGFjZXMgYXJvdW5kIHRleHQgd2hlbiBjaGFyIDw+ICcgJ1xyXG5cclxuZXhwb3J0IGNlbnRlcmVkIDo9IChcclxuXHR0ZXh0OiBzdHJpbmcsXHJcblx0d2lkdGg6IG51bWJlcixcclxuXHRjaGFyOiBzdHJpbmcgPSAnICcsXHJcblx0bnVtQnVmZmVyOiBudW1iZXIgPSAyXHJcblx0KTogc3RyaW5nID0+XHJcblxyXG5cdHRvdFNwYWNlcyA6PSB3aWR0aCAtIHRleHQubGVuZ3RoXHJcblx0aWYgKHRvdFNwYWNlcyA8PSAwKVxyXG5cdFx0cmV0dXJuIHRleHRcclxuXHRudW1MZWZ0IDo9IE1hdGguZmxvb3IodG90U3BhY2VzIC8gMilcclxuXHRudW1SaWdodCA6PSB0b3RTcGFjZXMgLSBudW1MZWZ0XHJcblx0aWYgKGNoYXIgPT0gJyAnKVxyXG5cdFx0cmV0dXJuICcgJy5yZXBlYXQobnVtTGVmdCkgKyB0ZXh0ICsgJyAnLnJlcGVhdChudW1SaWdodClcclxuXHRlbHNlXHJcblx0XHRidWYgOj0gJyAnLnJlcGVhdChudW1CdWZmZXIpXHJcblx0XHRsZWZ0IDo9IGNoYXIucmVwZWF0KG51bUxlZnQgLSBudW1CdWZmZXIpXHJcblx0XHRyaWdodCA6PSBjaGFyLnJlcGVhdChudW1SaWdodCAtIG51bUJ1ZmZlcilcclxuXHRcdHJldHVybiBsZWZ0ICsgYnVmICsgdGV4dCArIGJ1ZiArIHJpZ2h0XHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuZXhwb3J0IGxBbGxMaWJzIDo9IFtcclxuXHQnYmFzZS11dGlscycsICdkYXRhdHlwZXMnLCAnbGx1dGlscycsICdkYicsICdpbmRlbnQnLCAndW5pY29kZScsXHJcblx0J3RvLW5pY2UnLCAnZXh0cmFjdCcsICdsb2ctbGV2ZWxzJywgJ2xvZy1mb3JtYXR0ZXInLCAnbG9nZ2VyJywgJ3RleHQtdGFibGUnLFxyXG5cclxuXHQncGFyc2VyJywgJ2NtZC1hcmdzJyxcclxuXHQnd2Fsa2VyJywgJ2ZzeXMnLCAncGxsJywgJ2V4ZWMnLCAnZnJvbS1uaWNlJ1xyXG5cclxuXHQnc291cmNlLW1hcCcsICdzeW1ib2xzJywgJ3R5cGVzY3JpcHQnLCAnY2l2ZXQnLCAnY2llbG8nLFxyXG5cdCdhdXRvbWF0ZScsICd2OC1zdGFjaycsICd1bml0LXRlc3QnLFxyXG5cdF1cclxuIl19