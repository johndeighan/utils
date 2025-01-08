// llutils.civet

import {expandGlobSync} from '@std/fs/expand-glob'
import fs from 'fs'
import pathLib from 'path'
import urlLib from 'url'
import {TextLineStream} from '@std/streams'
import {TextDecoderStream} from 'stream/web'
import {compile} from '@danielx/civet'
import {debounce} from "@std/async/debounce"
import {stripAnsiCode} from "@std/fmt/colors"
import {
	setLogLevel, pushLogLevel, popLogLevel,
	curLogLevel, clearLog,
	INDENT, UNDENT, CLEAR,
	DBG, LOG, WARN, ERR,
	} from '@jdeighan/utils/logger.js'
import {
	isString, isNonEmptyString, isBoolean, isNumber, isInteger,
	isArray, isArrayOfStrings, isHash, isObject,
	} from '@jdeighan/utils/data-type-tests.js'

export {
	setLogLevel, pushLogLevel, popLogLevel, clearLog,
	INDENT, UNDENT, CLEAR,
	DBG, LOG, WARN, ERR,
	isString, isNonEmptyString, isBoolean, isNumber, isInteger,
	isArray, isArrayOfStrings, isHash, isObject,
	}

/**
 * @module llutils - low level utilities
 */

const textDecoder = new TextDecoder()
export var pass = () => {}    // do nothing

// ---------------------------------------------------------------------------

/**
 * Outputs an error message to the logs,
 * then throws an exception with the provided message
 */

export const croak = (msg) => {

	ERR(msg)
	throw new Error(msg)
}

// ---------------------------------------------------------------------------

export const assert = (cond, msg) => {

	if (!cond) {
		croak(msg)
	}
	return
}

// ---------------------------------------------------------------------------

export const undef = undefined

// ---------------------------------------------------------------------------

export const defined = (...lValues) => {

	for (const value of lValues) {
		if ((value === undef) || (value === null)) {
			return false
		}
	}
	return true
}

// ---------------------------------------------------------------------------

export const notdefined = (value) => {

	return !defined(value)
}

// ---------------------------------------------------------------------------

export const wsSplit = (str) => {

	const newstr = str.trim()
	if (newstr === '') {
		return []
	}
	else {
		return newstr.split(/\s+/)
	}
}

// ---------------------------------------------------------------------------

export const words = (...lStrings) => {

	let lWords = []
	for (const str of lStrings) {
		for (const word of wsSplit(str)) {
			lWords.push(word)
		}
	}
	return lWords
}

// ---------------------------------------------------------------------------
// GENERATOR

export const range = function*(n) {

	let i = 0
	while (i < n) {
		yield i
		i = i + 1
	}
	return
}

// ---------------------------------------------------------------------------

export const OL = (x) => {

	return JSON.stringify(x)
}

// ---------------------------------------------------------------------------

export const ML = (x) => {

	return JSON.stringify(x, null, 3)
}

// ---------------------------------------------------------------------------

export const keys = Object.keys

// ---------------------------------------------------------------------------
// --- true if hash has all keys

export const hasKey = (h, ...lKeys) => {

	if (notdefined(h)) {
		return false
	}
	assert(isHash(h), `h not a hash: ${OL(h)}`)
	for (const key of lKeys) {
		assert(isString(key), `key not a string: ${OL(key)}`)
		if (!h.hasOwnProperty(key)) {
			return false
		}
	}
	return true
}

export const hasKeys = hasKey

// ---------------------------------------------------------------------------
//   isEmpty - one of:
//      - string is whitespace
//      - array has no elements
//      - hash has no keys

export const isEmpty = (x) => {

	if ((x === undef) || (x === null)) {
		return true
	}
	if (isString(x)) {
		return (x.match(/^\s*$/) !== null)
	}
	if (isArray(x)) {
		return (x.length === 0)
	}
	if (isHash(x)) {
		return (keys(x).length === 0)
	}
	else {
		return false
	}
}

// ---------------------------------------------------------------------------
//   nonEmpty - not isEmpty(x)

export const nonEmpty = (x) => {

	return !isEmpty(x)
}

// ---------------------------------------------------------------------------

export const merge = (...lObjects) => {

	return Object.assign(...lObjects)
}

// ---------------------------------------------------------------------------

export const normalizeStr = (x) => {

	return x.toString().replaceAll('\r', '').trim()
}

// ---------------------------------------------------------------------------

export var spaces = (n) => {

	return " ".repeat(n)
}

// ---------------------------------------------------------------------------

export var tabs = (n) => {

	return "\t".repeat(n)
}

// ---------------------------------------------------------------------------

export var getNExtra = (str, len) => {

	const extra = len - str.length
	return (extra > 0) ? extra : 0
}

// ---------------------------------------------------------------------------

export const strToHash = (str) => {

	assert(isNonEmptyString(str), `Bad string: ${OL(str)}`)
	const h = {}
	for (const word of str.split(/\s+/)) {
		let ref;if ((ref = word.match(/^(\!)?([A-Za-z][A-Za-z_0-9]*)(?:(=)(.*))?$/))) {const lMatches = ref;
			const [_, neg, ident, eqSign, str] = lMatches
			if (isNonEmptyString(eqSign)) {
				assert(notdefined(neg) || (neg === ''),
						"negation with string value")

				// --- check if str is a valid number
				const num = parseFloat(str)
				if (Number.isNaN(num)) {
					// --- TO DO: interpret backslash escapes
					h[ident] = str
				}
				else {
					h[ident] = num
				}
			}
			else if (neg) {
				h[ident] = false
			}
			else {
				h[ident] = true
			}
		}
		else {
			croak(`Invalid word ${OL(word)}`)
		}
	}
	return h
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------

export const rpad = (str, len, ch=' ') => {

	assert((ch.length === 1), "Not a char")
	const extra = getNExtra(str, len)
	return str + ch.repeat(extra)
}

// ---------------------------------------------------------------------------

export const lpad = (str, len, ch=' ') => {

	assert((ch.length === 1), "Not a char")
	const extra = getNExtra(str, len)
	return ch.repeat(extra) + str
}

// ---------------------------------------------------------------------------
// --- valid options:
//        char - char to use on left and right
//        buffer - num spaces around text when char <> ' '

export const centered = (text, width, char=' ', numBuffer=2) => {

	const totSpaces = width - text.length
	if (totSpaces <= 0) {
		return text
	}
	const numLeft = Math.floor(totSpaces / 2)
	const numRight = totSpaces - numLeft
	if (char === ' ') {
		return spaces(numLeft) + text + spaces(numRight)
	}
	else {
		const buf = ' '.repeat(numBuffer)
		const left = char.repeat(numLeft - numBuffer)
		const right = char.repeat(numRight - numBuffer)
		return left + buf + text + buf + right
	}
}

// ---------------------------------------------------------------------------

export const alignString = function(str, width, align) {

	assert(isString(str), `str not a string: ${OL(str)}`)
	assert(isString(align), `align not a string: ${OL(align)}`)
	switch(align) {
		case 'left':case 'l': {
			return rpad(str, width)
		}
		case 'center':case 'c': {
			return centered(str, width)
		}
		case 'right':case 'r': {
			return lpad(str, width)
		}
		default: {
			croak(`Unknown align: ${OL(align)}`)
		}
	}
}

// ---------------------------------------------------------------------------

export const zpad = (n, len) => {

	return lpad(n.toString(), len, '0')
}

// ---------------------------------------------------------------------------
//   escapeStr - escape newlines, carriage return, TAB chars, etc.

export const hEscNL = {
	"\r": '←',
	"\n": '↓',
	"\t": '→',
	" ": '˳'
	}

export const hEscNoNL = {
	"\r": '←',
	"\t": '→',
	" ": '˳'
	}

// ---------------------------------------------------------------------------

export const escapeStr = (str, hReplace=hEscNL, hOptions={}) => {
	//     Valid options:
	//        offset  - indicate position of offset
	//        poschar - char to use to indicate position

	const {offset, poschar} = getOptions(hOptions, {
		offset: undef,
		poschar: '┊'
		})

	assert(isString(str), `not a string: ${OL(str)}`)
	assert(isHash(hReplace), `not a hash: ${OL(hReplace)}`)

	const lParts = []
	let i1 = 0;for (const ch of str.split('')) {const i = i1++;
		if (defined(offset) && (i === offset)) {
			lParts.push(poschar)
		}
		const newch = hReplace[ch]
		if (defined(newch)) {
			lParts.push(newch)
		}
		else {
			lParts.push(ch)
		}
	}
	if (offset === str.length) {
		lParts.push(poschar)
	}
	return lParts.join('')
}

// ---------------------------------------------------------------------------
//   escapeBlock
//      - remove carriage returns
//      - escape spaces, TAB chars

export var escapeBlock = (block, hReplace=hEscNoNL, hOptions) => {

	return escapeStr(block, hReplace, hOptions)
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------

export const addDefaults = (hOptions, hDefaults) => {

	assert(isObject(hOptions), `hOptions not an object: ${OL(hOptions)}`)
	assert(isObject(hDefaults), `hDefaults not an object: ${OL(hDefaults)}`)

	// --- Fill in defaults for missing values
	for (const key of Object.keys(hDefaults)) {
		const value = hDefaults[key]
		if (!hOptions.hasOwnProperty(key) && defined(value)) {
			hOptions[key] = value
		}
	}
	return hOptions
}

// ---------------------------------------------------------------------------

export const getOptions = (options=undef, hDefaults={}) => {

	const hOptions = (
		  notdefined(options) ? {}
		: isString(options)   ? strToHash(options)
		: isObject(options)   ? options
		:                       croak(`Bad options: ${OL(options)}`)
		)
	return addDefaults(hOptions, hDefaults)
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------

export const isFile = (path) => {

	return fs.existsSync(path) && fs.lstatSync(path).isFile()
}

// ---------------------------------------------------------------------------

export const isDir = (path) => {

	return fs.existsSync(path) && fs.lstatSync(path).isDirectory()
}

// ---------------------------------------------------------------------------

export const fileExt = (path) => {

	let ref1;if ((ref1 = path.match(/\.[^\.]+$/))) {const lMatches = ref1;
		return lMatches[0]
	}
	else {
		return ''
	}
}

// ---------------------------------------------------------------------------

export const withExt = (path, ext) => {

	assert(ext.startsWith('.'), `Bad file extension: ${ext}`)
	const lMatches = path.match(/^(.*)\.[^\.]+$/)
	if (defined(lMatches)) {
		return `${lMatches[1]}${ext}`
	}
	croak(`Bad path: '${path}'`)
}

// ---------------------------------------------------------------------------
// --- generate a 3 letter acronym if file stub is <str>-<str>-<str>

export var tla = (stub) => {

	let ref2;if ((ref2 = stub.match(/^([a-z])(?:[a-z]*)\-([a-z])(?:[a-z]*)\-([a-z])(?:[a-z]*)$/))) {const lMatches = ref2;
		const [_, a, b, c] = lMatches
		return `${a}${b}${c}`
	}
	else {
		return undef
	}
}

// ---------------------------------------------------------------------------

export const rmFile = (path) => {

	fs.rmSync(path, {force: true})   // no error if file doesn't exist
	return
}

// ---------------------------------------------------------------------------
// --- GENERATOR: yields:
// { path, name, isFile, isDirectory, isSymlink }
//
// --- Available options:
//        root:           default = current directory
//        exclude:        patterns to exclude, default = [
//                           'node_modules/**'
//                           '.git/**'
//                           ]
//        includeDirs:    default = false
//        followSymlinks: default = false
//        canonicalize:   default = true if followSymlinks is true

export const globFiles = function*(pat='*', hOptions={}) {

	const {
		root,
		includeDirs,
		exclude,
		followSymlinks,
		canonicalize,
		parse
		} = getOptions(hOptions, {
			root: Deno.cwd(),
			includeDirs: false,
			exclude: [],
			followSymlinks: undef,
			canonicalize: undef,
			parse: false
			})

	const hGlobOptions = {
		root,
		followSymlinks,
		canonicalize,
		includeDirs: false,
		exclude: ['node_modules/**', '.git/**',... exclude]
		}
	for (const hFile of expandGlobSync(pat, hGlobOptions)) {
		if (parse) {
			yield parsePath(hFile.path)
		}
		else {
			// --- has keys: path, name, isFile, isDirectory, isSymLink
			hFile.path = relpath(hFile.path)
			yield hFile
		}
	}
	return
}

// ---------------------------------------------------------------------------
// ASYNC ITERABLE
//
// Example Usage in *.civet
//
//   import {allLinesIn} from './llutils.js'
//
//   for await line of allLinesIn('src/lib/temp.civet')
// 	    console.log "LINE: #{line}"
//   console.log "DONE"

export const allLinesIn = async function*(path) {

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
// ASYNC ITERABLE
//
// Example Usage in *.civet
//
//   import {watchFiles} from './llutils.js'
//
//   for await event of watchFiles('src/lib')
// 	    console.log "EVENT: #{event.kind} #{event.paths[0]}"
//   watcher.close()
//   console.log "DONE"

export const watchFiles = async function*(path) {

	console.log(`WATCHING: ${path}`)
	const watcher = Deno.watchFs(path)
	for await (const event of watcher) {
		console.log(`WATCHER EVENT: ${OL(event)}`)
		yield event
	}
	watcher.close()
}

// ---------------------------------------------------------------------------
//     convert \ to /
// --- convert "C:..." to "c:..."

export const normalizePath = (path) => {

	const npath = path.replaceAll('\\', '/')
	if (npath.charAt(1) === ':') {
		return npath.charAt(0).toLowerCase() + npath.substring(1)
	}
	else {
		return npath
	}
}

// ---------------------------------------------------------------------------

export const mkpath = (...lParts) => {

	const path = pathLib.resolve(...lParts)
	return normalizePath(path)
}

// ---------------------------------------------------------------------------

export const relpath = (...lParts) => {

	assert(isArrayOfStrings(lParts), `Bad lParts: ${OL(lParts)}`)
	const fullPath = pathLib.resolve(...lParts)
	return normalizePath(pathLib.relative('', fullPath))
}

// ---------------------------------------------------------------------------

export const parsePath = (fileSpec, hOptions={}) => {
	// --- NOTE: fileSpec may be a file URL, e.g. import.meta.url
	//           fileSpec may be a relative path

	assert(isString(fileSpec), `fileSpec not a string ${OL(fileSpec)}`)
	const {stats} = getOptions(hOptions, {
		stats: false
		})

	// --- mkpath() normalizes the path
	const path = mkpath(
		defined(fileSpec.match(/^file\:\/\//))
			? urlLib.fileURLToPath(fileSpec)
			: fileSpec
			)
	assert(isNonEmptyString(path), `Bad path: ${OL(path)}`)
	const type = pathType(path)

	const {root, dir, base: fileName} = pathLib.parse(path)

	const lParts = fileName.split('.')
	let ref3;switch(lParts.length) {
		case 0: {
			ref3 = croak("Can't happen");break;
		}
		case 1: {
			ref3 = [fileName, undef, undef];break;
		}
		case 2: {
			ref3 = [lParts[0], undef, `.${lParts[1]}`];break;
		}
		default: {
			ref3 = [
				lParts.slice(0, -2).join('.'),
				lParts.at(-2),
				`.${lParts.at(-1)}`
				]
		}
	};const [stub, purpose, ext] =ref3

	// --- Grab everything up until the last path separator, if any
	const relPath = relpath(path)
	const lPathMatches = relPath.match(/^(.*)[\\\/][^\\\/]*$/)
	const relDir = defined(lPathMatches) ? lPathMatches[1] : '.'

	const hFile = {
		path,
		type,
		root,
		dir,
		fileName,
		stub,
		purpose,
		ext,
		relPath,
		relDir
		}
	if (stats && isFile(path)) {
		Object.assign(hFile, getFileStats(path))
	}
	return hFile
}

// ---------------------------------------------------------------------------
// --- returns one of:
//        'missing'  - does not exist
//        'dir'      - is a directory
//        'file'     - is a file
//        'unknown'  - exists, but not a file or directory

export const pathType = (path) => {

	assert(isString(path), `not a string: ${OL(path)}`)
	if (fs.existsSync(path)) {
		if (isFile(path)) {
			return 'file'
		}
		else if (isDir(path)) {
			return 'dir'
		}
		else {
			return 'unknown'
		}
	}
	else {
		return 'missing'
	}
}

// ---------------------------------------------------------------------------

export const getFileStats = (path) => {

	return fs.lstatSync(path)
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------

export const newerDestFileExists = (srcPath, destPath) => {

	assert(isFile(srcPath), `No such file: ${OL(srcPath)} (newerDestFileExists)`)
	if (!fs.existsSync(destPath)) {
		return false
	}
	const srcModTime = fs.statSync(srcPath).mtimeMs
	const destModTime = fs.statSync(destPath).mtimeMs
	return (destModTime > srcModTime)
}

// ---------------------------------------------------------------------------

export var pathSubDirs = (path) => {

	const {root, dir} = pathLib.parse(path)
	return {
		root,
		lParts: dir.slice(root.length).split(/[\\\/]/)
		}
}

// ---------------------------------------------------------------------------

export var clearDir = (dirPath) => {

	try {
		const h = {withFileTypes: true, recursive: true}
		for (const ent in fs.readdirSync(dirPath, h)) {
			subEnt = mkpath(ent.path, ent.name)
			if (ent.isFile()) {
				fs.rmSync(subEnt)
			}
			else if (ent.isDirectory()) {
				clearDir(subEnt)
			}
		}
	}
	catch (err) {}
	return
}

// ---------------------------------------------------------------------------

export var mkDir = (dirPath, hOptions={}) => {

	const {clear} = getOptions(hOptions, {
		clear: false
		})

	try {
		fs.mkdirSync(dirPath)
		return true
	}
	catch (err) {
		if (err.code === 'EEXIST') {
			if (clear) {
				clearDir(dirPath)
			}
			return false
		}
		else {
			throw err
		}
	}
}

// ---------------------------------------------------------------------------

export var mkDirsForFile = (filePath) => {

	const {root, lParts} = pathSubDirs(filePath)
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
//   slurp - read a file into a string

export const slurp = (path) => {

	assert(isFile(path), `No such file: ${path} (slurp)`)
	return normalizeStr(fs.readFileSync(path, 'utf8'))
}

// ---------------------------------------------------------------------------
//   barf - write a string to a file
//          will ensure that all necessary directories exist

export const barf = (contents, path) => {

	mkDirsForFile(path)
	fs.writeFileSync(path, normalizeStr(contents))
	return
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------

export const mkstr = (item) => {

	if (defined(item)) {
		if (isString(item)) {
			return stripAnsiCode(item)
		}
		else if (isArray(item)) {
			return stripAnsiCode(item.join(''))
		}
		else {
			return stripAnsiCode(textDecoder.decode(item))
		}
	}
	else {
		return ''
	}
}

// ---------------------------------------------------------------------------

export const getCmdLine = (cmdName, lArgs) => {

	assert(isString(cmdName), `cmdName not a string: ${OL(cmdName)}`)
	assert(isArrayOfStrings(lArgs), `not an array of strings: ${OL(lArgs)}`)
	return `${cmdName} ${lArgs.join(' ')}`
}

// ---------------------------------------------------------------------------
// ASYNC

export const execCmd = async (cmdName, lArgs=[]) => {

	const cmdLine = getCmdLine(cmdName, lArgs)
	DBG(`EXEC: ${OL(cmdLine)}`, INDENT)
	const logger = curLogLevel()

	const cmd = new Deno.Command(cmdName, {
		args: lArgs,
		env: {DEFAULT_LOGGER: logger}
		})
	const {success, code, signal, stdout, stderr} = await cmd.output()
	if (code !== 0) {
		ERR(`ERROR running ${cmdLine}, code=${code}`)
	}

	const hRetVal = {
		cmdLine,
		success,
		signal,
		code
		}

	if (defined(stdout)) {
		const stdoutStr = mkstr(stdout)
		if (stdoutStr.length > 0) {
			DBG("stdout =", stdoutStr)
			hRetVal.stdout = stdoutStr
		}
	}

	if (defined(stderr)) {
		const stderrStr = mkstr(stderr)
		if (stderrStr.length > 0) {
			DBG("stderr =", stderrStr)
			hRetVal.stderr = stderrStr
		}
	}

	DBG(UNDENT)
	return hRetVal
}

// ---------------------------------------------------------------------------

export const execCmdSync = (cmdName, lArgs=[]) => {

	const cmdLine = getCmdLine(cmdName, lArgs)
	DBG(`EXEC SYNC: ${OL(cmdLine)}`, INDENT)
	const logger = curLogLevel()

	const cmd = new Deno.Command(cmdName, {
		args: lArgs,
		env: {DEFAULT_LOGGER: logger}
		})
	const {success, code, signal, stdout, stderr} = cmd.outputSync()
	if (code !== 0) {
		ERR(`ERROR running ${cmdLine}, code=${code}`)
	}

	const hRetVal = {
		cmdLine,
		success,
		signal,
		code
		}

	if (defined(stdout)) {
		const stdoutStr = mkstr(stdout)
		if (stdoutStr.length > 0) {
			DBG("stdout =", stdoutStr)
			hRetVal.stdout = stdoutStr
		}
	}

	if (defined(stderr)) {
		const stderrStr = mkstr(stderr)
		if (stderrStr.length > 0) {
			DBG("stderr =", stderrStr)
			hRetVal.stderr = stderrStr
		}
	}

	DBG(UNDENT)
	return hRetVal
}

// ---------------------------------------------------------------------------
// --- will eventually pre-process the .cielo code

export const cielo2civet = (path, civetPath) => {

	assert(isFile(path), `No such file: ${OL(path)} (cielo2civet)`)
	assert((fileExt(path) === '.cielo'), `Not a cielo file: ${OL(path)}`)
	execCmdSync('cp', [path, civetPath])
	assert(isFile(civetPath), `File not created: ${OL(civetPath)}`)
	return
}

// ---------------------------------------------------------------------------

export const civet2js = (path, jsPath) => {

	assert(isFile(path), `No such file: ${OL(path)} (civet2js)`)
	assert((fileExt(path) === '.civet'), `Not a civet file: ${OL(path)}`)

	execCmdSync('civet', [
		'--js',
		'-o',
		jsPath,
		'--inline-map',
		'-c',
		path
		])

	assert(isFile(jsPath), `File not created: ${OL(jsPath)}`)
	return
}

// ---------------------------------------------------------------------------

export const coffee2js = (path, jsPath) => {

	assert(isFile(path), `No such file: ${OL(path)} (coffee2js)`)
	assert((fileExt(path) === '.coffee'), `Not a CoffeeScript file: ${OL(path)}`)
	execCmdSync('coffee', [
		'-o',
		jsPath,
		'--inline-map',
		'-c',
		path
		])
	assert(isFile(jsPath), `File not created: ${OL(jsPath)}`)
	return
}

// ---------------------------------------------------------------------------

export const ts2js = (path, jsPath) => {

	assert(isFile(path), `No such file: ${OL(path)} (ts2js)`)
	assert((fileExt(path) === '.ts'), `Not a ts file: ${OL(path)}`)
	execCmdSync('civet', [
		'--js',
		'-o',
		jsPath,
		'--inline-map',
		'-c',
		path
		])
	assert(isFile(jsPath), `File not created: ${OL(jsPath)}`)
	return
}

// ---------------------------------------------------------------------------
// ASYNC

export const installDenoCmd = async (stub) => {

	await execCmd('deno', [
		'install',
		'-fgA',
		`src/bin/${stub}.js`
		])
	const shortName = tla(stub)
	if (defined(shortName)) {
		await execCmd('deno', [
			'install',
			'-fgA',
			'-n',
			shortName,
			`src/bin/${stub}.js`
			])
	}
	return
}

// ---------------------------------------------------------------------------
// --- TO DO: if file 'compile.config.js' exists
//            in current dir, use that

export const getConfig = () => {

	return {
		hCompilers: {
			'.cielo': {
				outExt: '.js',
				compiler: (path) => {
					assert(isFile(path), `No such file: ${OL(path)}`)
					const civetPath = withExt(path, '.temp.civet')
					rmFile(civetPath)
					cielo2civet(path, civetPath)
					civet2js(civetPath, withExt(path, '.js'))
				}
				},
			'.civet': {
				outExt: '.js',
				compiler: (path) => {
					civet2js(path, withExt(path, '.js'))
				}
				},
			'.coffee': {
				outExt: '.js',
				compiler: (path) => {
					coffee2js(path, withExt(path, '.js'))
				}
				},
			'.ts': {
				outExt: '.js',
				compiler: (path) => {
					ts2js(path, withExt(path, '.js'))
				}
				}
			},
		hPostProcessors: {
			'test': {
				dir: 'test'    // --- no post processing
				},
			'lib': {
				dir: 'src/lib',
				postProcessor: (stub, hOptions) => {
					const testPath = findSourceFile('test', stub, 'test').path
					if (defined(testPath)) {
						const {status} = compileFile(testPath, hOptions)
					}
				}
				},
			'bin': {
				dir: 'src/bin',
				postProcessor: (stub, hOptions) => {
					LOG(`- installing command ${stub}`)
					installDenoCmd(stub, hOptions)
				}
				}
			}
		}
}

export const hConfig = getConfig()
export const hCompilers = hConfig.hCompilers
export const lCompilerExtensions = Object.keys(hCompilers)
export const hPostProcessors = hConfig.hPostProcessors
export const lDirSpecs = Object.keys(hPostProcessors)

// ---------------------------------------------------------------------------
// --- returns [compiler, outExt]
//     or [undef, undef] if there is no compiler

export const getCompiler = (ext) => {

	const h = hCompilers[ext]
	if (notdefined(h)) {
		DBG(`Not compiling - no compiler for ${ext} files`)
		return [undef, undef]
	}

	assert(isHash(h), `hCompilers[${ext}] not a hash: ${OL(h)}`)
	const {outExt, compiler} = h
	assert(defined(compiler), `Missing compiler in config for ${OL(ext)}`)
	assert(defined(outExt), `Missing outExt in config for ${OL(ext)}`)
	return [compiler, outExt]
}

// ---------------------------------------------------------------------------

export const isStub = (str) => {

	return notdefined(str.match(/[\.\\\/]/))
}

// ---------------------------------------------------------------------------

export const isDirSpec = (dirspec) => {

	return lDirSpecs.includes(dirspec)
}

// ---------------------------------------------------------------------------
// --- Returns {path, dirspec}

export const findSourceFile = (dirspec, stub, purpose) => {

	assert(isStub(stub), `Bad stub: ${OL(stub)}`)
	if (defined(dirspec)) {
		assert(lDirSpecs.includes(dirspec), `Bad dirspec: ${OL(dirspec)}`)
		const dir = hPostProcessors[dirspec].dir

		// --- Try every supported file extension
		for (const ext of lCompilerExtensions) {
			const path = (
				defined(purpose)
					? mkpath(dir, `${stub}.${purpose}${ext}`)
					: mkpath(dir, `${stub}${ext}`)
				)
			if (isFile(path)) {
				return {path, dirspec}
			}
		}
		return {}
	}
	else {
		// --- If dirspec is undef, we search all possible dirspecs
		//     but throw exception if it's found in more than one

		let [foundPath, dspec] = [undef, undef]
		for (const ds of lDirSpecs) {
			const h = findSourceFile(ds, stub, purpose)
			if (defined(h.path, h.dirspec)) {
				if (defined(foundPath)) {
					croak(`Ambiguous: [${dirspec}, ${stub}]`)
				}
				foundPath = h.path
				dspec = h.dirspec
			}
		}
		if (defined(foundPath, dspec)) {
			return {
				path: foundPath,
				dirspec: dspec
				}
		}
		else {
			return {}
		}
	}
}


// ---------------------------------------------------------------------------
// --- returns {path, dirspec, stub, purpose, ext}
//        returns {} if the file does not exist
//        dirspec and stub are undef if file exists, but
//           isn't in ./src/lib, ./src/bin or ./test folders

export const getSrcInfo = (src) => {

	if (isArray(src)) {
		// -- NOTE: src can be [undef, <stub>], in which case
		//          there can be only one dirspec that
		//          results in an existing file

		const [dspec, stub, purpose] = src
		const {path, dirspec} = findSourceFile(dspec, stub, purpose)
		if (isFile(path)) {
			const {stub, purpose, ext, relPath} = parsePath(path)
			return {
				path,
				relPath,
				dirspec,
				stub,
				purpose,
				ext
				}
		}
		else {
			return {}
		}
	}
	else if (isFile(src)) {
		const {stub, purpose, ext, relPath} = parsePath(src)
		const dirspec = (
			relPath.startsWith('src/lib/')     ? 'lib'
			: relPath.startsWith('./src/lib/') ? 'lib'
			: relPath.startsWith('src/bin/')   ? 'bin'
			: relPath.startsWith('./src/bin/') ? 'bin'
			: relPath.startsWith('test/')      ? 'test'
			: relPath.startsWith('./test/')    ? 'test'
			:                                    undef)
		return {
			path: src,
			relPath,
			dirspec,
			stub: defined(dirspec) ? stub : undef,
			purpose,
			ext
			}
	}
	else {
		return {}
	}
}

// ---------------------------------------------------------------------------
// --- src can be a full path or [dirspec, stub, purpose]
//        where dirspec can be 'lib', 'bin' or 'test'
//     throws error if file does not exist
//
//     Possible status values:
//        'temp'       - it was a temp file, not compiled
//        'nocompiler' - has no compiler, not compiled
//        'exists'     - newer compiled file already exists
//        'failed'     - compiling failed
//        'compiled'   - successfully compiled

export const compileFile = (src, hOptions={}) => {

	DBG(`COMPILE: ${OL(src)}`, INDENT)

	const {dirspec, stub, path, relPath, purpose, ext} = getSrcInfo(src)
	if (notdefined(relPath)) {
		ERR(`No such file: ${OL(relPath)} (compileFile)`, UNDENT)
		return {
			status: 'nofile'
			}
	}
	if (purpose === 'temp') {
		DBG(`Not compiling temp file ${OL(relPath)}`, UNDENT)
		return {
			path,
			relPath,
			status: 'temp'
			}
	}

	const [compiler, outExt] = getCompiler(ext)
	if (notdefined(compiler)) {
		DBG(`Not compiling - no compiler for ${ext}`, UNDENT)
		return {
			path,
			relPath,
			status: 'nocompiler'
			}
	}

	const {force, nopp} = getOptions(hOptions, {
		force: false,
		nopp: false
		})

	const outPath = withExt(relPath, outExt)
	if (newerDestFileExists(relPath, outPath) && !force) {
		DBG(`Not compiling, newer ${outPath} exists`, UNDENT)
		return {
			path,
			relPath,
			status: 'exists',
			outPath
			}
	}

	DBG("No newer dest file exists")
	if (isFile(outPath)) {
		DBG(`removing older ${outPath}`)
		rmFile(outPath)
	}
	DBG(`compiling ${OL(relPath)}`)
	compiler(relPath)     // produces file outPath, may throw

	if (isFile(outPath)) {
		// --- If first line is a file name with original extension,
		//     replace the file extension
		const contents = Deno.readTextFileSync(outPath)
		const lLines = contents.split("\n")
		lLines[0].replace(ext, outExt)
		Deno.writeTextFileSync(outPath, lLines.join("\n"))
	}
	else {
		ERR(`Output file ${relpath(outPath)} not produced`, UNDENT)
		return {
			path,
			relPath,
			status: 'failed',
			outPath
			}
	}

	if (defined(dirspec) && !nopp) {
		const postProc = hPostProcessors[dirspec].postProcessor
		if (defined(postProc)) {
			DBG("post-processing file")
			postProc(stub, hOptions)
		}
	}

	DBG(UNDENT)
	return {
		path,
		relPath,
		status: 'compiled',
		outPath
		}
}

// ---------------------------------------------------------------------------

export const getPattern = () => {

	const lKeys = Object.keys(hCompilers)
	if (lKeys.length === 1) {
		return `**/*${lKeys[0]}`
	}
	else {
		return `**/*{${lKeys.join(',')}}`
	}
}

// ---------------------------------------------------------------------------
// --- A generator - yields {path, status, outPath}

export const compileAllFiles = function*(pattern=undef, hOptions={}) {

	const {force} = getOptions(hOptions, {
		force: false
		})

	const hGlobOptions = {
		exclude: [
			'node_modules/**',
			'.git/**',
			'**/*.temp.*'  // --- don't compile temp files
			]
		}

	const globPattern = defined(pattern) ? pattern : getPattern()
	DBG(`compiling all files, force=${force}, pat=${OL(globPattern)}`)
	for (const {path} of globFiles(globPattern, hGlobOptions)) {
		const hResult = compileFile(path, hOptions)
		if (hResult.status === 'compiled') {
			yield hResult
		}
	}
	return
}

// ---------------------------------------------------------------------------

export const runUnitTest = (stub, hCompileOptions={}) => {

	DBG(`Running unit test ${stub}`)

	// --- Check if there's a corresponding library file
	const libPath = findSourceFile('lib', stub).path
	if (defined(libPath)) {
		if (isFile(libPath)) {
			// --- Make sure the library is compiled
			const {status, outPath} = compileFile(libPath, hCompileOptions)
			if (status === 'failed') {
				WARN(`Compile of lib ${relpath(libPath)} failed - ${status}`)
			}
		}
		else {}
	}
	else {
		DBG(`No corresponding library file for ${OL(stub)}`)
	}

	// --- Check if there's a corresponding binary file
	const binPath = findSourceFile('bin', stub).path
	if (isFile(binPath)) {
		// --- Make sure the binary is compiled
		const {status, outPath} = compileFile(binPath, hCompileOptions)
		if (status === 'failed') {
			WARN(`Compile of bin ${relpath(binPath)} failed - ${status}`)
		}
	}
	else {
		DBG(`No corresponding bin file for ${OL(stub)}`)
	}

	// --- Make sure unit test file is compiled
	//     NOTE: *.test.js file may exist without a *.test.civet file
	//           e.g. base.test.js
	const testPath = findSourceFile('test', stub, 'test').path
	let testOutPath = undef
	if (defined(testPath)) {
		DBG(`testPath = ${OL(testPath)}`)
		assert(isFile(testPath), `No such file: ${OL(testPath)} (runUnitTest)`)

		const {status, outPath} = compileFile(testPath, hCompileOptions)
		if (status === 'failed') {
			croak(`Compile of ${relpath(testPath)} failed`)
		}
		testOutPath = outPath
	}
	else {
		testOutPath = `test/${stub}.test.js`
	}

	// --- Compile all files in subdir if it exists
	if (isDir(`test/${stub}`)) {
		for (const {path, status, outPath} of compileAllFiles(`test/${stub}/*`)) {
			if (notdefined(outPath)) {
				WARN(`File ${OL(path)} not compiled`)
			}
		}
	}

	// --- Run the unit test, return return code
	assert(isFile(testOutPath), `No such file: ${OL(testOutPath)}`)
	return execCmdSync('deno', [
			'test',
			'-qA',
			testOutPath
			])
}

// ---------------------------------------------------------------------------
// --- a generator

export const runAllUnitTests = function*(hCompileOptions={}) {

	const hGlobOptions = {
		exclude: ['node_modules/**', '.git/**']
		}

	const pattern = 'test/*.test.js'
	DBG(`pattern = ${OL(pattern)}`)
	for (const {path} of globFiles(pattern, hGlobOptions)) {
		const {stub, ext, relDir} = parsePath(path)
		DBG(`TEST: ${path}`)
		yield runUnitTest(stub, hCompileOptions)
	}
	return
}

// ---------------------------------------------------------------------------

export const getCmdArgs = (lArgs=Deno.args, hOptions={}) => {

	assert(isHash(hOptions), `hOptions not a hash: ${OL(hOptions)}`)
	const {hArgs, nonOptions, doSetLogger} = getOptions(hOptions, {
		hArgs: undef,
		nonOptions: [0, Infinity],
		doSetLogger: false
		})

	if (doSetLogger && defined(hArgs)) {
		assert(!hasKey(hArgs, 'd'), "Arg key 'd' set")
		assert(!hasKey(hArgs, 'q'), "Arg key 'q' set")
		assert(!hasKey(hArgs, 'p'), "Arg key 'p' set")
	}

	const [minNonOptions, maxNonOptions] = (
		(isArray(nonOptions)?
			nonOptions
		:
			[nonOptions, nonOptions])
		)

	let hResult = {
		_: []
		}

	// --- Pre-process lArgs, which makes it easier
	//     to check if calls to DBG() should be logged,
	//     even while parsing args

	let loggerToSet = undef

	const results=[];for (const str of lArgs) {
		const lMatches = str.match(/^-([A-Za-z0-9_-]*)(?:(=)(.*))?$/)
		if (defined(lMatches)) {
			if (doSetLogger && !lMatches[2]) {
				if (lMatches[1].includes('p')) {
					hResult.p = true
					loggerToSet = 'profile'
				}
				else if (lMatches[1].includes('d')) {
					hResult.d = true
					loggerToSet = 'debug'
				}
				else if (lMatches[1].includes('q')) {
					hResult.q = true
					loggerToSet = 'error'
				}
			}
			results.push(lMatches)
		}
		else {
			results.push(undef)
		}
	};const lArgMatches =results

	if (doSetLogger) {
		setLogLevel(loggerToSet || 'info')
	}

	// --- Utility functions

	const add = (name, alias, value) => {
		assert(isString(name), `Not a string: ${OL(name)}`)
		if (defined(alias)) {
			assert(isString(alias), `Not a string: ${OL(alias)}`)
		}
		assert(!hasKey(hResult, name), `dup key ${name}`)
		hResult[name] = value
		if (alias) {
			assert(!hasKey(hResult, alias), `dup key ${alias}`)
			hResult[alias] = value
		}
		return
	}

	const addOption = (name, value) => {
		if (notdefined(hArgs)) {
			hResult[name] = value
			return
		}

		if (doSetLogger && ['d','q','p'].includes(name)) {
			return
		}

		const errMsg = `Bad arg: ${OL(name)}`
		assert(defined(hArgs[name]), errMsg)
		const {type, alias} = hArgs[name]

		// --- type checking
		if (isArray(type)) {
			assert(type.includes(value))
			add(name, alias, value)
		}
		else {
			switch(type) {
				case 'string': {
					add(name, alias, value);break;
				}
				case 'boolean':case undef: {
					if (value === 'true') {
						add(name, alias, true)
					}
					else if (value === 'false') {
						add(name, alias, false)
					}
					else {
						add(name, alias, value)
					};break;
				}
				case 'number':case 'float': {
					add(name, alias, parseFloat(value));break;
				}
				case 'integer': {
					add(name, alias, parseInt(value));break;
				}
			}
		}
		return
	}

	const addNonOption = (str) => {
		hResult._.push(str)
	}

	// --- lArgs is an array

	let i2 = 0;for (const str of lArgs) {const i = i2++;
		// --- check if it's an option
		const lMatches = lArgMatches[i]
		if (defined(lMatches)) {
			// --- it's an option
			const [_, optStr, eqStr, value] = lMatches
			if (eqStr) {
				addOption(optStr, value)
			}
			else {
				const lChars = optStr.split('')
				for (const ch of optStr.split('')) {
					addOption(ch, true)
				}
			}
		}
		else {
			// --- it's a non-option
			addNonOption(str)
		}
	}

	if (defined(hArgs)) {
		for (const name of Object.keys(hArgs)) {
			if (notdefined(hResult[name])) {
				const {alias, type, defaultVal} = hArgs[name]
				if (defined(defaultVal)) {
					add(name, alias, defaultVal)
				}
				else if (notdefined(type)) {
					add(name, alias, false)
				}
			}
		}
	}

	const numNonArgs = hResult._.length
	assert((numNonArgs >= minNonOptions),
		`${numNonArgs} non-args < min (${minNonOptions})`)
	assert((numNonArgs <= maxNonOptions),
		`${numNonArgs} non-args > max (${maxNonOptions})`)
	DBG(`hResult = ${OL(hResult)}`)
	return hResult
}

// ---------------------------------------------------------------------------
// --- ASYNC !

export var sleep = async (sec) => {

	await new Promise((r) => setTimeout(r, 1000 * sec))
	return
}

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3JjL2xpYi9sbHV0aWxzLmNpdmV0LnRzeCIsInNvdXJjZXMiOlsic3JjL2xpYi9sbHV0aWxzLmNpdmV0Il0sIm1hcHBpbmdzIjoiQUFBQSxnQkFBZTtBQUNmLEFBQUE7QUFDQSxBQUFBLE1BQU0sQ0FBQyxDQUFDLGNBQWMsQ0FBQyxDQUFDLElBQUksQ0FBQyxxQkFBcUI7QUFDbEQsQUFBQSxBQUFBLE1BQU0sQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLElBQUk7QUFDbkIsQUFBQSxBQUFBLE1BQU0sQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLE1BQU07QUFDMUIsQUFBQSxBQUFBLE1BQU0sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEtBQUs7QUFDeEIsQUFBQSxBQUFBLE1BQU0sQ0FBQyxDQUFDLGNBQWMsQ0FBQyxDQUFDLElBQUksQ0FBQyxjQUFjO0FBQzNDLEFBQUEsQUFBQSxNQUFNLENBQUMsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLElBQUksQ0FBQyxZQUFZO0FBQzVDLEFBQUEsQUFBQSxNQUFNLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxJQUFJLENBQUMsZ0JBQWdCO0FBQ3RDLEFBQUEsQUFBQSxNQUFNLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxJQUFJLENBQUMscUJBQXFCO0FBQzVDLEFBQUEsQUFBQSxNQUFNLENBQUMsQ0FBQyxhQUFhLENBQUMsQ0FBQyxJQUFJLENBQUMsaUJBQWlCO0FBQzdDLEFBQUEsQUFBQSxNQUFNLENBQUMsQ0FBQztBQUNSLENBQUMsV0FBVyxDQUFDLENBQUMsWUFBWSxDQUFDLENBQUMsV0FBVyxDQUFDO0FBQ3hDLENBQUMsV0FBVyxDQUFDLENBQUMsUUFBUSxDQUFDO0FBQ3ZCLENBQUMsTUFBTSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsS0FBSyxDQUFDO0FBQ3ZCLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDO0FBQ3JCLENBQUMsQ0FBQyxDQUFDLElBQUks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LE1BQU0sQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsR0FBRSxDQUFDLENBQUMsQztDQUFDLENBQUE7QUFDOUIsQUFBQSxDQUFDLElBQUksQ0FBQSxDQUFBO0FBQ0wsQUFBQSxFQUFFLE1BQU0sQ0FBQyxLO0NBQUssQztBQUFBLENBQUE7QUFDZCxBQUFBO0FBQ0EsQUFBQSw4RUFBNkU7QUFDN0UsQUFBQSw4QkFBNkI7QUFDN0IsQUFBQTtBQUNBLEFBQUEsQUFBQSxNQUFNLENBQVMsTUFBUixRQUFRLENBQUMsQ0FBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFBLENBQUE7QUFDekIsQUFBQTtBQUNBLEFBQUEsQ0FBQyxNQUFNLENBQUMsQ0FBSSxPQUFPLENBQUMsQ0FBQyxDO0FBQUMsQ0FBQTtBQUN0QixBQUFBO0FBQ0EsQUFBQSw4RUFBNkU7QUFDN0UsQUFBQTtBQUNBLEFBQUEsQUFBQSxNQUFNLENBQU0sTUFBTCxLQUFLLENBQUMsQ0FBRSxDQUFDLENBQUMsR0FBRyxRQUFRLENBQUMsQ0FBQyxFQUFFLENBQUEsQ0FBQTtBQUNoQyxBQUFBO0FBQ0EsQUFBQSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFTLEdBQVIsUUFBVyxDO0FBQUMsQ0FBQTtBQUNsQyxBQUFBO0FBQ0EsQUFBQSw4RUFBNkU7QUFDN0UsQUFBQTtBQUNBLEFBQUEsQUFBQSxNQUFNLENBQWEsTUFBWixZQUFZLENBQUMsQ0FBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFBLENBQUE7QUFDN0IsQUFBQTtBQUNBLEFBQUEsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxDO0FBQUMsQ0FBQTtBQUNoRCxBQUFBO0FBQ0EsQUFBQSw4RUFBNkU7QUFDN0UsQUFBQTtBQUNBLEFBQUEsQUFBQSxNQUFNLENBQUMsSUFBQSxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFBLENBQUE7QUFDdEIsQUFBQTtBQUNBLEFBQUEsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEM7QUFBQyxDQUFBO0FBQ3JCLEFBQUE7QUFDQSxBQUFBLDhFQUE2RTtBQUM3RSxBQUFBO0FBQ0EsQUFBQSxBQUFBLE1BQU0sQ0FBQyxJQUFBLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUEsQ0FBQTtBQUNwQixBQUFBO0FBQ0EsQUFBQSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQztBQUFDLENBQUE7QUFDdEIsQUFBQTtBQUNBLEFBQUEsOEVBQTZFO0FBQzdFLEFBQUE7QUFDQSxBQUFBLEFBQUEsTUFBTSxDQUFDLElBQUEsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQVcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQSxDQUFBO0FBQ3hDLEFBQUE7QUFDQSxBQUFBLENBQU0sTUFBTCxLQUFLLENBQUMsQ0FBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLE1BQU07QUFDMUIsQUFBQSxDQUFDLE1BQU0sQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQztBQUFDLENBQUE7QUFDL0IsQUFBQTtBQUNBLEFBQUEsOEVBQTZFO0FBQzdFLEFBQUE7QUFDQSxBQUFBLEFBQUEsTUFBTSxDQUFVLE1BQVQsU0FBUyxDQUFDLENBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQSxDQUFBO0FBQzVCLEFBQUE7QUFDQSxBQUFBLENBQUMsTUFBTSxDQUFBLEFBQUMsZ0JBQWdCLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLFlBQVksRUFBRSxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQ3ZELEFBQUEsQ0FBRSxNQUFELENBQUMsQ0FBQyxDQUFFLENBQUMsQ0FBQyxDQUFDO0FBQ1IsQUFBQSxDQUFDLEdBQUcsQ0FBQyxDQUFBLE1BQUEsSUFBSSxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFBLENBQUEsQ0FBQTtBQUM3QixBQUFBLEUsSSxHLENBQUUsR0FBRyxDLEMsR0FBUSxDQUFDLENBQUUsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUcsQ0FBQyxBQUM1QixDQUFDLEVBQUUsRUFBRSxBQUFvQixBQUFjLEFBQ3ZDLENBQUMsUUFBUSxZQUFZLEVBQUUsQUFBRSxBQUFZLEFBQ3JDLEdBQUcsQUFDRixHQUFHLEFBQ0gsSUFBSSxBQUNKLEVBQUUsQUFDSCxDQUFDLENBQUcsQyxDQUFDLENBQUEsQ0FBQSxDQVBJLE1BQVIsUSxHLEcsQ0FPSTtBQUNULEFBQUEsR0FBK0IsTUFBNUIsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFFLENBQUMsUUFBUTtBQUMzQyxBQUFBLEdBQUcsR0FBRyxDQUFBLGdCQUFnQixDQUFDLE1BQU0sQ0FBQyxDQUFBLENBQUEsQ0FBQTtBQUM5QixBQUFBLElBQUksTUFBTSxDQUFBLEFBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxHQUFFLENBQUMsRUFBRSxDQUFDLENBQUM7QUFDMUMsQUFBQSxNQUFNLDRCQUE0QixDQUFBO0FBQ2xDLEFBQUE7QUFDQSxBQUFBLElBQUkscUNBQW9DO0FBQ3hDLEFBQUEsSUFBTyxNQUFILEdBQUcsQ0FBQyxDQUFFLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQztBQUMxQixBQUFBLElBQUksR0FBRyxDQUFBLE1BQU0sQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUEsQ0FBQSxDQUFBO0FBQ3hCLEFBQUEsS0FBSyx5Q0FBd0M7QUFDN0MsQUFBQSxLQUFLLENBQUMsQ0FBQyxLQUFLLENBQUMsQyxDQUFFLENBQUMsRztJQUFHLENBQUE7QUFDbkIsQUFBQSxJQUFJLElBQUksQ0FBQSxDQUFBO0FBQ1IsQUFBQSxLQUFLLENBQUMsQ0FBQyxLQUFLLENBQUMsQyxDQUFFLENBQUMsRztJQUFHLEM7R0FBQSxDQUFBO0FBQ25CLEFBQUEsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFBLEdBQUcsQ0FBQSxDQUFBLENBQUE7QUFDZCxBQUFBLElBQUksQ0FBQyxDQUFDLEtBQUssQ0FBQyxDLENBQUUsQ0FBQyxLO0dBQUssQ0FBQTtBQUNwQixBQUFBLEdBQUcsSUFBSSxDQUFBLENBQUE7QUFDUCxBQUFBLElBQUksQ0FBQyxDQUFDLEtBQUssQ0FBQyxDLENBQUUsQ0FBQyxJO0dBQUksQztFQUFBLENBQUE7QUFDbkIsQUFBQSxFQUFFLElBQUksQ0FBQSxDQUFBO0FBQ04sQUFBQSxHQUFHLEtBQUssQ0FBQSxBQUFDLENBQUMsYUFBYSxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEM7RUFBQSxDO0NBQUEsQ0FBQTtBQUNuQyxBQUFBLENBQUMsTUFBTSxDQUFDLEM7QUFBQyxDQUFBO0FBQ1QsQUFBQTtBQUNBLEFBQUEsOEVBQTZFO0FBQzdFLEFBQUEsOEVBQTZFO0FBQzdFLEFBQUE7QUFDQSxBQUFBLEFBQUEsTUFBTSxDQUFLLE1BQUosSUFBSSxDQUFDLENBQUUsQ0FBQyxDQUFDLEdBQVcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUEsQ0FBQTtBQUM1QyxBQUFBO0FBQ0EsQUFBQSxDQUFDLE1BQU0sQ0FBQSxBQUFDLENBQUMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxHQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxZQUFZLENBQUE7QUFDdEMsQUFBQSxDQUFNLE1BQUwsS0FBSyxDQUFDLENBQUUsQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBRyxDQUFDO0FBQzdCLEFBQUEsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsTUFBTSxDQUFDLEtBQUssQztBQUFDLENBQUE7QUFDOUIsQUFBQTtBQUNBLEFBQUEsOEVBQTZFO0FBQzdFLEFBQUE7QUFDQSxBQUFBLEFBQUEsTUFBTSxDQUFLLE1BQUosSUFBSSxDQUFDLENBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUEsQ0FBQTtBQUNwQyxBQUFBO0FBQ0EsQUFBQSxDQUFDLE1BQU0sQ0FBQSxBQUFDLENBQUMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxHQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxZQUFZLENBQUE7QUFDdEMsQUFBQSxDQUFNLE1BQUwsS0FBSyxDQUFDLENBQUUsQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBRyxDQUFDO0FBQzdCLEFBQUEsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsRztBQUFHLENBQUE7QUFDOUIsQUFBQTtBQUNBLEFBQUEsOEVBQTZFO0FBQzdFLEFBQUEscUJBQW9CO0FBQ3BCLEFBQUEsOENBQTZDO0FBQzdDLEFBQUEsMERBQXlEO0FBQ3pELEFBQUE7QUFDQSxBQUFBLEFBQUEsTUFBTSxDQUFTLE1BQVIsUUFBUSxDQUFDLENBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFBLENBQUE7QUFDMUQsQUFBQTtBQUNBLEFBQUEsQ0FBVSxNQUFULFNBQVMsQ0FBQyxDQUFFLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTTtBQUNqQyxBQUFBLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUEsQ0FBQTtBQUNwQixBQUFBLEVBQUUsTUFBTSxDQUFDLEk7Q0FBSSxDQUFBO0FBQ2IsQUFBQSxDQUFRLE1BQVAsT0FBTyxDQUFDLENBQUUsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ3JDLEFBQUEsQ0FBUyxNQUFSLFFBQVEsQ0FBQyxDQUFFLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxPQUFPO0FBQ2hDLEFBQUEsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEdBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQSxDQUFBO0FBQ2pCLEFBQUEsRUFBRSxNQUFNLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxRQUFRLEM7Q0FBQyxDQUFBO0FBQ2xELEFBQUEsQ0FBQyxJQUFJLENBQUEsQ0FBQTtBQUNMLEFBQUEsRUFBSyxNQUFILEdBQUcsQ0FBQyxDQUFFLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUM7QUFDOUIsQUFBQSxFQUFNLE1BQUosSUFBSSxDQUFDLENBQUUsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDO0FBQzFDLEFBQUEsRUFBTyxNQUFMLEtBQUssQ0FBQyxDQUFFLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQztBQUM1QyxBQUFBLEVBQUUsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsSztDQUFLLEM7QUFBQSxDQUFBO0FBQ3hDLEFBQUE7QUFDQSxBQUFBLDhFQUE2RTtBQUM3RSxBQUFBO0FBQ0EsQUFBQSxBQUFBLE1BQU0sQ0FBWSxNQUFYLFdBQVcsQ0FBQyxDQUFFLENBQXFCLFFBQXBCLENBQUMsR0FBRyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsS0FBSyxDQUFJLENBQUEsQ0FBQTtBQUM1QyxBQUFBO0FBQ0EsQUFBQSxDQUFDLE1BQU0sQ0FBQSxBQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsa0JBQWtCLEVBQUUsRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUNyRCxBQUFBLENBQUMsTUFBTSxDQUFBLEFBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxvQkFBb0IsRUFBRSxFQUFFLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQzNELEFBQUEsQ0FBQyxNQUFNLENBQUEsQUFBQyxLQUFLLENBQUEsQ0FBQSxDQUFBO0FBQ2IsQUFBQSxFQUFFLElBQUksQ0FBQyxNQUFNLEMsS0FBQyxBQUFDLEdBQUcsQ0FBQSxDQUFBLENBQUE7QUFDbEIsQUFBQSxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsS0FBSyxDO0VBQUMsQ0FBQTtBQUMxQixBQUFBLEVBQUUsSUFBSSxDQUFDLFFBQVEsQyxLQUFDLEFBQUMsR0FBRyxDQUFBLENBQUEsQ0FBQTtBQUNwQixBQUFBLEdBQUcsTUFBTSxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxLQUFLLEM7RUFBQyxDQUFBO0FBQzlCLEFBQUEsRUFBRSxJQUFJLENBQUMsT0FBTyxDLEtBQUMsQUFBQyxHQUFHLENBQUEsQ0FBQSxDQUFBO0FBQ25CLEFBQUEsR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEtBQUssQztFQUFDLENBQUE7QUFDMUIsQUFBQSxFQUFFLE9BQUksQ0FBQSxDQUFBLENBQUE7QUFDTixBQUFBLEdBQUcsS0FBSyxDQUFBLEFBQUMsQ0FBQyxlQUFlLEVBQUUsRUFBRSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQztFQUFBLEM7Q0FBQSxDO0FBQUEsQ0FBQTtBQUN0QyxBQUFBO0FBQ0EsQUFBQSw4RUFBNkU7QUFDN0UsQUFBQTtBQUNBLEFBQUEsQUFBQSxNQUFNLENBQUssTUFBSixJQUFJLENBQUMsQ0FBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFBLENBQUE7QUFDMUIsQUFBQTtBQUNBLEFBQUEsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBRyxDO0FBQUMsQ0FBQTtBQUNwQyxBQUFBO0FBQ0EsQUFBQSw4RUFBNkU7QUFDN0UsQUFBQSxrRUFBaUU7QUFDakUsQUFBQTtBQUNBLEFBQUEsQUFBQSxNQUFNLENBQU8sTUFBTixNQUFNLENBQUMsQ0FBRSxDQUFDLENBQUM7QUFDbEIsQUFBQSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQTtBQUNWLEFBQUEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUE7QUFDVixBQUFBLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFBO0FBQ1YsQUFBQSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUc7QUFDVCxDQUFDLENBQUM7QUFDRixBQUFBO0FBQ0EsQUFBQSxBQUFBLE1BQU0sQ0FBUyxNQUFSLFFBQVEsQ0FBQyxDQUFFLENBQUMsQ0FBQztBQUNwQixBQUFBLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFBO0FBQ1YsQUFBQSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQTtBQUNWLEFBQUEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHO0FBQ1QsQ0FBQyxDQUFDO0FBQ0YsQUFBQTtBQUNBLEFBQUEsOEVBQTZFO0FBQzdFLEFBQUE7QUFDQSxBQUFBLEFBQUEsTUFBTSxDQUFVLE1BQVQsU0FBUyxDQUFDLENBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUEsQ0FBQTtBQUMxRCxBQUFBLENBQUMscUJBQW9CO0FBQ3JCLEFBQUEsQ0FBQywrQ0FBOEM7QUFDL0MsQUFBQSxDQUFDLG9EQUFtRDtBQUNwRCxBQUFBO0FBQ0EsQUFBQSxDQUFrQixNQUFqQixDQUFDLE1BQU0sQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUUsQ0FBQyxVQUFVLENBQUEsQUFBQyxRQUFRLENBQUMsQ0FBQyxDQUFDO0FBQzVDLEFBQUEsRUFBRSxNQUFNLENBQUMsQ0FBQyxLQUFLLENBQUE7QUFDZixBQUFBLEVBQUUsT0FBTyxDQUFDLENBQUMsR0FBRztBQUNkLEVBQUUsQ0FBQyxDQUFBO0FBQ0gsQUFBQTtBQUNBLEFBQUEsQ0FBQyxNQUFNLENBQUEsQUFBQyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLGNBQWMsRUFBRSxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQ2pELEFBQUEsQ0FBQyxNQUFNLENBQUEsQUFBQyxNQUFNLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLFlBQVksRUFBRSxFQUFFLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQ3ZELEFBQUE7QUFDQSxBQUFBLENBQU8sTUFBTixNQUFNLENBQUMsQ0FBRSxDQUFDLENBQUMsQ0FBQztBQUNiLEFBQUEsQyxJLEUsSSxDQUFDLEdBQUcsQ0FBQyxDQUFBLE1BQUEsRUFBSSxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxDQUFBLENBQUEsQ0FBbEIsTUFBQSxDLEcsRSxFLENBQWtCO0FBQzFCLEFBQUEsRUFBRSxHQUFHLENBQUEsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFFLENBQUMsTUFBTSxDQUFDLENBQUEsQ0FBQSxDQUFBO0FBQ3JDLEFBQUEsR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFBLEFBQUMsT0FBTyxDO0VBQUEsQ0FBQTtBQUN0QixBQUFBLEVBQU8sTUFBTCxLQUFLLENBQUMsQ0FBRSxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUM7QUFDdkIsQUFBQSxFQUFFLEdBQUcsQ0FBQSxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUEsQ0FBQSxDQUFBO0FBQ25CLEFBQUEsR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFBLEFBQUMsS0FBSyxDO0VBQUEsQ0FBQTtBQUNwQixBQUFBLEVBQUUsSUFBSSxDQUFBLENBQUE7QUFDTixBQUFBLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQSxBQUFDLEVBQUUsQztFQUFBLEM7Q0FBQSxDQUFBO0FBQ2pCLEFBQUEsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUUsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUEsQ0FBQTtBQUMxQixBQUFBLEVBQUUsTUFBTSxDQUFDLElBQUksQ0FBQSxBQUFDLE9BQU8sQztDQUFBLENBQUE7QUFDckIsQUFBQSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEVBQUUsQztBQUFDLENBQUE7QUFDdkIsQUFBQTtBQUNBLEFBQUEsOEVBQTZFO0FBQzdFLEFBQUEsZ0JBQWU7QUFDZixBQUFBLGlDQUFnQztBQUNoQyxBQUFBLGtDQUFpQztBQUNqQyxBQUFBO0FBQ0EsQUFBQSxBQUFBLE1BQU0sQ0FBQyxJQUFBLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsRUFBRSxDQUFBLENBQUE7QUFDNUQsQUFBQTtBQUNBLEFBQUEsQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLFFBQVEsQztBQUFDLENBQUE7QUFDNUMsQUFBQTtBQUNBLEFBQUEsOEVBQTZFO0FBQzdFLEFBQUEsOEVBQTZFO0FBQzdFLEFBQUE7QUFDQSxBQUFBLEFBQUEsTUFBTSxDQUFZLE1BQVgsV0FBVyxDQUFDLENBQUUsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLEVBQUUsQ0FBQSxDQUFBO0FBQzlDLEFBQUE7QUFDQSxBQUFBLENBQUMsTUFBTSxDQUFBLEFBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyx3QkFBd0IsRUFBRSxFQUFFLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQ3JFLEFBQUEsQ0FBQyxNQUFNLENBQUEsQUFBQyxRQUFRLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLHlCQUF5QixFQUFFLEVBQUUsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDeEUsQUFBQTtBQUNBLEFBQUEsQ0FBQywwQ0FBeUM7QUFDMUMsQUFBQSxDQUFDLEdBQUcsQ0FBQyxDQUFBLE1BQUEsR0FBRyxDQUFDLEVBQUUsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFBLENBQUEsQ0FBQTtBQUNsQyxBQUFBLEVBQU8sTUFBTCxLQUFLLENBQUMsQ0FBRSxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUM7QUFDekIsQUFBQSxFQUFFLEdBQUcsQ0FBQSxDQUFJLFFBQVEsQ0FBQyxjQUFjLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQSxDQUFBLENBQUE7QUFDdkQsQUFBQSxHQUFHLFFBQVEsQ0FBQyxHQUFHLENBQUMsQyxDQUFFLENBQUMsSztFQUFLLEM7Q0FBQSxDQUFBO0FBQ3hCLEFBQUEsQ0FBQyxNQUFNLENBQUMsUTtBQUFRLENBQUE7QUFDaEIsQUFBQTtBQUNBLEFBQUEsOEVBQTZFO0FBQzdFLEFBQUE7QUFDQSxBQUFBLEFBQUEsTUFBTSxDQUFXLE1BQVYsVUFBVSxDQUFDLENBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUEsQ0FBQTtBQUNyRCxBQUFBO0FBQ0EsQUFBQSxDQUFTLE1BQVIsUUFBUSxDQUFDLENBQUUsQ0FBQyxDQUFDO0FBQ2QsQUFBQSxJQUFJLFVBQVUsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQzVCLEVBQUUsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQztBQUM1QyxFQUFFLENBQUMsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDLE9BQU87QUFDakMsRUFBRSxDQUFDLHVCQUF1QixLQUFLLENBQUEsQUFBQyxDQUFDLGFBQWEsRUFBRSxFQUFFLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQzdELEVBQUUsQ0FBQztBQUNILEFBQUEsQ0FBQyxNQUFNLENBQUMsV0FBVyxDQUFBLEFBQUMsUUFBUSxDQUFDLENBQUMsU0FBUyxDO0FBQUEsQ0FBQTtBQUN2QyxBQUFBO0FBQ0EsQUFBQSw4RUFBNkU7QUFDN0UsQUFBQSw4RUFBNkU7QUFDN0UsQUFBQTtBQUNBLEFBQUEsQUFBQSxNQUFNLENBQU8sTUFBTixNQUFNLENBQUMsQ0FBRSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBRSxDQUFBLENBQUE7QUFDMUIsQUFBQTtBQUNBLEFBQUEsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUFNLENBQUMsQztBQUFDLENBQUE7QUFDMUQsQUFBQTtBQUNBLEFBQUEsOEVBQTZFO0FBQzdFLEFBQUE7QUFDQSxBQUFBLEFBQUEsTUFBTSxDQUFNLE1BQUwsS0FBSyxDQUFDLENBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLEVBQUUsQ0FBQSxDQUFBO0FBQ3pCLEFBQUE7QUFDQSxBQUFBLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUMsV0FBVyxDQUFDLEM7QUFBQyxDQUFBO0FBQy9ELEFBQUE7QUFDQSxBQUFBLDhFQUE2RTtBQUM3RSxBQUFBO0FBQ0EsQUFBQSxBQUFBLE1BQU0sQ0FBUSxNQUFQLE9BQU8sQ0FBQyxDQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLENBQUEsQ0FBQTtBQUMzQixBQUFBO0FBQ0EsQUFBQSxDLEksSSxDQUFDLEdBQUcsQyxDLElBQVEsQ0FBQyxDQUFFLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxXQUFXLEMsQ0FBQyxDQUFBLENBQUEsQ0FBM0IsTUFBUixRLEcsSSxDQUFtQztBQUN2QyxBQUFBLEVBQUUsTUFBTSxDQUFDLFFBQVEsQ0FBQyxDQUFDLEM7Q0FBQyxDQUFBO0FBQ3BCLEFBQUEsQ0FBQyxJQUFJLENBQUEsQ0FBQTtBQUNMLEFBQUEsRUFBRSxNQUFNLENBQUMsRTtDQUFFLEM7QUFBQSxDQUFBO0FBQ1gsQUFBQTtBQUNBLEFBQUEsOEVBQTZFO0FBQzdFLEFBQUE7QUFDQSxBQUFBLEFBQUEsTUFBTSxDQUFRLE1BQVAsT0FBTyxDQUFDLENBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQSxDQUFBO0FBQ2hDLEFBQUE7QUFDQSxBQUFBLENBQUMsTUFBTSxDQUFBLEFBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsb0JBQW9CLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQTtBQUN6RCxBQUFBLENBQVMsTUFBUixRQUFRLENBQUMsQ0FBRSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsZ0JBQWdCLENBQUM7QUFDekMsQUFBQSxDQUFDLEdBQUcsQ0FBQSxPQUFPLENBQUMsUUFBUSxDQUFDLENBQUEsQ0FBQSxDQUFBO0FBQ3JCLEFBQUEsRUFBRSxNQUFNLENBQUMsQ0FBQyxFQUFFLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDO0NBQUMsQ0FBQTtBQUMvQixBQUFBLENBQUMsS0FBSyxDQUFBLEFBQUMsQ0FBQyxXQUFXLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQyxDO0FBQUEsQ0FBQTtBQUM1QixBQUFBO0FBQ0EsQUFBQSw4RUFBNkU7QUFDN0UsQUFBQSxvRUFBbUU7QUFDbkUsQUFBQTtBQUNBLEFBQUEsQUFBQSxNQUFNLENBQUMsSUFBQSxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBRSxDQUFBLENBQUE7QUFDdEIsQUFBQTtBQUNBLEFBQUEsQyxJLEksQ0FBQyxHQUFHLEMsQyxJQUFRLENBQUMsQ0FBRSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBRyxDQUFDLEFBQzVCLENBQUMsS0FBSyxJQUFJLEtBQUssRUFBRSxBQUNqQixFQUFFLEFBQ0YsQ0FBQyxLQUFLLElBQUksS0FBSyxFQUFFLEFBQ2pCLEVBQUUsQUFDRixDQUFDLEtBQUssSUFBSSxLQUFLLEVBQUUsQUFDakIsQ0FBQyxDQUFHLEMsQ0FBQyxDQUFBLENBQUEsQ0FOSSxNQUFSLFEsRyxJLENBTUk7QUFDUixBQUFBLEVBQWMsTUFBWixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUUsQ0FBQyxRQUFRO0FBQzFCLEFBQUEsRUFBRSxNQUFNLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDO0NBQUMsQ0FBQTtBQUN2QixBQUFBLENBQUMsSUFBSSxDQUFBLENBQUE7QUFDTCxBQUFBLEVBQUUsTUFBTSxDQUFDLEs7Q0FBSyxDO0FBQUEsQ0FBQTtBQUNkLEFBQUE7QUFDQSxBQUFBLDhFQUE2RTtBQUM3RSxBQUFBO0FBQ0EsQUFBQSxBQUFBLE1BQU0sQ0FBTyxNQUFOLE1BQU0sQ0FBQyxDQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLENBQUEsQ0FBQTtBQUMxQixBQUFBO0FBQ0EsQUFBQSxDQUFDLEVBQUUsQ0FBQyxNQUFNLENBQUEsQUFBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFBLEdBQUcsaUNBQWdDO0FBQ2pFLEFBQUEsQ0FBQyxNO0FBQU0sQ0FBQTtBQUNQLEFBQUE7QUFDQSxBQUFBLDhFQUE2RTtBQUM3RSxBQUFBLHlCQUF3QjtBQUN4QixBQUFBLGlEQUFnRDtBQUNoRCxBQUFBLEVBQUM7QUFDRCxBQUFBLHlCQUF3QjtBQUN4QixBQUFBLHFEQUFvRDtBQUNwRCxBQUFBLDBEQUF5RDtBQUN6RCxBQUFBLDhDQUE2QztBQUM3QyxBQUFBLHNDQUFxQztBQUNyQyxBQUFBLDhCQUE2QjtBQUM3QixBQUFBLHlDQUF3QztBQUN4QyxBQUFBLHlDQUF3QztBQUN4QyxBQUFBLGtFQUFpRTtBQUNqRSxBQUFBO0FBQ0EsQUFBQSxBQUFBLE1BQU0sQ0FBVSxNQUFULFNBQVMsQ0FBQyxDQUFFLENBQXdCLFEsQ0FBdkIsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFJLENBQUEsQ0FBQTtBQUM3QyxBQUFBO0FBQ0EsQUFBQSxDQU9HLE1BUEYsQ0FBQztBQUNGLEFBQUEsRUFBRSxJQUFJLENBQUE7QUFDTixFQUFFLFdBQVcsQ0FBQTtBQUNiLEVBQUUsT0FBTyxDQUFBO0FBQ1QsRUFBRSxjQUFjLENBQUE7QUFDaEIsRUFBRSxZQUFZLENBQUE7QUFDZCxFQUFFLEtBQUs7QUFDUCxFQUFFLENBQUMsQ0FBQyxDQUFFLENBQUMsVUFBVSxDQUFBLEFBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQztBQUM3QixBQUFBLEdBQUcsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUE7QUFDbkIsQUFBQSxHQUFHLFdBQVcsQ0FBQyxDQUFDLEtBQUssQ0FBQTtBQUNyQixBQUFBLEdBQUcsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDZCxBQUFBLEdBQUcsY0FBYyxDQUFDLENBQUMsS0FBSyxDQUFBO0FBQ3hCLEFBQUEsR0FBRyxZQUFZLENBQUMsQ0FBQyxLQUFLLENBQUE7QUFDdEIsQUFBQSxHQUFHLEtBQUssQ0FBQyxDQUFDLEtBQUs7QUFDZixHQUFHLENBQUMsQ0FBQTtBQUNKLEFBQUE7QUFDQSxBQUFBLENBQWEsTUFBWixZQUFZLENBQUMsQ0FBRSxDQUFDLENBQUM7QUFDbEIsQUFBQSxFQUFFLElBQUksQ0FBQTtBQUNOLEFBQUEsRUFBRSxjQUFjLENBQUE7QUFDaEIsQUFBQSxFQUFFLFlBQVksQ0FBQTtBQUNkLEFBQUEsRUFBRSxXQUFXLENBQUMsQ0FBQyxLQUFLLENBQUE7QUFDcEIsQUFBQSxFQUFFLE9BQU8sQ0FBQyxDQUFDLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxTQUFTLENBQVMsR0FBUixDQUFDLE9BQVUsQ0FBQztBQUNyRCxFQUFFLENBQUM7QUFDSCxBQUFBLENBQUMsR0FBRyxDQUFDLENBQUEsTUFBQSxLQUFLLENBQUMsRUFBRSxDQUFDLGNBQWMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxZQUFZLENBQUMsQ0FBQSxDQUFBLENBQUE7QUFDL0MsQUFBQSxFQUFFLEdBQUcsQ0FBQSxLQUFLLENBQUEsQ0FBQSxDQUFBO0FBQ1YsQUFBQSxHQUFHLEtBQUssQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLElBQUksQztFQUFDLENBQUE7QUFDOUIsQUFBQSxFQUFFLElBQUksQ0FBQSxDQUFBO0FBQ04sQUFBQSxHQUFHLDJEQUEwRDtBQUM3RCxBQUFBLEdBQUcsS0FBSyxDQUFDLElBQUksQyxDQUFFLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUM7QUFDbkMsQUFBQSxHQUFHLEtBQUssQ0FBQyxLO0VBQUssQztDQUFBLENBQUE7QUFDZCxBQUFBLENBQUMsTTtBQUFNLENBQUE7QUFDUCxBQUFBO0FBQ0EsQUFBQSw4RUFBNkU7QUFDN0UsQUFBQSxpQkFBZ0I7QUFDaEIsQUFBQSxFQUFDO0FBQ0QsQUFBQSwyQkFBMEI7QUFDMUIsQUFBQSxFQUFDO0FBQ0QsQUFBQSw0Q0FBMkM7QUFDM0MsQUFBQSxFQUFDO0FBQ0QsQUFBQSx1REFBc0Q7QUFDdEQsQUFBQSxtQ0FBa0M7QUFDbEMsQUFBQSx1QkFBc0I7QUFDdEIsQUFBQTtBQUNBLEFBQUEsQUFBQSxNQUFNLENBQVcsTUFBVixVQUFVLENBQUMsQ0FBRSxDLE1BQVEsUSxDQUFQLENBQUMsSUFBSSxDQUFJLENBQUEsQ0FBQTtBQUM5QixBQUFBO0FBQ0EsQUFBQSxDQUFDLE1BQU0sQ0FBQSxBQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsY0FBYyxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxhQUFhLENBQUMsQ0FBQTtBQUM5RCxBQUFBLENBQUUsTUFBRCxDQUFDLENBQUMsQ0FBRSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQztBQUMzQixBQUFBLENBQVMsTUFBUixRQUFRLENBQUMsQ0FBRSxDQUFDLENBQUMsQ0FBQyxRQUFRO0FBQ3ZCLEFBQUEsRUFBRSxDQUFDLFdBQVcsQ0FBQyxHQUFHLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxDQUFDO0FBQ3ZDLEFBQUEsRUFBRSxDQUFDLFdBQVcsQ0FBQyxHQUFHLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQztBQUNwQyxBQUFBO0FBQ0EsQUFBQSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQSxNQUFBLElBQUksQ0FBQyxFQUFFLENBQUMsUUFBUSxDQUFBLENBQUEsQ0FBQTtBQUMzQixBQUFBLEVBQUUsS0FBSyxDQUFDLEk7Q0FBSSxDQUFBO0FBQ1osQUFBQSxDQUFDLE07QUFBTSxDQUFBO0FBQ1AsQUFBQTtBQUNBLEFBQUEsOEVBQTZFO0FBQzdFLEFBQUEsaUJBQWdCO0FBQ2hCLEFBQUEsRUFBQztBQUNELEFBQUEsMkJBQTBCO0FBQzFCLEFBQUEsRUFBQztBQUNELEFBQUEsNENBQTJDO0FBQzNDLEFBQUEsRUFBQztBQUNELEFBQUEsNkNBQTRDO0FBQzVDLEFBQUEsNERBQTJEO0FBQzNELEFBQUEsb0JBQW1CO0FBQ25CLEFBQUEsdUJBQXNCO0FBQ3RCLEFBQUE7QUFDQSxBQUFBLEFBQUEsTUFBTSxDQUFXLE1BQVYsVUFBVSxDQUFDLENBQUUsQyxNQUFRLFEsQ0FBUCxDQUFDLElBQUksQ0FBSSxDQUFBLENBQUE7QUFDOUIsQUFBQTtBQUNBLEFBQUEsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFBLEFBQUMsQ0FBQyxVQUFVLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQTtBQUNoQyxBQUFBLENBQVEsTUFBUCxPQUFPLENBQUMsQ0FBRSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDO0FBQzlCLEFBQUEsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUEsTUFBQSxLQUFLLENBQUMsRUFBRSxDQUFDLE9BQU8sQ0FBQSxDQUFBLENBQUE7QUFDM0IsQUFBQSxFQUFFLE9BQU8sQ0FBQyxHQUFHLENBQUEsQUFBQyxDQUFDLGVBQWUsRUFBRSxFQUFFLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQzNDLEFBQUEsRUFBRSxLQUFLLENBQUMsSztDQUFLLENBQUE7QUFDYixBQUFBLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxDO0FBQUMsQ0FBQTtBQUNoQixBQUFBO0FBQ0EsQUFBQSw4RUFBNkU7QUFDN0UsQUFBQSxxQkFBb0I7QUFDcEIsQUFBQSxpQ0FBZ0M7QUFDaEMsQUFBQTtBQUNBLEFBQUEsQUFBQSxNQUFNLENBQWMsTUFBYixhQUFhLENBQUMsQ0FBRSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBRSxDQUFBLENBQUE7QUFDakMsQUFBQTtBQUNBLEFBQUEsQ0FBTSxNQUFMLEtBQUssQ0FBQyxDQUFFLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUM7QUFDcEMsQUFBQSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQSxDQUFBO0FBQzVCLEFBQUEsRUFBRSxNQUFNLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLENBQUMsQztDQUFDLENBQUE7QUFDM0QsQUFBQSxDQUFDLElBQUksQ0FBQSxDQUFBO0FBQ0wsQUFBQSxFQUFFLE1BQU0sQ0FBQyxLO0NBQUssQztBQUFBLENBQUE7QUFDZCxBQUFBO0FBQ0EsQUFBQSw4RUFBNkU7QUFDN0UsQUFBQTtBQUNBLEFBQUEsQUFBQSxNQUFNLENBQU8sTUFBTixNQUFNLENBQUMsQ0FBRSxDQUFDLENBQU8sR0FBTixNQUFTLENBQUMsQ0FBQyxFQUFFLENBQUEsQ0FBQTtBQUMvQixBQUFBO0FBQ0EsQUFBQSxDQUFLLE1BQUosSUFBSSxDQUFDLENBQUUsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFPLEdBQU4sTUFBUyxDQUFDO0FBQ25DLEFBQUEsQ0FBQyxNQUFNLENBQUMsYUFBYSxDQUFDLElBQUksQztBQUFDLENBQUE7QUFDM0IsQUFBQTtBQUNBLEFBQUEsOEVBQTZFO0FBQzdFLEFBQUE7QUFDQSxBQUFBLEFBQUEsTUFBTSxDQUFRLE1BQVAsT0FBTyxDQUFDLENBQUUsQ0FBQyxDQUFPLEdBQU4sTUFBUyxDQUFDLENBQUMsRUFBRSxDQUFBLENBQUE7QUFDaEMsQUFBQTtBQUNBLEFBQUEsQ0FBQyxNQUFNLENBQUEsQUFBQyxnQkFBZ0IsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsWUFBWSxFQUFFLEVBQUUsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDN0QsQUFBQSxDQUFTLE1BQVIsUUFBUSxDQUFDLENBQUUsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFBLEFBQU8sR0FBTixNQUFTLENBQUE7QUFDdEMsQUFBQSxDQUFDLE1BQU0sQ0FBQyxhQUFhLENBQUEsQUFBQyxPQUFPLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDO0FBQUEsQ0FBQTtBQUNwRCxBQUFBO0FBQ0EsQUFBQSw4RUFBNkU7QUFDN0UsQUFBQTtBQUNBLEFBQUEsQUFBQSxNQUFNLENBQVUsTUFBVCxTQUFTLENBQUMsQ0FBRSxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFBLENBQUE7QUFDOUMsQUFBQSxDQUFDLDZEQUE0RDtBQUM3RCxBQUFBLENBQUMsNENBQTJDO0FBQzVDLEFBQUE7QUFDQSxBQUFBLENBQUMsTUFBTSxDQUFBLEFBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxzQkFBc0IsRUFBRSxFQUFFLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQ25FLEFBQUEsQ0FBUSxNQUFQLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBRSxDQUFDLFVBQVUsQ0FBQSxBQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUM7QUFDbEMsQUFBQSxFQUFFLEtBQUssQ0FBQyxDQUFDLEtBQUs7QUFDZCxFQUFFLENBQUMsQ0FBQTtBQUNILEFBQUE7QUFDQSxBQUFBLENBQUMsbUNBQWtDO0FBQ25DLEFBQUEsQ0FBSyxNQUFKLElBQUksQ0FBQyxDQUFFLENBQUMsTUFBTSxDQUFDO0FBQ2hCLEFBQUEsRUFBRSxPQUFPLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxhQUFhLENBQUMsQ0FBQztBQUN4QyxBQUFBLEdBQUcsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxhQUFhLENBQUMsUUFBUSxDQUFDO0FBQ25DLEFBQUEsR0FBRyxDQUFDLENBQUMsUUFBUTtBQUNiLEdBQUcsQ0FBQztBQUNKLEFBQUEsQ0FBQyxNQUFNLENBQUEsQUFBQyxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsVUFBVSxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDdkQsQUFBQSxDQUFLLE1BQUosSUFBSSxDQUFDLENBQUUsQ0FBQyxRQUFRLENBQUEsQUFBQyxJQUFJLENBQUE7QUFDdEIsQUFBQTtBQUNBLEFBQUEsQ0FBNEIsTUFBM0IsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFFLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUM7QUFDbkQsQUFBQTtBQUNBLEFBQUEsQ0FBTyxNQUFOLE1BQU0sQ0FBQyxDQUFFLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUM7QUFDOUIsQUFBQSxDLEksSSxDQUF5QixNQUFNLENBQUEsQUFBQyxNQUFNLENBQUMsTUFBTSxDQUFBLENBQUEsQ0FBQTtBQUM3QyxBQUFBLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQSxDQUFBLENBQUE7QUFDUixBQUFBLEcsSSxHQUFHLEtBQUssQ0FBQSxBQUFDLGNBQWMsQ0FBQSxPO0VBQUEsQ0FBQTtBQUN2QixBQUFBLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQSxDQUFBLENBQUE7QUFDUixBQUFBLEcsSSxHQUFHLENBQUMsUUFBUSxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsS0FBSyxDQUFDLE87RUFBQSxDQUFBO0FBQzNCLEFBQUEsRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFBLENBQUEsQ0FBQTtBQUNSLEFBQUEsRyxJLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE87RUFBQSxDQUFBO0FBQ3RDLEFBQUEsRUFBRSxPQUFJLENBQUEsQ0FBQSxDQUFBO0FBQ04sQUFBQSxHLEksR0FBRyxDQUFDO0FBQ0osQUFBQSxJQUFJLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7QUFDbEMsQUFBQSxJQUFJLE1BQU0sQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNsQixBQUFBLElBQUksQ0FBQyxDQUFDLEVBQUUsTUFBTSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDdkIsQUFBQSxJQUFJLEM7RUFBQyxDO0NBQUEsQyxDQVpnQixNQUFwQixDQUFDLElBQUksQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEMsSUFZakI7QUFDTCxBQUFBO0FBQ0EsQUFBQSxDQUFDLCtEQUE4RDtBQUMvRCxBQUFBLENBQVEsTUFBUCxPQUFPLENBQUMsQ0FBRSxDQUFDLE9BQU8sQ0FBQSxBQUFDLElBQUksQ0FBQTtBQUN4QixBQUFBLENBQWEsTUFBWixZQUFZLENBQUMsQ0FBRSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsc0JBQXNCLENBQUM7QUFDdEQsQUFBQSxDQUFPLE1BQU4sTUFBTSxDQUFDLENBQUUsQ0FBQyxPQUFPLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRztBQUN4RCxBQUFBO0FBQ0EsQUFBQSxDQUFNLE1BQUwsS0FBSyxDQUFDLENBQUUsQ0FBQyxDQUFDO0FBQ1gsQUFBQSxFQUFFLElBQUksQ0FBQTtBQUNOLEFBQUEsRUFBRSxJQUFJLENBQUE7QUFDTixBQUFBLEVBQUUsSUFBSSxDQUFBO0FBQ04sQUFBQSxFQUFFLEdBQUcsQ0FBQTtBQUNMLEFBQUEsRUFBRSxRQUFRLENBQUE7QUFDVixBQUFBLEVBQUUsSUFBSSxDQUFBO0FBQ04sQUFBQSxFQUFFLE9BQU8sQ0FBQTtBQUNULEFBQUEsRUFBRSxHQUFHLENBQUE7QUFDTCxBQUFBLEVBQUUsT0FBTyxDQUFBO0FBQ1QsQUFBQSxFQUFFLE1BQU07QUFDUixFQUFFLENBQUM7QUFDSCxBQUFBLENBQUMsR0FBRyxDQUFBLEtBQUssQ0FBQyxFQUFFLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFBLENBQUEsQ0FBQTtBQUN6QixBQUFBLEVBQUUsTUFBTSxDQUFDLE1BQU0sQ0FBQSxBQUFDLEtBQUssQ0FBQyxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsQztDQUFBLENBQUE7QUFDekMsQUFBQSxDQUFDLE1BQU0sQ0FBQyxLO0FBQUssQ0FBQTtBQUNiLEFBQUE7QUFDQSxBQUFBLDhFQUE2RTtBQUM3RSxBQUFBLHNCQUFxQjtBQUNyQixBQUFBLHFDQUFvQztBQUNwQyxBQUFBLHFDQUFvQztBQUNwQyxBQUFBLGdDQUErQjtBQUMvQixBQUFBLDBEQUF5RDtBQUN6RCxBQUFBO0FBQ0EsQUFBQSxBQUFBLE1BQU0sQ0FBUyxNQUFSLFFBQVEsQ0FBQyxDQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLENBQUEsQ0FBQTtBQUM1QixBQUFBO0FBQ0EsQUFBQSxDQUFDLE1BQU0sQ0FBQSxBQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsY0FBYyxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDbkQsQUFBQSxDQUFDLEdBQUcsQ0FBQSxFQUFFLENBQUMsVUFBVSxDQUFBLEFBQUMsSUFBSSxDQUFBLENBQUEsQ0FBQSxDQUFBO0FBQ3RCLEFBQUEsRUFBRSxHQUFHLENBQUEsTUFBTSxDQUFBLEFBQUMsSUFBSSxDQUFBLENBQUEsQ0FBQSxDQUFBO0FBQ2hCLEFBQUEsR0FBRyxNQUFNLENBQUMsTTtFQUFNLENBQUE7QUFDaEIsQUFBQSxFQUFFLElBQUksQ0FBQyxHQUFHLENBQUEsS0FBSyxDQUFBLEFBQUMsSUFBSSxDQUFBLENBQUEsQ0FBQSxDQUFBO0FBQ3BCLEFBQUEsR0FBRyxNQUFNLENBQUMsSztFQUFLLENBQUE7QUFDZixBQUFBLEVBQUUsSUFBSSxDQUFBLENBQUE7QUFDTixBQUFBLEdBQUcsTUFBTSxDQUFDLFM7RUFBUyxDO0NBQUEsQ0FBQTtBQUNuQixBQUFBLENBQUMsSUFBSSxDQUFBLENBQUE7QUFDTCxBQUFBLEVBQUUsTUFBTSxDQUFDLFM7Q0FBUyxDO0FBQUEsQ0FBQTtBQUNsQixBQUFBO0FBQ0EsQUFBQSw4RUFBNkU7QUFDN0UsQUFBQTtBQUNBLEFBQUEsQUFBQSxNQUFNLENBQWEsTUFBWixZQUFZLENBQUMsQ0FBRSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBRSxDQUFBLENBQUE7QUFDaEMsQUFBQTtBQUNBLEFBQUEsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLFNBQVMsQ0FBQyxJQUFJLEM7QUFBQyxDQUFBO0FBQzFCLEFBQUE7QUFDQSxBQUFBLDhFQUE2RTtBQUM3RSxBQUFBLDhFQUE2RTtBQUM3RSxBQUFBO0FBQ0EsQUFBQSxBQUFBLE1BQU0sQ0FBb0IsTUFBbkIsbUJBQW1CLENBQUMsQ0FBRSxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsRUFBRSxDQUFBLENBQUE7QUFDcEQsQUFBQTtBQUNBLEFBQUEsQ0FBQyxNQUFNLENBQUEsQUFBQyxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLGNBQWMsRUFBRSxFQUFFLENBQUMsT0FBTyxDQUFDLENBQUMsc0JBQXNCLENBQUMsQ0FBQTtBQUM3RSxBQUFBLENBQUMsR0FBRyxDQUFBLENBQUksRUFBRSxDQUFDLFVBQVUsQ0FBQyxRQUFRLENBQUMsQ0FBQSxDQUFBLENBQUE7QUFDL0IsQUFBQSxFQUFFLE1BQU0sQ0FBQyxLO0NBQUssQ0FBQTtBQUNkLEFBQUEsQ0FBVyxNQUFWLFVBQVUsQ0FBQyxDQUFFLENBQUMsRUFBRSxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsQ0FBQyxPQUFPO0FBQzNDLEFBQUEsQ0FBWSxNQUFYLFdBQVcsQ0FBQyxDQUFFLENBQUMsRUFBRSxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsQ0FBQyxPQUFPO0FBQzdDLEFBQUEsQ0FBQyxNQUFNLENBQUMsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLFVBQVUsQztBQUFDLENBQUE7QUFDbEMsQUFBQTtBQUNBLEFBQUEsOEVBQTZFO0FBQzdFLEFBQUE7QUFDQSxBQUFBLEFBQUEsTUFBTSxDQUFDLElBQUEsV0FBVyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLEVBQUUsQ0FBQSxDQUFBO0FBQzlCLEFBQUE7QUFDQSxBQUFBLENBQVksTUFBWCxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUUsQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQztBQUNuQyxBQUFBLENBQUMsTUFBTSxDQUFDLENBQUM7QUFDVCxBQUFBLEVBQUUsSUFBSSxDQUFBO0FBQ04sQUFBQSxFQUFFLE1BQU0sQ0FBQyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUM7QUFDaEQsRUFBRSxDO0FBQUMsQ0FBQTtBQUNILEFBQUE7QUFDQSxBQUFBLDhFQUE2RTtBQUM3RSxBQUFBO0FBQ0EsQUFBQSxBQUFBLE1BQU0sQ0FBQyxJQUFBLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxFQUFFLENBQUEsQ0FBQTtBQUM5QixBQUFBO0FBQ0EsQUFBQSxDQUFDLEdBQUcsQ0FBQSxDQUFBO0FBQ0osQUFBQSxFQUFHLE1BQUQsQ0FBQyxDQUFDLENBQUUsQ0FBQyxDQUFDLGFBQWEsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLElBQUksQ0FBQztBQUM3QyxBQUFBLEVBQUUsR0FBRyxDQUFDLENBQUEsTUFBQSxHQUFHLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxXQUFXLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUEsQ0FBQSxDQUFBO0FBQ3ZDLEFBQUEsR0FBRyxNQUFNLEMsQ0FBRSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQztBQUN0QyxBQUFBLEdBQUcsR0FBRyxDQUFBLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFBLENBQUEsQ0FBQTtBQUNsQixBQUFBLElBQUksRUFBRSxDQUFDLE1BQU0sQ0FBQSxBQUFDLE1BQU0sQztHQUFBLENBQUE7QUFDcEIsQUFBQSxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUEsR0FBRyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUEsQ0FBQSxDQUFBO0FBQzVCLEFBQUEsSUFBSSxRQUFRLENBQUEsQUFBQyxNQUFNLEM7R0FBQSxDO0VBQUEsQztDQUFBLENBQUE7QUFDbkIsQUFBQSxDQUFDLEtBQUssQ0FBQyxDQUFBLEdBQUcsQ0FBQSxDQUFBLENBQUEsQ0FBQTtBQUNWLEFBQUEsQ0FBQyxNO0FBQU0sQ0FBQTtBQUNQLEFBQUE7QUFDQSxBQUFBLDhFQUE2RTtBQUM3RSxBQUFBO0FBQ0EsQUFBQSxBQUFBLE1BQU0sQ0FBQyxJQUFBLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUEsQ0FBQTtBQUN4QyxBQUFBO0FBQ0EsQUFBQSxDQUFRLE1BQVAsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFFLENBQUMsVUFBVSxDQUFBLEFBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQztBQUNsQyxBQUFBLEVBQUUsS0FBSyxDQUFDLENBQUMsS0FBSztBQUNkLEVBQUUsQ0FBQyxDQUFBO0FBQ0gsQUFBQTtBQUNBLEFBQUEsQ0FBQyxHQUFHLENBQUEsQ0FBQTtBQUNKLEFBQUEsRUFBRSxFQUFFLENBQUMsU0FBUyxDQUFBLEFBQUMsT0FBTyxDQUFBO0FBQ3RCLEFBQUEsRUFBRSxNQUFNLENBQUMsSTtDQUFJLENBQUE7QUFDYixBQUFBLENBQUMsS0FBSyxDQUFDLENBQUEsR0FBRyxDQUFBLENBQUEsQ0FBQTtBQUNWLEFBQUEsRUFBRSxHQUFHLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxHQUFFLENBQUMsUUFBUSxDQUFDLENBQUEsQ0FBQTtBQUMzQixBQUFBLEdBQUcsR0FBRyxDQUFBLEtBQUssQ0FBQSxDQUFBLENBQUE7QUFDWCxBQUFBLElBQUksUUFBUSxDQUFBLEFBQUMsT0FBTyxDO0dBQUEsQ0FBQTtBQUNwQixBQUFBLEdBQUcsTUFBTSxDQUFDLEs7RUFBSyxDQUFBO0FBQ2YsQUFBQSxFQUFFLElBQUksQ0FBQSxDQUFBO0FBQ04sQUFBQSxHQUFHLEtBQUssQ0FBQyxHO0VBQUcsQztDQUFBLEM7QUFBQSxDQUFBO0FBQ1osQUFBQTtBQUNBLEFBQUEsOEVBQTZFO0FBQzdFLEFBQUE7QUFDQSxBQUFBLEFBQUEsTUFBTSxDQUFDLElBQUEsYUFBYSxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLEVBQUUsQ0FBQSxDQUFBO0FBQ3BDLEFBQUE7QUFDQSxBQUFBLENBQWUsTUFBZCxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUUsQ0FBQyxXQUFXLENBQUMsUUFBUSxDQUFDO0FBQ3hDLEFBQUEsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxJQUFJO0FBQ2YsQUFBQSxDQUFDLEdBQUcsQ0FBQyxDQUFBLE1BQUEsSUFBSSxDQUFDLEVBQUUsQ0FBQyxNQUFNLENBQUEsQ0FBQSxDQUFBO0FBQ25CLEFBQUEsRUFBRSxHQUFHLEMsRUFBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFDO0FBQ25CLEFBQUEsRUFBRSxHQUFHLENBQUEsQ0FBSSxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUEsQ0FBQSxDQUFBO0FBQ25CLEFBQUEsR0FBRyxLQUFLLENBQUMsR0FBRyxDO0VBQUMsQztDQUFBLENBQUE7QUFDYixBQUFBLENBQUMsTTtBQUFNLENBQUE7QUFDUCxBQUFBO0FBQ0EsQUFBQSw4RUFBNkU7QUFDN0UsQUFBQSxzQ0FBcUM7QUFDckMsQUFBQTtBQUNBLEFBQUEsQUFBQSxNQUFNLENBQU0sTUFBTCxLQUFLLENBQUMsQ0FBRSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBRSxDQUFBLENBQUE7QUFDekIsQUFBQTtBQUNBLEFBQUEsQ0FBQyxNQUFNLENBQUEsQUFBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLGNBQWMsRUFBRSxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUE7QUFDckQsQUFBQSxDQUFDLE1BQU0sQ0FBQyxZQUFZLENBQUEsQUFBQyxFQUFFLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDO0FBQUEsQ0FBQTtBQUNsRCxBQUFBO0FBQ0EsQUFBQSw4RUFBNkU7QUFDN0UsQUFBQSxvQ0FBbUM7QUFDbkMsQUFBQSw0REFBMkQ7QUFDM0QsQUFBQTtBQUNBLEFBQUEsQUFBQSxNQUFNLENBQUssTUFBSixJQUFJLENBQUMsQ0FBRSxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBRSxDQUFBLENBQUE7QUFDbEMsQUFBQTtBQUNBLEFBQUEsQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDO0FBQ3BCLEFBQUEsQ0FBQyxFQUFFLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxDQUFDLFlBQVksQ0FBQyxRQUFRLENBQUMsQ0FBQztBQUMvQyxBQUFBLENBQUMsTTtBQUFNLENBQUE7QUFDUCxBQUFBO0FBQ0EsQUFBQSw4RUFBNkU7QUFDN0UsQUFBQSw4RUFBNkU7QUFDN0UsQUFBQTtBQUNBLEFBQUEsQUFBQSxNQUFNLENBQU0sTUFBTCxLQUFLLENBQUMsQ0FBRSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBRSxDQUFBLENBQUE7QUFDekIsQUFBQTtBQUNBLEFBQUEsQ0FBQyxHQUFHLENBQUEsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFBLENBQUEsQ0FBQTtBQUNqQixBQUFBLEVBQUUsR0FBRyxDQUFBLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQSxDQUFBLENBQUE7QUFDbkIsQUFBQSxHQUFHLE1BQU0sQ0FBQyxhQUFhLENBQUMsSUFBSSxDO0VBQUMsQ0FBQTtBQUM3QixBQUFBLEVBQUUsSUFBSSxDQUFDLEdBQUcsQ0FBQSxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUEsQ0FBQSxDQUFBO0FBQ3ZCLEFBQUEsR0FBRyxNQUFNLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLEM7RUFBQyxDQUFBO0FBQ3RDLEFBQUEsRUFBRSxJQUFJLENBQUEsQ0FBQTtBQUNOLEFBQUEsR0FBRyxNQUFNLENBQUMsYUFBYSxDQUFDLFdBQVcsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEM7RUFBQyxDO0NBQUEsQ0FBQTtBQUNqRCxBQUFBLENBQUMsSUFBSSxDQUFBLENBQUE7QUFDTCxBQUFBLEVBQUUsTUFBTSxDQUFDLEU7Q0FBRSxDO0FBQUEsQ0FBQTtBQUNYLEFBQUE7QUFDQSxBQUFBLDhFQUE2RTtBQUM3RSxBQUFBO0FBQ0EsQUFBQSxBQUFBLE1BQU0sQ0FBVyxNQUFWLFVBQVUsQ0FBQyxDQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUEsQ0FBQTtBQUN4QyxBQUFBO0FBQ0EsQUFBQSxDQUFDLE1BQU0sQ0FBQSxBQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsc0JBQXNCLEVBQUUsRUFBRSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUNqRSxBQUFBLENBQUMsTUFBTSxDQUFBLEFBQUMsZ0JBQWdCLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLHlCQUF5QixFQUFFLEVBQUUsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDeEUsQUFBQSxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsT0FBTyxDQUFDLENBQUMsRUFBRSxLQUFLLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEM7QUFBQyxDQUFBO0FBQ3ZDLEFBQUE7QUFDQSxBQUFBLDhFQUE2RTtBQUM3RSxBQUFBLFFBQU87QUFDUCxBQUFBO0FBQ0EsQUFBQSxBQUFBLE1BQU0sQ0FBUSxNQUFQLE9BQU8sQ0FBQyxDQUFFLEMsTUFBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQSxDQUFBO0FBQ3hDLEFBQUE7QUFDQSxBQUFBLENBQVEsTUFBUCxPQUFPLENBQUMsQ0FBRSxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUMsQ0FBQyxLQUFLLENBQUM7QUFDdEMsQUFBQSxDQUFDLEdBQUcsQ0FBQSxBQUFDLENBQUMsTUFBTSxFQUFFLEVBQUUsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUE7QUFDbkMsQUFBQSxDQUFPLE1BQU4sTUFBTSxDQUFDLENBQUUsQ0FBQyxXQUFXLENBQUMsQ0FBQztBQUN4QixBQUFBO0FBQ0EsQUFBQSxDQUFJLE1BQUgsR0FBRyxDQUFDLENBQUUsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQSxBQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7QUFDbkMsQUFBQSxFQUFFLElBQUksQ0FBQyxDQUFDLEtBQUssQ0FBQztBQUNkLEFBQUEsRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDLGNBQWMsQ0FBQyxDQUFDLE1BQU0sQ0FBQztBQUMvQixFQUFFLENBQUMsQ0FBQTtBQUNILEFBQUEsQ0FBd0MsTUFBdkMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFFLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQztBQUM5RCxBQUFBLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxHQUFFLENBQUMsQ0FBQyxDQUFDLENBQUEsQ0FBQTtBQUNmLEFBQUEsRUFBRSxHQUFHLENBQUEsQUFBQyxDQUFDLGNBQWMsRUFBRSxPQUFPLENBQUMsT0FBTyxFQUFFLElBQUksQ0FBQyxDQUFDLEM7Q0FBQSxDQUFBO0FBQzlDLEFBQUE7QUFDQSxBQUFBLENBQVEsTUFBUCxPQUFPLENBQUMsQ0FBRSxDQUFDLENBQUM7QUFDYixBQUFBLEVBQUUsT0FBTyxDQUFBO0FBQ1QsQUFBQSxFQUFFLE9BQU8sQ0FBQTtBQUNULEFBQUEsRUFBRSxNQUFNLENBQUE7QUFDUixBQUFBLEVBQUUsSUFBSTtBQUNOLEVBQUUsQ0FBQztBQUNILEFBQUE7QUFDQSxBQUFBLENBQUMsR0FBRyxDQUFBLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQSxDQUFBLENBQUE7QUFDbkIsQUFBQSxFQUFXLE1BQVQsU0FBUyxDQUFDLENBQUUsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDO0FBQzVCLEFBQUEsRUFBRSxHQUFHLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUEsQ0FBQTtBQUMzQixBQUFBLEdBQUcsR0FBRyxDQUFBLEFBQUMsVUFBVSxDQUFDLENBQUMsU0FBUyxDQUFBO0FBQzVCLEFBQUEsR0FBRyxPQUFPLENBQUMsTUFBTSxDLENBQUUsQ0FBQyxTO0VBQVMsQztDQUFBLENBQUE7QUFDN0IsQUFBQTtBQUNBLEFBQUEsQ0FBQyxHQUFHLENBQUEsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFBLENBQUEsQ0FBQTtBQUNuQixBQUFBLEVBQVcsTUFBVCxTQUFTLENBQUMsQ0FBRSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUM7QUFDNUIsQUFBQSxFQUFFLEdBQUcsQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQSxDQUFBO0FBQzNCLEFBQUEsR0FBRyxHQUFHLENBQUEsQUFBQyxVQUFVLENBQUMsQ0FBQyxTQUFTLENBQUE7QUFDNUIsQUFBQSxHQUFHLE9BQU8sQ0FBQyxNQUFNLEMsQ0FBRSxDQUFDLFM7RUFBUyxDO0NBQUEsQ0FBQTtBQUM3QixBQUFBO0FBQ0EsQUFBQSxDQUFDLEdBQUcsQ0FBQSxBQUFDLE1BQU0sQ0FBQTtBQUNYLEFBQUEsQ0FBQyxNQUFNLENBQUMsTztBQUFPLENBQUE7QUFDZixBQUFBO0FBQ0EsQUFBQSw4RUFBNkU7QUFDN0UsQUFBQTtBQUNBLEFBQUEsQUFBQSxNQUFNLENBQVksTUFBWCxXQUFXLENBQUMsQ0FBRSxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFBLENBQUE7QUFDNUMsQUFBQTtBQUNBLEFBQUEsQ0FBUSxNQUFQLE9BQU8sQ0FBQyxDQUFFLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxDQUFDLEtBQUssQ0FBQztBQUN0QyxBQUFBLENBQUMsR0FBRyxDQUFBLEFBQUMsQ0FBQyxXQUFXLEVBQUUsRUFBRSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQTtBQUN4QyxBQUFBLENBQU8sTUFBTixNQUFNLENBQUMsQ0FBRSxDQUFDLFdBQVcsQ0FBQyxDQUFDO0FBQ3hCLEFBQUE7QUFDQSxBQUFBLENBQUksTUFBSCxHQUFHLENBQUMsQ0FBRSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFBLEFBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztBQUNuQyxBQUFBLEVBQUUsSUFBSSxDQUFDLENBQUMsS0FBSyxDQUFDO0FBQ2QsQUFBQSxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUMsY0FBYyxDQUFDLENBQUMsTUFBTSxDQUFDO0FBQy9CLEVBQUUsQ0FBQyxDQUFBO0FBQ0gsQUFBQSxDQUF3QyxNQUF2QyxDQUFDLE9BQU8sQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUUsQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLENBQUM7QUFDNUQsQUFBQSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsR0FBRSxDQUFDLENBQUMsQ0FBQyxDQUFBLENBQUE7QUFDZixBQUFBLEVBQUUsR0FBRyxDQUFBLEFBQUMsQ0FBQyxjQUFjLEVBQUUsT0FBTyxDQUFDLE9BQU8sRUFBRSxJQUFJLENBQUMsQ0FBQyxDO0NBQUEsQ0FBQTtBQUM5QyxBQUFBO0FBQ0EsQUFBQSxDQUFRLE1BQVAsT0FBTyxDQUFDLENBQUUsQ0FBQyxDQUFDO0FBQ2IsQUFBQSxFQUFFLE9BQU8sQ0FBQTtBQUNULEFBQUEsRUFBRSxPQUFPLENBQUE7QUFDVCxBQUFBLEVBQUUsTUFBTSxDQUFBO0FBQ1IsQUFBQSxFQUFFLElBQUk7QUFDTixFQUFFLENBQUM7QUFDSCxBQUFBO0FBQ0EsQUFBQSxDQUFDLEdBQUcsQ0FBQSxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUEsQ0FBQSxDQUFBO0FBQ25CLEFBQUEsRUFBVyxNQUFULFNBQVMsQ0FBQyxDQUFFLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQztBQUM1QixBQUFBLEVBQUUsR0FBRyxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFBLENBQUE7QUFDM0IsQUFBQSxHQUFHLEdBQUcsQ0FBQSxBQUFDLFVBQVUsQ0FBQyxDQUFDLFNBQVMsQ0FBQTtBQUM1QixBQUFBLEdBQUcsT0FBTyxDQUFDLE1BQU0sQyxDQUFFLENBQUMsUztFQUFTLEM7Q0FBQSxDQUFBO0FBQzdCLEFBQUE7QUFDQSxBQUFBLENBQUMsR0FBRyxDQUFBLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQSxDQUFBLENBQUE7QUFDbkIsQUFBQSxFQUFXLE1BQVQsU0FBUyxDQUFDLENBQUUsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDO0FBQzVCLEFBQUEsRUFBRSxHQUFHLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUEsQ0FBQTtBQUMzQixBQUFBLEdBQUcsR0FBRyxDQUFBLEFBQUMsVUFBVSxDQUFDLENBQUMsU0FBUyxDQUFBO0FBQzVCLEFBQUEsR0FBRyxPQUFPLENBQUMsTUFBTSxDLENBQUUsQ0FBQyxTO0VBQVMsQztDQUFBLENBQUE7QUFDN0IsQUFBQTtBQUNBLEFBQUEsQ0FBQyxHQUFHLENBQUEsQUFBQyxNQUFNLENBQUE7QUFDWCxBQUFBLENBQUMsTUFBTSxDQUFDLE87QUFBTyxDQUFBO0FBQ2YsQUFBQTtBQUNBLEFBQUEsOEVBQTZFO0FBQzdFLEFBQUEsa0RBQWlEO0FBQ2pELEFBQUE7QUFDQSxBQUFBLEFBQUEsTUFBTSxDQUFZLE1BQVgsV0FBVyxDQUFDLENBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLEVBQUUsQ0FBQSxDQUFBO0FBQzFDLEFBQUE7QUFDQSxBQUFBLENBQUMsTUFBTSxDQUFBLEFBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxjQUFjLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLGNBQWMsQ0FBQyxDQUFBO0FBQy9ELEFBQUEsQ0FBQyxNQUFNLENBQUEsQUFBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFFLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLGtCQUFrQixFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDcEUsQUFBQSxDQUFDLFdBQVcsQ0FBQSxBQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUE7QUFDcEMsQUFBQSxDQUFDLE1BQU0sQ0FBQSxBQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsa0JBQWtCLEVBQUUsRUFBRSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUMvRCxBQUFBLENBQUMsTTtBQUFNLENBQUE7QUFDUCxBQUFBO0FBQ0EsQUFBQSw4RUFBNkU7QUFDN0UsQUFBQTtBQUNBLEFBQUEsQUFBQSxNQUFNLENBQVMsTUFBUixRQUFRLENBQUMsQ0FBRSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFBLENBQUE7QUFDcEMsQUFBQTtBQUNBLEFBQUEsQ0FBQyxNQUFNLENBQUEsQUFBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLGNBQWMsRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsV0FBVyxDQUFDLENBQUE7QUFDNUQsQUFBQSxDQUFDLE1BQU0sQ0FBQSxBQUFDLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUUsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsa0JBQWtCLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUNwRSxBQUFBO0FBQ0EsQUFBQSxDQUFDLFdBQVcsQ0FBQSxBQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7QUFDdkIsQUFBQSxFQUFFLE1BQU0sQ0FBQztBQUNULEFBQUEsRUFBRSxJQUFJLENBQUM7QUFDUCxBQUFBLEVBQUUsTUFBTSxDQUFDO0FBQ1QsQUFBQSxFQUFFLGNBQWMsQ0FBQztBQUNqQixBQUFBLEVBQUUsSUFBSSxDQUFDO0FBQ1AsQUFBQSxFQUFFLElBQUk7QUFDTixBQUFBLEVBQUUsQ0FBQyxDQUFBO0FBQ0gsQUFBQTtBQUNBLEFBQUEsQ0FBQyxNQUFNLENBQUEsQUFBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLGtCQUFrQixFQUFFLEVBQUUsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDekQsQUFBQSxDQUFDLE07QUFBTSxDQUFBO0FBQ1AsQUFBQTtBQUNBLEFBQUEsOEVBQTZFO0FBQzdFLEFBQUE7QUFDQSxBQUFBLEFBQUEsTUFBTSxDQUFVLE1BQVQsU0FBUyxDQUFDLENBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQSxDQUFBO0FBQ3JDLEFBQUE7QUFDQSxBQUFBLENBQUMsTUFBTSxDQUFBLEFBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxjQUFjLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLFlBQVksQ0FBQyxDQUFBO0FBQzdELEFBQUEsQ0FBQyxNQUFNLENBQUEsQUFBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFFLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLHlCQUF5QixFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDNUUsQUFBQSxDQUFDLFdBQVcsQ0FBQSxBQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUM7QUFDeEIsQUFBQSxFQUFFLElBQUksQ0FBQztBQUNQLEFBQUEsRUFBRSxNQUFNLENBQUM7QUFDVCxBQUFBLEVBQUUsY0FBYyxDQUFDO0FBQ2pCLEFBQUEsRUFBRSxJQUFJLENBQUM7QUFDUCxBQUFBLEVBQUUsSUFBSTtBQUNOLEFBQUEsRUFBRSxDQUFDLENBQUE7QUFDSCxBQUFBLENBQUMsTUFBTSxDQUFBLEFBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxrQkFBa0IsRUFBRSxFQUFFLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQ3pELEFBQUEsQ0FBQyxNO0FBQU0sQ0FBQTtBQUNQLEFBQUE7QUFDQSxBQUFBLDhFQUE2RTtBQUM3RSxBQUFBO0FBQ0EsQUFBQSxBQUFBLE1BQU0sQ0FBTSxNQUFMLEtBQUssQ0FBQyxDQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLENBQUEsQ0FBQTtBQUNqQyxBQUFBO0FBQ0EsQUFBQSxDQUFDLE1BQU0sQ0FBQSxBQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsY0FBYyxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQTtBQUN6RCxBQUFBLENBQUMsTUFBTSxDQUFBLEFBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxlQUFlLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUM5RCxBQUFBLENBQUMsV0FBVyxDQUFBLEFBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztBQUN2QixBQUFBLEVBQUUsTUFBTSxDQUFDO0FBQ1QsQUFBQSxFQUFFLElBQUksQ0FBQztBQUNQLEFBQUEsRUFBRSxNQUFNLENBQUM7QUFDVCxBQUFBLEVBQUUsY0FBYyxDQUFDO0FBQ2pCLEFBQUEsRUFBRSxJQUFJLENBQUM7QUFDUCxBQUFBLEVBQUUsSUFBSTtBQUNOLEFBQUEsRUFBRSxDQUFDLENBQUE7QUFDSCxBQUFBLENBQUMsTUFBTSxDQUFBLEFBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxrQkFBa0IsRUFBRSxFQUFFLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQ3pELEFBQUEsQ0FBQyxNO0FBQU0sQ0FBQTtBQUNQLEFBQUE7QUFDQSxBQUFBLDhFQUE2RTtBQUM3RSxBQUFBLFFBQU87QUFDUCxBQUFBO0FBQ0EsQUFBQSxBQUFBLE1BQU0sQ0FBZSxNQUFkLGNBQWMsQ0FBQyxDQUFFLEMsTUFBQyxDQUFDLElBQUksQ0FBQyxDQUFDLEVBQUUsQ0FBQSxDQUFBO0FBQ2xDLEFBQUE7QUFDQSxBQUFBLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQSxBQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7QUFDeEIsQUFBQSxFQUFFLFNBQVMsQ0FBQztBQUNaLEFBQUEsRUFBRSxNQUFNLENBQUM7QUFDVCxBQUFBLEVBQUUsQ0FBQyxRQUFRLEVBQUUsSUFBSSxDQUFDLEdBQUcsQ0FBQztBQUN0QixBQUFBLEVBQUUsQ0FBQyxDQUFBO0FBQ0gsQUFBQSxDQUFVLE1BQVQsU0FBUyxDQUFDLENBQUUsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDO0FBQ3ZCLEFBQUEsQ0FBQyxHQUFHLENBQUEsT0FBTyxDQUFDLFNBQVMsQ0FBQyxDQUFBLENBQUEsQ0FBQTtBQUN0QixBQUFBLEVBQUUsS0FBSyxDQUFDLE9BQU8sQ0FBQSxBQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7QUFDekIsQUFBQSxHQUFHLFNBQVMsQ0FBQztBQUNiLEFBQUEsR0FBRyxNQUFNLENBQUM7QUFDVixBQUFBLEdBQUcsSUFBSSxDQUFDO0FBQ1IsQUFBQSxHQUFHLFNBQVMsQ0FBQztBQUNiLEFBQUEsR0FBRyxDQUFDLFFBQVEsRUFBRSxJQUFJLENBQUMsR0FBRyxDQUFDO0FBQ3ZCLEFBQUEsR0FBRyxDQUFDLEM7Q0FBQSxDQUFBO0FBQ0osQUFBQSxDQUFDLE07QUFBTSxDQUFBO0FBQ1AsQUFBQTtBQUNBLEFBQUEsOEVBQTZFO0FBQzdFLEFBQUEsZ0RBQStDO0FBQy9DLEFBQUEsc0NBQXFDO0FBQ3JDLEFBQUE7QUFDQSxBQUFBLEFBQUEsTUFBTSxDQUFVLE1BQVQsU0FBUyxDQUFDLENBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUEsQ0FBQTtBQUN6QixBQUFBO0FBQ0EsQUFBQSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0FBQ1QsQUFBQSxFQUFFLFVBQVUsQ0FBQyxDQUFDLENBQUM7QUFDZixBQUFBLEdBQUcsUUFBUSxDQUFDLENBQUMsQ0FBQztBQUNkLEFBQUEsSUFBSSxNQUFNLENBQUMsQ0FBQyxLQUFLLENBQUE7QUFDakIsQUFBQSxJQUFJLFFBQVEsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBRSxDQUFBLENBQUE7QUFDdkIsQUFBQSxLQUFLLE1BQU0sQ0FBQSxBQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsY0FBYyxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDckQsQUFBQSxLQUFjLE1BQVQsU0FBUyxDQUFDLENBQUUsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsYUFBYSxDQUFDO0FBQzlDLEFBQUEsS0FBSyxNQUFNLENBQUEsQUFBQyxTQUFTLENBQUE7QUFDckIsQUFBQSxLQUFLLFdBQVcsQ0FBQSxBQUFDLElBQUksQ0FBQyxDQUFDLFNBQVMsQ0FBQTtBQUNoQyxBQUFBLEtBQUssUUFBUSxDQUFBLEFBQUMsU0FBUyxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLEtBQUssQ0FBQyxDO0lBQUEsQ0FBQTtBQUM3QyxJQUFJLENBQUMsQ0FBQTtBQUNMLEFBQUEsR0FBRyxRQUFRLENBQUMsQ0FBQyxDQUFDO0FBQ2QsQUFBQSxJQUFJLE1BQU0sQ0FBQyxDQUFDLEtBQUssQ0FBQTtBQUNqQixBQUFBLElBQUksUUFBUSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLENBQUEsQ0FBQTtBQUN2QixBQUFBLEtBQUssUUFBUSxDQUFBLEFBQUMsSUFBSSxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLEtBQUssQ0FBQyxDO0lBQUEsQ0FBQTtBQUN4QyxJQUFJLENBQUMsQ0FBQTtBQUNMLEFBQUEsR0FBRyxTQUFTLENBQUMsQ0FBQyxDQUFDO0FBQ2YsQUFBQSxJQUFJLE1BQU0sQ0FBQyxDQUFDLEtBQUssQ0FBQTtBQUNqQixBQUFBLElBQUksUUFBUSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLENBQUEsQ0FBQTtBQUN2QixBQUFB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QyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDL0IsQUFBQSxDQUFDLE1BQU0sQ0FBQyxPO0FBQU8sQ0FBQTtBQUNmLEFBQUE7QUFDQSxBQUFBLDhFQUE2RTtBQUM3RSxBQUFBLGNBQWE7QUFDYixBQUFBO0FBQ0EsQUFBQSxBQUFBLE1BQU0sQ0FBQyxJQUFBLEtBQUssQ0FBQyxDQUFDLEMsTUFBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQSxDQUFBO0FBQ3ZCLEFBQUE7QUFDQSxBQUFBLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUM7QUFDcEQsQUFBQSxDQUFDLE07QUFBTSxDQUFBO0FBQ1AiLCJuYW1lcyI6W10sInNvdXJjZXNDb250ZW50IjpbIiMgbGx1dGlscy5jaXZldFxuXG5pbXBvcnQge2V4cGFuZEdsb2JTeW5jfSBmcm9tICdAc3RkL2ZzL2V4cGFuZC1nbG9iJ1xuaW1wb3J0IGZzIGZyb20gJ2ZzJ1xuaW1wb3J0IHBhdGhMaWIgZnJvbSAncGF0aCdcbmltcG9ydCB1cmxMaWIgZnJvbSAndXJsJ1xuaW1wb3J0IHtUZXh0TGluZVN0cmVhbX0gZnJvbSAnQHN0ZC9zdHJlYW1zJ1xuaW1wb3J0IHtUZXh0RGVjb2RlclN0cmVhbX0gZnJvbSAnc3RyZWFtL3dlYidcbmltcG9ydCB7Y29tcGlsZX0gZnJvbSAnQGRhbmllbHgvY2l2ZXQnXG5pbXBvcnQge2RlYm91bmNlfSBmcm9tIFwiQHN0ZC9hc3luYy9kZWJvdW5jZVwiXG5pbXBvcnQge3N0cmlwQW5zaUNvZGV9IGZyb20gXCJAc3RkL2ZtdC9jb2xvcnNcIlxuaW1wb3J0IHtcblx0c2V0TG9nTGV2ZWwsIHB1c2hMb2dMZXZlbCwgcG9wTG9nTGV2ZWwsXG5cdGN1ckxvZ0xldmVsLCBjbGVhckxvZyxcblx0SU5ERU5ULCBVTkRFTlQsIENMRUFSLFxuXHREQkcsIExPRywgV0FSTiwgRVJSLFxuXHR9IGZyb20gJ0BqZGVpZ2hhbi91dGlscy9sb2dnZXIuanMnXG5pbXBvcnQge1xuXHRpc1N0cmluZywgaXNOb25FbXB0eVN0cmluZywgaXNCb29sZWFuLCBpc051bWJlciwgaXNJbnRlZ2VyLFxuXHRpc0FycmF5LCBpc0FycmF5T2ZTdHJpbmdzLCBpc0hhc2gsIGlzT2JqZWN0LFxuXHR9IGZyb20gJ0BqZGVpZ2hhbi91dGlscy9kYXRhLXR5cGUtdGVzdHMuanMnXG5cbmV4cG9ydCB7XG5cdHNldExvZ0xldmVsLCBwdXNoTG9nTGV2ZWwsIHBvcExvZ0xldmVsLCBjbGVhckxvZyxcblx0SU5ERU5ULCBVTkRFTlQsIENMRUFSLFxuXHREQkcsIExPRywgV0FSTiwgRVJSLFxuXHRpc1N0cmluZywgaXNOb25FbXB0eVN0cmluZywgaXNCb29sZWFuLCBpc051bWJlciwgaXNJbnRlZ2VyLFxuXHRpc0FycmF5LCBpc0FycmF5T2ZTdHJpbmdzLCBpc0hhc2gsIGlzT2JqZWN0LFxuXHR9XG5cbi8qKlxuICogQG1vZHVsZSBsbHV0aWxzIC0gbG93IGxldmVsIHV0aWxpdGllc1xuICovXG5cbnRleHREZWNvZGVyIDo9IG5ldyBUZXh0RGVjb2RlcigpXG5leHBvcnQgcGFzcyA9ICgpID0+ICAgICMgZG8gbm90aGluZ1xuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKipcbiAqIE91dHB1dHMgYW4gZXJyb3IgbWVzc2FnZSB0byB0aGUgbG9ncyxcbiAqIHRoZW4gdGhyb3dzIGFuIGV4Y2VwdGlvbiB3aXRoIHRoZSBwcm92aWRlZCBtZXNzYWdlXG4gKi9cblxuZXhwb3J0IGNyb2FrIDo9IChtc2cpID0+XG5cblx0RVJSIG1zZ1xuXHR0aHJvdyBuZXcgRXJyb3IobXNnKVxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG5leHBvcnQgYXNzZXJ0IDo9IChjb25kLCBtc2cpID0+XG5cblx0aWYgIWNvbmRcblx0XHRjcm9hayBtc2dcblx0cmV0dXJuXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbmV4cG9ydCB1bmRlZiA6PSB1bmRlZmluZWRcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuZXhwb3J0IGRlZmluZWQgOj0gKC4uLmxWYWx1ZXMpID0+XG5cblx0Zm9yIHZhbHVlIG9mIGxWYWx1ZXNcblx0XHRpZiAodmFsdWUgPT0gdW5kZWYpIHx8ICh2YWx1ZSA9PSBudWxsKVxuXHRcdFx0cmV0dXJuIGZhbHNlXG5cdHJldHVybiB0cnVlXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbmV4cG9ydCBub3RkZWZpbmVkIDo9ICh2YWx1ZSkgPT5cblxuXHRyZXR1cm4gbm90IGRlZmluZWQodmFsdWUpXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbmV4cG9ydCB3c1NwbGl0IDo9IChzdHIpID0+XG5cblx0bmV3c3RyIDo9IHN0ci50cmltKClcblx0aWYgKG5ld3N0ciA9PSAnJylcblx0XHRyZXR1cm4gW11cblx0ZWxzZVxuXHRcdHJldHVybiBuZXdzdHIuc3BsaXQoL1xccysvKVxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG5leHBvcnQgd29yZHMgOj0gKC4uLmxTdHJpbmdzKSA9PlxuXG5cdGxldCBsV29yZHMgPSBbXVxuXHRmb3Igc3RyIG9mIGxTdHJpbmdzXG5cdFx0Zm9yIHdvcmQgb2Ygd3NTcGxpdChzdHIpXG5cdFx0XHRsV29yZHMucHVzaCB3b3JkXG5cdHJldHVybiBsV29yZHNcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiMgR0VORVJBVE9SXG5cbmV4cG9ydCByYW5nZSA6PSAobikgLT5cblxuXHRsZXQgaSA9IDBcblx0d2hpbGUgKGkgPCBuKVxuXHRcdHlpZWxkIGlcblx0XHRpID0gaSArIDFcblx0cmV0dXJuXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbmV4cG9ydCBPTCA6PSAoeCkgPT5cblxuXHRyZXR1cm4gSlNPTi5zdHJpbmdpZnkoeClcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuZXhwb3J0IE1MIDo9ICh4KSA9PlxuXG5cdHJldHVybiBKU09OLnN0cmluZ2lmeSh4LCBudWxsLCAzKVxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG5leHBvcnQga2V5cyA6PSBPYmplY3Qua2V5c1xuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuIyAtLS0gdHJ1ZSBpZiBoYXNoIGhhcyBhbGwga2V5c1xuXG5leHBvcnQgaGFzS2V5IDo9IChoLCAuLi5sS2V5cykgPT5cblxuXHRpZiBub3RkZWZpbmVkKGgpXG5cdFx0cmV0dXJuIGZhbHNlXG5cdGFzc2VydCBpc0hhc2goaCksIFwiaCBub3QgYSBoYXNoOiAje09MKGgpfVwiXG5cdGZvciBrZXkgb2YgbEtleXNcblx0XHRhc3NlcnQgaXNTdHJpbmcoa2V5KSwgXCJrZXkgbm90IGEgc3RyaW5nOiAje09MKGtleSl9XCJcblx0XHRpZiBub3QgaC5oYXNPd25Qcm9wZXJ0eShrZXkpXG5cdFx0XHRyZXR1cm4gZmFsc2Vcblx0cmV0dXJuIHRydWVcblxuZXhwb3J0IGhhc0tleXMgOj0gaGFzS2V5XG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4jICAgaXNFbXB0eSAtIG9uZSBvZjpcbiMgICAgICAtIHN0cmluZyBpcyB3aGl0ZXNwYWNlXG4jICAgICAgLSBhcnJheSBoYXMgbm8gZWxlbWVudHNcbiMgICAgICAtIGhhc2ggaGFzIG5vIGtleXNcblxuZXhwb3J0IGlzRW1wdHkgOj0gKHgpID0+XG5cblx0aWYgKHggPT0gdW5kZWYpIHx8ICh4ID09IG51bGwpXG5cdFx0cmV0dXJuIHRydWVcblx0aWYgaXNTdHJpbmcoeClcblx0XHRyZXR1cm4gKHgubWF0Y2goL15cXHMqJC8pICE9IG51bGwpXG5cdGlmIGlzQXJyYXkoeClcblx0XHRyZXR1cm4gKHgubGVuZ3RoID09IDApXG5cdGlmIGlzSGFzaCh4KVxuXHRcdHJldHVybiAoa2V5cyh4KS5sZW5ndGggPT0gMClcblx0ZWxzZVxuXHRcdHJldHVybiBmYWxzZVxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuIyAgIG5vbkVtcHR5IC0gbm90IGlzRW1wdHkoeClcblxuZXhwb3J0IG5vbkVtcHR5IDo9ICh4KSA9PlxuXG5cdHJldHVybiBub3QgaXNFbXB0eSh4KVxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG5leHBvcnQgbWVyZ2UgOj0gKC4uLmxPYmplY3RzKSA9PlxuXG5cdHJldHVybiBPYmplY3QuYXNzaWduKGxPYmplY3RzLi4uKVxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG5leHBvcnQgbm9ybWFsaXplU3RyIDo9ICh4KSA9PlxuXG5cdHJldHVybiB4LnRvU3RyaW5nKCkucmVwbGFjZUFsbCgnXFxyJywgJycpLnRyaW0oKVxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG5leHBvcnQgc3BhY2VzID0gKG4pID0+XG5cblx0cmV0dXJuIFwiIFwiLnJlcGVhdChuKVxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG5leHBvcnQgdGFicyA9IChuKSA9PlxuXG5cdHJldHVybiBcIlxcdFwiLnJlcGVhdChuKVxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG5leHBvcnQgZ2V0TkV4dHJhID0gKHN0cjogc3RyaW5nLCBsZW4pID0+XG5cblx0ZXh0cmEgOj0gbGVuIC0gc3RyLmxlbmd0aFxuXHRyZXR1cm4gKGV4dHJhID4gMCkgPyBleHRyYSA6IDBcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuZXhwb3J0IHN0clRvSGFzaCA6PSAoc3RyKSA9PlxuXG5cdGFzc2VydCBpc05vbkVtcHR5U3RyaW5nKHN0ciksIFwiQmFkIHN0cmluZzogI3tPTChzdHIpfVwiXG5cdGggOj0ge31cblx0Zm9yIHdvcmQgb2Ygc3RyLnNwbGl0KC9cXHMrLylcblx0XHRpZiBsTWF0Y2hlcyA6PSB3b3JkLm1hdGNoKC8vL15cblx0XHRcdFx0KFxcISk/ICAgICAgICAgICAgICAgICAgICAjIG5lZ2F0ZSB2YWx1ZVxuXHRcdFx0XHQoW0EtWmEtel1bQS1aYS16XzAtOV0qKSAgIyBpZGVudGlmaWVyXG5cdFx0XHRcdCg/OlxuXHRcdFx0XHRcdCg9KVxuXHRcdFx0XHRcdCguKilcblx0XHRcdFx0XHQpP1xuXHRcdFx0XHQkLy8vKVxuXHRcdFx0W18sIG5lZywgaWRlbnQsIGVxU2lnbiwgc3RyXSA6PSBsTWF0Y2hlc1xuXHRcdFx0aWYgaXNOb25FbXB0eVN0cmluZyhlcVNpZ24pXG5cdFx0XHRcdGFzc2VydCBub3RkZWZpbmVkKG5lZykgfHwgKG5lZyA9PSAnJyksXG5cdFx0XHRcdFx0XHRcIm5lZ2F0aW9uIHdpdGggc3RyaW5nIHZhbHVlXCJcblxuXHRcdFx0XHQjIC0tLSBjaGVjayBpZiBzdHIgaXMgYSB2YWxpZCBudW1iZXJcblx0XHRcdFx0bnVtIDo9IHBhcnNlRmxvYXQoc3RyKVxuXHRcdFx0XHRpZiBOdW1iZXIuaXNOYU4obnVtKVxuXHRcdFx0XHRcdCMgLS0tIFRPIERPOiBpbnRlcnByZXQgYmFja3NsYXNoIGVzY2FwZXNcblx0XHRcdFx0XHRoW2lkZW50XSA9IHN0clxuXHRcdFx0XHRlbHNlXG5cdFx0XHRcdFx0aFtpZGVudF0gPSBudW1cblx0XHRcdGVsc2UgaWYgbmVnXG5cdFx0XHRcdGhbaWRlbnRdID0gZmFsc2Vcblx0XHRcdGVsc2Vcblx0XHRcdFx0aFtpZGVudF0gPSB0cnVlXG5cdFx0ZWxzZVxuXHRcdFx0Y3JvYWsgXCJJbnZhbGlkIHdvcmQgI3tPTCh3b3JkKX1cIlxuXHRyZXR1cm4gaFxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuZXhwb3J0IHJwYWQgOj0gKHN0cjogc3RyaW5nLCBsZW4sIGNoPScgJykgPT5cblxuXHRhc3NlcnQgKGNoLmxlbmd0aCA9PSAxKSwgXCJOb3QgYSBjaGFyXCJcblx0ZXh0cmEgOj0gZ2V0TkV4dHJhKHN0ciwgbGVuKVxuXHRyZXR1cm4gc3RyICsgY2gucmVwZWF0KGV4dHJhKVxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG5leHBvcnQgbHBhZCA6PSAoc3RyLCBsZW4sIGNoPScgJykgPT5cblxuXHRhc3NlcnQgKGNoLmxlbmd0aCA9PSAxKSwgXCJOb3QgYSBjaGFyXCJcblx0ZXh0cmEgOj0gZ2V0TkV4dHJhKHN0ciwgbGVuKVxuXHRyZXR1cm4gY2gucmVwZWF0KGV4dHJhKSArIHN0clxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuIyAtLS0gdmFsaWQgb3B0aW9uczpcbiMgICAgICAgIGNoYXIgLSBjaGFyIHRvIHVzZSBvbiBsZWZ0IGFuZCByaWdodFxuIyAgICAgICAgYnVmZmVyIC0gbnVtIHNwYWNlcyBhcm91bmQgdGV4dCB3aGVuIGNoYXIgPD4gJyAnXG5cbmV4cG9ydCBjZW50ZXJlZCA6PSAodGV4dCwgd2lkdGgsIGNoYXI9JyAnLCBudW1CdWZmZXI9MikgPT5cblxuXHR0b3RTcGFjZXMgOj0gd2lkdGggLSB0ZXh0Lmxlbmd0aFxuXHRpZiAodG90U3BhY2VzIDw9IDApXG5cdFx0cmV0dXJuIHRleHRcblx0bnVtTGVmdCA6PSBNYXRoLmZsb29yKHRvdFNwYWNlcyAvIDIpXG5cdG51bVJpZ2h0IDo9IHRvdFNwYWNlcyAtIG51bUxlZnRcblx0aWYgKGNoYXIgPT0gJyAnKVxuXHRcdHJldHVybiBzcGFjZXMobnVtTGVmdCkgKyB0ZXh0ICsgc3BhY2VzKG51bVJpZ2h0KVxuXHRlbHNlXG5cdFx0YnVmIDo9ICcgJy5yZXBlYXQobnVtQnVmZmVyKVxuXHRcdGxlZnQgOj0gY2hhci5yZXBlYXQobnVtTGVmdCAtIG51bUJ1ZmZlcilcblx0XHRyaWdodCA6PSBjaGFyLnJlcGVhdChudW1SaWdodCAtIG51bUJ1ZmZlcilcblx0XHRyZXR1cm4gbGVmdCArIGJ1ZiArIHRleHQgKyBidWYgKyByaWdodFxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG5leHBvcnQgYWxpZ25TdHJpbmcgOj0gKHN0ciwgd2lkdGgsIGFsaWduKSAtPlxuXG5cdGFzc2VydCBpc1N0cmluZyhzdHIpLCBcInN0ciBub3QgYSBzdHJpbmc6ICN7T0woc3RyKX1cIlxuXHRhc3NlcnQgaXNTdHJpbmcoYWxpZ24pLCBcImFsaWduIG5vdCBhIHN0cmluZzogI3tPTChhbGlnbil9XCJcblx0c3dpdGNoIGFsaWduXG5cdFx0d2hlbiAnbGVmdCcsICdsJ1xuXHRcdFx0cmV0dXJuIHJwYWQoc3RyLCB3aWR0aClcblx0XHR3aGVuICdjZW50ZXInLCAnYydcblx0XHRcdHJldHVybiBjZW50ZXJlZChzdHIsIHdpZHRoKVxuXHRcdHdoZW4gJ3JpZ2h0JywgJ3InXG5cdFx0XHRyZXR1cm4gbHBhZChzdHIsIHdpZHRoKVxuXHRcdGVsc2Vcblx0XHRcdGNyb2FrIFwiVW5rbm93biBhbGlnbjogI3tPTChhbGlnbil9XCJcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuZXhwb3J0IHpwYWQgOj0gKG4sIGxlbikgPT5cblxuXHRyZXR1cm4gbHBhZChuLnRvU3RyaW5nKCksIGxlbiwgJzAnKVxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuIyAgIGVzY2FwZVN0ciAtIGVzY2FwZSBuZXdsaW5lcywgY2FycmlhZ2UgcmV0dXJuLCBUQUIgY2hhcnMsIGV0Yy5cblxuZXhwb3J0IGhFc2NOTCA6PSB7XG5cdFwiXFxyXCI6ICfihpAnXG5cdFwiXFxuXCI6ICfihpMnXG5cdFwiXFx0XCI6ICfihpInXG5cdFwiIFwiOiAny7MnXG5cdH1cblxuZXhwb3J0IGhFc2NOb05MIDo9IHtcblx0XCJcXHJcIjogJ+KGkCdcblx0XCJcXHRcIjogJ+KGkidcblx0XCIgXCI6ICfLsydcblx0fVxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG5leHBvcnQgZXNjYXBlU3RyIDo9IChzdHIsIGhSZXBsYWNlPWhFc2NOTCwgaE9wdGlvbnM9e30pID0+XG5cdCMgICAgIFZhbGlkIG9wdGlvbnM6XG5cdCMgICAgICAgIG9mZnNldCAgLSBpbmRpY2F0ZSBwb3NpdGlvbiBvZiBvZmZzZXRcblx0IyAgICAgICAgcG9zY2hhciAtIGNoYXIgdG8gdXNlIHRvIGluZGljYXRlIHBvc2l0aW9uXG5cblx0e29mZnNldCwgcG9zY2hhcn0gOj0gZ2V0T3B0aW9ucyBoT3B0aW9ucywge1xuXHRcdG9mZnNldDogdW5kZWZcblx0XHRwb3NjaGFyOiAn4pSKJ1xuXHRcdH1cblxuXHRhc3NlcnQgaXNTdHJpbmcoc3RyKSwgXCJub3QgYSBzdHJpbmc6ICN7T0woc3RyKX1cIlxuXHRhc3NlcnQgaXNIYXNoKGhSZXBsYWNlKSwgXCJub3QgYSBoYXNoOiAje09MKGhSZXBsYWNlKX1cIlxuXG5cdGxQYXJ0cyA6PSBbXVxuXHRmb3IgY2gsaSBvZiBzdHIuc3BsaXQoJycpXG5cdFx0aWYgZGVmaW5lZChvZmZzZXQpICYmIChpID09IG9mZnNldClcblx0XHRcdGxQYXJ0cy5wdXNoIHBvc2NoYXJcblx0XHRuZXdjaCA6PSBoUmVwbGFjZVtjaF1cblx0XHRpZiBkZWZpbmVkKG5ld2NoKVxuXHRcdFx0bFBhcnRzLnB1c2ggbmV3Y2hcblx0XHRlbHNlXG5cdFx0XHRsUGFydHMucHVzaCBjaFxuXHRpZiAob2Zmc2V0ID09IHN0ci5sZW5ndGgpXG5cdFx0bFBhcnRzLnB1c2ggcG9zY2hhclxuXHRyZXR1cm4gbFBhcnRzLmpvaW4oJycpXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4jICAgZXNjYXBlQmxvY2tcbiMgICAgICAtIHJlbW92ZSBjYXJyaWFnZSByZXR1cm5zXG4jICAgICAgLSBlc2NhcGUgc3BhY2VzLCBUQUIgY2hhcnNcblxuZXhwb3J0IGVzY2FwZUJsb2NrID0gKGJsb2NrLCBoUmVwbGFjZT1oRXNjTm9OTCwgaE9wdGlvbnMpID0+XG5cblx0cmV0dXJuIGVzY2FwZVN0cihibG9jaywgaFJlcGxhY2UsIGhPcHRpb25zKVxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuZXhwb3J0IGFkZERlZmF1bHRzIDo9IChoT3B0aW9ucywgaERlZmF1bHRzKSA9PlxuXG5cdGFzc2VydCBpc09iamVjdChoT3B0aW9ucyksIFwiaE9wdGlvbnMgbm90IGFuIG9iamVjdDogI3tPTChoT3B0aW9ucyl9XCJcblx0YXNzZXJ0IGlzT2JqZWN0KGhEZWZhdWx0cyksIFwiaERlZmF1bHRzIG5vdCBhbiBvYmplY3Q6ICN7T0woaERlZmF1bHRzKX1cIlxuXG5cdCMgLS0tIEZpbGwgaW4gZGVmYXVsdHMgZm9yIG1pc3NpbmcgdmFsdWVzXG5cdGZvciBrZXkgb2YgT2JqZWN0LmtleXMoaERlZmF1bHRzKVxuXHRcdHZhbHVlIDo9IGhEZWZhdWx0c1trZXldXG5cdFx0aWYgbm90IGhPcHRpb25zLmhhc093blByb3BlcnR5KGtleSkgJiYgZGVmaW5lZCh2YWx1ZSlcblx0XHRcdGhPcHRpb25zW2tleV0gPSB2YWx1ZVxuXHRyZXR1cm4gaE9wdGlvbnNcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuZXhwb3J0IGdldE9wdGlvbnMgOj0gKG9wdGlvbnM9dW5kZWYsIGhEZWZhdWx0cz17fSkgPT5cblxuXHRoT3B0aW9ucyA6PSAoXG5cdFx0ICBub3RkZWZpbmVkKG9wdGlvbnMpID8ge31cblx0XHQ6IGlzU3RyaW5nKG9wdGlvbnMpICAgPyBzdHJUb0hhc2gob3B0aW9ucylcblx0XHQ6IGlzT2JqZWN0KG9wdGlvbnMpICAgPyBvcHRpb25zXG5cdFx0OiAgICAgICAgICAgICAgICAgICAgICAgY3JvYWsgXCJCYWQgb3B0aW9uczogI3tPTChvcHRpb25zKX1cIlxuXHRcdClcblx0cmV0dXJuIGFkZERlZmF1bHRzIGhPcHRpb25zLCBoRGVmYXVsdHNcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbmV4cG9ydCBpc0ZpbGUgOj0gKHBhdGgpID0+XG5cblx0cmV0dXJuIGZzLmV4aXN0c1N5bmMocGF0aCkgJiYgZnMubHN0YXRTeW5jKHBhdGgpLmlzRmlsZSgpXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbmV4cG9ydCBpc0RpciA6PSAocGF0aCkgPT5cblxuXHRyZXR1cm4gZnMuZXhpc3RzU3luYyhwYXRoKSAmJiBmcy5sc3RhdFN5bmMocGF0aCkuaXNEaXJlY3RvcnkoKVxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG5leHBvcnQgZmlsZUV4dCA6PSAocGF0aCkgPT5cblxuXHRpZiBsTWF0Y2hlcyA6PSBwYXRoLm1hdGNoKC9cXC5bXlxcLl0rJC8pXG5cdFx0cmV0dXJuIGxNYXRjaGVzWzBdXG5cdGVsc2Vcblx0XHRyZXR1cm4gJydcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuZXhwb3J0IHdpdGhFeHQgOj0gKHBhdGgsIGV4dCkgPT5cblxuXHRhc3NlcnQgZXh0LnN0YXJ0c1dpdGgoJy4nKSwgXCJCYWQgZmlsZSBleHRlbnNpb246ICN7ZXh0fVwiXG5cdGxNYXRjaGVzIDo9IHBhdGgubWF0Y2goL14oLiopXFwuW15cXC5dKyQvKVxuXHRpZiBkZWZpbmVkKGxNYXRjaGVzKVxuXHRcdHJldHVybiBcIiN7bE1hdGNoZXNbMV19I3tleHR9XCJcblx0Y3JvYWsgXCJCYWQgcGF0aDogJyN7cGF0aH0nXCJcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiMgLS0tIGdlbmVyYXRlIGEgMyBsZXR0ZXIgYWNyb255bSBpZiBmaWxlIHN0dWIgaXMgPHN0cj4tPHN0cj4tPHN0cj5cblxuZXhwb3J0IHRsYSA9IChzdHViKSA9PlxuXG5cdGlmIGxNYXRjaGVzIDo9IHN0dWIubWF0Y2goLy8vXlxuXHRcdFx0KFthLXpdKSg/OlthLXpdKilcblx0XHRcdFxcLVxuXHRcdFx0KFthLXpdKSg/OlthLXpdKilcblx0XHRcdFxcLVxuXHRcdFx0KFthLXpdKSg/OlthLXpdKilcblx0XHRcdCQvLy8pXG5cdFx0W18sIGEsIGIsIGNdIDo9IGxNYXRjaGVzXG5cdFx0cmV0dXJuIFwiI3thfSN7Yn0je2N9XCJcblx0ZWxzZVxuXHRcdHJldHVybiB1bmRlZlxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG5leHBvcnQgcm1GaWxlIDo9IChwYXRoKSA9PlxuXG5cdGZzLnJtU3luYyBwYXRoLCB7Zm9yY2U6IHRydWV9ICAgIyBubyBlcnJvciBpZiBmaWxlIGRvZXNuJ3QgZXhpc3Rcblx0cmV0dXJuXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4jIC0tLSBHRU5FUkFUT1I6IHlpZWxkczpcbiMgeyBwYXRoLCBuYW1lLCBpc0ZpbGUsIGlzRGlyZWN0b3J5LCBpc1N5bWxpbmsgfVxuI1xuIyAtLS0gQXZhaWxhYmxlIG9wdGlvbnM6XG4jICAgICAgICByb290OiAgICAgICAgICAgZGVmYXVsdCA9IGN1cnJlbnQgZGlyZWN0b3J5XG4jICAgICAgICBleGNsdWRlOiAgICAgICAgcGF0dGVybnMgdG8gZXhjbHVkZSwgZGVmYXVsdCA9IFtcbiMgICAgICAgICAgICAgICAgICAgICAgICAgICAnbm9kZV9tb2R1bGVzLyoqJ1xuIyAgICAgICAgICAgICAgICAgICAgICAgICAgICcuZ2l0LyoqJ1xuIyAgICAgICAgICAgICAgICAgICAgICAgICAgIF1cbiMgICAgICAgIGluY2x1ZGVEaXJzOiAgICBkZWZhdWx0ID0gZmFsc2VcbiMgICAgICAgIGZvbGxvd1N5bWxpbmtzOiBkZWZhdWx0ID0gZmFsc2VcbiMgICAgICAgIGNhbm9uaWNhbGl6ZTogICBkZWZhdWx0ID0gdHJ1ZSBpZiBmb2xsb3dTeW1saW5rcyBpcyB0cnVlXG5cbmV4cG9ydCBnbG9iRmlsZXMgOj0gKHBhdD0nKicsIGhPcHRpb25zPXt9KSAtPlxuXG5cdHtcblx0XHRyb290XG5cdFx0aW5jbHVkZURpcnNcblx0XHRleGNsdWRlXG5cdFx0Zm9sbG93U3ltbGlua3Ncblx0XHRjYW5vbmljYWxpemVcblx0XHRwYXJzZVxuXHRcdH0gOj0gZ2V0T3B0aW9ucyBoT3B0aW9ucywge1xuXHRcdFx0cm9vdDogRGVuby5jd2QoKVxuXHRcdFx0aW5jbHVkZURpcnM6IGZhbHNlXG5cdFx0XHRleGNsdWRlOiBbXVxuXHRcdFx0Zm9sbG93U3ltbGlua3M6IHVuZGVmXG5cdFx0XHRjYW5vbmljYWxpemU6IHVuZGVmXG5cdFx0XHRwYXJzZTogZmFsc2Vcblx0XHRcdH1cblxuXHRoR2xvYk9wdGlvbnMgOj0ge1xuXHRcdHJvb3Rcblx0XHRmb2xsb3dTeW1saW5rc1xuXHRcdGNhbm9uaWNhbGl6ZVxuXHRcdGluY2x1ZGVEaXJzOiBmYWxzZVxuXHRcdGV4Y2x1ZGU6IFsnbm9kZV9tb2R1bGVzLyoqJywgJy5naXQvKionLCBleGNsdWRlLi4uXVxuXHRcdH1cblx0Zm9yIGhGaWxlIG9mIGV4cGFuZEdsb2JTeW5jKHBhdCwgaEdsb2JPcHRpb25zKVxuXHRcdGlmIHBhcnNlXG5cdFx0XHR5aWVsZCBwYXJzZVBhdGgoaEZpbGUucGF0aClcblx0XHRlbHNlXG5cdFx0XHQjIC0tLSBoYXMga2V5czogcGF0aCwgbmFtZSwgaXNGaWxlLCBpc0RpcmVjdG9yeSwgaXNTeW1MaW5rXG5cdFx0XHRoRmlsZS5wYXRoID0gcmVscGF0aChoRmlsZS5wYXRoKVxuXHRcdFx0eWllbGQgaEZpbGVcblx0cmV0dXJuXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4jIEFTWU5DIElURVJBQkxFXG4jXG4jIEV4YW1wbGUgVXNhZ2UgaW4gKi5jaXZldFxuI1xuIyAgIGltcG9ydCB7YWxsTGluZXNJbn0gZnJvbSAnLi9sbHV0aWxzLmpzJ1xuI1xuIyAgIGZvciBhd2FpdCBsaW5lIG9mIGFsbExpbmVzSW4oJ3NyYy9saWIvdGVtcC5jaXZldCcpXG4jIFx0ICAgIGNvbnNvbGUubG9nIFwiTElORTogI3tsaW5lfVwiXG4jICAgY29uc29sZS5sb2cgXCJET05FXCJcblxuZXhwb3J0IGFsbExpbmVzSW4gOj0gKHBhdGgpIC0+XG5cblx0YXNzZXJ0IGlzRmlsZShwYXRoKSwgXCJObyBzdWNoIGZpbGU6ICN7T0wocGF0aCl9IChhbGxMaW5lc0luKVwiXG5cdGYgOj0gYXdhaXQgRGVuby5vcGVuKHBhdGgpXG5cdHJlYWRhYmxlIDo9IGYucmVhZGFibGVcblx0XHQucGlwZVRocm91Z2gobmV3IFRleHREZWNvZGVyU3RyZWFtKCkpXG5cdFx0LnBpcGVUaHJvdWdoKG5ldyBUZXh0TGluZVN0cmVhbSgpKVxuXG5cdGZvciBhd2FpdCBsaW5lIG9mIHJlYWRhYmxlXG5cdFx0eWllbGQgbGluZVxuXHRyZXR1cm5cblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiMgQVNZTkMgSVRFUkFCTEVcbiNcbiMgRXhhbXBsZSBVc2FnZSBpbiAqLmNpdmV0XG4jXG4jICAgaW1wb3J0IHt3YXRjaEZpbGVzfSBmcm9tICcuL2xsdXRpbHMuanMnXG4jXG4jICAgZm9yIGF3YWl0IGV2ZW50IG9mIHdhdGNoRmlsZXMoJ3NyYy9saWInKVxuIyBcdCAgICBjb25zb2xlLmxvZyBcIkVWRU5UOiAje2V2ZW50LmtpbmR9ICN7ZXZlbnQucGF0aHNbMF19XCJcbiMgICB3YXRjaGVyLmNsb3NlKClcbiMgICBjb25zb2xlLmxvZyBcIkRPTkVcIlxuXG5leHBvcnQgd2F0Y2hGaWxlcyA6PSAocGF0aCkgLT5cblxuXHRjb25zb2xlLmxvZyBcIldBVENISU5HOiAje3BhdGh9XCJcblx0d2F0Y2hlciA6PSBEZW5vLndhdGNoRnMocGF0aClcblx0Zm9yIGF3YWl0IGV2ZW50IG9mIHdhdGNoZXJcblx0XHRjb25zb2xlLmxvZyBcIldBVENIRVIgRVZFTlQ6ICN7T0woZXZlbnQpfVwiXG5cdFx0eWllbGQgZXZlbnRcblx0d2F0Y2hlci5jbG9zZSgpXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4jICAgICBjb252ZXJ0IFxcIHRvIC9cbiMgLS0tIGNvbnZlcnQgXCJDOi4uLlwiIHRvIFwiYzouLi5cIlxuXG5leHBvcnQgbm9ybWFsaXplUGF0aCA6PSAocGF0aCkgPT5cblxuXHRucGF0aCA6PSBwYXRoLnJlcGxhY2VBbGwoJ1xcXFwnLCAnLycpXG5cdGlmIChucGF0aC5jaGFyQXQoMSkgPT0gJzonKVxuXHRcdHJldHVybiBucGF0aC5jaGFyQXQoMCkudG9Mb3dlckNhc2UoKSArIG5wYXRoLnN1YnN0cmluZygxKVxuXHRlbHNlXG5cdFx0cmV0dXJuIG5wYXRoXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbmV4cG9ydCBta3BhdGggOj0gKGxQYXJ0cy4uLikgPT5cblxuXHRwYXRoIDo9IHBhdGhMaWIucmVzb2x2ZShsUGFydHMuLi4pXG5cdHJldHVybiBub3JtYWxpemVQYXRoKHBhdGgpXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbmV4cG9ydCByZWxwYXRoIDo9IChsUGFydHMuLi4pID0+XG5cblx0YXNzZXJ0IGlzQXJyYXlPZlN0cmluZ3MobFBhcnRzKSwgXCJCYWQgbFBhcnRzOiAje09MKGxQYXJ0cyl9XCJcblx0ZnVsbFBhdGggOj0gcGF0aExpYi5yZXNvbHZlIGxQYXJ0cy4uLlxuXHRyZXR1cm4gbm9ybWFsaXplUGF0aCBwYXRoTGliLnJlbGF0aXZlKCcnLCBmdWxsUGF0aClcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuZXhwb3J0IHBhcnNlUGF0aCA6PSAoZmlsZVNwZWMsIGhPcHRpb25zPXt9KSA9PlxuXHQjIC0tLSBOT1RFOiBmaWxlU3BlYyBtYXkgYmUgYSBmaWxlIFVSTCwgZS5nLiBpbXBvcnQubWV0YS51cmxcblx0IyAgICAgICAgICAgZmlsZVNwZWMgbWF5IGJlIGEgcmVsYXRpdmUgcGF0aFxuXG5cdGFzc2VydCBpc1N0cmluZyhmaWxlU3BlYyksIFwiZmlsZVNwZWMgbm90IGEgc3RyaW5nICN7T0woZmlsZVNwZWMpfVwiXG5cdHtzdGF0c30gOj0gZ2V0T3B0aW9ucyBoT3B0aW9ucywge1xuXHRcdHN0YXRzOiBmYWxzZVxuXHRcdH1cblxuXHQjIC0tLSBta3BhdGgoKSBub3JtYWxpemVzIHRoZSBwYXRoXG5cdHBhdGggOj0gbWtwYXRoKFxuXHRcdGRlZmluZWQoZmlsZVNwZWMubWF0Y2goL15maWxlXFw6XFwvXFwvLykpXG5cdFx0XHQ/IHVybExpYi5maWxlVVJMVG9QYXRoKGZpbGVTcGVjKVxuXHRcdFx0OiBmaWxlU3BlY1xuXHRcdFx0KVxuXHRhc3NlcnQgaXNOb25FbXB0eVN0cmluZyhwYXRoKSwgXCJCYWQgcGF0aDogI3tPTChwYXRoKX1cIlxuXHR0eXBlIDo9IHBhdGhUeXBlIHBhdGhcblxuXHR7cm9vdCwgZGlyLCBiYXNlOiBmaWxlTmFtZX0gOj0gcGF0aExpYi5wYXJzZShwYXRoKVxuXG5cdGxQYXJ0cyA6PSBmaWxlTmFtZS5zcGxpdCgnLicpXG5cdFtzdHViLCBwdXJwb3NlLCBleHRdIDo9IHN3aXRjaCBsUGFydHMubGVuZ3RoXG5cdFx0d2hlbiAwXG5cdFx0XHRjcm9hayBcIkNhbid0IGhhcHBlblwiXG5cdFx0d2hlbiAxXG5cdFx0XHRbZmlsZU5hbWUsIHVuZGVmLCB1bmRlZl1cblx0XHR3aGVuIDJcblx0XHRcdFtsUGFydHNbMF0sIHVuZGVmLCBcIi4je2xQYXJ0c1sxXX1cIl1cblx0XHRlbHNlXG5cdFx0XHRbXG5cdFx0XHRcdGxQYXJ0cy5zbGljZSgwLCAtMikuam9pbignLicpLFxuXHRcdFx0XHRsUGFydHMuYXQoLTIpLFxuXHRcdFx0XHRcIi4je2xQYXJ0cy5hdCgtMSl9XCJcblx0XHRcdFx0XVxuXG5cdCMgLS0tIEdyYWIgZXZlcnl0aGluZyB1cCB1bnRpbCB0aGUgbGFzdCBwYXRoIHNlcGFyYXRvciwgaWYgYW55XG5cdHJlbFBhdGggOj0gcmVscGF0aCBwYXRoXG5cdGxQYXRoTWF0Y2hlcyA6PSByZWxQYXRoLm1hdGNoKC9eKC4qKVtcXFxcXFwvXVteXFxcXFxcL10qJC8pXG5cdHJlbERpciA6PSBkZWZpbmVkKGxQYXRoTWF0Y2hlcykgPyBsUGF0aE1hdGNoZXNbMV0gOiAnLidcblxuXHRoRmlsZSA6PSB7XG5cdFx0cGF0aFxuXHRcdHR5cGVcblx0XHRyb290XG5cdFx0ZGlyXG5cdFx0ZmlsZU5hbWVcblx0XHRzdHViXG5cdFx0cHVycG9zZVxuXHRcdGV4dFxuXHRcdHJlbFBhdGhcblx0XHRyZWxEaXJcblx0XHR9XG5cdGlmIHN0YXRzICYmIGlzRmlsZShwYXRoKVxuXHRcdE9iamVjdC5hc3NpZ24gaEZpbGUsIGdldEZpbGVTdGF0cyhwYXRoKVxuXHRyZXR1cm4gaEZpbGVcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiMgLS0tIHJldHVybnMgb25lIG9mOlxuIyAgICAgICAgJ21pc3NpbmcnICAtIGRvZXMgbm90IGV4aXN0XG4jICAgICAgICAnZGlyJyAgICAgIC0gaXMgYSBkaXJlY3RvcnlcbiMgICAgICAgICdmaWxlJyAgICAgLSBpcyBhIGZpbGVcbiMgICAgICAgICd1bmtub3duJyAgLSBleGlzdHMsIGJ1dCBub3QgYSBmaWxlIG9yIGRpcmVjdG9yeVxuXG5leHBvcnQgcGF0aFR5cGUgOj0gKHBhdGgpID0+XG5cblx0YXNzZXJ0IGlzU3RyaW5nKHBhdGgpLCBcIm5vdCBhIHN0cmluZzogI3tPTChwYXRoKX1cIlxuXHRpZiBmcy5leGlzdHNTeW5jIHBhdGhcblx0XHRpZiBpc0ZpbGUgcGF0aFxuXHRcdFx0cmV0dXJuICdmaWxlJ1xuXHRcdGVsc2UgaWYgaXNEaXIgcGF0aFxuXHRcdFx0cmV0dXJuICdkaXInXG5cdFx0ZWxzZVxuXHRcdFx0cmV0dXJuICd1bmtub3duJ1xuXHRlbHNlXG5cdFx0cmV0dXJuICdtaXNzaW5nJ1xuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG5leHBvcnQgZ2V0RmlsZVN0YXRzIDo9IChwYXRoKSA9PlxuXG5cdHJldHVybiBmcy5sc3RhdFN5bmMocGF0aClcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbmV4cG9ydCBuZXdlckRlc3RGaWxlRXhpc3RzIDo9IChzcmNQYXRoLCBkZXN0UGF0aCkgPT5cblxuXHRhc3NlcnQgaXNGaWxlKHNyY1BhdGgpLCBcIk5vIHN1Y2ggZmlsZTogI3tPTChzcmNQYXRoKX0gKG5ld2VyRGVzdEZpbGVFeGlzdHMpXCJcblx0aWYgbm90IGZzLmV4aXN0c1N5bmMoZGVzdFBhdGgpXG5cdFx0cmV0dXJuIGZhbHNlXG5cdHNyY01vZFRpbWUgOj0gZnMuc3RhdFN5bmMoc3JjUGF0aCkubXRpbWVNc1xuXHRkZXN0TW9kVGltZSA6PSBmcy5zdGF0U3luYyhkZXN0UGF0aCkubXRpbWVNc1xuXHRyZXR1cm4gKGRlc3RNb2RUaW1lID4gc3JjTW9kVGltZSlcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuZXhwb3J0IHBhdGhTdWJEaXJzID0gKHBhdGgpID0+XG5cblx0e3Jvb3QsIGRpcn0gOj0gcGF0aExpYi5wYXJzZShwYXRoKVxuXHRyZXR1cm4ge1xuXHRcdHJvb3Rcblx0XHRsUGFydHM6IGRpci5zbGljZShyb290Lmxlbmd0aCkuc3BsaXQoL1tcXFxcXFwvXS8pXG5cdFx0fVxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG5leHBvcnQgY2xlYXJEaXIgPSAoZGlyUGF0aCkgPT5cblxuXHR0cnlcblx0XHRoIDo9IHt3aXRoRmlsZVR5cGVzOiB0cnVlLCByZWN1cnNpdmU6IHRydWV9XG5cdFx0Zm9yIGVudCBpbiBmcy5yZWFkZGlyU3luYyhkaXJQYXRoLCBoKVxuXHRcdFx0c3ViRW50ID0gbWtwYXRoKGVudC5wYXRoLCBlbnQubmFtZSlcblx0XHRcdGlmIGVudC5pc0ZpbGUoKVxuXHRcdFx0XHRmcy5ybVN5bmMgc3ViRW50XG5cdFx0XHRlbHNlIGlmIGVudC5pc0RpcmVjdG9yeSgpXG5cdFx0XHRcdGNsZWFyRGlyIHN1YkVudFxuXHRjYXRjaCBlcnJcblx0cmV0dXJuXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbmV4cG9ydCBta0RpciA9IChkaXJQYXRoLCBoT3B0aW9ucz17fSkgPT5cblxuXHR7Y2xlYXJ9IDo9IGdldE9wdGlvbnMgaE9wdGlvbnMsIHtcblx0XHRjbGVhcjogZmFsc2Vcblx0XHR9XG5cblx0dHJ5XG5cdFx0ZnMubWtkaXJTeW5jIGRpclBhdGhcblx0XHRyZXR1cm4gdHJ1ZVxuXHRjYXRjaCBlcnJcblx0XHRpZiAoZXJyLmNvZGUgPT0gJ0VFWElTVCcpXG5cdFx0XHRpZiBjbGVhclxuXHRcdFx0XHRjbGVhckRpciBkaXJQYXRoXG5cdFx0XHRyZXR1cm4gZmFsc2Vcblx0XHRlbHNlXG5cdFx0XHR0aHJvdyBlcnJcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuZXhwb3J0IG1rRGlyc0ZvckZpbGUgPSAoZmlsZVBhdGgpID0+XG5cblx0e3Jvb3QsIGxQYXJ0c30gOj0gcGF0aFN1YkRpcnMoZmlsZVBhdGgpXG5cdGxldCBkaXIgPSByb290XG5cdGZvciBwYXJ0IG9mIGxQYXJ0c1xuXHRcdGRpciArPSBcIi8je3BhcnR9XCJcblx0XHRpZiBub3QgaXNEaXIoZGlyKVxuXHRcdFx0bWtEaXIoZGlyKVxuXHRyZXR1cm5cblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiMgICBzbHVycCAtIHJlYWQgYSBmaWxlIGludG8gYSBzdHJpbmdcblxuZXhwb3J0IHNsdXJwIDo9IChwYXRoKSA9PlxuXG5cdGFzc2VydCBpc0ZpbGUocGF0aCksIFwiTm8gc3VjaCBmaWxlOiAje3BhdGh9IChzbHVycClcIlxuXHRyZXR1cm4gbm9ybWFsaXplU3RyIGZzLnJlYWRGaWxlU3luYyhwYXRoLCAndXRmOCcpXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4jICAgYmFyZiAtIHdyaXRlIGEgc3RyaW5nIHRvIGEgZmlsZVxuIyAgICAgICAgICB3aWxsIGVuc3VyZSB0aGF0IGFsbCBuZWNlc3NhcnkgZGlyZWN0b3JpZXMgZXhpc3RcblxuZXhwb3J0IGJhcmYgOj0gKGNvbnRlbnRzLCBwYXRoKSA9PlxuXG5cdG1rRGlyc0ZvckZpbGUocGF0aClcblx0ZnMud3JpdGVGaWxlU3luYyhwYXRoLCBub3JtYWxpemVTdHIoY29udGVudHMpKVxuXHRyZXR1cm5cblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbmV4cG9ydCBta3N0ciA6PSAoaXRlbSkgPT5cblxuXHRpZiBkZWZpbmVkKGl0ZW0pXG5cdFx0aWYgaXNTdHJpbmcoaXRlbSlcblx0XHRcdHJldHVybiBzdHJpcEFuc2lDb2RlKGl0ZW0pXG5cdFx0ZWxzZSBpZiBpc0FycmF5KGl0ZW0pXG5cdFx0XHRyZXR1cm4gc3RyaXBBbnNpQ29kZShpdGVtLmpvaW4oJycpKVxuXHRcdGVsc2Vcblx0XHRcdHJldHVybiBzdHJpcEFuc2lDb2RlKHRleHREZWNvZGVyLmRlY29kZShpdGVtKSlcblx0ZWxzZVxuXHRcdHJldHVybiAnJ1xuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG5leHBvcnQgZ2V0Q21kTGluZSA6PSAoY21kTmFtZSwgbEFyZ3MpID0+XG5cblx0YXNzZXJ0IGlzU3RyaW5nKGNtZE5hbWUpLCBcImNtZE5hbWUgbm90IGEgc3RyaW5nOiAje09MKGNtZE5hbWUpfVwiXG5cdGFzc2VydCBpc0FycmF5T2ZTdHJpbmdzKGxBcmdzKSwgXCJub3QgYW4gYXJyYXkgb2Ygc3RyaW5nczogI3tPTChsQXJncyl9XCJcblx0cmV0dXJuIFwiI3tjbWROYW1lfSAje2xBcmdzLmpvaW4oJyAnKX1cIlxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuIyBBU1lOQ1xuXG5leHBvcnQgZXhlY0NtZCA6PSAoY21kTmFtZSwgbEFyZ3M9W10pID0+XG5cblx0Y21kTGluZSA6PSBnZXRDbWRMaW5lKGNtZE5hbWUsIGxBcmdzKVxuXHREQkcgXCJFWEVDOiAje09MKGNtZExpbmUpfVwiLCBJTkRFTlRcblx0bG9nZ2VyIDo9IGN1ckxvZ0xldmVsKClcblxuXHRjbWQgOj0gbmV3IERlbm8uQ29tbWFuZCBjbWROYW1lLCB7XG5cdFx0YXJnczogbEFyZ3MsXG5cdFx0ZW52OiB7REVGQVVMVF9MT0dHRVI6IGxvZ2dlcn1cblx0XHR9XG5cdHtzdWNjZXNzLCBjb2RlLCBzaWduYWwsIHN0ZG91dCwgc3RkZXJyfSA6PSBhd2FpdCBjbWQub3V0cHV0KClcblx0aWYgKGNvZGUgIT0gMClcblx0XHRFUlIgXCJFUlJPUiBydW5uaW5nICN7Y21kTGluZX0sIGNvZGU9I3tjb2RlfVwiXG5cblx0aFJldFZhbCA6PSB7XG5cdFx0Y21kTGluZVxuXHRcdHN1Y2Nlc3Ncblx0XHRzaWduYWxcblx0XHRjb2RlXG5cdFx0fVxuXG5cdGlmIGRlZmluZWQoc3Rkb3V0KVxuXHRcdHN0ZG91dFN0ciA6PSBta3N0cihzdGRvdXQpXG5cdFx0aWYgKHN0ZG91dFN0ci5sZW5ndGggPiAwKVxuXHRcdFx0REJHIFwic3Rkb3V0ID1cIiwgc3Rkb3V0U3RyXG5cdFx0XHRoUmV0VmFsLnN0ZG91dCA9IHN0ZG91dFN0clxuXG5cdGlmIGRlZmluZWQoc3RkZXJyKVxuXHRcdHN0ZGVyclN0ciA6PSBta3N0cihzdGRlcnIpXG5cdFx0aWYgKHN0ZGVyclN0ci5sZW5ndGggPiAwKVxuXHRcdFx0REJHIFwic3RkZXJyID1cIiwgc3RkZXJyU3RyXG5cdFx0XHRoUmV0VmFsLnN0ZGVyciA9IHN0ZGVyclN0clxuXG5cdERCRyBVTkRFTlRcblx0cmV0dXJuIGhSZXRWYWxcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuZXhwb3J0IGV4ZWNDbWRTeW5jIDo9IChjbWROYW1lLCBsQXJncz1bXSkgPT5cblxuXHRjbWRMaW5lIDo9IGdldENtZExpbmUoY21kTmFtZSwgbEFyZ3MpXG5cdERCRyBcIkVYRUMgU1lOQzogI3tPTChjbWRMaW5lKX1cIiwgSU5ERU5UXG5cdGxvZ2dlciA6PSBjdXJMb2dMZXZlbCgpXG5cblx0Y21kIDo9IG5ldyBEZW5vLkNvbW1hbmQgY21kTmFtZSwge1xuXHRcdGFyZ3M6IGxBcmdzLFxuXHRcdGVudjoge0RFRkFVTFRfTE9HR0VSOiBsb2dnZXJ9XG5cdFx0fVxuXHR7c3VjY2VzcywgY29kZSwgc2lnbmFsLCBzdGRvdXQsIHN0ZGVycn0gOj0gY21kLm91dHB1dFN5bmMoKVxuXHRpZiAoY29kZSAhPSAwKVxuXHRcdEVSUiBcIkVSUk9SIHJ1bm5pbmcgI3tjbWRMaW5lfSwgY29kZT0je2NvZGV9XCJcblxuXHRoUmV0VmFsIDo9IHtcblx0XHRjbWRMaW5lXG5cdFx0c3VjY2Vzc1xuXHRcdHNpZ25hbFxuXHRcdGNvZGVcblx0XHR9XG5cblx0aWYgZGVmaW5lZChzdGRvdXQpXG5cdFx0c3Rkb3V0U3RyIDo9IG1rc3RyKHN0ZG91dClcblx0XHRpZiAoc3Rkb3V0U3RyLmxlbmd0aCA+IDApXG5cdFx0XHREQkcgXCJzdGRvdXQgPVwiLCBzdGRvdXRTdHJcblx0XHRcdGhSZXRWYWwuc3Rkb3V0ID0gc3Rkb3V0U3RyXG5cblx0aWYgZGVmaW5lZChzdGRlcnIpXG5cdFx0c3RkZXJyU3RyIDo9IG1rc3RyKHN0ZGVycilcblx0XHRpZiAoc3RkZXJyU3RyLmxlbmd0aCA+IDApXG5cdFx0XHREQkcgXCJzdGRlcnIgPVwiLCBzdGRlcnJTdHJcblx0XHRcdGhSZXRWYWwuc3RkZXJyID0gc3RkZXJyU3RyXG5cblx0REJHIFVOREVOVFxuXHRyZXR1cm4gaFJldFZhbFxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuIyAtLS0gd2lsbCBldmVudHVhbGx5IHByZS1wcm9jZXNzIHRoZSAuY2llbG8gY29kZVxuXG5leHBvcnQgY2llbG8yY2l2ZXQgOj0gKHBhdGgsIGNpdmV0UGF0aCkgPT5cblxuXHRhc3NlcnQgaXNGaWxlKHBhdGgpLCBcIk5vIHN1Y2ggZmlsZTogI3tPTChwYXRoKX0gKGNpZWxvMmNpdmV0KVwiXG5cdGFzc2VydCAoZmlsZUV4dChwYXRoKSA9PSAnLmNpZWxvJyksIFwiTm90IGEgY2llbG8gZmlsZTogI3tPTChwYXRoKX1cIlxuXHRleGVjQ21kU3luYyAnY3AnLCBbcGF0aCwgY2l2ZXRQYXRoXVxuXHRhc3NlcnQgaXNGaWxlKGNpdmV0UGF0aCksIFwiRmlsZSBub3QgY3JlYXRlZDogI3tPTChjaXZldFBhdGgpfVwiXG5cdHJldHVyblxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG5leHBvcnQgY2l2ZXQyanMgOj0gKHBhdGgsIGpzUGF0aCkgPT5cblxuXHRhc3NlcnQgaXNGaWxlKHBhdGgpLCBcIk5vIHN1Y2ggZmlsZTogI3tPTChwYXRoKX0gKGNpdmV0MmpzKVwiXG5cdGFzc2VydCAoZmlsZUV4dChwYXRoKSA9PSAnLmNpdmV0JyksIFwiTm90IGEgY2l2ZXQgZmlsZTogI3tPTChwYXRoKX1cIlxuXG5cdGV4ZWNDbWRTeW5jICdjaXZldCcsIFtcblx0XHQnLS1qcycsXG5cdFx0Jy1vJyxcblx0XHRqc1BhdGgsXG5cdFx0Jy0taW5saW5lLW1hcCcsXG5cdFx0Jy1jJyxcblx0XHRwYXRoXG5cdFx0XVxuXG5cdGFzc2VydCBpc0ZpbGUoanNQYXRoKSwgXCJGaWxlIG5vdCBjcmVhdGVkOiAje09MKGpzUGF0aCl9XCJcblx0cmV0dXJuXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbmV4cG9ydCBjb2ZmZWUyanMgOj0gKHBhdGgsIGpzUGF0aCkgPT5cblxuXHRhc3NlcnQgaXNGaWxlKHBhdGgpLCBcIk5vIHN1Y2ggZmlsZTogI3tPTChwYXRoKX0gKGNvZmZlZTJqcylcIlxuXHRhc3NlcnQgKGZpbGVFeHQocGF0aCkgPT0gJy5jb2ZmZWUnKSwgXCJOb3QgYSBDb2ZmZWVTY3JpcHQgZmlsZTogI3tPTChwYXRoKX1cIlxuXHRleGVjQ21kU3luYyAnY29mZmVlJywgW1xuXHRcdCctbycsXG5cdFx0anNQYXRoLFxuXHRcdCctLWlubGluZS1tYXAnLFxuXHRcdCctYycsXG5cdFx0cGF0aFxuXHRcdF1cblx0YXNzZXJ0IGlzRmlsZShqc1BhdGgpLCBcIkZpbGUgbm90IGNyZWF0ZWQ6ICN7T0woanNQYXRoKX1cIlxuXHRyZXR1cm5cblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuZXhwb3J0IHRzMmpzIDo9IChwYXRoLCBqc1BhdGgpID0+XG5cblx0YXNzZXJ0IGlzRmlsZShwYXRoKSwgXCJObyBzdWNoIGZpbGU6ICN7T0wocGF0aCl9ICh0czJqcylcIlxuXHRhc3NlcnQgKGZpbGVFeHQocGF0aCkgPT0gJy50cycpLCBcIk5vdCBhIHRzIGZpbGU6ICN7T0wocGF0aCl9XCJcblx0ZXhlY0NtZFN5bmMgJ2NpdmV0JywgW1xuXHRcdCctLWpzJyxcblx0XHQnLW8nLFxuXHRcdGpzUGF0aCxcblx0XHQnLS1pbmxpbmUtbWFwJyxcblx0XHQnLWMnLFxuXHRcdHBhdGhcblx0XHRdXG5cdGFzc2VydCBpc0ZpbGUoanNQYXRoKSwgXCJGaWxlIG5vdCBjcmVhdGVkOiAje09MKGpzUGF0aCl9XCJcblx0cmV0dXJuXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4jIEFTWU5DXG5cbmV4cG9ydCBpbnN0YWxsRGVub0NtZCA6PSAoc3R1YikgPT5cblxuXHRhd2FpdCBleGVjQ21kICdkZW5vJywgW1xuXHRcdCdpbnN0YWxsJyxcblx0XHQnLWZnQScsXG5cdFx0XCJzcmMvYmluLyN7c3R1Yn0uanNcIlxuXHRcdF1cblx0c2hvcnROYW1lIDo9IHRsYShzdHViKVxuXHRpZiBkZWZpbmVkKHNob3J0TmFtZSlcblx0XHRhd2FpdCBleGVjQ21kICdkZW5vJywgW1xuXHRcdFx0J2luc3RhbGwnLFxuXHRcdFx0Jy1mZ0EnLFxuXHRcdFx0Jy1uJyxcblx0XHRcdHNob3J0TmFtZSxcblx0XHRcdFwic3JjL2Jpbi8je3N0dWJ9LmpzXCJcblx0XHRcdF1cblx0cmV0dXJuXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4jIC0tLSBUTyBETzogaWYgZmlsZSAnY29tcGlsZS5jb25maWcuanMnIGV4aXN0c1xuIyAgICAgICAgICAgIGluIGN1cnJlbnQgZGlyLCB1c2UgdGhhdFxuXG5leHBvcnQgZ2V0Q29uZmlnIDo9ICgpID0+XG5cblx0cmV0dXJuIHtcblx0XHRoQ29tcGlsZXJzOiB7XG5cdFx0XHQnLmNpZWxvJzoge1xuXHRcdFx0XHRvdXRFeHQ6ICcuanMnXG5cdFx0XHRcdGNvbXBpbGVyOiAocGF0aCkgPT5cblx0XHRcdFx0XHRhc3NlcnQgaXNGaWxlKHBhdGgpLCBcIk5vIHN1Y2ggZmlsZTogI3tPTChwYXRoKX1cIlxuXHRcdFx0XHRcdGNpdmV0UGF0aCA6PSB3aXRoRXh0KHBhdGgsICcudGVtcC5jaXZldCcpXG5cdFx0XHRcdFx0cm1GaWxlIGNpdmV0UGF0aFxuXHRcdFx0XHRcdGNpZWxvMmNpdmV0IHBhdGgsIGNpdmV0UGF0aFxuXHRcdFx0XHRcdGNpdmV0MmpzIGNpdmV0UGF0aCwgd2l0aEV4dChwYXRoLCAnLmpzJylcblx0XHRcdFx0fVxuXHRcdFx0Jy5jaXZldCc6IHtcblx0XHRcdFx0b3V0RXh0OiAnLmpzJ1xuXHRcdFx0XHRjb21waWxlcjogKHBhdGgpID0+XG5cdFx0XHRcdFx0Y2l2ZXQyanMgcGF0aCwgd2l0aEV4dChwYXRoLCAnLmpzJylcblx0XHRcdFx0fVxuXHRcdFx0Jy5jb2ZmZWUnOiB7XG5cdFx0XHRcdG91dEV4dDogJy5qcydcblx0XHRcdFx0Y29tcGlsZXI6IChwYXRoKSA9PlxuXHRcdFx0XHRcdGNvZmZlZTJqcyBwYXRoLCB3aXRoRXh0KHBhdGgsICcuanMnKVxuXHRcdFx0XHR9XG5cdFx0XHQnLnRzJzoge1xuXHRcdFx0XHRvdXRFeHQ6ICcuanMnXG5cdFx0XHRcdGNvbXBpbGVyOiAocGF0aCkgPT5cblx0XHRcdFx0XHR0czJqcyBwYXRoLCB3aXRoRXh0KHBhdGgsICcuanMnKVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0aFBvc3RQcm9jZXNzb3JzOiB7XG5cdFx0XHQndGVzdCc6IHtcblx0XHRcdFx0ZGlyOiAndGVzdCcgICAgIyAtLS0gbm8gcG9zdCBwcm9jZXNzaW5nXG5cdFx0XHRcdH1cblx0XHRcdCdsaWInOiB7XG5cdFx0XHRcdGRpcjogJ3NyYy9saWInXG5cdFx0XHRcdHBvc3RQcm9jZXNzb3I6IChzdHViLCBoT3B0aW9ucykgPT5cblx0XHRcdFx0XHR0ZXN0UGF0aCA6PSBmaW5kU291cmNlRmlsZSgndGVzdCcsIHN0dWIsICd0ZXN0JykucGF0aFxuXHRcdFx0XHRcdGlmIGRlZmluZWQodGVzdFBhdGgpXG5cdFx0XHRcdFx0XHR7c3RhdHVzfSA6PSBjb21waWxlRmlsZSh0ZXN0UGF0aCwgaE9wdGlvbnMpXG5cdFx0XHRcdH1cblx0XHRcdCdiaW4nOiB7XG5cdFx0XHRcdGRpcjogJ3NyYy9iaW4nXG5cdFx0XHRcdHBvc3RQcm9jZXNzb3I6IChzdHViLCBoT3B0aW9ucykgPT5cblx0XHRcdFx0XHRMT0cgXCItIGluc3RhbGxpbmcgY29tbWFuZCAje3N0dWJ9XCJcblx0XHRcdFx0XHRpbnN0YWxsRGVub0NtZCBzdHViLCBoT3B0aW9uc1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5leHBvcnQgaENvbmZpZyA6PSBnZXRDb25maWcoKVxuZXhwb3J0IGhDb21waWxlcnMgOj0gaENvbmZpZy5oQ29tcGlsZXJzXG5leHBvcnQgbENvbXBpbGVyRXh0ZW5zaW9ucyA6PSBPYmplY3Qua2V5cyhoQ29tcGlsZXJzKVxuZXhwb3J0IGhQb3N0UHJvY2Vzc29ycyA6PSBoQ29uZmlnLmhQb3N0UHJvY2Vzc29yc1xuZXhwb3J0IGxEaXJTcGVjcyA6PSBPYmplY3Qua2V5cyhoUG9zdFByb2Nlc3NvcnMpXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4jIC0tLSByZXR1cm5zIFtjb21waWxlciwgb3V0RXh0XVxuIyAgICAgb3IgW3VuZGVmLCB1bmRlZl0gaWYgdGhlcmUgaXMgbm8gY29tcGlsZXJcblxuZXhwb3J0IGdldENvbXBpbGVyIDo9IChleHQpID0+XG5cblx0aCA6PSBoQ29tcGlsZXJzW2V4dF1cblx0aWYgbm90ZGVmaW5lZChoKVxuXHRcdERCRyBcIk5vdCBjb21waWxpbmcgLSBubyBjb21waWxlciBmb3IgI3tleHR9IGZpbGVzXCJcblx0XHRyZXR1cm4gW3VuZGVmLCB1bmRlZl1cblxuXHRhc3NlcnQgaXNIYXNoKGgpLCBcImhDb21waWxlcnNbI3tleHR9XSBub3QgYSBoYXNoOiAje09MKGgpfVwiXG5cdHtvdXRFeHQsIGNvbXBpbGVyfSA6PSBoXG5cdGFzc2VydCBkZWZpbmVkKGNvbXBpbGVyKSwgXCJNaXNzaW5nIGNvbXBpbGVyIGluIGNvbmZpZyBmb3IgI3tPTChleHQpfVwiXG5cdGFzc2VydCBkZWZpbmVkKG91dEV4dCksIFwiTWlzc2luZyBvdXRFeHQgaW4gY29uZmlnIGZvciAje09MKGV4dCl9XCJcblx0cmV0dXJuIFtjb21waWxlciwgb3V0RXh0XVxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG5leHBvcnQgaXNTdHViIDo9IChzdHIpID0+XG5cblx0cmV0dXJuIG5vdGRlZmluZWQoc3RyLm1hdGNoKC9bXFwuXFxcXFxcL10vKSlcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuZXhwb3J0IGlzRGlyU3BlYyA6PSAoZGlyc3BlYykgPT5cblxuXHRyZXR1cm4gbERpclNwZWNzLmluY2x1ZGVzKGRpcnNwZWMpXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4jIC0tLSBSZXR1cm5zIHtwYXRoLCBkaXJzcGVjfVxuXG5leHBvcnQgZmluZFNvdXJjZUZpbGUgOj0gKGRpcnNwZWMsIHN0dWIsIHB1cnBvc2UpID0+XG5cblx0YXNzZXJ0IGlzU3R1YihzdHViKSwgXCJCYWQgc3R1YjogI3tPTChzdHViKX1cIlxuXHRpZiBkZWZpbmVkKGRpcnNwZWMpXG5cdFx0YXNzZXJ0IGxEaXJTcGVjcy5pbmNsdWRlcyhkaXJzcGVjKSwgXCJCYWQgZGlyc3BlYzogI3tPTChkaXJzcGVjKX1cIlxuXHRcdGRpciA6PSBoUG9zdFByb2Nlc3NvcnNbZGlyc3BlY10uZGlyXG5cblx0XHQjIC0tLSBUcnkgZXZlcnkgc3VwcG9ydGVkIGZpbGUgZXh0ZW5zaW9uXG5cdFx0Zm9yIGV4dCBvZiBsQ29tcGlsZXJFeHRlbnNpb25zXG5cdFx0XHRwYXRoIDo9IChcblx0XHRcdFx0ZGVmaW5lZChwdXJwb3NlKVxuXHRcdFx0XHRcdD8gbWtwYXRoKGRpciwgXCIje3N0dWJ9LiN7cHVycG9zZX0je2V4dH1cIilcblx0XHRcdFx0XHQ6IG1rcGF0aChkaXIsIFwiI3tzdHVifSN7ZXh0fVwiKVxuXHRcdFx0XHQpXG5cdFx0XHRpZiBpc0ZpbGUgcGF0aFxuXHRcdFx0XHRyZXR1cm4ge3BhdGgsIGRpcnNwZWN9XG5cdFx0cmV0dXJuIHt9XG5cdGVsc2Vcblx0XHQjIC0tLSBJZiBkaXJzcGVjIGlzIHVuZGVmLCB3ZSBzZWFyY2ggYWxsIHBvc3NpYmxlIGRpcnNwZWNzXG5cdFx0IyAgICAgYnV0IHRocm93IGV4Y2VwdGlvbiBpZiBpdCdzIGZvdW5kIGluIG1vcmUgdGhhbiBvbmVcblxuXHRcdGxldCBbZm91bmRQYXRoLCBkc3BlY10gPSBbdW5kZWYsIHVuZGVmXVxuXHRcdGZvciBkcyBvZiBsRGlyU3BlY3Ncblx0XHRcdGggOj0gZmluZFNvdXJjZUZpbGUgZHMsIHN0dWIsIHB1cnBvc2Vcblx0XHRcdGlmIGRlZmluZWQoaC5wYXRoLCBoLmRpcnNwZWMpXG5cdFx0XHRcdGlmIGRlZmluZWQoZm91bmRQYXRoKVxuXHRcdFx0XHRcdGNyb2FrIFwiQW1iaWd1b3VzOiBbI3tkaXJzcGVjfSwgI3tzdHVifV1cIlxuXHRcdFx0XHRmb3VuZFBhdGggPSBoLnBhdGhcblx0XHRcdFx0ZHNwZWMgPSBoLmRpcnNwZWNcblx0XHRpZiBkZWZpbmVkKGZvdW5kUGF0aCwgZHNwZWMpXG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRwYXRoOiBmb3VuZFBhdGgsXG5cdFx0XHRcdGRpcnNwZWM6IGRzcGVjXG5cdFx0XHRcdH1cblx0XHRlbHNlXG5cdFx0XHRyZXR1cm4ge31cblxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuIyAtLS0gcmV0dXJucyB7cGF0aCwgZGlyc3BlYywgc3R1YiwgcHVycG9zZSwgZXh0fVxuIyAgICAgICAgcmV0dXJucyB7fSBpZiB0aGUgZmlsZSBkb2VzIG5vdCBleGlzdFxuIyAgICAgICAgZGlyc3BlYyBhbmQgc3R1YiBhcmUgdW5kZWYgaWYgZmlsZSBleGlzdHMsIGJ1dFxuIyAgICAgICAgICAgaXNuJ3QgaW4gLi9zcmMvbGliLCAuL3NyYy9iaW4gb3IgLi90ZXN0IGZvbGRlcnNcblxuZXhwb3J0IGdldFNyY0luZm8gOj0gKHNyYykgPT5cblxuXHRpZiBpc0FycmF5KHNyYylcblx0XHQjIC0tIE5PVEU6IHNyYyBjYW4gYmUgW3VuZGVmLCA8c3R1Yj5dLCBpbiB3aGljaCBjYXNlXG5cdFx0IyAgICAgICAgICB0aGVyZSBjYW4gYmUgb25seSBvbmUgZGlyc3BlYyB0aGF0XG5cdFx0IyAgICAgICAgICByZXN1bHRzIGluIGFuIGV4aXN0aW5nIGZpbGVcblxuXHRcdFtkc3BlYywgc3R1YiwgcHVycG9zZV0gOj0gc3JjXG5cdFx0e3BhdGgsIGRpcnNwZWN9IDo9IGZpbmRTb3VyY2VGaWxlKGRzcGVjLCBzdHViLCBwdXJwb3NlKVxuXHRcdGlmIGlzRmlsZSBwYXRoXG5cdFx0XHR7c3R1YiwgcHVycG9zZSwgZXh0LCByZWxQYXRofSA6PSBwYXJzZVBhdGgocGF0aClcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdHBhdGhcblx0XHRcdFx0cmVsUGF0aFxuXHRcdFx0XHRkaXJzcGVjXG5cdFx0XHRcdHN0dWJcblx0XHRcdFx0cHVycG9zZVxuXHRcdFx0XHRleHRcblx0XHRcdFx0fVxuXHRcdGVsc2Vcblx0XHRcdHJldHVybiB7fVxuXHRlbHNlIGlmIGlzRmlsZShzcmMpXG5cdFx0e3N0dWIsIHB1cnBvc2UsIGV4dCwgcmVsUGF0aH0gOj0gcGFyc2VQYXRoKHNyYylcblx0XHRkaXJzcGVjIDo9IChcblx0XHRcdHJlbFBhdGguc3RhcnRzV2l0aCgnc3JjL2xpYi8nKSAgICAgPyAnbGliJ1xuXHRcdFx0OiByZWxQYXRoLnN0YXJ0c1dpdGgoJy4vc3JjL2xpYi8nKSA/ICdsaWInXG5cdFx0XHQ6IHJlbFBhdGguc3RhcnRzV2l0aCgnc3JjL2Jpbi8nKSAgID8gJ2Jpbidcblx0XHRcdDogcmVsUGF0aC5zdGFydHNXaXRoKCcuL3NyYy9iaW4vJykgPyAnYmluJ1xuXHRcdFx0OiByZWxQYXRoLnN0YXJ0c1dpdGgoJ3Rlc3QvJykgICAgICA/ICd0ZXN0J1xuXHRcdFx0OiByZWxQYXRoLnN0YXJ0c1dpdGgoJy4vdGVzdC8nKSAgICA/ICd0ZXN0J1xuXHRcdFx0OiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHVuZGVmKVxuXHRcdHJldHVybiB7XG5cdFx0XHRwYXRoOiBzcmNcblx0XHRcdHJlbFBhdGhcblx0XHRcdGRpcnNwZWNcblx0XHRcdHN0dWI6IGRlZmluZWQoZGlyc3BlYykgPyBzdHViIDogdW5kZWZcblx0XHRcdHB1cnBvc2Vcblx0XHRcdGV4dFxuXHRcdFx0fVxuXHRlbHNlXG5cdFx0cmV0dXJuIHt9XG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4jIC0tLSBzcmMgY2FuIGJlIGEgZnVsbCBwYXRoIG9yIFtkaXJzcGVjLCBzdHViLCBwdXJwb3NlXVxuIyAgICAgICAgd2hlcmUgZGlyc3BlYyBjYW4gYmUgJ2xpYicsICdiaW4nIG9yICd0ZXN0J1xuIyAgICAgdGhyb3dzIGVycm9yIGlmIGZpbGUgZG9lcyBub3QgZXhpc3RcbiNcbiMgICAgIFBvc3NpYmxlIHN0YXR1cyB2YWx1ZXM6XG4jICAgICAgICAndGVtcCcgICAgICAgLSBpdCB3YXMgYSB0ZW1wIGZpbGUsIG5vdCBjb21waWxlZFxuIyAgICAgICAgJ25vY29tcGlsZXInIC0gaGFzIG5vIGNvbXBpbGVyLCBub3QgY29tcGlsZWRcbiMgICAgICAgICdleGlzdHMnICAgICAtIG5ld2VyIGNvbXBpbGVkIGZpbGUgYWxyZWFkeSBleGlzdHNcbiMgICAgICAgICdmYWlsZWQnICAgICAtIGNvbXBpbGluZyBmYWlsZWRcbiMgICAgICAgICdjb21waWxlZCcgICAtIHN1Y2Nlc3NmdWxseSBjb21waWxlZFxuXG5leHBvcnQgY29tcGlsZUZpbGUgOj0gKHNyYywgaE9wdGlvbnM9e30pID0+XG5cblx0REJHIFwiQ09NUElMRTogI3tPTChzcmMpfVwiLCBJTkRFTlRcblxuXHR7ZGlyc3BlYywgc3R1YiwgcGF0aCwgcmVsUGF0aCwgcHVycG9zZSwgZXh0fSA6PSBnZXRTcmNJbmZvIHNyY1xuXHRpZiBub3RkZWZpbmVkKHJlbFBhdGgpXG5cdFx0RVJSIFwiTm8gc3VjaCBmaWxlOiAje09MKHJlbFBhdGgpfSAoY29tcGlsZUZpbGUpXCIsIFVOREVOVFxuXHRcdHJldHVybiB7XG5cdFx0XHRzdGF0dXM6ICdub2ZpbGUnXG5cdFx0XHR9XG5cdGlmIChwdXJwb3NlID09ICd0ZW1wJylcblx0XHREQkcgXCJOb3QgY29tcGlsaW5nIHRlbXAgZmlsZSAje09MKHJlbFBhdGgpfVwiLCBVTkRFTlRcblx0XHRyZXR1cm4ge1xuXHRcdFx0cGF0aFxuXHRcdFx0cmVsUGF0aFxuXHRcdFx0c3RhdHVzOiAndGVtcCdcblx0XHRcdH1cblxuXHRbY29tcGlsZXIsIG91dEV4dF0gOj0gZ2V0Q29tcGlsZXIoZXh0KVxuXHRpZiBub3RkZWZpbmVkKGNvbXBpbGVyKVxuXHRcdERCRyBcIk5vdCBjb21waWxpbmcgLSBubyBjb21waWxlciBmb3IgI3tleHR9XCIsIFVOREVOVFxuXHRcdHJldHVybiB7XG5cdFx0XHRwYXRoXG5cdFx0XHRyZWxQYXRoXG5cdFx0XHRzdGF0dXM6ICdub2NvbXBpbGVyJ1xuXHRcdFx0fVxuXG5cdHtmb3JjZSwgbm9wcH0gOj0gZ2V0T3B0aW9ucyBoT3B0aW9ucywge1xuXHRcdGZvcmNlOiBmYWxzZVxuXHRcdG5vcHA6IGZhbHNlXG5cdFx0fVxuXG5cdG91dFBhdGggOj0gd2l0aEV4dChyZWxQYXRoLCBvdXRFeHQpXG5cdGlmIG5ld2VyRGVzdEZpbGVFeGlzdHMocmVsUGF0aCwgb3V0UGF0aCkgJiYgbm90IGZvcmNlXG5cdFx0REJHIFwiTm90IGNvbXBpbGluZywgbmV3ZXIgI3tvdXRQYXRofSBleGlzdHNcIiwgVU5ERU5UXG5cdFx0cmV0dXJuIHtcblx0XHRcdHBhdGhcblx0XHRcdHJlbFBhdGhcblx0XHRcdHN0YXR1czogJ2V4aXN0cydcblx0XHRcdG91dFBhdGhcblx0XHRcdH1cblxuXHREQkcgXCJObyBuZXdlciBkZXN0IGZpbGUgZXhpc3RzXCJcblx0aWYgaXNGaWxlKG91dFBhdGgpXG5cdFx0REJHIFwicmVtb3Zpbmcgb2xkZXIgI3tvdXRQYXRofVwiXG5cdFx0cm1GaWxlIG91dFBhdGhcblx0REJHIFwiY29tcGlsaW5nICN7T0wocmVsUGF0aCl9XCJcblx0Y29tcGlsZXIgcmVsUGF0aCAgICAgIyBwcm9kdWNlcyBmaWxlIG91dFBhdGgsIG1heSB0aHJvd1xuXG5cdGlmIGlzRmlsZShvdXRQYXRoKVxuXHRcdCMgLS0tIElmIGZpcnN0IGxpbmUgaXMgYSBmaWxlIG5hbWUgd2l0aCBvcmlnaW5hbCBleHRlbnNpb24sXG5cdFx0IyAgICAgcmVwbGFjZSB0aGUgZmlsZSBleHRlbnNpb25cblx0XHRjb250ZW50cyA6PSBEZW5vLnJlYWRUZXh0RmlsZVN5bmMgb3V0UGF0aFxuXHRcdGxMaW5lcyA6PSBjb250ZW50cy5zcGxpdCBcIlxcblwiXG5cdFx0bExpbmVzWzBdLnJlcGxhY2UgZXh0LCBvdXRFeHRcblx0XHREZW5vLndyaXRlVGV4dEZpbGVTeW5jIG91dFBhdGgsIGxMaW5lcy5qb2luKFwiXFxuXCIpXG5cdGVsc2Vcblx0XHRFUlIgXCJPdXRwdXQgZmlsZSAje3JlbHBhdGgob3V0UGF0aCl9IG5vdCBwcm9kdWNlZFwiLCBVTkRFTlRcblx0XHRyZXR1cm4ge1xuXHRcdFx0cGF0aFxuXHRcdFx0cmVsUGF0aFxuXHRcdFx0c3RhdHVzOiAnZmFpbGVkJ1xuXHRcdFx0b3V0UGF0aFxuXHRcdFx0fVxuXG5cdGlmIGRlZmluZWQoZGlyc3BlYykgJiYgbm90IG5vcHBcblx0XHRwb3N0UHJvYyA6PSBoUG9zdFByb2Nlc3NvcnNbZGlyc3BlY10ucG9zdFByb2Nlc3NvclxuXHRcdGlmIGRlZmluZWQocG9zdFByb2MpXG5cdFx0XHREQkcgXCJwb3N0LXByb2Nlc3NpbmcgZmlsZVwiXG5cdFx0XHRwb3N0UHJvYyBzdHViLCBoT3B0aW9uc1xuXG5cdERCRyBVTkRFTlRcblx0cmV0dXJuIHtcblx0XHRwYXRoXG5cdFx0cmVsUGF0aFxuXHRcdHN0YXR1czogJ2NvbXBpbGVkJ1xuXHRcdG91dFBhdGhcblx0XHR9XG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbmV4cG9ydCBnZXRQYXR0ZXJuIDo9ICgpID0+XG5cblx0bEtleXMgOj0gT2JqZWN0LmtleXMoaENvbXBpbGVycylcblx0aWYgKGxLZXlzLmxlbmd0aCA9PSAxKVxuXHRcdHJldHVybiBcIioqLyoje2xLZXlzWzBdfVwiXG5cdGVsc2Vcblx0XHRyZXR1cm4gXCIqKi8qeyN7bEtleXMuam9pbignLCcpfX1cIlxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuIyAtLS0gQSBnZW5lcmF0b3IgLSB5aWVsZHMge3BhdGgsIHN0YXR1cywgb3V0UGF0aH1cblxuZXhwb3J0IGNvbXBpbGVBbGxGaWxlcyA6PSAocGF0dGVybj11bmRlZiwgaE9wdGlvbnM9e30pIC0+XG5cblx0e2ZvcmNlfSA6PSBnZXRPcHRpb25zIGhPcHRpb25zLCB7XG5cdFx0Zm9yY2U6IGZhbHNlXG5cdFx0fVxuXG5cdGhHbG9iT3B0aW9ucyA6PSB7XG5cdFx0ZXhjbHVkZTogW1xuXHRcdFx0J25vZGVfbW9kdWxlcy8qKidcblx0XHRcdCcuZ2l0LyoqJ1xuXHRcdFx0JyoqLyoudGVtcC4qJyAgIyAtLS0gZG9uJ3QgY29tcGlsZSB0ZW1wIGZpbGVzXG5cdFx0XHRdXG5cdFx0fVxuXG5cdGdsb2JQYXR0ZXJuIDo9IGRlZmluZWQocGF0dGVybikgPyBwYXR0ZXJuIDogZ2V0UGF0dGVybigpXG5cdERCRyBcImNvbXBpbGluZyBhbGwgZmlsZXMsIGZvcmNlPSN7Zm9yY2V9LCBwYXQ9I3tPTChnbG9iUGF0dGVybil9XCJcblx0Zm9yIHtwYXRofSBvZiBnbG9iRmlsZXMoZ2xvYlBhdHRlcm4sIGhHbG9iT3B0aW9ucylcblx0XHRoUmVzdWx0IDo9IGNvbXBpbGVGaWxlKHBhdGgsIGhPcHRpb25zKVxuXHRcdGlmIChoUmVzdWx0LnN0YXR1cyA9PSAnY29tcGlsZWQnKVxuXHRcdFx0eWllbGQgaFJlc3VsdFxuXHRyZXR1cm5cblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuZXhwb3J0IHJ1blVuaXRUZXN0IDo9IChzdHViLCBoQ29tcGlsZU9wdGlvbnM9e30pID0+XG5cblx0REJHIFwiUnVubmluZyB1bml0IHRlc3QgI3tzdHVifVwiXG5cblx0IyAtLS0gQ2hlY2sgaWYgdGhlcmUncyBhIGNvcnJlc3BvbmRpbmcgbGlicmFyeSBmaWxlXG5cdGxpYlBhdGggOj0gZmluZFNvdXJjZUZpbGUoJ2xpYicsIHN0dWIpLnBhdGhcblx0aWYgZGVmaW5lZChsaWJQYXRoKVxuXHRcdGlmIGlzRmlsZShsaWJQYXRoKVxuXHRcdFx0IyAtLS0gTWFrZSBzdXJlIHRoZSBsaWJyYXJ5IGlzIGNvbXBpbGVkXG5cdFx0XHR7c3RhdHVzLCBvdXRQYXRofSA6PSBjb21waWxlRmlsZSBsaWJQYXRoLCBoQ29tcGlsZU9wdGlvbnNcblx0XHRcdGlmIChzdGF0dXMgPT0gJ2ZhaWxlZCcpXG5cdFx0XHRcdFdBUk4gXCJDb21waWxlIG9mIGxpYiAje3JlbHBhdGgobGliUGF0aCl9IGZhaWxlZCAtICN7c3RhdHVzfVwiXG5cdFx0ZWxzZVxuXHRlbHNlXG5cdFx0REJHIFwiTm8gY29ycmVzcG9uZGluZyBsaWJyYXJ5IGZpbGUgZm9yICN7T0woc3R1Yil9XCJcblxuXHQjIC0tLSBDaGVjayBpZiB0aGVyZSdzIGEgY29ycmVzcG9uZGluZyBiaW5hcnkgZmlsZVxuXHRiaW5QYXRoIDo9IGZpbmRTb3VyY2VGaWxlKCdiaW4nLCBzdHViKS5wYXRoXG5cdGlmIGlzRmlsZShiaW5QYXRoKVxuXHRcdCMgLS0tIE1ha2Ugc3VyZSB0aGUgYmluYXJ5IGlzIGNvbXBpbGVkXG5cdFx0e3N0YXR1cywgb3V0UGF0aH0gOj0gY29tcGlsZUZpbGUgYmluUGF0aCwgaENvbXBpbGVPcHRpb25zXG5cdFx0aWYgKHN0YXR1cyA9PSAnZmFpbGVkJylcblx0XHRcdFdBUk4gXCJDb21waWxlIG9mIGJpbiAje3JlbHBhdGgoYmluUGF0aCl9IGZhaWxlZCAtICN7c3RhdHVzfVwiXG5cdGVsc2Vcblx0XHREQkcgXCJObyBjb3JyZXNwb25kaW5nIGJpbiBmaWxlIGZvciAje09MKHN0dWIpfVwiXG5cblx0IyAtLS0gTWFrZSBzdXJlIHVuaXQgdGVzdCBmaWxlIGlzIGNvbXBpbGVkXG5cdCMgICAgIE5PVEU6ICoudGVzdC5qcyBmaWxlIG1heSBleGlzdCB3aXRob3V0IGEgKi50ZXN0LmNpdmV0IGZpbGVcblx0IyAgICAgICAgICAgZS5nLiBiYXNlLnRlc3QuanNcblx0dGVzdFBhdGggOj0gZmluZFNvdXJjZUZpbGUoJ3Rlc3QnLCBzdHViLCAndGVzdCcpLnBhdGhcblx0bGV0IHRlc3RPdXRQYXRoID0gdW5kZWZcblx0aWYgZGVmaW5lZCh0ZXN0UGF0aClcblx0XHREQkcgXCJ0ZXN0UGF0aCA9ICN7T0wodGVzdFBhdGgpfVwiXG5cdFx0YXNzZXJ0IGlzRmlsZSh0ZXN0UGF0aCksIFwiTm8gc3VjaCBmaWxlOiAje09MKHRlc3RQYXRoKX0gKHJ1blVuaXRUZXN0KVwiXG5cblx0XHR7c3RhdHVzLCBvdXRQYXRofSA6PSBjb21waWxlRmlsZSB0ZXN0UGF0aCwgaENvbXBpbGVPcHRpb25zXG5cdFx0aWYgKHN0YXR1cyA9PSAnZmFpbGVkJylcblx0XHRcdGNyb2FrIFwiQ29tcGlsZSBvZiAje3JlbHBhdGgodGVzdFBhdGgpfSBmYWlsZWRcIlxuXHRcdHRlc3RPdXRQYXRoID0gb3V0UGF0aFxuXHRlbHNlXG5cdFx0dGVzdE91dFBhdGggPSBcInRlc3QvI3tzdHVifS50ZXN0LmpzXCJcblxuXHQjIC0tLSBDb21waWxlIGFsbCBmaWxlcyBpbiBzdWJkaXIgaWYgaXQgZXhpc3RzXG5cdGlmIGlzRGlyKFwidGVzdC8je3N0dWJ9XCIpXG5cdFx0Zm9yIHtwYXRoLCBzdGF0dXMsIG91dFBhdGh9IG9mIGNvbXBpbGVBbGxGaWxlcyhcInRlc3QvI3tzdHVifS8qXCIpXG5cdFx0XHRpZiBub3RkZWZpbmVkKG91dFBhdGgpXG5cdFx0XHRcdFdBUk4gXCJGaWxlICN7T0wocGF0aCl9IG5vdCBjb21waWxlZFwiXG5cblx0IyAtLS0gUnVuIHRoZSB1bml0IHRlc3QsIHJldHVybiByZXR1cm4gY29kZVxuXHRhc3NlcnQgaXNGaWxlKHRlc3RPdXRQYXRoKSwgXCJObyBzdWNoIGZpbGU6ICN7T0wodGVzdE91dFBhdGgpfVwiXG5cdHJldHVybiBleGVjQ21kU3luYyAnZGVubycsIFtcblx0XHRcdCd0ZXN0Jyxcblx0XHRcdCctcUEnLFxuXHRcdFx0dGVzdE91dFBhdGhcblx0XHRcdF1cblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiMgLS0tIGEgZ2VuZXJhdG9yXG5cbmV4cG9ydCBydW5BbGxVbml0VGVzdHMgOj0gKGhDb21waWxlT3B0aW9ucz17fSkgLT5cblxuXHRoR2xvYk9wdGlvbnMgOj0ge1xuXHRcdGV4Y2x1ZGU6IFsnbm9kZV9tb2R1bGVzLyoqJywgJy5naXQvKionXVxuXHRcdH1cblxuXHRwYXR0ZXJuIDo9ICd0ZXN0LyoudGVzdC5qcydcblx0REJHIFwicGF0dGVybiA9ICN7T0wocGF0dGVybil9XCJcblx0Zm9yIHtwYXRofSBvZiBnbG9iRmlsZXMocGF0dGVybiwgaEdsb2JPcHRpb25zKVxuXHRcdHtzdHViLCBleHQsIHJlbERpcn0gOj0gcGFyc2VQYXRoKHBhdGgpXG5cdFx0REJHIFwiVEVTVDogI3twYXRofVwiXG5cdFx0eWllbGQgcnVuVW5pdFRlc3Qoc3R1YiwgaENvbXBpbGVPcHRpb25zKVxuXHRyZXR1cm5cblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuZXhwb3J0IGdldENtZEFyZ3MgOj0gKGxBcmdzPURlbm8uYXJncywgaE9wdGlvbnM9e30pID0+XG5cblx0YXNzZXJ0IGlzSGFzaChoT3B0aW9ucyksIFwiaE9wdGlvbnMgbm90IGEgaGFzaDogI3tPTChoT3B0aW9ucyl9XCJcblx0e2hBcmdzLCBub25PcHRpb25zLCBkb1NldExvZ2dlcn0gOj0gZ2V0T3B0aW9ucyBoT3B0aW9ucywge1xuXHRcdGhBcmdzOiB1bmRlZlxuXHRcdG5vbk9wdGlvbnM6IFswLCBJbmZpbml0eV1cblx0XHRkb1NldExvZ2dlcjogZmFsc2Vcblx0XHR9XG5cblx0aWYgZG9TZXRMb2dnZXIgJiYgZGVmaW5lZChoQXJncylcblx0XHRhc3NlcnQgbm90IGhhc0tleShoQXJncywgJ2QnKSwgXCJBcmcga2V5ICdkJyBzZXRcIlxuXHRcdGFzc2VydCBub3QgaGFzS2V5KGhBcmdzLCAncScpLCBcIkFyZyBrZXkgJ3EnIHNldFwiXG5cdFx0YXNzZXJ0IG5vdCBoYXNLZXkoaEFyZ3MsICdwJyksIFwiQXJnIGtleSAncCcgc2V0XCJcblxuXHRbbWluTm9uT3B0aW9ucywgbWF4Tm9uT3B0aW9uc10gOj0gKFxuXHRcdGlmIGlzQXJyYXkobm9uT3B0aW9ucylcblx0XHRcdG5vbk9wdGlvbnNcblx0XHRlbHNlXG5cdFx0XHRbbm9uT3B0aW9ucywgbm9uT3B0aW9uc11cblx0XHQpXG5cblx0bGV0IGhSZXN1bHQgPSB7XG5cdFx0XzogW11cblx0XHR9XG5cblx0IyAtLS0gUHJlLXByb2Nlc3MgbEFyZ3MsIHdoaWNoIG1ha2VzIGl0IGVhc2llclxuXHQjICAgICB0byBjaGVjayBpZiBjYWxscyB0byBEQkcoKSBzaG91bGQgYmUgbG9nZ2VkLFxuXHQjICAgICBldmVuIHdoaWxlIHBhcnNpbmcgYXJnc1xuXG5cdGxldCBsb2dnZXJUb1NldCA9IHVuZGVmXG5cblx0bEFyZ01hdGNoZXMgOj0gZm9yIHN0ciBvZiBsQXJnc1xuXHRcdGxNYXRjaGVzIDo9IHN0ci5tYXRjaCgvLy9eXG5cdFx0XHQtXG5cdFx0XHQoW0EtWmEtejAtOV8tXSopXG5cdFx0XHQoPzpcblx0XHRcdFx0KD0pXG5cdFx0XHRcdCguKilcblx0XHRcdFx0KT9cblx0XHRcdCQvLy8pXG5cdFx0aWYgZGVmaW5lZChsTWF0Y2hlcylcblx0XHRcdGlmIGRvU2V0TG9nZ2VyICYmIG5vdCBsTWF0Y2hlc1syXVxuXHRcdFx0XHRpZiBsTWF0Y2hlc1sxXS5pbmNsdWRlcygncCcpXG5cdFx0XHRcdFx0aFJlc3VsdC5wID0gdHJ1ZVxuXHRcdFx0XHRcdGxvZ2dlclRvU2V0ID0gJ3Byb2ZpbGUnXG5cdFx0XHRcdGVsc2UgaWYgbE1hdGNoZXNbMV0uaW5jbHVkZXMoJ2QnKVxuXHRcdFx0XHRcdGhSZXN1bHQuZCA9IHRydWVcblx0XHRcdFx0XHRsb2dnZXJUb1NldCA9ICdkZWJ1Zydcblx0XHRcdFx0ZWxzZSBpZiBsTWF0Y2hlc1sxXS5pbmNsdWRlcygncScpXG5cdFx0XHRcdFx0aFJlc3VsdC5xID0gdHJ1ZVxuXHRcdFx0XHRcdGxvZ2dlclRvU2V0ID0gJ2Vycm9yJ1xuXHRcdFx0bE1hdGNoZXNcblx0XHRlbHNlXG5cdFx0XHR1bmRlZlxuXG5cdGlmIGRvU2V0TG9nZ2VyXG5cdFx0c2V0TG9nTGV2ZWwobG9nZ2VyVG9TZXQgfHwgJ2luZm8nKVxuXG5cdCMgLS0tIFV0aWxpdHkgZnVuY3Rpb25zXG5cblx0YWRkIDo9IChuYW1lOiBzdHJpbmcsIGFsaWFzLCB2YWx1ZSkgPT5cblx0XHRhc3NlcnQgaXNTdHJpbmcobmFtZSksIFwiTm90IGEgc3RyaW5nOiAje09MKG5hbWUpfVwiXG5cdFx0aWYgZGVmaW5lZChhbGlhcylcblx0XHRcdGFzc2VydCBpc1N0cmluZyhhbGlhcyksIFwiTm90IGEgc3RyaW5nOiAje09MKGFsaWFzKX1cIlxuXHRcdGFzc2VydCBub3QgaGFzS2V5KGhSZXN1bHQsIG5hbWUpLCBcImR1cCBrZXkgI3tuYW1lfVwiXG5cdFx0aFJlc3VsdFtuYW1lXSA9IHZhbHVlXG5cdFx0aWYgYWxpYXNcblx0XHRcdGFzc2VydCBub3QgaGFzS2V5KGhSZXN1bHQsIGFsaWFzKSwgXCJkdXAga2V5ICN7YWxpYXN9XCJcblx0XHRcdGhSZXN1bHRbYWxpYXNdID0gdmFsdWVcblx0XHRyZXR1cm5cblxuXHRhZGRPcHRpb24gOj0gKG5hbWUsIHZhbHVlKSA9PlxuXHRcdGlmIG5vdGRlZmluZWQoaEFyZ3MpXG5cdFx0XHRoUmVzdWx0W25hbWVdID0gdmFsdWVcblx0XHRcdHJldHVyblxuXG5cdFx0aWYgZG9TZXRMb2dnZXIgJiYgWydkJywncScsJ3AnXS5pbmNsdWRlcyhuYW1lKVxuXHRcdFx0cmV0dXJuXG5cblx0XHRlcnJNc2cgOj0gXCJCYWQgYXJnOiAje09MKG5hbWUpfVwiXG5cdFx0YXNzZXJ0IGRlZmluZWQoaEFyZ3NbbmFtZV0pLCBlcnJNc2dcblx0XHR7dHlwZSwgYWxpYXN9IDo9IGhBcmdzW25hbWVdXG5cblx0XHQjIC0tLSB0eXBlIGNoZWNraW5nXG5cdFx0aWYgaXNBcnJheSh0eXBlKVxuXHRcdFx0YXNzZXJ0IHR5cGUuaW5jbHVkZXModmFsdWUpXG5cdFx0XHRhZGQgbmFtZSwgYWxpYXMsIHZhbHVlXG5cdFx0ZWxzZVxuXHRcdFx0c3dpdGNoIHR5cGVcblx0XHRcdFx0d2hlbiAnc3RyaW5nJ1xuXHRcdFx0XHRcdGFkZCBuYW1lLCBhbGlhcywgdmFsdWVcblx0XHRcdFx0d2hlbiAnYm9vbGVhbicsIHVuZGVmXG5cdFx0XHRcdFx0aWYgKHZhbHVlID09ICd0cnVlJylcblx0XHRcdFx0XHRcdGFkZCBuYW1lLCBhbGlhcywgdHJ1ZVxuXHRcdFx0XHRcdGVsc2UgaWYgKHZhbHVlID09ICdmYWxzZScpXG5cdFx0XHRcdFx0XHRhZGQgbmFtZSwgYWxpYXMsIGZhbHNlXG5cdFx0XHRcdFx0ZWxzZVxuXHRcdFx0XHRcdFx0YWRkIG5hbWUsIGFsaWFzLCB2YWx1ZVxuXHRcdFx0XHR3aGVuICdudW1iZXInLCdmbG9hdCdcblx0XHRcdFx0XHRhZGQgbmFtZSwgYWxpYXMsIHBhcnNlRmxvYXQodmFsdWUpXG5cdFx0XHRcdHdoZW4gJ2ludGVnZXInXG5cdFx0XHRcdFx0YWRkIG5hbWUsIGFsaWFzLCBwYXJzZUludCh2YWx1ZSlcblx0XHRyZXR1cm5cblxuXHRhZGROb25PcHRpb24gOj0gKHN0cikgPT5cblx0XHRoUmVzdWx0Ll8ucHVzaCBzdHJcblxuXHQjIC0tLSBsQXJncyBpcyBhbiBhcnJheVxuXG5cdGZvciBzdHIsaSBvZiBsQXJnc1xuXHRcdCMgLS0tIGNoZWNrIGlmIGl0J3MgYW4gb3B0aW9uXG5cdFx0bE1hdGNoZXMgOj0gbEFyZ01hdGNoZXNbaV1cblx0XHRpZiBkZWZpbmVkKGxNYXRjaGVzKVxuXHRcdFx0IyAtLS0gaXQncyBhbiBvcHRpb25cblx0XHRcdFtfLCBvcHRTdHIsIGVxU3RyLCB2YWx1ZV0gOj0gbE1hdGNoZXNcblx0XHRcdGlmIGVxU3RyXG5cdFx0XHRcdGFkZE9wdGlvbiBvcHRTdHIsIHZhbHVlXG5cdFx0XHRlbHNlXG5cdFx0XHRcdGxDaGFycyA6PSBvcHRTdHIuc3BsaXQoJycpXG5cdFx0XHRcdGZvciBjaCBvZiBvcHRTdHIuc3BsaXQoJycpXG5cdFx0XHRcdFx0YWRkT3B0aW9uIGNoLCB0cnVlXG5cdFx0ZWxzZVxuXHRcdFx0IyAtLS0gaXQncyBhIG5vbi1vcHRpb25cblx0XHRcdGFkZE5vbk9wdGlvbiBzdHJcblxuXHRpZiBkZWZpbmVkKGhBcmdzKVxuXHRcdGZvciBuYW1lIG9mIE9iamVjdC5rZXlzKGhBcmdzKVxuXHRcdFx0aWYgbm90ZGVmaW5lZChoUmVzdWx0W25hbWVdKVxuXHRcdFx0XHR7YWxpYXMsIHR5cGUsIGRlZmF1bHRWYWx9IDo9IGhBcmdzW25hbWVdXG5cdFx0XHRcdGlmIGRlZmluZWQoZGVmYXVsdFZhbClcblx0XHRcdFx0XHRhZGQgbmFtZSwgYWxpYXMsIGRlZmF1bHRWYWxcblx0XHRcdFx0ZWxzZSBpZiBub3RkZWZpbmVkKHR5cGUpXG5cdFx0XHRcdFx0YWRkIG5hbWUsIGFsaWFzLCBmYWxzZVxuXG5cdG51bU5vbkFyZ3MgOj0gaFJlc3VsdC5fLmxlbmd0aFxuXHRhc3NlcnQgKG51bU5vbkFyZ3MgPj0gbWluTm9uT3B0aW9ucyksXG5cdFx0XCIje251bU5vbkFyZ3N9IG5vbi1hcmdzIDwgbWluICgje21pbk5vbk9wdGlvbnN9KVwiXG5cdGFzc2VydCAobnVtTm9uQXJncyA8PSBtYXhOb25PcHRpb25zKSxcblx0XHRcIiN7bnVtTm9uQXJnc30gbm9uLWFyZ3MgPiBtYXggKCN7bWF4Tm9uT3B0aW9uc30pXCJcblx0REJHIFwiaFJlc3VsdCA9ICN7T0woaFJlc3VsdCl9XCJcblx0cmV0dXJuIGhSZXN1bHRcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiMgLS0tIEFTWU5DICFcblxuZXhwb3J0IHNsZWVwID0gKHNlYykgPT5cblxuXHRhd2FpdCBuZXcgUHJvbWlzZSgocikgPT4gc2V0VGltZW91dChyLCAxMDAwICogc2VjKSlcblx0cmV0dXJuXG4iXX0=