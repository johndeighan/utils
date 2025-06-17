"use strict";
// fs.lib.civet

type AutoPromise<T> = Promise<Awaited<T>>;
import {sprintf} from "@std/fmt/printf"
import {debounce} from '@std/async/debounce'
import {
	existsSync, emptyDirSync, ensureDirSync,
	} from '@std/fs'
import {
	appendFileSync,
	} from 'node:fs'
import {EventEmitter} from 'node:events'

// --- Deno's statSync and lstatSync are still unstable,
//     so use this
import {statSync} from 'node:fs'

import {expandGlobSync} from '@std/fs/expand-glob'
import {TextLineStream} from '@std/streams'

// --- Use Deno's path library
import {
	parse, resolve, relative, fromFileUrl,
	} from '@std/path'

import {
	undef, defined, notdefined, assert, isEmpty, nonEmpty,
	isString, isNonEmptyString, isBoolean, isNumber, isInteger,
	isArray, isArrayOfStrings, isHash, isObject, isRegExp,
	integer, hash, voidFunc,
	} from './datatypes.lib.ts'
import {
	croak, OL, ML, getOptions, removeEmptyKeys, pass, hasKey,
	spaces, sinceLoadStr, sleep, relpath,
	getImportSync, require,
	} from './llutils.lib.ts'
import {
	pushLogLevel, popLogLevel, DBG, DBGVALUE, ERR,
	INDENT, UNDENT,
	} from './logger.lib.ts'
import {TextTable} from './text-table.lib.ts'
import {indented} from './indent.lib.ts'
import {
	TPLLToken, allTokensInBlock, tokenTable,
	} from './pll.lib.ts'
import {
	civet2tsFile,
	} from './civet.lib.ts'

export {relpath}

/**
 * @module fs - file system utilities
 */

// --- Create a function capable of synchronously
//     importing ESM modules

const Deno = globalThis.Deno

// --- not exported
const decoder = new TextDecoder('utf-8')
const encoder = new TextEncoder()

// ---------------------------------------------------------------------------

/**
 * returns a boolean indicating if the given path exists
 * and is a file
 */

export const isFile = (path: string): boolean => {

	return existsSync(path) && statSync(path).isFile()
}

// ---------------------------------------------------------------------------

/**
 * returns a boolean indicating of the given path exists
 * and is a directory
 */

export const isDir = (path: string): boolean => {

	return existsSync(path) && statSync(path).isDirectory()
}

// ---------------------------------------------------------------------------

/**
 * returns one of:
 *    'missing'  - does not exist
 *    'dir'      - is a directory
 *    'file'     - is a file
 *    'symlink'  - is a symlink
 *    'unknown'  - exists, but not a file, directory or symlink
 */

export type TPathType =
	'missing' | 'file' | 'dir' | 'symlink' | 'unknown'

export const getPathType = (path: string): TPathType => {

	assert(isString(path), `not a string: ${OL(path)}`)
	if (!existsSync(path)) {
		return 'missing'
	}
	const h = statSync(path)
	return (
		  h.isFile()         ? 'file'
		: h.isDirectory()    ? 'dir'
		: h.isSymbolicLink() ? 'symlink'
		:                      'unknown'
		)
}

// ---------------------------------------------------------------------------

/**
 * extract the file extension from a path, including
 * the leading period
 */

export const fileExt = (path: string): string => {

	let ref;if ((ref = path.match(/\.[^\.]+$/))) {const lMatches = ref;
		return lMatches[0]
	}
	else {
		return ''
	}
}

// ---------------------------------------------------------------------------

/**
 * return the given path, but with the given file extension
 * replacing the existing file extension
 */

export const withExt = (path: string, ext: string): string => {

	assert(isNonEmptyString(path), `path = ${OL(path)}`)
	assert(ext.startsWith('.'), `Bad file extension: ${ext}`)
	const lMatches = path.match(/^(.*)(\.[^\.]+)$/)
	if (lMatches === null) {
		throw new Error(`Bad path: '${path}'`)
	}
	const [_, headStr, orgExt] = lMatches
	return `${headStr}${ext}`
}

// ---------------------------------------------------------------------------

export const lStatFields: string[] = [
	'dev','ino','mode','nlink','uid','gid','rdev',
	'size','blksize','blocks',
	'atimeMs','mtimeMs','ctimeMs','birthtimeMs',
	'atime','mtime','ctime','birthtime',
	]

/**
 * return statistics for a file or directory
 */

export const getStats = (path: string): hash => {

	return statSync(path)
}

// ---------------------------------------------------------------------------

export const isStub = (str: string): boolean => {

	// --- a stub cannot contain any of '\\', '/'
	return notdefined(str.match(/[\\\/]/)) && (str[0] !== '.')
}

// ---------------------------------------------------------------------------

/**
 * parses a path or file URL, and returns a hash with keys:
 * 	type: TPathType - 'file','dir','symlink','missing' or 'unknown'
 * 	path: string
 * 	root: string
 * 	dir: string
 * 	fileName: string
 * 	stub: string?
 * 	purpose: string?
 * 	ext: string?
 * 	relPath: string
 * 	relDir: string
 */

export type TPathInfo = {
	type: TPathType  // 'file','dir','symlink','missing' or 'unknown'
	path: string
	root: string
	dir: string
	fileName: string
	stub: (string | undefined)
	purpose: (string | undefined)
	ext: (string | undefined)
	relPath: string
	relDir: string
	}

export const parsePath = (path: string): TPathInfo => {

	// --- NOTE: path may be a file URL, e.g. import.meta.url
	//           path may be a relative path

	assert(isNonEmptyString(path), `path not a string ${OL(path)}`)
	if (defined(path.match(/^file\:\/\//))) {
		path = fromFileUrl(path)
	}
	path = mkpath(path)

	const {root, dir, base: fileName} = parse(path)

	const lParts = fileName.split('.')
	let ref1;switch(lParts.length) {
		case 0: {
			ref1 = croak("Can't happen");break;
		}
		case 1: {
			ref1 = [fileName, undef, undef];break;
		}
		case 2: {
			ref1 = [lParts[0], undef, `.${lParts[1]}`];break;
		}
		default: {
			ref1 = [
				lParts.slice(0, -2).join('.'),
				lParts.at(-2),
				`.${lParts.at(-1)}`
				]
		}
	};const [stub, purpose, ext] =ref1

	// --- Grab everything up until the last path separator, if any
	const relPath = relpath(path)
	const lPathMatches = relPath.match(/^(.*)[\\\/][^\\\/]*$/)
	const relDir = (lPathMatches === null) ? '.' : lPathMatches[1]

	return {
		type: getPathType(path),
		path,
		root,
		dir,
		fileName,
		stub,
		purpose,
		ext,
		relPath,
		relDir
		}
}

// ---------------------------------------------------------------------------
// GENERATOR

/**
 * generate files that match a given glob pattern
 * yields a hash with keys:
 *    type     - 'file', 'dir', 'symlink', 'unknown'
 *    root     - e.g. 'C:/'
 *    fileName
 *    stub
 *    purpose
 *    ext
 *    relPath   - relative to working dir, no leading . or ..
 * These options may be specified in the 2nd parameter:
 *    root: string - root of search, (def: Deno.cwd())
 *    lExclude: [string] - patterns to exclude,
 *    	def: ['node_modules/**', '.git/**']
 *    includeDirs: boolean - should directories be included? (def: true)
 * 	followSymlinks - boolean - should sym links be followed? (def: false)
 * 	canonicalize: boolean - if followsymlinks is true, should
 * 		paths be canonicalized? (def: true)
 * 	filter: (string => any?) - ignore if undef returned,
 *       else yield the returned value
 *
 * Glob pattern:
 * 	*         match any number of chars, except path separator
 * 	**        match zero or more directories
 * 	?         match any single char, except path separator
 * 	/         path separator
 * 	[abc]     match one char in the brackets
 * 	[!abc]    match one char not in the brackets
 * 	{abc,123} comma-separated list of literals to match
 */

export const allFilesMatching = function*(
	pattern: string='**',
	hOptions: hash={}
	): Generator<any, void, void> {

	const {
		root,
		lExclude,
		includeDirs,
		followSymlinks,
		canonicalize,
		filter,
		debug
		} = getOptions(hOptions, {
			root: undef,
			lExclude: [
				'node_modules/**',
				'.git/**',
				'**/*.temp.*'
				],
			includeDirs: false,
			followSymlinks: false,
			canonicalize: false,
			filter: undef,
			debug: false
			})

	const hGlobOptions = {
		root,
		exclude: lExclude,
		includeDirs,
		followSymlinks,
		canonicalize
		}

	const DBG = (msg: string): void => {
		if (debug) {
			console.log(msg)
		}
		return
	}

	for (const h of expandGlobSync(pattern, hGlobOptions)) {
		// --- h has keys: path, name, isFile, isDirectory, isSymLink

		DBG(`MATCH: ${h.path}`)
		const type = (
			  h.isFile      ? 'file'
			: h.isDirectory ? 'dir'
			: h.isSymlink   ? 'symlink'
			:                 'unknown'
			)
		const hFile = parsePath(h.path)
		if (notdefined(filter)) {
			DBG("   - no filter")
			yield hFile
		}
		else {
			const result: (any | undefined) = filter(hFile)
			if (notdefined(result)) {
				DBG("   - excluded by filter")
			}
			else {
				DBG("   - allowed by filter")
				yield result
			}
		}
	}
	return
}

// ---------------------------------------------------------------------------
// ASYNC GENERATOR

/**
 * An async iterable - yields every line in the given file
 *
 * Usage:
 *   for await line of allLinesIn('src/lib/temp.civet')
 * 	  console.log "LINE: #{line}"
 *   console.log "DONE"
 */

export const allLinesIn = async function*(
	path: string
	): AsyncGenerator<string, void, void> {

	assert(isFile(path), `No such file: ${OL(path)} (allLinesIn)`)
	const f = await Deno.open(path)
	const readable = f.readable
		.pipeThrough(new TextDecoderStream())
		.pipeThrough(new TextLineStream())

	for await (const line of readable) {
		yield line
	}
	return
}

// ---------------------------------------------------------------------------

/**
 * converts all backslash characters to forward slashes
 * upper-cases drive letters
 */

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

export const pathToURL = (...lParts: string[]): string => {

	const path = resolve(...lParts)
	return new URL('file://' + path).href
}

// ---------------------------------------------------------------------------

/**
 * resolves multiple path parts to a single path
 * returns normalized path
 */

export const mkpath = (...lParts: string[]): string => {

	const path = resolve(...lParts)
	return normalizePath(path)
}

// ---------------------------------------------------------------------------

export type TPathDesc = {
	dir: string
	root: string
	lParts: string[]
	}

/**
 * returns {dir, root, lParts} where lParts includes the names of
 * all directories between the root and the file name
 * relative to the current working directory
 */

export const pathSubDirs = (path: string, hOptions: hash={}): TPathDesc => {

	const {relative} = getOptions(hOptions, {
		relative: false
		})
	path = relative ? relpath(path) : mkpath(path)
	const {root, dir} = parse(path)
	return {
		dir,
		root,
		lParts: dir.slice(root.length).split(/[\\\/]/)
		}
}

// ---------------------------------------------------------------------------
// --- Should be called like: myself(import.meta.url)
//     returns full path of current file

export const myself = (url: string): string => {

	return relpath(fromFileUrl(url))
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------

/**
 * read a file into a string
 */

export const slurp = (path: string): string => {

	assert(isFile(path), `No such file: ${resolve(path)} (slurp)`)
	const data = Deno.readFileSync(path)
	return decoder.decode(data).replaceAll('\r', '')
}

// ---------------------------------------------------------------------------

/**
 * write a string to a file
 * will ensure that all necessary directories exist
 */

export const barf = (
		path: string,
		contents: string,
		hOptions: hash = {}
		): void => {

	const {append} = getOptions(hOptions, {
		append: false
		})
	mkDirsForFile(path)
	const data = encoder.encode(contents)
	if (append && isFile(path)) {
		appendFileSync(path, data)
	}
	else {
		Deno.writeFileSync(path, data)
	}
	return
}

// ---------------------------------------------------------------------------

export const barfTempFile = (
		contents: string,
		hOptions: hash = {}
		): string => {

	const {ext} = getOptions(hOptions, {
		ext: '.civet'
		})
	const tempFilePath = Deno.makeTempFileSync({suffix: ext})
	barf(tempFilePath, contents)
	return tempFilePath
}


// ---------------------------------------------------------------------------

export const newerDestFileExists = (
	srcPath: string,
	destPath: string
	): boolean => {

	assert(isFile(srcPath), `No such file: ${OL(srcPath)} (newerDestFileExists)`)
	if (!existsSync(destPath)) {
		return false
	}
	const srcModTime = statSync(srcPath).mtimeMs
	const destModTime = statSync(destPath).mtimeMs
	return (destModTime > srcModTime)
}

// ---------------------------------------------------------------------------

/**
 * create a new directory if it doesn't exist
 * if the option 'clear' is set to a true value in the 2nd parameter
 * and the directory already exists, it is cleared
 */

export const mkDir = (
		dirPath: string,
		clear: boolean=false
		): void => {

	if (clear) {
		emptyDirSync(dirPath)
	}    // --- creates if it doesn't exist
	else {
		ensureDirSync(dirPath)
	}
	return
}

// ---------------------------------------------------------------------------

/**
 * remove a file from the file system, but do nothing
 * if the file does not exist
 */

export const rmFile = (path: string): void => {

	if (existsSync(path)) {
		Deno.removeSync(path)
	}
	return
}

// ---------------------------------------------------------------------------

/**
 * remove a directory from the file system, but do nothing
 * if the directory does not exist
 * NOTE: You must pass the 'clear' option if the directory
 *       is not empty
 */

export const rmDir = (path: string, hOptions: hash={}): void => {

	const {clear} = getOptions(hOptions, {
		clear: false
		})
	if (existsSync(path)) {
		if (clear) {
			Deno.removeSync(path, {recursive: true})
		}
		else {
			Deno.removeSync(path)
		}
	}
	return
}

// ---------------------------------------------------------------------------

/**
 * create any missing directories in the given path
 */

export const mkDirsForFile = (path: string): void => {

	const {root, lParts} = pathSubDirs(path)
	let dir = root
	for (const part of lParts) {
		dir += `/${part}`
		if (!isDir(dir)) {
			mkDir(dir)
		}
	}
	return
}

// ---------------------------------------------------------------------------

/**
 * deletes all files and subdirectories in the given directory
 */

export const clearDir = (dirPath: string): void => {

	emptyDirSync(dirPath)
	return
}

// ---------------------------------------------------------------------------
// --- hOptions gets passed to allFilesMatching()

export const removeFilesMatching = (
	pattern: string,
	hOptions: hash={}
	): void => {

	assert((pattern !== '*') && (pattern !== '**'),
		`Can't delete files matching ${OL(pattern)}`)
	for (const {relPath} of allFilesMatching(pattern, hOptions)) {
		Deno.removeSync(relPath)
	}
	return
}

// ---------------------------------------------------------------------------

export const removeFilesExcept = (
	pattern: string,
	lKeep: string[],
	hOptions: hash = {}
	): void => {

	const {debug} = getOptions(hOptions, {
		debug: false
		})
	const DBG = (msg: string): void => {
		if (debug) {
			console.log(msg)
		}
		return
	}

	// --- truthy return means remove it
	const filter = (hFile: TPathInfo): (TPathInfo | undefined) => {
		const {type, relPath} = hFile
		if (type !== 'file') {
			return undef
		}
		const removeFile = !lKeep.includes(relPath)
		DBG(`filter(${relPath}): removeFile = ${removeFile}`)
		return removeFile ? hFile : undef
	}

	const h: hash = {filter, debug}
	for (const {relPath} of allFilesMatching(pattern, h)) {
		DBG(`REMOVE FILE ${relPath}`)
		Deno.removeSync(relPath)
	}
	return
}

// ---------------------------------------------------------------------------

export type TFsChangeType = {
	kind: string
	path: string
	ms?: number
	}

/**
 * type TFsCallbackFunc - a function taking (type, path) and optionally
 * returns a function reference to be called on file changes
 */

export type TFsCallbackFunc = (change: TFsChangeType) => void

/**
 * class FileEventHandler
 *    handles file changed events when .handle({kind, path}) is called
 *    callback is a function, debounced by 200 ms
 *       that takes (type, path) and returns a voidFunc
 *       which will be called if the callback returns a function reference
 * [unit tests](../test/fs.test.civet#:~:text=%23%20%2D%2D%2D%20class%20FileEventHandler)
 */

export class FileEventHandler {

	callback: (TFsCallbackFunc | undefined)
	readonly lChanges: TFsChangeType[] = []
	hHandlers: hash = {}   // --- path => event type => debounced handler
	onStop: () => void = pass
	ms: number
	debug: boolean

	constructor(
			callback1: (TFsCallbackFunc | undefined)=undef,
			hOptions: hash={}
			) {

		this.callback = callback1;

		const {
			debug: debug1,
			onStop: onStop1,
			ms: ms1
			} = getOptions(hOptions, {
				debug: false,
				onStop: pass,
				ms: 200
				});this.debug = debug1;this.onStop = onStop1;this.ms = ms1;
		this.DBG("FileEventHandler constructor() called")
	}

	// --- Calls a function of type () => void
	//     but is debounced by @ms ms

	handle(change: TFsChangeType): void {
		const {kind, path} = change
		this.DBG(`HANDLE: [${sinceLoadStr()}] ${kind} ${path}`)
		if (notdefined(this.hHandlers?.[path])) {
			this.DBG(`Create handler for '${path}'`, 1)
			this.hHandlers[path] = {}
		}

		if (notdefined(this.hHandlers?.[path]?.[kind])) {
			this.DBG(`Create handler for ${kind} ${path}`, 1)
			const func = () => {
				if (this.callback) {
					this.callback({kind, path})
				}
				this.lChanges.push({kind, path})
				this.hHandlers[path][kind] = undef
				return undef
			}
			this.hHandlers[path][kind] = debounce(func, this.ms)
		}
		this.DBG(`Call debounced handler for ${kind} ${path}`)
		this.hHandlers[path][kind]()
		return
	}

	// --- ASYNC!
	async getChangeList() {
		await sleep(this.ms)
		return this.lChanges
	}

	private DBG(msg: string, level: number=0): void {
		if (this.debug) {
			console.log(`   ${spaces(3*level)}- ${msg}`)
		}
		return
	}
}

// ---------------------------------------------------------------------------
// ASYNC

export type TWatcherCallbackFunc = (change: TFsChangeType) => boolean

/**
 * a function that watches for changes one or more files or directories
 *    and calls a callback function for each change.
 * If the callback returns true, watching is halted
 *
 * Usage:
 *   handler := (kind, path) => console.log path
 *   await watchFile 'temp.txt', handler
 *   await watchFile 'src/lib',  handler
 *   await watchFile ['temp.txt', 'src/lib'], handler
 */

export const watchFile = async function(
	path: string | string[],
	watcherCB: TWatcherCallbackFunc,
	hOptions: hash={}
	): AutoPromise<void> {

	const {debug, ms} = getOptions(hOptions, {
		debug: false,
		ms: 200
		})
	const DBG = (msg: string): void => {
		if (debug) {
			console.log(msg)
		}
		return
	}

	DBG(`WATCH: ${JSON.stringify(path)}`)

	const watcher = Deno.watchFs(path)

	let doStop: boolean = false

	const fsCallback: TFsCallbackFunc = ({kind, path}) => {
		const result = watcherCB({kind, path})
		DBG(`FCB: result = ${result}`)
		if (result) {
			watcher.close()
		}
		return
	}

	const handler = new FileEventHandler(fsCallback, {debug, ms})

	for await (const {kind, paths} of watcher) {
		DBG("watcher event fired")
		if (doStop) {
			DBG(`doStop = ${doStop}, Closing watcher`)
			break
		}
		for (const path of paths) {
			// --- fsCallback will be (eventually) called
			handler.handle({kind, path})
		}
	}
}

export const watchFiles = watchFile

// ---------------------------------------------------------------------------

export const allTokensInFile = function*(
		path: string
		): Generator<TPLLToken, void, void> {

	for (const tok of allTokensInBlock(slurp(path))) {
		yield tok
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
	const {debug, clear, scaffold} = getOptions(hOptions, {
		debug: false,
		clear: false,
		scaffold: false
		})

	if (!debug) {
		pushLogLevel('info')
	}
	let level: integer = 0

	const dbgEnter = (name: string, ...lArgs: any[]) => {
		const strArgs = (
			(()=>{const results=[];for (const arg of lArgs) {
				results.push(OL(arg))
			}return results})()
			).join(', ')
		DBG(`${'   '.repeat(level)}-> ${name}(${strArgs})`)
		level += 1
		return
	}

	const dbgExit = (name: string, ...lArgs: any[]) => {
		const strArgs = (
			(()=>{const results1=[];for (const arg of lArgs) {
				results1.push(OL(arg))
			}return results1})()
			).join(', ')
		level -= 1
		DBG(`${'   '.repeat(level)}<- ${name}(${strArgs})`)
		return
	}

	const dbg = (line: string) => {
		DBG(`${'   '.repeat(level)}-- ${OL(line)}`)
		return
	}

	// --- In unit tests, we just return calls made
	const lFileOps: TFileOp[] = []

	// ..........................................................

	const doMakeDir = (
			dirPath: string
			): void => {

		assert(isString(dirPath), `dirPath not a string: ${OL(dirPath)}`)
		const path = relpath(dirPath)
		if (scaffold) {
			lFileOps.push({
				funcName: 'mkDir',
				path
				})
		}
		else {
			// --- if clear option set, clear dir if it exists
			mkDir(path, clear)
		}
		return
	}

	// ..........................................................

	const doBarf = (
			filePath: string,
			contents: string
			): void => {

		const path = relpath(filePath)
		if (scaffold) {
			lFileOps.push({
				funcName: "barf",
				path,
				contents
				})
		}
		else {
			barf(path, contents)
		}
		return
	}

	// ..........................................................

	const fileHandler = (
			filePath: string,
			lTokens: TPLLToken[]
			): void => {

		dbgEnter('fileHandler', filePath)
		let ref2;if (lTokens[0].kind === 'indent') {
			lTokens.shift()
			const lLines = []
			let level = 0
			// @ts-ignore
			while ((level > 0) || (lTokens[0].kind !== 'undent')) {
				const tok = lTokens.shift()
				if (notdefined(tok)) {
					croak("No 'undent' in clock")
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
						default: {
							const line = indented(tok.str, level)
							if (isString(line)) {    // --- ALWAYS SUCCEEDS
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
			ref2 = lLines.join('\n')
		}
		else {
			ref2 = ''
		};const contents =ref2
		doBarf(filePath, contents)
		dbgExit('fileHandler', filePath)
		return
	}

	const dirHandler = (
			dirPath: string,
			lTokens: TPLLToken[]
			): void => {

		dbgEnter('dirHandler', dirPath)
		doMakeDir(dirPath)
		if ((lTokens.length > 0) && (lTokens[0].kind === 'indent')) {
			lTokens.shift()
			blockHandler(dirPath, lTokens)
			// @ts-ignore
			assert((lTokens[0].kind === 'undent'), "Missing UNDENT in dirHandler")
			lTokens.shift()
		}
		dbgExit('dirHandler', dirPath)
		return
	}

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
					if (str.startsWith('/')) {
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

export const patchFirstLine = (
		path: string,
		str: string,
		newstr: string
		): void => {

	// --- Replace str with newstr, but only on first line
	const contents = Deno.readTextFileSync(path)
	const nlPos = contents.indexOf("\n")
	const strPos = contents.indexOf(str)
	if ((strPos !== -1) && ((nlPos === -1) || (strPos < nlPos))) {
		Deno.writeTextFileSync(path, contents.replace(str, newstr))
	}
	return
}

// ---------------------------------------------------------------------------

export const configFromFile = (aPath: string): hash => {

	const {path, type, purpose, ext} = parsePath(aPath)
	assert((type === 'file'), `Not a file: ${OL(path)}`)
	assert((purpose === 'config'), `Not a config file: ${OL(path)}`)
	DBG(`GET CONFIG: path = ${OL(path)}`)

	const srcPath = (
		(ext === '.civet'?(
			civet2tsFile(path),
			withExt(path, '.ts'))
		:
			path)
		)
	DBGVALUE('srcPath', srcPath)
	const hImported = require(srcPath)
	DBGVALUE('hImported', hImported)
	const hResult = hImported?.default || hImported
	DBGVALUE("hResult", hResult)
	assert(isHash(hResult),
			`Default import in ${OL(srcPath)} not a hash: ${ML(hResult)}`)
	return hResult
}

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3JjL2xpYi9mcy5saWIuY2l2ZXQudHN4Iiwic291cmNlcyI6WyJzcmMvbGliL2ZzLmxpYi5jaXZldCJdLCJtYXBwaW5ncyI6IjtBQUFBLGVBQWM7QUFDZCxBQUFBO0FBQ0EsSyxXLHlCO0FBQUEsTUFBTSxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxDQUFDLGlCQUFpQjtBQUN2QyxBQUFBLEFBQUEsTUFBTSxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsSUFBSSxDQUFDLHFCQUFxQjtBQUM1QyxBQUFBLEFBQUEsTUFBTSxDQUFDLENBQUM7QUFDUixDQUFDLFVBQVUsQ0FBQyxDQUFDLFlBQVksQ0FBQyxDQUFDLGFBQWEsQ0FBQztBQUN6QyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsU0FBUztBQUNqQixBQUFBLEFBQUEsTUFBTSxDQUFDLENBQUM7QUFDUixDQUFDLGNBQWMsQ0FBQztBQUNoQixDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsU0FBUztBQUNqQixBQUFBLEFBQUEsTUFBTSxDQUFDLENBQUMsWUFBWSxDQUFDLENBQUMsSUFBSSxDQUFDLGFBQWE7QUFDeEMsQUFBQTtBQUNBLEFBQUEsd0RBQXVEO0FBQ3ZELEFBQUEsa0JBQWlCO0FBQ2pCLEFBQUEsQUFBQSxNQUFNLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxJQUFJLENBQUMsU0FBUztBQUNoQyxBQUFBO0FBQ0EsQUFBQSxBQUFBLE1BQU0sQ0FBQyxDQUFDLGNBQWMsQ0FBQyxDQUFDLElBQUksQ0FBQyxxQkFBcUI7QUFDbEQsQUFBQSxBQUFBLE1BQU0sQ0FBQyxDQUFDLGNBQWMsQ0FBQyxDQUFDLElBQUksQ0FBQyxjQUFjO0FBQzNDLEFBQUE7QUFDQSxBQUFBLDhCQUE2QjtBQUM3QixBQUFBLEFBQUEsTUFBTSxDQUFDLENBQUM7QUFDUixDQUFDLEtBQUssQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLFdBQVcsQ0FBQztBQUN2QyxDQUFDLENBQUMsQ0FBQyxJQUFJLENB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SWQ7QUFDUCxFQUFFLENBQUM7QUFDSCxBQUFBLENBQUMsUUFBUSxDQUFBLEFBQUMsU0FBUyxDQUFDLENBQUMsT0FBTyxDQUFBO0FBQzVCLEFBQUEsQ0FBVSxNQUFULFNBQVMsQ0FBQyxDQUFFLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQztBQUM5QixBQUFBLENBQUMsUUFBUSxDQUFBLEFBQUMsV0FBVyxDQUFDLENBQUMsU0FBUyxDQUFBO0FBQ2hDLEFBQUEsQ0FBUSxNQUFQLE9BQU8sQ0FBQyxDQUFFLENBQUMsU0FBUyxDQUFDLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxTQUFTO0FBQzNDLEFBQUEsQ0FBQyxRQUFRLENBQUEsQUFBQyxTQUFTLENBQUMsQ0FBQyxPQUFPLENBQUE7QUFDNUIsQUFBQSxDQUFDLE1BQU0sQ0FBQSxBQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQztBQUN4QixBQUFBLEdBQUcsQ0FBQyxrQkFBa0IsRUFBRSxFQUFFLENBQUMsT0FBTyxDQUFDLENBQUMsYUFBYSxFQUFFLEVBQUUsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDaEUsQUFBQSxDQUFDLE1BQU0sQ0FBQyxPO0FBQU8sQ0FBQTtBQUNmIiwibmFtZXMiOltdLCJzb3VyY2VzQ29udGVudCI6WyIjIGZzLmxpYi5jaXZldFxuXG5pbXBvcnQge3NwcmludGZ9IGZyb20gXCJAc3RkL2ZtdC9wcmludGZcIlxuaW1wb3J0IHtkZWJvdW5jZX0gZnJvbSAnQHN0ZC9hc3luYy9kZWJvdW5jZSdcbmltcG9ydCB7XG5cdGV4aXN0c1N5bmMsIGVtcHR5RGlyU3luYywgZW5zdXJlRGlyU3luYyxcblx0fSBmcm9tICdAc3RkL2ZzJ1xuaW1wb3J0IHtcblx0YXBwZW5kRmlsZVN5bmMsXG5cdH0gZnJvbSAnbm9kZTpmcydcbmltcG9ydCB7RXZlbnRFbWl0dGVyfSBmcm9tICdub2RlOmV2ZW50cydcblxuIyAtLS0gRGVubydzIHN0YXRTeW5jIGFuZCBsc3RhdFN5bmMgYXJlIHN0aWxsIHVuc3RhYmxlLFxuIyAgICAgc28gdXNlIHRoaXNcbmltcG9ydCB7c3RhdFN5bmN9IGZyb20gJ25vZGU6ZnMnXG5cbmltcG9ydCB7ZXhwYW5kR2xvYlN5bmN9IGZyb20gJ0BzdGQvZnMvZXhwYW5kLWdsb2InXG5pbXBvcnQge1RleHRMaW5lU3RyZWFtfSBmcm9tICdAc3RkL3N0cmVhbXMnXG5cbiMgLS0tIFVzZSBEZW5vJ3MgcGF0aCBsaWJyYXJ5XG5pbXBvcnQge1xuXHRwYXJzZSwgcmVzb2x2ZSwgcmVsYXRpdmUsIGZyb21GaWxlVXJsLFxuXHR9IGZyb20gJ0BzdGQvcGF0aCdcblxuaW1wb3J0IHtcblx0dW5kZWYsIGRlZmluZWQsIG5vdGRlZmluZWQsIGFzc2VydCwgaXNFbXB0eSwgbm9uRW1wdHksXG5cdGlzU3RyaW5nLCBpc05vbkVtcHR5U3RyaW5nLCBpc0Jvb2xlYW4sIGlzTnVtYmVyLCBpc0ludGVnZXIsXG5cdGlzQXJyYXksIGlzQXJyYXlPZlN0cmluZ3MsIGlzSGFzaCwgaXNPYmplY3QsIGlzUmVnRXhwLFxuXHRpbnRlZ2VyLCBoYXNoLCB2b2lkRnVuYyxcblx0fSBmcm9tICcuL2RhdGF0eXBlcy5saWIudHMnXG5pbXBvcnQge1xuXHRjcm9haywgT0wsIE1MLCBnZXRPcHRpb25zLCByZW1vdmVFbXB0eUtleXMsIHBhc3MsIGhhc0tleSxcblx0c3BhY2VzLCBzaW5jZUxvYWRTdHIsIHNsZWVwLCByZWxwYXRoLFxuXHRnZXRJbXBvcnRTeW5jLCByZXF1aXJlLFxuXHR9IGZyb20gJy4vbGx1dGlscy5saWIudHMnXG5pbXBvcnQge1xuXHRwdXNoTG9nTGV2ZWwsIHBvcExvZ0xldmVsLCBEQkcsIERCR1ZBTFVFLCBFUlIsXG5cdElOREVOVCwgVU5ERU5ULFxuXHR9IGZyb20gJy4vbG9nZ2VyLmxpYi50cydcbmltcG9ydCB7VGV4dFRhYmxlfSBmcm9tICcuL3RleHQtdGFibGUubGliLnRzJ1xuaW1wb3J0IHtpbmRlbnRlZH0gZnJvbSAnLi9pbmRlbnQubGliLnRzJ1xuaW1wb3J0IHtcblx0VFBMTFRva2VuLCBhbGxUb2tlbnNJbkJsb2NrLCB0b2tlblRhYmxlLFxuXHR9IGZyb20gJy4vcGxsLmxpYi50cydcbmltcG9ydCB7XG5cdGNpdmV0MnRzRmlsZSxcblx0fSBmcm9tICcuL2NpdmV0LmxpYi50cydcblxuZXhwb3J0IHtyZWxwYXRofVxuXG4vKipcbiAqIEBtb2R1bGUgZnMgLSBmaWxlIHN5c3RlbSB1dGlsaXRpZXNcbiAqL1xuXG4jIC0tLSBDcmVhdGUgYSBmdW5jdGlvbiBjYXBhYmxlIG9mIHN5bmNocm9ub3VzbHlcbiMgICAgIGltcG9ydGluZyBFU00gbW9kdWxlc1xuXG5EZW5vIDo9IGdsb2JhbFRoaXMuRGVub1xuXG4jIC0tLSBub3QgZXhwb3J0ZWRcbmRlY29kZXIgOj0gbmV3IFRleHREZWNvZGVyKCd1dGYtOCcpXG5lbmNvZGVyIDo9IG5ldyBUZXh0RW5jb2RlcigpXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogcmV0dXJucyBhIGJvb2xlYW4gaW5kaWNhdGluZyBpZiB0aGUgZ2l2ZW4gcGF0aCBleGlzdHNcbiAqIGFuZCBpcyBhIGZpbGVcbiAqL1xuXG5leHBvcnQgaXNGaWxlIDo9IChwYXRoOiBzdHJpbmcpOiBib29sZWFuID0+XG5cblx0cmV0dXJuIGV4aXN0c1N5bmMocGF0aCkgJiYgc3RhdFN5bmMocGF0aCkuaXNGaWxlKClcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuLyoqXG4gKiByZXR1cm5zIGEgYm9vbGVhbiBpbmRpY2F0aW5nIG9mIHRoZSBnaXZlbiBwYXRoIGV4aXN0c1xuICogYW5kIGlzIGEgZGlyZWN0b3J5XG4gKi9cblxuZXhwb3J0IGlzRGlyIDo9IChwYXRoOiBzdHJpbmcpOiBib29sZWFuID0+XG5cblx0cmV0dXJuIGV4aXN0c1N5bmMocGF0aCkgJiYgc3RhdFN5bmMocGF0aCkuaXNEaXJlY3RvcnkoKVxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKipcbiAqIHJldHVybnMgb25lIG9mOlxuICogICAgJ21pc3NpbmcnICAtIGRvZXMgbm90IGV4aXN0XG4gKiAgICAnZGlyJyAgICAgIC0gaXMgYSBkaXJlY3RvcnlcbiAqICAgICdmaWxlJyAgICAgLSBpcyBhIGZpbGVcbiAqICAgICdzeW1saW5rJyAgLSBpcyBhIHN5bWxpbmtcbiAqICAgICd1bmtub3duJyAgLSBleGlzdHMsIGJ1dCBub3QgYSBmaWxlLCBkaXJlY3Rvcnkgb3Igc3ltbGlua1xuICovXG5cbmV4cG9ydCB0eXBlIFRQYXRoVHlwZSA9XG5cdCdtaXNzaW5nJyB8ICdmaWxlJyB8ICdkaXInIHwgJ3N5bWxpbmsnIHwgJ3Vua25vd24nXG5cbmV4cG9ydCBnZXRQYXRoVHlwZSA6PSAocGF0aDogc3RyaW5nKTogVFBhdGhUeXBlID0+XG5cblx0YXNzZXJ0IGlzU3RyaW5nKHBhdGgpLCBcIm5vdCBhIHN0cmluZzogI3tPTChwYXRoKX1cIlxuXHRpZiBub3QgZXhpc3RzU3luYyBwYXRoXG5cdFx0cmV0dXJuICdtaXNzaW5nJ1xuXHRoIDo9IHN0YXRTeW5jKHBhdGgpXG5cdHJldHVybiAoXG5cdFx0ICBoLmlzRmlsZSgpICAgICAgICAgPyAnZmlsZSdcblx0XHQ6IGguaXNEaXJlY3RvcnkoKSAgICA/ICdkaXInXG5cdFx0OiBoLmlzU3ltYm9saWNMaW5rKCkgPyAnc3ltbGluaydcblx0XHQ6ICAgICAgICAgICAgICAgICAgICAgICd1bmtub3duJ1xuXHRcdClcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuLyoqXG4gKiBleHRyYWN0IHRoZSBmaWxlIGV4dGVuc2lvbiBmcm9tIGEgcGF0aCwgaW5jbHVkaW5nXG4gKiB0aGUgbGVhZGluZyBwZXJpb2RcbiAqL1xuXG5leHBvcnQgZmlsZUV4dCA6PSAocGF0aDogc3RyaW5nKTogc3RyaW5nID0+XG5cblx0aWYgbE1hdGNoZXMgOj0gcGF0aC5tYXRjaCgvXFwuW15cXC5dKyQvKVxuXHRcdHJldHVybiBsTWF0Y2hlc1swXVxuXHRlbHNlXG5cdFx0cmV0dXJuICcnXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogcmV0dXJuIHRoZSBnaXZlbiBwYXRoLCBidXQgd2l0aCB0aGUgZ2l2ZW4gZmlsZSBleHRlbnNpb25cbiAqIHJlcGxhY2luZyB0aGUgZXhpc3RpbmcgZmlsZSBleHRlbnNpb25cbiAqL1xuXG5leHBvcnQgd2l0aEV4dCA6PSAocGF0aDogc3RyaW5nLCBleHQ6IHN0cmluZyk6IHN0cmluZyA9PlxuXG5cdGFzc2VydCBpc05vbkVtcHR5U3RyaW5nKHBhdGgpLCBcInBhdGggPSAje09MKHBhdGgpfVwiXG5cdGFzc2VydCBleHQuc3RhcnRzV2l0aCgnLicpLCBcIkJhZCBmaWxlIGV4dGVuc2lvbjogI3tleHR9XCJcblx0bE1hdGNoZXMgOj0gcGF0aC5tYXRjaCgvXiguKikoXFwuW15cXC5dKykkLylcblx0aWYgKGxNYXRjaGVzID09IG51bGwpXG5cdFx0dGhyb3cgbmV3IEVycm9yKFwiQmFkIHBhdGg6ICcje3BhdGh9J1wiKVxuXHRbXywgaGVhZFN0ciwgb3JnRXh0XSA6PSBsTWF0Y2hlc1xuXHRyZXR1cm4gXCIje2hlYWRTdHJ9I3tleHR9XCJcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuZXhwb3J0IGxTdGF0RmllbGRzOiBzdHJpbmdbXSA6PSBbXG5cdCdkZXYnLCdpbm8nLCdtb2RlJywnbmxpbmsnLCd1aWQnLCdnaWQnLCdyZGV2Jyxcblx0J3NpemUnLCdibGtzaXplJywnYmxvY2tzJyxcblx0J2F0aW1lTXMnLCdtdGltZU1zJywnY3RpbWVNcycsJ2JpcnRodGltZU1zJyxcblx0J2F0aW1lJywnbXRpbWUnLCdjdGltZScsJ2JpcnRodGltZScsXG5cdF1cblxuLyoqXG4gKiByZXR1cm4gc3RhdGlzdGljcyBmb3IgYSBmaWxlIG9yIGRpcmVjdG9yeVxuICovXG5cbmV4cG9ydCBnZXRTdGF0cyA6PSAocGF0aDogc3RyaW5nKTogaGFzaCA9PlxuXG5cdHJldHVybiBzdGF0U3luYyhwYXRoKVxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG5leHBvcnQgaXNTdHViIDo9IChzdHI6IHN0cmluZyk6IGJvb2xlYW4gPT5cblxuXHQjIC0tLSBhIHN0dWIgY2Fubm90IGNvbnRhaW4gYW55IG9mICdcXFxcJywgJy8nXG5cdHJldHVybiBub3RkZWZpbmVkKHN0ci5tYXRjaCgvW1xcXFxcXC9dLykpICYmIChzdHJbMF0gIT0gJy4nKVxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKipcbiAqIHBhcnNlcyBhIHBhdGggb3IgZmlsZSBVUkwsIGFuZCByZXR1cm5zIGEgaGFzaCB3aXRoIGtleXM6XG4gKiBcdHR5cGU6IFRQYXRoVHlwZSAtICdmaWxlJywnZGlyJywnc3ltbGluaycsJ21pc3NpbmcnIG9yICd1bmtub3duJ1xuICogXHRwYXRoOiBzdHJpbmdcbiAqIFx0cm9vdDogc3RyaW5nXG4gKiBcdGRpcjogc3RyaW5nXG4gKiBcdGZpbGVOYW1lOiBzdHJpbmdcbiAqIFx0c3R1Yjogc3RyaW5nP1xuICogXHRwdXJwb3NlOiBzdHJpbmc/XG4gKiBcdGV4dDogc3RyaW5nP1xuICogXHRyZWxQYXRoOiBzdHJpbmdcbiAqIFx0cmVsRGlyOiBzdHJpbmdcbiAqL1xuXG5leHBvcnQgdHlwZSBUUGF0aEluZm8gPSB7XG5cdHR5cGU6IFRQYXRoVHlwZSAgIyAnZmlsZScsJ2RpcicsJ3N5bWxpbmsnLCdtaXNzaW5nJyBvciAndW5rbm93bidcblx0cGF0aDogc3RyaW5nXG5cdHJvb3Q6IHN0cmluZ1xuXHRkaXI6IHN0cmluZ1xuXHRmaWxlTmFtZTogc3RyaW5nXG5cdHN0dWI6IHN0cmluZz9cblx0cHVycG9zZTogc3RyaW5nP1xuXHRleHQ6IHN0cmluZz9cblx0cmVsUGF0aDogc3RyaW5nXG5cdHJlbERpcjogc3RyaW5nXG5cdH1cblxuZXhwb3J0IHBhcnNlUGF0aCA6PSAocGF0aDogc3RyaW5nKTogVFBhdGhJbmZvID0+XG5cblx0IyAtLS0gTk9URTogcGF0aCBtYXkgYmUgYSBmaWxlIFVSTCwgZS5nLiBpbXBvcnQubWV0YS51cmxcblx0IyAgICAgICAgICAgcGF0aCBtYXkgYmUgYSByZWxhdGl2ZSBwYXRoXG5cblx0YXNzZXJ0IGlzTm9uRW1wdHlTdHJpbmcocGF0aCksIFwicGF0aCBub3QgYSBzdHJpbmcgI3tPTChwYXRoKX1cIlxuXHRpZiBkZWZpbmVkKHBhdGgubWF0Y2goL15maWxlXFw6XFwvXFwvLykpXG5cdFx0cGF0aCA9IGZyb21GaWxlVXJsKHBhdGgpXG5cdHBhdGggPSBta3BhdGggcGF0aFxuXG5cdHtyb290LCBkaXIsIGJhc2U6IGZpbGVOYW1lfSA6PSBwYXJzZShwYXRoKVxuXG5cdGxQYXJ0cyA6PSBmaWxlTmFtZS5zcGxpdCgnLicpXG5cdFtzdHViLCBwdXJwb3NlLCBleHRdIDo9IHN3aXRjaCBsUGFydHMubGVuZ3RoXG5cdFx0d2hlbiAwXG5cdFx0XHRjcm9hayBcIkNhbid0IGhhcHBlblwiXG5cdFx0d2hlbiAxXG5cdFx0XHRbZmlsZU5hbWUsIHVuZGVmLCB1bmRlZl1cblx0XHR3aGVuIDJcblx0XHRcdFtsUGFydHNbMF0sIHVuZGVmLCBcIi4je2xQYXJ0c1sxXX1cIl1cblx0XHRlbHNlXG5cdFx0XHRbXG5cdFx0XHRcdGxQYXJ0cy5zbGljZSgwLCAtMikuam9pbignLicpLFxuXHRcdFx0XHRsUGFydHMuYXQoLTIpLFxuXHRcdFx0XHRcIi4je2xQYXJ0cy5hdCgtMSl9XCJcblx0XHRcdFx0XVxuXG5cdCMgLS0tIEdyYWIgZXZlcnl0aGluZyB1cCB1bnRpbCB0aGUgbGFzdCBwYXRoIHNlcGFyYXRvciwgaWYgYW55XG5cdHJlbFBhdGggOj0gcmVscGF0aCBwYXRoXG5cdGxQYXRoTWF0Y2hlcyA6PSByZWxQYXRoLm1hdGNoKC9eKC4qKVtcXFxcXFwvXVteXFxcXFxcL10qJC8pXG5cdHJlbERpciA6PSAobFBhdGhNYXRjaGVzID09IG51bGwpID8gJy4nIDogbFBhdGhNYXRjaGVzWzFdXG5cblx0cmV0dXJuIHtcblx0XHR0eXBlOiBnZXRQYXRoVHlwZShwYXRoKVxuXHRcdHBhdGhcblx0XHRyb290XG5cdFx0ZGlyXG5cdFx0ZmlsZU5hbWVcblx0XHRzdHViXG5cdFx0cHVycG9zZVxuXHRcdGV4dFxuXHRcdHJlbFBhdGhcblx0XHRyZWxEaXJcblx0XHR9XG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4jIEdFTkVSQVRPUlxuXG4vKipcbiAqIGdlbmVyYXRlIGZpbGVzIHRoYXQgbWF0Y2ggYSBnaXZlbiBnbG9iIHBhdHRlcm5cbiAqIHlpZWxkcyBhIGhhc2ggd2l0aCBrZXlzOlxuICogICAgdHlwZSAgICAgLSAnZmlsZScsICdkaXInLCAnc3ltbGluaycsICd1bmtub3duJ1xuICogICAgcm9vdCAgICAgLSBlLmcuICdDOi8nXG4gKiAgICBmaWxlTmFtZVxuICogICAgc3R1YlxuICogICAgcHVycG9zZVxuICogICAgZXh0XG4gKiAgICByZWxQYXRoICAgLSByZWxhdGl2ZSB0byB3b3JraW5nIGRpciwgbm8gbGVhZGluZyAuIG9yIC4uXG4gKiBUaGVzZSBvcHRpb25zIG1heSBiZSBzcGVjaWZpZWQgaW4gdGhlIDJuZCBwYXJhbWV0ZXI6XG4gKiAgICByb290OiBzdHJpbmcgLSByb290IG9mIHNlYXJjaCwgKGRlZjogRGVuby5jd2QoKSlcbiAqICAgIGxFeGNsdWRlOiBbc3RyaW5nXSAtIHBhdHRlcm5zIHRvIGV4Y2x1ZGUsXG4gKiAgICBcdGRlZjogWydub2RlX21vZHVsZXMvKionLCAnLmdpdC8qKiddXG4gKiAgICBpbmNsdWRlRGlyczogYm9vbGVhbiAtIHNob3VsZCBkaXJlY3RvcmllcyBiZSBpbmNsdWRlZD8gKGRlZjogdHJ1ZSlcbiAqIFx0Zm9sbG93U3ltbGlua3MgLSBib29sZWFuIC0gc2hvdWxkIHN5bSBsaW5rcyBiZSBmb2xsb3dlZD8gKGRlZjogZmFsc2UpXG4gKiBcdGNhbm9uaWNhbGl6ZTogYm9vbGVhbiAtIGlmIGZvbGxvd3N5bWxpbmtzIGlzIHRydWUsIHNob3VsZFxuICogXHRcdHBhdGhzIGJlIGNhbm9uaWNhbGl6ZWQ/IChkZWY6IHRydWUpXG4gKiBcdGZpbHRlcjogKHN0cmluZyA9PiBhbnk/KSAtIGlnbm9yZSBpZiB1bmRlZiByZXR1cm5lZCxcbiAqICAgICAgIGVsc2UgeWllbGQgdGhlIHJldHVybmVkIHZhbHVlXG4gKlxuICogR2xvYiBwYXR0ZXJuOlxuICogXHQqICAgICAgICAgbWF0Y2ggYW55IG51bWJlciBvZiBjaGFycywgZXhjZXB0IHBhdGggc2VwYXJhdG9yXG4gKiBcdCoqICAgICAgICBtYXRjaCB6ZXJvIG9yIG1vcmUgZGlyZWN0b3JpZXNcbiAqIFx0PyAgICAgICAgIG1hdGNoIGFueSBzaW5nbGUgY2hhciwgZXhjZXB0IHBhdGggc2VwYXJhdG9yXG4gKiBcdC8gICAgICAgICBwYXRoIHNlcGFyYXRvclxuICogXHRbYWJjXSAgICAgbWF0Y2ggb25lIGNoYXIgaW4gdGhlIGJyYWNrZXRzXG4gKiBcdFshYWJjXSAgICBtYXRjaCBvbmUgY2hhciBub3QgaW4gdGhlIGJyYWNrZXRzXG4gKiBcdHthYmMsMTIzfSBjb21tYS1zZXBhcmF0ZWQgbGlzdCBvZiBsaXRlcmFscyB0byBtYXRjaFxuICovXG5cbmV4cG9ydCBhbGxGaWxlc01hdGNoaW5nIDo9IChcblx0cGF0dGVybjogc3RyaW5nPScqKicsXG5cdGhPcHRpb25zOiBoYXNoPXt9XG5cdCk6IEdlbmVyYXRvcjxhbnksIHZvaWQsIHZvaWQ+IC0+XG5cblx0e1xuXHRcdHJvb3QsXG5cdFx0bEV4Y2x1ZGUsXG5cdFx0aW5jbHVkZURpcnMsXG5cdFx0Zm9sbG93U3ltbGlua3MsXG5cdFx0Y2Fub25pY2FsaXplLFxuXHRcdGZpbHRlcixcblx0XHRkZWJ1Z1xuXHRcdH0gOj0gZ2V0T3B0aW9ucyBoT3B0aW9ucywge1xuXHRcdFx0cm9vdDogdW5kZWZcblx0XHRcdGxFeGNsdWRlOiBbXG5cdFx0XHRcdCdub2RlX21vZHVsZXMvKionXG5cdFx0XHRcdCcuZ2l0LyoqJ1xuXHRcdFx0XHQnKiovKi50ZW1wLionXG5cdFx0XHRcdF1cblx0XHRcdGluY2x1ZGVEaXJzOiBmYWxzZVxuXHRcdFx0Zm9sbG93U3ltbGlua3M6IGZhbHNlXG5cdFx0XHRjYW5vbmljYWxpemU6IGZhbHNlXG5cdFx0XHRmaWx0ZXI6IHVuZGVmXG5cdFx0XHRkZWJ1ZzogZmFsc2Vcblx0XHRcdH1cblxuXHRoR2xvYk9wdGlvbnMgOj0ge1xuXHRcdHJvb3Rcblx0XHRleGNsdWRlOiBsRXhjbHVkZVxuXHRcdGluY2x1ZGVEaXJzXG5cdFx0Zm9sbG93U3ltbGlua3Ncblx0XHRjYW5vbmljYWxpemVcblx0XHR9XG5cblx0REJHIDo9IChtc2c6IHN0cmluZyk6IHZvaWQgPT5cblx0XHRpZiBkZWJ1Z1xuXHRcdFx0Y29uc29sZS5sb2cgbXNnXG5cdFx0cmV0dXJuXG5cblx0Zm9yIGggb2YgZXhwYW5kR2xvYlN5bmMocGF0dGVybiwgaEdsb2JPcHRpb25zKVxuXHRcdCMgLS0tIGggaGFzIGtleXM6IHBhdGgsIG5hbWUsIGlzRmlsZSwgaXNEaXJlY3RvcnksIGlzU3ltTGlua1xuXG5cdFx0REJHIFwiTUFUQ0g6ICN7aC5wYXRofVwiXG5cdFx0dHlwZSA6PSAoXG5cdFx0XHQgIGguaXNGaWxlICAgICAgPyAnZmlsZSdcblx0XHRcdDogaC5pc0RpcmVjdG9yeSA/ICdkaXInXG5cdFx0XHQ6IGguaXNTeW1saW5rICAgPyAnc3ltbGluaydcblx0XHRcdDogICAgICAgICAgICAgICAgICd1bmtub3duJ1xuXHRcdFx0KVxuXHRcdGhGaWxlIDo9IHBhcnNlUGF0aChoLnBhdGgpXG5cdFx0aWYgbm90ZGVmaW5lZChmaWx0ZXIpXG5cdFx0XHREQkcgXCIgICAtIG5vIGZpbHRlclwiXG5cdFx0XHR5aWVsZCBoRmlsZVxuXHRcdGVsc2Vcblx0XHRcdHJlc3VsdDogYW55PyA6PSBmaWx0ZXIoaEZpbGUpXG5cdFx0XHRpZiBub3RkZWZpbmVkKHJlc3VsdClcblx0XHRcdFx0REJHIFwiICAgLSBleGNsdWRlZCBieSBmaWx0ZXJcIlxuXHRcdFx0ZWxzZVxuXHRcdFx0XHREQkcgXCIgICAtIGFsbG93ZWQgYnkgZmlsdGVyXCJcblx0XHRcdFx0eWllbGQgcmVzdWx0XG5cdHJldHVyblxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuIyBBU1lOQyBHRU5FUkFUT1JcblxuLyoqXG4gKiBBbiBhc3luYyBpdGVyYWJsZSAtIHlpZWxkcyBldmVyeSBsaW5lIGluIHRoZSBnaXZlbiBmaWxlXG4gKlxuICogVXNhZ2U6XG4gKiAgIGZvciBhd2FpdCBsaW5lIG9mIGFsbExpbmVzSW4oJ3NyYy9saWIvdGVtcC5jaXZldCcpXG4gKiBcdCAgY29uc29sZS5sb2cgXCJMSU5FOiAje2xpbmV9XCJcbiAqICAgY29uc29sZS5sb2cgXCJET05FXCJcbiAqL1xuXG5leHBvcnQgYWxsTGluZXNJbiA6PSAoXG5cdHBhdGg6IHN0cmluZ1xuXHQpOiBBc3luY0dlbmVyYXRvcjxzdHJpbmcsIHZvaWQsIHZvaWQ+IC0+XG5cblx0YXNzZXJ0IGlzRmlsZShwYXRoKSwgXCJObyBzdWNoIGZpbGU6ICN7T0wocGF0aCl9IChhbGxMaW5lc0luKVwiXG5cdGYgOj0gYXdhaXQgRGVuby5vcGVuKHBhdGgpXG5cdHJlYWRhYmxlIDo9IGYucmVhZGFibGVcblx0XHQucGlwZVRocm91Z2gobmV3IFRleHREZWNvZGVyU3RyZWFtKCkpXG5cdFx0LnBpcGVUaHJvdWdoKG5ldyBUZXh0TGluZVN0cmVhbSgpKVxuXG5cdGZvciBhd2FpdCBsaW5lIG9mIHJlYWRhYmxlXG5cdFx0eWllbGQgbGluZVxuXHRyZXR1cm5cblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuLyoqXG4gKiBjb252ZXJ0cyBhbGwgYmFja3NsYXNoIGNoYXJhY3RlcnMgdG8gZm9yd2FyZCBzbGFzaGVzXG4gKiB1cHBlci1jYXNlcyBkcml2ZSBsZXR0ZXJzXG4gKi9cblxuZXhwb3J0IG5vcm1hbGl6ZVBhdGggOj0gKHBhdGg6IHN0cmluZyk6IHN0cmluZyA9PlxuXG5cdG5wYXRoIDo9IHBhdGgucmVwbGFjZUFsbCgnXFxcXCcsICcvJylcblx0aWYgKG5wYXRoLmNoYXJBdCgxKSA9PSAnOicpXG5cdFx0cmV0dXJuIG5wYXRoLmNoYXJBdCgwKS50b1VwcGVyQ2FzZSgpICsgbnBhdGguc3Vic3RyaW5nKDEpXG5cdGVsc2Vcblx0XHRyZXR1cm4gbnBhdGhcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuZXhwb3J0IHBhdGhUb1VSTCA6PSAobFBhcnRzLi4uOiBzdHJpbmdbXSk6IHN0cmluZyA9PlxuXG5cdHBhdGggOj0gcmVzb2x2ZShsUGFydHMuLi4pXG5cdHJldHVybiBuZXcgVVJMKCdmaWxlOi8vJyArIHBhdGgpLmhyZWZcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuLyoqXG4gKiByZXNvbHZlcyBtdWx0aXBsZSBwYXRoIHBhcnRzIHRvIGEgc2luZ2xlIHBhdGhcbiAqIHJldHVybnMgbm9ybWFsaXplZCBwYXRoXG4gKi9cblxuZXhwb3J0IG1rcGF0aCA6PSAobFBhcnRzLi4uOiBzdHJpbmdbXSk6IHN0cmluZyA9PlxuXG5cdHBhdGggOj0gcmVzb2x2ZShsUGFydHMuLi4pXG5cdHJldHVybiBub3JtYWxpemVQYXRoKHBhdGgpXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbmV4cG9ydCB0eXBlIFRQYXRoRGVzYyA9IHtcblx0ZGlyOiBzdHJpbmdcblx0cm9vdDogc3RyaW5nXG5cdGxQYXJ0czogc3RyaW5nW11cblx0fVxuXG4vKipcbiAqIHJldHVybnMge2Rpciwgcm9vdCwgbFBhcnRzfSB3aGVyZSBsUGFydHMgaW5jbHVkZXMgdGhlIG5hbWVzIG9mXG4gKiBhbGwgZGlyZWN0b3JpZXMgYmV0d2VlbiB0aGUgcm9vdCBhbmQgdGhlIGZpbGUgbmFtZVxuICogcmVsYXRpdmUgdG8gdGhlIGN1cnJlbnQgd29ya2luZyBkaXJlY3RvcnlcbiAqL1xuXG5leHBvcnQgcGF0aFN1YkRpcnMgOj0gKHBhdGg6IHN0cmluZywgaE9wdGlvbnM6IGhhc2g9e30pOiBUUGF0aERlc2MgPT5cblxuXHR7cmVsYXRpdmV9IDo9IGdldE9wdGlvbnMgaE9wdGlvbnMsIHtcblx0XHRyZWxhdGl2ZTogZmFsc2Vcblx0XHR9XG5cdHBhdGggPSByZWxhdGl2ZSA/IHJlbHBhdGgocGF0aCkgOiBta3BhdGgocGF0aClcblx0e3Jvb3QsIGRpcn0gOj0gcGFyc2UocGF0aClcblx0cmV0dXJuIHtcblx0XHRkaXJcblx0XHRyb290XG5cdFx0bFBhcnRzOiBkaXIuc2xpY2Uocm9vdC5sZW5ndGgpLnNwbGl0KC9bXFxcXFxcL10vKVxuXHRcdH1cblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiMgLS0tIFNob3VsZCBiZSBjYWxsZWQgbGlrZTogbXlzZWxmKGltcG9ydC5tZXRhLnVybClcbiMgICAgIHJldHVybnMgZnVsbCBwYXRoIG9mIGN1cnJlbnQgZmlsZVxuXG5leHBvcnQgbXlzZWxmIDo9ICh1cmw6IHN0cmluZyk6IHN0cmluZyA9PlxuXG5cdHJldHVybiByZWxwYXRoIGZyb21GaWxlVXJsKHVybClcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogcmVhZCBhIGZpbGUgaW50byBhIHN0cmluZ1xuICovXG5cbmV4cG9ydCBzbHVycCA6PSAocGF0aDogc3RyaW5nKTogc3RyaW5nID0+XG5cblx0YXNzZXJ0IGlzRmlsZShwYXRoKSwgXCJObyBzdWNoIGZpbGU6ICN7cmVzb2x2ZShwYXRoKX0gKHNsdXJwKVwiXG5cdGRhdGEgOj0gRGVuby5yZWFkRmlsZVN5bmMgcGF0aFxuXHRyZXR1cm4gZGVjb2Rlci5kZWNvZGUoZGF0YSkucmVwbGFjZUFsbCgnXFxyJywgJycpXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogd3JpdGUgYSBzdHJpbmcgdG8gYSBmaWxlXG4gKiB3aWxsIGVuc3VyZSB0aGF0IGFsbCBuZWNlc3NhcnkgZGlyZWN0b3JpZXMgZXhpc3RcbiAqL1xuXG5leHBvcnQgYmFyZiA6PSAoXG5cdFx0cGF0aDogc3RyaW5nLFxuXHRcdGNvbnRlbnRzOiBzdHJpbmcsXG5cdFx0aE9wdGlvbnM6IGhhc2ggPSB7fVxuXHRcdCk6IHZvaWQgPT5cblxuXHR7YXBwZW5kfSA6PSBnZXRPcHRpb25zIGhPcHRpb25zLCB7XG5cdFx0YXBwZW5kOiBmYWxzZVxuXHRcdH1cblx0bWtEaXJzRm9yRmlsZShwYXRoKVxuXHRkYXRhIDo9IGVuY29kZXIuZW5jb2RlKGNvbnRlbnRzKVxuXHRpZiBhcHBlbmQgJiYgaXNGaWxlKHBhdGgpXG5cdFx0YXBwZW5kRmlsZVN5bmMgcGF0aCwgZGF0YVxuXHRlbHNlXG5cdFx0RGVuby53cml0ZUZpbGVTeW5jIHBhdGgsIGRhdGFcblx0cmV0dXJuXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbmV4cG9ydCBiYXJmVGVtcEZpbGUgOj0gKFxuXHRcdGNvbnRlbnRzOiBzdHJpbmdcblx0XHRoT3B0aW9uczogaGFzaCA9IHt9XG5cdFx0KTogc3RyaW5nID0+XG5cblx0e2V4dH0gOj0gZ2V0T3B0aW9ucyBoT3B0aW9ucywge1xuXHRcdGV4dDogJy5jaXZldCdcblx0XHR9XG5cdHRlbXBGaWxlUGF0aCA6PSBEZW5vLm1ha2VUZW1wRmlsZVN5bmMge3N1ZmZpeDogZXh0fVxuXHRiYXJmIHRlbXBGaWxlUGF0aCwgY29udGVudHNcblx0cmV0dXJuIHRlbXBGaWxlUGF0aFxuXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbmV4cG9ydCBuZXdlckRlc3RGaWxlRXhpc3RzIDo9IChcblx0c3JjUGF0aDogc3RyaW5nLFxuXHRkZXN0UGF0aDogc3RyaW5nXG5cdCk6IGJvb2xlYW4gPT5cblxuXHRhc3NlcnQgaXNGaWxlKHNyY1BhdGgpLCBcIk5vIHN1Y2ggZmlsZTogI3tPTChzcmNQYXRoKX0gKG5ld2VyRGVzdEZpbGVFeGlzdHMpXCJcblx0aWYgbm90IGV4aXN0c1N5bmMoZGVzdFBhdGgpXG5cdFx0cmV0dXJuIGZhbHNlXG5cdHNyY01vZFRpbWUgOj0gc3RhdFN5bmMoc3JjUGF0aCkubXRpbWVNc1xuXHRkZXN0TW9kVGltZSA6PSBzdGF0U3luYyhkZXN0UGF0aCkubXRpbWVNc1xuXHRyZXR1cm4gKGRlc3RNb2RUaW1lID4gc3JjTW9kVGltZSlcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuLyoqXG4gKiBjcmVhdGUgYSBuZXcgZGlyZWN0b3J5IGlmIGl0IGRvZXNuJ3QgZXhpc3RcbiAqIGlmIHRoZSBvcHRpb24gJ2NsZWFyJyBpcyBzZXQgdG8gYSB0cnVlIHZhbHVlIGluIHRoZSAybmQgcGFyYW1ldGVyXG4gKiBhbmQgdGhlIGRpcmVjdG9yeSBhbHJlYWR5IGV4aXN0cywgaXQgaXMgY2xlYXJlZFxuICovXG5cbmV4cG9ydCBta0RpciA6PSAoXG5cdFx0ZGlyUGF0aDogc3RyaW5nLFxuXHRcdGNsZWFyOiBib29sZWFuPWZhbHNlXG5cdFx0KTogdm9pZCA9PlxuXG5cdGlmIGNsZWFyXG5cdFx0ZW1wdHlEaXJTeW5jIGRpclBhdGggICAgIyAtLS0gY3JlYXRlcyBpZiBpdCBkb2Vzbid0IGV4aXN0XG5cdGVsc2Vcblx0XHRlbnN1cmVEaXJTeW5jIGRpclBhdGhcblx0cmV0dXJuXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogcmVtb3ZlIGEgZmlsZSBmcm9tIHRoZSBmaWxlIHN5c3RlbSwgYnV0IGRvIG5vdGhpbmdcbiAqIGlmIHRoZSBmaWxlIGRvZXMgbm90IGV4aXN0XG4gKi9cblxuZXhwb3J0IHJtRmlsZSA6PSAocGF0aDogc3RyaW5nKTogdm9pZCA9PlxuXG5cdGlmIGV4aXN0c1N5bmMgcGF0aFxuXHRcdERlbm8ucmVtb3ZlU3luYyBwYXRoXG5cdHJldHVyblxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKipcbiAqIHJlbW92ZSBhIGRpcmVjdG9yeSBmcm9tIHRoZSBmaWxlIHN5c3RlbSwgYnV0IGRvIG5vdGhpbmdcbiAqIGlmIHRoZSBkaXJlY3RvcnkgZG9lcyBub3QgZXhpc3RcbiAqIE5PVEU6IFlvdSBtdXN0IHBhc3MgdGhlICdjbGVhcicgb3B0aW9uIGlmIHRoZSBkaXJlY3RvcnlcbiAqICAgICAgIGlzIG5vdCBlbXB0eVxuICovXG5cbmV4cG9ydCBybURpciA6PSAocGF0aDogc3RyaW5nLCBoT3B0aW9uczogaGFzaD17fSk6IHZvaWQgPT5cblxuXHR7Y2xlYXJ9IDo9IGdldE9wdGlvbnMgaE9wdGlvbnMsIHtcblx0XHRjbGVhcjogZmFsc2Vcblx0XHR9XG5cdGlmIGV4aXN0c1N5bmMgcGF0aFxuXHRcdGlmIGNsZWFyXG5cdFx0XHREZW5vLnJlbW92ZVN5bmMgcGF0aCwge3JlY3Vyc2l2ZTogdHJ1ZX1cblx0XHRlbHNlXG5cdFx0XHREZW5vLnJlbW92ZVN5bmMgcGF0aFxuXHRyZXR1cm5cblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuLyoqXG4gKiBjcmVhdGUgYW55IG1pc3NpbmcgZGlyZWN0b3JpZXMgaW4gdGhlIGdpdmVuIHBhdGhcbiAqL1xuXG5leHBvcnQgbWtEaXJzRm9yRmlsZSA6PSAocGF0aDogc3RyaW5nKTogdm9pZCA9PlxuXG5cdHtyb290LCBsUGFydHN9IDo9IHBhdGhTdWJEaXJzKHBhdGgpXG5cdGxldCBkaXIgPSByb290XG5cdGZvciBwYXJ0IG9mIGxQYXJ0c1xuXHRcdGRpciArPSBcIi8je3BhcnR9XCJcblx0XHRpZiBub3QgaXNEaXIoZGlyKVxuXHRcdFx0bWtEaXIgZGlyXG5cdHJldHVyblxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKipcbiAqIGRlbGV0ZXMgYWxsIGZpbGVzIGFuZCBzdWJkaXJlY3RvcmllcyBpbiB0aGUgZ2l2ZW4gZGlyZWN0b3J5XG4gKi9cblxuZXhwb3J0IGNsZWFyRGlyIDo9IChkaXJQYXRoOiBzdHJpbmcpOiB2b2lkID0+XG5cblx0ZW1wdHlEaXJTeW5jIGRpclBhdGhcblx0cmV0dXJuXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4jIC0tLSBoT3B0aW9ucyBnZXRzIHBhc3NlZCB0byBhbGxGaWxlc01hdGNoaW5nKClcblxuZXhwb3J0IHJlbW92ZUZpbGVzTWF0Y2hpbmcgOj0gKFxuXHRwYXR0ZXJuOiBzdHJpbmcsXG5cdGhPcHRpb25zOiBoYXNoPXt9XG5cdCk6IHZvaWQgPT5cblxuXHRhc3NlcnQgKHBhdHRlcm4gIT0gJyonKSAmJiAocGF0dGVybiAhPSAnKionKSxcblx0XHRcIkNhbid0IGRlbGV0ZSBmaWxlcyBtYXRjaGluZyAje09MKHBhdHRlcm4pfVwiXG5cdGZvciB7cmVsUGF0aH0gb2YgYWxsRmlsZXNNYXRjaGluZyhwYXR0ZXJuLCBoT3B0aW9ucylcblx0XHREZW5vLnJlbW92ZVN5bmMgcmVsUGF0aFxuXHRyZXR1cm5cblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuZXhwb3J0IHJlbW92ZUZpbGVzRXhjZXB0IDo9IChcblx0cGF0dGVybjogc3RyaW5nLFxuXHRsS2VlcDogc3RyaW5nW10sXG5cdGhPcHRpb25zOiBoYXNoID0ge31cblx0KTogdm9pZCA9PlxuXG5cdHtkZWJ1Z30gOj0gZ2V0T3B0aW9ucyBoT3B0aW9ucywge1xuXHRcdGRlYnVnOiBmYWxzZVxuXHRcdH1cblx0REJHIDo9IChtc2c6IHN0cmluZyk6IHZvaWQgPT5cblx0XHRpZiBkZWJ1Z1xuXHRcdFx0Y29uc29sZS5sb2cgbXNnXG5cdFx0cmV0dXJuXG5cblx0IyAtLS0gdHJ1dGh5IHJldHVybiBtZWFucyByZW1vdmUgaXRcblx0ZmlsdGVyIDo9IChoRmlsZTogVFBhdGhJbmZvKTogVFBhdGhJbmZvPyA9PlxuXHRcdHt0eXBlLCByZWxQYXRofSA6PSBoRmlsZVxuXHRcdGlmICh0eXBlICE9ICdmaWxlJylcblx0XHRcdHJldHVybiB1bmRlZlxuXHRcdHJlbW92ZUZpbGUgOj0gbm90IGxLZWVwLmluY2x1ZGVzKHJlbFBhdGgpXG5cdFx0REJHIFwiZmlsdGVyKCN7cmVsUGF0aH0pOiByZW1vdmVGaWxlID0gI3tyZW1vdmVGaWxlfVwiXG5cdFx0cmV0dXJuIHJlbW92ZUZpbGUgPyBoRmlsZSA6IHVuZGVmXG5cblx0aDogaGFzaCA6PSB7ZmlsdGVyLCBkZWJ1Z31cblx0Zm9yIHtyZWxQYXRofSBvZiBhbGxGaWxlc01hdGNoaW5nKHBhdHRlcm4sIGgpXG5cdFx0REJHIFwiUkVNT1ZFIEZJTEUgI3tyZWxQYXRofVwiXG5cdFx0RGVuby5yZW1vdmVTeW5jIHJlbFBhdGhcblx0cmV0dXJuXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbmV4cG9ydCB0eXBlIFRGc0NoYW5nZVR5cGUgPSB7XG5cdGtpbmQ6IHN0cmluZ1xuXHRwYXRoOiBzdHJpbmdcblx0bXM/OiBudW1iZXJcblx0fVxuXG4vKipcbiAqIHR5cGUgVEZzQ2FsbGJhY2tGdW5jIC0gYSBmdW5jdGlvbiB0YWtpbmcgKHR5cGUsIHBhdGgpIGFuZCBvcHRpb25hbGx5XG4gKiByZXR1cm5zIGEgZnVuY3Rpb24gcmVmZXJlbmNlIHRvIGJlIGNhbGxlZCBvbiBmaWxlIGNoYW5nZXNcbiAqL1xuXG5leHBvcnQgdHlwZSBURnNDYWxsYmFja0Z1bmMgPSAoY2hhbmdlOiBURnNDaGFuZ2VUeXBlKSA9PiB2b2lkXG5cbi8qKlxuICogY2xhc3MgRmlsZUV2ZW50SGFuZGxlclxuICogICAgaGFuZGxlcyBmaWxlIGNoYW5nZWQgZXZlbnRzIHdoZW4gLmhhbmRsZSh7a2luZCwgcGF0aH0pIGlzIGNhbGxlZFxuICogICAgY2FsbGJhY2sgaXMgYSBmdW5jdGlvbiwgZGVib3VuY2VkIGJ5IDIwMCBtc1xuICogICAgICAgdGhhdCB0YWtlcyAodHlwZSwgcGF0aCkgYW5kIHJldHVybnMgYSB2b2lkRnVuY1xuICogICAgICAgd2hpY2ggd2lsbCBiZSBjYWxsZWQgaWYgdGhlIGNhbGxiYWNrIHJldHVybnMgYSBmdW5jdGlvbiByZWZlcmVuY2VcbiAqIFt1bml0IHRlc3RzXSguLi90ZXN0L2ZzLnRlc3QuY2l2ZXQjOn46dGV4dD0lMjMlMjAlMkQlMkQlMkQlMjBjbGFzcyUyMEZpbGVFdmVudEhhbmRsZXIpXG4gKi9cblxuZXhwb3J0IGNsYXNzIEZpbGVFdmVudEhhbmRsZXJcblxuXHRjYWxsYmFjazogVEZzQ2FsbGJhY2tGdW5jP1xuXHRsQ2hhbmdlczogVEZzQ2hhbmdlVHlwZVtdIDo9IFtdXG5cdGhIYW5kbGVyczogaGFzaCA9IHt9ICAgIyAtLS0gcGF0aCA9PiBldmVudCB0eXBlID0+IGRlYm91bmNlZCBoYW5kbGVyXG5cdG9uU3RvcDogKCkgPT4gdm9pZCA9IHBhc3Ncblx0bXM6IG51bWJlclxuXHRkZWJ1ZzogYm9vbGVhblxuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdFx0QGNhbGxiYWNrOiBURnNDYWxsYmFja0Z1bmM/PXVuZGVmLFxuXHRcdFx0aE9wdGlvbnM6IGhhc2g9e31cblx0XHRcdClcblxuXHRcdHtcblx0XHRcdGRlYnVnOiBAZGVidWcsXG5cdFx0XHRvblN0b3A6IEBvblN0b3Bcblx0XHRcdG1zOiBAbXNcblx0XHRcdH0gOj0gZ2V0T3B0aW9ucyBoT3B0aW9ucywge1xuXHRcdFx0XHRkZWJ1ZzogZmFsc2Vcblx0XHRcdFx0b25TdG9wOiBwYXNzXG5cdFx0XHRcdG1zOiAyMDBcblx0XHRcdFx0fVxuXHRcdEBEQkcgXCJGaWxlRXZlbnRIYW5kbGVyIGNvbnN0cnVjdG9yKCkgY2FsbGVkXCJcblxuXHQjIC0tLSBDYWxscyBhIGZ1bmN0aW9uIG9mIHR5cGUgKCkgPT4gdm9pZFxuXHQjICAgICBidXQgaXMgZGVib3VuY2VkIGJ5IEBtcyBtc1xuXG5cdGhhbmRsZShjaGFuZ2U6IFRGc0NoYW5nZVR5cGUpOiB2b2lkXG5cdFx0e2tpbmQsIHBhdGh9IDo9IGNoYW5nZVxuXHRcdEBEQkcgXCJIQU5ETEU6IFsje3NpbmNlTG9hZFN0cigpfV0gI3traW5kfSAje3BhdGh9XCJcblx0XHRpZiBub3RkZWZpbmVkKEBoSGFuZGxlcnM/LltwYXRoXSlcblx0XHRcdEBEQkcgXCJDcmVhdGUgaGFuZGxlciBmb3IgJyN7cGF0aH0nXCIsIDFcblx0XHRcdEBoSGFuZGxlcnNbcGF0aF0gPSB7fVxuXG5cdFx0aWYgbm90ZGVmaW5lZChAaEhhbmRsZXJzPy5bcGF0aF0/LltraW5kXSlcblx0XHRcdEBEQkcgXCJDcmVhdGUgaGFuZGxlciBmb3IgI3traW5kfSAje3BhdGh9XCIsIDFcblx0XHRcdGZ1bmMgOj0gKCkgPT5cblx0XHRcdFx0aWYgQGNhbGxiYWNrXG5cdFx0XHRcdFx0QGNhbGxiYWNrKHtraW5kLCBwYXRofSlcblx0XHRcdFx0QGxDaGFuZ2VzLnB1c2gge2tpbmQsIHBhdGh9XG5cdFx0XHRcdEBoSGFuZGxlcnNbcGF0aF1ba2luZF0gPSB1bmRlZlxuXHRcdFx0XHRyZXR1cm4gdW5kZWZcblx0XHRcdEBoSGFuZGxlcnNbcGF0aF1ba2luZF0gPSBkZWJvdW5jZShmdW5jLCBAbXMpXG5cdFx0QERCRyBcIkNhbGwgZGVib3VuY2VkIGhhbmRsZXIgZm9yICN7a2luZH0gI3twYXRofVwiXG5cdFx0QGhIYW5kbGVyc1twYXRoXVtraW5kXSgpXG5cdFx0cmV0dXJuXG5cblx0IyAtLS0gQVNZTkMhXG5cdGdldENoYW5nZUxpc3QoKVxuXHRcdGF3YWl0IHNsZWVwIEBtc1xuXHRcdHJldHVybiBAbENoYW5nZXNcblxuXHRwcml2YXRlIERCRyhtc2c6IHN0cmluZywgbGV2ZWw6IG51bWJlcj0wKTogdm9pZFxuXHRcdGlmIEBkZWJ1Z1xuXHRcdFx0Y29uc29sZS5sb2cgXCIgICAje3NwYWNlcygzKmxldmVsKX0tICN7bXNnfVwiXG5cdFx0cmV0dXJuXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4jIEFTWU5DXG5cbmV4cG9ydCB0eXBlIFRXYXRjaGVyQ2FsbGJhY2tGdW5jID0gKGNoYW5nZTogVEZzQ2hhbmdlVHlwZSkgPT4gYm9vbGVhblxuXG4vKipcbiAqIGEgZnVuY3Rpb24gdGhhdCB3YXRjaGVzIGZvciBjaGFuZ2VzIG9uZSBvciBtb3JlIGZpbGVzIG9yIGRpcmVjdG9yaWVzXG4gKiAgICBhbmQgY2FsbHMgYSBjYWxsYmFjayBmdW5jdGlvbiBmb3IgZWFjaCBjaGFuZ2UuXG4gKiBJZiB0aGUgY2FsbGJhY2sgcmV0dXJucyB0cnVlLCB3YXRjaGluZyBpcyBoYWx0ZWRcbiAqXG4gKiBVc2FnZTpcbiAqICAgaGFuZGxlciA6PSAoa2luZCwgcGF0aCkgPT4gY29uc29sZS5sb2cgcGF0aFxuICogICBhd2FpdCB3YXRjaEZpbGUgJ3RlbXAudHh0JywgaGFuZGxlclxuICogICBhd2FpdCB3YXRjaEZpbGUgJ3NyYy9saWInLCAgaGFuZGxlclxuICogICBhd2FpdCB3YXRjaEZpbGUgWyd0ZW1wLnR4dCcsICdzcmMvbGliJ10sIGhhbmRsZXJcbiAqL1xuXG5leHBvcnQgd2F0Y2hGaWxlIDo9IChcblx0cGF0aDogc3RyaW5nIHwgc3RyaW5nW10sXG5cdHdhdGNoZXJDQjogVFdhdGNoZXJDYWxsYmFja0Z1bmMsXG5cdGhPcHRpb25zOiBoYXNoPXt9XG5cdCk6IHZvaWQgLT5cblxuXHR7ZGVidWcsIG1zfSA6PSBnZXRPcHRpb25zIGhPcHRpb25zLCB7XG5cdFx0ZGVidWc6IGZhbHNlXG5cdFx0bXM6IDIwMFxuXHRcdH1cblx0REJHIDo9IChtc2c6IHN0cmluZyk6IHZvaWQgPT5cblx0XHRpZiBkZWJ1Z1xuXHRcdFx0Y29uc29sZS5sb2cgbXNnXG5cdFx0cmV0dXJuXG5cblx0REJHIFwiV0FUQ0g6ICN7SlNPTi5zdHJpbmdpZnkocGF0aCl9XCJcblxuXHR3YXRjaGVyIDo9IERlbm8ud2F0Y2hGcyhwYXRoKVxuXG5cdGxldCBkb1N0b3A6IGJvb2xlYW4gPSBmYWxzZVxuXG5cdGZzQ2FsbGJhY2s6IFRGc0NhbGxiYWNrRnVuYyA6PSAoe2tpbmQsIHBhdGh9KSA9PlxuXHRcdHJlc3VsdCA6PSB3YXRjaGVyQ0Ioe2tpbmQsIHBhdGh9KVxuXHRcdERCRyBcIkZDQjogcmVzdWx0ID0gI3tyZXN1bHR9XCJcblx0XHRpZiByZXN1bHRcblx0XHRcdHdhdGNoZXIuY2xvc2UoKVxuXHRcdHJldHVyblxuXG5cdGhhbmRsZXIgOj0gbmV3IEZpbGVFdmVudEhhbmRsZXIoZnNDYWxsYmFjaywge2RlYnVnLCBtc30pXG5cblx0Zm9yIGF3YWl0IHtraW5kLCBwYXRoc30gb2Ygd2F0Y2hlclxuXHRcdERCRyBcIndhdGNoZXIgZXZlbnQgZmlyZWRcIlxuXHRcdGlmIGRvU3RvcFxuXHRcdFx0REJHIFwiZG9TdG9wID0gI3tkb1N0b3B9LCBDbG9zaW5nIHdhdGNoZXJcIlxuXHRcdFx0YnJlYWtcblx0XHRmb3IgcGF0aCBvZiBwYXRoc1xuXHRcdFx0IyAtLS0gZnNDYWxsYmFjayB3aWxsIGJlIChldmVudHVhbGx5KSBjYWxsZWRcblx0XHRcdGhhbmRsZXIuaGFuZGxlKHtraW5kLCBwYXRofSlcblxuZXhwb3J0IHdhdGNoRmlsZXMgOj0gd2F0Y2hGaWxlXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbmV4cG9ydCBhbGxUb2tlbnNJbkZpbGUgOj0gKFxuXHRcdHBhdGg6IHN0cmluZ1xuXHRcdCk6IEdlbmVyYXRvcjxUUExMVG9rZW4sIHZvaWQsIHZvaWQ+IC0+XG5cblx0Zm9yIHRvayBvZiBhbGxUb2tlbnNJbkJsb2NrKHNsdXJwKHBhdGgpKVxuXHRcdHlpZWxkIHRva1xuXHRyZXR1cm5cblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiMgLS0tIFVzZXMgYSByZWN1cnNpdmUgZGVzY2VudCBwYXJzZXJcblxuZXhwb3J0IHR5cGUgVEZpbGVPcCA9IHtcblx0ZnVuY05hbWU6ICdta0RpcicgfCAnYmFyZidcblx0cGF0aDogc3RyaW5nXG5cdGNvbnRlbnRzPzogc3RyaW5nXG5cdH1cblxuZXhwb3J0IHNldERpclRyZWUgOj0gKFxuXHRcdGN1cnJlbnREaXI6IHN0cmluZyxcblx0XHRjb250ZW50czogc3RyaW5nLFxuXHRcdGhPcHRpb25zOiBoYXNoID0ge31cblx0XHQpOiBURmlsZU9wW10gPT5cblxuXHQjIC0tLSBFeHRyYWN0IG9wdGlvbnNcblx0e2RlYnVnLCBjbGVhciwgc2NhZmZvbGR9IDo9IGdldE9wdGlvbnMgaE9wdGlvbnMsIHtcblx0XHRkZWJ1ZzogZmFsc2Vcblx0XHRjbGVhcjogZmFsc2Vcblx0XHRzY2FmZm9sZDogZmFsc2Vcblx0XHR9XG5cblx0aWYgbm90IGRlYnVnXG5cdFx0cHVzaExvZ0xldmVsICdpbmZvJ1xuXHRsZXQgbGV2ZWw6IGludGVnZXIgPSAwXG5cblx0ZGJnRW50ZXIgOj0gKG5hbWU6IHN0cmluZywgLi4ubEFyZ3M6IGFueVtdKSA9PlxuXHRcdHN0ckFyZ3MgOj0gKFxuXHRcdFx0Zm9yIGFyZyBvZiBsQXJnc1xuXHRcdFx0XHRPTChhcmcpXG5cdFx0XHQpLmpvaW4oJywgJylcblx0XHREQkcgXCIjeycgICAnLnJlcGVhdChsZXZlbCl9LT4gI3tuYW1lfSgje3N0ckFyZ3N9KVwiXG5cdFx0bGV2ZWwgKz0gMVxuXHRcdHJldHVyblxuXG5cdGRiZ0V4aXQgOj0gKG5hbWU6IHN0cmluZywgLi4ubEFyZ3M6IGFueVtdKSA9PlxuXHRcdHN0ckFyZ3MgOj0gKFxuXHRcdFx0Zm9yIGFyZyBvZiBsQXJnc1xuXHRcdFx0XHRPTChhcmcpXG5cdFx0XHQpLmpvaW4oJywgJylcblx0XHRsZXZlbCAtPSAxXG5cdFx0REJHIFwiI3snICAgJy5yZXBlYXQobGV2ZWwpfTwtICN7bmFtZX0oI3tzdHJBcmdzfSlcIlxuXHRcdHJldHVyblxuXG5cdGRiZyA6PSAobGluZTogc3RyaW5nKSA9PlxuXHRcdERCRyBcIiN7JyAgICcucmVwZWF0KGxldmVsKX0tLSAje09MKGxpbmUpfVwiXG5cdFx0cmV0dXJuXG5cblx0IyAtLS0gSW4gdW5pdCB0ZXN0cywgd2UganVzdCByZXR1cm4gY2FsbHMgbWFkZVxuXHRsRmlsZU9wczogVEZpbGVPcFtdIDo9IFtdXG5cblx0IyAuLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uXG5cblx0ZG9NYWtlRGlyIDo9IChcblx0XHRcdGRpclBhdGg6IHN0cmluZ1xuXHRcdFx0KTogdm9pZCA9PlxuXG5cdFx0YXNzZXJ0IGlzU3RyaW5nKGRpclBhdGgpLCBcImRpclBhdGggbm90IGEgc3RyaW5nOiAje09MKGRpclBhdGgpfVwiXG5cdFx0cGF0aCA6PSByZWxwYXRoKGRpclBhdGgpXG5cdFx0aWYgc2NhZmZvbGRcblx0XHRcdGxGaWxlT3BzLnB1c2gge1xuXHRcdFx0XHRmdW5jTmFtZTogJ21rRGlyJ1xuXHRcdFx0XHRwYXRoXG5cdFx0XHRcdH1cblx0XHRlbHNlXG5cdFx0XHQjIC0tLSBpZiBjbGVhciBvcHRpb24gc2V0LCBjbGVhciBkaXIgaWYgaXQgZXhpc3RzXG5cdFx0XHRta0RpciBwYXRoLCBjbGVhclxuXHRcdHJldHVyblxuXG5cdCMgLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLlxuXG5cdGRvQmFyZiA6PSAoXG5cdFx0XHRmaWxlUGF0aDogc3RyaW5nLFxuXHRcdFx0Y29udGVudHM6IHN0cmluZ1xuXHRcdFx0KTogdm9pZCA9PlxuXG5cdFx0cGF0aCA6PSByZWxwYXRoKGZpbGVQYXRoKVxuXHRcdGlmIHNjYWZmb2xkXG5cdFx0XHRsRmlsZU9wcy5wdXNoIHtcblx0XHRcdFx0ZnVuY05hbWU6IFwiYmFyZlwiXG5cdFx0XHRcdHBhdGhcblx0XHRcdFx0Y29udGVudHNcblx0XHRcdFx0fVxuXHRcdGVsc2Vcblx0XHRcdGJhcmYgcGF0aCwgY29udGVudHNcblx0XHRyZXR1cm5cblxuXHQjIC4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi5cblxuXHRmaWxlSGFuZGxlciA6PSAoXG5cdFx0XHRmaWxlUGF0aDogc3RyaW5nLFxuXHRcdFx0bFRva2VuczogVFBMTFRva2VuW11cblx0XHRcdCk6IHZvaWQgPT5cblxuXHRcdGRiZ0VudGVyICdmaWxlSGFuZGxlcicsIGZpbGVQYXRoXG5cdFx0Y29udGVudHMgOj0gaWYgKGxUb2tlbnNbMF0ua2luZCA9PSAnaW5kZW50Jylcblx0XHRcdGxUb2tlbnMuc2hpZnQoKVxuXHRcdFx0bExpbmVzIDo9IFtdXG5cdFx0XHRsZXQgbGV2ZWwgPSAwXG5cdFx0XHQjIEB0cy1pZ25vcmVcblx0XHRcdHdoaWxlIChsZXZlbCA+IDApIHx8IChsVG9rZW5zWzBdLmtpbmQgIT0gJ3VuZGVudCcpXG5cdFx0XHRcdHRvayA6PSBsVG9rZW5zLnNoaWZ0KClcblx0XHRcdFx0aWYgbm90ZGVmaW5lZCh0b2spXG5cdFx0XHRcdFx0Y3JvYWsgXCJObyAndW5kZW50JyBpbiBjbG9ja1wiXG5cdFx0XHRcdGVsc2Vcblx0XHRcdFx0XHRzd2l0Y2ggdG9rLmtpbmRcblx0XHRcdFx0XHRcdHdoZW4gJ2luZGVudCdcblx0XHRcdFx0XHRcdFx0bGV2ZWwgKz0gMVxuXHRcdFx0XHRcdFx0d2hlbiAndW5kZW50J1xuXHRcdFx0XHRcdFx0XHRsZXZlbCAtPSAxXG5cdFx0XHRcdFx0XHRcdGFzc2VydCAobGV2ZWwgPj0gMCksIFwiTmVnYXRpdmUgbGV2ZWwgaW4gc2V0RGlyVHJlZSgpXCJcblx0XHRcdFx0XHRcdGVsc2Vcblx0XHRcdFx0XHRcdFx0bGluZSA6PSBpbmRlbnRlZCh0b2suc3RyLCBsZXZlbClcblx0XHRcdFx0XHRcdFx0aWYgaXNTdHJpbmcobGluZSkgICAgIyAtLS0gQUxXQVlTIFNVQ0NFRURTXG5cdFx0XHRcdFx0XHRcdFx0ZGJnIGxpbmVcblx0XHRcdFx0XHRcdFx0XHRsTGluZXMucHVzaCBsaW5lXG5cblx0XHRcdCMgLS0tIEhFUkU6IChsZXZlbCA9PSAwKSBBTkQgKGxUb2tlbnNbMF0ua2luZCA9PSAndW5kZW50Jylcblx0XHRcdGFzc2VydCAobGV2ZWwgPT0gMCksIFwiYWZ0ZXIgZmlsZSBjb250ZW50cywgbGV2ZWwgPSAje09MKGxldmVsKX1cIlxuXHRcdFx0YXNzZXJ0IChsVG9rZW5zWzBdLmtpbmQgPT0gJ3VuZGVudCcpLFxuXHRcdFx0XHRcdFwiVU5ERU5UIGV4cGVjdGVkIGFmdGVyIGNvbnRlbnRzLCBnb3QgI3tPTChsVG9rZW5zWzBdKX1cIlxuXHRcdFx0bFRva2Vucy5zaGlmdCgpXG5cdFx0XHRsTGluZXMuam9pbignXFxuJylcblx0XHRlbHNlXG5cdFx0XHQnJ1xuXHRcdGRvQmFyZiBmaWxlUGF0aCwgY29udGVudHNcblx0XHRkYmdFeGl0ICdmaWxlSGFuZGxlcicsIGZpbGVQYXRoXG5cdFx0cmV0dXJuXG5cblx0ZGlySGFuZGxlciA6PSAoXG5cdFx0XHRkaXJQYXRoOiBzdHJpbmcsXG5cdFx0XHRsVG9rZW5zOiBUUExMVG9rZW5bXVxuXHRcdFx0KTogdm9pZCA9PlxuXG5cdFx0ZGJnRW50ZXIgJ2RpckhhbmRsZXInLCBkaXJQYXRoXG5cdFx0ZG9NYWtlRGlyIGRpclBhdGhcblx0XHRpZiAobFRva2Vucy5sZW5ndGggPiAwKSAmJiAobFRva2Vuc1swXS5raW5kID09ICdpbmRlbnQnKVxuXHRcdFx0bFRva2Vucy5zaGlmdCgpXG5cdFx0XHRibG9ja0hhbmRsZXIoZGlyUGF0aCwgbFRva2Vucylcblx0XHRcdCMgQHRzLWlnbm9yZVxuXHRcdFx0YXNzZXJ0IChsVG9rZW5zWzBdLmtpbmQgPT0gJ3VuZGVudCcpLCBcIk1pc3NpbmcgVU5ERU5UIGluIGRpckhhbmRsZXJcIlxuXHRcdFx0bFRva2Vucy5zaGlmdCgpXG5cdFx0ZGJnRXhpdCAnZGlySGFuZGxlcicsIGRpclBhdGhcblx0XHRyZXR1cm5cblxuXHRibG9ja0hhbmRsZXIgOj0gKGRpclBhdGg6IHN0cmluZywgbFRva2VuczogVFBMTFRva2VuW10pID0+XG5cdFx0ZGJnRW50ZXIgJ2Jsb2NrSGFuZGxlcicsIGRpclBhdGhcblx0XHR3aGlsZSAobFRva2Vucy5sZW5ndGggPiAwKSAmJiAobFRva2Vuc1swXS5raW5kICE9ICd1bmRlbnQnKVxuXHRcdFx0dG9rOiBUUExMVG9rZW4gOj0gbFRva2Vuc1swXVxuXHRcdFx0bFRva2Vucy5zaGlmdCgpXG5cdFx0XHR7a2luZCwgc3RyfSA6PSB0b2tcblx0XHRcdHN3aXRjaCBraW5kXG5cdFx0XHRcdHdoZW4gJ2luZGVudCdcblx0XHRcdFx0XHRjcm9hayBcIlVuZXhwZWN0ZWQgSU5ERU5UXCJcblx0XHRcdFx0ZWxzZVxuXHRcdFx0XHRcdGlmIHN0ci5zdGFydHNXaXRoKCcvJylcblx0XHRcdFx0XHRcdGRpckhhbmRsZXIgXCIje2RpclBhdGh9I3t0b2suc3RyfVwiLCBsVG9rZW5zXG5cdFx0XHRcdFx0ZWxzZVxuXHRcdFx0XHRcdFx0ZmlsZUhhbmRsZXIgXCIje2RpclBhdGh9LyN7dG9rLnN0cn1cIiwgbFRva2Vuc1xuXHRcdGRiZ0V4aXQgJ2Jsb2NrSGFuZGxlcidcblx0XHRyZXR1cm5cblxuXHQjIC4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi5cblxuXHRwdHlwZSA6PSBnZXRQYXRoVHlwZShjdXJyZW50RGlyKVxuXHRhc3NlcnQgKHB0eXBlID09ICdkaXInKSB8fCAocHR5cGUgPT0gJ21pc3NpbmcnKSxcblx0XHRcdFwiY3VycmVudERpciBpcyBhICN7cHR5cGV9XCJcblxuXHQjIC0tLSBDbGVhciB0aGUgZGlyZWN0b3J5IGlmIGl0IGV4aXN0c1xuXHRkb01ha2VEaXIgY3VycmVudERpclxuXG5cdGxUb2tlbnMgOj0gQXJyYXkuZnJvbShhbGxUb2tlbnNJbkJsb2NrKGNvbnRlbnRzKSlcblx0REJHIHRva2VuVGFibGUobFRva2VucylcblxuXHRibG9ja0hhbmRsZXIoY3VycmVudERpciwgbFRva2Vucylcblx0YXNzZXJ0IChsVG9rZW5zLmxlbmd0aCA9PSAwKSxcblx0XHRcdFwiVG9rZW5zIHJlbWFpbmluZyBhZnRlciBwYXJzZTogI3tPTChsVG9rZW5zKX1cIlxuXHRpZiBub3QgZGVidWdcblx0XHRwb3BMb2dMZXZlbCgpXG5cdHJldHVybiBsRmlsZU9wc1xuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG5leHBvcnQgZmlsZU9wc1RhYmxlIDo9IChsRmlsZU9wczogVEZpbGVPcFtdKTogc3RyaW5nID0+XG5cblx0dHQgOj0gbmV3IFRleHRUYWJsZShcImwgbFwiKVxuXHR0dC5mdWxsc2VwKClcblx0dHQudGl0bGUgJ0ZJTEUgT1BTJ1xuXHR0dC5mdWxsc2VwKClcblx0Zm9yIHtmdW5jTmFtZSwgcGF0aCwgY29udGVudHN9IG9mIGxGaWxlT3BzXG5cdFx0c3dpdGNoIGZ1bmNOYW1lXG5cdFx0XHR3aGVuICdta0Rpcidcblx0XHRcdFx0dHQuZGF0YSBbJ21rZGlyJywgcGF0aF1cblx0XHRcdHdoZW4gJ2JhcmYnXG5cdFx0XHRcdHR0LmRhdGEgWydiYXJmJywgcGF0aF1cblx0XHRcdFx0aWYgY29udGVudHNcblx0XHRcdFx0XHRmb3IgbGluZSBvZiBjb250ZW50cy5zcGxpdCgnXFxuJylcblx0XHRcdFx0XHRcdHR0LmRhdGEgWycnLCBsaW5lLnJlcGxhY2UoJ1xcdCcsIHNwYWNlcygzKSldXG5cdHR0LmZ1bGxzZXAoKVxuXHRyZXR1cm4gdHQuYXNTdHJpbmcoKVxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG5leHBvcnQgcGF0Y2hGaXJzdExpbmUgOj0gKFxuXHRcdHBhdGg6IHN0cmluZ1xuXHRcdHN0cjogc3RyaW5nXG5cdFx0bmV3c3RyOiBzdHJpbmdcblx0XHQpOiB2b2lkID0+XG5cblx0IyAtLS0gUmVwbGFjZSBzdHIgd2l0aCBuZXdzdHIsIGJ1dCBvbmx5IG9uIGZpcnN0IGxpbmVcblx0Y29udGVudHMgOj0gRGVuby5yZWFkVGV4dEZpbGVTeW5jIHBhdGhcblx0bmxQb3MgOj0gY29udGVudHMuaW5kZXhPZiBcIlxcblwiXG5cdHN0clBvcyA6PSBjb250ZW50cy5pbmRleE9mIHN0clxuXHRpZiAoc3RyUG9zICE9IC0xKSAmJiAoKG5sUG9zID09IC0xKSB8fCAoc3RyUG9zIDwgbmxQb3MpKVxuXHRcdERlbm8ud3JpdGVUZXh0RmlsZVN5bmMgcGF0aCwgY29udGVudHMucmVwbGFjZShzdHIsIG5ld3N0cilcblx0cmV0dXJuXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbmV4cG9ydCBjb25maWdGcm9tRmlsZSA6PSAoYVBhdGg6IHN0cmluZyk6IGhhc2ggPT5cblxuXHR7cGF0aCwgdHlwZSwgcHVycG9zZSwgZXh0fSA6PSBwYXJzZVBhdGgoYVBhdGgpXG5cdGFzc2VydCAodHlwZSA9PSAnZmlsZScpLCBcIk5vdCBhIGZpbGU6ICN7T0wocGF0aCl9XCJcblx0YXNzZXJ0IChwdXJwb3NlID09ICdjb25maWcnKSwgXCJOb3QgYSBjb25maWcgZmlsZTogI3tPTChwYXRoKX1cIlxuXHREQkcgXCJHRVQgQ09ORklHOiBwYXRoID0gI3tPTChwYXRoKX1cIlxuXG5cdHNyY1BhdGggOj0gKFxuXHRcdGlmIChleHQgPT0gJy5jaXZldCcpXG5cdFx0XHRjaXZldDJ0c0ZpbGUgcGF0aFxuXHRcdFx0d2l0aEV4dCBwYXRoLCAnLnRzJ1xuXHRcdGVsc2Vcblx0XHRcdHBhdGhcblx0XHQpXG5cdERCR1ZBTFVFICdzcmNQYXRoJywgc3JjUGF0aFxuXHRoSW1wb3J0ZWQgOj0gcmVxdWlyZShzcmNQYXRoKVxuXHREQkdWQUxVRSAnaEltcG9ydGVkJywgaEltcG9ydGVkXG5cdGhSZXN1bHQgOj0gaEltcG9ydGVkPy5kZWZhdWx0IHx8IGhJbXBvcnRlZFxuXHREQkdWQUxVRSBcImhSZXN1bHRcIiwgaFJlc3VsdFxuXHRhc3NlcnQgaXNIYXNoKGhSZXN1bHQpLFxuXHRcdFx0XCJEZWZhdWx0IGltcG9ydCBpbiAje09MKHNyY1BhdGgpfSBub3QgYSBoYXNoOiAje01MKGhSZXN1bHQpfVwiXG5cdHJldHVybiBoUmVzdWx0XG4iXX0=