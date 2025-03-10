"use strict";
// fs.civet

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

import pathLib from 'node:path'
import urlLib from 'node:url'
import {expandGlobSync} from '@std/fs/expand-glob'
import {TextLineStream} from '@std/streams'

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
	async getChangeList(): AutoPromise<fsChangeType[]> {
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

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3JjL2xpYi9mcy5jaXZldC50c3giLCJzb3VyY2VzIjpbInNyYy9saWIvZnMuY2l2ZXQiXSwibWFwcGluZ3MiOiI7QUFBQSxXQUFVO0FBQ1YsQUFBQTtBQUNBLEssVyx5QjtBQUFBLE1BQU0sQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLElBQUksQ0FBQyxpQkFBaUI7QUFDdkMsQUFBQSxBQUFBLE1BQU0sQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLElBQUksQ0FBQyxxQkFBcUI7QUFDNUMsQUFBQTtBQUNBLEFBQUEsQUFBQSxNQUFNLENBQUMsQ0FBQztBQUNSLENBQUMsVUFBVSxDQUFDLENBQUMsWUFBWSxDQUFDLENBQUMsYUFBYSxDQUFDO0FBQ3pDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxTQUFTO0FBQ2pCLEFBQUEsQUFBQSxNQUFNLENBQUMsQ0FBQztBQUNSLENBQUMsY0FBYyxDQUFDO0FBQ2hCLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxTQUFTO0FBQ2pCLEFBQUEsQUFBQSxNQUFNLENBQUMsQ0FBQyxZQUFZLENBQUMsQ0FBQyxJQUFJLENBQUMsYUFBYTtBQUN4QyxBQUFBO0FBQ0EsQUFBQSx3REFBdUQ7QUFDdkQsQUFBQSxrQkFBaUI7QUFDakIsQUFBQSxBQUFBLE1BQU0sQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLElBQUksQ0FBQyxTQUFTO0FBQ2hDLEFBQUE7QUFDQSxBQUFBLEFBQUEsTUFBTSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsV0FBVztBQUMvQixBQUFBLEFBQUEsTUFBTSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsVUFBVTtBQUM3QixBQUFBLEFBQUEsTUFBTSxDQUFDLENBQUMsY0FBYyxDQUFDLENBQUMsSUFBSSxDQUFDLHFCQUFxQjtBQUNsRCxBQUFBLEFBQUEsTUFBTSxDQUFDLENBQUMsY0FBYyxDQUFDLENBQUMsSUFBSSxDQUFDLGNBQWM7QUFDM0MsQUFBQTtBQUNBLEFBQUEsQUFBQSxNQUFNLENBQUMsQ0FBQztBQUNSLENBQUMsS0FBSyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsVUFBVSxDQUFDO0FBQzVCLENBQUMsUUFBUSxDQUFDLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxTQUFTLENBQUM7QUFDNUQsQ0FBQyxPQUFPLENBQUMsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLFFBQVEsQ0FBQztBQUN2RCxDQUFDLE9BQU8sQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLFVBQVUsQ0FBQztBQUNyQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsZ0JBQWdCO0FBQ3hCLEFBQUEsQUFBQSxNQUFNLENBQUMsQ0FBQztBQUNSLENBQUMsTUFBTSxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsZUFBZSxDQUFDLENBQUMsSUFBSSxDQUFDO0FBQ3RELENBQUMsTUFBTSxDQUFDLENBQUMsWUFBWSxDQUFDLENBQUMsS0FBSyxDQUFDO0FBQzdCLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxjQUFjO0FBQ3RCLEFBQUE7QUFDQSxBQUFBLEFBQUksTUFBSixJQUFJLENBQUMsQ0FBRSxDQUFDLFVBQVUsQ0FBQyxJQUFJO0FBQ3ZCLEFBQUEsQUFBQSxNQUFNLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDO0FBQ3RCLEFBQUEsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLFNBQVM7QUFDbkQsQUFBQTtBQUNBLEFBQUEsbUJBQWtCO0FBQ2xCLEFBQUEsQUFBTyxNQUFQLE9BQU8sQ0FBQyxDQUFFLENBQUMsR0FBRyxDQUFDLFdBQVcsQ0FBQyxPQUFPLENBQUM7QUFDbkMsQUFBQSxBQUFPLE1BQVAsT0FBTyxDQUFDLENBQUUsQ0FBQyxHQUFHLENBQUMsV0FBVyxDQUFDLENBQUM7QUFDNUIsQUFBQTtBQUNBLEFBQUEsOEVBQTZFO0FBQzdFLEFBQUE7QUFDQSxBQUFBO0FBQ0E7QUFDQTtBQUNBLEdBQUc7QUFDSCxBQUFBO0FBQ0EsQUFBQSxBQUFBLE1BQU0sQ0FBTyxNQUFOLE1BQU0sQ0FBQyxDQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUEsQ0FBQTtBQUMzQyxBQUFBO0FBQ0EsQUFBQSxDQUFDLE1BQU0sQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBRSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUFNLENBQUMsQztBQUFDLENBQUE7QUFDbkQsQUFBQTtBQUNBLEFBQUEsOEVBQTZFO0FBQzdFLEFBQUE7QUFDQSxBQUFBO0FBQ0E7QUFDQTtBQUNBLEdBQUc7QUFDSCxBQUFBO0FBQ0EsQUFBQSxBQUFBLE1BQU0sQ0FBTSxNQUFMLEtBQUssQ0FBQyxDQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUEsQ0FBQTtBQUMxQyxBQUFBO0FBQ0EsQUFBQSxDQUFDLE1BQU0sQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBRSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxXQUFXLENBQUMsQztBQUFDLENBQUE7QUFDeEQsQUFBQTtBQUNBLEFBQUEsOEVBQTZFO0FBQzdFLEFBQUE7QUFDQSxBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsR0FBRztBQUNILEFBQUE7QUFDQSxBQUFBLEFBQUEsTUFBTSxDQUFZLE1BQVgsV0FBVyxDQUFDLENBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQSxDQUFBO0FBQ2pELEFBQUE7QUFDQSxBQUFBLENBQUMsTUFBTSxDQUFBLEFBQUMsUUFBUSxDQUFDLElB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QUcsSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsQyxDQUFFLENBQUMsQ0FBQyxDO0VBQUMsQ0FBQTtBQUN4QixBQUFBO0FBQ0EsQUFBQSxFQUFFLEdBQUcsQ0FBQSxVQUFVLENBQUMsSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUEsQ0FBQSxDQUFBO0FBQzNDLEFBQUEsR0FBRyxJLENBQUMsR0FBRyxDQUFBLEFBQUMsQ0FBQyxtQkFBbUIsRUFBRSxJQUFJLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDL0MsQUFBQSxHQUFPLE1BQUosSUFBSSxDQUFDLENBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUEsQ0FBQTtBQUNoQixBQUFBLElBQUksR0FBRyxDQUFBLEksQ0FBQyxRQUFRLENBQUEsQ0FBQSxDQUFBO0FBQ2hCLEFBQUEsS0FBSyxJLENBQUMsUUFBUSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLEM7SUFBQyxDQUFBO0FBQzVCLEFBQUEsSUFBSSxJLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQSxBQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUE7QUFDL0IsQUFBQSxJQUFJLEksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLEMsQ0FBRSxDQUFDLEtBQUs7QUFDbEMsQUFBQSxJQUFJLE1BQU0sQ0FBQyxLO0dBQUssQ0FBQTtBQUNoQixBQUFBLEdBQUcsSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsQyxDQUFFLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDLEksQ0FBQyxFQUFFLEM7RUFBQyxDQUFBO0FBQy9DLEFBQUEsRUFBRSxJLENBQUMsR0FBRyxDQUFBLEFBQUMsQ0FBQywyQkFBMkIsRUFBRSxJQUFJLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFD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QUFLLENBQUE7QUFDUixBQUFBLHdCQUF1QjtBQUN2QixBQUFBLEVBQUUsR0FBRyxDQUFDLENBQUEsTUFBQSxJQUFJLENBQUMsRUFBRSxDQUFDLEtBQUssQ0FBQSxDQUFBLENBQUE7QUFDbkIsQUFBQSxHQUFHLDZDQUE0QztBQUMvQyxBQUFBLEdBQUcsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxDO0VBQUMsQztDQUFBLEM7QUFBQSxDQUFBO0FBQy9CLEFBQUE7QUFDQSxBQUFBLEFBQUEsTUFBTSxDQUFXLE1BQVYsVUFBVSxDQUFDLENBQUUsQ0FBQyxTQUFTO0FBQzlCIiwibmFtZXMiOltdLCJzb3VyY2VzQ29udGVudCI6WyIjIGZzLmNpdmV0XG5cbmltcG9ydCB7c3ByaW50Zn0gZnJvbSBcIkBzdGQvZm10L3ByaW50ZlwiXG5pbXBvcnQge2RlYm91bmNlfSBmcm9tICdAc3RkL2FzeW5jL2RlYm91bmNlJ1xuXG5pbXBvcnQge1xuXHRleGlzdHNTeW5jLCBlbXB0eURpclN5bmMsIGVuc3VyZURpclN5bmMsXG5cdH0gZnJvbSAnQHN0ZC9mcydcbmltcG9ydCB7XG5cdGFwcGVuZEZpbGVTeW5jLFxuXHR9IGZyb20gJ25vZGU6ZnMnXG5pbXBvcnQge0V2ZW50RW1pdHRlcn0gZnJvbSAnbm9kZTpldmVudHMnXG5cbiMgLS0tIERlbm8ncyBzdGF0U3luYyBhbmQgbHN0YXRTeW5jIGFyZSBzdGlsbCB1bnN0YWJsZSxcbiMgICAgIHNvIHVzZSB0aGlzXG5pbXBvcnQge3N0YXRTeW5jfSBmcm9tICdub2RlOmZzJ1xuXG5pbXBvcnQgcGF0aExpYiBmcm9tICdub2RlOnBhdGgnXG5pbXBvcnQgdXJsTGliIGZyb20gJ25vZGU6dXJsJ1xuaW1wb3J0IHtleHBhbmRHbG9iU3luY30gZnJvbSAnQHN0ZC9mcy9leHBhbmQtZ2xvYidcbmltcG9ydCB7VGV4dExpbmVTdHJlYW19IGZyb20gJ0BzdGQvc3RyZWFtcydcblxuaW1wb3J0IHtcblx0dW5kZWYsIGRlZmluZWQsIG5vdGRlZmluZWQsXG5cdGlzU3RyaW5nLCBpc05vbkVtcHR5U3RyaW5nLCBpc0Jvb2xlYW4sIGlzTnVtYmVyLCBpc0ludGVnZXIsXG5cdGlzQXJyYXksIGlzQXJyYXlPZlN0cmluZ3MsIGlzSGFzaCwgaXNPYmplY3QsIGlzUmVnRXhwLFxuXHRpbnRlZ2VyLCBoYXNoLCB2b2lkRnVuYywgb3B0aW9uc3BlYyxcblx0fSBmcm9tICcuL2RhdGF0eXBlcy50cydcbmltcG9ydCB7XG5cdGFzc2VydCwgY3JvYWssIE9MLCBnZXRPcHRpb25zLCByZW1vdmVFbXB0eUtleXMsIHBhc3MsXG5cdHNwYWNlcywgc2luY2VMb2FkU3RyLCBzbGVlcCxcblx0fSBmcm9tICcuL2xsdXRpbHMudHMnXG5cbkRlbm8gOj0gZ2xvYmFsVGhpcy5EZW5vXG5leHBvcnQgdHlwZSBwYXRoVHlwZSA9XG5cdCdtaXNzaW5nJyB8ICdmaWxlJyB8ICdkaXInIHwgJ3N5bWxpbmsnIHwgJ3Vua25vd24nXG5cbiMgLS0tIG5vdCBleHBvcnRlZFxuZGVjb2RlciA6PSBuZXcgVGV4dERlY29kZXIoJ3V0Zi04JylcbmVuY29kZXIgOj0gbmV3IFRleHRFbmNvZGVyKClcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuLyoqXG4gKiByZXR1cm5zIGEgYm9vbGVhbiBpbmRpY2F0aW5nIGlmIHRoZSBnaXZlbiBwYXRoIGV4aXN0c1xuICogYW5kIGlzIGEgZmlsZVxuICovXG5cbmV4cG9ydCBpc0ZpbGUgOj0gKHBhdGg6IHN0cmluZyk6IGJvb2xlYW4gPT5cblxuXHRyZXR1cm4gZXhpc3RzU3luYyhwYXRoKSAmJiBzdGF0U3luYyhwYXRoKS5pc0ZpbGUoKVxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKipcbiAqIHJldHVybnMgYSBib29sZWFuIGluZGljYXRpbmcgb2YgdGhlIGdpdmVuIHBhdGggZXhpc3RzXG4gKiBhbmQgaXMgYSBkaXJlY3RvcnlcbiAqL1xuXG5leHBvcnQgaXNEaXIgOj0gKHBhdGg6IHN0cmluZyk6IGJvb2xlYW4gPT5cblxuXHRyZXR1cm4gZXhpc3RzU3luYyhwYXRoKSAmJiBzdGF0U3luYyhwYXRoKS5pc0RpcmVjdG9yeSgpXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogcmV0dXJucyBvbmUgb2Y6XG4gKiAgICAnbWlzc2luZycgIC0gZG9lcyBub3QgZXhpc3RcbiAqICAgICdkaXInICAgICAgLSBpcyBhIGRpcmVjdG9yeVxuICogICAgJ2ZpbGUnICAgICAtIGlzIGEgZmlsZVxuICogICAgJ3N5bWxpbmsnICAtIGlzIGEgc3ltbGlua1xuICogICAgJ3Vua25vd24nICAtIGV4aXN0cywgYnV0IG5vdCBhIGZpbGUsIGRpcmVjdG9yeSBvciBzeW1saW5rXG4gKi9cblxuZXhwb3J0IGdldFBhdGhUeXBlIDo9IChwYXRoOiBzdHJpbmcpOiBwYXRoVHlwZSA9PlxuXG5cdGFzc2VydCBpc1N0cmluZyhwYXRoKSwgXCJub3QgYSBzdHJpbmc6ICN7T0wocGF0aCl9XCJcblx0aWYgbm90IGV4aXN0c1N5bmMgcGF0aFxuXHRcdHJldHVybiAnbWlzc2luZydcblx0aCA6PSBzdGF0U3luYyhwYXRoKVxuXHRyZXR1cm4gKFxuXHRcdCAgaC5pc0ZpbGUoKSAgICAgICAgID8gJ2ZpbGUnXG5cdFx0OiBoLmlzRGlyZWN0b3J5KCkgICAgPyAnZGlyJ1xuXHRcdDogaC5pc1N5bWJvbGljTGluaygpID8gJ3N5bWxpbmsnXG5cdFx0OiAgICAgICAgICAgICAgICAgICAgICAndW5rbm93bidcblx0XHQpXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogZXh0cmFjdCB0aGUgZmlsZSBleHRlbnNpb24gZnJvbSBhIHBhdGgsIGluY2x1ZGluZ1xuICogdGhlIGxlYWRpbmcgcGVyaW9kXG4gKi9cblxuZXhwb3J0IGZpbGVFeHQgOj0gKHBhdGg6IHN0cmluZyk6IHN0cmluZyA9PlxuXG5cdGlmIGxNYXRjaGVzIDo9IHBhdGgubWF0Y2goL1xcLlteXFwuXSskLylcblx0XHRyZXR1cm4gbE1hdGNoZXNbMF1cblx0ZWxzZVxuXHRcdHJldHVybiAnJ1xuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKipcbiAqIHJldHVybiB0aGUgZ2l2ZW4gcGF0aCwgYnV0IHdpdGggdGhlIGdpdmVuIGZpbGUgZXh0ZW5zaW9uXG4gKiByZXBsYWNpbmcgdGhlIGV4aXN0aW5nIGZpbGUgZXh0ZW5zaW9uXG4gKi9cblxuZXhwb3J0IHdpdGhFeHQgOj0gKHBhdGg6IHN0cmluZywgZXh0OiBzdHJpbmcpOiBzdHJpbmcgPT5cblxuXHRhc3NlcnQgZXh0LnN0YXJ0c1dpdGgoJy4nKSwgXCJCYWQgZmlsZSBleHRlbnNpb246ICN7ZXh0fVwiXG5cdGxNYXRjaGVzIDo9IHBhdGgubWF0Y2goL14oLiopKFxcLlteXFwuXSspJC8pXG5cdGlmIChsTWF0Y2hlcyA9PSBudWxsKVxuXHRcdHRocm93IG5ldyBFcnJvcihcIkJhZCBwYXRoOiAnI3twYXRofSdcIilcblx0W18sIGhlYWRTdHIsIG9yZ0V4dF0gOj0gbE1hdGNoZXNcblx0cmV0dXJuIFwiI3toZWFkU3RyfSN7ZXh0fVwiXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbmV4cG9ydCBsU3RhdEZpZWxkczogc3RyaW5nW10gOj0gW1xuXHQnZGV2JywnaW5vJywnbW9kZScsJ25saW5rJywndWlkJywnZ2lkJywncmRldicsXG5cdCdzaXplJywnYmxrc2l6ZScsJ2Jsb2NrcycsXG5cdCdhdGltZU1zJywnbXRpbWVNcycsJ2N0aW1lTXMnLCdiaXJ0aHRpbWVNcycsXG5cdCdhdGltZScsJ210aW1lJywnY3RpbWUnLCdiaXJ0aHRpbWUnLFxuXHRdXG5cbi8qKlxuICogcmV0dXJuIHN0YXRpc3RpY3MgZm9yIGEgZmlsZSBvciBkaXJlY3RvcnlcbiAqL1xuXG5leHBvcnQgZ2V0U3RhdHMgOj0gKHBhdGg6IHN0cmluZyk6IGhhc2ggPT5cblxuXHRyZXR1cm4gc3RhdFN5bmMocGF0aClcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuXG4vKipcbiAqIHBhcnNlcyBhIHBhdGggb3IgZmlsZSBVUkwsIGFuZCByZXR1cm5zIGEgaGFzaCB3aXRoIGtleXM6XG4gKiBcdHR5cGU6IHBhdGhUeXBlIC0gJ2ZpbGUnLCdkaXInLCdzeW1saW5rJywnbWlzc2luZycgb3IgJ3Vua25vd24nXG4gKiBcdHBhdGg6IHN0cmluZ1xuICogXHRyb290OiBzdHJpbmdcbiAqIFx0ZGlyOiBzdHJpbmdcbiAqIFx0ZmlsZU5hbWU6IHN0cmluZ1xuICogXHRzdHViOiBzdHJpbmc/XG4gKiBcdHB1cnBvc2U6IHN0cmluZz9cbiAqIFx0ZXh0OiBzdHJpbmc/XG4gKiBcdHJlbFBhdGg6IHN0cmluZ1xuICogXHRyZWxEaXI6IHN0cmluZ1xuICovXG5cbmV4cG9ydCB0eXBlIHBhdGhJbmZvID0ge1xuXHR0eXBlOiBwYXRoVHlwZSAgIyAnZmlsZScsJ2RpcicsJ3N5bWxpbmsnLCdtaXNzaW5nJyBvciAndW5rbm93bidcblx0cGF0aDogc3RyaW5nXG5cdHJvb3Q6IHN0cmluZ1xuXHRkaXI6IHN0cmluZ1xuXHRmaWxlTmFtZTogc3RyaW5nXG5cdHN0dWI6IHN0cmluZz9cblx0cHVycG9zZTogc3RyaW5nP1xuXHRleHQ6IHN0cmluZz9cblx0cmVsUGF0aDogc3RyaW5nXG5cdHJlbERpcjogc3RyaW5nXG5cdH1cblxuZXhwb3J0IHBhcnNlUGF0aCA6PSAocGF0aDogc3RyaW5nKTogcGF0aEluZm8gPT5cblxuXHQjIC0tLSBOT1RFOiBwYXRoIG1heSBiZSBhIGZpbGUgVVJMLCBlLmcuIGltcG9ydC5tZXRhLnVybFxuXHQjICAgICAgICAgICBwYXRoIG1heSBiZSBhIHJlbGF0aXZlIHBhdGhcblxuXHRhc3NlcnQgaXNOb25FbXB0eVN0cmluZyhwYXRoKSwgXCJwYXRoIG5vdCBhIHN0cmluZyAje09MKHBhdGgpfVwiXG5cdGlmIGRlZmluZWQocGF0aC5tYXRjaCgvXmZpbGVcXDpcXC9cXC8vKSlcblx0XHRwYXRoID0gdXJsTGliLmZpbGVVUkxUb1BhdGgocGF0aClcblx0cGF0aCA9IG5vcm1hbGl6ZVBhdGggcGF0aFxuXG5cdHtyb290LCBkaXIsIGJhc2U6IGZpbGVOYW1lfSA6PSBwYXRoTGliLnBhcnNlKHBhdGgpXG5cblx0bFBhcnRzIDo9IGZpbGVOYW1lLnNwbGl0KCcuJylcblx0W3N0dWIsIHB1cnBvc2UsIGV4dF0gOj0gc3dpdGNoIGxQYXJ0cy5sZW5ndGhcblx0XHR3aGVuIDBcblx0XHRcdGNyb2FrIFwiQ2FuJ3QgaGFwcGVuXCJcblx0XHR3aGVuIDFcblx0XHRcdFtmaWxlTmFtZSwgdW5kZWYsIHVuZGVmXVxuXHRcdHdoZW4gMlxuXHRcdFx0W2xQYXJ0c1swXSwgdW5kZWYsIFwiLiN7bFBhcnRzWzFdfVwiXVxuXHRcdGVsc2Vcblx0XHRcdFtcblx0XHRcdFx0bFBhcnRzLnNsaWNlKDAsIC0yKS5qb2luKCcuJyksXG5cdFx0XHRcdGxQYXJ0cy5hdCgtMiksXG5cdFx0XHRcdFwiLiN7bFBhcnRzLmF0KC0xKX1cIlxuXHRcdFx0XHRdXG5cblx0IyAtLS0gR3JhYiBldmVyeXRoaW5nIHVwIHVudGlsIHRoZSBsYXN0IHBhdGggc2VwYXJhdG9yLCBpZiBhbnlcblx0cmVsUGF0aCA6PSByZWxwYXRoIHBhdGhcblx0bFBhdGhNYXRjaGVzIDo9IHJlbFBhdGgubWF0Y2goL14oLiopW1xcXFxcXC9dW15cXFxcXFwvXSokLylcblx0cmVsRGlyIDo9IChsUGF0aE1hdGNoZXMgPT0gbnVsbCkgPyAnLicgOiBsUGF0aE1hdGNoZXNbMV1cblxuXHRyZXR1cm4ge1xuXHRcdHR5cGU6IGdldFBhdGhUeXBlKHBhdGgpXG5cdFx0cGF0aFxuXHRcdHJvb3Rcblx0XHRkaXJcblx0XHRmaWxlTmFtZVxuXHRcdHN0dWJcblx0XHRwdXJwb3NlXG5cdFx0ZXh0XG5cdFx0cmVsUGF0aFxuXHRcdHJlbERpclxuXHRcdH1cblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuLyoqXG4gKiBnZW5lcmF0ZSBmaWxlcyB0aGF0IG1hdGNoIGEgZ2l2ZW4gZ2xvYiBwYXR0ZXJuXG4gKiB5aWVsZHMge3BhdGgsIG5hbWUsIGlzRmlsZSwgaXNEaXJlY3RvcnksIGlzU3ltbGlua31cbiAqICAgIHdpdGggcGFyc2Ugb3B0aW9uLCBhbHNvIGluY2x1ZGVzIGtleXM6XG4gKiAgICAgICByZWxQYXRoXG4gKiBUaGVzZSBvcHRpb25zIG1heSBiZSBzcGVjaWZpZWQgaW4gdGhlIDJuZCBwYXJhbWV0ZXI6XG4gKiAgICByb290OiBzdHJpbmcgLSByb290IG9mIHNlYXJjaCwgKGRlZjogRGVuby5jd2QoKSlcbiAqICAgIGxFeGNsdWRlOiBbc3RyaW5nXSAtIHBhdHRlcm5zIHRvIGV4Y2x1ZGUsXG4gKiAgICBcdGRlZjogWydub2RlX21vZHVsZXMvKionLCAnLmdpdC8qKiddXG4gKiAgICBpbmNsdWRlRGlyczogYm9vbGVhbiAtIHNob3VsZCBkaXJlY3RvcmllcyBiZSBpbmNsdWRlZD8gKGRlZjogdHJ1ZSlcbiAqIFx0Zm9sbG93U3ltbGlua3MgLSBib29sZWFuIC0gc2hvdWxkIHN5bSBsaW5rcyBiZSBmb2xsb3dlZD8gKGRlZjogZmFsc2UpXG4gKiBcdGNhbm9uaWNhbGl6ZTogYm9vbGVhbiAtIGlmIGZvbGxvd3N5bWxpbmtzIGlzIHRydWUsIHNob3VsZFxuICogXHRcdHBhdGhzIGJlIGNhbm9uaWNhbGl6ZWQ/IChkZWY6IHRydWUpXG4gKiBcdGZpbHRlcjogKHN0cmluZy0+Ym9vbGVhbikgLSB5aWVsZCBvbmx5IGlmIGZ1bmN0aW9uIHJldHVybnMgdHJ1ZVxuICovXG5cbmV4cG9ydCBhbGxGaWxlc01hdGNoaW5nIDo9IChcblx0cGF0dGVybjogc3RyaW5nPScqKicsXG5cdGhPcHRpb25zOiBvcHRpb25zcGVjPXt9XG5cdCk6IEdlbmVyYXRvcjxoYXNoLCB2b2lkLCB1bmtub3duPiAtPlxuXG5cdHtcblx0XHRyb290XG5cdFx0bEV4Y2x1ZGVcblx0XHRpbmNsdWRlRGlyc1xuXHRcdGZvbGxvd1N5bWxpbmtzXG5cdFx0Y2Fub25pY2FsaXplXG5cdFx0ZmlsdGVyXG5cdFx0ZGVidWdcblx0XHR9IDo9IGdldE9wdGlvbnMgaE9wdGlvbnMsIHtcblx0XHRcdHJvb3Q6IHVuZGVmXG5cdFx0XHRsRXhjbHVkZTogWydub2RlX21vZHVsZXMvKionLCAnLmdpdC8qKiddXG5cdFx0XHRpbmNsdWRlRGlyczogZmFsc2Vcblx0XHRcdGZvbGxvd1N5bWxpbmtzOiBmYWxzZVxuXHRcdFx0Y2Fub25pY2FsaXplOiBmYWxzZVxuXHRcdFx0ZmlsdGVyOiB1bmRlZlxuXHRcdFx0ZGVidWc6IGZhbHNlXG5cdFx0XHR9XG5cblx0aEdsb2JPcHRpb25zIDo9IHtcblx0XHRyb290XG5cdFx0ZXhjbHVkZTogbEV4Y2x1ZGVcblx0XHRpbmNsdWRlRGlyc1xuXHRcdGZvbGxvd1N5bWxpbmtzXG5cdFx0Y2Fub25pY2FsaXplXG5cdFx0fVxuXG5cdERCRyA6PSAobXNnOiBzdHJpbmcpOiB2b2lkID0+XG5cdFx0aWYgZGVidWdcblx0XHRcdGNvbnNvbGUubG9nIG1zZ1xuXHRcdHJldHVyblxuXG5cdGZvciBoIG9mIGV4cGFuZEdsb2JTeW5jKHBhdHRlcm4sIGhHbG9iT3B0aW9ucylcblx0XHQjIC0tLSBoIGhhcyBrZXlzOiBwYXRoLCBuYW1lLCBpc0ZpbGUsIGlzRGlyZWN0b3J5LCBpc1N5bUxpbmtcblxuXHRcdERCRyBcIk1BVENIOiAje2gucGF0aH1cIlxuXHRcdHR5cGUgOj0gKFxuXHRcdFx0ICBoLmlzRmlsZSAgICAgID8gJ2ZpbGUnXG5cdFx0XHQ6IGguaXNEaXJlY3RvcnkgPyAnZGlyJ1xuXHRcdFx0OiBoLmlzU3ltbGluayAgID8gJ3N5bWxpbmsnXG5cdFx0XHQ6ICAgICAgICAgICAgICAgICAndW5rbm93bidcblx0XHRcdClcblx0XHRoRmlsZSA6PSBwYXJzZVBhdGgoaC5wYXRoKVxuXHRcdGlmIG5vdGRlZmluZWQoZmlsdGVyKVxuXHRcdFx0REJHIFwiICAgLSBubyBmaWx0ZXJcIlxuXHRcdFx0eWllbGQgaEZpbGVcblx0XHRlbHNlIGlmIGZpbHRlcihoRmlsZSlcblx0XHRcdERCRyBcIiAgIC0gYWxsb3dlZCBieSBmaWx0ZXJcIlxuXHRcdFx0eWllbGQgaEZpbGVcblx0XHRlbHNlXG5cdFx0XHREQkcgXCIgICAtIGV4Y2x1ZGVkIGJ5IGZpbHRlclwiXG5cdHJldHVyblxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuIyBBU1lOQyBJVEVSQUJMRVxuXG4vKipcbiAqIEFuIGFzeW5jIGl0ZXJhYmxlIC0geWllbGRzIGV2ZXJ5IGxpbmUgaW4gdGhlIGdpdmVuIGZpbGVcbiAqXG4gKiBVc2FnZTpcbiAqICAgZm9yIGF3YWl0IGxpbmUgb2YgYWxsTGluZXNJbignc3JjL2xpYi90ZW1wLmNpdmV0JylcbiAqIFx0ICBjb25zb2xlLmxvZyBcIkxJTkU6ICN7bGluZX1cIlxuICogICBjb25zb2xlLmxvZyBcIkRPTkVcIlxuICovXG5cbmV4cG9ydCBhbGxMaW5lc0luIDo9IChcblx0cGF0aDogc3RyaW5nXG5cdCk6IEFzeW5jR2VuZXJhdG9yPHN0cmluZywgdm9pZCwgdW5rbm93bj4gLT5cblxuXHRhc3NlcnQgaXNGaWxlKHBhdGgpLCBcIk5vIHN1Y2ggZmlsZTogI3tPTChwYXRoKX0gKGFsbExpbmVzSW4pXCJcblx0ZiA6PSBhd2FpdCBEZW5vLm9wZW4ocGF0aClcblx0cmVhZGFibGUgOj0gZi5yZWFkYWJsZVxuXHRcdC5waXBlVGhyb3VnaChuZXcgVGV4dERlY29kZXJTdHJlYW0oKSlcblx0XHQucGlwZVRocm91Z2gobmV3IFRleHRMaW5lU3RyZWFtKCkpXG5cblx0Zm9yIGF3YWl0IGxpbmUgb2YgcmVhZGFibGVcblx0XHR5aWVsZCBsaW5lXG5cdHJldHVyblxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKipcbiAqIGNvbnZlcnRzIGFsbCBiYWNrc2xhc2ggY2hhcmFjdGVycyB0byBmb3J3YXJkIHNsYXNoZXNcbiAqIHVwcGVyLWNhc2VzIGRyaXZlIGxldHRlcnNcbiAqL1xuXG5leHBvcnQgbm9ybWFsaXplUGF0aCA6PSAocGF0aDogc3RyaW5nKTogc3RyaW5nID0+XG5cblx0bnBhdGggOj0gcGF0aC5yZXBsYWNlQWxsKCdcXFxcJywgJy8nKVxuXHRpZiAobnBhdGguY2hhckF0KDEpID09ICc6Jylcblx0XHRyZXR1cm4gbnBhdGguY2hhckF0KDApLnRvVXBwZXJDYXNlKCkgKyBucGF0aC5zdWJzdHJpbmcoMSlcblx0ZWxzZVxuXHRcdHJldHVybiBucGF0aFxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKipcbiAqIHJlc29sdmVzIG11bHRpcGxlIHBhdGggcGFydHMgdG8gYSBzaW5nbGUgcGF0aFxuICogcmV0dXJucyBub3JtYWxpemVkIHBhdGhcbiAqL1xuXG5leHBvcnQgbWtwYXRoIDo9IChsUGFydHMuLi46IHN0cmluZ1tdKTogc3RyaW5nID0+XG5cblx0cGF0aCA6PSBwYXRoTGliLnJlc29sdmUobFBhcnRzLi4uKVxuXHRyZXR1cm4gbm9ybWFsaXplUGF0aChwYXRoKVxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKipcbiAqIHJlc29sdmVzIG11bHRpcGxlIHBhdGggcGFydHMgdG8gYSBzaW5nbGUgcGF0aFxuICogcmV0dXJucyBub3JtYWxpemVkIHBhdGgsIHJlbGF0aXZlIHRvIGN1cnJlbnQgZGlyZWN0b3J5XG4gKi9cblxuZXhwb3J0IHJlbHBhdGggOj0gKGxQYXJ0cy4uLjogc3RyaW5nW10pOiBzdHJpbmcgPT5cblxuXHRhc3NlcnQgaXNBcnJheU9mU3RyaW5ncyhsUGFydHMpLCBcIkJhZCBsUGFydHM6ICN7T0wobFBhcnRzKX1cIlxuXHRmdWxsUGF0aCA6PSBwYXRoTGliLnJlc29sdmUgbFBhcnRzLi4uXG5cdHJldHVybiBub3JtYWxpemVQYXRoIHBhdGhMaWIucmVsYXRpdmUoJycsIGZ1bGxQYXRoKVxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG5leHBvcnQgdHlwZSBwYXRoRGVzYyA9IHtcblx0ZGlyOiBzdHJpbmdcblx0cm9vdDogc3RyaW5nXG5cdGxQYXJ0czogc3RyaW5nW11cblx0fVxuXG4vKipcbiAqIHJldHVybnMge2Rpciwgcm9vdCwgbFBhcnRzfSB3aGVyZSBsUGFydHMgaW5jbHVkZXMgdGhlIG5hbWVzIG9mXG4gKiBhbGwgZGlyZWN0b3JpZXMgYmV0d2VlbiB0aGUgcm9vdCBhbmQgdGhlIGZpbGUgbmFtZVxuICogcmVsYXRpdmUgdG8gdGhlIGN1cnJlbnQgd29ya2luZyBkaXJlY3RvcnlcbiAqL1xuXG5leHBvcnQgcGF0aFN1YkRpcnMgPSAocGF0aDogc3RyaW5nLCBoT3B0aW9uczogb3B0aW9uc3BlYz17fSk6IHBhdGhEZXNjID0+XG5cblx0e3JlbGF0aXZlfSA6PSBnZXRPcHRpb25zIGhPcHRpb25zLCB7XG5cdFx0cmVsYXRpdmU6IGZhbHNlXG5cdFx0fVxuXHRwYXRoID0gcmVsYXRpdmUgPyByZWxwYXRoKHBhdGgpIDogbWtwYXRoKHBhdGgpXG5cdHtyb290LCBkaXJ9IDo9IHBhdGhMaWIucGFyc2UocGF0aClcblx0cmV0dXJuIHtcblx0XHRkaXJcblx0XHRyb290XG5cdFx0bFBhcnRzOiBkaXIuc2xpY2Uocm9vdC5sZW5ndGgpLnNwbGl0KC9bXFxcXFxcL10vKVxuXHRcdH1cblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiMgLS0tIFNob3VsZCBiZSBjYWxsZWQgbGlrZTogbXlzZWxmKGltcG9ydC5tZXRhLnVybClcbiMgICAgIHJldHVybnMgZnVsbCBwYXRoIG9mIGN1cnJlbnQgZmlsZVxuXG5leHBvcnQgbXlzZWxmIDo9ICh1cmw6IHN0cmluZyk6IHN0cmluZyA9PlxuXG5cdHJldHVybiByZWxwYXRoIHVybExpYi5maWxlVVJMVG9QYXRoKHVybClcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKipcbiAqIHJlYWQgYSBmaWxlIGludG8gYSBzdHJpbmdcbiAqL1xuXG5leHBvcnQgc2x1cnAgOj0gKHBhdGg6IHN0cmluZyk6IHN0cmluZyA9PlxuXG5cdGFzc2VydCBpc0ZpbGUocGF0aCksIFwiTm8gc3VjaCBmaWxlOiAje3BhdGh9IChzbHVycClcIlxuXHRkYXRhIDo9IERlbm8ucmVhZEZpbGVTeW5jIHBhdGhcblx0cmV0dXJuIGRlY29kZXIuZGVjb2RlKGRhdGEpLnJlcGxhY2VBbGwoJ1xccicsICcnKVxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKipcbiAqIHdyaXRlIGEgc3RyaW5nIHRvIGEgZmlsZVxuICogd2lsbCBlbnN1cmUgdGhhdCBhbGwgbmVjZXNzYXJ5IGRpcmVjdG9yaWVzIGV4aXN0XG4gKi9cblxuZXhwb3J0IGJhcmYgOj0gKFxuXHRjb250ZW50czogc3RyaW5nLFxuXHRwYXRoOiBzdHJpbmcsXG5cdGhPcHRpb25zOiBvcHRpb25zcGVjPXt9XG5cdCk6IHZvaWQgPT5cblxuXHR7YXBwZW5kfSA6PSBnZXRPcHRpb25zIGhPcHRpb25zLCB7XG5cdFx0YXBwZW5kOiBmYWxzZVxuXHRcdH1cblx0bWtEaXJzRm9yRmlsZShwYXRoKVxuXHRkYXRhIDo9IGVuY29kZXIuZW5jb2RlKGNvbnRlbnRzKVxuXHRpZiBhcHBlbmQgJiYgaXNGaWxlKHBhdGgpXG5cdFx0YXBwZW5kRmlsZVN5bmMgcGF0aCwgZGF0YVxuXHRlbHNlXG5cdFx0RGVuby53cml0ZUZpbGVTeW5jIHBhdGgsIGRhdGFcblx0cmV0dXJuXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbmV4cG9ydCBuZXdlckRlc3RGaWxlRXhpc3RzIDo9IChcblx0c3JjUGF0aDogc3RyaW5nLFxuXHRkZXN0UGF0aDogc3RyaW5nXG5cdCk6IGJvb2xlYW4gPT5cblxuXHRhc3NlcnQgaXNGaWxlKHNyY1BhdGgpLCBcIk5vIHN1Y2ggZmlsZTogI3tPTChzcmNQYXRoKX0gKG5ld2VyRGVzdEZpbGVFeGlzdHMpXCJcblx0aWYgbm90IGV4aXN0c1N5bmMoZGVzdFBhdGgpXG5cdFx0cmV0dXJuIGZhbHNlXG5cdHNyY01vZFRpbWUgOj0gc3RhdFN5bmMoc3JjUGF0aCkubXRpbWVNc1xuXHRkZXN0TW9kVGltZSA6PSBzdGF0U3luYyhkZXN0UGF0aCkubXRpbWVNc1xuXHRyZXR1cm4gKGRlc3RNb2RUaW1lID4gc3JjTW9kVGltZSlcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuLyoqXG4gKiBjcmVhdGUgYSBuZXcgZGlyZWN0b3J5IGlmIGl0IGRvZXNuJ3QgZXhpc3RcbiAqIGlmIHRoZSBvcHRpb24gJ2NsZWFyJyBpcyBzZXQgdG8gYSB0cnVlIHZhbHVlIGluIHRoZSAybmQgcGFyYW1ldGVyXG4gKiBhbmQgdGhlIGRpcmVjdG9yeSBhbHJlYWR5IGV4aXN0cywgaXQgaXMgY2xlYXJlZFxuICovXG5cbmV4cG9ydCBta0RpciA9IChkaXJQYXRoOiBzdHJpbmcsIGNsZWFyOiBib29sZWFuPWZhbHNlKTogdm9pZCA9PlxuXG5cdGlmIGNsZWFyXG5cdFx0ZW1wdHlEaXJTeW5jIGRpclBhdGggICAgIyAtLS0gY3JlYXRlcyBpZiBpdCBkb2Vzbid0IGV4aXN0XG5cdGVsc2Vcblx0XHRlbnN1cmVEaXJTeW5jIGRpclBhdGhcblx0cmV0dXJuXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogcmVtb3ZlIGEgZmlsZSBmcm9tIHRoZSBmaWxlIHN5c3RlbSwgYnV0IGRvIG5vdGhpbmdcbiAqIGlmIHRoZSBmaWxlIGRvZXMgbm90IGV4aXN0XG4gKi9cblxuZXhwb3J0IHJtRmlsZSA6PSAocGF0aDogc3RyaW5nKTogdm9pZCA9PlxuXG5cdGlmIGV4aXN0c1N5bmMgcGF0aFxuXHRcdERlbm8ucmVtb3ZlU3luYyBwYXRoXG5cdHJldHVyblxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKipcbiAqIHJlbW92ZSBhIGRpcmVjdG9yeSBmcm9tIHRoZSBmaWxlIHN5c3RlbSwgYnV0IGRvIG5vdGhpbmdcbiAqIGlmIHRoZSBkaXJlY3RvcnkgZG9lcyBub3QgZXhpc3RcbiAqIE5PVEU6IFlvdSBtdXN0IHBhc3MgdGhlICdjbGVhcicgb3B0aW9uIGlmIHRoZSBkaXJlY3RvcnlcbiAqICAgICAgIGlzIG5vdCBlbXB0eVxuICovXG5cbmV4cG9ydCBybURpciA6PSAocGF0aDogc3RyaW5nLCBoT3B0aW9uczogb3B0aW9uc3BlYz17fSk6IHZvaWQgPT5cblxuXHR7Y2xlYXJ9IDo9IGdldE9wdGlvbnMgaE9wdGlvbnMsIHtcblx0XHRjbGVhcjogZmFsc2Vcblx0XHR9XG5cdGlmIGV4aXN0c1N5bmMgcGF0aFxuXHRcdGlmIGNsZWFyXG5cdFx0XHREZW5vLnJlbW92ZVN5bmMgcGF0aCwge3JlY3Vyc2l2ZTogdHJ1ZX1cblx0XHRlbHNlXG5cdFx0XHREZW5vLnJlbW92ZVN5bmMgcGF0aFxuXHRyZXR1cm5cblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuLyoqXG4gKiBjcmVhdGUgYW55IG1pc3NpbmcgZGlyZWN0b3JpZXMgaW4gdGhlIGdpdmVuIHBhdGhcbiAqL1xuXG5leHBvcnQgbWtEaXJzRm9yRmlsZSA9IChwYXRoOiBzdHJpbmcpOiB2b2lkID0+XG5cblx0e3Jvb3QsIGxQYXJ0c30gOj0gcGF0aFN1YkRpcnMocGF0aClcblx0bGV0IGRpciA9IHJvb3Rcblx0Zm9yIHBhcnQgb2YgbFBhcnRzXG5cdFx0ZGlyICs9IFwiLyN7cGFydH1cIlxuXHRcdGlmIG5vdCBpc0RpcihkaXIpXG5cdFx0XHRta0RpciBkaXJcblx0cmV0dXJuXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogZGVsZXRlcyBhbGwgZmlsZXMgYW5kIHN1YmRpcmVjdG9yaWVzIGluIHRoZSBnaXZlbiBkaXJlY3RvcnlcbiAqL1xuXG5leHBvcnQgY2xlYXJEaXIgPSAoZGlyUGF0aDogc3RyaW5nKTogdm9pZCA9PlxuXG5cdGVtcHR5RGlyU3luYyBkaXJQYXRoXG5cdHJldHVyblxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuIyAtLS0gaE9wdGlvbnMgZ2V0cyBwYXNzZWQgdG8gYWxsRmlsZXNNYXRjaGluZygpXG5cbmV4cG9ydCByZW1vdmVGaWxlc01hdGNoaW5nIDo9IChcblx0cGF0dGVybjogc3RyaW5nLFxuXHRoT3B0aW9uczogb3B0aW9uc3BlYz17fVxuXHQpOiB2b2lkID0+XG5cblx0YXNzZXJ0IChwYXR0ZXJuICE9ICcqJykgJiYgKHBhdHRlcm4gIT0gJyoqJyksXG5cdFx0XCJDYW4ndCBkZWxldGUgZmlsZXMgbWF0Y2hpbmcgI3tPTChwYXR0ZXJuKX1cIlxuXHRmb3Ige3JlbFBhdGh9IG9mIGFsbEZpbGVzTWF0Y2hpbmcocGF0dGVybiwgaE9wdGlvbnMpXG5cdFx0RGVuby5yZW1vdmVTeW5jIHJlbFBhdGhcblx0cmV0dXJuXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbmV4cG9ydCByZW1vdmVGaWxlc0V4Y2VwdCA6PSAoXG5cdHBhdHRlcm46IHN0cmluZyxcblx0bEtlZXA6IHN0cmluZ1tdLFxuXHRoT3B0aW9uczogb3B0aW9uc3BlYyA9IHt9XG5cdCk6IHZvaWQgPT5cblxuXHR7ZGVidWd9IDo9IGdldE9wdGlvbnMgaE9wdGlvbnMsIHtcblx0XHRkZWJ1ZzogZmFsc2Vcblx0XHR9XG5cdERCRyA6PSAobXNnOiBzdHJpbmcpOiB2b2lkID0+XG5cdFx0aWYgZGVidWdcblx0XHRcdGNvbnNvbGUubG9nIG1zZ1xuXHRcdHJldHVyblxuXG5cdCMgLS0tIHRydWUgcmV0dXJuIG1lYW5zIHJlbW92ZSBpdFxuXHRmaWx0ZXIgOj0gKGhGaWxlOiBwYXRoSW5mbyk6IGJvb2xlYW4gPT5cblx0XHR7dHlwZSwgcmVsUGF0aH0gOj0gaEZpbGVcblx0XHRpZiAodHlwZSAhPSAnZmlsZScpXG5cdFx0XHRyZXR1cm4gZmFsc2Vcblx0XHRyZXR1cm4gbm90IGxLZWVwLmluY2x1ZGVzKHJlbFBhdGgpXG5cblx0aDogb3B0aW9uc3BlYyA6PSB7ZmlsdGVyLCBkZWJ1Z31cblx0Zm9yIHtyZWxQYXRofSBvZiBhbGxGaWxlc01hdGNoaW5nKHBhdHRlcm4sIGgpXG5cdFx0REJHIFwiUkVNT1ZFIEZJTEUgI3tyZWxQYXRofVwiXG5cdFx0RGVuby5yZW1vdmVTeW5jIHJlbFBhdGhcblx0cmV0dXJuXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbmV4cG9ydCByZW1vdmVEaXJzRXhjZXB0IDo9IChcblx0cGF0dGVybjogc3RyaW5nLFxuXHRsS2VlcDogc3RyaW5nW10sXG5cdGhPcHRpb25zOiBvcHRpb25zcGVjID0ge31cblx0KTogdm9pZCA9PlxuXG5cdHtkZWJ1Z30gOj0gZ2V0T3B0aW9ucyBoT3B0aW9ucywge1xuXHRcdGRlYnVnOiBmYWxzZVxuXHRcdH1cblx0REJHIDo9IChtc2c6IHN0cmluZyk6IHZvaWQgPT5cblx0XHRpZiBkZWJ1Z1xuXHRcdFx0Y29uc29sZS5sb2cgbXNnXG5cdFx0cmV0dXJuXG5cblx0IyAtLS0gdHJ1ZSByZXR1cm4gbWVhbnMgcmVtb3ZlIGl0XG5cdGZpbHRlciA6PSAoaEZpbGU6IHBhdGhJbmZvKTogYm9vbGVhbiA9PlxuXHRcdHt0eXBlLCByZWxQYXRofSA6PSBoRmlsZVxuXHRcdGlmICh0eXBlICE9ICdkaXInKVxuXHRcdFx0cmV0dXJuIGZhbHNlXG5cdFx0cmV0dXJuIG5vdCBsS2VlcC5pbmNsdWRlcyhyZWxQYXRoKVxuXG5cdGg6IG9wdGlvbnNwZWMgOj0ge2ZpbHRlciwgaW5jbHVkZURpcnM6IHRydWV9XG5cdHBhdGhGdW5jIDo9IChoOiBoYXNoKTogc3RyaW5nID0+IGgucGF0aFxuXHRsRGlycyA6PSBBcnJheS5mcm9tKGFsbEZpbGVzTWF0Y2hpbmcocGF0dGVybiwgaCkpLm1hcChwYXRoRnVuYylcblxuXHQjIC0tLSBXZSBuZWVkIHRvIHJlbW92ZSBlbXB0eSBzdWJkaXJlY3RvcmllcyBiZWZvcmVcblx0IyAgICAgcmVtb3ZpbmcgYSBkaXJlY3RvcnksIHNvIHdlIGJ1aWxkIGEgbGlzdCBhbmRcblx0IyAgICAgcmVtb3ZlIGxvbmdlciBwYXRocyBiZWZvcmUgc2hvcnRlciBwYXRoc1xuXG5cdGNvbXBhcmVGdW5jIDo9IChhOiBzdHJpbmcsIGI6IHN0cmluZyk6IG51bWJlciA9PiAoYi5sZW5ndGggLSBhLmxlbmd0aClcblx0Zm9yIHBhdGggb2YgbERpcnMuc29ydChjb21wYXJlRnVuYylcblx0XHREQkcgXCJSRU1PVkUgRElSICN7cGF0aH1cIlxuXHRcdERlbm8ucmVtb3ZlU3luYyBwYXRoXG5cdHJldHVyblxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG5leHBvcnQgdHlwZSBmc0NoYW5nZVR5cGUgPSB7XG5cdGtpbmQ6IHN0cmluZ1xuXHRwYXRoOiBzdHJpbmdcblx0bXM/OiBudW1iZXJcblx0fVxuXG4vKipcbiAqIHR5cGUgZnNDYWxsYmFja0Z1bmMgLSBhIGZ1bmN0aW9uIHRha2luZyAodHlwZSwgcGF0aCkgYW5kIG9wdGlvbmFsbHlcbiAqIHJldHVybnMgYSBmdW5jdGlvbiByZWZlcmVuY2UgdG8gYmUgY2FsbGVkIG9uIGZpbGUgY2hhbmdlc1xuICovXG5cbmV4cG9ydCB0eXBlIGZzQ2FsbGJhY2tGdW5jID0gKGNoYW5nZTogZnNDaGFuZ2VUeXBlKSA9PiB2b2lkXG5cbi8qKlxuICogY2xhc3MgRmlsZUV2ZW50SGFuZGxlclxuICogICAgaGFuZGxlcyBmaWxlIGNoYW5nZWQgZXZlbnRzIHdoZW4gLmhhbmRsZSh7a2luZCwgcGF0aH0pIGlzIGNhbGxlZFxuICogICAgY2FsbGJhY2sgaXMgYSBmdW5jdGlvbiwgZGVib3VuY2VkIGJ5IDIwMCBtc1xuICogICAgICAgdGhhdCB0YWtlcyAodHlwZSwgcGF0aCkgYW5kIHJldHVybnMgYSB2b2lkRnVuY1xuICogICAgICAgd2hpY2ggd2lsbCBiZSBjYWxsZWQgaWYgdGhlIGNhbGxiYWNrIHJldHVybnMgYSBmdW5jdGlvbiByZWZlcmVuY2VcbiAqIFt1bml0IHRlc3RzXSguLi90ZXN0L2ZzLnRlc3QuY2l2ZXQjOn46dGV4dD0lMjMlMjAlMkQlMkQlMkQlMjBjbGFzcyUyMEZpbGVFdmVudEhhbmRsZXIpXG4gKi9cblxuZXhwb3J0IGNsYXNzIEZpbGVFdmVudEhhbmRsZXJcblxuXHRjYWxsYmFjazogZnNDYWxsYmFja0Z1bmM/XG5cdGxDaGFuZ2VzOiBmc0NoYW5nZVR5cGVbXSA6PSBbXVxuXHRoSGFuZGxlcnM6IGhhc2ggPSB7fSAgICMgLS0tIHBhdGggPT4gZXZlbnQgdHlwZSA9PiBkZWJvdW5jZWQgaGFuZGxlclxuXHRvblN0b3A6ICgpID0+IHZvaWQgPSBwYXNzXG5cdG1zOiBudW1iZXJcblx0ZGVidWc6IGJvb2xlYW5cblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRcdEBjYWxsYmFjazogZnNDYWxsYmFja0Z1bmM/PXVuZGVmLFxuXHRcdFx0aE9wdGlvbnM6IG9wdGlvbnNwZWM9e31cblx0XHRcdClcblxuXHRcdHtcblx0XHRcdGRlYnVnOiBAZGVidWcsXG5cdFx0XHRvblN0b3A6IEBvblN0b3Bcblx0XHRcdG1zOiBAbXNcblx0XHRcdH0gOj0gZ2V0T3B0aW9ucyBoT3B0aW9ucywge1xuXHRcdFx0XHRkZWJ1ZzogZmFsc2Vcblx0XHRcdFx0b25TdG9wOiBwYXNzXG5cdFx0XHRcdG1zOiAyMDBcblx0XHRcdFx0fVxuXHRcdEBEQkcgXCJGaWxlRXZlbnRIYW5kbGVyIGNvbnN0cnVjdG9yKCkgY2FsbGVkXCJcblxuXHQjIC0tLSBDYWxscyBhIGZ1bmN0aW9uIG9mIHR5cGUgKCkgPT4gdm9pZFxuXHQjICAgICBidXQgaXMgZGVib3VuY2VkIGJ5IEBtcyBtc1xuXG5cdGhhbmRsZShjaGFuZ2U6IGZzQ2hhbmdlVHlwZSk6IHZvaWRcblx0XHR7a2luZCwgcGF0aH0gOj0gY2hhbmdlXG5cdFx0QERCRyBcIkhBTkRMRTogWyN7c2luY2VMb2FkU3RyKCl9XSAje2tpbmR9ICN7cGF0aH1cIlxuXHRcdGlmIG5vdGRlZmluZWQoQGhIYW5kbGVycz8uW3BhdGhdKVxuXHRcdFx0QERCRyBcIkNyZWF0ZSBoYW5kbGVyIGZvciAnI3twYXRofSdcIiwgMVxuXHRcdFx0QGhIYW5kbGVyc1twYXRoXSA9IHt9XG5cblx0XHRpZiBub3RkZWZpbmVkKEBoSGFuZGxlcnM/LltwYXRoXT8uW2tpbmRdKVxuXHRcdFx0QERCRyBcIkNyZWF0ZSBoYW5kbGVyIGZvciAje2tpbmR9ICN7cGF0aH1cIiwgMVxuXHRcdFx0ZnVuYyA6PSAoKSA9PlxuXHRcdFx0XHRpZiBAY2FsbGJhY2tcblx0XHRcdFx0XHRAY2FsbGJhY2soe2tpbmQsIHBhdGh9KVxuXHRcdFx0XHRAbENoYW5nZXMucHVzaCB7a2luZCwgcGF0aH1cblx0XHRcdFx0QGhIYW5kbGVyc1twYXRoXVtraW5kXSA9IHVuZGVmXG5cdFx0XHRcdHJldHVybiB1bmRlZlxuXHRcdFx0QGhIYW5kbGVyc1twYXRoXVtraW5kXSA9IGRlYm91bmNlKGZ1bmMsIEBtcylcblx0XHRAREJHIFwiQ2FsbCBkZWJvdW5jZWQgaGFuZGxlciBmb3IgI3traW5kfSAje3BhdGh9XCJcblx0XHRAaEhhbmRsZXJzW3BhdGhdW2tpbmRdKClcblx0XHRyZXR1cm5cblxuXHQjIEFTWU5DIVxuXHRnZXRDaGFuZ2VMaXN0KCk6IGZzQ2hhbmdlVHlwZVtdXG5cdFx0YXdhaXQgc2xlZXAgQG1zXG5cdFx0cmV0dXJuIEBsQ2hhbmdlc1xuXG5cdHByaXZhdGUgREJHKG1zZzogc3RyaW5nLCBsZXZlbDogbnVtYmVyPTApOiB2b2lkXG5cdFx0aWYgQGRlYnVnXG5cdFx0XHRjb25zb2xlLmxvZyBcIiAgICN7c3BhY2VzKDMqbGV2ZWwpfS0gI3ttc2d9XCJcblx0XHRyZXR1cm5cblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiMgQVNZTkNcblxuZXhwb3J0IHR5cGUgd2F0Y2hlckNhbGxiYWNrRnVuYyA9IChjaGFuZ2U6IGZzQ2hhbmdlVHlwZSkgPT4gYm9vbGVhblxuXG4vKipcbiAqIGEgZnVuY3Rpb24gdGhhdCB3YXRjaGVzIGZvciBjaGFuZ2VzIG9uZSBvciBtb3JlIGZpbGVzIG9yIGRpcmVjdG9yaWVzXG4gKiAgICBhbmQgY2FsbHMgYSBjYWxsYmFjayBmdW5jdGlvbiBmb3IgZWFjaCBjaGFuZ2UuXG4gKiBJZiB0aGUgY2FsbGJhY2sgcmV0dXJucyB0cnVlLCB3YXRjaGluZyBpcyBoYWx0ZWRcbiAqXG4gKiBVc2FnZTpcbiAqICAgaGFuZGxlciA6PSAoa2luZCwgcGF0aCkgPT4gY29uc29sZS5sb2cgcGF0aFxuICogICBhd2FpdCB3YXRjaEZpbGUgJ3RlbXAudHh0JywgaGFuZGxlclxuICogICBhd2FpdCB3YXRjaEZpbGUgJ3NyYy9saWInLCAgaGFuZGxlclxuICogICBhd2FpdCB3YXRjaEZpbGUgWyd0ZW1wLnR4dCcsICdzcmMvbGliJ10sIGhhbmRsZXJcbiAqL1xuXG5leHBvcnQgd2F0Y2hGaWxlIDo9IChcblx0cGF0aDogc3RyaW5nIHwgc3RyaW5nW10sXG5cdHdhdGNoZXJDQjogd2F0Y2hlckNhbGxiYWNrRnVuYyxcblx0aE9wdGlvbnM6IG9wdGlvbnNwZWM9e31cblx0KTogdm9pZCAtPlxuXG5cdHtkZWJ1ZywgbXN9IDo9IGdldE9wdGlvbnMgaE9wdGlvbnMsIHtcblx0XHRkZWJ1ZzogZmFsc2Vcblx0XHRtczogMjAwXG5cdFx0fVxuXHREQkcgOj0gKG1zZzogc3RyaW5nKTogdm9pZCA9PlxuXHRcdGlmIGRlYnVnXG5cdFx0XHRjb25zb2xlLmxvZyBtc2dcblx0XHRyZXR1cm5cblxuXHREQkcgXCJXQVRDSDogI3tKU09OLnN0cmluZ2lmeShwYXRoKX1cIlxuXG5cdHdhdGNoZXIgOj0gRGVuby53YXRjaEZzKHBhdGgpXG5cblx0bGV0IGRvU3RvcDogYm9vbGVhbiA9IGZhbHNlXG5cblx0ZnNDYWxsYmFjazogZnNDYWxsYmFja0Z1bmMgOj0gKHtraW5kLCBwYXRofSkgPT5cblx0XHRyZXN1bHQgOj0gd2F0Y2hlckNCKHtraW5kLCBwYXRofSlcblx0XHREQkcgXCJGQ0I6IHJlc3VsdCA9ICN7cmVzdWx0fVwiXG5cdFx0aWYgcmVzdWx0XG5cdFx0XHR3YXRjaGVyLmNsb3NlKClcblx0XHRyZXR1cm5cblxuXHRoYW5kbGVyIDo9IG5ldyBGaWxlRXZlbnRIYW5kbGVyKGZzQ2FsbGJhY2ssIHtkZWJ1ZywgbXN9KVxuXG5cdGZvciBhd2FpdCB7a2luZCwgcGF0aHN9IG9mIHdhdGNoZXJcblx0XHREQkcgXCJ3YXRjaGVyIGV2ZW50IGZpcmVkXCJcblx0XHRpZiBkb1N0b3Bcblx0XHRcdERCRyBcImRvU3RvcCA9ICN7ZG9TdG9wfSwgQ2xvc2luZyB3YXRjaGVyXCJcblx0XHRcdGJyZWFrXG4jXHRcdHtraW5kLCBwYXRoc30gOj0gZXZ0XG5cdFx0Zm9yIHBhdGggb2YgcGF0aHNcblx0XHRcdCMgLS0tIGZzQ2FsbGJhY2sgd2lsbCBiZSAoZXZlbnR1YWxseSkgY2FsbGVkXG5cdFx0XHRoYW5kbGVyLmhhbmRsZSh7a2luZCwgcGF0aH0pXG5cbmV4cG9ydCB3YXRjaEZpbGVzIDo9IHdhdGNoRmlsZVxuIl19