"use strict";
// llutils.lib.civet

type AutoPromise<T> = Promise<Awaited<T>>;
import {createRequire} from "node:module"
import {sprintf} from "@std/fmt/printf"
import {relative} from '@std/path'

import {truncStr} from './typescript.lib.ts'
import {
	undef, defined, notdefined, assert, char, deepEqual,
	isHash, isArray, isNonEmptyString, isArrayOfStrings,
	isEmpty, nonEmpty, isString, isObject, isInteger,
	integer, hash, hashof, array, arrayof, voidFunc,
	TFilterFunc, isNonPrimitive, functionDef,
	} from './datatypes.lib.ts'

/**
 * @module llutils - low level utilities
 */

const llutilsLoadTime: integer = Date.now()

// ---------------------------------------------------------------------------
// --- Should be called like:
//        require := getImportSync(import.meta.url)

export const getImportSync = (url: string): Function => {

	return createRequire(url)
}

// ---------------------------------------------------------------------------

export const sinceLoad = (datetime: Date | integer = Date.now()) => {

	if (datetime instanceof Date) {
		return datetime.valueOf() - llutilsLoadTime
	}
	else {
		return datetime - llutilsLoadTime
	}
}

// ---------------------------------------------------------------------------

export const sinceLoadStr = (datetime: ((Date | integer) | undefined) = undef) => {

	return sprintf("%6d", sinceLoad(datetime))
}

// ---------------------------------------------------------------------------

/**
 * throws an exception with the provided message
 */

export const croak = (msg: string): never => {

	throw new Error(msg)
}

// ---------------------------------------------------------------------------

/**
 * Asserts that `cond` is true. If it isn't, an exception is
 * thrown with the given `msg`
 */

export const throwsError = (func: voidFunc, msg: string="Unexpected success"): void => {

	try {
		func()
		throw new Error(msg)
	}
	catch (err) {
		return
	}
}    // ignore error - it was expected

// ---------------------------------------------------------------------------

/**
 * Calling pass() does nothing
 */

export const pass = (): void => {}    // do nothing

// ---------------------------------------------------------------------------

/**
 * stringify any value, so that if we take the resultStr, we can
 *    let x = <resultStr>
 * to retrieve the original value (if no trunc option is passed in)
 */

export const stringify = (
	x: any,
	hOptions: hash={},
	level: number=0
	): string => {

	const {oneLine, compress, trunc} = getOptions(hOptions, {
		oneLine: false,
		compress: true,
		trunc: undef
		})

	const typeStr = typeof x
	let ref;switch(typeStr) {
		case 'undefined': {
			ref = 'undefined';break;
		}
		case 'object': {
			if (x === null) {
				ref = 'null'
			}
			else if (Array.isArray(x)) {
				const lParts =(()=>{const results=[];for (const item of x) { results.push( stringify(item, hOptions, level+1)) }return results})()
				if (oneLine) {
					ref = '[' + lParts.join(', ') + ']'
				}
				else {
					ref = '[\n' + lParts.join(',\n') + '\n]'
				}
			}
			else {
				const results1=[];for (const key in x) {const val = x[key];
					results1.push(`${key}: ${stringify(val, hOptions, level+1)}`)
				};const lParts =results1
				if (oneLine) {
					ref = '{' + lParts.join(', ') + '}'
				}
				else {
					ref = '{\n' + lParts.join(',\n') + '\n}'
				}
			};break;
		}
		case 'boolean': {
			ref = x ? 'true' : 'false';break;
		}
		case 'number': {
			ref = x.toString();break;
		}
		case 'bigint': {
			ref = x.toString() + 'n';break;
		}
		case 'string': {
			ref = `\"${escapeStr(x, o`style=C`)}\"`;break;
		}
		case 'symbol': {
			if (defined(x.description)) {
				ref = `Symbol(\"${x.description}\")`
			}
			else {
				ref = "Symbol()"
			};break;
		}
		case 'function': {
			ref = functionDef(x);break;
		}
	};const result =ref

	if (defined(trunc)) {
		return truncStr(result, trunc)
	}
	else {
		return result
	}
}

// ---------------------------------------------------------------------------

/**
 * JSON stringifies x on one line
 */

export const OL = (x: any): string => {

	if (x === undef) {
		return 'undef'
	}
	else if (x === null) {
		return 'null'
	}
	else if (typeof x === 'symbol') {
		if (defined(x.description)) {
			return `[Symbol ${x.description}]`
		}
		else {
			return "[Symbol]"
		}
		return 'symbol'
	}
	else if (typeof x === 'function') {
		return x.toString().replaceAll('\n', ' ')
	}
	else {
		const str = JSON.stringify(x, (k,v) => defined(v) ? v : '__undef__')
		return str.replaceAll('"__undef__"', 'undefined')
	}
}

// ---------------------------------------------------------------------------

export const ML = (x: any): string => {

	if (x === undef) {
		return 'undef'
	}
	else if (x === null) {
		return 'null'
	}
	else if (typeof x === 'function') {
		return x.toString()
	}
	else {
		const str = JSON.stringify(x, (k,v) => defined(v) ? v : '__undef__', 3)
		if (defined(str)) {
			return str.replaceAll('"__undef__"', 'undefined')
		}
		else {
			console.log(x)
			return "JSON.stringify returned undef!!!"
		}
	}
}

// ---------------------------------------------------------------------------

/**
 * Converts the given string to a hash
 * <word> becomes a key with a true value
 * !<word> becomes a keys with a false value
 * <word>=<string> becomes a key with value <string>
 *    - <string> must be quoted if it contains whitespace
 */

export const strToHash = (str: string): hash => {

	if (isEmpty(str)) {
		return {}
	}
	const h: hash = {}
	for (const word of str.trim().split(/\s+/)) {
		let ref1: string[] | null;if ((ref1 = word.match(/^(\!)?([A-Za-z][A-Za-z_0-9]*)(?:(=)(.*))?$/))) {const lMatches: string[] | null = ref1;
			const [_, neg, ident, eqSign, str] = lMatches
			if (isNonEmptyString(eqSign)) {
				assert(notdefined(neg) || (neg === ''),
						"negation with string value")

				// --- check if str is a valid number
				if (str.match(/^-?\d+(\.\d+)?$/)) {
					const num = parseFloat(str)
					if (Number.isNaN(num)) {
						// --- TO DO: interpret backslash escapes
						h[ident] = str
					}
					else {
						h[ident] = num
					}
				}
				else {
					h[ident] = str
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

export const o = (lStrings: TemplateStringsArray): hash => {

	return strToHash(lStrings[0])
}

// ---------------------------------------------------------------------------

/**
 * s - convert leading tabs to spaces
 */

export const s = (lStrings: TemplateStringsArray): string => {

	console.log("calling function s")
	const replacer = (match: string): string => {
		console.log(`match = <${escapeStr(match)}>`)
		const result = '   '.repeat(match.length)
		console.log(`result = <${escapeStr(result)}>`)
		return result
	}
	return lStrings[0].replaceAll(/^\t+/mg, replacer)
}

// ---------------------------------------------------------------------------

/**
 * t - convert leading spaces to tabs
 */

export const t = (lStrings: TemplateStringsArray): string => {

	const replacer = (match: string): string => {
		const level = Math.floor(match.length / 3)
		return '\t'.repeat(level)
	}
	return lStrings[0].replaceAll(/^\x20+/mg, replacer)
}

// ---------------------------------------------------------------------------

/**
 * Adds any keys in hDefaults that are missing in hOptions
 * to hOptions with their given values
 */

export const addDefaults = (hOptions: hash, hDefaults: hash): hash => {

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

/**
 * returns a hash of options with their values, using options
 * if it's a hash, or parsing options using strToHash() if
 * it's a string - adding any default values from hDefaults
 * if they're missing in the resulting hash
 */

export const getOptions = (hOptions: hash={}, hDefaults: hash={}): hash => {

	return addDefaults(hOptions, hDefaults)
}

// ---------------------------------------------------------------------------

export const getOneOption = (hOptions: hash={}, name: string, defVal: any) => {

	return hOptions[name] || defVal
}

// ---------------------------------------------------------------------------

/**
 * remove all keys from a hash that have either an empty name
 * or an empty value
 */

export const removeEmptyKeys = (h: hash): hash => {

	const hResult: hash = {}
	for (const key of keys(h)) {
		if (nonEmpty(key) && nonEmpty(h[key])) {
			hResult[key] = h[key]
		}
	}
	return hResult
}

// ---------------------------------------------------------------------------

/**
 * return an array of all own keys in a hash
 */

export const keys = (obj: hash, hOptions: hash={}): string[] => {

	const h = getOptions(hOptions, {
		except: []
		})

	let except = h.except

	if (isString(except)) {
		except = [except]
	}
	const lKeys: string[] = []
	for (const key of Object.keys(obj)) {
		if (!except.includes(key)) {
			lKeys.push(key)
		}
	}
	return lKeys
}

// ---------------------------------------------------------------------------

/**
 * returns true if either `h` is not defined, or if `h` is
 * a hash that includes all the keys provided
 */

export const hasKey = (h: hash, ...lKeys: string[]): boolean => {

	if (notdefined(h)) {
		return false
	}
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

export const missingKeys = (h: hash, ...lKeys: string[]): string[] => {

	if (notdefined(h)) {
		return lKeys
	}
	assert(isHash(h), `h not a hash: ${OL(h)}`)
	const lMissing: string[] = []
	for (const key of lKeys) {
		if (!h.hasOwnProperty(key)) {
			lMissing.push(key)
		}
	}
	return lMissing
}

// ---------------------------------------------------------------------------

/**
 * merges the provided objects into a new object
 * NOTE: none of the provided arguments are modified
 */

export const merge = (...lObjects: hash[]): hash => {

	return Object.assign({}, ...lObjects)
}

// ---------------------------------------------------------------------------

export const hit = (pct: number = 50): boolean => {

	return (100 * Math.random() < pct)
}

// ---------------------------------------------------------------------------
// --- ASYNC !

export const sleep = async (sec: number): AutoPromise<void> => {

	await new Promise((r) => setTimeout(r, 1000 * sec))
	return
}

// ---------------------------------------------------------------------------

export const sleepSync = (sec: number): void => {

	const start = Date.now()
	const end = Date.now() + 1000*sec
	while (Date.now() < end);
	return
}

// ---------------------------------------------------------------------------

/**
 * returns a string consisting of the given number
 * of space characters
 */

export const spaces = (n: number): string => {


	return (n <= 0) ? '' : ' '.repeat(n)
}

// ---------------------------------------------------------------------------

/**
 * returns a string consisting of the given number
 * of TAB characters
 */

export const tabs = (n: number): string => {

	return (n <= 0) ? '' : '\t'.repeat(n)
}

// ---------------------------------------------------------------------------

/**
 * rtrim - strip trailing whitespace
 */

export const rtrim = (line: string): string => {

	assert(isString(line), `not a string: ${typeof line}`)
	const lMatches = line.match(/^(.*?)\s+$/)
	return (lMatches === null) ? line : lMatches[1]
}

// ---------------------------------------------------------------------------

/**
 * Count the number of a specific character in a string
 */

export const countChars = (str: string, ch: string): number => {

	let count = 0
	let pos = -1
	while ((pos = str.indexOf(ch, pos+1)) !== -1) {
		count += 1
	}
	return count
}

// ---------------------------------------------------------------------------

/**
 * convert a multi-line string to an array
 * of single line strings
 */

export const blockToArray = (block: string): string[] => {

	if (isEmpty(block)) {
		return []
	}
	else {
		return block.split(/\r?\n/)
	}
}

// ---------------------------------------------------------------------------

export const allLinesInBlock = function*(
		block: string
		): Generator<string, void, void> {

	let start = 0
	let end = block.indexOf('\n')
	while (end !== -1) {
		yield block.substring(start, end)
		start = end + 1
		end = block.indexOf('\n', start)
	}
	if (start < block.length) {
		yield block.substring(start)
	}
	return
}

// ---------------------------------------------------------------------------

/**
 * A string or string array
 */

export type TBlockSpec = string | string[]

export const isBlockSpec = (x: any): x is TBlockSpec => {

	return isString(x) || isArrayOfStrings(x)
}

// ---------------------------------------------------------------------------

/**
 * return an array as is, convert a multi-line string
 * to an array of single line strings
 */

export const toArray = (strOrArray: TBlockSpec): string[] => {

	if (Array.isArray(strOrArray)) {
		return strOrArray
	}
	else {
		return blockToArray(strOrArray)
	}
}

// ---------------------------------------------------------------------------

/**
 * convert an array of strings to a single multi-line string
 */

export const arrayToBlock = (lLines: string[]): string => {

	assert(isArray(lLines), `lLines is not an array: ${OL(lLines)}`)
	return lLines.filter((line) => defined(line)).join("\n")
}

// ---------------------------------------------------------------------------

/**
 * return a string as is, convert an array of strings
 * to a single multi-line string
 */

export const toBlock = (strOrArray: TBlockSpec): string => {

	if (isString(strOrArray)) {
		return strOrArray
	}
	else {
		return arrayToBlock(strOrArray)
	}
}

// ---------------------------------------------------------------------------

export const invertHash = (h: hash): hash => {

	assert(isHash(h), `Not a hash: ${OL(h)}`)
	const hResult: hash = {}
	for (const key of keys(h)) {
		const value = h[key]
		if (isString(value)) {
			hResult[value] = key
		}
	}
	return hResult
}

// ---------------------------------------------------------------------------

export const withoutKeys = (
		h: hash,
		...lKeys: string[]
		): hash => {

	const hNew: hash = {}
	for (const key of keys(h)) {
		if (!lKeys.includes(key)) {
			hNew[key] = h[key]
		}
	}
	return hNew
}

// ---------------------------------------------------------------------------

type TKeyVal = [key: string, val: any]

export const withKeyVals = (
		h: hash,
		...lKeyVals: TKeyVal[]
		): hash => {

	const hNew: hash = {}
	for (const k of keys(h)) {
		hNew[k] = h[k]
	}
	for (const pair of lKeyVals) {
		const [key, val] = pair
		hNew[key] = val
	}
	return hNew
}

export var withKeyVal = withKeyVals

// ---------------------------------------------------------------------------

/**
 * by default, replace these characters:
 *    carriage return
 *    newline
 *    TAB
 *    space
 * Optionally, add a character to indicate a particular
 * position in the string
 * Valid options:
 *    offset - indicate position of offset
 *    poschar - char to use to indicate position
 */

const hDebugReplace: hash = {
	"\r": '←',
	"\n": '↓',
	"\t": '→',
	" ":  '˳'
	}

const hCReplace: hash = {
	"\r": '\\r',
	"\n": '\\n',
	"\t": '\\t'
	}

export const escapeStr = (
		str: string,
		hOptions: hash = {}
		): string => {

	const {
		style, hReplace, block, offset, poschar,
		beginchar, endchar
		} = getOptions(hOptions, {
			style: 'debug',
			hReplace: undef,
			block: false,
			offset: undef,
			range: undef,      // --- can be [int, int]
			poschar: '┊',
			beginchar: '⟨',
			endchar: '⟩'
			})

	let hRealReplace: hash = {}
	if (defined(hReplace)) {
		hRealReplace = hReplace
	}
	else if (style === 'C') {
		if (block) {
			hRealReplace = withoutKeys(hCReplace, '\n', '\r')
		}
		else {
			hRealReplace = hCReplace
		}
	}
	else {
		if (block) {
			hRealReplace = withoutKeys(hDebugReplace, '\n', '\r')
		}
		else {
			hRealReplace = hDebugReplace
		}
	}

	const [beginPos, endPos] = (
		(defined(range) && isArray(range)?
			range
		:
			[undef, undef])
		)

	const lParts: string[] = []
	let i1 = 0;for (const ch of str) {const i = i1++;
		if (i === offset) {
			lParts.push(poschar)
		}
		else if (i === beginPos) {
			lParts.push(beginchar)
		}
		else if (i === endPos) {
			lParts.push(endchar)
		}
		lParts.push((hRealReplace[ch] || ch))
	}
	if (offset === str.length) {
		lParts.push(poschar)
	}
	return lParts.join('')
}

// ---------------------------------------------------------------------------

export const unescapeStr = (
		str: string,
		hOptions: hash = {}
		): string => {

	const {style, hReplace} = getOptions(hOptions, {
		style: 'C',
		hReplace: undef
		})

	let hRealReplace: hash = {}
	if (defined(hReplace)) {
		hRealReplace = hReplace
	}
	else {
		if (style === 'debug') {
			hRealReplace = {
				'←': '',
				'↓': '\n',
				'→': '\t',
				'˳': ' '
				}
		}
		else {
			hRealReplace = {
				'n': '\n',
				'r': '',     // carriage return should just disappear
				't': '\t'
				}
		}
	}

	let esc = false
	const lParts: string[] = []
	let i2 = 0;for (const ch of str) {const i = i2++;
		if (ch === '\\') {
			if (esc) {
				lParts.push('\\')
				esc = false
			}
			else {
				esc = true
			}
		}
		else {
			if (esc) {
				if (defined(hRealReplace[ch])) {
					lParts.push(hRealReplace[ch])
				}
				else {
					lParts.push(ch)
				}
				esc = false
			}
			else {
				lParts.push(ch)
			}
		}
	}
	return lParts.join('')
}

// ---------------------------------------------------------------------------

/**
 * don't escape newline or carriage return
 * Optionally, add a character to indicate a particular
 * position in the string
 */

export const escapeBlock = (
	block: string,
	hOptions: hash = {}
	): string => {

	return escapeStr(block, withKeyVal(hOptions, ['block', true]))
}

// ---------------------------------------------------------------------------

export const relpath = (path: string): string => {

	return relative(Deno.cwd(), path).replaceAll('\\', '/')
}

// ---------------------------------------------------------------------------

/**
 * Splits a string on whitespace into an array,
 * ignoring any leading or trailing whitespace
 */

export const wsSplit = (str: string): string[] => {

	const newstr = str.trim()
	if (newstr === '') {
		return []
	}
	else {
		return newstr.split(/\s+/)
	}
}

// ---------------------------------------------------------------------------

/**
 * splits each string on whitespace ignoring any leading
 * or trailing whitespace, and returns an array of
 * all substrings obtained
 */

export const words = (...lStrings: string[]): string[] => {

	let lWords = []
	for (const str of lStrings) {
		for (const word of wsSplit(str)) {
			lWords.push(word)
		}
	}
	return lWords
}

// ---------------------------------------------------------------------------

/**
 * calculates the number of extra characters needed to
 * make the given string have the given length.
 * If not possible, returns 0
 */

export const getNExtra = (str: string, len: number): number => {

	const extra = len - str.length
	return (extra > 0) ? extra : 0
}

// ---------------------------------------------------------------------------

/**
 * pads the given string on the right with
 * the given character, to the given length
 */

export const rpad = (str: string, len: number, ch: string=' '): string => {

	assert((ch.length === 1), "Not a char")
	const extra = getNExtra(str, len)
	return str + ch.repeat(extra)
}

// ---------------------------------------------------------------------------

/**
 * pads the given string on the left with
 * the given character, to the given length
 */

export const lpad = (str: string, len: number, ch: string=' '): string => {

	assert((ch.length === 1), "Not a char")
	const extra = getNExtra(str, len)
	return ch.repeat(extra) + str
}

// ---------------------------------------------------------------------------
// --- valid options:
//        char - char to use on left and right
//        buffer - num spaces around text when char <> ' '

/**
 * pads the given string on both the left and right
 * with the given character, to the given length
 * but with the given number of buffer chars surrounding
 * the text
 */

export const centered = (
	text: string,
	width: number,
	char: string = ' ',
	numBuffer: number = 2
	): string => {

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

/**
 * pad a string on the left, right, or both
 * to the given width
 */

export type TAlignment = 'l'|'c'|'r'|'left'|'center'|'right'

export const isAlignment = (x: any): x is TAlignment => {

	return ['l','c','r','left','center','right'].includes(x)
}

export const alignString = function(
	str: string,
	width: number,
	align: TAlignment
	): string {

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
	}
}

// ---------------------------------------------------------------------------

/**
 * converts the given number to a string, then pads on the left
 * with zeros to achieve the given length
 */

export const zpad = (n: number, len: number): string => {

	return lpad(n.toString(), len, '0')
}

// ---------------------------------------------------------------------------
// GENERATOR

export const allMatches = function*(str: string, re: RegExp): Generator<string[], void, void> {

	// --- Ensure the regex has the global flag (g) set
	const newre = new RegExp(re, re.flags + (re.flags.includes('g') ? '' : 'g'))
	let lMatches: string[] | null = null
	while (defined(lMatches = newre.exec(str))) {
  		yield lMatches
	}
	return
}

// ---------------------------------------------------------------------------

/**
 * A generator that yields integers starting with 0 and
 * continuing to n-1
 */

export const range = function*(
	n: number
	): Generator<number, void, void> {

	let i = 0
	while (i < n) {
		yield i
		i = i + 1
	}
	return
}

// ---------------------------------------------------------------------------

export class Fetcher<T> {

	iter: Iterator<T>
	buffer: (T | undefined) = undef

	eofValue: T;constructor(iter1: Iterator<T>, eofValue: T){this.iter = iter1;this.eofValue = eofValue;}

	peek(): T {
		if (defined(this.buffer)) {
			return this.buffer
		}
		else {
			const {value, done} = this.iter.next()
			if (done) {
				return this.eofValue
			}
			else {
				this.buffer = value
				return value
			}
		}
	}

	get(expected: (T | undefined)=undef): T {
		let result: T = this.eofValue
		if (defined(this.buffer)) {
			result = this.buffer
			this.buffer = undef
		}
		else {
			const {value, done} = this.iter.next()
			result = done ? this.eofValue : value
		}
		if (defined(expected)) {
			assert(deepEqual(result, expected),
					`${OL(expected)} expected`)
		}
		return result
	}

	skip(expected: (T | undefined)=undef): void {
		this.get(expected)
		return
	}

	atEnd(): boolean {
		if (defined(this.buffer)) {
			return false
		}
		else {
			const {value, done} = this.iter.next()
			if (done || (value === this.eofValue)) {
				return true
			}
			else {
				this.buffer = value
				return false
			}
		}
	}
}

// ---------------------------------------------------------------------------

export const assertSameStr = (
		str1: string,
		str2: string
		): void => {

	if (str1 !== str2) {
		console.log(centered("Strings Differ:", 64, '-'))
		console.log(centered("string 1", 64, '-'))
		console.log(str1)
		console.log(centered("string 2", 64, '-'))
		console.log(str2)
		console.log('-'.repeat(64))
	}

	assert((str1 === str2), "strings differ")
	return
}

// ---------------------------------------------------------------------------

export const interpolate = (
		str: string,
		hReplace: hashof<string>   // --- { <tag>: <replacement>, ... }
		): string => {

	for (const key of Object.keys(hReplace)) {
		assert((key[0] === '$'), "all keys must start with '$'")
	}
	const re = /\$(?:[A-Za-z][A-Za-z0-9]*)/g
	return str.replaceAll(re, (match: string) => {
		return hReplace[match] || match
	}
		)
}

// ---------------------------------------------------------------------------
// --- generate random labels

const labelGen = function*(): Generator<string, void, void> {

	for (let i3 = 65; i3 <= 90; ++i3) {const ch = String.fromCharCode(i3);
		yield ch
	}
	for (let i4 = 65; i4 <= 90; ++i4) {const ch = String.fromCharCode(i4);
		for (let i5 = 65; i5 <= 90; ++i5) {const ch2 = String.fromCharCode(i5);
			yield ch + ch2
		}
	}
	for (let i6 = 65; i6 <= 90; ++i6) {const ch = String.fromCharCode(i6);
		for (let i7 = 65; i7 <= 90; ++i7) {const ch2 = String.fromCharCode(i7);
			for (let i8 = 65; i8 <= 90; ++i8) {const ch3 = String.fromCharCode(i8);
				yield ch + ch2 + ch3
			}
		}
	}
	return
}

// --- Create an iterator from the generator
const labels = labelGen()

export const randomLabel = (): string => {
	const label = labels.next()
	return label.done ? 'ERR!' : label.value
}

// ---------------------------------------------------------------------------

export const require = getImportSync(import.meta.url)

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3JjL2xpYi9sbHV0aWxzLmxpYi5jaXZldC50c3giLCJzb3VyY2VzIjpbInNyYy9saWIvbGx1dGlscy5saWIuY2l2ZXQiXSwibWFwcGluZ3MiOiI7QUFBQSxvQkFBbUI7QUFDbkIsQUFBQTtBQUNBLEssVyx5QjtBQUFBLE1BQU0sQ0FBQyxDQUFDLGFBQWEsQ0FBQyxDQUFDLElBQUksQ0FBQyxhQUFhO0FBQ3pDLEFBQUEsQUFBQSxNQUFNLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxJQUFJLENBQUMsaUJBQWlCO0FBQ3ZDLEFBQUEsQUFBQSxNQUFNLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxJQUFJLENBQUMsV0FBVztBQUNsQyxBQUFBO0FBQ0EsQUFBQSxBQUFBLE1BQU0sQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLElBQUksQ0FBQyxxQkFBcUI7QUFDNUMsQUFBQSxBQUFBLE1BQU0sQ0FBQyxDQUFDO0FBQ1IsQ0FBQyxLQUFLLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxTQUFTLENBQUM7QUFDckQsQ0FBQyxNQUFNLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDLGdCQUFnQixDQUFDO0FBQ3JELENBQUMsT0FBTyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsU0FBUyxDQUFDO0FBQ2xELENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsUUFBUSxDQUFDO0FBQ2pELENBQUMsV0FBVyxDQUFDLENBQUMsY0FBYyxDQUFDLENBQUMsV0FBVyxDQUFDO0FBQzFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxvQkFBb0I7QUFDNUIsQUFBQTtBQUNBLEFBQUE7QUFDQTtBQUNBLEdBQUc7QUFDSCxBQUFBO0FBQ0Es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RCxBQUFBO0FBQ0EsQUFBQSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUEsQUFBQyxvQkFBb0IsQ0FBQTtBQUNqQyxBQUFBLENBQVMsTUFBUixRQUFRLENBQUMsQ0FBRSxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFBLENBQUE7QUFDdkMsQUFBQSxFQUFFLE9BQU8sQ0FBQyxHQUFHLENBQUEsQUFBQyxDQUFDLFNBQVMsRUFBRSxTQUFTLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDN0MsQUFBQSxFQUFRLE1BQU4sTUFBTSxDQUFDLENBQUUsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUM7QUFDdEMsQUFBQSxFQUFFLE9BQU8sQ0FBQyxHQUFHLENBQUEsQUFBQyxDQUFDLFVBQVUsRUFBRSxTQUFTLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDL0MsQUFBQSxFQUFFLE1BQU0sQ0FBQyxNO0NBQU0sQ0FBQTtBQUNmLEFBQUEsQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxRQUFRLENBQUMsQ0FBQyxRQUFRLEM7QUFBQyxDQUFBO0FBQ2xELEFBQUE7QUFDQSxBQUFBLDhFQUE2RTtBQUM3RSxBQUFBO0FBQ0EsQUFBQTtBQUNBO0FBQ0EsR0FBRztBQUNILEFBQUE7QUFDQSxBQUFBLEFBQUEsTUFBTSxDQUFFLE1BQUQsQ0FBQyxDQUFDLENBQUUsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLG9CQUFvQixDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFBLENBQUE7QUFDdkQsQUFBQTtBQUNBLEFBQUEsQ0FBUyxNQUFSLFFBQVEsQ0FBQyxDQUFFLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUEsQ0FBQTtBQUN2QyxBQUFBLEVBQU8sTUFBTCxLQUFL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Q0FBQyxDQUFDO0FBQ1osRUFBRSxDQUFDLENBQUE7QUFDSCxBQUFBO0FBQ0EsQUFBQSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNO0FBQ3RCLEFBQUE7QUFDQSxBQUFBLENBQUMsR0FBRyxDQUFBLFFBQVEsQ0FBQyxNQUFNLENBQUMsQ0FBQSxDQUFBLENBQUE7QUFDcEIsQUFBQSxFQUFFLE1BQU0sQyxDQUFFLENBQUMsQ0FBQyxNQUFNLEM7Q0FBQyxDQUFBO0FBQ25CLEFBQUEsQ0FBZ0IsTUFBZixLQUFLLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUUsQ0FBQyxDQUFDLENBQUM7QUFDdEIsQUFBQSxDQUFDLEdBQUcsQ0FBQyxDQUFBLE1BQUEsR0FBRyxDQUFDLEVBQUUsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFBLENBQUEsQ0FBQTtBQUM1QixBQUFBLEVBQUUsR0FBRyxDQUFBLENBQUksTUFBTSxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQSxDQUFBLENBQUE7QUFDN0IsQUFBQSxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUEsQUFBQyxHQUFHLEM7RUFBQSxDO0NBQUEsQ0FBQTtBQUNqQixBQUFBLENBQUMsTUFBTSxDQUFDLEs7QUFBSyxDQUFBO0FBQ2IsQUFBQTtBQUNBLEFBQUEsOEVBQTZFO0FBQzdFLEFBQUE7QUFDQSxBQUFBO0FBQ0E7QUFDQTtBQUNBLEdBQUc7QUFDSCxBQUFBO0FBQ0EsQUFBQSxBQUFBLE1BQU0sQ0FBTyxNQUFOLE1BQU0sQ0FBQyxDQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLEtBQUssQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUEsQ0FBQTtBQUMxRCxBQUFBO0FBQ0EsQUFBQSxDQUFDLEdBQUcsQ0FBQSxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUEsQ0FBQSxDQUFBO0FBQ2pCLEFB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LE1BQU0sQ0FBQyxDQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUEsQ0FBQTtBQUN2QyxBQUFBO0FBQ0EsQUFBQTtBQUNBLEFBQUEsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDO0FBQUMsQ0FBQTtBQUNyQyxBQUFBO0FBQ0EsQUFBQSw4RUFBNkU7QUFDN0UsQUFBQTtBQUNBLEFBQUE7QUFDQTtBQUNBO0FBQ0EsR0FBRztBQUNILEFBQUE7QUFDQSxBQUFBLEFBQUEsTUFBTSxDQUFLLE1BQUosSUFBSSxDQUFDLENBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQSxDQUFBO0FBQ3JDLEFBQUE7QUFDQSxBQUFBLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQztBQUFDLENBQUE7QUFDdEMsQUFBQTtBQUNBLEFBQUEsOEVBQTZFO0FBQzdFLEFBQUE7QUFDQSxBQUFBO0FBQ0E7QUFDQSxHQUFHO0FBQ0gsQUFBQTtBQUNBLEFBQUEsQUFBQSxNQUFNLENBQU0sTUFBTCxLQUFLLENBQUMsQ0FBRSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFBLENBQUE7QUFDekMsQUFBQTtBQUNBLEFBQUEsQ0FBQyxNQUFNLENBQUEsQUFBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLGNBQWMsRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQTtBQUN0RCxBQUFBLENBQVMsTUFB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LENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUEsQ0FBQTtBQUNwRCxBQUFBO0FBQ0EsQUFBQSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNoQixBQUFBLENBQUMsR0FBRyxDQUFDLENBQUEsTUFBQSxHQUFHLENBQUMsRUFBRSxDQUFDLFFBQVEsQ0FBQSxDQUFBLENBQUE7QUFDcEIsQUFBQSxFQUFFLEdBQUcsQ0FBQyxDQUFBLE1BQUEsSUFBSSxDQUFDLEVBQUUsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUEsQ0FBQSxDQUFBO0FBQzFCLEFBQUEsR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFBLEFBQUMsSUFBSSxDO0VBQUEsQztDQUFBLENBQUE7QUFDbkIsQUFBQSxDQUFDLE1BQU0sQ0FBQyxNO0FBQU0sQ0FBQTtBQUNkLEFBQUE7QUFDQSxBQUFBLDhFQUE2RTtBQUM3RSxBQUFBO0FBQ0EsQUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLEdBQUc7QUFDSCxBQUFBO0FBQ0EsQUFBQSxBQUFBLE1BQU0sQ0FBVSxNQUFULFNBQVMsQ0FBQyxDQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUEsQ0FBQTtBQUN6RCxBQUFBO0FBQ0EsQUFBQSxDQUFNLE1BQUwsS0FBSyxDQUFDLENBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxNQUFNO0FBQzFCLEFBQUEsQ0FBQyxNQUFNLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEM7QUFBQyxDQUFBO0FBQy9CLEFBQUE7QUFDQSxBQUFBLDhFQUE2RTtBQUM3RSxBQUFBO0FBQ0EsQUFBQTtBQUNBO0FBQ0E7QUFDQSxHQUFHO0FBQ0gsQUFBQTtBQUNBLEFBQUEsQUFBQSxNQUFNLENBQUssTUFBSixJQUFJLENBQUMsQ0FBRSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQSxDQUFBO0FBQ3BFLEFBQUE7QUFDQSxBQUFBLENBQUMsTUFBTSxDQUFBLEFBQUMsQ0FBQyxFQUFFLENBQUMsTUFBTSxDQUFDLEdBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFlBQVksQ0FBQTtBQUN0QyxBQUFBLENBQU0sTUFBTCxLQUFLLENBQUMsQ0FBRSxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUM7QUFDN0IsQUFBQSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxNQUFNLENBQUMsS0FBSyxDO0FBQUMsQ0FBQTtBQUM5QixBQUFBO0FBQ0EsQUFBQSw4RUFBNkU7QUFDN0UsQUFBQTtBQUNBLEFBQUE7QUFDQTtBQUNBO0FBQ0EsR0FBRztBQUNILEFBQUE7QUFDQSxBQUFBLEFBQUEsTUFBTSxDQUFLLE1BQUosSUFBSSxDQUFDLENBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUEsQ0FBQTtBQUNwRSxBQUFBO0FBQ0EsQUFBQSxDQUFDLE1BQU0sQ0FBQSxBQUFDLENBQUMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxHQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxZQUFZLENBQUE7QUFDdEMsQUFBQSxDQUFNLE1BQUwsS0FBSyxDQUFDLENBQUUsQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBRyxD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O0FBQ0EsQUFBQSxBQUFBLE1BQU0sQ0FBSyxNQUFKLElBQUksQ0FBQyxDQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUEsQ0FBQTtBQUNsRCxBQUFBO0FBQ0EsQUFBQSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLEM7QUFBQyxDQUFBO0FBQ3BDLEFBQUE7QUFDQSxBQUFBLDhFQUE2RTtBQUM3RSxBQUFBLFlBQVc7QUFDWCxBQUFBO0FBQ0EsQUFBQSxBQUFBLE1BQU0sQ0FBVyxNQUFWLFVBQVUsQ0FBQyxDQUFFLENBQTRELFEsQ0FBM0QsQ0FBQyxHQUFHLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFJLENBQUEsQ0FBQTtBQUNsRixBQUFBO0FBQ0EsQUFBQSxDQUFDLG1EQUFrRDtBQUNuRCxBQUFBLENBQU0sTUFBTCxLQUFLLENBQUMsQ0FBRSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUN4RSxBQUFBLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsSUFBSTtBQUNyQyxBQUFBLENBQUMsS0FBSyxDQUFDLENBQUEsT0FBTyxDQUFDLFFBQVEsQyxDQUFFLENBQUMs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QUUsR0FBRyxDQUFDLEMsSSxFLEcsRSxFLEUsSSxFLEUsRSxFQUFpQixDQUFBLENBQUEsQ0FBakIsTUFBQSxHLEcsb0IsRSxDLENBQWlCO0FBQ3ZCLEFBQUEsR0FBRyxHQUFHLENBQUMsQyxJLEUsRyxFLEUsRSxJLEUsRSxFLEVBQWlCLENBQUEsQ0FBQSxDQUFqQixNQUFBLEcsRyxvQixFLEMsQ0FBaUI7QUFDeEIsQUFBQSxJQUFJLEtBQUssQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRztHQUFHLEM7RUFBQSxDO0NBQUEsQ0FBQTtBQUN4QixBQUFBLENBQUMsTTtBQUFNLENBQUE7QUFDUCxBQUFBO0FBQ0EsQUFBQSw0Q0FBMkM7QUFDM0MsQUFBQSxBQUFNLE1BQU4sTUFBTSxDQUFDLENBQUUsQ0FBQyxRQUFRLENBQUMsQ0FBQztBQUNwQixBQUFBO0FBQ0EsQUFBQSxBQUFBLE1BQU0sQ0FBWSxNQUFYLFdBQVcsQ0FBQyxDQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFBLENBQUE7QUFDbkMsQUFBQSxDQUFNLE1BQUwsS0FBSyxDQUFDLENBQUUsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDdkIsQUFBQSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxLO0FBQUssQ0FBQTtBQUN6QyxBQUFBO0FBQ0EsQUFBQSw4RUFBNkU7QUFDN0UsQUFBQTtBQUNBLEFBQUEsQUFBQSxNQUFNLENBQVEsTUFBUCxPQUFPLENBQUMsQ0FBRSxDQUFDLGFBQWEsQ0FBQyxXQUFXLENBQUMsR0FBRyxDQUFDO0FBQ2hEIiwibmFtZXMiOltdLCJzb3VyY2VzQ29udGVudCI6WyIjIGxsdXRpbHMubGliLmNpdmV0XHJcblxyXG5pbXBvcnQge2NyZWF0ZVJlcXVpcmV9IGZyb20gXCJub2RlOm1vZHVsZVwiXHJcbmltcG9ydCB7c3ByaW50Zn0gZnJvbSBcIkBzdGQvZm10L3ByaW50ZlwiXHJcbmltcG9ydCB7cmVsYXRpdmV9IGZyb20gJ0BzdGQvcGF0aCdcclxuXHJcbmltcG9ydCB7dHJ1bmNTdHJ9IGZyb20gJy4vdHlwZXNjcmlwdC5saWIudHMnXHJcbmltcG9ydCB7XHJcblx0dW5kZWYsIGRlZmluZWQsIG5vdGRlZmluZWQsIGFzc2VydCwgY2hhciwgZGVlcEVxdWFsLFxyXG5cdGlzSGFzaCwgaXNBcnJheSwgaXNOb25FbXB0eVN0cmluZywgaXNBcnJheU9mU3RyaW5ncyxcclxuXHRpc0VtcHR5LCBub25FbXB0eSwgaXNTdHJpbmcsIGlzT2JqZWN0LCBpc0ludGVnZXIsXHJcblx0aW50ZWdlciwgaGFzaCwgaGFzaG9mLCBhcnJheSwgYXJyYXlvZiwgdm9pZEZ1bmMsXHJcblx0VEZpbHRlckZ1bmMsIGlzTm9uUHJpbWl0aXZlLCBmdW5jdGlvbkRlZixcclxuXHR9IGZyb20gJy4vZGF0YXR5cGVzLmxpYi50cydcclxuXHJcbi8qKlxyXG4gKiBAbW9kdWxlIGxsdXRpbHMgLSBsb3cgbGV2ZWwgdXRpbGl0aWVzXHJcbiAqL1xyXG5cclxubGx1dGlsc0xvYWRUaW1lOiBpbnRlZ2VyIDo9IERhdGUubm93KClcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbiMgLS0tIFNob3VsZCBiZSBjYWxsZWQgbGlrZTpcclxuIyAgICAgICAgcmVxdWlyZSA6PSBnZXRJbXBvcnRTeW5jKGltcG9ydC5tZXRhLnVybClcclxuXHJcbmV4cG9ydCBnZXRJbXBvcnRTeW5jIDo9ICh1cmw6IHN0cmluZyk6IEZ1bmN0aW9uID0+XHJcblxyXG5cdHJldHVybiBjcmVhdGVSZXF1aXJlKHVybClcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgc2luY2VMb2FkIDo9IChkYXRldGltZTogRGF0ZSB8IGludGVnZXIgPSBEYXRlLm5vdygpKSA9PlxyXG5cclxuXHRpZiAoZGF0ZXRpbWUgaW5zdGFuY2VvZiBEYXRlKVxyXG5cdFx0cmV0dXJuIGRhdGV0aW1lLnZhbHVlT2YoKSAtIGxsdXRpbHNMb2FkVGltZVxyXG5cdGVsc2VcclxuXHRcdHJldHVybiBkYXRldGltZSAtIGxsdXRpbHNMb2FkVGltZVxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbmV4cG9ydCBzaW5jZUxvYWRTdHIgOj0gKGRhdGV0aW1lOiAoRGF0ZSB8IGludGVnZXIpPyA9IHVuZGVmKSA9PlxyXG5cclxuXHRyZXR1cm4gc3ByaW50ZihcIiU2ZFwiLCBzaW5jZUxvYWQoZGF0ZXRpbWUpKVxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbi8qKlxyXG4gKiB0aHJvd3MgYW4gZXhjZXB0aW9uIHdpdGggdGhlIHByb3ZpZGVkIG1lc3NhZ2VcclxuICovXHJcblxyXG5leHBvcnQgY3JvYWsgOj0gKG1zZzogc3RyaW5nKTogbmV2ZXIgPT5cclxuXHJcblx0dGhyb3cgbmV3IEVycm9yKG1zZylcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG4vKipcclxuICogQXNzZXJ0cyB0aGF0IGBjb25kYCBpcyB0cnVlLiBJZiBpdCBpc24ndCwgYW4gZXhjZXB0aW9uIGlzXHJcbiAqIHRocm93biB3aXRoIHRoZSBnaXZlbiBgbXNnYFxyXG4gKi9cclxuXHJcbmV4cG9ydCB0aHJvd3NFcnJvciA6PSAoZnVuYzogdm9pZEZ1bmMsIG1zZzogc3RyaW5nPVwiVW5leHBlY3RlZCBzdWNjZXNzXCIpOiB2b2lkID0+XHJcblxyXG5cdHRyeVxyXG5cdFx0ZnVuYygpXHJcblx0XHR0aHJvdyBuZXcgRXJyb3IobXNnKVxyXG5cdGNhdGNoIGVyclxyXG5cdFx0cmV0dXJuICAgICMgaWdub3JlIGVycm9yIC0gaXQgd2FzIGV4cGVjdGVkXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuLyoqXHJcbiAqIENhbGxpbmcgcGFzcygpIGRvZXMgbm90aGluZ1xyXG4gKi9cclxuXHJcbmV4cG9ydCBwYXNzIDo9ICgpOiB2b2lkID0+ICAgICMgZG8gbm90aGluZ1xyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbi8qKlxyXG4gKiBzdHJpbmdpZnkgYW55IHZhbHVlLCBzbyB0aGF0IGlmIHdlIHRha2UgdGhlIHJlc3VsdFN0ciwgd2UgY2FuXHJcbiAqICAgIGxldCB4ID0gPHJlc3VsdFN0cj5cclxuICogdG8gcmV0cmlldmUgdGhlIG9yaWdpbmFsIHZhbHVlIChpZiBubyB0cnVuYyBvcHRpb24gaXMgcGFzc2VkIGluKVxyXG4gKi9cclxuXHJcbmV4cG9ydCBzdHJpbmdpZnkgOj0gKFxyXG5cdHg6IGFueSxcclxuXHRoT3B0aW9uczogaGFzaD17fVxyXG5cdGxldmVsOiBudW1iZXI9MFxyXG5cdCk6IHN0cmluZyA9PlxyXG5cclxuXHR7b25lTGluZSwgY29tcHJlc3MsIHRydW5jfSA6PSBnZXRPcHRpb25zIGhPcHRpb25zLCB7XHJcblx0XHRvbmVMaW5lOiBmYWxzZVxyXG5cdFx0Y29tcHJlc3M6IHRydWVcclxuXHRcdHRydW5jOiB1bmRlZlxyXG5cdFx0fVxyXG5cclxuXHR0eXBlU3RyIDo9IHR5cGVvZiB4XHJcblx0cmVzdWx0IDo9IHN3aXRjaCB0eXBlU3RyXHJcblx0XHR3aGVuICd1bmRlZmluZWQnXHJcblx0XHRcdCd1bmRlZmluZWQnXHJcblx0XHR3aGVuICdvYmplY3QnXHJcblx0XHRcdGlmICh4ID09IG51bGwpXHJcblx0XHRcdFx0J251bGwnXHJcblx0XHRcdGVsc2UgaWYgQXJyYXkuaXNBcnJheSh4KVxyXG5cdFx0XHRcdGxQYXJ0cyA6PSBzdHJpbmdpZnkoaXRlbSwgaE9wdGlvbnMsIGxldmVsKzEpIGZvciBpdGVtIG9mIHhcclxuXHRcdFx0XHRpZiBvbmVMaW5lXHJcblx0XHRcdFx0XHQnWycgKyBsUGFydHMuam9pbignLCAnKSArICddJ1xyXG5cdFx0XHRcdGVsc2VcclxuXHRcdFx0XHRcdCdbXFxuJyArIGxQYXJ0cy5qb2luKCcsXFxuJykgKyAnXFxuXSdcclxuXHRcdFx0ZWxzZVxyXG5cdFx0XHRcdGxQYXJ0cyA6PSBmb3Iga2V5LHZhbCBpbiB4XHJcblx0XHRcdFx0XHRcIiN7a2V5fTogI3tzdHJpbmdpZnkodmFsLCBoT3B0aW9ucywgbGV2ZWwrMSl9XCJcclxuXHRcdFx0XHRpZiBvbmVMaW5lXHJcblx0XHRcdFx0XHQneycgKyBsUGFydHMuam9pbignLCAnKSArICd9J1xyXG5cdFx0XHRcdGVsc2VcclxuXHRcdFx0XHRcdCd7XFxuJyArIGxQYXJ0cy5qb2luKCcsXFxuJykgKyAnXFxufSdcclxuXHRcdHdoZW4gJ2Jvb2xlYW4nXHJcblx0XHRcdHggPyAndHJ1ZScgOiAnZmFsc2UnXHJcblx0XHR3aGVuICdudW1iZXInXHJcblx0XHRcdHgudG9TdHJpbmcoKVxyXG5cdFx0d2hlbiAnYmlnaW50J1xyXG5cdFx0XHR4LnRvU3RyaW5nKCkgKyAnbidcclxuXHRcdHdoZW4gJ3N0cmluZydcclxuXHRcdFx0XCJcXFwiI3tlc2NhcGVTdHIoeCwgbydzdHlsZT1DJyl9XFxcIlwiXHJcblx0XHR3aGVuICdzeW1ib2wnXHJcblx0XHRcdGlmIGRlZmluZWQoeC5kZXNjcmlwdGlvbilcclxuXHRcdFx0XHRcIlN5bWJvbChcXFwiI3t4LmRlc2NyaXB0aW9ufVxcXCIpXCJcclxuXHRcdFx0ZWxzZVxyXG5cdFx0XHRcdFwiU3ltYm9sKClcIlxyXG5cdFx0d2hlbiAnZnVuY3Rpb24nXHJcblx0XHRcdGZ1bmN0aW9uRGVmKHgpXHJcblxyXG5cdGlmIGRlZmluZWQodHJ1bmMpXHJcblx0XHRyZXR1cm4gdHJ1bmNTdHIocmVzdWx0LCB0cnVuYylcclxuXHRlbHNlXHJcblx0XHRyZXR1cm4gcmVzdWx0XHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuLyoqXHJcbiAqIEpTT04gc3RyaW5naWZpZXMgeCBvbiBvbmUgbGluZVxyXG4gKi9cclxuXHJcbmV4cG9ydCBPTCA6PSAoeDogYW55KTogc3RyaW5nID0+XHJcblxyXG5cdGlmICh4ID09IHVuZGVmKVxyXG5cdFx0cmV0dXJuICd1bmRlZidcclxuXHRlbHNlIGlmICh4ID09IG51bGwpXHJcblx0XHRyZXR1cm4gJ251bGwnXHJcblx0ZWxzZSBpZiAodHlwZW9mIHggPT0gJ3N5bWJvbCcpXHJcblx0XHRpZiBkZWZpbmVkKHguZGVzY3JpcHRpb24pXHJcblx0XHRcdHJldHVybiBcIltTeW1ib2wgI3t4LmRlc2NyaXB0aW9ufV1cIlxyXG5cdFx0ZWxzZVxyXG5cdFx0XHRyZXR1cm4gXCJbU3ltYm9sXVwiXHJcblx0XHRyZXR1cm4gJ3N5bWJvbCdcclxuXHRlbHNlIGlmICh0eXBlb2YgeCA9PSAnZnVuY3Rpb24nKVxyXG5cdFx0cmV0dXJuIHgudG9TdHJpbmcoKS5yZXBsYWNlQWxsKCdcXG4nLCAnICcpXHJcblx0ZWxzZVxyXG5cdFx0c3RyIDo9IEpTT04uc3RyaW5naWZ5KHgsIChrLHYpID0+IGRlZmluZWQodikgPyB2IDogJ19fdW5kZWZfXycpXHJcblx0XHRyZXR1cm4gc3RyLnJlcGxhY2VBbGwoJ1wiX191bmRlZl9fXCInLCAndW5kZWZpbmVkJylcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgTUwgOj0gKHg6IGFueSk6IHN0cmluZyA9PlxyXG5cclxuXHRpZiAoeCA9PSB1bmRlZilcclxuXHRcdHJldHVybiAndW5kZWYnXHJcblx0ZWxzZSBpZiAoeCA9PSBudWxsKVxyXG5cdFx0cmV0dXJuICdudWxsJ1xyXG5cdGVsc2UgaWYgKHR5cGVvZiB4ID09ICdmdW5jdGlvbicpXHJcblx0XHRyZXR1cm4geC50b1N0cmluZygpXHJcblx0ZWxzZVxyXG5cdFx0c3RyIDo9IEpTT04uc3RyaW5naWZ5KHgsIChrLHYpID0+IGRlZmluZWQodikgPyB2IDogJ19fdW5kZWZfXycsIDMpXHJcblx0XHRpZiBkZWZpbmVkKHN0cilcclxuXHRcdFx0cmV0dXJuIHN0ci5yZXBsYWNlQWxsKCdcIl9fdW5kZWZfX1wiJywgJ3VuZGVmaW5lZCcpXHJcblx0XHRlbHNlXHJcblx0XHRcdGNvbnNvbGUubG9nIHhcclxuXHRcdFx0cmV0dXJuIFwiSlNPTi5zdHJpbmdpZnkgcmV0dXJuZWQgdW5kZWYhISFcIlxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbi8qKlxyXG4gKiBDb252ZXJ0cyB0aGUgZ2l2ZW4gc3RyaW5nIHRvIGEgaGFzaFxyXG4gKiA8d29yZD4gYmVjb21lcyBhIGtleSB3aXRoIGEgdHJ1ZSB2YWx1ZVxyXG4gKiAhPHdvcmQ+IGJlY29tZXMgYSBrZXlzIHdpdGggYSBmYWxzZSB2YWx1ZVxyXG4gKiA8d29yZD49PHN0cmluZz4gYmVjb21lcyBhIGtleSB3aXRoIHZhbHVlIDxzdHJpbmc+XHJcbiAqICAgIC0gPHN0cmluZz4gbXVzdCBiZSBxdW90ZWQgaWYgaXQgY29udGFpbnMgd2hpdGVzcGFjZVxyXG4gKi9cclxuXHJcbmV4cG9ydCBzdHJUb0hhc2ggOj0gKHN0cjogc3RyaW5nKTogaGFzaCA9PlxyXG5cclxuXHRpZiBpc0VtcHR5KHN0cilcclxuXHRcdHJldHVybiB7fVxyXG5cdGg6IGhhc2ggOj0ge31cclxuXHRmb3Igd29yZCBvZiBzdHIudHJpbSgpLnNwbGl0KC9cXHMrLylcclxuXHRcdGlmIGxNYXRjaGVzOiBzdHJpbmdbXSB8IG51bGwgOj0gd29yZC5tYXRjaCgvLy9eXHJcblx0XHRcdFx0KFxcISk/ICAgICAgICAgICAgICAgICAgICAjIG5lZ2F0ZSB2YWx1ZVxyXG5cdFx0XHRcdChbQS1aYS16XVtBLVphLXpfMC05XSopICAjIGlkZW50aWZpZXJcclxuXHRcdFx0XHQoPzpcclxuXHRcdFx0XHRcdCg9KVxyXG5cdFx0XHRcdFx0KC4qKVxyXG5cdFx0XHRcdFx0KT9cclxuXHRcdFx0XHQkLy8vKVxyXG5cdFx0XHRbXywgbmVnLCBpZGVudCwgZXFTaWduLCBzdHJdIDo9IGxNYXRjaGVzXHJcblx0XHRcdGlmIGlzTm9uRW1wdHlTdHJpbmcoZXFTaWduKVxyXG5cdFx0XHRcdGFzc2VydCBub3RkZWZpbmVkKG5lZykgfHwgKG5lZyA9PSAnJyksXHJcblx0XHRcdFx0XHRcdFwibmVnYXRpb24gd2l0aCBzdHJpbmcgdmFsdWVcIlxyXG5cclxuXHRcdFx0XHQjIC0tLSBjaGVjayBpZiBzdHIgaXMgYSB2YWxpZCBudW1iZXJcclxuXHRcdFx0XHRpZiBzdHIubWF0Y2goL14tP1xcZCsoXFwuXFxkKyk/JC8pXHJcblx0XHRcdFx0XHRudW0gOj0gcGFyc2VGbG9hdChzdHIpXHJcblx0XHRcdFx0XHRpZiBOdW1iZXIuaXNOYU4obnVtKVxyXG5cdFx0XHRcdFx0XHQjIC0tLSBUTyBETzogaW50ZXJwcmV0IGJhY2tzbGFzaCBlc2NhcGVzXHJcblx0XHRcdFx0XHRcdGhbaWRlbnRdID0gc3RyXHJcblx0XHRcdFx0XHRlbHNlXHJcblx0XHRcdFx0XHRcdGhbaWRlbnRdID0gbnVtXHJcblx0XHRcdFx0ZWxzZVxyXG5cdFx0XHRcdFx0aFtpZGVudF0gPSBzdHJcclxuXHRcdFx0ZWxzZSBpZiBuZWdcclxuXHRcdFx0XHRoW2lkZW50XSA9IGZhbHNlXHJcblx0XHRcdGVsc2VcclxuXHRcdFx0XHRoW2lkZW50XSA9IHRydWVcclxuXHRcdGVsc2VcclxuXHRcdFx0Y3JvYWsgXCJJbnZhbGlkIHdvcmQgI3tPTCh3b3JkKX1cIlxyXG5cdHJldHVybiBoXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuZXhwb3J0IG8gOj0gKGxTdHJpbmdzOiBUZW1wbGF0ZVN0cmluZ3NBcnJheSk6IGhhc2ggPT5cclxuXHJcblx0cmV0dXJuIHN0clRvSGFzaChsU3RyaW5nc1swXSlcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG4vKipcclxuICogcyAtIGNvbnZlcnQgbGVhZGluZyB0YWJzIHRvIHNwYWNlc1xyXG4gKi9cclxuXHJcbmV4cG9ydCBzIDo9IChsU3RyaW5nczogVGVtcGxhdGVTdHJpbmdzQXJyYXkpOiBzdHJpbmcgPT5cclxuXHJcblx0Y29uc29sZS5sb2cgXCJjYWxsaW5nIGZ1bmN0aW9uIHNcIlxyXG5cdHJlcGxhY2VyIDo9IChtYXRjaDogc3RyaW5nKTogc3RyaW5nID0+XHJcblx0XHRjb25zb2xlLmxvZyBcIm1hdGNoID0gPCN7ZXNjYXBlU3RyKG1hdGNoKX0+XCJcclxuXHRcdHJlc3VsdCA6PSAnICAgJy5yZXBlYXQobWF0Y2gubGVuZ3RoKVxyXG5cdFx0Y29uc29sZS5sb2cgXCJyZXN1bHQgPSA8I3tlc2NhcGVTdHIocmVzdWx0KX0+XCJcclxuXHRcdHJldHVybiByZXN1bHRcclxuXHRyZXR1cm4gbFN0cmluZ3NbMF0ucmVwbGFjZUFsbCgvXlxcdCsvbWcsIHJlcGxhY2VyKVxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbi8qKlxyXG4gKiB0IC0gY29udmVydCBsZWFkaW5nIHNwYWNlcyB0byB0YWJzXHJcbiAqL1xyXG5cclxuZXhwb3J0IHQgOj0gKGxTdHJpbmdzOiBUZW1wbGF0ZVN0cmluZ3NBcnJheSk6IHN0cmluZyA9PlxyXG5cclxuXHRyZXBsYWNlciA6PSAobWF0Y2g6IHN0cmluZyk6IHN0cmluZyA9PlxyXG5cdFx0bGV2ZWwgOj0gTWF0aC5mbG9vcihtYXRjaC5sZW5ndGggLyAzKVxyXG5cdFx0cmV0dXJuICdcXHQnLnJlcGVhdChsZXZlbClcclxuXHRyZXR1cm4gbFN0cmluZ3NbMF0ucmVwbGFjZUFsbCgvXlxceDIwKy9tZywgcmVwbGFjZXIpXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuLyoqXHJcbiAqIEFkZHMgYW55IGtleXMgaW4gaERlZmF1bHRzIHRoYXQgYXJlIG1pc3NpbmcgaW4gaE9wdGlvbnNcclxuICogdG8gaE9wdGlvbnMgd2l0aCB0aGVpciBnaXZlbiB2YWx1ZXNcclxuICovXHJcblxyXG5leHBvcnQgYWRkRGVmYXVsdHMgOj0gKGhPcHRpb25zOiBoYXNoLCBoRGVmYXVsdHM6IGhhc2gpOiBoYXNoID0+XHJcblxyXG5cdGFzc2VydCBpc09iamVjdChoT3B0aW9ucyksIFwiaE9wdGlvbnMgbm90IGFuIG9iamVjdDogI3tPTChoT3B0aW9ucyl9XCJcclxuXHRhc3NlcnQgaXNPYmplY3QoaERlZmF1bHRzKSwgXCJoRGVmYXVsdHMgbm90IGFuIG9iamVjdDogI3tPTChoRGVmYXVsdHMpfVwiXHJcblxyXG5cdCMgLS0tIEZpbGwgaW4gZGVmYXVsdHMgZm9yIG1pc3NpbmcgdmFsdWVzXHJcblx0Zm9yIGtleSBvZiBPYmplY3Qua2V5cyhoRGVmYXVsdHMpXHJcblx0XHR2YWx1ZSA6PSBoRGVmYXVsdHNba2V5XVxyXG5cdFx0aWYgbm90IGhPcHRpb25zLmhhc093blByb3BlcnR5KGtleSkgJiYgZGVmaW5lZCh2YWx1ZSlcclxuXHRcdFx0aE9wdGlvbnNba2V5XSA9IHZhbHVlXHJcblx0cmV0dXJuIGhPcHRpb25zXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuLyoqXHJcbiAqIHJldHVybnMgYSBoYXNoIG9mIG9wdGlvbnMgd2l0aCB0aGVpciB2YWx1ZXMsIHVzaW5nIG9wdGlvbnNcclxuICogaWYgaXQncyBhIGhhc2gsIG9yIHBhcnNpbmcgb3B0aW9ucyB1c2luZyBzdHJUb0hhc2goKSBpZlxyXG4gKiBpdCdzIGEgc3RyaW5nIC0gYWRkaW5nIGFueSBkZWZhdWx0IHZhbHVlcyBmcm9tIGhEZWZhdWx0c1xyXG4gKiBpZiB0aGV5J3JlIG1pc3NpbmcgaW4gdGhlIHJlc3VsdGluZyBoYXNoXHJcbiAqL1xyXG5cclxuZXhwb3J0IGdldE9wdGlvbnMgOj0gKGhPcHRpb25zOiBoYXNoPXt9LCBoRGVmYXVsdHM6IGhhc2g9e30pOiBoYXNoID0+XHJcblxyXG5cdHJldHVybiBhZGREZWZhdWx0cyBoT3B0aW9ucywgaERlZmF1bHRzXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuZXhwb3J0IGdldE9uZU9wdGlvbiA6PSAoaE9wdGlvbnM6IGhhc2g9e30sIG5hbWU6IHN0cmluZywgZGVmVmFsOiBhbnkpID0+XHJcblxyXG5cdHJldHVybiBoT3B0aW9uc1tuYW1lXSB8fCBkZWZWYWxcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG4vKipcclxuICogcmVtb3ZlIGFsbCBrZXlzIGZyb20gYSBoYXNoIHRoYXQgaGF2ZSBlaXRoZXIgYW4gZW1wdHkgbmFtZVxyXG4gKiBvciBhbiBlbXB0eSB2YWx1ZVxyXG4gKi9cclxuXHJcbmV4cG9ydCByZW1vdmVFbXB0eUtleXMgOj0gKGg6IGhhc2gpOiBoYXNoID0+XHJcblxyXG5cdGhSZXN1bHQ6IGhhc2ggOj0ge31cclxuXHRmb3Iga2V5IG9mIGtleXMoaClcclxuXHRcdGlmIG5vbkVtcHR5KGtleSkgJiYgbm9uRW1wdHkoaFtrZXldKVxyXG5cdFx0XHRoUmVzdWx0W2tleV0gPSBoW2tleV1cclxuXHRyZXR1cm4gaFJlc3VsdFxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbi8qKlxyXG4gKiByZXR1cm4gYW4gYXJyYXkgb2YgYWxsIG93biBrZXlzIGluIGEgaGFzaFxyXG4gKi9cclxuXHJcbmV4cG9ydCBrZXlzIDo9IChvYmo6IGhhc2gsIGhPcHRpb25zOiBoYXNoPXt9KTogc3RyaW5nW10gPT5cclxuXHJcblx0aCA6PSBnZXRPcHRpb25zIGhPcHRpb25zLCB7XHJcblx0XHRleGNlcHQ6IFtdXHJcblx0XHR9XHJcblxyXG5cdGxldCBleGNlcHQgPSBoLmV4Y2VwdFxyXG5cclxuXHRpZiBpc1N0cmluZyhleGNlcHQpXHJcblx0XHRleGNlcHQgPSBbZXhjZXB0XVxyXG5cdGxLZXlzOiBzdHJpbmdbXSA6PSBbXVxyXG5cdGZvciBrZXkgb2YgT2JqZWN0LmtleXMob2JqKVxyXG5cdFx0aWYgbm90IGV4Y2VwdC5pbmNsdWRlcyhrZXkpXHJcblx0XHRcdGxLZXlzLnB1c2gga2V5XHJcblx0cmV0dXJuIGxLZXlzXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuLyoqXHJcbiAqIHJldHVybnMgdHJ1ZSBpZiBlaXRoZXIgYGhgIGlzIG5vdCBkZWZpbmVkLCBvciBpZiBgaGAgaXNcclxuICogYSBoYXNoIHRoYXQgaW5jbHVkZXMgYWxsIHRoZSBrZXlzIHByb3ZpZGVkXHJcbiAqL1xyXG5cclxuZXhwb3J0IGhhc0tleSA6PSAoaDogaGFzaCwgLi4ubEtleXM6IHN0cmluZ1tdKTogYm9vbGVhbiA9PlxyXG5cclxuXHRpZiBub3RkZWZpbmVkKGgpXHJcblx0XHRyZXR1cm4gZmFsc2VcclxuXHRmb3Iga2V5IG9mIGxLZXlzXHJcblx0XHRhc3NlcnQgaXNTdHJpbmcoa2V5KSwgXCJrZXkgbm90IGEgc3RyaW5nOiAje09MKGtleSl9XCJcclxuXHRcdGlmIG5vdCBoLmhhc093blByb3BlcnR5KGtleSlcclxuXHRcdFx0cmV0dXJuIGZhbHNlXHJcblx0cmV0dXJuIHRydWVcclxuXHJcbmV4cG9ydCBoYXNLZXlzIDo9IGhhc0tleVxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbmV4cG9ydCBtaXNzaW5nS2V5cyA6PSAoaDogaGFzaCwgLi4ubEtleXM6IHN0cmluZ1tdKTogc3RyaW5nW10gPT5cclxuXHJcblx0aWYgbm90ZGVmaW5lZChoKVxyXG5cdFx0cmV0dXJuIGxLZXlzXHJcblx0YXNzZXJ0IGlzSGFzaChoKSwgXCJoIG5vdCBhIGhhc2g6ICN7T0woaCl9XCJcclxuXHRsTWlzc2luZzogc3RyaW5nW10gOj0gW11cclxuXHRmb3Iga2V5IG9mIGxLZXlzXHJcblx0XHRpZiBub3QgaC5oYXNPd25Qcm9wZXJ0eShrZXkpXHJcblx0XHRcdGxNaXNzaW5nLnB1c2gga2V5XHJcblx0cmV0dXJuIGxNaXNzaW5nXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuLyoqXHJcbiAqIG1lcmdlcyB0aGUgcHJvdmlkZWQgb2JqZWN0cyBpbnRvIGEgbmV3IG9iamVjdFxyXG4gKiBOT1RFOiBub25lIG9mIHRoZSBwcm92aWRlZCBhcmd1bWVudHMgYXJlIG1vZGlmaWVkXHJcbiAqL1xyXG5cclxuZXhwb3J0IG1lcmdlIDo9ICguLi5sT2JqZWN0czogaGFzaFtdKTogaGFzaCA9PlxyXG5cclxuXHRyZXR1cm4gT2JqZWN0LmFzc2lnbih7fSwgbE9iamVjdHMuLi4pXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuZXhwb3J0IGhpdCA6PSAocGN0OiBudW1iZXIgPSA1MCk6IGJvb2xlYW4gPT5cclxuXHJcblx0cmV0dXJuICgxMDAgKiBNYXRoLnJhbmRvbSgpIDwgcGN0KVxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuIyAtLS0gQVNZTkMgIVxyXG5cclxuZXhwb3J0IHNsZWVwIDo9IChzZWM6IG51bWJlcik6IHZvaWQgPT5cclxuXHJcblx0YXdhaXQgbmV3IFByb21pc2UoKHIpID0+IHNldFRpbWVvdXQociwgMTAwMCAqIHNlYykpXHJcblx0cmV0dXJuXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuZXhwb3J0IHNsZWVwU3luYyA6PSAoc2VjOiBudW1iZXIpOiB2b2lkID0+XHJcblxyXG5cdHN0YXJ0IDo9IERhdGUubm93KClcclxuXHRlbmQgOj0gRGF0ZS5ub3coKSArIDEwMDAqc2VjXHJcblx0d2hpbGUgKERhdGUubm93KCkgPCBlbmQpXHJcblx0cmV0dXJuXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuLyoqXHJcbiAqIHJldHVybnMgYSBzdHJpbmcgY29uc2lzdGluZyBvZiB0aGUgZ2l2ZW4gbnVtYmVyXHJcbiAqIG9mIHNwYWNlIGNoYXJhY3RlcnNcclxuICovXHJcblxyXG5leHBvcnQgc3BhY2VzIDo9IChuOiBudW1iZXIpOiBzdHJpbmcgPT5cclxuXHJcblxyXG5cdHJldHVybiAobiA8PSAwKSA/ICcnIDogJyAnLnJlcGVhdChuKVxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbi8qKlxyXG4gKiByZXR1cm5zIGEgc3RyaW5nIGNvbnNpc3Rpbmcgb2YgdGhlIGdpdmVuIG51bWJlclxyXG4gKiBvZiBUQUIgY2hhcmFjdGVyc1xyXG4gKi9cclxuXHJcbmV4cG9ydCB0YWJzIDo9IChuOiBudW1iZXIpOiBzdHJpbmcgPT5cclxuXHJcblx0cmV0dXJuIChuIDw9IDApID8gJycgOiAnXFx0Jy5yZXBlYXQobilcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG4vKipcclxuICogcnRyaW0gLSBzdHJpcCB0cmFpbGluZyB3aGl0ZXNwYWNlXHJcbiAqL1xyXG5cclxuZXhwb3J0IHJ0cmltIDo9IChsaW5lOiBzdHJpbmcpOiBzdHJpbmcgPT5cclxuXHJcblx0YXNzZXJ0IGlzU3RyaW5nKGxpbmUpLCBcIm5vdCBhIHN0cmluZzogI3t0eXBlb2YgbGluZX1cIlxyXG5cdGxNYXRjaGVzIDo9IGxpbmUubWF0Y2goL14oLio/KVxccyskLylcclxuXHRyZXR1cm4gKGxNYXRjaGVzID09IG51bGwpID8gbGluZSA6IGxNYXRjaGVzWzFdXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuLyoqXHJcbiAqIENvdW50IHRoZSBudW1iZXIgb2YgYSBzcGVjaWZpYyBjaGFyYWN0ZXIgaW4gYSBzdHJpbmdcclxuICovXHJcblxyXG5leHBvcnQgY291bnRDaGFycyA6PSAoc3RyOiBzdHJpbmcsIGNoOiBzdHJpbmcpOiBudW1iZXIgPT5cclxuXHJcblx0bGV0IGNvdW50ID0gMFxyXG5cdGxldCBwb3MgPSAtMVxyXG5cdHdoaWxlIChwb3MgPSBzdHIuaW5kZXhPZihjaCwgcG9zKzEpKSAhPSAtMVxyXG5cdFx0Y291bnQgKz0gMVxyXG5cdHJldHVybiBjb3VudFxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbi8qKlxyXG4gKiBjb252ZXJ0IGEgbXVsdGktbGluZSBzdHJpbmcgdG8gYW4gYXJyYXlcclxuICogb2Ygc2luZ2xlIGxpbmUgc3RyaW5nc1xyXG4gKi9cclxuXHJcbmV4cG9ydCBibG9ja1RvQXJyYXkgOj0gKGJsb2NrOiBzdHJpbmcpOiBzdHJpbmdbXSA9PlxyXG5cclxuXHRpZiBpc0VtcHR5KGJsb2NrKVxyXG5cdFx0cmV0dXJuIFtdXHJcblx0ZWxzZVxyXG5cdFx0cmV0dXJuIGJsb2NrLnNwbGl0KC9cXHI/XFxuLylcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgYWxsTGluZXNJbkJsb2NrIDo9IChcclxuXHRcdGJsb2NrOiBzdHJpbmdcclxuXHRcdCk6IEdlbmVyYXRvcjxzdHJpbmcsIHZvaWQsIHZvaWQ+IC0+XHJcblxyXG5cdGxldCBzdGFydCA9IDBcclxuXHRsZXQgZW5kID0gYmxvY2suaW5kZXhPZignXFxuJylcclxuXHR3aGlsZSAoZW5kICE9IC0xKVxyXG5cdFx0eWllbGQgYmxvY2suc3Vic3RyaW5nKHN0YXJ0LCBlbmQpXHJcblx0XHRzdGFydCA9IGVuZCArIDFcclxuXHRcdGVuZCA9IGJsb2NrLmluZGV4T2YoJ1xcbicsIHN0YXJ0KVxyXG5cdGlmIChzdGFydCA8IGJsb2NrLmxlbmd0aClcclxuXHRcdHlpZWxkIGJsb2NrLnN1YnN0cmluZyhzdGFydClcclxuXHRyZXR1cm5cclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG4vKipcclxuICogQSBzdHJpbmcgb3Igc3RyaW5nIGFycmF5XHJcbiAqL1xyXG5cclxuZXhwb3J0IHR5cGUgVEJsb2NrU3BlYyA9IHN0cmluZyB8IHN0cmluZ1tdXHJcblxyXG5leHBvcnQgaXNCbG9ja1NwZWMgOj0gKHg6IGFueSk6IHggaXMgVEJsb2NrU3BlYyA9PlxyXG5cclxuXHRyZXR1cm4gaXNTdHJpbmcoeCkgfHwgaXNBcnJheU9mU3RyaW5ncyh4KVxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbi8qKlxyXG4gKiByZXR1cm4gYW4gYXJyYXkgYXMgaXMsIGNvbnZlcnQgYSBtdWx0aS1saW5lIHN0cmluZ1xyXG4gKiB0byBhbiBhcnJheSBvZiBzaW5nbGUgbGluZSBzdHJpbmdzXHJcbiAqL1xyXG5cclxuZXhwb3J0IHRvQXJyYXkgOj0gKHN0ck9yQXJyYXk6IFRCbG9ja1NwZWMpOiBzdHJpbmdbXSA9PlxyXG5cclxuXHRpZiBBcnJheS5pc0FycmF5KHN0ck9yQXJyYXkpXHJcblx0XHRyZXR1cm4gc3RyT3JBcnJheVxyXG5cdGVsc2VcclxuXHRcdHJldHVybiBibG9ja1RvQXJyYXkoc3RyT3JBcnJheSlcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG4vKipcclxuICogY29udmVydCBhbiBhcnJheSBvZiBzdHJpbmdzIHRvIGEgc2luZ2xlIG11bHRpLWxpbmUgc3RyaW5nXHJcbiAqL1xyXG5cclxuZXhwb3J0IGFycmF5VG9CbG9jayA6PSAobExpbmVzOiBzdHJpbmdbXSk6IHN0cmluZyA9PlxyXG5cclxuXHRhc3NlcnQgaXNBcnJheShsTGluZXMpLCBcImxMaW5lcyBpcyBub3QgYW4gYXJyYXk6ICN7T0wobExpbmVzKX1cIlxyXG5cdHJldHVybiBsTGluZXMuZmlsdGVyKChsaW5lKSA9PiBkZWZpbmVkKGxpbmUpKS5qb2luKFwiXFxuXCIpXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuLyoqXHJcbiAqIHJldHVybiBhIHN0cmluZyBhcyBpcywgY29udmVydCBhbiBhcnJheSBvZiBzdHJpbmdzXHJcbiAqIHRvIGEgc2luZ2xlIG11bHRpLWxpbmUgc3RyaW5nXHJcbiAqL1xyXG5cclxuZXhwb3J0IHRvQmxvY2sgOj0gKHN0ck9yQXJyYXk6IFRCbG9ja1NwZWMpOiBzdHJpbmcgPT5cclxuXHJcblx0aWYgaXNTdHJpbmcoc3RyT3JBcnJheSlcclxuXHRcdHJldHVybiBzdHJPckFycmF5XHJcblx0ZWxzZVxyXG5cdFx0cmV0dXJuIGFycmF5VG9CbG9jayhzdHJPckFycmF5KVxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbmV4cG9ydCBpbnZlcnRIYXNoIDo9IChoOiBoYXNoKTogaGFzaCA9PlxyXG5cclxuXHRhc3NlcnQgaXNIYXNoKGgpLCBcIk5vdCBhIGhhc2g6ICN7T0woaCl9XCJcclxuXHRoUmVzdWx0OiBoYXNoIDo9IHt9XHJcblx0Zm9yIGtleSBvZiBrZXlzKGgpXHJcblx0XHR2YWx1ZSA6PSBoW2tleV1cclxuXHRcdGlmIGlzU3RyaW5nKHZhbHVlKVxyXG5cdFx0XHRoUmVzdWx0W3ZhbHVlXSA9IGtleVxyXG5cdHJldHVybiBoUmVzdWx0XHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuZXhwb3J0IHdpdGhvdXRLZXlzIDo9IChcclxuXHRcdGg6IGhhc2gsXHJcblx0XHQuLi5sS2V5czogc3RyaW5nW11cclxuXHRcdCk6IGhhc2ggPT5cclxuXHJcblx0aE5ldzogaGFzaCA6PSB7fVxyXG5cdGZvciBrZXkgb2Yga2V5cyhoKVxyXG5cdFx0aWYgbm90IGxLZXlzLmluY2x1ZGVzKGtleSlcclxuXHRcdFx0aE5ld1trZXldID0gaFtrZXldXHJcblx0cmV0dXJuIGhOZXdcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG50eXBlIFRLZXlWYWwgPSBba2V5OiBzdHJpbmcsIHZhbDogYW55XVxyXG5cclxuZXhwb3J0IHdpdGhLZXlWYWxzIDo9IChcclxuXHRcdGg6IGhhc2gsXHJcblx0XHQuLi5sS2V5VmFsczogVEtleVZhbFtdXHJcblx0XHQpOiBoYXNoID0+XHJcblxyXG5cdGhOZXc6IGhhc2ggOj0ge31cclxuXHRmb3IgayBvZiBrZXlzKGgpXHJcblx0XHRoTmV3W2tdID0gaFtrXVxyXG5cdGZvciBwYWlyIG9mIGxLZXlWYWxzXHJcblx0XHRba2V5LCB2YWxdIDo9IHBhaXJcclxuXHRcdGhOZXdba2V5XSA9IHZhbFxyXG5cdHJldHVybiBoTmV3XHJcblxyXG5leHBvcnQgd2l0aEtleVZhbCA9IHdpdGhLZXlWYWxzXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuLyoqXHJcbiAqIGJ5IGRlZmF1bHQsIHJlcGxhY2UgdGhlc2UgY2hhcmFjdGVyczpcclxuICogICAgY2FycmlhZ2UgcmV0dXJuXHJcbiAqICAgIG5ld2xpbmVcclxuICogICAgVEFCXHJcbiAqICAgIHNwYWNlXHJcbiAqIE9wdGlvbmFsbHksIGFkZCBhIGNoYXJhY3RlciB0byBpbmRpY2F0ZSBhIHBhcnRpY3VsYXJcclxuICogcG9zaXRpb24gaW4gdGhlIHN0cmluZ1xyXG4gKiBWYWxpZCBvcHRpb25zOlxyXG4gKiAgICBvZmZzZXQgLSBpbmRpY2F0ZSBwb3NpdGlvbiBvZiBvZmZzZXRcclxuICogICAgcG9zY2hhciAtIGNoYXIgdG8gdXNlIHRvIGluZGljYXRlIHBvc2l0aW9uXHJcbiAqL1xyXG5cclxuaERlYnVnUmVwbGFjZTogaGFzaCA6PSB7XHJcblx0XCJcXHJcIjogJ+KGkCdcclxuXHRcIlxcblwiOiAn4oaTJ1xyXG5cdFwiXFx0XCI6ICfihpInXHJcblx0XCIgXCI6ICAny7MnXHJcblx0fVxyXG5cclxuaENSZXBsYWNlOiBoYXNoIDo9IHtcclxuXHRcIlxcclwiOiAnXFxcXHInXHJcblx0XCJcXG5cIjogJ1xcXFxuJ1xyXG5cdFwiXFx0XCI6ICdcXFxcdCdcclxuXHR9XHJcblxyXG5leHBvcnQgZXNjYXBlU3RyIDo9IChcclxuXHRcdHN0cjogc3RyaW5nXHJcblx0XHRoT3B0aW9uczogaGFzaCA9IHt9XHJcblx0XHQpOiBzdHJpbmcgPT5cclxuXHJcblx0e1xyXG5cdFx0c3R5bGUsIGhSZXBsYWNlLCBibG9jaywgb2Zmc2V0LCBwb3NjaGFyLFxyXG5cdFx0YmVnaW5jaGFyLCBlbmRjaGFyXHJcblx0XHR9IDo9IGdldE9wdGlvbnMgaE9wdGlvbnMsIHtcclxuXHRcdFx0c3R5bGU6ICdkZWJ1ZydcclxuXHRcdFx0aFJlcGxhY2U6IHVuZGVmXHJcblx0XHRcdGJsb2NrOiBmYWxzZVxyXG5cdFx0XHRvZmZzZXQ6IHVuZGVmXHJcblx0XHRcdHJhbmdlOiB1bmRlZiAgICAgICMgLS0tIGNhbiBiZSBbaW50LCBpbnRdXHJcblx0XHRcdHBvc2NoYXI6ICfilIonXHJcblx0XHRcdGJlZ2luY2hhcjogJ+KfqCdcclxuXHRcdFx0ZW5kY2hhcjogJ+KfqSdcclxuXHRcdFx0fVxyXG5cclxuXHRsZXQgaFJlYWxSZXBsYWNlOiBoYXNoID0ge31cclxuXHRpZiBkZWZpbmVkKGhSZXBsYWNlKVxyXG5cdFx0aFJlYWxSZXBsYWNlID0gaFJlcGxhY2VcclxuXHRlbHNlIGlmIChzdHlsZSA9PSAnQycpXHJcblx0XHRpZiBibG9ja1xyXG5cdFx0XHRoUmVhbFJlcGxhY2UgPSB3aXRob3V0S2V5cyhoQ1JlcGxhY2UsICdcXG4nLCAnXFxyJylcclxuXHRcdGVsc2VcclxuXHRcdFx0aFJlYWxSZXBsYWNlID0gaENSZXBsYWNlXHJcblx0ZWxzZVxyXG5cdFx0aWYgYmxvY2tcclxuXHRcdFx0aFJlYWxSZXBsYWNlID0gd2l0aG91dEtleXMoaERlYnVnUmVwbGFjZSwgJ1xcbicsICdcXHInKVxyXG5cdFx0ZWxzZVxyXG5cdFx0XHRoUmVhbFJlcGxhY2UgPSBoRGVidWdSZXBsYWNlXHJcblxyXG5cdFtiZWdpblBvcywgZW5kUG9zXSA6PSAoXHJcblx0XHRpZiBkZWZpbmVkKHJhbmdlKSAmJiBpc0FycmF5KHJhbmdlKVxyXG5cdFx0XHRyYW5nZVxyXG5cdFx0ZWxzZVxyXG5cdFx0XHRbdW5kZWYsIHVuZGVmXVxyXG5cdFx0KVxyXG5cclxuXHRsUGFydHM6IHN0cmluZ1tdIDo9IFtdXHJcblx0Zm9yIGNoLGkgb2Ygc3RyXHJcblx0XHRpZiAoaSA9PSBvZmZzZXQpXHJcblx0XHRcdGxQYXJ0cy5wdXNoIHBvc2NoYXJcclxuXHRcdGVsc2UgaWYgKGkgPT0gYmVnaW5Qb3MpXHJcblx0XHRcdGxQYXJ0cy5wdXNoIGJlZ2luY2hhclxyXG5cdFx0ZWxzZSBpZiAoaSA9PSBlbmRQb3MpXHJcblx0XHRcdGxQYXJ0cy5wdXNoIGVuZGNoYXJcclxuXHRcdGxQYXJ0cy5wdXNoIChoUmVhbFJlcGxhY2VbY2hdIHx8IGNoKVxyXG5cdGlmIChvZmZzZXQgPT0gc3RyLmxlbmd0aClcclxuXHRcdGxQYXJ0cy5wdXNoIHBvc2NoYXJcclxuXHRyZXR1cm4gbFBhcnRzLmpvaW4oJycpXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuZXhwb3J0IHVuZXNjYXBlU3RyIDo9IChcclxuXHRcdHN0cjogc3RyaW5nXHJcblx0XHRoT3B0aW9uczogaGFzaCA9IHt9XHJcblx0XHQpOiBzdHJpbmcgPT5cclxuXHJcblx0e3N0eWxlLCBoUmVwbGFjZX0gOj0gZ2V0T3B0aW9ucyBoT3B0aW9ucywge1xyXG5cdFx0c3R5bGU6ICdDJ1xyXG5cdFx0aFJlcGxhY2U6IHVuZGVmXHJcblx0XHR9XHJcblxyXG5cdGxldCBoUmVhbFJlcGxhY2U6IGhhc2ggPSB7fVxyXG5cdGlmIGRlZmluZWQoaFJlcGxhY2UpXHJcblx0XHRoUmVhbFJlcGxhY2UgPSBoUmVwbGFjZVxyXG5cdGVsc2VcclxuXHRcdGlmIChzdHlsZSA9PSAnZGVidWcnKVxyXG5cdFx0XHRoUmVhbFJlcGxhY2UgPSB7XHJcblx0XHRcdFx0J+KGkCc6ICcnXHJcblx0XHRcdFx0J+KGkyc6ICdcXG4nXHJcblx0XHRcdFx0J+KGkic6ICdcXHQnXHJcblx0XHRcdFx0J8uzJzogJyAnXHJcblx0XHRcdFx0fVxyXG5cdFx0ZWxzZVxyXG5cdFx0XHRoUmVhbFJlcGxhY2UgPSB7XHJcblx0XHRcdFx0J24nOiAnXFxuJ1xyXG5cdFx0XHRcdCdyJzogJycgICAgICMgY2FycmlhZ2UgcmV0dXJuIHNob3VsZCBqdXN0IGRpc2FwcGVhclxyXG5cdFx0XHRcdCd0JzogJ1xcdCdcclxuXHRcdFx0XHR9XHJcblxyXG5cdGxldCBlc2MgPSBmYWxzZVxyXG5cdGxQYXJ0czogc3RyaW5nW10gOj0gW11cclxuXHRmb3IgY2gsaSBvZiBzdHJcclxuXHRcdGlmIChjaCA9PSAnXFxcXCcpXHJcblx0XHRcdGlmIGVzY1xyXG5cdFx0XHRcdGxQYXJ0cy5wdXNoICdcXFxcJ1xyXG5cdFx0XHRcdGVzYyA9IGZhbHNlXHJcblx0XHRcdGVsc2VcclxuXHRcdFx0XHRlc2MgPSB0cnVlXHJcblx0XHRlbHNlXHJcblx0XHRcdGlmIGVzY1xyXG5cdFx0XHRcdGlmIGRlZmluZWQoaFJlYWxSZXBsYWNlW2NoXSlcclxuXHRcdFx0XHRcdGxQYXJ0cy5wdXNoIGhSZWFsUmVwbGFjZVtjaF1cclxuXHRcdFx0XHRlbHNlXHJcblx0XHRcdFx0XHRsUGFydHMucHVzaCBjaFxyXG5cdFx0XHRcdGVzYyA9IGZhbHNlXHJcblx0XHRcdGVsc2VcclxuXHRcdFx0XHRsUGFydHMucHVzaCBjaFxyXG5cdHJldHVybiBsUGFydHMuam9pbignJylcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG4vKipcclxuICogZG9uJ3QgZXNjYXBlIG5ld2xpbmUgb3IgY2FycmlhZ2UgcmV0dXJuXHJcbiAqIE9wdGlvbmFsbHksIGFkZCBhIGNoYXJhY3RlciB0byBpbmRpY2F0ZSBhIHBhcnRpY3VsYXJcclxuICogcG9zaXRpb24gaW4gdGhlIHN0cmluZ1xyXG4gKi9cclxuXHJcbmV4cG9ydCBlc2NhcGVCbG9jayA6PSAoXHJcblx0YmxvY2s6IHN0cmluZyxcclxuXHRoT3B0aW9uczogaGFzaCA9IHt9XHJcblx0KTogc3RyaW5nID0+XHJcblxyXG5cdHJldHVybiBlc2NhcGVTdHIoYmxvY2ssIHdpdGhLZXlWYWwoaE9wdGlvbnMsIFsnYmxvY2snLCB0cnVlXSkpXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuZXhwb3J0IHJlbHBhdGggOj0gKHBhdGg6IHN0cmluZyk6IHN0cmluZyA9PlxyXG5cclxuXHRyZXR1cm4gcmVsYXRpdmUoRGVuby5jd2QoKSwgcGF0aCkucmVwbGFjZUFsbCgnXFxcXCcsICcvJylcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG4vKipcclxuICogU3BsaXRzIGEgc3RyaW5nIG9uIHdoaXRlc3BhY2UgaW50byBhbiBhcnJheSxcclxuICogaWdub3JpbmcgYW55IGxlYWRpbmcgb3IgdHJhaWxpbmcgd2hpdGVzcGFjZVxyXG4gKi9cclxuXHJcbmV4cG9ydCB3c1NwbGl0IDo9IChzdHI6IHN0cmluZyk6IHN0cmluZ1tdID0+XHJcblxyXG5cdG5ld3N0ciA6PSBzdHIudHJpbSgpXHJcblx0aWYgKG5ld3N0ciA9PSAnJylcclxuXHRcdHJldHVybiBbXVxyXG5cdGVsc2VcclxuXHRcdHJldHVybiBuZXdzdHIuc3BsaXQoL1xccysvKVxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbi8qKlxyXG4gKiBzcGxpdHMgZWFjaCBzdHJpbmcgb24gd2hpdGVzcGFjZSBpZ25vcmluZyBhbnkgbGVhZGluZ1xyXG4gKiBvciB0cmFpbGluZyB3aGl0ZXNwYWNlLCBhbmQgcmV0dXJucyBhbiBhcnJheSBvZlxyXG4gKiBhbGwgc3Vic3RyaW5ncyBvYnRhaW5lZFxyXG4gKi9cclxuXHJcbmV4cG9ydCB3b3JkcyA6PSAoLi4ubFN0cmluZ3M6IHN0cmluZ1tdKTogc3RyaW5nW10gPT5cclxuXHJcblx0bGV0IGxXb3JkcyA9IFtdXHJcblx0Zm9yIHN0ciBvZiBsU3RyaW5nc1xyXG5cdFx0Zm9yIHdvcmQgb2Ygd3NTcGxpdChzdHIpXHJcblx0XHRcdGxXb3Jkcy5wdXNoIHdvcmRcclxuXHRyZXR1cm4gbFdvcmRzXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuLyoqXHJcbiAqIGNhbGN1bGF0ZXMgdGhlIG51bWJlciBvZiBleHRyYSBjaGFyYWN0ZXJzIG5lZWRlZCB0b1xyXG4gKiBtYWtlIHRoZSBnaXZlbiBzdHJpbmcgaGF2ZSB0aGUgZ2l2ZW4gbGVuZ3RoLlxyXG4gKiBJZiBub3QgcG9zc2libGUsIHJldHVybnMgMFxyXG4gKi9cclxuXHJcbmV4cG9ydCBnZXRORXh0cmEgOj0gKHN0cjogc3RyaW5nLCBsZW46IG51bWJlcik6IG51bWJlciA9PlxyXG5cclxuXHRleHRyYSA6PSBsZW4gLSBzdHIubGVuZ3RoXHJcblx0cmV0dXJuIChleHRyYSA+IDApID8gZXh0cmEgOiAwXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuLyoqXHJcbiAqIHBhZHMgdGhlIGdpdmVuIHN0cmluZyBvbiB0aGUgcmlnaHQgd2l0aFxyXG4gKiB0aGUgZ2l2ZW4gY2hhcmFjdGVyLCB0byB0aGUgZ2l2ZW4gbGVuZ3RoXHJcbiAqL1xyXG5cclxuZXhwb3J0IHJwYWQgOj0gKHN0cjogc3RyaW5nLCBsZW46IG51bWJlciwgY2g6IHN0cmluZz0nICcpOiBzdHJpbmcgPT5cclxuXHJcblx0YXNzZXJ0IChjaC5sZW5ndGggPT0gMSksIFwiTm90IGEgY2hhclwiXHJcblx0ZXh0cmEgOj0gZ2V0TkV4dHJhKHN0ciwgbGVuKVxyXG5cdHJldHVybiBzdHIgKyBjaC5yZXBlYXQoZXh0cmEpXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuLyoqXHJcbiAqIHBhZHMgdGhlIGdpdmVuIHN0cmluZyBvbiB0aGUgbGVmdCB3aXRoXHJcbiAqIHRoZSBnaXZlbiBjaGFyYWN0ZXIsIHRvIHRoZSBnaXZlbiBsZW5ndGhcclxuICovXHJcblxyXG5leHBvcnQgbHBhZCA6PSAoc3RyOiBzdHJpbmcsIGxlbjogbnVtYmVyLCBjaDogc3RyaW5nPScgJyk6IHN0cmluZyA9PlxyXG5cclxuXHRhc3NlcnQgKGNoLmxlbmd0aCA9PSAxKSwgXCJOb3QgYSBjaGFyXCJcclxuXHRleHRyYSA6PSBnZXRORXh0cmEoc3RyLCBsZW4pXHJcblx0cmV0dXJuIGNoLnJlcGVhdChleHRyYSkgKyBzdHJcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbiMgLS0tIHZhbGlkIG9wdGlvbnM6XHJcbiMgICAgICAgIGNoYXIgLSBjaGFyIHRvIHVzZSBvbiBsZWZ0IGFuZCByaWdodFxyXG4jICAgICAgICBidWZmZXIgLSBudW0gc3BhY2VzIGFyb3VuZCB0ZXh0IHdoZW4gY2hhciA8PiAnICdcclxuXHJcbi8qKlxyXG4gKiBwYWRzIHRoZSBnaXZlbiBzdHJpbmcgb24gYm90aCB0aGUgbGVmdCBhbmQgcmlnaHRcclxuICogd2l0aCB0aGUgZ2l2ZW4gY2hhcmFjdGVyLCB0byB0aGUgZ2l2ZW4gbGVuZ3RoXHJcbiAqIGJ1dCB3aXRoIHRoZSBnaXZlbiBudW1iZXIgb2YgYnVmZmVyIGNoYXJzIHN1cnJvdW5kaW5nXHJcbiAqIHRoZSB0ZXh0XHJcbiAqL1xyXG5cclxuZXhwb3J0IGNlbnRlcmVkIDo9IChcclxuXHR0ZXh0OiBzdHJpbmcsXHJcblx0d2lkdGg6IG51bWJlcixcclxuXHRjaGFyOiBzdHJpbmcgPSAnICcsXHJcblx0bnVtQnVmZmVyOiBudW1iZXIgPSAyXHJcblx0KTogc3RyaW5nID0+XHJcblxyXG5cdHRvdFNwYWNlcyA6PSB3aWR0aCAtIHRleHQubGVuZ3RoXHJcblx0aWYgKHRvdFNwYWNlcyA8PSAwKVxyXG5cdFx0cmV0dXJuIHRleHRcclxuXHRudW1MZWZ0IDo9IE1hdGguZmxvb3IodG90U3BhY2VzIC8gMilcclxuXHRudW1SaWdodCA6PSB0b3RTcGFjZXMgLSBudW1MZWZ0XHJcblx0aWYgKGNoYXIgPT0gJyAnKVxyXG5cdFx0cmV0dXJuIHNwYWNlcyhudW1MZWZ0KSArIHRleHQgKyBzcGFjZXMobnVtUmlnaHQpXHJcblx0ZWxzZVxyXG5cdFx0YnVmIDo9ICcgJy5yZXBlYXQobnVtQnVmZmVyKVxyXG5cdFx0bGVmdCA6PSBjaGFyLnJlcGVhdChudW1MZWZ0IC0gbnVtQnVmZmVyKVxyXG5cdFx0cmlnaHQgOj0gY2hhci5yZXBlYXQobnVtUmlnaHQgLSBudW1CdWZmZXIpXHJcblx0XHRyZXR1cm4gbGVmdCArIGJ1ZiArIHRleHQgKyBidWYgKyByaWdodFxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbi8qKlxyXG4gKiBwYWQgYSBzdHJpbmcgb24gdGhlIGxlZnQsIHJpZ2h0LCBvciBib3RoXHJcbiAqIHRvIHRoZSBnaXZlbiB3aWR0aFxyXG4gKi9cclxuXHJcbmV4cG9ydCB0eXBlIFRBbGlnbm1lbnQgPSAnbCd8J2MnfCdyJ3wnbGVmdCd8J2NlbnRlcid8J3JpZ2h0J1xyXG5cclxuZXhwb3J0IGlzQWxpZ25tZW50IDo9ICh4OiBhbnkpOiB4IGlzIFRBbGlnbm1lbnQgPT5cclxuXHJcblx0cmV0dXJuIFsnbCcsJ2MnLCdyJywnbGVmdCcsJ2NlbnRlcicsJ3JpZ2h0J10uaW5jbHVkZXMoeClcclxuXHJcbmV4cG9ydCBhbGlnblN0cmluZyA6PSAoXHJcblx0c3RyOiBzdHJpbmcsXHJcblx0d2lkdGg6IG51bWJlcixcclxuXHRhbGlnbjogVEFsaWdubWVudFxyXG5cdCk6IHN0cmluZyAtPlxyXG5cclxuXHRzd2l0Y2ggYWxpZ25cclxuXHRcdHdoZW4gJ2xlZnQnLCAnbCdcclxuXHRcdFx0cmV0dXJuIHJwYWQoc3RyLCB3aWR0aClcclxuXHRcdHdoZW4gJ2NlbnRlcicsICdjJ1xyXG5cdFx0XHRyZXR1cm4gY2VudGVyZWQoc3RyLCB3aWR0aClcclxuXHRcdHdoZW4gJ3JpZ2h0JywgJ3InXHJcblx0XHRcdHJldHVybiBscGFkKHN0ciwgd2lkdGgpXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuLyoqXHJcbiAqIGNvbnZlcnRzIHRoZSBnaXZlbiBudW1iZXIgdG8gYSBzdHJpbmcsIHRoZW4gcGFkcyBvbiB0aGUgbGVmdFxyXG4gKiB3aXRoIHplcm9zIHRvIGFjaGlldmUgdGhlIGdpdmVuIGxlbmd0aFxyXG4gKi9cclxuXHJcbmV4cG9ydCB6cGFkIDo9IChuOiBudW1iZXIsIGxlbjogbnVtYmVyKTogc3RyaW5nID0+XHJcblxyXG5cdHJldHVybiBscGFkKG4udG9TdHJpbmcoKSwgbGVuLCAnMCcpXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4jIEdFTkVSQVRPUlxyXG5cclxuZXhwb3J0IGFsbE1hdGNoZXMgOj0gKHN0cjogc3RyaW5nLCByZTogUmVnRXhwKTogR2VuZXJhdG9yPHN0cmluZ1tdLCB2b2lkLCB2b2lkPiAtPlxyXG5cclxuXHQjIC0tLSBFbnN1cmUgdGhlIHJlZ2V4IGhhcyB0aGUgZ2xvYmFsIGZsYWcgKGcpIHNldFxyXG5cdG5ld3JlIDo9IG5ldyBSZWdFeHAocmUsIHJlLmZsYWdzICsgKHJlLmZsYWdzLmluY2x1ZGVzKCdnJykgPyAnJyA6ICdnJykpXHJcblx0bGV0IGxNYXRjaGVzOiBzdHJpbmdbXSB8IG51bGwgPSBudWxsXHJcblx0d2hpbGUgZGVmaW5lZChsTWF0Y2hlcyA9IG5ld3JlLmV4ZWMoc3RyKSlcclxuICBcdFx0eWllbGQgbE1hdGNoZXNcclxuXHRyZXR1cm5cclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG4vKipcclxuICogQSBnZW5lcmF0b3IgdGhhdCB5aWVsZHMgaW50ZWdlcnMgc3RhcnRpbmcgd2l0aCAwIGFuZFxyXG4gKiBjb250aW51aW5nIHRvIG4tMVxyXG4gKi9cclxuXHJcbmV4cG9ydCByYW5nZSA6PSAoXHJcblx0bjogbnVtYmVyXHJcblx0KTogR2VuZXJhdG9yPG51bWJlciwgdm9pZCwgdm9pZD4gLT5cclxuXHJcblx0bGV0IGkgPSAwXHJcblx0d2hpbGUgKGkgPCBuKVxyXG5cdFx0eWllbGQgaVxyXG5cdFx0aSA9IGkgKyAxXHJcblx0cmV0dXJuXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuZXhwb3J0IGNsYXNzIEZldGNoZXI8VD5cclxuXHJcblx0aXRlcjogSXRlcmF0b3I8VD5cclxuXHRidWZmZXI6IFQ/ID0gdW5kZWZcclxuXHJcblx0Y29uc3RydWN0b3IoQGl0ZXI6IEl0ZXJhdG9yPFQ+LCBAZW9mVmFsdWU6IFQpXHJcblxyXG5cdHBlZWsoKTogVFxyXG5cdFx0aWYgZGVmaW5lZChAYnVmZmVyKVxyXG5cdFx0XHRyZXR1cm4gQGJ1ZmZlclxyXG5cdFx0ZWxzZVxyXG5cdFx0XHR7dmFsdWUsIGRvbmV9IDo9IEBpdGVyLm5leHQoKVxyXG5cdFx0XHRpZiBkb25lXHJcblx0XHRcdFx0cmV0dXJuIEBlb2ZWYWx1ZVxyXG5cdFx0XHRlbHNlXHJcblx0XHRcdFx0QGJ1ZmZlciA9IHZhbHVlXHJcblx0XHRcdFx0cmV0dXJuIHZhbHVlXHJcblxyXG5cdGdldChleHBlY3RlZDogVD89dW5kZWYpOiBUXHJcblx0XHRsZXQgcmVzdWx0OiBUID0gQGVvZlZhbHVlXHJcblx0XHRpZiBkZWZpbmVkKEBidWZmZXIpXHJcblx0XHRcdHJlc3VsdCA9IEBidWZmZXJcclxuXHRcdFx0QGJ1ZmZlciA9IHVuZGVmXHJcblx0XHRlbHNlXHJcblx0XHRcdHt2YWx1ZSwgZG9uZX0gOj0gQGl0ZXIubmV4dCgpXHJcblx0XHRcdHJlc3VsdCA9IGRvbmUgPyBAZW9mVmFsdWUgOiB2YWx1ZVxyXG5cdFx0aWYgZGVmaW5lZChleHBlY3RlZClcclxuXHRcdFx0YXNzZXJ0IGRlZXBFcXVhbChyZXN1bHQsIGV4cGVjdGVkKSxcclxuXHRcdFx0XHRcdFwiI3tPTChleHBlY3RlZCl9IGV4cGVjdGVkXCJcclxuXHRcdHJldHVybiByZXN1bHRcclxuXHJcblx0c2tpcChleHBlY3RlZDogVD89dW5kZWYpOiB2b2lkXHJcblx0XHRAZ2V0KGV4cGVjdGVkKVxyXG5cdFx0cmV0dXJuXHJcblxyXG5cdGF0RW5kKCk6IGJvb2xlYW5cclxuXHRcdGlmIGRlZmluZWQoQGJ1ZmZlcilcclxuXHRcdFx0cmV0dXJuIGZhbHNlXHJcblx0XHRlbHNlXHJcblx0XHRcdHt2YWx1ZSwgZG9uZX0gOj0gQGl0ZXIubmV4dCgpXHJcblx0XHRcdGlmIGRvbmUgfHwgKHZhbHVlID09IEBlb2ZWYWx1ZSlcclxuXHRcdFx0XHRyZXR1cm4gdHJ1ZVxyXG5cdFx0XHRlbHNlXHJcblx0XHRcdFx0QGJ1ZmZlciA9IHZhbHVlXHJcblx0XHRcdFx0cmV0dXJuIGZhbHNlXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuZXhwb3J0IGFzc2VydFNhbWVTdHIgOj0gKFxyXG5cdFx0c3RyMTogc3RyaW5nLFxyXG5cdFx0c3RyMjogc3RyaW5nXHJcblx0XHQpOiB2b2lkID0+XHJcblxyXG5cdGlmIChzdHIxICE9IHN0cjIpXHJcblx0XHRjb25zb2xlLmxvZyBjZW50ZXJlZChcIlN0cmluZ3MgRGlmZmVyOlwiLCA2NCwgJy0nKVxyXG5cdFx0Y29uc29sZS5sb2cgY2VudGVyZWQoXCJzdHJpbmcgMVwiLCA2NCwgJy0nKVxyXG5cdFx0Y29uc29sZS5sb2cgc3RyMVxyXG5cdFx0Y29uc29sZS5sb2cgY2VudGVyZWQoXCJzdHJpbmcgMlwiLCA2NCwgJy0nKVxyXG5cdFx0Y29uc29sZS5sb2cgc3RyMlxyXG5cdFx0Y29uc29sZS5sb2cgJy0nLnJlcGVhdCg2NClcclxuXHJcblx0YXNzZXJ0IChzdHIxID09IHN0cjIpLCBcInN0cmluZ3MgZGlmZmVyXCJcclxuXHRyZXR1cm5cclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgaW50ZXJwb2xhdGUgOj0gKFxyXG5cdFx0c3RyOiBzdHJpbmdcclxuXHRcdGhSZXBsYWNlOiBoYXNob2Y8c3RyaW5nPiAgICMgLS0tIHsgPHRhZz46IDxyZXBsYWNlbWVudD4sIC4uLiB9XHJcblx0XHQpOiBzdHJpbmcgPT5cclxuXHJcblx0Zm9yIGtleSBvZiBPYmplY3Qua2V5cyhoUmVwbGFjZSlcclxuXHRcdGFzc2VydCAoa2V5WzBdID09ICckJyksIFwiYWxsIGtleXMgbXVzdCBzdGFydCB3aXRoICckJ1wiXHJcblx0cmUgOj0gLy8vXHJcblx0XHRcXCRcclxuXHRcdCg/OltBLVphLXpdW0EtWmEtejAtOV0qKVxyXG5cdFx0Ly8vZ1xyXG5cdHJldHVybiBzdHIucmVwbGFjZUFsbChyZSwgKG1hdGNoOiBzdHJpbmcpID0+XHJcblx0XHRyZXR1cm4gaFJlcGxhY2VbbWF0Y2hdIHx8IG1hdGNoXHJcblx0XHQpXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4jIC0tLSBnZW5lcmF0ZSByYW5kb20gbGFiZWxzXHJcblxyXG5sYWJlbEdlbiA6PSAoKTogR2VuZXJhdG9yPHN0cmluZywgdm9pZCwgdm9pZD4gLT5cclxuXHJcblx0Zm9yIGNoIG9mIFsnQScuLidaJ11cclxuXHRcdHlpZWxkIGNoXHJcblx0Zm9yIGNoIG9mIFsnQScuLidaJ11cclxuXHRcdGZvciBjaDIgb2YgWydBJy4uJ1onXVxyXG5cdFx0XHR5aWVsZCBjaCArIGNoMlxyXG5cdGZvciBjaCBvZiBbJ0EnLi4nWiddXHJcblx0XHRmb3IgY2gyIG9mIFsnQScuLidaJ11cclxuXHRcdFx0Zm9yIGNoMyBvZiBbJ0EnLi4nWiddXHJcblx0XHRcdFx0eWllbGQgY2ggKyBjaDIgKyBjaDNcclxuXHRyZXR1cm5cclxuXHJcbiMgLS0tIENyZWF0ZSBhbiBpdGVyYXRvciBmcm9tIHRoZSBnZW5lcmF0b3JcclxubGFiZWxzIDo9IGxhYmVsR2VuKClcclxuXHJcbmV4cG9ydCByYW5kb21MYWJlbCA6PSAoKTogc3RyaW5nID0+XHJcblx0bGFiZWwgOj0gbGFiZWxzLm5leHQoKVxyXG5cdHJldHVybiBsYWJlbC5kb25lID8gJ0VSUiEnIDogbGFiZWwudmFsdWVcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgcmVxdWlyZSA6PSBnZXRJbXBvcnRTeW5jKGltcG9ydC5tZXRhLnVybClcclxuIl19