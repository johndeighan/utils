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
	croak, OL, getOptions, removeEmptyKeys, pass,
	spaces, sinceLoadStr, sleep, relpath,
	} from './llutils.lib.ts'
import {TextTable} from './text-table.lib.ts'
import {indented} from './indent.lib.ts'
import {
	Token, allTokensInBlock, tokenTable,
	} from './tokens.lib.ts'

export {relpath}

/**
 * @module fs - file system utilities
 */

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

export type pathType =
	'missing' | 'file' | 'dir' | 'symlink' | 'unknown'

export const getPathType = (path: string): pathType => {

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
 * 	type: pathType - 'file','dir','symlink','missing' or 'unknown'
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

export type pathInfo = {
	type: pathType  // 'file','dir','symlink','missing' or 'unknown'
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

export const parsePath = (path: string): pathInfo => {

	// --- NOTE: path may be a file URL, e.g. import.meta.url
	//           path may be a relative path

	assert(isNonEmptyString(path), `path not a string ${OL(path)}`)
	if (defined(path.match(/^file\:\/\//))) {
		path = fromFileUrl(path)
	}
	path = normalizePath(path)

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

export type pathDesc = {
	dir: string
	root: string
	lParts: string[]
	}

/**
 * returns {dir, root, lParts} where lParts includes the names of
 * all directories between the root and the file name
 * relative to the current working directory
 */

export const pathSubDirs = (path: string, hOptions: hash={}): pathDesc => {

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

	assert(isFile(path), `No such file: ${path} (slurp)`)
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
	hOptions: hash={}
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
	const filter = (hFile: pathInfo): (pathInfo | undefined) => {
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

export type fsChangeType = {
	kind: string
	path: string
	ms?: number
	}

/**
 * type fsCallbackFunc - a function taking (type, path) and optionally
 * returns a function reference to be called on file changes
 */

export type fsCallbackFunc = (change: fsChangeType) => void

/**
 * class FileEventHandler
 *    handles file changed events when .handle({kind, path}) is called
 *    callback is a function, debounced by 200 ms
 *       that takes (type, path) and returns a voidFunc
 *       which will be called if the callback returns a function reference
 * [unit tests](../test/fs.test.civet#:~:text=%23%20%2D%2D%2D%20class%20FileEventHandler)
 */

export class FileEventHandler {

	callback: (fsCallbackFunc | undefined)
	readonly lChanges: fsChangeType[] = []
	hHandlers: hash = {}   // --- path => event type => debounced handler
	onStop: () => void = pass
	ms: number
	debug: boolean

	constructor(
			callback1: (fsCallbackFunc | undefined)=undef,
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

	handle(change: fsChangeType): void {
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

export type watcherCallbackFunc = (change: fsChangeType) => boolean

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
	watcherCB: watcherCallbackFunc,
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

	const fsCallback: fsCallbackFunc = ({kind, path}) => {
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
		): Generator<Token, void, void> {

	for (const tok of allTokensInBlock(slurp(path))) {
		yield tok
	}
	return
}

// ---------------------------------------------------------------------------
// --- Uses a recursive descent parser

export type FileOp = {
	funcName: 'mkDir' | 'barf'
	path: string
	contents?: string
	}

export const setDirTree = (
		currentDir: string,
		contents: string,
		hOptions: hash = {}
		): FileOp[] => {

	// --- Extract options
	const {debug, clear, scaffold} = getOptions(hOptions, {
		debug: true,
		clear: false,
		scaffold: false
		})

	// --- fs lib can't use logger lib directly, so
	//     we define and use a local DBG() function

	const DBG = (str: string): void => {
		if (debug) {
			console.log(str)
		}
		return
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
	const lFileOps: FileOp[] = []

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
			lTokens: Token[]
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
			lTokens: Token[]
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

	const blockHandler = (dirPath: string, lTokens: Token[]) => {
		dbgEnter('blockHandler', dirPath)
		while ((lTokens.length > 0) && (lTokens[0].kind !== 'undent')) {
			const tok: Token = lTokens[0]
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
	return lFileOps
}

// ---------------------------------------------------------------------------

export const fileOpsTable = (lFileOps: FileOp[]): string => {

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

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3JjL2xpYi9mcy5saWIuY2l2ZXQudHN4Iiwic291cmNlcyI6WyJzcmMvbGliL2ZzLmxpYi5jaXZldCJdLCJtYXBwaW5ncyI6IjtBQUFBLGVBQWM7QUFDZCxBQUFBO0FBQ0EsSyxXLHlCO0FBQUEsTUFBTSxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxDQUFDLGlCQUFpQjtBQUN2QyxBQUFBLEFBQUEsTUFBTSxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsSUFBSSxDQUFDLHFCQUFxQjtBQUM1QyxBQUFBLEFBQUEsTUFBTSxDQUFDLENBQUM7QUFDUixDQUFDLFVBQVUsQ0FBQyxDQUFDLFlBQVksQ0FBQyxDQUFDLGFBQWEsQ0FBQztBQUN6QyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsU0FBUztBQUNqQixBQUFBLEFBQUEsTUFBTSxDQUFDLENBQUM7QUFDUixDQUFDLGNBQWMsQ0FBQztBQUNoQixDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsU0FBUztBQUNqQixBQUFBLEFBQUEsTUFBTSxDQUFDLENBQUMsWUFBWSxDQUFDLENBQUMsSUFBSSxDQUFDLGFBQWE7QUFDeEMsQUFBQTtBQUNBLEFBQUEsd0RBQXVEO0FBQ3ZELEFBQUEsa0JBQWlCO0FBQ2pCLEFBQUEsQUFBQSxNQUFNLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxJQUFJLENBQUMsU0FBUztBQUNoQyxBQUFBO0FBQ0EsQUFBQSxBQUFBLE1BQU0sQ0FBQyxDQUFDLGNBQWMsQ0FBQyxDQUFDLElBQUksQ0FBQyxxQkFBcUI7QUFDbEQsQUFBQSxBQUFBLE1BQU0sQ0FBQyxDQUFDLGNBQWMsQ0FBQyxDQUFDLElBQUksQ0FBQyxjQUFjO0FBQzNDLEFBQUE7QUFDQSxBQUFBLDhCQUE2QjtBQUM3QixBQUFBLEFBQUEsTUFBTSxDQUFDLENBQUM7QUFDUixDQUFDLEtBQUssQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLFdBQVcsQ0FBQztBQUN2QyxDQUFDLENBQUMsQ0FBQyxJQUFJLENB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QUEsOEVBQTZFO0FBQzdFLEFBQUE7QUFDQSxBQUFBO0FBQ0E7QUFDQTtBQUNBLEdBQUc7QUFDSCxBQUFBO0FBQ0EsQUFBQSxBQUFBLE1BQU0sQ0FBTyxNQUFOLE1BQU0sQ0FBQyxDQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUEsQ0FBQTtBQUN4QyxBQUFBO0FBQ0EsQUFBQSxDQUFDLEdBQUcsQ0FBQSxVQUFVLENBQUEsQUFBQyxJQUFJLENBQUEsQ0FBQSxDQUFBLENBQUE7QUFDbkIsQUFBQSxFQUFFLElBQUksQ0FBQyxVQUFVLENBQUEsQUFBQyxJQUFJLEM7Q0FBQSxDQUFBO0FBQ3RCLEFBQUEsQ0FBQyxNO0FBQU0sQ0FBQTtBQUNQLEFBQUE7QUFDQSxBQUFBLDhFQUE2RTtBQUM3RSxBQUFBO0FBQ0EsQUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsR0FBRztBQUNILEFBQUE7QUFDQSxBQUFBLEFBQUEsTUFBTSxDQUFNLE1BQUwsS0FBSyxDQUFDLENBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQSxDQUFBO0FBQzFELEFBQUE7QUFDQSxBQUFBLENBQVEsTUFBUCxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUUsQ0FBQyxVQUFVLENBQUEsQUFBQyxRQUFRLENBQUMsQ0FBQyxDQUFDO0FBQ2xDLEFBQUEsRUFBRSxLQUFLLENBQUMsQ0FBQyxLQUFLO0FBQ2QsRUFBRSxDQUFDLENBQUE7QUFDSCxBQUFBLENBQUMsR0FBRyxDQUFBLFVBQVUsQ0FBQSxBQUFDLElBQUksQ0FBQSxDQUFBLENBQUEsQ0FBQTtBQUNuQixBQUFBLEVBQUUsR0FBRyxDQUFBLEtBQUssQ0FBQSxDQUFBLENBQUE7QUFDVixBQUFBLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQSxBQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsSUFBSSxDQUFDLEM7RUFBQSxDQUFBO0FBQzFDLEFBQUEsRUFBRSxJQUFJLENBQUEsQ0FBQTtBQUNOLEFBQUEsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFBLEFBQUMsSUFBSSxDO0VBQUEsQztDQUFBLENBQUE7QUFDdkIsQUFBQSxDQUFDLE07QUFBTSxDQUFBO0FBQ1AsQUFBQTtBQUNBLEFBQUEsOEVBQTZFO0FBQzdFLEFBQUE7QUFDQSxBQUFBO0FBQ0E7QUFDQSxHQUFHO0FBQ0gsQUFBQTtBQUNBLEFBQUEsQUFBQSxNQUFNLENBQWMsTUFBYixhQUFhLENBQUMsQ0FBRSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFBLENBQUE7QUFDL0MsQUFBQTtBQUNBLEFBQUEsQ0FBZSxNQUFkLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBRSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUM7QUFDcEMsQUFBQSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLElBQUk7QUFDZixBQUFBLENBQUMsR0FBRyxDQUFDLENBQUEsTUFBQSxJQUFJLENBQUMsRUFBRSxDQUFDLE1BQU0sQ0FBQSxDQUFBLENBQUE7QUFDbkIsQUFBQSxFQUFFLEdBQUcsQyxFQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUM7QUFDbkIsQUFBQSxFQUFFLEdBQUcsQ0FBQSxDQUFJLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQSxDQUFBLENBQUE7QUFDbkIsQUFBQSxHQUFHLEtBQUssQ0FBQSxBQUFDLEdBQUcsQztFQUFBLEM7Q0FBQSxDQUFBO0FBQ1osQUFBQSxDQUFDLE07QUFBTSxDQUFBO0FBQ1AsQUFBQTtBQUNBLEFBQUEsOEVBQTZFO0FBQzdFLEFBQUE7QUFDQSxBQUFBO0FBQ0E7QUFDQSxHQUFHO0FBQ0gsQUFBQTtBQUNBLEFBQUEsQUFBQSxNQUFNLENBQVMsTUFBUixRQUFRLENB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QUFBO0FBQ3hCLEFBQUE7QUFDQSxBQUFBLEVBQUUsR0FBRyxDQUFBLFVBQVUsQ0FBQyxJLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQSxDQUFBLENBQUE7QUFDM0MsQUFBQSxHQUFHLEksQ0FBQyxHQUFHLENBQUEsQUFBQyxDQUFDLG1CQUFtQixFQUFFLElBQUksQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUMvQyxBQUFBLEdBQU8sTUFBSixJQUFJLENBQUMsQ0FBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQSxDQUFBO0FBQ2hCLEFBQUEsSUFBSSxHQUFHLENBQUEsSSxDQUFDLFFBQVEsQ0FBQSxDQUFBLENBQUE7QUFDaEIsQUFBQSxLQUFLLEksQ0FBQyxRQUFRLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsQztJQUFDLENBQUE7QUFDNUIsQUFBQSxJQUFJLEksQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFBLEFBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQTtBQUMvQixBQUFBLElBQUksSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsQyxDQUFFLENBQUMsS0FBSztBQUNsQyxBQUFBLElBQUksTUFBTSxDQUFDLEs7R0FBSyxDQUFBO0FBQ2hCLEFBQUEsR0FBRyxJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxDLENBQUUsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMsSSxDQUFDLEVBQUUsQztFQUFDLENBQUE7QUFDL0MsQUFBQSxFQUFFLEksQ0FBQyxHQUFHLENBQUEsQUFBQyxDQUFDLDJCQUEyQixFQUFFLElBQUksQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQTtBQUNuRCxBQUFBLEVBQUUsSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJ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IGZzLmxpYi5jaXZldFxuXG5pbXBvcnQge3NwcmludGZ9IGZyb20gXCJAc3RkL2ZtdC9wcmludGZcIlxuaW1wb3J0IHtkZWJvdW5jZX0gZnJvbSAnQHN0ZC9hc3luYy9kZWJvdW5jZSdcbmltcG9ydCB7XG5cdGV4aXN0c1N5bmMsIGVtcHR5RGlyU3luYywgZW5zdXJlRGlyU3luYyxcblx0fSBmcm9tICdAc3RkL2ZzJ1xuaW1wb3J0IHtcblx0YXBwZW5kRmlsZVN5bmMsXG5cdH0gZnJvbSAnbm9kZTpmcydcbmltcG9ydCB7RXZlbnRFbWl0dGVyfSBmcm9tICdub2RlOmV2ZW50cydcblxuIyAtLS0gRGVubydzIHN0YXRTeW5jIGFuZCBsc3RhdFN5bmMgYXJlIHN0aWxsIHVuc3RhYmxlLFxuIyAgICAgc28gdXNlIHRoaXNcbmltcG9ydCB7c3RhdFN5bmN9IGZyb20gJ25vZGU6ZnMnXG5cbmltcG9ydCB7ZXhwYW5kR2xvYlN5bmN9IGZyb20gJ0BzdGQvZnMvZXhwYW5kLWdsb2InXG5pbXBvcnQge1RleHRMaW5lU3RyZWFtfSBmcm9tICdAc3RkL3N0cmVhbXMnXG5cbiMgLS0tIFVzZSBEZW5vJ3MgcGF0aCBsaWJyYXJ5XG5pbXBvcnQge1xuXHRwYXJzZSwgcmVzb2x2ZSwgcmVsYXRpdmUsIGZyb21GaWxlVXJsLFxuXHR9IGZyb20gJ0BzdGQvcGF0aCdcblxuaW1wb3J0IHtcblx0dW5kZWYsIGRlZmluZWQsIG5vdGRlZmluZWQsIGFzc2VydCwgaXNFbXB0eSwgbm9uRW1wdHksXG5cdGlzU3RyaW5nLCBpc05vbkVtcHR5U3RyaW5nLCBpc0Jvb2xlYW4sIGlzTnVtYmVyLCBpc0ludGVnZXIsXG5cdGlzQXJyYXksIGlzQXJyYXlPZlN0cmluZ3MsIGlzSGFzaCwgaXNPYmplY3QsIGlzUmVnRXhwLFxuXHRpbnRlZ2VyLCBoYXNoLCB2b2lkRnVuYyxcblx0fSBmcm9tICcuL2RhdGF0eXBlcy5saWIudHMnXG5pbXBvcnQge1xuXHRjcm9haywgT0wsIGdldE9wdGlvbnMsIHJlbW92ZUVtcHR5S2V5cywgcGFzcyxcblx0c3BhY2VzLCBzaW5jZUxvYWRTdHIsIHNsZWVwLCByZWxwYXRoLFxuXHR9IGZyb20gJy4vbGx1dGlscy5saWIudHMnXG5pbXBvcnQge1RleHRUYWJsZX0gZnJvbSAnLi90ZXh0LXRhYmxlLmxpYi50cydcbmltcG9ydCB7aW5kZW50ZWR9IGZyb20gJy4vaW5kZW50LmxpYi50cydcbmltcG9ydCB7XG5cdFRva2VuLCBhbGxUb2tlbnNJbkJsb2NrLCB0b2tlblRhYmxlLFxuXHR9IGZyb20gJy4vdG9rZW5zLmxpYi50cydcblxuZXhwb3J0IHtyZWxwYXRofVxuXG4vKipcbiAqIEBtb2R1bGUgZnMgLSBmaWxlIHN5c3RlbSB1dGlsaXRpZXNcbiAqL1xuXG5EZW5vIDo9IGdsb2JhbFRoaXMuRGVub1xuXG4jIC0tLSBub3QgZXhwb3J0ZWRcbmRlY29kZXIgOj0gbmV3IFRleHREZWNvZGVyKCd1dGYtOCcpXG5lbmNvZGVyIDo9IG5ldyBUZXh0RW5jb2RlcigpXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogcmV0dXJucyBhIGJvb2xlYW4gaW5kaWNhdGluZyBpZiB0aGUgZ2l2ZW4gcGF0aCBleGlzdHNcbiAqIGFuZCBpcyBhIGZpbGVcbiAqL1xuXG5leHBvcnQgaXNGaWxlIDo9IChwYXRoOiBzdHJpbmcpOiBib29sZWFuID0+XG5cblx0cmV0dXJuIGV4aXN0c1N5bmMocGF0aCkgJiYgc3RhdFN5bmMocGF0aCkuaXNGaWxlKClcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuLyoqXG4gKiByZXR1cm5zIGEgYm9vbGVhbiBpbmRpY2F0aW5nIG9mIHRoZSBnaXZlbiBwYXRoIGV4aXN0c1xuICogYW5kIGlzIGEgZGlyZWN0b3J5XG4gKi9cblxuZXhwb3J0IGlzRGlyIDo9IChwYXRoOiBzdHJpbmcpOiBib29sZWFuID0+XG5cblx0cmV0dXJuIGV4aXN0c1N5bmMocGF0aCkgJiYgc3RhdFN5bmMocGF0aCkuaXNEaXJlY3RvcnkoKVxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKipcbiAqIHJldHVybnMgb25lIG9mOlxuICogICAgJ21pc3NpbmcnICAtIGRvZXMgbm90IGV4aXN0XG4gKiAgICAnZGlyJyAgICAgIC0gaXMgYSBkaXJlY3RvcnlcbiAqICAgICdmaWxlJyAgICAgLSBpcyBhIGZpbGVcbiAqICAgICdzeW1saW5rJyAgLSBpcyBhIHN5bWxpbmtcbiAqICAgICd1bmtub3duJyAgLSBleGlzdHMsIGJ1dCBub3QgYSBmaWxlLCBkaXJlY3Rvcnkgb3Igc3ltbGlua1xuICovXG5cbmV4cG9ydCB0eXBlIHBhdGhUeXBlID1cblx0J21pc3NpbmcnIHwgJ2ZpbGUnIHwgJ2RpcicgfCAnc3ltbGluaycgfCAndW5rbm93bidcblxuZXhwb3J0IGdldFBhdGhUeXBlIDo9IChwYXRoOiBzdHJpbmcpOiBwYXRoVHlwZSA9PlxuXG5cdGFzc2VydCBpc1N0cmluZyhwYXRoKSwgXCJub3QgYSBzdHJpbmc6ICN7T0wocGF0aCl9XCJcblx0aWYgbm90IGV4aXN0c1N5bmMgcGF0aFxuXHRcdHJldHVybiAnbWlzc2luZydcblx0aCA6PSBzdGF0U3luYyhwYXRoKVxuXHRyZXR1cm4gKFxuXHRcdCAgaC5pc0ZpbGUoKSAgICAgICAgID8gJ2ZpbGUnXG5cdFx0OiBoLmlzRGlyZWN0b3J5KCkgICAgPyAnZGlyJ1xuXHRcdDogaC5pc1N5bWJvbGljTGluaygpID8gJ3N5bWxpbmsnXG5cdFx0OiAgICAgICAgICAgICAgICAgICAgICAndW5rbm93bidcblx0XHQpXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogZXh0cmFjdCB0aGUgZmlsZSBleHRlbnNpb24gZnJvbSBhIHBhdGgsIGluY2x1ZGluZ1xuICogdGhlIGxlYWRpbmcgcGVyaW9kXG4gKi9cblxuZXhwb3J0IGZpbGVFeHQgOj0gKHBhdGg6IHN0cmluZyk6IHN0cmluZyA9PlxuXG5cdGlmIGxNYXRjaGVzIDo9IHBhdGgubWF0Y2goL1xcLlteXFwuXSskLylcblx0XHRyZXR1cm4gbE1hdGNoZXNbMF1cblx0ZWxzZVxuXHRcdHJldHVybiAnJ1xuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKipcbiAqIHJldHVybiB0aGUgZ2l2ZW4gcGF0aCwgYnV0IHdpdGggdGhlIGdpdmVuIGZpbGUgZXh0ZW5zaW9uXG4gKiByZXBsYWNpbmcgdGhlIGV4aXN0aW5nIGZpbGUgZXh0ZW5zaW9uXG4gKi9cblxuZXhwb3J0IHdpdGhFeHQgOj0gKHBhdGg6IHN0cmluZywgZXh0OiBzdHJpbmcpOiBzdHJpbmcgPT5cblxuXHRhc3NlcnQgZXh0LnN0YXJ0c1dpdGgoJy4nKSwgXCJCYWQgZmlsZSBleHRlbnNpb246ICN7ZXh0fVwiXG5cdGxNYXRjaGVzIDo9IHBhdGgubWF0Y2goL14oLiopKFxcLlteXFwuXSspJC8pXG5cdGlmIChsTWF0Y2hlcyA9PSBudWxsKVxuXHRcdHRocm93IG5ldyBFcnJvcihcIkJhZCBwYXRoOiAnI3twYXRofSdcIilcblx0W18sIGhlYWRTdHIsIG9yZ0V4dF0gOj0gbE1hdGNoZXNcblx0cmV0dXJuIFwiI3toZWFkU3RyfSN7ZXh0fVwiXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbmV4cG9ydCBsU3RhdEZpZWxkczogc3RyaW5nW10gOj0gW1xuXHQnZGV2JywnaW5vJywnbW9kZScsJ25saW5rJywndWlkJywnZ2lkJywncmRldicsXG5cdCdzaXplJywnYmxrc2l6ZScsJ2Jsb2NrcycsXG5cdCdhdGltZU1zJywnbXRpbWVNcycsJ2N0aW1lTXMnLCdiaXJ0aHRpbWVNcycsXG5cdCdhdGltZScsJ210aW1lJywnY3RpbWUnLCdiaXJ0aHRpbWUnLFxuXHRdXG5cbi8qKlxuICogcmV0dXJuIHN0YXRpc3RpY3MgZm9yIGEgZmlsZSBvciBkaXJlY3RvcnlcbiAqL1xuXG5leHBvcnQgZ2V0U3RhdHMgOj0gKHBhdGg6IHN0cmluZyk6IGhhc2ggPT5cblxuXHRyZXR1cm4gc3RhdFN5bmMocGF0aClcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuZXhwb3J0IGlzU3R1YiA6PSAoc3RyOiBzdHJpbmcpOiBib29sZWFuID0+XG5cblx0IyAtLS0gYSBzdHViIGNhbm5vdCBjb250YWluIGFueSBvZiAnXFxcXCcsICcvJ1xuXHRyZXR1cm4gbm90ZGVmaW5lZChzdHIubWF0Y2goL1tcXFxcXFwvXS8pKSAmJiAoc3RyWzBdICE9ICcuJylcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuLyoqXG4gKiBwYXJzZXMgYSBwYXRoIG9yIGZpbGUgVVJMLCBhbmQgcmV0dXJucyBhIGhhc2ggd2l0aCBrZXlzOlxuICogXHR0eXBlOiBwYXRoVHlwZSAtICdmaWxlJywnZGlyJywnc3ltbGluaycsJ21pc3NpbmcnIG9yICd1bmtub3duJ1xuICogXHRwYXRoOiBzdHJpbmdcbiAqIFx0cm9vdDogc3RyaW5nXG4gKiBcdGRpcjogc3RyaW5nXG4gKiBcdGZpbGVOYW1lOiBzdHJpbmdcbiAqIFx0c3R1Yjogc3RyaW5nP1xuICogXHRwdXJwb3NlOiBzdHJpbmc/XG4gKiBcdGV4dDogc3RyaW5nP1xuICogXHRyZWxQYXRoOiBzdHJpbmdcbiAqIFx0cmVsRGlyOiBzdHJpbmdcbiAqL1xuXG5leHBvcnQgdHlwZSBwYXRoSW5mbyA9IHtcblx0dHlwZTogcGF0aFR5cGUgICMgJ2ZpbGUnLCdkaXInLCdzeW1saW5rJywnbWlzc2luZycgb3IgJ3Vua25vd24nXG5cdHBhdGg6IHN0cmluZ1xuXHRyb290OiBzdHJpbmdcblx0ZGlyOiBzdHJpbmdcblx0ZmlsZU5hbWU6IHN0cmluZ1xuXHRzdHViOiBzdHJpbmc/XG5cdHB1cnBvc2U6IHN0cmluZz9cblx0ZXh0OiBzdHJpbmc/XG5cdHJlbFBhdGg6IHN0cmluZ1xuXHRyZWxEaXI6IHN0cmluZ1xuXHR9XG5cbmV4cG9ydCBwYXJzZVBhdGggOj0gKHBhdGg6IHN0cmluZyk6IHBhdGhJbmZvID0+XG5cblx0IyAtLS0gTk9URTogcGF0aCBtYXkgYmUgYSBmaWxlIFVSTCwgZS5nLiBpbXBvcnQubWV0YS51cmxcblx0IyAgICAgICAgICAgcGF0aCBtYXkgYmUgYSByZWxhdGl2ZSBwYXRoXG5cblx0YXNzZXJ0IGlzTm9uRW1wdHlTdHJpbmcocGF0aCksIFwicGF0aCBub3QgYSBzdHJpbmcgI3tPTChwYXRoKX1cIlxuXHRpZiBkZWZpbmVkKHBhdGgubWF0Y2goL15maWxlXFw6XFwvXFwvLykpXG5cdFx0cGF0aCA9IGZyb21GaWxlVXJsKHBhdGgpXG5cdHBhdGggPSBub3JtYWxpemVQYXRoIHBhdGhcblxuXHR7cm9vdCwgZGlyLCBiYXNlOiBmaWxlTmFtZX0gOj0gcGFyc2UocGF0aClcblxuXHRsUGFydHMgOj0gZmlsZU5hbWUuc3BsaXQoJy4nKVxuXHRbc3R1YiwgcHVycG9zZSwgZXh0XSA6PSBzd2l0Y2ggbFBhcnRzLmxlbmd0aFxuXHRcdHdoZW4gMFxuXHRcdFx0Y3JvYWsgXCJDYW4ndCBoYXBwZW5cIlxuXHRcdHdoZW4gMVxuXHRcdFx0W2ZpbGVOYW1lLCB1bmRlZiwgdW5kZWZdXG5cdFx0d2hlbiAyXG5cdFx0XHRbbFBhcnRzWzBdLCB1bmRlZiwgXCIuI3tsUGFydHNbMV19XCJdXG5cdFx0ZWxzZVxuXHRcdFx0W1xuXHRcdFx0XHRsUGFydHMuc2xpY2UoMCwgLTIpLmpvaW4oJy4nKSxcblx0XHRcdFx0bFBhcnRzLmF0KC0yKSxcblx0XHRcdFx0XCIuI3tsUGFydHMuYXQoLTEpfVwiXG5cdFx0XHRcdF1cblxuXHQjIC0tLSBHcmFiIGV2ZXJ5dGhpbmcgdXAgdW50aWwgdGhlIGxhc3QgcGF0aCBzZXBhcmF0b3IsIGlmIGFueVxuXHRyZWxQYXRoIDo9IHJlbHBhdGggcGF0aFxuXHRsUGF0aE1hdGNoZXMgOj0gcmVsUGF0aC5tYXRjaCgvXiguKilbXFxcXFxcL11bXlxcXFxcXC9dKiQvKVxuXHRyZWxEaXIgOj0gKGxQYXRoTWF0Y2hlcyA9PSBudWxsKSA/ICcuJyA6IGxQYXRoTWF0Y2hlc1sxXVxuXG5cdHJldHVybiB7XG5cdFx0dHlwZTogZ2V0UGF0aFR5cGUocGF0aClcblx0XHRwYXRoXG5cdFx0cm9vdFxuXHRcdGRpclxuXHRcdGZpbGVOYW1lXG5cdFx0c3R1YlxuXHRcdHB1cnBvc2Vcblx0XHRleHRcblx0XHRyZWxQYXRoXG5cdFx0cmVsRGlyXG5cdFx0fVxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuIyBHRU5FUkFUT1JcblxuLyoqXG4gKiBnZW5lcmF0ZSBmaWxlcyB0aGF0IG1hdGNoIGEgZ2l2ZW4gZ2xvYiBwYXR0ZXJuXG4gKiB5aWVsZHMgYSBoYXNoIHdpdGgga2V5czpcbiAqICAgIHR5cGUgICAgIC0gJ2ZpbGUnLCAnZGlyJywgJ3N5bWxpbmsnLCAndW5rbm93bidcbiAqICAgIHJvb3QgICAgIC0gZS5nLiAnQzovJ1xuICogICAgZmlsZU5hbWVcbiAqICAgIHN0dWJcbiAqICAgIHB1cnBvc2VcbiAqICAgIGV4dFxuICogICAgcmVsUGF0aCAgIC0gcmVsYXRpdmUgdG8gd29ya2luZyBkaXIsIG5vIGxlYWRpbmcgLiBvciAuLlxuICogVGhlc2Ugb3B0aW9ucyBtYXkgYmUgc3BlY2lmaWVkIGluIHRoZSAybmQgcGFyYW1ldGVyOlxuICogICAgcm9vdDogc3RyaW5nIC0gcm9vdCBvZiBzZWFyY2gsIChkZWY6IERlbm8uY3dkKCkpXG4gKiAgICBsRXhjbHVkZTogW3N0cmluZ10gLSBwYXR0ZXJucyB0byBleGNsdWRlLFxuICogICAgXHRkZWY6IFsnbm9kZV9tb2R1bGVzLyoqJywgJy5naXQvKionXVxuICogICAgaW5jbHVkZURpcnM6IGJvb2xlYW4gLSBzaG91bGQgZGlyZWN0b3JpZXMgYmUgaW5jbHVkZWQ/IChkZWY6IHRydWUpXG4gKiBcdGZvbGxvd1N5bWxpbmtzIC0gYm9vbGVhbiAtIHNob3VsZCBzeW0gbGlua3MgYmUgZm9sbG93ZWQ/IChkZWY6IGZhbHNlKVxuICogXHRjYW5vbmljYWxpemU6IGJvb2xlYW4gLSBpZiBmb2xsb3dzeW1saW5rcyBpcyB0cnVlLCBzaG91bGRcbiAqIFx0XHRwYXRocyBiZSBjYW5vbmljYWxpemVkPyAoZGVmOiB0cnVlKVxuICogXHRmaWx0ZXI6IChzdHJpbmcgPT4gYW55PykgLSBpZ25vcmUgaWYgdW5kZWYgcmV0dXJuZWQsXG4gKiAgICAgICBlbHNlIHlpZWxkIHRoZSByZXR1cm5lZCB2YWx1ZVxuICpcbiAqIEdsb2IgcGF0dGVybjpcbiAqIFx0KiAgICAgICAgIG1hdGNoIGFueSBudW1iZXIgb2YgY2hhcnMsIGV4Y2VwdCBwYXRoIHNlcGFyYXRvclxuICogXHQqKiAgICAgICAgbWF0Y2ggemVybyBvciBtb3JlIGRpcmVjdG9yaWVzXG4gKiBcdD8gICAgICAgICBtYXRjaCBhbnkgc2luZ2xlIGNoYXIsIGV4Y2VwdCBwYXRoIHNlcGFyYXRvclxuICogXHQvICAgICAgICAgcGF0aCBzZXBhcmF0b3JcbiAqIFx0W2FiY10gICAgIG1hdGNoIG9uZSBjaGFyIGluIHRoZSBicmFja2V0c1xuICogXHRbIWFiY10gICAgbWF0Y2ggb25lIGNoYXIgbm90IGluIHRoZSBicmFja2V0c1xuICogXHR7YWJjLDEyM30gY29tbWEtc2VwYXJhdGVkIGxpc3Qgb2YgbGl0ZXJhbHMgdG8gbWF0Y2hcbiAqL1xuXG5leHBvcnQgYWxsRmlsZXNNYXRjaGluZyA6PSAoXG5cdHBhdHRlcm46IHN0cmluZz0nKionLFxuXHRoT3B0aW9uczogaGFzaD17fVxuXHQpOiBHZW5lcmF0b3I8YW55LCB2b2lkLCB2b2lkPiAtPlxuXG5cdHtcblx0XHRyb290LFxuXHRcdGxFeGNsdWRlLFxuXHRcdGluY2x1ZGVEaXJzLFxuXHRcdGZvbGxvd1N5bWxpbmtzLFxuXHRcdGNhbm9uaWNhbGl6ZSxcblx0XHRmaWx0ZXIsXG5cdFx0ZGVidWdcblx0XHR9IDo9IGdldE9wdGlvbnMgaE9wdGlvbnMsIHtcblx0XHRcdHJvb3Q6IHVuZGVmXG5cdFx0XHRsRXhjbHVkZTogW1xuXHRcdFx0XHQnbm9kZV9tb2R1bGVzLyoqJ1xuXHRcdFx0XHQnLmdpdC8qKidcblx0XHRcdFx0JyoqLyoudGVtcC4qJ1xuXHRcdFx0XHRdXG5cdFx0XHRpbmNsdWRlRGlyczogZmFsc2Vcblx0XHRcdGZvbGxvd1N5bWxpbmtzOiBmYWxzZVxuXHRcdFx0Y2Fub25pY2FsaXplOiBmYWxzZVxuXHRcdFx0ZmlsdGVyOiB1bmRlZlxuXHRcdFx0ZGVidWc6IGZhbHNlXG5cdFx0XHR9XG5cblx0aEdsb2JPcHRpb25zIDo9IHtcblx0XHRyb290XG5cdFx0ZXhjbHVkZTogbEV4Y2x1ZGVcblx0XHRpbmNsdWRlRGlyc1xuXHRcdGZvbGxvd1N5bWxpbmtzXG5cdFx0Y2Fub25pY2FsaXplXG5cdFx0fVxuXG5cdERCRyA6PSAobXNnOiBzdHJpbmcpOiB2b2lkID0+XG5cdFx0aWYgZGVidWdcblx0XHRcdGNvbnNvbGUubG9nIG1zZ1xuXHRcdHJldHVyblxuXG5cdGZvciBoIG9mIGV4cGFuZEdsb2JTeW5jKHBhdHRlcm4sIGhHbG9iT3B0aW9ucylcblx0XHQjIC0tLSBoIGhhcyBrZXlzOiBwYXRoLCBuYW1lLCBpc0ZpbGUsIGlzRGlyZWN0b3J5LCBpc1N5bUxpbmtcblxuXHRcdERCRyBcIk1BVENIOiAje2gucGF0aH1cIlxuXHRcdHR5cGUgOj0gKFxuXHRcdFx0ICBoLmlzRmlsZSAgICAgID8gJ2ZpbGUnXG5cdFx0XHQ6IGguaXNEaXJlY3RvcnkgPyAnZGlyJ1xuXHRcdFx0OiBoLmlzU3ltbGluayAgID8gJ3N5bWxpbmsnXG5cdFx0XHQ6ICAgICAgICAgICAgICAgICAndW5rbm93bidcblx0XHRcdClcblx0XHRoRmlsZSA6PSBwYXJzZVBhdGgoaC5wYXRoKVxuXHRcdGlmIG5vdGRlZmluZWQoZmlsdGVyKVxuXHRcdFx0REJHIFwiICAgLSBubyBmaWx0ZXJcIlxuXHRcdFx0eWllbGQgaEZpbGVcblx0XHRlbHNlXG5cdFx0XHRyZXN1bHQ6IGFueT8gOj0gZmlsdGVyKGhGaWxlKVxuXHRcdFx0aWYgbm90ZGVmaW5lZChyZXN1bHQpXG5cdFx0XHRcdERCRyBcIiAgIC0gZXhjbHVkZWQgYnkgZmlsdGVyXCJcblx0XHRcdGVsc2Vcblx0XHRcdFx0REJHIFwiICAgLSBhbGxvd2VkIGJ5IGZpbHRlclwiXG5cdFx0XHRcdHlpZWxkIHJlc3VsdFxuXHRyZXR1cm5cblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiMgQVNZTkMgR0VORVJBVE9SXG5cbi8qKlxuICogQW4gYXN5bmMgaXRlcmFibGUgLSB5aWVsZHMgZXZlcnkgbGluZSBpbiB0aGUgZ2l2ZW4gZmlsZVxuICpcbiAqIFVzYWdlOlxuICogICBmb3IgYXdhaXQgbGluZSBvZiBhbGxMaW5lc0luKCdzcmMvbGliL3RlbXAuY2l2ZXQnKVxuICogXHQgIGNvbnNvbGUubG9nIFwiTElORTogI3tsaW5lfVwiXG4gKiAgIGNvbnNvbGUubG9nIFwiRE9ORVwiXG4gKi9cblxuZXhwb3J0IGFsbExpbmVzSW4gOj0gKFxuXHRwYXRoOiBzdHJpbmdcblx0KTogQXN5bmNHZW5lcmF0b3I8c3RyaW5nLCB2b2lkLCB2b2lkPiAtPlxuXG5cdGFzc2VydCBpc0ZpbGUocGF0aCksIFwiTm8gc3VjaCBmaWxlOiAje09MKHBhdGgpfSAoYWxsTGluZXNJbilcIlxuXHRmIDo9IGF3YWl0IERlbm8ub3BlbihwYXRoKVxuXHRyZWFkYWJsZSA6PSBmLnJlYWRhYmxlXG5cdFx0LnBpcGVUaHJvdWdoKG5ldyBUZXh0RGVjb2RlclN0cmVhbSgpKVxuXHRcdC5waXBlVGhyb3VnaChuZXcgVGV4dExpbmVTdHJlYW0oKSlcblxuXHRmb3IgYXdhaXQgbGluZSBvZiByZWFkYWJsZVxuXHRcdHlpZWxkIGxpbmVcblx0cmV0dXJuXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogY29udmVydHMgYWxsIGJhY2tzbGFzaCBjaGFyYWN0ZXJzIHRvIGZvcndhcmQgc2xhc2hlc1xuICogdXBwZXItY2FzZXMgZHJpdmUgbGV0dGVyc1xuICovXG5cbmV4cG9ydCBub3JtYWxpemVQYXRoIDo9IChwYXRoOiBzdHJpbmcpOiBzdHJpbmcgPT5cblxuXHRucGF0aCA6PSBwYXRoLnJlcGxhY2VBbGwoJ1xcXFwnLCAnLycpXG5cdGlmIChucGF0aC5jaGFyQXQoMSkgPT0gJzonKVxuXHRcdHJldHVybiBucGF0aC5jaGFyQXQoMCkudG9VcHBlckNhc2UoKSArIG5wYXRoLnN1YnN0cmluZygxKVxuXHRlbHNlXG5cdFx0cmV0dXJuIG5wYXRoXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbmV4cG9ydCBwYXRoVG9VUkwgOj0gKGxQYXJ0cy4uLjogc3RyaW5nW10pOiBzdHJpbmcgPT5cblxuXHRwYXRoIDo9IHJlc29sdmUobFBhcnRzLi4uKVxuXHRyZXR1cm4gbmV3IFVSTCgnZmlsZTovLycgKyBwYXRoKS5ocmVmXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogcmVzb2x2ZXMgbXVsdGlwbGUgcGF0aCBwYXJ0cyB0byBhIHNpbmdsZSBwYXRoXG4gKiByZXR1cm5zIG5vcm1hbGl6ZWQgcGF0aFxuICovXG5cbmV4cG9ydCBta3BhdGggOj0gKGxQYXJ0cy4uLjogc3RyaW5nW10pOiBzdHJpbmcgPT5cblxuXHRwYXRoIDo9IHJlc29sdmUobFBhcnRzLi4uKVxuXHRyZXR1cm4gbm9ybWFsaXplUGF0aChwYXRoKVxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG5leHBvcnQgdHlwZSBwYXRoRGVzYyA9IHtcblx0ZGlyOiBzdHJpbmdcblx0cm9vdDogc3RyaW5nXG5cdGxQYXJ0czogc3RyaW5nW11cblx0fVxuXG4vKipcbiAqIHJldHVybnMge2Rpciwgcm9vdCwgbFBhcnRzfSB3aGVyZSBsUGFydHMgaW5jbHVkZXMgdGhlIG5hbWVzIG9mXG4gKiBhbGwgZGlyZWN0b3JpZXMgYmV0d2VlbiB0aGUgcm9vdCBhbmQgdGhlIGZpbGUgbmFtZVxuICogcmVsYXRpdmUgdG8gdGhlIGN1cnJlbnQgd29ya2luZyBkaXJlY3RvcnlcbiAqL1xuXG5leHBvcnQgcGF0aFN1YkRpcnMgOj0gKHBhdGg6IHN0cmluZywgaE9wdGlvbnM6IGhhc2g9e30pOiBwYXRoRGVzYyA9PlxuXG5cdHtyZWxhdGl2ZX0gOj0gZ2V0T3B0aW9ucyBoT3B0aW9ucywge1xuXHRcdHJlbGF0aXZlOiBmYWxzZVxuXHRcdH1cblx0cGF0aCA9IHJlbGF0aXZlID8gcmVscGF0aChwYXRoKSA6IG1rcGF0aChwYXRoKVxuXHR7cm9vdCwgZGlyfSA6PSBwYXJzZShwYXRoKVxuXHRyZXR1cm4ge1xuXHRcdGRpclxuXHRcdHJvb3Rcblx0XHRsUGFydHM6IGRpci5zbGljZShyb290Lmxlbmd0aCkuc3BsaXQoL1tcXFxcXFwvXS8pXG5cdFx0fVxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuIyAtLS0gU2hvdWxkIGJlIGNhbGxlZCBsaWtlOiBteXNlbGYoaW1wb3J0Lm1ldGEudXJsKVxuIyAgICAgcmV0dXJucyBmdWxsIHBhdGggb2YgY3VycmVudCBmaWxlXG5cbmV4cG9ydCBteXNlbGYgOj0gKHVybDogc3RyaW5nKTogc3RyaW5nID0+XG5cblx0cmV0dXJuIHJlbHBhdGggZnJvbUZpbGVVcmwodXJsKVxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuLyoqXG4gKiByZWFkIGEgZmlsZSBpbnRvIGEgc3RyaW5nXG4gKi9cblxuZXhwb3J0IHNsdXJwIDo9IChwYXRoOiBzdHJpbmcpOiBzdHJpbmcgPT5cblxuXHRhc3NlcnQgaXNGaWxlKHBhdGgpLCBcIk5vIHN1Y2ggZmlsZTogI3twYXRofSAoc2x1cnApXCJcblx0ZGF0YSA6PSBEZW5vLnJlYWRGaWxlU3luYyBwYXRoXG5cdHJldHVybiBkZWNvZGVyLmRlY29kZShkYXRhKS5yZXBsYWNlQWxsKCdcXHInLCAnJylcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuLyoqXG4gKiB3cml0ZSBhIHN0cmluZyB0byBhIGZpbGVcbiAqIHdpbGwgZW5zdXJlIHRoYXQgYWxsIG5lY2Vzc2FyeSBkaXJlY3RvcmllcyBleGlzdFxuICovXG5cbmV4cG9ydCBiYXJmIDo9IChcblx0cGF0aDogc3RyaW5nLFxuXHRjb250ZW50czogc3RyaW5nLFxuXHRoT3B0aW9uczogaGFzaD17fVxuXHQpOiB2b2lkID0+XG5cblx0e2FwcGVuZH0gOj0gZ2V0T3B0aW9ucyBoT3B0aW9ucywge1xuXHRcdGFwcGVuZDogZmFsc2Vcblx0XHR9XG5cdG1rRGlyc0ZvckZpbGUocGF0aClcblx0ZGF0YSA6PSBlbmNvZGVyLmVuY29kZShjb250ZW50cylcblx0aWYgYXBwZW5kICYmIGlzRmlsZShwYXRoKVxuXHRcdGFwcGVuZEZpbGVTeW5jIHBhdGgsIGRhdGFcblx0ZWxzZVxuXHRcdERlbm8ud3JpdGVGaWxlU3luYyBwYXRoLCBkYXRhXG5cdHJldHVyblxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG5leHBvcnQgbmV3ZXJEZXN0RmlsZUV4aXN0cyA6PSAoXG5cdHNyY1BhdGg6IHN0cmluZyxcblx0ZGVzdFBhdGg6IHN0cmluZ1xuXHQpOiBib29sZWFuID0+XG5cblx0YXNzZXJ0IGlzRmlsZShzcmNQYXRoKSwgXCJObyBzdWNoIGZpbGU6ICN7T0woc3JjUGF0aCl9IChuZXdlckRlc3RGaWxlRXhpc3RzKVwiXG5cdGlmIG5vdCBleGlzdHNTeW5jKGRlc3RQYXRoKVxuXHRcdHJldHVybiBmYWxzZVxuXHRzcmNNb2RUaW1lIDo9IHN0YXRTeW5jKHNyY1BhdGgpLm10aW1lTXNcblx0ZGVzdE1vZFRpbWUgOj0gc3RhdFN5bmMoZGVzdFBhdGgpLm10aW1lTXNcblx0cmV0dXJuIChkZXN0TW9kVGltZSA+IHNyY01vZFRpbWUpXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogY3JlYXRlIGEgbmV3IGRpcmVjdG9yeSBpZiBpdCBkb2Vzbid0IGV4aXN0XG4gKiBpZiB0aGUgb3B0aW9uICdjbGVhcicgaXMgc2V0IHRvIGEgdHJ1ZSB2YWx1ZSBpbiB0aGUgMm5kIHBhcmFtZXRlclxuICogYW5kIHRoZSBkaXJlY3RvcnkgYWxyZWFkeSBleGlzdHMsIGl0IGlzIGNsZWFyZWRcbiAqL1xuXG5leHBvcnQgbWtEaXIgOj0gKFxuXHRcdGRpclBhdGg6IHN0cmluZyxcblx0XHRjbGVhcjogYm9vbGVhbj1mYWxzZVxuXHRcdCk6IHZvaWQgPT5cblxuXHRpZiBjbGVhclxuXHRcdGVtcHR5RGlyU3luYyBkaXJQYXRoICAgICMgLS0tIGNyZWF0ZXMgaWYgaXQgZG9lc24ndCBleGlzdFxuXHRlbHNlXG5cdFx0ZW5zdXJlRGlyU3luYyBkaXJQYXRoXG5cdHJldHVyblxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKipcbiAqIHJlbW92ZSBhIGZpbGUgZnJvbSB0aGUgZmlsZSBzeXN0ZW0sIGJ1dCBkbyBub3RoaW5nXG4gKiBpZiB0aGUgZmlsZSBkb2VzIG5vdCBleGlzdFxuICovXG5cbmV4cG9ydCBybUZpbGUgOj0gKHBhdGg6IHN0cmluZyk6IHZvaWQgPT5cblxuXHRpZiBleGlzdHNTeW5jIHBhdGhcblx0XHREZW5vLnJlbW92ZVN5bmMgcGF0aFxuXHRyZXR1cm5cblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuLyoqXG4gKiByZW1vdmUgYSBkaXJlY3RvcnkgZnJvbSB0aGUgZmlsZSBzeXN0ZW0sIGJ1dCBkbyBub3RoaW5nXG4gKiBpZiB0aGUgZGlyZWN0b3J5IGRvZXMgbm90IGV4aXN0XG4gKiBOT1RFOiBZb3UgbXVzdCBwYXNzIHRoZSAnY2xlYXInIG9wdGlvbiBpZiB0aGUgZGlyZWN0b3J5XG4gKiAgICAgICBpcyBub3QgZW1wdHlcbiAqL1xuXG5leHBvcnQgcm1EaXIgOj0gKHBhdGg6IHN0cmluZywgaE9wdGlvbnM6IGhhc2g9e30pOiB2b2lkID0+XG5cblx0e2NsZWFyfSA6PSBnZXRPcHRpb25zIGhPcHRpb25zLCB7XG5cdFx0Y2xlYXI6IGZhbHNlXG5cdFx0fVxuXHRpZiBleGlzdHNTeW5jIHBhdGhcblx0XHRpZiBjbGVhclxuXHRcdFx0RGVuby5yZW1vdmVTeW5jIHBhdGgsIHtyZWN1cnNpdmU6IHRydWV9XG5cdFx0ZWxzZVxuXHRcdFx0RGVuby5yZW1vdmVTeW5jIHBhdGhcblx0cmV0dXJuXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogY3JlYXRlIGFueSBtaXNzaW5nIGRpcmVjdG9yaWVzIGluIHRoZSBnaXZlbiBwYXRoXG4gKi9cblxuZXhwb3J0IG1rRGlyc0ZvckZpbGUgOj0gKHBhdGg6IHN0cmluZyk6IHZvaWQgPT5cblxuXHR7cm9vdCwgbFBhcnRzfSA6PSBwYXRoU3ViRGlycyhwYXRoKVxuXHRsZXQgZGlyID0gcm9vdFxuXHRmb3IgcGFydCBvZiBsUGFydHNcblx0XHRkaXIgKz0gXCIvI3twYXJ0fVwiXG5cdFx0aWYgbm90IGlzRGlyKGRpcilcblx0XHRcdG1rRGlyIGRpclxuXHRyZXR1cm5cblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuLyoqXG4gKiBkZWxldGVzIGFsbCBmaWxlcyBhbmQgc3ViZGlyZWN0b3JpZXMgaW4gdGhlIGdpdmVuIGRpcmVjdG9yeVxuICovXG5cbmV4cG9ydCBjbGVhckRpciA6PSAoZGlyUGF0aDogc3RyaW5nKTogdm9pZCA9PlxuXG5cdGVtcHR5RGlyU3luYyBkaXJQYXRoXG5cdHJldHVyblxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuIyAtLS0gaE9wdGlvbnMgZ2V0cyBwYXNzZWQgdG8gYWxsRmlsZXNNYXRjaGluZygpXG5cbmV4cG9ydCByZW1vdmVGaWxlc01hdGNoaW5nIDo9IChcblx0cGF0dGVybjogc3RyaW5nLFxuXHRoT3B0aW9uczogaGFzaD17fVxuXHQpOiB2b2lkID0+XG5cblx0YXNzZXJ0IChwYXR0ZXJuICE9ICcqJykgJiYgKHBhdHRlcm4gIT0gJyoqJyksXG5cdFx0XCJDYW4ndCBkZWxldGUgZmlsZXMgbWF0Y2hpbmcgI3tPTChwYXR0ZXJuKX1cIlxuXHRmb3Ige3JlbFBhdGh9IG9mIGFsbEZpbGVzTWF0Y2hpbmcocGF0dGVybiwgaE9wdGlvbnMpXG5cdFx0RGVuby5yZW1vdmVTeW5jIHJlbFBhdGhcblx0cmV0dXJuXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbmV4cG9ydCByZW1vdmVGaWxlc0V4Y2VwdCA6PSAoXG5cdHBhdHRlcm46IHN0cmluZyxcblx0bEtlZXA6IHN0cmluZ1tdLFxuXHRoT3B0aW9uczogaGFzaCA9IHt9XG5cdCk6IHZvaWQgPT5cblxuXHR7ZGVidWd9IDo9IGdldE9wdGlvbnMgaE9wdGlvbnMsIHtcblx0XHRkZWJ1ZzogZmFsc2Vcblx0XHR9XG5cdERCRyA6PSAobXNnOiBzdHJpbmcpOiB2b2lkID0+XG5cdFx0aWYgZGVidWdcblx0XHRcdGNvbnNvbGUubG9nIG1zZ1xuXHRcdHJldHVyblxuXG5cdCMgLS0tIHRydXRoeSByZXR1cm4gbWVhbnMgcmVtb3ZlIGl0XG5cdGZpbHRlciA6PSAoaEZpbGU6IHBhdGhJbmZvKTogcGF0aEluZm8/ID0+XG5cdFx0e3R5cGUsIHJlbFBhdGh9IDo9IGhGaWxlXG5cdFx0aWYgKHR5cGUgIT0gJ2ZpbGUnKVxuXHRcdFx0cmV0dXJuIHVuZGVmXG5cdFx0cmVtb3ZlRmlsZSA6PSBub3QgbEtlZXAuaW5jbHVkZXMocmVsUGF0aClcblx0XHREQkcgXCJmaWx0ZXIoI3tyZWxQYXRofSk6IHJlbW92ZUZpbGUgPSAje3JlbW92ZUZpbGV9XCJcblx0XHRyZXR1cm4gcmVtb3ZlRmlsZSA/IGhGaWxlIDogdW5kZWZcblxuXHRoOiBoYXNoIDo9IHtmaWx0ZXIsIGRlYnVnfVxuXHRmb3Ige3JlbFBhdGh9IG9mIGFsbEZpbGVzTWF0Y2hpbmcocGF0dGVybiwgaClcblx0XHREQkcgXCJSRU1PVkUgRklMRSAje3JlbFBhdGh9XCJcblx0XHREZW5vLnJlbW92ZVN5bmMgcmVsUGF0aFxuXHRyZXR1cm5cblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuZXhwb3J0IHR5cGUgZnNDaGFuZ2VUeXBlID0ge1xuXHRraW5kOiBzdHJpbmdcblx0cGF0aDogc3RyaW5nXG5cdG1zPzogbnVtYmVyXG5cdH1cblxuLyoqXG4gKiB0eXBlIGZzQ2FsbGJhY2tGdW5jIC0gYSBmdW5jdGlvbiB0YWtpbmcgKHR5cGUsIHBhdGgpIGFuZCBvcHRpb25hbGx5XG4gKiByZXR1cm5zIGEgZnVuY3Rpb24gcmVmZXJlbmNlIHRvIGJlIGNhbGxlZCBvbiBmaWxlIGNoYW5nZXNcbiAqL1xuXG5leHBvcnQgdHlwZSBmc0NhbGxiYWNrRnVuYyA9IChjaGFuZ2U6IGZzQ2hhbmdlVHlwZSkgPT4gdm9pZFxuXG4vKipcbiAqIGNsYXNzIEZpbGVFdmVudEhhbmRsZXJcbiAqICAgIGhhbmRsZXMgZmlsZSBjaGFuZ2VkIGV2ZW50cyB3aGVuIC5oYW5kbGUoe2tpbmQsIHBhdGh9KSBpcyBjYWxsZWRcbiAqICAgIGNhbGxiYWNrIGlzIGEgZnVuY3Rpb24sIGRlYm91bmNlZCBieSAyMDAgbXNcbiAqICAgICAgIHRoYXQgdGFrZXMgKHR5cGUsIHBhdGgpIGFuZCByZXR1cm5zIGEgdm9pZEZ1bmNcbiAqICAgICAgIHdoaWNoIHdpbGwgYmUgY2FsbGVkIGlmIHRoZSBjYWxsYmFjayByZXR1cm5zIGEgZnVuY3Rpb24gcmVmZXJlbmNlXG4gKiBbdW5pdCB0ZXN0c10oLi4vdGVzdC9mcy50ZXN0LmNpdmV0Izp+OnRleHQ9JTIzJTIwJTJEJTJEJTJEJTIwY2xhc3MlMjBGaWxlRXZlbnRIYW5kbGVyKVxuICovXG5cbmV4cG9ydCBjbGFzcyBGaWxlRXZlbnRIYW5kbGVyXG5cblx0Y2FsbGJhY2s6IGZzQ2FsbGJhY2tGdW5jP1xuXHRsQ2hhbmdlczogZnNDaGFuZ2VUeXBlW10gOj0gW11cblx0aEhhbmRsZXJzOiBoYXNoID0ge30gICAjIC0tLSBwYXRoID0+IGV2ZW50IHR5cGUgPT4gZGVib3VuY2VkIGhhbmRsZXJcblx0b25TdG9wOiAoKSA9PiB2b2lkID0gcGFzc1xuXHRtczogbnVtYmVyXG5cdGRlYnVnOiBib29sZWFuXG5cblx0Y29uc3RydWN0b3IoXG5cdFx0XHRAY2FsbGJhY2s6IGZzQ2FsbGJhY2tGdW5jPz11bmRlZixcblx0XHRcdGhPcHRpb25zOiBoYXNoPXt9XG5cdFx0XHQpXG5cblx0XHR7XG5cdFx0XHRkZWJ1ZzogQGRlYnVnLFxuXHRcdFx0b25TdG9wOiBAb25TdG9wXG5cdFx0XHRtczogQG1zXG5cdFx0XHR9IDo9IGdldE9wdGlvbnMgaE9wdGlvbnMsIHtcblx0XHRcdFx0ZGVidWc6IGZhbHNlXG5cdFx0XHRcdG9uU3RvcDogcGFzc1xuXHRcdFx0XHRtczogMjAwXG5cdFx0XHRcdH1cblx0XHRAREJHIFwiRmlsZUV2ZW50SGFuZGxlciBjb25zdHJ1Y3RvcigpIGNhbGxlZFwiXG5cblx0IyAtLS0gQ2FsbHMgYSBmdW5jdGlvbiBvZiB0eXBlICgpID0+IHZvaWRcblx0IyAgICAgYnV0IGlzIGRlYm91bmNlZCBieSBAbXMgbXNcblxuXHRoYW5kbGUoY2hhbmdlOiBmc0NoYW5nZVR5cGUpOiB2b2lkXG5cdFx0e2tpbmQsIHBhdGh9IDo9IGNoYW5nZVxuXHRcdEBEQkcgXCJIQU5ETEU6IFsje3NpbmNlTG9hZFN0cigpfV0gI3traW5kfSAje3BhdGh9XCJcblx0XHRpZiBub3RkZWZpbmVkKEBoSGFuZGxlcnM/LltwYXRoXSlcblx0XHRcdEBEQkcgXCJDcmVhdGUgaGFuZGxlciBmb3IgJyN7cGF0aH0nXCIsIDFcblx0XHRcdEBoSGFuZGxlcnNbcGF0aF0gPSB7fVxuXG5cdFx0aWYgbm90ZGVmaW5lZChAaEhhbmRsZXJzPy5bcGF0aF0/LltraW5kXSlcblx0XHRcdEBEQkcgXCJDcmVhdGUgaGFuZGxlciBmb3IgI3traW5kfSAje3BhdGh9XCIsIDFcblx0XHRcdGZ1bmMgOj0gKCkgPT5cblx0XHRcdFx0aWYgQGNhbGxiYWNrXG5cdFx0XHRcdFx0QGNhbGxiYWNrKHtraW5kLCBwYXRofSlcblx0XHRcdFx0QGxDaGFuZ2VzLnB1c2gge2tpbmQsIHBhdGh9XG5cdFx0XHRcdEBoSGFuZGxlcnNbcGF0aF1ba2luZF0gPSB1bmRlZlxuXHRcdFx0XHRyZXR1cm4gdW5kZWZcblx0XHRcdEBoSGFuZGxlcnNbcGF0aF1ba2luZF0gPSBkZWJvdW5jZShmdW5jLCBAbXMpXG5cdFx0QERCRyBcIkNhbGwgZGVib3VuY2VkIGhhbmRsZXIgZm9yICN7a2luZH0gI3twYXRofVwiXG5cdFx0QGhIYW5kbGVyc1twYXRoXVtraW5kXSgpXG5cdFx0cmV0dXJuXG5cblx0IyAtLS0gQVNZTkMhXG5cdGdldENoYW5nZUxpc3QoKVxuXHRcdGF3YWl0IHNsZWVwIEBtc1xuXHRcdHJldHVybiBAbENoYW5nZXNcblxuXHRwcml2YXRlIERCRyhtc2c6IHN0cmluZywgbGV2ZWw6IG51bWJlcj0wKTogdm9pZFxuXHRcdGlmIEBkZWJ1Z1xuXHRcdFx0Y29uc29sZS5sb2cgXCIgICAje3NwYWNlcygzKmxldmVsKX0tICN7bXNnfVwiXG5cdFx0cmV0dXJuXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4jIEFTWU5DXG5cbmV4cG9ydCB0eXBlIHdhdGNoZXJDYWxsYmFja0Z1bmMgPSAoY2hhbmdlOiBmc0NoYW5nZVR5cGUpID0+IGJvb2xlYW5cblxuLyoqXG4gKiBhIGZ1bmN0aW9uIHRoYXQgd2F0Y2hlcyBmb3IgY2hhbmdlcyBvbmUgb3IgbW9yZSBmaWxlcyBvciBkaXJlY3Rvcmllc1xuICogICAgYW5kIGNhbGxzIGEgY2FsbGJhY2sgZnVuY3Rpb24gZm9yIGVhY2ggY2hhbmdlLlxuICogSWYgdGhlIGNhbGxiYWNrIHJldHVybnMgdHJ1ZSwgd2F0Y2hpbmcgaXMgaGFsdGVkXG4gKlxuICogVXNhZ2U6XG4gKiAgIGhhbmRsZXIgOj0gKGtpbmQsIHBhdGgpID0+IGNvbnNvbGUubG9nIHBhdGhcbiAqICAgYXdhaXQgd2F0Y2hGaWxlICd0ZW1wLnR4dCcsIGhhbmRsZXJcbiAqICAgYXdhaXQgd2F0Y2hGaWxlICdzcmMvbGliJywgIGhhbmRsZXJcbiAqICAgYXdhaXQgd2F0Y2hGaWxlIFsndGVtcC50eHQnLCAnc3JjL2xpYiddLCBoYW5kbGVyXG4gKi9cblxuZXhwb3J0IHdhdGNoRmlsZSA6PSAoXG5cdHBhdGg6IHN0cmluZyB8IHN0cmluZ1tdLFxuXHR3YXRjaGVyQ0I6IHdhdGNoZXJDYWxsYmFja0Z1bmMsXG5cdGhPcHRpb25zOiBoYXNoPXt9XG5cdCk6IHZvaWQgLT5cblxuXHR7ZGVidWcsIG1zfSA6PSBnZXRPcHRpb25zIGhPcHRpb25zLCB7XG5cdFx0ZGVidWc6IGZhbHNlXG5cdFx0bXM6IDIwMFxuXHRcdH1cblx0REJHIDo9IChtc2c6IHN0cmluZyk6IHZvaWQgPT5cblx0XHRpZiBkZWJ1Z1xuXHRcdFx0Y29uc29sZS5sb2cgbXNnXG5cdFx0cmV0dXJuXG5cblx0REJHIFwiV0FUQ0g6ICN7SlNPTi5zdHJpbmdpZnkocGF0aCl9XCJcblxuXHR3YXRjaGVyIDo9IERlbm8ud2F0Y2hGcyhwYXRoKVxuXG5cdGxldCBkb1N0b3A6IGJvb2xlYW4gPSBmYWxzZVxuXG5cdGZzQ2FsbGJhY2s6IGZzQ2FsbGJhY2tGdW5jIDo9ICh7a2luZCwgcGF0aH0pID0+XG5cdFx0cmVzdWx0IDo9IHdhdGNoZXJDQih7a2luZCwgcGF0aH0pXG5cdFx0REJHIFwiRkNCOiByZXN1bHQgPSAje3Jlc3VsdH1cIlxuXHRcdGlmIHJlc3VsdFxuXHRcdFx0d2F0Y2hlci5jbG9zZSgpXG5cdFx0cmV0dXJuXG5cblx0aGFuZGxlciA6PSBuZXcgRmlsZUV2ZW50SGFuZGxlcihmc0NhbGxiYWNrLCB7ZGVidWcsIG1zfSlcblxuXHRmb3IgYXdhaXQge2tpbmQsIHBhdGhzfSBvZiB3YXRjaGVyXG5cdFx0REJHIFwid2F0Y2hlciBldmVudCBmaXJlZFwiXG5cdFx0aWYgZG9TdG9wXG5cdFx0XHREQkcgXCJkb1N0b3AgPSAje2RvU3RvcH0sIENsb3Npbmcgd2F0Y2hlclwiXG5cdFx0XHRicmVha1xuXHRcdGZvciBwYXRoIG9mIHBhdGhzXG5cdFx0XHQjIC0tLSBmc0NhbGxiYWNrIHdpbGwgYmUgKGV2ZW50dWFsbHkpIGNhbGxlZFxuXHRcdFx0aGFuZGxlci5oYW5kbGUoe2tpbmQsIHBhdGh9KVxuXG5leHBvcnQgd2F0Y2hGaWxlcyA6PSB3YXRjaEZpbGVcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuZXhwb3J0IGFsbFRva2Vuc0luRmlsZSA6PSAoXG5cdFx0cGF0aDogc3RyaW5nXG5cdFx0KTogR2VuZXJhdG9yPFRva2VuLCB2b2lkLCB2b2lkPiAtPlxuXG5cdGZvciB0b2sgb2YgYWxsVG9rZW5zSW5CbG9jayhzbHVycChwYXRoKSlcblx0XHR5aWVsZCB0b2tcblx0cmV0dXJuXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4jIC0tLSBVc2VzIGEgcmVjdXJzaXZlIGRlc2NlbnQgcGFyc2VyXG5cbmV4cG9ydCB0eXBlIEZpbGVPcCA9IHtcblx0ZnVuY05hbWU6ICdta0RpcicgfCAnYmFyZidcblx0cGF0aDogc3RyaW5nXG5cdGNvbnRlbnRzPzogc3RyaW5nXG5cdH1cblxuZXhwb3J0IHNldERpclRyZWUgOj0gKFxuXHRcdGN1cnJlbnREaXI6IHN0cmluZyxcblx0XHRjb250ZW50czogc3RyaW5nLFxuXHRcdGhPcHRpb25zOiBoYXNoID0ge31cblx0XHQpOiBGaWxlT3BbXSA9PlxuXG5cdCMgLS0tIEV4dHJhY3Qgb3B0aW9uc1xuXHR7ZGVidWcsIGNsZWFyLCBzY2FmZm9sZH0gOj0gZ2V0T3B0aW9ucyBoT3B0aW9ucywge1xuXHRcdGRlYnVnOiB0cnVlXG5cdFx0Y2xlYXI6IGZhbHNlXG5cdFx0c2NhZmZvbGQ6IGZhbHNlXG5cdFx0fVxuXG5cdCMgLS0tIGZzIGxpYiBjYW4ndCB1c2UgbG9nZ2VyIGxpYiBkaXJlY3RseSwgc29cblx0IyAgICAgd2UgZGVmaW5lIGFuZCB1c2UgYSBsb2NhbCBEQkcoKSBmdW5jdGlvblxuXG5cdERCRyA6PSAoc3RyOiBzdHJpbmcpOiB2b2lkID0+XG5cdFx0aWYgZGVidWdcblx0XHRcdGNvbnNvbGUubG9nIHN0clxuXHRcdHJldHVyblxuXG5cdGxldCBsZXZlbDogaW50ZWdlciA9IDBcblxuXHRkYmdFbnRlciA6PSAobmFtZTogc3RyaW5nLCAuLi5sQXJnczogYW55W10pID0+XG5cdFx0c3RyQXJncyA6PSAoXG5cdFx0XHRmb3IgYXJnIG9mIGxBcmdzXG5cdFx0XHRcdE9MKGFyZylcblx0XHRcdCkuam9pbignLCAnKVxuXHRcdERCRyBcIiN7JyAgICcucmVwZWF0KGxldmVsKX0tPiAje25hbWV9KCN7c3RyQXJnc30pXCJcblx0XHRsZXZlbCArPSAxXG5cdFx0cmV0dXJuXG5cblx0ZGJnRXhpdCA6PSAobmFtZTogc3RyaW5nLCAuLi5sQXJnczogYW55W10pID0+XG5cdFx0c3RyQXJncyA6PSAoXG5cdFx0XHRmb3IgYXJnIG9mIGxBcmdzXG5cdFx0XHRcdE9MKGFyZylcblx0XHRcdCkuam9pbignLCAnKVxuXHRcdGxldmVsIC09IDFcblx0XHREQkcgXCIjeycgICAnLnJlcGVhdChsZXZlbCl9PC0gI3tuYW1lfSgje3N0ckFyZ3N9KVwiXG5cdFx0cmV0dXJuXG5cblx0ZGJnIDo9IChsaW5lOiBzdHJpbmcpID0+XG5cdFx0REJHIFwiI3snICAgJy5yZXBlYXQobGV2ZWwpfS0tICN7T0wobGluZSl9XCJcblx0XHRyZXR1cm5cblxuXHQjIC0tLSBJbiB1bml0IHRlc3RzLCB3ZSBqdXN0IHJldHVybiBjYWxscyBtYWRlXG5cdGxGaWxlT3BzOiBGaWxlT3BbXSA6PSBbXVxuXG5cdCMgLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLlxuXG5cdGRvTWFrZURpciA6PSAoXG5cdFx0XHRkaXJQYXRoOiBzdHJpbmdcblx0XHRcdCk6IHZvaWQgPT5cblxuXHRcdGFzc2VydCBpc1N0cmluZyhkaXJQYXRoKSwgXCJkaXJQYXRoIG5vdCBhIHN0cmluZzogI3tPTChkaXJQYXRoKX1cIlxuXHRcdHBhdGggOj0gcmVscGF0aChkaXJQYXRoKVxuXHRcdGlmIHNjYWZmb2xkXG5cdFx0XHRsRmlsZU9wcy5wdXNoIHtcblx0XHRcdFx0ZnVuY05hbWU6ICdta0Rpcidcblx0XHRcdFx0cGF0aFxuXHRcdFx0XHR9XG5cdFx0ZWxzZVxuXHRcdFx0IyAtLS0gaWYgY2xlYXIgb3B0aW9uIHNldCwgY2xlYXIgZGlyIGlmIGl0IGV4aXN0c1xuXHRcdFx0bWtEaXIgcGF0aCwgY2xlYXJcblx0XHRyZXR1cm5cblxuXHQjIC4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi5cblxuXHRkb0JhcmYgOj0gKFxuXHRcdFx0ZmlsZVBhdGg6IHN0cmluZyxcblx0XHRcdGNvbnRlbnRzOiBzdHJpbmdcblx0XHRcdCk6IHZvaWQgPT5cblxuXHRcdHBhdGggOj0gcmVscGF0aChmaWxlUGF0aClcblx0XHRpZiBzY2FmZm9sZFxuXHRcdFx0bEZpbGVPcHMucHVzaCB7XG5cdFx0XHRcdGZ1bmNOYW1lOiBcImJhcmZcIlxuXHRcdFx0XHRwYXRoXG5cdFx0XHRcdGNvbnRlbnRzXG5cdFx0XHRcdH1cblx0XHRlbHNlXG5cdFx0XHRiYXJmIHBhdGgsIGNvbnRlbnRzXG5cdFx0cmV0dXJuXG5cblx0IyAuLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uXG5cblx0ZmlsZUhhbmRsZXIgOj0gKFxuXHRcdFx0ZmlsZVBhdGg6IHN0cmluZyxcblx0XHRcdGxUb2tlbnM6IFRva2VuW11cblx0XHRcdCk6IHZvaWQgPT5cblxuXHRcdGRiZ0VudGVyICdmaWxlSGFuZGxlcicsIGZpbGVQYXRoXG5cdFx0Y29udGVudHMgOj0gaWYgKGxUb2tlbnNbMF0ua2luZCA9PSAnaW5kZW50Jylcblx0XHRcdGxUb2tlbnMuc2hpZnQoKVxuXHRcdFx0bExpbmVzIDo9IFtdXG5cdFx0XHRsZXQgbGV2ZWwgPSAwXG5cdFx0XHQjIEB0cy1pZ25vcmVcblx0XHRcdHdoaWxlIChsZXZlbCA+IDApIHx8IChsVG9rZW5zWzBdLmtpbmQgIT0gJ3VuZGVudCcpXG5cdFx0XHRcdHRvayA6PSBsVG9rZW5zLnNoaWZ0KClcblx0XHRcdFx0aWYgbm90ZGVmaW5lZCh0b2spXG5cdFx0XHRcdFx0Y3JvYWsgXCJObyAndW5kZW50JyBpbiBjbG9ja1wiXG5cdFx0XHRcdGVsc2Vcblx0XHRcdFx0XHRzd2l0Y2ggdG9rLmtpbmRcblx0XHRcdFx0XHRcdHdoZW4gJ2luZGVudCdcblx0XHRcdFx0XHRcdFx0bGV2ZWwgKz0gMVxuXHRcdFx0XHRcdFx0d2hlbiAndW5kZW50J1xuXHRcdFx0XHRcdFx0XHRsZXZlbCAtPSAxXG5cdFx0XHRcdFx0XHRcdGFzc2VydCAobGV2ZWwgPj0gMCksIFwiTmVnYXRpdmUgbGV2ZWwgaW4gc2V0RGlyVHJlZSgpXCJcblx0XHRcdFx0XHRcdGVsc2Vcblx0XHRcdFx0XHRcdFx0bGluZSA6PSBpbmRlbnRlZCh0b2suc3RyLCBsZXZlbClcblx0XHRcdFx0XHRcdFx0aWYgaXNTdHJpbmcobGluZSkgICAgIyAtLS0gQUxXQVlTIFNVQ0NFRURTXG5cdFx0XHRcdFx0XHRcdFx0ZGJnIGxpbmVcblx0XHRcdFx0XHRcdFx0XHRsTGluZXMucHVzaCBsaW5lXG5cblx0XHRcdCMgLS0tIEhFUkU6IChsZXZlbCA9PSAwKSBBTkQgKGxUb2tlbnNbMF0ua2luZCA9PSAndW5kZW50Jylcblx0XHRcdGFzc2VydCAobGV2ZWwgPT0gMCksIFwiYWZ0ZXIgZmlsZSBjb250ZW50cywgbGV2ZWwgPSAje09MKGxldmVsKX1cIlxuXHRcdFx0YXNzZXJ0IChsVG9rZW5zWzBdLmtpbmQgPT0gJ3VuZGVudCcpLFxuXHRcdFx0XHRcdFwiVU5ERU5UIGV4cGVjdGVkIGFmdGVyIGNvbnRlbnRzLCBnb3QgI3tPTChsVG9rZW5zWzBdKX1cIlxuXHRcdFx0bFRva2Vucy5zaGlmdCgpXG5cdFx0XHRsTGluZXMuam9pbignXFxuJylcblx0XHRlbHNlXG5cdFx0XHQnJ1xuXHRcdGRvQmFyZiBmaWxlUGF0aCwgY29udGVudHNcblx0XHRkYmdFeGl0ICdmaWxlSGFuZGxlcicsIGZpbGVQYXRoXG5cdFx0cmV0dXJuXG5cblx0ZGlySGFuZGxlciA6PSAoXG5cdFx0XHRkaXJQYXRoOiBzdHJpbmcsXG5cdFx0XHRsVG9rZW5zOiBUb2tlbltdXG5cdFx0XHQpOiB2b2lkID0+XG5cblx0XHRkYmdFbnRlciAnZGlySGFuZGxlcicsIGRpclBhdGhcblx0XHRkb01ha2VEaXIgZGlyUGF0aFxuXHRcdGlmIChsVG9rZW5zLmxlbmd0aCA+IDApICYmIChsVG9rZW5zWzBdLmtpbmQgPT0gJ2luZGVudCcpXG5cdFx0XHRsVG9rZW5zLnNoaWZ0KClcblx0XHRcdGJsb2NrSGFuZGxlcihkaXJQYXRoLCBsVG9rZW5zKVxuXHRcdFx0IyBAdHMtaWdub3JlXG5cdFx0XHRhc3NlcnQgKGxUb2tlbnNbMF0ua2luZCA9PSAndW5kZW50JyksIFwiTWlzc2luZyBVTkRFTlQgaW4gZGlySGFuZGxlclwiXG5cdFx0XHRsVG9rZW5zLnNoaWZ0KClcblx0XHRkYmdFeGl0ICdkaXJIYW5kbGVyJywgZGlyUGF0aFxuXHRcdHJldHVyblxuXG5cdGJsb2NrSGFuZGxlciA6PSAoZGlyUGF0aDogc3RyaW5nLCBsVG9rZW5zOiBUb2tlbltdKSA9PlxuXHRcdGRiZ0VudGVyICdibG9ja0hhbmRsZXInLCBkaXJQYXRoXG5cdFx0d2hpbGUgKGxUb2tlbnMubGVuZ3RoID4gMCkgJiYgKGxUb2tlbnNbMF0ua2luZCAhPSAndW5kZW50Jylcblx0XHRcdHRvazogVG9rZW4gOj0gbFRva2Vuc1swXVxuXHRcdFx0bFRva2Vucy5zaGlmdCgpXG5cdFx0XHR7a2luZCwgc3RyfSA6PSB0b2tcblx0XHRcdHN3aXRjaCBraW5kXG5cdFx0XHRcdHdoZW4gJ2luZGVudCdcblx0XHRcdFx0XHRjcm9hayBcIlVuZXhwZWN0ZWQgSU5ERU5UXCJcblx0XHRcdFx0ZWxzZVxuXHRcdFx0XHRcdGlmIHN0ci5zdGFydHNXaXRoKCcvJylcblx0XHRcdFx0XHRcdGRpckhhbmRsZXIgXCIje2RpclBhdGh9I3t0b2suc3RyfVwiLCBsVG9rZW5zXG5cdFx0XHRcdFx0ZWxzZVxuXHRcdFx0XHRcdFx0ZmlsZUhhbmRsZXIgXCIje2RpclBhdGh9LyN7dG9rLnN0cn1cIiwgbFRva2Vuc1xuXHRcdGRiZ0V4aXQgJ2Jsb2NrSGFuZGxlcidcblx0XHRyZXR1cm5cblxuXHQjIC4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi5cblxuXHRwdHlwZSA6PSBnZXRQYXRoVHlwZShjdXJyZW50RGlyKVxuXHRhc3NlcnQgKHB0eXBlID09ICdkaXInKSB8fCAocHR5cGUgPT0gJ21pc3NpbmcnKSxcblx0XHRcdFwiY3VycmVudERpciBpcyBhICN7cHR5cGV9XCJcblxuXHQjIC0tLSBDbGVhciB0aGUgZGlyZWN0b3J5IGlmIGl0IGV4aXN0c1xuXHRkb01ha2VEaXIgY3VycmVudERpclxuXG5cdGxUb2tlbnMgOj0gQXJyYXkuZnJvbShhbGxUb2tlbnNJbkJsb2NrKGNvbnRlbnRzKSlcblx0REJHIHRva2VuVGFibGUobFRva2VucylcblxuXHRibG9ja0hhbmRsZXIoY3VycmVudERpciwgbFRva2Vucylcblx0YXNzZXJ0IChsVG9rZW5zLmxlbmd0aCA9PSAwKSxcblx0XHRcdFwiVG9rZW5zIHJlbWFpbmluZyBhZnRlciBwYXJzZTogI3tPTChsVG9rZW5zKX1cIlxuXHRyZXR1cm4gbEZpbGVPcHNcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuZXhwb3J0IGZpbGVPcHNUYWJsZSA6PSAobEZpbGVPcHM6IEZpbGVPcFtdKTogc3RyaW5nID0+XG5cblx0dHQgOj0gbmV3IFRleHRUYWJsZShcImwgbFwiKVxuXHR0dC5mdWxsc2VwKClcblx0dHQudGl0bGUgJ0ZJTEUgT1BTJ1xuXHR0dC5mdWxsc2VwKClcblx0Zm9yIHtmdW5jTmFtZSwgcGF0aCwgY29udGVudHN9IG9mIGxGaWxlT3BzXG5cdFx0c3dpdGNoIGZ1bmNOYW1lXG5cdFx0XHR3aGVuICdta0Rpcidcblx0XHRcdFx0dHQuZGF0YSBbJ21rZGlyJywgcGF0aF1cblx0XHRcdHdoZW4gJ2JhcmYnXG5cdFx0XHRcdHR0LmRhdGEgWydiYXJmJywgcGF0aF1cblx0XHRcdFx0aWYgY29udGVudHNcblx0XHRcdFx0XHRmb3IgbGluZSBvZiBjb250ZW50cy5zcGxpdCgnXFxuJylcblx0XHRcdFx0XHRcdHR0LmRhdGEgWycnLCBsaW5lLnJlcGxhY2UoJ1xcdCcsIHNwYWNlcygzKSldXG5cdHR0LmZ1bGxzZXAoKVxuXHRyZXR1cm4gdHQuYXNTdHJpbmcoKVxuIl19