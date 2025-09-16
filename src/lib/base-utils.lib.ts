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

export const DIR = console.dir

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

export const nonOption = (pos: number): (string | undefined) => {

	for (const str of Deno.args) {
		if (!/^-/.test(str)) {
			if (pos === 0) {
				return str
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

const LLOG = (
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

	const lFiles = Array.from(allFilesMatching(`**/${fileName}`))
	switch(lFiles.length) {
		case 1: {
			return lFiles[0]
		}
		case 0: {
			return undef
		}
		default: {
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

	const name = (
		   getStringOption(hOptions, 'name')
		|| parsePath(path).stub
		)
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
	'log-levels', 'log-formatter', 'logger', 'text-table',

	'parser', 'cmd-args',
	'walker', 'fsys', 'pll', 'exec', 'nice',

	'symbols', 'typescript', 'civet', 'cielo', 'automate',
	'source-map', 'v8-stack', 'unit-test',
	]

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQzpcXFVzZXJzXFxqb2huZFxcdXRpbHNcXHNyY1xcbGliXFxiYXNlLXV0aWxzLmxpYi5jaXZldC50c3giLCJzb3VyY2VzIjpbIkM6XFxVc2Vyc1xcam9obmRcXHV0aWxzXFxzcmNcXGxpYlxcYmFzZS11dGlscy5saWIuY2l2ZXQiXSwibWFwcGluZ3MiOiI7QUFBQSx1QkFBc0I7QUFDdEIsQUFBQTtBQUNBLEssVyx5QjtBQUFBLE1BQU0sQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksQ0FBQyxpQkFBaUI7QUFDdEMsQUFBQSxBQUFBLE1BQU0sQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxXQUFXO0FBQ3pDLEFBQUEsQUFBQSxNQUFNLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxJQUFJLENBQUMsYUFBYTtBQUN0QyxBQUFBLEFBQUEsTUFBTSxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsSUFBSSxDQUFDLFNBQVM7QUFDaEMsQUFBQSxBQUFBLE1BQU0sQ0FBQyxDQUFDLGNBQWMsQ0FBQyxDQUFDLElBQUksQ0FBQyx5QkFBeUI7QUFDdEQsQUFBQTtBQUNBLEFBQUEsQUFBQSxNQUFNLENBQUMsQ0FBQyxNQUFNLENBQUM7QUFDZixBQUFBLEFBQU8sTUFBUCxPQUFPLENBQUMsQ0FBRSxDQUFDLEdBQUcsQ0FBQyxXQUFXLENBQUMsQ0FBQztBQUM1QixBQUFBLEFBQU0sTUFBTixNQUFNLENBQUMsQ0FBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFBLENBQUE7QUFDekMsQUFBQSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUMsQztBQUFDLENBQUE7QUFDekIsQUFBQTtBQUNBLEFBQUEsQUFBQSxNQUFNLENBQUksTUFBSCxHQUFHLENBQUMsQ0FBRSxDQUFDLE9BQU8sQ0FBQyxHQUFHO0FBQ3pCLEFBQUE7QUFDQSxBQUFBLEFBQUEs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NkU7QUFDN0UsQUFBQTtBQUNBLEFBQUEsQUFBQSxNQUFNLENBQUksTUFBSCxHQUFHLENBQUMsQ0FBRSxDQUFDLENBQUM7QUFDZixBQUFBLEVBQUUsS0FBSyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUE7QUFDcEIsQUFBQSxFQUFFLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsR0FBRztBQUNwQixFQUFFLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUEsQ0FBQTtBQUNkLEFBQUE7QUFDQSxBQUFBLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxDO0FBQUMsQ0FBQTtBQUMxQixBQUFBO0FBQ0EsQUFBQSw4RUFBNkU7QUFDN0UsQUFBQSxxQkFBb0I7QUFDcEIsQUFBQSw4Q0FBNkM7QUFDN0MsQUFBQSwwREFBeUQ7QUFDekQsQUFBQTtBQUNBLEFBQUEsQUFBQSxNQUFNLENBQVMsTUFBUixRQUFRLENBQUMsQ0FBRSxDQUFDLENBQUM7QUFDcEIsQUFBQSxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQztBQUNkLEFBQUEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxNQUFNLENBQUM7QUFDZixBQUFBLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUM7QUFDcEIsQUFBQSxDQUFDLFNBQVMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUN0QixDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUEsQ0FBQTtBQUNiLEFBQUE7QUFDQSxBQUFBLENBQVUsTUFBVCxTQUFTLENBQUMsQ0FBRSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU07QUFDakMsQUFBQSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFBLENBQUE7QUFDcEIsQUFBQSxFQUFFLE1BQU0sQ0FBQyxJO0NBQUksQ0FBQTtBQUNiLEFBQUEsQ0FBUSxNQUFQLE9BQU8sQ0FBQyxDQUFFLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNyQyxBQUFBLENBQVMsTUFBUixRQUFRLENBQUMsQ0FBRSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsT0FBTztBQUNoQyxBQUFBLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxHQUFFLENBQUMsR0FBRyxDQUFDLENBQUEsQ0FBQTtBQUNqQixBQUFBLEVBQUUsTUFBTSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxRQUFRLEM7Q0FBQyxDQUFBO0FBQzFELEFBQUEsQ0FBQyxJQUFJLENBQUEsQ0FBQTtBQUNMLEFBQUEsRUFBSyxNQUFILEdBQUcsQ0FBQyxDQUFFLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUM7QUFDOUIsQUFBQSxFQUFNLE1BQUosSUFBSSxDQUFDLENBQUUsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDO0FBQzFDLEFBQUEsRUFBTyxNQUFMLEtBQUssQ0FBQyxDQUFFLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQztBQUM1QyxBQUFBLEVBQUUsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsSztDQUFLLEM7QUFBQSxDQUFBO0FBQ3hDLEFBQUE7QUFDQSxBQUFBLDhFQUE2RTtBQUM3RSxBQUFBO0FBQ0EsQUFBQSxBQUFBLE1BQU0sQ0FBUyxNQUFSLFFBQVEsQ0FBQyxDQUFFLENBQUMsQ0FBQztBQUNwQixBQUFBLENBQUMsWUFBWSxDQUFDLENBQUMsV0FBVyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsU0FBUyxDQUFDO0FBQzNELEFBQUEsQ0FBQyxZQUFZLENBQUMsQ0FBQyxlQUFlLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxZQUFZLENBQUM7QUFDdkQsQUFBQTtBQUNBLEFBQUEsQ0FBQyxRQUFRLENBQUMsQ0FBQyxVQUFVLENBQUM7QUFDdEIsQUFBQSxDQUFDLFFBQVEsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLE1BQU0sQ0FBQTtBQUN4QyxBQUFBO0FBQ0EsQUFBQSxDQUFDLFNBQVMsQ0FBQyxDQUFDLFlBQVksQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLFVBQVUsQ0FBQztBQUN2RCxBQUFBLENBQUMsWUFBWSxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsV0FBVyxDQUFDO0FBQ3ZDLEFBQUEsQ0FBQyxDQUFDO0FBQ0YiLCJuYW1lcyI6W10sInNvdXJjZXNDb250ZW50IjpbIiMgYmFzZS11dGlscy5saWIuY2l2ZXRcclxuXHJcbmltcG9ydCB7YXNzZXJ0fSBmcm9tICdqc3I6QHN0ZC9hc3NlcnQnXHJcbmltcG9ydCB7cmVsYXRpdmUsIHBhcnNlfSBmcm9tICdub2RlOnBhdGgnXHJcbmltcG9ydCB7ZXhpc3RzU3luY30gZnJvbSAnanNyOkBzdGQvZnMnXHJcbmltcG9ydCB7c3RhdFN5bmN9IGZyb20gJ25vZGU6ZnMnXHJcbmltcG9ydCB7ZXhwYW5kR2xvYlN5bmN9IGZyb20gJ2pzcjpAc3RkL2ZzL2V4cGFuZC1nbG9iJ1xyXG5cclxuZXhwb3J0IHthc3NlcnR9XHJcbmRlY29kZXIgOj0gbmV3IFRleHREZWNvZGVyKClcclxuZGVjb2RlIDo9ICh4OiBVaW50OEFycmF5PEFycmF5QnVmZmVyPikgPT5cclxuXHRyZXR1cm4gZGVjb2Rlci5kZWNvZGUoeClcclxuXHJcbmV4cG9ydCBESVIgOj0gY29uc29sZS5kaXJcclxuXHJcbmV4cG9ydCB0eXBlIFRDb25zdHJ1Y3RvcjxUPiA9IG5ldyAoLi4uYXJnczogYW55W10pID0+IFRcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgY2hlY2tTZXR1cCA6PSAoKTogdm9pZCA9PlxyXG5cclxuXHRyb290RGlyOiBzdHJpbmc/IDo9IERlbm8uZW52LmdldCgnUFJPSkVDVF9ST09UX0RJUicpXHJcblx0YXNzZXJ0SXNEZWZpbmVkKHJvb3REaXIpXHJcblx0YXNzZXJ0IGV4aXN0c1N5bmMocm9vdERpcikgJiYgc3RhdFN5bmMocm9vdERpcikuaXNEaXJlY3RvcnkoKSxcclxuXHRcdFwiUGxlYXNlIHNldCBlbnYgdmFyIFBST0pFQ1RfUk9PVF9ESVIgdG8gYSB2YWxpZCBkaXJlY3RvcnlcIlxyXG5cdHJldHVyblxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbmV4cG9ydCBGQUlMIDo9IChlcnJNc2c6IHN0cmluZywgbjogbnVtYmVyID0gOTkpOiBuZXZlciA9PlxyXG5cclxuXHRjb25zb2xlLmxvZyBlcnJNc2dcclxuXHREZW5vLmV4aXQobilcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgU1VDQ0VFRCA6PSAobXNnOiBzdHJpbmc/ID0gdW5kZWYpOiBuZXZlciA9PlxyXG5cclxuXHRpZiBkZWZpbmVkKG1zZylcclxuXHRcdGNvbnNvbGUubG9nIG1zZ1xyXG5cdERlbm8uZXhpdCgwKVxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuIyAgICAgICAgICAgICBjbWQtYXJnc1xyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuZXhwb3J0IGZsYWcgOj0gKFxyXG5cdFx0Y2g6IHN0cmluZ1xyXG5cdFx0bENtZEFyZ3M6IHN0cmluZ1tdID0gRGVuby5hcmdzXHJcblx0XHQpOiBib29sZWFuID0+XHJcblxyXG5cdGFzc2VydCAoY2gubGVuZ3RoID09IDEpLCBcIkJhZCBmbGFnIGFyZzogI3tjaH1cIlxyXG5cdHJlIDo9IG5ldyBSZWdFeHAoXCJeLVthLXpdKiN7Y2h9W2Etel0qJFwiKVxyXG5cdGZvciBzdHIgb2YgbENtZEFyZ3NcclxuXHRcdGlmIHJlLnRlc3Qoc3RyKVxyXG5cdFx0XHRyZXR1cm4gdHJ1ZVxyXG5cdHJldHVybiBmYWxzZVxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbmV4cG9ydCBub25PcHRpb24gOj0gKHBvczogbnVtYmVyKTogc3RyaW5nPyA9PlxyXG5cclxuXHRmb3Igc3RyIG9mIERlbm8uYXJnc1xyXG5cdFx0aWYgbm90IC9eLS8udGVzdChzdHIpXHJcblx0XHRcdGlmIChwb3MgPT0gMClcclxuXHRcdFx0XHRyZXR1cm4gc3RyXHJcblx0XHRcdGVsc2VcclxuXHRcdFx0XHRwb3MgLT0gMVxyXG5cdHJldHVybiB1bmRlZlxyXG5cclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbiMgICAgICAgICAgICAgbG9nZ2VyXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgTE9HIDo9IGNvbnNvbGUubG9nXHJcblxyXG5leHBvcnQgREJHIDo9IChtc2c6IHN0cmluZyk6IHZvaWQgPT5cclxuXHRpZiBmbGFnKCdEJylcclxuXHRcdExPRyBtc2dcclxuXHRyZXR1cm5cclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5MTE9HIDo9IChcclxuXHRcdGxhYmVsOiBzdHJpbmdcclxuXHRcdG1zZzogc3RyaW5nXHJcblx0XHQpOiB2b2lkID0+XHJcblxyXG5cdGxhYmVsTGVuIDo9IDE1XHJcblx0aWYgKGxhYmVsLmxlbmd0aCA8PSBsYWJlbExlbilcclxuXHRcdHNwYWNlcyA6PSAnICcucmVwZWF0KGxhYmVsTGVuLWxhYmVsLmxlbmd0aClcclxuXHRcdExPRyBcIiN7bGFiZWx9I3tzcGFjZXN9ICN7bXNnfVwiXHJcblx0ZWxzZVxyXG5cdFx0TE9HIFwiI3tsYWJlbC5zdWJzdHJpbmcoMCwgbGFiZWxMZW4pfSAje21zZ31cIlxyXG5cdHJldHVyblxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbklMT0cgOj0gKG1zZzogc3RyaW5nKTogdm9pZCA9PlxyXG5cclxuXHRMT0cgXCIgICAje21zZ31cIlxyXG5cdHJldHVyblxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuIyAgICAgICAgICAgICBkYXRhdHlwZXNcclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbmV4cG9ydCB0eXBlIGhhc2hcclxuXHRba2V5OiBzdHJpbmcgfCBzeW1ib2xdOiB1bmtub3duXHJcblxyXG5leHBvcnQgdHlwZSBURGVmaW5lZCA9IE5vbk51bGxhYmxlPHVua25vd24+XHJcbmV4cG9ydCB0eXBlIFROb3REZWZpbmVkID0gbnVsbCB8IHVuZGVmaW5lZFxyXG5cclxuZXhwb3J0IHVuZGVmIDo9IHVuZGVmaW5lZFxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbmV4cG9ydCBkZWZpbmVkIDo9ICh4OiB1bmtub3duKTogeCBpcyBURGVmaW5lZCA9PlxyXG5cclxuXHRyZXR1cm4gKHggIT0gdW5kZWYpICYmICh4ICE9IG51bGwpXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuZXhwb3J0IG5vdGRlZmluZWQgOj0gKHg6IHVua25vd24pOiB4IGlzIFROb3REZWZpbmVkID0+XHJcblxyXG5cdHJldHVybiAoeCA9PSB1bmRlZikgfHwgKHggPT0gbnVsbClcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgZnVuY3Rpb24gYXNzZXJ0SXNEZWZpbmVkKFxyXG5cdFx0dmFsdWU6IHVua25vd25cclxuXHRcdG5hbWU6IHN0cmluZyA9ICcnXHJcblx0XHQpOiBhc3NlcnRzIHZhbHVlIGlzIFREZWZpbmVkID0+XHJcblxyXG5cdGlmIG5vdGRlZmluZWQodmFsdWUpXHJcblx0XHR0aHJvdyBuZXcgRXJyb3IoXCJ2YWx1ZSBpcyBub3QgZGVmaW5lZFwiKVxyXG5cdHJldHVyblxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBhc3NlcnROb3REZWZpbmVkKFxyXG5cdFx0dmFsdWU6IHVua25vd25cclxuXHRcdG5hbWU6IHN0cmluZyA9ICcnXHJcblx0XHQpOiBhc3NlcnRzIHZhbHVlIGlzIFROb3REZWZpbmVkID0+XHJcblxyXG5cdGlmIGRlZmluZWQodmFsdWUpXHJcblx0XHR0aHJvdyBuZXcgRXJyb3IoXCJ2YWx1ZSBpcyBkZWZpbmVkXCIpXHJcblx0cmV0dXJuXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuZXhwb3J0IGNyb2FrIDo9IChtc2c6IHN0cmluZyk6IG5ldmVyID0+XHJcblxyXG5cdHRocm93IG5ldyBFcnJvcihtc2cpXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuZXhwb3J0IHJlcGxhY2VJbkFycmF5IDo9IChcclxuXHRsU3RyaW5nczogc3RyaW5nW11cclxuXHRoUmVwbGFjZToge1trZXk6IHN0cmluZ106IHN0cmluZ31cclxuXHQpOiBzdHJpbmdbXSA9PlxyXG5cclxuXHRyZXR1cm4gZm9yIHN0ciBvZiBsU3RyaW5nc1xyXG5cdFx0aWYgaFJlcGxhY2UuaGFzT3duUHJvcGVydHkoc3RyKVxyXG5cdFx0XHRoUmVwbGFjZVtzdHJdXHJcblx0XHRlbHNlXHJcblx0XHRcdHN0clxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuIyAgICAgICAgICAgICBmc3lzXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgcm1GaWxlIDo9IChwYXRoOiBzdHJpbmcpOiB2b2lkID0+XHJcblxyXG5cdGlmIGV4aXN0c1N5bmMgcGF0aFxyXG5cdFx0RGVuby5yZW1vdmVTeW5jIHBhdGhcclxuXHRyZXR1cm5cclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgZmlsZUV4dCA6PSAocGF0aDogc3RyaW5nKTogc3RyaW5nID0+XHJcblxyXG5cdGlmIGxNYXRjaGVzIDo9IHBhdGgubWF0Y2goL1xcLlteXFwuXSskLylcclxuXHRcdHJldHVybiBsTWF0Y2hlc1swXVxyXG5cdGVsc2VcclxuXHRcdHJldHVybiAnJ1xyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbmV4cG9ydCB3aXRoRXh0IDo9IChwYXRoOiBzdHJpbmcsIGV4dDogc3RyaW5nKTogc3RyaW5nID0+XHJcblxyXG5cdGxNYXRjaGVzIDo9IHBhdGgubWF0Y2ggL14oLiopKFxcLlteXFwuXSspJC9cclxuXHRpZiAobE1hdGNoZXMgPT0gbnVsbClcclxuXHRcdGNyb2FrIFwiQmFkIHBhdGg6ICcje3BhdGh9J1wiXHJcblx0XHRyZXR1cm4gJydcclxuXHRlbHNlXHJcblx0XHRbXywgaGVhZFN0ciwgb3JnRXh0XSA6PSBsTWF0Y2hlc1xyXG5cdFx0cmV0dXJuIFwiI3toZWFkU3RyfSN7ZXh0fVwiXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuZXhwb3J0IG5vcm1hbGl6ZVBhdGggOj0gKHBhdGg6IHN0cmluZyk6IHN0cmluZyA9PlxyXG5cclxuXHRucGF0aCA6PSBwYXRoLnJlcGxhY2VBbGwoJ1xcXFwnLCAnLycpXHJcblx0aWYgKG5wYXRoLmNoYXJBdCgxKSA9PSAnOicpXHJcblx0XHRyZXR1cm4gbnBhdGguY2hhckF0KDApLnRvVXBwZXJDYXNlKCkgKyBucGF0aC5zdWJzdHJpbmcoMSlcclxuXHRlbHNlXHJcblx0XHRyZXR1cm4gbnBhdGhcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgcmVscGF0aCA6PSAocGF0aDogc3RyaW5nKTogc3RyaW5nID0+XHJcblxyXG5cdHJldHVybiBub3JtYWxpemVQYXRoKHJlbGF0aXZlKCcnLCBwYXRoKSlcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgYnVpbGRGaWxlTmFtZSA6PSAoXHJcblx0XHRzdHViOiBzdHJpbmdcclxuXHRcdHB1cnBvc2U6IHN0cmluZz9cclxuXHRcdGV4dDogc3RyaW5nXHJcblx0XHQpID0+XHJcblxyXG5cdHJldHVybiAoXHJcblx0XHRwdXJwb3NlID8gXCIje3N0dWJ9LiN7cHVycG9zZX0je2V4dH1cIlxyXG5cdFx0ICAgICAgICA6IFwiI3tzdHVifSN7ZXh0fVwiXHJcblx0XHQpXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuZXhwb3J0IGJ1aWxkVGVzdEZpbGVOYW1lIDo9IChcclxuXHRcdHN0dWI6IHN0cmluZ1xyXG5cdFx0cHVycG9zZTogc3RyaW5nP1xyXG5cdFx0ZXh0OiBzdHJpbmdcclxuXHRcdCkgPT5cclxuXHJcblx0cmV0dXJuIChcclxuXHRcdHB1cnBvc2UgPyBcIiN7c3R1Yn0uI3twdXJwb3NlfS50ZXN0I3tleHR9XCJcclxuXHRcdCAgICAgICAgOiBcIiN7c3R1Yn0udGVzdCN7ZXh0fVwiXHJcblx0XHQpXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuZXhwb3J0IHR5cGUgVFBhdGhJbmZvID0ge1xyXG5cdHJvb3Q6IHN0cmluZ1xyXG5cdGRpcjogc3RyaW5nXHJcblx0ZmlsZU5hbWU6IHN0cmluZ1xyXG5cclxuXHRzdHViOiBzdHJpbmdcclxuXHRwdXJwb3NlOiBzdHJpbmc/XHJcblx0ZXh0OiBzdHJpbmdcclxuXHR9XHJcblxyXG5leHBvcnQgcGFyc2VQYXRoIDo9IChcclxuXHRcdHBhdGg6IHN0cmluZ1xyXG5cdFx0KTogVFBhdGhJbmZvID0+XHJcblxyXG5cdHtyb290LCBkaXIsIGJhc2V9IDo9IHBhcnNlKHBhdGgpXHJcblxyXG5cdGxQYXJ0cyA6PSBiYXNlLnNwbGl0KCcuJylcclxuXHRhc3NlcnQgKGxQYXJ0cy5sZW5ndGggPiAyKSwgXCJCYWQgcGF0aDogI3twYXRofVwiXHJcblx0cmV0dXJuIHtcclxuXHRcdHJvb3Q6IG5vcm1hbGl6ZVBhdGgocm9vdClcclxuXHRcdGRpcjogbm9ybWFsaXplUGF0aChkaXIpXHJcblx0XHRmaWxlTmFtZTogYmFzZVxyXG5cclxuXHRcdHN0dWI6ICAgIGxQYXJ0cy5zbGljZSgwLCAtMikuam9pbignLicpXHJcblx0XHRwdXJwb3NlOiBsUGFydHMuYXQoLTIpXHJcblx0XHRleHQ6ICAgICBcIi4je2xQYXJ0cy5hdCgtMSl9XCJcclxuXHRcdH1cclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgdHlwZSBURXhlY1Jlc3VsdCA9IHtcclxuXHRzdWNjZXNzOiBib29sZWFuXHJcblx0Y29kZTogbnVtYmVyXHJcblx0c2lnbmFsPzogRGVuby5TaWduYWwgfCBudWxsXHJcblx0c3Rkb3V0Pzogc3RyaW5nXHJcblx0c3RkZXJyPzogc3RyaW5nXHJcblx0fVxyXG5cclxuZXhwb3J0IHR5cGUgVFJlcGxhY2VIYXNoID0ge1xyXG5cdFtrZXk6IHN0cmluZ106IHN0cmluZ1xyXG5cdH1cclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbiMgQVNZTkNcclxuXHJcbmV4cG9ydCBleGVjQ21kIDo9IChcclxuXHRjbWROYW1lOiBzdHJpbmdcclxuXHRsQ21kQXJnczogc3RyaW5nW10gPSBbXVxyXG5cdGhSZXBsYWNlOiBUUmVwbGFjZUhhc2ggPSB7fVxyXG5cdGNhcHR1cmU6IGJvb2xlYW4gPSBmYWxzZVxyXG5cdCk6IFRFeGVjUmVzdWx0ID0+XHJcblxyXG5cdGNoaWxkIDo9IG5ldyBEZW5vLkNvbW1hbmQoY21kTmFtZSwge1xyXG5cdFx0YXJnczogcmVwbGFjZUluQXJyYXkobENtZEFyZ3MsIGhSZXBsYWNlKVxyXG5cdFx0c3Rkb3V0OiBjYXB0dXJlID8gJ3BpcGVkJyA6ICdpbmhlcml0J1xyXG5cdFx0c3RkZXJyOiBjYXB0dXJlID8gJ3BpcGVkJyA6ICdpbmhlcml0J1xyXG5cdFx0fSlcclxuXHRpZiBjYXB0dXJlXHJcblx0XHR7c3VjY2VzcywgY29kZSwgc2lnbmFsLCBzdGRvdXQsIHN0ZGVycn0gOj0gYXdhaXQgY2hpbGQub3V0cHV0KClcclxuXHRcdHJldHVybiB7XHJcblx0XHRcdHN1Y2Nlc3MsIGNvZGVcclxuXHRcdFx0c2lnbmFsOiBzaWduYWwgfHwgdW5kZWZcclxuXHRcdFx0c3Rkb3V0OiBkZWNvZGUoc3Rkb3V0KVxyXG5cdFx0XHRzdGRlcnI6IGRlY29kZShzdGRlcnIpXHJcblx0XHRcdH1cclxuXHRlbHNlXHJcblx0XHR7c3VjY2VzcywgY29kZSwgc2lnbmFsfSA6PSBhd2FpdCBjaGlsZC5vdXRwdXQoKVxyXG5cdFx0cmV0dXJuIHtcclxuXHRcdFx0c3VjY2Vzc1xyXG5cdFx0XHRjb2RlXHJcblx0XHRcdHNpZ25hbDogc2lnbmFsIHx8IHVuZGVmXHJcblx0XHRcdH1cclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgbmV3ZXJEZXN0RmlsZUV4aXN0cyA6PSAoXHJcblx0XHRwYXRoOiBzdHJpbmdcclxuXHRcdGV4dDogc3RyaW5nXHJcblx0XHQpOiBib29sZWFuID0+XHJcblxyXG5cdGRlc3RQYXRoIDo9IHdpdGhFeHQgcGF0aCwgZXh0XHJcblx0aWYgbm90IGV4aXN0c1N5bmMoZGVzdFBhdGgpXHJcblx0XHRyZXR1cm4gZmFsc2VcclxuXHRzcmNNUyA6PSBzdGF0U3luYyhwYXRoKS5tdGltZU1zXHJcblx0ZGVzdE1TIDo9IHN0YXRTeW5jKGRlc3RQYXRoKS5tdGltZU1zXHJcblx0cmV0dXJuIChkZXN0TVMgPiBzcmNNUylcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgY21kU3VjY2VlZHMgOj0gKFxyXG5cdFx0Y21kTmFtZTogc3RyaW5nXHJcblx0XHRsQXJnczogc3RyaW5nW10gPSBbXVxyXG5cdFx0KTogYm9vbGVhbiA9PlxyXG5cclxuXHRjaGlsZCA6PSBuZXcgRGVuby5Db21tYW5kIGNtZE5hbWUsIHtcclxuXHRcdGFyZ3M6IGxBcmdzXHJcblx0XHRzdGRvdXQ6ICdwaXBlZCdcclxuXHRcdHN0ZGVycjogJ3BpcGVkJ1xyXG5cdFx0fVxyXG5cdHJldHVybiBjaGlsZC5vdXRwdXRTeW5jKCkuc3VjY2Vzc1xyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbmV4cG9ydCBzcGxpdFBhdHRlcm5zIDo9IChcclxuXHRcdGxBbGxQYXRzOiBzdHJpbmcgfCBzdHJpbmdbXVxyXG5cdFx0KTogW3N0cmluZ1tdLCBzdHJpbmdbXV0gPT5cclxuXHJcblx0bFBvc1BhdHM6IHN0cmluZ1tdIDo9IFtdXHJcblx0bE5lZ1BhdHM6IHN0cmluZ1tdIDo9IFtdXHJcblxyXG5cdGlmICh0eXBlb2YgbEFsbFBhdHMgPT0gJ3N0cmluZycpXHJcblx0XHQjIC0tLSBBIHNpbmdsZSBzdHJpbmcgY2FuJ3QgYmUgYSBuZWdhdGl2ZSBwYXR0ZXJuXHJcblx0XHRhc3NlcnQgbm90IGxBbGxQYXRzLm1hdGNoKC9eXFwhLyksIFwiQmFkIGdsb2IgcGF0dGVybjogI3tsQWxsUGF0c31cIlxyXG5cdFx0bFBvc1BhdHMucHVzaCBsQWxsUGF0c1xyXG5cdGVsc2VcclxuXHRcdGZvciBwYXQgb2YgbEFsbFBhdHNcclxuXHRcdFx0bE1hdGNoZXMgOj0gcGF0Lm1hdGNoKC9eKFxcIVxccyopPyguKikkLylcclxuXHRcdFx0aWYgbE1hdGNoZXNcclxuXHRcdFx0XHRpZiBsTWF0Y2hlc1sxXVxyXG5cdFx0XHRcdFx0bE5lZ1BhdHMucHVzaCBsTWF0Y2hlc1syXVxyXG5cdFx0XHRcdGVsc2VcclxuXHRcdFx0XHRcdGxQb3NQYXRzLnB1c2ggbE1hdGNoZXNbMl1cclxuXHRyZXR1cm4gW2xQb3NQYXRzLCBsTmVnUGF0c11cclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbiMgR0VORVJBVE9SXHJcbiNcclxuIyAgICBVc2UgbGlrZTpcclxuIyAgICAgICBmb3IgcGF0aCBvZiBhbGxGaWxlc01hdGNoaW5nKGxQYXRzKVxyXG4jICAgICAgICAgIE9SXHJcbiMgICAgICAgbFBhdGhzIDo9IEFycmF5LmZyb20oYWxsRmlsZXNNYXRjaGluZyhsUGF0cykpXHJcbiNcclxuIyAgICBOT1RFOiBCeSBkZWZhdWx0LCBzZWFyY2hlcyBmcm9tIC4vc3JjXHJcblxyXG5leHBvcnQgYWxsRmlsZXNNYXRjaGluZyA6PSAoXHJcblx0XHRsUGF0dGVybnM6IHN0cmluZyB8IHN0cmluZ1tdXHJcblx0XHRoR2xvYk9wdGlvbnMgPSB7XHJcblx0XHRcdHJvb3Q6ICcuL3NyYydcclxuXHRcdFx0aW5jbHVkZURpcnM6IGZhbHNlXHJcblx0XHRcdH1cclxuXHRcdCk6IEdlbmVyYXRvcjxzdHJpbmcsIHZvaWQsIHZvaWQ+IC0+XHJcblxyXG5cdFtsUG9zUGF0cywgbE5lZ1BhdHNdIDo9IHNwbGl0UGF0dGVybnMgbFBhdHRlcm5zXHJcblx0aWYgZmxhZygnRCcpXHJcblx0XHRMT0cgXCJQQVRURVJOUzpcIlxyXG5cdFx0Zm9yIHBhdCBvZiBsUG9zUGF0c1xyXG5cdFx0XHRJTE9HIFwiUE9TOiAje3BhdH1cIlxyXG5cdFx0Zm9yIHBhdCBvZiBsTmVnUGF0c1xyXG5cdFx0XHRJTE9HIFwiTkVHOiAje3BhdH1cIlxyXG5cclxuXHRzZXRTa2lwIDo9IG5ldyBTZXQ8c3RyaW5nPigpXHJcblx0Zm9yIHBhdCBvZiBsTmVnUGF0c1xyXG5cdFx0Zm9yIHtwYXRofSBvZiBleHBhbmRHbG9iU3luYyhwYXQsIGhHbG9iT3B0aW9ucylcclxuXHRcdFx0c2V0U2tpcC5hZGQgcGF0aFxyXG5cclxuXHRmb3IgcGF0IG9mIGxQb3NQYXRzXHJcblx0XHRmb3Ige3BhdGh9IG9mIGV4cGFuZEdsb2JTeW5jKHBhdCwgaEdsb2JPcHRpb25zKVxyXG5cdFx0XHRpZiBub3Qgc2V0U2tpcC5oYXMgcGF0aFxyXG5cdFx0XHRcdERCRyBcIlBBVEg6ICN7cGF0aH1cIlxyXG5cdFx0XHRcdHlpZWxkIHBhdGhcclxuXHRcdFx0XHRzZXRTa2lwLmFkZCBwYXRoXHJcblx0cmV0dXJuXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuZXhwb3J0IGZpbmRGaWxlIDo9IChmaWxlTmFtZTogc3RyaW5nKTogc3RyaW5nPyA9PlxyXG5cclxuXHRsRmlsZXMgOj0gQXJyYXkuZnJvbSBhbGxGaWxlc01hdGNoaW5nKFwiKiovI3tmaWxlTmFtZX1cIilcclxuXHRzd2l0Y2ggbEZpbGVzLmxlbmd0aFxyXG5cdFx0d2hlbiAxXHJcblx0XHRcdHJldHVybiBsRmlsZXNbMF1cclxuXHRcdHdoZW4gMFxyXG5cdFx0XHRyZXR1cm4gdW5kZWZcclxuXHRcdGVsc2VcclxuXHRcdFx0Y3JvYWsgXCJNdWx0aXBsZSBmaWxlcyB3aXRoIG5hbWUgI3tmaWxlTmFtZX1cIlxyXG5cdFx0XHRyZXR1cm4gJydcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbiMgQVNZTkNcclxuXHJcbmV4cG9ydCB0eXBlIFRQcm9jRnVuYyA9IChwYXRoOiBzdHJpbmcpID0+IFByb21pc2U8dW5rbm93bj5cclxuZXhwb3J0IHR5cGUgVFByb2NSZXN1bHQgPSB7IFtwYXRoOiBzdHJpbmddOiB1bmtub3duIH1cclxuXHJcbmV4cG9ydCBwcm9jRmlsZXMgOj0gKFxyXG5cdFx0bFBhdHRlcm5zOiBzdHJpbmcgfCBzdHJpbmdbXVxyXG5cdFx0cHJvY0Z1bmM6IFRQcm9jRnVuY1xyXG5cdFx0KTogW1xyXG5cdFx0XHRUUHJvY1Jlc3VsdCAgICAgIyBwYXRocyBzdWNjZWVkZWRcclxuXHRcdFx0VFByb2NSZXN1bHQ/ICAgICMgcGF0aHMgZmFpbGVkXHJcblx0XHRcdF0gPT5cclxuXHJcblx0IyAtLS0gV2UgbmVlZCB0aGUgcGF0aHMgZm9yIGxhdGVyXHJcblx0bFBhdGhzIDo9IEFycmF5LmZyb20oYWxsRmlsZXNNYXRjaGluZyhsUGF0dGVybnMpKVxyXG5cclxuXHRsUHJvbWlzZXMgOj0gZm9yIHBhdGggb2YgbFBhdGhzXHJcblx0XHRwcm9jRnVuYyBwYXRoXHJcblx0bFJlc3VsdHMgOj0gYXdhaXQgUHJvbWlzZS5hbGxTZXR0bGVkKGxQcm9taXNlcylcclxuXHJcblx0aFN1Y2NlZWRlZDogVFByb2NSZXN1bHQgOj0ge31cclxuXHRoRmFpbGVkOiAgICBUUHJvY1Jlc3VsdCA6PSB7fVxyXG5cclxuXHQjIC0tLSBsUmVzdWx0cyBhcmUgaW4gdGhlIHNhbWUgb3JkZXIgYXMgbFBhdGhzXHJcblx0bGV0IGhhc0ZhaWxlZCA9IGZhbHNlXHJcblx0Zm9yIHJlcyxpIG9mIGxSZXN1bHRzXHJcblx0XHRwYXRoIDo9IGxQYXRoc1tpXVxyXG5cdFx0aWYgKHJlcy5zdGF0dXMgPT0gJ2Z1bGZpbGxlZCcpXHJcblx0XHRcdGhTdWNjZWVkZWRbcGF0aF0gPSByZXMudmFsdWVcclxuXHRcdGVsc2VcclxuXHRcdFx0aGFzRmFpbGVkID0gdHJ1ZVxyXG5cdFx0XHRoRmFpbGVkW3BhdGhdID0gcmVzLnJlYXNvblxyXG5cclxuXHRyZXR1cm4gW1xyXG5cdFx0aFN1Y2NlZWRlZCxcclxuXHRcdGhhc0ZhaWxlZCA/IGhGYWlsZWQgOiB1bmRlZlxyXG5cdFx0XVxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbnR5cGUgVEZpbGVSdW5uZXIgPSAoXHJcblx0XHRzdHViOiBzdHJpbmdcclxuXHRcdHB1cnBvc2U6IHN0cmluZz9cclxuXHRcdGxBcmdzPzogc3RyaW5nW11cclxuXHRcdGhPcHRpb25zPzogaGFzaFxyXG5cdFx0KSA9PiBQcm9taXNlPHZvaWQ+XHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuZXhwb3J0IGdldFN0cmluZ09wdGlvbiA6PSAoXHJcblx0XHRoT3B0aW9uczogaGFzaFxyXG5cdFx0a2V5OiBzdHJpbmdcclxuXHRcdGRlZlZhbDogc3RyaW5nPyA9IHVuZGVmXHJcblx0XHQpOiBzdHJpbmc/ID0+XHJcblxyXG5cdGlmIGhPcHRpb25zLmhhc093blByb3BlcnR5IGtleVxyXG5cdFx0dmFsIDo9IGhPcHRpb25zW2tleV1cclxuXHRcdGFzc2VydCAodHlwZW9mIHZhbCA9PSAnc3RyaW5nJyksIFwiTm90IGEgc3RyaW5nOiAje3ZhbH1cIlxyXG5cdFx0cmV0dXJuIHZhbFxyXG5cdGVsc2VcclxuXHRcdHJldHVybiBkZWZWYWxcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgZ2V0Qm9vbGVhbk9wdGlvbiA6PSAoXHJcblx0XHRoT3B0aW9uczogaGFzaFxyXG5cdFx0a2V5OiBzdHJpbmdcclxuXHRcdGRlZlZhbDogYm9vbGVhbiA9IGZhbHNlXHJcblx0XHQpOiBib29sZWFuID0+XHJcblxyXG5cdGlmIGhPcHRpb25zLmhhc093blByb3BlcnR5IGtleVxyXG5cdFx0dmFsIDo9IGhPcHRpb25zW2tleV1cclxuXHRcdGFzc2VydCAodHlwZW9mIHZhbCA9PSAnYm9vbGVhbicpLCBcIk5vdCBhIGJvb2xlYW46ICN7dmFsfVwiXHJcblx0XHRyZXR1cm4gdmFsXHJcblx0ZWxzZVxyXG5cdFx0cmV0dXJuIGRlZlZhbFxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuIyBBU1lOQ1xyXG5cclxuZXhwb3J0IHRyeUNtZCA6PSAoXHJcblx0XHRmdW5jOiBURmlsZVJ1bm5lclxyXG5cdFx0c3R1Yjogc3RyaW5nXHJcblx0XHRwdXJwb3NlOiBzdHJpbmc/XHJcblx0XHRsQXJnczogc3RyaW5nW10gPSBbXVxyXG5cdFx0aE9wdGlvbnM6IGhhc2ggPSB7fVxyXG5cdFx0KTogdm9pZCA9PlxyXG5cclxuXHR0cnlcclxuXHRcdGF3YWl0IGZ1bmMoc3R1YiwgcHVycG9zZSwgbEFyZ3MsIGhPcHRpb25zKVxyXG5cdGNhdGNoIGVyclxyXG5cdFx0Y29uc29sZS5lcnJvciBlcnJcclxuXHRcdGlmIGdldEJvb2xlYW5PcHRpb24gaE9wdGlvbnMsICdleGl0T25GYWlsJywgdHJ1ZVxyXG5cdFx0XHREZW5vLmV4aXQoOTkpXHJcblx0XHRyZXR1cm5cclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbiMgICAgICBSVU5ORVJTIChhbGwgQVNZTkMpXHJcbiMgICAgICB3aGVuIHJ1biB1c2luZyB0cnlDbWQoKVxyXG4jICAgICAgICAgLSBmYWxzZSByZXR1cm4gd2lsbCBleGl0IHRoZSBzY3JpcHRcclxuIyAgICAgICAgIC0gZmFsc2UgcmV0dXJuIHdpbGwgY2F1c2UgYSBsb2cgbWVzc2FnZVxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4jIEFTWU5DXHJcblxyXG5leHBvcnQgY2l2ZXQydHNGaWxlIDo9IChcclxuXHRcdHN0dWI6IHN0cmluZ1xyXG5cdFx0cHVycG9zZTogc3RyaW5nP1xyXG5cdFx0KTogdm9pZCA9PlxyXG5cclxuXHRmaWxlTmFtZSA6PSBidWlsZEZpbGVOYW1lIHN0dWIsIHB1cnBvc2UsICcuY2l2ZXQnXHJcblx0TExPRyAnQ09NUElMRScsIGZpbGVOYW1lXHJcblxyXG5cdHBhdGggOj0gZmluZEZpbGUgZmlsZU5hbWVcclxuXHRhc3NlcnQgcGF0aCwgXCJObyBzdWNoIGZpbGU6ICN7ZmlsZU5hbWV9XCJcclxuXHJcblx0aWYgbmV3ZXJEZXN0RmlsZUV4aXN0cyBwYXRoLCAnLnRzJ1xyXG5cdFx0SUxPRyBcImFscmVhZHkgY29tcGlsZWRcIlxyXG5cdFx0cmV0dXJuXHJcblxyXG5cdHtzdWNjZXNzfSA6PSBhd2FpdCBleGVjQ21kICdkZW5vJywgW1xyXG5cdFx0J3J1bidcclxuXHRcdCctQSdcclxuXHRcdCducG06QGRhbmllbHgvY2l2ZXQnXHJcblx0XHQnLS1pbmxpbmUtbWFwJ1xyXG5cdFx0Jy1vJywgJy50cydcclxuXHRcdCctYycsIHBhdGhcclxuXHRcdF1cclxuXHRpZiBzdWNjZXNzXHJcblx0XHRJTE9HIFwiT0tcIlxyXG5cdGVsc2VcclxuXHRcdElMT0cgXCJGQUlMRURcIlxyXG5cdFx0cm1GaWxlIHdpdGhFeHQoZmlsZU5hbWUsICcudHMnKVxyXG5cdFx0Y3JvYWsgXCJDb21waWxlIG9mICN7ZmlsZU5hbWV9IGZhaWxlZFwiXHJcblxyXG5cdCMgLS0tIFR5cGUgY2hlY2sgdGhlICoudHMgZmlsZVxyXG5cdExPRyBcIlRZUEUgQ0hFQ0s6ICN7ZmlsZU5hbWV9XCJcclxuXHRoIDo9IGF3YWl0IGV4ZWNDbWQgJ2Rlbm8nLCBbXHJcblx0XHQnY2hlY2snLFxyXG5cdFx0d2l0aEV4dChwYXRoLCAnLnRzJylcclxuXHRcdF1cclxuXHJcblx0aWYgaC5zdWNjZXNzXHJcblx0XHRJTE9HIFwiT0tcIlxyXG5cdGVsc2VcclxuXHRcdElMT0cgXCJGQUlMRURcIlxyXG5cdFx0cm1GaWxlIHdpdGhFeHQoZmlsZU5hbWUsICcudHMnKVxyXG5cdFx0Y3JvYWsgXCJUeXBlIENoZWNrIG9mICN7ZmlsZU5hbWV9IGZhaWxlZFwiXHJcblx0cmV0dXJuXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4jIEFTWU5DXHJcblxyXG5leHBvcnQgZG9Vbml0VGVzdCA6PSAoXHJcblx0XHRzdHViOiBzdHJpbmdcclxuXHRcdHB1cnBvc2U6IHN0cmluZz8gICAgICAjIHB1cnBvc2Ugb2YgdGhlIGZpbGUgYmVpbmcgdGVzdGVkXHJcblx0XHRsQXJnczogc3RyaW5nW10gPSBbXVxyXG5cdFx0aE9wdGlvbnM6IGhhc2ggPSB7fVxyXG5cdFx0KTogdm9pZCA9PlxyXG5cclxuXHRmaWxlTmFtZSA6PSBidWlsZFRlc3RGaWxlTmFtZSBzdHViLCBwdXJwb3NlLCAnLmNpdmV0J1xyXG5cdExMT0cgXCJVTklUIFRFU1RcIiwgZmlsZU5hbWVcclxuXHJcblx0dGVzdFBhdGggOj0gZmluZEZpbGUgZmlsZU5hbWVcclxuXHRpZiBub3RkZWZpbmVkKHRlc3RQYXRoKVxyXG5cdFx0SUxPRyBcIlRoZXJlIGlzIG5vIHVuaXQgdGVzdCBmb3IgI3tmaWxlTmFtZX1cIlxyXG5cdFx0cmV0dXJuXHJcblx0REJHIFwiVEVTVCBGSUxFOiAje3JlbHBhdGgodGVzdFBhdGgpfVwiXHJcblxyXG5cdGlmIG5vdCBuZXdlckRlc3RGaWxlRXhpc3RzKHRlc3RQYXRoLCAnLnRzJylcclxuXHRcdExMT0cgJ0NPTVBJTEUnLCByZWxwYXRoKHRlc3RQYXRoKVxyXG5cdFx0e3N1Y2Nlc3N9IDo9IGF3YWl0IGV4ZWNDbWQgJ2Rlbm8nLCBbXHJcblx0XHRcdCdydW4nXHJcblx0XHRcdCctQSdcclxuXHRcdFx0J25wbTpAZGFuaWVseC9jaXZldCdcclxuXHRcdFx0Jy0taW5saW5lLW1hcCdcclxuXHRcdFx0Jy1vJywgJy50cydcclxuXHRcdFx0Jy1jJywgdGVzdFBhdGhcclxuXHRcdFx0XVxyXG5cdFx0YXNzZXJ0IHN1Y2Nlc3MsIFwiICAgQ29tcGlsZSBvZiAje3Rlc3RQYXRofSBmYWlsZWRcIlxyXG5cclxuXHRyZXBvcnRlciA6PSBnZXRTdHJpbmdPcHRpb24gaE9wdGlvbnMsICdyZXBvcnRlcicsICdkb3QnXHJcblx0dmVyYm9zZSA6PSBnZXRCb29sZWFuT3B0aW9uIGhPcHRpb25zLCAndmVyYm9zZSdcclxuXHRmbGFncyA6PSB2ZXJib3NlID8gJy1BJyA6ICctcUEnXHJcblx0bFN0ckFyZ3MgOj0gKFxyXG5cdFx0ICByZXBvcnRlclxyXG5cdFx0PyBbJ3Rlc3QnLCBmbGFncywgJy0tcmVwb3J0ZXInLCByZXBvcnRlciwgd2l0aEV4dCh0ZXN0UGF0aCwgJy50cycpXVxyXG5cdFx0OiBbJ3Rlc3QnLCBmbGFncywgd2l0aEV4dCh0ZXN0UGF0aCwgJy50cycpXVxyXG5cdFx0KVxyXG5cdGggOj0gYXdhaXQgZXhlY0NtZCAnZGVubycsIGxTdHJBcmdzXHJcblx0YXNzZXJ0IGguc3VjY2VzcywgXCIgICBGQUlMRURcIlxyXG5cdHJldHVyblxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuIyBBU1lOQ1xyXG5cclxuZXhwb3J0IGRvSW5zdGFsbENtZCA6PSAoXHJcblx0XHRzdHViOiBzdHJpbmcsXHJcblx0XHRwdXJwb3NlOiBzdHJpbmc/ID0gJ2NtZCdcclxuXHRcdGxBcmdzOiBzdHJpbmdbXSA9IFtdXHJcblx0XHRoT3B0aW9uczogaGFzaCA9IHt9XHJcblx0XHQpOiB2b2lkID0+XHJcblxyXG5cdGZpbGVOYW1lIDo9IGJ1aWxkRmlsZU5hbWUgc3R1YiwgcHVycG9zZSwgJy50cydcclxuXHRMT0cgXCJJTlNUQUxMIENNRDogI3tmaWxlTmFtZX1cIlxyXG5cclxuXHRwYXRoIDo9IGZpbmRGaWxlIGZpbGVOYW1lXHJcblx0YXNzZXJ0IHBhdGgsIFwiTm8gc3VjaCBmaWxlOiAje2ZpbGVOYW1lfVwiXHJcblxyXG5cdG5hbWUgOj0gKFxyXG5cdFx0ICAgZ2V0U3RyaW5nT3B0aW9uKGhPcHRpb25zLCAnbmFtZScpXHJcblx0XHR8fCBwYXJzZVBhdGgocGF0aCkuc3R1YlxyXG5cdFx0KVxyXG5cdGggOj0gYXdhaXQgZXhlY0NtZCAnZGVubycsIFtcclxuXHRcdCdpbnN0YWxsJyxcclxuXHRcdCctZmdBJyxcclxuXHRcdCctbicsIG5hbWUsXHJcblx0XHQnLS1uby1jb25maWcnLFxyXG5cdFx0Jy0taW1wb3J0LW1hcCcsICdpbXBvcnRfbWFwLmpzb25jJyxcclxuXHRcdHBhdGhcclxuXHRcdF1cclxuXHRhc3NlcnQgaC5zdWNjZXNzLCBcIiAgIEZBSUxFRFwiXHJcblx0TE9HIFwiICAgT0tcIlxyXG5cdHJldHVyblxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuIyBBU1lOQ1xyXG5cclxuZXhwb3J0IGRvUnVuIDo9IChcclxuXHRcdHN0dWI6IHN0cmluZ1xyXG5cdFx0cHVycG9zZTogc3RyaW5nP1xyXG5cdFx0bEFyZ3M6IHN0cmluZ1tdID0gW11cclxuXHRcdGhPcHRpb25zOiBoYXNoID0ge31cclxuXHRcdCk6IHZvaWQgPT5cclxuXHJcblx0ZmlsZU5hbWUgOj0gYnVpbGRGaWxlTmFtZSBzdHViLCBwdXJwb3NlLCAnLnRzJ1xyXG5cdExPRyBjZW50ZXJlZChcIlJVTjogI3tmaWxlTmFtZX1cIiwgNjQsICctJylcclxuXHJcblx0cGF0aCA6PSBmaW5kRmlsZSBmaWxlTmFtZVxyXG5cdGFzc2VydCBwYXRoLCBcIk5vIHN1Y2ggZmlsZTogI3tmaWxlTmFtZX1cIlxyXG5cclxuXHRoIDo9IChcclxuXHRcdCAgZ2V0Qm9vbGVhbk9wdGlvbihoT3B0aW9ucywgJ2RlYnVnJylcclxuXHRcdD8gYXdhaXQgZXhlY0NtZCAnZGVubycsIFtcclxuXHRcdFx0J3J1bidcclxuXHRcdFx0Jy1BJ1xyXG5cdFx0XHQnLS1pbnNwZWN0LWJyaydcclxuXHRcdFx0cGF0aFxyXG5cdFx0XHQnLS0nXHJcblx0XHRcdGxBcmdzLi4uXHJcblx0XHRcdF1cclxuXHRcdDogYXdhaXQgZXhlY0NtZCAnZGVubycsIFtcclxuXHRcdFx0J3J1bidcclxuXHRcdFx0Jy1BJ1xyXG5cdFx0XHRwYXRoXHJcblx0XHRcdCctLSdcclxuXHRcdFx0bEFyZ3MuLi5cclxuXHRcdFx0XVxyXG5cdFx0KVxyXG5cdGFzc2VydCBoLnN1Y2Nlc3MsIFwiICAgRkFJTEVEXCJcclxuXHRyZXR1cm5cclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgc2VwIDo9IChcclxuXHRcdHdpZHRoOiBudW1iZXIgPSA2NFxyXG5cdFx0Y2hhcjogc3RyaW5nID0gJy0nXHJcblx0XHQpOiBzdHJpbmcgPT5cclxuXHJcblx0cmV0dXJuIGNoYXIucmVwZWF0KHdpZHRoKVxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuIyAtLS0gdmFsaWQgb3B0aW9uczpcclxuIyAgICAgICAgY2hhciAtIGNoYXIgdG8gdXNlIG9uIGxlZnQgYW5kIHJpZ2h0XHJcbiMgICAgICAgIGJ1ZmZlciAtIG51bSBzcGFjZXMgYXJvdW5kIHRleHQgd2hlbiBjaGFyIDw+ICcgJ1xyXG5cclxuZXhwb3J0IGNlbnRlcmVkIDo9IChcclxuXHR0ZXh0OiBzdHJpbmcsXHJcblx0d2lkdGg6IG51bWJlcixcclxuXHRjaGFyOiBzdHJpbmcgPSAnICcsXHJcblx0bnVtQnVmZmVyOiBudW1iZXIgPSAyXHJcblx0KTogc3RyaW5nID0+XHJcblxyXG5cdHRvdFNwYWNlcyA6PSB3aWR0aCAtIHRleHQubGVuZ3RoXHJcblx0aWYgKHRvdFNwYWNlcyA8PSAwKVxyXG5cdFx0cmV0dXJuIHRleHRcclxuXHRudW1MZWZ0IDo9IE1hdGguZmxvb3IodG90U3BhY2VzIC8gMilcclxuXHRudW1SaWdodCA6PSB0b3RTcGFjZXMgLSBudW1MZWZ0XHJcblx0aWYgKGNoYXIgPT0gJyAnKVxyXG5cdFx0cmV0dXJuICcgJy5yZXBlYXQobnVtTGVmdCkgKyB0ZXh0ICsgJyAnLnJlcGVhdChudW1SaWdodClcclxuXHRlbHNlXHJcblx0XHRidWYgOj0gJyAnLnJlcGVhdChudW1CdWZmZXIpXHJcblx0XHRsZWZ0IDo9IGNoYXIucmVwZWF0KG51bUxlZnQgLSBudW1CdWZmZXIpXHJcblx0XHRyaWdodCA6PSBjaGFyLnJlcGVhdChudW1SaWdodCAtIG51bUJ1ZmZlcilcclxuXHRcdHJldHVybiBsZWZ0ICsgYnVmICsgdGV4dCArIGJ1ZiArIHJpZ2h0XHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuZXhwb3J0IGxBbGxMaWJzIDo9IFtcclxuXHQnYmFzZS11dGlscycsICdkYXRhdHlwZXMnLCAnbGx1dGlscycsICdpbmRlbnQnLCAndW5pY29kZScsXHJcblx0J2xvZy1sZXZlbHMnLCAnbG9nLWZvcm1hdHRlcicsICdsb2dnZXInLCAndGV4dC10YWJsZScsXHJcblxyXG5cdCdwYXJzZXInLCAnY21kLWFyZ3MnLFxyXG5cdCd3YWxrZXInLCAnZnN5cycsICdwbGwnLCAnZXhlYycsICduaWNlJ1xyXG5cclxuXHQnc3ltYm9scycsICd0eXBlc2NyaXB0JywgJ2NpdmV0JywgJ2NpZWxvJywgJ2F1dG9tYXRlJyxcclxuXHQnc291cmNlLW1hcCcsICd2OC1zdGFjaycsICd1bml0LXRlc3QnLFxyXG5cdF1cclxuIl19