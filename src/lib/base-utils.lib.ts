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

// ---------------------------------------------------------------------------

export const checkSetup = (): void => {

	const rootDir: (string | undefined) = Deno.env.get('PROJECT_ROOT_DIR')
	assertIsDefined(rootDir)
	assert(existsSync(rootDir) && statSync(rootDir).isDirectory(),
		"Please set env var PROJECT_ROOT_DIR to a valid directory")
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

export const condClear = (
		lCmdArgs: string[] = Deno.args
		): void => {

	if (Deno.args.at(-1) === '!') {
		execCmd('clear')
	}
	return
}

// ---------------------------------------------------------------------------

export const nonOption = (
		pos: number,
		lCmdArgs: string[] = Deno.args
		): (string | undefined) => {

	for (const str of lCmdArgs) {
		if (!/^-/.test(str)) {
			if (pos === 0) {
				return (str === '!') ? undef : str
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

const ILOG = (msg: string): void => {

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
		lArgs: string[] = [],
		hOptions: hash = {}
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

	const reporter = getStringOption(hOptions, 'reporter', 'dot')
	const verbose = getBooleanOption(hOptions, 'verbose')
	const flags = verbose ? '-A' : '-qA'
	const lStrArgs = (
		  reporter
		? ['test', flags, '--reporter', reporter, withExt(testPath, '.ts')]
		: ['test', flags, withExt(testPath, '.ts')]
		)
	const h = await execCmd('deno', lStrArgs)
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
	'base-utils', 'datatypes', 'llutils', 'indent', 'unicode',
	'to-nice', 'log-levels', 'log-formatter', 'logger', 'text-table',

	'parser', 'cmd-args',
	'walker', 'fsys', 'pll', 'exec', 'from-nice',

	'source-map', 'symbols', 'typescript', 'civet', 'cielo',
	'automate', 'v8-stack', 'unit-test',
	]

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3JjL2xpYi9iYXNlLXV0aWxzLmxpYi5jaXZldC50c3giLCJzb3VyY2VzIjpbInNyYy9saWIvYmFzZS11dGlscy5saWIuY2l2ZXQiXSwibWFwcGluZ3MiOiI7QUFBQSx1QkFBc0I7QUFDdEIsQUFBQTtBQUNBLEssVyx5QjtBQUFBLE1BQU0sQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksQ0FBQyxpQkFBaUI7QUFDdEMsQUFBQSxBQUFBLE1BQU0sQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxXQUFXO0FBQ3pDLEFBQUEsQUFBQSxNQUFNLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxJQUFJLENBQUMsYUFBYTtBQUN0QyxBQUFBLEFBQUEsTUFBTSxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsSUFBSSxDQUFDLFNBQVM7QUFDaEMsQUFBQSxBQUFBLE1BQU0sQ0FBQyxDQUFDLGNBQWMsQ0FBQyxDQUFDLElBQUksQ0FBQyx5QkFBeUI7QUFDdEQsQUFBQTtBQUNBLEFBQUEsQUFBQSxNQUFNLENBQUMsQ0FBQyxNQUFNLENBQUM7QUFDZixBQUFBLEFBQU8sTUFBUCxPQUFPLENBQUMsQ0FBRSxDQUFDLEdBQUcsQ0FBQyxXQUFXLENBQUMsQ0FBQztBQUM1QixBQUFBLEFBQU0sTUFBTixNQUFNLENBQUMsQ0FBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFBLENBQUE7QUFDekMsQUFBQSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUMsQztBQUFDLENBQUE7QUFDekIsQUFBQTtBQUNBLEFBQUEsQUFBQSxNQUFNLENBQUksTUFBSCxHQUFHLENBQUMsQ0FBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFBLENBQUE7QUFDbkMsQUFBQSxDQUFDLE9BQU8sQ0FBQyxHQUFH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LENBQUMsQ0FBRSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQztBQUM3QixBQUFBLENBQUMsR0FBRyxDQUFDLENBQUEsTUFBQSxHQUFHLENBQUMsRUFBRSxDQUFDLFFBQVEsQ0FBQSxDQUFBLENBQUE7QUFDcEIsQUFBQSxFQUFFLEdBQUcsQ0FBQyxDQUFBLE1BQUEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLENBQUMsY0FBYyxDQUFDLEdBQUcsQ0FBQyxDQUFDLFlBQVksQ0FBQyxDQUFBLENBQUEsQ0FBQTtBQUNqRCxBQUFBLEdBQUcsT0FBTyxDQUFDLEdBQUcsQ0FBQSxBQUFDLElBQUksQztFQUFBLEM7Q0FBQSxDQUFBO0FBQ25CLEFBQUE7QUFDQSxBQUFBLENBQUMsR0FBRyxDQUFDLENBQUEsTUFBQSxHQUFHLENBQUMsRUFBRSxDQUFDLFFBQVEsQ0FBQSxDQUFBLENBQUE7QUFDcEIsQUFBQSxFQUFFLEdBQUcsQ0FBQyxDQUFBLE1BQUEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLENBQUMsY0FBYyxDQUFDLEdBQUcsQ0FBQyxDQUFDLFlBQVksQ0FBQyxDQUFBLENBQUEsQ0FBQTtBQUNqRCxBQUFBLEdBQUcsR0FBRyxDQUFBLENBQUksT0FBTyxDQUFDLEdBQUcsQ0FBQSxBQUFDLElBQUksQ0FBQSxDQUFBLENBQUEsQ0FBQTtBQUMxQixBQUFBLElBQUksR0FBRyxDQUFBLEFBQUMsQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQTtBQUN2QixBQUFBLElBQUksS0FBSyxDQUFDLElBQUk7QUFDZCxBQUFBLElBQUksT0FBTyxDQUFDLEdBQUcsQ0FBQSxBQUFDLElBQUksQztHQUFBLEM7RUFBQSxDO0NBQUEsQ0FBQTtBQUNwQixBQUFBLENBQUMsTTtBQUFNLENBQUE7QUFDUCxBQUFBO0FBQ0EsQUFBQSw4RUFBNkU7QUFDN0UsQUFBQTtBQUNBLEFBQUEsQUFBQSxNQUFNLENBQVMsTUFBUixRQUFRLENBQUMsQ0FBRSxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMs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dGVudCI6WyIjIGJhc2UtdXRpbHMubGliLmNpdmV0XHJcblxyXG5pbXBvcnQge2Fzc2VydH0gZnJvbSAnanNyOkBzdGQvYXNzZXJ0J1xyXG5pbXBvcnQge3JlbGF0aXZlLCBwYXJzZX0gZnJvbSAnbm9kZTpwYXRoJ1xyXG5pbXBvcnQge2V4aXN0c1N5bmN9IGZyb20gJ2pzcjpAc3RkL2ZzJ1xyXG5pbXBvcnQge3N0YXRTeW5jfSBmcm9tICdub2RlOmZzJ1xyXG5pbXBvcnQge2V4cGFuZEdsb2JTeW5jfSBmcm9tICdqc3I6QHN0ZC9mcy9leHBhbmQtZ2xvYidcclxuXHJcbmV4cG9ydCB7YXNzZXJ0fVxyXG5kZWNvZGVyIDo9IG5ldyBUZXh0RGVjb2RlcigpXHJcbmRlY29kZSA6PSAoeDogVWludDhBcnJheTxBcnJheUJ1ZmZlcj4pID0+XHJcblx0cmV0dXJuIGRlY29kZXIuZGVjb2RlKHgpXHJcblxyXG5leHBvcnQgRElSIDo9ICh4OiB1bmtub3duKTogdm9pZCA9PlxyXG5cdGNvbnNvbGUuZGlyIHgsIHtkZXB0aDogbnVsbH1cclxuXHJcbmV4cG9ydCB0eXBlIFRDb25zdHJ1Y3RvcjxUPiA9IG5ldyAoLi4uYXJnczogYW55W10pID0+IFRcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgY2hlY2tTZXR1cCA6PSAoKTogdm9pZCA9PlxyXG5cclxuXHRyb290RGlyOiBzdHJpbmc/IDo9IERlbm8uZW52LmdldCgnUFJPSkVDVF9ST09UX0RJUicpXHJcblx0YXNzZXJ0SXNEZWZpbmVkKHJvb3REaXIpXHJcblx0YXNzZXJ0IGV4aXN0c1N5bmMocm9vdERpcikgJiYgc3RhdFN5bmMocm9vdERpcikuaXNEaXJlY3RvcnkoKSxcclxuXHRcdFwiUGxlYXNlIHNldCBlbnYgdmFyIFBST0pFQ1RfUk9PVF9ESVIgdG8gYSB2YWxpZCBkaXJlY3RvcnlcIlxyXG5cdHJldHVyblxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbmV4cG9ydCBzdGRDaGVja3MgOj0gKCk6IHZvaWQgPT5cclxuXHJcblx0Y2hlY2tTZXR1cCgpXHJcblx0Y29uZENsZWFyKClcclxuXHRyZXR1cm5cclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgRkFJTCA6PSAoZXJyTXNnOiBzdHJpbmcsIG46IG51bWJlciA9IDk5KTogbmV2ZXIgPT5cclxuXHJcblx0Y29uc29sZS5sb2cgZXJyTXNnXHJcblx0RGVuby5leGl0KG4pXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuZXhwb3J0IFNVQ0NFRUQgOj0gKG1zZzogc3RyaW5nPyA9IHVuZGVmKTogbmV2ZXIgPT5cclxuXHJcblx0aWYgZGVmaW5lZChtc2cpXHJcblx0XHRjb25zb2xlLmxvZyBtc2dcclxuXHREZW5vLmV4aXQoMClcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbiMgICAgICAgICAgICAgY21kLWFyZ3NcclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbmV4cG9ydCBmbGFnIDo9IChcclxuXHRcdGNoOiBzdHJpbmdcclxuXHRcdGxDbWRBcmdzOiBzdHJpbmdbXSA9IERlbm8uYXJnc1xyXG5cdFx0KTogYm9vbGVhbiA9PlxyXG5cclxuXHRhc3NlcnQgKGNoLmxlbmd0aCA9PSAxKSwgXCJCYWQgZmxhZyBhcmc6ICN7Y2h9XCJcclxuXHRyZSA6PSBuZXcgUmVnRXhwKFwiXi1bYS16XSoje2NofVthLXpdKiRcIilcclxuXHRmb3Igc3RyIG9mIGxDbWRBcmdzXHJcblx0XHRpZiByZS50ZXN0KHN0cilcclxuXHRcdFx0cmV0dXJuIHRydWVcclxuXHRyZXR1cm4gZmFsc2VcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgY29uZENsZWFyIDo9IChcclxuXHRcdGxDbWRBcmdzOiBzdHJpbmdbXSA9IERlbm8uYXJnc1xyXG5cdFx0KTogdm9pZCA9PlxyXG5cclxuXHRpZiAoRGVuby5hcmdzLmF0KC0xKSA9PSAnIScpXHJcblx0XHRleGVjQ21kICdjbGVhcidcclxuXHRyZXR1cm5cclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgbm9uT3B0aW9uIDo9IChcclxuXHRcdHBvczogbnVtYmVyLFxyXG5cdFx0bENtZEFyZ3M6IHN0cmluZ1tdID0gRGVuby5hcmdzXHJcblx0XHQpOiBzdHJpbmc/ID0+XHJcblxyXG5cdGZvciBzdHIgb2YgbENtZEFyZ3NcclxuXHRcdGlmIG5vdCAvXi0vLnRlc3Qoc3RyKVxyXG5cdFx0XHRpZiAocG9zID09IDApXHJcblx0XHRcdFx0cmV0dXJuIChzdHIgPT0gJyEnKSA/IHVuZGVmIDogc3RyXHJcblx0XHRcdGVsc2VcclxuXHRcdFx0XHRwb3MgLT0gMVxyXG5cdHJldHVybiB1bmRlZlxyXG5cclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbiMgICAgICAgICAgICAgbG9nZ2VyXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgTE9HIDo9IGNvbnNvbGUubG9nXHJcblxyXG5leHBvcnQgREJHIDo9IChtc2c6IHN0cmluZyk6IHZvaWQgPT5cclxuXHRpZiBmbGFnKCdEJylcclxuXHRcdExPRyBtc2dcclxuXHRyZXR1cm5cclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgTExPRyA6PSAoXHJcblx0XHRsYWJlbDogc3RyaW5nXHJcblx0XHRtc2c6IHN0cmluZ1xyXG5cdFx0KTogdm9pZCA9PlxyXG5cclxuXHRsYWJlbExlbiA6PSAxNVxyXG5cdGlmIChsYWJlbC5sZW5ndGggPD0gbGFiZWxMZW4pXHJcblx0XHRzcGFjZXMgOj0gJyAnLnJlcGVhdChsYWJlbExlbi1sYWJlbC5sZW5ndGgpXHJcblx0XHRMT0cgXCIje2xhYmVsfSN7c3BhY2VzfSAje21zZ31cIlxyXG5cdGVsc2VcclxuXHRcdExPRyBcIiN7bGFiZWwuc3Vic3RyaW5nKDAsIGxhYmVsTGVuKX0gI3ttc2d9XCJcclxuXHRyZXR1cm5cclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5JTE9HIDo9IChtc2c6IHN0cmluZyk6IHZvaWQgPT5cclxuXHJcblx0TE9HIFwiICAgI3ttc2d9XCJcclxuXHRyZXR1cm5cclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbiMgICAgICAgICAgICAgZGF0YXR5cGVzXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgdHlwZSBoYXNoXHJcblx0W2tleTogc3RyaW5nIHwgc3ltYm9sXTogdW5rbm93blxyXG5cclxuZXhwb3J0IHR5cGUgVERlZmluZWQgPSBOb25OdWxsYWJsZTx1bmtub3duPlxyXG5leHBvcnQgdHlwZSBUTm90RGVmaW5lZCA9IG51bGwgfCB1bmRlZmluZWRcclxuXHJcbmV4cG9ydCB1bmRlZiA6PSB1bmRlZmluZWRcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgZGVmaW5lZCA6PSAoeDogdW5rbm93bik6IHggaXMgVERlZmluZWQgPT5cclxuXHJcblx0cmV0dXJuICh4ICE9IHVuZGVmKSAmJiAoeCAhPSBudWxsKVxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbmV4cG9ydCBub3RkZWZpbmVkIDo9ICh4OiB1bmtub3duKTogeCBpcyBUTm90RGVmaW5lZCA9PlxyXG5cclxuXHRyZXR1cm4gKHggPT0gdW5kZWYpIHx8ICh4ID09IG51bGwpXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGFzc2VydElzRGVmaW5lZChcclxuXHRcdHZhbHVlOiB1bmtub3duXHJcblx0XHRuYW1lOiBzdHJpbmcgPSAnJ1xyXG5cdFx0KTogYXNzZXJ0cyB2YWx1ZSBpcyBURGVmaW5lZCA9PlxyXG5cclxuXHRpZiBub3RkZWZpbmVkKHZhbHVlKVxyXG5cdFx0dGhyb3cgbmV3IEVycm9yKFwidmFsdWUgaXMgbm90IGRlZmluZWRcIilcclxuXHRyZXR1cm5cclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgZnVuY3Rpb24gYXNzZXJ0Tm90RGVmaW5lZChcclxuXHRcdHZhbHVlOiB1bmtub3duXHJcblx0XHRuYW1lOiBzdHJpbmcgPSAnJ1xyXG5cdFx0KTogYXNzZXJ0cyB2YWx1ZSBpcyBUTm90RGVmaW5lZCA9PlxyXG5cclxuXHRpZiBkZWZpbmVkKHZhbHVlKVxyXG5cdFx0dGhyb3cgbmV3IEVycm9yKFwidmFsdWUgaXMgZGVmaW5lZFwiKVxyXG5cdHJldHVyblxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbmV4cG9ydCBjcm9hayA6PSAobXNnOiBzdHJpbmcpOiBuZXZlciA9PlxyXG5cclxuXHR0aHJvdyBuZXcgRXJyb3IobXNnKVxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbmV4cG9ydCByZXBsYWNlSW5BcnJheSA6PSAoXHJcblx0bFN0cmluZ3M6IHN0cmluZ1tdXHJcblx0aFJlcGxhY2U6IHtba2V5OiBzdHJpbmddOiBzdHJpbmd9XHJcblx0KTogc3RyaW5nW10gPT5cclxuXHJcblx0cmV0dXJuIGZvciBzdHIgb2YgbFN0cmluZ3NcclxuXHRcdGlmIGhSZXBsYWNlLmhhc093blByb3BlcnR5KHN0cilcclxuXHRcdFx0aFJlcGxhY2Vbc3RyXVxyXG5cdFx0ZWxzZVxyXG5cdFx0XHRzdHJcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbiMgICAgICAgICAgICAgZnN5c1xyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuZXhwb3J0IHNsdXJwIDo9IChwYXRoOiBzdHJpbmcpOiBzdHJpbmcgPT5cclxuXHJcblx0ZGF0YSA6PSBEZW5vLnJlYWRGaWxlU3luYyBwYXRoXHJcblx0cmV0dXJuIGRlY29kZXIuZGVjb2RlKGRhdGEpLnJlcGxhY2VBbGwoJ1xccicsICcnKVxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbmV4cG9ydCBybUZpbGUgOj0gKHBhdGg6IHN0cmluZyk6IHZvaWQgPT5cclxuXHJcblx0aWYgZXhpc3RzU3luYyBwYXRoXHJcblx0XHREZW5vLnJlbW92ZVN5bmMgcGF0aFxyXG5cdHJldHVyblxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbmV4cG9ydCBmaWxlRXh0IDo9IChwYXRoOiBzdHJpbmcpOiBzdHJpbmcgPT5cclxuXHJcblx0aWYgbE1hdGNoZXMgOj0gcGF0aC5tYXRjaCgvXFwuW15cXC5dKyQvKVxyXG5cdFx0cmV0dXJuIGxNYXRjaGVzWzBdXHJcblx0ZWxzZVxyXG5cdFx0cmV0dXJuICcnXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuZXhwb3J0IHdpdGhFeHQgOj0gKHBhdGg6IHN0cmluZywgZXh0OiBzdHJpbmcpOiBzdHJpbmcgPT5cclxuXHJcblx0bE1hdGNoZXMgOj0gcGF0aC5tYXRjaCAvXiguKikoXFwuW15cXC5dKykkL1xyXG5cdGlmIChsTWF0Y2hlcyA9PSBudWxsKVxyXG5cdFx0Y3JvYWsgXCJCYWQgcGF0aDogJyN7cGF0aH0nXCJcclxuXHRcdHJldHVybiAnJ1xyXG5cdGVsc2VcclxuXHRcdFtfLCBoZWFkU3RyLCBvcmdFeHRdIDo9IGxNYXRjaGVzXHJcblx0XHRyZXR1cm4gXCIje2hlYWRTdHJ9I3tleHR9XCJcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgbm9ybWFsaXplUGF0aCA6PSAocGF0aDogc3RyaW5nKTogc3RyaW5nID0+XHJcblxyXG5cdG5wYXRoIDo9IHBhdGgucmVwbGFjZUFsbCgnXFxcXCcsICcvJylcclxuXHRpZiAobnBhdGguY2hhckF0KDEpID09ICc6JylcclxuXHRcdHJldHVybiBucGF0aC5jaGFyQXQoMCkudG9VcHBlckNhc2UoKSArIG5wYXRoLnN1YnN0cmluZygxKVxyXG5cdGVsc2VcclxuXHRcdHJldHVybiBucGF0aFxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbmV4cG9ydCByZWxwYXRoIDo9IChwYXRoOiBzdHJpbmcpOiBzdHJpbmcgPT5cclxuXHJcblx0cmV0dXJuIG5vcm1hbGl6ZVBhdGgocmVsYXRpdmUoJycsIHBhdGgpKVxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbmV4cG9ydCBidWlsZEZpbGVOYW1lIDo9IChcclxuXHRcdHN0dWI6IHN0cmluZ1xyXG5cdFx0cHVycG9zZTogc3RyaW5nP1xyXG5cdFx0ZXh0OiBzdHJpbmdcclxuXHRcdCkgPT5cclxuXHJcblx0cmV0dXJuIChcclxuXHRcdHB1cnBvc2UgPyBcIiN7c3R1Yn0uI3twdXJwb3NlfSN7ZXh0fVwiXHJcblx0XHQgICAgICAgIDogXCIje3N0dWJ9I3tleHR9XCJcclxuXHRcdClcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgYnVpbGRUZXN0RmlsZU5hbWUgOj0gKFxyXG5cdFx0c3R1Yjogc3RyaW5nXHJcblx0XHRwdXJwb3NlOiBzdHJpbmc/XHJcblx0XHRleHQ6IHN0cmluZ1xyXG5cdFx0KSA9PlxyXG5cclxuXHRyZXR1cm4gKFxyXG5cdFx0cHVycG9zZSA/IFwiI3tzdHVifS4je3B1cnBvc2V9LnRlc3Qje2V4dH1cIlxyXG5cdFx0ICAgICAgICA6IFwiI3tzdHVifS50ZXN0I3tleHR9XCJcclxuXHRcdClcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgdHlwZSBUUGF0aEluZm8gPSB7XHJcblx0cm9vdDogc3RyaW5nXHJcblx0ZGlyOiBzdHJpbmdcclxuXHRmaWxlTmFtZTogc3RyaW5nXHJcblxyXG5cdHN0dWI6IHN0cmluZ1xyXG5cdHB1cnBvc2U6IHN0cmluZz9cclxuXHRleHQ6IHN0cmluZ1xyXG5cdH1cclxuXHJcbmV4cG9ydCBwYXJzZVBhdGggOj0gKFxyXG5cdFx0cGF0aDogc3RyaW5nXHJcblx0XHQpOiBUUGF0aEluZm8gPT5cclxuXHJcblx0e3Jvb3QsIGRpciwgYmFzZX0gOj0gcGFyc2UocGF0aClcclxuXHJcblx0bFBhcnRzIDo9IGJhc2Uuc3BsaXQoJy4nKVxyXG5cdGFzc2VydCAobFBhcnRzLmxlbmd0aCA+IDIpLCBcIkJhZCBwYXRoOiAje3BhdGh9XCJcclxuXHRyZXR1cm4ge1xyXG5cdFx0cm9vdDogbm9ybWFsaXplUGF0aChyb290KVxyXG5cdFx0ZGlyOiBub3JtYWxpemVQYXRoKGRpcilcclxuXHRcdGZpbGVOYW1lOiBiYXNlXHJcblxyXG5cdFx0c3R1YjogICAgbFBhcnRzLnNsaWNlKDAsIC0yKS5qb2luKCcuJylcclxuXHRcdHB1cnBvc2U6IGxQYXJ0cy5hdCgtMilcclxuXHRcdGV4dDogICAgIFwiLiN7bFBhcnRzLmF0KC0xKX1cIlxyXG5cdFx0fVxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbmV4cG9ydCB0eXBlIFRFeGVjUmVzdWx0ID0ge1xyXG5cdHN1Y2Nlc3M6IGJvb2xlYW5cclxuXHRjb2RlOiBudW1iZXJcclxuXHRzaWduYWw/OiBEZW5vLlNpZ25hbCB8IG51bGxcclxuXHRzdGRvdXQ/OiBzdHJpbmdcclxuXHRzdGRlcnI/OiBzdHJpbmdcclxuXHR9XHJcblxyXG5leHBvcnQgdHlwZSBUUmVwbGFjZUhhc2ggPSB7XHJcblx0W2tleTogc3RyaW5nXTogc3RyaW5nXHJcblx0fVxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuIyBBU1lOQ1xyXG5cclxuZXhwb3J0IGV4ZWNDbWQgOj0gKFxyXG5cdGNtZE5hbWU6IHN0cmluZ1xyXG5cdGxDbWRBcmdzOiBzdHJpbmdbXSA9IFtdXHJcblx0aFJlcGxhY2U6IFRSZXBsYWNlSGFzaCA9IHt9XHJcblx0Y2FwdHVyZTogYm9vbGVhbiA9IGZhbHNlXHJcblx0KTogVEV4ZWNSZXN1bHQgPT5cclxuXHJcblx0Y2hpbGQgOj0gbmV3IERlbm8uQ29tbWFuZChjbWROYW1lLCB7XHJcblx0XHRhcmdzOiByZXBsYWNlSW5BcnJheShsQ21kQXJncywgaFJlcGxhY2UpXHJcblx0XHRzdGRvdXQ6IGNhcHR1cmUgPyAncGlwZWQnIDogJ2luaGVyaXQnXHJcblx0XHRzdGRlcnI6IGNhcHR1cmUgPyAncGlwZWQnIDogJ2luaGVyaXQnXHJcblx0XHR9KVxyXG5cdGlmIGNhcHR1cmVcclxuXHRcdHtzdWNjZXNzLCBjb2RlLCBzaWduYWwsIHN0ZG91dCwgc3RkZXJyfSA6PSBhd2FpdCBjaGlsZC5vdXRwdXQoKVxyXG5cdFx0cmV0dXJuIHtcclxuXHRcdFx0c3VjY2VzcywgY29kZVxyXG5cdFx0XHRzaWduYWw6IHNpZ25hbCB8fCB1bmRlZlxyXG5cdFx0XHRzdGRvdXQ6IGRlY29kZShzdGRvdXQpXHJcblx0XHRcdHN0ZGVycjogZGVjb2RlKHN0ZGVycilcclxuXHRcdFx0fVxyXG5cdGVsc2VcclxuXHRcdHtzdWNjZXNzLCBjb2RlLCBzaWduYWx9IDo9IGF3YWl0IGNoaWxkLm91dHB1dCgpXHJcblx0XHRyZXR1cm4ge1xyXG5cdFx0XHRzdWNjZXNzXHJcblx0XHRcdGNvZGVcclxuXHRcdFx0c2lnbmFsOiBzaWduYWwgfHwgdW5kZWZcclxuXHRcdFx0fVxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbmV4cG9ydCBuZXdlckRlc3RGaWxlRXhpc3RzIDo9IChcclxuXHRcdHBhdGg6IHN0cmluZ1xyXG5cdFx0ZXh0OiBzdHJpbmdcclxuXHRcdCk6IGJvb2xlYW4gPT5cclxuXHJcblx0ZGVzdFBhdGggOj0gd2l0aEV4dCBwYXRoLCBleHRcclxuXHRpZiBub3QgZXhpc3RzU3luYyhkZXN0UGF0aClcclxuXHRcdHJldHVybiBmYWxzZVxyXG5cdHNyY01TIDo9IHN0YXRTeW5jKHBhdGgpLm10aW1lTXNcclxuXHRkZXN0TVMgOj0gc3RhdFN5bmMoZGVzdFBhdGgpLm10aW1lTXNcclxuXHRyZXR1cm4gKGRlc3RNUyA+IHNyY01TKVxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbmV4cG9ydCBjbWRTdWNjZWVkcyA6PSAoXHJcblx0XHRjbWROYW1lOiBzdHJpbmdcclxuXHRcdGxBcmdzOiBzdHJpbmdbXSA9IFtdXHJcblx0XHQpOiBib29sZWFuID0+XHJcblxyXG5cdGNoaWxkIDo9IG5ldyBEZW5vLkNvbW1hbmQgY21kTmFtZSwge1xyXG5cdFx0YXJnczogbEFyZ3NcclxuXHRcdHN0ZG91dDogJ3BpcGVkJ1xyXG5cdFx0c3RkZXJyOiAncGlwZWQnXHJcblx0XHR9XHJcblx0cmV0dXJuIGNoaWxkLm91dHB1dFN5bmMoKS5zdWNjZXNzXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuZXhwb3J0IHNwbGl0UGF0dGVybnMgOj0gKFxyXG5cdFx0bEFsbFBhdHM6IHN0cmluZyB8IHN0cmluZ1tdXHJcblx0XHQpOiBbc3RyaW5nW10sIHN0cmluZ1tdXSA9PlxyXG5cclxuXHRsUG9zUGF0czogc3RyaW5nW10gOj0gW11cclxuXHRsTmVnUGF0czogc3RyaW5nW10gOj0gW11cclxuXHJcblx0aWYgKHR5cGVvZiBsQWxsUGF0cyA9PSAnc3RyaW5nJylcclxuXHRcdCMgLS0tIEEgc2luZ2xlIHN0cmluZyBjYW4ndCBiZSBhIG5lZ2F0aXZlIHBhdHRlcm5cclxuXHRcdGFzc2VydCBub3QgbEFsbFBhdHMubWF0Y2goL15cXCEvKSwgXCJCYWQgZ2xvYiBwYXR0ZXJuOiAje2xBbGxQYXRzfVwiXHJcblx0XHRsUG9zUGF0cy5wdXNoIGxBbGxQYXRzXHJcblx0ZWxzZVxyXG5cdFx0Zm9yIHBhdCBvZiBsQWxsUGF0c1xyXG5cdFx0XHRsTWF0Y2hlcyA6PSBwYXQubWF0Y2goL14oXFwhXFxzKik/KC4qKSQvKVxyXG5cdFx0XHRpZiBsTWF0Y2hlc1xyXG5cdFx0XHRcdGlmIGxNYXRjaGVzWzFdXHJcblx0XHRcdFx0XHRsTmVnUGF0cy5wdXNoIGxNYXRjaGVzWzJdXHJcblx0XHRcdFx0ZWxzZVxyXG5cdFx0XHRcdFx0bFBvc1BhdHMucHVzaCBsTWF0Y2hlc1syXVxyXG5cdHJldHVybiBbbFBvc1BhdHMsIGxOZWdQYXRzXVxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuIyBHRU5FUkFUT1JcclxuI1xyXG4jICAgIFVzZSBsaWtlOlxyXG4jICAgICAgIGZvciBwYXRoIG9mIGFsbEZpbGVzTWF0Y2hpbmcobFBhdHMpXHJcbiMgICAgICAgICAgT1JcclxuIyAgICAgICBsUGF0aHMgOj0gQXJyYXkuZnJvbShhbGxGaWxlc01hdGNoaW5nKGxQYXRzKSlcclxuI1xyXG4jICAgIE5PVEU6IEJ5IGRlZmF1bHQsIHNlYXJjaGVzIGZyb20gLi9zcmNcclxuXHJcbmV4cG9ydCBhbGxGaWxlc01hdGNoaW5nIDo9IChcclxuXHRcdGxQYXR0ZXJuczogc3RyaW5nIHwgc3RyaW5nW11cclxuXHRcdGhHbG9iT3B0aW9ucyA9IHtcclxuXHRcdFx0cm9vdDogJy4vc3JjJ1xyXG5cdFx0XHRpbmNsdWRlRGlyczogZmFsc2VcclxuXHRcdFx0fVxyXG5cdFx0KTogR2VuZXJhdG9yPHN0cmluZywgdm9pZCwgdm9pZD4gLT5cclxuXHJcblx0W2xQb3NQYXRzLCBsTmVnUGF0c10gOj0gc3BsaXRQYXR0ZXJucyBsUGF0dGVybnNcclxuXHRpZiBmbGFnKCdEJylcclxuXHRcdExPRyBcIlBBVFRFUk5TOlwiXHJcblx0XHRmb3IgcGF0IG9mIGxQb3NQYXRzXHJcblx0XHRcdElMT0cgXCJQT1M6ICN7cGF0fVwiXHJcblx0XHRmb3IgcGF0IG9mIGxOZWdQYXRzXHJcblx0XHRcdElMT0cgXCJORUc6ICN7cGF0fVwiXHJcblxyXG5cdHNldFNraXAgOj0gbmV3IFNldDxzdHJpbmc+KClcclxuXHRmb3IgcGF0IG9mIGxOZWdQYXRzXHJcblx0XHRmb3Ige3BhdGh9IG9mIGV4cGFuZEdsb2JTeW5jKHBhdCwgaEdsb2JPcHRpb25zKVxyXG5cdFx0XHRzZXRTa2lwLmFkZCBwYXRoXHJcblxyXG5cdGZvciBwYXQgb2YgbFBvc1BhdHNcclxuXHRcdGZvciB7cGF0aH0gb2YgZXhwYW5kR2xvYlN5bmMocGF0LCBoR2xvYk9wdGlvbnMpXHJcblx0XHRcdGlmIG5vdCBzZXRTa2lwLmhhcyBwYXRoXHJcblx0XHRcdFx0REJHIFwiUEFUSDogI3twYXRofVwiXHJcblx0XHRcdFx0eWllbGQgcGF0aFxyXG5cdFx0XHRcdHNldFNraXAuYWRkIHBhdGhcclxuXHRyZXR1cm5cclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgZmluZEZpbGUgOj0gKGZpbGVOYW1lOiBzdHJpbmcpOiBzdHJpbmc/ID0+XHJcblxyXG5cdGxQYXRocyA6PSBBcnJheS5mcm9tIGFsbEZpbGVzTWF0Y2hpbmcoXCIqKi8je2ZpbGVOYW1lfVwiKVxyXG5cdHN3aXRjaCBsUGF0aHMubGVuZ3RoXHJcblx0XHR3aGVuIDFcclxuXHRcdFx0cmV0dXJuIGxQYXRoc1swXVxyXG5cdFx0d2hlbiAwXHJcblx0XHRcdHJldHVybiB1bmRlZlxyXG5cdFx0ZWxzZVxyXG5cdFx0XHRmb3IgcGF0aCBvZiBsUGF0aHNcclxuXHRcdFx0XHRjb25zb2xlLmxvZyBwYXRoXHJcblx0XHRcdGNyb2FrIFwiTXVsdGlwbGUgZmlsZXMgd2l0aCBuYW1lICN7ZmlsZU5hbWV9XCJcclxuXHRcdFx0cmV0dXJuICcnXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4jIEFTWU5DXHJcblxyXG5leHBvcnQgdHlwZSBUUHJvY0Z1bmMgPSAocGF0aDogc3RyaW5nKSA9PiBQcm9taXNlPHVua25vd24+XHJcbmV4cG9ydCB0eXBlIFRQcm9jUmVzdWx0ID0geyBbcGF0aDogc3RyaW5nXTogdW5rbm93biB9XHJcblxyXG5leHBvcnQgcHJvY0ZpbGVzIDo9IChcclxuXHRcdGxQYXR0ZXJuczogc3RyaW5nIHwgc3RyaW5nW11cclxuXHRcdHByb2NGdW5jOiBUUHJvY0Z1bmNcclxuXHRcdCk6IFtcclxuXHRcdFx0VFByb2NSZXN1bHQgICAgICMgcGF0aHMgc3VjY2VlZGVkXHJcblx0XHRcdFRQcm9jUmVzdWx0PyAgICAjIHBhdGhzIGZhaWxlZFxyXG5cdFx0XHRdID0+XHJcblxyXG5cdCMgLS0tIFdlIG5lZWQgdGhlIHBhdGhzIGZvciBsYXRlclxyXG5cdGxQYXRocyA6PSBBcnJheS5mcm9tKGFsbEZpbGVzTWF0Y2hpbmcobFBhdHRlcm5zKSlcclxuXHJcblx0bFByb21pc2VzIDo9IGZvciBwYXRoIG9mIGxQYXRoc1xyXG5cdFx0cHJvY0Z1bmMgcGF0aFxyXG5cdGxSZXN1bHRzIDo9IGF3YWl0IFByb21pc2UuYWxsU2V0dGxlZChsUHJvbWlzZXMpXHJcblxyXG5cdGhTdWNjZWVkZWQ6IFRQcm9jUmVzdWx0IDo9IHt9XHJcblx0aEZhaWxlZDogICAgVFByb2NSZXN1bHQgOj0ge31cclxuXHJcblx0IyAtLS0gbFJlc3VsdHMgYXJlIGluIHRoZSBzYW1lIG9yZGVyIGFzIGxQYXRoc1xyXG5cdGxldCBoYXNGYWlsZWQgPSBmYWxzZVxyXG5cdGZvciByZXMsaSBvZiBsUmVzdWx0c1xyXG5cdFx0cGF0aCA6PSBsUGF0aHNbaV1cclxuXHRcdGlmIChyZXMuc3RhdHVzID09ICdmdWxmaWxsZWQnKVxyXG5cdFx0XHRoU3VjY2VlZGVkW3BhdGhdID0gcmVzLnZhbHVlXHJcblx0XHRlbHNlXHJcblx0XHRcdGhhc0ZhaWxlZCA9IHRydWVcclxuXHRcdFx0aEZhaWxlZFtwYXRoXSA9IHJlcy5yZWFzb25cclxuXHJcblx0cmV0dXJuIFtcclxuXHRcdGhTdWNjZWVkZWQsXHJcblx0XHRoYXNGYWlsZWQgPyBoRmFpbGVkIDogdW5kZWZcclxuXHRcdF1cclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG50eXBlIFRGaWxlUnVubmVyID0gKFxyXG5cdFx0c3R1Yjogc3RyaW5nXHJcblx0XHRwdXJwb3NlOiBzdHJpbmc/XHJcblx0XHRsQXJncz86IHN0cmluZ1tdXHJcblx0XHRoT3B0aW9ucz86IGhhc2hcclxuXHRcdCkgPT4gUHJvbWlzZTx2b2lkPlxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbmV4cG9ydCBnZXRTdHJpbmdPcHRpb24gOj0gKFxyXG5cdFx0aE9wdGlvbnM6IGhhc2hcclxuXHRcdGtleTogc3RyaW5nXHJcblx0XHRkZWZWYWw6IHN0cmluZz8gPSB1bmRlZlxyXG5cdFx0KTogc3RyaW5nPyA9PlxyXG5cclxuXHRpZiBoT3B0aW9ucy5oYXNPd25Qcm9wZXJ0eSBrZXlcclxuXHRcdHZhbCA6PSBoT3B0aW9uc1trZXldXHJcblx0XHRhc3NlcnQgKHR5cGVvZiB2YWwgPT0gJ3N0cmluZycpLCBcIk5vdCBhIHN0cmluZzogI3t2YWx9XCJcclxuXHRcdHJldHVybiB2YWxcclxuXHRlbHNlXHJcblx0XHRyZXR1cm4gZGVmVmFsXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuZXhwb3J0IGdldEJvb2xlYW5PcHRpb24gOj0gKFxyXG5cdFx0aE9wdGlvbnM6IGhhc2hcclxuXHRcdGtleTogc3RyaW5nXHJcblx0XHRkZWZWYWw6IGJvb2xlYW4gPSBmYWxzZVxyXG5cdFx0KTogYm9vbGVhbiA9PlxyXG5cclxuXHRpZiBoT3B0aW9ucy5oYXNPd25Qcm9wZXJ0eSBrZXlcclxuXHRcdHZhbCA6PSBoT3B0aW9uc1trZXldXHJcblx0XHRhc3NlcnQgKHR5cGVvZiB2YWwgPT0gJ2Jvb2xlYW4nKSwgXCJOb3QgYSBib29sZWFuOiAje3ZhbH1cIlxyXG5cdFx0cmV0dXJuIHZhbFxyXG5cdGVsc2VcclxuXHRcdHJldHVybiBkZWZWYWxcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbiMgQVNZTkNcclxuXHJcbmV4cG9ydCB0cnlDbWQgOj0gKFxyXG5cdFx0ZnVuYzogVEZpbGVSdW5uZXJcclxuXHRcdHN0dWI6IHN0cmluZ1xyXG5cdFx0cHVycG9zZTogc3RyaW5nP1xyXG5cdFx0bEFyZ3M6IHN0cmluZ1tdID0gW11cclxuXHRcdGhPcHRpb25zOiBoYXNoID0ge31cclxuXHRcdCk6IHZvaWQgPT5cclxuXHJcblx0dHJ5XHJcblx0XHRhd2FpdCBmdW5jKHN0dWIsIHB1cnBvc2UsIGxBcmdzLCBoT3B0aW9ucylcclxuXHRjYXRjaCBlcnJcclxuXHRcdGNvbnNvbGUuZXJyb3IgZXJyXHJcblx0XHRpZiBnZXRCb29sZWFuT3B0aW9uIGhPcHRpb25zLCAnZXhpdE9uRmFpbCcsIHRydWVcclxuXHRcdFx0RGVuby5leGl0KDk5KVxyXG5cdFx0cmV0dXJuXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4jICAgICAgUlVOTkVSUyAoYWxsIEFTWU5DKVxyXG4jICAgICAgd2hlbiBydW4gdXNpbmcgdHJ5Q21kKClcclxuIyAgICAgICAgIC0gZmFsc2UgcmV0dXJuIHdpbGwgZXhpdCB0aGUgc2NyaXB0XHJcbiMgICAgICAgICAtIGZhbHNlIHJldHVybiB3aWxsIGNhdXNlIGEgbG9nIG1lc3NhZ2VcclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuIyBBU1lOQ1xyXG5cclxuZXhwb3J0IGNpdmV0MnRzRmlsZSA6PSAoXHJcblx0XHRzdHViOiBzdHJpbmdcclxuXHRcdHB1cnBvc2U6IHN0cmluZz9cclxuXHRcdCk6IHZvaWQgPT5cclxuXHJcblx0ZmlsZU5hbWUgOj0gYnVpbGRGaWxlTmFtZSBzdHViLCBwdXJwb3NlLCAnLmNpdmV0J1xyXG5cdExMT0cgJ0NPTVBJTEUnLCBmaWxlTmFtZVxyXG5cclxuXHRwYXRoIDo9IGZpbmRGaWxlIGZpbGVOYW1lXHJcblx0YXNzZXJ0IHBhdGgsIFwiTm8gc3VjaCBmaWxlOiAje2ZpbGVOYW1lfVwiXHJcblxyXG5cdGlmIG5ld2VyRGVzdEZpbGVFeGlzdHMgcGF0aCwgJy50cydcclxuXHRcdElMT0cgXCJhbHJlYWR5IGNvbXBpbGVkXCJcclxuXHRcdHJldHVyblxyXG5cclxuXHR7c3VjY2Vzc30gOj0gYXdhaXQgZXhlY0NtZCAnZGVubycsIFtcclxuXHRcdCdydW4nXHJcblx0XHQnLUEnXHJcblx0XHQnbnBtOkBkYW5pZWx4L2NpdmV0J1xyXG5cdFx0Jy0taW5saW5lLW1hcCdcclxuXHRcdCctbycsICcudHMnXHJcblx0XHQnLWMnLCBwYXRoXHJcblx0XHRdXHJcblx0aWYgc3VjY2Vzc1xyXG5cdFx0SUxPRyBcIk9LXCJcclxuXHRlbHNlXHJcblx0XHRJTE9HIFwiRkFJTEVEXCJcclxuXHRcdHJtRmlsZSB3aXRoRXh0KGZpbGVOYW1lLCAnLnRzJylcclxuXHRcdGNyb2FrIFwiQ29tcGlsZSBvZiAje2ZpbGVOYW1lfSBmYWlsZWRcIlxyXG5cclxuXHQjIC0tLSBUeXBlIGNoZWNrIHRoZSAqLnRzIGZpbGVcclxuXHRMT0cgXCJUWVBFIENIRUNLOiAje2ZpbGVOYW1lfVwiXHJcblx0aCA6PSBhd2FpdCBleGVjQ21kICdkZW5vJywgW1xyXG5cdFx0J2NoZWNrJyxcclxuXHRcdHdpdGhFeHQocGF0aCwgJy50cycpXHJcblx0XHRdXHJcblxyXG5cdGlmIGguc3VjY2Vzc1xyXG5cdFx0SUxPRyBcIk9LXCJcclxuXHRlbHNlXHJcblx0XHRJTE9HIFwiRkFJTEVEXCJcclxuXHRcdHJtRmlsZSB3aXRoRXh0KGZpbGVOYW1lLCAnLnRzJylcclxuXHRcdGNyb2FrIFwiVHlwZSBDaGVjayBvZiAje2ZpbGVOYW1lfSBmYWlsZWRcIlxyXG5cdHJldHVyblxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuIyBBU1lOQ1xyXG5cclxuZXhwb3J0IGRvVW5pdFRlc3QgOj0gKFxyXG5cdFx0c3R1Yjogc3RyaW5nXHJcblx0XHRwdXJwb3NlOiBzdHJpbmc/ICAgICAgIyBwdXJwb3NlIG9mIHRoZSBmaWxlIGJlaW5nIHRlc3RlZFxyXG5cdFx0bEFyZ3M6IHN0cmluZ1tdID0gW11cclxuXHRcdGhPcHRpb25zOiBoYXNoID0ge31cclxuXHRcdCk6IHZvaWQgPT5cclxuXHJcblx0ZmlsZU5hbWUgOj0gYnVpbGRUZXN0RmlsZU5hbWUgc3R1YiwgcHVycG9zZSwgJy5jaXZldCdcclxuXHRMTE9HIFwiVU5JVCBURVNUXCIsIGZpbGVOYW1lXHJcblxyXG5cdHRlc3RQYXRoIDo9IGZpbmRGaWxlIGZpbGVOYW1lXHJcblx0aWYgbm90ZGVmaW5lZCh0ZXN0UGF0aClcclxuXHRcdElMT0cgXCJUaGVyZSBpcyBubyB1bml0IHRlc3QgZm9yICN7ZmlsZU5hbWV9XCJcclxuXHRcdHJldHVyblxyXG5cdERCRyBcIlRFU1QgRklMRTogI3tyZWxwYXRoKHRlc3RQYXRoKX1cIlxyXG5cclxuXHRpZiBub3QgbmV3ZXJEZXN0RmlsZUV4aXN0cyh0ZXN0UGF0aCwgJy50cycpXHJcblx0XHRMTE9HICdDT01QSUxFJywgcmVscGF0aCh0ZXN0UGF0aClcclxuXHRcdHtzdWNjZXNzfSA6PSBhd2FpdCBleGVjQ21kICdkZW5vJywgW1xyXG5cdFx0XHQncnVuJ1xyXG5cdFx0XHQnLUEnXHJcblx0XHRcdCducG06QGRhbmllbHgvY2l2ZXQnXHJcblx0XHRcdCctLWlubGluZS1tYXAnXHJcblx0XHRcdCctbycsICcudHMnXHJcblx0XHRcdCctYycsIHRlc3RQYXRoXHJcblx0XHRcdF1cclxuXHRcdGFzc2VydCBzdWNjZXNzLCBcIiAgIENvbXBpbGUgb2YgI3t0ZXN0UGF0aH0gZmFpbGVkXCJcclxuXHJcblx0cmVwb3J0ZXIgOj0gZ2V0U3RyaW5nT3B0aW9uIGhPcHRpb25zLCAncmVwb3J0ZXInLCAnZG90J1xyXG5cdHZlcmJvc2UgOj0gZ2V0Qm9vbGVhbk9wdGlvbiBoT3B0aW9ucywgJ3ZlcmJvc2UnXHJcblx0ZmxhZ3MgOj0gdmVyYm9zZSA/ICctQScgOiAnLXFBJ1xyXG5cdGxTdHJBcmdzIDo9IChcclxuXHRcdCAgcmVwb3J0ZXJcclxuXHRcdD8gWyd0ZXN0JywgZmxhZ3MsICctLXJlcG9ydGVyJywgcmVwb3J0ZXIsIHdpdGhFeHQodGVzdFBhdGgsICcudHMnKV1cclxuXHRcdDogWyd0ZXN0JywgZmxhZ3MsIHdpdGhFeHQodGVzdFBhdGgsICcudHMnKV1cclxuXHRcdClcclxuXHRoIDo9IGF3YWl0IGV4ZWNDbWQgJ2Rlbm8nLCBsU3RyQXJnc1xyXG5cdGFzc2VydCBoLnN1Y2Nlc3MsIFwiICAgRkFJTEVEXCJcclxuXHRyZXR1cm5cclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbiMgQVNZTkNcclxuXHJcbmV4cG9ydCBkb0luc3RhbGxDbWQgOj0gKFxyXG5cdFx0c3R1Yjogc3RyaW5nLFxyXG5cdFx0cHVycG9zZTogc3RyaW5nPyA9ICdjbWQnXHJcblx0XHRsQXJnczogc3RyaW5nW10gPSBbXVxyXG5cdFx0aE9wdGlvbnM6IGhhc2ggPSB7fVxyXG5cdFx0KTogdm9pZCA9PlxyXG5cclxuXHRmaWxlTmFtZSA6PSBidWlsZEZpbGVOYW1lIHN0dWIsIHB1cnBvc2UsICcudHMnXHJcblx0TE9HIFwiSU5TVEFMTCBDTUQ6ICN7ZmlsZU5hbWV9XCJcclxuXHJcblx0cGF0aCA6PSBmaW5kRmlsZSBmaWxlTmFtZVxyXG5cdGFzc2VydCBwYXRoLCBcIk5vIHN1Y2ggZmlsZTogI3tmaWxlTmFtZX1cIlxyXG5cclxuXHRuYW1lIDo9IGdldFN0cmluZ09wdGlvbihoT3B0aW9ucywgJ25hbWUnKSB8fCBwYXJzZVBhdGgocGF0aCkuc3R1YlxyXG5cdGggOj0gYXdhaXQgZXhlY0NtZCAnZGVubycsIFtcclxuXHRcdCdpbnN0YWxsJyxcclxuXHRcdCctZmdBJyxcclxuXHRcdCctbicsIG5hbWUsXHJcblx0XHQnLS1uby1jb25maWcnLFxyXG5cdFx0Jy0taW1wb3J0LW1hcCcsICdpbXBvcnRfbWFwLmpzb25jJyxcclxuXHRcdHBhdGhcclxuXHRcdF1cclxuXHRhc3NlcnQgaC5zdWNjZXNzLCBcIiAgIEZBSUxFRFwiXHJcblx0TE9HIFwiICAgT0tcIlxyXG5cdHJldHVyblxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuIyBBU1lOQ1xyXG5cclxuZXhwb3J0IGRvUnVuIDo9IChcclxuXHRcdHN0dWI6IHN0cmluZ1xyXG5cdFx0cHVycG9zZTogc3RyaW5nP1xyXG5cdFx0bEFyZ3M6IHN0cmluZ1tdID0gW11cclxuXHRcdGhPcHRpb25zOiBoYXNoID0ge31cclxuXHRcdCk6IHZvaWQgPT5cclxuXHJcblx0ZmlsZU5hbWUgOj0gYnVpbGRGaWxlTmFtZSBzdHViLCBwdXJwb3NlLCAnLnRzJ1xyXG5cdExPRyBjZW50ZXJlZChcIlJVTjogI3tmaWxlTmFtZX1cIiwgNjQsICctJylcclxuXHJcblx0cGF0aCA6PSBmaW5kRmlsZSBmaWxlTmFtZVxyXG5cdGFzc2VydCBwYXRoLCBcIk5vIHN1Y2ggZmlsZTogI3tmaWxlTmFtZX1cIlxyXG5cclxuXHRoIDo9IChcclxuXHRcdCAgZ2V0Qm9vbGVhbk9wdGlvbihoT3B0aW9ucywgJ2RlYnVnJylcclxuXHRcdD8gYXdhaXQgZXhlY0NtZCAnZGVubycsIFtcclxuXHRcdFx0J3J1bidcclxuXHRcdFx0Jy1BJ1xyXG5cdFx0XHQnLS1pbnNwZWN0LWJyaydcclxuXHRcdFx0cGF0aFxyXG5cdFx0XHQnLS0nXHJcblx0XHRcdGxBcmdzLi4uXHJcblx0XHRcdF1cclxuXHRcdDogYXdhaXQgZXhlY0NtZCAnZGVubycsIFtcclxuXHRcdFx0J3J1bidcclxuXHRcdFx0Jy1BJ1xyXG5cdFx0XHRwYXRoXHJcblx0XHRcdCctLSdcclxuXHRcdFx0bEFyZ3MuLi5cclxuXHRcdFx0XVxyXG5cdFx0KVxyXG5cdGFzc2VydCBoLnN1Y2Nlc3MsIFwiICAgRkFJTEVEXCJcclxuXHRyZXR1cm5cclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgc2VwIDo9IChcclxuXHRcdHdpZHRoOiBudW1iZXIgPSA2NFxyXG5cdFx0Y2hhcjogc3RyaW5nID0gJy0nXHJcblx0XHQpOiBzdHJpbmcgPT5cclxuXHJcblx0cmV0dXJuIGNoYXIucmVwZWF0KHdpZHRoKVxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuIyAtLS0gdmFsaWQgb3B0aW9uczpcclxuIyAgICAgICAgY2hhciAtIGNoYXIgdG8gdXNlIG9uIGxlZnQgYW5kIHJpZ2h0XHJcbiMgICAgICAgIGJ1ZmZlciAtIG51bSBzcGFjZXMgYXJvdW5kIHRleHQgd2hlbiBjaGFyIDw+ICcgJ1xyXG5cclxuZXhwb3J0IGNlbnRlcmVkIDo9IChcclxuXHR0ZXh0OiBzdHJpbmcsXHJcblx0d2lkdGg6IG51bWJlcixcclxuXHRjaGFyOiBzdHJpbmcgPSAnICcsXHJcblx0bnVtQnVmZmVyOiBudW1iZXIgPSAyXHJcblx0KTogc3RyaW5nID0+XHJcblxyXG5cdHRvdFNwYWNlcyA6PSB3aWR0aCAtIHRleHQubGVuZ3RoXHJcblx0aWYgKHRvdFNwYWNlcyA8PSAwKVxyXG5cdFx0cmV0dXJuIHRleHRcclxuXHRudW1MZWZ0IDo9IE1hdGguZmxvb3IodG90U3BhY2VzIC8gMilcclxuXHRudW1SaWdodCA6PSB0b3RTcGFjZXMgLSBudW1MZWZ0XHJcblx0aWYgKGNoYXIgPT0gJyAnKVxyXG5cdFx0cmV0dXJuICcgJy5yZXBlYXQobnVtTGVmdCkgKyB0ZXh0ICsgJyAnLnJlcGVhdChudW1SaWdodClcclxuXHRlbHNlXHJcblx0XHRidWYgOj0gJyAnLnJlcGVhdChudW1CdWZmZXIpXHJcblx0XHRsZWZ0IDo9IGNoYXIucmVwZWF0KG51bUxlZnQgLSBudW1CdWZmZXIpXHJcblx0XHRyaWdodCA6PSBjaGFyLnJlcGVhdChudW1SaWdodCAtIG51bUJ1ZmZlcilcclxuXHRcdHJldHVybiBsZWZ0ICsgYnVmICsgdGV4dCArIGJ1ZiArIHJpZ2h0XHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuZXhwb3J0IGxBbGxMaWJzIDo9IFtcclxuXHQnYmFzZS11dGlscycsICdkYXRhdHlwZXMnLCAnbGx1dGlscycsICdpbmRlbnQnLCAndW5pY29kZScsXHJcblx0J3RvLW5pY2UnLCAnbG9nLWxldmVscycsICdsb2ctZm9ybWF0dGVyJywgJ2xvZ2dlcicsICd0ZXh0LXRhYmxlJyxcclxuXHJcblx0J3BhcnNlcicsICdjbWQtYXJncycsXHJcblx0J3dhbGtlcicsICdmc3lzJywgJ3BsbCcsICdleGVjJywgJ2Zyb20tbmljZSdcclxuXHJcblx0J3NvdXJjZS1tYXAnLCAnc3ltYm9scycsICd0eXBlc2NyaXB0JywgJ2NpdmV0JywgJ2NpZWxvJyxcclxuXHQnYXV0b21hdGUnLCAndjgtc3RhY2snLCAndW5pdC10ZXN0JyxcclxuXHRdXHJcbiJdfQ==