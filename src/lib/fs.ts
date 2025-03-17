"use strict";
// fs.civet

type AutoPromise<T> = T extends Promise<unknown> ? T : Promise<T>;
import {sprintf} from "jsr:@std/fmt/printf"
import {debounce} from 'jsr:@std/async/debounce'
import {
	existsSync, emptyDirSync, ensureDirSync,
	} from 'jsr:@std/fs'
import {
	appendFileSync,
	} from 'node:fs'
import {EventEmitter} from 'node:events'

// --- Deno's statSync and lstatSync are still unstable,
//     so use this
import {statSync} from 'node:fs'

import pathLib from 'node:path'
import urlLib from 'node:url'
import {expandGlobSync} from 'jsr:@std/fs/expand-glob'
import {TextLineStream} from 'jsr:@std/streams'

import {
	undef, defined, notdefined,
	isString, isNonEmptyString, isBoolean, isNumber, isInteger,
	isArray, isArrayOfStrings, isHash, isObject, isRegExp,
	integer, hash, voidFunc, optionspec,
	} from './datatypes.ts'
import {
	assert, croak, OL, getOptions, removeEmptyKeys, pass,
	spaces, sinceLoadStr, sleep,
	} from './llutils.ts'

const Deno = globalThis.Deno
export type pathType =
	'missing' | 'file' | 'dir' | 'symlink' | 'unknown'

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
		path = urlLib.fileURLToPath(path)
	}
	path = normalizePath(path)

	const {root, dir, base: fileName} = pathLib.parse(path)

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

/**
 * generate files that match a given glob pattern
 * yields {path, name, isFile, isDirectory, isSymlink}
 *    with parse option, also includes keys:
 *       relPath
 * These options may be specified in the 2nd parameter:
 *    root: string - root of search, (def: Deno.cwd())
 *    lExclude: [string] - patterns to exclude,
 *    	def: ['node_modules/**', '.git/**']
 *    includeDirs: boolean - should directories be included? (def: true)
 * 	followSymlinks - boolean - should sym links be followed? (def: false)
 * 	canonicalize: boolean - if followsymlinks is true, should
 * 		paths be canonicalized? (def: true)
 * 	filter: (string->boolean) - yield only if function returns true
 */

export const allFilesMatching = function*(
	pattern: string='**',
	hOptions: optionspec={}
	): Generator<hash, void, unknown> {

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
			lExclude: ['node_modules/**', '.git/**'],
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
		else if (filter(hFile)) {
			DBG("   - allowed by filter")
			yield hFile
		}
		else {
			DBG("   - excluded by filter")
		}
	}
	return
}

// ---------------------------------------------------------------------------
// ASYNC ITERABLE

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
	): AsyncGenerator<string, void, unknown> {

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

/**
 * resolves multiple path parts to a single path
 * returns normalized path
 */

export const mkpath = (...lParts: string[]): string => {

	const path = pathLib.resolve(...lParts)
	return normalizePath(path)
}

// ---------------------------------------------------------------------------

/**
 * resolves multiple path parts to a single path
 * returns normalized path, relative to current directory
 */

export const relpath = (...lParts: string[]): string => {

	assert(isArrayOfStrings(lParts), `Bad lParts: ${OL(lParts)}`)
	const fullPath = pathLib.resolve(...lParts)
	return normalizePath(pathLib.relative('', fullPath))
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

export var pathSubDirs = (path: string, hOptions: optionspec={}): pathDesc => {

	const {relative} = getOptions(hOptions, {
		relative: false
		})
	path = relative ? relpath(path) : mkpath(path)
	const {root, dir} = pathLib.parse(path)
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

	return relpath(urlLib.fileURLToPath(url))
}

// ---------------------------------------------------------------------------
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
	contents: string,
	path: string,
	hOptions: optionspec={}
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

export var mkDir = (dirPath: string, clear: boolean=false): void => {

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

export const rmDir = (path: string, hOptions: optionspec={}): void => {

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

export var mkDirsForFile = (path: string): void => {

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

export var clearDir = (dirPath: string): void => {

	emptyDirSync(dirPath)
	return
}

// ---------------------------------------------------------------------------
// --- hOptions gets passed to allFilesMatching()

export const removeFilesMatching = (
	pattern: string,
	hOptions: optionspec={}
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
	hOptions: optionspec = {}
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

	// --- true return means remove it
	const filter = (hFile: pathInfo): boolean => {
		const {type, relPath} = hFile
		if (type !== 'file') {
			return false
		}
		return !lKeep.includes(relPath)
	}

	const h: optionspec = {filter, debug}
	for (const {relPath} of allFilesMatching(pattern, h)) {
		DBG(`REMOVE FILE ${relPath}`)
		Deno.removeSync(relPath)
	}
	return
}

// ---------------------------------------------------------------------------

export const removeDirsExcept = (
	pattern: string,
	lKeep: string[],
	hOptions: optionspec = {}
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

	// --- true return means remove it
	const filter = (hFile: pathInfo): boolean => {
		const {type, relPath} = hFile
		if (type !== 'dir') {
			return false
		}
		return !lKeep.includes(relPath)
	}

	const h: optionspec = {filter, includeDirs: true}
	const pathFunc = (h: hash): string => h.path
	const lDirs = Array.from(allFilesMatching(pattern, h)).map(pathFunc)

	// --- We need to remove empty subdirectories before
	//     removing a directory, so we build a list and
	//     remove longer paths before shorter paths

	const compareFunc = (a: string, b: string): number => (b.length - a.length)
	for (const path of lDirs.sort(compareFunc)) {
		DBG(`REMOVE DIR ${path}`)
		Deno.removeSync(path)
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
			hOptions: optionspec={}
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

	// ASYNC!
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
	hOptions: optionspec={}
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
//		{kind, paths} := evt
		for (const path of paths) {
			// --- fsCallback will be (eventually) called
			handler.handle({kind, path})
		}
	}
}

export const watchFiles = watchFile

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3JjL2xpYi9mcy5jaXZldC50c3giLCJzb3VyY2VzIjpbInNyYy9saWIvZnMuY2l2ZXQiXSwibWFwcGluZ3MiOiI7QUFBQSxXQUFVO0FBQ1YsQUFBQTtBQUNBLEssVyxpRDtBQUFBLE1BQU0sQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLElBQUksQ0FBQyxxQkFBcUI7QUFDM0MsQUFBQSxBQUFBLE1BQU0sQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLElBQUksQ0FBQyx5QkFBeUI7QUFDaEQsQUFBQSxBQUFBLE1BQU0sQ0FBQyxDQUFDO0FBQ1IsQ0FBQyxVQUFVLENBQUMsQ0FBQyxZQUFZLENBQUMsQ0FBQyxhQUFhLENBQUM7QUFDekMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLGFBQWE7QUFDckIsQUFBQSxBQUFBLE1BQU0sQ0FBQyxDQUFDO0FBQ1IsQ0FBQyxjQUFjLENBQUM7QUFDaEIsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFNBQVM7QUFDakIsQUFBQSxBQUFBLE1BQU0sQ0FBQyxDQUFDLFlBQVksQ0FBQyxDQUFDLElBQUksQ0FBQyxhQUFhO0FBQ3hDLEFBQUE7QUFDQSxBQUFBLHdEQUF1RDtBQUN2RCxBQUFBLGtCQUFpQjtBQUNqQixBQUFBLEFBQUEsTUFBTSxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsSUFBSSxDQUFDLFNBQVM7QUFDaEMsQUFBQTtBQUNBLEFBQUEsQUFBQSxNQUFNLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxXQUFXO0FBQy9CLEFBQUEsQUFBQSxNQUFNLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxVQUFVO0FBQzdCLEFBQUEsQUFBQSxNQUFNLENBQUMsQ0FBQyxjQUFjLENBQUMsQ0FBQyxJQUFJLENBQUMseUJBQXlCO0FBQ3RELEFBQUEsQUFBQSxNQUFNLENBQUMsQ0FBQyxjQUFjLENBQUMsQ0FBQyxJQUFJLENBQUMsa0JBQWtCO0FBQy9DLEFBQUE7QUFDQSxBQUFBLEFBQUEsTUFBTSxDQUFDLENBQUM7QUFDUixDQUFDLEtBQUss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LENBQUEsS0FBSyxDQUFBLENBQUEsQ0FBQTtBQUNWLEFBQUEsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFBLEFBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxJQUFJLENBQUMsQztFQUFBLENBQUE7QUFDMUMsQUFBQSxFQUFFLElBQUksQ0FBQSxDQUFBO0FBQ04sQUFBQSxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUEsQUFBQyxJQUFJLEM7RUFBQSxDO0NBQUEsQ0FBQTtBQUN2QixBQUFBLENBQUMsTTtBQUFNLENBQUE7QUFDUCxBQUFBO0FBQ0EsQUFBQSw4RUFBNkU7QUFDN0UsQUFBQTtBQUNBLEFBQUE7QUFDQTtBQUNBLEdBQUc7QUFDSCxBQUFBO0FBQ0EsQUFBQSxBQUFBLE1BQU0sQ0FBQyxJQUFBLGFBQWEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUEsQ0FBQTtBQUM5QyxBQUFBO0FBQ0EsQUFBQSxDQUFlLE1BQWQsQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFFLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQztBQUNwQyxBQUFBLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsSUFBSTtBQUNmLEFBQUEsQ0FBQyxHQUFHLENBQUMsQ0FBQSxNQUFBLElBQUksQ0FBQyxFQUFFLENBQUMsTUFBTSxDQUFBLENBQUEsQ0FBQTtBQUNuQixBQUFBLEVBQUUsR0FBRyxDLEVBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQztBQUNuQixBQUFBLEVBQUUsR0FBRyxDQUFBLENBQUksS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFBLENBQUEsQ0FBQTtBQUNuQixBQUFBLEdBQUcsS0FBSyxDQUFBLEFBQUMsR0FBRyxDO0VBQUEsQztDQUFBLENBQUE7QUFDWixBQUFBLENBQUMsTTtBQUFNLENBQUE7QUFDUCxBQUFBO0FBQ0EsQUFBQSw4RUFBNkU7QUFDN0UsQUFBQTtBQUNBLEFBQUE7QUFDQTtBQUNBLEdBQUc7QUFDSCxBQUFBO0FBQ0EsQUFBQSxBQUFBLE1BQU0sQ0FBQyxJQUFBLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUEsQ0FBQTtBQUM1QyxBQUFBO0FBQ0EsQUFBQSxDQUFDLFlBQVksQ0FBQSxBQUFDLE9BQU8sQ0FBQTtBQUNyQixBQUFBLENBQUMsTTtBQUFNLENBQUE7QUFDUCxBQUFBO0FBQ0EsQUFBQSw4RUFBNkU7QUFDN0UsQUFBQSxpREFBZ0Q7QUFDaEQsQUFBQTtBQUNBLEFBQUEsQUFBQSxNQUFNLENBQW9CLE1BQW5CLG1CQUFtQixDQUFDLENBQUUsQ0FBQyxDQUFDO0FBQy9CLEFBQUEsQ0FBQyxPQUFPLENBQUMsQ0FBQyxNQUFNLENBQUM7QUFDakIsQUFBQSxDQUFDLFFBQVEsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUM7QUFDeEIsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFBLENBQUE7QUFDWCxBQUFBO0FBQ0EsQUFBQSxDQUFDLE1BQU0sQ0FBQSxBQUFDLENBQUMsT0FBTyxDQUFDLEdBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsR0FBRSxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQzlDLEFBQUEsRUFBRSxDQUFDLDRCQUE0QixFQUFFLEVBQUUsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDOUMsQUFBQSxDQUFDLEdBQUcsQ0FBQyxDQUFBLE1BQUEsQ0FBQyxPQUFPLENBQUMsQ0FBQyxFQUFFLENBQUMsZ0JBQWdCLENBQUMsT0FBTyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUEsQ0FBQSxDQUFBO0FBQ3JELEFBQUEsRUFBRSxJQUFJLENBQUMsVUFBVSxDQUFBLEFBQUMsT0FBTyxDO0NBQUEsQ0FBQTtBQUN6QixBQUFBLENBQUMsTTtBQUFNLENBQUE7QUFDUCxBQUFBO0FBQ0EsQUFBQSw4RUFBNkU7QUFDN0UsQUFBQTtBQUNBLEFBQUEsQUFBQSxNQUFNLENBQWtCLE1BQWpCLGlCQUFpQixDQUFDLENBQUUsQ0FBQyxDQUFDO0FBQzdCLEFBQUEsQ0FBQyxPQUFPLENBQUMsQ0FBQyxNQUFNLENBQUM7QUFDakIsQUFBQSxDQUFDLEtBQUssQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7QUFDakIsQUFBQSxDQUFDLFFBQVEsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQzFCLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQSxDQUFBO0FBQ1gsQUFBQTtBQUNBLEFBQUEsQ0FBUSxNQUFQLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBRSxDQUFDLFVBQVUsQ0FBQSxBQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUM7QUFDbEMsQUFBQSxFQUFFLEtBQUssQ0FBQyxDQUFDLEtBQUs7QUFDZCxFQUFFLENBQUMsQ0FBQTtBQUNILEFBQUEsQ0FBSSxNQUFILEdBQUcsQ0FBQyxDQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUEsQ0FBQTtBQUM5QixBQUFBLEVBQUUsR0FBRyxDQUFBLEtBQUssQ0FBQSxDQUFBLENBQUE7QUFDVixBQUFBLEdBQUcsT0FBTyxDQUFDLEdBQUcsQ0FBQSxBQUFDLEdBQUcsQztFQUFBLENBQUE7QUFDbEIsQUFBQSxFQUFFLE07Q0FBTSxDQUFBO0FBQ1IsQUFBQTtBQUNBLEFBQUEsQ0FBQyxrQ0FBaUM7QUFDbEMsQUFBQSxDQUFPLE1BQU4sTUFBTSxDQUFDLENBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQSxDQUFBO0FBQ3hDLEFBQUEsRUFBaUIsTUFBZixDQUFDLElBQUksQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUUsQ0FBQyxLQUFLO0FBQzFCLEFBQUEsRUFBRSxHQUFHLENBQUMsSUFBSSxDQUFDLEdBQUUsQ0FBQyxNQUFNLENBQUMsQ0FBQSxDQUFBO0FBQ3JCLEFBQUEsR0FBRyxNQUFNLENBQUMsSztFQUFLLENBQUE7QUFDZixBQUFBLEVBQUUsTUFBTSxDQUFDLENBQUksS0FBSyxDQUFDLFFBQVEsQ0FBQyxPQUFPLEM7Q0FBQyxDQUFBO0FBQ3BDLEFBQUE7QUFDQSxBQUFBLENBQWMsTUFBYixDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBRSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsS0FBSyxDQUFDO0FBQ2pDLEFBQUEsQ0FBQyxHQUFHLENBQUMsQ0FBQSxNQUFBLENBQUMsT0FBTyxDQUFDLENBQUMsRUFBRSxDQUFDLGdCQUFnQixDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFBLENBQUEsQ0FBQTtBQUM5QyxBQUFBLEVBQUUsR0FBRyxDQUFBLEFBQUMsQ0FBQyxZQUFZLEVBQUUsT0FBTyxDQUFDLENBQUMsQ0FBQTtBQUM5QixBQUFBLEVBQUUsSUFBSSxDQUFDLFVBQVUsQ0FBQSxBQUFDLE9BQU8sQztDQUFBLENBQUE7QUFDekIsQUFBQSxDQUFDLE07QUFBTSxDQUFBO0FBQ1AsQUFBQTtBQUNBLEFBQUEsOEVBQTZFO0FBQzdFLEFBQUE7QUFDQSxBQUFBLEFBQUEsTUFBTSxDQUFpQixNQUFoQixnQkFBZ0IsQ0FBQyxDQUFFLENBQUMsQ0FBQztBQUM1QixBQUFBLENBQUMsT0FBTyxDQUFDLENBQUMsTUFBTSxDQUFDO0FBQ2pCLEFBQUEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDO0FBQ2pCLEFBQUEsQ0FBQyxRQUFRLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUMxQixDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUEsQ0FBQTtBQUNYLEFBQUE7QUFDQSxBQUFBLENBQVEsTUFBUCxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUUsQ0FBQyxVQUFVLENBQUEsQUFBQyxRQUFRLENBQUMsQ0FBQyxDQUFDO0FBQ2xDLEFBQUEsRUFBRSxLQUFLLENBQUMsQ0FBQyxLQUFLO0FBQ2QsRUFBRSxDQUFDLENBQUE7QUFDSCxBQUFBLENBQUksTUFBSCxHQUFHLENBQUMsQ0FBRSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFBLENBQUE7QUFDOUIsQUFBQSxFQUFFLEdBQUcsQ0FBQSxLQUFLLENBQUEsQ0FBQSxDQUFBO0FBQ1YsQUFBQSxHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUEsQUFBQyxHQUFHLEM7RUFBQSxDQUFBO0FBQ2xCLEFBQUEsRUFBRSxNO0NBQU0sQ0FBQTtBQUNSLEFBQUE7QUFDQSxBQUFBLENBQUMsa0NBQWlDO0FBQ2xDLEFBQUEsQ0FBTyxNQUFOLE1BQU0sQ0FBQyxDQUFFLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUEsQ0FBQTtBQUN4QyxBQUFBLEVBQWlCLE1BQWYsQ0FBQyxJQUFJLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFFLENBQUMsS0FBSztBQUMxQixBQUFBLEVBQUUsR0FBRyxDQUFDLElBQUksQ0FBQyxHQUFFLENBQUMsS0FBSyxDQUFDLENBQUEsQ0FBQTtBQUNwQixBQUFBLEdBQUcsTUFBTSxDQUFDLEs7RUFBSyxDQUFBO0FBQ2YsQUFBQSxFQUFFLE1BQU0sQ0FBQyxDQUFJLEtBQUssQ0FBQyxRQUFRLENBQUMsT0FBTyxDO0NBQUMsQ0FBQTtBQUNwQyxBQUFBO0FBQ0EsQUFBQSxDQUFjLE1BQWIsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUUsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLFdBQVcsQ0FBQyxDQUFDLElBQUksQ0FBQztBQUM3QyxBQUFBLENBQVMsTUFBUixRQUFRLENBQUMsQ0FBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJO0FBQ3hDLEFBQUEsQ0FBTSxNQUFMLEtBQUssQ0FBQyxDQUFFLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUM7QUFDaEUsQUFBQTtBQUNBLEFBQUEsQ0FBQyxvREFBbUQ7QUFDcEQsQUFBQSxDQUFDLG1EQUFrRDtBQUNuRCxBQUFBLENBQUMsK0NBQThDO0FBQy9DLEFBQUE7QUFDQSxBQUFBLENBQVksTUFBWCxXQUFXLENBQUMsQ0FBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQztBQUN2RSxBQUFBLENBQUMsR0FBRyxDQUFDLENBQUEsTUFBQSxJQUFJLENBQUMsRUFBRSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUEsQ0FBQSxDQUFBO0FBQ3BDLEFBQUEsRUFBRSxHQUFHLENBQUEsQUFBQyxDQUFDLFdBQVcsRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFBO0FBQzFCLEFBQUEsRUFBRSxJQUFJLENBQUMsVUFBVSxDQUFBLEFBQUMsSUFBSSxDO0NBQUEsQ0FBQTtBQUN0QixBQUFBLENBQUMsTTtBQUFNLENBQUE7QUFDUCxBQUFBO0FBQ0EsQUFBQSw4RUFBNkU7QUFDN0UsQUFBQTtBQUNBLEFBQUEsQUFBQSxNQUFNLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUM1QixBQUFBLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTTtBQUNiLEFBQUEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUFNO0FBQ2IsQUFBQSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsTUFBTTtBQUNaLENBQUMsQ0FBQztBQUNGLEFBQUE7QUFDQSxBQUFBO0FBQ0E7QUFDQTtBQUNBLEdBQUc7QUFDSCxBQUFBO0FBQ0EsQUFBQSxBQUFBLE1BQU0sQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLFlBQVksQ0FBQyxDQUFDLEVBQUUsQ0FBQyxJQUFJO0FBQzNELEFBQUE7QUFDQSxBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsR0FBRztBQUNILEFBQUE7QUFDQSxBQUFBLEFBQUEsTUFBTSxDQUFDLEtBQUssQ0FBQyxnQkFBZ0IsQ0FBQSxDQUFBO0FBQzdCLEFBQUE7QUFDQSxBQUFBLENBQUMsUUFBUSxDLEMsQ0FBQyxBQUFDLGMsWSxDQUFlO0FBQzFCLEFBQUEsQ0FBeUIsU0FBeEIsUUFBUSxDQUFDLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFFLENBQUMsQ0FBQyxDQUFDO0FBQy9CLEFBQUEsQ0FBQyxTQUFTLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLDhDQUE2QztBQUNyRSxBQUFBLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsSUFBSTtBQUMxQixBQUFBLENBQUMsRUFBRSxDQUFDLENBQUMsTUFBTTtBQUNYLEFBQUEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxPQUFPO0FBQ2YsQUFBQTtBQUNBLEFBQUEsQ0FBQyxXQUFXLENBQUM7QUFDYixBQUFBLEcsU0FBWSxDLEMsQ0FBQyxBQUFDLGMsWSxDQUFlLENBQUMsS0FBSyxDQUFDO0FBQ3BDLEFBQUEsR0FBRyxRQUFRLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDO0FBQzFCLEdBQUcsQ0FBQyxDQUFBLENBQUE7QUFDSixBQUFBO0FBQ0EsQUFBQSxFLGdCLFMsQ0FGSTtBQUNKLEFBQUE7QUFDQSxBQUFBLEVBSUksTUFKRixDQUFDO0FBQ0gsQUFBQSxHQUFHLEtBQUssQ0FBQyxDLE1BQU8sQ0FBQztBQUNqQixBQUFBLEdBQUcsTUFBTSxDQUFDLEMsT0FBUSxDQUFBO0FBQ2xCLEFBQUEsR0FBRyxFQUFFLENBQUMsQyxHQUFJO0FBQ1YsR0FBRyxDQUFDLENBQUMsQ0FBRSxDQUFDLFVBQVUsQ0FBQSxBQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUM7QUFDOUIsQUFBQSxJQUFJLEtBQUssQ0FBQyxDQUFDLEtBQUssQ0FBQTtBQUNoQixBQUFBLElBQUksTUFBTSxDQUFDLENBQUMsSUFBSSxDQUFBO0FBQ2hCLEFBQUEsSUFBSSxFQUFFLENBQUMsQ0FBQyxHQUFHO0FBQ1gsSUFBSSxDQUFDLEMsQyxhLE0sQyxjLE8sQyxVLEcsQ0FBQTtBQUNMLEFBQUEsRUFBRSxJLENBQUMsR0FBRyxDQUFBLEFBQUMsdUNBQXVDLEM7Q0FBQSxDQUFBO0FBQzlDLEFBQUE7QUFDQSxBQUFBLENBQUMsMENBQXlDO0FBQzFDLEFBQUEsQ0FBQyxpQ0FBZ0M7QUFDakMsQUFBQTtBQUNBLEFBQUEsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUEsQ0FBQTtBQUNuQyxBQUFBLEVBQWMsTUFBWixDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUUsQ0FBQyxNQUFNO0FBQ3hCLEFBQUEsRUFBRSxJLENBQUMsR0FBRyxDQUFBLEFBQUMsQ0FBQyxTQUFTLEVBQUUsWUFBWSxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsSUFBSSxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFBO0FBQ3BELEFBQUEsRUFBRSxHQUFHLENBQUEsVUFBVSxDQUFDLEksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUEsQ0FBQSxDQUFBO0FBQ25DLEFBQUEsR0FBRyxJLENBQUMsR0FBRyxDQUFBLEFBQUMsQ0FBQyxvQkFBb0IsRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDekMsQUFBQSxHQUFHLEksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLEMsQ0FBRSxDQUFDLENBQUMsQztFQUFDLENBQUE7QUFDeEIsQUFBQTtBQUNBLEFBQUEsRUFBRSxHQUFHLENBQUEsVUFBVSxDQUFDLEksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFBLENBQUEsQ0FBQTtBQUMzQyxBQUFBLEdBQUcsSSxDQUFDLEdBQUcsQ0FBQSxBQUFDLENBQUMsbUJBQW1CLEVBQUUsSUFBSSxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQy9DLEFBQUEsR0FBTyxNQUFKLElBQUksQ0FBQyxDQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFBLENBQUE7QUFDaEIsQUFBQSxJQUFJLEdBQUcsQ0FBQSxJLENBQUMsUUFBUSxDQUFBLENBQUEsQ0FBQTtBQUNoQixBQUFBLEtBQUssSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxDO0lBQUMsQ0FBQTtBQUM1QixBQUFBLElBQUksSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUEsQUFBQyxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFBO0FBQy9CLEFBQUEsSUFBSSxJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxDLENBQUUsQ0FBQyxLQUFLO0FBQ2xDLEFBQUEsSUFBSSxNQUFNLENBQUMsSztHQUFLLENBQUE7QUFDaEIsQUFBQSxHQUFHLEksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLEMsQ0FBRSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJLENBQUMsRUFBRSxDO0VBQUMsQ0FBQTtBQUMvQyxBQUFBLEVBQUUsSSxDQUFDLEdBQUcsQ0FBQSxBQUFDLENBQUMsMkJBQTJCLEVBQUUsSUFBSSxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFBO0FBQ25ELEFBQUEsRUFBRSxJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7QUFDMUIsQUFBQSxFQUFFLE07Q0FBTSxDQUFBO0FBQ1IsQUFBQTtBQUNBLEFBQUEsQ0FBQyxTQUFRO0FBQ1QsQUFBQSxDLE1BQUMsYUFBYSxDQUFDLENBQUMsQ0FBQSxDQUFBO0FBQ2hCLEFBQUEsRUFBRSxLQUFLLENBQUMsS0FBSyxDQUFBLEFBQUMsSSxDQUFDLEVBQUUsQ0FBQTtBQUNqQixBQUFBLEVBQUUsTUFBTSxDQUFDLEksQ0FBQyxRO0NBQVEsQ0FBQTtBQUNsQixBQUFBO0FBQ0EsQUFBQSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFBLENBQUE7QUFDaEQsQUFBQSxFQUFFLEdBQUcsQ0FBQSxJLENBQUMsS0FBSyxDQUFBLENBQUEsQ0FBQTtBQUNYLEFBQUEsR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFBLEFBQUMsQ0FBQyxHQUFHLEVBQUUsTUFBTSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLEVBQUUsR0FBRyxDQUFDLENBQUMsQztFQUFBLENBQUE7QUFDOUMsQUFBQSxFQUFFLE07Q0FBTSxDO0FBQUEsQ0FBQTtBQUNSLEFBQUE7QUFDQSxBQUFBLDhFQUE2RTtBQUM3RSxBQUFBLFFBQU87QUFDUCxBQUFBO0FBQ0EsQUFBQSxBQUFBLE1BQU0sQ0FBQyxJQUFJLENBQUMsbUJBQW1CLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsWUFBWSxDQUFDLENBQUMsRUFBRSxDQUFDLE9BQU87QUFDbkUsQUFBQTtBQUNBLEFBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxHQUFHO0FBQ0gsQUFBQTtBQUNBLEFBQUEsQUFBQSxNQUFNLENBQVUsTUFBVCxTQUFTLENBQUMsQ0FBRSxDLE1BSVYsUUFKVyxDQUFDO0FBQ3JCLEFBQUEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7QUFDekIsQUFBQSxDQUFDLFNBQVMsQ0FBQyxDQUFDLG1CQUFtQixDQUFDO0FBQ2hDLEFBQUEsQ0FBQyxRQUFRLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDO0FBQ3hCLENBQUMsQ0FBQyxDLEMsVyxDQUFDLEFBQUMsSSxDQUFPLENBQUEsQ0FBQTtBQUNYLEFBQUE7QUFDQSxBQUFBLENBQVksTUFBWCxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUUsQ0FBQyxVQUFVLENBQUEsQUFBQyxRQUFRLENBQUMsQ0FBQyxDQUFDO0FBQ3RDLEFBQUEsRUFBRSxLQUFLLENBQUMsQ0FBQyxLQUFLLENBQUE7QUFDZCxBQUFBLEVBQUUsRUFBRSxDQUFDLENBQUMsR0FBRztBQUNULEVBQUUsQ0FBQyxDQUFBO0FBQ0gsQUFBQSxDQUFJLE1BQUgsR0FBRyxDQUFDLENBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQSxDQUFBO0FBQzlCLEFBQUEsRUFBRSxHQUFHLENBQUEsS0FBSyxDQUFBLENBQUEsQ0FBQTtBQUNWLEFBQUEsR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFBLEFBQUMsR0FBRyxDO0VBQUEsQ0FBQTtBQUNsQixBQUFBLEVBQUUsTTtDQUFNLENBQUE7QUFDUixBQUFBO0FBQ0EsQUFBQSxDQUFDLEdBQUcsQ0FBQSxBQUFDLENBQUMsT0FBTyxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQ3JDLEFBQUE7QUFDQSxBQUFBLENBQVEsTUFBUCxPQUFPLENBQUMsQ0FBRSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDO0FBQzlCLEFBQUE7QUFDQSxBQUFBLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsS0FBSztBQUM1QixBQUFBO0FBQ0EsQUFBQSxDQUEyQixNQUExQixVQUFVLENBQUMsQ0FBQyxjQUFjLENBQUMsQ0FBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQSxDQUFBO0FBQ2hELEFBQUEsRUFBUSxNQUFOLE1BQU0sQ0FBQyxDQUFFLENBQUMsU0FBUyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDbkMsQUFBQSxFQUFFLEdBQUcsQ0FBQSxBQUFDLENBQUMsY0FBYyxFQUFFLE1BQU0sQ0FBQyxDQUFDLENBQUE7QUFDL0IsQUFBQSxFQUFFLEdBQUcsQ0FBQSxNQUFNLENBQUEsQ0FBQSxDQUFBO0FBQ1gsQUFBQSxHQUFHLE9BQU8sQ0FBQyxLQUFLLENBQUMsQztFQUFDLENBQUE7QUFDbEIsQUFBQSxFQUFFLE07Q0FBTSxDQUFBO0FBQ1IsQUFBQTtBQUNBLEFBQUEsQ0FBUSxNQUFQLE9BQU8sQ0FBQyxDQUFFLENBQUMsR0FBRyxDQUFDLGdCQUFnQixDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUM7QUFDekQsQUFBQTtBQUNBLEFBQUEsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUEsTUFBQSxDQUFDLElBQUksQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQyxPQUFPLENBQUEsQ0FBQSxDQUFBO0FBQ25DLEFBQUEsRUFBRSxHQUFHLENBQUEsQUFBQyxxQkFBcUIsQ0FBQTtBQUMzQixBQUFBLEVBQUUsR0FBRyxDQUFBLE1BQU0sQ0FBQSxDQUFBLENBQUE7QUFDWCxBQUFBLEdBQUcsR0FBRyxDQUFBLEFBQUMsQ0FBQyxTQUFTLEVBQUUsTUFBTSxDQUFDLGlCQUFpQixDQUFDLENBQUE7QUFDNUMsQUFBQSxHQUFHLEs7RUFBSyxDQUFBO0FBQ1IsQUFBQSx3QkFBdUI7QUFDdkIsQUFBQSxFQUFFLEdBQUcsQ0FBQyxDQUFBLE1BQUEsSUFBSSxDQUFDLEVBQUUsQ0FBQyxLQUFLLENBQUEsQ0FBQSxDQUFBO0FBQ25CLEFBQUEsR0FBRyw2Q0FBNEM7QUFDL0MsQUFBQSxHQUFHLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsQztFQUFDLEM7Q0FBQSxDO0FBQUEsQ0FBQTtBQUMvQixBQUFBO0FBQ0EsQUFBQSxBQUFBLE1BQU0sQ0FBVyxNQUFWLFVBQVUsQ0FBQyxDQUFFLENBQUMsU0FBUztBQUM5QiIsIm5hbWVzIjpbXSwic291cmNlc0NvbnRlbnQiOlsiIyBmcy5jaXZldFxuXG5pbXBvcnQge3NwcmludGZ9IGZyb20gXCJqc3I6QHN0ZC9mbXQvcHJpbnRmXCJcbmltcG9ydCB7ZGVib3VuY2V9IGZyb20gJ2pzcjpAc3RkL2FzeW5jL2RlYm91bmNlJ1xuaW1wb3J0IHtcblx0ZXhpc3RzU3luYywgZW1wdHlEaXJTeW5jLCBlbnN1cmVEaXJTeW5jLFxuXHR9IGZyb20gJ2pzcjpAc3RkL2ZzJ1xuaW1wb3J0IHtcblx0YXBwZW5kRmlsZVN5bmMsXG5cdH0gZnJvbSAnbm9kZTpmcydcbmltcG9ydCB7RXZlbnRFbWl0dGVyfSBmcm9tICdub2RlOmV2ZW50cydcblxuIyAtLS0gRGVubydzIHN0YXRTeW5jIGFuZCBsc3RhdFN5bmMgYXJlIHN0aWxsIHVuc3RhYmxlLFxuIyAgICAgc28gdXNlIHRoaXNcbmltcG9ydCB7c3RhdFN5bmN9IGZyb20gJ25vZGU6ZnMnXG5cbmltcG9ydCBwYXRoTGliIGZyb20gJ25vZGU6cGF0aCdcbmltcG9ydCB1cmxMaWIgZnJvbSAnbm9kZTp1cmwnXG5pbXBvcnQge2V4cGFuZEdsb2JTeW5jfSBmcm9tICdqc3I6QHN0ZC9mcy9leHBhbmQtZ2xvYidcbmltcG9ydCB7VGV4dExpbmVTdHJlYW19IGZyb20gJ2pzcjpAc3RkL3N0cmVhbXMnXG5cbmltcG9ydCB7XG5cdHVuZGVmLCBkZWZpbmVkLCBub3RkZWZpbmVkLFxuXHRpc1N0cmluZywgaXNOb25FbXB0eVN0cmluZywgaXNCb29sZWFuLCBpc051bWJlciwgaXNJbnRlZ2VyLFxuXHRpc0FycmF5LCBpc0FycmF5T2ZTdHJpbmdzLCBpc0hhc2gsIGlzT2JqZWN0LCBpc1JlZ0V4cCxcblx0aW50ZWdlciwgaGFzaCwgdm9pZEZ1bmMsIG9wdGlvbnNwZWMsXG5cdH0gZnJvbSAnLi9kYXRhdHlwZXMudHMnXG5pbXBvcnQge1xuXHRhc3NlcnQsIGNyb2FrLCBPTCwgZ2V0T3B0aW9ucywgcmVtb3ZlRW1wdHlLZXlzLCBwYXNzLFxuXHRzcGFjZXMsIHNpbmNlTG9hZFN0ciwgc2xlZXAsXG5cdH0gZnJvbSAnLi9sbHV0aWxzLnRzJ1xuXG5EZW5vIDo9IGdsb2JhbFRoaXMuRGVub1xuZXhwb3J0IHR5cGUgcGF0aFR5cGUgPVxuXHQnbWlzc2luZycgfCAnZmlsZScgfCAnZGlyJyB8ICdzeW1saW5rJyB8ICd1bmtub3duJ1xuXG4jIC0tLSBub3QgZXhwb3J0ZWRcbmRlY29kZXIgOj0gbmV3IFRleHREZWNvZGVyKCd1dGYtOCcpXG5lbmNvZGVyIDo9IG5ldyBUZXh0RW5jb2RlcigpXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogcmV0dXJucyBhIGJvb2xlYW4gaW5kaWNhdGluZyBpZiB0aGUgZ2l2ZW4gcGF0aCBleGlzdHNcbiAqIGFuZCBpcyBhIGZpbGVcbiAqL1xuXG5leHBvcnQgaXNGaWxlIDo9IChwYXRoOiBzdHJpbmcpOiBib29sZWFuID0+XG5cblx0cmV0dXJuIGV4aXN0c1N5bmMocGF0aCkgJiYgc3RhdFN5bmMocGF0aCkuaXNGaWxlKClcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuLyoqXG4gKiByZXR1cm5zIGEgYm9vbGVhbiBpbmRpY2F0aW5nIG9mIHRoZSBnaXZlbiBwYXRoIGV4aXN0c1xuICogYW5kIGlzIGEgZGlyZWN0b3J5XG4gKi9cblxuZXhwb3J0IGlzRGlyIDo9IChwYXRoOiBzdHJpbmcpOiBib29sZWFuID0+XG5cblx0cmV0dXJuIGV4aXN0c1N5bmMocGF0aCkgJiYgc3RhdFN5bmMocGF0aCkuaXNEaXJlY3RvcnkoKVxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKipcbiAqIHJldHVybnMgb25lIG9mOlxuICogICAgJ21pc3NpbmcnICAtIGRvZXMgbm90IGV4aXN0XG4gKiAgICAnZGlyJyAgICAgIC0gaXMgYSBkaXJlY3RvcnlcbiAqICAgICdmaWxlJyAgICAgLSBpcyBhIGZpbGVcbiAqICAgICdzeW1saW5rJyAgLSBpcyBhIHN5bWxpbmtcbiAqICAgICd1bmtub3duJyAgLSBleGlzdHMsIGJ1dCBub3QgYSBmaWxlLCBkaXJlY3Rvcnkgb3Igc3ltbGlua1xuICovXG5cbmV4cG9ydCBnZXRQYXRoVHlwZSA6PSAocGF0aDogc3RyaW5nKTogcGF0aFR5cGUgPT5cblxuXHRhc3NlcnQgaXNTdHJpbmcocGF0aCksIFwibm90IGEgc3RyaW5nOiAje09MKHBhdGgpfVwiXG5cdGlmIG5vdCBleGlzdHNTeW5jIHBhdGhcblx0XHRyZXR1cm4gJ21pc3NpbmcnXG5cdGggOj0gc3RhdFN5bmMocGF0aClcblx0cmV0dXJuIChcblx0XHQgIGguaXNGaWxlKCkgICAgICAgICA/ICdmaWxlJ1xuXHRcdDogaC5pc0RpcmVjdG9yeSgpICAgID8gJ2Rpcidcblx0XHQ6IGguaXNTeW1ib2xpY0xpbmsoKSA/ICdzeW1saW5rJ1xuXHRcdDogICAgICAgICAgICAgICAgICAgICAgJ3Vua25vd24nXG5cdFx0KVxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKipcbiAqIGV4dHJhY3QgdGhlIGZpbGUgZXh0ZW5zaW9uIGZyb20gYSBwYXRoLCBpbmNsdWRpbmdcbiAqIHRoZSBsZWFkaW5nIHBlcmlvZFxuICovXG5cbmV4cG9ydCBmaWxlRXh0IDo9IChwYXRoOiBzdHJpbmcpOiBzdHJpbmcgPT5cblxuXHRpZiBsTWF0Y2hlcyA6PSBwYXRoLm1hdGNoKC9cXC5bXlxcLl0rJC8pXG5cdFx0cmV0dXJuIGxNYXRjaGVzWzBdXG5cdGVsc2Vcblx0XHRyZXR1cm4gJydcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuLyoqXG4gKiByZXR1cm4gdGhlIGdpdmVuIHBhdGgsIGJ1dCB3aXRoIHRoZSBnaXZlbiBmaWxlIGV4dGVuc2lvblxuICogcmVwbGFjaW5nIHRoZSBleGlzdGluZyBmaWxlIGV4dGVuc2lvblxuICovXG5cbmV4cG9ydCB3aXRoRXh0IDo9IChwYXRoOiBzdHJpbmcsIGV4dDogc3RyaW5nKTogc3RyaW5nID0+XG5cblx0YXNzZXJ0IGV4dC5zdGFydHNXaXRoKCcuJyksIFwiQmFkIGZpbGUgZXh0ZW5zaW9uOiAje2V4dH1cIlxuXHRsTWF0Y2hlcyA6PSBwYXRoLm1hdGNoKC9eKC4qKShcXC5bXlxcLl0rKSQvKVxuXHRpZiAobE1hdGNoZXMgPT0gbnVsbClcblx0XHR0aHJvdyBuZXcgRXJyb3IoXCJCYWQgcGF0aDogJyN7cGF0aH0nXCIpXG5cdFtfLCBoZWFkU3RyLCBvcmdFeHRdIDo9IGxNYXRjaGVzXG5cdHJldHVybiBcIiN7aGVhZFN0cn0je2V4dH1cIlxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG5leHBvcnQgbFN0YXRGaWVsZHM6IHN0cmluZ1tdIDo9IFtcblx0J2RldicsJ2lubycsJ21vZGUnLCdubGluaycsJ3VpZCcsJ2dpZCcsJ3JkZXYnLFxuXHQnc2l6ZScsJ2Jsa3NpemUnLCdibG9ja3MnLFxuXHQnYXRpbWVNcycsJ210aW1lTXMnLCdjdGltZU1zJywnYmlydGh0aW1lTXMnLFxuXHQnYXRpbWUnLCdtdGltZScsJ2N0aW1lJywnYmlydGh0aW1lJyxcblx0XVxuXG4vKipcbiAqIHJldHVybiBzdGF0aXN0aWNzIGZvciBhIGZpbGUgb3IgZGlyZWN0b3J5XG4gKi9cblxuZXhwb3J0IGdldFN0YXRzIDo9IChwYXRoOiBzdHJpbmcpOiBoYXNoID0+XG5cblx0cmV0dXJuIHN0YXRTeW5jKHBhdGgpXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cblxuLyoqXG4gKiBwYXJzZXMgYSBwYXRoIG9yIGZpbGUgVVJMLCBhbmQgcmV0dXJucyBhIGhhc2ggd2l0aCBrZXlzOlxuICogXHR0eXBlOiBwYXRoVHlwZSAtICdmaWxlJywnZGlyJywnc3ltbGluaycsJ21pc3NpbmcnIG9yICd1bmtub3duJ1xuICogXHRwYXRoOiBzdHJpbmdcbiAqIFx0cm9vdDogc3RyaW5nXG4gKiBcdGRpcjogc3RyaW5nXG4gKiBcdGZpbGVOYW1lOiBzdHJpbmdcbiAqIFx0c3R1Yjogc3RyaW5nP1xuICogXHRwdXJwb3NlOiBzdHJpbmc/XG4gKiBcdGV4dDogc3RyaW5nP1xuICogXHRyZWxQYXRoOiBzdHJpbmdcbiAqIFx0cmVsRGlyOiBzdHJpbmdcbiAqL1xuXG5leHBvcnQgdHlwZSBwYXRoSW5mbyA9IHtcblx0dHlwZTogcGF0aFR5cGUgICMgJ2ZpbGUnLCdkaXInLCdzeW1saW5rJywnbWlzc2luZycgb3IgJ3Vua25vd24nXG5cdHBhdGg6IHN0cmluZ1xuXHRyb290OiBzdHJpbmdcblx0ZGlyOiBzdHJpbmdcblx0ZmlsZU5hbWU6IHN0cmluZ1xuXHRzdHViOiBzdHJpbmc/XG5cdHB1cnBvc2U6IHN0cmluZz9cblx0ZXh0OiBzdHJpbmc/XG5cdHJlbFBhdGg6IHN0cmluZ1xuXHRyZWxEaXI6IHN0cmluZ1xuXHR9XG5cbmV4cG9ydCBwYXJzZVBhdGggOj0gKHBhdGg6IHN0cmluZyk6IHBhdGhJbmZvID0+XG5cblx0IyAtLS0gTk9URTogcGF0aCBtYXkgYmUgYSBmaWxlIFVSTCwgZS5nLiBpbXBvcnQubWV0YS51cmxcblx0IyAgICAgICAgICAgcGF0aCBtYXkgYmUgYSByZWxhdGl2ZSBwYXRoXG5cblx0YXNzZXJ0IGlzTm9uRW1wdHlTdHJpbmcocGF0aCksIFwicGF0aCBub3QgYSBzdHJpbmcgI3tPTChwYXRoKX1cIlxuXHRpZiBkZWZpbmVkKHBhdGgubWF0Y2goL15maWxlXFw6XFwvXFwvLykpXG5cdFx0cGF0aCA9IHVybExpYi5maWxlVVJMVG9QYXRoKHBhdGgpXG5cdHBhdGggPSBub3JtYWxpemVQYXRoIHBhdGhcblxuXHR7cm9vdCwgZGlyLCBiYXNlOiBmaWxlTmFtZX0gOj0gcGF0aExpYi5wYXJzZShwYXRoKVxuXG5cdGxQYXJ0cyA6PSBmaWxlTmFtZS5zcGxpdCgnLicpXG5cdFtzdHViLCBwdXJwb3NlLCBleHRdIDo9IHN3aXRjaCBsUGFydHMubGVuZ3RoXG5cdFx0d2hlbiAwXG5cdFx0XHRjcm9hayBcIkNhbid0IGhhcHBlblwiXG5cdFx0d2hlbiAxXG5cdFx0XHRbZmlsZU5hbWUsIHVuZGVmLCB1bmRlZl1cblx0XHR3aGVuIDJcblx0XHRcdFtsUGFydHNbMF0sIHVuZGVmLCBcIi4je2xQYXJ0c1sxXX1cIl1cblx0XHRlbHNlXG5cdFx0XHRbXG5cdFx0XHRcdGxQYXJ0cy5zbGljZSgwLCAtMikuam9pbignLicpLFxuXHRcdFx0XHRsUGFydHMuYXQoLTIpLFxuXHRcdFx0XHRcIi4je2xQYXJ0cy5hdCgtMSl9XCJcblx0XHRcdFx0XVxuXG5cdCMgLS0tIEdyYWIgZXZlcnl0aGluZyB1cCB1bnRpbCB0aGUgbGFzdCBwYXRoIHNlcGFyYXRvciwgaWYgYW55XG5cdHJlbFBhdGggOj0gcmVscGF0aCBwYXRoXG5cdGxQYXRoTWF0Y2hlcyA6PSByZWxQYXRoLm1hdGNoKC9eKC4qKVtcXFxcXFwvXVteXFxcXFxcL10qJC8pXG5cdHJlbERpciA6PSAobFBhdGhNYXRjaGVzID09IG51bGwpID8gJy4nIDogbFBhdGhNYXRjaGVzWzFdXG5cblx0cmV0dXJuIHtcblx0XHR0eXBlOiBnZXRQYXRoVHlwZShwYXRoKVxuXHRcdHBhdGhcblx0XHRyb290XG5cdFx0ZGlyXG5cdFx0ZmlsZU5hbWVcblx0XHRzdHViXG5cdFx0cHVycG9zZVxuXHRcdGV4dFxuXHRcdHJlbFBhdGhcblx0XHRyZWxEaXJcblx0XHR9XG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogZ2VuZXJhdGUgZmlsZXMgdGhhdCBtYXRjaCBhIGdpdmVuIGdsb2IgcGF0dGVyblxuICogeWllbGRzIHtwYXRoLCBuYW1lLCBpc0ZpbGUsIGlzRGlyZWN0b3J5LCBpc1N5bWxpbmt9XG4gKiAgICB3aXRoIHBhcnNlIG9wdGlvbiwgYWxzbyBpbmNsdWRlcyBrZXlzOlxuICogICAgICAgcmVsUGF0aFxuICogVGhlc2Ugb3B0aW9ucyBtYXkgYmUgc3BlY2lmaWVkIGluIHRoZSAybmQgcGFyYW1ldGVyOlxuICogICAgcm9vdDogc3RyaW5nIC0gcm9vdCBvZiBzZWFyY2gsIChkZWY6IERlbm8uY3dkKCkpXG4gKiAgICBsRXhjbHVkZTogW3N0cmluZ10gLSBwYXR0ZXJucyB0byBleGNsdWRlLFxuICogICAgXHRkZWY6IFsnbm9kZV9tb2R1bGVzLyoqJywgJy5naXQvKionXVxuICogICAgaW5jbHVkZURpcnM6IGJvb2xlYW4gLSBzaG91bGQgZGlyZWN0b3JpZXMgYmUgaW5jbHVkZWQ/IChkZWY6IHRydWUpXG4gKiBcdGZvbGxvd1N5bWxpbmtzIC0gYm9vbGVhbiAtIHNob3VsZCBzeW0gbGlua3MgYmUgZm9sbG93ZWQ/IChkZWY6IGZhbHNlKVxuICogXHRjYW5vbmljYWxpemU6IGJvb2xlYW4gLSBpZiBmb2xsb3dzeW1saW5rcyBpcyB0cnVlLCBzaG91bGRcbiAqIFx0XHRwYXRocyBiZSBjYW5vbmljYWxpemVkPyAoZGVmOiB0cnVlKVxuICogXHRmaWx0ZXI6IChzdHJpbmctPmJvb2xlYW4pIC0geWllbGQgb25seSBpZiBmdW5jdGlvbiByZXR1cm5zIHRydWVcbiAqL1xuXG5leHBvcnQgYWxsRmlsZXNNYXRjaGluZyA6PSAoXG5cdHBhdHRlcm46IHN0cmluZz0nKionLFxuXHRoT3B0aW9uczogb3B0aW9uc3BlYz17fVxuXHQpOiBHZW5lcmF0b3I8aGFzaCwgdm9pZCwgdW5rbm93bj4gLT5cblxuXHR7XG5cdFx0cm9vdFxuXHRcdGxFeGNsdWRlXG5cdFx0aW5jbHVkZURpcnNcblx0XHRmb2xsb3dTeW1saW5rc1xuXHRcdGNhbm9uaWNhbGl6ZVxuXHRcdGZpbHRlclxuXHRcdGRlYnVnXG5cdFx0fSA6PSBnZXRPcHRpb25zIGhPcHRpb25zLCB7XG5cdFx0XHRyb290OiB1bmRlZlxuXHRcdFx0bEV4Y2x1ZGU6IFsnbm9kZV9tb2R1bGVzLyoqJywgJy5naXQvKionXVxuXHRcdFx0aW5jbHVkZURpcnM6IGZhbHNlXG5cdFx0XHRmb2xsb3dTeW1saW5rczogZmFsc2Vcblx0XHRcdGNhbm9uaWNhbGl6ZTogZmFsc2Vcblx0XHRcdGZpbHRlcjogdW5kZWZcblx0XHRcdGRlYnVnOiBmYWxzZVxuXHRcdFx0fVxuXG5cdGhHbG9iT3B0aW9ucyA6PSB7XG5cdFx0cm9vdFxuXHRcdGV4Y2x1ZGU6IGxFeGNsdWRlXG5cdFx0aW5jbHVkZURpcnNcblx0XHRmb2xsb3dTeW1saW5rc1xuXHRcdGNhbm9uaWNhbGl6ZVxuXHRcdH1cblxuXHREQkcgOj0gKG1zZzogc3RyaW5nKTogdm9pZCA9PlxuXHRcdGlmIGRlYnVnXG5cdFx0XHRjb25zb2xlLmxvZyBtc2dcblx0XHRyZXR1cm5cblxuXHRmb3IgaCBvZiBleHBhbmRHbG9iU3luYyhwYXR0ZXJuLCBoR2xvYk9wdGlvbnMpXG5cdFx0IyAtLS0gaCBoYXMga2V5czogcGF0aCwgbmFtZSwgaXNGaWxlLCBpc0RpcmVjdG9yeSwgaXNTeW1MaW5rXG5cblx0XHREQkcgXCJNQVRDSDogI3toLnBhdGh9XCJcblx0XHR0eXBlIDo9IChcblx0XHRcdCAgaC5pc0ZpbGUgICAgICA/ICdmaWxlJ1xuXHRcdFx0OiBoLmlzRGlyZWN0b3J5ID8gJ2Rpcidcblx0XHRcdDogaC5pc1N5bWxpbmsgICA/ICdzeW1saW5rJ1xuXHRcdFx0OiAgICAgICAgICAgICAgICAgJ3Vua25vd24nXG5cdFx0XHQpXG5cdFx0aEZpbGUgOj0gcGFyc2VQYXRoKGgucGF0aClcblx0XHRpZiBub3RkZWZpbmVkKGZpbHRlcilcblx0XHRcdERCRyBcIiAgIC0gbm8gZmlsdGVyXCJcblx0XHRcdHlpZWxkIGhGaWxlXG5cdFx0ZWxzZSBpZiBmaWx0ZXIoaEZpbGUpXG5cdFx0XHREQkcgXCIgICAtIGFsbG93ZWQgYnkgZmlsdGVyXCJcblx0XHRcdHlpZWxkIGhGaWxlXG5cdFx0ZWxzZVxuXHRcdFx0REJHIFwiICAgLSBleGNsdWRlZCBieSBmaWx0ZXJcIlxuXHRyZXR1cm5cblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiMgQVNZTkMgSVRFUkFCTEVcblxuLyoqXG4gKiBBbiBhc3luYyBpdGVyYWJsZSAtIHlpZWxkcyBldmVyeSBsaW5lIGluIHRoZSBnaXZlbiBmaWxlXG4gKlxuICogVXNhZ2U6XG4gKiAgIGZvciBhd2FpdCBsaW5lIG9mIGFsbExpbmVzSW4oJ3NyYy9saWIvdGVtcC5jaXZldCcpXG4gKiBcdCAgY29uc29sZS5sb2cgXCJMSU5FOiAje2xpbmV9XCJcbiAqICAgY29uc29sZS5sb2cgXCJET05FXCJcbiAqL1xuXG5leHBvcnQgYWxsTGluZXNJbiA6PSAoXG5cdHBhdGg6IHN0cmluZ1xuXHQpOiBBc3luY0dlbmVyYXRvcjxzdHJpbmcsIHZvaWQsIHVua25vd24+IC0+XG5cblx0YXNzZXJ0IGlzRmlsZShwYXRoKSwgXCJObyBzdWNoIGZpbGU6ICN7T0wocGF0aCl9IChhbGxMaW5lc0luKVwiXG5cdGYgOj0gYXdhaXQgRGVuby5vcGVuKHBhdGgpXG5cdHJlYWRhYmxlIDo9IGYucmVhZGFibGVcblx0XHQucGlwZVRocm91Z2gobmV3IFRleHREZWNvZGVyU3RyZWFtKCkpXG5cdFx0LnBpcGVUaHJvdWdoKG5ldyBUZXh0TGluZVN0cmVhbSgpKVxuXG5cdGZvciBhd2FpdCBsaW5lIG9mIHJlYWRhYmxlXG5cdFx0eWllbGQgbGluZVxuXHRyZXR1cm5cblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuLyoqXG4gKiBjb252ZXJ0cyBhbGwgYmFja3NsYXNoIGNoYXJhY3RlcnMgdG8gZm9yd2FyZCBzbGFzaGVzXG4gKiB1cHBlci1jYXNlcyBkcml2ZSBsZXR0ZXJzXG4gKi9cblxuZXhwb3J0IG5vcm1hbGl6ZVBhdGggOj0gKHBhdGg6IHN0cmluZyk6IHN0cmluZyA9PlxuXG5cdG5wYXRoIDo9IHBhdGgucmVwbGFjZUFsbCgnXFxcXCcsICcvJylcblx0aWYgKG5wYXRoLmNoYXJBdCgxKSA9PSAnOicpXG5cdFx0cmV0dXJuIG5wYXRoLmNoYXJBdCgwKS50b1VwcGVyQ2FzZSgpICsgbnBhdGguc3Vic3RyaW5nKDEpXG5cdGVsc2Vcblx0XHRyZXR1cm4gbnBhdGhcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuLyoqXG4gKiByZXNvbHZlcyBtdWx0aXBsZSBwYXRoIHBhcnRzIHRvIGEgc2luZ2xlIHBhdGhcbiAqIHJldHVybnMgbm9ybWFsaXplZCBwYXRoXG4gKi9cblxuZXhwb3J0IG1rcGF0aCA6PSAobFBhcnRzLi4uOiBzdHJpbmdbXSk6IHN0cmluZyA9PlxuXG5cdHBhdGggOj0gcGF0aExpYi5yZXNvbHZlKGxQYXJ0cy4uLilcblx0cmV0dXJuIG5vcm1hbGl6ZVBhdGgocGF0aClcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuLyoqXG4gKiByZXNvbHZlcyBtdWx0aXBsZSBwYXRoIHBhcnRzIHRvIGEgc2luZ2xlIHBhdGhcbiAqIHJldHVybnMgbm9ybWFsaXplZCBwYXRoLCByZWxhdGl2ZSB0byBjdXJyZW50IGRpcmVjdG9yeVxuICovXG5cbmV4cG9ydCByZWxwYXRoIDo9IChsUGFydHMuLi46IHN0cmluZ1tdKTogc3RyaW5nID0+XG5cblx0YXNzZXJ0IGlzQXJyYXlPZlN0cmluZ3MobFBhcnRzKSwgXCJCYWQgbFBhcnRzOiAje09MKGxQYXJ0cyl9XCJcblx0ZnVsbFBhdGggOj0gcGF0aExpYi5yZXNvbHZlIGxQYXJ0cy4uLlxuXHRyZXR1cm4gbm9ybWFsaXplUGF0aCBwYXRoTGliLnJlbGF0aXZlKCcnLCBmdWxsUGF0aClcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuZXhwb3J0IHR5cGUgcGF0aERlc2MgPSB7XG5cdGRpcjogc3RyaW5nXG5cdHJvb3Q6IHN0cmluZ1xuXHRsUGFydHM6IHN0cmluZ1tdXG5cdH1cblxuLyoqXG4gKiByZXR1cm5zIHtkaXIsIHJvb3QsIGxQYXJ0c30gd2hlcmUgbFBhcnRzIGluY2x1ZGVzIHRoZSBuYW1lcyBvZlxuICogYWxsIGRpcmVjdG9yaWVzIGJldHdlZW4gdGhlIHJvb3QgYW5kIHRoZSBmaWxlIG5hbWVcbiAqIHJlbGF0aXZlIHRvIHRoZSBjdXJyZW50IHdvcmtpbmcgZGlyZWN0b3J5XG4gKi9cblxuZXhwb3J0IHBhdGhTdWJEaXJzID0gKHBhdGg6IHN0cmluZywgaE9wdGlvbnM6IG9wdGlvbnNwZWM9e30pOiBwYXRoRGVzYyA9PlxuXG5cdHtyZWxhdGl2ZX0gOj0gZ2V0T3B0aW9ucyBoT3B0aW9ucywge1xuXHRcdHJlbGF0aXZlOiBmYWxzZVxuXHRcdH1cblx0cGF0aCA9IHJlbGF0aXZlID8gcmVscGF0aChwYXRoKSA6IG1rcGF0aChwYXRoKVxuXHR7cm9vdCwgZGlyfSA6PSBwYXRoTGliLnBhcnNlKHBhdGgpXG5cdHJldHVybiB7XG5cdFx0ZGlyXG5cdFx0cm9vdFxuXHRcdGxQYXJ0czogZGlyLnNsaWNlKHJvb3QubGVuZ3RoKS5zcGxpdCgvW1xcXFxcXC9dLylcblx0XHR9XG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4jIC0tLSBTaG91bGQgYmUgY2FsbGVkIGxpa2U6IG15c2VsZihpbXBvcnQubWV0YS51cmwpXG4jICAgICByZXR1cm5zIGZ1bGwgcGF0aCBvZiBjdXJyZW50IGZpbGVcblxuZXhwb3J0IG15c2VsZiA6PSAodXJsOiBzdHJpbmcpOiBzdHJpbmcgPT5cblxuXHRyZXR1cm4gcmVscGF0aCB1cmxMaWIuZmlsZVVSTFRvUGF0aCh1cmwpXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuLyoqXG4gKiByZWFkIGEgZmlsZSBpbnRvIGEgc3RyaW5nXG4gKi9cblxuZXhwb3J0IHNsdXJwIDo9IChwYXRoOiBzdHJpbmcpOiBzdHJpbmcgPT5cblxuXHRhc3NlcnQgaXNGaWxlKHBhdGgpLCBcIk5vIHN1Y2ggZmlsZTogI3twYXRofSAoc2x1cnApXCJcblx0ZGF0YSA6PSBEZW5vLnJlYWRGaWxlU3luYyBwYXRoXG5cdHJldHVybiBkZWNvZGVyLmRlY29kZShkYXRhKS5yZXBsYWNlQWxsKCdcXHInLCAnJylcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuLyoqXG4gKiB3cml0ZSBhIHN0cmluZyB0byBhIGZpbGVcbiAqIHdpbGwgZW5zdXJlIHRoYXQgYWxsIG5lY2Vzc2FyeSBkaXJlY3RvcmllcyBleGlzdFxuICovXG5cbmV4cG9ydCBiYXJmIDo9IChcblx0Y29udGVudHM6IHN0cmluZyxcblx0cGF0aDogc3RyaW5nLFxuXHRoT3B0aW9uczogb3B0aW9uc3BlYz17fVxuXHQpOiB2b2lkID0+XG5cblx0e2FwcGVuZH0gOj0gZ2V0T3B0aW9ucyBoT3B0aW9ucywge1xuXHRcdGFwcGVuZDogZmFsc2Vcblx0XHR9XG5cdG1rRGlyc0ZvckZpbGUocGF0aClcblx0ZGF0YSA6PSBlbmNvZGVyLmVuY29kZShjb250ZW50cylcblx0aWYgYXBwZW5kICYmIGlzRmlsZShwYXRoKVxuXHRcdGFwcGVuZEZpbGVTeW5jIHBhdGgsIGRhdGFcblx0ZWxzZVxuXHRcdERlbm8ud3JpdGVGaWxlU3luYyBwYXRoLCBkYXRhXG5cdHJldHVyblxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG5leHBvcnQgbmV3ZXJEZXN0RmlsZUV4aXN0cyA6PSAoXG5cdHNyY1BhdGg6IHN0cmluZyxcblx0ZGVzdFBhdGg6IHN0cmluZ1xuXHQpOiBib29sZWFuID0+XG5cblx0YXNzZXJ0IGlzRmlsZShzcmNQYXRoKSwgXCJObyBzdWNoIGZpbGU6ICN7T0woc3JjUGF0aCl9IChuZXdlckRlc3RGaWxlRXhpc3RzKVwiXG5cdGlmIG5vdCBleGlzdHNTeW5jKGRlc3RQYXRoKVxuXHRcdHJldHVybiBmYWxzZVxuXHRzcmNNb2RUaW1lIDo9IHN0YXRTeW5jKHNyY1BhdGgpLm10aW1lTXNcblx0ZGVzdE1vZFRpbWUgOj0gc3RhdFN5bmMoZGVzdFBhdGgpLm10aW1lTXNcblx0cmV0dXJuIChkZXN0TW9kVGltZSA+IHNyY01vZFRpbWUpXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogY3JlYXRlIGEgbmV3IGRpcmVjdG9yeSBpZiBpdCBkb2Vzbid0IGV4aXN0XG4gKiBpZiB0aGUgb3B0aW9uICdjbGVhcicgaXMgc2V0IHRvIGEgdHJ1ZSB2YWx1ZSBpbiB0aGUgMm5kIHBhcmFtZXRlclxuICogYW5kIHRoZSBkaXJlY3RvcnkgYWxyZWFkeSBleGlzdHMsIGl0IGlzIGNsZWFyZWRcbiAqL1xuXG5leHBvcnQgbWtEaXIgPSAoZGlyUGF0aDogc3RyaW5nLCBjbGVhcjogYm9vbGVhbj1mYWxzZSk6IHZvaWQgPT5cblxuXHRpZiBjbGVhclxuXHRcdGVtcHR5RGlyU3luYyBkaXJQYXRoICAgICMgLS0tIGNyZWF0ZXMgaWYgaXQgZG9lc24ndCBleGlzdFxuXHRlbHNlXG5cdFx0ZW5zdXJlRGlyU3luYyBkaXJQYXRoXG5cdHJldHVyblxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKipcbiAqIHJlbW92ZSBhIGZpbGUgZnJvbSB0aGUgZmlsZSBzeXN0ZW0sIGJ1dCBkbyBub3RoaW5nXG4gKiBpZiB0aGUgZmlsZSBkb2VzIG5vdCBleGlzdFxuICovXG5cbmV4cG9ydCBybUZpbGUgOj0gKHBhdGg6IHN0cmluZyk6IHZvaWQgPT5cblxuXHRpZiBleGlzdHNTeW5jIHBhdGhcblx0XHREZW5vLnJlbW92ZVN5bmMgcGF0aFxuXHRyZXR1cm5cblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuLyoqXG4gKiByZW1vdmUgYSBkaXJlY3RvcnkgZnJvbSB0aGUgZmlsZSBzeXN0ZW0sIGJ1dCBkbyBub3RoaW5nXG4gKiBpZiB0aGUgZGlyZWN0b3J5IGRvZXMgbm90IGV4aXN0XG4gKiBOT1RFOiBZb3UgbXVzdCBwYXNzIHRoZSAnY2xlYXInIG9wdGlvbiBpZiB0aGUgZGlyZWN0b3J5XG4gKiAgICAgICBpcyBub3QgZW1wdHlcbiAqL1xuXG5leHBvcnQgcm1EaXIgOj0gKHBhdGg6IHN0cmluZywgaE9wdGlvbnM6IG9wdGlvbnNwZWM9e30pOiB2b2lkID0+XG5cblx0e2NsZWFyfSA6PSBnZXRPcHRpb25zIGhPcHRpb25zLCB7XG5cdFx0Y2xlYXI6IGZhbHNlXG5cdFx0fVxuXHRpZiBleGlzdHNTeW5jIHBhdGhcblx0XHRpZiBjbGVhclxuXHRcdFx0RGVuby5yZW1vdmVTeW5jIHBhdGgsIHtyZWN1cnNpdmU6IHRydWV9XG5cdFx0ZWxzZVxuXHRcdFx0RGVuby5yZW1vdmVTeW5jIHBhdGhcblx0cmV0dXJuXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogY3JlYXRlIGFueSBtaXNzaW5nIGRpcmVjdG9yaWVzIGluIHRoZSBnaXZlbiBwYXRoXG4gKi9cblxuZXhwb3J0IG1rRGlyc0ZvckZpbGUgPSAocGF0aDogc3RyaW5nKTogdm9pZCA9PlxuXG5cdHtyb290LCBsUGFydHN9IDo9IHBhdGhTdWJEaXJzKHBhdGgpXG5cdGxldCBkaXIgPSByb290XG5cdGZvciBwYXJ0IG9mIGxQYXJ0c1xuXHRcdGRpciArPSBcIi8je3BhcnR9XCJcblx0XHRpZiBub3QgaXNEaXIoZGlyKVxuXHRcdFx0bWtEaXIgZGlyXG5cdHJldHVyblxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKipcbiAqIGRlbGV0ZXMgYWxsIGZpbGVzIGFuZCBzdWJkaXJlY3RvcmllcyBpbiB0aGUgZ2l2ZW4gZGlyZWN0b3J5XG4gKi9cblxuZXhwb3J0IGNsZWFyRGlyID0gKGRpclBhdGg6IHN0cmluZyk6IHZvaWQgPT5cblxuXHRlbXB0eURpclN5bmMgZGlyUGF0aFxuXHRyZXR1cm5cblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiMgLS0tIGhPcHRpb25zIGdldHMgcGFzc2VkIHRvIGFsbEZpbGVzTWF0Y2hpbmcoKVxuXG5leHBvcnQgcmVtb3ZlRmlsZXNNYXRjaGluZyA6PSAoXG5cdHBhdHRlcm46IHN0cmluZyxcblx0aE9wdGlvbnM6IG9wdGlvbnNwZWM9e31cblx0KTogdm9pZCA9PlxuXG5cdGFzc2VydCAocGF0dGVybiAhPSAnKicpICYmIChwYXR0ZXJuICE9ICcqKicpLFxuXHRcdFwiQ2FuJ3QgZGVsZXRlIGZpbGVzIG1hdGNoaW5nICN7T0wocGF0dGVybil9XCJcblx0Zm9yIHtyZWxQYXRofSBvZiBhbGxGaWxlc01hdGNoaW5nKHBhdHRlcm4sIGhPcHRpb25zKVxuXHRcdERlbm8ucmVtb3ZlU3luYyByZWxQYXRoXG5cdHJldHVyblxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG5leHBvcnQgcmVtb3ZlRmlsZXNFeGNlcHQgOj0gKFxuXHRwYXR0ZXJuOiBzdHJpbmcsXG5cdGxLZWVwOiBzdHJpbmdbXSxcblx0aE9wdGlvbnM6IG9wdGlvbnNwZWMgPSB7fVxuXHQpOiB2b2lkID0+XG5cblx0e2RlYnVnfSA6PSBnZXRPcHRpb25zIGhPcHRpb25zLCB7XG5cdFx0ZGVidWc6IGZhbHNlXG5cdFx0fVxuXHREQkcgOj0gKG1zZzogc3RyaW5nKTogdm9pZCA9PlxuXHRcdGlmIGRlYnVnXG5cdFx0XHRjb25zb2xlLmxvZyBtc2dcblx0XHRyZXR1cm5cblxuXHQjIC0tLSB0cnVlIHJldHVybiBtZWFucyByZW1vdmUgaXRcblx0ZmlsdGVyIDo9IChoRmlsZTogcGF0aEluZm8pOiBib29sZWFuID0+XG5cdFx0e3R5cGUsIHJlbFBhdGh9IDo9IGhGaWxlXG5cdFx0aWYgKHR5cGUgIT0gJ2ZpbGUnKVxuXHRcdFx0cmV0dXJuIGZhbHNlXG5cdFx0cmV0dXJuIG5vdCBsS2VlcC5pbmNsdWRlcyhyZWxQYXRoKVxuXG5cdGg6IG9wdGlvbnNwZWMgOj0ge2ZpbHRlciwgZGVidWd9XG5cdGZvciB7cmVsUGF0aH0gb2YgYWxsRmlsZXNNYXRjaGluZyhwYXR0ZXJuLCBoKVxuXHRcdERCRyBcIlJFTU9WRSBGSUxFICN7cmVsUGF0aH1cIlxuXHRcdERlbm8ucmVtb3ZlU3luYyByZWxQYXRoXG5cdHJldHVyblxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG5leHBvcnQgcmVtb3ZlRGlyc0V4Y2VwdCA6PSAoXG5cdHBhdHRlcm46IHN0cmluZyxcblx0bEtlZXA6IHN0cmluZ1tdLFxuXHRoT3B0aW9uczogb3B0aW9uc3BlYyA9IHt9XG5cdCk6IHZvaWQgPT5cblxuXHR7ZGVidWd9IDo9IGdldE9wdGlvbnMgaE9wdGlvbnMsIHtcblx0XHRkZWJ1ZzogZmFsc2Vcblx0XHR9XG5cdERCRyA6PSAobXNnOiBzdHJpbmcpOiB2b2lkID0+XG5cdFx0aWYgZGVidWdcblx0XHRcdGNvbnNvbGUubG9nIG1zZ1xuXHRcdHJldHVyblxuXG5cdCMgLS0tIHRydWUgcmV0dXJuIG1lYW5zIHJlbW92ZSBpdFxuXHRmaWx0ZXIgOj0gKGhGaWxlOiBwYXRoSW5mbyk6IGJvb2xlYW4gPT5cblx0XHR7dHlwZSwgcmVsUGF0aH0gOj0gaEZpbGVcblx0XHRpZiAodHlwZSAhPSAnZGlyJylcblx0XHRcdHJldHVybiBmYWxzZVxuXHRcdHJldHVybiBub3QgbEtlZXAuaW5jbHVkZXMocmVsUGF0aClcblxuXHRoOiBvcHRpb25zcGVjIDo9IHtmaWx0ZXIsIGluY2x1ZGVEaXJzOiB0cnVlfVxuXHRwYXRoRnVuYyA6PSAoaDogaGFzaCk6IHN0cmluZyA9PiBoLnBhdGhcblx0bERpcnMgOj0gQXJyYXkuZnJvbShhbGxGaWxlc01hdGNoaW5nKHBhdHRlcm4sIGgpKS5tYXAocGF0aEZ1bmMpXG5cblx0IyAtLS0gV2UgbmVlZCB0byByZW1vdmUgZW1wdHkgc3ViZGlyZWN0b3JpZXMgYmVmb3JlXG5cdCMgICAgIHJlbW92aW5nIGEgZGlyZWN0b3J5LCBzbyB3ZSBidWlsZCBhIGxpc3QgYW5kXG5cdCMgICAgIHJlbW92ZSBsb25nZXIgcGF0aHMgYmVmb3JlIHNob3J0ZXIgcGF0aHNcblxuXHRjb21wYXJlRnVuYyA6PSAoYTogc3RyaW5nLCBiOiBzdHJpbmcpOiBudW1iZXIgPT4gKGIubGVuZ3RoIC0gYS5sZW5ndGgpXG5cdGZvciBwYXRoIG9mIGxEaXJzLnNvcnQoY29tcGFyZUZ1bmMpXG5cdFx0REJHIFwiUkVNT1ZFIERJUiAje3BhdGh9XCJcblx0XHREZW5vLnJlbW92ZVN5bmMgcGF0aFxuXHRyZXR1cm5cblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuZXhwb3J0IHR5cGUgZnNDaGFuZ2VUeXBlID0ge1xuXHRraW5kOiBzdHJpbmdcblx0cGF0aDogc3RyaW5nXG5cdG1zPzogbnVtYmVyXG5cdH1cblxuLyoqXG4gKiB0eXBlIGZzQ2FsbGJhY2tGdW5jIC0gYSBmdW5jdGlvbiB0YWtpbmcgKHR5cGUsIHBhdGgpIGFuZCBvcHRpb25hbGx5XG4gKiByZXR1cm5zIGEgZnVuY3Rpb24gcmVmZXJlbmNlIHRvIGJlIGNhbGxlZCBvbiBmaWxlIGNoYW5nZXNcbiAqL1xuXG5leHBvcnQgdHlwZSBmc0NhbGxiYWNrRnVuYyA9IChjaGFuZ2U6IGZzQ2hhbmdlVHlwZSkgPT4gdm9pZFxuXG4vKipcbiAqIGNsYXNzIEZpbGVFdmVudEhhbmRsZXJcbiAqICAgIGhhbmRsZXMgZmlsZSBjaGFuZ2VkIGV2ZW50cyB3aGVuIC5oYW5kbGUoe2tpbmQsIHBhdGh9KSBpcyBjYWxsZWRcbiAqICAgIGNhbGxiYWNrIGlzIGEgZnVuY3Rpb24sIGRlYm91bmNlZCBieSAyMDAgbXNcbiAqICAgICAgIHRoYXQgdGFrZXMgKHR5cGUsIHBhdGgpIGFuZCByZXR1cm5zIGEgdm9pZEZ1bmNcbiAqICAgICAgIHdoaWNoIHdpbGwgYmUgY2FsbGVkIGlmIHRoZSBjYWxsYmFjayByZXR1cm5zIGEgZnVuY3Rpb24gcmVmZXJlbmNlXG4gKiBbdW5pdCB0ZXN0c10oLi4vdGVzdC9mcy50ZXN0LmNpdmV0Izp+OnRleHQ9JTIzJTIwJTJEJTJEJTJEJTIwY2xhc3MlMjBGaWxlRXZlbnRIYW5kbGVyKVxuICovXG5cbmV4cG9ydCBjbGFzcyBGaWxlRXZlbnRIYW5kbGVyXG5cblx0Y2FsbGJhY2s6IGZzQ2FsbGJhY2tGdW5jP1xuXHRsQ2hhbmdlczogZnNDaGFuZ2VUeXBlW10gOj0gW11cblx0aEhhbmRsZXJzOiBoYXNoID0ge30gICAjIC0tLSBwYXRoID0+IGV2ZW50IHR5cGUgPT4gZGVib3VuY2VkIGhhbmRsZXJcblx0b25TdG9wOiAoKSA9PiB2b2lkID0gcGFzc1xuXHRtczogbnVtYmVyXG5cdGRlYnVnOiBib29sZWFuXG5cblx0Y29uc3RydWN0b3IoXG5cdFx0XHRAY2FsbGJhY2s6IGZzQ2FsbGJhY2tGdW5jPz11bmRlZixcblx0XHRcdGhPcHRpb25zOiBvcHRpb25zcGVjPXt9XG5cdFx0XHQpXG5cblx0XHR7XG5cdFx0XHRkZWJ1ZzogQGRlYnVnLFxuXHRcdFx0b25TdG9wOiBAb25TdG9wXG5cdFx0XHRtczogQG1zXG5cdFx0XHR9IDo9IGdldE9wdGlvbnMgaE9wdGlvbnMsIHtcblx0XHRcdFx0ZGVidWc6IGZhbHNlXG5cdFx0XHRcdG9uU3RvcDogcGFzc1xuXHRcdFx0XHRtczogMjAwXG5cdFx0XHRcdH1cblx0XHRAREJHIFwiRmlsZUV2ZW50SGFuZGxlciBjb25zdHJ1Y3RvcigpIGNhbGxlZFwiXG5cblx0IyAtLS0gQ2FsbHMgYSBmdW5jdGlvbiBvZiB0eXBlICgpID0+IHZvaWRcblx0IyAgICAgYnV0IGlzIGRlYm91bmNlZCBieSBAbXMgbXNcblxuXHRoYW5kbGUoY2hhbmdlOiBmc0NoYW5nZVR5cGUpOiB2b2lkXG5cdFx0e2tpbmQsIHBhdGh9IDo9IGNoYW5nZVxuXHRcdEBEQkcgXCJIQU5ETEU6IFsje3NpbmNlTG9hZFN0cigpfV0gI3traW5kfSAje3BhdGh9XCJcblx0XHRpZiBub3RkZWZpbmVkKEBoSGFuZGxlcnM/LltwYXRoXSlcblx0XHRcdEBEQkcgXCJDcmVhdGUgaGFuZGxlciBmb3IgJyN7cGF0aH0nXCIsIDFcblx0XHRcdEBoSGFuZGxlcnNbcGF0aF0gPSB7fVxuXG5cdFx0aWYgbm90ZGVmaW5lZChAaEhhbmRsZXJzPy5bcGF0aF0/LltraW5kXSlcblx0XHRcdEBEQkcgXCJDcmVhdGUgaGFuZGxlciBmb3IgI3traW5kfSAje3BhdGh9XCIsIDFcblx0XHRcdGZ1bmMgOj0gKCkgPT5cblx0XHRcdFx0aWYgQGNhbGxiYWNrXG5cdFx0XHRcdFx0QGNhbGxiYWNrKHtraW5kLCBwYXRofSlcblx0XHRcdFx0QGxDaGFuZ2VzLnB1c2gge2tpbmQsIHBhdGh9XG5cdFx0XHRcdEBoSGFuZGxlcnNbcGF0aF1ba2luZF0gPSB1bmRlZlxuXHRcdFx0XHRyZXR1cm4gdW5kZWZcblx0XHRcdEBoSGFuZGxlcnNbcGF0aF1ba2luZF0gPSBkZWJvdW5jZShmdW5jLCBAbXMpXG5cdFx0QERCRyBcIkNhbGwgZGVib3VuY2VkIGhhbmRsZXIgZm9yICN7a2luZH0gI3twYXRofVwiXG5cdFx0QGhIYW5kbGVyc1twYXRoXVtraW5kXSgpXG5cdFx0cmV0dXJuXG5cblx0IyBBU1lOQyFcblx0Z2V0Q2hhbmdlTGlzdCgpXG5cdFx0YXdhaXQgc2xlZXAgQG1zXG5cdFx0cmV0dXJuIEBsQ2hhbmdlc1xuXG5cdHByaXZhdGUgREJHKG1zZzogc3RyaW5nLCBsZXZlbDogbnVtYmVyPTApOiB2b2lkXG5cdFx0aWYgQGRlYnVnXG5cdFx0XHRjb25zb2xlLmxvZyBcIiAgICN7c3BhY2VzKDMqbGV2ZWwpfS0gI3ttc2d9XCJcblx0XHRyZXR1cm5cblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiMgQVNZTkNcblxuZXhwb3J0IHR5cGUgd2F0Y2hlckNhbGxiYWNrRnVuYyA9IChjaGFuZ2U6IGZzQ2hhbmdlVHlwZSkgPT4gYm9vbGVhblxuXG4vKipcbiAqIGEgZnVuY3Rpb24gdGhhdCB3YXRjaGVzIGZvciBjaGFuZ2VzIG9uZSBvciBtb3JlIGZpbGVzIG9yIGRpcmVjdG9yaWVzXG4gKiAgICBhbmQgY2FsbHMgYSBjYWxsYmFjayBmdW5jdGlvbiBmb3IgZWFjaCBjaGFuZ2UuXG4gKiBJZiB0aGUgY2FsbGJhY2sgcmV0dXJucyB0cnVlLCB3YXRjaGluZyBpcyBoYWx0ZWRcbiAqXG4gKiBVc2FnZTpcbiAqICAgaGFuZGxlciA6PSAoa2luZCwgcGF0aCkgPT4gY29uc29sZS5sb2cgcGF0aFxuICogICBhd2FpdCB3YXRjaEZpbGUgJ3RlbXAudHh0JywgaGFuZGxlclxuICogICBhd2FpdCB3YXRjaEZpbGUgJ3NyYy9saWInLCAgaGFuZGxlclxuICogICBhd2FpdCB3YXRjaEZpbGUgWyd0ZW1wLnR4dCcsICdzcmMvbGliJ10sIGhhbmRsZXJcbiAqL1xuXG5leHBvcnQgd2F0Y2hGaWxlIDo9IChcblx0cGF0aDogc3RyaW5nIHwgc3RyaW5nW10sXG5cdHdhdGNoZXJDQjogd2F0Y2hlckNhbGxiYWNrRnVuYyxcblx0aE9wdGlvbnM6IG9wdGlvbnNwZWM9e31cblx0KTogdm9pZCAtPlxuXG5cdHtkZWJ1ZywgbXN9IDo9IGdldE9wdGlvbnMgaE9wdGlvbnMsIHtcblx0XHRkZWJ1ZzogZmFsc2Vcblx0XHRtczogMjAwXG5cdFx0fVxuXHREQkcgOj0gKG1zZzogc3RyaW5nKTogdm9pZCA9PlxuXHRcdGlmIGRlYnVnXG5cdFx0XHRjb25zb2xlLmxvZyBtc2dcblx0XHRyZXR1cm5cblxuXHREQkcgXCJXQVRDSDogI3tKU09OLnN0cmluZ2lmeShwYXRoKX1cIlxuXG5cdHdhdGNoZXIgOj0gRGVuby53YXRjaEZzKHBhdGgpXG5cblx0bGV0IGRvU3RvcDogYm9vbGVhbiA9IGZhbHNlXG5cblx0ZnNDYWxsYmFjazogZnNDYWxsYmFja0Z1bmMgOj0gKHtraW5kLCBwYXRofSkgPT5cblx0XHRyZXN1bHQgOj0gd2F0Y2hlckNCKHtraW5kLCBwYXRofSlcblx0XHREQkcgXCJGQ0I6IHJlc3VsdCA9ICN7cmVzdWx0fVwiXG5cdFx0aWYgcmVzdWx0XG5cdFx0XHR3YXRjaGVyLmNsb3NlKClcblx0XHRyZXR1cm5cblxuXHRoYW5kbGVyIDo9IG5ldyBGaWxlRXZlbnRIYW5kbGVyKGZzQ2FsbGJhY2ssIHtkZWJ1ZywgbXN9KVxuXG5cdGZvciBhd2FpdCB7a2luZCwgcGF0aHN9IG9mIHdhdGNoZXJcblx0XHREQkcgXCJ3YXRjaGVyIGV2ZW50IGZpcmVkXCJcblx0XHRpZiBkb1N0b3Bcblx0XHRcdERCRyBcImRvU3RvcCA9ICN7ZG9TdG9wfSwgQ2xvc2luZyB3YXRjaGVyXCJcblx0XHRcdGJyZWFrXG4jXHRcdHtraW5kLCBwYXRoc30gOj0gZXZ0XG5cdFx0Zm9yIHBhdGggb2YgcGF0aHNcblx0XHRcdCMgLS0tIGZzQ2FsbGJhY2sgd2lsbCBiZSAoZXZlbnR1YWxseSkgY2FsbGVkXG5cdFx0XHRoYW5kbGVyLmhhbmRsZSh7a2luZCwgcGF0aH0pXG5cbmV4cG9ydCB3YXRjaEZpbGVzIDo9IHdhdGNoRmlsZVxuIl19