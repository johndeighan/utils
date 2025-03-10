"use strict";
// fs.civet

type AutoPromise<T> = Promise<Awaited<T>>;
import {sprintf} from "https://deno.land/std/fmt/printf.ts"
import {debounce} from '@std/async/debounce'

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

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3JjL2xpYi9mcy5jaXZldC50c3giLCJzb3VyY2VzIjpbInNyYy9saWIvZnMuY2l2ZXQiXSwibWFwcGluZ3MiOiI7QUFBQSxXQUFVO0FBQ1YsQUFBQTtBQUNBLEssVyx5QjtBQUFBLE1BQU0sQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLElBQUksQ0FBQyxxQ0FBcUM7QUFDM0QsQUFBQSxBQUFBLE1BQU0sQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLElBQUksQ0FBQyxxQkFBcUI7QUFDNUMsQUFBQTtBQUNBLEFBQUEsQUFBQSxNQUFNLENBQUMsQ0FBQztBQUNSLENBQUMsVUFBVSxDQUFDLENBQUMsWUFBWSxDQUFDLENBQUMsYUFBYSxDQUFDO0FBQ3pDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxhQUFhO0FBQ3JCLEFBQUEsQUFBQSxNQUFNLENBQUMsQ0FBQztBQUNSLENBQUMsY0FBYyxDQUFDO0FBQ2hCLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxTQUFTO0FBQ2pCLEFBQUEsQUFBQSxNQUFNLENBQUMsQ0FBQyxZQUFZLENBQUMsQ0FBQyxJQUFJLENBQUMsYUFBYTtBQUN4QyxBQUFBO0FBQ0EsQUFBQSx3REFBdUQ7QUFDdkQsQUFBQSxrQkFBaUI7QUFDakIsQUFBQSxBQUFBLE1BQU0sQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLElBQUksQ0FBQyxTQUFTO0FBQ2hDLEFBQUE7QUFDQSxBQUFBLEFBQUEsTUFBTSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsV0FBVztBQUMvQixBQUFBLEFBQUEsTUFBTSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsVUFBVTtBQUM3QixBQUFBLEFBQUEsTUFBTSxDQUFDLENBQUMsY0FBYyxDQUFDLENBQUMsSUFBSSxDQUFDLHlCQUF5QjtBQUN0RCxBQUFBLEFBQUEsTUFBTSxDQUFDLENBQUMsY0FBYyxDQUFDLENBQUMsSUFBSSxDQUFDLGtCQUFrQjtBQUMvQyxBQUFBO0FBQ0EsQUFBQSxBQUFBLE1BQU0sQ0FBQyxDQUFDO0FBQ1IsQ0FBQyxLQUFLLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxVQUFVLENBQUM7QUFDNUIsQ0FBQyxRQUFRLENBQUMsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLFNBQVMsQ0FBQztBQUM1RCxDQUFDLE9BQU8sQ0FBQyxDQUFDLGdCQUFnQixDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsUUFBUSxDQUFDO0FBQ3ZELENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsVUFBVSxDQUFDO0FBQ3JDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxnQkFBZ0I7QUFDeEIsQUFBQSxBQUFBLE1BQU0sQ0FBQyxDQUFDO0FBQ1IsQ0FBQyxNQUFNLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxlQUFlLENBQUMsQ0FBQyxJQUFJLENBQUM7QUFDdEQsQ0FBQyxNQUFNLENBQUMsQ0FBQyxZQUFZLENBQUMsQ0FBQyxLQUFLLENBQUM7QUFDN0IsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLGNBQWM7QUFDdEIsQUFBQTtBQUNBLEFBQUEsQUFBSSxNQUFKLElBQUksQ0FBQyxDQUFFLENBQUMsVUFBVSxDQUFDLElBQUk7QUFDdkIsQUFBQSxBQUFBLE1BQU0sQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUM7QUFDdEIsQUFBQSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsU0FBUztBQUNuRCxBQUFBO0FBQ0EsQUFBQSxtQkFBa0I7QUFDbEIsQUFBQSxBQUFPLE1BQVAsT0FBTyxDQUFDLENBQUUsQ0FBQyxHQUFHLENBQUMsV0FBVyxDQUFDLE9BQU8sQ0FBQztBQUNuQyxBQUFBLEFBQU8sTUFBUCxPQUFPLENBQUMsQ0FBRSxDQUFDLEdBQUcsQ0FBQyxXQUFXLENBQUMsQ0FBQztBQUM1QixBQUFBO0FBQ0EsQUFBQSw4RUFBNkU7QUFDN0UsQUFBQTtBQUNBLEFBQUE7QUFDQTtBQUNBO0FBQ0EsR0FBRztBQUNILEFBQUE7QUFDQSxBQUFBLEFBQUEsTUFBTSxDQUFPLE1BQU4sTUFBTSxDQUFDLENBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQSxDQUFBO0FBQzNDLEFBQUE7QUFDQSxBQUFBLENBQUMsTUFBTSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDO0FBQUMsQ0FBQTtBQUNuRCxBQUFBO0FBQ0EsQUFBQSw4RUFBNkU7QUFDN0UsQUFBQTtBQUNBLEFBQUE7QUFDQTtBQUNBO0FBQ0EsR0FBRztBQUNILEFBQUE7QUFDQSxBQUFBLEFBQUEsTUFBTSxDQUFNLE1BQUwsS0FBSyxDQUFDLENBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQSxDQUFBO0FBQzFDLEFBQUE7QUFDQSxBQUFBLENBQUMsTUFBTSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDLFdBQVcsQ0FBQyxDO0FBQUMsQ0FBQTtBQUN4RCxBQUFBO0FBQ0EsQUFBQSw4RUFBNkU7QUFDN0UsQUFBQTtBQUNBLEFBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxHQUFHO0FBQ0gsQUFBQTtBQUNBLEFBQUEsQUFBQSxNQUFNLENBQVksTUFBWCxXQUFXLENBQUMsQ0FBRSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFBLENBQUE7QUFDakQsQUFBQTtBQUNBLEFBQUEsQ0FBQyxNQUFNLENBQUEsQUFBQyxRQUFRLENBQUMs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LEVBQUUsR0FBRyxDQUFBLEtBQUssQ0FBQSxDQUFBLENBQUE7QUFDVixBQUFBLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQSxBQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsSUFBSSxDQUFDLEM7RUFBQSxDQUFBO0FBQzFDLEFBQUEsRUFBRSxJQUFJLENBQUEsQ0FBQTtBQUNOLEFBQUEsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFBLEFBQUMsSUFBSSxDO0VBQUEsQztDQUFBLENBQUE7QUFDdkIsQUFBQSxDQUFDLE07QUFBTSxDQUFBO0FBQ1AsQUFBQTtBQUNBLEFBQUEsOEVBQTZFO0FBQzdFLEFBQUE7QUFDQSxBQUFBO0FBQ0E7QUFDQSxHQUFHO0FBQ0gsQUFBQTtBQUNBLEFBQUEsQUFBQSxNQUFNLENBQUMsSUFBQSxhQUFhLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFBLENBQUE7QUFDOUMsQUFBQTtBQUNBLEFBQUEsQ0FBZSxNQUFkLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBRSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUM7QUFDcEMsQUFBQSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLElBQUk7QUFDZixBQUFBLENBQUMsR0FBRyxDQUFDLENBQUEsTUFBQSxJQUFJLENBQUMsRUFBRSxDQUFDLE1BQU0sQ0FBQSxDQUFBLENBQUE7QUFDbkIsQUFBQSxFQUFFLEdBQUcsQyxFQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUM7QUFDbkIsQUFBQSxFQUFFLEdBQUcsQ0FBQSxDQUFJLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQSxDQUFBLENBQUE7QUFDbkIsQUFBQSxHQUFHLEtBQUssQ0FBQSxBQUFDLEdBQUcsQztFQUFBLEM7Q0FBQSxDQUFBO0FBQ1osQUFBQSxDQUFDLE07QUFBTSxDQUFBO0FBQ1AsQUFBQTtBQUNBLEFBQUEsOEVB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R0FBRyxJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxDLENBQUUsQ0FBQyxDQUFDLEM7RUFBQyxDQUFBO0FBQ3hCLEFBQUE7QUFDQSxBQUFBLEVBQUUsR0FBRyxDQUFBLFVBQVUsQ0FBQyxJLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQSxDQUFBLENBQUE7QUFDM0MsQUFBQSxHQUFHLEksQ0FBQyxHQUFHLENBQUEsQUFBQyxDQUFDLG1CQUFtQixFQUFFLElBQUksQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUMvQyxBQUFBLEdBQU8sTUFBSixJQUFJLENBQUMsQ0FBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQSxDQUFBO0FBQ2hCLEFBQUEsSUFBSSxHQUFHLENBQUEsSSxDQUFDLFFBQVEsQ0FBQSxDQUFBLENBQUE7QUFDaEIsQUFBQSxLQUFLLEksQ0FBQyxRQUFRLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsQztJQUFDLENBQUE7QUFDNUIsQUFBQSxJQUFJLEksQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFBLEFBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQTtBQUMvQixBQUFBLElBQUksSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsQyxDQUFFLENBQUMsS0FBSztBQUNsQyxBQUFBLElBQUksTUFBTSxDQUFDLEs7R0FBSyxDQUFBO0FBQ2hCLEFBQUEsR0FBRyxJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxDLENBQUUsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMsSSxDQUFDLEVBQUUsQztFQUFDLENBQUE7QUFDL0MsQUFBQSxFQUFFLEksQ0FBQyxHQUFHLENBQUEsQUFBQyxDQUFDLDJCQUEyQixFQUFFLElBQUksQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLENB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O0VBQUssQ0FBQTtBQUNSLEFBQUEsd0JBQXVCO0FBQ3ZCLEFBQUEsRUFBRSxHQUFHLENBQUMsQ0FBQSxNQUFBLElBQUksQ0FBQyxFQUFFLENBQUMsS0FBSyxDQUFBLENBQUEsQ0FBQTtBQUNuQixBQUFBLEdBQUcsNkNBQTRDO0FBQy9DLEFBQUEsR0FBRyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLEM7RUFBQyxDO0NBQUEsQztBQUFBLENBQUE7QUFDL0IsQUFBQTtBQUNBLEFBQUEsQUFBQSxNQUFNLENBQVcsTUFBVixVQUFVLENBQUMsQ0FBRSxDQUFDLFNBQVM7QUFDOUIiLCJuYW1lcyI6W10sInNvdXJjZXNDb250ZW50IjpbIiMgZnMuY2l2ZXRcblxuaW1wb3J0IHtzcHJpbnRmfSBmcm9tIFwiaHR0cHM6Ly9kZW5vLmxhbmQvc3RkL2ZtdC9wcmludGYudHNcIlxuaW1wb3J0IHtkZWJvdW5jZX0gZnJvbSAnQHN0ZC9hc3luYy9kZWJvdW5jZSdcblxuaW1wb3J0IHtcblx0ZXhpc3RzU3luYywgZW1wdHlEaXJTeW5jLCBlbnN1cmVEaXJTeW5jLFxuXHR9IGZyb20gJ2pzcjpAc3RkL2ZzJ1xuaW1wb3J0IHtcblx0YXBwZW5kRmlsZVN5bmMsXG5cdH0gZnJvbSAnbm9kZTpmcydcbmltcG9ydCB7RXZlbnRFbWl0dGVyfSBmcm9tICdub2RlOmV2ZW50cydcblxuIyAtLS0gRGVubydzIHN0YXRTeW5jIGFuZCBsc3RhdFN5bmMgYXJlIHN0aWxsIHVuc3RhYmxlLFxuIyAgICAgc28gdXNlIHRoaXNcbmltcG9ydCB7c3RhdFN5bmN9IGZyb20gJ25vZGU6ZnMnXG5cbmltcG9ydCBwYXRoTGliIGZyb20gJ25vZGU6cGF0aCdcbmltcG9ydCB1cmxMaWIgZnJvbSAnbm9kZTp1cmwnXG5pbXBvcnQge2V4cGFuZEdsb2JTeW5jfSBmcm9tICdqc3I6QHN0ZC9mcy9leHBhbmQtZ2xvYidcbmltcG9ydCB7VGV4dExpbmVTdHJlYW19IGZyb20gJ2pzcjpAc3RkL3N0cmVhbXMnXG5cbmltcG9ydCB7XG5cdHVuZGVmLCBkZWZpbmVkLCBub3RkZWZpbmVkLFxuXHRpc1N0cmluZywgaXNOb25FbXB0eVN0cmluZywgaXNCb29sZWFuLCBpc051bWJlciwgaXNJbnRlZ2VyLFxuXHRpc0FycmF5LCBpc0FycmF5T2ZTdHJpbmdzLCBpc0hhc2gsIGlzT2JqZWN0LCBpc1JlZ0V4cCxcblx0aW50ZWdlciwgaGFzaCwgdm9pZEZ1bmMsIG9wdGlvbnNwZWMsXG5cdH0gZnJvbSAnLi9kYXRhdHlwZXMudHMnXG5pbXBvcnQge1xuXHRhc3NlcnQsIGNyb2FrLCBPTCwgZ2V0T3B0aW9ucywgcmVtb3ZlRW1wdHlLZXlzLCBwYXNzLFxuXHRzcGFjZXMsIHNpbmNlTG9hZFN0ciwgc2xlZXAsXG5cdH0gZnJvbSAnLi9sbHV0aWxzLnRzJ1xuXG5EZW5vIDo9IGdsb2JhbFRoaXMuRGVub1xuZXhwb3J0IHR5cGUgcGF0aFR5cGUgPVxuXHQnbWlzc2luZycgfCAnZmlsZScgfCAnZGlyJyB8ICdzeW1saW5rJyB8ICd1bmtub3duJ1xuXG4jIC0tLSBub3QgZXhwb3J0ZWRcbmRlY29kZXIgOj0gbmV3IFRleHREZWNvZGVyKCd1dGYtOCcpXG5lbmNvZGVyIDo9IG5ldyBUZXh0RW5jb2RlcigpXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogcmV0dXJucyBhIGJvb2xlYW4gaW5kaWNhdGluZyBpZiB0aGUgZ2l2ZW4gcGF0aCBleGlzdHNcbiAqIGFuZCBpcyBhIGZpbGVcbiAqL1xuXG5leHBvcnQgaXNGaWxlIDo9IChwYXRoOiBzdHJpbmcpOiBib29sZWFuID0+XG5cblx0cmV0dXJuIGV4aXN0c1N5bmMocGF0aCkgJiYgc3RhdFN5bmMocGF0aCkuaXNGaWxlKClcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuLyoqXG4gKiByZXR1cm5zIGEgYm9vbGVhbiBpbmRpY2F0aW5nIG9mIHRoZSBnaXZlbiBwYXRoIGV4aXN0c1xuICogYW5kIGlzIGEgZGlyZWN0b3J5XG4gKi9cblxuZXhwb3J0IGlzRGlyIDo9IChwYXRoOiBzdHJpbmcpOiBib29sZWFuID0+XG5cblx0cmV0dXJuIGV4aXN0c1N5bmMocGF0aCkgJiYgc3RhdFN5bmMocGF0aCkuaXNEaXJlY3RvcnkoKVxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKipcbiAqIHJldHVybnMgb25lIG9mOlxuICogICAgJ21pc3NpbmcnICAtIGRvZXMgbm90IGV4aXN0XG4gKiAgICAnZGlyJyAgICAgIC0gaXMgYSBkaXJlY3RvcnlcbiAqICAgICdmaWxlJyAgICAgLSBpcyBhIGZpbGVcbiAqICAgICdzeW1saW5rJyAgLSBpcyBhIHN5bWxpbmtcbiAqICAgICd1bmtub3duJyAgLSBleGlzdHMsIGJ1dCBub3QgYSBmaWxlLCBkaXJlY3Rvcnkgb3Igc3ltbGlua1xuICovXG5cbmV4cG9ydCBnZXRQYXRoVHlwZSA6PSAocGF0aDogc3RyaW5nKTogcGF0aFR5cGUgPT5cblxuXHRhc3NlcnQgaXNTdHJpbmcocGF0aCksIFwibm90IGEgc3RyaW5nOiAje09MKHBhdGgpfVwiXG5cdGlmIG5vdCBleGlzdHNTeW5jIHBhdGhcblx0XHRyZXR1cm4gJ21pc3NpbmcnXG5cdGggOj0gc3RhdFN5bmMocGF0aClcblx0cmV0dXJuIChcblx0XHQgIGguaXNGaWxlKCkgICAgICAgICA/ICdmaWxlJ1xuXHRcdDogaC5pc0RpcmVjdG9yeSgpICAgID8gJ2Rpcidcblx0XHQ6IGguaXNTeW1ib2xpY0xpbmsoKSA/ICdzeW1saW5rJ1xuXHRcdDogICAgICAgICAgICAgICAgICAgICAgJ3Vua25vd24nXG5cdFx0KVxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKipcbiAqIGV4dHJhY3QgdGhlIGZpbGUgZXh0ZW5zaW9uIGZyb20gYSBwYXRoLCBpbmNsdWRpbmdcbiAqIHRoZSBsZWFkaW5nIHBlcmlvZFxuICovXG5cbmV4cG9ydCBmaWxlRXh0IDo9IChwYXRoOiBzdHJpbmcpOiBzdHJpbmcgPT5cblxuXHRpZiBsTWF0Y2hlcyA6PSBwYXRoLm1hdGNoKC9cXC5bXlxcLl0rJC8pXG5cdFx0cmV0dXJuIGxNYXRjaGVzWzBdXG5cdGVsc2Vcblx0XHRyZXR1cm4gJydcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuLyoqXG4gKiByZXR1cm4gdGhlIGdpdmVuIHBhdGgsIGJ1dCB3aXRoIHRoZSBnaXZlbiBmaWxlIGV4dGVuc2lvblxuICogcmVwbGFjaW5nIHRoZSBleGlzdGluZyBmaWxlIGV4dGVuc2lvblxuICovXG5cbmV4cG9ydCB3aXRoRXh0IDo9IChwYXRoOiBzdHJpbmcsIGV4dDogc3RyaW5nKTogc3RyaW5nID0+XG5cblx0YXNzZXJ0IGV4dC5zdGFydHNXaXRoKCcuJyksIFwiQmFkIGZpbGUgZXh0ZW5zaW9uOiAje2V4dH1cIlxuXHRsTWF0Y2hlcyA6PSBwYXRoLm1hdGNoKC9eKC4qKShcXC5bXlxcLl0rKSQvKVxuXHRpZiAobE1hdGNoZXMgPT0gbnVsbClcblx0XHR0aHJvdyBuZXcgRXJyb3IoXCJCYWQgcGF0aDogJyN7cGF0aH0nXCIpXG5cdFtfLCBoZWFkU3RyLCBvcmdFeHRdIDo9IGxNYXRjaGVzXG5cdHJldHVybiBcIiN7aGVhZFN0cn0je2V4dH1cIlxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG5leHBvcnQgbFN0YXRGaWVsZHM6IHN0cmluZ1tdIDo9IFtcblx0J2RldicsJ2lubycsJ21vZGUnLCdubGluaycsJ3VpZCcsJ2dpZCcsJ3JkZXYnLFxuXHQnc2l6ZScsJ2Jsa3NpemUnLCdibG9ja3MnLFxuXHQnYXRpbWVNcycsJ210aW1lTXMnLCdjdGltZU1zJywnYmlydGh0aW1lTXMnLFxuXHQnYXRpbWUnLCdtdGltZScsJ2N0aW1lJywnYmlydGh0aW1lJyxcblx0XVxuXG4vKipcbiAqIHJldHVybiBzdGF0aXN0aWNzIGZvciBhIGZpbGUgb3IgZGlyZWN0b3J5XG4gKi9cblxuZXhwb3J0IGdldFN0YXRzIDo9IChwYXRoOiBzdHJpbmcpOiBoYXNoID0+XG5cblx0cmV0dXJuIHN0YXRTeW5jKHBhdGgpXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cblxuLyoqXG4gKiBwYXJzZXMgYSBwYXRoIG9yIGZpbGUgVVJMLCBhbmQgcmV0dXJucyBhIGhhc2ggd2l0aCBrZXlzOlxuICogXHR0eXBlOiBwYXRoVHlwZSAtICdmaWxlJywnZGlyJywnc3ltbGluaycsJ21pc3NpbmcnIG9yICd1bmtub3duJ1xuICogXHRwYXRoOiBzdHJpbmdcbiAqIFx0cm9vdDogc3RyaW5nXG4gKiBcdGRpcjogc3RyaW5nXG4gKiBcdGZpbGVOYW1lOiBzdHJpbmdcbiAqIFx0c3R1Yjogc3RyaW5nP1xuICogXHRwdXJwb3NlOiBzdHJpbmc/XG4gKiBcdGV4dDogc3RyaW5nP1xuICogXHRyZWxQYXRoOiBzdHJpbmdcbiAqIFx0cmVsRGlyOiBzdHJpbmdcbiAqL1xuXG5leHBvcnQgdHlwZSBwYXRoSW5mbyA9IHtcblx0dHlwZTogcGF0aFR5cGUgICMgJ2ZpbGUnLCdkaXInLCdzeW1saW5rJywnbWlzc2luZycgb3IgJ3Vua25vd24nXG5cdHBhdGg6IHN0cmluZ1xuXHRyb290OiBzdHJpbmdcblx0ZGlyOiBzdHJpbmdcblx0ZmlsZU5hbWU6IHN0cmluZ1xuXHRzdHViOiBzdHJpbmc/XG5cdHB1cnBvc2U6IHN0cmluZz9cblx0ZXh0OiBzdHJpbmc/XG5cdHJlbFBhdGg6IHN0cmluZ1xuXHRyZWxEaXI6IHN0cmluZ1xuXHR9XG5cbmV4cG9ydCBwYXJzZVBhdGggOj0gKHBhdGg6IHN0cmluZyk6IHBhdGhJbmZvID0+XG5cblx0IyAtLS0gTk9URTogcGF0aCBtYXkgYmUgYSBmaWxlIFVSTCwgZS5nLiBpbXBvcnQubWV0YS51cmxcblx0IyAgICAgICAgICAgcGF0aCBtYXkgYmUgYSByZWxhdGl2ZSBwYXRoXG5cblx0YXNzZXJ0IGlzTm9uRW1wdHlTdHJpbmcocGF0aCksIFwicGF0aCBub3QgYSBzdHJpbmcgI3tPTChwYXRoKX1cIlxuXHRpZiBkZWZpbmVkKHBhdGgubWF0Y2goL15maWxlXFw6XFwvXFwvLykpXG5cdFx0cGF0aCA9IHVybExpYi5maWxlVVJMVG9QYXRoKHBhdGgpXG5cdHBhdGggPSBub3JtYWxpemVQYXRoIHBhdGhcblxuXHR7cm9vdCwgZGlyLCBiYXNlOiBmaWxlTmFtZX0gOj0gcGF0aExpYi5wYXJzZShwYXRoKVxuXG5cdGxQYXJ0cyA6PSBmaWxlTmFtZS5zcGxpdCgnLicpXG5cdFtzdHViLCBwdXJwb3NlLCBleHRdIDo9IHN3aXRjaCBsUGFydHMubGVuZ3RoXG5cdFx0d2hlbiAwXG5cdFx0XHRjcm9hayBcIkNhbid0IGhhcHBlblwiXG5cdFx0d2hlbiAxXG5cdFx0XHRbZmlsZU5hbWUsIHVuZGVmLCB1bmRlZl1cblx0XHR3aGVuIDJcblx0XHRcdFtsUGFydHNbMF0sIHVuZGVmLCBcIi4je2xQYXJ0c1sxXX1cIl1cblx0XHRlbHNlXG5cdFx0XHRbXG5cdFx0XHRcdGxQYXJ0cy5zbGljZSgwLCAtMikuam9pbignLicpLFxuXHRcdFx0XHRsUGFydHMuYXQoLTIpLFxuXHRcdFx0XHRcIi4je2xQYXJ0cy5hdCgtMSl9XCJcblx0XHRcdFx0XVxuXG5cdCMgLS0tIEdyYWIgZXZlcnl0aGluZyB1cCB1bnRpbCB0aGUgbGFzdCBwYXRoIHNlcGFyYXRvciwgaWYgYW55XG5cdHJlbFBhdGggOj0gcmVscGF0aCBwYXRoXG5cdGxQYXRoTWF0Y2hlcyA6PSByZWxQYXRoLm1hdGNoKC9eKC4qKVtcXFxcXFwvXVteXFxcXFxcL10qJC8pXG5cdHJlbERpciA6PSAobFBhdGhNYXRjaGVzID09IG51bGwpID8gJy4nIDogbFBhdGhNYXRjaGVzWzFdXG5cblx0cmV0dXJuIHtcblx0XHR0eXBlOiBnZXRQYXRoVHlwZShwYXRoKVxuXHRcdHBhdGhcblx0XHRyb290XG5cdFx0ZGlyXG5cdFx0ZmlsZU5hbWVcblx0XHRzdHViXG5cdFx0cHVycG9zZVxuXHRcdGV4dFxuXHRcdHJlbFBhdGhcblx0XHRyZWxEaXJcblx0XHR9XG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogZ2VuZXJhdGUgZmlsZXMgdGhhdCBtYXRjaCBhIGdpdmVuIGdsb2IgcGF0dGVyblxuICogeWllbGRzIHtwYXRoLCBuYW1lLCBpc0ZpbGUsIGlzRGlyZWN0b3J5LCBpc1N5bWxpbmt9XG4gKiAgICB3aXRoIHBhcnNlIG9wdGlvbiwgYWxzbyBpbmNsdWRlcyBrZXlzOlxuICogICAgICAgcmVsUGF0aFxuICogVGhlc2Ugb3B0aW9ucyBtYXkgYmUgc3BlY2lmaWVkIGluIHRoZSAybmQgcGFyYW1ldGVyOlxuICogICAgcm9vdDogc3RyaW5nIC0gcm9vdCBvZiBzZWFyY2gsIChkZWY6IERlbm8uY3dkKCkpXG4gKiAgICBsRXhjbHVkZTogW3N0cmluZ10gLSBwYXR0ZXJucyB0byBleGNsdWRlLFxuICogICAgXHRkZWY6IFsnbm9kZV9tb2R1bGVzLyoqJywgJy5naXQvKionXVxuICogICAgaW5jbHVkZURpcnM6IGJvb2xlYW4gLSBzaG91bGQgZGlyZWN0b3JpZXMgYmUgaW5jbHVkZWQ/IChkZWY6IHRydWUpXG4gKiBcdGZvbGxvd1N5bWxpbmtzIC0gYm9vbGVhbiAtIHNob3VsZCBzeW0gbGlua3MgYmUgZm9sbG93ZWQ/IChkZWY6IGZhbHNlKVxuICogXHRjYW5vbmljYWxpemU6IGJvb2xlYW4gLSBpZiBmb2xsb3dzeW1saW5rcyBpcyB0cnVlLCBzaG91bGRcbiAqIFx0XHRwYXRocyBiZSBjYW5vbmljYWxpemVkPyAoZGVmOiB0cnVlKVxuICogXHRmaWx0ZXI6IChzdHJpbmctPmJvb2xlYW4pIC0geWllbGQgb25seSBpZiBmdW5jdGlvbiByZXR1cm5zIHRydWVcbiAqL1xuXG5leHBvcnQgYWxsRmlsZXNNYXRjaGluZyA6PSAoXG5cdHBhdHRlcm46IHN0cmluZz0nKionLFxuXHRoT3B0aW9uczogb3B0aW9uc3BlYz17fVxuXHQpOiBHZW5lcmF0b3I8aGFzaCwgdm9pZCwgdW5rbm93bj4gLT5cblxuXHR7XG5cdFx0cm9vdFxuXHRcdGxFeGNsdWRlXG5cdFx0aW5jbHVkZURpcnNcblx0XHRmb2xsb3dTeW1saW5rc1xuXHRcdGNhbm9uaWNhbGl6ZVxuXHRcdGZpbHRlclxuXHRcdGRlYnVnXG5cdFx0fSA6PSBnZXRPcHRpb25zIGhPcHRpb25zLCB7XG5cdFx0XHRyb290OiB1bmRlZlxuXHRcdFx0bEV4Y2x1ZGU6IFsnbm9kZV9tb2R1bGVzLyoqJywgJy5naXQvKionXVxuXHRcdFx0aW5jbHVkZURpcnM6IGZhbHNlXG5cdFx0XHRmb2xsb3dTeW1saW5rczogZmFsc2Vcblx0XHRcdGNhbm9uaWNhbGl6ZTogZmFsc2Vcblx0XHRcdGZpbHRlcjogdW5kZWZcblx0XHRcdGRlYnVnOiBmYWxzZVxuXHRcdFx0fVxuXG5cdGhHbG9iT3B0aW9ucyA6PSB7XG5cdFx0cm9vdFxuXHRcdGV4Y2x1ZGU6IGxFeGNsdWRlXG5cdFx0aW5jbHVkZURpcnNcblx0XHRmb2xsb3dTeW1saW5rc1xuXHRcdGNhbm9uaWNhbGl6ZVxuXHRcdH1cblxuXHREQkcgOj0gKG1zZzogc3RyaW5nKTogdm9pZCA9PlxuXHRcdGlmIGRlYnVnXG5cdFx0XHRjb25zb2xlLmxvZyBtc2dcblx0XHRyZXR1cm5cblxuXHRmb3IgaCBvZiBleHBhbmRHbG9iU3luYyhwYXR0ZXJuLCBoR2xvYk9wdGlvbnMpXG5cdFx0IyAtLS0gaCBoYXMga2V5czogcGF0aCwgbmFtZSwgaXNGaWxlLCBpc0RpcmVjdG9yeSwgaXNTeW1MaW5rXG5cblx0XHREQkcgXCJNQVRDSDogI3toLnBhdGh9XCJcblx0XHR0eXBlIDo9IChcblx0XHRcdCAgaC5pc0ZpbGUgICAgICA/ICdmaWxlJ1xuXHRcdFx0OiBoLmlzRGlyZWN0b3J5ID8gJ2Rpcidcblx0XHRcdDogaC5pc1N5bWxpbmsgICA/ICdzeW1saW5rJ1xuXHRcdFx0OiAgICAgICAgICAgICAgICAgJ3Vua25vd24nXG5cdFx0XHQpXG5cdFx0aEZpbGUgOj0gcGFyc2VQYXRoKGgucGF0aClcblx0XHRpZiBub3RkZWZpbmVkKGZpbHRlcilcblx0XHRcdERCRyBcIiAgIC0gbm8gZmlsdGVyXCJcblx0XHRcdHlpZWxkIGhGaWxlXG5cdFx0ZWxzZSBpZiBmaWx0ZXIoaEZpbGUpXG5cdFx0XHREQkcgXCIgICAtIGFsbG93ZWQgYnkgZmlsdGVyXCJcblx0XHRcdHlpZWxkIGhGaWxlXG5cdFx0ZWxzZVxuXHRcdFx0REJHIFwiICAgLSBleGNsdWRlZCBieSBmaWx0ZXJcIlxuXHRyZXR1cm5cblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiMgQVNZTkMgSVRFUkFCTEVcblxuLyoqXG4gKiBBbiBhc3luYyBpdGVyYWJsZSAtIHlpZWxkcyBldmVyeSBsaW5lIGluIHRoZSBnaXZlbiBmaWxlXG4gKlxuICogVXNhZ2U6XG4gKiAgIGZvciBhd2FpdCBsaW5lIG9mIGFsbExpbmVzSW4oJ3NyYy9saWIvdGVtcC5jaXZldCcpXG4gKiBcdCAgY29uc29sZS5sb2cgXCJMSU5FOiAje2xpbmV9XCJcbiAqICAgY29uc29sZS5sb2cgXCJET05FXCJcbiAqL1xuXG5leHBvcnQgYWxsTGluZXNJbiA6PSAoXG5cdHBhdGg6IHN0cmluZ1xuXHQpOiBBc3luY0dlbmVyYXRvcjxzdHJpbmcsIHZvaWQsIHVua25vd24+IC0+XG5cblx0YXNzZXJ0IGlzRmlsZShwYXRoKSwgXCJObyBzdWNoIGZpbGU6ICN7T0wocGF0aCl9IChhbGxMaW5lc0luKVwiXG5cdGYgOj0gYXdhaXQgRGVuby5vcGVuKHBhdGgpXG5cdHJlYWRhYmxlIDo9IGYucmVhZGFibGVcblx0XHQucGlwZVRocm91Z2gobmV3IFRleHREZWNvZGVyU3RyZWFtKCkpXG5cdFx0LnBpcGVUaHJvdWdoKG5ldyBUZXh0TGluZVN0cmVhbSgpKVxuXG5cdGZvciBhd2FpdCBsaW5lIG9mIHJlYWRhYmxlXG5cdFx0eWllbGQgbGluZVxuXHRyZXR1cm5cblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuLyoqXG4gKiBjb252ZXJ0cyBhbGwgYmFja3NsYXNoIGNoYXJhY3RlcnMgdG8gZm9yd2FyZCBzbGFzaGVzXG4gKiB1cHBlci1jYXNlcyBkcml2ZSBsZXR0ZXJzXG4gKi9cblxuZXhwb3J0IG5vcm1hbGl6ZVBhdGggOj0gKHBhdGg6IHN0cmluZyk6IHN0cmluZyA9PlxuXG5cdG5wYXRoIDo9IHBhdGgucmVwbGFjZUFsbCgnXFxcXCcsICcvJylcblx0aWYgKG5wYXRoLmNoYXJBdCgxKSA9PSAnOicpXG5cdFx0cmV0dXJuIG5wYXRoLmNoYXJBdCgwKS50b1VwcGVyQ2FzZSgpICsgbnBhdGguc3Vic3RyaW5nKDEpXG5cdGVsc2Vcblx0XHRyZXR1cm4gbnBhdGhcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuLyoqXG4gKiByZXNvbHZlcyBtdWx0aXBsZSBwYXRoIHBhcnRzIHRvIGEgc2luZ2xlIHBhdGhcbiAqIHJldHVybnMgbm9ybWFsaXplZCBwYXRoXG4gKi9cblxuZXhwb3J0IG1rcGF0aCA6PSAobFBhcnRzLi4uOiBzdHJpbmdbXSk6IHN0cmluZyA9PlxuXG5cdHBhdGggOj0gcGF0aExpYi5yZXNvbHZlKGxQYXJ0cy4uLilcblx0cmV0dXJuIG5vcm1hbGl6ZVBhdGgocGF0aClcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuLyoqXG4gKiByZXNvbHZlcyBtdWx0aXBsZSBwYXRoIHBhcnRzIHRvIGEgc2luZ2xlIHBhdGhcbiAqIHJldHVybnMgbm9ybWFsaXplZCBwYXRoLCByZWxhdGl2ZSB0byBjdXJyZW50IGRpcmVjdG9yeVxuICovXG5cbmV4cG9ydCByZWxwYXRoIDo9IChsUGFydHMuLi46IHN0cmluZ1tdKTogc3RyaW5nID0+XG5cblx0YXNzZXJ0IGlzQXJyYXlPZlN0cmluZ3MobFBhcnRzKSwgXCJCYWQgbFBhcnRzOiAje09MKGxQYXJ0cyl9XCJcblx0ZnVsbFBhdGggOj0gcGF0aExpYi5yZXNvbHZlIGxQYXJ0cy4uLlxuXHRyZXR1cm4gbm9ybWFsaXplUGF0aCBwYXRoTGliLnJlbGF0aXZlKCcnLCBmdWxsUGF0aClcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuZXhwb3J0IHR5cGUgcGF0aERlc2MgPSB7XG5cdGRpcjogc3RyaW5nXG5cdHJvb3Q6IHN0cmluZ1xuXHRsUGFydHM6IHN0cmluZ1tdXG5cdH1cblxuLyoqXG4gKiByZXR1cm5zIHtkaXIsIHJvb3QsIGxQYXJ0c30gd2hlcmUgbFBhcnRzIGluY2x1ZGVzIHRoZSBuYW1lcyBvZlxuICogYWxsIGRpcmVjdG9yaWVzIGJldHdlZW4gdGhlIHJvb3QgYW5kIHRoZSBmaWxlIG5hbWVcbiAqIHJlbGF0aXZlIHRvIHRoZSBjdXJyZW50IHdvcmtpbmcgZGlyZWN0b3J5XG4gKi9cblxuZXhwb3J0IHBhdGhTdWJEaXJzID0gKHBhdGg6IHN0cmluZywgaE9wdGlvbnM6IG9wdGlvbnNwZWM9e30pOiBwYXRoRGVzYyA9PlxuXG5cdHtyZWxhdGl2ZX0gOj0gZ2V0T3B0aW9ucyBoT3B0aW9ucywge1xuXHRcdHJlbGF0aXZlOiBmYWxzZVxuXHRcdH1cblx0cGF0aCA9IHJlbGF0aXZlID8gcmVscGF0aChwYXRoKSA6IG1rcGF0aChwYXRoKVxuXHR7cm9vdCwgZGlyfSA6PSBwYXRoTGliLnBhcnNlKHBhdGgpXG5cdHJldHVybiB7XG5cdFx0ZGlyXG5cdFx0cm9vdFxuXHRcdGxQYXJ0czogZGlyLnNsaWNlKHJvb3QubGVuZ3RoKS5zcGxpdCgvW1xcXFxcXC9dLylcblx0XHR9XG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4jIC0tLSBTaG91bGQgYmUgY2FsbGVkIGxpa2U6IG15c2VsZihpbXBvcnQubWV0YS51cmwpXG4jICAgICByZXR1cm5zIGZ1bGwgcGF0aCBvZiBjdXJyZW50IGZpbGVcblxuZXhwb3J0IG15c2VsZiA6PSAodXJsOiBzdHJpbmcpOiBzdHJpbmcgPT5cblxuXHRyZXR1cm4gcmVscGF0aCB1cmxMaWIuZmlsZVVSTFRvUGF0aCh1cmwpXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuLyoqXG4gKiByZWFkIGEgZmlsZSBpbnRvIGEgc3RyaW5nXG4gKi9cblxuZXhwb3J0IHNsdXJwIDo9IChwYXRoOiBzdHJpbmcpOiBzdHJpbmcgPT5cblxuXHRhc3NlcnQgaXNGaWxlKHBhdGgpLCBcIk5vIHN1Y2ggZmlsZTogI3twYXRofSAoc2x1cnApXCJcblx0ZGF0YSA6PSBEZW5vLnJlYWRGaWxlU3luYyBwYXRoXG5cdHJldHVybiBkZWNvZGVyLmRlY29kZShkYXRhKS5yZXBsYWNlQWxsKCdcXHInLCAnJylcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuLyoqXG4gKiB3cml0ZSBhIHN0cmluZyB0byBhIGZpbGVcbiAqIHdpbGwgZW5zdXJlIHRoYXQgYWxsIG5lY2Vzc2FyeSBkaXJlY3RvcmllcyBleGlzdFxuICovXG5cbmV4cG9ydCBiYXJmIDo9IChcblx0Y29udGVudHM6IHN0cmluZyxcblx0cGF0aDogc3RyaW5nLFxuXHRoT3B0aW9uczogb3B0aW9uc3BlYz17fVxuXHQpOiB2b2lkID0+XG5cblx0e2FwcGVuZH0gOj0gZ2V0T3B0aW9ucyBoT3B0aW9ucywge1xuXHRcdGFwcGVuZDogZmFsc2Vcblx0XHR9XG5cdG1rRGlyc0ZvckZpbGUocGF0aClcblx0ZGF0YSA6PSBlbmNvZGVyLmVuY29kZShjb250ZW50cylcblx0aWYgYXBwZW5kICYmIGlzRmlsZShwYXRoKVxuXHRcdGFwcGVuZEZpbGVTeW5jIHBhdGgsIGRhdGFcblx0ZWxzZVxuXHRcdERlbm8ud3JpdGVGaWxlU3luYyBwYXRoLCBkYXRhXG5cdHJldHVyblxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG5leHBvcnQgbmV3ZXJEZXN0RmlsZUV4aXN0cyA6PSAoXG5cdHNyY1BhdGg6IHN0cmluZyxcblx0ZGVzdFBhdGg6IHN0cmluZ1xuXHQpOiBib29sZWFuID0+XG5cblx0YXNzZXJ0IGlzRmlsZShzcmNQYXRoKSwgXCJObyBzdWNoIGZpbGU6ICN7T0woc3JjUGF0aCl9IChuZXdlckRlc3RGaWxlRXhpc3RzKVwiXG5cdGlmIG5vdCBleGlzdHNTeW5jKGRlc3RQYXRoKVxuXHRcdHJldHVybiBmYWxzZVxuXHRzcmNNb2RUaW1lIDo9IHN0YXRTeW5jKHNyY1BhdGgpLm10aW1lTXNcblx0ZGVzdE1vZFRpbWUgOj0gc3RhdFN5bmMoZGVzdFBhdGgpLm10aW1lTXNcblx0cmV0dXJuIChkZXN0TW9kVGltZSA+IHNyY01vZFRpbWUpXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogY3JlYXRlIGEgbmV3IGRpcmVjdG9yeSBpZiBpdCBkb2Vzbid0IGV4aXN0XG4gKiBpZiB0aGUgb3B0aW9uICdjbGVhcicgaXMgc2V0IHRvIGEgdHJ1ZSB2YWx1ZSBpbiB0aGUgMm5kIHBhcmFtZXRlclxuICogYW5kIHRoZSBkaXJlY3RvcnkgYWxyZWFkeSBleGlzdHMsIGl0IGlzIGNsZWFyZWRcbiAqL1xuXG5leHBvcnQgbWtEaXIgPSAoZGlyUGF0aDogc3RyaW5nLCBjbGVhcjogYm9vbGVhbj1mYWxzZSk6IHZvaWQgPT5cblxuXHRpZiBjbGVhclxuXHRcdGVtcHR5RGlyU3luYyBkaXJQYXRoICAgICMgLS0tIGNyZWF0ZXMgaWYgaXQgZG9lc24ndCBleGlzdFxuXHRlbHNlXG5cdFx0ZW5zdXJlRGlyU3luYyBkaXJQYXRoXG5cdHJldHVyblxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKipcbiAqIHJlbW92ZSBhIGZpbGUgZnJvbSB0aGUgZmlsZSBzeXN0ZW0sIGJ1dCBkbyBub3RoaW5nXG4gKiBpZiB0aGUgZmlsZSBkb2VzIG5vdCBleGlzdFxuICovXG5cbmV4cG9ydCBybUZpbGUgOj0gKHBhdGg6IHN0cmluZyk6IHZvaWQgPT5cblxuXHRpZiBleGlzdHNTeW5jIHBhdGhcblx0XHREZW5vLnJlbW92ZVN5bmMgcGF0aFxuXHRyZXR1cm5cblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuLyoqXG4gKiByZW1vdmUgYSBkaXJlY3RvcnkgZnJvbSB0aGUgZmlsZSBzeXN0ZW0sIGJ1dCBkbyBub3RoaW5nXG4gKiBpZiB0aGUgZGlyZWN0b3J5IGRvZXMgbm90IGV4aXN0XG4gKiBOT1RFOiBZb3UgbXVzdCBwYXNzIHRoZSAnY2xlYXInIG9wdGlvbiBpZiB0aGUgZGlyZWN0b3J5XG4gKiAgICAgICBpcyBub3QgZW1wdHlcbiAqL1xuXG5leHBvcnQgcm1EaXIgOj0gKHBhdGg6IHN0cmluZywgaE9wdGlvbnM6IG9wdGlvbnNwZWM9e30pOiB2b2lkID0+XG5cblx0e2NsZWFyfSA6PSBnZXRPcHRpb25zIGhPcHRpb25zLCB7XG5cdFx0Y2xlYXI6IGZhbHNlXG5cdFx0fVxuXHRpZiBleGlzdHNTeW5jIHBhdGhcblx0XHRpZiBjbGVhclxuXHRcdFx0RGVuby5yZW1vdmVTeW5jIHBhdGgsIHtyZWN1cnNpdmU6IHRydWV9XG5cdFx0ZWxzZVxuXHRcdFx0RGVuby5yZW1vdmVTeW5jIHBhdGhcblx0cmV0dXJuXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogY3JlYXRlIGFueSBtaXNzaW5nIGRpcmVjdG9yaWVzIGluIHRoZSBnaXZlbiBwYXRoXG4gKi9cblxuZXhwb3J0IG1rRGlyc0ZvckZpbGUgPSAocGF0aDogc3RyaW5nKTogdm9pZCA9PlxuXG5cdHtyb290LCBsUGFydHN9IDo9IHBhdGhTdWJEaXJzKHBhdGgpXG5cdGxldCBkaXIgPSByb290XG5cdGZvciBwYXJ0IG9mIGxQYXJ0c1xuXHRcdGRpciArPSBcIi8je3BhcnR9XCJcblx0XHRpZiBub3QgaXNEaXIoZGlyKVxuXHRcdFx0bWtEaXIgZGlyXG5cdHJldHVyblxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKipcbiAqIGRlbGV0ZXMgYWxsIGZpbGVzIGFuZCBzdWJkaXJlY3RvcmllcyBpbiB0aGUgZ2l2ZW4gZGlyZWN0b3J5XG4gKi9cblxuZXhwb3J0IGNsZWFyRGlyID0gKGRpclBhdGg6IHN0cmluZyk6IHZvaWQgPT5cblxuXHRlbXB0eURpclN5bmMgZGlyUGF0aFxuXHRyZXR1cm5cblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiMgLS0tIGhPcHRpb25zIGdldHMgcGFzc2VkIHRvIGFsbEZpbGVzTWF0Y2hpbmcoKVxuXG5leHBvcnQgcmVtb3ZlRmlsZXNNYXRjaGluZyA6PSAoXG5cdHBhdHRlcm46IHN0cmluZyxcblx0aE9wdGlvbnM6IG9wdGlvbnNwZWM9e31cblx0KTogdm9pZCA9PlxuXG5cdGFzc2VydCAocGF0dGVybiAhPSAnKicpICYmIChwYXR0ZXJuICE9ICcqKicpLFxuXHRcdFwiQ2FuJ3QgZGVsZXRlIGZpbGVzIG1hdGNoaW5nICN7T0wocGF0dGVybil9XCJcblx0Zm9yIHtyZWxQYXRofSBvZiBhbGxGaWxlc01hdGNoaW5nKHBhdHRlcm4sIGhPcHRpb25zKVxuXHRcdERlbm8ucmVtb3ZlU3luYyByZWxQYXRoXG5cdHJldHVyblxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG5leHBvcnQgcmVtb3ZlRmlsZXNFeGNlcHQgOj0gKFxuXHRwYXR0ZXJuOiBzdHJpbmcsXG5cdGxLZWVwOiBzdHJpbmdbXSxcblx0aE9wdGlvbnM6IG9wdGlvbnNwZWMgPSB7fVxuXHQpOiB2b2lkID0+XG5cblx0e2RlYnVnfSA6PSBnZXRPcHRpb25zIGhPcHRpb25zLCB7XG5cdFx0ZGVidWc6IGZhbHNlXG5cdFx0fVxuXHREQkcgOj0gKG1zZzogc3RyaW5nKTogdm9pZCA9PlxuXHRcdGlmIGRlYnVnXG5cdFx0XHRjb25zb2xlLmxvZyBtc2dcblx0XHRyZXR1cm5cblxuXHQjIC0tLSB0cnVlIHJldHVybiBtZWFucyByZW1vdmUgaXRcblx0ZmlsdGVyIDo9IChoRmlsZTogcGF0aEluZm8pOiBib29sZWFuID0+XG5cdFx0e3R5cGUsIHJlbFBhdGh9IDo9IGhGaWxlXG5cdFx0aWYgKHR5cGUgIT0gJ2ZpbGUnKVxuXHRcdFx0cmV0dXJuIGZhbHNlXG5cdFx0cmV0dXJuIG5vdCBsS2VlcC5pbmNsdWRlcyhyZWxQYXRoKVxuXG5cdGg6IG9wdGlvbnNwZWMgOj0ge2ZpbHRlciwgZGVidWd9XG5cdGZvciB7cmVsUGF0aH0gb2YgYWxsRmlsZXNNYXRjaGluZyhwYXR0ZXJuLCBoKVxuXHRcdERCRyBcIlJFTU9WRSBGSUxFICN7cmVsUGF0aH1cIlxuXHRcdERlbm8ucmVtb3ZlU3luYyByZWxQYXRoXG5cdHJldHVyblxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG5leHBvcnQgcmVtb3ZlRGlyc0V4Y2VwdCA6PSAoXG5cdHBhdHRlcm46IHN0cmluZyxcblx0bEtlZXA6IHN0cmluZ1tdLFxuXHRoT3B0aW9uczogb3B0aW9uc3BlYyA9IHt9XG5cdCk6IHZvaWQgPT5cblxuXHR7ZGVidWd9IDo9IGdldE9wdGlvbnMgaE9wdGlvbnMsIHtcblx0XHRkZWJ1ZzogZmFsc2Vcblx0XHR9XG5cdERCRyA6PSAobXNnOiBzdHJpbmcpOiB2b2lkID0+XG5cdFx0aWYgZGVidWdcblx0XHRcdGNvbnNvbGUubG9nIG1zZ1xuXHRcdHJldHVyblxuXG5cdCMgLS0tIHRydWUgcmV0dXJuIG1lYW5zIHJlbW92ZSBpdFxuXHRmaWx0ZXIgOj0gKGhGaWxlOiBwYXRoSW5mbyk6IGJvb2xlYW4gPT5cblx0XHR7dHlwZSwgcmVsUGF0aH0gOj0gaEZpbGVcblx0XHRpZiAodHlwZSAhPSAnZGlyJylcblx0XHRcdHJldHVybiBmYWxzZVxuXHRcdHJldHVybiBub3QgbEtlZXAuaW5jbHVkZXMocmVsUGF0aClcblxuXHRoOiBvcHRpb25zcGVjIDo9IHtmaWx0ZXIsIGluY2x1ZGVEaXJzOiB0cnVlfVxuXHRwYXRoRnVuYyA6PSAoaDogaGFzaCk6IHN0cmluZyA9PiBoLnBhdGhcblx0bERpcnMgOj0gQXJyYXkuZnJvbShhbGxGaWxlc01hdGNoaW5nKHBhdHRlcm4sIGgpKS5tYXAocGF0aEZ1bmMpXG5cblx0IyAtLS0gV2UgbmVlZCB0byByZW1vdmUgZW1wdHkgc3ViZGlyZWN0b3JpZXMgYmVmb3JlXG5cdCMgICAgIHJlbW92aW5nIGEgZGlyZWN0b3J5LCBzbyB3ZSBidWlsZCBhIGxpc3QgYW5kXG5cdCMgICAgIHJlbW92ZSBsb25nZXIgcGF0aHMgYmVmb3JlIHNob3J0ZXIgcGF0aHNcblxuXHRjb21wYXJlRnVuYyA6PSAoYTogc3RyaW5nLCBiOiBzdHJpbmcpOiBudW1iZXIgPT4gKGIubGVuZ3RoIC0gYS5sZW5ndGgpXG5cdGZvciBwYXRoIG9mIGxEaXJzLnNvcnQoY29tcGFyZUZ1bmMpXG5cdFx0REJHIFwiUkVNT1ZFIERJUiAje3BhdGh9XCJcblx0XHREZW5vLnJlbW92ZVN5bmMgcGF0aFxuXHRyZXR1cm5cblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuZXhwb3J0IHR5cGUgZnNDaGFuZ2VUeXBlID0ge1xuXHRraW5kOiBzdHJpbmdcblx0cGF0aDogc3RyaW5nXG5cdG1zPzogbnVtYmVyXG5cdH1cblxuLyoqXG4gKiB0eXBlIGZzQ2FsbGJhY2tGdW5jIC0gYSBmdW5jdGlvbiB0YWtpbmcgKHR5cGUsIHBhdGgpIGFuZCBvcHRpb25hbGx5XG4gKiByZXR1cm5zIGEgZnVuY3Rpb24gcmVmZXJlbmNlIHRvIGJlIGNhbGxlZCBvbiBmaWxlIGNoYW5nZXNcbiAqL1xuXG5leHBvcnQgdHlwZSBmc0NhbGxiYWNrRnVuYyA9IChjaGFuZ2U6IGZzQ2hhbmdlVHlwZSkgPT4gdm9pZFxuXG4vKipcbiAqIGNsYXNzIEZpbGVFdmVudEhhbmRsZXJcbiAqICAgIGhhbmRsZXMgZmlsZSBjaGFuZ2VkIGV2ZW50cyB3aGVuIC5oYW5kbGUoe2tpbmQsIHBhdGh9KSBpcyBjYWxsZWRcbiAqICAgIGNhbGxiYWNrIGlzIGEgZnVuY3Rpb24sIGRlYm91bmNlZCBieSAyMDAgbXNcbiAqICAgICAgIHRoYXQgdGFrZXMgKHR5cGUsIHBhdGgpIGFuZCByZXR1cm5zIGEgdm9pZEZ1bmNcbiAqICAgICAgIHdoaWNoIHdpbGwgYmUgY2FsbGVkIGlmIHRoZSBjYWxsYmFjayByZXR1cm5zIGEgZnVuY3Rpb24gcmVmZXJlbmNlXG4gKiBbdW5pdCB0ZXN0c10oLi4vdGVzdC9mcy50ZXN0LmNpdmV0Izp+OnRleHQ9JTIzJTIwJTJEJTJEJTJEJTIwY2xhc3MlMjBGaWxlRXZlbnRIYW5kbGVyKVxuICovXG5cbmV4cG9ydCBjbGFzcyBGaWxlRXZlbnRIYW5kbGVyXG5cblx0Y2FsbGJhY2s6IGZzQ2FsbGJhY2tGdW5jP1xuXHRsQ2hhbmdlczogZnNDaGFuZ2VUeXBlW10gOj0gW11cblx0aEhhbmRsZXJzOiBoYXNoID0ge30gICAjIC0tLSBwYXRoID0+IGV2ZW50IHR5cGUgPT4gZGVib3VuY2VkIGhhbmRsZXJcblx0b25TdG9wOiAoKSA9PiB2b2lkID0gcGFzc1xuXHRtczogbnVtYmVyXG5cdGRlYnVnOiBib29sZWFuXG5cblx0Y29uc3RydWN0b3IoXG5cdFx0XHRAY2FsbGJhY2s6IGZzQ2FsbGJhY2tGdW5jPz11bmRlZixcblx0XHRcdGhPcHRpb25zOiBvcHRpb25zcGVjPXt9XG5cdFx0XHQpXG5cblx0XHR7XG5cdFx0XHRkZWJ1ZzogQGRlYnVnLFxuXHRcdFx0b25TdG9wOiBAb25TdG9wXG5cdFx0XHRtczogQG1zXG5cdFx0XHR9IDo9IGdldE9wdGlvbnMgaE9wdGlvbnMsIHtcblx0XHRcdFx0ZGVidWc6IGZhbHNlXG5cdFx0XHRcdG9uU3RvcDogcGFzc1xuXHRcdFx0XHRtczogMjAwXG5cdFx0XHRcdH1cblx0XHRAREJHIFwiRmlsZUV2ZW50SGFuZGxlciBjb25zdHJ1Y3RvcigpIGNhbGxlZFwiXG5cblx0IyAtLS0gQ2FsbHMgYSBmdW5jdGlvbiBvZiB0eXBlICgpID0+IHZvaWRcblx0IyAgICAgYnV0IGlzIGRlYm91bmNlZCBieSBAbXMgbXNcblxuXHRoYW5kbGUoY2hhbmdlOiBmc0NoYW5nZVR5cGUpOiB2b2lkXG5cdFx0e2tpbmQsIHBhdGh9IDo9IGNoYW5nZVxuXHRcdEBEQkcgXCJIQU5ETEU6IFsje3NpbmNlTG9hZFN0cigpfV0gI3traW5kfSAje3BhdGh9XCJcblx0XHRpZiBub3RkZWZpbmVkKEBoSGFuZGxlcnM/LltwYXRoXSlcblx0XHRcdEBEQkcgXCJDcmVhdGUgaGFuZGxlciBmb3IgJyN7cGF0aH0nXCIsIDFcblx0XHRcdEBoSGFuZGxlcnNbcGF0aF0gPSB7fVxuXG5cdFx0aWYgbm90ZGVmaW5lZChAaEhhbmRsZXJzPy5bcGF0aF0/LltraW5kXSlcblx0XHRcdEBEQkcgXCJDcmVhdGUgaGFuZGxlciBmb3IgI3traW5kfSAje3BhdGh9XCIsIDFcblx0XHRcdGZ1bmMgOj0gKCkgPT5cblx0XHRcdFx0aWYgQGNhbGxiYWNrXG5cdFx0XHRcdFx0QGNhbGxiYWNrKHtraW5kLCBwYXRofSlcblx0XHRcdFx0QGxDaGFuZ2VzLnB1c2gge2tpbmQsIHBhdGh9XG5cdFx0XHRcdEBoSGFuZGxlcnNbcGF0aF1ba2luZF0gPSB1bmRlZlxuXHRcdFx0XHRyZXR1cm4gdW5kZWZcblx0XHRcdEBoSGFuZGxlcnNbcGF0aF1ba2luZF0gPSBkZWJvdW5jZShmdW5jLCBAbXMpXG5cdFx0QERCRyBcIkNhbGwgZGVib3VuY2VkIGhhbmRsZXIgZm9yICN7a2luZH0gI3twYXRofVwiXG5cdFx0QGhIYW5kbGVyc1twYXRoXVtraW5kXSgpXG5cdFx0cmV0dXJuXG5cblx0IyBBU1lOQyFcblx0Z2V0Q2hhbmdlTGlzdCgpOiBmc0NoYW5nZVR5cGVbXVxuXHRcdGF3YWl0IHNsZWVwIEBtc1xuXHRcdHJldHVybiBAbENoYW5nZXNcblxuXHRwcml2YXRlIERCRyhtc2c6IHN0cmluZywgbGV2ZWw6IG51bWJlcj0wKTogdm9pZFxuXHRcdGlmIEBkZWJ1Z1xuXHRcdFx0Y29uc29sZS5sb2cgXCIgICAje3NwYWNlcygzKmxldmVsKX0tICN7bXNnfVwiXG5cdFx0cmV0dXJuXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4jIEFTWU5DXG5cbmV4cG9ydCB0eXBlIHdhdGNoZXJDYWxsYmFja0Z1bmMgPSAoY2hhbmdlOiBmc0NoYW5nZVR5cGUpID0+IGJvb2xlYW5cblxuLyoqXG4gKiBhIGZ1bmN0aW9uIHRoYXQgd2F0Y2hlcyBmb3IgY2hhbmdlcyBvbmUgb3IgbW9yZSBmaWxlcyBvciBkaXJlY3Rvcmllc1xuICogICAgYW5kIGNhbGxzIGEgY2FsbGJhY2sgZnVuY3Rpb24gZm9yIGVhY2ggY2hhbmdlLlxuICogSWYgdGhlIGNhbGxiYWNrIHJldHVybnMgdHJ1ZSwgd2F0Y2hpbmcgaXMgaGFsdGVkXG4gKlxuICogVXNhZ2U6XG4gKiAgIGhhbmRsZXIgOj0gKGtpbmQsIHBhdGgpID0+IGNvbnNvbGUubG9nIHBhdGhcbiAqICAgYXdhaXQgd2F0Y2hGaWxlICd0ZW1wLnR4dCcsIGhhbmRsZXJcbiAqICAgYXdhaXQgd2F0Y2hGaWxlICdzcmMvbGliJywgIGhhbmRsZXJcbiAqICAgYXdhaXQgd2F0Y2hGaWxlIFsndGVtcC50eHQnLCAnc3JjL2xpYiddLCBoYW5kbGVyXG4gKi9cblxuZXhwb3J0IHdhdGNoRmlsZSA6PSAoXG5cdHBhdGg6IHN0cmluZyB8IHN0cmluZ1tdLFxuXHR3YXRjaGVyQ0I6IHdhdGNoZXJDYWxsYmFja0Z1bmMsXG5cdGhPcHRpb25zOiBvcHRpb25zcGVjPXt9XG5cdCk6IHZvaWQgLT5cblxuXHR7ZGVidWcsIG1zfSA6PSBnZXRPcHRpb25zIGhPcHRpb25zLCB7XG5cdFx0ZGVidWc6IGZhbHNlXG5cdFx0bXM6IDIwMFxuXHRcdH1cblx0REJHIDo9IChtc2c6IHN0cmluZyk6IHZvaWQgPT5cblx0XHRpZiBkZWJ1Z1xuXHRcdFx0Y29uc29sZS5sb2cgbXNnXG5cdFx0cmV0dXJuXG5cblx0REJHIFwiV0FUQ0g6ICN7SlNPTi5zdHJpbmdpZnkocGF0aCl9XCJcblxuXHR3YXRjaGVyIDo9IERlbm8ud2F0Y2hGcyhwYXRoKVxuXG5cdGxldCBkb1N0b3A6IGJvb2xlYW4gPSBmYWxzZVxuXG5cdGZzQ2FsbGJhY2s6IGZzQ2FsbGJhY2tGdW5jIDo9ICh7a2luZCwgcGF0aH0pID0+XG5cdFx0cmVzdWx0IDo9IHdhdGNoZXJDQih7a2luZCwgcGF0aH0pXG5cdFx0REJHIFwiRkNCOiByZXN1bHQgPSAje3Jlc3VsdH1cIlxuXHRcdGlmIHJlc3VsdFxuXHRcdFx0d2F0Y2hlci5jbG9zZSgpXG5cdFx0cmV0dXJuXG5cblx0aGFuZGxlciA6PSBuZXcgRmlsZUV2ZW50SGFuZGxlcihmc0NhbGxiYWNrLCB7ZGVidWcsIG1zfSlcblxuXHRmb3IgYXdhaXQge2tpbmQsIHBhdGhzfSBvZiB3YXRjaGVyXG5cdFx0REJHIFwid2F0Y2hlciBldmVudCBmaXJlZFwiXG5cdFx0aWYgZG9TdG9wXG5cdFx0XHREQkcgXCJkb1N0b3AgPSAje2RvU3RvcH0sIENsb3Npbmcgd2F0Y2hlclwiXG5cdFx0XHRicmVha1xuI1x0XHR7a2luZCwgcGF0aHN9IDo9IGV2dFxuXHRcdGZvciBwYXRoIG9mIHBhdGhzXG5cdFx0XHQjIC0tLSBmc0NhbGxiYWNrIHdpbGwgYmUgKGV2ZW50dWFsbHkpIGNhbGxlZFxuXHRcdFx0aGFuZGxlci5oYW5kbGUoe2tpbmQsIHBhdGh9KVxuXG5leHBvcnQgd2F0Y2hGaWxlcyA6PSB3YXRjaEZpbGVcbiJdfQ==