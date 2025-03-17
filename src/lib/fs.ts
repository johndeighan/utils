"use strict";
// fs.civet

type AutoPromise<T> = T extends Promise<unknown> ? T : Promise<T>;
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

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3JjL2xpYi9mcy5jaXZldC50c3giLCJzb3VyY2VzIjpbInNyYy9saWIvZnMuY2l2ZXQiXSwibWFwcGluZ3MiOiI7QUFBQSxXQUFVO0FBQ1YsQUFBQTtBQUNBLEssVyxpRDtBQUFBLE1BQU0sQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLElBQUksQ0FBQyxpQkFBaUI7QUFDdkMsQUFBQSxBQUFBLE1BQU0sQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLElBQUksQ0FBQyxxQkFBcUI7QUFDNUMsQUFBQSxBQUFBLE1BQU0sQ0FBQyxDQUFDO0FBQ1IsQ0FBQyxVQUFVLENBQUMsQ0FBQyxZQUFZLENBQUMsQ0FBQyxhQUFhLENBQUM7QUFDekMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFNBQVM7QUFDakIsQUFBQSxBQUFBLE1BQU0sQ0FBQyxDQUFDO0FBQ1IsQ0FBQyxjQUFjLENBQUM7QUFDaEIsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFNBQVM7QUFDakIsQUFBQSxBQUFBLE1BQU0sQ0FBQyxDQUFDLFlBQVksQ0FBQyxDQUFDLElBQUksQ0FBQyxhQUFhO0FBQ3hDLEFBQUE7QUFDQSxBQUFBLHdEQUF1RDtBQUN2RCxBQUFBLGtCQUFpQjtBQUNqQixBQUFBLEFBQUEsTUFBTSxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsSUFBSSxDQUFDLFNBQVM7QUFDaEMsQUFBQTtBQUNBLEFBQUEsQUFBQSxNQUFNLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxXQUFXO0FBQy9CLEFBQUEsQUFBQSxNQUFNLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxVQUFVO0FBQzdCLEFBQUEsQUFBQSxNQUFNLENBQUMsQ0FBQyxjQUFjLENBQUMsQ0FBQyxJQUFJLENBQUMscUJBQXFCO0FBQ2xELEFBQUEsQUFBQSxNQUFNLENBQUMsQ0FBQyxjQUFjLENBQUMsQ0FBQyxJQUFJLENBQUMsY0FBYztBQUMzQyxBQUFBO0FBQ0EsQUFBQSxBQUFBLE1BQU0sQ0FBQyxDQUFDO0FBQ1IsQ0FBQyxLQUFLLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxVQUFVLENBQUM7QUFDNUIsQ0FBQyxRQUFRLENBQUMsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLFNBQVMsQ0FBQztBQUM1RCxDQUFDLE9BQU8sQ0FBQyxDQUFDLGdCQUFnQixDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsUUFBUSxDQUFDO0FBQ3ZELENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsVUFBVSxDQUFDO0FBQ3JDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxnQkFBZ0I7QUFDeEIsQUFBQSxBQUFBLE1BQU0sQ0FBQyxDQUFDO0FBQ1IsQ0FBQyxNQUFNLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxlQUFlLENBQUMsQ0FBQyxJQUFJLENBQUM7QUFDdEQsQ0FBQyxNQUFNLENBQUMsQ0FBQyxZQUFZLENBQUMsQ0FBQyxLQUFLLENBQUM7QUFDN0IsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLGNBQWM7QUFDdEIsQUFBQTtBQUNBLEFBQUEsQUFBSSxNQUFKLElBQUksQ0FBQyxDQUFFLENBQUMsVUFBVSxDQUFDLElBQUk7QUFDdkIsQUFBQSxBQUFBLE1BQU0sQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUM7QUFDdEIsQUFBQSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsU0FBUztBQUNuRCxBQUFBO0FBQ0EsQUFBQSxtQkFBa0I7QUFDbEIsQUFBQSxBQUFPLE1BQVAsT0FBTyxDQUFDLENBQUUsQ0FBQyxHQUFHLENBQUMsV0FBVyxDQUFDLE9BQU8sQ0FBQztBQUNuQyxBQUFBLEFBQU8sTUFBUCxPQUFPLENBQUMsQ0FBRSxDQUFDLEdBQUcsQ0FBQyxXQUFXLENBQUMsQ0FBQztBQUM1QixBQUFBO0FBQ0EsQUFBQSw4RUFBNkU7QUFDN0UsQUFBQTtBQUNBLEFBQUE7QUFDQTtBQUNBO0FBQ0EsR0FBRztBQUNILEFBQUE7QUFDQSxBQUFBLEFBQUEsTUFBTSxDQUFPLE1BQU4sTUFBTSxDQUFDLENBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQSxDQUFBO0FBQzNDLEFBQUE7QUFDQSxBQUFBLENBQUMsTUFBTSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDO0FBQUMsQ0FBQTtBQUNuRCxBQUFBO0FBQ0EsQUFBQSw4RUFBNkU7QUFDN0UsQUFBQTtBQUNBLEFBQUE7QUFDQTtBQUNBO0FBQ0EsR0FBRztBQUNILEFBQUE7QUFDQSxBQUFBLEFBQUEsTUFBTSxDQUFNLE1BQUwsS0FBSyxDQUFDLENBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQSxDQUFBO0FBQzFDLEFBQUE7QUFDQSxBQUFBLENBQUMsTUFBTSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDLFdBQVcsQ0FBQyxDO0FBQUMsQ0FBQTtBQUN4RCxBQUFBO0FBQ0EsQUFBQSw4RUFBNkU7QUFDN0UsQUFBQTtBQUNBLEFBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxHQUFHO0FBQ0gsQUFBQTtBQUNBLEFBQUEsQUFBQSxNQUFNLENBQVksTUFBWCxXQUFXLENBQUMsQ0FBRSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFBLENBQUE7QUFDakQsQUFBQTtBQUNBLEFBQUEsQ0FBQyxNQUFNLENBQUEsQUFBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENB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QUFBLEtBQUssQ0FBQSxDQUFBLENBQUE7QUFDVixBQUFBLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQSxBQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsSUFBSSxDQUFDLEM7RUFBQSxDQUFBO0FBQzFDLEFBQUEsRUFBRSxJQUFJLENBQUEsQ0FBQTtBQUNOLEFBQUEsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFBLEFBQUMsSUFBSSxDO0VBQUEsQztDQUFBLENBQUE7QUFDdkIsQUFBQSxDQUFDLE07QUFBTSxDQUFBO0FBQ1AsQUFBQTtBQUNBLEFBQUEsOEVBQTZFO0FBQzdFLEFBQUE7QUFDQSxBQUFBO0FBQ0E7QUFDQSxHQUFHO0FBQ0gsQUFBQTtBQUNBLEFBQUEsQUFBQSxNQUFNLENBQUMsSUFBQSxhQUFhLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFBLENBQUE7QUFDOUMsQUFBQTtBQUNBLEFBQUEsQ0FBZSxNQUFkLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBRSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUM7QUFDcEMsQUFBQSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLElBQUk7QUFDZixBQUFBLENBQUMsR0FBRyxDQUFDLENBQUEsTUFBQSxJQUFJLENBQUMsRUFBRSxDQUFDLE1BQU0sQ0FBQSxDQUFBLENBQUE7QUFDbkIsQUFBQSxFQUFFLEdBQUcsQyxFQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUM7QUFDbkIsQUFBQSxFQUFFLEdBQUcsQ0FBQSxDQUFJLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQSxDQUFBLENBQUE7QUFDbkIsQUFBQSxHQUFHLEtBQUssQ0FBQSxBQUFDLEdBQUcsQztFQUFBLEM7Q0FBQSxDQUFBO0FBQ1osQUFBQSxDQUFDLE07QUFBTSxDQUFBO0FBQ1AsQUFBQTtBQUNBLEFBQUEsOEVBQTZFO0FBQzdFLEFB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LENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxDLENBQUUsQ0FBQyxDQUFDLEM7RUFBQyxDQUFBO0FBQ3hCLEFBQUE7QUFDQSxBQUFBLEVBQUUsR0FBRyxDQUFBLFVBQVUsQ0FBQyxJLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQSxDQUFBLENBQUE7QUFDM0MsQUFBQSxHQUFHLEksQ0FBQyxHQUFHLENBQUEsQUFBQyxDQUFDLG1CQUFtQixFQUFFLElBQUksQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUMvQyxBQUFBLEdBQU8sTUFBSixJQUFJLENBQUMsQ0FBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQSxDQUFBO0FBQ2hCLEFBQUEsSUFBSSxHQUFHLENBQUEsSSxDQUFDLFFBQVEsQ0FBQSxDQUFBLENBQUE7QUFDaEIsQUFBQSxLQUFLLEksQ0FBQyxRQUFRLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsQztJQUFDLENBQUE7QUFDNUIsQUFBQSxJQUFJLEksQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFBLEFBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQTtBQUMvQixBQUFBLElBQUksSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsQyxDQUFFLENBQUMsS0FBSztBQUNsQyxBQUFBLElBQUksTUFBTSxDQUFDLEs7R0FBSyxDQUFBO0FBQ2hCLEFBQUEsR0FBRyxJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxDLENBQUUsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMsSSxDQUFDLEVBQUUsQztFQUFDLENBQUE7QUFDL0MsQUFBQSxFQUFFLEksQ0FBQyxHQUFHLENBQUEsQUFBQyxDQUFDLDJCQUEyQixFQUFFLElBQUksQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQTtBQUNuRCxBQUFBLEVBQUUsSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO0FBQzFCLEFBQUEsRUFBRSxNO0NBQU0sQ0FBQTtBQUNSLEFBQUE7QUFDQSxBQUFBLENBQUMsU0FBUTtBQUNULEFBQUEsQyxNQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUEsQ0FBQTtBQUNoQixBQUFBLEVBQUUsS0FBSyxDQUFDLEtBQUssQ0FBQSxBQUFDLEksQ0FBQyxFQUFFLENBQUE7QUFDakIsQUFBQSxFQUFFLE1BQU0sQ0FBQyxJLENBQUMsUTtDQUFRLENBQUE7QUFDbEIsQUFBQTtBQUNBLEFBQUEsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQSxDQUFBO0FBQ2hELEFBQUEsRUFBRSxHQUFHLENBQUEsSSxDQUFDLEtBQUssQ0FBQSxDQUFBLENBQUE7QUFDWCxBQUFBLEdBQUcsT0FBTyxDQUFDLEdBQUcsQ0FBQSxBQUFDLENBQUMsR0FBRyxFQUFFLE1BQU0sQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSxFQUFFLEdBQUcsQ0FBQyxDQUFDLEM7RUFBQSxDQUFBO0FBQzlDLEFBQUEsRUFBRSxNO0NBQU0sQztBQUFBLENBQUE7QUFDUixBQUFBO0FBQ0EsQUFBQSw4RUFBNkU7QUFDN0UsQUFBQSxRQUFPO0FBQ1AsQUFBQTtBQUNBLEFBQUEsQUFBQSxNQUFNLENBQUMsSUFBSSxDQUFDLG1CQUFtQixDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLFlBQVksQ0FBQyxDQUFDLEVBQUUsQ0FBQyxPQUFPO0FBQ25FLEFBQUE7QUFDQSxBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsR0FBRztBQUNILEFBQUE7QUFDQSxBQUFBLEFBQUEsTUFBTSxDQUFVLE1BQVQsU0FBUyxDQUFDLENBQUUsQyxNQUlWLFFBSlcsQ0FBQztBQUNyQixBQUFBLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDO0FBQ3pCLEFBQUEsQ0FBQyxTQUFTLENBQUMsQ0FBQyxtQkFBbUIsQ0FBQztBQUNoQyxBQUFBLENBQUMsUUFBUSxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQztBQUN4QixDQUFDLENBQUMsQyxDLFcsQ0FBQyxBQUFDLEksQ0FBTyxDQUFBLENBQUE7QUFDWCxBQUFBO0FBQ0EsQUFBQSxDQUFZLE1BQVgsQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFFLENBQUMsVUFBVSxDQUFBLEFBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQztBQUN0QyxBQUFBLEVBQUUsS0FBSyxDQUFDLENBQUMsS0FBSyxDQUFBO0FBQ2QsQUFBQSxFQUFFLEVBQUUsQ0FBQyxDQUFDLEdBQUc7QUFDVCxFQUFFLENBQUMsQ0FBQTtBQUNILEFBQUEsQ0FBSSxNQUFILEdBQUcsQ0FBQyxDQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUEsQ0FBQTtBQUM5QixBQUFBLEVBQUUsR0FBRyxDQUFBLEtBQUssQ0FBQSxDQUFBLENBQUE7QUFDVixBQUFBLEdBQUcsT0FBTyxDQUFDLEdBQUcsQ0FBQSxBQUFDLEdBQUcsQztFQUFBLENBQUE7QUFDbEIsQUFBQSxFQUFFLE07Q0FBTSxDQUFBO0FBQ1IsQUFBQTtBQUNBLEFBQUEsQ0FBQyxHQUFHLENBQUEsQUFBQyxDQUFDLE9BQU8sRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUNyQyxBQUFBO0FBQ0EsQUFBQSxDQUFRLE1BQVAsT0FBTyxDQUFDLENBQUUsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQztBQUM5QixBQUFBO0FBQ0EsQUFBQSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLEtBQUs7QUFDNUIsQUFBQTtBQUNBLEFBQUEsQ0FBMkIsTUFBMUIsVUFBVSxDQUFDLENBQUMsY0FBYyxDQUFDLENBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUEsQ0FBQTtBQUNoRCxBQUFBLEVBQVEsTUFBTixNQUFNLENBQUMsQ0FBRSxDQUFDLFNBQVMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQ25DLEFBQUEsRUFBRSxHQUFHLENBQUEsQUFBQyxDQUFDLGNBQWMsRUFBRSxNQUFNLENBQUMsQ0FBQyxDQUFBO0FBQy9CLEFBQUEsRUFBRSxHQUFHLENBQUEsTUFBTSxDQUFBLENBQUEsQ0FBQTtBQUNYLEFBQUEsR0FBRyxPQUFPLENBQUMsS0FBSyxDQUFDLEM7RUFBQyxDQUFBO0FBQ2xCLEFBQUEsRUFBRSxNO0NBQU0sQ0FBQTtBQUNSLEFBQUE7QUFDQSxBQUFBLENBQVEsTUFBUCxPQUFPLENBQUMsQ0FBRSxDQUFDLEdBQUcsQ0FBQyxnQkFBZ0IsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDO0FBQ3pELEFBQUE7QUFDQSxBQUFBLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFBLE1BQUEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsT0FBTyxDQUFBLENBQUEsQ0FBQTtBQUNuQyxBQUFBLEVBQUUsR0FBRyxDQUFBLEFBQUMscUJBQXFCLENBQUE7QUFDM0IsQUFBQSxFQUFFLEdBQUcsQ0FBQSxNQUFNLENBQUEsQ0FBQSxDQUFBO0FBQ1gsQUFBQSxHQUFHLEdBQUcsQ0FBQSxBQUFDLENBQUMsU0FBUyxFQUFFLE1BQU0sQ0FBQyxpQkFBaUIsQ0FBQyxDQUFBO0FBQzVDLEFBQUEsR0FBRyxLO0VBQUssQ0FBQTtBQUNSLEFBQUEsd0JBQXVCO0FBQ3ZCLEFBQUEsRUFBRSxHQUFHLENBQUMsQ0FBQSxNQUFBLElBQUksQ0FBQyxFQUFFLENBQUMsS0FBSyxDQUFBLENBQUEsQ0FBQTtBQUNuQixBQUFBLEdBQUcsNkNBQTRDO0FBQy9DLEFBQUEsR0FBRyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLEM7RUFBQyxDO0NBQUEsQztBQUFBLENBQUE7QUFDL0IsQUFBQTtBQUNBLEFBQUEsQUFBQSxNQUFNLENBQVcsTUFBVixVQUFVLENBQUMsQ0FBRSxDQUFDLFNBQVM7QUFDOUIiLCJuYW1lcyI6W10sInNvdXJjZXNDb250ZW50IjpbIiMgZnMuY2l2ZXRcblxuaW1wb3J0IHtzcHJpbnRmfSBmcm9tIFwiQHN0ZC9mbXQvcHJpbnRmXCJcbmltcG9ydCB7ZGVib3VuY2V9IGZyb20gJ0BzdGQvYXN5bmMvZGVib3VuY2UnXG5pbXBvcnQge1xuXHRleGlzdHNTeW5jLCBlbXB0eURpclN5bmMsIGVuc3VyZURpclN5bmMsXG5cdH0gZnJvbSAnQHN0ZC9mcydcbmltcG9ydCB7XG5cdGFwcGVuZEZpbGVTeW5jLFxuXHR9IGZyb20gJ25vZGU6ZnMnXG5pbXBvcnQge0V2ZW50RW1pdHRlcn0gZnJvbSAnbm9kZTpldmVudHMnXG5cbiMgLS0tIERlbm8ncyBzdGF0U3luYyBhbmQgbHN0YXRTeW5jIGFyZSBzdGlsbCB1bnN0YWJsZSxcbiMgICAgIHNvIHVzZSB0aGlzXG5pbXBvcnQge3N0YXRTeW5jfSBmcm9tICdub2RlOmZzJ1xuXG5pbXBvcnQgcGF0aExpYiBmcm9tICdub2RlOnBhdGgnXG5pbXBvcnQgdXJsTGliIGZyb20gJ25vZGU6dXJsJ1xuaW1wb3J0IHtleHBhbmRHbG9iU3luY30gZnJvbSAnQHN0ZC9mcy9leHBhbmQtZ2xvYidcbmltcG9ydCB7VGV4dExpbmVTdHJlYW19IGZyb20gJ0BzdGQvc3RyZWFtcydcblxuaW1wb3J0IHtcblx0dW5kZWYsIGRlZmluZWQsIG5vdGRlZmluZWQsXG5cdGlzU3RyaW5nLCBpc05vbkVtcHR5U3RyaW5nLCBpc0Jvb2xlYW4sIGlzTnVtYmVyLCBpc0ludGVnZXIsXG5cdGlzQXJyYXksIGlzQXJyYXlPZlN0cmluZ3MsIGlzSGFzaCwgaXNPYmplY3QsIGlzUmVnRXhwLFxuXHRpbnRlZ2VyLCBoYXNoLCB2b2lkRnVuYywgb3B0aW9uc3BlYyxcblx0fSBmcm9tICcuL2RhdGF0eXBlcy50cydcbmltcG9ydCB7XG5cdGFzc2VydCwgY3JvYWssIE9MLCBnZXRPcHRpb25zLCByZW1vdmVFbXB0eUtleXMsIHBhc3MsXG5cdHNwYWNlcywgc2luY2VMb2FkU3RyLCBzbGVlcCxcblx0fSBmcm9tICcuL2xsdXRpbHMudHMnXG5cbkRlbm8gOj0gZ2xvYmFsVGhpcy5EZW5vXG5leHBvcnQgdHlwZSBwYXRoVHlwZSA9XG5cdCdtaXNzaW5nJyB8ICdmaWxlJyB8ICdkaXInIHwgJ3N5bWxpbmsnIHwgJ3Vua25vd24nXG5cbiMgLS0tIG5vdCBleHBvcnRlZFxuZGVjb2RlciA6PSBuZXcgVGV4dERlY29kZXIoJ3V0Zi04JylcbmVuY29kZXIgOj0gbmV3IFRleHRFbmNvZGVyKClcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuLyoqXG4gKiByZXR1cm5zIGEgYm9vbGVhbiBpbmRpY2F0aW5nIGlmIHRoZSBnaXZlbiBwYXRoIGV4aXN0c1xuICogYW5kIGlzIGEgZmlsZVxuICovXG5cbmV4cG9ydCBpc0ZpbGUgOj0gKHBhdGg6IHN0cmluZyk6IGJvb2xlYW4gPT5cblxuXHRyZXR1cm4gZXhpc3RzU3luYyhwYXRoKSAmJiBzdGF0U3luYyhwYXRoKS5pc0ZpbGUoKVxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKipcbiAqIHJldHVybnMgYSBib29sZWFuIGluZGljYXRpbmcgb2YgdGhlIGdpdmVuIHBhdGggZXhpc3RzXG4gKiBhbmQgaXMgYSBkaXJlY3RvcnlcbiAqL1xuXG5leHBvcnQgaXNEaXIgOj0gKHBhdGg6IHN0cmluZyk6IGJvb2xlYW4gPT5cblxuXHRyZXR1cm4gZXhpc3RzU3luYyhwYXRoKSAmJiBzdGF0U3luYyhwYXRoKS5pc0RpcmVjdG9yeSgpXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogcmV0dXJucyBvbmUgb2Y6XG4gKiAgICAnbWlzc2luZycgIC0gZG9lcyBub3QgZXhpc3RcbiAqICAgICdkaXInICAgICAgLSBpcyBhIGRpcmVjdG9yeVxuICogICAgJ2ZpbGUnICAgICAtIGlzIGEgZmlsZVxuICogICAgJ3N5bWxpbmsnICAtIGlzIGEgc3ltbGlua1xuICogICAgJ3Vua25vd24nICAtIGV4aXN0cywgYnV0IG5vdCBhIGZpbGUsIGRpcmVjdG9yeSBvciBzeW1saW5rXG4gKi9cblxuZXhwb3J0IGdldFBhdGhUeXBlIDo9IChwYXRoOiBzdHJpbmcpOiBwYXRoVHlwZSA9PlxuXG5cdGFzc2VydCBpc1N0cmluZyhwYXRoKSwgXCJub3QgYSBzdHJpbmc6ICN7T0wocGF0aCl9XCJcblx0aWYgbm90IGV4aXN0c1N5bmMgcGF0aFxuXHRcdHJldHVybiAnbWlzc2luZydcblx0aCA6PSBzdGF0U3luYyhwYXRoKVxuXHRyZXR1cm4gKFxuXHRcdCAgaC5pc0ZpbGUoKSAgICAgICAgID8gJ2ZpbGUnXG5cdFx0OiBoLmlzRGlyZWN0b3J5KCkgICAgPyAnZGlyJ1xuXHRcdDogaC5pc1N5bWJvbGljTGluaygpID8gJ3N5bWxpbmsnXG5cdFx0OiAgICAgICAgICAgICAgICAgICAgICAndW5rbm93bidcblx0XHQpXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogZXh0cmFjdCB0aGUgZmlsZSBleHRlbnNpb24gZnJvbSBhIHBhdGgsIGluY2x1ZGluZ1xuICogdGhlIGxlYWRpbmcgcGVyaW9kXG4gKi9cblxuZXhwb3J0IGZpbGVFeHQgOj0gKHBhdGg6IHN0cmluZyk6IHN0cmluZyA9PlxuXG5cdGlmIGxNYXRjaGVzIDo9IHBhdGgubWF0Y2goL1xcLlteXFwuXSskLylcblx0XHRyZXR1cm4gbE1hdGNoZXNbMF1cblx0ZWxzZVxuXHRcdHJldHVybiAnJ1xuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKipcbiAqIHJldHVybiB0aGUgZ2l2ZW4gcGF0aCwgYnV0IHdpdGggdGhlIGdpdmVuIGZpbGUgZXh0ZW5zaW9uXG4gKiByZXBsYWNpbmcgdGhlIGV4aXN0aW5nIGZpbGUgZXh0ZW5zaW9uXG4gKi9cblxuZXhwb3J0IHdpdGhFeHQgOj0gKHBhdGg6IHN0cmluZywgZXh0OiBzdHJpbmcpOiBzdHJpbmcgPT5cblxuXHRhc3NlcnQgZXh0LnN0YXJ0c1dpdGgoJy4nKSwgXCJCYWQgZmlsZSBleHRlbnNpb246ICN7ZXh0fVwiXG5cdGxNYXRjaGVzIDo9IHBhdGgubWF0Y2goL14oLiopKFxcLlteXFwuXSspJC8pXG5cdGlmIChsTWF0Y2hlcyA9PSBudWxsKVxuXHRcdHRocm93IG5ldyBFcnJvcihcIkJhZCBwYXRoOiAnI3twYXRofSdcIilcblx0W18sIGhlYWRTdHIsIG9yZ0V4dF0gOj0gbE1hdGNoZXNcblx0cmV0dXJuIFwiI3toZWFkU3RyfSN7ZXh0fVwiXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbmV4cG9ydCBsU3RhdEZpZWxkczogc3RyaW5nW10gOj0gW1xuXHQnZGV2JywnaW5vJywnbW9kZScsJ25saW5rJywndWlkJywnZ2lkJywncmRldicsXG5cdCdzaXplJywnYmxrc2l6ZScsJ2Jsb2NrcycsXG5cdCdhdGltZU1zJywnbXRpbWVNcycsJ2N0aW1lTXMnLCdiaXJ0aHRpbWVNcycsXG5cdCdhdGltZScsJ210aW1lJywnY3RpbWUnLCdiaXJ0aHRpbWUnLFxuXHRdXG5cbi8qKlxuICogcmV0dXJuIHN0YXRpc3RpY3MgZm9yIGEgZmlsZSBvciBkaXJlY3RvcnlcbiAqL1xuXG5leHBvcnQgZ2V0U3RhdHMgOj0gKHBhdGg6IHN0cmluZyk6IGhhc2ggPT5cblxuXHRyZXR1cm4gc3RhdFN5bmMocGF0aClcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuXG4vKipcbiAqIHBhcnNlcyBhIHBhdGggb3IgZmlsZSBVUkwsIGFuZCByZXR1cm5zIGEgaGFzaCB3aXRoIGtleXM6XG4gKiBcdHR5cGU6IHBhdGhUeXBlIC0gJ2ZpbGUnLCdkaXInLCdzeW1saW5rJywnbWlzc2luZycgb3IgJ3Vua25vd24nXG4gKiBcdHBhdGg6IHN0cmluZ1xuICogXHRyb290OiBzdHJpbmdcbiAqIFx0ZGlyOiBzdHJpbmdcbiAqIFx0ZmlsZU5hbWU6IHN0cmluZ1xuICogXHRzdHViOiBzdHJpbmc/XG4gKiBcdHB1cnBvc2U6IHN0cmluZz9cbiAqIFx0ZXh0OiBzdHJpbmc/XG4gKiBcdHJlbFBhdGg6IHN0cmluZ1xuICogXHRyZWxEaXI6IHN0cmluZ1xuICovXG5cbmV4cG9ydCB0eXBlIHBhdGhJbmZvID0ge1xuXHR0eXBlOiBwYXRoVHlwZSAgIyAnZmlsZScsJ2RpcicsJ3N5bWxpbmsnLCdtaXNzaW5nJyBvciAndW5rbm93bidcblx0cGF0aDogc3RyaW5nXG5cdHJvb3Q6IHN0cmluZ1xuXHRkaXI6IHN0cmluZ1xuXHRmaWxlTmFtZTogc3RyaW5nXG5cdHN0dWI6IHN0cmluZz9cblx0cHVycG9zZTogc3RyaW5nP1xuXHRleHQ6IHN0cmluZz9cblx0cmVsUGF0aDogc3RyaW5nXG5cdHJlbERpcjogc3RyaW5nXG5cdH1cblxuZXhwb3J0IHBhcnNlUGF0aCA6PSAocGF0aDogc3RyaW5nKTogcGF0aEluZm8gPT5cblxuXHQjIC0tLSBOT1RFOiBwYXRoIG1heSBiZSBhIGZpbGUgVVJMLCBlLmcuIGltcG9ydC5tZXRhLnVybFxuXHQjICAgICAgICAgICBwYXRoIG1heSBiZSBhIHJlbGF0aXZlIHBhdGhcblxuXHRhc3NlcnQgaXNOb25FbXB0eVN0cmluZyhwYXRoKSwgXCJwYXRoIG5vdCBhIHN0cmluZyAje09MKHBhdGgpfVwiXG5cdGlmIGRlZmluZWQocGF0aC5tYXRjaCgvXmZpbGVcXDpcXC9cXC8vKSlcblx0XHRwYXRoID0gdXJsTGliLmZpbGVVUkxUb1BhdGgocGF0aClcblx0cGF0aCA9IG5vcm1hbGl6ZVBhdGggcGF0aFxuXG5cdHtyb290LCBkaXIsIGJhc2U6IGZpbGVOYW1lfSA6PSBwYXRoTGliLnBhcnNlKHBhdGgpXG5cblx0bFBhcnRzIDo9IGZpbGVOYW1lLnNwbGl0KCcuJylcblx0W3N0dWIsIHB1cnBvc2UsIGV4dF0gOj0gc3dpdGNoIGxQYXJ0cy5sZW5ndGhcblx0XHR3aGVuIDBcblx0XHRcdGNyb2FrIFwiQ2FuJ3QgaGFwcGVuXCJcblx0XHR3aGVuIDFcblx0XHRcdFtmaWxlTmFtZSwgdW5kZWYsIHVuZGVmXVxuXHRcdHdoZW4gMlxuXHRcdFx0W2xQYXJ0c1swXSwgdW5kZWYsIFwiLiN7bFBhcnRzWzFdfVwiXVxuXHRcdGVsc2Vcblx0XHRcdFtcblx0XHRcdFx0bFBhcnRzLnNsaWNlKDAsIC0yKS5qb2luKCcuJyksXG5cdFx0XHRcdGxQYXJ0cy5hdCgtMiksXG5cdFx0XHRcdFwiLiN7bFBhcnRzLmF0KC0xKX1cIlxuXHRcdFx0XHRdXG5cblx0IyAtLS0gR3JhYiBldmVyeXRoaW5nIHVwIHVudGlsIHRoZSBsYXN0IHBhdGggc2VwYXJhdG9yLCBpZiBhbnlcblx0cmVsUGF0aCA6PSByZWxwYXRoIHBhdGhcblx0bFBhdGhNYXRjaGVzIDo9IHJlbFBhdGgubWF0Y2goL14oLiopW1xcXFxcXC9dW15cXFxcXFwvXSokLylcblx0cmVsRGlyIDo9IChsUGF0aE1hdGNoZXMgPT0gbnVsbCkgPyAnLicgOiBsUGF0aE1hdGNoZXNbMV1cblxuXHRyZXR1cm4ge1xuXHRcdHR5cGU6IGdldFBhdGhUeXBlKHBhdGgpXG5cdFx0cGF0aFxuXHRcdHJvb3Rcblx0XHRkaXJcblx0XHRmaWxlTmFtZVxuXHRcdHN0dWJcblx0XHRwdXJwb3NlXG5cdFx0ZXh0XG5cdFx0cmVsUGF0aFxuXHRcdHJlbERpclxuXHRcdH1cblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuLyoqXG4gKiBnZW5lcmF0ZSBmaWxlcyB0aGF0IG1hdGNoIGEgZ2l2ZW4gZ2xvYiBwYXR0ZXJuXG4gKiB5aWVsZHMge3BhdGgsIG5hbWUsIGlzRmlsZSwgaXNEaXJlY3RvcnksIGlzU3ltbGlua31cbiAqICAgIHdpdGggcGFyc2Ugb3B0aW9uLCBhbHNvIGluY2x1ZGVzIGtleXM6XG4gKiAgICAgICByZWxQYXRoXG4gKiBUaGVzZSBvcHRpb25zIG1heSBiZSBzcGVjaWZpZWQgaW4gdGhlIDJuZCBwYXJhbWV0ZXI6XG4gKiAgICByb290OiBzdHJpbmcgLSByb290IG9mIHNlYXJjaCwgKGRlZjogRGVuby5jd2QoKSlcbiAqICAgIGxFeGNsdWRlOiBbc3RyaW5nXSAtIHBhdHRlcm5zIHRvIGV4Y2x1ZGUsXG4gKiAgICBcdGRlZjogWydub2RlX21vZHVsZXMvKionLCAnLmdpdC8qKiddXG4gKiAgICBpbmNsdWRlRGlyczogYm9vbGVhbiAtIHNob3VsZCBkaXJlY3RvcmllcyBiZSBpbmNsdWRlZD8gKGRlZjogdHJ1ZSlcbiAqIFx0Zm9sbG93U3ltbGlua3MgLSBib29sZWFuIC0gc2hvdWxkIHN5bSBsaW5rcyBiZSBmb2xsb3dlZD8gKGRlZjogZmFsc2UpXG4gKiBcdGNhbm9uaWNhbGl6ZTogYm9vbGVhbiAtIGlmIGZvbGxvd3N5bWxpbmtzIGlzIHRydWUsIHNob3VsZFxuICogXHRcdHBhdGhzIGJlIGNhbm9uaWNhbGl6ZWQ/IChkZWY6IHRydWUpXG4gKiBcdGZpbHRlcjogKHN0cmluZy0+Ym9vbGVhbikgLSB5aWVsZCBvbmx5IGlmIGZ1bmN0aW9uIHJldHVybnMgdHJ1ZVxuICovXG5cbmV4cG9ydCBhbGxGaWxlc01hdGNoaW5nIDo9IChcblx0cGF0dGVybjogc3RyaW5nPScqKicsXG5cdGhPcHRpb25zOiBvcHRpb25zcGVjPXt9XG5cdCk6IEdlbmVyYXRvcjxoYXNoLCB2b2lkLCB1bmtub3duPiAtPlxuXG5cdHtcblx0XHRyb290XG5cdFx0bEV4Y2x1ZGVcblx0XHRpbmNsdWRlRGlyc1xuXHRcdGZvbGxvd1N5bWxpbmtzXG5cdFx0Y2Fub25pY2FsaXplXG5cdFx0ZmlsdGVyXG5cdFx0ZGVidWdcblx0XHR9IDo9IGdldE9wdGlvbnMgaE9wdGlvbnMsIHtcblx0XHRcdHJvb3Q6IHVuZGVmXG5cdFx0XHRsRXhjbHVkZTogWydub2RlX21vZHVsZXMvKionLCAnLmdpdC8qKiddXG5cdFx0XHRpbmNsdWRlRGlyczogZmFsc2Vcblx0XHRcdGZvbGxvd1N5bWxpbmtzOiBmYWxzZVxuXHRcdFx0Y2Fub25pY2FsaXplOiBmYWxzZVxuXHRcdFx0ZmlsdGVyOiB1bmRlZlxuXHRcdFx0ZGVidWc6IGZhbHNlXG5cdFx0XHR9XG5cblx0aEdsb2JPcHRpb25zIDo9IHtcblx0XHRyb290XG5cdFx0ZXhjbHVkZTogbEV4Y2x1ZGVcblx0XHRpbmNsdWRlRGlyc1xuXHRcdGZvbGxvd1N5bWxpbmtzXG5cdFx0Y2Fub25pY2FsaXplXG5cdFx0fVxuXG5cdERCRyA6PSAobXNnOiBzdHJpbmcpOiB2b2lkID0+XG5cdFx0aWYgZGVidWdcblx0XHRcdGNvbnNvbGUubG9nIG1zZ1xuXHRcdHJldHVyblxuXG5cdGZvciBoIG9mIGV4cGFuZEdsb2JTeW5jKHBhdHRlcm4sIGhHbG9iT3B0aW9ucylcblx0XHQjIC0tLSBoIGhhcyBrZXlzOiBwYXRoLCBuYW1lLCBpc0ZpbGUsIGlzRGlyZWN0b3J5LCBpc1N5bUxpbmtcblxuXHRcdERCRyBcIk1BVENIOiAje2gucGF0aH1cIlxuXHRcdHR5cGUgOj0gKFxuXHRcdFx0ICBoLmlzRmlsZSAgICAgID8gJ2ZpbGUnXG5cdFx0XHQ6IGguaXNEaXJlY3RvcnkgPyAnZGlyJ1xuXHRcdFx0OiBoLmlzU3ltbGluayAgID8gJ3N5bWxpbmsnXG5cdFx0XHQ6ICAgICAgICAgICAgICAgICAndW5rbm93bidcblx0XHRcdClcblx0XHRoRmlsZSA6PSBwYXJzZVBhdGgoaC5wYXRoKVxuXHRcdGlmIG5vdGRlZmluZWQoZmlsdGVyKVxuXHRcdFx0REJHIFwiICAgLSBubyBmaWx0ZXJcIlxuXHRcdFx0eWllbGQgaEZpbGVcblx0XHRlbHNlIGlmIGZpbHRlcihoRmlsZSlcblx0XHRcdERCRyBcIiAgIC0gYWxsb3dlZCBieSBmaWx0ZXJcIlxuXHRcdFx0eWllbGQgaEZpbGVcblx0XHRlbHNlXG5cdFx0XHREQkcgXCIgICAtIGV4Y2x1ZGVkIGJ5IGZpbHRlclwiXG5cdHJldHVyblxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuIyBBU1lOQyBJVEVSQUJMRVxuXG4vKipcbiAqIEFuIGFzeW5jIGl0ZXJhYmxlIC0geWllbGRzIGV2ZXJ5IGxpbmUgaW4gdGhlIGdpdmVuIGZpbGVcbiAqXG4gKiBVc2FnZTpcbiAqICAgZm9yIGF3YWl0IGxpbmUgb2YgYWxsTGluZXNJbignc3JjL2xpYi90ZW1wLmNpdmV0JylcbiAqIFx0ICBjb25zb2xlLmxvZyBcIkxJTkU6ICN7bGluZX1cIlxuICogICBjb25zb2xlLmxvZyBcIkRPTkVcIlxuICovXG5cbmV4cG9ydCBhbGxMaW5lc0luIDo9IChcblx0cGF0aDogc3RyaW5nXG5cdCk6IEFzeW5jR2VuZXJhdG9yPHN0cmluZywgdm9pZCwgdW5rbm93bj4gLT5cblxuXHRhc3NlcnQgaXNGaWxlKHBhdGgpLCBcIk5vIHN1Y2ggZmlsZTogI3tPTChwYXRoKX0gKGFsbExpbmVzSW4pXCJcblx0ZiA6PSBhd2FpdCBEZW5vLm9wZW4ocGF0aClcblx0cmVhZGFibGUgOj0gZi5yZWFkYWJsZVxuXHRcdC5waXBlVGhyb3VnaChuZXcgVGV4dERlY29kZXJTdHJlYW0oKSlcblx0XHQucGlwZVRocm91Z2gobmV3IFRleHRMaW5lU3RyZWFtKCkpXG5cblx0Zm9yIGF3YWl0IGxpbmUgb2YgcmVhZGFibGVcblx0XHR5aWVsZCBsaW5lXG5cdHJldHVyblxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKipcbiAqIGNvbnZlcnRzIGFsbCBiYWNrc2xhc2ggY2hhcmFjdGVycyB0byBmb3J3YXJkIHNsYXNoZXNcbiAqIHVwcGVyLWNhc2VzIGRyaXZlIGxldHRlcnNcbiAqL1xuXG5leHBvcnQgbm9ybWFsaXplUGF0aCA6PSAocGF0aDogc3RyaW5nKTogc3RyaW5nID0+XG5cblx0bnBhdGggOj0gcGF0aC5yZXBsYWNlQWxsKCdcXFxcJywgJy8nKVxuXHRpZiAobnBhdGguY2hhckF0KDEpID09ICc6Jylcblx0XHRyZXR1cm4gbnBhdGguY2hhckF0KDApLnRvVXBwZXJDYXNlKCkgKyBucGF0aC5zdWJzdHJpbmcoMSlcblx0ZWxzZVxuXHRcdHJldHVybiBucGF0aFxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKipcbiAqIHJlc29sdmVzIG11bHRpcGxlIHBhdGggcGFydHMgdG8gYSBzaW5nbGUgcGF0aFxuICogcmV0dXJucyBub3JtYWxpemVkIHBhdGhcbiAqL1xuXG5leHBvcnQgbWtwYXRoIDo9IChsUGFydHMuLi46IHN0cmluZ1tdKTogc3RyaW5nID0+XG5cblx0cGF0aCA6PSBwYXRoTGliLnJlc29sdmUobFBhcnRzLi4uKVxuXHRyZXR1cm4gbm9ybWFsaXplUGF0aChwYXRoKVxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKipcbiAqIHJlc29sdmVzIG11bHRpcGxlIHBhdGggcGFydHMgdG8gYSBzaW5nbGUgcGF0aFxuICogcmV0dXJucyBub3JtYWxpemVkIHBhdGgsIHJlbGF0aXZlIHRvIGN1cnJlbnQgZGlyZWN0b3J5XG4gKi9cblxuZXhwb3J0IHJlbHBhdGggOj0gKGxQYXJ0cy4uLjogc3RyaW5nW10pOiBzdHJpbmcgPT5cblxuXHRhc3NlcnQgaXNBcnJheU9mU3RyaW5ncyhsUGFydHMpLCBcIkJhZCBsUGFydHM6ICN7T0wobFBhcnRzKX1cIlxuXHRmdWxsUGF0aCA6PSBwYXRoTGliLnJlc29sdmUgbFBhcnRzLi4uXG5cdHJldHVybiBub3JtYWxpemVQYXRoIHBhdGhMaWIucmVsYXRpdmUoJycsIGZ1bGxQYXRoKVxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG5leHBvcnQgdHlwZSBwYXRoRGVzYyA9IHtcblx0ZGlyOiBzdHJpbmdcblx0cm9vdDogc3RyaW5nXG5cdGxQYXJ0czogc3RyaW5nW11cblx0fVxuXG4vKipcbiAqIHJldHVybnMge2Rpciwgcm9vdCwgbFBhcnRzfSB3aGVyZSBsUGFydHMgaW5jbHVkZXMgdGhlIG5hbWVzIG9mXG4gKiBhbGwgZGlyZWN0b3JpZXMgYmV0d2VlbiB0aGUgcm9vdCBhbmQgdGhlIGZpbGUgbmFtZVxuICogcmVsYXRpdmUgdG8gdGhlIGN1cnJlbnQgd29ya2luZyBkaXJlY3RvcnlcbiAqL1xuXG5leHBvcnQgcGF0aFN1YkRpcnMgPSAocGF0aDogc3RyaW5nLCBoT3B0aW9uczogb3B0aW9uc3BlYz17fSk6IHBhdGhEZXNjID0+XG5cblx0e3JlbGF0aXZlfSA6PSBnZXRPcHRpb25zIGhPcHRpb25zLCB7XG5cdFx0cmVsYXRpdmU6IGZhbHNlXG5cdFx0fVxuXHRwYXRoID0gcmVsYXRpdmUgPyByZWxwYXRoKHBhdGgpIDogbWtwYXRoKHBhdGgpXG5cdHtyb290LCBkaXJ9IDo9IHBhdGhMaWIucGFyc2UocGF0aClcblx0cmV0dXJuIHtcblx0XHRkaXJcblx0XHRyb290XG5cdFx0bFBhcnRzOiBkaXIuc2xpY2Uocm9vdC5sZW5ndGgpLnNwbGl0KC9bXFxcXFxcL10vKVxuXHRcdH1cblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiMgLS0tIFNob3VsZCBiZSBjYWxsZWQgbGlrZTogbXlzZWxmKGltcG9ydC5tZXRhLnVybClcbiMgICAgIHJldHVybnMgZnVsbCBwYXRoIG9mIGN1cnJlbnQgZmlsZVxuXG5leHBvcnQgbXlzZWxmIDo9ICh1cmw6IHN0cmluZyk6IHN0cmluZyA9PlxuXG5cdHJldHVybiByZWxwYXRoIHVybExpYi5maWxlVVJMVG9QYXRoKHVybClcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKipcbiAqIHJlYWQgYSBmaWxlIGludG8gYSBzdHJpbmdcbiAqL1xuXG5leHBvcnQgc2x1cnAgOj0gKHBhdGg6IHN0cmluZyk6IHN0cmluZyA9PlxuXG5cdGFzc2VydCBpc0ZpbGUocGF0aCksIFwiTm8gc3VjaCBmaWxlOiAje3BhdGh9IChzbHVycClcIlxuXHRkYXRhIDo9IERlbm8ucmVhZEZpbGVTeW5jIHBhdGhcblx0cmV0dXJuIGRlY29kZXIuZGVjb2RlKGRhdGEpLnJlcGxhY2VBbGwoJ1xccicsICcnKVxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKipcbiAqIHdyaXRlIGEgc3RyaW5nIHRvIGEgZmlsZVxuICogd2lsbCBlbnN1cmUgdGhhdCBhbGwgbmVjZXNzYXJ5IGRpcmVjdG9yaWVzIGV4aXN0XG4gKi9cblxuZXhwb3J0IGJhcmYgOj0gKFxuXHRjb250ZW50czogc3RyaW5nLFxuXHRwYXRoOiBzdHJpbmcsXG5cdGhPcHRpb25zOiBvcHRpb25zcGVjPXt9XG5cdCk6IHZvaWQgPT5cblxuXHR7YXBwZW5kfSA6PSBnZXRPcHRpb25zIGhPcHRpb25zLCB7XG5cdFx0YXBwZW5kOiBmYWxzZVxuXHRcdH1cblx0bWtEaXJzRm9yRmlsZShwYXRoKVxuXHRkYXRhIDo9IGVuY29kZXIuZW5jb2RlKGNvbnRlbnRzKVxuXHRpZiBhcHBlbmQgJiYgaXNGaWxlKHBhdGgpXG5cdFx0YXBwZW5kRmlsZVN5bmMgcGF0aCwgZGF0YVxuXHRlbHNlXG5cdFx0RGVuby53cml0ZUZpbGVTeW5jIHBhdGgsIGRhdGFcblx0cmV0dXJuXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbmV4cG9ydCBuZXdlckRlc3RGaWxlRXhpc3RzIDo9IChcblx0c3JjUGF0aDogc3RyaW5nLFxuXHRkZXN0UGF0aDogc3RyaW5nXG5cdCk6IGJvb2xlYW4gPT5cblxuXHRhc3NlcnQgaXNGaWxlKHNyY1BhdGgpLCBcIk5vIHN1Y2ggZmlsZTogI3tPTChzcmNQYXRoKX0gKG5ld2VyRGVzdEZpbGVFeGlzdHMpXCJcblx0aWYgbm90IGV4aXN0c1N5bmMoZGVzdFBhdGgpXG5cdFx0cmV0dXJuIGZhbHNlXG5cdHNyY01vZFRpbWUgOj0gc3RhdFN5bmMoc3JjUGF0aCkubXRpbWVNc1xuXHRkZXN0TW9kVGltZSA6PSBzdGF0U3luYyhkZXN0UGF0aCkubXRpbWVNc1xuXHRyZXR1cm4gKGRlc3RNb2RUaW1lID4gc3JjTW9kVGltZSlcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuLyoqXG4gKiBjcmVhdGUgYSBuZXcgZGlyZWN0b3J5IGlmIGl0IGRvZXNuJ3QgZXhpc3RcbiAqIGlmIHRoZSBvcHRpb24gJ2NsZWFyJyBpcyBzZXQgdG8gYSB0cnVlIHZhbHVlIGluIHRoZSAybmQgcGFyYW1ldGVyXG4gKiBhbmQgdGhlIGRpcmVjdG9yeSBhbHJlYWR5IGV4aXN0cywgaXQgaXMgY2xlYXJlZFxuICovXG5cbmV4cG9ydCBta0RpciA9IChkaXJQYXRoOiBzdHJpbmcsIGNsZWFyOiBib29sZWFuPWZhbHNlKTogdm9pZCA9PlxuXG5cdGlmIGNsZWFyXG5cdFx0ZW1wdHlEaXJTeW5jIGRpclBhdGggICAgIyAtLS0gY3JlYXRlcyBpZiBpdCBkb2Vzbid0IGV4aXN0XG5cdGVsc2Vcblx0XHRlbnN1cmVEaXJTeW5jIGRpclBhdGhcblx0cmV0dXJuXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogcmVtb3ZlIGEgZmlsZSBmcm9tIHRoZSBmaWxlIHN5c3RlbSwgYnV0IGRvIG5vdGhpbmdcbiAqIGlmIHRoZSBmaWxlIGRvZXMgbm90IGV4aXN0XG4gKi9cblxuZXhwb3J0IHJtRmlsZSA6PSAocGF0aDogc3RyaW5nKTogdm9pZCA9PlxuXG5cdGlmIGV4aXN0c1N5bmMgcGF0aFxuXHRcdERlbm8ucmVtb3ZlU3luYyBwYXRoXG5cdHJldHVyblxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKipcbiAqIHJlbW92ZSBhIGRpcmVjdG9yeSBmcm9tIHRoZSBmaWxlIHN5c3RlbSwgYnV0IGRvIG5vdGhpbmdcbiAqIGlmIHRoZSBkaXJlY3RvcnkgZG9lcyBub3QgZXhpc3RcbiAqIE5PVEU6IFlvdSBtdXN0IHBhc3MgdGhlICdjbGVhcicgb3B0aW9uIGlmIHRoZSBkaXJlY3RvcnlcbiAqICAgICAgIGlzIG5vdCBlbXB0eVxuICovXG5cbmV4cG9ydCBybURpciA6PSAocGF0aDogc3RyaW5nLCBoT3B0aW9uczogb3B0aW9uc3BlYz17fSk6IHZvaWQgPT5cblxuXHR7Y2xlYXJ9IDo9IGdldE9wdGlvbnMgaE9wdGlvbnMsIHtcblx0XHRjbGVhcjogZmFsc2Vcblx0XHR9XG5cdGlmIGV4aXN0c1N5bmMgcGF0aFxuXHRcdGlmIGNsZWFyXG5cdFx0XHREZW5vLnJlbW92ZVN5bmMgcGF0aCwge3JlY3Vyc2l2ZTogdHJ1ZX1cblx0XHRlbHNlXG5cdFx0XHREZW5vLnJlbW92ZVN5bmMgcGF0aFxuXHRyZXR1cm5cblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuLyoqXG4gKiBjcmVhdGUgYW55IG1pc3NpbmcgZGlyZWN0b3JpZXMgaW4gdGhlIGdpdmVuIHBhdGhcbiAqL1xuXG5leHBvcnQgbWtEaXJzRm9yRmlsZSA9IChwYXRoOiBzdHJpbmcpOiB2b2lkID0+XG5cblx0e3Jvb3QsIGxQYXJ0c30gOj0gcGF0aFN1YkRpcnMocGF0aClcblx0bGV0IGRpciA9IHJvb3Rcblx0Zm9yIHBhcnQgb2YgbFBhcnRzXG5cdFx0ZGlyICs9IFwiLyN7cGFydH1cIlxuXHRcdGlmIG5vdCBpc0RpcihkaXIpXG5cdFx0XHRta0RpciBkaXJcblx0cmV0dXJuXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogZGVsZXRlcyBhbGwgZmlsZXMgYW5kIHN1YmRpcmVjdG9yaWVzIGluIHRoZSBnaXZlbiBkaXJlY3RvcnlcbiAqL1xuXG5leHBvcnQgY2xlYXJEaXIgPSAoZGlyUGF0aDogc3RyaW5nKTogdm9pZCA9PlxuXG5cdGVtcHR5RGlyU3luYyBkaXJQYXRoXG5cdHJldHVyblxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuIyAtLS0gaE9wdGlvbnMgZ2V0cyBwYXNzZWQgdG8gYWxsRmlsZXNNYXRjaGluZygpXG5cbmV4cG9ydCByZW1vdmVGaWxlc01hdGNoaW5nIDo9IChcblx0cGF0dGVybjogc3RyaW5nLFxuXHRoT3B0aW9uczogb3B0aW9uc3BlYz17fVxuXHQpOiB2b2lkID0+XG5cblx0YXNzZXJ0IChwYXR0ZXJuICE9ICcqJykgJiYgKHBhdHRlcm4gIT0gJyoqJyksXG5cdFx0XCJDYW4ndCBkZWxldGUgZmlsZXMgbWF0Y2hpbmcgI3tPTChwYXR0ZXJuKX1cIlxuXHRmb3Ige3JlbFBhdGh9IG9mIGFsbEZpbGVzTWF0Y2hpbmcocGF0dGVybiwgaE9wdGlvbnMpXG5cdFx0RGVuby5yZW1vdmVTeW5jIHJlbFBhdGhcblx0cmV0dXJuXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbmV4cG9ydCByZW1vdmVGaWxlc0V4Y2VwdCA6PSAoXG5cdHBhdHRlcm46IHN0cmluZyxcblx0bEtlZXA6IHN0cmluZ1tdLFxuXHRoT3B0aW9uczogb3B0aW9uc3BlYyA9IHt9XG5cdCk6IHZvaWQgPT5cblxuXHR7ZGVidWd9IDo9IGdldE9wdGlvbnMgaE9wdGlvbnMsIHtcblx0XHRkZWJ1ZzogZmFsc2Vcblx0XHR9XG5cdERCRyA6PSAobXNnOiBzdHJpbmcpOiB2b2lkID0+XG5cdFx0aWYgZGVidWdcblx0XHRcdGNvbnNvbGUubG9nIG1zZ1xuXHRcdHJldHVyblxuXG5cdCMgLS0tIHRydWUgcmV0dXJuIG1lYW5zIHJlbW92ZSBpdFxuXHRmaWx0ZXIgOj0gKGhGaWxlOiBwYXRoSW5mbyk6IGJvb2xlYW4gPT5cblx0XHR7dHlwZSwgcmVsUGF0aH0gOj0gaEZpbGVcblx0XHRpZiAodHlwZSAhPSAnZmlsZScpXG5cdFx0XHRyZXR1cm4gZmFsc2Vcblx0XHRyZXR1cm4gbm90IGxLZWVwLmluY2x1ZGVzKHJlbFBhdGgpXG5cblx0aDogb3B0aW9uc3BlYyA6PSB7ZmlsdGVyLCBkZWJ1Z31cblx0Zm9yIHtyZWxQYXRofSBvZiBhbGxGaWxlc01hdGNoaW5nKHBhdHRlcm4sIGgpXG5cdFx0REJHIFwiUkVNT1ZFIEZJTEUgI3tyZWxQYXRofVwiXG5cdFx0RGVuby5yZW1vdmVTeW5jIHJlbFBhdGhcblx0cmV0dXJuXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbmV4cG9ydCByZW1vdmVEaXJzRXhjZXB0IDo9IChcblx0cGF0dGVybjogc3RyaW5nLFxuXHRsS2VlcDogc3RyaW5nW10sXG5cdGhPcHRpb25zOiBvcHRpb25zcGVjID0ge31cblx0KTogdm9pZCA9PlxuXG5cdHtkZWJ1Z30gOj0gZ2V0T3B0aW9ucyBoT3B0aW9ucywge1xuXHRcdGRlYnVnOiBmYWxzZVxuXHRcdH1cblx0REJHIDo9IChtc2c6IHN0cmluZyk6IHZvaWQgPT5cblx0XHRpZiBkZWJ1Z1xuXHRcdFx0Y29uc29sZS5sb2cgbXNnXG5cdFx0cmV0dXJuXG5cblx0IyAtLS0gdHJ1ZSByZXR1cm4gbWVhbnMgcmVtb3ZlIGl0XG5cdGZpbHRlciA6PSAoaEZpbGU6IHBhdGhJbmZvKTogYm9vbGVhbiA9PlxuXHRcdHt0eXBlLCByZWxQYXRofSA6PSBoRmlsZVxuXHRcdGlmICh0eXBlICE9ICdkaXInKVxuXHRcdFx0cmV0dXJuIGZhbHNlXG5cdFx0cmV0dXJuIG5vdCBsS2VlcC5pbmNsdWRlcyhyZWxQYXRoKVxuXG5cdGg6IG9wdGlvbnNwZWMgOj0ge2ZpbHRlciwgaW5jbHVkZURpcnM6IHRydWV9XG5cdHBhdGhGdW5jIDo9IChoOiBoYXNoKTogc3RyaW5nID0+IGgucGF0aFxuXHRsRGlycyA6PSBBcnJheS5mcm9tKGFsbEZpbGVzTWF0Y2hpbmcocGF0dGVybiwgaCkpLm1hcChwYXRoRnVuYylcblxuXHQjIC0tLSBXZSBuZWVkIHRvIHJlbW92ZSBlbXB0eSBzdWJkaXJlY3RvcmllcyBiZWZvcmVcblx0IyAgICAgcmVtb3ZpbmcgYSBkaXJlY3RvcnksIHNvIHdlIGJ1aWxkIGEgbGlzdCBhbmRcblx0IyAgICAgcmVtb3ZlIGxvbmdlciBwYXRocyBiZWZvcmUgc2hvcnRlciBwYXRoc1xuXG5cdGNvbXBhcmVGdW5jIDo9IChhOiBzdHJpbmcsIGI6IHN0cmluZyk6IG51bWJlciA9PiAoYi5sZW5ndGggLSBhLmxlbmd0aClcblx0Zm9yIHBhdGggb2YgbERpcnMuc29ydChjb21wYXJlRnVuYylcblx0XHREQkcgXCJSRU1PVkUgRElSICN7cGF0aH1cIlxuXHRcdERlbm8ucmVtb3ZlU3luYyBwYXRoXG5cdHJldHVyblxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG5leHBvcnQgdHlwZSBmc0NoYW5nZVR5cGUgPSB7XG5cdGtpbmQ6IHN0cmluZ1xuXHRwYXRoOiBzdHJpbmdcblx0bXM/OiBudW1iZXJcblx0fVxuXG4vKipcbiAqIHR5cGUgZnNDYWxsYmFja0Z1bmMgLSBhIGZ1bmN0aW9uIHRha2luZyAodHlwZSwgcGF0aCkgYW5kIG9wdGlvbmFsbHlcbiAqIHJldHVybnMgYSBmdW5jdGlvbiByZWZlcmVuY2UgdG8gYmUgY2FsbGVkIG9uIGZpbGUgY2hhbmdlc1xuICovXG5cbmV4cG9ydCB0eXBlIGZzQ2FsbGJhY2tGdW5jID0gKGNoYW5nZTogZnNDaGFuZ2VUeXBlKSA9PiB2b2lkXG5cbi8qKlxuICogY2xhc3MgRmlsZUV2ZW50SGFuZGxlclxuICogICAgaGFuZGxlcyBmaWxlIGNoYW5nZWQgZXZlbnRzIHdoZW4gLmhhbmRsZSh7a2luZCwgcGF0aH0pIGlzIGNhbGxlZFxuICogICAgY2FsbGJhY2sgaXMgYSBmdW5jdGlvbiwgZGVib3VuY2VkIGJ5IDIwMCBtc1xuICogICAgICAgdGhhdCB0YWtlcyAodHlwZSwgcGF0aCkgYW5kIHJldHVybnMgYSB2b2lkRnVuY1xuICogICAgICAgd2hpY2ggd2lsbCBiZSBjYWxsZWQgaWYgdGhlIGNhbGxiYWNrIHJldHVybnMgYSBmdW5jdGlvbiByZWZlcmVuY2VcbiAqIFt1bml0IHRlc3RzXSguLi90ZXN0L2ZzLnRlc3QuY2l2ZXQjOn46dGV4dD0lMjMlMjAlMkQlMkQlMkQlMjBjbGFzcyUyMEZpbGVFdmVudEhhbmRsZXIpXG4gKi9cblxuZXhwb3J0IGNsYXNzIEZpbGVFdmVudEhhbmRsZXJcblxuXHRjYWxsYmFjazogZnNDYWxsYmFja0Z1bmM/XG5cdGxDaGFuZ2VzOiBmc0NoYW5nZVR5cGVbXSA6PSBbXVxuXHRoSGFuZGxlcnM6IGhhc2ggPSB7fSAgICMgLS0tIHBhdGggPT4gZXZlbnQgdHlwZSA9PiBkZWJvdW5jZWQgaGFuZGxlclxuXHRvblN0b3A6ICgpID0+IHZvaWQgPSBwYXNzXG5cdG1zOiBudW1iZXJcblx0ZGVidWc6IGJvb2xlYW5cblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRcdEBjYWxsYmFjazogZnNDYWxsYmFja0Z1bmM/PXVuZGVmLFxuXHRcdFx0aE9wdGlvbnM6IG9wdGlvbnNwZWM9e31cblx0XHRcdClcblxuXHRcdHtcblx0XHRcdGRlYnVnOiBAZGVidWcsXG5cdFx0XHRvblN0b3A6IEBvblN0b3Bcblx0XHRcdG1zOiBAbXNcblx0XHRcdH0gOj0gZ2V0T3B0aW9ucyBoT3B0aW9ucywge1xuXHRcdFx0XHRkZWJ1ZzogZmFsc2Vcblx0XHRcdFx0b25TdG9wOiBwYXNzXG5cdFx0XHRcdG1zOiAyMDBcblx0XHRcdFx0fVxuXHRcdEBEQkcgXCJGaWxlRXZlbnRIYW5kbGVyIGNvbnN0cnVjdG9yKCkgY2FsbGVkXCJcblxuXHQjIC0tLSBDYWxscyBhIGZ1bmN0aW9uIG9mIHR5cGUgKCkgPT4gdm9pZFxuXHQjICAgICBidXQgaXMgZGVib3VuY2VkIGJ5IEBtcyBtc1xuXG5cdGhhbmRsZShjaGFuZ2U6IGZzQ2hhbmdlVHlwZSk6IHZvaWRcblx0XHR7a2luZCwgcGF0aH0gOj0gY2hhbmdlXG5cdFx0QERCRyBcIkhBTkRMRTogWyN7c2luY2VMb2FkU3RyKCl9XSAje2tpbmR9ICN7cGF0aH1cIlxuXHRcdGlmIG5vdGRlZmluZWQoQGhIYW5kbGVycz8uW3BhdGhdKVxuXHRcdFx0QERCRyBcIkNyZWF0ZSBoYW5kbGVyIGZvciAnI3twYXRofSdcIiwgMVxuXHRcdFx0QGhIYW5kbGVyc1twYXRoXSA9IHt9XG5cblx0XHRpZiBub3RkZWZpbmVkKEBoSGFuZGxlcnM/LltwYXRoXT8uW2tpbmRdKVxuXHRcdFx0QERCRyBcIkNyZWF0ZSBoYW5kbGVyIGZvciAje2tpbmR9ICN7cGF0aH1cIiwgMVxuXHRcdFx0ZnVuYyA6PSAoKSA9PlxuXHRcdFx0XHRpZiBAY2FsbGJhY2tcblx0XHRcdFx0XHRAY2FsbGJhY2soe2tpbmQsIHBhdGh9KVxuXHRcdFx0XHRAbENoYW5nZXMucHVzaCB7a2luZCwgcGF0aH1cblx0XHRcdFx0QGhIYW5kbGVyc1twYXRoXVtraW5kXSA9IHVuZGVmXG5cdFx0XHRcdHJldHVybiB1bmRlZlxuXHRcdFx0QGhIYW5kbGVyc1twYXRoXVtraW5kXSA9IGRlYm91bmNlKGZ1bmMsIEBtcylcblx0XHRAREJHIFwiQ2FsbCBkZWJvdW5jZWQgaGFuZGxlciBmb3IgI3traW5kfSAje3BhdGh9XCJcblx0XHRAaEhhbmRsZXJzW3BhdGhdW2tpbmRdKClcblx0XHRyZXR1cm5cblxuXHQjIEFTWU5DIVxuXHRnZXRDaGFuZ2VMaXN0KClcblx0XHRhd2FpdCBzbGVlcCBAbXNcblx0XHRyZXR1cm4gQGxDaGFuZ2VzXG5cblx0cHJpdmF0ZSBEQkcobXNnOiBzdHJpbmcsIGxldmVsOiBudW1iZXI9MCk6IHZvaWRcblx0XHRpZiBAZGVidWdcblx0XHRcdGNvbnNvbGUubG9nIFwiICAgI3tzcGFjZXMoMypsZXZlbCl9LSAje21zZ31cIlxuXHRcdHJldHVyblxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuIyBBU1lOQ1xuXG5leHBvcnQgdHlwZSB3YXRjaGVyQ2FsbGJhY2tGdW5jID0gKGNoYW5nZTogZnNDaGFuZ2VUeXBlKSA9PiBib29sZWFuXG5cbi8qKlxuICogYSBmdW5jdGlvbiB0aGF0IHdhdGNoZXMgZm9yIGNoYW5nZXMgb25lIG9yIG1vcmUgZmlsZXMgb3IgZGlyZWN0b3JpZXNcbiAqICAgIGFuZCBjYWxscyBhIGNhbGxiYWNrIGZ1bmN0aW9uIGZvciBlYWNoIGNoYW5nZS5cbiAqIElmIHRoZSBjYWxsYmFjayByZXR1cm5zIHRydWUsIHdhdGNoaW5nIGlzIGhhbHRlZFxuICpcbiAqIFVzYWdlOlxuICogICBoYW5kbGVyIDo9IChraW5kLCBwYXRoKSA9PiBjb25zb2xlLmxvZyBwYXRoXG4gKiAgIGF3YWl0IHdhdGNoRmlsZSAndGVtcC50eHQnLCBoYW5kbGVyXG4gKiAgIGF3YWl0IHdhdGNoRmlsZSAnc3JjL2xpYicsICBoYW5kbGVyXG4gKiAgIGF3YWl0IHdhdGNoRmlsZSBbJ3RlbXAudHh0JywgJ3NyYy9saWInXSwgaGFuZGxlclxuICovXG5cbmV4cG9ydCB3YXRjaEZpbGUgOj0gKFxuXHRwYXRoOiBzdHJpbmcgfCBzdHJpbmdbXSxcblx0d2F0Y2hlckNCOiB3YXRjaGVyQ2FsbGJhY2tGdW5jLFxuXHRoT3B0aW9uczogb3B0aW9uc3BlYz17fVxuXHQpOiB2b2lkIC0+XG5cblx0e2RlYnVnLCBtc30gOj0gZ2V0T3B0aW9ucyBoT3B0aW9ucywge1xuXHRcdGRlYnVnOiBmYWxzZVxuXHRcdG1zOiAyMDBcblx0XHR9XG5cdERCRyA6PSAobXNnOiBzdHJpbmcpOiB2b2lkID0+XG5cdFx0aWYgZGVidWdcblx0XHRcdGNvbnNvbGUubG9nIG1zZ1xuXHRcdHJldHVyblxuXG5cdERCRyBcIldBVENIOiAje0pTT04uc3RyaW5naWZ5KHBhdGgpfVwiXG5cblx0d2F0Y2hlciA6PSBEZW5vLndhdGNoRnMocGF0aClcblxuXHRsZXQgZG9TdG9wOiBib29sZWFuID0gZmFsc2VcblxuXHRmc0NhbGxiYWNrOiBmc0NhbGxiYWNrRnVuYyA6PSAoe2tpbmQsIHBhdGh9KSA9PlxuXHRcdHJlc3VsdCA6PSB3YXRjaGVyQ0Ioe2tpbmQsIHBhdGh9KVxuXHRcdERCRyBcIkZDQjogcmVzdWx0ID0gI3tyZXN1bHR9XCJcblx0XHRpZiByZXN1bHRcblx0XHRcdHdhdGNoZXIuY2xvc2UoKVxuXHRcdHJldHVyblxuXG5cdGhhbmRsZXIgOj0gbmV3IEZpbGVFdmVudEhhbmRsZXIoZnNDYWxsYmFjaywge2RlYnVnLCBtc30pXG5cblx0Zm9yIGF3YWl0IHtraW5kLCBwYXRoc30gb2Ygd2F0Y2hlclxuXHRcdERCRyBcIndhdGNoZXIgZXZlbnQgZmlyZWRcIlxuXHRcdGlmIGRvU3RvcFxuXHRcdFx0REJHIFwiZG9TdG9wID0gI3tkb1N0b3B9LCBDbG9zaW5nIHdhdGNoZXJcIlxuXHRcdFx0YnJlYWtcbiNcdFx0e2tpbmQsIHBhdGhzfSA6PSBldnRcblx0XHRmb3IgcGF0aCBvZiBwYXRoc1xuXHRcdFx0IyAtLS0gZnNDYWxsYmFjayB3aWxsIGJlIChldmVudHVhbGx5KSBjYWxsZWRcblx0XHRcdGhhbmRsZXIuaGFuZGxlKHtraW5kLCBwYXRofSlcblxuZXhwb3J0IHdhdGNoRmlsZXMgOj0gd2F0Y2hGaWxlXG4iXX0=