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

	debugger
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

export const mapNonOption = (str: string): string => {

	if (str.startsWith('=')) {
		const fileName = str.substring(1)
		const path = findFile(fileName)
		assert(defined(path), `No such file: ${fileName}`)
		return path
	}
	else {
		return str
	}
}

// ---------------------------------------------------------------------------

export const nonOption = (
		pos: number,
		lCmdArgs: string[] = Deno.args
		): (string | undefined) => {

	for (const str of lCmdArgs) {
		if (!str.startsWith('-')) {
			if (pos === 0) {
				return hasClear && (str === '!') ? undef : mapNonOption(str)
			}
			else {
				pos -= 1
			}
		}
	}
	return undef
}

// ---------------------------------------------------------------------------

export const allNonOptions = function*(
		lCmdArgs: string[] = Deno.args
		): Generator<string, void, void> {

	for (const str of lCmdArgs) {
		if (!str.startsWith('-') && ((str !== '!') || !hasClear)) {
			yield mapNonOption(str)
		}
	}
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
			return normalizePath(lPaths[0])
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

	debugger
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
			...(flag('d') ? ['--inspect-brk'] : []),
			'npm:@danielx/civet',
			'--inline-map',
			'-o', '.ts',
			'-c', testPath
			])
		if (!success) {
			croak(`   Compile of ${testPath} failed!`)
		}
	}

	const tsTestPath = relpath(withExt(testPath, '.ts'))
	const verbose = flag('v')
	const lCmdArgs = (
		  verbose
		? ['test', '-A', '--coverage-raw-data-only', tsTestPath]
		: ['test', '-A', '--coverage-raw-data-only', '--reporter', 'dot', tsTestPath]
		)

	const h = await execCmd('deno', lCmdArgs)
	assert(h.success, `   deno ${lCmdArgs.join(' ')} FAILED`)
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
		lArgs: string[] = []
		): AutoPromise<void> => {

	const fileName = buildFileName(stub, purpose, '.ts')
	LOG(centered(`RUN: ${fileName}`, 64, '-'))

	const path = findFile(fileName)
	assert(path, `No such file: ${fileName}`)

	const h = await execCmd('deno', [
		'run',
		'-A',
		...(flag('d') ? ['--inspect-brk'] : []),
		path,
		'--',
		...lArgs
		])

	assert(h.success, "   FAILED")
	return
}

// ---------------------------------------------------------------------------

export const sep = (
		label: (string | undefined) = undef,
		char: string = '-',
		width: number = 64
		): string => {

	if (defined(label)) {
		return centered(label, width, char)
	}
	else {
		return char.repeat(width)
	}
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
	'to-nice', 'extract', 'log-levels', 'log-formatter', 'logger',
	'text-table',

	'walker', 'scope', 'parser', 'fsys', 'pll', 'from-nice',
	'exec', 'cmd-args',

	'source-map', 'symbols', 'typescript', 'civet', 'cielo',
	'automate', 'v8-stack', 'unit-test',
	]

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQzovVXNlcnMvam9obmQvdXRpbHMvc3JjL2xpYi9iYXNlLXV0aWxzLmxpYi5jaXZldC50c3giLCJzb3VyY2VzIjpbIkM6L1VzZXJzL2pvaG5kL3V0aWxzL3NyYy9saWIvYmFzZS11dGlscy5saWIuY2l2ZXQiXSwibWFwcGluZ3MiOiI7QUFBQSx1QkFBc0I7QUFDdEIsQUFBQTtBQUNBLEssVyx5QjtBQUFBLE1BQU0sQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksQ0FBQyxpQkFBaUI7QUFDdEMsQUFBQSxBQUFBLE1BQU0sQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxXQUFXO0FBQ3pDLEFBQUEsQUFBQSxNQUFNLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxJQUFJLENBQUMsYUFBYTtBQUN0QyxBQUFBLEFBQUEsTUFBTSxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsSUFBSSxDQUFDLFNBQVM7QUFDaEMsQUFBQSxBQUFBLE1BQU0sQ0FBQyxDQUFDLGNBQWMsQ0FBQyxDQUFDLElBQUksQ0FBQyx5QkFBeUI7QUFDdEQsQUFBQTtBQUNBLEFBQUEsQUFBQSxNQUFNLENBQUMsQ0FBQyxNQUFNLENBQUM7QUFDZixBQUFBLEFBQU8sTUFBUCxPQUFPLENBQUMsQ0FBRSxDQUFDLEdBQUcsQ0FBQyxXQUFXLENBQUMsQ0FBQztBQUM1QixBQUFBLEFBQU0sTUFBTixNQUFNLENBQUMsQ0FBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFBLENBQUE7QUFDekMsQUFBQSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUMsQztBQUFDLENBQUE7QUFDekIsQUFBQTtBQUNBLEFBQUEsQUFBQSxNQUFNLENBQUksTUFBSCxHQUFHLENBQUMsQ0FBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFB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QztBQUNsQixBQUFBLEdBQUcsSUFBSSxDQUFDLENBQUMsT0FBTyxDQUFBO0FBQ2hCLEFBQUEsR0FBRyxXQUFXLENBQUMsQ0FBQyxLQUFLO0FBQ3JCLEdBQUcsQ0FBQztBQUNKLEVBQUUsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBSSxDQUFBLENBQUE7QUFDckMsQUFBQTtBQUNBLEFBQUEsQ0FBcUIsTUFBcEIsQ0FBQyxRQUFRLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFFLENBQUMsYUFBYSxDQUFBLEFBQUMsU0FBUyxDQUFBO0FBQ2hELEFBQUEsQ0FBQyxHQUFHLENBQUEsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFBLENBQUEsQ0FBQTtBQUNiLEFBQUEsRUFBRSxHQUFHLENBQUEsQUFBQyxXQUFXLENBQUE7QUFDakIsQUFBQSxFQUFFLEdBQUcsQ0FBQyxDQUFBLE1BQUEsR0FBRyxDQUFDLEVBQUUsQ0FBQyxRQUFRLENBQUEsQ0FBQSxDQUFBO0FBQ3JCLEFBQUEsR0FBRyxJQUFJLENBQUEsQUFBQyxDQUFDLEtBQUssRUFBRSxHQUFHLENBQUMsQ0FBQyxDO0VBQUEsQ0FBQTtBQUNyQixBQUFBLEVBQUUsR0FBRyxDQUFDLENBQUEsTUFBQSxHQUFHLENBQUMsRUFBRSxDQUFDLFFBQVEsQ0FBQSxDQUFBLENBQUE7QUFDckIsQUFBQSxHQUFHLElBQUksQ0FBQSxBQUFDLENBQUMsS0FBSyxFQUFFLEdBQUcsQ0FBQyxDQUFDLEM7RUFBQSxDO0NBQUEsQ0FBQTtBQUNyQixBQUFBO0FBQ0EsQUFBQSxDQUFRLE1BQVAsT0FBTyxDQUFDLENBQUUsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7QUFDN0IsQUFBQSxDQUFDLEdBQUcsQ0FBQyxDQUFBLE1BQUEsR0FBRyxDQUFDLEVBQUUsQ0FBQyxRQUFRLENBQUEsQ0FBQSxDQUFBO0FBQ3BCLEFBQUEsRUFBRSxHQUFHLENBQUMsQ0FBQSxNQUFBLENBQUMsSUFB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QUFDO0FBQzVDLEFBQUEsRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxLO0NBQUssQztBQUFBLENBQUE7QUFDeEMsQUFBQTtBQUNBLEFBQUEsOEVBQTZFO0FBQzdFLEFBQUE7QUFDQSxBQUFBLEFBQUEsTUFBTSxDQUFTLE1BQVIsUUFBUSxDQUFDLENBQUUsQ0FBQyxDQUFDO0FBQ3BCLEFBQUEsQ0FBQyxZQUFZLENBQUMsQ0FBQyxXQUFXLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxTQUFTLENBQUM7QUFDakUsQUFBQSxDQUFDLFNBQVMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLFlBQVksQ0FBQyxDQUFDLGVBQWUsQ0FBQyxDQUFDLFFBQVEsQ0FBQztBQUMvRCxBQUFBLENBQUMsWUFBWSxDQUFDO0FBQ2QsQUFBQTtBQUNBLEFBQUEsQ0FBQyxRQUFRLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxXQUFXLENBQUM7QUFDekQsQUFBQSxDQUFDLE1BQU0sQ0FBQyxDQUFDLFVBQVUsQ0FBQztBQUNwQixBQUFBO0FBQ0EsQUFBQSxDQUFDLFlBQVksQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLFlBQVksQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLE9BQU8sQ0FBQztBQUN6RCxBQUFBLENBQUMsVUFBVSxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsV0FBVyxDQUFDO0FBQ3JDLEFBQUEsQ0FBQyxDQUFDO0FBQ0YiLCJuYW1lcyI6W10sInNvdXJjZXNDb250ZW50IjpbIiMgYmFzZS11dGlscy5saWIuY2l2ZXRcclxuXHJcbmltcG9ydCB7YXNzZXJ0fSBmcm9tICdqc3I6QHN0ZC9hc3NlcnQnXHJcbmltcG9ydCB7cmVsYXRpdmUsIHBhcnNlfSBmcm9tICdub2RlOnBhdGgnXHJcbmltcG9ydCB7ZXhpc3RzU3luY30gZnJvbSAnanNyOkBzdGQvZnMnXHJcbmltcG9ydCB7c3RhdFN5bmN9IGZyb20gJ25vZGU6ZnMnXHJcbmltcG9ydCB7ZXhwYW5kR2xvYlN5bmN9IGZyb20gJ2pzcjpAc3RkL2ZzL2V4cGFuZC1nbG9iJ1xyXG5cclxuZXhwb3J0IHthc3NlcnR9XHJcbmRlY29kZXIgOj0gbmV3IFRleHREZWNvZGVyKClcclxuZGVjb2RlIDo9ICh4OiBVaW50OEFycmF5PEFycmF5QnVmZmVyPikgPT5cclxuXHRyZXR1cm4gZGVjb2Rlci5kZWNvZGUoeClcclxuXHJcbmV4cG9ydCBESVIgOj0gKHg6IHVua25vd24pOiB2b2lkID0+XHJcblx0Y29uc29sZS5kaXIgeCwge2RlcHRoOiBudWxsfVxyXG5cclxuZXhwb3J0IHR5cGUgVENvbnN0cnVjdG9yPFQ+ID0gbmV3ICguLi5hcmdzOiBhbnlbXSkgPT4gVFxyXG5cclxubGV0IGhhc0NsZWFyID0gZmFsc2VcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgY2hlY2tTZXR1cCA6PSAoKTogdm9pZCA9PlxyXG5cclxuXHRyb290RGlyOiBzdHJpbmc/IDo9IERlbm8uZW52LmdldCgnUFJPSkVDVF9ST09UX0RJUicpXHJcblx0YXNzZXJ0SXNEZWZpbmVkKHJvb3REaXIpXHJcblx0YXNzZXJ0IGV4aXN0c1N5bmMocm9vdERpcikgJiYgc3RhdFN5bmMocm9vdERpcikuaXNEaXJlY3RvcnkoKSxcclxuXHRcdFwiUGxlYXNlIHNldCBlbnYgdmFyIFBST0pFQ1RfUk9PVF9ESVIgdG8gYSB2YWxpZCBkaXJlY3RvcnlcIlxyXG5cdHJldHVyblxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbmV4cG9ydCBjb25kQ2xlYXIgOj0gKFxyXG5cdFx0bENtZEFyZ3M6IHN0cmluZ1tdID0gRGVuby5hcmdzXHJcblx0XHQpOiB2b2lkID0+XHJcblxyXG5cdGlmIChEZW5vLmFyZ3MuYXQoLTEpID09ICchJylcclxuXHRcdGhhc0NsZWFyID0gdHJ1ZVxyXG5cdFx0ZXhlY0NtZCAnY2xlYXInXHJcblx0cmV0dXJuXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuZXhwb3J0IHN0ZENoZWNrcyA6PSAoKTogdm9pZCA9PlxyXG5cclxuXHRkZWJ1Z2dlclxyXG5cdGNoZWNrU2V0dXAoKVxyXG5cdGNvbmRDbGVhcigpXHJcblx0cmV0dXJuXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuZXhwb3J0IEZBSUwgOj0gKGVyck1zZzogc3RyaW5nLCBuOiBudW1iZXIgPSA5OSk6IG5ldmVyID0+XHJcblxyXG5cdGNvbnNvbGUubG9nIGVyck1zZ1xyXG5cdERlbm8uZXhpdChuKVxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbmV4cG9ydCBTVUNDRUVEIDo9IChtc2c6IHN0cmluZz8gPSB1bmRlZik6IG5ldmVyID0+XHJcblxyXG5cdGlmIGRlZmluZWQobXNnKVxyXG5cdFx0Y29uc29sZS5sb2cgbXNnXHJcblx0RGVuby5leGl0KDApXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4jICAgICAgICAgICAgIGNtZC1hcmdzXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgZmxhZyA6PSAoXHJcblx0XHRjaDogc3RyaW5nXHJcblx0XHRsQ21kQXJnczogc3RyaW5nW10gPSBEZW5vLmFyZ3NcclxuXHRcdCk6IGJvb2xlYW4gPT5cclxuXHJcblx0YXNzZXJ0IChjaC5sZW5ndGggPT0gMSksIFwiQmFkIGZsYWcgYXJnOiAje2NofVwiXHJcblx0cmUgOj0gbmV3IFJlZ0V4cChcIl4tW2Etel0qI3tjaH1bYS16XSokXCIpXHJcblx0Zm9yIHN0ciBvZiBsQ21kQXJnc1xyXG5cdFx0aWYgcmUudGVzdChzdHIpXHJcblx0XHRcdHJldHVybiB0cnVlXHJcblx0cmV0dXJuIGZhbHNlXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuZXhwb3J0IG1hcE5vbk9wdGlvbiA6PSAoc3RyOiBzdHJpbmcpOiBzdHJpbmcgPT5cclxuXHJcblx0aWYgc3RyLnN0YXJ0c1dpdGgoJz0nKVxyXG5cdFx0ZmlsZU5hbWUgOj0gc3RyLnN1YnN0cmluZygxKVxyXG5cdFx0cGF0aCA6PSBmaW5kRmlsZSBmaWxlTmFtZVxyXG5cdFx0YXNzZXJ0IGRlZmluZWQocGF0aCksIFwiTm8gc3VjaCBmaWxlOiAje2ZpbGVOYW1lfVwiXHJcblx0XHRyZXR1cm4gcGF0aFxyXG5cdGVsc2VcclxuXHRcdHJldHVybiBzdHJcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgbm9uT3B0aW9uIDo9IChcclxuXHRcdHBvczogbnVtYmVyLFxyXG5cdFx0bENtZEFyZ3M6IHN0cmluZ1tdID0gRGVuby5hcmdzXHJcblx0XHQpOiBzdHJpbmc/ID0+XHJcblxyXG5cdGZvciBzdHIgb2YgbENtZEFyZ3NcclxuXHRcdGlmIG5vdCBzdHIuc3RhcnRzV2l0aCgnLScpXHJcblx0XHRcdGlmIChwb3MgPT0gMClcclxuXHRcdFx0XHRyZXR1cm4gaGFzQ2xlYXIgJiYgKHN0ciA9PSAnIScpID8gdW5kZWYgOiBtYXBOb25PcHRpb24oc3RyKVxyXG5cdFx0XHRlbHNlXHJcblx0XHRcdFx0cG9zIC09IDFcclxuXHRyZXR1cm4gdW5kZWZcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgYWxsTm9uT3B0aW9ucyA6PSAoXHJcblx0XHRsQ21kQXJnczogc3RyaW5nW10gPSBEZW5vLmFyZ3NcclxuXHRcdCk6IEdlbmVyYXRvcjxzdHJpbmcsIHZvaWQsIHZvaWQ+IC0+XHJcblxyXG5cdGZvciBzdHIgb2YgbENtZEFyZ3NcclxuXHRcdGlmIG5vdCBzdHIuc3RhcnRzV2l0aCgnLScpICYmICgoc3RyICE9ICchJykgfHwgbm90IGhhc0NsZWFyKVxyXG5cdFx0XHR5aWVsZCBtYXBOb25PcHRpb24oc3RyKVxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuIyAgICAgICAgICAgICBsb2dnZXJcclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbmV4cG9ydCBMT0cgOj0gY29uc29sZS5sb2dcclxuXHJcbmV4cG9ydCBEQkcgOj0gKG1zZzogc3RyaW5nKTogdm9pZCA9PlxyXG5cdGlmIGZsYWcoJ0QnKVxyXG5cdFx0TE9HIG1zZ1xyXG5cdHJldHVyblxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbmV4cG9ydCBMTE9HIDo9IChcclxuXHRcdGxhYmVsOiBzdHJpbmdcclxuXHRcdG1zZzogc3RyaW5nXHJcblx0XHQpOiB2b2lkID0+XHJcblxyXG5cdGxhYmVsTGVuIDo9IDE1XHJcblx0aWYgKGxhYmVsLmxlbmd0aCA8PSBsYWJlbExlbilcclxuXHRcdHNwYWNlcyA6PSAnICcucmVwZWF0KGxhYmVsTGVuLWxhYmVsLmxlbmd0aClcclxuXHRcdExPRyBcIiN7bGFiZWx9I3tzcGFjZXN9ICN7bXNnfVwiXHJcblx0ZWxzZVxyXG5cdFx0TE9HIFwiI3tsYWJlbC5zdWJzdHJpbmcoMCwgbGFiZWxMZW4pfSAje21zZ31cIlxyXG5cdHJldHVyblxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbmV4cG9ydCBJTE9HIDo9IChtc2c6IHN0cmluZyk6IHZvaWQgPT5cclxuXHJcblx0TE9HIFwiICAgI3ttc2d9XCJcclxuXHRyZXR1cm5cclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbiMgICAgICAgICAgICAgZGF0YXR5cGVzXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgdHlwZSBoYXNoXHJcblx0W2tleTogc3RyaW5nIHwgc3ltYm9sXTogdW5rbm93blxyXG5cclxuZXhwb3J0IHR5cGUgVERlZmluZWQgPSBOb25OdWxsYWJsZTx1bmtub3duPlxyXG5leHBvcnQgdHlwZSBUTm90RGVmaW5lZCA9IG51bGwgfCB1bmRlZmluZWRcclxuXHJcbmV4cG9ydCB1bmRlZiA6PSB1bmRlZmluZWRcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgZGVmaW5lZCA6PSAoeDogdW5rbm93bik6IHggaXMgVERlZmluZWQgPT5cclxuXHJcblx0cmV0dXJuICh4ICE9IHVuZGVmKSAmJiAoeCAhPSBudWxsKVxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbmV4cG9ydCBub3RkZWZpbmVkIDo9ICh4OiB1bmtub3duKTogeCBpcyBUTm90RGVmaW5lZCA9PlxyXG5cclxuXHRyZXR1cm4gKHggPT0gdW5kZWYpIHx8ICh4ID09IG51bGwpXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGFzc2VydElzRGVmaW5lZChcclxuXHRcdHZhbHVlOiB1bmtub3duXHJcblx0XHRuYW1lOiBzdHJpbmcgPSAnJ1xyXG5cdFx0KTogYXNzZXJ0cyB2YWx1ZSBpcyBURGVmaW5lZCA9PlxyXG5cclxuXHRpZiBub3RkZWZpbmVkKHZhbHVlKVxyXG5cdFx0dGhyb3cgbmV3IEVycm9yKFwidmFsdWUgaXMgbm90IGRlZmluZWRcIilcclxuXHRyZXR1cm5cclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgZnVuY3Rpb24gYXNzZXJ0Tm90RGVmaW5lZChcclxuXHRcdHZhbHVlOiB1bmtub3duXHJcblx0XHRuYW1lOiBzdHJpbmcgPSAnJ1xyXG5cdFx0KTogYXNzZXJ0cyB2YWx1ZSBpcyBUTm90RGVmaW5lZCA9PlxyXG5cclxuXHRpZiBkZWZpbmVkKHZhbHVlKVxyXG5cdFx0dGhyb3cgbmV3IEVycm9yKFwidmFsdWUgaXMgZGVmaW5lZFwiKVxyXG5cdHJldHVyblxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbmV4cG9ydCBjcm9hayA6PSAobXNnOiBzdHJpbmcpOiBuZXZlciA9PlxyXG5cclxuXHR0aHJvdyBuZXcgRXJyb3IobXNnKVxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbmV4cG9ydCByZXBsYWNlSW5BcnJheSA6PSAoXHJcblx0bFN0cmluZ3M6IHN0cmluZ1tdXHJcblx0aFJlcGxhY2U6IHtba2V5OiBzdHJpbmddOiBzdHJpbmd9XHJcblx0KTogc3RyaW5nW10gPT5cclxuXHJcblx0cmV0dXJuIGZvciBzdHIgb2YgbFN0cmluZ3NcclxuXHRcdGlmIGhSZXBsYWNlLmhhc093blByb3BlcnR5KHN0cilcclxuXHRcdFx0aFJlcGxhY2Vbc3RyXVxyXG5cdFx0ZWxzZVxyXG5cdFx0XHRzdHJcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbiMgICAgICAgICAgICAgZnN5c1xyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuZXhwb3J0IGlzRmlsZSA6PSAocGF0aDogc3RyaW5nKTogYm9vbGVhbiA9PlxyXG5cclxuXHRyZXR1cm4gZXhpc3RzU3luYyhwYXRoKSAmJiBzdGF0U3luYyhwYXRoKS5pc0ZpbGUoKVxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbmV4cG9ydCBzbHVycCA6PSAocGF0aDogc3RyaW5nKTogc3RyaW5nID0+XHJcblxyXG5cdGRhdGEgOj0gRGVuby5yZWFkRmlsZVN5bmMgcGF0aFxyXG5cdHJldHVybiBkZWNvZGVyLmRlY29kZShkYXRhKS5yZXBsYWNlQWxsKCdcXHInLCAnJylcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgcm1GaWxlIDo9IChwYXRoOiBzdHJpbmcpOiB2b2lkID0+XHJcblxyXG5cdGlmIGV4aXN0c1N5bmMgcGF0aFxyXG5cdFx0RGVuby5yZW1vdmVTeW5jIHBhdGhcclxuXHRyZXR1cm5cclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgZmlsZUV4dCA6PSAocGF0aDogc3RyaW5nKTogc3RyaW5nID0+XHJcblxyXG5cdGlmIGxNYXRjaGVzIDo9IHBhdGgubWF0Y2goL1xcLlteXFwuXSskLylcclxuXHRcdHJldHVybiBsTWF0Y2hlc1swXVxyXG5cdGVsc2VcclxuXHRcdHJldHVybiAnJ1xyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbmV4cG9ydCB3aXRoRXh0IDo9IChwYXRoOiBzdHJpbmcsIGV4dDogc3RyaW5nKTogc3RyaW5nID0+XHJcblxyXG5cdGxNYXRjaGVzIDo9IHBhdGgubWF0Y2ggL14oLiopKFxcLlteXFwuXSspJC9cclxuXHRpZiAobE1hdGNoZXMgPT0gbnVsbClcclxuXHRcdGNyb2FrIFwiQmFkIHBhdGg6ICcje3BhdGh9J1wiXHJcblx0XHRyZXR1cm4gJydcclxuXHRlbHNlXHJcblx0XHRbXywgaGVhZFN0ciwgb3JnRXh0XSA6PSBsTWF0Y2hlc1xyXG5cdFx0cmV0dXJuIFwiI3toZWFkU3RyfSN7ZXh0fVwiXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuZXhwb3J0IG5vcm1hbGl6ZVBhdGggOj0gKHBhdGg6IHN0cmluZyk6IHN0cmluZyA9PlxyXG5cclxuXHRucGF0aCA6PSBwYXRoLnJlcGxhY2VBbGwoJ1xcXFwnLCAnLycpXHJcblx0aWYgKG5wYXRoLmNoYXJBdCgxKSA9PSAnOicpXHJcblx0XHRyZXR1cm4gbnBhdGguY2hhckF0KDApLnRvVXBwZXJDYXNlKCkgKyBucGF0aC5zdWJzdHJpbmcoMSlcclxuXHRlbHNlXHJcblx0XHRyZXR1cm4gbnBhdGhcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgcmVscGF0aCA6PSAocGF0aDogc3RyaW5nKTogc3RyaW5nID0+XHJcblxyXG5cdHJldHVybiBub3JtYWxpemVQYXRoKHJlbGF0aXZlKCcnLCBwYXRoKSlcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgYnVpbGRGaWxlTmFtZSA6PSAoXHJcblx0XHRzdHViOiBzdHJpbmdcclxuXHRcdHB1cnBvc2U6IHN0cmluZz9cclxuXHRcdGV4dDogc3RyaW5nXHJcblx0XHQpID0+XHJcblxyXG5cdHJldHVybiAoXHJcblx0XHRwdXJwb3NlID8gXCIje3N0dWJ9LiN7cHVycG9zZX0je2V4dH1cIlxyXG5cdFx0ICAgICAgICA6IFwiI3tzdHVifSN7ZXh0fVwiXHJcblx0XHQpXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuZXhwb3J0IGJ1aWxkVGVzdEZpbGVOYW1lIDo9IChcclxuXHRcdHN0dWI6IHN0cmluZ1xyXG5cdFx0cHVycG9zZTogc3RyaW5nP1xyXG5cdFx0ZXh0OiBzdHJpbmdcclxuXHRcdCkgPT5cclxuXHJcblx0cmV0dXJuIChcclxuXHRcdHB1cnBvc2UgPyBcIiN7c3R1Yn0uI3twdXJwb3NlfS50ZXN0I3tleHR9XCJcclxuXHRcdCAgICAgICAgOiBcIiN7c3R1Yn0udGVzdCN7ZXh0fVwiXHJcblx0XHQpXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuZXhwb3J0IHR5cGUgVFBhdGhJbmZvID0ge1xyXG5cdHJvb3Q6IHN0cmluZ1xyXG5cdGRpcjogc3RyaW5nXHJcblx0ZmlsZU5hbWU6IHN0cmluZ1xyXG5cclxuXHRzdHViOiBzdHJpbmdcclxuXHRwdXJwb3NlOiBzdHJpbmc/XHJcblx0ZXh0OiBzdHJpbmdcclxuXHR9XHJcblxyXG5leHBvcnQgcGFyc2VQYXRoIDo9IChcclxuXHRcdHBhdGg6IHN0cmluZ1xyXG5cdFx0KTogVFBhdGhJbmZvID0+XHJcblxyXG5cdHtyb290LCBkaXIsIGJhc2V9IDo9IHBhcnNlKHBhdGgpXHJcblxyXG5cdGxQYXJ0cyA6PSBiYXNlLnNwbGl0KCcuJylcclxuXHRhc3NlcnQgKGxQYXJ0cy5sZW5ndGggPiAyKSwgXCJCYWQgcGF0aDogI3twYXRofVwiXHJcblx0cmV0dXJuIHtcclxuXHRcdHJvb3Q6IG5vcm1hbGl6ZVBhdGgocm9vdClcclxuXHRcdGRpcjogbm9ybWFsaXplUGF0aChkaXIpXHJcblx0XHRmaWxlTmFtZTogYmFzZVxyXG5cclxuXHRcdHN0dWI6ICAgIGxQYXJ0cy5zbGljZSgwLCAtMikuam9pbignLicpXHJcblx0XHRwdXJwb3NlOiBsUGFydHMuYXQoLTIpXHJcblx0XHRleHQ6ICAgICBcIi4je2xQYXJ0cy5hdCgtMSl9XCJcclxuXHRcdH1cclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgdHlwZSBURXhlY1Jlc3VsdCA9IHtcclxuXHRzdWNjZXNzOiBib29sZWFuXHJcblx0Y29kZTogbnVtYmVyXHJcblx0c2lnbmFsPzogRGVuby5TaWduYWwgfCBudWxsXHJcblx0c3Rkb3V0Pzogc3RyaW5nXHJcblx0c3RkZXJyPzogc3RyaW5nXHJcblx0fVxyXG5cclxuZXhwb3J0IHR5cGUgVFJlcGxhY2VIYXNoID0ge1xyXG5cdFtrZXk6IHN0cmluZ106IHN0cmluZ1xyXG5cdH1cclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbiMgQVNZTkNcclxuXHJcbmV4cG9ydCBleGVjQ21kIDo9IChcclxuXHRjbWROYW1lOiBzdHJpbmdcclxuXHRsQ21kQXJnczogc3RyaW5nW10gPSBbXVxyXG5cdGhSZXBsYWNlOiBUUmVwbGFjZUhhc2ggPSB7fVxyXG5cdGNhcHR1cmU6IGJvb2xlYW4gPSBmYWxzZVxyXG5cdCk6IFRFeGVjUmVzdWx0ID0+XHJcblxyXG5cdGNoaWxkIDo9IG5ldyBEZW5vLkNvbW1hbmQoY21kTmFtZSwge1xyXG5cdFx0YXJnczogcmVwbGFjZUluQXJyYXkobENtZEFyZ3MsIGhSZXBsYWNlKVxyXG5cdFx0c3Rkb3V0OiBjYXB0dXJlID8gJ3BpcGVkJyA6ICdpbmhlcml0J1xyXG5cdFx0c3RkZXJyOiBjYXB0dXJlID8gJ3BpcGVkJyA6ICdpbmhlcml0J1xyXG5cdFx0fSlcclxuXHRpZiBjYXB0dXJlXHJcblx0XHR7c3VjY2VzcywgY29kZSwgc2lnbmFsLCBzdGRvdXQsIHN0ZGVycn0gOj0gYXdhaXQgY2hpbGQub3V0cHV0KClcclxuXHRcdHJldHVybiB7XHJcblx0XHRcdHN1Y2Nlc3MsIGNvZGVcclxuXHRcdFx0c2lnbmFsOiBzaWduYWwgfHwgdW5kZWZcclxuXHRcdFx0c3Rkb3V0OiBkZWNvZGUoc3Rkb3V0KVxyXG5cdFx0XHRzdGRlcnI6IGRlY29kZShzdGRlcnIpXHJcblx0XHRcdH1cclxuXHRlbHNlXHJcblx0XHR7c3VjY2VzcywgY29kZSwgc2lnbmFsfSA6PSBhd2FpdCBjaGlsZC5vdXRwdXQoKVxyXG5cdFx0cmV0dXJuIHtcclxuXHRcdFx0c3VjY2Vzc1xyXG5cdFx0XHRjb2RlXHJcblx0XHRcdHNpZ25hbDogc2lnbmFsIHx8IHVuZGVmXHJcblx0XHRcdH1cclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgbmV3ZXJEZXN0RmlsZUV4aXN0cyA6PSAoXHJcblx0XHRwYXRoOiBzdHJpbmdcclxuXHRcdGV4dDogc3RyaW5nXHJcblx0XHQpOiBib29sZWFuID0+XHJcblxyXG5cdGRlc3RQYXRoIDo9IHdpdGhFeHQgcGF0aCwgZXh0XHJcblx0aWYgbm90IGV4aXN0c1N5bmMoZGVzdFBhdGgpXHJcblx0XHRyZXR1cm4gZmFsc2VcclxuXHRzcmNNUyA6PSBzdGF0U3luYyhwYXRoKS5tdGltZU1zXHJcblx0ZGVzdE1TIDo9IHN0YXRTeW5jKGRlc3RQYXRoKS5tdGltZU1zXHJcblx0cmV0dXJuIChkZXN0TVMgPiBzcmNNUylcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgY21kU3VjY2VlZHMgOj0gKFxyXG5cdFx0Y21kTmFtZTogc3RyaW5nXHJcblx0XHRsQXJnczogc3RyaW5nW10gPSBbXVxyXG5cdFx0KTogYm9vbGVhbiA9PlxyXG5cclxuXHRjaGlsZCA6PSBuZXcgRGVuby5Db21tYW5kIGNtZE5hbWUsIHtcclxuXHRcdGFyZ3M6IGxBcmdzXHJcblx0XHRzdGRvdXQ6ICdwaXBlZCdcclxuXHRcdHN0ZGVycjogJ3BpcGVkJ1xyXG5cdFx0fVxyXG5cdHJldHVybiBjaGlsZC5vdXRwdXRTeW5jKCkuc3VjY2Vzc1xyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbmV4cG9ydCBzcGxpdFBhdHRlcm5zIDo9IChcclxuXHRcdGxBbGxQYXRzOiBzdHJpbmcgfCBzdHJpbmdbXVxyXG5cdFx0KTogW3N0cmluZ1tdLCBzdHJpbmdbXV0gPT5cclxuXHJcblx0bFBvc1BhdHM6IHN0cmluZ1tdIDo9IFtdXHJcblx0bE5lZ1BhdHM6IHN0cmluZ1tdIDo9IFtdXHJcblxyXG5cdGlmICh0eXBlb2YgbEFsbFBhdHMgPT0gJ3N0cmluZycpXHJcblx0XHQjIC0tLSBBIHNpbmdsZSBzdHJpbmcgY2FuJ3QgYmUgYSBuZWdhdGl2ZSBwYXR0ZXJuXHJcblx0XHRhc3NlcnQgbm90IGxBbGxQYXRzLm1hdGNoKC9eXFwhLyksIFwiQmFkIGdsb2IgcGF0dGVybjogI3tsQWxsUGF0c31cIlxyXG5cdFx0bFBvc1BhdHMucHVzaCBsQWxsUGF0c1xyXG5cdGVsc2VcclxuXHRcdGZvciBwYXQgb2YgbEFsbFBhdHNcclxuXHRcdFx0bE1hdGNoZXMgOj0gcGF0Lm1hdGNoKC9eKFxcIVxccyopPyguKikkLylcclxuXHRcdFx0aWYgbE1hdGNoZXNcclxuXHRcdFx0XHRpZiBsTWF0Y2hlc1sxXVxyXG5cdFx0XHRcdFx0bE5lZ1BhdHMucHVzaCBsTWF0Y2hlc1syXVxyXG5cdFx0XHRcdGVsc2VcclxuXHRcdFx0XHRcdGxQb3NQYXRzLnB1c2ggbE1hdGNoZXNbMl1cclxuXHRyZXR1cm4gW2xQb3NQYXRzLCBsTmVnUGF0c11cclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbiMgR0VORVJBVE9SXHJcbiNcclxuIyAgICBVc2UgbGlrZTpcclxuIyAgICAgICBmb3IgcGF0aCBvZiBhbGxGaWxlc01hdGNoaW5nKGxQYXRzKVxyXG4jICAgICAgICAgIE9SXHJcbiMgICAgICAgbFBhdGhzIDo9IEFycmF5LmZyb20oYWxsRmlsZXNNYXRjaGluZyhsUGF0cykpXHJcbiNcclxuIyAgICBOT1RFOiBCeSBkZWZhdWx0LCBzZWFyY2hlcyBmcm9tIC4vc3JjXHJcblxyXG5leHBvcnQgYWxsRmlsZXNNYXRjaGluZyA6PSAoXHJcblx0XHRsUGF0dGVybnM6IHN0cmluZyB8IHN0cmluZ1tdXHJcblx0XHRoR2xvYk9wdGlvbnMgPSB7XHJcblx0XHRcdHJvb3Q6ICcuL3NyYydcclxuXHRcdFx0aW5jbHVkZURpcnM6IGZhbHNlXHJcblx0XHRcdH1cclxuXHRcdCk6IEdlbmVyYXRvcjxzdHJpbmcsIHZvaWQsIHZvaWQ+IC0+XHJcblxyXG5cdFtsUG9zUGF0cywgbE5lZ1BhdHNdIDo9IHNwbGl0UGF0dGVybnMgbFBhdHRlcm5zXHJcblx0aWYgZmxhZygnRCcpXHJcblx0XHRMT0cgXCJQQVRURVJOUzpcIlxyXG5cdFx0Zm9yIHBhdCBvZiBsUG9zUGF0c1xyXG5cdFx0XHRJTE9HIFwiUE9TOiAje3BhdH1cIlxyXG5cdFx0Zm9yIHBhdCBvZiBsTmVnUGF0c1xyXG5cdFx0XHRJTE9HIFwiTkVHOiAje3BhdH1cIlxyXG5cclxuXHRzZXRTa2lwIDo9IG5ldyBTZXQ8c3RyaW5nPigpXHJcblx0Zm9yIHBhdCBvZiBsTmVnUGF0c1xyXG5cdFx0Zm9yIHtwYXRofSBvZiBleHBhbmRHbG9iU3luYyhwYXQsIGhHbG9iT3B0aW9ucylcclxuXHRcdFx0c2V0U2tpcC5hZGQgcGF0aFxyXG5cclxuXHRmb3IgcGF0IG9mIGxQb3NQYXRzXHJcblx0XHRmb3Ige3BhdGh9IG9mIGV4cGFuZEdsb2JTeW5jKHBhdCwgaEdsb2JPcHRpb25zKVxyXG5cdFx0XHRpZiBub3Qgc2V0U2tpcC5oYXMgcGF0aFxyXG5cdFx0XHRcdERCRyBcIlBBVEg6ICN7cGF0aH1cIlxyXG5cdFx0XHRcdHlpZWxkIHBhdGhcclxuXHRcdFx0XHRzZXRTa2lwLmFkZCBwYXRoXHJcblx0cmV0dXJuXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuZXhwb3J0IGZpbmRGaWxlIDo9IChmaWxlTmFtZTogc3RyaW5nKTogc3RyaW5nPyA9PlxyXG5cclxuXHRsUGF0aHMgOj0gQXJyYXkuZnJvbSBhbGxGaWxlc01hdGNoaW5nKFwiKiovI3tmaWxlTmFtZX1cIilcclxuXHRzd2l0Y2ggbFBhdGhzLmxlbmd0aFxyXG5cdFx0d2hlbiAxXHJcblx0XHRcdHJldHVybiBub3JtYWxpemVQYXRoKGxQYXRoc1swXSlcclxuXHRcdHdoZW4gMFxyXG5cdFx0XHRyZXR1cm4gdW5kZWZcclxuXHRcdGVsc2VcclxuXHRcdFx0Zm9yIHBhdGggb2YgbFBhdGhzXHJcblx0XHRcdFx0Y29uc29sZS5sb2cgcGF0aFxyXG5cdFx0XHRjcm9hayBcIk11bHRpcGxlIGZpbGVzIHdpdGggbmFtZSAje2ZpbGVOYW1lfVwiXHJcblx0XHRcdHJldHVybiAnJ1xyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuIyBBU1lOQ1xyXG5cclxuZXhwb3J0IHR5cGUgVFByb2NGdW5jID0gKHBhdGg6IHN0cmluZykgPT4gUHJvbWlzZTx1bmtub3duPlxyXG5leHBvcnQgdHlwZSBUUHJvY1Jlc3VsdCA9IHsgW3BhdGg6IHN0cmluZ106IHVua25vd24gfVxyXG5cclxuZXhwb3J0IHByb2NGaWxlcyA6PSAoXHJcblx0XHRsUGF0dGVybnM6IHN0cmluZyB8IHN0cmluZ1tdXHJcblx0XHRwcm9jRnVuYzogVFByb2NGdW5jXHJcblx0XHQpOiBbXHJcblx0XHRcdFRQcm9jUmVzdWx0ICAgICAjIHBhdGhzIHN1Y2NlZWRlZFxyXG5cdFx0XHRUUHJvY1Jlc3VsdD8gICAgIyBwYXRocyBmYWlsZWRcclxuXHRcdFx0XSA9PlxyXG5cclxuXHQjIC0tLSBXZSBuZWVkIHRoZSBwYXRocyBmb3IgbGF0ZXJcclxuXHRsUGF0aHMgOj0gQXJyYXkuZnJvbShhbGxGaWxlc01hdGNoaW5nKGxQYXR0ZXJucykpXHJcblxyXG5cdGxQcm9taXNlcyA6PSBmb3IgcGF0aCBvZiBsUGF0aHNcclxuXHRcdHByb2NGdW5jIHBhdGhcclxuXHRsUmVzdWx0cyA6PSBhd2FpdCBQcm9taXNlLmFsbFNldHRsZWQobFByb21pc2VzKVxyXG5cclxuXHRoU3VjY2VlZGVkOiBUUHJvY1Jlc3VsdCA6PSB7fVxyXG5cdGhGYWlsZWQ6ICAgIFRQcm9jUmVzdWx0IDo9IHt9XHJcblxyXG5cdCMgLS0tIGxSZXN1bHRzIGFyZSBpbiB0aGUgc2FtZSBvcmRlciBhcyBsUGF0aHNcclxuXHRsZXQgaGFzRmFpbGVkID0gZmFsc2VcclxuXHRmb3IgcmVzLGkgb2YgbFJlc3VsdHNcclxuXHRcdHBhdGggOj0gbFBhdGhzW2ldXHJcblx0XHRpZiAocmVzLnN0YXR1cyA9PSAnZnVsZmlsbGVkJylcclxuXHRcdFx0aFN1Y2NlZWRlZFtwYXRoXSA9IHJlcy52YWx1ZVxyXG5cdFx0ZWxzZVxyXG5cdFx0XHRoYXNGYWlsZWQgPSB0cnVlXHJcblx0XHRcdGhGYWlsZWRbcGF0aF0gPSByZXMucmVhc29uXHJcblxyXG5cdHJldHVybiBbXHJcblx0XHRoU3VjY2VlZGVkLFxyXG5cdFx0aGFzRmFpbGVkID8gaEZhaWxlZCA6IHVuZGVmXHJcblx0XHRdXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxudHlwZSBURmlsZVJ1bm5lciA9IChcclxuXHRcdHN0dWI6IHN0cmluZ1xyXG5cdFx0cHVycG9zZTogc3RyaW5nP1xyXG5cdFx0bEFyZ3M/OiBzdHJpbmdbXVxyXG5cdFx0aE9wdGlvbnM/OiBoYXNoXHJcblx0XHQpID0+IFByb21pc2U8dm9pZD5cclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgZ2V0U3RyaW5nT3B0aW9uIDo9IChcclxuXHRcdGhPcHRpb25zOiBoYXNoXHJcblx0XHRrZXk6IHN0cmluZ1xyXG5cdFx0ZGVmVmFsOiBzdHJpbmc/ID0gdW5kZWZcclxuXHRcdCk6IHN0cmluZz8gPT5cclxuXHJcblx0aWYgaE9wdGlvbnMuaGFzT3duUHJvcGVydHkga2V5XHJcblx0XHR2YWwgOj0gaE9wdGlvbnNba2V5XVxyXG5cdFx0YXNzZXJ0ICh0eXBlb2YgdmFsID09ICdzdHJpbmcnKSwgXCJOb3QgYSBzdHJpbmc6ICN7dmFsfVwiXHJcblx0XHRyZXR1cm4gdmFsXHJcblx0ZWxzZVxyXG5cdFx0cmV0dXJuIGRlZlZhbFxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbmV4cG9ydCBnZXRCb29sZWFuT3B0aW9uIDo9IChcclxuXHRcdGhPcHRpb25zOiBoYXNoXHJcblx0XHRrZXk6IHN0cmluZ1xyXG5cdFx0ZGVmVmFsOiBib29sZWFuID0gZmFsc2VcclxuXHRcdCk6IGJvb2xlYW4gPT5cclxuXHJcblx0aWYgaE9wdGlvbnMuaGFzT3duUHJvcGVydHkga2V5XHJcblx0XHR2YWwgOj0gaE9wdGlvbnNba2V5XVxyXG5cdFx0YXNzZXJ0ICh0eXBlb2YgdmFsID09ICdib29sZWFuJyksIFwiTm90IGEgYm9vbGVhbjogI3t2YWx9XCJcclxuXHRcdHJldHVybiB2YWxcclxuXHRlbHNlXHJcblx0XHRyZXR1cm4gZGVmVmFsXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4jIEFTWU5DXHJcblxyXG5leHBvcnQgdHJ5Q21kIDo9IChcclxuXHRcdGZ1bmM6IFRGaWxlUnVubmVyXHJcblx0XHRzdHViOiBzdHJpbmdcclxuXHRcdHB1cnBvc2U6IHN0cmluZz9cclxuXHRcdGxBcmdzOiBzdHJpbmdbXSA9IFtdXHJcblx0XHRoT3B0aW9uczogaGFzaCA9IHt9XHJcblx0XHQpOiB2b2lkID0+XHJcblxyXG5cdHRyeVxyXG5cdFx0YXdhaXQgZnVuYyhzdHViLCBwdXJwb3NlLCBsQXJncywgaE9wdGlvbnMpXHJcblx0Y2F0Y2ggZXJyXHJcblx0XHRjb25zb2xlLmVycm9yIGVyclxyXG5cdFx0aWYgZ2V0Qm9vbGVhbk9wdGlvbiBoT3B0aW9ucywgJ2V4aXRPbkZhaWwnLCB0cnVlXHJcblx0XHRcdERlbm8uZXhpdCg5OSlcclxuXHRcdHJldHVyblxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuIyAgICAgIFJVTk5FUlMgKGFsbCBBU1lOQylcclxuIyAgICAgIHdoZW4gcnVuIHVzaW5nIHRyeUNtZCgpXHJcbiMgICAgICAgICAtIGZhbHNlIHJldHVybiB3aWxsIGV4aXQgdGhlIHNjcmlwdFxyXG4jICAgICAgICAgLSBmYWxzZSByZXR1cm4gd2lsbCBjYXVzZSBhIGxvZyBtZXNzYWdlXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbiMgQVNZTkNcclxuXHJcbmV4cG9ydCBjaXZldDJ0c0ZpbGUgOj0gKFxyXG5cdFx0c3R1Yjogc3RyaW5nXHJcblx0XHRwdXJwb3NlOiBzdHJpbmc/XHJcblx0XHQpOiB2b2lkID0+XHJcblxyXG5cdGZpbGVOYW1lIDo9IGJ1aWxkRmlsZU5hbWUgc3R1YiwgcHVycG9zZSwgJy5jaXZldCdcclxuXHRMTE9HICdDT01QSUxFJywgZmlsZU5hbWVcclxuXHJcblx0cGF0aCA6PSBmaW5kRmlsZSBmaWxlTmFtZVxyXG5cdGFzc2VydCBwYXRoLCBcIk5vIHN1Y2ggZmlsZTogI3tmaWxlTmFtZX1cIlxyXG5cclxuXHRpZiBuZXdlckRlc3RGaWxlRXhpc3RzIHBhdGgsICcudHMnXHJcblx0XHRJTE9HIFwiYWxyZWFkeSBjb21waWxlZFwiXHJcblx0XHRyZXR1cm5cclxuXHJcblx0e3N1Y2Nlc3N9IDo9IGF3YWl0IGV4ZWNDbWQgJ2Rlbm8nLCBbXHJcblx0XHQncnVuJ1xyXG5cdFx0Jy1BJ1xyXG5cdFx0J25wbTpAZGFuaWVseC9jaXZldCdcclxuXHRcdCctLWlubGluZS1tYXAnXHJcblx0XHQnLW8nLCAnLnRzJ1xyXG5cdFx0Jy1jJywgcGF0aFxyXG5cdFx0XVxyXG5cdGlmIHN1Y2Nlc3NcclxuXHRcdElMT0cgXCJPS1wiXHJcblx0ZWxzZVxyXG5cdFx0SUxPRyBcIkZBSUxFRFwiXHJcblx0XHRybUZpbGUgd2l0aEV4dChmaWxlTmFtZSwgJy50cycpXHJcblx0XHRjcm9hayBcIkNvbXBpbGUgb2YgI3tmaWxlTmFtZX0gZmFpbGVkXCJcclxuXHJcblx0IyAtLS0gVHlwZSBjaGVjayB0aGUgKi50cyBmaWxlXHJcblx0TE9HIFwiVFlQRSBDSEVDSzogI3tmaWxlTmFtZX1cIlxyXG5cdGggOj0gYXdhaXQgZXhlY0NtZCAnZGVubycsIFtcclxuXHRcdCdjaGVjaycsXHJcblx0XHR3aXRoRXh0KHBhdGgsICcudHMnKVxyXG5cdFx0XVxyXG5cclxuXHRpZiBoLnN1Y2Nlc3NcclxuXHRcdElMT0cgXCJPS1wiXHJcblx0ZWxzZVxyXG5cdFx0SUxPRyBcIkZBSUxFRFwiXHJcblx0XHRybUZpbGUgd2l0aEV4dChmaWxlTmFtZSwgJy50cycpXHJcblx0XHRjcm9hayBcIlR5cGUgQ2hlY2sgb2YgI3tmaWxlTmFtZX0gZmFpbGVkXCJcclxuXHRyZXR1cm5cclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbiMgQVNZTkNcclxuXHJcbmV4cG9ydCBkb1VuaXRUZXN0IDo9IChcclxuXHRcdHN0dWI6IHN0cmluZ1xyXG5cdFx0cHVycG9zZTogc3RyaW5nPyAgICAgICMgcHVycG9zZSBvZiB0aGUgZmlsZSBiZWluZyB0ZXN0ZWRcclxuXHRcdGxBcmdzOiBzdHJpbmdbXSA9IFtdXHJcblx0XHQpOiB2b2lkID0+XHJcblxyXG5cdGRlYnVnZ2VyXHJcblx0ZmlsZU5hbWUgOj0gYnVpbGRUZXN0RmlsZU5hbWUgc3R1YiwgcHVycG9zZSwgJy5jaXZldCdcclxuXHRMTE9HIFwiVU5JVCBURVNUXCIsIGZpbGVOYW1lXHJcblxyXG5cdHRlc3RQYXRoIDo9IGZpbmRGaWxlIGZpbGVOYW1lXHJcblx0aWYgbm90ZGVmaW5lZCh0ZXN0UGF0aClcclxuXHRcdElMT0cgXCJUaGVyZSBpcyBubyB1bml0IHRlc3QgZm9yICN7ZmlsZU5hbWV9XCJcclxuXHRcdHJldHVyblxyXG5cdERCRyBcIlRFU1QgRklMRTogI3tyZWxwYXRoKHRlc3RQYXRoKX1cIlxyXG5cclxuXHRpZiBub3QgbmV3ZXJEZXN0RmlsZUV4aXN0cyh0ZXN0UGF0aCwgJy50cycpXHJcblx0XHRMTE9HICdDT01QSUxFJywgcmVscGF0aCh0ZXN0UGF0aClcclxuXHRcdHtzdWNjZXNzfSA6PSBhd2FpdCBleGVjQ21kICdkZW5vJywgW1xyXG5cdFx0XHQncnVuJ1xyXG5cdFx0XHQnLUEnXHJcblx0XHRcdC4uLihmbGFnKCdkJykgPyBbJy0taW5zcGVjdC1icmsnXSA6IFtdKVxyXG5cdFx0XHQnbnBtOkBkYW5pZWx4L2NpdmV0J1xyXG5cdFx0XHQnLS1pbmxpbmUtbWFwJ1xyXG5cdFx0XHQnLW8nLCAnLnRzJ1xyXG5cdFx0XHQnLWMnLCB0ZXN0UGF0aFxyXG5cdFx0XHRdXHJcblx0XHRpZiBub3Qgc3VjY2Vzc1xyXG5cdFx0XHRjcm9hayBcIiAgIENvbXBpbGUgb2YgI3t0ZXN0UGF0aH0gZmFpbGVkIVwiXHJcblxyXG5cdHRzVGVzdFBhdGggOj0gcmVscGF0aCh3aXRoRXh0KHRlc3RQYXRoLCAnLnRzJykpXHJcblx0dmVyYm9zZSA6PSBmbGFnKCd2JylcclxuXHRsQ21kQXJncyA6PSAoXHJcblx0XHQgIHZlcmJvc2VcclxuXHRcdD8gWyd0ZXN0JywgJy1BJywgJy0tY292ZXJhZ2UtcmF3LWRhdGEtb25seScsIHRzVGVzdFBhdGhdXHJcblx0XHQ6IFsndGVzdCcsICctQScsICctLWNvdmVyYWdlLXJhdy1kYXRhLW9ubHknLCAnLS1yZXBvcnRlcicsICdkb3QnLCB0c1Rlc3RQYXRoXVxyXG5cdFx0KVxyXG5cclxuXHRoIDo9IGF3YWl0IGV4ZWNDbWQgJ2Rlbm8nLCBsQ21kQXJnc1xyXG5cdGFzc2VydCBoLnN1Y2Nlc3MsIFwiICAgZGVubyAje2xDbWRBcmdzLmpvaW4oJyAnKX0gRkFJTEVEXCJcclxuXHRyZXR1cm5cclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbiMgQVNZTkNcclxuXHJcbmV4cG9ydCBkb0luc3RhbGxDbWQgOj0gKFxyXG5cdFx0c3R1Yjogc3RyaW5nLFxyXG5cdFx0cHVycG9zZTogc3RyaW5nPyA9ICdjbWQnXHJcblx0XHRsQXJnczogc3RyaW5nW10gPSBbXVxyXG5cdFx0aE9wdGlvbnM6IGhhc2ggPSB7fVxyXG5cdFx0KTogdm9pZCA9PlxyXG5cclxuXHRmaWxlTmFtZSA6PSBidWlsZEZpbGVOYW1lIHN0dWIsIHB1cnBvc2UsICcudHMnXHJcblx0TE9HIFwiSU5TVEFMTCBDTUQ6ICN7ZmlsZU5hbWV9XCJcclxuXHJcblx0cGF0aCA6PSBmaW5kRmlsZSBmaWxlTmFtZVxyXG5cdGFzc2VydCBwYXRoLCBcIk5vIHN1Y2ggZmlsZTogI3tmaWxlTmFtZX1cIlxyXG5cclxuXHRuYW1lIDo9IGdldFN0cmluZ09wdGlvbihoT3B0aW9ucywgJ25hbWUnKSB8fCBwYXJzZVBhdGgocGF0aCkuc3R1YlxyXG5cdGggOj0gYXdhaXQgZXhlY0NtZCAnZGVubycsIFtcclxuXHRcdCdpbnN0YWxsJyxcclxuXHRcdCctZmdBJyxcclxuXHRcdCctbicsIG5hbWUsXHJcblx0XHQnLS1uby1jb25maWcnLFxyXG5cdFx0Jy0taW1wb3J0LW1hcCcsICdpbXBvcnRfbWFwLmpzb25jJyxcclxuXHRcdHBhdGhcclxuXHRcdF1cclxuXHRhc3NlcnQgaC5zdWNjZXNzLCBcIiAgIEZBSUxFRFwiXHJcblx0TE9HIFwiICAgT0tcIlxyXG5cdHJldHVyblxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuIyBBU1lOQ1xyXG5cclxuZXhwb3J0IGRvUnVuIDo9IChcclxuXHRcdHN0dWI6IHN0cmluZ1xyXG5cdFx0cHVycG9zZTogc3RyaW5nP1xyXG5cdFx0bEFyZ3M6IHN0cmluZ1tdID0gW11cclxuXHRcdCk6IHZvaWQgPT5cclxuXHJcblx0ZmlsZU5hbWUgOj0gYnVpbGRGaWxlTmFtZSBzdHViLCBwdXJwb3NlLCAnLnRzJ1xyXG5cdExPRyBjZW50ZXJlZChcIlJVTjogI3tmaWxlTmFtZX1cIiwgNjQsICctJylcclxuXHJcblx0cGF0aCA6PSBmaW5kRmlsZSBmaWxlTmFtZVxyXG5cdGFzc2VydCBwYXRoLCBcIk5vIHN1Y2ggZmlsZTogI3tmaWxlTmFtZX1cIlxyXG5cclxuXHRoIDo9IGF3YWl0IGV4ZWNDbWQgJ2Rlbm8nLCBbXHJcblx0XHQncnVuJ1xyXG5cdFx0Jy1BJ1xyXG5cdFx0Li4uKGZsYWcoJ2QnKSA/IFsnLS1pbnNwZWN0LWJyayddIDogW10pXHJcblx0XHRwYXRoXHJcblx0XHQnLS0nXHJcblx0XHRsQXJncy4uLlxyXG5cdFx0XVxyXG5cclxuXHRhc3NlcnQgaC5zdWNjZXNzLCBcIiAgIEZBSUxFRFwiXHJcblx0cmV0dXJuXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuZXhwb3J0IHNlcCA6PSAoXHJcblx0XHRsYWJlbDogc3RyaW5nPyA9IHVuZGVmXHJcblx0XHRjaGFyOiBzdHJpbmcgPSAnLSdcclxuXHRcdHdpZHRoOiBudW1iZXIgPSA2NFxyXG5cdFx0KTogc3RyaW5nID0+XHJcblxyXG5cdGlmIGRlZmluZWQobGFiZWwpXHJcblx0XHRyZXR1cm4gY2VudGVyZWQobGFiZWwsIHdpZHRoLCBjaGFyKVxyXG5cdGVsc2VcclxuXHRcdHJldHVybiBjaGFyLnJlcGVhdCh3aWR0aClcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbiMgLS0tIHZhbGlkIG9wdGlvbnM6XHJcbiMgICAgICAgIGNoYXIgLSBjaGFyIHRvIHVzZSBvbiBsZWZ0IGFuZCByaWdodFxyXG4jICAgICAgICBidWZmZXIgLSBudW0gc3BhY2VzIGFyb3VuZCB0ZXh0IHdoZW4gY2hhciA8PiAnICdcclxuXHJcbmV4cG9ydCBjZW50ZXJlZCA6PSAoXHJcblx0dGV4dDogc3RyaW5nLFxyXG5cdHdpZHRoOiBudW1iZXIsXHJcblx0Y2hhcjogc3RyaW5nID0gJyAnLFxyXG5cdG51bUJ1ZmZlcjogbnVtYmVyID0gMlxyXG5cdCk6IHN0cmluZyA9PlxyXG5cclxuXHR0b3RTcGFjZXMgOj0gd2lkdGggLSB0ZXh0Lmxlbmd0aFxyXG5cdGlmICh0b3RTcGFjZXMgPD0gMClcclxuXHRcdHJldHVybiB0ZXh0XHJcblx0bnVtTGVmdCA6PSBNYXRoLmZsb29yKHRvdFNwYWNlcyAvIDIpXHJcblx0bnVtUmlnaHQgOj0gdG90U3BhY2VzIC0gbnVtTGVmdFxyXG5cdGlmIChjaGFyID09ICcgJylcclxuXHRcdHJldHVybiAnICcucmVwZWF0KG51bUxlZnQpICsgdGV4dCArICcgJy5yZXBlYXQobnVtUmlnaHQpXHJcblx0ZWxzZVxyXG5cdFx0YnVmIDo9ICcgJy5yZXBlYXQobnVtQnVmZmVyKVxyXG5cdFx0bGVmdCA6PSBjaGFyLnJlcGVhdChudW1MZWZ0IC0gbnVtQnVmZmVyKVxyXG5cdFx0cmlnaHQgOj0gY2hhci5yZXBlYXQobnVtUmlnaHQgLSBudW1CdWZmZXIpXHJcblx0XHRyZXR1cm4gbGVmdCArIGJ1ZiArIHRleHQgKyBidWYgKyByaWdodFxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbmV4cG9ydCBsQWxsTGlicyA6PSBbXHJcblx0J2Jhc2UtdXRpbHMnLCAnZGF0YXR5cGVzJywgJ2xsdXRpbHMnLCAnZGInLCAnaW5kZW50JywgJ3VuaWNvZGUnLFxyXG5cdCd0by1uaWNlJywgJ2V4dHJhY3QnLCAnbG9nLWxldmVscycsICdsb2ctZm9ybWF0dGVyJywgJ2xvZ2dlcicsXHJcblx0J3RleHQtdGFibGUnLFxyXG5cclxuXHQnd2Fsa2VyJywgJ3Njb3BlJywgJ3BhcnNlcicsICdmc3lzJywgJ3BsbCcsICdmcm9tLW5pY2UnLFxyXG5cdCdleGVjJywgJ2NtZC1hcmdzJyxcclxuXHJcblx0J3NvdXJjZS1tYXAnLCAnc3ltYm9scycsICd0eXBlc2NyaXB0JywgJ2NpdmV0JywgJ2NpZWxvJyxcclxuXHQnYXV0b21hdGUnLCAndjgtc3RhY2snLCAndW5pdC10ZXN0JyxcclxuXHRdXHJcbiJdfQ==