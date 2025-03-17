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

/**
 * @module fs - file system utilities
 */

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

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3JjL2xpYi9mcy5jaXZldC50c3giLCJzb3VyY2VzIjpbInNyYy9saWIvZnMuY2l2ZXQiXSwibWFwcGluZ3MiOiI7QUFBQSxXQUFVO0FBQ1YsQUFBQTtBQUNBLEssVyx5QjtBQUFBLE1BQU0sQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLElBQUksQ0FBQyxpQkFBaUI7QUFDdkMsQUFBQSxBQUFBLE1BQU0sQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLElBQUksQ0FBQyxxQkFBcUI7QUFDNUMsQUFBQSxBQUFBLE1BQU0sQ0FBQyxDQUFDO0FBQ1IsQ0FBQyxVQUFVLENBQUMsQ0FBQyxZQUFZLENBQUMsQ0FBQyxhQUFhLENBQUM7QUFDekMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFNBQVM7QUFDakIsQUFBQSxBQUFBLE1BQU0sQ0FBQyxDQUFDO0FBQ1IsQ0FBQyxjQUFjLENBQUM7QUFDaEIsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFNBQVM7QUFDakIsQUFBQSxBQUFBLE1BQU0sQ0FBQyxDQUFDLFlBQVksQ0FBQyxDQUFDLElBQUksQ0FBQyxhQUFhO0FBQ3hDLEFBQUE7QUFDQSxBQUFBLHdEQUF1RDtBQUN2RCxBQUFBLGtCQUFpQjtBQUNqQixBQUFBLEFBQUEsTUFBTSxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsSUFBSSxDQUFDLFNBQVM7QUFDaEMsQUFBQTtBQUNBLEFBQUEsQUFBQSxNQUFNLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxXQUFXO0FBQy9CLEFBQUEsQUFBQSxNQUFNLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxVQUFVO0FBQzdCLEFBQUEsQUFBQSxNQUFNLENBQUMsQ0FBQyxjQUFjLENBQUMsQ0FBQyxJQUFJLENBQUMscUJBQXFCO0FBQ2xELEFBQUEsQUFBQSxNQUFNLENBQUMsQ0FBQyxjQUFjLENBQUMsQ0FBQyxJQUFJLENBQUMsY0FBYztBQUMzQyxBQUFBO0FBQ0EsQUFBQSxBQUFBLE1BQU0sQ0FBQyxDQUFDO0FBQ1IsQ0FBQyxLQUFLLENB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QUEsQ0FBQSxDQUFBO0FBQ25CLEFBQUEsRUFBRSxHQUFHLENBQUEsS0FBSyxDQUFBLENBQUEsQ0FBQTtBQUNWLEFBQUEsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFBLEFBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxJQUFJLENBQUMsQztFQUFBLENBQUE7QUFDMUMsQUFBQSxFQUFFLElBQUksQ0FBQSxDQUFBO0FBQ04sQUFBQSxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUEsQUFBQyxJQUFJLEM7RUFBQSxDO0NBQUEsQ0FBQTtBQUN2QixBQUFBLENBQUMsTTtBQUFNLENBQUE7QUFDUCxBQUFBO0FBQ0EsQUFBQSw4RUFBNkU7QUFDN0UsQUFBQTtBQUNBLEFBQUE7QUFDQTtBQUNBLEdBQUc7QUFDSCxBQUFBO0FBQ0EsQUFBQSxBQUFBLE1BQU0sQ0FBQyxJQUFBLGFBQWEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUEsQ0FBQTtBQUM5QyxBQUFBO0FBQ0EsQUFBQSxDQUFlLE1BQWQsQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFFLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQztBQUNwQyxBQUFBLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsSUFBSTtBQUNmLEFBQUEsQ0FBQyxHQUFHLENBQUMsQ0FBQSxNQUFBLElBQUksQ0FBQyxFQUFFLENBQUMsTUFBTSxDQUFBLENBQUEsQ0FBQTtBQUNuQixBQUFBLEVBQUUsR0FBRyxDLEVBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQztBQUNuQixBQUFBLEVBQUUsR0FBRyxDQUFBLENBQUksS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFBLENBQUEsQ0FBQTtBQUNuQixBQUFBLEdBQUcsS0FBSyxDQUFBLEFBQUMsR0FBRyxDO0VBQUEsQztDQUFBLENBQUE7QUFDWixBQUFBLENBQUMsTTtBQUFNLENBQUE7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O0FBQ1IsQUFBQSx3QkFBdUI7QUFDdkIsQUFBQSxFQUFFLEdBQUcsQ0FBQyxDQUFBLE1BQUEsSUFBSSxDQUFDLEVBQUUsQ0FBQyxLQUFLLENBQUEsQ0FBQSxDQUFBO0FBQ25CLEFBQUEsR0FBRyw2Q0FBNEM7QUFDL0MsQUFBQSxHQUFHLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsQztFQUFDLEM7Q0FBQSxDO0FBQUEsQ0FBQTtBQUMvQixBQUFBO0FBQ0EsQUFBQSxBQUFBLE1BQU0sQ0FBVyxNQUFWLFVBQVUsQ0FBQyxDQUFFLENBQUMsU0FBUztBQUM5QiIsIm5hbWVzIjpbXSwic291cmNlc0NvbnRlbnQiOlsiIyBmcy5jaXZldFxuXG5pbXBvcnQge3NwcmludGZ9IGZyb20gXCJAc3RkL2ZtdC9wcmludGZcIlxuaW1wb3J0IHtkZWJvdW5jZX0gZnJvbSAnQHN0ZC9hc3luYy9kZWJvdW5jZSdcbmltcG9ydCB7XG5cdGV4aXN0c1N5bmMsIGVtcHR5RGlyU3luYywgZW5zdXJlRGlyU3luYyxcblx0fSBmcm9tICdAc3RkL2ZzJ1xuaW1wb3J0IHtcblx0YXBwZW5kRmlsZVN5bmMsXG5cdH0gZnJvbSAnbm9kZTpmcydcbmltcG9ydCB7RXZlbnRFbWl0dGVyfSBmcm9tICdub2RlOmV2ZW50cydcblxuIyAtLS0gRGVubydzIHN0YXRTeW5jIGFuZCBsc3RhdFN5bmMgYXJlIHN0aWxsIHVuc3RhYmxlLFxuIyAgICAgc28gdXNlIHRoaXNcbmltcG9ydCB7c3RhdFN5bmN9IGZyb20gJ25vZGU6ZnMnXG5cbmltcG9ydCBwYXRoTGliIGZyb20gJ25vZGU6cGF0aCdcbmltcG9ydCB1cmxMaWIgZnJvbSAnbm9kZTp1cmwnXG5pbXBvcnQge2V4cGFuZEdsb2JTeW5jfSBmcm9tICdAc3RkL2ZzL2V4cGFuZC1nbG9iJ1xuaW1wb3J0IHtUZXh0TGluZVN0cmVhbX0gZnJvbSAnQHN0ZC9zdHJlYW1zJ1xuXG5pbXBvcnQge1xuXHR1bmRlZiwgZGVmaW5lZCwgbm90ZGVmaW5lZCxcblx0aXNTdHJpbmcsIGlzTm9uRW1wdHlTdHJpbmcsIGlzQm9vbGVhbiwgaXNOdW1iZXIsIGlzSW50ZWdlcixcblx0aXNBcnJheSwgaXNBcnJheU9mU3RyaW5ncywgaXNIYXNoLCBpc09iamVjdCwgaXNSZWdFeHAsXG5cdGludGVnZXIsIGhhc2gsIHZvaWRGdW5jLCBvcHRpb25zcGVjLFxuXHR9IGZyb20gJy4vZGF0YXR5cGVzLnRzJ1xuaW1wb3J0IHtcblx0YXNzZXJ0LCBjcm9haywgT0wsIGdldE9wdGlvbnMsIHJlbW92ZUVtcHR5S2V5cywgcGFzcyxcblx0c3BhY2VzLCBzaW5jZUxvYWRTdHIsIHNsZWVwLFxuXHR9IGZyb20gJy4vbGx1dGlscy50cydcblxuLyoqXG4gKiBAbW9kdWxlIGZzIC0gZmlsZSBzeXN0ZW0gdXRpbGl0aWVzXG4gKi9cblxuRGVubyA6PSBnbG9iYWxUaGlzLkRlbm9cbmV4cG9ydCB0eXBlIHBhdGhUeXBlID1cblx0J21pc3NpbmcnIHwgJ2ZpbGUnIHwgJ2RpcicgfCAnc3ltbGluaycgfCAndW5rbm93bidcblxuIyAtLS0gbm90IGV4cG9ydGVkXG5kZWNvZGVyIDo9IG5ldyBUZXh0RGVjb2RlcigndXRmLTgnKVxuZW5jb2RlciA6PSBuZXcgVGV4dEVuY29kZXIoKVxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKipcbiAqIHJldHVybnMgYSBib29sZWFuIGluZGljYXRpbmcgaWYgdGhlIGdpdmVuIHBhdGggZXhpc3RzXG4gKiBhbmQgaXMgYSBmaWxlXG4gKi9cblxuZXhwb3J0IGlzRmlsZSA6PSAocGF0aDogc3RyaW5nKTogYm9vbGVhbiA9PlxuXG5cdHJldHVybiBleGlzdHNTeW5jKHBhdGgpICYmIHN0YXRTeW5jKHBhdGgpLmlzRmlsZSgpXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogcmV0dXJucyBhIGJvb2xlYW4gaW5kaWNhdGluZyBvZiB0aGUgZ2l2ZW4gcGF0aCBleGlzdHNcbiAqIGFuZCBpcyBhIGRpcmVjdG9yeVxuICovXG5cbmV4cG9ydCBpc0RpciA6PSAocGF0aDogc3RyaW5nKTogYm9vbGVhbiA9PlxuXG5cdHJldHVybiBleGlzdHNTeW5jKHBhdGgpICYmIHN0YXRTeW5jKHBhdGgpLmlzRGlyZWN0b3J5KClcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuLyoqXG4gKiByZXR1cm5zIG9uZSBvZjpcbiAqICAgICdtaXNzaW5nJyAgLSBkb2VzIG5vdCBleGlzdFxuICogICAgJ2RpcicgICAgICAtIGlzIGEgZGlyZWN0b3J5XG4gKiAgICAnZmlsZScgICAgIC0gaXMgYSBmaWxlXG4gKiAgICAnc3ltbGluaycgIC0gaXMgYSBzeW1saW5rXG4gKiAgICAndW5rbm93bicgIC0gZXhpc3RzLCBidXQgbm90IGEgZmlsZSwgZGlyZWN0b3J5IG9yIHN5bWxpbmtcbiAqL1xuXG5leHBvcnQgZ2V0UGF0aFR5cGUgOj0gKHBhdGg6IHN0cmluZyk6IHBhdGhUeXBlID0+XG5cblx0YXNzZXJ0IGlzU3RyaW5nKHBhdGgpLCBcIm5vdCBhIHN0cmluZzogI3tPTChwYXRoKX1cIlxuXHRpZiBub3QgZXhpc3RzU3luYyBwYXRoXG5cdFx0cmV0dXJuICdtaXNzaW5nJ1xuXHRoIDo9IHN0YXRTeW5jKHBhdGgpXG5cdHJldHVybiAoXG5cdFx0ICBoLmlzRmlsZSgpICAgICAgICAgPyAnZmlsZSdcblx0XHQ6IGguaXNEaXJlY3RvcnkoKSAgICA/ICdkaXInXG5cdFx0OiBoLmlzU3ltYm9saWNMaW5rKCkgPyAnc3ltbGluaydcblx0XHQ6ICAgICAgICAgICAgICAgICAgICAgICd1bmtub3duJ1xuXHRcdClcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuLyoqXG4gKiBleHRyYWN0IHRoZSBmaWxlIGV4dGVuc2lvbiBmcm9tIGEgcGF0aCwgaW5jbHVkaW5nXG4gKiB0aGUgbGVhZGluZyBwZXJpb2RcbiAqL1xuXG5leHBvcnQgZmlsZUV4dCA6PSAocGF0aDogc3RyaW5nKTogc3RyaW5nID0+XG5cblx0aWYgbE1hdGNoZXMgOj0gcGF0aC5tYXRjaCgvXFwuW15cXC5dKyQvKVxuXHRcdHJldHVybiBsTWF0Y2hlc1swXVxuXHRlbHNlXG5cdFx0cmV0dXJuICcnXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogcmV0dXJuIHRoZSBnaXZlbiBwYXRoLCBidXQgd2l0aCB0aGUgZ2l2ZW4gZmlsZSBleHRlbnNpb25cbiAqIHJlcGxhY2luZyB0aGUgZXhpc3RpbmcgZmlsZSBleHRlbnNpb25cbiAqL1xuXG5leHBvcnQgd2l0aEV4dCA6PSAocGF0aDogc3RyaW5nLCBleHQ6IHN0cmluZyk6IHN0cmluZyA9PlxuXG5cdGFzc2VydCBleHQuc3RhcnRzV2l0aCgnLicpLCBcIkJhZCBmaWxlIGV4dGVuc2lvbjogI3tleHR9XCJcblx0bE1hdGNoZXMgOj0gcGF0aC5tYXRjaCgvXiguKikoXFwuW15cXC5dKykkLylcblx0aWYgKGxNYXRjaGVzID09IG51bGwpXG5cdFx0dGhyb3cgbmV3IEVycm9yKFwiQmFkIHBhdGg6ICcje3BhdGh9J1wiKVxuXHRbXywgaGVhZFN0ciwgb3JnRXh0XSA6PSBsTWF0Y2hlc1xuXHRyZXR1cm4gXCIje2hlYWRTdHJ9I3tleHR9XCJcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuZXhwb3J0IGxTdGF0RmllbGRzOiBzdHJpbmdbXSA6PSBbXG5cdCdkZXYnLCdpbm8nLCdtb2RlJywnbmxpbmsnLCd1aWQnLCdnaWQnLCdyZGV2Jyxcblx0J3NpemUnLCdibGtzaXplJywnYmxvY2tzJyxcblx0J2F0aW1lTXMnLCdtdGltZU1zJywnY3RpbWVNcycsJ2JpcnRodGltZU1zJyxcblx0J2F0aW1lJywnbXRpbWUnLCdjdGltZScsJ2JpcnRodGltZScsXG5cdF1cblxuLyoqXG4gKiByZXR1cm4gc3RhdGlzdGljcyBmb3IgYSBmaWxlIG9yIGRpcmVjdG9yeVxuICovXG5cbmV4cG9ydCBnZXRTdGF0cyA6PSAocGF0aDogc3RyaW5nKTogaGFzaCA9PlxuXG5cdHJldHVybiBzdGF0U3luYyhwYXRoKVxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG5cbi8qKlxuICogcGFyc2VzIGEgcGF0aCBvciBmaWxlIFVSTCwgYW5kIHJldHVybnMgYSBoYXNoIHdpdGgga2V5czpcbiAqIFx0dHlwZTogcGF0aFR5cGUgLSAnZmlsZScsJ2RpcicsJ3N5bWxpbmsnLCdtaXNzaW5nJyBvciAndW5rbm93bidcbiAqIFx0cGF0aDogc3RyaW5nXG4gKiBcdHJvb3Q6IHN0cmluZ1xuICogXHRkaXI6IHN0cmluZ1xuICogXHRmaWxlTmFtZTogc3RyaW5nXG4gKiBcdHN0dWI6IHN0cmluZz9cbiAqIFx0cHVycG9zZTogc3RyaW5nP1xuICogXHRleHQ6IHN0cmluZz9cbiAqIFx0cmVsUGF0aDogc3RyaW5nXG4gKiBcdHJlbERpcjogc3RyaW5nXG4gKi9cblxuZXhwb3J0IHR5cGUgcGF0aEluZm8gPSB7XG5cdHR5cGU6IHBhdGhUeXBlICAjICdmaWxlJywnZGlyJywnc3ltbGluaycsJ21pc3NpbmcnIG9yICd1bmtub3duJ1xuXHRwYXRoOiBzdHJpbmdcblx0cm9vdDogc3RyaW5nXG5cdGRpcjogc3RyaW5nXG5cdGZpbGVOYW1lOiBzdHJpbmdcblx0c3R1Yjogc3RyaW5nP1xuXHRwdXJwb3NlOiBzdHJpbmc/XG5cdGV4dDogc3RyaW5nP1xuXHRyZWxQYXRoOiBzdHJpbmdcblx0cmVsRGlyOiBzdHJpbmdcblx0fVxuXG5leHBvcnQgcGFyc2VQYXRoIDo9IChwYXRoOiBzdHJpbmcpOiBwYXRoSW5mbyA9PlxuXG5cdCMgLS0tIE5PVEU6IHBhdGggbWF5IGJlIGEgZmlsZSBVUkwsIGUuZy4gaW1wb3J0Lm1ldGEudXJsXG5cdCMgICAgICAgICAgIHBhdGggbWF5IGJlIGEgcmVsYXRpdmUgcGF0aFxuXG5cdGFzc2VydCBpc05vbkVtcHR5U3RyaW5nKHBhdGgpLCBcInBhdGggbm90IGEgc3RyaW5nICN7T0wocGF0aCl9XCJcblx0aWYgZGVmaW5lZChwYXRoLm1hdGNoKC9eZmlsZVxcOlxcL1xcLy8pKVxuXHRcdHBhdGggPSB1cmxMaWIuZmlsZVVSTFRvUGF0aChwYXRoKVxuXHRwYXRoID0gbm9ybWFsaXplUGF0aCBwYXRoXG5cblx0e3Jvb3QsIGRpciwgYmFzZTogZmlsZU5hbWV9IDo9IHBhdGhMaWIucGFyc2UocGF0aClcblxuXHRsUGFydHMgOj0gZmlsZU5hbWUuc3BsaXQoJy4nKVxuXHRbc3R1YiwgcHVycG9zZSwgZXh0XSA6PSBzd2l0Y2ggbFBhcnRzLmxlbmd0aFxuXHRcdHdoZW4gMFxuXHRcdFx0Y3JvYWsgXCJDYW4ndCBoYXBwZW5cIlxuXHRcdHdoZW4gMVxuXHRcdFx0W2ZpbGVOYW1lLCB1bmRlZiwgdW5kZWZdXG5cdFx0d2hlbiAyXG5cdFx0XHRbbFBhcnRzWzBdLCB1bmRlZiwgXCIuI3tsUGFydHNbMV19XCJdXG5cdFx0ZWxzZVxuXHRcdFx0W1xuXHRcdFx0XHRsUGFydHMuc2xpY2UoMCwgLTIpLmpvaW4oJy4nKSxcblx0XHRcdFx0bFBhcnRzLmF0KC0yKSxcblx0XHRcdFx0XCIuI3tsUGFydHMuYXQoLTEpfVwiXG5cdFx0XHRcdF1cblxuXHQjIC0tLSBHcmFiIGV2ZXJ5dGhpbmcgdXAgdW50aWwgdGhlIGxhc3QgcGF0aCBzZXBhcmF0b3IsIGlmIGFueVxuXHRyZWxQYXRoIDo9IHJlbHBhdGggcGF0aFxuXHRsUGF0aE1hdGNoZXMgOj0gcmVsUGF0aC5tYXRjaCgvXiguKilbXFxcXFxcL11bXlxcXFxcXC9dKiQvKVxuXHRyZWxEaXIgOj0gKGxQYXRoTWF0Y2hlcyA9PSBudWxsKSA/ICcuJyA6IGxQYXRoTWF0Y2hlc1sxXVxuXG5cdHJldHVybiB7XG5cdFx0dHlwZTogZ2V0UGF0aFR5cGUocGF0aClcblx0XHRwYXRoXG5cdFx0cm9vdFxuXHRcdGRpclxuXHRcdGZpbGVOYW1lXG5cdFx0c3R1YlxuXHRcdHB1cnBvc2Vcblx0XHRleHRcblx0XHRyZWxQYXRoXG5cdFx0cmVsRGlyXG5cdFx0fVxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKipcbiAqIGdlbmVyYXRlIGZpbGVzIHRoYXQgbWF0Y2ggYSBnaXZlbiBnbG9iIHBhdHRlcm5cbiAqIHlpZWxkcyB7cGF0aCwgbmFtZSwgaXNGaWxlLCBpc0RpcmVjdG9yeSwgaXNTeW1saW5rfVxuICogICAgd2l0aCBwYXJzZSBvcHRpb24sIGFsc28gaW5jbHVkZXMga2V5czpcbiAqICAgICAgIHJlbFBhdGhcbiAqIFRoZXNlIG9wdGlvbnMgbWF5IGJlIHNwZWNpZmllZCBpbiB0aGUgMm5kIHBhcmFtZXRlcjpcbiAqICAgIHJvb3Q6IHN0cmluZyAtIHJvb3Qgb2Ygc2VhcmNoLCAoZGVmOiBEZW5vLmN3ZCgpKVxuICogICAgbEV4Y2x1ZGU6IFtzdHJpbmddIC0gcGF0dGVybnMgdG8gZXhjbHVkZSxcbiAqICAgIFx0ZGVmOiBbJ25vZGVfbW9kdWxlcy8qKicsICcuZ2l0LyoqJ11cbiAqICAgIGluY2x1ZGVEaXJzOiBib29sZWFuIC0gc2hvdWxkIGRpcmVjdG9yaWVzIGJlIGluY2x1ZGVkPyAoZGVmOiB0cnVlKVxuICogXHRmb2xsb3dTeW1saW5rcyAtIGJvb2xlYW4gLSBzaG91bGQgc3ltIGxpbmtzIGJlIGZvbGxvd2VkPyAoZGVmOiBmYWxzZSlcbiAqIFx0Y2Fub25pY2FsaXplOiBib29sZWFuIC0gaWYgZm9sbG93c3ltbGlua3MgaXMgdHJ1ZSwgc2hvdWxkXG4gKiBcdFx0cGF0aHMgYmUgY2Fub25pY2FsaXplZD8gKGRlZjogdHJ1ZSlcbiAqIFx0ZmlsdGVyOiAoc3RyaW5nLT5ib29sZWFuKSAtIHlpZWxkIG9ubHkgaWYgZnVuY3Rpb24gcmV0dXJucyB0cnVlXG4gKi9cblxuZXhwb3J0IGFsbEZpbGVzTWF0Y2hpbmcgOj0gKFxuXHRwYXR0ZXJuOiBzdHJpbmc9JyoqJyxcblx0aE9wdGlvbnM6IG9wdGlvbnNwZWM9e31cblx0KTogR2VuZXJhdG9yPGhhc2gsIHZvaWQsIHVua25vd24+IC0+XG5cblx0e1xuXHRcdHJvb3Rcblx0XHRsRXhjbHVkZVxuXHRcdGluY2x1ZGVEaXJzXG5cdFx0Zm9sbG93U3ltbGlua3Ncblx0XHRjYW5vbmljYWxpemVcblx0XHRmaWx0ZXJcblx0XHRkZWJ1Z1xuXHRcdH0gOj0gZ2V0T3B0aW9ucyBoT3B0aW9ucywge1xuXHRcdFx0cm9vdDogdW5kZWZcblx0XHRcdGxFeGNsdWRlOiBbJ25vZGVfbW9kdWxlcy8qKicsICcuZ2l0LyoqJ11cblx0XHRcdGluY2x1ZGVEaXJzOiBmYWxzZVxuXHRcdFx0Zm9sbG93U3ltbGlua3M6IGZhbHNlXG5cdFx0XHRjYW5vbmljYWxpemU6IGZhbHNlXG5cdFx0XHRmaWx0ZXI6IHVuZGVmXG5cdFx0XHRkZWJ1ZzogZmFsc2Vcblx0XHRcdH1cblxuXHRoR2xvYk9wdGlvbnMgOj0ge1xuXHRcdHJvb3Rcblx0XHRleGNsdWRlOiBsRXhjbHVkZVxuXHRcdGluY2x1ZGVEaXJzXG5cdFx0Zm9sbG93U3ltbGlua3Ncblx0XHRjYW5vbmljYWxpemVcblx0XHR9XG5cblx0REJHIDo9IChtc2c6IHN0cmluZyk6IHZvaWQgPT5cblx0XHRpZiBkZWJ1Z1xuXHRcdFx0Y29uc29sZS5sb2cgbXNnXG5cdFx0cmV0dXJuXG5cblx0Zm9yIGggb2YgZXhwYW5kR2xvYlN5bmMocGF0dGVybiwgaEdsb2JPcHRpb25zKVxuXHRcdCMgLS0tIGggaGFzIGtleXM6IHBhdGgsIG5hbWUsIGlzRmlsZSwgaXNEaXJlY3RvcnksIGlzU3ltTGlua1xuXG5cdFx0REJHIFwiTUFUQ0g6ICN7aC5wYXRofVwiXG5cdFx0dHlwZSA6PSAoXG5cdFx0XHQgIGguaXNGaWxlICAgICAgPyAnZmlsZSdcblx0XHRcdDogaC5pc0RpcmVjdG9yeSA/ICdkaXInXG5cdFx0XHQ6IGguaXNTeW1saW5rICAgPyAnc3ltbGluaydcblx0XHRcdDogICAgICAgICAgICAgICAgICd1bmtub3duJ1xuXHRcdFx0KVxuXHRcdGhGaWxlIDo9IHBhcnNlUGF0aChoLnBhdGgpXG5cdFx0aWYgbm90ZGVmaW5lZChmaWx0ZXIpXG5cdFx0XHREQkcgXCIgICAtIG5vIGZpbHRlclwiXG5cdFx0XHR5aWVsZCBoRmlsZVxuXHRcdGVsc2UgaWYgZmlsdGVyKGhGaWxlKVxuXHRcdFx0REJHIFwiICAgLSBhbGxvd2VkIGJ5IGZpbHRlclwiXG5cdFx0XHR5aWVsZCBoRmlsZVxuXHRcdGVsc2Vcblx0XHRcdERCRyBcIiAgIC0gZXhjbHVkZWQgYnkgZmlsdGVyXCJcblx0cmV0dXJuXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4jIEFTWU5DIElURVJBQkxFXG5cbi8qKlxuICogQW4gYXN5bmMgaXRlcmFibGUgLSB5aWVsZHMgZXZlcnkgbGluZSBpbiB0aGUgZ2l2ZW4gZmlsZVxuICpcbiAqIFVzYWdlOlxuICogICBmb3IgYXdhaXQgbGluZSBvZiBhbGxMaW5lc0luKCdzcmMvbGliL3RlbXAuY2l2ZXQnKVxuICogXHQgIGNvbnNvbGUubG9nIFwiTElORTogI3tsaW5lfVwiXG4gKiAgIGNvbnNvbGUubG9nIFwiRE9ORVwiXG4gKi9cblxuZXhwb3J0IGFsbExpbmVzSW4gOj0gKFxuXHRwYXRoOiBzdHJpbmdcblx0KTogQXN5bmNHZW5lcmF0b3I8c3RyaW5nLCB2b2lkLCB1bmtub3duPiAtPlxuXG5cdGFzc2VydCBpc0ZpbGUocGF0aCksIFwiTm8gc3VjaCBmaWxlOiAje09MKHBhdGgpfSAoYWxsTGluZXNJbilcIlxuXHRmIDo9IGF3YWl0IERlbm8ub3BlbihwYXRoKVxuXHRyZWFkYWJsZSA6PSBmLnJlYWRhYmxlXG5cdFx0LnBpcGVUaHJvdWdoKG5ldyBUZXh0RGVjb2RlclN0cmVhbSgpKVxuXHRcdC5waXBlVGhyb3VnaChuZXcgVGV4dExpbmVTdHJlYW0oKSlcblxuXHRmb3IgYXdhaXQgbGluZSBvZiByZWFkYWJsZVxuXHRcdHlpZWxkIGxpbmVcblx0cmV0dXJuXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogY29udmVydHMgYWxsIGJhY2tzbGFzaCBjaGFyYWN0ZXJzIHRvIGZvcndhcmQgc2xhc2hlc1xuICogdXBwZXItY2FzZXMgZHJpdmUgbGV0dGVyc1xuICovXG5cbmV4cG9ydCBub3JtYWxpemVQYXRoIDo9IChwYXRoOiBzdHJpbmcpOiBzdHJpbmcgPT5cblxuXHRucGF0aCA6PSBwYXRoLnJlcGxhY2VBbGwoJ1xcXFwnLCAnLycpXG5cdGlmIChucGF0aC5jaGFyQXQoMSkgPT0gJzonKVxuXHRcdHJldHVybiBucGF0aC5jaGFyQXQoMCkudG9VcHBlckNhc2UoKSArIG5wYXRoLnN1YnN0cmluZygxKVxuXHRlbHNlXG5cdFx0cmV0dXJuIG5wYXRoXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogcmVzb2x2ZXMgbXVsdGlwbGUgcGF0aCBwYXJ0cyB0byBhIHNpbmdsZSBwYXRoXG4gKiByZXR1cm5zIG5vcm1hbGl6ZWQgcGF0aFxuICovXG5cbmV4cG9ydCBta3BhdGggOj0gKGxQYXJ0cy4uLjogc3RyaW5nW10pOiBzdHJpbmcgPT5cblxuXHRwYXRoIDo9IHBhdGhMaWIucmVzb2x2ZShsUGFydHMuLi4pXG5cdHJldHVybiBub3JtYWxpemVQYXRoKHBhdGgpXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogcmVzb2x2ZXMgbXVsdGlwbGUgcGF0aCBwYXJ0cyB0byBhIHNpbmdsZSBwYXRoXG4gKiByZXR1cm5zIG5vcm1hbGl6ZWQgcGF0aCwgcmVsYXRpdmUgdG8gY3VycmVudCBkaXJlY3RvcnlcbiAqL1xuXG5leHBvcnQgcmVscGF0aCA6PSAobFBhcnRzLi4uOiBzdHJpbmdbXSk6IHN0cmluZyA9PlxuXG5cdGFzc2VydCBpc0FycmF5T2ZTdHJpbmdzKGxQYXJ0cyksIFwiQmFkIGxQYXJ0czogI3tPTChsUGFydHMpfVwiXG5cdGZ1bGxQYXRoIDo9IHBhdGhMaWIucmVzb2x2ZSBsUGFydHMuLi5cblx0cmV0dXJuIG5vcm1hbGl6ZVBhdGggcGF0aExpYi5yZWxhdGl2ZSgnJywgZnVsbFBhdGgpXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbmV4cG9ydCB0eXBlIHBhdGhEZXNjID0ge1xuXHRkaXI6IHN0cmluZ1xuXHRyb290OiBzdHJpbmdcblx0bFBhcnRzOiBzdHJpbmdbXVxuXHR9XG5cbi8qKlxuICogcmV0dXJucyB7ZGlyLCByb290LCBsUGFydHN9IHdoZXJlIGxQYXJ0cyBpbmNsdWRlcyB0aGUgbmFtZXMgb2ZcbiAqIGFsbCBkaXJlY3RvcmllcyBiZXR3ZWVuIHRoZSByb290IGFuZCB0aGUgZmlsZSBuYW1lXG4gKiByZWxhdGl2ZSB0byB0aGUgY3VycmVudCB3b3JraW5nIGRpcmVjdG9yeVxuICovXG5cbmV4cG9ydCBwYXRoU3ViRGlycyA9IChwYXRoOiBzdHJpbmcsIGhPcHRpb25zOiBvcHRpb25zcGVjPXt9KTogcGF0aERlc2MgPT5cblxuXHR7cmVsYXRpdmV9IDo9IGdldE9wdGlvbnMgaE9wdGlvbnMsIHtcblx0XHRyZWxhdGl2ZTogZmFsc2Vcblx0XHR9XG5cdHBhdGggPSByZWxhdGl2ZSA/IHJlbHBhdGgocGF0aCkgOiBta3BhdGgocGF0aClcblx0e3Jvb3QsIGRpcn0gOj0gcGF0aExpYi5wYXJzZShwYXRoKVxuXHRyZXR1cm4ge1xuXHRcdGRpclxuXHRcdHJvb3Rcblx0XHRsUGFydHM6IGRpci5zbGljZShyb290Lmxlbmd0aCkuc3BsaXQoL1tcXFxcXFwvXS8pXG5cdFx0fVxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuIyAtLS0gU2hvdWxkIGJlIGNhbGxlZCBsaWtlOiBteXNlbGYoaW1wb3J0Lm1ldGEudXJsKVxuIyAgICAgcmV0dXJucyBmdWxsIHBhdGggb2YgY3VycmVudCBmaWxlXG5cbmV4cG9ydCBteXNlbGYgOj0gKHVybDogc3RyaW5nKTogc3RyaW5nID0+XG5cblx0cmV0dXJuIHJlbHBhdGggdXJsTGliLmZpbGVVUkxUb1BhdGgodXJsKVxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogcmVhZCBhIGZpbGUgaW50byBhIHN0cmluZ1xuICovXG5cbmV4cG9ydCBzbHVycCA6PSAocGF0aDogc3RyaW5nKTogc3RyaW5nID0+XG5cblx0YXNzZXJ0IGlzRmlsZShwYXRoKSwgXCJObyBzdWNoIGZpbGU6ICN7cGF0aH0gKHNsdXJwKVwiXG5cdGRhdGEgOj0gRGVuby5yZWFkRmlsZVN5bmMgcGF0aFxuXHRyZXR1cm4gZGVjb2Rlci5kZWNvZGUoZGF0YSkucmVwbGFjZUFsbCgnXFxyJywgJycpXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogd3JpdGUgYSBzdHJpbmcgdG8gYSBmaWxlXG4gKiB3aWxsIGVuc3VyZSB0aGF0IGFsbCBuZWNlc3NhcnkgZGlyZWN0b3JpZXMgZXhpc3RcbiAqL1xuXG5leHBvcnQgYmFyZiA6PSAoXG5cdGNvbnRlbnRzOiBzdHJpbmcsXG5cdHBhdGg6IHN0cmluZyxcblx0aE9wdGlvbnM6IG9wdGlvbnNwZWM9e31cblx0KTogdm9pZCA9PlxuXG5cdHthcHBlbmR9IDo9IGdldE9wdGlvbnMgaE9wdGlvbnMsIHtcblx0XHRhcHBlbmQ6IGZhbHNlXG5cdFx0fVxuXHRta0RpcnNGb3JGaWxlKHBhdGgpXG5cdGRhdGEgOj0gZW5jb2Rlci5lbmNvZGUoY29udGVudHMpXG5cdGlmIGFwcGVuZCAmJiBpc0ZpbGUocGF0aClcblx0XHRhcHBlbmRGaWxlU3luYyBwYXRoLCBkYXRhXG5cdGVsc2Vcblx0XHREZW5vLndyaXRlRmlsZVN5bmMgcGF0aCwgZGF0YVxuXHRyZXR1cm5cblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuZXhwb3J0IG5ld2VyRGVzdEZpbGVFeGlzdHMgOj0gKFxuXHRzcmNQYXRoOiBzdHJpbmcsXG5cdGRlc3RQYXRoOiBzdHJpbmdcblx0KTogYm9vbGVhbiA9PlxuXG5cdGFzc2VydCBpc0ZpbGUoc3JjUGF0aCksIFwiTm8gc3VjaCBmaWxlOiAje09MKHNyY1BhdGgpfSAobmV3ZXJEZXN0RmlsZUV4aXN0cylcIlxuXHRpZiBub3QgZXhpc3RzU3luYyhkZXN0UGF0aClcblx0XHRyZXR1cm4gZmFsc2Vcblx0c3JjTW9kVGltZSA6PSBzdGF0U3luYyhzcmNQYXRoKS5tdGltZU1zXG5cdGRlc3RNb2RUaW1lIDo9IHN0YXRTeW5jKGRlc3RQYXRoKS5tdGltZU1zXG5cdHJldHVybiAoZGVzdE1vZFRpbWUgPiBzcmNNb2RUaW1lKVxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKipcbiAqIGNyZWF0ZSBhIG5ldyBkaXJlY3RvcnkgaWYgaXQgZG9lc24ndCBleGlzdFxuICogaWYgdGhlIG9wdGlvbiAnY2xlYXInIGlzIHNldCB0byBhIHRydWUgdmFsdWUgaW4gdGhlIDJuZCBwYXJhbWV0ZXJcbiAqIGFuZCB0aGUgZGlyZWN0b3J5IGFscmVhZHkgZXhpc3RzLCBpdCBpcyBjbGVhcmVkXG4gKi9cblxuZXhwb3J0IG1rRGlyID0gKGRpclBhdGg6IHN0cmluZywgY2xlYXI6IGJvb2xlYW49ZmFsc2UpOiB2b2lkID0+XG5cblx0aWYgY2xlYXJcblx0XHRlbXB0eURpclN5bmMgZGlyUGF0aCAgICAjIC0tLSBjcmVhdGVzIGlmIGl0IGRvZXNuJ3QgZXhpc3Rcblx0ZWxzZVxuXHRcdGVuc3VyZURpclN5bmMgZGlyUGF0aFxuXHRyZXR1cm5cblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuLyoqXG4gKiByZW1vdmUgYSBmaWxlIGZyb20gdGhlIGZpbGUgc3lzdGVtLCBidXQgZG8gbm90aGluZ1xuICogaWYgdGhlIGZpbGUgZG9lcyBub3QgZXhpc3RcbiAqL1xuXG5leHBvcnQgcm1GaWxlIDo9IChwYXRoOiBzdHJpbmcpOiB2b2lkID0+XG5cblx0aWYgZXhpc3RzU3luYyBwYXRoXG5cdFx0RGVuby5yZW1vdmVTeW5jIHBhdGhcblx0cmV0dXJuXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogcmVtb3ZlIGEgZGlyZWN0b3J5IGZyb20gdGhlIGZpbGUgc3lzdGVtLCBidXQgZG8gbm90aGluZ1xuICogaWYgdGhlIGRpcmVjdG9yeSBkb2VzIG5vdCBleGlzdFxuICogTk9URTogWW91IG11c3QgcGFzcyB0aGUgJ2NsZWFyJyBvcHRpb24gaWYgdGhlIGRpcmVjdG9yeVxuICogICAgICAgaXMgbm90IGVtcHR5XG4gKi9cblxuZXhwb3J0IHJtRGlyIDo9IChwYXRoOiBzdHJpbmcsIGhPcHRpb25zOiBvcHRpb25zcGVjPXt9KTogdm9pZCA9PlxuXG5cdHtjbGVhcn0gOj0gZ2V0T3B0aW9ucyBoT3B0aW9ucywge1xuXHRcdGNsZWFyOiBmYWxzZVxuXHRcdH1cblx0aWYgZXhpc3RzU3luYyBwYXRoXG5cdFx0aWYgY2xlYXJcblx0XHRcdERlbm8ucmVtb3ZlU3luYyBwYXRoLCB7cmVjdXJzaXZlOiB0cnVlfVxuXHRcdGVsc2Vcblx0XHRcdERlbm8ucmVtb3ZlU3luYyBwYXRoXG5cdHJldHVyblxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKipcbiAqIGNyZWF0ZSBhbnkgbWlzc2luZyBkaXJlY3RvcmllcyBpbiB0aGUgZ2l2ZW4gcGF0aFxuICovXG5cbmV4cG9ydCBta0RpcnNGb3JGaWxlID0gKHBhdGg6IHN0cmluZyk6IHZvaWQgPT5cblxuXHR7cm9vdCwgbFBhcnRzfSA6PSBwYXRoU3ViRGlycyhwYXRoKVxuXHRsZXQgZGlyID0gcm9vdFxuXHRmb3IgcGFydCBvZiBsUGFydHNcblx0XHRkaXIgKz0gXCIvI3twYXJ0fVwiXG5cdFx0aWYgbm90IGlzRGlyKGRpcilcblx0XHRcdG1rRGlyIGRpclxuXHRyZXR1cm5cblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuLyoqXG4gKiBkZWxldGVzIGFsbCBmaWxlcyBhbmQgc3ViZGlyZWN0b3JpZXMgaW4gdGhlIGdpdmVuIGRpcmVjdG9yeVxuICovXG5cbmV4cG9ydCBjbGVhckRpciA9IChkaXJQYXRoOiBzdHJpbmcpOiB2b2lkID0+XG5cblx0ZW1wdHlEaXJTeW5jIGRpclBhdGhcblx0cmV0dXJuXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4jIC0tLSBoT3B0aW9ucyBnZXRzIHBhc3NlZCB0byBhbGxGaWxlc01hdGNoaW5nKClcblxuZXhwb3J0IHJlbW92ZUZpbGVzTWF0Y2hpbmcgOj0gKFxuXHRwYXR0ZXJuOiBzdHJpbmcsXG5cdGhPcHRpb25zOiBvcHRpb25zcGVjPXt9XG5cdCk6IHZvaWQgPT5cblxuXHRhc3NlcnQgKHBhdHRlcm4gIT0gJyonKSAmJiAocGF0dGVybiAhPSAnKionKSxcblx0XHRcIkNhbid0IGRlbGV0ZSBmaWxlcyBtYXRjaGluZyAje09MKHBhdHRlcm4pfVwiXG5cdGZvciB7cmVsUGF0aH0gb2YgYWxsRmlsZXNNYXRjaGluZyhwYXR0ZXJuLCBoT3B0aW9ucylcblx0XHREZW5vLnJlbW92ZVN5bmMgcmVsUGF0aFxuXHRyZXR1cm5cblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuZXhwb3J0IHJlbW92ZUZpbGVzRXhjZXB0IDo9IChcblx0cGF0dGVybjogc3RyaW5nLFxuXHRsS2VlcDogc3RyaW5nW10sXG5cdGhPcHRpb25zOiBvcHRpb25zcGVjID0ge31cblx0KTogdm9pZCA9PlxuXG5cdHtkZWJ1Z30gOj0gZ2V0T3B0aW9ucyBoT3B0aW9ucywge1xuXHRcdGRlYnVnOiBmYWxzZVxuXHRcdH1cblx0REJHIDo9IChtc2c6IHN0cmluZyk6IHZvaWQgPT5cblx0XHRpZiBkZWJ1Z1xuXHRcdFx0Y29uc29sZS5sb2cgbXNnXG5cdFx0cmV0dXJuXG5cblx0IyAtLS0gdHJ1ZSByZXR1cm4gbWVhbnMgcmVtb3ZlIGl0XG5cdGZpbHRlciA6PSAoaEZpbGU6IHBhdGhJbmZvKTogYm9vbGVhbiA9PlxuXHRcdHt0eXBlLCByZWxQYXRofSA6PSBoRmlsZVxuXHRcdGlmICh0eXBlICE9ICdmaWxlJylcblx0XHRcdHJldHVybiBmYWxzZVxuXHRcdHJldHVybiBub3QgbEtlZXAuaW5jbHVkZXMocmVsUGF0aClcblxuXHRoOiBvcHRpb25zcGVjIDo9IHtmaWx0ZXIsIGRlYnVnfVxuXHRmb3Ige3JlbFBhdGh9IG9mIGFsbEZpbGVzTWF0Y2hpbmcocGF0dGVybiwgaClcblx0XHREQkcgXCJSRU1PVkUgRklMRSAje3JlbFBhdGh9XCJcblx0XHREZW5vLnJlbW92ZVN5bmMgcmVsUGF0aFxuXHRyZXR1cm5cblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuZXhwb3J0IHJlbW92ZURpcnNFeGNlcHQgOj0gKFxuXHRwYXR0ZXJuOiBzdHJpbmcsXG5cdGxLZWVwOiBzdHJpbmdbXSxcblx0aE9wdGlvbnM6IG9wdGlvbnNwZWMgPSB7fVxuXHQpOiB2b2lkID0+XG5cblx0e2RlYnVnfSA6PSBnZXRPcHRpb25zIGhPcHRpb25zLCB7XG5cdFx0ZGVidWc6IGZhbHNlXG5cdFx0fVxuXHREQkcgOj0gKG1zZzogc3RyaW5nKTogdm9pZCA9PlxuXHRcdGlmIGRlYnVnXG5cdFx0XHRjb25zb2xlLmxvZyBtc2dcblx0XHRyZXR1cm5cblxuXHQjIC0tLSB0cnVlIHJldHVybiBtZWFucyByZW1vdmUgaXRcblx0ZmlsdGVyIDo9IChoRmlsZTogcGF0aEluZm8pOiBib29sZWFuID0+XG5cdFx0e3R5cGUsIHJlbFBhdGh9IDo9IGhGaWxlXG5cdFx0aWYgKHR5cGUgIT0gJ2RpcicpXG5cdFx0XHRyZXR1cm4gZmFsc2Vcblx0XHRyZXR1cm4gbm90IGxLZWVwLmluY2x1ZGVzKHJlbFBhdGgpXG5cblx0aDogb3B0aW9uc3BlYyA6PSB7ZmlsdGVyLCBpbmNsdWRlRGlyczogdHJ1ZX1cblx0cGF0aEZ1bmMgOj0gKGg6IGhhc2gpOiBzdHJpbmcgPT4gaC5wYXRoXG5cdGxEaXJzIDo9IEFycmF5LmZyb20oYWxsRmlsZXNNYXRjaGluZyhwYXR0ZXJuLCBoKSkubWFwKHBhdGhGdW5jKVxuXG5cdCMgLS0tIFdlIG5lZWQgdG8gcmVtb3ZlIGVtcHR5IHN1YmRpcmVjdG9yaWVzIGJlZm9yZVxuXHQjICAgICByZW1vdmluZyBhIGRpcmVjdG9yeSwgc28gd2UgYnVpbGQgYSBsaXN0IGFuZFxuXHQjICAgICByZW1vdmUgbG9uZ2VyIHBhdGhzIGJlZm9yZSBzaG9ydGVyIHBhdGhzXG5cblx0Y29tcGFyZUZ1bmMgOj0gKGE6IHN0cmluZywgYjogc3RyaW5nKTogbnVtYmVyID0+IChiLmxlbmd0aCAtIGEubGVuZ3RoKVxuXHRmb3IgcGF0aCBvZiBsRGlycy5zb3J0KGNvbXBhcmVGdW5jKVxuXHRcdERCRyBcIlJFTU9WRSBESVIgI3twYXRofVwiXG5cdFx0RGVuby5yZW1vdmVTeW5jIHBhdGhcblx0cmV0dXJuXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbmV4cG9ydCB0eXBlIGZzQ2hhbmdlVHlwZSA9IHtcblx0a2luZDogc3RyaW5nXG5cdHBhdGg6IHN0cmluZ1xuXHRtcz86IG51bWJlclxuXHR9XG5cbi8qKlxuICogdHlwZSBmc0NhbGxiYWNrRnVuYyAtIGEgZnVuY3Rpb24gdGFraW5nICh0eXBlLCBwYXRoKSBhbmQgb3B0aW9uYWxseVxuICogcmV0dXJucyBhIGZ1bmN0aW9uIHJlZmVyZW5jZSB0byBiZSBjYWxsZWQgb24gZmlsZSBjaGFuZ2VzXG4gKi9cblxuZXhwb3J0IHR5cGUgZnNDYWxsYmFja0Z1bmMgPSAoY2hhbmdlOiBmc0NoYW5nZVR5cGUpID0+IHZvaWRcblxuLyoqXG4gKiBjbGFzcyBGaWxlRXZlbnRIYW5kbGVyXG4gKiAgICBoYW5kbGVzIGZpbGUgY2hhbmdlZCBldmVudHMgd2hlbiAuaGFuZGxlKHtraW5kLCBwYXRofSkgaXMgY2FsbGVkXG4gKiAgICBjYWxsYmFjayBpcyBhIGZ1bmN0aW9uLCBkZWJvdW5jZWQgYnkgMjAwIG1zXG4gKiAgICAgICB0aGF0IHRha2VzICh0eXBlLCBwYXRoKSBhbmQgcmV0dXJucyBhIHZvaWRGdW5jXG4gKiAgICAgICB3aGljaCB3aWxsIGJlIGNhbGxlZCBpZiB0aGUgY2FsbGJhY2sgcmV0dXJucyBhIGZ1bmN0aW9uIHJlZmVyZW5jZVxuICogW3VuaXQgdGVzdHNdKC4uL3Rlc3QvZnMudGVzdC5jaXZldCM6fjp0ZXh0PSUyMyUyMCUyRCUyRCUyRCUyMGNsYXNzJTIwRmlsZUV2ZW50SGFuZGxlcilcbiAqL1xuXG5leHBvcnQgY2xhc3MgRmlsZUV2ZW50SGFuZGxlclxuXG5cdGNhbGxiYWNrOiBmc0NhbGxiYWNrRnVuYz9cblx0bENoYW5nZXM6IGZzQ2hhbmdlVHlwZVtdIDo9IFtdXG5cdGhIYW5kbGVyczogaGFzaCA9IHt9ICAgIyAtLS0gcGF0aCA9PiBldmVudCB0eXBlID0+IGRlYm91bmNlZCBoYW5kbGVyXG5cdG9uU3RvcDogKCkgPT4gdm9pZCA9IHBhc3Ncblx0bXM6IG51bWJlclxuXHRkZWJ1ZzogYm9vbGVhblxuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdFx0QGNhbGxiYWNrOiBmc0NhbGxiYWNrRnVuYz89dW5kZWYsXG5cdFx0XHRoT3B0aW9uczogb3B0aW9uc3BlYz17fVxuXHRcdFx0KVxuXG5cdFx0e1xuXHRcdFx0ZGVidWc6IEBkZWJ1Zyxcblx0XHRcdG9uU3RvcDogQG9uU3RvcFxuXHRcdFx0bXM6IEBtc1xuXHRcdFx0fSA6PSBnZXRPcHRpb25zIGhPcHRpb25zLCB7XG5cdFx0XHRcdGRlYnVnOiBmYWxzZVxuXHRcdFx0XHRvblN0b3A6IHBhc3Ncblx0XHRcdFx0bXM6IDIwMFxuXHRcdFx0XHR9XG5cdFx0QERCRyBcIkZpbGVFdmVudEhhbmRsZXIgY29uc3RydWN0b3IoKSBjYWxsZWRcIlxuXG5cdCMgLS0tIENhbGxzIGEgZnVuY3Rpb24gb2YgdHlwZSAoKSA9PiB2b2lkXG5cdCMgICAgIGJ1dCBpcyBkZWJvdW5jZWQgYnkgQG1zIG1zXG5cblx0aGFuZGxlKGNoYW5nZTogZnNDaGFuZ2VUeXBlKTogdm9pZFxuXHRcdHtraW5kLCBwYXRofSA6PSBjaGFuZ2Vcblx0XHRAREJHIFwiSEFORExFOiBbI3tzaW5jZUxvYWRTdHIoKX1dICN7a2luZH0gI3twYXRofVwiXG5cdFx0aWYgbm90ZGVmaW5lZChAaEhhbmRsZXJzPy5bcGF0aF0pXG5cdFx0XHRAREJHIFwiQ3JlYXRlIGhhbmRsZXIgZm9yICcje3BhdGh9J1wiLCAxXG5cdFx0XHRAaEhhbmRsZXJzW3BhdGhdID0ge31cblxuXHRcdGlmIG5vdGRlZmluZWQoQGhIYW5kbGVycz8uW3BhdGhdPy5ba2luZF0pXG5cdFx0XHRAREJHIFwiQ3JlYXRlIGhhbmRsZXIgZm9yICN7a2luZH0gI3twYXRofVwiLCAxXG5cdFx0XHRmdW5jIDo9ICgpID0+XG5cdFx0XHRcdGlmIEBjYWxsYmFja1xuXHRcdFx0XHRcdEBjYWxsYmFjayh7a2luZCwgcGF0aH0pXG5cdFx0XHRcdEBsQ2hhbmdlcy5wdXNoIHtraW5kLCBwYXRofVxuXHRcdFx0XHRAaEhhbmRsZXJzW3BhdGhdW2tpbmRdID0gdW5kZWZcblx0XHRcdFx0cmV0dXJuIHVuZGVmXG5cdFx0XHRAaEhhbmRsZXJzW3BhdGhdW2tpbmRdID0gZGVib3VuY2UoZnVuYywgQG1zKVxuXHRcdEBEQkcgXCJDYWxsIGRlYm91bmNlZCBoYW5kbGVyIGZvciAje2tpbmR9ICN7cGF0aH1cIlxuXHRcdEBoSGFuZGxlcnNbcGF0aF1ba2luZF0oKVxuXHRcdHJldHVyblxuXG5cdCMgQVNZTkMhXG5cdGdldENoYW5nZUxpc3QoKVxuXHRcdGF3YWl0IHNsZWVwIEBtc1xuXHRcdHJldHVybiBAbENoYW5nZXNcblxuXHRwcml2YXRlIERCRyhtc2c6IHN0cmluZywgbGV2ZWw6IG51bWJlcj0wKTogdm9pZFxuXHRcdGlmIEBkZWJ1Z1xuXHRcdFx0Y29uc29sZS5sb2cgXCIgICAje3NwYWNlcygzKmxldmVsKX0tICN7bXNnfVwiXG5cdFx0cmV0dXJuXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4jIEFTWU5DXG5cbmV4cG9ydCB0eXBlIHdhdGNoZXJDYWxsYmFja0Z1bmMgPSAoY2hhbmdlOiBmc0NoYW5nZVR5cGUpID0+IGJvb2xlYW5cblxuLyoqXG4gKiBhIGZ1bmN0aW9uIHRoYXQgd2F0Y2hlcyBmb3IgY2hhbmdlcyBvbmUgb3IgbW9yZSBmaWxlcyBvciBkaXJlY3Rvcmllc1xuICogICAgYW5kIGNhbGxzIGEgY2FsbGJhY2sgZnVuY3Rpb24gZm9yIGVhY2ggY2hhbmdlLlxuICogSWYgdGhlIGNhbGxiYWNrIHJldHVybnMgdHJ1ZSwgd2F0Y2hpbmcgaXMgaGFsdGVkXG4gKlxuICogVXNhZ2U6XG4gKiAgIGhhbmRsZXIgOj0gKGtpbmQsIHBhdGgpID0+IGNvbnNvbGUubG9nIHBhdGhcbiAqICAgYXdhaXQgd2F0Y2hGaWxlICd0ZW1wLnR4dCcsIGhhbmRsZXJcbiAqICAgYXdhaXQgd2F0Y2hGaWxlICdzcmMvbGliJywgIGhhbmRsZXJcbiAqICAgYXdhaXQgd2F0Y2hGaWxlIFsndGVtcC50eHQnLCAnc3JjL2xpYiddLCBoYW5kbGVyXG4gKi9cblxuZXhwb3J0IHdhdGNoRmlsZSA6PSAoXG5cdHBhdGg6IHN0cmluZyB8IHN0cmluZ1tdLFxuXHR3YXRjaGVyQ0I6IHdhdGNoZXJDYWxsYmFja0Z1bmMsXG5cdGhPcHRpb25zOiBvcHRpb25zcGVjPXt9XG5cdCk6IHZvaWQgLT5cblxuXHR7ZGVidWcsIG1zfSA6PSBnZXRPcHRpb25zIGhPcHRpb25zLCB7XG5cdFx0ZGVidWc6IGZhbHNlXG5cdFx0bXM6IDIwMFxuXHRcdH1cblx0REJHIDo9IChtc2c6IHN0cmluZyk6IHZvaWQgPT5cblx0XHRpZiBkZWJ1Z1xuXHRcdFx0Y29uc29sZS5sb2cgbXNnXG5cdFx0cmV0dXJuXG5cblx0REJHIFwiV0FUQ0g6ICN7SlNPTi5zdHJpbmdpZnkocGF0aCl9XCJcblxuXHR3YXRjaGVyIDo9IERlbm8ud2F0Y2hGcyhwYXRoKVxuXG5cdGxldCBkb1N0b3A6IGJvb2xlYW4gPSBmYWxzZVxuXG5cdGZzQ2FsbGJhY2s6IGZzQ2FsbGJhY2tGdW5jIDo9ICh7a2luZCwgcGF0aH0pID0+XG5cdFx0cmVzdWx0IDo9IHdhdGNoZXJDQih7a2luZCwgcGF0aH0pXG5cdFx0REJHIFwiRkNCOiByZXN1bHQgPSAje3Jlc3VsdH1cIlxuXHRcdGlmIHJlc3VsdFxuXHRcdFx0d2F0Y2hlci5jbG9zZSgpXG5cdFx0cmV0dXJuXG5cblx0aGFuZGxlciA6PSBuZXcgRmlsZUV2ZW50SGFuZGxlcihmc0NhbGxiYWNrLCB7ZGVidWcsIG1zfSlcblxuXHRmb3IgYXdhaXQge2tpbmQsIHBhdGhzfSBvZiB3YXRjaGVyXG5cdFx0REJHIFwid2F0Y2hlciBldmVudCBmaXJlZFwiXG5cdFx0aWYgZG9TdG9wXG5cdFx0XHREQkcgXCJkb1N0b3AgPSAje2RvU3RvcH0sIENsb3Npbmcgd2F0Y2hlclwiXG5cdFx0XHRicmVha1xuI1x0XHR7a2luZCwgcGF0aHN9IDo9IGV2dFxuXHRcdGZvciBwYXRoIG9mIHBhdGhzXG5cdFx0XHQjIC0tLSBmc0NhbGxiYWNrIHdpbGwgYmUgKGV2ZW50dWFsbHkpIGNhbGxlZFxuXHRcdFx0aGFuZGxlci5oYW5kbGUoe2tpbmQsIHBhdGh9KVxuXG5leHBvcnQgd2F0Y2hGaWxlcyA6PSB3YXRjaEZpbGVcbiJdfQ==