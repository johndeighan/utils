"use strict";
// fs.lib.civet

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

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3JjL2xpYi9mcy5saWIuY2l2ZXQudHN4Iiwic291cmNlcyI6WyJzcmMvbGliL2ZzLmxpYi5jaXZldCJdLCJtYXBwaW5ncyI6IjtBQUFBLGVBQWM7QUFDZCxBQUFBO0FBQ0EsSyxXLHlCO0FBQUEsTUFBTSxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsSUFBSSxDQUFDLHFCQUFxQjtBQUM1QyxBQUFBLEFBQUEsTUFBTSxDQUFDLENBQUM7QUFDUixDQUFDLFVBQVUsQ0FBQyxDQUFDLFlBQVksQ0FBQyxDQUFDLGFBQWEsQ0FBQztBQUN6QyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsU0FBUztBQUNqQixBQUFBLEFBQUEsTUFBTSxDQUFDLENBQUM7QUFDUixDQUFDLGNBQWMsQ0FBQztBQUNoQixDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsU0FBUztBQUNqQixBQUFBLEFBQUEsTUFBTSxDQUFDLENBQUMsWUFBWSxDQUFDLENBQUMsSUFBSSxDQUFDLGFBQWE7QUFDeEMsQUFBQTtBQUNBLEFBQUEsd0RBQXVEO0FBQ3ZELEFBQUEsa0JBQWlCO0FBQ2pCLEFBQUEsQUFBQSxNQUFNLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxJQUFJLENBQUMsU0FBUztBQUNoQyxBQUFBO0FBQ0EsQUFBQSxBQUFBLE1BQU0sQ0FBQyxDQUFDLGNBQWMsQ0FBQyxDQUFDLElBQUksQ0FBQyxxQkFBcUI7QUFDbEQsQUFBQSxBQUFBLE1BQU0sQ0FBQyxDQUFDLGNBQWMsQ0FBQyxDQUFDLElBQUksQ0FBQyxjQUFjO0FBQzNDLEFBQUE7QUFDQSxBQUFBLDhCQUE2QjtBQUM3QixBQUFBLEFBQUEsTUFBTSxDQUFDLENBQUM7QUFDUixDQUFDLEtBQUssQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLFdBQVcsQ0FBQztBQUN2QyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsV0FBVztBQUNuQixBQUFBO0FBQ0EsQUFBQSxBQUFBLE1BQU0sQ0FBQyxDQUFDO0FBQ1IsQ0FBQyxLQUFL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QUFDSCxBQUFBLENBQUMsR0FBRyxDQUFBLFVBQVUsQ0FBQSxBQUFDLElBQUksQ0FBQSxDQUFBLENBQUEsQ0FBQTtBQUNuQixBQUFBLEVBQUUsR0FBRyxDQUFBLEtBQUssQ0FBQSxDQUFBLENBQUE7QUFDVixBQUFBLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQSxBQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsSUFBSSxDQUFDLEM7RUFBQSxDQUFBO0FBQzFDLEFBQUEsRUFBRSxJQUFJLENBQUEsQ0FBQTtBQUNOLEFBQUEsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFBLEFBQUMsSUFBSSxDO0VBQUEsQztDQUFBLENBQUE7QUFDdkIsQUFBQSxDQUFDLE07QUFBTSxDQUFBO0FBQ1AsQUFBQTtBQUNBLEFBQUEsOEVBQTZFO0FBQzdFLEFBQUE7QUFDQSxBQUFBO0FBQ0E7QUFDQSxHQUFHO0FBQ0gsQUFBQTtBQUNBLEFBQUEsQUFBQSxNQUFNLENBQWMsTUFBYixhQUFhLENBQUMsQ0FBRSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFBLENBQUE7QUFDL0MsQUFBQTtBQUNBLEFBQUEsQ0FBZSxNQUFkLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBRSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUM7QUFDcEMsQUFBQSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLElBQUk7QUFDZixBQUFBLENBQUMsR0FBRyxDQUFDLENBQUEsTUFBQSxJQUFJLENBQUMsRUFBRSxDQUFDLE1BQU0sQ0FBQSxDQUFBLENBQUE7QUFDbkIsQUFBQSxFQUFFLEdBQUcsQyxFQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUM7QUFDbkIsQUFBQSxFQUFFLEdBQUcsQ0FBQSxDQUFJLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQSxDQUFBLENBQUE7QUFDbkIsQUFBQSxHQUFHLEtBQUssQ0FBQSxBQUFDLEdBQUcsQztFQUFBLEM7Q0FBQSxDQUFBO0FBQ1osQUFBQSxDQUFDLE07QUFBTSxDQUFBO0FBQ1AsQUFBQTtBQUNBLEFBQUEsOEVBQTZFO0FBQzdFLEFBQUE7QUFDQSxBQUFBO0FBQ0E7QUFDQSxHQUFHO0FBQ0gsQUFBQTtBQUNBLEFBQUEsQUFBQSxNQUFNLENBQVMsTUFBUixRQUFRLENBQUMsQ0FBRSxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFBLENBQUE7QUFDN0MsQUFBQTtBQUNBLEFBQUEsQ0FBQyxZQUFZLENBQUEsQUFBQyxPQUFPLENBQUE7QUFDckIsQUFBQSxDQUFDLE07QUFBTSxDQUFBO0FBQ1AsQUFBQTtBQUNBLEFBQUEsOEVBQTZFO0FBQzdFLEFBQUEsaURBQWdEO0FBQ2hELEFBQUE7QUFDQSxBQUFBLEFBQUEsTUFBTSxDQUFvQixNQUFuQixtQkFBbUIsQ0FBQyxDQUFFLENBQUMsQ0FBQztBQUMvQixBQUFBLENBQUMsT0FBTyxDQUFDLENBQUMsTUFBTSxDQUFDO0FBQ2pCLEFBQUEsQ0FBQyxRQUFRLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO0FBQ2xCLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQSxDQUFBO0FBQ1gsQUFBQTtBQUNBLEFBQUEsQ0FBQyxNQUFNLENBQUEsQUFBQyxDQUFDLE9BQU8sQ0FBQyxHQUFFLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLEdBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUM5QyxBQUFBLEVBQUUsQ0FBQyw0QkFBNEIsRUFBRSxFQUFFLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQzlDLEFBQUEsQ0FBQyxHQUFHLENBQUMsQ0FBQSxNQUFBLENBQUMsT0FBTyxDQUFDLENBQUMsRUFBRSxDQUFDLGdCQUFnQixDQUFDLE9BQU8sQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFBLENBQUEsQ0FBQTtBQUNyRCxBQUFBLEVBQUUsSUFBSSxDQUFDLFVBQVUsQ0FBQSxBQUFDLE9BQU8sQztDQUFBLENBQUE7QUFDekIsQUFBQSxDQUFDLE07QUFBTSxDQUFBO0FBQ1AsQUFBQTtBQUNBLEFBQUEsOEVBQTZFO0FBQzdFLEFBQUE7QUFDQSxBQUFBLEFBQUEsTUFBTSxDQUFrQixNQUFqQixpQkFBaUIsQ0FBQyxDQUFFLENBQUMsQ0FBQztBQUM3QixBQUFBLENBQUMsT0FBTyxDQUFDLENBQUMsTUFBTSxDQUFDO0FBQ2pCLEFBQUEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDO0FBQ2pCLEFBQUEsQ0FBQyxRQUFRLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNwQixDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUEsQ0FBQTtBQUNYLEFBQUE7QUFDQSxBQUFBLENBQVEsTUFBUCxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUUsQ0FBQyxVQUFVLENBQUEsQUFBQyxRQUFRLENBQUMsQ0FBQyxDQUFDO0FBQ2xDLEFBQUEsRUFBRSxLQUFLLENBQUMsQ0FBQyxLQUFLO0FBQ2QsRUFBRSxDQUFDLENBQUE7QUFDSCxBQUFBLENBQUksTUFBSCxHQUFHLENBQUMsQ0FBRSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFBLENBQUE7QUFDOUIsQUFBQSxFQUFFLEdBQUcsQ0FBQSxLQUFLLENBQUEsQ0FBQSxDQUFBO0FBQ1YsQUFBQSxHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUEsQUFBQyxHQUFHLEM7RUFBQSxDQUFBO0FBQ2xCLEFBQUEsRUFBRSxNO0NBQU0sQ0FBQTtBQUNSLEFBQUE7QUFDQSxBQUFBLENBQUMsb0NBQW1DO0FBQ3BDLEFBQUEsQ0FBTyxNQUFOLE1BQU0sQ0FBQyxDQUFFLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxTQUFTLENBQUMsQyxDLENBQUMsQUFBQyxTLFksQ0FBVSxDQUFDLEVBQUUsQ0FBQSxDQUFBO0FBQzVDLEFBQUEsRUFBaUIsTUFBZixDQUFDLElBQUksQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUUsQ0FBQyxLQUFLO0FBQzFCLEFBQUEsRUFBRSxHQUFHLENBQUMsSUFBSSxDQUFDLEdBQUUsQ0FBQyxNQUFNLENBQUMsQ0FBQSxDQUFBO0FBQ3JCLEFBQUEsR0FBRyxNQUFNLENBQUMsSztFQUFLLENBQUE7QUFDZixBQUFBLEVBQVksTUFBVixVQUFVLENBQUMsQ0FBRSxDQUFDLENBQUksS0FBSyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUM7QUFDM0MsQUFBQSxFQUFFLEdBQUcsQ0FBQSxBQUFDLENBQUMsT0FBTyxFQUFFLE9BQU8sQ0FBQyxnQkFBZ0IsRUFBRSxVQUFVLENBQUMsQ0FBQyxDQUFBO0FBQ3RELEFBQUEsRUFBRSxNQUFNLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEs7Q0FBSyxDQUFBO0FBQ25DLEFBQUE7QUFDQSxBQUFBLENBQVEsTUFBUCxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBRSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsS0FBSyxDQUFDO0FBQzNCLEFBQUEsQ0FBQyxHQUFHLENBQUMsQ0FBQSxNQUFBLENBQUMsT0FBTyxDQUFDLENBQUMsRUFBRSxDQUFDLGdCQUFnQixDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFBLENBQUEsQ0FBQTtBQUM5QyxBQUFBLEVBQUUsR0FBRyxDQUFBLEFBQUMsQ0FBQyxZQUFZLEVBQUUsT0FBTyxDQUFDLENBQUMsQ0FBQTtBQUM5QixBQUFBLEVBQUUsSUFBSSxDQUFDLFVBQVUsQ0FBQSxBQUFDLE9BQU8sQztDQUFBLENBQUE7QUFDekIsQUFBQSxDQUFDLE07QUFBTSxDQUFBO0FBQ1AsQUFBQTtBQUNBLEFBQUEsOEVBQTZFO0FBQzdFLEFBQUE7QUFDQSxBQUFBLEFBQUEsTUFBTSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDN0IsQUFBQSxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU07QUFDYixBQUFBLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTTtBQUNiLEFBQUEsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLE1BQU07QUFDWixDQUFDLENBQUM7QUFDRixBQUFBO0FBQ0EsQUFBQTtBQUNBO0FBQ0E7QUFDQSxHQUFHO0FBQ0gsQUFBQTtBQUNBLEFBQUEsQUFBQSxNQUFNLENBQUMsSUFBSSxDQUFDLGVBQWUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxhQUFhLENBQUMsQ0FBQyxFQUFFLENBQUMsSUFBSTtBQUM3RCxBQUFBO0FBQ0EsQUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLEdBQUc7QUFDSCxBQUFBO0FBQ0EsQUFBQSxBQUFBLE1BQU0sQ0FBQyxLQUFLLENBQUMsZ0JBQWdCLENBQUEsQ0FBQTtBQUM3QixBQUFBO0FBQ0EsQUFBQSxDQUFDLFFBQVEsQyxDLENBQUMsQUFBQyxlLFksQ0FBZ0I7QUFDM0IsQUFBQSxDQUEwQixTQUF6QixRQUFRLENBQUMsQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDLENBQUUsQ0FBQyxDQUFDLENBQUM7QUFDaEMsQUFBQSxDQUFDLFNBQVMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsOENBQTZDO0FBQ3JFLEFBQUEsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJO0FBQzFCLEFBQUEsQ0FBQyxFQUFFLENBQUMsQ0FBQyxNQUFNO0FBQ1gsQUFBQSxDQUFDLEtBQUssQ0FBQyxDQUFDLE9BQU87QUFDZixBQUFBO0FBQ0EsQUFBQSxDLFdBQVksQ0FBQztBQUNiLEFBQUEsRyxTQUFZLEMsQyxDQUFDLEFBQUMsZSxZLENBQWdCLENBQUMsS0FBSyxDQUFDO0FBQ3JDLEFBQUEsR0FBRyxRQUFRLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO0FBQ3BCLEdBQUcsQ0FBQyxDQUFBLENBQUE7QUFDSixBQUFBO0FBQ0EsQUFBQSxFLGdCLFMsQ0FGSTtBQUNKLEFBQUE7QUFDQSxBQUFBLEVBSUksTUFKRixDQUFDO0FBQ0gsQUFBQSxHQUFHLEtBQUssQ0FBQyxDLE1BQU8sQ0FBQztBQUNqQixBQUFBLEdBQUcsTUFBTSxDQUFDLEMsT0FBUSxDQUFBO0FBQ2xCLEFBQUEsR0FBRyxFQUFFLENBQUMsQyxHQUFJO0FBQ1YsR0FBRyxDQUFDLENBQUMsQ0FBRSxDQUFDLFVBQVUsQ0FBQSxBQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUM7QUFDOUIsQUFBQSxJQUFJLEtBQUssQ0FBQyxDQUFDLEtBQUssQ0FBQTtBQUNoQixBQUFBLElBQUksTUFBTSxDQUFDLENBQUMsSUFBSSxDQUFBO0FBQ2hCLEFBQUEsSUFBSSxFQUFFLENBQUMsQ0FBQyxHQUFHO0FBQ1gsSUFBSSxDQUFDLEMsQyxhLE0sQyxjLE8sQyxVLEcsQ0FBQTtBQUNMLEFBQUEsRUFBRSxJLENBQUMsR0FBRyxDQUFBLEFBQUMsdUNBQXVDLEM7Q0FBQSxDQUFBO0FBQzlDLEFBQUE7QUFDQSxBQUFBLENBQUMsMENBQXlDO0FBQzFDLEFBQUEsQ0FBQyxpQ0FBZ0M7QUFDakMsQUFBQTtBQUNBLEFBQUEsQyxNQUFPLENBQUMsTUFBTSxDQUFDLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUEsQ0FBQTtBQUNwQyxBQUFBLEVBQWMsTUFBWixDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUUsQ0FBQyxNQUFNO0FBQ3hCLEFBQUEsRUFBRSxJLENBQUMsR0FBRyxDQUFBLEFBQUMsQ0FBQyxTQUFTLEVBQUUsWUFBWSxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsSUFBSSxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFBO0FBQ3BELEFBQUEsRUFBRSxHQUFHLENBQUEsVUFBVSxDQUFDLEksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUEsQ0FBQSxDQUFBO0FBQ25DLEFBQUEsR0FBRyxJLENBQUMsR0FBRyxDQUFBLEFBQUMsQ0FBQyxvQkFBb0IsRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDekMsQUFBQSxHQUFHLEksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLEMsQ0FBRSxDQUFDLENBQUMsQztFQUFDLENBQUE7QUFDeEIsQUFBQTtBQUNBLEFBQUEsRUFBRSxHQUFHLENBQUEsVUFBVSxDQUFDLEksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFBLENBQUEsQ0FBQTtBQUMzQyxBQUFBLEdBQUcsSSxDQUFDLEdBQUcsQ0FBQSxBQUFDLENBQUMsbUJBQW1CLEVBQUUsSUFBSSxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQy9DLEFBQUEsR0FBTyxNQUFKLElBQUksQ0FBQyxDQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFBLENBQUE7QUFDaEIsQUFBQSxJQUFJLEdBQUcsQ0FBQSxJLENBQUMsUUFBUSxDQUFBLENBQUEsQ0FBQTtBQUNoQixBQUFBLEtBQUssSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxDO0lBQUMsQ0FBQTtBQUM1QixBQUFBLElBQUksSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUEsQUFBQyxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFBO0FBQy9CLEFBQUEsSUFBSSxJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxDLENBQUUsQ0FBQyxLQUFLO0FBQ2xDLEFBQUEsSUFBSSxNQUFNLENBQUMsSztHQUFLLENBQUE7QUFDaEIsQUFBQSxHQUFHLEksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLEMsQ0FBRSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJLENBQUMsRUFBRSxDO0VBQUMsQ0FBQTtBQUMvQyxBQUFBLEVBQUUsSSxDQUFDLEdBQUcsQ0FBQSxBQUFDLENBQUMsMkJBQTJCLEVBQUUsSUFBSSxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFBO0FBQ25ELEFBQUEsRUFBRSxJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7QUFDMUIsQUFBQSxFQUFFLE07Q0FBTSxDQUFBO0FBQ1IsQUFBQTtBQUNBLEFBQUEsQ0FBQyxhQUFZO0FBQ2IsQUFBQSxDLE0sYUFBYyxDQUFDLENBQUMsQ0FBQSxDQUFBO0FBQ2hCLEFBQUEsRUFBRSxLQUFLLENBQUMsS0FBSyxDQUFBLEFBQUMsSSxDQUFDLEVBQUUsQ0FBQTtBQUNqQixBQUFBLEVBQUUsTUFBTSxDQUFDLEksQ0FBQyxRO0NBQVEsQ0FBQTtBQUNsQixBQUFBO0FBQ0EsQUFBQSxDQUFDLE9BQU8sQyxHQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFBLENBQUE7QUFDaEQsQUFBQSxFQUFFLEdBQUcsQ0FBQSxJLENBQUMsS0FBSyxDQUFBLENBQUEsQ0FBQTtBQUNYLEFBQUEsR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFBLEFBQUMsQ0FBQyxHQUFHLEVBQUUsTUFBTSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLEVBQUUsR0FBRyxDQUFDLENBQUMsQztFQUFBLENBQUE7QUFDOUMsQUFBQSxFQUFFLE07Q0FBTSxDO0FBQUEsQ0FBQTtBQUNSLEFBQUE7QUFDQSxBQUFBLDhFQUE2RTtBQUM3RSxBQUFBLFFBQU87QUFDUCxBQUFBO0FBQ0EsQUFBQSxBQUFBLE1BQU0sQ0FBQyxJQUFJLENBQUMsb0JBQW9CLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsYUFBYSxDQUFDLENBQUMsRUFBRSxDQUFDLE9BQU87QUFDckUsQUFBQTtBQUNBLEFBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxHQUFHO0FBQ0gsQUFBQTtBQUNBLEFBQUEsQUFBQSxNQUFNLENBQVUsTUFBVCxTQUFTLENBQUMsQ0FBRSxDLE1BSVYsUUFKVyxDQUFDO0FBQ3JCLEFBQUEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7QUFDekIsQUFBQSxDQUFDLFNBQVMsQ0FBQyxDQUFDLG9CQUFvQixDQUFDO0FBQ2pDLEFBQUEsQ0FBQyxRQUFRLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO0FBQ2xCLENBQUMsQ0FBQyxDLEMsVyxDQUFDLEFBQUMsSSxDQUFPLENBQUEsQ0FBQTtBQUNYLEFBQUE7QUFDQSxBQUFBLENBQVksTUFBWCxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUUsQ0FBQyxVQUFVLENBQUEsQUFBQyxRQUFRLENBQUMsQ0FBQyxDQUFDO0FBQ3RDLEFBQUEsRUFBRSxLQUFLLENBQUMsQ0FBQyxLQUFLLENBQUE7QUFDZCxBQUFBLEVBQUUsRUFBRSxDQUFDLENBQUMsR0FBRztBQUNULEVBQUUsQ0FBQyxDQUFBO0FBQ0gsQUFBQSxDQUFJLE1BQUgsR0FBRyxDQUFDLENBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQSxDQUFBO0FBQzlCLEFBQUEsRUFBRSxHQUFHLENBQUEsS0FBSyxDQUFBLENBQUEsQ0FBQTtBQUNWLEFBQUEsR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFBLEFBQUMsR0FBRyxDO0VBQUEsQ0FBQTtBQUNsQixBQUFBLEVBQUUsTTtDQUFNLENBQUE7QUFDUixBQUFBO0FBQ0EsQUFBQSxDQUFDLEdBQUcsQ0FBQSxBQUFDLENBQUMsT0FBTyxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQ3JDLEFBQUE7QUFDQSxBQUFBLENBQVEsTUFBUCxPQUFPLENBQUMsQ0FBRSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDO0FBQzlCLEFBQUE7QUFDQSxBQUFBLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsS0FBSztBQUM1QixBQUFBO0FBQ0EsQUFBQSxDQUE0QixNQUEzQixVQUFVLENBQUMsQ0FBQyxlQUFlLENBQUMsQ0FBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQSxDQUFBO0FBQ2pELEFBQUEsRUFBUSxNQUFOLE1BQU0sQ0FBQyxDQUFFLENBQUMsU0FBUyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDbkMsQUFBQSxFQUFFLEdBQUcsQ0FBQSxBQUFDLENBQUMsY0FBYyxFQUFFLE1BQU0sQ0FBQyxDQUFDLENBQUE7QUFDL0IsQUFBQSxFQUFFLEdBQUcsQ0FBQSxNQUFNLENBQUEsQ0FBQSxDQUFBO0FBQ1gsQUFBQSxHQUFHLE9BQU8sQ0FBQyxLQUFLLENBQUMsQztFQUFDLENBQUE7QUFDbEIsQUFBQSxFQUFFLE07Q0FBTSxDQUFBO0FBQ1IsQUFBQTtBQUNBLEFBQUEsQ0FBUSxNQUFQLE9BQU8sQ0FBQyxDQUFFLENBQUMsR0FBRyxDQUFDLGdCQUFnQixDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUM7QUFDekQsQUFBQTtBQUNBLEFBQUEsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUEsTUFBQSxDQUFDLElBQUksQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQyxPQUFPLENBQUEsQ0FBQSxDQUFBO0FBQ25DLEFBQUEsRUFBRSxHQUFHLENBQUEsQUFBQyxxQkFBcUIsQ0FBQTtBQUMzQixBQUFBLEVBQUUsR0FBRyxDQUFBLE1BQU0sQ0FBQSxDQUFBLENBQUE7QUFDWCxBQUFBLEdBQUcsR0FBRyxDQUFBLEFBQUMsQ0FBQyxTQUFTLEVBQUUsTUFBTSxDQUFDLGlCQUFpQixDQUFDLENBQUE7QUFDNUMsQUFBQSxHQUFHLEs7RUFBSyxDQUFBO0FBQ1IsQUFBQSxFQUFFLEdBQUcsQ0FBQyxDQUFBLE1BQUEsSUFBSSxDQUFDLEVBQUUsQ0FBQyxLQUFLLENBQUEsQ0FBQSxDQUFBO0FBQ25CLEFBQUEsR0FBRyw2Q0FBNEM7QUFDL0MsQUFBQSxHQUFHLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsQztFQUFDLEM7Q0FBQSxDO0FBQUEsQ0FBQTtBQUMvQixBQUFBO0FBQ0EsQUFBQSxBQUFBLE1BQU0sQ0FBVyxNQUFWLFVBQVUsQ0FBQyxDQUFFLENBQUMsU0FBUztBQUM5QixBQUFBO0FBQ0EsQUFBQSw4RUFBNkU7QUFDN0UsQUFBQTtBQUNBLEFBQUEsQUFBQSxNQUFNLENBQWdCLE1BQWYsZUFBZSxDQUFDLENBQUUsQ0FFYSxRLENBRlosQ0FBQztBQUMzQixBQUFBLEVBQUUsSUFBSSxDQUFDLENBQUMsTUFBTTtBQUNkLEVBQUUsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBSSxDQUFBLENBQUE7QUFDeEMsQUFBQTtBQUNBLEFBQUEsQ0FBQyxHQUFHLENBQUMsQ0FBQSxNQUFBLEdBQUcsQ0FBQyxFQUFFLENBQUMsZ0JBQWdCLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUEsQ0FBQSxDQUFBO0FBQ3pDLEFBQUEsRUFBRSxLQUFLLENBQUMsRztDQUFHLENBQUE7QUFDWCxBQUFBLENBQUMsTTtBQUFNLENBQUE7QUFDUCxBQUFBO0FBQ0EsQUFBQSw4RUFBNkU7QUFDN0UsQUFBQSxzQ0FBcUM7QUFDckMsQUFBQTtBQUNBLEFBQUEsQUFBQSxNQUFNLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUN2QixBQUFBLENBQUMsUUFBUSxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxNQUFNO0FBQzNCLEFBQUEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUFNO0FBQ2IsQUFBQSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsTUFBTTtBQUNsQixDQUFDLENBQUM7QUFDRixBQUFBO0FBQ0EsQUFBQSxBQUFBLE1BQU0sQ0FBVyxNQUFWLFVBQVUsQ0FBQyxDQUFFLENBQUMsQ0FBQztBQUN0QixBQUFBLEVBQUUsVUFBVSxDQUFDLENBQUMsTUFBTSxDQUFDO0FBQ3JCLEFBQUEsRUFBRSxRQUFRLENBQUMsQ0FBQyxNQUFNLENBQUM7QUFDbkIsQUFBQSxFQUFFLFFBQVEsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ3JCLEVBQUUsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUEsQ0FBQTtBQUNqQixBQUFBO0FBQ0EsQUFBQSxDQUFDLHNCQUFxQjtBQUN0QixBQUFBLENBQXlCLE1BQXhCLENBQUMsS0FBSyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBRSxDQUFDLFVBQVUsQ0FBQSxBQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUM7QUFDbkQsQUFBQSxFQUFFLEtBQUssQ0FBQyxDQUFDLEtBQUssQ0FBQTtBQUNkLEFBQUEsRUFBRSxLQUFLLENBQUMsQ0FBQyxLQUFLLENBQUE7QUFDZCxBQUFBLEVBQUUsUUFBUSxDQUFDLENBQUMsS0FBSztBQUNqQixFQUFFLENBQUMsQ0FBQTtBQUNILEFBQUE7QUFDQSxBQUFBLENBQUMsR0FBRyxDQUFBLENBQUksS0FBSyxDQUFBLENBQUEsQ0FBQTtBQUNiLEFBQUEsRUFBRSxZQUFZLENBQUEsQUFBQyxNQUFNLEM7Q0FBQSxDQUFBO0FBQ3JCLEFBQUEsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ3ZCLEFBQUE7QUFDQSxBQUFBLENBQVMsTUFBUixRQUFRLENBQUMsQ0FBRSxDQUFDLENBQUMsSUFB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T0FBTyxDQUFBO0FBQzVCLEFBQUEsQ0FBVSxNQUFULFNBQVMsQ0FBQyxDQUFFLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQztBQUM5QixBQUFBLENBQUMsUUFBUSxDQUFBLEFBQUMsV0FBVyxDQUFDLENBQUMsU0FBUyxDQUFBO0FBQ2hDLEFBQUEsQ0FBUSxNQUFQLE9BQU8sQ0FBQyxDQUFFLENBQUMsU0FBUyxDQUFDLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxTQUFTO0FBQzNDLEFBQUEsQ0FBQyxRQUFRLENBQUEsQUFBQyxTQUFTLENBQUMsQ0FBQyxPQUFPLENBQUE7QUFDNUIsQUFBQSxDQUFDLE1BQU0sQ0FBQSxBQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQztBQUN4QixBQUFBLEdBQUcsQ0FBQyxrQkFBa0IsRUFBRSxFQUFFLENBQUMsT0FBTyxDQUFDLENBQUMsYUFBYSxFQUFFLEVBQUUsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDaEUsQUFBQSxDQUFDLE1BQU0sQ0FBQyxPO0FBQU8sQ0FBQTtBQUNmIiwibmFtZXMiOltdLCJzb3VyY2VzQ29udGVudCI6WyIjIGZzLmxpYi5jaXZldFxuXG5pbXBvcnQge2RlYm91bmNlfSBmcm9tICdAc3RkL2FzeW5jL2RlYm91bmNlJ1xuaW1wb3J0IHtcblx0ZXhpc3RzU3luYywgZW1wdHlEaXJTeW5jLCBlbnN1cmVEaXJTeW5jLFxuXHR9IGZyb20gJ0BzdGQvZnMnXG5pbXBvcnQge1xuXHRhcHBlbmRGaWxlU3luYyxcblx0fSBmcm9tICdub2RlOmZzJ1xuaW1wb3J0IHtFdmVudEVtaXR0ZXJ9IGZyb20gJ25vZGU6ZXZlbnRzJ1xuXG4jIC0tLSBEZW5vJ3Mgc3RhdFN5bmMgYW5kIGxzdGF0U3luYyBhcmUgc3RpbGwgdW5zdGFibGUsXG4jICAgICBzbyB1c2UgdGhpc1xuaW1wb3J0IHtzdGF0U3luY30gZnJvbSAnbm9kZTpmcydcblxuaW1wb3J0IHtleHBhbmRHbG9iU3luY30gZnJvbSAnQHN0ZC9mcy9leHBhbmQtZ2xvYidcbmltcG9ydCB7VGV4dExpbmVTdHJlYW19IGZyb20gJ0BzdGQvc3RyZWFtcydcblxuIyAtLS0gVXNlIERlbm8ncyBwYXRoIGxpYnJhcnlcbmltcG9ydCB7XG5cdHBhcnNlLCByZXNvbHZlLCByZWxhdGl2ZSwgZnJvbUZpbGVVcmwsXG5cdH0gZnJvbSAnQHN0ZC9wYXRoJ1xuXG5pbXBvcnQge1xuXHR1bmRlZiwgZGVmaW5lZCwgbm90ZGVmaW5lZCwgYXNzZXJ0LCBpc0VtcHR5LCBub25FbXB0eSxcblx0aXNTdHJpbmcsIGlzTm9uRW1wdHlTdHJpbmcsIGlzQm9vbGVhbiwgaXNOdW1iZXIsIGlzSW50ZWdlcixcblx0aXNBcnJheSwgaXNBcnJheU9mU3RyaW5ncywgaXNIYXNoLCBpc09iamVjdCwgaXNSZWdFeHAsXG5cdGludGVnZXIsIGhhc2gsIHZvaWRGdW5jLFxuXHR9IGZyb20gJy4vZGF0YXR5cGVzLmxpYi50cydcbmltcG9ydCB7XG5cdGNyb2FrLCBPTCwgTUwsIGdldE9wdGlvbnMsIHJlbW92ZUVtcHR5S2V5cywgcGFzcywgaGFzS2V5LFxuXHRzcGFjZXMsIHNpbmNlTG9hZFN0ciwgc2xlZXAsIHJlbHBhdGgsXG5cdGdldEltcG9ydFN5bmMsIHJlcXVpcmUsXG5cdH0gZnJvbSAnLi9sbHV0aWxzLmxpYi50cydcbmltcG9ydCB7XG5cdHB1c2hMb2dMZXZlbCwgcG9wTG9nTGV2ZWwsIERCRywgREJHVkFMVUUsIEVSUixcblx0SU5ERU5ULCBVTkRFTlQsXG5cdH0gZnJvbSAnLi9sb2dnZXIubGliLnRzJ1xuaW1wb3J0IHtUZXh0VGFibGV9IGZyb20gJy4vdGV4dC10YWJsZS5saWIudHMnXG5pbXBvcnQge2luZGVudGVkfSBmcm9tICcuL2luZGVudC5saWIudHMnXG5pbXBvcnQge1xuXHRUUExMVG9rZW4sIGFsbFRva2Vuc0luQmxvY2ssIHRva2VuVGFibGUsXG5cdH0gZnJvbSAnLi9wbGwubGliLnRzJ1xuaW1wb3J0IHtcblx0Y2l2ZXQydHNGaWxlLFxuXHR9IGZyb20gJy4vY2l2ZXQubGliLnRzJ1xuXG5leHBvcnQge3JlbHBhdGh9XG5cbi8qKlxuICogQG1vZHVsZSBmcyAtIGZpbGUgc3lzdGVtIHV0aWxpdGllc1xuICovXG5cbiMgLS0tIENyZWF0ZSBhIGZ1bmN0aW9uIGNhcGFibGUgb2Ygc3luY2hyb25vdXNseVxuIyAgICAgaW1wb3J0aW5nIEVTTSBtb2R1bGVzXG5cbkRlbm8gOj0gZ2xvYmFsVGhpcy5EZW5vXG5cbiMgLS0tIG5vdCBleHBvcnRlZFxuZGVjb2RlciA6PSBuZXcgVGV4dERlY29kZXIoJ3V0Zi04JylcbmVuY29kZXIgOj0gbmV3IFRleHRFbmNvZGVyKClcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuLyoqXG4gKiByZXR1cm5zIGEgYm9vbGVhbiBpbmRpY2F0aW5nIGlmIHRoZSBnaXZlbiBwYXRoIGV4aXN0c1xuICogYW5kIGlzIGEgZmlsZVxuICovXG5cbmV4cG9ydCBpc0ZpbGUgOj0gKHBhdGg6IHN0cmluZyk6IGJvb2xlYW4gPT5cblxuXHRyZXR1cm4gZXhpc3RzU3luYyhwYXRoKSAmJiBzdGF0U3luYyhwYXRoKS5pc0ZpbGUoKVxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKipcbiAqIHJldHVybnMgYSBib29sZWFuIGluZGljYXRpbmcgb2YgdGhlIGdpdmVuIHBhdGggZXhpc3RzXG4gKiBhbmQgaXMgYSBkaXJlY3RvcnlcbiAqL1xuXG5leHBvcnQgaXNEaXIgOj0gKHBhdGg6IHN0cmluZyk6IGJvb2xlYW4gPT5cblxuXHRyZXR1cm4gZXhpc3RzU3luYyhwYXRoKSAmJiBzdGF0U3luYyhwYXRoKS5pc0RpcmVjdG9yeSgpXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogcmV0dXJucyBvbmUgb2Y6XG4gKiAgICAnbWlzc2luZycgIC0gZG9lcyBub3QgZXhpc3RcbiAqICAgICdkaXInICAgICAgLSBpcyBhIGRpcmVjdG9yeVxuICogICAgJ2ZpbGUnICAgICAtIGlzIGEgZmlsZVxuICogICAgJ3N5bWxpbmsnICAtIGlzIGEgc3ltbGlua1xuICogICAgJ3Vua25vd24nICAtIGV4aXN0cywgYnV0IG5vdCBhIGZpbGUsIGRpcmVjdG9yeSBvciBzeW1saW5rXG4gKi9cblxuZXhwb3J0IHR5cGUgVFBhdGhUeXBlID1cblx0J21pc3NpbmcnIHwgJ2ZpbGUnIHwgJ2RpcicgfCAnc3ltbGluaycgfCAndW5rbm93bidcblxuZXhwb3J0IGdldFBhdGhUeXBlIDo9IChwYXRoOiBzdHJpbmcpOiBUUGF0aFR5cGUgPT5cblxuXHRhc3NlcnQgaXNTdHJpbmcocGF0aCksIFwibm90IGEgc3RyaW5nOiAje09MKHBhdGgpfVwiXG5cdGlmIG5vdCBleGlzdHNTeW5jIHBhdGhcblx0XHRyZXR1cm4gJ21pc3NpbmcnXG5cdGggOj0gc3RhdFN5bmMocGF0aClcblx0cmV0dXJuIChcblx0XHQgIGguaXNGaWxlKCkgICAgICAgICA/ICdmaWxlJ1xuXHRcdDogaC5pc0RpcmVjdG9yeSgpICAgID8gJ2Rpcidcblx0XHQ6IGguaXNTeW1ib2xpY0xpbmsoKSA/ICdzeW1saW5rJ1xuXHRcdDogICAgICAgICAgICAgICAgICAgICAgJ3Vua25vd24nXG5cdFx0KVxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKipcbiAqIGV4dHJhY3QgdGhlIGZpbGUgZXh0ZW5zaW9uIGZyb20gYSBwYXRoLCBpbmNsdWRpbmdcbiAqIHRoZSBsZWFkaW5nIHBlcmlvZFxuICovXG5cbmV4cG9ydCBmaWxlRXh0IDo9IChwYXRoOiBzdHJpbmcpOiBzdHJpbmcgPT5cblxuXHRpZiBsTWF0Y2hlcyA6PSBwYXRoLm1hdGNoKC9cXC5bXlxcLl0rJC8pXG5cdFx0cmV0dXJuIGxNYXRjaGVzWzBdXG5cdGVsc2Vcblx0XHRyZXR1cm4gJydcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuLyoqXG4gKiByZXR1cm4gdGhlIGdpdmVuIHBhdGgsIGJ1dCB3aXRoIHRoZSBnaXZlbiBmaWxlIGV4dGVuc2lvblxuICogcmVwbGFjaW5nIHRoZSBleGlzdGluZyBmaWxlIGV4dGVuc2lvblxuICovXG5cbmV4cG9ydCB3aXRoRXh0IDo9IChwYXRoOiBzdHJpbmcsIGV4dDogc3RyaW5nKTogc3RyaW5nID0+XG5cblx0YXNzZXJ0IGlzTm9uRW1wdHlTdHJpbmcocGF0aCksIFwicGF0aCA9ICN7T0wocGF0aCl9XCJcblx0YXNzZXJ0IGV4dC5zdGFydHNXaXRoKCcuJyksIFwiQmFkIGZpbGUgZXh0ZW5zaW9uOiAje2V4dH1cIlxuXHRsTWF0Y2hlcyA6PSBwYXRoLm1hdGNoKC9eKC4qKShcXC5bXlxcLl0rKSQvKVxuXHRpZiAobE1hdGNoZXMgPT0gbnVsbClcblx0XHR0aHJvdyBuZXcgRXJyb3IoXCJCYWQgcGF0aDogJyN7cGF0aH0nXCIpXG5cdFtfLCBoZWFkU3RyLCBvcmdFeHRdIDo9IGxNYXRjaGVzXG5cdHJldHVybiBcIiN7aGVhZFN0cn0je2V4dH1cIlxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG5leHBvcnQgbFN0YXRGaWVsZHM6IHN0cmluZ1tdIDo9IFtcblx0J2RldicsJ2lubycsJ21vZGUnLCdubGluaycsJ3VpZCcsJ2dpZCcsJ3JkZXYnLFxuXHQnc2l6ZScsJ2Jsa3NpemUnLCdibG9ja3MnLFxuXHQnYXRpbWVNcycsJ210aW1lTXMnLCdjdGltZU1zJywnYmlydGh0aW1lTXMnLFxuXHQnYXRpbWUnLCdtdGltZScsJ2N0aW1lJywnYmlydGh0aW1lJyxcblx0XVxuXG4vKipcbiAqIHJldHVybiBzdGF0aXN0aWNzIGZvciBhIGZpbGUgb3IgZGlyZWN0b3J5XG4gKi9cblxuZXhwb3J0IGdldFN0YXRzIDo9IChwYXRoOiBzdHJpbmcpOiBoYXNoID0+XG5cblx0cmV0dXJuIHN0YXRTeW5jKHBhdGgpXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbmV4cG9ydCBpc1N0dWIgOj0gKHN0cjogc3RyaW5nKTogYm9vbGVhbiA9PlxuXG5cdCMgLS0tIGEgc3R1YiBjYW5ub3QgY29udGFpbiBhbnkgb2YgJ1xcXFwnLCAnLydcblx0cmV0dXJuIG5vdGRlZmluZWQoc3RyLm1hdGNoKC9bXFxcXFxcL10vKSkgJiYgKHN0clswXSAhPSAnLicpXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogcGFyc2VzIGEgcGF0aCBvciBmaWxlIFVSTCwgYW5kIHJldHVybnMgYSBoYXNoIHdpdGgga2V5czpcbiAqIFx0dHlwZTogVFBhdGhUeXBlIC0gJ2ZpbGUnLCdkaXInLCdzeW1saW5rJywnbWlzc2luZycgb3IgJ3Vua25vd24nXG4gKiBcdHBhdGg6IHN0cmluZ1xuICogXHRyb290OiBzdHJpbmdcbiAqIFx0ZGlyOiBzdHJpbmdcbiAqIFx0ZmlsZU5hbWU6IHN0cmluZ1xuICogXHRzdHViOiBzdHJpbmc/XG4gKiBcdHB1cnBvc2U6IHN0cmluZz9cbiAqIFx0ZXh0OiBzdHJpbmc/XG4gKiBcdHJlbFBhdGg6IHN0cmluZ1xuICogXHRyZWxEaXI6IHN0cmluZ1xuICovXG5cbmV4cG9ydCB0eXBlIFRQYXRoSW5mbyA9IHtcblx0dHlwZTogVFBhdGhUeXBlICAjICdmaWxlJywnZGlyJywnc3ltbGluaycsJ21pc3NpbmcnIG9yICd1bmtub3duJ1xuXHRwYXRoOiBzdHJpbmdcblx0cm9vdDogc3RyaW5nXG5cdGRpcjogc3RyaW5nXG5cdGZpbGVOYW1lOiBzdHJpbmdcblx0c3R1Yjogc3RyaW5nP1xuXHRwdXJwb3NlOiBzdHJpbmc/XG5cdGV4dDogc3RyaW5nP1xuXHRyZWxQYXRoOiBzdHJpbmdcblx0cmVsRGlyOiBzdHJpbmdcblx0fVxuXG5leHBvcnQgcGFyc2VQYXRoIDo9IChwYXRoOiBzdHJpbmcpOiBUUGF0aEluZm8gPT5cblxuXHQjIC0tLSBOT1RFOiBwYXRoIG1heSBiZSBhIGZpbGUgVVJMLCBlLmcuIGltcG9ydC5tZXRhLnVybFxuXHQjICAgICAgICAgICBwYXRoIG1heSBiZSBhIHJlbGF0aXZlIHBhdGhcblxuXHRhc3NlcnQgaXNOb25FbXB0eVN0cmluZyhwYXRoKSwgXCJwYXRoIG5vdCBhIHN0cmluZyAje09MKHBhdGgpfVwiXG5cdGlmIGRlZmluZWQocGF0aC5tYXRjaCgvXmZpbGVcXDpcXC9cXC8vKSlcblx0XHRwYXRoID0gZnJvbUZpbGVVcmwocGF0aClcblx0cGF0aCA9IG1rcGF0aCBwYXRoXG5cblx0e3Jvb3QsIGRpciwgYmFzZTogZmlsZU5hbWV9IDo9IHBhcnNlKHBhdGgpXG5cblx0bFBhcnRzIDo9IGZpbGVOYW1lLnNwbGl0KCcuJylcblx0W3N0dWIsIHB1cnBvc2UsIGV4dF0gOj0gc3dpdGNoIGxQYXJ0cy5sZW5ndGhcblx0XHR3aGVuIDBcblx0XHRcdGNyb2FrIFwiQ2FuJ3QgaGFwcGVuXCJcblx0XHR3aGVuIDFcblx0XHRcdFtmaWxlTmFtZSwgdW5kZWYsIHVuZGVmXVxuXHRcdHdoZW4gMlxuXHRcdFx0W2xQYXJ0c1swXSwgdW5kZWYsIFwiLiN7bFBhcnRzWzFdfVwiXVxuXHRcdGVsc2Vcblx0XHRcdFtcblx0XHRcdFx0bFBhcnRzLnNsaWNlKDAsIC0yKS5qb2luKCcuJyksXG5cdFx0XHRcdGxQYXJ0cy5hdCgtMiksXG5cdFx0XHRcdFwiLiN7bFBhcnRzLmF0KC0xKX1cIlxuXHRcdFx0XHRdXG5cblx0IyAtLS0gR3JhYiBldmVyeXRoaW5nIHVwIHVudGlsIHRoZSBsYXN0IHBhdGggc2VwYXJhdG9yLCBpZiBhbnlcblx0cmVsUGF0aCA6PSByZWxwYXRoIHBhdGhcblx0bFBhdGhNYXRjaGVzIDo9IHJlbFBhdGgubWF0Y2goL14oLiopW1xcXFxcXC9dW15cXFxcXFwvXSokLylcblx0cmVsRGlyIDo9IChsUGF0aE1hdGNoZXMgPT0gbnVsbCkgPyAnLicgOiBsUGF0aE1hdGNoZXNbMV1cblxuXHRyZXR1cm4ge1xuXHRcdHR5cGU6IGdldFBhdGhUeXBlKHBhdGgpXG5cdFx0cGF0aFxuXHRcdHJvb3Rcblx0XHRkaXJcblx0XHRmaWxlTmFtZVxuXHRcdHN0dWJcblx0XHRwdXJwb3NlXG5cdFx0ZXh0XG5cdFx0cmVsUGF0aFxuXHRcdHJlbERpclxuXHRcdH1cblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiMgR0VORVJBVE9SXG5cbi8qKlxuICogZ2VuZXJhdGUgZmlsZXMgdGhhdCBtYXRjaCBhIGdpdmVuIGdsb2IgcGF0dGVyblxuICogeWllbGRzIGEgaGFzaCB3aXRoIGtleXM6XG4gKiAgICB0eXBlICAgICAtICdmaWxlJywgJ2RpcicsICdzeW1saW5rJywgJ3Vua25vd24nXG4gKiAgICByb290ICAgICAtIGUuZy4gJ0M6LydcbiAqICAgIGZpbGVOYW1lXG4gKiAgICBzdHViXG4gKiAgICBwdXJwb3NlXG4gKiAgICBleHRcbiAqICAgIHJlbFBhdGggICAtIHJlbGF0aXZlIHRvIHdvcmtpbmcgZGlyLCBubyBsZWFkaW5nIC4gb3IgLi5cbiAqIFRoZXNlIG9wdGlvbnMgbWF5IGJlIHNwZWNpZmllZCBpbiB0aGUgMm5kIHBhcmFtZXRlcjpcbiAqICAgIHJvb3Q6IHN0cmluZyAtIHJvb3Qgb2Ygc2VhcmNoLCAoZGVmOiBEZW5vLmN3ZCgpKVxuICogICAgbEV4Y2x1ZGU6IFtzdHJpbmddIC0gcGF0dGVybnMgdG8gZXhjbHVkZSxcbiAqICAgIFx0ZGVmOiBbJ25vZGVfbW9kdWxlcy8qKicsICcuZ2l0LyoqJ11cbiAqICAgIGluY2x1ZGVEaXJzOiBib29sZWFuIC0gc2hvdWxkIGRpcmVjdG9yaWVzIGJlIGluY2x1ZGVkPyAoZGVmOiB0cnVlKVxuICogXHRmb2xsb3dTeW1saW5rcyAtIGJvb2xlYW4gLSBzaG91bGQgc3ltIGxpbmtzIGJlIGZvbGxvd2VkPyAoZGVmOiBmYWxzZSlcbiAqIFx0Y2Fub25pY2FsaXplOiBib29sZWFuIC0gaWYgZm9sbG93c3ltbGlua3MgaXMgdHJ1ZSwgc2hvdWxkXG4gKiBcdFx0cGF0aHMgYmUgY2Fub25pY2FsaXplZD8gKGRlZjogdHJ1ZSlcbiAqIFx0ZmlsdGVyOiAoc3RyaW5nID0+IGFueT8pIC0gaWdub3JlIGlmIHVuZGVmIHJldHVybmVkLFxuICogICAgICAgZWxzZSB5aWVsZCB0aGUgcmV0dXJuZWQgdmFsdWVcbiAqXG4gKiBHbG9iIHBhdHRlcm46XG4gKiBcdCogICAgICAgICBtYXRjaCBhbnkgbnVtYmVyIG9mIGNoYXJzLCBleGNlcHQgcGF0aCBzZXBhcmF0b3JcbiAqIFx0KiogICAgICAgIG1hdGNoIHplcm8gb3IgbW9yZSBkaXJlY3Rvcmllc1xuICogXHQ/ICAgICAgICAgbWF0Y2ggYW55IHNpbmdsZSBjaGFyLCBleGNlcHQgcGF0aCBzZXBhcmF0b3JcbiAqIFx0LyAgICAgICAgIHBhdGggc2VwYXJhdG9yXG4gKiBcdFthYmNdICAgICBtYXRjaCBvbmUgY2hhciBpbiB0aGUgYnJhY2tldHNcbiAqIFx0WyFhYmNdICAgIG1hdGNoIG9uZSBjaGFyIG5vdCBpbiB0aGUgYnJhY2tldHNcbiAqIFx0e2FiYywxMjN9IGNvbW1hLXNlcGFyYXRlZCBsaXN0IG9mIGxpdGVyYWxzIHRvIG1hdGNoXG4gKi9cblxuZXhwb3J0IGFsbEZpbGVzTWF0Y2hpbmcgOj0gKFxuXHRwYXR0ZXJuOiBzdHJpbmc9JyoqJyxcblx0aE9wdGlvbnM6IGhhc2g9e31cblx0KTogR2VuZXJhdG9yPGFueSwgdm9pZCwgdm9pZD4gLT5cblxuXHR7XG5cdFx0cm9vdCxcblx0XHRsRXhjbHVkZSxcblx0XHRpbmNsdWRlRGlycyxcblx0XHRmb2xsb3dTeW1saW5rcyxcblx0XHRjYW5vbmljYWxpemUsXG5cdFx0ZmlsdGVyLFxuXHRcdGRlYnVnXG5cdFx0fSA6PSBnZXRPcHRpb25zIGhPcHRpb25zLCB7XG5cdFx0XHRyb290OiB1bmRlZlxuXHRcdFx0bEV4Y2x1ZGU6IFtcblx0XHRcdFx0J25vZGVfbW9kdWxlcy8qKidcblx0XHRcdFx0Jy5naXQvKionXG5cdFx0XHRcdCcqKi8qLnRlbXAuKidcblx0XHRcdFx0XVxuXHRcdFx0aW5jbHVkZURpcnM6IGZhbHNlXG5cdFx0XHRmb2xsb3dTeW1saW5rczogZmFsc2Vcblx0XHRcdGNhbm9uaWNhbGl6ZTogZmFsc2Vcblx0XHRcdGZpbHRlcjogdW5kZWZcblx0XHRcdGRlYnVnOiBmYWxzZVxuXHRcdFx0fVxuXG5cdGhHbG9iT3B0aW9ucyA6PSB7XG5cdFx0cm9vdFxuXHRcdGV4Y2x1ZGU6IGxFeGNsdWRlXG5cdFx0aW5jbHVkZURpcnNcblx0XHRmb2xsb3dTeW1saW5rc1xuXHRcdGNhbm9uaWNhbGl6ZVxuXHRcdH1cblxuXHREQkcgOj0gKG1zZzogc3RyaW5nKTogdm9pZCA9PlxuXHRcdGlmIGRlYnVnXG5cdFx0XHRjb25zb2xlLmxvZyBtc2dcblx0XHRyZXR1cm5cblxuXHRmb3IgaCBvZiBleHBhbmRHbG9iU3luYyhwYXR0ZXJuLCBoR2xvYk9wdGlvbnMpXG5cdFx0IyAtLS0gaCBoYXMga2V5czogcGF0aCwgbmFtZSwgaXNGaWxlLCBpc0RpcmVjdG9yeSwgaXNTeW1MaW5rXG5cblx0XHREQkcgXCJNQVRDSDogI3toLnBhdGh9XCJcblx0XHR0eXBlIDo9IChcblx0XHRcdCAgaC5pc0ZpbGUgICAgICA/ICdmaWxlJ1xuXHRcdFx0OiBoLmlzRGlyZWN0b3J5ID8gJ2Rpcidcblx0XHRcdDogaC5pc1N5bWxpbmsgICA/ICdzeW1saW5rJ1xuXHRcdFx0OiAgICAgICAgICAgICAgICAgJ3Vua25vd24nXG5cdFx0XHQpXG5cdFx0aEZpbGUgOj0gcGFyc2VQYXRoKGgucGF0aClcblx0XHRpZiBub3RkZWZpbmVkKGZpbHRlcilcblx0XHRcdERCRyBcIiAgIC0gbm8gZmlsdGVyXCJcblx0XHRcdHlpZWxkIGhGaWxlXG5cdFx0ZWxzZVxuXHRcdFx0cmVzdWx0OiBhbnk/IDo9IGZpbHRlcihoRmlsZSlcblx0XHRcdGlmIG5vdGRlZmluZWQocmVzdWx0KVxuXHRcdFx0XHREQkcgXCIgICAtIGV4Y2x1ZGVkIGJ5IGZpbHRlclwiXG5cdFx0XHRlbHNlXG5cdFx0XHRcdERCRyBcIiAgIC0gYWxsb3dlZCBieSBmaWx0ZXJcIlxuXHRcdFx0XHR5aWVsZCByZXN1bHRcblx0cmV0dXJuXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4jIEFTWU5DIEdFTkVSQVRPUlxuXG4vKipcbiAqIEFuIGFzeW5jIGl0ZXJhYmxlIC0geWllbGRzIGV2ZXJ5IGxpbmUgaW4gdGhlIGdpdmVuIGZpbGVcbiAqXG4gKiBVc2FnZTpcbiAqICAgZm9yIGF3YWl0IGxpbmUgb2YgYWxsTGluZXNJbignc3JjL2xpYi90ZW1wLmNpdmV0JylcbiAqIFx0ICBjb25zb2xlLmxvZyBcIkxJTkU6ICN7bGluZX1cIlxuICogICBjb25zb2xlLmxvZyBcIkRPTkVcIlxuICovXG5cbmV4cG9ydCBhbGxMaW5lc0luIDo9IChcblx0cGF0aDogc3RyaW5nXG5cdCk6IEFzeW5jR2VuZXJhdG9yPHN0cmluZywgdm9pZCwgdm9pZD4gLT5cblxuXHRhc3NlcnQgaXNGaWxlKHBhdGgpLCBcIk5vIHN1Y2ggZmlsZTogI3tPTChwYXRoKX0gKGFsbExpbmVzSW4pXCJcblx0ZiA6PSBhd2FpdCBEZW5vLm9wZW4ocGF0aClcblx0cmVhZGFibGUgOj0gZi5yZWFkYWJsZVxuXHRcdC5waXBlVGhyb3VnaChuZXcgVGV4dERlY29kZXJTdHJlYW0oKSlcblx0XHQucGlwZVRocm91Z2gobmV3IFRleHRMaW5lU3RyZWFtKCkpXG5cblx0Zm9yIGF3YWl0IGxpbmUgb2YgcmVhZGFibGVcblx0XHR5aWVsZCBsaW5lXG5cdHJldHVyblxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKipcbiAqIGNvbnZlcnRzIGFsbCBiYWNrc2xhc2ggY2hhcmFjdGVycyB0byBmb3J3YXJkIHNsYXNoZXNcbiAqIHVwcGVyLWNhc2VzIGRyaXZlIGxldHRlcnNcbiAqL1xuXG5leHBvcnQgbm9ybWFsaXplUGF0aCA6PSAocGF0aDogc3RyaW5nKTogc3RyaW5nID0+XG5cblx0bnBhdGggOj0gcGF0aC5yZXBsYWNlQWxsKCdcXFxcJywgJy8nKVxuXHRpZiAobnBhdGguY2hhckF0KDEpID09ICc6Jylcblx0XHRyZXR1cm4gbnBhdGguY2hhckF0KDApLnRvVXBwZXJDYXNlKCkgKyBucGF0aC5zdWJzdHJpbmcoMSlcblx0ZWxzZVxuXHRcdHJldHVybiBucGF0aFxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG5leHBvcnQgcGF0aFRvVVJMIDo9IChsUGFydHMuLi46IHN0cmluZ1tdKTogc3RyaW5nID0+XG5cblx0cGF0aCA6PSByZXNvbHZlKGxQYXJ0cy4uLilcblx0cmV0dXJuIG5ldyBVUkwoJ2ZpbGU6Ly8nICsgcGF0aCkuaHJlZlxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKipcbiAqIHJlc29sdmVzIG11bHRpcGxlIHBhdGggcGFydHMgdG8gYSBzaW5nbGUgcGF0aFxuICogcmV0dXJucyBub3JtYWxpemVkIHBhdGhcbiAqL1xuXG5leHBvcnQgbWtwYXRoIDo9IChsUGFydHMuLi46IHN0cmluZ1tdKTogc3RyaW5nID0+XG5cblx0cGF0aCA6PSByZXNvbHZlKGxQYXJ0cy4uLilcblx0cmV0dXJuIG5vcm1hbGl6ZVBhdGgocGF0aClcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuZXhwb3J0IHR5cGUgVFBhdGhEZXNjID0ge1xuXHRkaXI6IHN0cmluZ1xuXHRyb290OiBzdHJpbmdcblx0bFBhcnRzOiBzdHJpbmdbXVxuXHR9XG5cbi8qKlxuICogcmV0dXJucyB7ZGlyLCByb290LCBsUGFydHN9IHdoZXJlIGxQYXJ0cyBpbmNsdWRlcyB0aGUgbmFtZXMgb2ZcbiAqIGFsbCBkaXJlY3RvcmllcyBiZXR3ZWVuIHRoZSByb290IGFuZCB0aGUgZmlsZSBuYW1lXG4gKiByZWxhdGl2ZSB0byB0aGUgY3VycmVudCB3b3JraW5nIGRpcmVjdG9yeVxuICovXG5cbmV4cG9ydCBwYXRoU3ViRGlycyA6PSAocGF0aDogc3RyaW5nLCBoT3B0aW9uczogaGFzaD17fSk6IFRQYXRoRGVzYyA9PlxuXG5cdHtyZWxhdGl2ZX0gOj0gZ2V0T3B0aW9ucyBoT3B0aW9ucywge1xuXHRcdHJlbGF0aXZlOiBmYWxzZVxuXHRcdH1cblx0cGF0aCA9IHJlbGF0aXZlID8gcmVscGF0aChwYXRoKSA6IG1rcGF0aChwYXRoKVxuXHR7cm9vdCwgZGlyfSA6PSBwYXJzZShwYXRoKVxuXHRyZXR1cm4ge1xuXHRcdGRpclxuXHRcdHJvb3Rcblx0XHRsUGFydHM6IGRpci5zbGljZShyb290Lmxlbmd0aCkuc3BsaXQoL1tcXFxcXFwvXS8pXG5cdFx0fVxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuIyAtLS0gU2hvdWxkIGJlIGNhbGxlZCBsaWtlOiBteXNlbGYoaW1wb3J0Lm1ldGEudXJsKVxuIyAgICAgcmV0dXJucyBmdWxsIHBhdGggb2YgY3VycmVudCBmaWxlXG5cbmV4cG9ydCBteXNlbGYgOj0gKHVybDogc3RyaW5nKTogc3RyaW5nID0+XG5cblx0cmV0dXJuIHJlbHBhdGggZnJvbUZpbGVVcmwodXJsKVxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuLyoqXG4gKiByZWFkIGEgZmlsZSBpbnRvIGEgc3RyaW5nXG4gKi9cblxuZXhwb3J0IHNsdXJwIDo9IChwYXRoOiBzdHJpbmcpOiBzdHJpbmcgPT5cblxuXHRhc3NlcnQgaXNGaWxlKHBhdGgpLCBcIk5vIHN1Y2ggZmlsZTogI3tyZXNvbHZlKHBhdGgpfSAoc2x1cnApXCJcblx0ZGF0YSA6PSBEZW5vLnJlYWRGaWxlU3luYyBwYXRoXG5cdHJldHVybiBkZWNvZGVyLmRlY29kZShkYXRhKS5yZXBsYWNlQWxsKCdcXHInLCAnJylcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuLyoqXG4gKiB3cml0ZSBhIHN0cmluZyB0byBhIGZpbGVcbiAqIHdpbGwgZW5zdXJlIHRoYXQgYWxsIG5lY2Vzc2FyeSBkaXJlY3RvcmllcyBleGlzdFxuICovXG5cbmV4cG9ydCBiYXJmIDo9IChcblx0XHRwYXRoOiBzdHJpbmcsXG5cdFx0Y29udGVudHM6IHN0cmluZyxcblx0XHRoT3B0aW9uczogaGFzaCA9IHt9XG5cdFx0KTogdm9pZCA9PlxuXG5cdHthcHBlbmR9IDo9IGdldE9wdGlvbnMgaE9wdGlvbnMsIHtcblx0XHRhcHBlbmQ6IGZhbHNlXG5cdFx0fVxuXHRta0RpcnNGb3JGaWxlKHBhdGgpXG5cdGRhdGEgOj0gZW5jb2Rlci5lbmNvZGUoY29udGVudHMpXG5cdGlmIGFwcGVuZCAmJiBpc0ZpbGUocGF0aClcblx0XHRhcHBlbmRGaWxlU3luYyBwYXRoLCBkYXRhXG5cdGVsc2Vcblx0XHREZW5vLndyaXRlRmlsZVN5bmMgcGF0aCwgZGF0YVxuXHRyZXR1cm5cblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuZXhwb3J0IGJhcmZUZW1wRmlsZSA6PSAoXG5cdFx0Y29udGVudHM6IHN0cmluZ1xuXHRcdGhPcHRpb25zOiBoYXNoID0ge31cblx0XHQpOiBzdHJpbmcgPT5cblxuXHR7ZXh0fSA6PSBnZXRPcHRpb25zIGhPcHRpb25zLCB7XG5cdFx0ZXh0OiAnLmNpdmV0J1xuXHRcdH1cblx0dGVtcEZpbGVQYXRoIDo9IERlbm8ubWFrZVRlbXBGaWxlU3luYyB7c3VmZml4OiBleHR9XG5cdGJhcmYgdGVtcEZpbGVQYXRoLCBjb250ZW50c1xuXHRyZXR1cm4gdGVtcEZpbGVQYXRoXG5cblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuZXhwb3J0IG5ld2VyRGVzdEZpbGVFeGlzdHMgOj0gKFxuXHRzcmNQYXRoOiBzdHJpbmcsXG5cdGRlc3RQYXRoOiBzdHJpbmdcblx0KTogYm9vbGVhbiA9PlxuXG5cdGFzc2VydCBpc0ZpbGUoc3JjUGF0aCksIFwiTm8gc3VjaCBmaWxlOiAje09MKHNyY1BhdGgpfSAobmV3ZXJEZXN0RmlsZUV4aXN0cylcIlxuXHRpZiBub3QgZXhpc3RzU3luYyhkZXN0UGF0aClcblx0XHRyZXR1cm4gZmFsc2Vcblx0c3JjTW9kVGltZSA6PSBzdGF0U3luYyhzcmNQYXRoKS5tdGltZU1zXG5cdGRlc3RNb2RUaW1lIDo9IHN0YXRTeW5jKGRlc3RQYXRoKS5tdGltZU1zXG5cdHJldHVybiAoZGVzdE1vZFRpbWUgPiBzcmNNb2RUaW1lKVxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKipcbiAqIGNyZWF0ZSBhIG5ldyBkaXJlY3RvcnkgaWYgaXQgZG9lc24ndCBleGlzdFxuICogaWYgdGhlIG9wdGlvbiAnY2xlYXInIGlzIHNldCB0byBhIHRydWUgdmFsdWUgaW4gdGhlIDJuZCBwYXJhbWV0ZXJcbiAqIGFuZCB0aGUgZGlyZWN0b3J5IGFscmVhZHkgZXhpc3RzLCBpdCBpcyBjbGVhcmVkXG4gKi9cblxuZXhwb3J0IG1rRGlyIDo9IChcblx0XHRkaXJQYXRoOiBzdHJpbmcsXG5cdFx0Y2xlYXI6IGJvb2xlYW49ZmFsc2Vcblx0XHQpOiB2b2lkID0+XG5cblx0aWYgY2xlYXJcblx0XHRlbXB0eURpclN5bmMgZGlyUGF0aCAgICAjIC0tLSBjcmVhdGVzIGlmIGl0IGRvZXNuJ3QgZXhpc3Rcblx0ZWxzZVxuXHRcdGVuc3VyZURpclN5bmMgZGlyUGF0aFxuXHRyZXR1cm5cblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuLyoqXG4gKiByZW1vdmUgYSBmaWxlIGZyb20gdGhlIGZpbGUgc3lzdGVtLCBidXQgZG8gbm90aGluZ1xuICogaWYgdGhlIGZpbGUgZG9lcyBub3QgZXhpc3RcbiAqL1xuXG5leHBvcnQgcm1GaWxlIDo9IChwYXRoOiBzdHJpbmcpOiB2b2lkID0+XG5cblx0aWYgZXhpc3RzU3luYyBwYXRoXG5cdFx0RGVuby5yZW1vdmVTeW5jIHBhdGhcblx0cmV0dXJuXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogcmVtb3ZlIGEgZGlyZWN0b3J5IGZyb20gdGhlIGZpbGUgc3lzdGVtLCBidXQgZG8gbm90aGluZ1xuICogaWYgdGhlIGRpcmVjdG9yeSBkb2VzIG5vdCBleGlzdFxuICogTk9URTogWW91IG11c3QgcGFzcyB0aGUgJ2NsZWFyJyBvcHRpb24gaWYgdGhlIGRpcmVjdG9yeVxuICogICAgICAgaXMgbm90IGVtcHR5XG4gKi9cblxuZXhwb3J0IHJtRGlyIDo9IChwYXRoOiBzdHJpbmcsIGhPcHRpb25zOiBoYXNoPXt9KTogdm9pZCA9PlxuXG5cdHtjbGVhcn0gOj0gZ2V0T3B0aW9ucyBoT3B0aW9ucywge1xuXHRcdGNsZWFyOiBmYWxzZVxuXHRcdH1cblx0aWYgZXhpc3RzU3luYyBwYXRoXG5cdFx0aWYgY2xlYXJcblx0XHRcdERlbm8ucmVtb3ZlU3luYyBwYXRoLCB7cmVjdXJzaXZlOiB0cnVlfVxuXHRcdGVsc2Vcblx0XHRcdERlbm8ucmVtb3ZlU3luYyBwYXRoXG5cdHJldHVyblxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKipcbiAqIGNyZWF0ZSBhbnkgbWlzc2luZyBkaXJlY3RvcmllcyBpbiB0aGUgZ2l2ZW4gcGF0aFxuICovXG5cbmV4cG9ydCBta0RpcnNGb3JGaWxlIDo9IChwYXRoOiBzdHJpbmcpOiB2b2lkID0+XG5cblx0e3Jvb3QsIGxQYXJ0c30gOj0gcGF0aFN1YkRpcnMocGF0aClcblx0bGV0IGRpciA9IHJvb3Rcblx0Zm9yIHBhcnQgb2YgbFBhcnRzXG5cdFx0ZGlyICs9IFwiLyN7cGFydH1cIlxuXHRcdGlmIG5vdCBpc0RpcihkaXIpXG5cdFx0XHRta0RpciBkaXJcblx0cmV0dXJuXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogZGVsZXRlcyBhbGwgZmlsZXMgYW5kIHN1YmRpcmVjdG9yaWVzIGluIHRoZSBnaXZlbiBkaXJlY3RvcnlcbiAqL1xuXG5leHBvcnQgY2xlYXJEaXIgOj0gKGRpclBhdGg6IHN0cmluZyk6IHZvaWQgPT5cblxuXHRlbXB0eURpclN5bmMgZGlyUGF0aFxuXHRyZXR1cm5cblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiMgLS0tIGhPcHRpb25zIGdldHMgcGFzc2VkIHRvIGFsbEZpbGVzTWF0Y2hpbmcoKVxuXG5leHBvcnQgcmVtb3ZlRmlsZXNNYXRjaGluZyA6PSAoXG5cdHBhdHRlcm46IHN0cmluZyxcblx0aE9wdGlvbnM6IGhhc2g9e31cblx0KTogdm9pZCA9PlxuXG5cdGFzc2VydCAocGF0dGVybiAhPSAnKicpICYmIChwYXR0ZXJuICE9ICcqKicpLFxuXHRcdFwiQ2FuJ3QgZGVsZXRlIGZpbGVzIG1hdGNoaW5nICN7T0wocGF0dGVybil9XCJcblx0Zm9yIHtyZWxQYXRofSBvZiBhbGxGaWxlc01hdGNoaW5nKHBhdHRlcm4sIGhPcHRpb25zKVxuXHRcdERlbm8ucmVtb3ZlU3luYyByZWxQYXRoXG5cdHJldHVyblxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG5leHBvcnQgcmVtb3ZlRmlsZXNFeGNlcHQgOj0gKFxuXHRwYXR0ZXJuOiBzdHJpbmcsXG5cdGxLZWVwOiBzdHJpbmdbXSxcblx0aE9wdGlvbnM6IGhhc2ggPSB7fVxuXHQpOiB2b2lkID0+XG5cblx0e2RlYnVnfSA6PSBnZXRPcHRpb25zIGhPcHRpb25zLCB7XG5cdFx0ZGVidWc6IGZhbHNlXG5cdFx0fVxuXHREQkcgOj0gKG1zZzogc3RyaW5nKTogdm9pZCA9PlxuXHRcdGlmIGRlYnVnXG5cdFx0XHRjb25zb2xlLmxvZyBtc2dcblx0XHRyZXR1cm5cblxuXHQjIC0tLSB0cnV0aHkgcmV0dXJuIG1lYW5zIHJlbW92ZSBpdFxuXHRmaWx0ZXIgOj0gKGhGaWxlOiBUUGF0aEluZm8pOiBUUGF0aEluZm8/ID0+XG5cdFx0e3R5cGUsIHJlbFBhdGh9IDo9IGhGaWxlXG5cdFx0aWYgKHR5cGUgIT0gJ2ZpbGUnKVxuXHRcdFx0cmV0dXJuIHVuZGVmXG5cdFx0cmVtb3ZlRmlsZSA6PSBub3QgbEtlZXAuaW5jbHVkZXMocmVsUGF0aClcblx0XHREQkcgXCJmaWx0ZXIoI3tyZWxQYXRofSk6IHJlbW92ZUZpbGUgPSAje3JlbW92ZUZpbGV9XCJcblx0XHRyZXR1cm4gcmVtb3ZlRmlsZSA/IGhGaWxlIDogdW5kZWZcblxuXHRoOiBoYXNoIDo9IHtmaWx0ZXIsIGRlYnVnfVxuXHRmb3Ige3JlbFBhdGh9IG9mIGFsbEZpbGVzTWF0Y2hpbmcocGF0dGVybiwgaClcblx0XHREQkcgXCJSRU1PVkUgRklMRSAje3JlbFBhdGh9XCJcblx0XHREZW5vLnJlbW92ZVN5bmMgcmVsUGF0aFxuXHRyZXR1cm5cblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuZXhwb3J0IHR5cGUgVEZzQ2hhbmdlVHlwZSA9IHtcblx0a2luZDogc3RyaW5nXG5cdHBhdGg6IHN0cmluZ1xuXHRtcz86IG51bWJlclxuXHR9XG5cbi8qKlxuICogdHlwZSBURnNDYWxsYmFja0Z1bmMgLSBhIGZ1bmN0aW9uIHRha2luZyAodHlwZSwgcGF0aCkgYW5kIG9wdGlvbmFsbHlcbiAqIHJldHVybnMgYSBmdW5jdGlvbiByZWZlcmVuY2UgdG8gYmUgY2FsbGVkIG9uIGZpbGUgY2hhbmdlc1xuICovXG5cbmV4cG9ydCB0eXBlIFRGc0NhbGxiYWNrRnVuYyA9IChjaGFuZ2U6IFRGc0NoYW5nZVR5cGUpID0+IHZvaWRcblxuLyoqXG4gKiBjbGFzcyBGaWxlRXZlbnRIYW5kbGVyXG4gKiAgICBoYW5kbGVzIGZpbGUgY2hhbmdlZCBldmVudHMgd2hlbiAuaGFuZGxlKHtraW5kLCBwYXRofSkgaXMgY2FsbGVkXG4gKiAgICBjYWxsYmFjayBpcyBhIGZ1bmN0aW9uLCBkZWJvdW5jZWQgYnkgMjAwIG1zXG4gKiAgICAgICB0aGF0IHRha2VzICh0eXBlLCBwYXRoKSBhbmQgcmV0dXJucyBhIHZvaWRGdW5jXG4gKiAgICAgICB3aGljaCB3aWxsIGJlIGNhbGxlZCBpZiB0aGUgY2FsbGJhY2sgcmV0dXJucyBhIGZ1bmN0aW9uIHJlZmVyZW5jZVxuICogW3VuaXQgdGVzdHNdKC4uL3Rlc3QvZnMudGVzdC5jaXZldCM6fjp0ZXh0PSUyMyUyMCUyRCUyRCUyRCUyMGNsYXNzJTIwRmlsZUV2ZW50SGFuZGxlcilcbiAqL1xuXG5leHBvcnQgY2xhc3MgRmlsZUV2ZW50SGFuZGxlclxuXG5cdGNhbGxiYWNrOiBURnNDYWxsYmFja0Z1bmM/XG5cdGxDaGFuZ2VzOiBURnNDaGFuZ2VUeXBlW10gOj0gW11cblx0aEhhbmRsZXJzOiBoYXNoID0ge30gICAjIC0tLSBwYXRoID0+IGV2ZW50IHR5cGUgPT4gZGVib3VuY2VkIGhhbmRsZXJcblx0b25TdG9wOiAoKSA9PiB2b2lkID0gcGFzc1xuXHRtczogbnVtYmVyXG5cdGRlYnVnOiBib29sZWFuXG5cblx0Y29uc3RydWN0b3IoXG5cdFx0XHRAY2FsbGJhY2s6IFRGc0NhbGxiYWNrRnVuYz89dW5kZWYsXG5cdFx0XHRoT3B0aW9uczogaGFzaD17fVxuXHRcdFx0KVxuXG5cdFx0e1xuXHRcdFx0ZGVidWc6IEBkZWJ1Zyxcblx0XHRcdG9uU3RvcDogQG9uU3RvcFxuXHRcdFx0bXM6IEBtc1xuXHRcdFx0fSA6PSBnZXRPcHRpb25zIGhPcHRpb25zLCB7XG5cdFx0XHRcdGRlYnVnOiBmYWxzZVxuXHRcdFx0XHRvblN0b3A6IHBhc3Ncblx0XHRcdFx0bXM6IDIwMFxuXHRcdFx0XHR9XG5cdFx0QERCRyBcIkZpbGVFdmVudEhhbmRsZXIgY29uc3RydWN0b3IoKSBjYWxsZWRcIlxuXG5cdCMgLS0tIENhbGxzIGEgZnVuY3Rpb24gb2YgdHlwZSAoKSA9PiB2b2lkXG5cdCMgICAgIGJ1dCBpcyBkZWJvdW5jZWQgYnkgQG1zIG1zXG5cblx0aGFuZGxlKGNoYW5nZTogVEZzQ2hhbmdlVHlwZSk6IHZvaWRcblx0XHR7a2luZCwgcGF0aH0gOj0gY2hhbmdlXG5cdFx0QERCRyBcIkhBTkRMRTogWyN7c2luY2VMb2FkU3RyKCl9XSAje2tpbmR9ICN7cGF0aH1cIlxuXHRcdGlmIG5vdGRlZmluZWQoQGhIYW5kbGVycz8uW3BhdGhdKVxuXHRcdFx0QERCRyBcIkNyZWF0ZSBoYW5kbGVyIGZvciAnI3twYXRofSdcIiwgMVxuXHRcdFx0QGhIYW5kbGVyc1twYXRoXSA9IHt9XG5cblx0XHRpZiBub3RkZWZpbmVkKEBoSGFuZGxlcnM/LltwYXRoXT8uW2tpbmRdKVxuXHRcdFx0QERCRyBcIkNyZWF0ZSBoYW5kbGVyIGZvciAje2tpbmR9ICN7cGF0aH1cIiwgMVxuXHRcdFx0ZnVuYyA6PSAoKSA9PlxuXHRcdFx0XHRpZiBAY2FsbGJhY2tcblx0XHRcdFx0XHRAY2FsbGJhY2soe2tpbmQsIHBhdGh9KVxuXHRcdFx0XHRAbENoYW5nZXMucHVzaCB7a2luZCwgcGF0aH1cblx0XHRcdFx0QGhIYW5kbGVyc1twYXRoXVtraW5kXSA9IHVuZGVmXG5cdFx0XHRcdHJldHVybiB1bmRlZlxuXHRcdFx0QGhIYW5kbGVyc1twYXRoXVtraW5kXSA9IGRlYm91bmNlKGZ1bmMsIEBtcylcblx0XHRAREJHIFwiQ2FsbCBkZWJvdW5jZWQgaGFuZGxlciBmb3IgI3traW5kfSAje3BhdGh9XCJcblx0XHRAaEhhbmRsZXJzW3BhdGhdW2tpbmRdKClcblx0XHRyZXR1cm5cblxuXHQjIC0tLSBBU1lOQyFcblx0Z2V0Q2hhbmdlTGlzdCgpXG5cdFx0YXdhaXQgc2xlZXAgQG1zXG5cdFx0cmV0dXJuIEBsQ2hhbmdlc1xuXG5cdHByaXZhdGUgREJHKG1zZzogc3RyaW5nLCBsZXZlbDogbnVtYmVyPTApOiB2b2lkXG5cdFx0aWYgQGRlYnVnXG5cdFx0XHRjb25zb2xlLmxvZyBcIiAgICN7c3BhY2VzKDMqbGV2ZWwpfS0gI3ttc2d9XCJcblx0XHRyZXR1cm5cblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiMgQVNZTkNcblxuZXhwb3J0IHR5cGUgVFdhdGNoZXJDYWxsYmFja0Z1bmMgPSAoY2hhbmdlOiBURnNDaGFuZ2VUeXBlKSA9PiBib29sZWFuXG5cbi8qKlxuICogYSBmdW5jdGlvbiB0aGF0IHdhdGNoZXMgZm9yIGNoYW5nZXMgb25lIG9yIG1vcmUgZmlsZXMgb3IgZGlyZWN0b3JpZXNcbiAqICAgIGFuZCBjYWxscyBhIGNhbGxiYWNrIGZ1bmN0aW9uIGZvciBlYWNoIGNoYW5nZS5cbiAqIElmIHRoZSBjYWxsYmFjayByZXR1cm5zIHRydWUsIHdhdGNoaW5nIGlzIGhhbHRlZFxuICpcbiAqIFVzYWdlOlxuICogICBoYW5kbGVyIDo9IChraW5kLCBwYXRoKSA9PiBjb25zb2xlLmxvZyBwYXRoXG4gKiAgIGF3YWl0IHdhdGNoRmlsZSAndGVtcC50eHQnLCBoYW5kbGVyXG4gKiAgIGF3YWl0IHdhdGNoRmlsZSAnc3JjL2xpYicsICBoYW5kbGVyXG4gKiAgIGF3YWl0IHdhdGNoRmlsZSBbJ3RlbXAudHh0JywgJ3NyYy9saWInXSwgaGFuZGxlclxuICovXG5cbmV4cG9ydCB3YXRjaEZpbGUgOj0gKFxuXHRwYXRoOiBzdHJpbmcgfCBzdHJpbmdbXSxcblx0d2F0Y2hlckNCOiBUV2F0Y2hlckNhbGxiYWNrRnVuYyxcblx0aE9wdGlvbnM6IGhhc2g9e31cblx0KTogdm9pZCAtPlxuXG5cdHtkZWJ1ZywgbXN9IDo9IGdldE9wdGlvbnMgaE9wdGlvbnMsIHtcblx0XHRkZWJ1ZzogZmFsc2Vcblx0XHRtczogMjAwXG5cdFx0fVxuXHREQkcgOj0gKG1zZzogc3RyaW5nKTogdm9pZCA9PlxuXHRcdGlmIGRlYnVnXG5cdFx0XHRjb25zb2xlLmxvZyBtc2dcblx0XHRyZXR1cm5cblxuXHREQkcgXCJXQVRDSDogI3tKU09OLnN0cmluZ2lmeShwYXRoKX1cIlxuXG5cdHdhdGNoZXIgOj0gRGVuby53YXRjaEZzKHBhdGgpXG5cblx0bGV0IGRvU3RvcDogYm9vbGVhbiA9IGZhbHNlXG5cblx0ZnNDYWxsYmFjazogVEZzQ2FsbGJhY2tGdW5jIDo9ICh7a2luZCwgcGF0aH0pID0+XG5cdFx0cmVzdWx0IDo9IHdhdGNoZXJDQih7a2luZCwgcGF0aH0pXG5cdFx0REJHIFwiRkNCOiByZXN1bHQgPSAje3Jlc3VsdH1cIlxuXHRcdGlmIHJlc3VsdFxuXHRcdFx0d2F0Y2hlci5jbG9zZSgpXG5cdFx0cmV0dXJuXG5cblx0aGFuZGxlciA6PSBuZXcgRmlsZUV2ZW50SGFuZGxlcihmc0NhbGxiYWNrLCB7ZGVidWcsIG1zfSlcblxuXHRmb3IgYXdhaXQge2tpbmQsIHBhdGhzfSBvZiB3YXRjaGVyXG5cdFx0REJHIFwid2F0Y2hlciBldmVudCBmaXJlZFwiXG5cdFx0aWYgZG9TdG9wXG5cdFx0XHREQkcgXCJkb1N0b3AgPSAje2RvU3RvcH0sIENsb3Npbmcgd2F0Y2hlclwiXG5cdFx0XHRicmVha1xuXHRcdGZvciBwYXRoIG9mIHBhdGhzXG5cdFx0XHQjIC0tLSBmc0NhbGxiYWNrIHdpbGwgYmUgKGV2ZW50dWFsbHkpIGNhbGxlZFxuXHRcdFx0aGFuZGxlci5oYW5kbGUoe2tpbmQsIHBhdGh9KVxuXG5leHBvcnQgd2F0Y2hGaWxlcyA6PSB3YXRjaEZpbGVcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuZXhwb3J0IGFsbFRva2Vuc0luRmlsZSA6PSAoXG5cdFx0cGF0aDogc3RyaW5nXG5cdFx0KTogR2VuZXJhdG9yPFRQTExUb2tlbiwgdm9pZCwgdm9pZD4gLT5cblxuXHRmb3IgdG9rIG9mIGFsbFRva2Vuc0luQmxvY2soc2x1cnAocGF0aCkpXG5cdFx0eWllbGQgdG9rXG5cdHJldHVyblxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuIyAtLS0gVXNlcyBhIHJlY3Vyc2l2ZSBkZXNjZW50IHBhcnNlclxuXG5leHBvcnQgdHlwZSBURmlsZU9wID0ge1xuXHRmdW5jTmFtZTogJ21rRGlyJyB8ICdiYXJmJ1xuXHRwYXRoOiBzdHJpbmdcblx0Y29udGVudHM/OiBzdHJpbmdcblx0fVxuXG5leHBvcnQgc2V0RGlyVHJlZSA6PSAoXG5cdFx0Y3VycmVudERpcjogc3RyaW5nLFxuXHRcdGNvbnRlbnRzOiBzdHJpbmcsXG5cdFx0aE9wdGlvbnM6IGhhc2ggPSB7fVxuXHRcdCk6IFRGaWxlT3BbXSA9PlxuXG5cdCMgLS0tIEV4dHJhY3Qgb3B0aW9uc1xuXHR7ZGVidWcsIGNsZWFyLCBzY2FmZm9sZH0gOj0gZ2V0T3B0aW9ucyBoT3B0aW9ucywge1xuXHRcdGRlYnVnOiBmYWxzZVxuXHRcdGNsZWFyOiBmYWxzZVxuXHRcdHNjYWZmb2xkOiBmYWxzZVxuXHRcdH1cblxuXHRpZiBub3QgZGVidWdcblx0XHRwdXNoTG9nTGV2ZWwgJ2luZm8nXG5cdGxldCBsZXZlbDogaW50ZWdlciA9IDBcblxuXHRkYmdFbnRlciA6PSAobmFtZTogc3RyaW5nLCAuLi5sQXJnczogYW55W10pID0+XG5cdFx0c3RyQXJncyA6PSAoXG5cdFx0XHRmb3IgYXJnIG9mIGxBcmdzXG5cdFx0XHRcdE9MKGFyZylcblx0XHRcdCkuam9pbignLCAnKVxuXHRcdERCRyBcIiN7JyAgICcucmVwZWF0KGxldmVsKX0tPiAje25hbWV9KCN7c3RyQXJnc30pXCJcblx0XHRsZXZlbCArPSAxXG5cdFx0cmV0dXJuXG5cblx0ZGJnRXhpdCA6PSAobmFtZTogc3RyaW5nLCAuLi5sQXJnczogYW55W10pID0+XG5cdFx0c3RyQXJncyA6PSAoXG5cdFx0XHRmb3IgYXJnIG9mIGxBcmdzXG5cdFx0XHRcdE9MKGFyZylcblx0XHRcdCkuam9pbignLCAnKVxuXHRcdGxldmVsIC09IDFcblx0XHREQkcgXCIjeycgICAnLnJlcGVhdChsZXZlbCl9PC0gI3tuYW1lfSgje3N0ckFyZ3N9KVwiXG5cdFx0cmV0dXJuXG5cblx0ZGJnIDo9IChsaW5lOiBzdHJpbmcpID0+XG5cdFx0REJHIFwiI3snICAgJy5yZXBlYXQobGV2ZWwpfS0tICN7T0wobGluZSl9XCJcblx0XHRyZXR1cm5cblxuXHQjIC0tLSBJbiB1bml0IHRlc3RzLCB3ZSBqdXN0IHJldHVybiBjYWxscyBtYWRlXG5cdGxGaWxlT3BzOiBURmlsZU9wW10gOj0gW11cblxuXHQjIC4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi5cblxuXHRkb01ha2VEaXIgOj0gKFxuXHRcdFx0ZGlyUGF0aDogc3RyaW5nXG5cdFx0XHQpOiB2b2lkID0+XG5cblx0XHRhc3NlcnQgaXNTdHJpbmcoZGlyUGF0aCksIFwiZGlyUGF0aCBub3QgYSBzdHJpbmc6ICN7T0woZGlyUGF0aCl9XCJcblx0XHRwYXRoIDo9IHJlbHBhdGgoZGlyUGF0aClcblx0XHRpZiBzY2FmZm9sZFxuXHRcdFx0bEZpbGVPcHMucHVzaCB7XG5cdFx0XHRcdGZ1bmNOYW1lOiAnbWtEaXInXG5cdFx0XHRcdHBhdGhcblx0XHRcdFx0fVxuXHRcdGVsc2Vcblx0XHRcdCMgLS0tIGlmIGNsZWFyIG9wdGlvbiBzZXQsIGNsZWFyIGRpciBpZiBpdCBleGlzdHNcblx0XHRcdG1rRGlyIHBhdGgsIGNsZWFyXG5cdFx0cmV0dXJuXG5cblx0IyAuLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uXG5cblx0ZG9CYXJmIDo9IChcblx0XHRcdGZpbGVQYXRoOiBzdHJpbmcsXG5cdFx0XHRjb250ZW50czogc3RyaW5nXG5cdFx0XHQpOiB2b2lkID0+XG5cblx0XHRwYXRoIDo9IHJlbHBhdGgoZmlsZVBhdGgpXG5cdFx0aWYgc2NhZmZvbGRcblx0XHRcdGxGaWxlT3BzLnB1c2gge1xuXHRcdFx0XHRmdW5jTmFtZTogXCJiYXJmXCJcblx0XHRcdFx0cGF0aFxuXHRcdFx0XHRjb250ZW50c1xuXHRcdFx0XHR9XG5cdFx0ZWxzZVxuXHRcdFx0YmFyZiBwYXRoLCBjb250ZW50c1xuXHRcdHJldHVyblxuXG5cdCMgLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLlxuXG5cdGZpbGVIYW5kbGVyIDo9IChcblx0XHRcdGZpbGVQYXRoOiBzdHJpbmcsXG5cdFx0XHRsVG9rZW5zOiBUUExMVG9rZW5bXVxuXHRcdFx0KTogdm9pZCA9PlxuXG5cdFx0ZGJnRW50ZXIgJ2ZpbGVIYW5kbGVyJywgZmlsZVBhdGhcblx0XHRjb250ZW50cyA6PSBpZiAobFRva2Vuc1swXS5raW5kID09ICdpbmRlbnQnKVxuXHRcdFx0bFRva2Vucy5zaGlmdCgpXG5cdFx0XHRsTGluZXMgOj0gW11cblx0XHRcdGxldCBsZXZlbCA9IDBcblx0XHRcdCMgQHRzLWlnbm9yZVxuXHRcdFx0d2hpbGUgKGxldmVsID4gMCkgfHwgKGxUb2tlbnNbMF0ua2luZCAhPSAndW5kZW50Jylcblx0XHRcdFx0dG9rIDo9IGxUb2tlbnMuc2hpZnQoKVxuXHRcdFx0XHRpZiBub3RkZWZpbmVkKHRvaylcblx0XHRcdFx0XHRjcm9hayBcIk5vICd1bmRlbnQnIGluIGNsb2NrXCJcblx0XHRcdFx0ZWxzZVxuXHRcdFx0XHRcdHN3aXRjaCB0b2sua2luZFxuXHRcdFx0XHRcdFx0d2hlbiAnaW5kZW50J1xuXHRcdFx0XHRcdFx0XHRsZXZlbCArPSAxXG5cdFx0XHRcdFx0XHR3aGVuICd1bmRlbnQnXG5cdFx0XHRcdFx0XHRcdGxldmVsIC09IDFcblx0XHRcdFx0XHRcdFx0YXNzZXJ0IChsZXZlbCA+PSAwKSwgXCJOZWdhdGl2ZSBsZXZlbCBpbiBzZXREaXJUcmVlKClcIlxuXHRcdFx0XHRcdFx0ZWxzZVxuXHRcdFx0XHRcdFx0XHRsaW5lIDo9IGluZGVudGVkKHRvay5zdHIsIGxldmVsKVxuXHRcdFx0XHRcdFx0XHRpZiBpc1N0cmluZyhsaW5lKSAgICAjIC0tLSBBTFdBWVMgU1VDQ0VFRFNcblx0XHRcdFx0XHRcdFx0XHRkYmcgbGluZVxuXHRcdFx0XHRcdFx0XHRcdGxMaW5lcy5wdXNoIGxpbmVcblxuXHRcdFx0IyAtLS0gSEVSRTogKGxldmVsID09IDApIEFORCAobFRva2Vuc1swXS5raW5kID09ICd1bmRlbnQnKVxuXHRcdFx0YXNzZXJ0IChsZXZlbCA9PSAwKSwgXCJhZnRlciBmaWxlIGNvbnRlbnRzLCBsZXZlbCA9ICN7T0wobGV2ZWwpfVwiXG5cdFx0XHRhc3NlcnQgKGxUb2tlbnNbMF0ua2luZCA9PSAndW5kZW50JyksXG5cdFx0XHRcdFx0XCJVTkRFTlQgZXhwZWN0ZWQgYWZ0ZXIgY29udGVudHMsIGdvdCAje09MKGxUb2tlbnNbMF0pfVwiXG5cdFx0XHRsVG9rZW5zLnNoaWZ0KClcblx0XHRcdGxMaW5lcy5qb2luKCdcXG4nKVxuXHRcdGVsc2Vcblx0XHRcdCcnXG5cdFx0ZG9CYXJmIGZpbGVQYXRoLCBjb250ZW50c1xuXHRcdGRiZ0V4aXQgJ2ZpbGVIYW5kbGVyJywgZmlsZVBhdGhcblx0XHRyZXR1cm5cblxuXHRkaXJIYW5kbGVyIDo9IChcblx0XHRcdGRpclBhdGg6IHN0cmluZyxcblx0XHRcdGxUb2tlbnM6IFRQTExUb2tlbltdXG5cdFx0XHQpOiB2b2lkID0+XG5cblx0XHRkYmdFbnRlciAnZGlySGFuZGxlcicsIGRpclBhdGhcblx0XHRkb01ha2VEaXIgZGlyUGF0aFxuXHRcdGlmIChsVG9rZW5zLmxlbmd0aCA+IDApICYmIChsVG9rZW5zWzBdLmtpbmQgPT0gJ2luZGVudCcpXG5cdFx0XHRsVG9rZW5zLnNoaWZ0KClcblx0XHRcdGJsb2NrSGFuZGxlcihkaXJQYXRoLCBsVG9rZW5zKVxuXHRcdFx0IyBAdHMtaWdub3JlXG5cdFx0XHRhc3NlcnQgKGxUb2tlbnNbMF0ua2luZCA9PSAndW5kZW50JyksIFwiTWlzc2luZyBVTkRFTlQgaW4gZGlySGFuZGxlclwiXG5cdFx0XHRsVG9rZW5zLnNoaWZ0KClcblx0XHRkYmdFeGl0ICdkaXJIYW5kbGVyJywgZGlyUGF0aFxuXHRcdHJldHVyblxuXG5cdGJsb2NrSGFuZGxlciA6PSAoZGlyUGF0aDogc3RyaW5nLCBsVG9rZW5zOiBUUExMVG9rZW5bXSkgPT5cblx0XHRkYmdFbnRlciAnYmxvY2tIYW5kbGVyJywgZGlyUGF0aFxuXHRcdHdoaWxlIChsVG9rZW5zLmxlbmd0aCA+IDApICYmIChsVG9rZW5zWzBdLmtpbmQgIT0gJ3VuZGVudCcpXG5cdFx0XHR0b2s6IFRQTExUb2tlbiA6PSBsVG9rZW5zWzBdXG5cdFx0XHRsVG9rZW5zLnNoaWZ0KClcblx0XHRcdHtraW5kLCBzdHJ9IDo9IHRva1xuXHRcdFx0c3dpdGNoIGtpbmRcblx0XHRcdFx0d2hlbiAnaW5kZW50J1xuXHRcdFx0XHRcdGNyb2FrIFwiVW5leHBlY3RlZCBJTkRFTlRcIlxuXHRcdFx0XHRlbHNlXG5cdFx0XHRcdFx0aWYgc3RyLnN0YXJ0c1dpdGgoJy8nKVxuXHRcdFx0XHRcdFx0ZGlySGFuZGxlciBcIiN7ZGlyUGF0aH0je3Rvay5zdHJ9XCIsIGxUb2tlbnNcblx0XHRcdFx0XHRlbHNlXG5cdFx0XHRcdFx0XHRmaWxlSGFuZGxlciBcIiN7ZGlyUGF0aH0vI3t0b2suc3RyfVwiLCBsVG9rZW5zXG5cdFx0ZGJnRXhpdCAnYmxvY2tIYW5kbGVyJ1xuXHRcdHJldHVyblxuXG5cdCMgLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLlxuXG5cdHB0eXBlIDo9IGdldFBhdGhUeXBlKGN1cnJlbnREaXIpXG5cdGFzc2VydCAocHR5cGUgPT0gJ2RpcicpIHx8IChwdHlwZSA9PSAnbWlzc2luZycpLFxuXHRcdFx0XCJjdXJyZW50RGlyIGlzIGEgI3twdHlwZX1cIlxuXG5cdCMgLS0tIENsZWFyIHRoZSBkaXJlY3RvcnkgaWYgaXQgZXhpc3RzXG5cdGRvTWFrZURpciBjdXJyZW50RGlyXG5cblx0bFRva2VucyA6PSBBcnJheS5mcm9tKGFsbFRva2Vuc0luQmxvY2soY29udGVudHMpKVxuXHREQkcgdG9rZW5UYWJsZShsVG9rZW5zKVxuXG5cdGJsb2NrSGFuZGxlcihjdXJyZW50RGlyLCBsVG9rZW5zKVxuXHRhc3NlcnQgKGxUb2tlbnMubGVuZ3RoID09IDApLFxuXHRcdFx0XCJUb2tlbnMgcmVtYWluaW5nIGFmdGVyIHBhcnNlOiAje09MKGxUb2tlbnMpfVwiXG5cdGlmIG5vdCBkZWJ1Z1xuXHRcdHBvcExvZ0xldmVsKClcblx0cmV0dXJuIGxGaWxlT3BzXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbmV4cG9ydCBmaWxlT3BzVGFibGUgOj0gKGxGaWxlT3BzOiBURmlsZU9wW10pOiBzdHJpbmcgPT5cblxuXHR0dCA6PSBuZXcgVGV4dFRhYmxlKFwibCBsXCIpXG5cdHR0LmZ1bGxzZXAoKVxuXHR0dC50aXRsZSAnRklMRSBPUFMnXG5cdHR0LmZ1bGxzZXAoKVxuXHRmb3Ige2Z1bmNOYW1lLCBwYXRoLCBjb250ZW50c30gb2YgbEZpbGVPcHNcblx0XHRzd2l0Y2ggZnVuY05hbWVcblx0XHRcdHdoZW4gJ21rRGlyJ1xuXHRcdFx0XHR0dC5kYXRhIFsnbWtkaXInLCBwYXRoXVxuXHRcdFx0d2hlbiAnYmFyZidcblx0XHRcdFx0dHQuZGF0YSBbJ2JhcmYnLCBwYXRoXVxuXHRcdFx0XHRpZiBjb250ZW50c1xuXHRcdFx0XHRcdGZvciBsaW5lIG9mIGNvbnRlbnRzLnNwbGl0KCdcXG4nKVxuXHRcdFx0XHRcdFx0dHQuZGF0YSBbJycsIGxpbmUucmVwbGFjZSgnXFx0Jywgc3BhY2VzKDMpKV1cblx0dHQuZnVsbHNlcCgpXG5cdHJldHVybiB0dC5hc1N0cmluZygpXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbmV4cG9ydCBwYXRjaEZpcnN0TGluZSA6PSAoXG5cdFx0cGF0aDogc3RyaW5nXG5cdFx0c3RyOiBzdHJpbmdcblx0XHRuZXdzdHI6IHN0cmluZ1xuXHRcdCk6IHZvaWQgPT5cblxuXHQjIC0tLSBSZXBsYWNlIHN0ciB3aXRoIG5ld3N0ciwgYnV0IG9ubHkgb24gZmlyc3QgbGluZVxuXHRjb250ZW50cyA6PSBEZW5vLnJlYWRUZXh0RmlsZVN5bmMgcGF0aFxuXHRubFBvcyA6PSBjb250ZW50cy5pbmRleE9mIFwiXFxuXCJcblx0c3RyUG9zIDo9IGNvbnRlbnRzLmluZGV4T2Ygc3RyXG5cdGlmIChzdHJQb3MgIT0gLTEpICYmICgobmxQb3MgPT0gLTEpIHx8IChzdHJQb3MgPCBubFBvcykpXG5cdFx0RGVuby53cml0ZVRleHRGaWxlU3luYyBwYXRoLCBjb250ZW50cy5yZXBsYWNlKHN0ciwgbmV3c3RyKVxuXHRyZXR1cm5cblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuZXhwb3J0IGNvbmZpZ0Zyb21GaWxlIDo9IChhUGF0aDogc3RyaW5nKTogaGFzaCA9PlxuXG5cdHtwYXRoLCB0eXBlLCBwdXJwb3NlLCBleHR9IDo9IHBhcnNlUGF0aChhUGF0aClcblx0YXNzZXJ0ICh0eXBlID09ICdmaWxlJyksIFwiTm90IGEgZmlsZTogI3tPTChwYXRoKX1cIlxuXHRhc3NlcnQgKHB1cnBvc2UgPT0gJ2NvbmZpZycpLCBcIk5vdCBhIGNvbmZpZyBmaWxlOiAje09MKHBhdGgpfVwiXG5cdERCRyBcIkdFVCBDT05GSUc6IHBhdGggPSAje09MKHBhdGgpfVwiXG5cblx0c3JjUGF0aCA6PSAoXG5cdFx0aWYgKGV4dCA9PSAnLmNpdmV0Jylcblx0XHRcdGNpdmV0MnRzRmlsZSBwYXRoXG5cdFx0XHR3aXRoRXh0IHBhdGgsICcudHMnXG5cdFx0ZWxzZVxuXHRcdFx0cGF0aFxuXHRcdClcblx0REJHVkFMVUUgJ3NyY1BhdGgnLCBzcmNQYXRoXG5cdGhJbXBvcnRlZCA6PSByZXF1aXJlKHNyY1BhdGgpXG5cdERCR1ZBTFVFICdoSW1wb3J0ZWQnLCBoSW1wb3J0ZWRcblx0aFJlc3VsdCA6PSBoSW1wb3J0ZWQ/LmRlZmF1bHQgfHwgaEltcG9ydGVkXG5cdERCR1ZBTFVFIFwiaFJlc3VsdFwiLCBoUmVzdWx0XG5cdGFzc2VydCBpc0hhc2goaFJlc3VsdCksXG5cdFx0XHRcIkRlZmF1bHQgaW1wb3J0IGluICN7T0woc3JjUGF0aCl9IG5vdCBhIGhhc2g6ICN7TUwoaFJlc3VsdCl9XCJcblx0cmV0dXJuIGhSZXN1bHRcbiJdfQ==