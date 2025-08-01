"use strict";
// fsys.lib.civet

type AutoPromise<T> = Promise<Awaited<T>>;
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
	undef, defined, notdefined, assert, croak, isEmpty, nonEmpty,
	isString, isNonEmptyString, isBoolean, isNumber, isInteger,
	isArray, isArrayOfStrings, isHash, isObject, isRegExp,
	integer, hash, voidFunc,
	} from 'datatypes'
import {
	OL, ML, getOptions, removeEmptyKeys, pass, hasKey,
	spaces, sinceLoadStr, sleep, relpath,
	getImportSync, require,
	} from 'llutils'
import {
	pushLogLevel, popLogLevel, DBG, DBGVALUE, ERR,
	INDENT, UNDENT,
	} from 'logger'
import {TextTable} from 'text-table'
import {indented} from 'indent'
import {
	TPLLToken, allTokensInBlock, tokenTable,
	} from 'pll'

export {relpath}

/**
 * @module fs - file system utilities
 */

// --- Create a function capable of synchronously
//     importing ESM modules

const Deno = globalThis.Deno
type FsEvent = Deno.FsEvent

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

export const getStats = (path: string): Deno.FileInfo => {

	const fileInfo = Deno.statSync(path)
	return fileInfo
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

	type opt = {
		root: (string | undefined)
		lExclude: string[]
		includeDirs: boolean
		followSymlinks: boolean
		canonicalize: boolean
		filter: (Function | undefined)
		}
	const {
		root,
		lExclude,
		includeDirs,
		followSymlinks,
		canonicalize,
		filter,
		} = getOptions<opt>(hOptions, {
			root: undef,
			lExclude: [
				'node_modules/**',
				'.git/**',
				'**/*.temp.*'
				],
			includeDirs: false,
			followSymlinks: false,
			canonicalize: false,
			filter: undef
			})

	const hGlobOptions = {
		root,
		exclude: lExclude,
		includeDirs,
		followSymlinks,
		canonicalize
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

	type opt = {
		relative: boolean
		}
	const {relative} = getOptions<opt>(hOptions, {
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

	type opt = {
		append: boolean
		}
	const {append} = getOptions<opt>(hOptions, {
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

	type opt = {
		ext: string
		}
	const {ext} = getOptions<opt>(hOptions, {
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

	type opt = {
		clear: boolean
		}
	const {clear} = getOptions<opt>(hOptions, {
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

	type opt = {
		debug: boolean
		}
	const {debug} = getOptions<opt>(hOptions, {
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

/**
 * type TFsCallbackFunc - a function taking FsEvent and optionally
 * returns a function reference to be called on file changes
 */

export type TFsEventHandler = (evt: FsEvent) => void
export type TFsHandlers = {
	[path: string]: {[kind in `${FsEvent["kind"]}`]: TFsEventHandler}
	}

/**
 * class FileEventHandler
 *    handles file changed events when .handle(fsEvent) is called
 *    callback is a function, debounced by 200 ms
 *       that takes an FsEvent and returns a voidFunc
 *       which will be called if the callback returns a function reference
 * [unit tests](../test/fs.test.civet#:~:text=%23%20%2D%2D%2D%20class%20FileEventHandler)
 */

export type TFsCallbackFunc = (change: FsEvent) => void

export class FileEventHandler {

	callback: TFsCallbackFunc

	// --- Create the debounced version only once
	//     path => eventType => debounced handler
	hHandlers: TFsHandlers = {}

	onStop: () => void = pass
	ms: number

	constructor(
			callback1: TFsCallbackFunc,  // --- fsEvent => void
			hOptions: hash={}
			) {

		this.callback = callback1;

		type opt = {
			onStop: voidFunc
			ms: number
			}
		const {
			onStop: onStop1,
			ms: ms1
			} = getOptions<opt>(hOptions, {
				onStop: pass,
				ms: 200
				});this.onStop = onStop1;this.ms = ms1;
		DBG("FileEventHandler constructor() called")
	}

	// --- Calls a voidFunc
	//     but is debounced by @ms ms

	handle(fsEvent: FsEvent): void {
		const {kind, paths} = fsEvent
		DBG(`HANDLE: [${sinceLoadStr()}] ${kind} ${paths}`)

		for (const path of paths) {
			const dHandler = this.hHandlers?.[path]?.[kind]
			if (defined(dHandler)) {
				dHandler(fsEvent)
			}
			else {
				const func = (evt: FsEvent) => {
					this.callback(evt)
					return
				}

				const dfunc = debounce(func, this.ms)
				dfunc(fsEvent)
				this.hHandlers[path][kind] = dfunc
			}
		}

		return
	}
}

// ---------------------------------------------------------------------------
// ASYNC

export type TWatcherCallbackFunc = (fsEvent: FsEvent) => boolean

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

	// --- ms is milliseconds to debounce by, default is 200
	const {ms} = getOptions<{ms: number}>(hOptions, {ms: 200})

	DBG(`WATCH: ${JSON.stringify(path)}`)
	const watcher = Deno.watchFs(path)

	let doStop: boolean = false

	const fsCallback: TFsCallbackFunc = (fsEvent) => {
		const result = watcherCB(fsEvent)
		DBG(`FCB: result = ${result}`)
		if (result) {
			watcher.close()
		}
		return
	}

	const handler = new FileEventHandler(fsCallback, {ms})

	for await (const fsEvent of watcher) {
		DBG("watcher event fired")
		if (doStop) {
			DBG(`doStop = ${doStop}, Closing watcher`)
			break
		}
		for (const path of fsEvent.paths) {
			// --- fsCallback will be (eventually) called
			handler.handle(fsEvent)
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
	type opt = {
		debug: boolean
		clear: boolean
		scaffold: boolean
		}
	const {debug, clear, scaffold} = getOptions<opt>(hOptions, {
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

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3JjL2xpYi9mc3lzLmxpYi5jaXZldC50c3giLCJzb3VyY2VzIjpbInNyYy9saWIvZnN5cy5saWIuY2l2ZXQiXSwibWFwcGluZ3MiOiI7QUFBQSxpQkFBZ0I7QUFDaEIsQUFBQTtBQUNBLEssVyx5QjtBQUFBLE1BQU0sQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLElBQUksQ0FBQyxxQkFBcUI7QUFDNUMsQUFBQSxBQUFBLE1BQU0sQ0FBQyxDQUFDO0FBQ1IsQ0FBQyxVQUFVLENBQUMsQ0FBQyxZQUFZLENBQUMsQ0FBQyxhQUFhLENBQUM7QUFDekMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFNBQVM7QUFDakIsQUFBQSxBQUFBLE1BQU0sQ0FBQyxDQUFDO0FBQ1IsQ0FBQyxjQUFjLENBQUM7QUFDaEIsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFNBQVM7QUFDakIsQUFBQSxBQUFBLE1BQU0sQ0FBQyxDQUFDLFlBQVksQ0FBQyxDQUFDLElBQUksQ0FBQyxhQUFhO0FBQ3hDLEFBQUE7QUFDQSxBQUFBLHdEQUF1RDtBQUN2RCxBQUFBLGtCQUFpQjtBQUNqQixBQUFBLEFBQUEsTUFBTSxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsSUFBSSxDQUFDLFNBQVM7QUFDaEMsQUFBQTtBQUNBLEFBQUEsQUFBQSxNQUFNLENBQUMsQ0FBQyxjQUFjLENBQUMsQ0FBQyxJQUFJLENBQUMscUJBQXFCO0FBQ2xELEFBQUEsQUFBQSxNQUFNLENBQUMsQ0FBQyxjQUFjLENBQUMsQ0FBQyxJQUFJLENBQUMsY0FBYztBQUMzQyxBQUFBO0FBQ0EsQUFBQSw4QkFBNkI7QUFDN0IsQUFBQSxBQUFBLE1BQU0sQ0FBQyxDQUFDO0FBQ1IsQ0FBQyxLQUFLLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxXQUFXLENBQUM7QUFDdkMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFdBQVc7QUFDbkIsQUFBQTtBQUNBLEFBQUEsQUFBQSxNQUFNLENBQUMsQ0FBQztBQUNSLENB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QUEsQ0FBQSxDQUFBO0FBQ3RDLEFBQUEsRUFBRSxJQUFJLEMsQ0FBRSxDQUFDLFdBQVcsQ0FBQyxJQUFJLEM7Q0FBQyxDQUFBO0FBQzFCLEFBQUEsQ0FBQyxJQUFJLEMsQ0FBRSxDQUFDLE1BQU0sQ0FBQSxBQUFDLElBQUksQ0FBQTtBQUNuQixBQUFBO0FBQ0EsQUFBQSxDQUE0QixNQUEzQixDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUUsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDO0FBQzNDLEFBQUE7QUFDQSxBQUFBLENBQU8sTUFBTixNQUFNLENBQUMsQ0FBRSxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDO0FBQzlCLEFBQUEsQyxJLEksQ0FBeUIsTUFBTSxDQUFBLEFBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQSxDQUFBLENBQUE7QUFDN0MsQUFBQSxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUEsQ0FBQSxDQUFBO0FBQ1IsQUFBQSxHLEksR0FBRyxLQUFLLENBQUEsQUFBQyxjQUFjLENBQUEsTztFQUFBLENBQUE7QUFDdkIsQUFBQSxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUEsQ0FBQSxDQUFBO0FBQ1IsQUFBQSxHLEksR0FBRyxDQUFDLFFBQVEsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLEtBQUssQ0FBQyxPO0VBQUEsQ0FBQTtBQUMzQixBQUFBLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQSxDQUFBLENBQUE7QUFDUixBQUFBLEcsSSxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPO0VBQUEsQ0FBQTtBQUN0QyxBQUFBLEVBQUUsT0FBSSxDQUFBLENBQUEsQ0FBQTtBQUNOLEFBQUEsRyxJLEdBQUcsQ0FBQztBQUNKLEFBQUEsSUFBSSxNQUFNLENBQUMsS0FBSyxD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Q0FBQyxDQUFDLENBQUMsZUFBZSxDQUFDO0FBQ2xFLENBQUMsQ0FBQztBQUNGLEFBQUE7QUFDQSxBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsR0FBRztBQUNILEFBQUE7QUFDQSxBQUFBLEFBQUEsTUFBTSxDQUFDLElBQUksQ0FBQyxlQUFlLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsRUFBRSxDQUFDLElBQUk7QUFDdkQsQUFBQTtBQUNBLEFBQUEsQUFBQSxNQUFNLENBQUMsS0FBSyxDQUFDLGdCQUFnQixDQUFBLENBQUE7QUFDN0IsQUFBQTtBQUNBLEFBQUEsQ0FBQyxRQUFRLENBQUMsQ0FBQyxlQUFlO0FBQzFCLEFBQUE7QUFDQSxBQUFBLENBQUMsNkNBQTRDO0FBQzdDLEFBQUEsQ0FBQyw2Q0FBNEM7QUFDN0MsQUFBQSxDQUFDLFNBQVMsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQzVCLEFBQUE7QUFDQSxBQUFBLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsSUFBSTtBQUMxQixBQUFBLENBQUMsRUFBRSxDQUFDLENBQUMsTUFBTTtBQUNYLEFBQUE7QUFDQSxBQUFBLEMsV0FBWSxDQUFDO0FBQ2IsQUFBQSxHLFNBQVksQ0FBQyxDQUFDLGVBQWUsQ0FBQSxFQUFFLHNCQUFxQjtBQUNwRCxBQUFBLEdBQUcsUUFBUSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztBQUNwQixHQUFHLENBQUMsQ0FBQSxDQUFBO0FBQ0osQUFBQTtBQUNBLEFBQUEsRSxnQixTLENBRkk7QUFDSixBQUFBO0FBQ0EsQUFBQSxFQUFFLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDZCxBQUFBLEdBQUcsTUFBTSxDQUFDLENBQUMsUUFBUTtBQUNuQixBQUFBLEdBQUcsRUFBRSxDQUFDLENBQUMsTUFBTTtBQUNiLEdBQUcs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QUFMLEtBQUssQ0FBQyxDQUFFLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQSxBQUFDLElBQUksQ0FBQTtBQUMvQixBQUFBLENBQU8sTUFBTixNQUFNLENBQUMsQ0FBRSxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUEsQUFBQyxHQUFHLENBQUE7QUFDL0IsQUFBQSxDQUFDLEdBQUcsQ0FBQSxDQUFDLE1BQU0sQ0FBQyxHQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxHQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUEsQ0FBQSxDQUFBO0FBQ3pELEFBQUEsRUFBRSxJQUFJLENBQUMsaUJBQWlCLENBQUEsQUFBQyxJQUFJLENBQUMsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDO0NBQUEsQ0FBQTtBQUM1RCxBQUFBLENBQUMsTTtBQUFNLENBQUE7QUFDUCIsIm5hbWVzIjpbXSwic291cmNlc0NvbnRlbnQiOlsiIyBmc3lzLmxpYi5jaXZldFxuXG5pbXBvcnQge2RlYm91bmNlfSBmcm9tICdAc3RkL2FzeW5jL2RlYm91bmNlJ1xuaW1wb3J0IHtcblx0ZXhpc3RzU3luYywgZW1wdHlEaXJTeW5jLCBlbnN1cmVEaXJTeW5jLFxuXHR9IGZyb20gJ0BzdGQvZnMnXG5pbXBvcnQge1xuXHRhcHBlbmRGaWxlU3luYyxcblx0fSBmcm9tICdub2RlOmZzJ1xuaW1wb3J0IHtFdmVudEVtaXR0ZXJ9IGZyb20gJ25vZGU6ZXZlbnRzJ1xuXG4jIC0tLSBEZW5vJ3Mgc3RhdFN5bmMgYW5kIGxzdGF0U3luYyBhcmUgc3RpbGwgdW5zdGFibGUsXG4jICAgICBzbyB1c2UgdGhpc1xuaW1wb3J0IHtzdGF0U3luY30gZnJvbSAnbm9kZTpmcydcblxuaW1wb3J0IHtleHBhbmRHbG9iU3luY30gZnJvbSAnQHN0ZC9mcy9leHBhbmQtZ2xvYidcbmltcG9ydCB7VGV4dExpbmVTdHJlYW19IGZyb20gJ0BzdGQvc3RyZWFtcydcblxuIyAtLS0gVXNlIERlbm8ncyBwYXRoIGxpYnJhcnlcbmltcG9ydCB7XG5cdHBhcnNlLCByZXNvbHZlLCByZWxhdGl2ZSwgZnJvbUZpbGVVcmwsXG5cdH0gZnJvbSAnQHN0ZC9wYXRoJ1xuXG5pbXBvcnQge1xuXHR1bmRlZiwgZGVmaW5lZCwgbm90ZGVmaW5lZCwgYXNzZXJ0LCBjcm9haywgaXNFbXB0eSwgbm9uRW1wdHksXG5cdGlzU3RyaW5nLCBpc05vbkVtcHR5U3RyaW5nLCBpc0Jvb2xlYW4sIGlzTnVtYmVyLCBpc0ludGVnZXIsXG5cdGlzQXJyYXksIGlzQXJyYXlPZlN0cmluZ3MsIGlzSGFzaCwgaXNPYmplY3QsIGlzUmVnRXhwLFxuXHRpbnRlZ2VyLCBoYXNoLCB2b2lkRnVuYyxcblx0fSBmcm9tICdkYXRhdHlwZXMnXG5pbXBvcnQge1xuXHRPTCwgTUwsIGdldE9wdGlvbnMsIHJlbW92ZUVtcHR5S2V5cywgcGFzcywgaGFzS2V5LFxuXHRzcGFjZXMsIHNpbmNlTG9hZFN0ciwgc2xlZXAsIHJlbHBhdGgsXG5cdGdldEltcG9ydFN5bmMsIHJlcXVpcmUsXG5cdH0gZnJvbSAnbGx1dGlscydcbmltcG9ydCB7XG5cdHB1c2hMb2dMZXZlbCwgcG9wTG9nTGV2ZWwsIERCRywgREJHVkFMVUUsIEVSUixcblx0SU5ERU5ULCBVTkRFTlQsXG5cdH0gZnJvbSAnbG9nZ2VyJ1xuaW1wb3J0IHtUZXh0VGFibGV9IGZyb20gJ3RleHQtdGFibGUnXG5pbXBvcnQge2luZGVudGVkfSBmcm9tICdpbmRlbnQnXG5pbXBvcnQge1xuXHRUUExMVG9rZW4sIGFsbFRva2Vuc0luQmxvY2ssIHRva2VuVGFibGUsXG5cdH0gZnJvbSAncGxsJ1xuXG5leHBvcnQge3JlbHBhdGh9XG5cbi8qKlxuICogQG1vZHVsZSBmcyAtIGZpbGUgc3lzdGVtIHV0aWxpdGllc1xuICovXG5cbiMgLS0tIENyZWF0ZSBhIGZ1bmN0aW9uIGNhcGFibGUgb2Ygc3luY2hyb25vdXNseVxuIyAgICAgaW1wb3J0aW5nIEVTTSBtb2R1bGVzXG5cbkRlbm8gOj0gZ2xvYmFsVGhpcy5EZW5vXG50eXBlIEZzRXZlbnQgPSBEZW5vLkZzRXZlbnRcblxuIyAtLS0gbm90IGV4cG9ydGVkXG5kZWNvZGVyIDo9IG5ldyBUZXh0RGVjb2RlcigndXRmLTgnKVxuZW5jb2RlciA6PSBuZXcgVGV4dEVuY29kZXIoKVxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKipcbiAqIHJldHVybnMgYSBib29sZWFuIGluZGljYXRpbmcgaWYgdGhlIGdpdmVuIHBhdGggZXhpc3RzXG4gKiBhbmQgaXMgYSBmaWxlXG4gKi9cblxuZXhwb3J0IGlzRmlsZSA6PSAocGF0aDogc3RyaW5nKTogYm9vbGVhbiA9PlxuXG5cdHJldHVybiBleGlzdHNTeW5jKHBhdGgpICYmIHN0YXRTeW5jKHBhdGgpLmlzRmlsZSgpXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogcmV0dXJucyBhIGJvb2xlYW4gaW5kaWNhdGluZyBvZiB0aGUgZ2l2ZW4gcGF0aCBleGlzdHNcbiAqIGFuZCBpcyBhIGRpcmVjdG9yeVxuICovXG5cbmV4cG9ydCBpc0RpciA6PSAocGF0aDogc3RyaW5nKTogYm9vbGVhbiA9PlxuXG5cdHJldHVybiBleGlzdHNTeW5jKHBhdGgpICYmIHN0YXRTeW5jKHBhdGgpLmlzRGlyZWN0b3J5KClcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuLyoqXG4gKiByZXR1cm5zIG9uZSBvZjpcbiAqICAgICdtaXNzaW5nJyAgLSBkb2VzIG5vdCBleGlzdFxuICogICAgJ2RpcicgICAgICAtIGlzIGEgZGlyZWN0b3J5XG4gKiAgICAnZmlsZScgICAgIC0gaXMgYSBmaWxlXG4gKiAgICAnc3ltbGluaycgIC0gaXMgYSBzeW1saW5rXG4gKiAgICAndW5rbm93bicgIC0gZXhpc3RzLCBidXQgbm90IGEgZmlsZSwgZGlyZWN0b3J5IG9yIHN5bWxpbmtcbiAqL1xuXG5leHBvcnQgdHlwZSBUUGF0aFR5cGUgPVxuXHQnbWlzc2luZycgfCAnZmlsZScgfCAnZGlyJyB8ICdzeW1saW5rJyB8ICd1bmtub3duJ1xuXG5leHBvcnQgZ2V0UGF0aFR5cGUgOj0gKHBhdGg6IHN0cmluZyk6IFRQYXRoVHlwZSA9PlxuXG5cdGFzc2VydCBpc1N0cmluZyhwYXRoKSwgXCJub3QgYSBzdHJpbmc6ICN7T0wocGF0aCl9XCJcblx0aWYgbm90IGV4aXN0c1N5bmMgcGF0aFxuXHRcdHJldHVybiAnbWlzc2luZydcblx0aCA6PSBzdGF0U3luYyhwYXRoKVxuXHRyZXR1cm4gKFxuXHRcdCAgaC5pc0ZpbGUoKSAgICAgICAgID8gJ2ZpbGUnXG5cdFx0OiBoLmlzRGlyZWN0b3J5KCkgICAgPyAnZGlyJ1xuXHRcdDogaC5pc1N5bWJvbGljTGluaygpID8gJ3N5bWxpbmsnXG5cdFx0OiAgICAgICAgICAgICAgICAgICAgICAndW5rbm93bidcblx0XHQpXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogZXh0cmFjdCB0aGUgZmlsZSBleHRlbnNpb24gZnJvbSBhIHBhdGgsIGluY2x1ZGluZ1xuICogdGhlIGxlYWRpbmcgcGVyaW9kXG4gKi9cblxuZXhwb3J0IGZpbGVFeHQgOj0gKHBhdGg6IHN0cmluZyk6IHN0cmluZyA9PlxuXG5cdGlmIGxNYXRjaGVzIDo9IHBhdGgubWF0Y2goL1xcLlteXFwuXSskLylcblx0XHRyZXR1cm4gbE1hdGNoZXNbMF1cblx0ZWxzZVxuXHRcdHJldHVybiAnJ1xuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKipcbiAqIHJldHVybiB0aGUgZ2l2ZW4gcGF0aCwgYnV0IHdpdGggdGhlIGdpdmVuIGZpbGUgZXh0ZW5zaW9uXG4gKiByZXBsYWNpbmcgdGhlIGV4aXN0aW5nIGZpbGUgZXh0ZW5zaW9uXG4gKi9cblxuZXhwb3J0IHdpdGhFeHQgOj0gKHBhdGg6IHN0cmluZywgZXh0OiBzdHJpbmcpOiBzdHJpbmcgPT5cblxuXHRhc3NlcnQgaXNOb25FbXB0eVN0cmluZyhwYXRoKSwgXCJwYXRoID0gI3tPTChwYXRoKX1cIlxuXHRhc3NlcnQgZXh0LnN0YXJ0c1dpdGgoJy4nKSwgXCJCYWQgZmlsZSBleHRlbnNpb246ICN7ZXh0fVwiXG5cdGxNYXRjaGVzIDo9IHBhdGgubWF0Y2goL14oLiopKFxcLlteXFwuXSspJC8pXG5cdGlmIChsTWF0Y2hlcyA9PSBudWxsKVxuXHRcdHRocm93IG5ldyBFcnJvcihcIkJhZCBwYXRoOiAnI3twYXRofSdcIilcblx0W18sIGhlYWRTdHIsIG9yZ0V4dF0gOj0gbE1hdGNoZXNcblx0cmV0dXJuIFwiI3toZWFkU3RyfSN7ZXh0fVwiXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbmV4cG9ydCBsU3RhdEZpZWxkczogc3RyaW5nW10gOj0gW1xuXHQnZGV2JywnaW5vJywnbW9kZScsJ25saW5rJywndWlkJywnZ2lkJywncmRldicsXG5cdCdzaXplJywnYmxrc2l6ZScsJ2Jsb2NrcycsXG5cdCdhdGltZU1zJywnbXRpbWVNcycsJ2N0aW1lTXMnLCdiaXJ0aHRpbWVNcycsXG5cdCdhdGltZScsJ210aW1lJywnY3RpbWUnLCdiaXJ0aHRpbWUnLFxuXHRdXG5cbi8qKlxuICogcmV0dXJuIHN0YXRpc3RpY3MgZm9yIGEgZmlsZSBvciBkaXJlY3RvcnlcbiAqL1xuXG5leHBvcnQgZ2V0U3RhdHMgOj0gKHBhdGg6IHN0cmluZyk6IERlbm8uRmlsZUluZm8gPT5cblxuXHRmaWxlSW5mbyA6PSBEZW5vLnN0YXRTeW5jKHBhdGgpXG5cdHJldHVybiBmaWxlSW5mb1xuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG5leHBvcnQgaXNTdHViIDo9IChzdHI6IHN0cmluZyk6IGJvb2xlYW4gPT5cblxuXHQjIC0tLSBhIHN0dWIgY2Fubm90IGNvbnRhaW4gYW55IG9mICdcXFxcJywgJy8nXG5cdHJldHVybiBub3RkZWZpbmVkKHN0ci5tYXRjaCgvW1xcXFxcXC9dLykpICYmIChzdHJbMF0gIT0gJy4nKVxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKipcbiAqIHBhcnNlcyBhIHBhdGggb3IgZmlsZSBVUkwsIGFuZCByZXR1cm5zIGEgaGFzaCB3aXRoIGtleXM6XG4gKiBcdHR5cGU6IFRQYXRoVHlwZSAtICdmaWxlJywnZGlyJywnc3ltbGluaycsJ21pc3NpbmcnIG9yICd1bmtub3duJ1xuICogXHRwYXRoOiBzdHJpbmdcbiAqIFx0cm9vdDogc3RyaW5nXG4gKiBcdGRpcjogc3RyaW5nXG4gKiBcdGZpbGVOYW1lOiBzdHJpbmdcbiAqIFx0c3R1Yjogc3RyaW5nP1xuICogXHRwdXJwb3NlOiBzdHJpbmc/XG4gKiBcdGV4dDogc3RyaW5nP1xuICogXHRyZWxQYXRoOiBzdHJpbmdcbiAqIFx0cmVsRGlyOiBzdHJpbmdcbiAqL1xuXG5leHBvcnQgdHlwZSBUUGF0aEluZm8gPSB7XG5cdHR5cGU6IFRQYXRoVHlwZSAgIyAnZmlsZScsJ2RpcicsJ3N5bWxpbmsnLCdtaXNzaW5nJyBvciAndW5rbm93bidcblx0cGF0aDogc3RyaW5nXG5cdHJvb3Q6IHN0cmluZ1xuXHRkaXI6IHN0cmluZ1xuXHRmaWxlTmFtZTogc3RyaW5nXG5cdHN0dWI6IHN0cmluZz9cblx0cHVycG9zZTogc3RyaW5nP1xuXHRleHQ6IHN0cmluZz9cblx0cmVsUGF0aDogc3RyaW5nXG5cdHJlbERpcjogc3RyaW5nXG5cdH1cblxuZXhwb3J0IHBhcnNlUGF0aCA6PSAocGF0aDogc3RyaW5nKTogVFBhdGhJbmZvID0+XG5cblx0IyAtLS0gTk9URTogcGF0aCBtYXkgYmUgYSBmaWxlIFVSTCwgZS5nLiBpbXBvcnQubWV0YS51cmxcblx0IyAgICAgICAgICAgcGF0aCBtYXkgYmUgYSByZWxhdGl2ZSBwYXRoXG5cblx0YXNzZXJ0IGlzTm9uRW1wdHlTdHJpbmcocGF0aCksIFwicGF0aCBub3QgYSBzdHJpbmcgI3tPTChwYXRoKX1cIlxuXHRpZiBkZWZpbmVkKHBhdGgubWF0Y2goL15maWxlXFw6XFwvXFwvLykpXG5cdFx0cGF0aCA9IGZyb21GaWxlVXJsKHBhdGgpXG5cdHBhdGggPSBta3BhdGggcGF0aFxuXG5cdHtyb290LCBkaXIsIGJhc2U6IGZpbGVOYW1lfSA6PSBwYXJzZShwYXRoKVxuXG5cdGxQYXJ0cyA6PSBmaWxlTmFtZS5zcGxpdCgnLicpXG5cdFtzdHViLCBwdXJwb3NlLCBleHRdIDo9IHN3aXRjaCBsUGFydHMubGVuZ3RoXG5cdFx0d2hlbiAwXG5cdFx0XHRjcm9hayBcIkNhbid0IGhhcHBlblwiXG5cdFx0d2hlbiAxXG5cdFx0XHRbZmlsZU5hbWUsIHVuZGVmLCB1bmRlZl1cblx0XHR3aGVuIDJcblx0XHRcdFtsUGFydHNbMF0sIHVuZGVmLCBcIi4je2xQYXJ0c1sxXX1cIl1cblx0XHRlbHNlXG5cdFx0XHRbXG5cdFx0XHRcdGxQYXJ0cy5zbGljZSgwLCAtMikuam9pbignLicpLFxuXHRcdFx0XHRsUGFydHMuYXQoLTIpLFxuXHRcdFx0XHRcIi4je2xQYXJ0cy5hdCgtMSl9XCJcblx0XHRcdFx0XVxuXG5cdCMgLS0tIEdyYWIgZXZlcnl0aGluZyB1cCB1bnRpbCB0aGUgbGFzdCBwYXRoIHNlcGFyYXRvciwgaWYgYW55XG5cdHJlbFBhdGggOj0gcmVscGF0aCBwYXRoXG5cdGxQYXRoTWF0Y2hlcyA6PSByZWxQYXRoLm1hdGNoKC9eKC4qKVtcXFxcXFwvXVteXFxcXFxcL10qJC8pXG5cdHJlbERpciA6PSAobFBhdGhNYXRjaGVzID09IG51bGwpID8gJy4nIDogbFBhdGhNYXRjaGVzWzFdXG5cblx0cmV0dXJuIHtcblx0XHR0eXBlOiBnZXRQYXRoVHlwZShwYXRoKVxuXHRcdHBhdGhcblx0XHRyb290XG5cdFx0ZGlyXG5cdFx0ZmlsZU5hbWVcblx0XHRzdHViXG5cdFx0cHVycG9zZVxuXHRcdGV4dFxuXHRcdHJlbFBhdGhcblx0XHRyZWxEaXJcblx0XHR9XG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4jIEdFTkVSQVRPUlxuXG4vKipcbiAqIGdlbmVyYXRlIGZpbGVzIHRoYXQgbWF0Y2ggYSBnaXZlbiBnbG9iIHBhdHRlcm5cbiAqIHlpZWxkcyBhIGhhc2ggd2l0aCBrZXlzOlxuICogICAgdHlwZSAgICAgLSAnZmlsZScsICdkaXInLCAnc3ltbGluaycsICd1bmtub3duJ1xuICogICAgcm9vdCAgICAgLSBlLmcuICdDOi8nXG4gKiAgICBmaWxlTmFtZVxuICogICAgc3R1YlxuICogICAgcHVycG9zZVxuICogICAgZXh0XG4gKiAgICByZWxQYXRoICAgLSByZWxhdGl2ZSB0byB3b3JraW5nIGRpciwgbm8gbGVhZGluZyAuIG9yIC4uXG4gKiBUaGVzZSBvcHRpb25zIG1heSBiZSBzcGVjaWZpZWQgaW4gdGhlIDJuZCBwYXJhbWV0ZXI6XG4gKiAgICByb290OiBzdHJpbmcgLSByb290IG9mIHNlYXJjaCwgKGRlZjogRGVuby5jd2QoKSlcbiAqICAgIGxFeGNsdWRlOiBbc3RyaW5nXSAtIHBhdHRlcm5zIHRvIGV4Y2x1ZGUsXG4gKiAgICBcdGRlZjogWydub2RlX21vZHVsZXMvKionLCAnLmdpdC8qKiddXG4gKiAgICBpbmNsdWRlRGlyczogYm9vbGVhbiAtIHNob3VsZCBkaXJlY3RvcmllcyBiZSBpbmNsdWRlZD8gKGRlZjogdHJ1ZSlcbiAqIFx0Zm9sbG93U3ltbGlua3MgLSBib29sZWFuIC0gc2hvdWxkIHN5bSBsaW5rcyBiZSBmb2xsb3dlZD8gKGRlZjogZmFsc2UpXG4gKiBcdGNhbm9uaWNhbGl6ZTogYm9vbGVhbiAtIGlmIGZvbGxvd3N5bWxpbmtzIGlzIHRydWUsIHNob3VsZFxuICogXHRcdHBhdGhzIGJlIGNhbm9uaWNhbGl6ZWQ/IChkZWY6IHRydWUpXG4gKiBcdGZpbHRlcjogKHN0cmluZyA9PiBhbnk/KSAtIGlnbm9yZSBpZiB1bmRlZiByZXR1cm5lZCxcbiAqICAgICAgIGVsc2UgeWllbGQgdGhlIHJldHVybmVkIHZhbHVlXG4gKlxuICogR2xvYiBwYXR0ZXJuOlxuICogXHQqICAgICAgICAgbWF0Y2ggYW55IG51bWJlciBvZiBjaGFycywgZXhjZXB0IHBhdGggc2VwYXJhdG9yXG4gKiBcdCoqICAgICAgICBtYXRjaCB6ZXJvIG9yIG1vcmUgZGlyZWN0b3JpZXNcbiAqIFx0PyAgICAgICAgIG1hdGNoIGFueSBzaW5nbGUgY2hhciwgZXhjZXB0IHBhdGggc2VwYXJhdG9yXG4gKiBcdC8gICAgICAgICBwYXRoIHNlcGFyYXRvclxuICogXHRbYWJjXSAgICAgbWF0Y2ggb25lIGNoYXIgaW4gdGhlIGJyYWNrZXRzXG4gKiBcdFshYWJjXSAgICBtYXRjaCBvbmUgY2hhciBub3QgaW4gdGhlIGJyYWNrZXRzXG4gKiBcdHthYmMsMTIzfSBjb21tYS1zZXBhcmF0ZWQgbGlzdCBvZiBsaXRlcmFscyB0byBtYXRjaFxuICovXG5cbmV4cG9ydCBhbGxGaWxlc01hdGNoaW5nIDo9IChcblx0cGF0dGVybjogc3RyaW5nPScqKicsXG5cdGhPcHRpb25zOiBoYXNoPXt9XG5cdCk6IEdlbmVyYXRvcjxhbnksIHZvaWQsIHZvaWQ+IC0+XG5cblx0dHlwZSBvcHQgPSB7XG5cdFx0cm9vdDogc3RyaW5nP1xuXHRcdGxFeGNsdWRlOiBzdHJpbmdbXVxuXHRcdGluY2x1ZGVEaXJzOiBib29sZWFuXG5cdFx0Zm9sbG93U3ltbGlua3M6IGJvb2xlYW5cblx0XHRjYW5vbmljYWxpemU6IGJvb2xlYW5cblx0XHRmaWx0ZXI6IEZ1bmN0aW9uP1xuXHRcdH1cblx0e1xuXHRcdHJvb3QsXG5cdFx0bEV4Y2x1ZGUsXG5cdFx0aW5jbHVkZURpcnMsXG5cdFx0Zm9sbG93U3ltbGlua3MsXG5cdFx0Y2Fub25pY2FsaXplLFxuXHRcdGZpbHRlcixcblx0XHR9IDo9IGdldE9wdGlvbnM8b3B0PiBoT3B0aW9ucywge1xuXHRcdFx0cm9vdDogdW5kZWZcblx0XHRcdGxFeGNsdWRlOiBbXG5cdFx0XHRcdCdub2RlX21vZHVsZXMvKionXG5cdFx0XHRcdCcuZ2l0LyoqJ1xuXHRcdFx0XHQnKiovKi50ZW1wLionXG5cdFx0XHRcdF1cblx0XHRcdGluY2x1ZGVEaXJzOiBmYWxzZVxuXHRcdFx0Zm9sbG93U3ltbGlua3M6IGZhbHNlXG5cdFx0XHRjYW5vbmljYWxpemU6IGZhbHNlXG5cdFx0XHRmaWx0ZXI6IHVuZGVmXG5cdFx0XHR9XG5cblx0aEdsb2JPcHRpb25zIDo9IHtcblx0XHRyb290XG5cdFx0ZXhjbHVkZTogbEV4Y2x1ZGVcblx0XHRpbmNsdWRlRGlyc1xuXHRcdGZvbGxvd1N5bWxpbmtzXG5cdFx0Y2Fub25pY2FsaXplXG5cdFx0fVxuXG5cdGZvciBoIG9mIGV4cGFuZEdsb2JTeW5jKHBhdHRlcm4sIGhHbG9iT3B0aW9ucylcblx0XHQjIC0tLSBoIGhhcyBrZXlzOiBwYXRoLCBuYW1lLCBpc0ZpbGUsIGlzRGlyZWN0b3J5LCBpc1N5bUxpbmtcblxuXHRcdERCRyBcIk1BVENIOiAje2gucGF0aH1cIlxuXHRcdHR5cGUgOj0gKFxuXHRcdFx0ICBoLmlzRmlsZSAgICAgID8gJ2ZpbGUnXG5cdFx0XHQ6IGguaXNEaXJlY3RvcnkgPyAnZGlyJ1xuXHRcdFx0OiBoLmlzU3ltbGluayAgID8gJ3N5bWxpbmsnXG5cdFx0XHQ6ICAgICAgICAgICAgICAgICAndW5rbm93bidcblx0XHRcdClcblx0XHRoRmlsZSA6PSBwYXJzZVBhdGgoaC5wYXRoKVxuXHRcdGlmIG5vdGRlZmluZWQoZmlsdGVyKVxuXHRcdFx0REJHIFwiICAgLSBubyBmaWx0ZXJcIlxuXHRcdFx0eWllbGQgaEZpbGVcblx0XHRlbHNlXG5cdFx0XHRyZXN1bHQ6IGFueT8gOj0gZmlsdGVyKGhGaWxlKVxuXHRcdFx0aWYgbm90ZGVmaW5lZChyZXN1bHQpXG5cdFx0XHRcdERCRyBcIiAgIC0gZXhjbHVkZWQgYnkgZmlsdGVyXCJcblx0XHRcdGVsc2Vcblx0XHRcdFx0REJHIFwiICAgLSBhbGxvd2VkIGJ5IGZpbHRlclwiXG5cdFx0XHRcdHlpZWxkIHJlc3VsdFxuXHRyZXR1cm5cblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiMgQVNZTkMgR0VORVJBVE9SXG5cbi8qKlxuICogQW4gYXN5bmMgaXRlcmFibGUgLSB5aWVsZHMgZXZlcnkgbGluZSBpbiB0aGUgZ2l2ZW4gZmlsZVxuICpcbiAqIFVzYWdlOlxuICogICBmb3IgYXdhaXQgbGluZSBvZiBhbGxMaW5lc0luKCdzcmMvbGliL3RlbXAuY2l2ZXQnKVxuICogXHQgIGNvbnNvbGUubG9nIFwiTElORTogI3tsaW5lfVwiXG4gKiAgIGNvbnNvbGUubG9nIFwiRE9ORVwiXG4gKi9cblxuZXhwb3J0IGFsbExpbmVzSW4gOj0gKFxuXHRwYXRoOiBzdHJpbmdcblx0KTogQXN5bmNHZW5lcmF0b3I8c3RyaW5nLCB2b2lkLCB2b2lkPiAtPlxuXG5cdGFzc2VydCBpc0ZpbGUocGF0aCksIFwiTm8gc3VjaCBmaWxlOiAje09MKHBhdGgpfSAoYWxsTGluZXNJbilcIlxuXHRmIDo9IGF3YWl0IERlbm8ub3BlbihwYXRoKVxuXHRyZWFkYWJsZSA6PSBmLnJlYWRhYmxlXG5cdFx0LnBpcGVUaHJvdWdoKG5ldyBUZXh0RGVjb2RlclN0cmVhbSgpKVxuXHRcdC5waXBlVGhyb3VnaChuZXcgVGV4dExpbmVTdHJlYW0oKSlcblxuXHRmb3IgYXdhaXQgbGluZSBvZiByZWFkYWJsZVxuXHRcdHlpZWxkIGxpbmVcblx0cmV0dXJuXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogY29udmVydHMgYWxsIGJhY2tzbGFzaCBjaGFyYWN0ZXJzIHRvIGZvcndhcmQgc2xhc2hlc1xuICogdXBwZXItY2FzZXMgZHJpdmUgbGV0dGVyc1xuICovXG5cbmV4cG9ydCBub3JtYWxpemVQYXRoIDo9IChwYXRoOiBzdHJpbmcpOiBzdHJpbmcgPT5cblxuXHRucGF0aCA6PSBwYXRoLnJlcGxhY2VBbGwoJ1xcXFwnLCAnLycpXG5cdGlmIChucGF0aC5jaGFyQXQoMSkgPT0gJzonKVxuXHRcdHJldHVybiBucGF0aC5jaGFyQXQoMCkudG9VcHBlckNhc2UoKSArIG5wYXRoLnN1YnN0cmluZygxKVxuXHRlbHNlXG5cdFx0cmV0dXJuIG5wYXRoXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbmV4cG9ydCBwYXRoVG9VUkwgOj0gKGxQYXJ0cy4uLjogc3RyaW5nW10pOiBzdHJpbmcgPT5cblxuXHRwYXRoIDo9IHJlc29sdmUobFBhcnRzLi4uKVxuXHRyZXR1cm4gbmV3IFVSTCgnZmlsZTovLycgKyBwYXRoKS5ocmVmXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogcmVzb2x2ZXMgbXVsdGlwbGUgcGF0aCBwYXJ0cyB0byBhIHNpbmdsZSBwYXRoXG4gKiByZXR1cm5zIG5vcm1hbGl6ZWQgcGF0aFxuICovXG5cbmV4cG9ydCBta3BhdGggOj0gKGxQYXJ0cy4uLjogc3RyaW5nW10pOiBzdHJpbmcgPT5cblxuXHRwYXRoIDo9IHJlc29sdmUobFBhcnRzLi4uKVxuXHRyZXR1cm4gbm9ybWFsaXplUGF0aChwYXRoKVxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG5leHBvcnQgdHlwZSBUUGF0aERlc2MgPSB7XG5cdGRpcjogc3RyaW5nXG5cdHJvb3Q6IHN0cmluZ1xuXHRsUGFydHM6IHN0cmluZ1tdXG5cdH1cblxuLyoqXG4gKiByZXR1cm5zIHtkaXIsIHJvb3QsIGxQYXJ0c30gd2hlcmUgbFBhcnRzIGluY2x1ZGVzIHRoZSBuYW1lcyBvZlxuICogYWxsIGRpcmVjdG9yaWVzIGJldHdlZW4gdGhlIHJvb3QgYW5kIHRoZSBmaWxlIG5hbWVcbiAqIHJlbGF0aXZlIHRvIHRoZSBjdXJyZW50IHdvcmtpbmcgZGlyZWN0b3J5XG4gKi9cblxuZXhwb3J0IHBhdGhTdWJEaXJzIDo9IChwYXRoOiBzdHJpbmcsIGhPcHRpb25zOiBoYXNoPXt9KTogVFBhdGhEZXNjID0+XG5cblx0dHlwZSBvcHQgPSB7XG5cdFx0cmVsYXRpdmU6IGJvb2xlYW5cblx0XHR9XG5cdHtyZWxhdGl2ZX0gOj0gZ2V0T3B0aW9uczxvcHQ+IGhPcHRpb25zLCB7XG5cdFx0cmVsYXRpdmU6IGZhbHNlXG5cdFx0fVxuXHRwYXRoID0gcmVsYXRpdmUgPyByZWxwYXRoKHBhdGgpIDogbWtwYXRoKHBhdGgpXG5cdHtyb290LCBkaXJ9IDo9IHBhcnNlKHBhdGgpXG5cdHJldHVybiB7XG5cdFx0ZGlyXG5cdFx0cm9vdFxuXHRcdGxQYXJ0czogZGlyLnNsaWNlKHJvb3QubGVuZ3RoKS5zcGxpdCgvW1xcXFxcXC9dLylcblx0XHR9XG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4jIC0tLSBTaG91bGQgYmUgY2FsbGVkIGxpa2U6IG15c2VsZihpbXBvcnQubWV0YS51cmwpXG4jICAgICByZXR1cm5zIGZ1bGwgcGF0aCBvZiBjdXJyZW50IGZpbGVcblxuZXhwb3J0IG15c2VsZiA6PSAodXJsOiBzdHJpbmcpOiBzdHJpbmcgPT5cblxuXHRyZXR1cm4gcmVscGF0aCBmcm9tRmlsZVVybCh1cmwpXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKipcbiAqIHJlYWQgYSBmaWxlIGludG8gYSBzdHJpbmdcbiAqL1xuXG5leHBvcnQgc2x1cnAgOj0gKHBhdGg6IHN0cmluZyk6IHN0cmluZyA9PlxuXG5cdGFzc2VydCBpc0ZpbGUocGF0aCksIFwiTm8gc3VjaCBmaWxlOiAje3Jlc29sdmUocGF0aCl9IChzbHVycClcIlxuXHRkYXRhIDo9IERlbm8ucmVhZEZpbGVTeW5jIHBhdGhcblx0cmV0dXJuIGRlY29kZXIuZGVjb2RlKGRhdGEpLnJlcGxhY2VBbGwoJ1xccicsICcnKVxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKipcbiAqIHdyaXRlIGEgc3RyaW5nIHRvIGEgZmlsZVxuICogd2lsbCBlbnN1cmUgdGhhdCBhbGwgbmVjZXNzYXJ5IGRpcmVjdG9yaWVzIGV4aXN0XG4gKi9cblxuZXhwb3J0IGJhcmYgOj0gKFxuXHRcdHBhdGg6IHN0cmluZyxcblx0XHRjb250ZW50czogc3RyaW5nLFxuXHRcdGhPcHRpb25zOiBoYXNoID0ge31cblx0XHQpOiB2b2lkID0+XG5cblx0dHlwZSBvcHQgPSB7XG5cdFx0YXBwZW5kOiBib29sZWFuXG5cdFx0fVxuXHR7YXBwZW5kfSA6PSBnZXRPcHRpb25zPG9wdD4gaE9wdGlvbnMsIHtcblx0XHRhcHBlbmQ6IGZhbHNlXG5cdFx0fVxuXHRta0RpcnNGb3JGaWxlKHBhdGgpXG5cdGRhdGEgOj0gZW5jb2Rlci5lbmNvZGUoY29udGVudHMpXG5cdGlmIGFwcGVuZCAmJiBpc0ZpbGUocGF0aClcblx0XHRhcHBlbmRGaWxlU3luYyBwYXRoLCBkYXRhXG5cdGVsc2Vcblx0XHREZW5vLndyaXRlRmlsZVN5bmMgcGF0aCwgZGF0YVxuXHRyZXR1cm5cblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuZXhwb3J0IGJhcmZUZW1wRmlsZSA6PSAoXG5cdFx0Y29udGVudHM6IHN0cmluZ1xuXHRcdGhPcHRpb25zOiBoYXNoID0ge31cblx0XHQpOiBzdHJpbmcgPT5cblxuXHR0eXBlIG9wdCA9IHtcblx0XHRleHQ6IHN0cmluZ1xuXHRcdH1cblx0e2V4dH0gOj0gZ2V0T3B0aW9uczxvcHQ+IGhPcHRpb25zLCB7XG5cdFx0ZXh0OiAnLmNpdmV0J1xuXHRcdH1cblx0dGVtcEZpbGVQYXRoIDo9IERlbm8ubWFrZVRlbXBGaWxlU3luYyB7c3VmZml4OiBleHR9XG5cdGJhcmYgdGVtcEZpbGVQYXRoLCBjb250ZW50c1xuXHRyZXR1cm4gdGVtcEZpbGVQYXRoXG5cblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuZXhwb3J0IG5ld2VyRGVzdEZpbGVFeGlzdHMgOj0gKFxuXHRzcmNQYXRoOiBzdHJpbmcsXG5cdGRlc3RQYXRoOiBzdHJpbmdcblx0KTogYm9vbGVhbiA9PlxuXG5cdGFzc2VydCBpc0ZpbGUoc3JjUGF0aCksIFwiTm8gc3VjaCBmaWxlOiAje09MKHNyY1BhdGgpfSAobmV3ZXJEZXN0RmlsZUV4aXN0cylcIlxuXHRpZiBub3QgZXhpc3RzU3luYyhkZXN0UGF0aClcblx0XHRyZXR1cm4gZmFsc2Vcblx0c3JjTW9kVGltZSA6PSBzdGF0U3luYyhzcmNQYXRoKS5tdGltZU1zXG5cdGRlc3RNb2RUaW1lIDo9IHN0YXRTeW5jKGRlc3RQYXRoKS5tdGltZU1zXG5cdHJldHVybiAoZGVzdE1vZFRpbWUgPiBzcmNNb2RUaW1lKVxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKipcbiAqIGNyZWF0ZSBhIG5ldyBkaXJlY3RvcnkgaWYgaXQgZG9lc24ndCBleGlzdFxuICogaWYgdGhlIG9wdGlvbiAnY2xlYXInIGlzIHNldCB0byBhIHRydWUgdmFsdWUgaW4gdGhlIDJuZCBwYXJhbWV0ZXJcbiAqIGFuZCB0aGUgZGlyZWN0b3J5IGFscmVhZHkgZXhpc3RzLCBpdCBpcyBjbGVhcmVkXG4gKi9cblxuZXhwb3J0IG1rRGlyIDo9IChcblx0XHRkaXJQYXRoOiBzdHJpbmcsXG5cdFx0Y2xlYXI6IGJvb2xlYW49ZmFsc2Vcblx0XHQpOiB2b2lkID0+XG5cblx0aWYgY2xlYXJcblx0XHRlbXB0eURpclN5bmMgZGlyUGF0aCAgICAjIC0tLSBjcmVhdGVzIGlmIGl0IGRvZXNuJ3QgZXhpc3Rcblx0ZWxzZVxuXHRcdGVuc3VyZURpclN5bmMgZGlyUGF0aFxuXHRyZXR1cm5cblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuLyoqXG4gKiByZW1vdmUgYSBmaWxlIGZyb20gdGhlIGZpbGUgc3lzdGVtLCBidXQgZG8gbm90aGluZ1xuICogaWYgdGhlIGZpbGUgZG9lcyBub3QgZXhpc3RcbiAqL1xuXG5leHBvcnQgcm1GaWxlIDo9IChwYXRoOiBzdHJpbmcpOiB2b2lkID0+XG5cblx0aWYgZXhpc3RzU3luYyBwYXRoXG5cdFx0RGVuby5yZW1vdmVTeW5jIHBhdGhcblx0cmV0dXJuXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogcmVtb3ZlIGEgZGlyZWN0b3J5IGZyb20gdGhlIGZpbGUgc3lzdGVtLCBidXQgZG8gbm90aGluZ1xuICogaWYgdGhlIGRpcmVjdG9yeSBkb2VzIG5vdCBleGlzdFxuICogTk9URTogWW91IG11c3QgcGFzcyB0aGUgJ2NsZWFyJyBvcHRpb24gaWYgdGhlIGRpcmVjdG9yeVxuICogICAgICAgaXMgbm90IGVtcHR5XG4gKi9cblxuZXhwb3J0IHJtRGlyIDo9IChwYXRoOiBzdHJpbmcsIGhPcHRpb25zOiBoYXNoPXt9KTogdm9pZCA9PlxuXG5cdHR5cGUgb3B0ID0ge1xuXHRcdGNsZWFyOiBib29sZWFuXG5cdFx0fVxuXHR7Y2xlYXJ9IDo9IGdldE9wdGlvbnM8b3B0PiBoT3B0aW9ucywge1xuXHRcdGNsZWFyOiBmYWxzZVxuXHRcdH1cblx0aWYgZXhpc3RzU3luYyBwYXRoXG5cdFx0aWYgY2xlYXJcblx0XHRcdERlbm8ucmVtb3ZlU3luYyBwYXRoLCB7cmVjdXJzaXZlOiB0cnVlfVxuXHRcdGVsc2Vcblx0XHRcdERlbm8ucmVtb3ZlU3luYyBwYXRoXG5cdHJldHVyblxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKipcbiAqIGNyZWF0ZSBhbnkgbWlzc2luZyBkaXJlY3RvcmllcyBpbiB0aGUgZ2l2ZW4gcGF0aFxuICovXG5cbmV4cG9ydCBta0RpcnNGb3JGaWxlIDo9IChwYXRoOiBzdHJpbmcpOiB2b2lkID0+XG5cblx0e3Jvb3QsIGxQYXJ0c30gOj0gcGF0aFN1YkRpcnMocGF0aClcblx0bGV0IGRpciA9IHJvb3Rcblx0Zm9yIHBhcnQgb2YgbFBhcnRzXG5cdFx0ZGlyICs9IFwiLyN7cGFydH1cIlxuXHRcdGlmIG5vdCBpc0RpcihkaXIpXG5cdFx0XHRta0RpciBkaXJcblx0cmV0dXJuXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogZGVsZXRlcyBhbGwgZmlsZXMgYW5kIHN1YmRpcmVjdG9yaWVzIGluIHRoZSBnaXZlbiBkaXJlY3RvcnlcbiAqL1xuXG5leHBvcnQgY2xlYXJEaXIgOj0gKGRpclBhdGg6IHN0cmluZyk6IHZvaWQgPT5cblxuXHRlbXB0eURpclN5bmMgZGlyUGF0aFxuXHRyZXR1cm5cblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiMgLS0tIGhPcHRpb25zIGdldHMgcGFzc2VkIHRvIGFsbEZpbGVzTWF0Y2hpbmcoKVxuXG5leHBvcnQgcmVtb3ZlRmlsZXNNYXRjaGluZyA6PSAoXG5cdHBhdHRlcm46IHN0cmluZyxcblx0aE9wdGlvbnM6IGhhc2g9e31cblx0KTogdm9pZCA9PlxuXG5cdGFzc2VydCAocGF0dGVybiAhPSAnKicpICYmIChwYXR0ZXJuICE9ICcqKicpLFxuXHRcdFwiQ2FuJ3QgZGVsZXRlIGZpbGVzIG1hdGNoaW5nICN7T0wocGF0dGVybil9XCJcblx0Zm9yIHtyZWxQYXRofSBvZiBhbGxGaWxlc01hdGNoaW5nKHBhdHRlcm4sIGhPcHRpb25zKVxuXHRcdERlbm8ucmVtb3ZlU3luYyByZWxQYXRoXG5cdHJldHVyblxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG5leHBvcnQgcmVtb3ZlRmlsZXNFeGNlcHQgOj0gKFxuXHRwYXR0ZXJuOiBzdHJpbmcsXG5cdGxLZWVwOiBzdHJpbmdbXSxcblx0aE9wdGlvbnM6IGhhc2ggPSB7fVxuXHQpOiB2b2lkID0+XG5cblx0dHlwZSBvcHQgPSB7XG5cdFx0ZGVidWc6IGJvb2xlYW5cblx0XHR9XG5cdHtkZWJ1Z30gOj0gZ2V0T3B0aW9uczxvcHQ+IGhPcHRpb25zLCB7XG5cdFx0ZGVidWc6IGZhbHNlXG5cdFx0fVxuXHREQkcgOj0gKG1zZzogc3RyaW5nKTogdm9pZCA9PlxuXHRcdGlmIGRlYnVnXG5cdFx0XHRjb25zb2xlLmxvZyBtc2dcblx0XHRyZXR1cm5cblxuXHQjIC0tLSB0cnV0aHkgcmV0dXJuIG1lYW5zIHJlbW92ZSBpdFxuXHRmaWx0ZXIgOj0gKGhGaWxlOiBUUGF0aEluZm8pOiBUUGF0aEluZm8/ID0+XG5cdFx0e3R5cGUsIHJlbFBhdGh9IDo9IGhGaWxlXG5cdFx0aWYgKHR5cGUgIT0gJ2ZpbGUnKVxuXHRcdFx0cmV0dXJuIHVuZGVmXG5cdFx0cmVtb3ZlRmlsZSA6PSBub3QgbEtlZXAuaW5jbHVkZXMocmVsUGF0aClcblx0XHREQkcgXCJmaWx0ZXIoI3tyZWxQYXRofSk6IHJlbW92ZUZpbGUgPSAje3JlbW92ZUZpbGV9XCJcblx0XHRyZXR1cm4gcmVtb3ZlRmlsZSA/IGhGaWxlIDogdW5kZWZcblxuXHRoOiBoYXNoIDo9IHtmaWx0ZXIsIGRlYnVnfVxuXHRmb3Ige3JlbFBhdGh9IG9mIGFsbEZpbGVzTWF0Y2hpbmcocGF0dGVybiwgaClcblx0XHREQkcgXCJSRU1PVkUgRklMRSAje3JlbFBhdGh9XCJcblx0XHREZW5vLnJlbW92ZVN5bmMgcmVsUGF0aFxuXHRyZXR1cm5cblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuLyoqXG4gKiB0eXBlIFRGc0NhbGxiYWNrRnVuYyAtIGEgZnVuY3Rpb24gdGFraW5nIEZzRXZlbnQgYW5kIG9wdGlvbmFsbHlcbiAqIHJldHVybnMgYSBmdW5jdGlvbiByZWZlcmVuY2UgdG8gYmUgY2FsbGVkIG9uIGZpbGUgY2hhbmdlc1xuICovXG5cbmV4cG9ydCB0eXBlIFRGc0V2ZW50SGFuZGxlciA9IChldnQ6IEZzRXZlbnQpID0+IHZvaWRcbmV4cG9ydCB0eXBlIFRGc0hhbmRsZXJzID0ge1xuXHRbcGF0aDogc3RyaW5nXToge1traW5kIGluIGAke0ZzRXZlbnRbXCJraW5kXCJdfWBdOiBURnNFdmVudEhhbmRsZXJ9XG5cdH1cblxuLyoqXG4gKiBjbGFzcyBGaWxlRXZlbnRIYW5kbGVyXG4gKiAgICBoYW5kbGVzIGZpbGUgY2hhbmdlZCBldmVudHMgd2hlbiAuaGFuZGxlKGZzRXZlbnQpIGlzIGNhbGxlZFxuICogICAgY2FsbGJhY2sgaXMgYSBmdW5jdGlvbiwgZGVib3VuY2VkIGJ5IDIwMCBtc1xuICogICAgICAgdGhhdCB0YWtlcyBhbiBGc0V2ZW50IGFuZCByZXR1cm5zIGEgdm9pZEZ1bmNcbiAqICAgICAgIHdoaWNoIHdpbGwgYmUgY2FsbGVkIGlmIHRoZSBjYWxsYmFjayByZXR1cm5zIGEgZnVuY3Rpb24gcmVmZXJlbmNlXG4gKiBbdW5pdCB0ZXN0c10oLi4vdGVzdC9mcy50ZXN0LmNpdmV0Izp+OnRleHQ9JTIzJTIwJTJEJTJEJTJEJTIwY2xhc3MlMjBGaWxlRXZlbnRIYW5kbGVyKVxuICovXG5cbmV4cG9ydCB0eXBlIFRGc0NhbGxiYWNrRnVuYyA9IChjaGFuZ2U6IEZzRXZlbnQpID0+IHZvaWRcblxuZXhwb3J0IGNsYXNzIEZpbGVFdmVudEhhbmRsZXJcblxuXHRjYWxsYmFjazogVEZzQ2FsbGJhY2tGdW5jXG5cblx0IyAtLS0gQ3JlYXRlIHRoZSBkZWJvdW5jZWQgdmVyc2lvbiBvbmx5IG9uY2Vcblx0IyAgICAgcGF0aCA9PiBldmVudFR5cGUgPT4gZGVib3VuY2VkIGhhbmRsZXJcblx0aEhhbmRsZXJzOiBURnNIYW5kbGVycyA9IHt9XG5cblx0b25TdG9wOiAoKSA9PiB2b2lkID0gcGFzc1xuXHRtczogbnVtYmVyXG5cblx0Y29uc3RydWN0b3IoXG5cdFx0XHRAY2FsbGJhY2s6IFRGc0NhbGxiYWNrRnVuYyAgIyAtLS0gZnNFdmVudCA9PiB2b2lkXG5cdFx0XHRoT3B0aW9uczogaGFzaD17fVxuXHRcdFx0KVxuXG5cdFx0dHlwZSBvcHQgPSB7XG5cdFx0XHRvblN0b3A6IHZvaWRGdW5jXG5cdFx0XHRtczogbnVtYmVyXG5cdFx0XHR9XG5cdFx0e1xuXHRcdFx0b25TdG9wOiBAb25TdG9wXG5cdFx0XHRtczogQG1zXG5cdFx0XHR9IDo9IGdldE9wdGlvbnM8b3B0PiBoT3B0aW9ucywge1xuXHRcdFx0XHRvblN0b3A6IHBhc3Ncblx0XHRcdFx0bXM6IDIwMFxuXHRcdFx0XHR9XG5cdFx0REJHIFwiRmlsZUV2ZW50SGFuZGxlciBjb25zdHJ1Y3RvcigpIGNhbGxlZFwiXG5cblx0IyAtLS0gQ2FsbHMgYSB2b2lkRnVuY1xuXHQjICAgICBidXQgaXMgZGVib3VuY2VkIGJ5IEBtcyBtc1xuXG5cdGhhbmRsZShmc0V2ZW50OiBGc0V2ZW50KTogdm9pZFxuXHRcdHtraW5kLCBwYXRoc30gOj0gZnNFdmVudFxuXHRcdERCRyBcIkhBTkRMRTogWyN7c2luY2VMb2FkU3RyKCl9XSAje2tpbmR9ICN7cGF0aHN9XCJcblxuXHRcdGZvciBwYXRoIG9mIHBhdGhzXG5cdFx0XHRkSGFuZGxlciA6PSBAaEhhbmRsZXJzPy5bcGF0aF0/LltraW5kXVxuXHRcdFx0aWYgZGVmaW5lZChkSGFuZGxlcilcblx0XHRcdFx0ZEhhbmRsZXIoZnNFdmVudClcblx0XHRcdGVsc2Vcblx0XHRcdFx0ZnVuYyA6PSAoZXZ0OiBGc0V2ZW50KSA9PlxuXHRcdFx0XHRcdEBjYWxsYmFjayhldnQpXG5cdFx0XHRcdFx0cmV0dXJuXG5cblx0XHRcdFx0ZGZ1bmMgOj0gZGVib3VuY2UoZnVuYywgQG1zKVxuXHRcdFx0XHRkZnVuYyhmc0V2ZW50KVxuXHRcdFx0XHRAaEhhbmRsZXJzW3BhdGhdW2tpbmRdID0gZGZ1bmNcblxuXHRcdHJldHVyblxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuIyBBU1lOQ1xuXG5leHBvcnQgdHlwZSBUV2F0Y2hlckNhbGxiYWNrRnVuYyA9IChmc0V2ZW50OiBGc0V2ZW50KSA9PiBib29sZWFuXG5cbi8qKlxuICogYSBmdW5jdGlvbiB0aGF0IHdhdGNoZXMgZm9yIGNoYW5nZXMgb25lIG9yIG1vcmUgZmlsZXMgb3IgZGlyZWN0b3JpZXNcbiAqICAgIGFuZCBjYWxscyBhIGNhbGxiYWNrIGZ1bmN0aW9uIGZvciBlYWNoIGNoYW5nZS5cbiAqIElmIHRoZSBjYWxsYmFjayByZXR1cm5zIHRydWUsIHdhdGNoaW5nIGlzIGhhbHRlZFxuICpcbiAqIFVzYWdlOlxuICogICBoYW5kbGVyIDo9IChraW5kLCBwYXRoKSA9PiBjb25zb2xlLmxvZyBwYXRoXG4gKiAgIGF3YWl0IHdhdGNoRmlsZSAndGVtcC50eHQnLCBoYW5kbGVyXG4gKiAgIGF3YWl0IHdhdGNoRmlsZSAnc3JjL2xpYicsICBoYW5kbGVyXG4gKiAgIGF3YWl0IHdhdGNoRmlsZSBbJ3RlbXAudHh0JywgJ3NyYy9saWInXSwgaGFuZGxlclxuICovXG5cbmV4cG9ydCB3YXRjaEZpbGUgOj0gKFxuXHRwYXRoOiBzdHJpbmcgfCBzdHJpbmdbXSxcblx0d2F0Y2hlckNCOiBUV2F0Y2hlckNhbGxiYWNrRnVuYyxcblx0aE9wdGlvbnM6IGhhc2g9e31cblx0KTogdm9pZCAtPlxuXG5cdCMgLS0tIG1zIGlzIG1pbGxpc2Vjb25kcyB0byBkZWJvdW5jZSBieSwgZGVmYXVsdCBpcyAyMDBcblx0e21zfSA6PSBnZXRPcHRpb25zPHttczogbnVtYmVyfT4gaE9wdGlvbnMsIHttczogMjAwfVxuXG5cdERCRyBcIldBVENIOiAje0pTT04uc3RyaW5naWZ5KHBhdGgpfVwiXG5cdHdhdGNoZXIgOj0gRGVuby53YXRjaEZzKHBhdGgpXG5cblx0bGV0IGRvU3RvcDogYm9vbGVhbiA9IGZhbHNlXG5cblx0ZnNDYWxsYmFjazogVEZzQ2FsbGJhY2tGdW5jIDo9IChmc0V2ZW50KSA9PlxuXHRcdHJlc3VsdCA6PSB3YXRjaGVyQ0IoZnNFdmVudClcblx0XHREQkcgXCJGQ0I6IHJlc3VsdCA9ICN7cmVzdWx0fVwiXG5cdFx0aWYgcmVzdWx0XG5cdFx0XHR3YXRjaGVyLmNsb3NlKClcblx0XHRyZXR1cm5cblxuXHRoYW5kbGVyIDo9IG5ldyBGaWxlRXZlbnRIYW5kbGVyKGZzQ2FsbGJhY2ssIHttc30pXG5cblx0Zm9yIGF3YWl0IGZzRXZlbnQgb2Ygd2F0Y2hlclxuXHRcdERCRyBcIndhdGNoZXIgZXZlbnQgZmlyZWRcIlxuXHRcdGlmIGRvU3RvcFxuXHRcdFx0REJHIFwiZG9TdG9wID0gI3tkb1N0b3B9LCBDbG9zaW5nIHdhdGNoZXJcIlxuXHRcdFx0YnJlYWtcblx0XHRmb3IgcGF0aCBvZiBmc0V2ZW50LnBhdGhzXG5cdFx0XHQjIC0tLSBmc0NhbGxiYWNrIHdpbGwgYmUgKGV2ZW50dWFsbHkpIGNhbGxlZFxuXHRcdFx0aGFuZGxlci5oYW5kbGUoZnNFdmVudClcblxuZXhwb3J0IHdhdGNoRmlsZXMgOj0gd2F0Y2hGaWxlXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbmV4cG9ydCBhbGxUb2tlbnNJbkZpbGUgOj0gKFxuXHRcdHBhdGg6IHN0cmluZ1xuXHRcdCk6IEdlbmVyYXRvcjxUUExMVG9rZW4sIHZvaWQsIHZvaWQ+IC0+XG5cblx0Zm9yIHRvayBvZiBhbGxUb2tlbnNJbkJsb2NrKHNsdXJwKHBhdGgpKVxuXHRcdHlpZWxkIHRva1xuXHRyZXR1cm5cblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiMgLS0tIFVzZXMgYSByZWN1cnNpdmUgZGVzY2VudCBwYXJzZXJcblxuZXhwb3J0IHR5cGUgVEZpbGVPcCA9IHtcblx0ZnVuY05hbWU6ICdta0RpcicgfCAnYmFyZidcblx0cGF0aDogc3RyaW5nXG5cdGNvbnRlbnRzPzogc3RyaW5nXG5cdH1cblxuZXhwb3J0IHNldERpclRyZWUgOj0gKFxuXHRcdGN1cnJlbnREaXI6IHN0cmluZyxcblx0XHRjb250ZW50czogc3RyaW5nLFxuXHRcdGhPcHRpb25zOiBoYXNoID0ge31cblx0XHQpOiBURmlsZU9wW10gPT5cblxuXHQjIC0tLSBFeHRyYWN0IG9wdGlvbnNcblx0dHlwZSBvcHQgPSB7XG5cdFx0ZGVidWc6IGJvb2xlYW5cblx0XHRjbGVhcjogYm9vbGVhblxuXHRcdHNjYWZmb2xkOiBib29sZWFuXG5cdFx0fVxuXHR7ZGVidWcsIGNsZWFyLCBzY2FmZm9sZH0gOj0gZ2V0T3B0aW9uczxvcHQ+IGhPcHRpb25zLCB7XG5cdFx0ZGVidWc6IGZhbHNlXG5cdFx0Y2xlYXI6IGZhbHNlXG5cdFx0c2NhZmZvbGQ6IGZhbHNlXG5cdFx0fVxuXG5cdGlmIG5vdCBkZWJ1Z1xuXHRcdHB1c2hMb2dMZXZlbCAnaW5mbydcblx0bGV0IGxldmVsOiBpbnRlZ2VyID0gMFxuXG5cdGRiZ0VudGVyIDo9IChuYW1lOiBzdHJpbmcsIC4uLmxBcmdzOiBhbnlbXSkgPT5cblx0XHRzdHJBcmdzIDo9IChcblx0XHRcdGZvciBhcmcgb2YgbEFyZ3Ncblx0XHRcdFx0T0woYXJnKVxuXHRcdFx0KS5qb2luKCcsICcpXG5cdFx0REJHIFwiI3snICAgJy5yZXBlYXQobGV2ZWwpfS0+ICN7bmFtZX0oI3tzdHJBcmdzfSlcIlxuXHRcdGxldmVsICs9IDFcblx0XHRyZXR1cm5cblxuXHRkYmdFeGl0IDo9IChuYW1lOiBzdHJpbmcsIC4uLmxBcmdzOiBhbnlbXSkgPT5cblx0XHRzdHJBcmdzIDo9IChcblx0XHRcdGZvciBhcmcgb2YgbEFyZ3Ncblx0XHRcdFx0T0woYXJnKVxuXHRcdFx0KS5qb2luKCcsICcpXG5cdFx0bGV2ZWwgLT0gMVxuXHRcdERCRyBcIiN7JyAgICcucmVwZWF0KGxldmVsKX08LSAje25hbWV9KCN7c3RyQXJnc30pXCJcblx0XHRyZXR1cm5cblxuXHRkYmcgOj0gKGxpbmU6IHN0cmluZykgPT5cblx0XHREQkcgXCIjeycgICAnLnJlcGVhdChsZXZlbCl9LS0gI3tPTChsaW5lKX1cIlxuXHRcdHJldHVyblxuXG5cdCMgLS0tIEluIHVuaXQgdGVzdHMsIHdlIGp1c3QgcmV0dXJuIGNhbGxzIG1hZGVcblx0bEZpbGVPcHM6IFRGaWxlT3BbXSA6PSBbXVxuXG5cdCMgLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLlxuXG5cdGRvTWFrZURpciA6PSAoXG5cdFx0XHRkaXJQYXRoOiBzdHJpbmdcblx0XHRcdCk6IHZvaWQgPT5cblxuXHRcdGFzc2VydCBpc1N0cmluZyhkaXJQYXRoKSwgXCJkaXJQYXRoIG5vdCBhIHN0cmluZzogI3tPTChkaXJQYXRoKX1cIlxuXHRcdHBhdGggOj0gcmVscGF0aChkaXJQYXRoKVxuXHRcdGlmIHNjYWZmb2xkXG5cdFx0XHRsRmlsZU9wcy5wdXNoIHtcblx0XHRcdFx0ZnVuY05hbWU6ICdta0Rpcidcblx0XHRcdFx0cGF0aFxuXHRcdFx0XHR9XG5cdFx0ZWxzZVxuXHRcdFx0IyAtLS0gaWYgY2xlYXIgb3B0aW9uIHNldCwgY2xlYXIgZGlyIGlmIGl0IGV4aXN0c1xuXHRcdFx0bWtEaXIgcGF0aCwgY2xlYXJcblx0XHRyZXR1cm5cblxuXHQjIC4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi5cblxuXHRkb0JhcmYgOj0gKFxuXHRcdFx0ZmlsZVBhdGg6IHN0cmluZyxcblx0XHRcdGNvbnRlbnRzOiBzdHJpbmdcblx0XHRcdCk6IHZvaWQgPT5cblxuXHRcdHBhdGggOj0gcmVscGF0aChmaWxlUGF0aClcblx0XHRpZiBzY2FmZm9sZFxuXHRcdFx0bEZpbGVPcHMucHVzaCB7XG5cdFx0XHRcdGZ1bmNOYW1lOiBcImJhcmZcIlxuXHRcdFx0XHRwYXRoXG5cdFx0XHRcdGNvbnRlbnRzXG5cdFx0XHRcdH1cblx0XHRlbHNlXG5cdFx0XHRiYXJmIHBhdGgsIGNvbnRlbnRzXG5cdFx0cmV0dXJuXG5cblx0IyAuLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uXG5cblx0ZmlsZUhhbmRsZXIgOj0gKFxuXHRcdFx0ZmlsZVBhdGg6IHN0cmluZyxcblx0XHRcdGxUb2tlbnM6IFRQTExUb2tlbltdXG5cdFx0XHQpOiB2b2lkID0+XG5cblx0XHRkYmdFbnRlciAnZmlsZUhhbmRsZXInLCBmaWxlUGF0aFxuXHRcdGNvbnRlbnRzIDo9IGlmIChsVG9rZW5zWzBdLmtpbmQgPT0gJ2luZGVudCcpXG5cdFx0XHRsVG9rZW5zLnNoaWZ0KClcblx0XHRcdGxMaW5lcyA6PSBbXVxuXHRcdFx0bGV0IGxldmVsID0gMFxuXHRcdFx0IyBAdHMtaWdub3JlXG5cdFx0XHR3aGlsZSAobGV2ZWwgPiAwKSB8fCAobFRva2Vuc1swXS5raW5kICE9ICd1bmRlbnQnKVxuXHRcdFx0XHR0b2sgOj0gbFRva2Vucy5zaGlmdCgpXG5cdFx0XHRcdGlmIG5vdGRlZmluZWQodG9rKVxuXHRcdFx0XHRcdGNyb2FrIFwiTm8gJ3VuZGVudCcgaW4gY2xvY2tcIlxuXHRcdFx0XHRlbHNlXG5cdFx0XHRcdFx0c3dpdGNoIHRvay5raW5kXG5cdFx0XHRcdFx0XHR3aGVuICdpbmRlbnQnXG5cdFx0XHRcdFx0XHRcdGxldmVsICs9IDFcblx0XHRcdFx0XHRcdHdoZW4gJ3VuZGVudCdcblx0XHRcdFx0XHRcdFx0bGV2ZWwgLT0gMVxuXHRcdFx0XHRcdFx0XHRhc3NlcnQgKGxldmVsID49IDApLCBcIk5lZ2F0aXZlIGxldmVsIGluIHNldERpclRyZWUoKVwiXG5cdFx0XHRcdFx0XHRlbHNlXG5cdFx0XHRcdFx0XHRcdGxpbmUgOj0gaW5kZW50ZWQodG9rLnN0ciwgbGV2ZWwpXG5cdFx0XHRcdFx0XHRcdGlmIGlzU3RyaW5nKGxpbmUpICAgICMgLS0tIEFMV0FZUyBTVUNDRUVEU1xuXHRcdFx0XHRcdFx0XHRcdGRiZyBsaW5lXG5cdFx0XHRcdFx0XHRcdFx0bExpbmVzLnB1c2ggbGluZVxuXG5cdFx0XHQjIC0tLSBIRVJFOiAobGV2ZWwgPT0gMCkgQU5EIChsVG9rZW5zWzBdLmtpbmQgPT0gJ3VuZGVudCcpXG5cdFx0XHRhc3NlcnQgKGxldmVsID09IDApLCBcImFmdGVyIGZpbGUgY29udGVudHMsIGxldmVsID0gI3tPTChsZXZlbCl9XCJcblx0XHRcdGFzc2VydCAobFRva2Vuc1swXS5raW5kID09ICd1bmRlbnQnKSxcblx0XHRcdFx0XHRcIlVOREVOVCBleHBlY3RlZCBhZnRlciBjb250ZW50cywgZ290ICN7T0wobFRva2Vuc1swXSl9XCJcblx0XHRcdGxUb2tlbnMuc2hpZnQoKVxuXHRcdFx0bExpbmVzLmpvaW4oJ1xcbicpXG5cdFx0ZWxzZVxuXHRcdFx0Jydcblx0XHRkb0JhcmYgZmlsZVBhdGgsIGNvbnRlbnRzXG5cdFx0ZGJnRXhpdCAnZmlsZUhhbmRsZXInLCBmaWxlUGF0aFxuXHRcdHJldHVyblxuXG5cdGRpckhhbmRsZXIgOj0gKFxuXHRcdFx0ZGlyUGF0aDogc3RyaW5nLFxuXHRcdFx0bFRva2VuczogVFBMTFRva2VuW11cblx0XHRcdCk6IHZvaWQgPT5cblxuXHRcdGRiZ0VudGVyICdkaXJIYW5kbGVyJywgZGlyUGF0aFxuXHRcdGRvTWFrZURpciBkaXJQYXRoXG5cdFx0aWYgKGxUb2tlbnMubGVuZ3RoID4gMCkgJiYgKGxUb2tlbnNbMF0ua2luZCA9PSAnaW5kZW50Jylcblx0XHRcdGxUb2tlbnMuc2hpZnQoKVxuXHRcdFx0YmxvY2tIYW5kbGVyKGRpclBhdGgsIGxUb2tlbnMpXG5cdFx0XHQjIEB0cy1pZ25vcmVcblx0XHRcdGFzc2VydCAobFRva2Vuc1swXS5raW5kID09ICd1bmRlbnQnKSwgXCJNaXNzaW5nIFVOREVOVCBpbiBkaXJIYW5kbGVyXCJcblx0XHRcdGxUb2tlbnMuc2hpZnQoKVxuXHRcdGRiZ0V4aXQgJ2RpckhhbmRsZXInLCBkaXJQYXRoXG5cdFx0cmV0dXJuXG5cblx0YmxvY2tIYW5kbGVyIDo9IChkaXJQYXRoOiBzdHJpbmcsIGxUb2tlbnM6IFRQTExUb2tlbltdKSA9PlxuXHRcdGRiZ0VudGVyICdibG9ja0hhbmRsZXInLCBkaXJQYXRoXG5cdFx0d2hpbGUgKGxUb2tlbnMubGVuZ3RoID4gMCkgJiYgKGxUb2tlbnNbMF0ua2luZCAhPSAndW5kZW50Jylcblx0XHRcdHRvazogVFBMTFRva2VuIDo9IGxUb2tlbnNbMF1cblx0XHRcdGxUb2tlbnMuc2hpZnQoKVxuXHRcdFx0e2tpbmQsIHN0cn0gOj0gdG9rXG5cdFx0XHRzd2l0Y2gga2luZFxuXHRcdFx0XHR3aGVuICdpbmRlbnQnXG5cdFx0XHRcdFx0Y3JvYWsgXCJVbmV4cGVjdGVkIElOREVOVFwiXG5cdFx0XHRcdGVsc2Vcblx0XHRcdFx0XHRpZiBzdHIuc3RhcnRzV2l0aCgnLycpXG5cdFx0XHRcdFx0XHRkaXJIYW5kbGVyIFwiI3tkaXJQYXRofSN7dG9rLnN0cn1cIiwgbFRva2Vuc1xuXHRcdFx0XHRcdGVsc2Vcblx0XHRcdFx0XHRcdGZpbGVIYW5kbGVyIFwiI3tkaXJQYXRofS8je3Rvay5zdHJ9XCIsIGxUb2tlbnNcblx0XHRkYmdFeGl0ICdibG9ja0hhbmRsZXInXG5cdFx0cmV0dXJuXG5cblx0IyAuLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uXG5cblx0cHR5cGUgOj0gZ2V0UGF0aFR5cGUoY3VycmVudERpcilcblx0YXNzZXJ0IChwdHlwZSA9PSAnZGlyJykgfHwgKHB0eXBlID09ICdtaXNzaW5nJyksXG5cdFx0XHRcImN1cnJlbnREaXIgaXMgYSAje3B0eXBlfVwiXG5cblx0IyAtLS0gQ2xlYXIgdGhlIGRpcmVjdG9yeSBpZiBpdCBleGlzdHNcblx0ZG9NYWtlRGlyIGN1cnJlbnREaXJcblxuXHRsVG9rZW5zIDo9IEFycmF5LmZyb20oYWxsVG9rZW5zSW5CbG9jayhjb250ZW50cykpXG5cdERCRyB0b2tlblRhYmxlKGxUb2tlbnMpXG5cblx0YmxvY2tIYW5kbGVyKGN1cnJlbnREaXIsIGxUb2tlbnMpXG5cdGFzc2VydCAobFRva2Vucy5sZW5ndGggPT0gMCksXG5cdFx0XHRcIlRva2VucyByZW1haW5pbmcgYWZ0ZXIgcGFyc2U6ICN7T0wobFRva2Vucyl9XCJcblx0aWYgbm90IGRlYnVnXG5cdFx0cG9wTG9nTGV2ZWwoKVxuXHRyZXR1cm4gbEZpbGVPcHNcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuZXhwb3J0IGZpbGVPcHNUYWJsZSA6PSAobEZpbGVPcHM6IFRGaWxlT3BbXSk6IHN0cmluZyA9PlxuXG5cdHR0IDo9IG5ldyBUZXh0VGFibGUoXCJsIGxcIilcblx0dHQuZnVsbHNlcCgpXG5cdHR0LnRpdGxlICdGSUxFIE9QUydcblx0dHQuZnVsbHNlcCgpXG5cdGZvciB7ZnVuY05hbWUsIHBhdGgsIGNvbnRlbnRzfSBvZiBsRmlsZU9wc1xuXHRcdHN3aXRjaCBmdW5jTmFtZVxuXHRcdFx0d2hlbiAnbWtEaXInXG5cdFx0XHRcdHR0LmRhdGEgWydta2RpcicsIHBhdGhdXG5cdFx0XHR3aGVuICdiYXJmJ1xuXHRcdFx0XHR0dC5kYXRhIFsnYmFyZicsIHBhdGhdXG5cdFx0XHRcdGlmIGNvbnRlbnRzXG5cdFx0XHRcdFx0Zm9yIGxpbmUgb2YgY29udGVudHMuc3BsaXQoJ1xcbicpXG5cdFx0XHRcdFx0XHR0dC5kYXRhIFsnJywgbGluZS5yZXBsYWNlKCdcXHQnLCBzcGFjZXMoMykpXVxuXHR0dC5mdWxsc2VwKClcblx0cmV0dXJuIHR0LmFzU3RyaW5nKClcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuZXhwb3J0IHBhdGNoRmlyc3RMaW5lIDo9IChcblx0XHRwYXRoOiBzdHJpbmdcblx0XHRzdHI6IHN0cmluZ1xuXHRcdG5ld3N0cjogc3RyaW5nXG5cdFx0KTogdm9pZCA9PlxuXG5cdCMgLS0tIFJlcGxhY2Ugc3RyIHdpdGggbmV3c3RyLCBidXQgb25seSBvbiBmaXJzdCBsaW5lXG5cdGNvbnRlbnRzIDo9IERlbm8ucmVhZFRleHRGaWxlU3luYyBwYXRoXG5cdG5sUG9zIDo9IGNvbnRlbnRzLmluZGV4T2YgXCJcXG5cIlxuXHRzdHJQb3MgOj0gY29udGVudHMuaW5kZXhPZiBzdHJcblx0aWYgKHN0clBvcyAhPSAtMSkgJiYgKChubFBvcyA9PSAtMSkgfHwgKHN0clBvcyA8IG5sUG9zKSlcblx0XHREZW5vLndyaXRlVGV4dEZpbGVTeW5jIHBhdGgsIGNvbnRlbnRzLnJlcGxhY2Uoc3RyLCBuZXdzdHIpXG5cdHJldHVyblxuIl19