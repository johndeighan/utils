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

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3JjL2xpYi9mcy5jaXZldC50c3giLCJzb3VyY2VzIjpbInNyYy9saWIvZnMuY2l2ZXQiXSwibWFwcGluZ3MiOiI7QUFBQSxXQUFVO0FBQ1YsQUFBQTtBQUNBLEssVyx5QjtBQUFBLE1BQU0sQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLElBQUksQ0FBQyxxQ0FBcUM7QUFDM0QsQUFBQSxBQUFBLE1BQU0sQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLElBQUksQ0FBQyxxQkFBcUI7QUFDNUMsQUFBQTtBQUNBLEFBQUEsQUFBQSxNQUFNLENBQUMsQ0FBQztBQUNSLENBQUMsVUFBVSxDQUFDLENBQUMsWUFBWSxDQUFDLENBQUMsYUFBYSxDQUFDO0FBQ3pDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxhQUFhO0FBQ3JCLEFBQUEsQUFBQSxNQUFNLENBQUMsQ0FBQztBQUNSLENBQUMsY0FBYyxDQUFDO0FBQ2hCLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxTQUFTO0FBQ2pCLEFBQUEsQUFBQSxNQUFNLENBQUMsQ0FBQyxZQUFZLENBQUMsQ0FBQyxJQUFJLENBQUMsYUFBYTtBQUN4QyxBQUFBO0FBQ0EsQUFBQSx3REFBdUQ7QUFDdkQsQUFBQSxrQkFBaUI7QUFDakIsQUFBQSxBQUFBLE1BQU0sQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLElBQUksQ0FBQyxTQUFTO0FBQ2hDLEFBQUE7QUFDQSxBQUFBLEFBQUEsTUFBTSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsV0FBVztBQUMvQixBQUFBLEFBQUEsTUFBTSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsVUFBVTtBQUM3QixBQUFBLEFBQUEsTUFBTSxDQUFDLENBQUMsY0FBYyxDQUFDLENBQUMsSUFBSSxDQUFDLHlCQUF5QjtBQUN0RCxBQUFBLEFBQUEsTUFBTSxDQUFDLENBQUMsY0FBYyxDQUFDLENBQUMsSUFBSSxDQUFDLGtCQUFrQjtBQUMvQyxBQUFBO0FBQ0EsQUFBQSxBQUFBLE1BQU0sQ0FBQyxDQUFDO0FBQ1IsQ0FBQyxLQUFLLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxVQUFVLENBQUM7QUFDNUIsQ0FBQyxRQUFRLENBQUMsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLFNBQVMsQ0FBQztBQUM1RCxDQUFDLE9BQU8sQ0FBQyxDQUFDLGdCQUFnQixDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsUUFBUSxDQUFDO0FBQ3ZELENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsVUFBVSxDQUFDO0FBQ3JDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxnQkFBZ0I7QUFDeEIsQUFBQSxBQUFBLE1BQU0sQ0FBQyxDQUFDO0FBQ1IsQ0FBQyxNQUFNLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxlQUFlLENBQUMsQ0FBQyxJQUFJLENBQUM7QUFDdEQsQ0FBQyxNQUFNLENBQUMsQ0FBQyxZQUFZLENBQUMsQ0FBQyxLQUFLLENBQUM7QUFDN0IsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLGNBQWM7QUFDdEIsQUFBQTtBQUNBLEFBQUEsQUFBSSxNQUFKLElBQUksQ0FBQyxDQUFFLENBQUMsVUFBVSxDQUFDLElBQUk7QUFDdkIsQUFBQSxBQUFBLE1BQU0sQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUM7QUFDdEIsQUFBQSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsU0FBUztBQUNuRCxBQUFBO0FBQ0EsQUFBQSxtQkFBa0I7QUFDbEIsQUFBQSxBQUFPLE1BQVAsT0FBTyxDQUFDLENBQUUsQ0FBQyxHQUFHLENBQUMsV0FBVyxDQUFDLE9BQU8sQ0FBQztBQUNuQyxBQUFBLEFBQU8sTUFBUCxPQUFPLENBQUMsQ0FBRSxDQUFDLEdBQUcsQ0FBQyxXQUFXLENBQUMsQ0FBQztBQUM1QixBQUFBO0FBQ0EsQUFBQSw4RUFBNkU7QUFDN0UsQUFBQTtBQUNBLEFBQUE7QUFDQTtBQUNBO0FBQ0EsR0FBRztBQUNILEFBQUE7QUFDQSxBQUFBLEFBQUEsTUFBTSxDQUFPLE1BQU4sTUFBTSxDQUFDLENBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQSxDQUFBO0FBQzNDLEFBQUE7QUFDQSxBQUFBLENBQUMsTUFBTSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDO0FBQUMsQ0FBQTtBQUNuRCxBQUFBO0FBQ0EsQUFBQSw4RUFBNkU7QUFDN0UsQUFBQTtBQUNBLEFBQUE7QUFDQTtBQUNBO0FBQ0EsR0FBRztBQUNILEFBQUE7QUFDQSxBQUFBLEFBQUEsTUFBTSxDQUFNLE1BQUwsS0FBSyxDQUFDLENBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQSxDQUFBO0FBQzFDLEFBQUE7QUFDQSxBQUFBLENBQUMsTUFBTSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDLFdBQVcsQ0FBQyxDO0FBQUMsQ0FBQTtBQUN4RCxBQUFBO0FBQ0EsQUFBQSw4RUFBNkU7QUFDN0UsQUFBQTtBQUNBLEFBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxHQUFHO0FBQ0gsQUFBQTtBQUNBLEFBQUEsQUFBQSxNQUFNLENBQVksTUFBWCxXQUFXLENBQUMsQ0FBRSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFBLENBQUE7QUFDakQsQUFBQTtBQUNBLEFBQUEsQ0FBQyxNQUFNLENBQUEsQUFBQyxRQUFRLENBQUMs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LEVBQUUsR0FBRyxDQUFBLEtBQUssQ0FBQSxDQUFBLENBQUE7QUFDVixBQUFBLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQSxBQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsSUFBSSxDQUFDLEM7RUFBQSxDQUFBO0FBQzFDLEFBQUEsRUFBRSxJQUFJLENBQUEsQ0FBQTtBQUNOLEFBQUEsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFBLEFBQUMsSUFBSSxDO0VBQUEsQztDQUFBLENBQUE7QUFDdkIsQUFBQSxDQUFDLE07QUFBTSxDQUFBO0FBQ1AsQUFBQTtBQUNBLEFBQUEsOEVBQTZFO0FBQzdFLEFBQUE7QUFDQSxBQUFBO0FBQ0E7QUFDQSxHQUFHO0FBQ0gsQUFBQTtBQUNBLEFBQUEsQUFBQSxNQUFNLENBQUMsSUFBQSxhQUFhLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFBLENBQUE7QUFDOUMsQUFBQTtBQUNBLEFBQUEsQ0FBZSxNQUFkLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBRSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUM7QUFDcEMsQUFBQSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLElBQUk7QUFDZixBQUFBLENBQUMsR0FBRyxDQUFDLENBQUEsTUFBQSxJQUFJLENBQUMsRUFBRSxDQUFDLE1BQU0sQ0FBQSxDQUFBLENBQUE7QUFDbkIsQUFBQSxFQUFFLEdBQUcsQyxFQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUM7QUFDbkIsQUFBQSxFQUFFLEdBQUcsQ0FBQSxDQUFJLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQSxDQUFBLENBQUE7QUFDbkIsQUFBQSxHQUFHLEtBQUssQ0FBQSxBQUFDLEdBQUcsQztFQUFBLEM7Q0FBQSxDQUFBO0FBQ1osQUFBQSxDQUFDLE07QUFBTSxDQUFBO0FBQ1AsQUFBQTtBQUNBLEFBQUEsOEVB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R0FBRyxJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxDLENBQUUsQ0FBQyxDQUFDLEM7RUFBQyxDQUFBO0FBQ3hCLEFBQUE7QUFDQSxBQUFBLEVBQUUsR0FBRyxDQUFBLFVBQVUsQ0FBQyxJLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQSxDQUFBLENBQUE7QUFDM0MsQUFBQSxHQUFHLEksQ0FBQyxHQUFHLENBQUEsQUFBQyxDQUFDLG1CQUFtQixFQUFFLElBQUksQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUMvQyxBQUFBLEdBQU8sTUFBSixJQUFJLENBQUMsQ0FBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQSxDQUFBO0FBQ2hCLEFBQUEsSUFBSSxHQUFHLENBQUEsSSxDQUFDLFFBQVEsQ0FBQSxDQUFBLENBQUE7QUFDaEIsQUFBQSxLQUFLLEksQ0FBQyxRQUFRLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsQztJQUFDLENBQUE7QUFDNUIsQUFBQSxJQUFJLEksQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFBLEFBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQTtBQUMvQixBQUFBLElBQUksSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsQyxDQUFFLENBQUMsS0FBSztBQUNsQyxBQUFBLElBQUksTUFBTSxDQUFDLEs7R0FBSyxDQUFBO0FBQ2hCLEFBQUEsR0FBRyxJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxDLENBQUUsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMsSSxDQUFDLEVBQUUsQztFQUFDLENBQUE7QUFDL0MsQUFBQSxFQUFFLEksQ0FBQyxHQUFHLENBQUEsQUFBQyxDQUFDLDJCQUEyQixFQUFFLElBQUksQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLENB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LHdCQUF1QjtBQUN2QixBQUFBLEVBQUUsR0FBRyxDQUFDLENBQUEsTUFBQSxJQUFJLENBQUMsRUFBRSxDQUFDLEtBQUssQ0FBQSxDQUFBLENBQUE7QUFDbkIsQUFBQSxHQUFHLDZDQUE0QztBQUMvQyxBQUFBLEdBQUcsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxDO0VBQUMsQztDQUFBLEM7QUFBQSxDQUFBO0FBQy9CLEFBQUE7QUFDQSxBQUFBLEFBQUEsTUFBTSxDQUFXLE1BQVYsVUFBVSxDQUFDLENBQUUsQ0FBQyxTQUFTO0FBQzlCIiwibmFtZXMiOltdLCJzb3VyY2VzQ29udGVudCI6WyIjIGZzLmNpdmV0XG5cbmltcG9ydCB7c3ByaW50Zn0gZnJvbSBcImh0dHBzOi8vZGVuby5sYW5kL3N0ZC9mbXQvcHJpbnRmLnRzXCJcbmltcG9ydCB7ZGVib3VuY2V9IGZyb20gJ0BzdGQvYXN5bmMvZGVib3VuY2UnXG5cbmltcG9ydCB7XG5cdGV4aXN0c1N5bmMsIGVtcHR5RGlyU3luYywgZW5zdXJlRGlyU3luYyxcblx0fSBmcm9tICdqc3I6QHN0ZC9mcydcbmltcG9ydCB7XG5cdGFwcGVuZEZpbGVTeW5jLFxuXHR9IGZyb20gJ25vZGU6ZnMnXG5pbXBvcnQge0V2ZW50RW1pdHRlcn0gZnJvbSAnbm9kZTpldmVudHMnXG5cbiMgLS0tIERlbm8ncyBzdGF0U3luYyBhbmQgbHN0YXRTeW5jIGFyZSBzdGlsbCB1bnN0YWJsZSxcbiMgICAgIHNvIHVzZSB0aGlzXG5pbXBvcnQge3N0YXRTeW5jfSBmcm9tICdub2RlOmZzJ1xuXG5pbXBvcnQgcGF0aExpYiBmcm9tICdub2RlOnBhdGgnXG5pbXBvcnQgdXJsTGliIGZyb20gJ25vZGU6dXJsJ1xuaW1wb3J0IHtleHBhbmRHbG9iU3luY30gZnJvbSAnanNyOkBzdGQvZnMvZXhwYW5kLWdsb2InXG5pbXBvcnQge1RleHRMaW5lU3RyZWFtfSBmcm9tICdqc3I6QHN0ZC9zdHJlYW1zJ1xuXG5pbXBvcnQge1xuXHR1bmRlZiwgZGVmaW5lZCwgbm90ZGVmaW5lZCxcblx0aXNTdHJpbmcsIGlzTm9uRW1wdHlTdHJpbmcsIGlzQm9vbGVhbiwgaXNOdW1iZXIsIGlzSW50ZWdlcixcblx0aXNBcnJheSwgaXNBcnJheU9mU3RyaW5ncywgaXNIYXNoLCBpc09iamVjdCwgaXNSZWdFeHAsXG5cdGludGVnZXIsIGhhc2gsIHZvaWRGdW5jLCBvcHRpb25zcGVjLFxuXHR9IGZyb20gJy4vZGF0YXR5cGVzLnRzJ1xuaW1wb3J0IHtcblx0YXNzZXJ0LCBjcm9haywgT0wsIGdldE9wdGlvbnMsIHJlbW92ZUVtcHR5S2V5cywgcGFzcyxcblx0c3BhY2VzLCBzaW5jZUxvYWRTdHIsIHNsZWVwLFxuXHR9IGZyb20gJy4vbGx1dGlscy50cydcblxuRGVubyA6PSBnbG9iYWxUaGlzLkRlbm9cbmV4cG9ydCB0eXBlIHBhdGhUeXBlID1cblx0J21pc3NpbmcnIHwgJ2ZpbGUnIHwgJ2RpcicgfCAnc3ltbGluaycgfCAndW5rbm93bidcblxuIyAtLS0gbm90IGV4cG9ydGVkXG5kZWNvZGVyIDo9IG5ldyBUZXh0RGVjb2RlcigndXRmLTgnKVxuZW5jb2RlciA6PSBuZXcgVGV4dEVuY29kZXIoKVxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKipcbiAqIHJldHVybnMgYSBib29sZWFuIGluZGljYXRpbmcgaWYgdGhlIGdpdmVuIHBhdGggZXhpc3RzXG4gKiBhbmQgaXMgYSBmaWxlXG4gKi9cblxuZXhwb3J0IGlzRmlsZSA6PSAocGF0aDogc3RyaW5nKTogYm9vbGVhbiA9PlxuXG5cdHJldHVybiBleGlzdHNTeW5jKHBhdGgpICYmIHN0YXRTeW5jKHBhdGgpLmlzRmlsZSgpXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogcmV0dXJucyBhIGJvb2xlYW4gaW5kaWNhdGluZyBvZiB0aGUgZ2l2ZW4gcGF0aCBleGlzdHNcbiAqIGFuZCBpcyBhIGRpcmVjdG9yeVxuICovXG5cbmV4cG9ydCBpc0RpciA6PSAocGF0aDogc3RyaW5nKTogYm9vbGVhbiA9PlxuXG5cdHJldHVybiBleGlzdHNTeW5jKHBhdGgpICYmIHN0YXRTeW5jKHBhdGgpLmlzRGlyZWN0b3J5KClcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuLyoqXG4gKiByZXR1cm5zIG9uZSBvZjpcbiAqICAgICdtaXNzaW5nJyAgLSBkb2VzIG5vdCBleGlzdFxuICogICAgJ2RpcicgICAgICAtIGlzIGEgZGlyZWN0b3J5XG4gKiAgICAnZmlsZScgICAgIC0gaXMgYSBmaWxlXG4gKiAgICAnc3ltbGluaycgIC0gaXMgYSBzeW1saW5rXG4gKiAgICAndW5rbm93bicgIC0gZXhpc3RzLCBidXQgbm90IGEgZmlsZSwgZGlyZWN0b3J5IG9yIHN5bWxpbmtcbiAqL1xuXG5leHBvcnQgZ2V0UGF0aFR5cGUgOj0gKHBhdGg6IHN0cmluZyk6IHBhdGhUeXBlID0+XG5cblx0YXNzZXJ0IGlzU3RyaW5nKHBhdGgpLCBcIm5vdCBhIHN0cmluZzogI3tPTChwYXRoKX1cIlxuXHRpZiBub3QgZXhpc3RzU3luYyBwYXRoXG5cdFx0cmV0dXJuICdtaXNzaW5nJ1xuXHRoIDo9IHN0YXRTeW5jKHBhdGgpXG5cdHJldHVybiAoXG5cdFx0ICBoLmlzRmlsZSgpICAgICAgICAgPyAnZmlsZSdcblx0XHQ6IGguaXNEaXJlY3RvcnkoKSAgICA/ICdkaXInXG5cdFx0OiBoLmlzU3ltYm9saWNMaW5rKCkgPyAnc3ltbGluaydcblx0XHQ6ICAgICAgICAgICAgICAgICAgICAgICd1bmtub3duJ1xuXHRcdClcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuLyoqXG4gKiBleHRyYWN0IHRoZSBmaWxlIGV4dGVuc2lvbiBmcm9tIGEgcGF0aCwgaW5jbHVkaW5nXG4gKiB0aGUgbGVhZGluZyBwZXJpb2RcbiAqL1xuXG5leHBvcnQgZmlsZUV4dCA6PSAocGF0aDogc3RyaW5nKTogc3RyaW5nID0+XG5cblx0aWYgbE1hdGNoZXMgOj0gcGF0aC5tYXRjaCgvXFwuW15cXC5dKyQvKVxuXHRcdHJldHVybiBsTWF0Y2hlc1swXVxuXHRlbHNlXG5cdFx0cmV0dXJuICcnXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogcmV0dXJuIHRoZSBnaXZlbiBwYXRoLCBidXQgd2l0aCB0aGUgZ2l2ZW4gZmlsZSBleHRlbnNpb25cbiAqIHJlcGxhY2luZyB0aGUgZXhpc3RpbmcgZmlsZSBleHRlbnNpb25cbiAqL1xuXG5leHBvcnQgd2l0aEV4dCA6PSAocGF0aDogc3RyaW5nLCBleHQ6IHN0cmluZyk6IHN0cmluZyA9PlxuXG5cdGFzc2VydCBleHQuc3RhcnRzV2l0aCgnLicpLCBcIkJhZCBmaWxlIGV4dGVuc2lvbjogI3tleHR9XCJcblx0bE1hdGNoZXMgOj0gcGF0aC5tYXRjaCgvXiguKikoXFwuW15cXC5dKykkLylcblx0aWYgKGxNYXRjaGVzID09IG51bGwpXG5cdFx0dGhyb3cgbmV3IEVycm9yKFwiQmFkIHBhdGg6ICcje3BhdGh9J1wiKVxuXHRbXywgaGVhZFN0ciwgb3JnRXh0XSA6PSBsTWF0Y2hlc1xuXHRyZXR1cm4gXCIje2hlYWRTdHJ9I3tleHR9XCJcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuZXhwb3J0IGxTdGF0RmllbGRzOiBzdHJpbmdbXSA6PSBbXG5cdCdkZXYnLCdpbm8nLCdtb2RlJywnbmxpbmsnLCd1aWQnLCdnaWQnLCdyZGV2Jyxcblx0J3NpemUnLCdibGtzaXplJywnYmxvY2tzJyxcblx0J2F0aW1lTXMnLCdtdGltZU1zJywnY3RpbWVNcycsJ2JpcnRodGltZU1zJyxcblx0J2F0aW1lJywnbXRpbWUnLCdjdGltZScsJ2JpcnRodGltZScsXG5cdF1cblxuLyoqXG4gKiByZXR1cm4gc3RhdGlzdGljcyBmb3IgYSBmaWxlIG9yIGRpcmVjdG9yeVxuICovXG5cbmV4cG9ydCBnZXRTdGF0cyA6PSAocGF0aDogc3RyaW5nKTogaGFzaCA9PlxuXG5cdHJldHVybiBzdGF0U3luYyhwYXRoKVxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG5cbi8qKlxuICogcGFyc2VzIGEgcGF0aCBvciBmaWxlIFVSTCwgYW5kIHJldHVybnMgYSBoYXNoIHdpdGgga2V5czpcbiAqIFx0dHlwZTogcGF0aFR5cGUgLSAnZmlsZScsJ2RpcicsJ3N5bWxpbmsnLCdtaXNzaW5nJyBvciAndW5rbm93bidcbiAqIFx0cGF0aDogc3RyaW5nXG4gKiBcdHJvb3Q6IHN0cmluZ1xuICogXHRkaXI6IHN0cmluZ1xuICogXHRmaWxlTmFtZTogc3RyaW5nXG4gKiBcdHN0dWI6IHN0cmluZz9cbiAqIFx0cHVycG9zZTogc3RyaW5nP1xuICogXHRleHQ6IHN0cmluZz9cbiAqIFx0cmVsUGF0aDogc3RyaW5nXG4gKiBcdHJlbERpcjogc3RyaW5nXG4gKi9cblxuZXhwb3J0IHR5cGUgcGF0aEluZm8gPSB7XG5cdHR5cGU6IHBhdGhUeXBlICAjICdmaWxlJywnZGlyJywnc3ltbGluaycsJ21pc3NpbmcnIG9yICd1bmtub3duJ1xuXHRwYXRoOiBzdHJpbmdcblx0cm9vdDogc3RyaW5nXG5cdGRpcjogc3RyaW5nXG5cdGZpbGVOYW1lOiBzdHJpbmdcblx0c3R1Yjogc3RyaW5nP1xuXHRwdXJwb3NlOiBzdHJpbmc/XG5cdGV4dDogc3RyaW5nP1xuXHRyZWxQYXRoOiBzdHJpbmdcblx0cmVsRGlyOiBzdHJpbmdcblx0fVxuXG5leHBvcnQgcGFyc2VQYXRoIDo9IChwYXRoOiBzdHJpbmcpOiBwYXRoSW5mbyA9PlxuXG5cdCMgLS0tIE5PVEU6IHBhdGggbWF5IGJlIGEgZmlsZSBVUkwsIGUuZy4gaW1wb3J0Lm1ldGEudXJsXG5cdCMgICAgICAgICAgIHBhdGggbWF5IGJlIGEgcmVsYXRpdmUgcGF0aFxuXG5cdGFzc2VydCBpc05vbkVtcHR5U3RyaW5nKHBhdGgpLCBcInBhdGggbm90IGEgc3RyaW5nICN7T0wocGF0aCl9XCJcblx0aWYgZGVmaW5lZChwYXRoLm1hdGNoKC9eZmlsZVxcOlxcL1xcLy8pKVxuXHRcdHBhdGggPSB1cmxMaWIuZmlsZVVSTFRvUGF0aChwYXRoKVxuXHRwYXRoID0gbm9ybWFsaXplUGF0aCBwYXRoXG5cblx0e3Jvb3QsIGRpciwgYmFzZTogZmlsZU5hbWV9IDo9IHBhdGhMaWIucGFyc2UocGF0aClcblxuXHRsUGFydHMgOj0gZmlsZU5hbWUuc3BsaXQoJy4nKVxuXHRbc3R1YiwgcHVycG9zZSwgZXh0XSA6PSBzd2l0Y2ggbFBhcnRzLmxlbmd0aFxuXHRcdHdoZW4gMFxuXHRcdFx0Y3JvYWsgXCJDYW4ndCBoYXBwZW5cIlxuXHRcdHdoZW4gMVxuXHRcdFx0W2ZpbGVOYW1lLCB1bmRlZiwgdW5kZWZdXG5cdFx0d2hlbiAyXG5cdFx0XHRbbFBhcnRzWzBdLCB1bmRlZiwgXCIuI3tsUGFydHNbMV19XCJdXG5cdFx0ZWxzZVxuXHRcdFx0W1xuXHRcdFx0XHRsUGFydHMuc2xpY2UoMCwgLTIpLmpvaW4oJy4nKSxcblx0XHRcdFx0bFBhcnRzLmF0KC0yKSxcblx0XHRcdFx0XCIuI3tsUGFydHMuYXQoLTEpfVwiXG5cdFx0XHRcdF1cblxuXHQjIC0tLSBHcmFiIGV2ZXJ5dGhpbmcgdXAgdW50aWwgdGhlIGxhc3QgcGF0aCBzZXBhcmF0b3IsIGlmIGFueVxuXHRyZWxQYXRoIDo9IHJlbHBhdGggcGF0aFxuXHRsUGF0aE1hdGNoZXMgOj0gcmVsUGF0aC5tYXRjaCgvXiguKilbXFxcXFxcL11bXlxcXFxcXC9dKiQvKVxuXHRyZWxEaXIgOj0gKGxQYXRoTWF0Y2hlcyA9PSBudWxsKSA/ICcuJyA6IGxQYXRoTWF0Y2hlc1sxXVxuXG5cdHJldHVybiB7XG5cdFx0dHlwZTogZ2V0UGF0aFR5cGUocGF0aClcblx0XHRwYXRoXG5cdFx0cm9vdFxuXHRcdGRpclxuXHRcdGZpbGVOYW1lXG5cdFx0c3R1YlxuXHRcdHB1cnBvc2Vcblx0XHRleHRcblx0XHRyZWxQYXRoXG5cdFx0cmVsRGlyXG5cdFx0fVxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKipcbiAqIGdlbmVyYXRlIGZpbGVzIHRoYXQgbWF0Y2ggYSBnaXZlbiBnbG9iIHBhdHRlcm5cbiAqIHlpZWxkcyB7cGF0aCwgbmFtZSwgaXNGaWxlLCBpc0RpcmVjdG9yeSwgaXNTeW1saW5rfVxuICogICAgd2l0aCBwYXJzZSBvcHRpb24sIGFsc28gaW5jbHVkZXMga2V5czpcbiAqICAgICAgIHJlbFBhdGhcbiAqIFRoZXNlIG9wdGlvbnMgbWF5IGJlIHNwZWNpZmllZCBpbiB0aGUgMm5kIHBhcmFtZXRlcjpcbiAqICAgIHJvb3Q6IHN0cmluZyAtIHJvb3Qgb2Ygc2VhcmNoLCAoZGVmOiBEZW5vLmN3ZCgpKVxuICogICAgbEV4Y2x1ZGU6IFtzdHJpbmddIC0gcGF0dGVybnMgdG8gZXhjbHVkZSxcbiAqICAgIFx0ZGVmOiBbJ25vZGVfbW9kdWxlcy8qKicsICcuZ2l0LyoqJ11cbiAqICAgIGluY2x1ZGVEaXJzOiBib29sZWFuIC0gc2hvdWxkIGRpcmVjdG9yaWVzIGJlIGluY2x1ZGVkPyAoZGVmOiB0cnVlKVxuICogXHRmb2xsb3dTeW1saW5rcyAtIGJvb2xlYW4gLSBzaG91bGQgc3ltIGxpbmtzIGJlIGZvbGxvd2VkPyAoZGVmOiBmYWxzZSlcbiAqIFx0Y2Fub25pY2FsaXplOiBib29sZWFuIC0gaWYgZm9sbG93c3ltbGlua3MgaXMgdHJ1ZSwgc2hvdWxkXG4gKiBcdFx0cGF0aHMgYmUgY2Fub25pY2FsaXplZD8gKGRlZjogdHJ1ZSlcbiAqIFx0ZmlsdGVyOiAoc3RyaW5nLT5ib29sZWFuKSAtIHlpZWxkIG9ubHkgaWYgZnVuY3Rpb24gcmV0dXJucyB0cnVlXG4gKi9cblxuZXhwb3J0IGFsbEZpbGVzTWF0Y2hpbmcgOj0gKFxuXHRwYXR0ZXJuOiBzdHJpbmc9JyoqJyxcblx0aE9wdGlvbnM6IG9wdGlvbnNwZWM9e31cblx0KTogR2VuZXJhdG9yPGhhc2gsIHZvaWQsIHVua25vd24+IC0+XG5cblx0e1xuXHRcdHJvb3Rcblx0XHRsRXhjbHVkZVxuXHRcdGluY2x1ZGVEaXJzXG5cdFx0Zm9sbG93U3ltbGlua3Ncblx0XHRjYW5vbmljYWxpemVcblx0XHRmaWx0ZXJcblx0XHRkZWJ1Z1xuXHRcdH0gOj0gZ2V0T3B0aW9ucyBoT3B0aW9ucywge1xuXHRcdFx0cm9vdDogdW5kZWZcblx0XHRcdGxFeGNsdWRlOiBbJ25vZGVfbW9kdWxlcy8qKicsICcuZ2l0LyoqJ11cblx0XHRcdGluY2x1ZGVEaXJzOiBmYWxzZVxuXHRcdFx0Zm9sbG93U3ltbGlua3M6IGZhbHNlXG5cdFx0XHRjYW5vbmljYWxpemU6IGZhbHNlXG5cdFx0XHRmaWx0ZXI6IHVuZGVmXG5cdFx0XHRkZWJ1ZzogZmFsc2Vcblx0XHRcdH1cblxuXHRoR2xvYk9wdGlvbnMgOj0ge1xuXHRcdHJvb3Rcblx0XHRleGNsdWRlOiBsRXhjbHVkZVxuXHRcdGluY2x1ZGVEaXJzXG5cdFx0Zm9sbG93U3ltbGlua3Ncblx0XHRjYW5vbmljYWxpemVcblx0XHR9XG5cblx0REJHIDo9IChtc2c6IHN0cmluZyk6IHZvaWQgPT5cblx0XHRpZiBkZWJ1Z1xuXHRcdFx0Y29uc29sZS5sb2cgbXNnXG5cdFx0cmV0dXJuXG5cblx0Zm9yIGggb2YgZXhwYW5kR2xvYlN5bmMocGF0dGVybiwgaEdsb2JPcHRpb25zKVxuXHRcdCMgLS0tIGggaGFzIGtleXM6IHBhdGgsIG5hbWUsIGlzRmlsZSwgaXNEaXJlY3RvcnksIGlzU3ltTGlua1xuXG5cdFx0REJHIFwiTUFUQ0g6ICN7aC5wYXRofVwiXG5cdFx0dHlwZSA6PSAoXG5cdFx0XHQgIGguaXNGaWxlICAgICAgPyAnZmlsZSdcblx0XHRcdDogaC5pc0RpcmVjdG9yeSA/ICdkaXInXG5cdFx0XHQ6IGguaXNTeW1saW5rICAgPyAnc3ltbGluaydcblx0XHRcdDogICAgICAgICAgICAgICAgICd1bmtub3duJ1xuXHRcdFx0KVxuXHRcdGhGaWxlIDo9IHBhcnNlUGF0aChoLnBhdGgpXG5cdFx0aWYgbm90ZGVmaW5lZChmaWx0ZXIpXG5cdFx0XHREQkcgXCIgICAtIG5vIGZpbHRlclwiXG5cdFx0XHR5aWVsZCBoRmlsZVxuXHRcdGVsc2UgaWYgZmlsdGVyKGhGaWxlKVxuXHRcdFx0REJHIFwiICAgLSBhbGxvd2VkIGJ5IGZpbHRlclwiXG5cdFx0XHR5aWVsZCBoRmlsZVxuXHRcdGVsc2Vcblx0XHRcdERCRyBcIiAgIC0gZXhjbHVkZWQgYnkgZmlsdGVyXCJcblx0cmV0dXJuXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4jIEFTWU5DIElURVJBQkxFXG5cbi8qKlxuICogQW4gYXN5bmMgaXRlcmFibGUgLSB5aWVsZHMgZXZlcnkgbGluZSBpbiB0aGUgZ2l2ZW4gZmlsZVxuICpcbiAqIFVzYWdlOlxuICogICBmb3IgYXdhaXQgbGluZSBvZiBhbGxMaW5lc0luKCdzcmMvbGliL3RlbXAuY2l2ZXQnKVxuICogXHQgIGNvbnNvbGUubG9nIFwiTElORTogI3tsaW5lfVwiXG4gKiAgIGNvbnNvbGUubG9nIFwiRE9ORVwiXG4gKi9cblxuZXhwb3J0IGFsbExpbmVzSW4gOj0gKFxuXHRwYXRoOiBzdHJpbmdcblx0KTogQXN5bmNHZW5lcmF0b3I8c3RyaW5nLCB2b2lkLCB1bmtub3duPiAtPlxuXG5cdGFzc2VydCBpc0ZpbGUocGF0aCksIFwiTm8gc3VjaCBmaWxlOiAje09MKHBhdGgpfSAoYWxsTGluZXNJbilcIlxuXHRmIDo9IGF3YWl0IERlbm8ub3BlbihwYXRoKVxuXHRyZWFkYWJsZSA6PSBmLnJlYWRhYmxlXG5cdFx0LnBpcGVUaHJvdWdoKG5ldyBUZXh0RGVjb2RlclN0cmVhbSgpKVxuXHRcdC5waXBlVGhyb3VnaChuZXcgVGV4dExpbmVTdHJlYW0oKSlcblxuXHRmb3IgYXdhaXQgbGluZSBvZiByZWFkYWJsZVxuXHRcdHlpZWxkIGxpbmVcblx0cmV0dXJuXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogY29udmVydHMgYWxsIGJhY2tzbGFzaCBjaGFyYWN0ZXJzIHRvIGZvcndhcmQgc2xhc2hlc1xuICogdXBwZXItY2FzZXMgZHJpdmUgbGV0dGVyc1xuICovXG5cbmV4cG9ydCBub3JtYWxpemVQYXRoIDo9IChwYXRoOiBzdHJpbmcpOiBzdHJpbmcgPT5cblxuXHRucGF0aCA6PSBwYXRoLnJlcGxhY2VBbGwoJ1xcXFwnLCAnLycpXG5cdGlmIChucGF0aC5jaGFyQXQoMSkgPT0gJzonKVxuXHRcdHJldHVybiBucGF0aC5jaGFyQXQoMCkudG9VcHBlckNhc2UoKSArIG5wYXRoLnN1YnN0cmluZygxKVxuXHRlbHNlXG5cdFx0cmV0dXJuIG5wYXRoXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogcmVzb2x2ZXMgbXVsdGlwbGUgcGF0aCBwYXJ0cyB0byBhIHNpbmdsZSBwYXRoXG4gKiByZXR1cm5zIG5vcm1hbGl6ZWQgcGF0aFxuICovXG5cbmV4cG9ydCBta3BhdGggOj0gKGxQYXJ0cy4uLjogc3RyaW5nW10pOiBzdHJpbmcgPT5cblxuXHRwYXRoIDo9IHBhdGhMaWIucmVzb2x2ZShsUGFydHMuLi4pXG5cdHJldHVybiBub3JtYWxpemVQYXRoKHBhdGgpXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogcmVzb2x2ZXMgbXVsdGlwbGUgcGF0aCBwYXJ0cyB0byBhIHNpbmdsZSBwYXRoXG4gKiByZXR1cm5zIG5vcm1hbGl6ZWQgcGF0aCwgcmVsYXRpdmUgdG8gY3VycmVudCBkaXJlY3RvcnlcbiAqL1xuXG5leHBvcnQgcmVscGF0aCA6PSAobFBhcnRzLi4uOiBzdHJpbmdbXSk6IHN0cmluZyA9PlxuXG5cdGFzc2VydCBpc0FycmF5T2ZTdHJpbmdzKGxQYXJ0cyksIFwiQmFkIGxQYXJ0czogI3tPTChsUGFydHMpfVwiXG5cdGZ1bGxQYXRoIDo9IHBhdGhMaWIucmVzb2x2ZSBsUGFydHMuLi5cblx0cmV0dXJuIG5vcm1hbGl6ZVBhdGggcGF0aExpYi5yZWxhdGl2ZSgnJywgZnVsbFBhdGgpXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbmV4cG9ydCB0eXBlIHBhdGhEZXNjID0ge1xuXHRkaXI6IHN0cmluZ1xuXHRyb290OiBzdHJpbmdcblx0bFBhcnRzOiBzdHJpbmdbXVxuXHR9XG5cbi8qKlxuICogcmV0dXJucyB7ZGlyLCByb290LCBsUGFydHN9IHdoZXJlIGxQYXJ0cyBpbmNsdWRlcyB0aGUgbmFtZXMgb2ZcbiAqIGFsbCBkaXJlY3RvcmllcyBiZXR3ZWVuIHRoZSByb290IGFuZCB0aGUgZmlsZSBuYW1lXG4gKiByZWxhdGl2ZSB0byB0aGUgY3VycmVudCB3b3JraW5nIGRpcmVjdG9yeVxuICovXG5cbmV4cG9ydCBwYXRoU3ViRGlycyA9IChwYXRoOiBzdHJpbmcsIGhPcHRpb25zOiBvcHRpb25zcGVjPXt9KTogcGF0aERlc2MgPT5cblxuXHR7cmVsYXRpdmV9IDo9IGdldE9wdGlvbnMgaE9wdGlvbnMsIHtcblx0XHRyZWxhdGl2ZTogZmFsc2Vcblx0XHR9XG5cdHBhdGggPSByZWxhdGl2ZSA/IHJlbHBhdGgocGF0aCkgOiBta3BhdGgocGF0aClcblx0e3Jvb3QsIGRpcn0gOj0gcGF0aExpYi5wYXJzZShwYXRoKVxuXHRyZXR1cm4ge1xuXHRcdGRpclxuXHRcdHJvb3Rcblx0XHRsUGFydHM6IGRpci5zbGljZShyb290Lmxlbmd0aCkuc3BsaXQoL1tcXFxcXFwvXS8pXG5cdFx0fVxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuIyAtLS0gU2hvdWxkIGJlIGNhbGxlZCBsaWtlOiBteXNlbGYoaW1wb3J0Lm1ldGEudXJsKVxuIyAgICAgcmV0dXJucyBmdWxsIHBhdGggb2YgY3VycmVudCBmaWxlXG5cbmV4cG9ydCBteXNlbGYgOj0gKHVybDogc3RyaW5nKTogc3RyaW5nID0+XG5cblx0cmV0dXJuIHJlbHBhdGggdXJsTGliLmZpbGVVUkxUb1BhdGgodXJsKVxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogcmVhZCBhIGZpbGUgaW50byBhIHN0cmluZ1xuICovXG5cbmV4cG9ydCBzbHVycCA6PSAocGF0aDogc3RyaW5nKTogc3RyaW5nID0+XG5cblx0YXNzZXJ0IGlzRmlsZShwYXRoKSwgXCJObyBzdWNoIGZpbGU6ICN7cGF0aH0gKHNsdXJwKVwiXG5cdGRhdGEgOj0gRGVuby5yZWFkRmlsZVN5bmMgcGF0aFxuXHRyZXR1cm4gZGVjb2Rlci5kZWNvZGUoZGF0YSkucmVwbGFjZUFsbCgnXFxyJywgJycpXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogd3JpdGUgYSBzdHJpbmcgdG8gYSBmaWxlXG4gKiB3aWxsIGVuc3VyZSB0aGF0IGFsbCBuZWNlc3NhcnkgZGlyZWN0b3JpZXMgZXhpc3RcbiAqL1xuXG5leHBvcnQgYmFyZiA6PSAoXG5cdGNvbnRlbnRzOiBzdHJpbmcsXG5cdHBhdGg6IHN0cmluZyxcblx0aE9wdGlvbnM6IG9wdGlvbnNwZWM9e31cblx0KTogdm9pZCA9PlxuXG5cdHthcHBlbmR9IDo9IGdldE9wdGlvbnMgaE9wdGlvbnMsIHtcblx0XHRhcHBlbmQ6IGZhbHNlXG5cdFx0fVxuXHRta0RpcnNGb3JGaWxlKHBhdGgpXG5cdGRhdGEgOj0gZW5jb2Rlci5lbmNvZGUoY29udGVudHMpXG5cdGlmIGFwcGVuZCAmJiBpc0ZpbGUocGF0aClcblx0XHRhcHBlbmRGaWxlU3luYyBwYXRoLCBkYXRhXG5cdGVsc2Vcblx0XHREZW5vLndyaXRlRmlsZVN5bmMgcGF0aCwgZGF0YVxuXHRyZXR1cm5cblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuZXhwb3J0IG5ld2VyRGVzdEZpbGVFeGlzdHMgOj0gKFxuXHRzcmNQYXRoOiBzdHJpbmcsXG5cdGRlc3RQYXRoOiBzdHJpbmdcblx0KTogYm9vbGVhbiA9PlxuXG5cdGFzc2VydCBpc0ZpbGUoc3JjUGF0aCksIFwiTm8gc3VjaCBmaWxlOiAje09MKHNyY1BhdGgpfSAobmV3ZXJEZXN0RmlsZUV4aXN0cylcIlxuXHRpZiBub3QgZXhpc3RzU3luYyhkZXN0UGF0aClcblx0XHRyZXR1cm4gZmFsc2Vcblx0c3JjTW9kVGltZSA6PSBzdGF0U3luYyhzcmNQYXRoKS5tdGltZU1zXG5cdGRlc3RNb2RUaW1lIDo9IHN0YXRTeW5jKGRlc3RQYXRoKS5tdGltZU1zXG5cdHJldHVybiAoZGVzdE1vZFRpbWUgPiBzcmNNb2RUaW1lKVxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKipcbiAqIGNyZWF0ZSBhIG5ldyBkaXJlY3RvcnkgaWYgaXQgZG9lc24ndCBleGlzdFxuICogaWYgdGhlIG9wdGlvbiAnY2xlYXInIGlzIHNldCB0byBhIHRydWUgdmFsdWUgaW4gdGhlIDJuZCBwYXJhbWV0ZXJcbiAqIGFuZCB0aGUgZGlyZWN0b3J5IGFscmVhZHkgZXhpc3RzLCBpdCBpcyBjbGVhcmVkXG4gKi9cblxuZXhwb3J0IG1rRGlyID0gKGRpclBhdGg6IHN0cmluZywgY2xlYXI6IGJvb2xlYW49ZmFsc2UpOiB2b2lkID0+XG5cblx0aWYgY2xlYXJcblx0XHRlbXB0eURpclN5bmMgZGlyUGF0aCAgICAjIC0tLSBjcmVhdGVzIGlmIGl0IGRvZXNuJ3QgZXhpc3Rcblx0ZWxzZVxuXHRcdGVuc3VyZURpclN5bmMgZGlyUGF0aFxuXHRyZXR1cm5cblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuLyoqXG4gKiByZW1vdmUgYSBmaWxlIGZyb20gdGhlIGZpbGUgc3lzdGVtLCBidXQgZG8gbm90aGluZ1xuICogaWYgdGhlIGZpbGUgZG9lcyBub3QgZXhpc3RcbiAqL1xuXG5leHBvcnQgcm1GaWxlIDo9IChwYXRoOiBzdHJpbmcpOiB2b2lkID0+XG5cblx0aWYgZXhpc3RzU3luYyBwYXRoXG5cdFx0RGVuby5yZW1vdmVTeW5jIHBhdGhcblx0cmV0dXJuXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogcmVtb3ZlIGEgZGlyZWN0b3J5IGZyb20gdGhlIGZpbGUgc3lzdGVtLCBidXQgZG8gbm90aGluZ1xuICogaWYgdGhlIGRpcmVjdG9yeSBkb2VzIG5vdCBleGlzdFxuICogTk9URTogWW91IG11c3QgcGFzcyB0aGUgJ2NsZWFyJyBvcHRpb24gaWYgdGhlIGRpcmVjdG9yeVxuICogICAgICAgaXMgbm90IGVtcHR5XG4gKi9cblxuZXhwb3J0IHJtRGlyIDo9IChwYXRoOiBzdHJpbmcsIGhPcHRpb25zOiBvcHRpb25zcGVjPXt9KTogdm9pZCA9PlxuXG5cdHtjbGVhcn0gOj0gZ2V0T3B0aW9ucyBoT3B0aW9ucywge1xuXHRcdGNsZWFyOiBmYWxzZVxuXHRcdH1cblx0aWYgZXhpc3RzU3luYyBwYXRoXG5cdFx0aWYgY2xlYXJcblx0XHRcdERlbm8ucmVtb3ZlU3luYyBwYXRoLCB7cmVjdXJzaXZlOiB0cnVlfVxuXHRcdGVsc2Vcblx0XHRcdERlbm8ucmVtb3ZlU3luYyBwYXRoXG5cdHJldHVyblxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKipcbiAqIGNyZWF0ZSBhbnkgbWlzc2luZyBkaXJlY3RvcmllcyBpbiB0aGUgZ2l2ZW4gcGF0aFxuICovXG5cbmV4cG9ydCBta0RpcnNGb3JGaWxlID0gKHBhdGg6IHN0cmluZyk6IHZvaWQgPT5cblxuXHR7cm9vdCwgbFBhcnRzfSA6PSBwYXRoU3ViRGlycyhwYXRoKVxuXHRsZXQgZGlyID0gcm9vdFxuXHRmb3IgcGFydCBvZiBsUGFydHNcblx0XHRkaXIgKz0gXCIvI3twYXJ0fVwiXG5cdFx0aWYgbm90IGlzRGlyKGRpcilcblx0XHRcdG1rRGlyIGRpclxuXHRyZXR1cm5cblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuLyoqXG4gKiBkZWxldGVzIGFsbCBmaWxlcyBhbmQgc3ViZGlyZWN0b3JpZXMgaW4gdGhlIGdpdmVuIGRpcmVjdG9yeVxuICovXG5cbmV4cG9ydCBjbGVhckRpciA9IChkaXJQYXRoOiBzdHJpbmcpOiB2b2lkID0+XG5cblx0ZW1wdHlEaXJTeW5jIGRpclBhdGhcblx0cmV0dXJuXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4jIC0tLSBoT3B0aW9ucyBnZXRzIHBhc3NlZCB0byBhbGxGaWxlc01hdGNoaW5nKClcblxuZXhwb3J0IHJlbW92ZUZpbGVzTWF0Y2hpbmcgOj0gKFxuXHRwYXR0ZXJuOiBzdHJpbmcsXG5cdGhPcHRpb25zOiBvcHRpb25zcGVjPXt9XG5cdCk6IHZvaWQgPT5cblxuXHRhc3NlcnQgKHBhdHRlcm4gIT0gJyonKSAmJiAocGF0dGVybiAhPSAnKionKSxcblx0XHRcIkNhbid0IGRlbGV0ZSBmaWxlcyBtYXRjaGluZyAje09MKHBhdHRlcm4pfVwiXG5cdGZvciB7cmVsUGF0aH0gb2YgYWxsRmlsZXNNYXRjaGluZyhwYXR0ZXJuLCBoT3B0aW9ucylcblx0XHREZW5vLnJlbW92ZVN5bmMgcmVsUGF0aFxuXHRyZXR1cm5cblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuZXhwb3J0IHJlbW92ZUZpbGVzRXhjZXB0IDo9IChcblx0cGF0dGVybjogc3RyaW5nLFxuXHRsS2VlcDogc3RyaW5nW10sXG5cdGhPcHRpb25zOiBvcHRpb25zcGVjID0ge31cblx0KTogdm9pZCA9PlxuXG5cdHtkZWJ1Z30gOj0gZ2V0T3B0aW9ucyBoT3B0aW9ucywge1xuXHRcdGRlYnVnOiBmYWxzZVxuXHRcdH1cblx0REJHIDo9IChtc2c6IHN0cmluZyk6IHZvaWQgPT5cblx0XHRpZiBkZWJ1Z1xuXHRcdFx0Y29uc29sZS5sb2cgbXNnXG5cdFx0cmV0dXJuXG5cblx0IyAtLS0gdHJ1ZSByZXR1cm4gbWVhbnMgcmVtb3ZlIGl0XG5cdGZpbHRlciA6PSAoaEZpbGU6IHBhdGhJbmZvKTogYm9vbGVhbiA9PlxuXHRcdHt0eXBlLCByZWxQYXRofSA6PSBoRmlsZVxuXHRcdGlmICh0eXBlICE9ICdmaWxlJylcblx0XHRcdHJldHVybiBmYWxzZVxuXHRcdHJldHVybiBub3QgbEtlZXAuaW5jbHVkZXMocmVsUGF0aClcblxuXHRoOiBvcHRpb25zcGVjIDo9IHtmaWx0ZXIsIGRlYnVnfVxuXHRmb3Ige3JlbFBhdGh9IG9mIGFsbEZpbGVzTWF0Y2hpbmcocGF0dGVybiwgaClcblx0XHREQkcgXCJSRU1PVkUgRklMRSAje3JlbFBhdGh9XCJcblx0XHREZW5vLnJlbW92ZVN5bmMgcmVsUGF0aFxuXHRyZXR1cm5cblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuZXhwb3J0IHJlbW92ZURpcnNFeGNlcHQgOj0gKFxuXHRwYXR0ZXJuOiBzdHJpbmcsXG5cdGxLZWVwOiBzdHJpbmdbXSxcblx0aE9wdGlvbnM6IG9wdGlvbnNwZWMgPSB7fVxuXHQpOiB2b2lkID0+XG5cblx0e2RlYnVnfSA6PSBnZXRPcHRpb25zIGhPcHRpb25zLCB7XG5cdFx0ZGVidWc6IGZhbHNlXG5cdFx0fVxuXHREQkcgOj0gKG1zZzogc3RyaW5nKTogdm9pZCA9PlxuXHRcdGlmIGRlYnVnXG5cdFx0XHRjb25zb2xlLmxvZyBtc2dcblx0XHRyZXR1cm5cblxuXHQjIC0tLSB0cnVlIHJldHVybiBtZWFucyByZW1vdmUgaXRcblx0ZmlsdGVyIDo9IChoRmlsZTogcGF0aEluZm8pOiBib29sZWFuID0+XG5cdFx0e3R5cGUsIHJlbFBhdGh9IDo9IGhGaWxlXG5cdFx0aWYgKHR5cGUgIT0gJ2RpcicpXG5cdFx0XHRyZXR1cm4gZmFsc2Vcblx0XHRyZXR1cm4gbm90IGxLZWVwLmluY2x1ZGVzKHJlbFBhdGgpXG5cblx0aDogb3B0aW9uc3BlYyA6PSB7ZmlsdGVyLCBpbmNsdWRlRGlyczogdHJ1ZX1cblx0cGF0aEZ1bmMgOj0gKGg6IGhhc2gpOiBzdHJpbmcgPT4gaC5wYXRoXG5cdGxEaXJzIDo9IEFycmF5LmZyb20oYWxsRmlsZXNNYXRjaGluZyhwYXR0ZXJuLCBoKSkubWFwKHBhdGhGdW5jKVxuXG5cdCMgLS0tIFdlIG5lZWQgdG8gcmVtb3ZlIGVtcHR5IHN1YmRpcmVjdG9yaWVzIGJlZm9yZVxuXHQjICAgICByZW1vdmluZyBhIGRpcmVjdG9yeSwgc28gd2UgYnVpbGQgYSBsaXN0IGFuZFxuXHQjICAgICByZW1vdmUgbG9uZ2VyIHBhdGhzIGJlZm9yZSBzaG9ydGVyIHBhdGhzXG5cblx0Y29tcGFyZUZ1bmMgOj0gKGE6IHN0cmluZywgYjogc3RyaW5nKTogbnVtYmVyID0+IChiLmxlbmd0aCAtIGEubGVuZ3RoKVxuXHRmb3IgcGF0aCBvZiBsRGlycy5zb3J0KGNvbXBhcmVGdW5jKVxuXHRcdERCRyBcIlJFTU9WRSBESVIgI3twYXRofVwiXG5cdFx0RGVuby5yZW1vdmVTeW5jIHBhdGhcblx0cmV0dXJuXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbmV4cG9ydCB0eXBlIGZzQ2hhbmdlVHlwZSA9IHtcblx0a2luZDogc3RyaW5nXG5cdHBhdGg6IHN0cmluZ1xuXHRtcz86IG51bWJlclxuXHR9XG5cbi8qKlxuICogdHlwZSBmc0NhbGxiYWNrRnVuYyAtIGEgZnVuY3Rpb24gdGFraW5nICh0eXBlLCBwYXRoKSBhbmQgb3B0aW9uYWxseVxuICogcmV0dXJucyBhIGZ1bmN0aW9uIHJlZmVyZW5jZSB0byBiZSBjYWxsZWQgb24gZmlsZSBjaGFuZ2VzXG4gKi9cblxuZXhwb3J0IHR5cGUgZnNDYWxsYmFja0Z1bmMgPSAoY2hhbmdlOiBmc0NoYW5nZVR5cGUpID0+IHZvaWRcblxuLyoqXG4gKiBjbGFzcyBGaWxlRXZlbnRIYW5kbGVyXG4gKiAgICBoYW5kbGVzIGZpbGUgY2hhbmdlZCBldmVudHMgd2hlbiAuaGFuZGxlKHtraW5kLCBwYXRofSkgaXMgY2FsbGVkXG4gKiAgICBjYWxsYmFjayBpcyBhIGZ1bmN0aW9uLCBkZWJvdW5jZWQgYnkgMjAwIG1zXG4gKiAgICAgICB0aGF0IHRha2VzICh0eXBlLCBwYXRoKSBhbmQgcmV0dXJucyBhIHZvaWRGdW5jXG4gKiAgICAgICB3aGljaCB3aWxsIGJlIGNhbGxlZCBpZiB0aGUgY2FsbGJhY2sgcmV0dXJucyBhIGZ1bmN0aW9uIHJlZmVyZW5jZVxuICogW3VuaXQgdGVzdHNdKC4uL3Rlc3QvZnMudGVzdC5jaXZldCM6fjp0ZXh0PSUyMyUyMCUyRCUyRCUyRCUyMGNsYXNzJTIwRmlsZUV2ZW50SGFuZGxlcilcbiAqL1xuXG5leHBvcnQgY2xhc3MgRmlsZUV2ZW50SGFuZGxlclxuXG5cdGNhbGxiYWNrOiBmc0NhbGxiYWNrRnVuYz9cblx0bENoYW5nZXM6IGZzQ2hhbmdlVHlwZVtdIDo9IFtdXG5cdGhIYW5kbGVyczogaGFzaCA9IHt9ICAgIyAtLS0gcGF0aCA9PiBldmVudCB0eXBlID0+IGRlYm91bmNlZCBoYW5kbGVyXG5cdG9uU3RvcDogKCkgPT4gdm9pZCA9IHBhc3Ncblx0bXM6IG51bWJlclxuXHRkZWJ1ZzogYm9vbGVhblxuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdFx0QGNhbGxiYWNrOiBmc0NhbGxiYWNrRnVuYz89dW5kZWYsXG5cdFx0XHRoT3B0aW9uczogb3B0aW9uc3BlYz17fVxuXHRcdFx0KVxuXG5cdFx0e1xuXHRcdFx0ZGVidWc6IEBkZWJ1Zyxcblx0XHRcdG9uU3RvcDogQG9uU3RvcFxuXHRcdFx0bXM6IEBtc1xuXHRcdFx0fSA6PSBnZXRPcHRpb25zIGhPcHRpb25zLCB7XG5cdFx0XHRcdGRlYnVnOiBmYWxzZVxuXHRcdFx0XHRvblN0b3A6IHBhc3Ncblx0XHRcdFx0bXM6IDIwMFxuXHRcdFx0XHR9XG5cdFx0QERCRyBcIkZpbGVFdmVudEhhbmRsZXIgY29uc3RydWN0b3IoKSBjYWxsZWRcIlxuXG5cdCMgLS0tIENhbGxzIGEgZnVuY3Rpb24gb2YgdHlwZSAoKSA9PiB2b2lkXG5cdCMgICAgIGJ1dCBpcyBkZWJvdW5jZWQgYnkgQG1zIG1zXG5cblx0aGFuZGxlKGNoYW5nZTogZnNDaGFuZ2VUeXBlKTogdm9pZFxuXHRcdHtraW5kLCBwYXRofSA6PSBjaGFuZ2Vcblx0XHRAREJHIFwiSEFORExFOiBbI3tzaW5jZUxvYWRTdHIoKX1dICN7a2luZH0gI3twYXRofVwiXG5cdFx0aWYgbm90ZGVmaW5lZChAaEhhbmRsZXJzPy5bcGF0aF0pXG5cdFx0XHRAREJHIFwiQ3JlYXRlIGhhbmRsZXIgZm9yICcje3BhdGh9J1wiLCAxXG5cdFx0XHRAaEhhbmRsZXJzW3BhdGhdID0ge31cblxuXHRcdGlmIG5vdGRlZmluZWQoQGhIYW5kbGVycz8uW3BhdGhdPy5ba2luZF0pXG5cdFx0XHRAREJHIFwiQ3JlYXRlIGhhbmRsZXIgZm9yICN7a2luZH0gI3twYXRofVwiLCAxXG5cdFx0XHRmdW5jIDo9ICgpID0+XG5cdFx0XHRcdGlmIEBjYWxsYmFja1xuXHRcdFx0XHRcdEBjYWxsYmFjayh7a2luZCwgcGF0aH0pXG5cdFx0XHRcdEBsQ2hhbmdlcy5wdXNoIHtraW5kLCBwYXRofVxuXHRcdFx0XHRAaEhhbmRsZXJzW3BhdGhdW2tpbmRdID0gdW5kZWZcblx0XHRcdFx0cmV0dXJuIHVuZGVmXG5cdFx0XHRAaEhhbmRsZXJzW3BhdGhdW2tpbmRdID0gZGVib3VuY2UoZnVuYywgQG1zKVxuXHRcdEBEQkcgXCJDYWxsIGRlYm91bmNlZCBoYW5kbGVyIGZvciAje2tpbmR9ICN7cGF0aH1cIlxuXHRcdEBoSGFuZGxlcnNbcGF0aF1ba2luZF0oKVxuXHRcdHJldHVyblxuXG5cdGdldENoYW5nZUxpc3QoKTogZnNDaGFuZ2VUeXBlW11cblx0XHRhd2FpdCBzbGVlcCBAbXNcblx0XHRyZXR1cm4gQGxDaGFuZ2VzXG5cblx0cHJpdmF0ZSBEQkcobXNnOiBzdHJpbmcsIGxldmVsOiBudW1iZXI9MCk6IHZvaWRcblx0XHRpZiBAZGVidWdcblx0XHRcdGNvbnNvbGUubG9nIFwiICAgI3tzcGFjZXMoMypsZXZlbCl9LSAje21zZ31cIlxuXHRcdHJldHVyblxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuIyBBU1lOQ1xuXG5leHBvcnQgdHlwZSB3YXRjaGVyQ2FsbGJhY2tGdW5jID0gKGNoYW5nZTogZnNDaGFuZ2VUeXBlKSA9PiBib29sZWFuXG5cbi8qKlxuICogYSBmdW5jdGlvbiB0aGF0IHdhdGNoZXMgZm9yIGNoYW5nZXMgb25lIG9yIG1vcmUgZmlsZXMgb3IgZGlyZWN0b3JpZXNcbiAqICAgIGFuZCBjYWxscyBhIGNhbGxiYWNrIGZ1bmN0aW9uIGZvciBlYWNoIGNoYW5nZS5cbiAqIElmIHRoZSBjYWxsYmFjayByZXR1cm5zIHRydWUsIHdhdGNoaW5nIGlzIGhhbHRlZFxuICpcbiAqIFVzYWdlOlxuICogICBoYW5kbGVyIDo9IChraW5kLCBwYXRoKSA9PiBjb25zb2xlLmxvZyBwYXRoXG4gKiAgIGF3YWl0IHdhdGNoRmlsZSAndGVtcC50eHQnLCBoYW5kbGVyXG4gKiAgIGF3YWl0IHdhdGNoRmlsZSAnc3JjL2xpYicsICBoYW5kbGVyXG4gKiAgIGF3YWl0IHdhdGNoRmlsZSBbJ3RlbXAudHh0JywgJ3NyYy9saWInXSwgaGFuZGxlclxuICovXG5cbmV4cG9ydCB3YXRjaEZpbGUgOj0gKFxuXHRwYXRoOiBzdHJpbmcgfCBzdHJpbmdbXSxcblx0d2F0Y2hlckNCOiB3YXRjaGVyQ2FsbGJhY2tGdW5jLFxuXHRoT3B0aW9uczogb3B0aW9uc3BlYz17fVxuXHQpOiB2b2lkIC0+XG5cblx0e2RlYnVnLCBtc30gOj0gZ2V0T3B0aW9ucyBoT3B0aW9ucywge1xuXHRcdGRlYnVnOiBmYWxzZVxuXHRcdG1zOiAyMDBcblx0XHR9XG5cdERCRyA6PSAobXNnOiBzdHJpbmcpOiB2b2lkID0+XG5cdFx0aWYgZGVidWdcblx0XHRcdGNvbnNvbGUubG9nIG1zZ1xuXHRcdHJldHVyblxuXG5cdERCRyBcIldBVENIOiAje0pTT04uc3RyaW5naWZ5KHBhdGgpfVwiXG5cblx0d2F0Y2hlciA6PSBEZW5vLndhdGNoRnMocGF0aClcblxuXHRsZXQgZG9TdG9wOiBib29sZWFuID0gZmFsc2VcblxuXHRmc0NhbGxiYWNrOiBmc0NhbGxiYWNrRnVuYyA6PSAoe2tpbmQsIHBhdGh9KSA9PlxuXHRcdHJlc3VsdCA6PSB3YXRjaGVyQ0Ioe2tpbmQsIHBhdGh9KVxuXHRcdERCRyBcIkZDQjogcmVzdWx0ID0gI3tyZXN1bHR9XCJcblx0XHRpZiByZXN1bHRcblx0XHRcdHdhdGNoZXIuY2xvc2UoKVxuXHRcdHJldHVyblxuXG5cdGhhbmRsZXIgOj0gbmV3IEZpbGVFdmVudEhhbmRsZXIoZnNDYWxsYmFjaywge2RlYnVnLCBtc30pXG5cblx0Zm9yIGF3YWl0IHtraW5kLCBwYXRoc30gb2Ygd2F0Y2hlclxuXHRcdERCRyBcIndhdGNoZXIgZXZlbnQgZmlyZWRcIlxuXHRcdGlmIGRvU3RvcFxuXHRcdFx0REJHIFwiZG9TdG9wID0gI3tkb1N0b3B9LCBDbG9zaW5nIHdhdGNoZXJcIlxuXHRcdFx0YnJlYWtcbiNcdFx0e2tpbmQsIHBhdGhzfSA6PSBldnRcblx0XHRmb3IgcGF0aCBvZiBwYXRoc1xuXHRcdFx0IyAtLS0gZnNDYWxsYmFjayB3aWxsIGJlIChldmVudHVhbGx5KSBjYWxsZWRcblx0XHRcdGhhbmRsZXIuaGFuZGxlKHtraW5kLCBwYXRofSlcblxuZXhwb3J0IHdhdGNoRmlsZXMgOj0gd2F0Y2hGaWxlXG4iXX0=