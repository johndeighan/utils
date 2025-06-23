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

export const require = getImportSync(import.meta.url)

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3JjL2xpYi9sbHV0aWxzLmxpYi5jaXZldC50c3giLCJzb3VyY2VzIjpbInNyYy9saWIvbGx1dGlscy5saWIuY2l2ZXQiXSwibWFwcGluZ3MiOiI7QUFBQSxvQkFBbUI7QUFDbkIsQUFBQTtBQUNBLEssVyx5QjtBQUFBLE1BQU0sQ0FBQyxDQUFDLGFBQWEsQ0FBQyxDQUFDLElBQUksQ0FBQyxhQUFhO0FBQ3pDLEFBQUEsQUFBQSxNQUFNLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxJQUFJLENBQUMsaUJBQWlCO0FBQ3ZDLEFBQUEsQUFBQSxNQUFNLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxJQUFJLENBQUMsV0FBVztBQUNsQyxBQUFBO0FBQ0EsQUFBQSxBQUFBLE1BQU0sQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLElBQUksQ0FBQyxxQkFBcUI7QUFDNUMsQUFBQSxBQUFBLE1BQU0sQ0FBQyxDQUFDO0FBQ1IsQ0FBQyxLQUFLLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxTQUFTLENBQUM7QUFDckQsQ0FBQyxNQUFNLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDLGdCQUFnQixDQUFDO0FBQ3JELENBQUMsT0FBTyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsU0FBUyxDQUFDO0FBQ2xELENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsUUFBUSxDQUFDO0FBQ2pELENBQUMsV0FBVyxDQUFDLENBQUMsY0FBYyxDQUFDLENBQUMsV0FBVyxDQUFDO0FBQzFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxvQkFBb0I7QUFDNUIsQUFBQTtBQUNBLEFBQUE7QUFDQTtBQUNBLEdBQUc7QUFDSCxBQUFBO0FBQ0Es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RCxBQUFBO0FBQ0EsQUFBQSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUEsQUFBQyxvQkFBb0IsQ0FBQTtBQUNqQyxBQUFBLENBQVMsTUFBUixRQUFRLENBQUMsQ0FBRSxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFBLENBQUE7QUFDdkMsQUFBQSxFQUFFLE9BQU8sQ0FBQyxHQUFHLENBQUEsQUFBQyxDQUFDLFNBQVMsRUFBRSxTQUFTLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDN0MsQUFBQSxFQUFRLE1BQU4sTUFBTSxDQUFDLENBQUUsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUM7QUFDdEMsQUFBQSxFQUFFLE9BQU8sQ0FBQyxHQUFHLENBQUEsQUFBQyxDQUFDLFVBQVUsRUFBRSxTQUFTLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDL0MsQUFBQSxFQUFFLE1BQU0sQ0FBQyxNO0NBQU0sQ0FBQTtBQUNmLEFBQUEsQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxRQUFRLENBQUMsQ0FBQyxRQUFRLEM7QUFBQyxDQUFBO0FBQ2xELEFBQUE7QUFDQSxBQUFBLDhFQUE2RTtBQUM3RSxBQUFBO0FBQ0EsQUFBQTtBQUNBO0FBQ0EsR0FBRztBQUNILEFBQUE7QUFDQSxBQUFBLEFBQUEsTUFBTSxDQUFFLE1BQUQsQ0FBQyxDQUFDLENBQUUsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLG9CQUFvQixDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFBLENBQUE7QUFDdkQsQUFBQTtBQUNBLEFBQUEsQ0FBUyxNQUFSLFFBQVEsQ0FBQyxDQUFFLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUEsQ0FBQTtBQUN2QyxBQUFBLEVBQU8sTUFBTCxLQUFL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Q0FBQyxDQUFDO0FBQ1osRUFBRSxDQUFDLENBQUE7QUFDSCxBQUFBO0FBQ0EsQUFBQSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNO0FBQ3RCLEFBQUE7QUFDQSxBQUFBLENBQUMsR0FBRyxDQUFBLFFBQVEsQ0FBQyxNQUFNLENBQUMsQ0FBQSxDQUFBLENBQUE7QUFDcEIsQUFBQSxFQUFFLE1BQU0sQyxDQUFFLENBQUMsQ0FBQyxNQUFNLEM7Q0FBQyxDQUFBO0FBQ25CLEFBQUEsQ0FBZ0IsTUFBZixLQUFLLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUUsQ0FBQyxDQUFDLENBQUM7QUFDdEIsQUFBQSxDQUFDLEdBQUcsQ0FBQyxDQUFBLE1BQUEsR0FBRyxDQUFDLEVBQUUsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFBLENBQUEsQ0FBQTtBQUM1QixBQUFBLEVBQUUsR0FBRyxDQUFBLENBQUksTUFBTSxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQSxDQUFBLENBQUE7QUFDN0IsQUFBQSxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUEsQUFBQyxHQUFHLEM7RUFBQSxDO0NBQUEsQ0FBQTtBQUNqQixBQUFBLENBQUMsTUFBTSxDQUFDLEs7QUFBSyxDQUFBO0FBQ2IsQUFBQTtBQUNBLEFBQUEsOEVBQTZFO0FBQzdFLEFBQUE7QUFDQSxBQUFBO0FBQ0E7QUFDQTtBQUNBLEdBQUc7QUFDSCxBQUFBO0FBQ0EsQUFBQSxBQUFBLE1BQU0sQ0FBTyxNQUFOLE1BQU0sQ0FBQyxDQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLEtBQUssQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUEsQ0FBQTtBQUMxRCxBQUFBO0FBQ0EsQUFBQSxDQUFDLEdBQUcsQ0FBQSxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUEsQ0FBQSxDQUFBO0FBQ2pCLEFB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LE1BQU0sQ0FBQyxDQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUEsQ0FBQTtBQUN2QyxBQUFBO0FBQ0EsQUFBQTtBQUNBLEFBQUEsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDO0FBQUMsQ0FBQTtBQUNyQyxBQUFBO0FBQ0EsQUFBQSw4RUFBNkU7QUFDN0UsQUFBQTtBQUNBLEFBQUE7QUFDQTtBQUNBO0FBQ0EsR0FBRztBQUNILEFBQUE7QUFDQSxBQUFBLEFBQUEsTUFBTSxDQUFLLE1BQUosSUFBSSxDQUFDLENBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQSxDQUFBO0FBQ3JDLEFBQUE7QUFDQSxBQUFBLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQztBQUFDLENBQUE7QUFDdEMsQUFBQTtBQUNBLEFBQUEsOEVBQTZFO0FBQzdFLEFBQUE7QUFDQSxBQUFBO0FBQ0E7QUFDQSxHQUFHO0FBQ0gsQUFBQTtBQUNBLEFBQUEsQUFBQSxNQUFNLENBQU0sTUFBTCxLQUFLLENBQUMsQ0FBRSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFBLENBQUE7QUFDekMsQUFBQTtBQUNBLEFBQUEsQ0FBQyxNQUFNLENBQUEsQUFBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLGNBQWMsRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQTtBQUN0RCxBQUFBLENBQVMsTUFB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LENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUEsQ0FBQTtBQUNwRCxBQUFBO0FBQ0EsQUFBQSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNoQixBQUFBLENBQUMsR0FBRyxDQUFDLENBQUEsTUFBQSxHQUFHLENBQUMsRUFBRSxDQUFDLFFBQVEsQ0FBQSxDQUFBLENBQUE7QUFDcEIsQUFBQSxFQUFFLEdBQUcsQ0FBQyxDQUFBLE1BQUEsSUFBSSxDQUFDLEVBQUUsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUEsQ0FBQSxDQUFBO0FBQzFCLEFBQUEsR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFBLEFBQUMsSUFBSSxDO0VBQUEsQztDQUFBLENBQUE7QUFDbkIsQUFBQSxDQUFDLE1BQU0sQ0FBQyxNO0FBQU0sQ0FBQTtBQUNkLEFBQUE7QUFDQSxBQUFBLDhFQUE2RTtBQUM3RSxBQUFBO0FBQ0EsQUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLEdBQUc7QUFDSCxBQUFBO0FBQ0EsQUFBQSxBQUFBLE1BQU0sQ0FBVSxNQUFULFNBQVMsQ0FBQyxDQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUEsQ0FBQTtBQUN6RCxBQUFBO0FBQ0EsQUFBQSxDQUFNLE1BQUwsS0FBSyxDQUFDLENBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxNQUFNO0FBQzFCLEFBQUEsQ0FBQyxNQUFNLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEM7QUFBQyxDQUFBO0FBQy9CLEFBQUE7QUFDQSxBQUFBLDhFQUE2RTtBQUM3RSxBQUFBO0FBQ0EsQUFBQTtBQUNBO0FBQ0E7QUFDQSxHQUFHO0FBQ0gsQUFBQTtBQUNBLEFBQUEsQUFBQSxNQUFNLENBQUssTUFBSixJQUFJLENBQUMsQ0FBRSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQSxDQUFBO0FBQ3BFLEFBQUE7QUFDQSxBQUFBLENBQUMsTUFBTSxDQUFBLEFBQUMsQ0FBQyxFQUFFLENBQUMsTUFBTSxDQUFDLEdBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFlBQVksQ0FBQTtBQUN0QyxBQUFBLENBQU0sTUFBTCxLQUFLLENBQUMsQ0FBRSxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUM7QUFDN0IsQUFBQSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxNQUFNLENBQUMsS0FBSyxDO0FBQUMsQ0FBQTtBQUM5QixBQUFBO0FBQ0EsQUFBQSw4RUFBNkU7QUFDN0UsQUFBQTtBQUNBLEFBQUE7QUFDQTtBQUNBO0FBQ0EsR0FBRztBQUNILEFBQUE7QUFDQSxBQUFBLEFBQUEsTUFBTSxDQUFLLE1BQUosSUFBSSxDQUFDLENBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUEsQ0FBQTtBQUNwRSxBQUFBO0FBQ0EsQUFBQSxDQUFDLE1BQU0sQ0FBQSxBQUFDLENBQUMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxHQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxZQUFZLENBQUE7QUFDdEMsQUFBQSxDQUFNLE1BQUwsS0FBSyxDQUFDLENBQUUsQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBRyxD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O0FBQ0EsQUFBQSxBQUFBLE1BQU0sQ0FBSyxNQUFKLElBQUksQ0FBQyxDQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUEsQ0FBQTtBQUNsRCxBQUFBO0FBQ0EsQUFBQSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLEM7QUFBQyxDQUFBO0FBQ3BDLEFBQUE7QUFDQSxBQUFBLDhFQUE2RTtBQUM3RSxBQUFBLFlBQVc7QUFDWCxBQUFBO0FBQ0EsQUFBQSxBQUFBLE1BQU0sQ0FBVyxNQUFWLFVBQVUsQ0FBQyxDQUFFLENBQTRELFEsQ0FBM0QsQ0FBQyxHQUFHLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFJLENBQUEsQ0FBQTtBQUNsRixBQUFBO0FBQ0EsQUFBQSxDQUFDLG1EQUFrRDtBQUNuRCxBQUFBLENBQU0sTUFBTCxLQUFLLENBQUMsQ0FBRSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUN4RSxBQUFBLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsSUFBSTtBQUNyQyxBQUFBLENBQUMsS0FBSyxDQUFDLENBQUEsT0FBTyxDQUFDLFFBQVEsQyxDQUFFLENBQUMs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QUUsQUFDeEIsQyxDQUFJO0FBQ04sQUFBQSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFBLENBQUE7QUFDN0MsQUFBQSxFQUFFLE1BQU0sQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLEs7Q0FBSyxDQUFBO0FBQ2pDLEVBQUUsQztBQUFDLENBQUE7QUFDSCxBQUFBO0FBQ0EsQUFBQSw4RUFBNkU7QUFDN0UsQUFBQTtBQUNBLEFBQUEsQUFBQSxNQUFNLENBQVEsTUFBUCxPQUFPLENBQUMsQ0FBRSxDQUFDLGFBQWEsQ0FBQyxXQUFXLENBQUMsR0FBRyxDQUFDO0FBQ2hEIiwibmFtZXMiOltdLCJzb3VyY2VzQ29udGVudCI6WyIjIGxsdXRpbHMubGliLmNpdmV0XG5cbmltcG9ydCB7Y3JlYXRlUmVxdWlyZX0gZnJvbSBcIm5vZGU6bW9kdWxlXCJcbmltcG9ydCB7c3ByaW50Zn0gZnJvbSBcIkBzdGQvZm10L3ByaW50ZlwiXG5pbXBvcnQge3JlbGF0aXZlfSBmcm9tICdAc3RkL3BhdGgnXG5cbmltcG9ydCB7dHJ1bmNTdHJ9IGZyb20gJy4vdHlwZXNjcmlwdC5saWIudHMnXG5pbXBvcnQge1xuXHR1bmRlZiwgZGVmaW5lZCwgbm90ZGVmaW5lZCwgYXNzZXJ0LCBjaGFyLCBkZWVwRXF1YWwsXG5cdGlzSGFzaCwgaXNBcnJheSwgaXNOb25FbXB0eVN0cmluZywgaXNBcnJheU9mU3RyaW5ncyxcblx0aXNFbXB0eSwgbm9uRW1wdHksIGlzU3RyaW5nLCBpc09iamVjdCwgaXNJbnRlZ2VyLFxuXHRpbnRlZ2VyLCBoYXNoLCBoYXNob2YsIGFycmF5LCBhcnJheW9mLCB2b2lkRnVuYyxcblx0VEZpbHRlckZ1bmMsIGlzTm9uUHJpbWl0aXZlLCBmdW5jdGlvbkRlZixcblx0fSBmcm9tICcuL2RhdGF0eXBlcy5saWIudHMnXG5cbi8qKlxuICogQG1vZHVsZSBsbHV0aWxzIC0gbG93IGxldmVsIHV0aWxpdGllc1xuICovXG5cbmxsdXRpbHNMb2FkVGltZTogaW50ZWdlciA6PSBEYXRlLm5vdygpXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4jIC0tLSBTaG91bGQgYmUgY2FsbGVkIGxpa2U6XG4jICAgICAgICByZXF1aXJlIDo9IGdldEltcG9ydFN5bmMoaW1wb3J0Lm1ldGEudXJsKVxuXG5leHBvcnQgZ2V0SW1wb3J0U3luYyA6PSAodXJsOiBzdHJpbmcpOiBGdW5jdGlvbiA9PlxuXG5cdHJldHVybiBjcmVhdGVSZXF1aXJlKHVybClcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuZXhwb3J0IHNpbmNlTG9hZCA6PSAoZGF0ZXRpbWU6IERhdGUgfCBpbnRlZ2VyID0gRGF0ZS5ub3coKSkgPT5cblxuXHRpZiAoZGF0ZXRpbWUgaW5zdGFuY2VvZiBEYXRlKVxuXHRcdHJldHVybiBkYXRldGltZS52YWx1ZU9mKCkgLSBsbHV0aWxzTG9hZFRpbWVcblx0ZWxzZVxuXHRcdHJldHVybiBkYXRldGltZSAtIGxsdXRpbHNMb2FkVGltZVxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG5leHBvcnQgc2luY2VMb2FkU3RyIDo9IChkYXRldGltZTogKERhdGUgfCBpbnRlZ2VyKT8gPSB1bmRlZikgPT5cblxuXHRyZXR1cm4gc3ByaW50ZihcIiU2ZFwiLCBzaW5jZUxvYWQoZGF0ZXRpbWUpKVxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKipcbiAqIHRocm93cyBhbiBleGNlcHRpb24gd2l0aCB0aGUgcHJvdmlkZWQgbWVzc2FnZVxuICovXG5cbmV4cG9ydCBjcm9hayA6PSAobXNnOiBzdHJpbmcpOiBuZXZlciA9PlxuXG5cdHRocm93IG5ldyBFcnJvcihtc2cpXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogQXNzZXJ0cyB0aGF0IGBjb25kYCBpcyB0cnVlLiBJZiBpdCBpc24ndCwgYW4gZXhjZXB0aW9uIGlzXG4gKiB0aHJvd24gd2l0aCB0aGUgZ2l2ZW4gYG1zZ2BcbiAqL1xuXG5leHBvcnQgdGhyb3dzRXJyb3IgOj0gKGZ1bmM6IHZvaWRGdW5jLCBtc2c6IHN0cmluZz1cIlVuZXhwZWN0ZWQgc3VjY2Vzc1wiKTogdm9pZCA9PlxuXG5cdHRyeVxuXHRcdGZ1bmMoKVxuXHRcdHRocm93IG5ldyBFcnJvcihtc2cpXG5cdGNhdGNoIGVyclxuXHRcdHJldHVybiAgICAjIGlnbm9yZSBlcnJvciAtIGl0IHdhcyBleHBlY3RlZFxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKipcbiAqIENhbGxpbmcgcGFzcygpIGRvZXMgbm90aGluZ1xuICovXG5cbmV4cG9ydCBwYXNzIDo9ICgpOiB2b2lkID0+ICAgICMgZG8gbm90aGluZ1xuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKipcbiAqIHN0cmluZ2lmeSBhbnkgdmFsdWUsIHNvIHRoYXQgaWYgd2UgdGFrZSB0aGUgcmVzdWx0U3RyLCB3ZSBjYW5cbiAqICAgIGxldCB4ID0gPHJlc3VsdFN0cj5cbiAqIHRvIHJldHJpZXZlIHRoZSBvcmlnaW5hbCB2YWx1ZSAoaWYgbm8gdHJ1bmMgb3B0aW9uIGlzIHBhc3NlZCBpbilcbiAqL1xuXG5leHBvcnQgc3RyaW5naWZ5IDo9IChcblx0eDogYW55LFxuXHRoT3B0aW9uczogaGFzaD17fVxuXHRsZXZlbDogbnVtYmVyPTBcblx0KTogc3RyaW5nID0+XG5cblx0e29uZUxpbmUsIGNvbXByZXNzLCB0cnVuY30gOj0gZ2V0T3B0aW9ucyBoT3B0aW9ucywge1xuXHRcdG9uZUxpbmU6IGZhbHNlXG5cdFx0Y29tcHJlc3M6IHRydWVcblx0XHR0cnVuYzogdW5kZWZcblx0XHR9XG5cblx0dHlwZVN0ciA6PSB0eXBlb2YgeFxuXHRyZXN1bHQgOj0gc3dpdGNoIHR5cGVTdHJcblx0XHR3aGVuICd1bmRlZmluZWQnXG5cdFx0XHQndW5kZWZpbmVkJ1xuXHRcdHdoZW4gJ29iamVjdCdcblx0XHRcdGlmICh4ID09IG51bGwpXG5cdFx0XHRcdCdudWxsJ1xuXHRcdFx0ZWxzZSBpZiBBcnJheS5pc0FycmF5KHgpXG5cdFx0XHRcdGxQYXJ0cyA6PSBzdHJpbmdpZnkoaXRlbSwgaE9wdGlvbnMsIGxldmVsKzEpIGZvciBpdGVtIG9mIHhcblx0XHRcdFx0aWYgb25lTGluZVxuXHRcdFx0XHRcdCdbJyArIGxQYXJ0cy5qb2luKCcsICcpICsgJ10nXG5cdFx0XHRcdGVsc2Vcblx0XHRcdFx0XHQnW1xcbicgKyBsUGFydHMuam9pbignLFxcbicpICsgJ1xcbl0nXG5cdFx0XHRlbHNlXG5cdFx0XHRcdGxQYXJ0cyA6PSBmb3Iga2V5LHZhbCBpbiB4XG5cdFx0XHRcdFx0XCIje2tleX06ICN7c3RyaW5naWZ5KHZhbCwgaE9wdGlvbnMsIGxldmVsKzEpfVwiXG5cdFx0XHRcdGlmIG9uZUxpbmVcblx0XHRcdFx0XHQneycgKyBsUGFydHMuam9pbignLCAnKSArICd9J1xuXHRcdFx0XHRlbHNlXG5cdFx0XHRcdFx0J3tcXG4nICsgbFBhcnRzLmpvaW4oJyxcXG4nKSArICdcXG59J1xuXHRcdHdoZW4gJ2Jvb2xlYW4nXG5cdFx0XHR4ID8gJ3RydWUnIDogJ2ZhbHNlJ1xuXHRcdHdoZW4gJ251bWJlcidcblx0XHRcdHgudG9TdHJpbmcoKVxuXHRcdHdoZW4gJ2JpZ2ludCdcblx0XHRcdHgudG9TdHJpbmcoKSArICduJ1xuXHRcdHdoZW4gJ3N0cmluZydcblx0XHRcdFwiXFxcIiN7ZXNjYXBlU3RyKHgsIG8nc3R5bGU9QycpfVxcXCJcIlxuXHRcdHdoZW4gJ3N5bWJvbCdcblx0XHRcdGlmIGRlZmluZWQoeC5kZXNjcmlwdGlvbilcblx0XHRcdFx0XCJTeW1ib2woXFxcIiN7eC5kZXNjcmlwdGlvbn1cXFwiKVwiXG5cdFx0XHRlbHNlXG5cdFx0XHRcdFwiU3ltYm9sKClcIlxuXHRcdHdoZW4gJ2Z1bmN0aW9uJ1xuXHRcdFx0ZnVuY3Rpb25EZWYoeClcblxuXHRpZiBkZWZpbmVkKHRydW5jKVxuXHRcdHJldHVybiB0cnVuY1N0cihyZXN1bHQsIHRydW5jKVxuXHRlbHNlXG5cdFx0cmV0dXJuIHJlc3VsdFxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKipcbiAqIEpTT04gc3RyaW5naWZpZXMgeCBvbiBvbmUgbGluZVxuICovXG5cbmV4cG9ydCBPTCA6PSAoeDogYW55KTogc3RyaW5nID0+XG5cblx0aWYgKHggPT0gdW5kZWYpXG5cdFx0cmV0dXJuICd1bmRlZidcblx0ZWxzZSBpZiAoeCA9PSBudWxsKVxuXHRcdHJldHVybiAnbnVsbCdcblx0ZWxzZSBpZiAodHlwZW9mIHggPT0gJ3N5bWJvbCcpXG5cdFx0aWYgZGVmaW5lZCh4LmRlc2NyaXB0aW9uKVxuXHRcdFx0cmV0dXJuIFwiW1N5bWJvbCAje3guZGVzY3JpcHRpb259XVwiXG5cdFx0ZWxzZVxuXHRcdFx0cmV0dXJuIFwiW1N5bWJvbF1cIlxuXHRcdHJldHVybiAnc3ltYm9sJ1xuXHRlbHNlIGlmICh0eXBlb2YgeCA9PSAnZnVuY3Rpb24nKVxuXHRcdHJldHVybiB4LnRvU3RyaW5nKCkucmVwbGFjZUFsbCgnXFxuJywgJyAnKVxuXHRlbHNlXG5cdFx0c3RyIDo9IEpTT04uc3RyaW5naWZ5KHgsIChrLHYpID0+IGRlZmluZWQodikgPyB2IDogJ19fdW5kZWZfXycpXG5cdFx0cmV0dXJuIHN0ci5yZXBsYWNlQWxsKCdcIl9fdW5kZWZfX1wiJywgJ3VuZGVmaW5lZCcpXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbmV4cG9ydCBNTCA6PSAoeDogYW55KTogc3RyaW5nID0+XG5cblx0aWYgKHggPT0gdW5kZWYpXG5cdFx0cmV0dXJuICd1bmRlZidcblx0ZWxzZSBpZiAoeCA9PSBudWxsKVxuXHRcdHJldHVybiAnbnVsbCdcblx0ZWxzZSBpZiAodHlwZW9mIHggPT0gJ2Z1bmN0aW9uJylcblx0XHRyZXR1cm4geC50b1N0cmluZygpXG5cdGVsc2Vcblx0XHRzdHIgOj0gSlNPTi5zdHJpbmdpZnkoeCwgKGssdikgPT4gZGVmaW5lZCh2KSA/IHYgOiAnX191bmRlZl9fJywgMylcblx0XHRpZiBkZWZpbmVkKHN0cilcblx0XHRcdHJldHVybiBzdHIucmVwbGFjZUFsbCgnXCJfX3VuZGVmX19cIicsICd1bmRlZmluZWQnKVxuXHRcdGVsc2Vcblx0XHRcdGNvbnNvbGUubG9nIHhcblx0XHRcdHJldHVybiBcIkpTT04uc3RyaW5naWZ5IHJldHVybmVkIHVuZGVmISEhXCJcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuLyoqXG4gKiBDb252ZXJ0cyB0aGUgZ2l2ZW4gc3RyaW5nIHRvIGEgaGFzaFxuICogPHdvcmQ+IGJlY29tZXMgYSBrZXkgd2l0aCBhIHRydWUgdmFsdWVcbiAqICE8d29yZD4gYmVjb21lcyBhIGtleXMgd2l0aCBhIGZhbHNlIHZhbHVlXG4gKiA8d29yZD49PHN0cmluZz4gYmVjb21lcyBhIGtleSB3aXRoIHZhbHVlIDxzdHJpbmc+XG4gKiAgICAtIDxzdHJpbmc+IG11c3QgYmUgcXVvdGVkIGlmIGl0IGNvbnRhaW5zIHdoaXRlc3BhY2VcbiAqL1xuXG5leHBvcnQgc3RyVG9IYXNoIDo9IChzdHI6IHN0cmluZyk6IGhhc2ggPT5cblxuXHRpZiBpc0VtcHR5KHN0cilcblx0XHRyZXR1cm4ge31cblx0aDogaGFzaCA6PSB7fVxuXHRmb3Igd29yZCBvZiBzdHIudHJpbSgpLnNwbGl0KC9cXHMrLylcblx0XHRpZiBsTWF0Y2hlczogc3RyaW5nW10gfCBudWxsIDo9IHdvcmQubWF0Y2goLy8vXlxuXHRcdFx0XHQoXFwhKT8gICAgICAgICAgICAgICAgICAgICMgbmVnYXRlIHZhbHVlXG5cdFx0XHRcdChbQS1aYS16XVtBLVphLXpfMC05XSopICAjIGlkZW50aWZpZXJcblx0XHRcdFx0KD86XG5cdFx0XHRcdFx0KD0pXG5cdFx0XHRcdFx0KC4qKVxuXHRcdFx0XHRcdCk/XG5cdFx0XHRcdCQvLy8pXG5cdFx0XHRbXywgbmVnLCBpZGVudCwgZXFTaWduLCBzdHJdIDo9IGxNYXRjaGVzXG5cdFx0XHRpZiBpc05vbkVtcHR5U3RyaW5nKGVxU2lnbilcblx0XHRcdFx0YXNzZXJ0IG5vdGRlZmluZWQobmVnKSB8fCAobmVnID09ICcnKSxcblx0XHRcdFx0XHRcdFwibmVnYXRpb24gd2l0aCBzdHJpbmcgdmFsdWVcIlxuXG5cdFx0XHRcdCMgLS0tIGNoZWNrIGlmIHN0ciBpcyBhIHZhbGlkIG51bWJlclxuXHRcdFx0XHRpZiBzdHIubWF0Y2goL14tP1xcZCsoXFwuXFxkKyk/JC8pXG5cdFx0XHRcdFx0bnVtIDo9IHBhcnNlRmxvYXQoc3RyKVxuXHRcdFx0XHRcdGlmIE51bWJlci5pc05hTihudW0pXG5cdFx0XHRcdFx0XHQjIC0tLSBUTyBETzogaW50ZXJwcmV0IGJhY2tzbGFzaCBlc2NhcGVzXG5cdFx0XHRcdFx0XHRoW2lkZW50XSA9IHN0clxuXHRcdFx0XHRcdGVsc2Vcblx0XHRcdFx0XHRcdGhbaWRlbnRdID0gbnVtXG5cdFx0XHRcdGVsc2Vcblx0XHRcdFx0XHRoW2lkZW50XSA9IHN0clxuXHRcdFx0ZWxzZSBpZiBuZWdcblx0XHRcdFx0aFtpZGVudF0gPSBmYWxzZVxuXHRcdFx0ZWxzZVxuXHRcdFx0XHRoW2lkZW50XSA9IHRydWVcblx0XHRlbHNlXG5cdFx0XHRjcm9hayBcIkludmFsaWQgd29yZCAje09MKHdvcmQpfVwiXG5cdHJldHVybiBoXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbmV4cG9ydCBvIDo9IChsU3RyaW5nczogVGVtcGxhdGVTdHJpbmdzQXJyYXkpOiBoYXNoID0+XG5cblx0cmV0dXJuIHN0clRvSGFzaChsU3RyaW5nc1swXSlcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuLyoqXG4gKiBzIC0gY29udmVydCBsZWFkaW5nIHRhYnMgdG8gc3BhY2VzXG4gKi9cblxuZXhwb3J0IHMgOj0gKGxTdHJpbmdzOiBUZW1wbGF0ZVN0cmluZ3NBcnJheSk6IHN0cmluZyA9PlxuXG5cdGNvbnNvbGUubG9nIFwiY2FsbGluZyBmdW5jdGlvbiBzXCJcblx0cmVwbGFjZXIgOj0gKG1hdGNoOiBzdHJpbmcpOiBzdHJpbmcgPT5cblx0XHRjb25zb2xlLmxvZyBcIm1hdGNoID0gPCN7ZXNjYXBlU3RyKG1hdGNoKX0+XCJcblx0XHRyZXN1bHQgOj0gJyAgICcucmVwZWF0KG1hdGNoLmxlbmd0aClcblx0XHRjb25zb2xlLmxvZyBcInJlc3VsdCA9IDwje2VzY2FwZVN0cihyZXN1bHQpfT5cIlxuXHRcdHJldHVybiByZXN1bHRcblx0cmV0dXJuIGxTdHJpbmdzWzBdLnJlcGxhY2VBbGwoL15cXHQrL21nLCByZXBsYWNlcilcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuLyoqXG4gKiB0IC0gY29udmVydCBsZWFkaW5nIHNwYWNlcyB0byB0YWJzXG4gKi9cblxuZXhwb3J0IHQgOj0gKGxTdHJpbmdzOiBUZW1wbGF0ZVN0cmluZ3NBcnJheSk6IHN0cmluZyA9PlxuXG5cdHJlcGxhY2VyIDo9IChtYXRjaDogc3RyaW5nKTogc3RyaW5nID0+XG5cdFx0bGV2ZWwgOj0gTWF0aC5mbG9vcihtYXRjaC5sZW5ndGggLyAzKVxuXHRcdHJldHVybiAnXFx0Jy5yZXBlYXQobGV2ZWwpXG5cdHJldHVybiBsU3RyaW5nc1swXS5yZXBsYWNlQWxsKC9eXFx4MjArL21nLCByZXBsYWNlcilcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuLyoqXG4gKiBBZGRzIGFueSBrZXlzIGluIGhEZWZhdWx0cyB0aGF0IGFyZSBtaXNzaW5nIGluIGhPcHRpb25zXG4gKiB0byBoT3B0aW9ucyB3aXRoIHRoZWlyIGdpdmVuIHZhbHVlc1xuICovXG5cbmV4cG9ydCBhZGREZWZhdWx0cyA6PSAoaE9wdGlvbnM6IGhhc2gsIGhEZWZhdWx0czogaGFzaCk6IGhhc2ggPT5cblxuXHRhc3NlcnQgaXNPYmplY3QoaE9wdGlvbnMpLCBcImhPcHRpb25zIG5vdCBhbiBvYmplY3Q6ICN7T0woaE9wdGlvbnMpfVwiXG5cdGFzc2VydCBpc09iamVjdChoRGVmYXVsdHMpLCBcImhEZWZhdWx0cyBub3QgYW4gb2JqZWN0OiAje09MKGhEZWZhdWx0cyl9XCJcblxuXHQjIC0tLSBGaWxsIGluIGRlZmF1bHRzIGZvciBtaXNzaW5nIHZhbHVlc1xuXHRmb3Iga2V5IG9mIE9iamVjdC5rZXlzKGhEZWZhdWx0cylcblx0XHR2YWx1ZSA6PSBoRGVmYXVsdHNba2V5XVxuXHRcdGlmIG5vdCBoT3B0aW9ucy5oYXNPd25Qcm9wZXJ0eShrZXkpICYmIGRlZmluZWQodmFsdWUpXG5cdFx0XHRoT3B0aW9uc1trZXldID0gdmFsdWVcblx0cmV0dXJuIGhPcHRpb25zXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogcmV0dXJucyBhIGhhc2ggb2Ygb3B0aW9ucyB3aXRoIHRoZWlyIHZhbHVlcywgdXNpbmcgb3B0aW9uc1xuICogaWYgaXQncyBhIGhhc2gsIG9yIHBhcnNpbmcgb3B0aW9ucyB1c2luZyBzdHJUb0hhc2goKSBpZlxuICogaXQncyBhIHN0cmluZyAtIGFkZGluZyBhbnkgZGVmYXVsdCB2YWx1ZXMgZnJvbSBoRGVmYXVsdHNcbiAqIGlmIHRoZXkncmUgbWlzc2luZyBpbiB0aGUgcmVzdWx0aW5nIGhhc2hcbiAqL1xuXG5leHBvcnQgZ2V0T3B0aW9ucyA6PSAoaE9wdGlvbnM6IGhhc2g9e30sIGhEZWZhdWx0czogaGFzaD17fSk6IGhhc2ggPT5cblxuXHRyZXR1cm4gYWRkRGVmYXVsdHMgaE9wdGlvbnMsIGhEZWZhdWx0c1xuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG5leHBvcnQgZ2V0T25lT3B0aW9uIDo9IChoT3B0aW9uczogaGFzaD17fSwgbmFtZTogc3RyaW5nLCBkZWZWYWw6IGFueSkgPT5cblxuXHRyZXR1cm4gaE9wdGlvbnNbbmFtZV0gfHwgZGVmVmFsXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogcmVtb3ZlIGFsbCBrZXlzIGZyb20gYSBoYXNoIHRoYXQgaGF2ZSBlaXRoZXIgYW4gZW1wdHkgbmFtZVxuICogb3IgYW4gZW1wdHkgdmFsdWVcbiAqL1xuXG5leHBvcnQgcmVtb3ZlRW1wdHlLZXlzIDo9IChoOiBoYXNoKTogaGFzaCA9PlxuXG5cdGhSZXN1bHQ6IGhhc2ggOj0ge31cblx0Zm9yIGtleSBvZiBrZXlzKGgpXG5cdFx0aWYgbm9uRW1wdHkoa2V5KSAmJiBub25FbXB0eShoW2tleV0pXG5cdFx0XHRoUmVzdWx0W2tleV0gPSBoW2tleV1cblx0cmV0dXJuIGhSZXN1bHRcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuLyoqXG4gKiByZXR1cm4gYW4gYXJyYXkgb2YgYWxsIG93biBrZXlzIGluIGEgaGFzaFxuICovXG5cbmV4cG9ydCBrZXlzIDo9IChvYmo6IGhhc2gsIGhPcHRpb25zOiBoYXNoPXt9KTogc3RyaW5nW10gPT5cblxuXHRoIDo9IGdldE9wdGlvbnMgaE9wdGlvbnMsIHtcblx0XHRleGNlcHQ6IFtdXG5cdFx0fVxuXG5cdGxldCBleGNlcHQgPSBoLmV4Y2VwdFxuXG5cdGlmIGlzU3RyaW5nKGV4Y2VwdClcblx0XHRleGNlcHQgPSBbZXhjZXB0XVxuXHRsS2V5czogc3RyaW5nW10gOj0gW11cblx0Zm9yIGtleSBvZiBPYmplY3Qua2V5cyhvYmopXG5cdFx0aWYgbm90IGV4Y2VwdC5pbmNsdWRlcyhrZXkpXG5cdFx0XHRsS2V5cy5wdXNoIGtleVxuXHRyZXR1cm4gbEtleXNcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuLyoqXG4gKiByZXR1cm5zIHRydWUgaWYgZWl0aGVyIGBoYCBpcyBub3QgZGVmaW5lZCwgb3IgaWYgYGhgIGlzXG4gKiBhIGhhc2ggdGhhdCBpbmNsdWRlcyBhbGwgdGhlIGtleXMgcHJvdmlkZWRcbiAqL1xuXG5leHBvcnQgaGFzS2V5IDo9IChoOiBoYXNoLCAuLi5sS2V5czogc3RyaW5nW10pOiBib29sZWFuID0+XG5cblx0aWYgbm90ZGVmaW5lZChoKVxuXHRcdHJldHVybiBmYWxzZVxuXHRmb3Iga2V5IG9mIGxLZXlzXG5cdFx0YXNzZXJ0IGlzU3RyaW5nKGtleSksIFwia2V5IG5vdCBhIHN0cmluZzogI3tPTChrZXkpfVwiXG5cdFx0aWYgbm90IGguaGFzT3duUHJvcGVydHkoa2V5KVxuXHRcdFx0cmV0dXJuIGZhbHNlXG5cdHJldHVybiB0cnVlXG5cbmV4cG9ydCBoYXNLZXlzIDo9IGhhc0tleVxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG5leHBvcnQgbWlzc2luZ0tleXMgOj0gKGg6IGhhc2gsIC4uLmxLZXlzOiBzdHJpbmdbXSk6IHN0cmluZ1tdID0+XG5cblx0aWYgbm90ZGVmaW5lZChoKVxuXHRcdHJldHVybiBsS2V5c1xuXHRhc3NlcnQgaXNIYXNoKGgpLCBcImggbm90IGEgaGFzaDogI3tPTChoKX1cIlxuXHRsTWlzc2luZzogc3RyaW5nW10gOj0gW11cblx0Zm9yIGtleSBvZiBsS2V5c1xuXHRcdGlmIG5vdCBoLmhhc093blByb3BlcnR5KGtleSlcblx0XHRcdGxNaXNzaW5nLnB1c2gga2V5XG5cdHJldHVybiBsTWlzc2luZ1xuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKipcbiAqIG1lcmdlcyB0aGUgcHJvdmlkZWQgb2JqZWN0cyBpbnRvIGEgbmV3IG9iamVjdFxuICogTk9URTogbm9uZSBvZiB0aGUgcHJvdmlkZWQgYXJndW1lbnRzIGFyZSBtb2RpZmllZFxuICovXG5cbmV4cG9ydCBtZXJnZSA6PSAoLi4ubE9iamVjdHM6IGhhc2hbXSk6IGhhc2ggPT5cblxuXHRyZXR1cm4gT2JqZWN0LmFzc2lnbih7fSwgbE9iamVjdHMuLi4pXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbmV4cG9ydCBoaXQgOj0gKHBjdDogbnVtYmVyID0gNTApOiBib29sZWFuID0+XG5cblx0cmV0dXJuICgxMDAgKiBNYXRoLnJhbmRvbSgpIDwgcGN0KVxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuIyAtLS0gQVNZTkMgIVxuXG5leHBvcnQgc2xlZXAgOj0gKHNlYzogbnVtYmVyKTogdm9pZCA9PlxuXG5cdGF3YWl0IG5ldyBQcm9taXNlKChyKSA9PiBzZXRUaW1lb3V0KHIsIDEwMDAgKiBzZWMpKVxuXHRyZXR1cm5cblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuZXhwb3J0IHNsZWVwU3luYyA6PSAoc2VjOiBudW1iZXIpOiB2b2lkID0+XG5cblx0c3RhcnQgOj0gRGF0ZS5ub3coKVxuXHRlbmQgOj0gRGF0ZS5ub3coKSArIDEwMDAqc2VjXG5cdHdoaWxlIChEYXRlLm5vdygpIDwgZW5kKVxuXHRyZXR1cm5cblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuLyoqXG4gKiByZXR1cm5zIGEgc3RyaW5nIGNvbnNpc3Rpbmcgb2YgdGhlIGdpdmVuIG51bWJlclxuICogb2Ygc3BhY2UgY2hhcmFjdGVyc1xuICovXG5cbmV4cG9ydCBzcGFjZXMgOj0gKG46IG51bWJlcik6IHN0cmluZyA9PlxuXG5cblx0cmV0dXJuIChuIDw9IDApID8gJycgOiAnICcucmVwZWF0KG4pXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogcmV0dXJucyBhIHN0cmluZyBjb25zaXN0aW5nIG9mIHRoZSBnaXZlbiBudW1iZXJcbiAqIG9mIFRBQiBjaGFyYWN0ZXJzXG4gKi9cblxuZXhwb3J0IHRhYnMgOj0gKG46IG51bWJlcik6IHN0cmluZyA9PlxuXG5cdHJldHVybiAobiA8PSAwKSA/ICcnIDogJ1xcdCcucmVwZWF0KG4pXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogcnRyaW0gLSBzdHJpcCB0cmFpbGluZyB3aGl0ZXNwYWNlXG4gKi9cblxuZXhwb3J0IHJ0cmltIDo9IChsaW5lOiBzdHJpbmcpOiBzdHJpbmcgPT5cblxuXHRhc3NlcnQgaXNTdHJpbmcobGluZSksIFwibm90IGEgc3RyaW5nOiAje3R5cGVvZiBsaW5lfVwiXG5cdGxNYXRjaGVzIDo9IGxpbmUubWF0Y2goL14oLio/KVxccyskLylcblx0cmV0dXJuIChsTWF0Y2hlcyA9PSBudWxsKSA/IGxpbmUgOiBsTWF0Y2hlc1sxXVxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKipcbiAqIENvdW50IHRoZSBudW1iZXIgb2YgYSBzcGVjaWZpYyBjaGFyYWN0ZXIgaW4gYSBzdHJpbmdcbiAqL1xuXG5leHBvcnQgY291bnRDaGFycyA6PSAoc3RyOiBzdHJpbmcsIGNoOiBzdHJpbmcpOiBudW1iZXIgPT5cblxuXHRsZXQgY291bnQgPSAwXG5cdGxldCBwb3MgPSAtMVxuXHR3aGlsZSAocG9zID0gc3RyLmluZGV4T2YoY2gsIHBvcysxKSkgIT0gLTFcblx0XHRjb3VudCArPSAxXG5cdHJldHVybiBjb3VudFxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKipcbiAqIGNvbnZlcnQgYSBtdWx0aS1saW5lIHN0cmluZyB0byBhbiBhcnJheVxuICogb2Ygc2luZ2xlIGxpbmUgc3RyaW5nc1xuICovXG5cbmV4cG9ydCBibG9ja1RvQXJyYXkgOj0gKGJsb2NrOiBzdHJpbmcpOiBzdHJpbmdbXSA9PlxuXG5cdGlmIGlzRW1wdHkoYmxvY2spXG5cdFx0cmV0dXJuIFtdXG5cdGVsc2Vcblx0XHRyZXR1cm4gYmxvY2suc3BsaXQoL1xccj9cXG4vKVxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG5leHBvcnQgYWxsTGluZXNJbkJsb2NrIDo9IChcblx0XHRibG9jazogc3RyaW5nXG5cdFx0KTogR2VuZXJhdG9yPHN0cmluZywgdm9pZCwgdm9pZD4gLT5cblxuXHRsZXQgc3RhcnQgPSAwXG5cdGxldCBlbmQgPSBibG9jay5pbmRleE9mKCdcXG4nKVxuXHR3aGlsZSAoZW5kICE9IC0xKVxuXHRcdHlpZWxkIGJsb2NrLnN1YnN0cmluZyhzdGFydCwgZW5kKVxuXHRcdHN0YXJ0ID0gZW5kICsgMVxuXHRcdGVuZCA9IGJsb2NrLmluZGV4T2YoJ1xcbicsIHN0YXJ0KVxuXHRpZiAoc3RhcnQgPCBibG9jay5sZW5ndGgpXG5cdFx0eWllbGQgYmxvY2suc3Vic3RyaW5nKHN0YXJ0KVxuXHRyZXR1cm5cblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuLyoqXG4gKiBBIHN0cmluZyBvciBzdHJpbmcgYXJyYXlcbiAqL1xuXG5leHBvcnQgdHlwZSBUQmxvY2tTcGVjID0gc3RyaW5nIHwgc3RyaW5nW11cblxuZXhwb3J0IGlzQmxvY2tTcGVjIDo9ICh4OiBhbnkpOiB4IGlzIFRCbG9ja1NwZWMgPT5cblxuXHRyZXR1cm4gaXNTdHJpbmcoeCkgfHwgaXNBcnJheU9mU3RyaW5ncyh4KVxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKipcbiAqIHJldHVybiBhbiBhcnJheSBhcyBpcywgY29udmVydCBhIG11bHRpLWxpbmUgc3RyaW5nXG4gKiB0byBhbiBhcnJheSBvZiBzaW5nbGUgbGluZSBzdHJpbmdzXG4gKi9cblxuZXhwb3J0IHRvQXJyYXkgOj0gKHN0ck9yQXJyYXk6IFRCbG9ja1NwZWMpOiBzdHJpbmdbXSA9PlxuXG5cdGlmIEFycmF5LmlzQXJyYXkoc3RyT3JBcnJheSlcblx0XHRyZXR1cm4gc3RyT3JBcnJheVxuXHRlbHNlXG5cdFx0cmV0dXJuIGJsb2NrVG9BcnJheShzdHJPckFycmF5KVxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKipcbiAqIGNvbnZlcnQgYW4gYXJyYXkgb2Ygc3RyaW5ncyB0byBhIHNpbmdsZSBtdWx0aS1saW5lIHN0cmluZ1xuICovXG5cbmV4cG9ydCBhcnJheVRvQmxvY2sgOj0gKGxMaW5lczogc3RyaW5nW10pOiBzdHJpbmcgPT5cblxuXHRhc3NlcnQgaXNBcnJheShsTGluZXMpLCBcImxMaW5lcyBpcyBub3QgYW4gYXJyYXk6ICN7T0wobExpbmVzKX1cIlxuXHRyZXR1cm4gbExpbmVzLmZpbHRlcigobGluZSkgPT4gZGVmaW5lZChsaW5lKSkuam9pbihcIlxcblwiKVxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKipcbiAqIHJldHVybiBhIHN0cmluZyBhcyBpcywgY29udmVydCBhbiBhcnJheSBvZiBzdHJpbmdzXG4gKiB0byBhIHNpbmdsZSBtdWx0aS1saW5lIHN0cmluZ1xuICovXG5cbmV4cG9ydCB0b0Jsb2NrIDo9IChzdHJPckFycmF5OiBUQmxvY2tTcGVjKTogc3RyaW5nID0+XG5cblx0aWYgaXNTdHJpbmcoc3RyT3JBcnJheSlcblx0XHRyZXR1cm4gc3RyT3JBcnJheVxuXHRlbHNlXG5cdFx0cmV0dXJuIGFycmF5VG9CbG9jayhzdHJPckFycmF5KVxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG5leHBvcnQgaW52ZXJ0SGFzaCA6PSAoaDogaGFzaCk6IGhhc2ggPT5cblxuXHRhc3NlcnQgaXNIYXNoKGgpLCBcIk5vdCBhIGhhc2g6ICN7T0woaCl9XCJcblx0aFJlc3VsdDogaGFzaCA6PSB7fVxuXHRmb3Iga2V5IG9mIGtleXMoaClcblx0XHR2YWx1ZSA6PSBoW2tleV1cblx0XHRpZiBpc1N0cmluZyh2YWx1ZSlcblx0XHRcdGhSZXN1bHRbdmFsdWVdID0ga2V5XG5cdHJldHVybiBoUmVzdWx0XG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbmV4cG9ydCB3aXRob3V0S2V5cyA6PSAoXG5cdFx0aDogaGFzaCxcblx0XHQuLi5sS2V5czogc3RyaW5nW11cblx0XHQpOiBoYXNoID0+XG5cblx0aE5ldzogaGFzaCA6PSB7fVxuXHRmb3Iga2V5IG9mIGtleXMoaClcblx0XHRpZiBub3QgbEtleXMuaW5jbHVkZXMoa2V5KVxuXHRcdFx0aE5ld1trZXldID0gaFtrZXldXG5cdHJldHVybiBoTmV3XG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbnR5cGUgVEtleVZhbCA9IFtrZXk6IHN0cmluZywgdmFsOiBhbnldXG5cbmV4cG9ydCB3aXRoS2V5VmFscyA6PSAoXG5cdFx0aDogaGFzaCxcblx0XHQuLi5sS2V5VmFsczogVEtleVZhbFtdXG5cdFx0KTogaGFzaCA9PlxuXG5cdGhOZXc6IGhhc2ggOj0ge31cblx0Zm9yIGsgb2Yga2V5cyhoKVxuXHRcdGhOZXdba10gPSBoW2tdXG5cdGZvciBwYWlyIG9mIGxLZXlWYWxzXG5cdFx0W2tleSwgdmFsXSA6PSBwYWlyXG5cdFx0aE5ld1trZXldID0gdmFsXG5cdHJldHVybiBoTmV3XG5cbmV4cG9ydCB3aXRoS2V5VmFsID0gd2l0aEtleVZhbHNcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuLyoqXG4gKiBieSBkZWZhdWx0LCByZXBsYWNlIHRoZXNlIGNoYXJhY3RlcnM6XG4gKiAgICBjYXJyaWFnZSByZXR1cm5cbiAqICAgIG5ld2xpbmVcbiAqICAgIFRBQlxuICogICAgc3BhY2VcbiAqIE9wdGlvbmFsbHksIGFkZCBhIGNoYXJhY3RlciB0byBpbmRpY2F0ZSBhIHBhcnRpY3VsYXJcbiAqIHBvc2l0aW9uIGluIHRoZSBzdHJpbmdcbiAqIFZhbGlkIG9wdGlvbnM6XG4gKiAgICBvZmZzZXQgLSBpbmRpY2F0ZSBwb3NpdGlvbiBvZiBvZmZzZXRcbiAqICAgIHBvc2NoYXIgLSBjaGFyIHRvIHVzZSB0byBpbmRpY2F0ZSBwb3NpdGlvblxuICovXG5cbmhEZWJ1Z1JlcGxhY2U6IGhhc2ggOj0ge1xuXHRcIlxcclwiOiAn4oaQJ1xuXHRcIlxcblwiOiAn4oaTJ1xuXHRcIlxcdFwiOiAn4oaSJ1xuXHRcIiBcIjogICfLsydcblx0fVxuXG5oQ1JlcGxhY2U6IGhhc2ggOj0ge1xuXHRcIlxcclwiOiAnXFxcXHInXG5cdFwiXFxuXCI6ICdcXFxcbidcblx0XCJcXHRcIjogJ1xcXFx0J1xuXHR9XG5cbmV4cG9ydCBlc2NhcGVTdHIgOj0gKFxuXHRcdHN0cjogc3RyaW5nXG5cdFx0aE9wdGlvbnM6IGhhc2ggPSB7fVxuXHRcdCk6IHN0cmluZyA9PlxuXG5cdHtcblx0XHRzdHlsZSwgaFJlcGxhY2UsIGJsb2NrLCBvZmZzZXQsIHBvc2NoYXIsXG5cdFx0YmVnaW5jaGFyLCBlbmRjaGFyXG5cdFx0fSA6PSBnZXRPcHRpb25zIGhPcHRpb25zLCB7XG5cdFx0XHRzdHlsZTogJ2RlYnVnJ1xuXHRcdFx0aFJlcGxhY2U6IHVuZGVmXG5cdFx0XHRibG9jazogZmFsc2Vcblx0XHRcdG9mZnNldDogdW5kZWZcblx0XHRcdHJhbmdlOiB1bmRlZiAgICAgICMgLS0tIGNhbiBiZSBbaW50LCBpbnRdXG5cdFx0XHRwb3NjaGFyOiAn4pSKJ1xuXHRcdFx0YmVnaW5jaGFyOiAn4p+oJ1xuXHRcdFx0ZW5kY2hhcjogJ+KfqSdcblx0XHRcdH1cblxuXHRsZXQgaFJlYWxSZXBsYWNlOiBoYXNoID0ge31cblx0aWYgZGVmaW5lZChoUmVwbGFjZSlcblx0XHRoUmVhbFJlcGxhY2UgPSBoUmVwbGFjZVxuXHRlbHNlIGlmIChzdHlsZSA9PSAnQycpXG5cdFx0aWYgYmxvY2tcblx0XHRcdGhSZWFsUmVwbGFjZSA9IHdpdGhvdXRLZXlzKGhDUmVwbGFjZSwgJ1xcbicsICdcXHInKVxuXHRcdGVsc2Vcblx0XHRcdGhSZWFsUmVwbGFjZSA9IGhDUmVwbGFjZVxuXHRlbHNlXG5cdFx0aWYgYmxvY2tcblx0XHRcdGhSZWFsUmVwbGFjZSA9IHdpdGhvdXRLZXlzKGhEZWJ1Z1JlcGxhY2UsICdcXG4nLCAnXFxyJylcblx0XHRlbHNlXG5cdFx0XHRoUmVhbFJlcGxhY2UgPSBoRGVidWdSZXBsYWNlXG5cblx0W2JlZ2luUG9zLCBlbmRQb3NdIDo9IChcblx0XHRpZiBkZWZpbmVkKHJhbmdlKSAmJiBpc0FycmF5KHJhbmdlKVxuXHRcdFx0cmFuZ2Vcblx0XHRlbHNlXG5cdFx0XHRbdW5kZWYsIHVuZGVmXVxuXHRcdClcblxuXHRsUGFydHM6IHN0cmluZ1tdIDo9IFtdXG5cdGZvciBjaCxpIG9mIHN0clxuXHRcdGlmIChpID09IG9mZnNldClcblx0XHRcdGxQYXJ0cy5wdXNoIHBvc2NoYXJcblx0XHRlbHNlIGlmIChpID09IGJlZ2luUG9zKVxuXHRcdFx0bFBhcnRzLnB1c2ggYmVnaW5jaGFyXG5cdFx0ZWxzZSBpZiAoaSA9PSBlbmRQb3MpXG5cdFx0XHRsUGFydHMucHVzaCBlbmRjaGFyXG5cdFx0bFBhcnRzLnB1c2ggKGhSZWFsUmVwbGFjZVtjaF0gfHwgY2gpXG5cdGlmIChvZmZzZXQgPT0gc3RyLmxlbmd0aClcblx0XHRsUGFydHMucHVzaCBwb3NjaGFyXG5cdHJldHVybiBsUGFydHMuam9pbignJylcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuZXhwb3J0IHVuZXNjYXBlU3RyIDo9IChcblx0XHRzdHI6IHN0cmluZ1xuXHRcdGhPcHRpb25zOiBoYXNoID0ge31cblx0XHQpOiBzdHJpbmcgPT5cblxuXHR7c3R5bGUsIGhSZXBsYWNlfSA6PSBnZXRPcHRpb25zIGhPcHRpb25zLCB7XG5cdFx0c3R5bGU6ICdDJ1xuXHRcdGhSZXBsYWNlOiB1bmRlZlxuXHRcdH1cblxuXHRsZXQgaFJlYWxSZXBsYWNlOiBoYXNoID0ge31cblx0aWYgZGVmaW5lZChoUmVwbGFjZSlcblx0XHRoUmVhbFJlcGxhY2UgPSBoUmVwbGFjZVxuXHRlbHNlXG5cdFx0aWYgKHN0eWxlID09ICdkZWJ1ZycpXG5cdFx0XHRoUmVhbFJlcGxhY2UgPSB7XG5cdFx0XHRcdCfihpAnOiAnJ1xuXHRcdFx0XHQn4oaTJzogJ1xcbidcblx0XHRcdFx0J+KGkic6ICdcXHQnXG5cdFx0XHRcdCfLsyc6ICcgJ1xuXHRcdFx0XHR9XG5cdFx0ZWxzZVxuXHRcdFx0aFJlYWxSZXBsYWNlID0ge1xuXHRcdFx0XHQnbic6ICdcXG4nXG5cdFx0XHRcdCdyJzogJycgICAgICMgY2FycmlhZ2UgcmV0dXJuIHNob3VsZCBqdXN0IGRpc2FwcGVhclxuXHRcdFx0XHQndCc6ICdcXHQnXG5cdFx0XHRcdH1cblxuXHRsZXQgZXNjID0gZmFsc2Vcblx0bFBhcnRzOiBzdHJpbmdbXSA6PSBbXVxuXHRmb3IgY2gsaSBvZiBzdHJcblx0XHRpZiAoY2ggPT0gJ1xcXFwnKVxuXHRcdFx0aWYgZXNjXG5cdFx0XHRcdGxQYXJ0cy5wdXNoICdcXFxcJ1xuXHRcdFx0XHRlc2MgPSBmYWxzZVxuXHRcdFx0ZWxzZVxuXHRcdFx0XHRlc2MgPSB0cnVlXG5cdFx0ZWxzZVxuXHRcdFx0aWYgZXNjXG5cdFx0XHRcdGlmIGRlZmluZWQoaFJlYWxSZXBsYWNlW2NoXSlcblx0XHRcdFx0XHRsUGFydHMucHVzaCBoUmVhbFJlcGxhY2VbY2hdXG5cdFx0XHRcdGVsc2Vcblx0XHRcdFx0XHRsUGFydHMucHVzaCBjaFxuXHRcdFx0XHRlc2MgPSBmYWxzZVxuXHRcdFx0ZWxzZVxuXHRcdFx0XHRsUGFydHMucHVzaCBjaFxuXHRyZXR1cm4gbFBhcnRzLmpvaW4oJycpXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogZG9uJ3QgZXNjYXBlIG5ld2xpbmUgb3IgY2FycmlhZ2UgcmV0dXJuXG4gKiBPcHRpb25hbGx5LCBhZGQgYSBjaGFyYWN0ZXIgdG8gaW5kaWNhdGUgYSBwYXJ0aWN1bGFyXG4gKiBwb3NpdGlvbiBpbiB0aGUgc3RyaW5nXG4gKi9cblxuZXhwb3J0IGVzY2FwZUJsb2NrIDo9IChcblx0YmxvY2s6IHN0cmluZyxcblx0aE9wdGlvbnM6IGhhc2ggPSB7fVxuXHQpOiBzdHJpbmcgPT5cblxuXHRyZXR1cm4gZXNjYXBlU3RyKGJsb2NrLCB3aXRoS2V5VmFsKGhPcHRpb25zLCBbJ2Jsb2NrJywgdHJ1ZV0pKVxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG5leHBvcnQgcmVscGF0aCA6PSAocGF0aDogc3RyaW5nKTogc3RyaW5nID0+XG5cblx0cmV0dXJuIHJlbGF0aXZlKERlbm8uY3dkKCksIHBhdGgpLnJlcGxhY2VBbGwoJ1xcXFwnLCAnLycpXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogU3BsaXRzIGEgc3RyaW5nIG9uIHdoaXRlc3BhY2UgaW50byBhbiBhcnJheSxcbiAqIGlnbm9yaW5nIGFueSBsZWFkaW5nIG9yIHRyYWlsaW5nIHdoaXRlc3BhY2VcbiAqL1xuXG5leHBvcnQgd3NTcGxpdCA6PSAoc3RyOiBzdHJpbmcpOiBzdHJpbmdbXSA9PlxuXG5cdG5ld3N0ciA6PSBzdHIudHJpbSgpXG5cdGlmIChuZXdzdHIgPT0gJycpXG5cdFx0cmV0dXJuIFtdXG5cdGVsc2Vcblx0XHRyZXR1cm4gbmV3c3RyLnNwbGl0KC9cXHMrLylcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuLyoqXG4gKiBzcGxpdHMgZWFjaCBzdHJpbmcgb24gd2hpdGVzcGFjZSBpZ25vcmluZyBhbnkgbGVhZGluZ1xuICogb3IgdHJhaWxpbmcgd2hpdGVzcGFjZSwgYW5kIHJldHVybnMgYW4gYXJyYXkgb2ZcbiAqIGFsbCBzdWJzdHJpbmdzIG9idGFpbmVkXG4gKi9cblxuZXhwb3J0IHdvcmRzIDo9ICguLi5sU3RyaW5nczogc3RyaW5nW10pOiBzdHJpbmdbXSA9PlxuXG5cdGxldCBsV29yZHMgPSBbXVxuXHRmb3Igc3RyIG9mIGxTdHJpbmdzXG5cdFx0Zm9yIHdvcmQgb2Ygd3NTcGxpdChzdHIpXG5cdFx0XHRsV29yZHMucHVzaCB3b3JkXG5cdHJldHVybiBsV29yZHNcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuLyoqXG4gKiBjYWxjdWxhdGVzIHRoZSBudW1iZXIgb2YgZXh0cmEgY2hhcmFjdGVycyBuZWVkZWQgdG9cbiAqIG1ha2UgdGhlIGdpdmVuIHN0cmluZyBoYXZlIHRoZSBnaXZlbiBsZW5ndGguXG4gKiBJZiBub3QgcG9zc2libGUsIHJldHVybnMgMFxuICovXG5cbmV4cG9ydCBnZXRORXh0cmEgOj0gKHN0cjogc3RyaW5nLCBsZW46IG51bWJlcik6IG51bWJlciA9PlxuXG5cdGV4dHJhIDo9IGxlbiAtIHN0ci5sZW5ndGhcblx0cmV0dXJuIChleHRyYSA+IDApID8gZXh0cmEgOiAwXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogcGFkcyB0aGUgZ2l2ZW4gc3RyaW5nIG9uIHRoZSByaWdodCB3aXRoXG4gKiB0aGUgZ2l2ZW4gY2hhcmFjdGVyLCB0byB0aGUgZ2l2ZW4gbGVuZ3RoXG4gKi9cblxuZXhwb3J0IHJwYWQgOj0gKHN0cjogc3RyaW5nLCBsZW46IG51bWJlciwgY2g6IHN0cmluZz0nICcpOiBzdHJpbmcgPT5cblxuXHRhc3NlcnQgKGNoLmxlbmd0aCA9PSAxKSwgXCJOb3QgYSBjaGFyXCJcblx0ZXh0cmEgOj0gZ2V0TkV4dHJhKHN0ciwgbGVuKVxuXHRyZXR1cm4gc3RyICsgY2gucmVwZWF0KGV4dHJhKVxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKipcbiAqIHBhZHMgdGhlIGdpdmVuIHN0cmluZyBvbiB0aGUgbGVmdCB3aXRoXG4gKiB0aGUgZ2l2ZW4gY2hhcmFjdGVyLCB0byB0aGUgZ2l2ZW4gbGVuZ3RoXG4gKi9cblxuZXhwb3J0IGxwYWQgOj0gKHN0cjogc3RyaW5nLCBsZW46IG51bWJlciwgY2g6IHN0cmluZz0nICcpOiBzdHJpbmcgPT5cblxuXHRhc3NlcnQgKGNoLmxlbmd0aCA9PSAxKSwgXCJOb3QgYSBjaGFyXCJcblx0ZXh0cmEgOj0gZ2V0TkV4dHJhKHN0ciwgbGVuKVxuXHRyZXR1cm4gY2gucmVwZWF0KGV4dHJhKSArIHN0clxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuIyAtLS0gdmFsaWQgb3B0aW9uczpcbiMgICAgICAgIGNoYXIgLSBjaGFyIHRvIHVzZSBvbiBsZWZ0IGFuZCByaWdodFxuIyAgICAgICAgYnVmZmVyIC0gbnVtIHNwYWNlcyBhcm91bmQgdGV4dCB3aGVuIGNoYXIgPD4gJyAnXG5cbi8qKlxuICogcGFkcyB0aGUgZ2l2ZW4gc3RyaW5nIG9uIGJvdGggdGhlIGxlZnQgYW5kIHJpZ2h0XG4gKiB3aXRoIHRoZSBnaXZlbiBjaGFyYWN0ZXIsIHRvIHRoZSBnaXZlbiBsZW5ndGhcbiAqIGJ1dCB3aXRoIHRoZSBnaXZlbiBudW1iZXIgb2YgYnVmZmVyIGNoYXJzIHN1cnJvdW5kaW5nXG4gKiB0aGUgdGV4dFxuICovXG5cbmV4cG9ydCBjZW50ZXJlZCA6PSAoXG5cdHRleHQ6IHN0cmluZyxcblx0d2lkdGg6IG51bWJlcixcblx0Y2hhcjogc3RyaW5nID0gJyAnLFxuXHRudW1CdWZmZXI6IG51bWJlciA9IDJcblx0KTogc3RyaW5nID0+XG5cblx0dG90U3BhY2VzIDo9IHdpZHRoIC0gdGV4dC5sZW5ndGhcblx0aWYgKHRvdFNwYWNlcyA8PSAwKVxuXHRcdHJldHVybiB0ZXh0XG5cdG51bUxlZnQgOj0gTWF0aC5mbG9vcih0b3RTcGFjZXMgLyAyKVxuXHRudW1SaWdodCA6PSB0b3RTcGFjZXMgLSBudW1MZWZ0XG5cdGlmIChjaGFyID09ICcgJylcblx0XHRyZXR1cm4gc3BhY2VzKG51bUxlZnQpICsgdGV4dCArIHNwYWNlcyhudW1SaWdodClcblx0ZWxzZVxuXHRcdGJ1ZiA6PSAnICcucmVwZWF0KG51bUJ1ZmZlcilcblx0XHRsZWZ0IDo9IGNoYXIucmVwZWF0KG51bUxlZnQgLSBudW1CdWZmZXIpXG5cdFx0cmlnaHQgOj0gY2hhci5yZXBlYXQobnVtUmlnaHQgLSBudW1CdWZmZXIpXG5cdFx0cmV0dXJuIGxlZnQgKyBidWYgKyB0ZXh0ICsgYnVmICsgcmlnaHRcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuLyoqXG4gKiBwYWQgYSBzdHJpbmcgb24gdGhlIGxlZnQsIHJpZ2h0LCBvciBib3RoXG4gKiB0byB0aGUgZ2l2ZW4gd2lkdGhcbiAqL1xuXG5leHBvcnQgdHlwZSBUQWxpZ25tZW50ID0gJ2wnfCdjJ3wncid8J2xlZnQnfCdjZW50ZXInfCdyaWdodCdcblxuZXhwb3J0IGlzQWxpZ25tZW50IDo9ICh4OiBhbnkpOiB4IGlzIFRBbGlnbm1lbnQgPT5cblxuXHRyZXR1cm4gWydsJywnYycsJ3InLCdsZWZ0JywnY2VudGVyJywncmlnaHQnXS5pbmNsdWRlcyh4KVxuXG5leHBvcnQgYWxpZ25TdHJpbmcgOj0gKFxuXHRzdHI6IHN0cmluZyxcblx0d2lkdGg6IG51bWJlcixcblx0YWxpZ246IFRBbGlnbm1lbnRcblx0KTogc3RyaW5nIC0+XG5cblx0c3dpdGNoIGFsaWduXG5cdFx0d2hlbiAnbGVmdCcsICdsJ1xuXHRcdFx0cmV0dXJuIHJwYWQoc3RyLCB3aWR0aClcblx0XHR3aGVuICdjZW50ZXInLCAnYydcblx0XHRcdHJldHVybiBjZW50ZXJlZChzdHIsIHdpZHRoKVxuXHRcdHdoZW4gJ3JpZ2h0JywgJ3InXG5cdFx0XHRyZXR1cm4gbHBhZChzdHIsIHdpZHRoKVxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKipcbiAqIGNvbnZlcnRzIHRoZSBnaXZlbiBudW1iZXIgdG8gYSBzdHJpbmcsIHRoZW4gcGFkcyBvbiB0aGUgbGVmdFxuICogd2l0aCB6ZXJvcyB0byBhY2hpZXZlIHRoZSBnaXZlbiBsZW5ndGhcbiAqL1xuXG5leHBvcnQgenBhZCA6PSAobjogbnVtYmVyLCBsZW46IG51bWJlcik6IHN0cmluZyA9PlxuXG5cdHJldHVybiBscGFkKG4udG9TdHJpbmcoKSwgbGVuLCAnMCcpXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4jIEdFTkVSQVRPUlxuXG5leHBvcnQgYWxsTWF0Y2hlcyA6PSAoc3RyOiBzdHJpbmcsIHJlOiBSZWdFeHApOiBHZW5lcmF0b3I8c3RyaW5nW10sIHZvaWQsIHZvaWQ+IC0+XG5cblx0IyAtLS0gRW5zdXJlIHRoZSByZWdleCBoYXMgdGhlIGdsb2JhbCBmbGFnIChnKSBzZXRcblx0bmV3cmUgOj0gbmV3IFJlZ0V4cChyZSwgcmUuZmxhZ3MgKyAocmUuZmxhZ3MuaW5jbHVkZXMoJ2cnKSA/ICcnIDogJ2cnKSlcblx0bGV0IGxNYXRjaGVzOiBzdHJpbmdbXSB8IG51bGwgPSBudWxsXG5cdHdoaWxlIGRlZmluZWQobE1hdGNoZXMgPSBuZXdyZS5leGVjKHN0cikpXG4gIFx0XHR5aWVsZCBsTWF0Y2hlc1xuXHRyZXR1cm5cblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuLyoqXG4gKiBBIGdlbmVyYXRvciB0aGF0IHlpZWxkcyBpbnRlZ2VycyBzdGFydGluZyB3aXRoIDAgYW5kXG4gKiBjb250aW51aW5nIHRvIG4tMVxuICovXG5cbmV4cG9ydCByYW5nZSA6PSAoXG5cdG46IG51bWJlclxuXHQpOiBHZW5lcmF0b3I8bnVtYmVyLCB2b2lkLCB2b2lkPiAtPlxuXG5cdGxldCBpID0gMFxuXHR3aGlsZSAoaSA8IG4pXG5cdFx0eWllbGQgaVxuXHRcdGkgPSBpICsgMVxuXHRyZXR1cm5cblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuZXhwb3J0IGNsYXNzIEZldGNoZXI8VD5cblxuXHRpdGVyOiBJdGVyYXRvcjxUPlxuXHRidWZmZXI6IFQ/ID0gdW5kZWZcblxuXHRjb25zdHJ1Y3RvcihAaXRlcjogSXRlcmF0b3I8VD4sIEBlb2ZWYWx1ZTogVClcblxuXHRwZWVrKCk6IFRcblx0XHRpZiBkZWZpbmVkKEBidWZmZXIpXG5cdFx0XHRyZXR1cm4gQGJ1ZmZlclxuXHRcdGVsc2Vcblx0XHRcdHt2YWx1ZSwgZG9uZX0gOj0gQGl0ZXIubmV4dCgpXG5cdFx0XHRpZiBkb25lXG5cdFx0XHRcdHJldHVybiBAZW9mVmFsdWVcblx0XHRcdGVsc2Vcblx0XHRcdFx0QGJ1ZmZlciA9IHZhbHVlXG5cdFx0XHRcdHJldHVybiB2YWx1ZVxuXG5cdGdldChleHBlY3RlZDogVD89dW5kZWYpOiBUXG5cdFx0bGV0IHJlc3VsdDogVCA9IEBlb2ZWYWx1ZVxuXHRcdGlmIGRlZmluZWQoQGJ1ZmZlcilcblx0XHRcdHJlc3VsdCA9IEBidWZmZXJcblx0XHRcdEBidWZmZXIgPSB1bmRlZlxuXHRcdGVsc2Vcblx0XHRcdHt2YWx1ZSwgZG9uZX0gOj0gQGl0ZXIubmV4dCgpXG5cdFx0XHRyZXN1bHQgPSBkb25lID8gQGVvZlZhbHVlIDogdmFsdWVcblx0XHRpZiBkZWZpbmVkKGV4cGVjdGVkKVxuXHRcdFx0YXNzZXJ0IGRlZXBFcXVhbChyZXN1bHQsIGV4cGVjdGVkKSxcblx0XHRcdFx0XHRcIiN7T0woZXhwZWN0ZWQpfSBleHBlY3RlZFwiXG5cdFx0cmV0dXJuIHJlc3VsdFxuXG5cdHNraXAoZXhwZWN0ZWQ6IFQ/PXVuZGVmKTogdm9pZFxuXHRcdEBnZXQoZXhwZWN0ZWQpXG5cdFx0cmV0dXJuXG5cblx0YXRFbmQoKTogYm9vbGVhblxuXHRcdGlmIGRlZmluZWQoQGJ1ZmZlcilcblx0XHRcdHJldHVybiBmYWxzZVxuXHRcdGVsc2Vcblx0XHRcdHt2YWx1ZSwgZG9uZX0gOj0gQGl0ZXIubmV4dCgpXG5cdFx0XHRpZiBkb25lIHx8ICh2YWx1ZSA9PSBAZW9mVmFsdWUpXG5cdFx0XHRcdHJldHVybiB0cnVlXG5cdFx0XHRlbHNlXG5cdFx0XHRcdEBidWZmZXIgPSB2YWx1ZVxuXHRcdFx0XHRyZXR1cm4gZmFsc2VcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuZXhwb3J0IGFzc2VydFNhbWVTdHIgOj0gKFxuXHRcdHN0cjE6IHN0cmluZyxcblx0XHRzdHIyOiBzdHJpbmdcblx0XHQpOiB2b2lkID0+XG5cblx0aWYgKHN0cjEgIT0gc3RyMilcblx0XHRjb25zb2xlLmxvZyBjZW50ZXJlZChcIlN0cmluZ3MgRGlmZmVyOlwiLCA2NCwgJy0nKVxuXHRcdGNvbnNvbGUubG9nIGNlbnRlcmVkKFwic3RyaW5nIDFcIiwgNjQsICctJylcblx0XHRjb25zb2xlLmxvZyBzdHIxXG5cdFx0Y29uc29sZS5sb2cgY2VudGVyZWQoXCJzdHJpbmcgMlwiLCA2NCwgJy0nKVxuXHRcdGNvbnNvbGUubG9nIHN0cjJcblx0XHRjb25zb2xlLmxvZyAnLScucmVwZWF0KDY0KVxuXG5cdGFzc2VydCAoc3RyMSA9PSBzdHIyKSwgXCJzdHJpbmdzIGRpZmZlclwiXG5cdHJldHVyblxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG5leHBvcnQgaW50ZXJwb2xhdGUgOj0gKFxuXHRcdHN0cjogc3RyaW5nXG5cdFx0aFJlcGxhY2U6IGhhc2hvZjxzdHJpbmc+ICAgIyAtLS0geyA8dGFnPjogPHJlcGxhY2VtZW50PiwgLi4uIH1cblx0XHQpOiBzdHJpbmcgPT5cblxuXHRmb3Iga2V5IG9mIE9iamVjdC5rZXlzKGhSZXBsYWNlKVxuXHRcdGFzc2VydCAoa2V5WzBdID09ICckJyksIFwiYWxsIGtleXMgbXVzdCBzdGFydCB3aXRoICckJ1wiXG5cdHJlIDo9IC8vL1xuXHRcdFxcJFxuXHRcdCg/OltBLVphLXpdW0EtWmEtejAtOV0qKVxuXHRcdC8vL2dcblx0cmV0dXJuIHN0ci5yZXBsYWNlQWxsKHJlLCAobWF0Y2g6IHN0cmluZykgPT5cblx0XHRyZXR1cm4gaFJlcGxhY2VbbWF0Y2hdIHx8IG1hdGNoXG5cdFx0KVxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG5leHBvcnQgcmVxdWlyZSA6PSBnZXRJbXBvcnRTeW5jKGltcG9ydC5tZXRhLnVybClcbiJdfQ==