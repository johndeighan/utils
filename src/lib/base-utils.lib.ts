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
	'text-table', 'env-stack',

	'parser', 'cmd-args',
	'walker', 'fsys', 'pll', 'exec', 'from-nice',

	'source-map', 'symbols', 'typescript', 'civet', 'cielo',
	'automate', 'v8-stack', 'unit-test',
	]

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQzovVXNlcnMvam9obmQvdXRpbHMvc3JjL2xpYi9iYXNlLXV0aWxzLmxpYi5jaXZldC50c3giLCJzb3VyY2VzIjpbIkM6L1VzZXJzL2pvaG5kL3V0aWxzL3NyYy9saWIvYmFzZS11dGlscy5saWIuY2l2ZXQiXSwibWFwcGluZ3MiOiI7QUFBQSx1QkFBc0I7QUFDdEIsQUFBQTtBQUNBLEssVyx5QjtBQUFBLE1BQU0sQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksQ0FBQyxpQkFBaUI7QUFDdEMsQUFBQSxBQUFBLE1BQU0sQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxXQUFXO0FBQ3pDLEFBQUEsQUFBQSxNQUFNLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxJQUFJLENBQUMsYUFBYTtBQUN0QyxBQUFBLEFBQUEsTUFBTSxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsSUFBSSxDQUFDLFNBQVM7QUFDaEMsQUFBQSxBQUFBLE1BQU0sQ0FBQyxDQUFDLGNBQWMsQ0FBQyxDQUFDLElBQUksQ0FBQyx5QkFBeUI7QUFDdEQsQUFBQTtBQUNBLEFBQUEsQUFBQSxNQUFNLENBQUMsQ0FBQyxNQUFNLENBQUM7QUFDZixBQUFBLEFBQU8sTUFBUCxPQUFPLENBQUMsQ0FBRSxDQUFDLEdBQUcsQ0FBQyxXQUFXLENBQUMsQ0FBQztBQUM1QixBQUFBLEFBQU0sTUFBTixNQUFNLENBQUMsQ0FBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFBLENBQUE7QUFDekMsQUFBQSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUMsQztBQUFDLENBQUE7QUFDekIsQUFBQTtBQUNBLEFBQUEsQUFBQSxNQUFNLENBQUksTUFBSCxHQUFHLENBQUMsQ0FBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFB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QztBQUNsQixBQUFBLEdBQUcsSUFBSSxDQUFDLENBQUMsT0FBTyxDQUFBO0FBQ2hCLEFBQUEsR0FBRyxXQUFXLENBQUMsQ0FBQyxLQUFLO0FBQ3JCLEdBQUcsQ0FBQztBQUNKLEVBQUUsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBSSxDQUFBLENBQUE7QUFDckMsQUFBQTtBQUNBLEFBQUEsQ0FBcUIsTUFBcEIsQ0FBQyxRQUFRLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFFLENBQUMsYUFBYSxDQUFBLEFBQUMsU0FBUyxDQUFBO0FBQ2hELEFBQUEsQ0FBQyxHQUFHLENBQUEsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFBLENBQUEsQ0FBQTtBQUNiLEFBQUEsRUFBRSxHQUFHLENBQUEsQUFBQyxXQUFXLENBQUE7QUFDakIsQUFBQSxFQUFFLEdBQUcsQ0FBQyxDQUFBLE1BQUEsR0FBRyxDQUFDLEVBQUUsQ0FBQyxRQUFRLENBQUEsQ0FBQSxDQUFBO0FBQ3JCLEFBQUEsR0FBRyxJQUFJLENBQUEsQUFBQyxDQUFDLEtBQUssRUFBRSxHQUFHLENBQUMsQ0FBQyxDO0VBQUEsQ0FBQTtBQUNyQixBQUFBLEVBQUUsR0FBRyxDQUFDLENBQUEsTUFBQSxHQUFHLENBQUMsRUFBRSxDQUFDLFFBQVEsQ0FBQSxDQUFBLENBQUE7QUFDckIsQUFBQSxHQUFHLElBQUksQ0FBQSxBQUFDLENBQUMsS0FBSyxFQUFFLEdBQUcsQ0FBQyxDQUFDLEM7RUFBQSxDO0NBQUEsQ0FBQTtBQUNyQixBQUFBO0FBQ0EsQUFBQSxDQUFRLE1BQVAsT0FBTyxDQUFDLENBQUUsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7QUFDN0IsQUFBQSxDQUFDLEdBQUcsQ0FBQyxDQUFBLE1BQUEsR0FBRyxDQUFDLEVBQUUsQ0FBQyxRQUFRLENBQUEsQ0FBQSxDQUFBO0FBQ3BCLEFBQUEsRUFBRSxHQUFHLENBQUMsQ0FBQSxNQUFBLENBQUMsSUFB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QUFDO0FBQzVDLEFBQUEsRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxLO0NBQUssQztBQUFBLENBQUE7QUFDeEMsQUFBQTtBQUNBLEFBQUEsOEVBQTZFO0FBQzdFLEFBQUE7QUFDQSxBQUFBLEFBQUEsTUFBTSxDQUFTLE1BQVIsUUFBUSxDQUFDLENBQUUsQ0FBQyxDQUFDO0FBQ3BCLEFBQUEsQ0FBQyxZQUFZLENBQUMsQ0FBQyxXQUFXLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxTQUFTLENBQUM7QUFDakUsQUFBQSxDQUFDLFNBQVMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLFlBQVksQ0FBQyxDQUFDLGVBQWUsQ0FBQyxDQUFDLFFBQVEsQ0FBQztBQUMvRCxBQUFBLENBQUMsWUFBWSxDQUFDLENBQUMsV0FBVyxDQUFDO0FBQzNCLEFBQUE7QUFDQSxBQUFBLENBQUMsUUFBUSxDQUFDLENBQUMsVUFBVSxDQUFDO0FBQ3RCLEFBQUEsQ0FBQyxRQUFRLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxXQUFXLENBQUE7QUFDN0MsQUFBQTtBQUNBLEFBQUEsQ0FBQyxZQUFZLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxZQUFZLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxPQUFPLENBQUM7QUFDekQsQUFBQSxDQUFDLFVBQVUsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDLFdBQVcsQ0FBQztBQUNyQyxBQUFBLENBQUMsQ0FBQztBQUNGIiwibmFtZXMiOltdLCJzb3VyY2VzQ29udGVudCI6WyIjIGJhc2UtdXRpbHMubGliLmNpdmV0XHJcblxyXG5pbXBvcnQge2Fzc2VydH0gZnJvbSAnanNyOkBzdGQvYXNzZXJ0J1xyXG5pbXBvcnQge3JlbGF0aXZlLCBwYXJzZX0gZnJvbSAnbm9kZTpwYXRoJ1xyXG5pbXBvcnQge2V4aXN0c1N5bmN9IGZyb20gJ2pzcjpAc3RkL2ZzJ1xyXG5pbXBvcnQge3N0YXRTeW5jfSBmcm9tICdub2RlOmZzJ1xyXG5pbXBvcnQge2V4cGFuZEdsb2JTeW5jfSBmcm9tICdqc3I6QHN0ZC9mcy9leHBhbmQtZ2xvYidcclxuXHJcbmV4cG9ydCB7YXNzZXJ0fVxyXG5kZWNvZGVyIDo9IG5ldyBUZXh0RGVjb2RlcigpXHJcbmRlY29kZSA6PSAoeDogVWludDhBcnJheTxBcnJheUJ1ZmZlcj4pID0+XHJcblx0cmV0dXJuIGRlY29kZXIuZGVjb2RlKHgpXHJcblxyXG5leHBvcnQgRElSIDo9ICh4OiB1bmtub3duKTogdm9pZCA9PlxyXG5cdGNvbnNvbGUuZGlyIHgsIHtkZXB0aDogbnVsbH1cclxuXHJcbmV4cG9ydCB0eXBlIFRDb25zdHJ1Y3RvcjxUPiA9IG5ldyAoLi4uYXJnczogYW55W10pID0+IFRcclxuXHJcbmxldCBoYXNDbGVhciA9IGZhbHNlXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuZXhwb3J0IGNoZWNrU2V0dXAgOj0gKCk6IHZvaWQgPT5cclxuXHJcblx0cm9vdERpcjogc3RyaW5nPyA6PSBEZW5vLmVudi5nZXQoJ1BST0pFQ1RfUk9PVF9ESVInKVxyXG5cdGFzc2VydElzRGVmaW5lZChyb290RGlyKVxyXG5cdGFzc2VydCBleGlzdHNTeW5jKHJvb3REaXIpICYmIHN0YXRTeW5jKHJvb3REaXIpLmlzRGlyZWN0b3J5KCksXHJcblx0XHRcIlBsZWFzZSBzZXQgZW52IHZhciBQUk9KRUNUX1JPT1RfRElSIHRvIGEgdmFsaWQgZGlyZWN0b3J5XCJcclxuXHRyZXR1cm5cclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgY29uZENsZWFyIDo9IChcclxuXHRcdGxDbWRBcmdzOiBzdHJpbmdbXSA9IERlbm8uYXJnc1xyXG5cdFx0KTogdm9pZCA9PlxyXG5cclxuXHRpZiAoRGVuby5hcmdzLmF0KC0xKSA9PSAnIScpXHJcblx0XHRoYXNDbGVhciA9IHRydWVcclxuXHRcdGV4ZWNDbWQgJ2NsZWFyJ1xyXG5cdHJldHVyblxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbmV4cG9ydCBzdGRDaGVja3MgOj0gKCk6IHZvaWQgPT5cclxuXHJcblx0ZGVidWdnZXJcclxuXHRjaGVja1NldHVwKClcclxuXHRjb25kQ2xlYXIoKVxyXG5cdHJldHVyblxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbmV4cG9ydCBGQUlMIDo9IChlcnJNc2c6IHN0cmluZywgbjogbnVtYmVyID0gOTkpOiBuZXZlciA9PlxyXG5cclxuXHRjb25zb2xlLmxvZyBlcnJNc2dcclxuXHREZW5vLmV4aXQobilcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgU1VDQ0VFRCA6PSAobXNnOiBzdHJpbmc/ID0gdW5kZWYpOiBuZXZlciA9PlxyXG5cclxuXHRpZiBkZWZpbmVkKG1zZylcclxuXHRcdGNvbnNvbGUubG9nIG1zZ1xyXG5cdERlbm8uZXhpdCgwKVxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuIyAgICAgICAgICAgICBjbWQtYXJnc1xyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuZXhwb3J0IGZsYWcgOj0gKFxyXG5cdFx0Y2g6IHN0cmluZ1xyXG5cdFx0bENtZEFyZ3M6IHN0cmluZ1tdID0gRGVuby5hcmdzXHJcblx0XHQpOiBib29sZWFuID0+XHJcblxyXG5cdGFzc2VydCAoY2gubGVuZ3RoID09IDEpLCBcIkJhZCBmbGFnIGFyZzogI3tjaH1cIlxyXG5cdHJlIDo9IG5ldyBSZWdFeHAoXCJeLVthLXpdKiN7Y2h9W2Etel0qJFwiKVxyXG5cdGZvciBzdHIgb2YgbENtZEFyZ3NcclxuXHRcdGlmIHJlLnRlc3Qoc3RyKVxyXG5cdFx0XHRyZXR1cm4gdHJ1ZVxyXG5cdHJldHVybiBmYWxzZVxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbmV4cG9ydCBtYXBOb25PcHRpb24gOj0gKHN0cjogc3RyaW5nKTogc3RyaW5nID0+XHJcblxyXG5cdGlmIHN0ci5zdGFydHNXaXRoKCc9JylcclxuXHRcdGZpbGVOYW1lIDo9IHN0ci5zdWJzdHJpbmcoMSlcclxuXHRcdHBhdGggOj0gZmluZEZpbGUgZmlsZU5hbWVcclxuXHRcdGFzc2VydCBkZWZpbmVkKHBhdGgpLCBcIk5vIHN1Y2ggZmlsZTogI3tmaWxlTmFtZX1cIlxyXG5cdFx0cmV0dXJuIHBhdGhcclxuXHRlbHNlXHJcblx0XHRyZXR1cm4gc3RyXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuZXhwb3J0IG5vbk9wdGlvbiA6PSAoXHJcblx0XHRwb3M6IG51bWJlcixcclxuXHRcdGxDbWRBcmdzOiBzdHJpbmdbXSA9IERlbm8uYXJnc1xyXG5cdFx0KTogc3RyaW5nPyA9PlxyXG5cclxuXHRmb3Igc3RyIG9mIGxDbWRBcmdzXHJcblx0XHRpZiBub3Qgc3RyLnN0YXJ0c1dpdGgoJy0nKVxyXG5cdFx0XHRpZiAocG9zID09IDApXHJcblx0XHRcdFx0cmV0dXJuIGhhc0NsZWFyICYmIChzdHIgPT0gJyEnKSA/IHVuZGVmIDogbWFwTm9uT3B0aW9uKHN0cilcclxuXHRcdFx0ZWxzZVxyXG5cdFx0XHRcdHBvcyAtPSAxXHJcblx0cmV0dXJuIHVuZGVmXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuZXhwb3J0IGFsbE5vbk9wdGlvbnMgOj0gKFxyXG5cdFx0bENtZEFyZ3M6IHN0cmluZ1tdID0gRGVuby5hcmdzXHJcblx0XHQpOiBHZW5lcmF0b3I8c3RyaW5nLCB2b2lkLCB2b2lkPiAtPlxyXG5cclxuXHRmb3Igc3RyIG9mIGxDbWRBcmdzXHJcblx0XHRpZiBub3Qgc3RyLnN0YXJ0c1dpdGgoJy0nKSAmJiAoKHN0ciAhPSAnIScpIHx8IG5vdCBoYXNDbGVhcilcclxuXHRcdFx0eWllbGQgbWFwTm9uT3B0aW9uKHN0cilcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbiMgICAgICAgICAgICAgbG9nZ2VyXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgTE9HIDo9IGNvbnNvbGUubG9nXHJcblxyXG5leHBvcnQgREJHIDo9IChtc2c6IHN0cmluZyk6IHZvaWQgPT5cclxuXHRpZiBmbGFnKCdEJylcclxuXHRcdExPRyBtc2dcclxuXHRyZXR1cm5cclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgTExPRyA6PSAoXHJcblx0XHRsYWJlbDogc3RyaW5nXHJcblx0XHRtc2c6IHN0cmluZ1xyXG5cdFx0KTogdm9pZCA9PlxyXG5cclxuXHRsYWJlbExlbiA6PSAxNVxyXG5cdGlmIChsYWJlbC5sZW5ndGggPD0gbGFiZWxMZW4pXHJcblx0XHRzcGFjZXMgOj0gJyAnLnJlcGVhdChsYWJlbExlbi1sYWJlbC5sZW5ndGgpXHJcblx0XHRMT0cgXCIje2xhYmVsfSN7c3BhY2VzfSAje21zZ31cIlxyXG5cdGVsc2VcclxuXHRcdExPRyBcIiN7bGFiZWwuc3Vic3RyaW5nKDAsIGxhYmVsTGVuKX0gI3ttc2d9XCJcclxuXHRyZXR1cm5cclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgSUxPRyA6PSAobXNnOiBzdHJpbmcpOiB2b2lkID0+XHJcblxyXG5cdExPRyBcIiAgICN7bXNnfVwiXHJcblx0cmV0dXJuXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4jICAgICAgICAgICAgIGRhdGF0eXBlc1xyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuZXhwb3J0IHR5cGUgaGFzaFxyXG5cdFtrZXk6IHN0cmluZyB8IHN5bWJvbF06IHVua25vd25cclxuXHJcbmV4cG9ydCB0eXBlIFREZWZpbmVkID0gTm9uTnVsbGFibGU8dW5rbm93bj5cclxuZXhwb3J0IHR5cGUgVE5vdERlZmluZWQgPSBudWxsIHwgdW5kZWZpbmVkXHJcblxyXG5leHBvcnQgdW5kZWYgOj0gdW5kZWZpbmVkXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuZXhwb3J0IGRlZmluZWQgOj0gKHg6IHVua25vd24pOiB4IGlzIFREZWZpbmVkID0+XHJcblxyXG5cdHJldHVybiAoeCAhPSB1bmRlZikgJiYgKHggIT0gbnVsbClcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgbm90ZGVmaW5lZCA6PSAoeDogdW5rbm93bik6IHggaXMgVE5vdERlZmluZWQgPT5cclxuXHJcblx0cmV0dXJuICh4ID09IHVuZGVmKSB8fCAoeCA9PSBudWxsKVxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBhc3NlcnRJc0RlZmluZWQoXHJcblx0XHR2YWx1ZTogdW5rbm93blxyXG5cdFx0bmFtZTogc3RyaW5nID0gJydcclxuXHRcdCk6IGFzc2VydHMgdmFsdWUgaXMgVERlZmluZWQgPT5cclxuXHJcblx0aWYgbm90ZGVmaW5lZCh2YWx1ZSlcclxuXHRcdHRocm93IG5ldyBFcnJvcihcInZhbHVlIGlzIG5vdCBkZWZpbmVkXCIpXHJcblx0cmV0dXJuXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGFzc2VydE5vdERlZmluZWQoXHJcblx0XHR2YWx1ZTogdW5rbm93blxyXG5cdFx0bmFtZTogc3RyaW5nID0gJydcclxuXHRcdCk6IGFzc2VydHMgdmFsdWUgaXMgVE5vdERlZmluZWQgPT5cclxuXHJcblx0aWYgZGVmaW5lZCh2YWx1ZSlcclxuXHRcdHRocm93IG5ldyBFcnJvcihcInZhbHVlIGlzIGRlZmluZWRcIilcclxuXHRyZXR1cm5cclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgY3JvYWsgOj0gKG1zZzogc3RyaW5nKTogbmV2ZXIgPT5cclxuXHJcblx0dGhyb3cgbmV3IEVycm9yKG1zZylcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgcmVwbGFjZUluQXJyYXkgOj0gKFxyXG5cdGxTdHJpbmdzOiBzdHJpbmdbXVxyXG5cdGhSZXBsYWNlOiB7W2tleTogc3RyaW5nXTogc3RyaW5nfVxyXG5cdCk6IHN0cmluZ1tdID0+XHJcblxyXG5cdHJldHVybiBmb3Igc3RyIG9mIGxTdHJpbmdzXHJcblx0XHRpZiBoUmVwbGFjZS5oYXNPd25Qcm9wZXJ0eShzdHIpXHJcblx0XHRcdGhSZXBsYWNlW3N0cl1cclxuXHRcdGVsc2VcclxuXHRcdFx0c3RyXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4jICAgICAgICAgICAgIGZzeXNcclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbmV4cG9ydCBpc0ZpbGUgOj0gKHBhdGg6IHN0cmluZyk6IGJvb2xlYW4gPT5cclxuXHJcblx0cmV0dXJuIGV4aXN0c1N5bmMocGF0aCkgJiYgc3RhdFN5bmMocGF0aCkuaXNGaWxlKClcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgc2x1cnAgOj0gKHBhdGg6IHN0cmluZyk6IHN0cmluZyA9PlxyXG5cclxuXHRkYXRhIDo9IERlbm8ucmVhZEZpbGVTeW5jIHBhdGhcclxuXHRyZXR1cm4gZGVjb2Rlci5kZWNvZGUoZGF0YSkucmVwbGFjZUFsbCgnXFxyJywgJycpXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuZXhwb3J0IHJtRmlsZSA6PSAocGF0aDogc3RyaW5nKTogdm9pZCA9PlxyXG5cclxuXHRpZiBleGlzdHNTeW5jIHBhdGhcclxuXHRcdERlbm8ucmVtb3ZlU3luYyBwYXRoXHJcblx0cmV0dXJuXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuZXhwb3J0IGZpbGVFeHQgOj0gKHBhdGg6IHN0cmluZyk6IHN0cmluZyA9PlxyXG5cclxuXHRpZiBsTWF0Y2hlcyA6PSBwYXRoLm1hdGNoKC9cXC5bXlxcLl0rJC8pXHJcblx0XHRyZXR1cm4gbE1hdGNoZXNbMF1cclxuXHRlbHNlXHJcblx0XHRyZXR1cm4gJydcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgd2l0aEV4dCA6PSAocGF0aDogc3RyaW5nLCBleHQ6IHN0cmluZyk6IHN0cmluZyA9PlxyXG5cclxuXHRsTWF0Y2hlcyA6PSBwYXRoLm1hdGNoIC9eKC4qKShcXC5bXlxcLl0rKSQvXHJcblx0aWYgKGxNYXRjaGVzID09IG51bGwpXHJcblx0XHRjcm9hayBcIkJhZCBwYXRoOiAnI3twYXRofSdcIlxyXG5cdFx0cmV0dXJuICcnXHJcblx0ZWxzZVxyXG5cdFx0W18sIGhlYWRTdHIsIG9yZ0V4dF0gOj0gbE1hdGNoZXNcclxuXHRcdHJldHVybiBcIiN7aGVhZFN0cn0je2V4dH1cIlxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbmV4cG9ydCBub3JtYWxpemVQYXRoIDo9IChwYXRoOiBzdHJpbmcpOiBzdHJpbmcgPT5cclxuXHJcblx0bnBhdGggOj0gcGF0aC5yZXBsYWNlQWxsKCdcXFxcJywgJy8nKVxyXG5cdGlmIChucGF0aC5jaGFyQXQoMSkgPT0gJzonKVxyXG5cdFx0cmV0dXJuIG5wYXRoLmNoYXJBdCgwKS50b1VwcGVyQ2FzZSgpICsgbnBhdGguc3Vic3RyaW5nKDEpXHJcblx0ZWxzZVxyXG5cdFx0cmV0dXJuIG5wYXRoXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuZXhwb3J0IHJlbHBhdGggOj0gKHBhdGg6IHN0cmluZyk6IHN0cmluZyA9PlxyXG5cclxuXHRyZXR1cm4gbm9ybWFsaXplUGF0aChyZWxhdGl2ZSgnJywgcGF0aCkpXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuZXhwb3J0IGJ1aWxkRmlsZU5hbWUgOj0gKFxyXG5cdFx0c3R1Yjogc3RyaW5nXHJcblx0XHRwdXJwb3NlOiBzdHJpbmc/XHJcblx0XHRleHQ6IHN0cmluZ1xyXG5cdFx0KSA9PlxyXG5cclxuXHRyZXR1cm4gKFxyXG5cdFx0cHVycG9zZSA/IFwiI3tzdHVifS4je3B1cnBvc2V9I3tleHR9XCJcclxuXHRcdCAgICAgICAgOiBcIiN7c3R1Yn0je2V4dH1cIlxyXG5cdFx0KVxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbmV4cG9ydCBidWlsZFRlc3RGaWxlTmFtZSA6PSAoXHJcblx0XHRzdHViOiBzdHJpbmdcclxuXHRcdHB1cnBvc2U6IHN0cmluZz9cclxuXHRcdGV4dDogc3RyaW5nXHJcblx0XHQpID0+XHJcblxyXG5cdHJldHVybiAoXHJcblx0XHRwdXJwb3NlID8gXCIje3N0dWJ9LiN7cHVycG9zZX0udGVzdCN7ZXh0fVwiXHJcblx0XHQgICAgICAgIDogXCIje3N0dWJ9LnRlc3Qje2V4dH1cIlxyXG5cdFx0KVxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbmV4cG9ydCB0eXBlIFRQYXRoSW5mbyA9IHtcclxuXHRyb290OiBzdHJpbmdcclxuXHRkaXI6IHN0cmluZ1xyXG5cdGZpbGVOYW1lOiBzdHJpbmdcclxuXHJcblx0c3R1Yjogc3RyaW5nXHJcblx0cHVycG9zZTogc3RyaW5nP1xyXG5cdGV4dDogc3RyaW5nXHJcblx0fVxyXG5cclxuZXhwb3J0IHBhcnNlUGF0aCA6PSAoXHJcblx0XHRwYXRoOiBzdHJpbmdcclxuXHRcdCk6IFRQYXRoSW5mbyA9PlxyXG5cclxuXHR7cm9vdCwgZGlyLCBiYXNlfSA6PSBwYXJzZShwYXRoKVxyXG5cclxuXHRsUGFydHMgOj0gYmFzZS5zcGxpdCgnLicpXHJcblx0YXNzZXJ0IChsUGFydHMubGVuZ3RoID4gMiksIFwiQmFkIHBhdGg6ICN7cGF0aH1cIlxyXG5cdHJldHVybiB7XHJcblx0XHRyb290OiBub3JtYWxpemVQYXRoKHJvb3QpXHJcblx0XHRkaXI6IG5vcm1hbGl6ZVBhdGgoZGlyKVxyXG5cdFx0ZmlsZU5hbWU6IGJhc2VcclxuXHJcblx0XHRzdHViOiAgICBsUGFydHMuc2xpY2UoMCwgLTIpLmpvaW4oJy4nKVxyXG5cdFx0cHVycG9zZTogbFBhcnRzLmF0KC0yKVxyXG5cdFx0ZXh0OiAgICAgXCIuI3tsUGFydHMuYXQoLTEpfVwiXHJcblx0XHR9XHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuZXhwb3J0IHR5cGUgVEV4ZWNSZXN1bHQgPSB7XHJcblx0c3VjY2VzczogYm9vbGVhblxyXG5cdGNvZGU6IG51bWJlclxyXG5cdHNpZ25hbD86IERlbm8uU2lnbmFsIHwgbnVsbFxyXG5cdHN0ZG91dD86IHN0cmluZ1xyXG5cdHN0ZGVycj86IHN0cmluZ1xyXG5cdH1cclxuXHJcbmV4cG9ydCB0eXBlIFRSZXBsYWNlSGFzaCA9IHtcclxuXHRba2V5OiBzdHJpbmddOiBzdHJpbmdcclxuXHR9XHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4jIEFTWU5DXHJcblxyXG5leHBvcnQgZXhlY0NtZCA6PSAoXHJcblx0Y21kTmFtZTogc3RyaW5nXHJcblx0bENtZEFyZ3M6IHN0cmluZ1tdID0gW11cclxuXHRoUmVwbGFjZTogVFJlcGxhY2VIYXNoID0ge31cclxuXHRjYXB0dXJlOiBib29sZWFuID0gZmFsc2VcclxuXHQpOiBURXhlY1Jlc3VsdCA9PlxyXG5cclxuXHRjaGlsZCA6PSBuZXcgRGVuby5Db21tYW5kKGNtZE5hbWUsIHtcclxuXHRcdGFyZ3M6IHJlcGxhY2VJbkFycmF5KGxDbWRBcmdzLCBoUmVwbGFjZSlcclxuXHRcdHN0ZG91dDogY2FwdHVyZSA/ICdwaXBlZCcgOiAnaW5oZXJpdCdcclxuXHRcdHN0ZGVycjogY2FwdHVyZSA/ICdwaXBlZCcgOiAnaW5oZXJpdCdcclxuXHRcdH0pXHJcblx0aWYgY2FwdHVyZVxyXG5cdFx0e3N1Y2Nlc3MsIGNvZGUsIHNpZ25hbCwgc3Rkb3V0LCBzdGRlcnJ9IDo9IGF3YWl0IGNoaWxkLm91dHB1dCgpXHJcblx0XHRyZXR1cm4ge1xyXG5cdFx0XHRzdWNjZXNzLCBjb2RlXHJcblx0XHRcdHNpZ25hbDogc2lnbmFsIHx8IHVuZGVmXHJcblx0XHRcdHN0ZG91dDogZGVjb2RlKHN0ZG91dClcclxuXHRcdFx0c3RkZXJyOiBkZWNvZGUoc3RkZXJyKVxyXG5cdFx0XHR9XHJcblx0ZWxzZVxyXG5cdFx0e3N1Y2Nlc3MsIGNvZGUsIHNpZ25hbH0gOj0gYXdhaXQgY2hpbGQub3V0cHV0KClcclxuXHRcdHJldHVybiB7XHJcblx0XHRcdHN1Y2Nlc3NcclxuXHRcdFx0Y29kZVxyXG5cdFx0XHRzaWduYWw6IHNpZ25hbCB8fCB1bmRlZlxyXG5cdFx0XHR9XHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuZXhwb3J0IG5ld2VyRGVzdEZpbGVFeGlzdHMgOj0gKFxyXG5cdFx0cGF0aDogc3RyaW5nXHJcblx0XHRleHQ6IHN0cmluZ1xyXG5cdFx0KTogYm9vbGVhbiA9PlxyXG5cclxuXHRkZXN0UGF0aCA6PSB3aXRoRXh0IHBhdGgsIGV4dFxyXG5cdGlmIG5vdCBleGlzdHNTeW5jKGRlc3RQYXRoKVxyXG5cdFx0cmV0dXJuIGZhbHNlXHJcblx0c3JjTVMgOj0gc3RhdFN5bmMocGF0aCkubXRpbWVNc1xyXG5cdGRlc3RNUyA6PSBzdGF0U3luYyhkZXN0UGF0aCkubXRpbWVNc1xyXG5cdHJldHVybiAoZGVzdE1TID4gc3JjTVMpXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuZXhwb3J0IGNtZFN1Y2NlZWRzIDo9IChcclxuXHRcdGNtZE5hbWU6IHN0cmluZ1xyXG5cdFx0bEFyZ3M6IHN0cmluZ1tdID0gW11cclxuXHRcdCk6IGJvb2xlYW4gPT5cclxuXHJcblx0Y2hpbGQgOj0gbmV3IERlbm8uQ29tbWFuZCBjbWROYW1lLCB7XHJcblx0XHRhcmdzOiBsQXJnc1xyXG5cdFx0c3Rkb3V0OiAncGlwZWQnXHJcblx0XHRzdGRlcnI6ICdwaXBlZCdcclxuXHRcdH1cclxuXHRyZXR1cm4gY2hpbGQub3V0cHV0U3luYygpLnN1Y2Nlc3NcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgc3BsaXRQYXR0ZXJucyA6PSAoXHJcblx0XHRsQWxsUGF0czogc3RyaW5nIHwgc3RyaW5nW11cclxuXHRcdCk6IFtzdHJpbmdbXSwgc3RyaW5nW11dID0+XHJcblxyXG5cdGxQb3NQYXRzOiBzdHJpbmdbXSA6PSBbXVxyXG5cdGxOZWdQYXRzOiBzdHJpbmdbXSA6PSBbXVxyXG5cclxuXHRpZiAodHlwZW9mIGxBbGxQYXRzID09ICdzdHJpbmcnKVxyXG5cdFx0IyAtLS0gQSBzaW5nbGUgc3RyaW5nIGNhbid0IGJlIGEgbmVnYXRpdmUgcGF0dGVyblxyXG5cdFx0YXNzZXJ0IG5vdCBsQWxsUGF0cy5tYXRjaCgvXlxcIS8pLCBcIkJhZCBnbG9iIHBhdHRlcm46ICN7bEFsbFBhdHN9XCJcclxuXHRcdGxQb3NQYXRzLnB1c2ggbEFsbFBhdHNcclxuXHRlbHNlXHJcblx0XHRmb3IgcGF0IG9mIGxBbGxQYXRzXHJcblx0XHRcdGxNYXRjaGVzIDo9IHBhdC5tYXRjaCgvXihcXCFcXHMqKT8oLiopJC8pXHJcblx0XHRcdGlmIGxNYXRjaGVzXHJcblx0XHRcdFx0aWYgbE1hdGNoZXNbMV1cclxuXHRcdFx0XHRcdGxOZWdQYXRzLnB1c2ggbE1hdGNoZXNbMl1cclxuXHRcdFx0XHRlbHNlXHJcblx0XHRcdFx0XHRsUG9zUGF0cy5wdXNoIGxNYXRjaGVzWzJdXHJcblx0cmV0dXJuIFtsUG9zUGF0cywgbE5lZ1BhdHNdXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4jIEdFTkVSQVRPUlxyXG4jXHJcbiMgICAgVXNlIGxpa2U6XHJcbiMgICAgICAgZm9yIHBhdGggb2YgYWxsRmlsZXNNYXRjaGluZyhsUGF0cylcclxuIyAgICAgICAgICBPUlxyXG4jICAgICAgIGxQYXRocyA6PSBBcnJheS5mcm9tKGFsbEZpbGVzTWF0Y2hpbmcobFBhdHMpKVxyXG4jXHJcbiMgICAgTk9URTogQnkgZGVmYXVsdCwgc2VhcmNoZXMgZnJvbSAuL3NyY1xyXG5cclxuZXhwb3J0IGFsbEZpbGVzTWF0Y2hpbmcgOj0gKFxyXG5cdFx0bFBhdHRlcm5zOiBzdHJpbmcgfCBzdHJpbmdbXVxyXG5cdFx0aEdsb2JPcHRpb25zID0ge1xyXG5cdFx0XHRyb290OiAnLi9zcmMnXHJcblx0XHRcdGluY2x1ZGVEaXJzOiBmYWxzZVxyXG5cdFx0XHR9XHJcblx0XHQpOiBHZW5lcmF0b3I8c3RyaW5nLCB2b2lkLCB2b2lkPiAtPlxyXG5cclxuXHRbbFBvc1BhdHMsIGxOZWdQYXRzXSA6PSBzcGxpdFBhdHRlcm5zIGxQYXR0ZXJuc1xyXG5cdGlmIGZsYWcoJ0QnKVxyXG5cdFx0TE9HIFwiUEFUVEVSTlM6XCJcclxuXHRcdGZvciBwYXQgb2YgbFBvc1BhdHNcclxuXHRcdFx0SUxPRyBcIlBPUzogI3twYXR9XCJcclxuXHRcdGZvciBwYXQgb2YgbE5lZ1BhdHNcclxuXHRcdFx0SUxPRyBcIk5FRzogI3twYXR9XCJcclxuXHJcblx0c2V0U2tpcCA6PSBuZXcgU2V0PHN0cmluZz4oKVxyXG5cdGZvciBwYXQgb2YgbE5lZ1BhdHNcclxuXHRcdGZvciB7cGF0aH0gb2YgZXhwYW5kR2xvYlN5bmMocGF0LCBoR2xvYk9wdGlvbnMpXHJcblx0XHRcdHNldFNraXAuYWRkIHBhdGhcclxuXHJcblx0Zm9yIHBhdCBvZiBsUG9zUGF0c1xyXG5cdFx0Zm9yIHtwYXRofSBvZiBleHBhbmRHbG9iU3luYyhwYXQsIGhHbG9iT3B0aW9ucylcclxuXHRcdFx0aWYgbm90IHNldFNraXAuaGFzIHBhdGhcclxuXHRcdFx0XHREQkcgXCJQQVRIOiAje3BhdGh9XCJcclxuXHRcdFx0XHR5aWVsZCBwYXRoXHJcblx0XHRcdFx0c2V0U2tpcC5hZGQgcGF0aFxyXG5cdHJldHVyblxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbmV4cG9ydCBmaW5kRmlsZSA6PSAoZmlsZU5hbWU6IHN0cmluZyk6IHN0cmluZz8gPT5cclxuXHJcblx0bFBhdGhzIDo9IEFycmF5LmZyb20gYWxsRmlsZXNNYXRjaGluZyhcIioqLyN7ZmlsZU5hbWV9XCIpXHJcblx0c3dpdGNoIGxQYXRocy5sZW5ndGhcclxuXHRcdHdoZW4gMVxyXG5cdFx0XHRyZXR1cm4gbm9ybWFsaXplUGF0aChsUGF0aHNbMF0pXHJcblx0XHR3aGVuIDBcclxuXHRcdFx0cmV0dXJuIHVuZGVmXHJcblx0XHRlbHNlXHJcblx0XHRcdGZvciBwYXRoIG9mIGxQYXRoc1xyXG5cdFx0XHRcdGNvbnNvbGUubG9nIHBhdGhcclxuXHRcdFx0Y3JvYWsgXCJNdWx0aXBsZSBmaWxlcyB3aXRoIG5hbWUgI3tmaWxlTmFtZX1cIlxyXG5cdFx0XHRyZXR1cm4gJydcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbiMgQVNZTkNcclxuXHJcbmV4cG9ydCB0eXBlIFRQcm9jRnVuYyA9IChwYXRoOiBzdHJpbmcpID0+IFByb21pc2U8dW5rbm93bj5cclxuZXhwb3J0IHR5cGUgVFByb2NSZXN1bHQgPSB7IFtwYXRoOiBzdHJpbmddOiB1bmtub3duIH1cclxuXHJcbmV4cG9ydCBwcm9jRmlsZXMgOj0gKFxyXG5cdFx0bFBhdHRlcm5zOiBzdHJpbmcgfCBzdHJpbmdbXVxyXG5cdFx0cHJvY0Z1bmM6IFRQcm9jRnVuY1xyXG5cdFx0KTogW1xyXG5cdFx0XHRUUHJvY1Jlc3VsdCAgICAgIyBwYXRocyBzdWNjZWVkZWRcclxuXHRcdFx0VFByb2NSZXN1bHQ/ICAgICMgcGF0aHMgZmFpbGVkXHJcblx0XHRcdF0gPT5cclxuXHJcblx0IyAtLS0gV2UgbmVlZCB0aGUgcGF0aHMgZm9yIGxhdGVyXHJcblx0bFBhdGhzIDo9IEFycmF5LmZyb20oYWxsRmlsZXNNYXRjaGluZyhsUGF0dGVybnMpKVxyXG5cclxuXHRsUHJvbWlzZXMgOj0gZm9yIHBhdGggb2YgbFBhdGhzXHJcblx0XHRwcm9jRnVuYyBwYXRoXHJcblx0bFJlc3VsdHMgOj0gYXdhaXQgUHJvbWlzZS5hbGxTZXR0bGVkKGxQcm9taXNlcylcclxuXHJcblx0aFN1Y2NlZWRlZDogVFByb2NSZXN1bHQgOj0ge31cclxuXHRoRmFpbGVkOiAgICBUUHJvY1Jlc3VsdCA6PSB7fVxyXG5cclxuXHQjIC0tLSBsUmVzdWx0cyBhcmUgaW4gdGhlIHNhbWUgb3JkZXIgYXMgbFBhdGhzXHJcblx0bGV0IGhhc0ZhaWxlZCA9IGZhbHNlXHJcblx0Zm9yIHJlcyxpIG9mIGxSZXN1bHRzXHJcblx0XHRwYXRoIDo9IGxQYXRoc1tpXVxyXG5cdFx0aWYgKHJlcy5zdGF0dXMgPT0gJ2Z1bGZpbGxlZCcpXHJcblx0XHRcdGhTdWNjZWVkZWRbcGF0aF0gPSByZXMudmFsdWVcclxuXHRcdGVsc2VcclxuXHRcdFx0aGFzRmFpbGVkID0gdHJ1ZVxyXG5cdFx0XHRoRmFpbGVkW3BhdGhdID0gcmVzLnJlYXNvblxyXG5cclxuXHRyZXR1cm4gW1xyXG5cdFx0aFN1Y2NlZWRlZCxcclxuXHRcdGhhc0ZhaWxlZCA/IGhGYWlsZWQgOiB1bmRlZlxyXG5cdFx0XVxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbnR5cGUgVEZpbGVSdW5uZXIgPSAoXHJcblx0XHRzdHViOiBzdHJpbmdcclxuXHRcdHB1cnBvc2U6IHN0cmluZz9cclxuXHRcdGxBcmdzPzogc3RyaW5nW11cclxuXHRcdGhPcHRpb25zPzogaGFzaFxyXG5cdFx0KSA9PiBQcm9taXNlPHZvaWQ+XHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuZXhwb3J0IGdldFN0cmluZ09wdGlvbiA6PSAoXHJcblx0XHRoT3B0aW9uczogaGFzaFxyXG5cdFx0a2V5OiBzdHJpbmdcclxuXHRcdGRlZlZhbDogc3RyaW5nPyA9IHVuZGVmXHJcblx0XHQpOiBzdHJpbmc/ID0+XHJcblxyXG5cdGlmIGhPcHRpb25zLmhhc093blByb3BlcnR5IGtleVxyXG5cdFx0dmFsIDo9IGhPcHRpb25zW2tleV1cclxuXHRcdGFzc2VydCAodHlwZW9mIHZhbCA9PSAnc3RyaW5nJyksIFwiTm90IGEgc3RyaW5nOiAje3ZhbH1cIlxyXG5cdFx0cmV0dXJuIHZhbFxyXG5cdGVsc2VcclxuXHRcdHJldHVybiBkZWZWYWxcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgZ2V0Qm9vbGVhbk9wdGlvbiA6PSAoXHJcblx0XHRoT3B0aW9uczogaGFzaFxyXG5cdFx0a2V5OiBzdHJpbmdcclxuXHRcdGRlZlZhbDogYm9vbGVhbiA9IGZhbHNlXHJcblx0XHQpOiBib29sZWFuID0+XHJcblxyXG5cdGlmIGhPcHRpb25zLmhhc093blByb3BlcnR5IGtleVxyXG5cdFx0dmFsIDo9IGhPcHRpb25zW2tleV1cclxuXHRcdGFzc2VydCAodHlwZW9mIHZhbCA9PSAnYm9vbGVhbicpLCBcIk5vdCBhIGJvb2xlYW46ICN7dmFsfVwiXHJcblx0XHRyZXR1cm4gdmFsXHJcblx0ZWxzZVxyXG5cdFx0cmV0dXJuIGRlZlZhbFxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuIyBBU1lOQ1xyXG5cclxuZXhwb3J0IHRyeUNtZCA6PSAoXHJcblx0XHRmdW5jOiBURmlsZVJ1bm5lclxyXG5cdFx0c3R1Yjogc3RyaW5nXHJcblx0XHRwdXJwb3NlOiBzdHJpbmc/XHJcblx0XHRsQXJnczogc3RyaW5nW10gPSBbXVxyXG5cdFx0aE9wdGlvbnM6IGhhc2ggPSB7fVxyXG5cdFx0KTogdm9pZCA9PlxyXG5cclxuXHR0cnlcclxuXHRcdGF3YWl0IGZ1bmMoc3R1YiwgcHVycG9zZSwgbEFyZ3MsIGhPcHRpb25zKVxyXG5cdGNhdGNoIGVyclxyXG5cdFx0Y29uc29sZS5lcnJvciBlcnJcclxuXHRcdGlmIGdldEJvb2xlYW5PcHRpb24gaE9wdGlvbnMsICdleGl0T25GYWlsJywgdHJ1ZVxyXG5cdFx0XHREZW5vLmV4aXQoOTkpXHJcblx0XHRyZXR1cm5cclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbiMgICAgICBSVU5ORVJTIChhbGwgQVNZTkMpXHJcbiMgICAgICB3aGVuIHJ1biB1c2luZyB0cnlDbWQoKVxyXG4jICAgICAgICAgLSBmYWxzZSByZXR1cm4gd2lsbCBleGl0IHRoZSBzY3JpcHRcclxuIyAgICAgICAgIC0gZmFsc2UgcmV0dXJuIHdpbGwgY2F1c2UgYSBsb2cgbWVzc2FnZVxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4jIEFTWU5DXHJcblxyXG5leHBvcnQgY2l2ZXQydHNGaWxlIDo9IChcclxuXHRcdHN0dWI6IHN0cmluZ1xyXG5cdFx0cHVycG9zZTogc3RyaW5nP1xyXG5cdFx0KTogdm9pZCA9PlxyXG5cclxuXHRmaWxlTmFtZSA6PSBidWlsZEZpbGVOYW1lIHN0dWIsIHB1cnBvc2UsICcuY2l2ZXQnXHJcblx0TExPRyAnQ09NUElMRScsIGZpbGVOYW1lXHJcblxyXG5cdHBhdGggOj0gZmluZEZpbGUgZmlsZU5hbWVcclxuXHRhc3NlcnQgcGF0aCwgXCJObyBzdWNoIGZpbGU6ICN7ZmlsZU5hbWV9XCJcclxuXHJcblx0aWYgbmV3ZXJEZXN0RmlsZUV4aXN0cyBwYXRoLCAnLnRzJ1xyXG5cdFx0SUxPRyBcImFscmVhZHkgY29tcGlsZWRcIlxyXG5cdFx0cmV0dXJuXHJcblxyXG5cdHtzdWNjZXNzfSA6PSBhd2FpdCBleGVjQ21kICdkZW5vJywgW1xyXG5cdFx0J3J1bidcclxuXHRcdCctQSdcclxuXHRcdCducG06QGRhbmllbHgvY2l2ZXQnXHJcblx0XHQnLS1pbmxpbmUtbWFwJ1xyXG5cdFx0Jy1vJywgJy50cydcclxuXHRcdCctYycsIHBhdGhcclxuXHRcdF1cclxuXHRpZiBzdWNjZXNzXHJcblx0XHRJTE9HIFwiT0tcIlxyXG5cdGVsc2VcclxuXHRcdElMT0cgXCJGQUlMRURcIlxyXG5cdFx0cm1GaWxlIHdpdGhFeHQoZmlsZU5hbWUsICcudHMnKVxyXG5cdFx0Y3JvYWsgXCJDb21waWxlIG9mICN7ZmlsZU5hbWV9IGZhaWxlZFwiXHJcblxyXG5cdCMgLS0tIFR5cGUgY2hlY2sgdGhlICoudHMgZmlsZVxyXG5cdExPRyBcIlRZUEUgQ0hFQ0s6ICN7ZmlsZU5hbWV9XCJcclxuXHRoIDo9IGF3YWl0IGV4ZWNDbWQgJ2Rlbm8nLCBbXHJcblx0XHQnY2hlY2snLFxyXG5cdFx0d2l0aEV4dChwYXRoLCAnLnRzJylcclxuXHRcdF1cclxuXHJcblx0aWYgaC5zdWNjZXNzXHJcblx0XHRJTE9HIFwiT0tcIlxyXG5cdGVsc2VcclxuXHRcdElMT0cgXCJGQUlMRURcIlxyXG5cdFx0cm1GaWxlIHdpdGhFeHQoZmlsZU5hbWUsICcudHMnKVxyXG5cdFx0Y3JvYWsgXCJUeXBlIENoZWNrIG9mICN7ZmlsZU5hbWV9IGZhaWxlZFwiXHJcblx0cmV0dXJuXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4jIEFTWU5DXHJcblxyXG5leHBvcnQgZG9Vbml0VGVzdCA6PSAoXHJcblx0XHRzdHViOiBzdHJpbmdcclxuXHRcdHB1cnBvc2U6IHN0cmluZz8gICAgICAjIHB1cnBvc2Ugb2YgdGhlIGZpbGUgYmVpbmcgdGVzdGVkXHJcblx0XHRsQXJnczogc3RyaW5nW10gPSBbXVxyXG5cdFx0KTogdm9pZCA9PlxyXG5cclxuXHRkZWJ1Z2dlclxyXG5cdGZpbGVOYW1lIDo9IGJ1aWxkVGVzdEZpbGVOYW1lIHN0dWIsIHB1cnBvc2UsICcuY2l2ZXQnXHJcblx0TExPRyBcIlVOSVQgVEVTVFwiLCBmaWxlTmFtZVxyXG5cclxuXHR0ZXN0UGF0aCA6PSBmaW5kRmlsZSBmaWxlTmFtZVxyXG5cdGlmIG5vdGRlZmluZWQodGVzdFBhdGgpXHJcblx0XHRJTE9HIFwiVGhlcmUgaXMgbm8gdW5pdCB0ZXN0IGZvciAje2ZpbGVOYW1lfVwiXHJcblx0XHRyZXR1cm5cclxuXHREQkcgXCJURVNUIEZJTEU6ICN7cmVscGF0aCh0ZXN0UGF0aCl9XCJcclxuXHJcblx0aWYgbm90IG5ld2VyRGVzdEZpbGVFeGlzdHModGVzdFBhdGgsICcudHMnKVxyXG5cdFx0TExPRyAnQ09NUElMRScsIHJlbHBhdGgodGVzdFBhdGgpXHJcblx0XHR7c3VjY2Vzc30gOj0gYXdhaXQgZXhlY0NtZCAnZGVubycsIFtcclxuXHRcdFx0J3J1bidcclxuXHRcdFx0Jy1BJ1xyXG5cdFx0XHQuLi4oZmxhZygnZCcpID8gWyctLWluc3BlY3QtYnJrJ10gOiBbXSlcclxuXHRcdFx0J25wbTpAZGFuaWVseC9jaXZldCdcclxuXHRcdFx0Jy0taW5saW5lLW1hcCdcclxuXHRcdFx0Jy1vJywgJy50cydcclxuXHRcdFx0Jy1jJywgdGVzdFBhdGhcclxuXHRcdFx0XVxyXG5cdFx0aWYgbm90IHN1Y2Nlc3NcclxuXHRcdFx0Y3JvYWsgXCIgICBDb21waWxlIG9mICN7dGVzdFBhdGh9IGZhaWxlZCFcIlxyXG5cclxuXHR0c1Rlc3RQYXRoIDo9IHJlbHBhdGgod2l0aEV4dCh0ZXN0UGF0aCwgJy50cycpKVxyXG5cdHZlcmJvc2UgOj0gZmxhZygndicpXHJcblx0bENtZEFyZ3MgOj0gKFxyXG5cdFx0ICB2ZXJib3NlXHJcblx0XHQ/IFsndGVzdCcsICctQScsICctLWNvdmVyYWdlLXJhdy1kYXRhLW9ubHknLCB0c1Rlc3RQYXRoXVxyXG5cdFx0OiBbJ3Rlc3QnLCAnLUEnLCAnLS1jb3ZlcmFnZS1yYXctZGF0YS1vbmx5JywgJy0tcmVwb3J0ZXInLCAnZG90JywgdHNUZXN0UGF0aF1cclxuXHRcdClcclxuXHJcblx0aCA6PSBhd2FpdCBleGVjQ21kICdkZW5vJywgbENtZEFyZ3NcclxuXHRhc3NlcnQgaC5zdWNjZXNzLCBcIiAgIGRlbm8gI3tsQ21kQXJncy5qb2luKCcgJyl9IEZBSUxFRFwiXHJcblx0cmV0dXJuXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4jIEFTWU5DXHJcblxyXG5leHBvcnQgZG9JbnN0YWxsQ21kIDo9IChcclxuXHRcdHN0dWI6IHN0cmluZyxcclxuXHRcdHB1cnBvc2U6IHN0cmluZz8gPSAnY21kJ1xyXG5cdFx0bEFyZ3M6IHN0cmluZ1tdID0gW11cclxuXHRcdGhPcHRpb25zOiBoYXNoID0ge31cclxuXHRcdCk6IHZvaWQgPT5cclxuXHJcblx0ZmlsZU5hbWUgOj0gYnVpbGRGaWxlTmFtZSBzdHViLCBwdXJwb3NlLCAnLnRzJ1xyXG5cdExPRyBcIklOU1RBTEwgQ01EOiAje2ZpbGVOYW1lfVwiXHJcblxyXG5cdHBhdGggOj0gZmluZEZpbGUgZmlsZU5hbWVcclxuXHRhc3NlcnQgcGF0aCwgXCJObyBzdWNoIGZpbGU6ICN7ZmlsZU5hbWV9XCJcclxuXHJcblx0bmFtZSA6PSBnZXRTdHJpbmdPcHRpb24oaE9wdGlvbnMsICduYW1lJykgfHwgcGFyc2VQYXRoKHBhdGgpLnN0dWJcclxuXHRoIDo9IGF3YWl0IGV4ZWNDbWQgJ2Rlbm8nLCBbXHJcblx0XHQnaW5zdGFsbCcsXHJcblx0XHQnLWZnQScsXHJcblx0XHQnLW4nLCBuYW1lLFxyXG5cdFx0Jy0tbm8tY29uZmlnJyxcclxuXHRcdCctLWltcG9ydC1tYXAnLCAnaW1wb3J0X21hcC5qc29uYycsXHJcblx0XHRwYXRoXHJcblx0XHRdXHJcblx0YXNzZXJ0IGguc3VjY2VzcywgXCIgICBGQUlMRURcIlxyXG5cdExPRyBcIiAgIE9LXCJcclxuXHRyZXR1cm5cclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbiMgQVNZTkNcclxuXHJcbmV4cG9ydCBkb1J1biA6PSAoXHJcblx0XHRzdHViOiBzdHJpbmdcclxuXHRcdHB1cnBvc2U6IHN0cmluZz9cclxuXHRcdGxBcmdzOiBzdHJpbmdbXSA9IFtdXHJcblx0XHQpOiB2b2lkID0+XHJcblxyXG5cdGZpbGVOYW1lIDo9IGJ1aWxkRmlsZU5hbWUgc3R1YiwgcHVycG9zZSwgJy50cydcclxuXHRMT0cgY2VudGVyZWQoXCJSVU46ICN7ZmlsZU5hbWV9XCIsIDY0LCAnLScpXHJcblxyXG5cdHBhdGggOj0gZmluZEZpbGUgZmlsZU5hbWVcclxuXHRhc3NlcnQgcGF0aCwgXCJObyBzdWNoIGZpbGU6ICN7ZmlsZU5hbWV9XCJcclxuXHJcblx0aCA6PSBhd2FpdCBleGVjQ21kICdkZW5vJywgW1xyXG5cdFx0J3J1bidcclxuXHRcdCctQSdcclxuXHRcdC4uLihmbGFnKCdkJykgPyBbJy0taW5zcGVjdC1icmsnXSA6IFtdKVxyXG5cdFx0cGF0aFxyXG5cdFx0Jy0tJ1xyXG5cdFx0bEFyZ3MuLi5cclxuXHRcdF1cclxuXHJcblx0YXNzZXJ0IGguc3VjY2VzcywgXCIgICBGQUlMRURcIlxyXG5cdHJldHVyblxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbmV4cG9ydCBzZXAgOj0gKFxyXG5cdFx0bGFiZWw6IHN0cmluZz8gPSB1bmRlZlxyXG5cdFx0Y2hhcjogc3RyaW5nID0gJy0nXHJcblx0XHR3aWR0aDogbnVtYmVyID0gNjRcclxuXHRcdCk6IHN0cmluZyA9PlxyXG5cclxuXHRpZiBkZWZpbmVkKGxhYmVsKVxyXG5cdFx0cmV0dXJuIGNlbnRlcmVkKGxhYmVsLCB3aWR0aCwgY2hhcilcclxuXHRlbHNlXHJcblx0XHRyZXR1cm4gY2hhci5yZXBlYXQod2lkdGgpXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4jIC0tLSB2YWxpZCBvcHRpb25zOlxyXG4jICAgICAgICBjaGFyIC0gY2hhciB0byB1c2Ugb24gbGVmdCBhbmQgcmlnaHRcclxuIyAgICAgICAgYnVmZmVyIC0gbnVtIHNwYWNlcyBhcm91bmQgdGV4dCB3aGVuIGNoYXIgPD4gJyAnXHJcblxyXG5leHBvcnQgY2VudGVyZWQgOj0gKFxyXG5cdHRleHQ6IHN0cmluZyxcclxuXHR3aWR0aDogbnVtYmVyLFxyXG5cdGNoYXI6IHN0cmluZyA9ICcgJyxcclxuXHRudW1CdWZmZXI6IG51bWJlciA9IDJcclxuXHQpOiBzdHJpbmcgPT5cclxuXHJcblx0dG90U3BhY2VzIDo9IHdpZHRoIC0gdGV4dC5sZW5ndGhcclxuXHRpZiAodG90U3BhY2VzIDw9IDApXHJcblx0XHRyZXR1cm4gdGV4dFxyXG5cdG51bUxlZnQgOj0gTWF0aC5mbG9vcih0b3RTcGFjZXMgLyAyKVxyXG5cdG51bVJpZ2h0IDo9IHRvdFNwYWNlcyAtIG51bUxlZnRcclxuXHRpZiAoY2hhciA9PSAnICcpXHJcblx0XHRyZXR1cm4gJyAnLnJlcGVhdChudW1MZWZ0KSArIHRleHQgKyAnICcucmVwZWF0KG51bVJpZ2h0KVxyXG5cdGVsc2VcclxuXHRcdGJ1ZiA6PSAnICcucmVwZWF0KG51bUJ1ZmZlcilcclxuXHRcdGxlZnQgOj0gY2hhci5yZXBlYXQobnVtTGVmdCAtIG51bUJ1ZmZlcilcclxuXHRcdHJpZ2h0IDo9IGNoYXIucmVwZWF0KG51bVJpZ2h0IC0gbnVtQnVmZmVyKVxyXG5cdFx0cmV0dXJuIGxlZnQgKyBidWYgKyB0ZXh0ICsgYnVmICsgcmlnaHRcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgbEFsbExpYnMgOj0gW1xyXG5cdCdiYXNlLXV0aWxzJywgJ2RhdGF0eXBlcycsICdsbHV0aWxzJywgJ2RiJywgJ2luZGVudCcsICd1bmljb2RlJyxcclxuXHQndG8tbmljZScsICdleHRyYWN0JywgJ2xvZy1sZXZlbHMnLCAnbG9nLWZvcm1hdHRlcicsICdsb2dnZXInLFxyXG5cdCd0ZXh0LXRhYmxlJywgJ2Vudi1zdGFjaycsXHJcblxyXG5cdCdwYXJzZXInLCAnY21kLWFyZ3MnLFxyXG5cdCd3YWxrZXInLCAnZnN5cycsICdwbGwnLCAnZXhlYycsICdmcm9tLW5pY2UnXHJcblxyXG5cdCdzb3VyY2UtbWFwJywgJ3N5bWJvbHMnLCAndHlwZXNjcmlwdCcsICdjaXZldCcsICdjaWVsbycsXHJcblx0J2F1dG9tYXRlJywgJ3Y4LXN0YWNrJywgJ3VuaXQtdGVzdCcsXHJcblx0XVxyXG4iXX0=