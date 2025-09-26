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
	slurp,
	} from 'base-utils'
import {
	undef, defined, notdefined, assert, croak, isEmpty, nonEmpty,
	isString, isNonEmptyString, isBoolean, isNumber, isInteger,
	isArray, isArrayOfStrings, isHash, isRegExp,
	integer, hash, voidFunc,
	} from 'datatypes'
import {
	getOptions, removeEmptyKeys, pass,
	spaces, sinceLoadStr, sleep, relpath,
	} from 'llutils'
import {OL, ML} from 'to-nice'
import {
	pushLogLevel, popLogLevel, LOG, DBG, ERR,
	INDENT, UNDENT, DBGVALUE, DBGLABELED,
	} from 'logger'

export {slurp, relpath}

// --- Create a function capable of synchronously
//     importing ESM modules

const Deno = globalThis.Deno
export type FsEvent = Deno.FsEvent

// --- not exported
const decoder = new TextDecoder('utf-8')
const encoder = new TextEncoder()

// ---------------------------------------------------------------------------

export const isFile = (path: string): boolean => {

	return existsSync(path) && statSync(path).isFile()
}

// ---------------------------------------------------------------------------

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

export type TFileFilterFunc = (hInfo: TPathInfo) => boolean

export const allFilesMatching = function*(
		pattern: string='**',
		hOptions: hash={}
		): Generator<TPathInfo, void, void> {

	type opt = {
		root: (string | undefined)
		lExclude: string[]
		includeDirs: boolean
		followSymlinks: boolean
		canonicalize: boolean
		filter: (TFileFilterFunc | undefined)
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
			if (filter(hFile)) {
				DBG("   - allowed by filter")
				yield hFile
			}
			else {
				DBG("   - excluded by filter")
			}
		}
	}
	return
}

// ---------------------------------------------------------------------------
// returns full path to file

export const findSrcFile = (
		fileName: string,
		hOptions: hash={}
		): (string | undefined) => {

	type opt = {
		root: (string | undefined)
		}
	const {root} = getOptions<opt>(hOptions, {
		root: './src'
		})

	const lFiles = Array.from(allFilesMatching(`**/${fileName}`, {root}))
	DBGVALUE('lFiles', lFiles)
	switch(lFiles.length) {
		case 1: {
			const {path} = lFiles[0]
			assert(isFile(path), `Not a file: ${OL(path)}`)
			return path
		}
		case 0: {
			return undef
		}
		default: {
			croak(`Multiple files with name ${OL(fileName)}`)
			return ''
		}
	}
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

export const isExt = (str: string): boolean => {

	return /^\.[A-Za-z0-9_]+$/.test(str)
}

// ---------------------------------------------------------------------------

export const newerDestFileExists = (
	srcPath: string,
	destPath: string
	): boolean => {

	if (isExt(destPath)) {
		destPath = withExt(srcPath, destPath)
	}
	assert(isFile(srcPath), `No such file: ${OL(srcPath)}`)
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
	const filter = (hFile: TPathInfo) => {
		const {type, relPath} = hFile
		if (type !== 'file') {
			return undef
		}
		const removeFile = !lKeep.includes(relPath)
		DBG(`filter(${relPath}): removeFile = ${removeFile}`)
		return removeFile
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
 * type TFsEventHandler
 *    - a function taking (kind, path)
 *   - optionally returns boolean to indicate stop watching
 */

export type TFsEventHandler = (kind: string, path: string) => void | boolean

/**
 * class FileEventHandler
 *    handles file changed events when .handle(fsEvent) is called
 *    callback is a function, debounced by 200 ms
 *       that takes an FsEvent and returns a voidFunc
 *       which will be called if the callback returns a function reference
 * [unit tests](../test/fs.test.civet#:~:text=%23%20%2D%2D%2D%20class%20FileEventHandler)
 */

export class FileEventHandler {

	handler: TFsEventHandler   // --- debounced handler
	onStop: () => void = pass

	// ..........................................................

	constructor(
			callback: TFsEventHandler,
			hOptions: hash={}
			) {

		type opt = {
			onStop: voidFunc
			debounceBy: number
			}
		const {
			onStop: onStop1,
			debounceBy
			} = getOptions<opt>(hOptions, {
				onStop: pass,
				debounceBy: 200
				});this.onStop = onStop1;
		const handler1 = debounce(callback, debounceBy);this.handler = handler1;
		DBG("FileEventHandler constructor() called")
	}

	// ..........................................................
	// --- Calls a voidFunc, but is debounced by @ms ms

	handle(fsEvent: FsEvent): void {
		const {kind, paths} = fsEvent
		DBG(`HANDLE: [${sinceLoadStr()}] ${kind} ${OL(paths)}`)

		for (const path of paths) {
			this.handler(kind, path)
		}
		return
	}
}

// ---------------------------------------------------------------------------
// ASYNC

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
	watcherCB: TFsEventHandler,
	hOptions: hash={}
	): AutoPromise<void> {

	// --- debounceBy is milliseconds to debounce by, default is 200
	const {debounceBy} = getOptions<{debounceBy: number}>(hOptions, {
		debounceBy: 200
		})

	DBG(`WATCH: ${OL(path)}`)
	const watcher = Deno.watchFs(path)

	let doStop: boolean = false

	const fsCallback: TFsEventHandler = (kind, path) => {
		const result = watcherCB(kind, path)
		DBG(`FCB: result = ${result}`)
		if (result) {
			watcher.close()
		}
		return
	}

	const handler = new FileEventHandler(fsCallback, {debounceBy})

	for await (const item of watcher) {const fsEvent: FsEvent = item;
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

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQzpcXFVzZXJzXFxqb2huZFxcdXRpbHNcXHNyY1xcbGliXFxmc3lzLmxpYi5jaXZldC50c3giLCJzb3VyY2VzIjpbIkM6XFxVc2Vyc1xcam9obmRcXHV0aWxzXFxzcmNcXGxpYlxcZnN5cy5saWIuY2l2ZXQiXSwibWFwcGluZ3MiOiI7QUFBQSxpQkFBZ0I7QUFDaEIsQUFBQTtBQUNBLEssVyx5QjtBQUFBLE1BQU0sQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLElBQUksQ0FBQyxxQkFBcUI7QUFDNUMsQUFBQSxBQUFBLE1BQU0sQ0FBQyxDQUFDO0FBQ1IsQ0FBQyxVQUFVLENBQUMsQ0FBQyxZQUFZLENBQUMsQ0FBQyxhQUFhLENBQUM7QUFDekMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFNBQVM7QUFDakIsQUFBQSxBQUFBLE1BQU0sQ0FBQyxDQUFDO0FBQ1IsQ0FBQyxjQUFjLENBQUM7QUFDaEIsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFNBQVM7QUFDakIsQUFBQSxBQUFBLE1BQU0sQ0FBQyxDQUFDLFlBQVksQ0FBQyxDQUFDLElBQUksQ0FBQyxhQUFhO0FBQ3hDLEFBQUE7QUFDQSxBQUFBLHdEQUF1RDtBQUN2RCxBQUFBLGtCQUFpQjtBQUNqQixBQUFBLEFBQUEsTUFBTSxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsSUFBSSxDQUFDLFNBQVM7QUFDaEMsQUFBQTtBQUNBLEFBQUEsQUFBQSxNQUFNLENBQUMsQ0FBQyxjQUFjLENBQUMsQ0FBQyxJQUFJLENBQUMscUJBQXFCO0FBQ2xELEFBQUEsQUFBQSxNQUFNLENBQUMsQ0FBQyxjQUFjLENBQUMsQ0FBQyxJQUFJLENBQUMsY0FBYztBQUMzQyxBQUFBO0FBQ0EsQUFBQSw4QkFBNkI7QUFDN0IsQUFBQSxBQUFBLE1BQU0sQ0FBQyxDQUFDO0FBQ1IsQ0FBQyxLQUFLLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxXQUFXLENBQUM7QUFDdkMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFD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QUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUUsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDO0FBQzNDLEFBQUE7QUFDQSxBQUFBLENBQU8sTUFBTixNQUFNLENBQUMsQ0FBRSxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDO0FBQzlCLEFBQUEsQyxJLEksQ0FBeUIsTUFBTSxDQUFBLEFBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQSxDQUFBLENBQUE7QUFDN0MsQUFBQSxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUEsQ0FBQSxDQUFBO0FBQ1IsQUFBQSxHLEksR0FBRyxLQUFLLENBQUEsQUFBQyxjQUFjLENBQUEsTztFQUFBLENBQUE7QUFDdkIsQUFBQSxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUEsQ0FBQSxDQUFBO0FBQ1IsQUFBQSxHLEksR0FBRyxDQUFDLFFBQVEsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLEtBQUssQ0FBQyxPO0VBQUEsQ0FBQTtBQUMzQixBQUFBLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQSxDQUFBLENBQUE7QUFDUixBQUFBLEcsSSxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPO0VBQUEsQ0FBQTtBQUN0QyxBQUFBLEVBQUUsT0FBSSxDQUFBLENBQUEsQ0FBQTtBQUNOLEFBQUEsRyxJLEdBQUcsQ0FBQztBQUNKLEFBQUEsSUFBSSxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0FBQ2xDLEFBQUEsSUFBSSxNQUFNLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDbEIsQUFBQSxJQUFJLENBQUMsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFD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Q25CLEFBQUEsRUFBRSxJQUFJLENBQUMsVUFBVSxDQUFBLEFBQUMsSUFBSSxDO0NBQUEsQ0FBQTtBQUN0QixBQUFBLENBQUMsTTtBQUFNLENBQUE7QUFDUCxBQUFBO0FBQ0EsQUFBQSw4RUFBNkU7QUFDN0UsQUFBQTtBQUNBLEFBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLEdBQUc7QUFDSCxBQUFBO0FBQ0EsQUFBQSxBQUFBLE1BQU0sQ0FBTSxNQUFMLEtBQUssQ0FBQyxDQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUEsQ0FBQTtBQUMxRCxBQUFBO0FBQ0EsQUFBQSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDYixBQUFBLEVBQUUsS0FBSyxDQUFDLENBQUMsT0FBTztBQUNoQixFQUFFLENBQUM7QUFDSCxBQUFBLENBQVEsTUFBUCxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUUsQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLENBQUEsQUFBQyxRQUFRLENBQUMsQ0FBQyxDQUFDO0FBQ3ZDLEFBQUEsRUFBRSxLQUFLLENBQUMsQ0FBQyxLQUFLO0FBQ2QsRUFBRSxDQUFDLENBQUE7QUFDSCxBQUFBLENBQUMsR0FBRyxDQUFBLFVBQVUsQ0FBQSxBQUFDLElBQUksQ0FBQSxDQUFBLENBQUEsQ0FBQTtBQUNuQixBQUFBLEVBQUUsR0FBRyxDQUFBLEtBQUssQ0FBQSxDQUFBLENBQUE7QUFDVixBQUFBLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQSxBQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsSUFBSSxDQUFDLEM7RUFBQSxDQUFBO0FBQzFDLEFBQUEsRUFBRSxJQUFJLENBQUEsQ0FBQTtBQUNOLEFBQUEsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFBLEFBQUMsSUFBSSxDO0VBQUEsQztDQUFBLENBQUE7QUFDdkIsQUFBQSxDQUFDLE07QUFBTSxDQUFBO0FBQ1AsQUFBQTtBQUNBLEFBQUEsOEVBQTZFO0FBQzdFLEFBQUE7QUFDQSxBQUFBO0FBQ0E7QUFDQSxHQUFHO0FBQ0gsQUFBQTtBQUNBLEFBQUEsQUFBQSxNQUFNLENBQWMsTUFBYixhQUFhLENBQUMsQ0FBRSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFBLENBQUE7QUFDL0MsQUFBQTtBQUNBLEFBQUEsQ0FBZSxNQUFkLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBRSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUM7QUFDcEMsQUFBQSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLElBQUk7QUFDZixBQUFBLENBQUMsR0FBRyxDQUFDLENBQUEsTUFBQSxJQUFJLENBQUMsRUFBRSxDQUFDLE1BQU0sQ0FBQSxDQUFBLENBQUE7QUFDbkIsQUFBQSxFQUFFLEdBQUcsQyxFQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUM7QUFDbkIsQUFBQSxFQUFFLEdBQUcsQ0FBQSxDQUFJLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQSxDQUFBLENBQUE7QUFDbkIsQUFBQSxHQUFHLEtBQUssQ0FBQSxBQUFDLEdBQUcsQztFQUFBLEM7Q0FBQSxDQUFBO0FBQ1osQUFBQSxDQUFDLE07QUFBTSxDQUFBO0FBQ1AsQUFBQTtBQUNBLEFBQUEsOEVBQTZFO0FBQzdFLEFBQUE7QUFDQSxBQUFBO0FBQ0E7QUFDQSxHQUFHO0FBQ0gsQUFBQTtBQUNBLEFBQUEsQUFBQSxNQUFNLENBQVMsTUFBUixRQUFRLENBQUMsQ0FBRSxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFBLENBQUE7QUFDN0MsQUFBQTtBQUNBLEFBQUEsQ0FBQyxZQUFZLENBQUEsQUFBQyxPQUFPLENBQUE7QUFDckIsQUFB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Q0FBUyxNQUFSLFFBQVEsQ0FBQyxDQUFFLENBQUMsSUFBSSxDQUFDLGdCQUFnQixDQUFBLEFBQUMsSUFBSSxDQUFBO0FBQ3ZDLEFBQUEsQ0FBTSxNQUFMLEtBQUssQ0FBQyxDQUFFLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQSxBQUFDLElBQUksQ0FBQTtBQUMvQixBQUFBLENBQU8sTUFBTixNQUFNLENBQUMsQ0FBRSxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUEsQUFBQyxHQUFHLENBQUE7QUFDL0IsQUFBQSxDQUFDLEdBQUcsQ0FBQSxDQUFDLE1BQU0sQ0FBQyxHQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxHQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUEsQ0FBQSxDQUFBO0FBQ3pELEFBQUEsRUFBRSxJQUFJLENBQUMsaUJBQWlCLENBQUEsQUFBQyxJQUFJLENBQUMsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDO0NBQUEsQ0FBQTtBQUM1RCxBQUFBLENBQUMsTTtBQUFNLENBQUE7QUFDUCIsIm5hbWVzIjpbXSwic291cmNlc0NvbnRlbnQiOlsiIyBmc3lzLmxpYi5jaXZldFxyXG5cclxuaW1wb3J0IHtkZWJvdW5jZX0gZnJvbSAnQHN0ZC9hc3luYy9kZWJvdW5jZSdcclxuaW1wb3J0IHtcclxuXHRleGlzdHNTeW5jLCBlbXB0eURpclN5bmMsIGVuc3VyZURpclN5bmMsXHJcblx0fSBmcm9tICdAc3RkL2ZzJ1xyXG5pbXBvcnQge1xyXG5cdGFwcGVuZEZpbGVTeW5jLFxyXG5cdH0gZnJvbSAnbm9kZTpmcydcclxuaW1wb3J0IHtFdmVudEVtaXR0ZXJ9IGZyb20gJ25vZGU6ZXZlbnRzJ1xyXG5cclxuIyAtLS0gRGVubydzIHN0YXRTeW5jIGFuZCBsc3RhdFN5bmMgYXJlIHN0aWxsIHVuc3RhYmxlLFxyXG4jICAgICBzbyB1c2UgdGhpc1xyXG5pbXBvcnQge3N0YXRTeW5jfSBmcm9tICdub2RlOmZzJ1xyXG5cclxuaW1wb3J0IHtleHBhbmRHbG9iU3luY30gZnJvbSAnQHN0ZC9mcy9leHBhbmQtZ2xvYidcclxuaW1wb3J0IHtUZXh0TGluZVN0cmVhbX0gZnJvbSAnQHN0ZC9zdHJlYW1zJ1xyXG5cclxuIyAtLS0gVXNlIERlbm8ncyBwYXRoIGxpYnJhcnlcclxuaW1wb3J0IHtcclxuXHRwYXJzZSwgcmVzb2x2ZSwgcmVsYXRpdmUsIGZyb21GaWxlVXJsLFxyXG5cdH0gZnJvbSAnQHN0ZC9wYXRoJ1xyXG5cclxuaW1wb3J0IHtcclxuXHRzbHVycCxcclxuXHR9IGZyb20gJ2Jhc2UtdXRpbHMnXHJcbmltcG9ydCB7XHJcblx0dW5kZWYsIGRlZmluZWQsIG5vdGRlZmluZWQsIGFzc2VydCwgY3JvYWssIGlzRW1wdHksIG5vbkVtcHR5LFxyXG5cdGlzU3RyaW5nLCBpc05vbkVtcHR5U3RyaW5nLCBpc0Jvb2xlYW4sIGlzTnVtYmVyLCBpc0ludGVnZXIsXHJcblx0aXNBcnJheSwgaXNBcnJheU9mU3RyaW5ncywgaXNIYXNoLCBpc1JlZ0V4cCxcclxuXHRpbnRlZ2VyLCBoYXNoLCB2b2lkRnVuYyxcclxuXHR9IGZyb20gJ2RhdGF0eXBlcydcclxuaW1wb3J0IHtcclxuXHRnZXRPcHRpb25zLCByZW1vdmVFbXB0eUtleXMsIHBhc3MsXHJcblx0c3BhY2VzLCBzaW5jZUxvYWRTdHIsIHNsZWVwLCByZWxwYXRoLFxyXG5cdH0gZnJvbSAnbGx1dGlscydcclxuaW1wb3J0IHtPTCwgTUx9IGZyb20gJ3RvLW5pY2UnXHJcbmltcG9ydCB7XHJcblx0cHVzaExvZ0xldmVsLCBwb3BMb2dMZXZlbCwgTE9HLCBEQkcsIEVSUixcclxuXHRJTkRFTlQsIFVOREVOVCwgREJHVkFMVUUsIERCR0xBQkVMRUQsXHJcblx0fSBmcm9tICdsb2dnZXInXHJcblxyXG5leHBvcnQge3NsdXJwLCByZWxwYXRofVxyXG5cclxuIyAtLS0gQ3JlYXRlIGEgZnVuY3Rpb24gY2FwYWJsZSBvZiBzeW5jaHJvbm91c2x5XHJcbiMgICAgIGltcG9ydGluZyBFU00gbW9kdWxlc1xyXG5cclxuRGVubyA6PSBnbG9iYWxUaGlzLkRlbm9cclxuZXhwb3J0IHR5cGUgRnNFdmVudCA9IERlbm8uRnNFdmVudFxyXG5cclxuIyAtLS0gbm90IGV4cG9ydGVkXHJcbmRlY29kZXIgOj0gbmV3IFRleHREZWNvZGVyKCd1dGYtOCcpXHJcbmVuY29kZXIgOj0gbmV3IFRleHRFbmNvZGVyKClcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgaXNGaWxlIDo9IChwYXRoOiBzdHJpbmcpOiBib29sZWFuID0+XHJcblxyXG5cdHJldHVybiBleGlzdHNTeW5jKHBhdGgpICYmIHN0YXRTeW5jKHBhdGgpLmlzRmlsZSgpXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuZXhwb3J0IGlzRGlyIDo9IChwYXRoOiBzdHJpbmcpOiBib29sZWFuID0+XHJcblxyXG5cdHJldHVybiBleGlzdHNTeW5jKHBhdGgpICYmIHN0YXRTeW5jKHBhdGgpLmlzRGlyZWN0b3J5KClcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG4vKipcclxuICogcmV0dXJucyBvbmUgb2Y6XHJcbiAqICAgICdtaXNzaW5nJyAgLSBkb2VzIG5vdCBleGlzdFxyXG4gKiAgICAnZGlyJyAgICAgIC0gaXMgYSBkaXJlY3RvcnlcclxuICogICAgJ2ZpbGUnICAgICAtIGlzIGEgZmlsZVxyXG4gKiAgICAnc3ltbGluaycgIC0gaXMgYSBzeW1saW5rXHJcbiAqICAgICd1bmtub3duJyAgLSBleGlzdHMsIGJ1dCBub3QgYSBmaWxlLCBkaXJlY3Rvcnkgb3Igc3ltbGlua1xyXG4gKi9cclxuXHJcbmV4cG9ydCB0eXBlIFRQYXRoVHlwZSA9XHJcblx0J21pc3NpbmcnIHwgJ2ZpbGUnIHwgJ2RpcicgfCAnc3ltbGluaycgfCAndW5rbm93bidcclxuXHJcbmV4cG9ydCBnZXRQYXRoVHlwZSA6PSAocGF0aDogc3RyaW5nKTogVFBhdGhUeXBlID0+XHJcblxyXG5cdGFzc2VydCBpc1N0cmluZyhwYXRoKSwgXCJub3QgYSBzdHJpbmc6ICN7T0wocGF0aCl9XCJcclxuXHRpZiBub3QgZXhpc3RzU3luYyBwYXRoXHJcblx0XHRyZXR1cm4gJ21pc3NpbmcnXHJcblx0aCA6PSBzdGF0U3luYyhwYXRoKVxyXG5cdHJldHVybiAoXHJcblx0XHQgIGguaXNGaWxlKCkgICAgICAgICA/ICdmaWxlJ1xyXG5cdFx0OiBoLmlzRGlyZWN0b3J5KCkgICAgPyAnZGlyJ1xyXG5cdFx0OiBoLmlzU3ltYm9saWNMaW5rKCkgPyAnc3ltbGluaydcclxuXHRcdDogICAgICAgICAgICAgICAgICAgICAgJ3Vua25vd24nXHJcblx0XHQpXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuLyoqXHJcbiAqIGV4dHJhY3QgdGhlIGZpbGUgZXh0ZW5zaW9uIGZyb20gYSBwYXRoLCBpbmNsdWRpbmdcclxuICogdGhlIGxlYWRpbmcgcGVyaW9kXHJcbiAqL1xyXG5cclxuZXhwb3J0IGZpbGVFeHQgOj0gKHBhdGg6IHN0cmluZyk6IHN0cmluZyA9PlxyXG5cclxuXHRpZiBsTWF0Y2hlcyA6PSBwYXRoLm1hdGNoKC9cXC5bXlxcLl0rJC8pXHJcblx0XHRyZXR1cm4gbE1hdGNoZXNbMF1cclxuXHRlbHNlXHJcblx0XHRyZXR1cm4gJydcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG4vKipcclxuICogcmV0dXJuIHRoZSBnaXZlbiBwYXRoLCBidXQgd2l0aCB0aGUgZ2l2ZW4gZmlsZSBleHRlbnNpb25cclxuICogcmVwbGFjaW5nIHRoZSBleGlzdGluZyBmaWxlIGV4dGVuc2lvblxyXG4gKi9cclxuXHJcbmV4cG9ydCB3aXRoRXh0IDo9IChwYXRoOiBzdHJpbmcsIGV4dDogc3RyaW5nKTogc3RyaW5nID0+XHJcblxyXG5cdGFzc2VydCBpc05vbkVtcHR5U3RyaW5nKHBhdGgpLCBcInBhdGggPSAje09MKHBhdGgpfVwiXHJcblx0YXNzZXJ0IGV4dC5zdGFydHNXaXRoKCcuJyksIFwiQmFkIGZpbGUgZXh0ZW5zaW9uOiAje2V4dH1cIlxyXG5cdGxNYXRjaGVzIDo9IHBhdGgubWF0Y2goL14oLiopKFxcLlteXFwuXSspJC8pXHJcblx0aWYgKGxNYXRjaGVzID09IG51bGwpXHJcblx0XHR0aHJvdyBuZXcgRXJyb3IoXCJCYWQgcGF0aDogJyN7cGF0aH0nXCIpXHJcblx0W18sIGhlYWRTdHIsIG9yZ0V4dF0gOj0gbE1hdGNoZXNcclxuXHRyZXR1cm4gXCIje2hlYWRTdHJ9I3tleHR9XCJcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgbFN0YXRGaWVsZHM6IHN0cmluZ1tdIDo9IFtcclxuXHQnZGV2JywnaW5vJywnbW9kZScsJ25saW5rJywndWlkJywnZ2lkJywncmRldicsXHJcblx0J3NpemUnLCdibGtzaXplJywnYmxvY2tzJyxcclxuXHQnYXRpbWVNcycsJ210aW1lTXMnLCdjdGltZU1zJywnYmlydGh0aW1lTXMnLFxyXG5cdCdhdGltZScsJ210aW1lJywnY3RpbWUnLCdiaXJ0aHRpbWUnLFxyXG5cdF1cclxuXHJcbi8qKlxyXG4gKiByZXR1cm4gc3RhdGlzdGljcyBmb3IgYSBmaWxlIG9yIGRpcmVjdG9yeVxyXG4gKi9cclxuXHJcbmV4cG9ydCBnZXRTdGF0cyA6PSAocGF0aDogc3RyaW5nKTogRGVuby5GaWxlSW5mbyA9PlxyXG5cclxuXHRmaWxlSW5mbyA6PSBEZW5vLnN0YXRTeW5jKHBhdGgpXHJcblx0cmV0dXJuIGZpbGVJbmZvXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuZXhwb3J0IGlzU3R1YiA6PSAoc3RyOiBzdHJpbmcpOiBib29sZWFuID0+XHJcblxyXG5cdCMgLS0tIGEgc3R1YiBjYW5ub3QgY29udGFpbiBhbnkgb2YgJ1xcXFwnLCAnLydcclxuXHRyZXR1cm4gbm90ZGVmaW5lZChzdHIubWF0Y2goL1tcXFxcXFwvXS8pKSAmJiAoc3RyWzBdICE9ICcuJylcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG4vKipcclxuICogcGFyc2VzIGEgcGF0aCBvciBmaWxlIFVSTCwgYW5kIHJldHVybnMgYSBoYXNoIHdpdGgga2V5czpcclxuICogXHR0eXBlOiBUUGF0aFR5cGUgLSAnZmlsZScsJ2RpcicsJ3N5bWxpbmsnLCdtaXNzaW5nJyBvciAndW5rbm93bidcclxuICogXHRwYXRoOiBzdHJpbmdcclxuICogXHRyb290OiBzdHJpbmdcclxuICogXHRkaXI6IHN0cmluZ1xyXG4gKiBcdGZpbGVOYW1lOiBzdHJpbmdcclxuICogXHRzdHViOiBzdHJpbmc/XHJcbiAqIFx0cHVycG9zZTogc3RyaW5nP1xyXG4gKiBcdGV4dDogc3RyaW5nP1xyXG4gKiBcdHJlbFBhdGg6IHN0cmluZ1xyXG4gKiBcdHJlbERpcjogc3RyaW5nXHJcbiAqL1xyXG5cclxuZXhwb3J0IHR5cGUgVFBhdGhJbmZvID0ge1xyXG5cdHR5cGU6IFRQYXRoVHlwZSAgIyAnZmlsZScsJ2RpcicsJ3N5bWxpbmsnLCdtaXNzaW5nJyBvciAndW5rbm93bidcclxuXHRwYXRoOiBzdHJpbmdcclxuXHRyb290OiBzdHJpbmdcclxuXHRkaXI6IHN0cmluZ1xyXG5cdGZpbGVOYW1lOiBzdHJpbmdcclxuXHRzdHViOiBzdHJpbmc/XHJcblx0cHVycG9zZTogc3RyaW5nP1xyXG5cdGV4dDogc3RyaW5nP1xyXG5cdHJlbFBhdGg6IHN0cmluZ1xyXG5cdHJlbERpcjogc3RyaW5nXHJcblx0fVxyXG5cclxuZXhwb3J0IHBhcnNlUGF0aCA6PSAocGF0aDogc3RyaW5nKTogVFBhdGhJbmZvID0+XHJcblxyXG5cdCMgLS0tIE5PVEU6IHBhdGggbWF5IGJlIGEgZmlsZSBVUkwsIGUuZy4gaW1wb3J0Lm1ldGEudXJsXHJcblx0IyAgICAgICAgICAgcGF0aCBtYXkgYmUgYSByZWxhdGl2ZSBwYXRoXHJcblxyXG5cdGFzc2VydCBpc05vbkVtcHR5U3RyaW5nKHBhdGgpLCBcInBhdGggbm90IGEgc3RyaW5nICN7T0wocGF0aCl9XCJcclxuXHRpZiBkZWZpbmVkKHBhdGgubWF0Y2goL15maWxlXFw6XFwvXFwvLykpXHJcblx0XHRwYXRoID0gZnJvbUZpbGVVcmwocGF0aClcclxuXHRwYXRoID0gbWtwYXRoIHBhdGhcclxuXHJcblx0e3Jvb3QsIGRpciwgYmFzZTogZmlsZU5hbWV9IDo9IHBhcnNlKHBhdGgpXHJcblxyXG5cdGxQYXJ0cyA6PSBmaWxlTmFtZS5zcGxpdCgnLicpXHJcblx0W3N0dWIsIHB1cnBvc2UsIGV4dF0gOj0gc3dpdGNoIGxQYXJ0cy5sZW5ndGhcclxuXHRcdHdoZW4gMFxyXG5cdFx0XHRjcm9hayBcIkNhbid0IGhhcHBlblwiXHJcblx0XHR3aGVuIDFcclxuXHRcdFx0W2ZpbGVOYW1lLCB1bmRlZiwgdW5kZWZdXHJcblx0XHR3aGVuIDJcclxuXHRcdFx0W2xQYXJ0c1swXSwgdW5kZWYsIFwiLiN7bFBhcnRzWzFdfVwiXVxyXG5cdFx0ZWxzZVxyXG5cdFx0XHRbXHJcblx0XHRcdFx0bFBhcnRzLnNsaWNlKDAsIC0yKS5qb2luKCcuJyksXHJcblx0XHRcdFx0bFBhcnRzLmF0KC0yKSxcclxuXHRcdFx0XHRcIi4je2xQYXJ0cy5hdCgtMSl9XCJcclxuXHRcdFx0XHRdXHJcblxyXG5cdCMgLS0tIEdyYWIgZXZlcnl0aGluZyB1cCB1bnRpbCB0aGUgbGFzdCBwYXRoIHNlcGFyYXRvciwgaWYgYW55XHJcblx0cmVsUGF0aCA6PSByZWxwYXRoIHBhdGhcclxuXHRsUGF0aE1hdGNoZXMgOj0gcmVsUGF0aC5tYXRjaCgvXiguKilbXFxcXFxcL11bXlxcXFxcXC9dKiQvKVxyXG5cdHJlbERpciA6PSAobFBhdGhNYXRjaGVzID09IG51bGwpID8gJy4nIDogbFBhdGhNYXRjaGVzWzFdXHJcblxyXG5cdHJldHVybiB7XHJcblx0XHR0eXBlOiBnZXRQYXRoVHlwZShwYXRoKVxyXG5cdFx0cGF0aFxyXG5cdFx0cm9vdFxyXG5cdFx0ZGlyXHJcblx0XHRmaWxlTmFtZVxyXG5cdFx0c3R1YlxyXG5cdFx0cHVycG9zZVxyXG5cdFx0ZXh0XHJcblx0XHRyZWxQYXRoXHJcblx0XHRyZWxEaXJcclxuXHRcdH1cclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbiMgR0VORVJBVE9SXHJcblxyXG4vKipcclxuICogZ2VuZXJhdGUgZmlsZXMgdGhhdCBtYXRjaCBhIGdpdmVuIGdsb2IgcGF0dGVyblxyXG4gKiB5aWVsZHMgYSBoYXNoIHdpdGgga2V5czpcclxuICogICAgdHlwZSAgICAgLSAnZmlsZScsICdkaXInLCAnc3ltbGluaycsICd1bmtub3duJ1xyXG4gKiAgICByb290ICAgICAtIGUuZy4gJ0M6LydcclxuICogICAgZmlsZU5hbWVcclxuICogICAgc3R1YlxyXG4gKiAgICBwdXJwb3NlXHJcbiAqICAgIGV4dFxyXG4gKiAgICByZWxQYXRoICAgLSByZWxhdGl2ZSB0byB3b3JraW5nIGRpciwgbm8gbGVhZGluZyAuIG9yIC4uXHJcbiAqIFRoZXNlIG9wdGlvbnMgbWF5IGJlIHNwZWNpZmllZCBpbiB0aGUgMm5kIHBhcmFtZXRlcjpcclxuICogICAgcm9vdDogc3RyaW5nIC0gcm9vdCBvZiBzZWFyY2gsIChkZWY6IERlbm8uY3dkKCkpXHJcbiAqICAgIGxFeGNsdWRlOiBbc3RyaW5nXSAtIHBhdHRlcm5zIHRvIGV4Y2x1ZGUsXHJcbiAqICAgIFx0ZGVmOiBbJ25vZGVfbW9kdWxlcy8qKicsICcuZ2l0LyoqJ11cclxuICogICAgaW5jbHVkZURpcnM6IGJvb2xlYW4gLSBzaG91bGQgZGlyZWN0b3JpZXMgYmUgaW5jbHVkZWQ/IChkZWY6IHRydWUpXHJcbiAqIFx0Zm9sbG93U3ltbGlua3MgLSBib29sZWFuIC0gc2hvdWxkIHN5bSBsaW5rcyBiZSBmb2xsb3dlZD8gKGRlZjogZmFsc2UpXHJcbiAqIFx0Y2Fub25pY2FsaXplOiBib29sZWFuIC0gaWYgZm9sbG93c3ltbGlua3MgaXMgdHJ1ZSwgc2hvdWxkXHJcbiAqIFx0XHRwYXRocyBiZSBjYW5vbmljYWxpemVkPyAoZGVmOiB0cnVlKVxyXG4gKiBcdGZpbHRlcjogKHN0cmluZyA9PiBhbnk/KSAtIGlnbm9yZSBpZiB1bmRlZiByZXR1cm5lZCxcclxuICogICAgICAgZWxzZSB5aWVsZCB0aGUgcmV0dXJuZWQgdmFsdWVcclxuICpcclxuICogR2xvYiBwYXR0ZXJuOlxyXG4gKiBcdCogICAgICAgICBtYXRjaCBhbnkgbnVtYmVyIG9mIGNoYXJzLCBleGNlcHQgcGF0aCBzZXBhcmF0b3JcclxuICogXHQqKiAgICAgICAgbWF0Y2ggemVybyBvciBtb3JlIGRpcmVjdG9yaWVzXHJcbiAqIFx0PyAgICAgICAgIG1hdGNoIGFueSBzaW5nbGUgY2hhciwgZXhjZXB0IHBhdGggc2VwYXJhdG9yXHJcbiAqIFx0LyAgICAgICAgIHBhdGggc2VwYXJhdG9yXHJcbiAqIFx0W2FiY10gICAgIG1hdGNoIG9uZSBjaGFyIGluIHRoZSBicmFja2V0c1xyXG4gKiBcdFshYWJjXSAgICBtYXRjaCBvbmUgY2hhciBub3QgaW4gdGhlIGJyYWNrZXRzXHJcbiAqIFx0e2FiYywxMjN9IGNvbW1hLXNlcGFyYXRlZCBsaXN0IG9mIGxpdGVyYWxzIHRvIG1hdGNoXHJcbiAqL1xyXG5cclxuZXhwb3J0IHR5cGUgVEZpbGVGaWx0ZXJGdW5jID0gKGhJbmZvOiBUUGF0aEluZm8pID0+IGJvb2xlYW5cclxuXHJcbmV4cG9ydCBhbGxGaWxlc01hdGNoaW5nIDo9IChcclxuXHRcdHBhdHRlcm46IHN0cmluZz0nKionLFxyXG5cdFx0aE9wdGlvbnM6IGhhc2g9e31cclxuXHRcdCk6IEdlbmVyYXRvcjxUUGF0aEluZm8sIHZvaWQsIHZvaWQ+IC0+XHJcblxyXG5cdHR5cGUgb3B0ID0ge1xyXG5cdFx0cm9vdDogc3RyaW5nP1xyXG5cdFx0bEV4Y2x1ZGU6IHN0cmluZ1tdXHJcblx0XHRpbmNsdWRlRGlyczogYm9vbGVhblxyXG5cdFx0Zm9sbG93U3ltbGlua3M6IGJvb2xlYW5cclxuXHRcdGNhbm9uaWNhbGl6ZTogYm9vbGVhblxyXG5cdFx0ZmlsdGVyOiBURmlsZUZpbHRlckZ1bmM/XHJcblx0XHR9XHJcblx0e1xyXG5cdFx0cm9vdCxcclxuXHRcdGxFeGNsdWRlLFxyXG5cdFx0aW5jbHVkZURpcnMsXHJcblx0XHRmb2xsb3dTeW1saW5rcyxcclxuXHRcdGNhbm9uaWNhbGl6ZSxcclxuXHRcdGZpbHRlcixcclxuXHRcdH0gOj0gZ2V0T3B0aW9uczxvcHQ+IGhPcHRpb25zLCB7XHJcblx0XHRcdHJvb3Q6IHVuZGVmXHJcblx0XHRcdGxFeGNsdWRlOiBbXHJcblx0XHRcdFx0J25vZGVfbW9kdWxlcy8qKidcclxuXHRcdFx0XHQnLmdpdC8qKidcclxuXHRcdFx0XHQnKiovKi50ZW1wLionXHJcblx0XHRcdFx0XVxyXG5cdFx0XHRpbmNsdWRlRGlyczogZmFsc2VcclxuXHRcdFx0Zm9sbG93U3ltbGlua3M6IGZhbHNlXHJcblx0XHRcdGNhbm9uaWNhbGl6ZTogZmFsc2VcclxuXHRcdFx0ZmlsdGVyOiB1bmRlZlxyXG5cdFx0XHR9XHJcblxyXG5cdGhHbG9iT3B0aW9ucyA6PSB7XHJcblx0XHRyb290XHJcblx0XHRleGNsdWRlOiBsRXhjbHVkZVxyXG5cdFx0aW5jbHVkZURpcnNcclxuXHRcdGZvbGxvd1N5bWxpbmtzXHJcblx0XHRjYW5vbmljYWxpemVcclxuXHRcdH1cclxuXHJcblx0Zm9yIGggb2YgZXhwYW5kR2xvYlN5bmMocGF0dGVybiwgaEdsb2JPcHRpb25zKVxyXG5cdFx0IyAtLS0gaCBoYXMga2V5czogcGF0aCwgbmFtZSwgaXNGaWxlLCBpc0RpcmVjdG9yeSwgaXNTeW1MaW5rXHJcblxyXG5cdFx0REJHIFwiTUFUQ0g6ICN7aC5wYXRofVwiXHJcblx0XHR0eXBlIDo9IChcclxuXHRcdFx0ICBoLmlzRmlsZSAgICAgID8gJ2ZpbGUnXHJcblx0XHRcdDogaC5pc0RpcmVjdG9yeSA/ICdkaXInXHJcblx0XHRcdDogaC5pc1N5bWxpbmsgICA/ICdzeW1saW5rJ1xyXG5cdFx0XHQ6ICAgICAgICAgICAgICAgICAndW5rbm93bidcclxuXHRcdFx0KVxyXG5cdFx0aEZpbGUgOj0gcGFyc2VQYXRoKGgucGF0aClcclxuXHRcdGlmIG5vdGRlZmluZWQoZmlsdGVyKVxyXG5cdFx0XHREQkcgXCIgICAtIG5vIGZpbHRlclwiXHJcblx0XHRcdHlpZWxkIGhGaWxlXHJcblx0XHRlbHNlXHJcblx0XHRcdGlmIGZpbHRlcihoRmlsZSlcclxuXHRcdFx0XHREQkcgXCIgICAtIGFsbG93ZWQgYnkgZmlsdGVyXCJcclxuXHRcdFx0XHR5aWVsZCBoRmlsZVxyXG5cdFx0XHRlbHNlXHJcblx0XHRcdFx0REJHIFwiICAgLSBleGNsdWRlZCBieSBmaWx0ZXJcIlxyXG5cdHJldHVyblxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuIyByZXR1cm5zIGZ1bGwgcGF0aCB0byBmaWxlXHJcblxyXG5leHBvcnQgZmluZFNyY0ZpbGUgOj0gKFxyXG5cdFx0ZmlsZU5hbWU6IHN0cmluZ1xyXG5cdFx0aE9wdGlvbnM6IGhhc2g9e31cclxuXHRcdCk6IHN0cmluZz8gPT5cclxuXHJcblx0dHlwZSBvcHQgPSB7XHJcblx0XHRyb290OiBzdHJpbmc/XHJcblx0XHR9XHJcblx0e3Jvb3R9IDo9IGdldE9wdGlvbnM8b3B0PiBoT3B0aW9ucywge1xyXG5cdFx0cm9vdDogJy4vc3JjJ1xyXG5cdFx0fVxyXG5cclxuXHRsRmlsZXMgOj0gQXJyYXkuZnJvbShhbGxGaWxlc01hdGNoaW5nKFwiKiovI3tmaWxlTmFtZX1cIiwge3Jvb3R9KSlcclxuXHREQkdWQUxVRSAnbEZpbGVzJywgbEZpbGVzXHJcblx0c3dpdGNoIGxGaWxlcy5sZW5ndGhcclxuXHRcdHdoZW4gMVxyXG5cdFx0XHR7cGF0aH0gOj0gbEZpbGVzWzBdXHJcblx0XHRcdGFzc2VydCBpc0ZpbGUocGF0aCksIFwiTm90IGEgZmlsZTogI3tPTChwYXRoKX1cIlxyXG5cdFx0XHRyZXR1cm4gcGF0aFxyXG5cdFx0d2hlbiAwXHJcblx0XHRcdHJldHVybiB1bmRlZlxyXG5cdFx0ZWxzZVxyXG5cdFx0XHRjcm9hayBcIk11bHRpcGxlIGZpbGVzIHdpdGggbmFtZSAje09MKGZpbGVOYW1lKX1cIlxyXG5cdFx0XHRyZXR1cm4gJydcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbiMgQVNZTkMgR0VORVJBVE9SXHJcblxyXG4vKipcclxuICogQW4gYXN5bmMgaXRlcmFibGUgLSB5aWVsZHMgZXZlcnkgbGluZSBpbiB0aGUgZ2l2ZW4gZmlsZVxyXG4gKlxyXG4gKiBVc2FnZTpcclxuICogICBmb3IgYXdhaXQgbGluZSBvZiBhbGxMaW5lc0luKCdzcmMvbGliL3RlbXAuY2l2ZXQnKVxyXG4gKiBcdCAgY29uc29sZS5sb2cgXCJMSU5FOiAje2xpbmV9XCJcclxuICogICBjb25zb2xlLmxvZyBcIkRPTkVcIlxyXG4gKi9cclxuXHJcbmV4cG9ydCBhbGxMaW5lc0luIDo9IChcclxuXHRwYXRoOiBzdHJpbmdcclxuXHQpOiBBc3luY0dlbmVyYXRvcjxzdHJpbmcsIHZvaWQsIHZvaWQ+IC0+XHJcblxyXG5cdGFzc2VydCBpc0ZpbGUocGF0aCksIFwiTm8gc3VjaCBmaWxlOiAje09MKHBhdGgpfSAoYWxsTGluZXNJbilcIlxyXG5cdGYgOj0gYXdhaXQgRGVuby5vcGVuKHBhdGgpXHJcblx0cmVhZGFibGUgOj0gZi5yZWFkYWJsZVxyXG5cdFx0LnBpcGVUaHJvdWdoKG5ldyBUZXh0RGVjb2RlclN0cmVhbSgpKVxyXG5cdFx0LnBpcGVUaHJvdWdoKG5ldyBUZXh0TGluZVN0cmVhbSgpKVxyXG5cclxuXHRmb3IgYXdhaXQgbGluZSBvZiByZWFkYWJsZVxyXG5cdFx0eWllbGQgbGluZVxyXG5cdHJldHVyblxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbi8qKlxyXG4gKiBjb252ZXJ0cyBhbGwgYmFja3NsYXNoIGNoYXJhY3RlcnMgdG8gZm9yd2FyZCBzbGFzaGVzXHJcbiAqIHVwcGVyLWNhc2VzIGRyaXZlIGxldHRlcnNcclxuICovXHJcblxyXG5leHBvcnQgbm9ybWFsaXplUGF0aCA6PSAocGF0aDogc3RyaW5nKTogc3RyaW5nID0+XHJcblxyXG5cdG5wYXRoIDo9IHBhdGgucmVwbGFjZUFsbCgnXFxcXCcsICcvJylcclxuXHRpZiAobnBhdGguY2hhckF0KDEpID09ICc6JylcclxuXHRcdHJldHVybiBucGF0aC5jaGFyQXQoMCkudG9VcHBlckNhc2UoKSArIG5wYXRoLnN1YnN0cmluZygxKVxyXG5cdGVsc2VcclxuXHRcdHJldHVybiBucGF0aFxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbmV4cG9ydCBwYXRoVG9VUkwgOj0gKGxQYXJ0cy4uLjogc3RyaW5nW10pOiBzdHJpbmcgPT5cclxuXHJcblx0cGF0aCA6PSByZXNvbHZlKGxQYXJ0cy4uLilcclxuXHRyZXR1cm4gbmV3IFVSTCgnZmlsZTovLycgKyBwYXRoKS5ocmVmXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuLyoqXHJcbiAqIHJlc29sdmVzIG11bHRpcGxlIHBhdGggcGFydHMgdG8gYSBzaW5nbGUgcGF0aFxyXG4gKiByZXR1cm5zIG5vcm1hbGl6ZWQgcGF0aFxyXG4gKi9cclxuXHJcbmV4cG9ydCBta3BhdGggOj0gKGxQYXJ0cy4uLjogc3RyaW5nW10pOiBzdHJpbmcgPT5cclxuXHJcblx0cGF0aCA6PSByZXNvbHZlKGxQYXJ0cy4uLilcclxuXHRyZXR1cm4gbm9ybWFsaXplUGF0aChwYXRoKVxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbmV4cG9ydCB0eXBlIFRQYXRoRGVzYyA9IHtcclxuXHRkaXI6IHN0cmluZ1xyXG5cdHJvb3Q6IHN0cmluZ1xyXG5cdGxQYXJ0czogc3RyaW5nW11cclxuXHR9XHJcblxyXG4vKipcclxuICogcmV0dXJucyB7ZGlyLCByb290LCBsUGFydHN9IHdoZXJlIGxQYXJ0cyBpbmNsdWRlcyB0aGUgbmFtZXMgb2ZcclxuICogYWxsIGRpcmVjdG9yaWVzIGJldHdlZW4gdGhlIHJvb3QgYW5kIHRoZSBmaWxlIG5hbWVcclxuICogcmVsYXRpdmUgdG8gdGhlIGN1cnJlbnQgd29ya2luZyBkaXJlY3RvcnlcclxuICovXHJcblxyXG5leHBvcnQgcGF0aFN1YkRpcnMgOj0gKHBhdGg6IHN0cmluZywgaE9wdGlvbnM6IGhhc2g9e30pOiBUUGF0aERlc2MgPT5cclxuXHJcblx0dHlwZSBvcHQgPSB7XHJcblx0XHRyZWxhdGl2ZTogYm9vbGVhblxyXG5cdFx0fVxyXG5cdHtyZWxhdGl2ZX0gOj0gZ2V0T3B0aW9uczxvcHQ+IGhPcHRpb25zLCB7XHJcblx0XHRyZWxhdGl2ZTogZmFsc2VcclxuXHRcdH1cclxuXHRwYXRoID0gcmVsYXRpdmUgPyByZWxwYXRoKHBhdGgpIDogbWtwYXRoKHBhdGgpXHJcblx0e3Jvb3QsIGRpcn0gOj0gcGFyc2UocGF0aClcclxuXHRyZXR1cm4ge1xyXG5cdFx0ZGlyXHJcblx0XHRyb290XHJcblx0XHRsUGFydHM6IGRpci5zbGljZShyb290Lmxlbmd0aCkuc3BsaXQoL1tcXFxcXFwvXS8pXHJcblx0XHR9XHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4jIC0tLSBTaG91bGQgYmUgY2FsbGVkIGxpa2U6IG15c2VsZihpbXBvcnQubWV0YS51cmwpXHJcbiMgICAgIHJldHVybnMgZnVsbCBwYXRoIG9mIGN1cnJlbnQgZmlsZVxyXG5cclxuZXhwb3J0IG15c2VsZiA6PSAodXJsOiBzdHJpbmcpOiBzdHJpbmcgPT5cclxuXHJcblx0cmV0dXJuIHJlbHBhdGggZnJvbUZpbGVVcmwodXJsKVxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbmV4cG9ydCBiYXJmIDo9IChcclxuXHRcdHBhdGg6IHN0cmluZyxcclxuXHRcdGNvbnRlbnRzOiBzdHJpbmcsXHJcblx0XHRoT3B0aW9uczogaGFzaCA9IHt9XHJcblx0XHQpOiB2b2lkID0+XHJcblxyXG5cdHR5cGUgb3B0ID0ge1xyXG5cdFx0YXBwZW5kOiBib29sZWFuXHJcblx0XHR9XHJcblx0e2FwcGVuZH0gOj0gZ2V0T3B0aW9uczxvcHQ+IGhPcHRpb25zLCB7XHJcblx0XHRhcHBlbmQ6IGZhbHNlXHJcblx0XHR9XHJcblx0bWtEaXJzRm9yRmlsZShwYXRoKVxyXG5cdGRhdGEgOj0gZW5jb2Rlci5lbmNvZGUoY29udGVudHMpXHJcblx0aWYgYXBwZW5kICYmIGlzRmlsZShwYXRoKVxyXG5cdFx0YXBwZW5kRmlsZVN5bmMgcGF0aCwgZGF0YVxyXG5cdGVsc2VcclxuXHRcdERlbm8ud3JpdGVGaWxlU3luYyBwYXRoLCBkYXRhXHJcblx0cmV0dXJuXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuZXhwb3J0IGJhcmZUZW1wRmlsZSA6PSAoXHJcblx0XHRjb250ZW50czogc3RyaW5nXHJcblx0XHRoT3B0aW9uczogaGFzaCA9IHt9XHJcblx0XHQpOiBzdHJpbmcgPT5cclxuXHJcblx0dHlwZSBvcHQgPSB7XHJcblx0XHRleHQ6IHN0cmluZ1xyXG5cdFx0fVxyXG5cdHtleHR9IDo9IGdldE9wdGlvbnM8b3B0PiBoT3B0aW9ucywge1xyXG5cdFx0ZXh0OiAnLmNpdmV0J1xyXG5cdFx0fVxyXG5cdHRlbXBGaWxlUGF0aCA6PSBEZW5vLm1ha2VUZW1wRmlsZVN5bmMge3N1ZmZpeDogZXh0fVxyXG5cdGJhcmYgdGVtcEZpbGVQYXRoLCBjb250ZW50c1xyXG5cdHJldHVybiB0ZW1wRmlsZVBhdGhcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgaXNFeHQgOj0gKHN0cjogc3RyaW5nKTogYm9vbGVhbiA9PlxyXG5cclxuXHRyZXR1cm4gL15cXC5bQS1aYS16MC05X10rJC8udGVzdChzdHIpXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuZXhwb3J0IG5ld2VyRGVzdEZpbGVFeGlzdHMgOj0gKFxyXG5cdHNyY1BhdGg6IHN0cmluZyxcclxuXHRkZXN0UGF0aDogc3RyaW5nXHJcblx0KTogYm9vbGVhbiA9PlxyXG5cclxuXHRpZiBpc0V4dChkZXN0UGF0aClcclxuXHRcdGRlc3RQYXRoID0gd2l0aEV4dChzcmNQYXRoLCBkZXN0UGF0aClcclxuXHRhc3NlcnQgaXNGaWxlKHNyY1BhdGgpLCBcIk5vIHN1Y2ggZmlsZTogI3tPTChzcmNQYXRoKX1cIlxyXG5cdGlmIG5vdCBleGlzdHNTeW5jKGRlc3RQYXRoKVxyXG5cdFx0cmV0dXJuIGZhbHNlXHJcblx0c3JjTW9kVGltZSA6PSBzdGF0U3luYyhzcmNQYXRoKS5tdGltZU1zXHJcblx0ZGVzdE1vZFRpbWUgOj0gc3RhdFN5bmMoZGVzdFBhdGgpLm10aW1lTXNcclxuXHRyZXR1cm4gKGRlc3RNb2RUaW1lID4gc3JjTW9kVGltZSlcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG4vKipcclxuICogY3JlYXRlIGEgbmV3IGRpcmVjdG9yeSBpZiBpdCBkb2Vzbid0IGV4aXN0XHJcbiAqIGlmIHRoZSBvcHRpb24gJ2NsZWFyJyBpcyBzZXQgdG8gYSB0cnVlIHZhbHVlIGluIHRoZSAybmQgcGFyYW1ldGVyXHJcbiAqIGFuZCB0aGUgZGlyZWN0b3J5IGFscmVhZHkgZXhpc3RzLCBpdCBpcyBjbGVhcmVkXHJcbiAqL1xyXG5cclxuZXhwb3J0IG1rRGlyIDo9IChcclxuXHRcdGRpclBhdGg6IHN0cmluZyxcclxuXHRcdGNsZWFyOiBib29sZWFuPWZhbHNlXHJcblx0XHQpOiB2b2lkID0+XHJcblxyXG5cdGlmIGNsZWFyXHJcblx0XHRlbXB0eURpclN5bmMgZGlyUGF0aCAgICAjIC0tLSBjcmVhdGVzIGlmIGl0IGRvZXNuJ3QgZXhpc3RcclxuXHRlbHNlXHJcblx0XHRlbnN1cmVEaXJTeW5jIGRpclBhdGhcclxuXHRyZXR1cm5cclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG4vKipcclxuICogcmVtb3ZlIGEgZmlsZSBmcm9tIHRoZSBmaWxlIHN5c3RlbSwgYnV0IGRvIG5vdGhpbmdcclxuICogaWYgdGhlIGZpbGUgZG9lcyBub3QgZXhpc3RcclxuICovXHJcblxyXG5leHBvcnQgcm1GaWxlIDo9IChwYXRoOiBzdHJpbmcpOiB2b2lkID0+XHJcblxyXG5cdGlmIGV4aXN0c1N5bmMgcGF0aFxyXG5cdFx0RGVuby5yZW1vdmVTeW5jIHBhdGhcclxuXHRyZXR1cm5cclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG4vKipcclxuICogcmVtb3ZlIGEgZGlyZWN0b3J5IGZyb20gdGhlIGZpbGUgc3lzdGVtLCBidXQgZG8gbm90aGluZ1xyXG4gKiBpZiB0aGUgZGlyZWN0b3J5IGRvZXMgbm90IGV4aXN0XHJcbiAqIE5PVEU6IFlvdSBtdXN0IHBhc3MgdGhlICdjbGVhcicgb3B0aW9uIGlmIHRoZSBkaXJlY3RvcnlcclxuICogICAgICAgaXMgbm90IGVtcHR5XHJcbiAqL1xyXG5cclxuZXhwb3J0IHJtRGlyIDo9IChwYXRoOiBzdHJpbmcsIGhPcHRpb25zOiBoYXNoPXt9KTogdm9pZCA9PlxyXG5cclxuXHR0eXBlIG9wdCA9IHtcclxuXHRcdGNsZWFyOiBib29sZWFuXHJcblx0XHR9XHJcblx0e2NsZWFyfSA6PSBnZXRPcHRpb25zPG9wdD4gaE9wdGlvbnMsIHtcclxuXHRcdGNsZWFyOiBmYWxzZVxyXG5cdFx0fVxyXG5cdGlmIGV4aXN0c1N5bmMgcGF0aFxyXG5cdFx0aWYgY2xlYXJcclxuXHRcdFx0RGVuby5yZW1vdmVTeW5jIHBhdGgsIHtyZWN1cnNpdmU6IHRydWV9XHJcblx0XHRlbHNlXHJcblx0XHRcdERlbm8ucmVtb3ZlU3luYyBwYXRoXHJcblx0cmV0dXJuXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuLyoqXHJcbiAqIGNyZWF0ZSBhbnkgbWlzc2luZyBkaXJlY3RvcmllcyBpbiB0aGUgZ2l2ZW4gcGF0aFxyXG4gKi9cclxuXHJcbmV4cG9ydCBta0RpcnNGb3JGaWxlIDo9IChwYXRoOiBzdHJpbmcpOiB2b2lkID0+XHJcblxyXG5cdHtyb290LCBsUGFydHN9IDo9IHBhdGhTdWJEaXJzKHBhdGgpXHJcblx0bGV0IGRpciA9IHJvb3RcclxuXHRmb3IgcGFydCBvZiBsUGFydHNcclxuXHRcdGRpciArPSBcIi8je3BhcnR9XCJcclxuXHRcdGlmIG5vdCBpc0RpcihkaXIpXHJcblx0XHRcdG1rRGlyIGRpclxyXG5cdHJldHVyblxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbi8qKlxyXG4gKiBkZWxldGVzIGFsbCBmaWxlcyBhbmQgc3ViZGlyZWN0b3JpZXMgaW4gdGhlIGdpdmVuIGRpcmVjdG9yeVxyXG4gKi9cclxuXHJcbmV4cG9ydCBjbGVhckRpciA6PSAoZGlyUGF0aDogc3RyaW5nKTogdm9pZCA9PlxyXG5cclxuXHRlbXB0eURpclN5bmMgZGlyUGF0aFxyXG5cdHJldHVyblxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuIyAtLS0gaE9wdGlvbnMgZ2V0cyBwYXNzZWQgdG8gYWxsRmlsZXNNYXRjaGluZygpXHJcblxyXG5leHBvcnQgcmVtb3ZlRmlsZXNNYXRjaGluZyA6PSAoXHJcblx0cGF0dGVybjogc3RyaW5nLFxyXG5cdGhPcHRpb25zOiBoYXNoPXt9XHJcblx0KTogdm9pZCA9PlxyXG5cclxuXHRhc3NlcnQgKHBhdHRlcm4gIT0gJyonKSAmJiAocGF0dGVybiAhPSAnKionKSxcclxuXHRcdFwiQ2FuJ3QgZGVsZXRlIGZpbGVzIG1hdGNoaW5nICN7T0wocGF0dGVybil9XCJcclxuXHRmb3Ige3JlbFBhdGh9IG9mIGFsbEZpbGVzTWF0Y2hpbmcocGF0dGVybiwgaE9wdGlvbnMpXHJcblx0XHREZW5vLnJlbW92ZVN5bmMgcmVsUGF0aFxyXG5cdHJldHVyblxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbmV4cG9ydCByZW1vdmVGaWxlc0V4Y2VwdCA6PSAoXHJcblx0cGF0dGVybjogc3RyaW5nLFxyXG5cdGxLZWVwOiBzdHJpbmdbXSxcclxuXHRoT3B0aW9uczogaGFzaCA9IHt9XHJcblx0KTogdm9pZCA9PlxyXG5cclxuXHR0eXBlIG9wdCA9IHtcclxuXHRcdGRlYnVnOiBib29sZWFuXHJcblx0XHR9XHJcblx0e2RlYnVnfSA6PSBnZXRPcHRpb25zPG9wdD4gaE9wdGlvbnMsIHtcclxuXHRcdGRlYnVnOiBmYWxzZVxyXG5cdFx0fVxyXG5cdERCRyA6PSAobXNnOiBzdHJpbmcpOiB2b2lkID0+XHJcblx0XHRpZiBkZWJ1Z1xyXG5cdFx0XHRjb25zb2xlLmxvZyBtc2dcclxuXHRcdHJldHVyblxyXG5cclxuXHQjIC0tLSB0cnV0aHkgcmV0dXJuIG1lYW5zIHJlbW92ZSBpdFxyXG5cdGZpbHRlciA6PSAoaEZpbGU6IFRQYXRoSW5mbykgPT5cclxuXHRcdHt0eXBlLCByZWxQYXRofSA6PSBoRmlsZVxyXG5cdFx0aWYgKHR5cGUgIT0gJ2ZpbGUnKVxyXG5cdFx0XHRyZXR1cm4gdW5kZWZcclxuXHRcdHJlbW92ZUZpbGUgOj0gbm90IGxLZWVwLmluY2x1ZGVzKHJlbFBhdGgpXHJcblx0XHREQkcgXCJmaWx0ZXIoI3tyZWxQYXRofSk6IHJlbW92ZUZpbGUgPSAje3JlbW92ZUZpbGV9XCJcclxuXHRcdHJldHVybiByZW1vdmVGaWxlXHJcblxyXG5cdGg6IGhhc2ggOj0ge2ZpbHRlciwgZGVidWd9XHJcblx0Zm9yIHtyZWxQYXRofSBvZiBhbGxGaWxlc01hdGNoaW5nKHBhdHRlcm4sIGgpXHJcblx0XHREQkcgXCJSRU1PVkUgRklMRSAje3JlbFBhdGh9XCJcclxuXHRcdERlbm8ucmVtb3ZlU3luYyByZWxQYXRoXHJcblx0cmV0dXJuXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuLyoqXHJcbiAqIHR5cGUgVEZzRXZlbnRIYW5kbGVyXHJcbiAqICAgIC0gYSBmdW5jdGlvbiB0YWtpbmcgKGtpbmQsIHBhdGgpXHJcbiAqICAgLSBvcHRpb25hbGx5IHJldHVybnMgYm9vbGVhbiB0byBpbmRpY2F0ZSBzdG9wIHdhdGNoaW5nXHJcbiAqL1xyXG5cclxuZXhwb3J0IHR5cGUgVEZzRXZlbnRIYW5kbGVyID0gKGtpbmQ6IHN0cmluZywgcGF0aDogc3RyaW5nKSA9PiB2b2lkIHwgYm9vbGVhblxyXG5cclxuLyoqXHJcbiAqIGNsYXNzIEZpbGVFdmVudEhhbmRsZXJcclxuICogICAgaGFuZGxlcyBmaWxlIGNoYW5nZWQgZXZlbnRzIHdoZW4gLmhhbmRsZShmc0V2ZW50KSBpcyBjYWxsZWRcclxuICogICAgY2FsbGJhY2sgaXMgYSBmdW5jdGlvbiwgZGVib3VuY2VkIGJ5IDIwMCBtc1xyXG4gKiAgICAgICB0aGF0IHRha2VzIGFuIEZzRXZlbnQgYW5kIHJldHVybnMgYSB2b2lkRnVuY1xyXG4gKiAgICAgICB3aGljaCB3aWxsIGJlIGNhbGxlZCBpZiB0aGUgY2FsbGJhY2sgcmV0dXJucyBhIGZ1bmN0aW9uIHJlZmVyZW5jZVxyXG4gKiBbdW5pdCB0ZXN0c10oLi4vdGVzdC9mcy50ZXN0LmNpdmV0Izp+OnRleHQ9JTIzJTIwJTJEJTJEJTJEJTIwY2xhc3MlMjBGaWxlRXZlbnRIYW5kbGVyKVxyXG4gKi9cclxuXHJcbmV4cG9ydCBjbGFzcyBGaWxlRXZlbnRIYW5kbGVyXHJcblxyXG5cdGhhbmRsZXI6IFRGc0V2ZW50SGFuZGxlciAgICMgLS0tIGRlYm91bmNlZCBoYW5kbGVyXHJcblx0b25TdG9wOiAoKSA9PiB2b2lkID0gcGFzc1xyXG5cclxuXHQjIC4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi5cclxuXHJcblx0Y29uc3RydWN0b3IoXHJcblx0XHRcdGNhbGxiYWNrOiBURnNFdmVudEhhbmRsZXJcclxuXHRcdFx0aE9wdGlvbnM6IGhhc2g9e31cclxuXHRcdFx0KVxyXG5cclxuXHRcdHR5cGUgb3B0ID0ge1xyXG5cdFx0XHRvblN0b3A6IHZvaWRGdW5jXHJcblx0XHRcdGRlYm91bmNlQnk6IG51bWJlclxyXG5cdFx0XHR9XHJcblx0XHR7XHJcblx0XHRcdG9uU3RvcDogQG9uU3RvcFxyXG5cdFx0XHRkZWJvdW5jZUJ5XHJcblx0XHRcdH0gOj0gZ2V0T3B0aW9uczxvcHQ+IGhPcHRpb25zLCB7XHJcblx0XHRcdFx0b25TdG9wOiBwYXNzXHJcblx0XHRcdFx0ZGVib3VuY2VCeTogMjAwXHJcblx0XHRcdFx0fVxyXG5cdFx0QGhhbmRsZXIgOj0gZGVib3VuY2UoY2FsbGJhY2ssIGRlYm91bmNlQnkpXHJcblx0XHREQkcgXCJGaWxlRXZlbnRIYW5kbGVyIGNvbnN0cnVjdG9yKCkgY2FsbGVkXCJcclxuXHJcblx0IyAuLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uXHJcblx0IyAtLS0gQ2FsbHMgYSB2b2lkRnVuYywgYnV0IGlzIGRlYm91bmNlZCBieSBAbXMgbXNcclxuXHJcblx0aGFuZGxlKGZzRXZlbnQ6IEZzRXZlbnQpOiB2b2lkXHJcblx0XHR7a2luZCwgcGF0aHN9IDo9IGZzRXZlbnRcclxuXHRcdERCRyBcIkhBTkRMRTogWyN7c2luY2VMb2FkU3RyKCl9XSAje2tpbmR9ICN7T0wocGF0aHMpfVwiXHJcblxyXG5cdFx0Zm9yIHBhdGggb2YgcGF0aHNcclxuXHRcdFx0QGhhbmRsZXIoa2luZCwgcGF0aClcclxuXHRcdHJldHVyblxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuIyBBU1lOQ1xyXG5cclxuLyoqXHJcbiAqIGEgZnVuY3Rpb24gdGhhdCB3YXRjaGVzIGZvciBjaGFuZ2VzIG9uZSBvciBtb3JlIGZpbGVzIG9yIGRpcmVjdG9yaWVzXHJcbiAqICAgIGFuZCBjYWxscyBhIGNhbGxiYWNrIGZ1bmN0aW9uIGZvciBlYWNoIGNoYW5nZS5cclxuICogSWYgdGhlIGNhbGxiYWNrIHJldHVybnMgdHJ1ZSwgd2F0Y2hpbmcgaXMgaGFsdGVkXHJcbiAqXHJcbiAqIFVzYWdlOlxyXG4gKiAgIGhhbmRsZXIgOj0gKGtpbmQsIHBhdGgpID0+IGNvbnNvbGUubG9nIHBhdGhcclxuICogICBhd2FpdCB3YXRjaEZpbGUgJ3RlbXAudHh0JywgaGFuZGxlclxyXG4gKiAgIGF3YWl0IHdhdGNoRmlsZSAnc3JjL2xpYicsICBoYW5kbGVyXHJcbiAqICAgYXdhaXQgd2F0Y2hGaWxlIFsndGVtcC50eHQnLCAnc3JjL2xpYiddLCBoYW5kbGVyXHJcbiAqL1xyXG5cclxuZXhwb3J0IHdhdGNoRmlsZSA6PSAoXHJcblx0cGF0aDogc3RyaW5nIHwgc3RyaW5nW10sXHJcblx0d2F0Y2hlckNCOiBURnNFdmVudEhhbmRsZXIsXHJcblx0aE9wdGlvbnM6IGhhc2g9e31cclxuXHQpOiB2b2lkIC0+XHJcblxyXG5cdCMgLS0tIGRlYm91bmNlQnkgaXMgbWlsbGlzZWNvbmRzIHRvIGRlYm91bmNlIGJ5LCBkZWZhdWx0IGlzIDIwMFxyXG5cdHtkZWJvdW5jZUJ5fSA6PSBnZXRPcHRpb25zPHtkZWJvdW5jZUJ5OiBudW1iZXJ9PiBoT3B0aW9ucywge1xyXG5cdFx0ZGVib3VuY2VCeTogMjAwXHJcblx0XHR9XHJcblxyXG5cdERCRyBcIldBVENIOiAje09MKHBhdGgpfVwiXHJcblx0d2F0Y2hlciA6PSBEZW5vLndhdGNoRnMocGF0aClcclxuXHJcblx0bGV0IGRvU3RvcDogYm9vbGVhbiA9IGZhbHNlXHJcblxyXG5cdGZzQ2FsbGJhY2s6IFRGc0V2ZW50SGFuZGxlciA6PSAoa2luZCwgcGF0aCkgPT5cclxuXHRcdHJlc3VsdCA6PSB3YXRjaGVyQ0Ioa2luZCwgcGF0aClcclxuXHRcdERCRyBcIkZDQjogcmVzdWx0ID0gI3tyZXN1bHR9XCJcclxuXHRcdGlmIHJlc3VsdFxyXG5cdFx0XHR3YXRjaGVyLmNsb3NlKClcclxuXHRcdHJldHVyblxyXG5cclxuXHRoYW5kbGVyIDo9IG5ldyBGaWxlRXZlbnRIYW5kbGVyKGZzQ2FsbGJhY2ssIHtkZWJvdW5jZUJ5fSlcclxuXHJcblx0Zm9yIGF3YWl0IGZzRXZlbnQ6IEZzRXZlbnQgb2Ygd2F0Y2hlclxyXG5cdFx0REJHIFwid2F0Y2hlciBldmVudCBmaXJlZFwiXHJcblx0XHRpZiBkb1N0b3BcclxuXHRcdFx0REJHIFwiZG9TdG9wID0gI3tkb1N0b3B9LCBDbG9zaW5nIHdhdGNoZXJcIlxyXG5cdFx0XHRicmVha1xyXG5cdFx0Zm9yIHBhdGggb2YgZnNFdmVudC5wYXRoc1xyXG5cdFx0XHQjIC0tLSBmc0NhbGxiYWNrIHdpbGwgYmUgKGV2ZW50dWFsbHkpIGNhbGxlZFxyXG5cdFx0XHRoYW5kbGVyLmhhbmRsZShmc0V2ZW50KVxyXG5cclxuZXhwb3J0IHdhdGNoRmlsZXMgOj0gd2F0Y2hGaWxlXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuZXhwb3J0IHBhdGNoRmlyc3RMaW5lIDo9IChcclxuXHRcdHBhdGg6IHN0cmluZ1xyXG5cdFx0c3RyOiBzdHJpbmdcclxuXHRcdG5ld3N0cjogc3RyaW5nXHJcblx0XHQpOiB2b2lkID0+XHJcblxyXG5cdCMgLS0tIFJlcGxhY2Ugc3RyIHdpdGggbmV3c3RyLCBidXQgb25seSBvbiBmaXJzdCBsaW5lXHJcblx0Y29udGVudHMgOj0gRGVuby5yZWFkVGV4dEZpbGVTeW5jIHBhdGhcclxuXHRubFBvcyA6PSBjb250ZW50cy5pbmRleE9mIFwiXFxuXCJcclxuXHRzdHJQb3MgOj0gY29udGVudHMuaW5kZXhPZiBzdHJcclxuXHRpZiAoc3RyUG9zICE9IC0xKSAmJiAoKG5sUG9zID09IC0xKSB8fCAoc3RyUG9zIDwgbmxQb3MpKVxyXG5cdFx0RGVuby53cml0ZVRleHRGaWxlU3luYyBwYXRoLCBjb250ZW50cy5yZXBsYWNlKHN0ciwgbmV3c3RyKVxyXG5cdHJldHVyblxyXG4iXX0=