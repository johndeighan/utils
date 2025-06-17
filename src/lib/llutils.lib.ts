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

	return " ".repeat(n)
}

// ---------------------------------------------------------------------------

/**
 * returns a string consisting of the given number
 * of TAB characters
 */

export const tabs = (n: number): string => {

	return "\t".repeat(n)
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
		style, hReplace, block, offset, poschar
		} = getOptions(hOptions, {
			style: 'debug',
			hReplace: undef,
			block: false,
			offset: undef,
			poschar: '┊'
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

	const lParts: string[] = []
	let i1 = 0;for (const ch of str) {const i = i1++;
		if (i === offset) {
			lParts.push(poschar)
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

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3JjL2xpYi9sbHV0aWxzLmxpYi5jaXZldC50c3giLCJzb3VyY2VzIjpbInNyYy9saWIvbGx1dGlscy5saWIuY2l2ZXQiXSwibWFwcGluZ3MiOiI7QUFBQSxvQkFBbUI7QUFDbkIsQUFBQTtBQUNBLEssVyx5QjtBQUFBLE1BQU0sQ0FBQyxDQUFDLGFBQWEsQ0FBQyxDQUFDLElBQUksQ0FBQyxhQUFhO0FBQ3pDLEFBQUEsQUFBQSxNQUFNLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxJQUFJLENBQUMsaUJBQWlCO0FBQ3ZDLEFBQUEsQUFBQSxNQUFNLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxJQUFJLENBQUMsV0FBVztBQUNsQyxBQUFBO0FBQ0EsQUFBQSxBQUFBLE1BQU0sQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLElBQUksQ0FBQyxxQkFBcUI7QUFDNUMsQUFBQSxBQUFBLE1BQU0sQ0FBQyxDQUFDO0FBQ1IsQ0FBQyxLQUFLLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxTQUFTLENBQUM7QUFDckQsQ0FBQyxNQUFNLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDLGdCQUFnQixDQUFDO0FBQ3JELENBQUMsT0FBTyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsU0FBUyxDQUFDO0FBQ2xELENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsUUFBUSxDQUFDO0FBQ2pELENBQUMsV0FBVyxDQUFDLENBQUMsY0FBYyxDQUFDLENBQUMsV0FBVyxDQUFDO0FBQzFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxvQkFBb0I7QUFDNUIsQUFBQTtBQUNBLEFBQUE7QUFDQTtBQUNBLEdBQUc7QUFDSCxBQUFBO0FBQ0Es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RCxBQUFBO0FBQ0EsQUFBQSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUEsQUFBQyxvQkFBb0IsQ0FBQTtBQUNqQyxBQUFBLENBQVMsTUFBUixRQUFRLENBQUMsQ0FBRSxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFBLENBQUE7QUFDdkMsQUFBQSxFQUFFLE9BQU8sQ0FBQyxHQUFHLENBQUEsQUFBQyxDQUFDLFNBQVMsRUFBRSxTQUFTLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDN0MsQUFBQSxFQUFRLE1BQU4sTUFBTSxDQUFDLENBQUUsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUM7QUFDdEMsQUFBQSxFQUFFLE9BQU8sQ0FBQyxHQUFHLENBQUEsQUFBQyxDQUFDLFVBQVUsRUFBRSxTQUFTLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDL0MsQUFBQSxFQUFFLE1BQU0sQ0FBQyxNO0NBQU0sQ0FBQTtBQUNmLEFBQUEsQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxRQUFRLENBQUMsQ0FBQyxRQUFRLEM7QUFBQyxDQUFBO0FBQ2xELEFBQUE7QUFDQSxBQUFBLDhFQUE2RTtBQUM3RSxBQUFBO0FBQ0EsQUFBQTtBQUNBO0FBQ0EsR0FBRztBQUNILEFBQUE7QUFDQSxBQUFBLEFBQUEsTUFBTSxDQUFFLE1BQUQsQ0FBQyxDQUFDLENBQUUsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLG9CQUFvQixDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFBLENBQUE7QUFDdkQsQUFBQTtBQUNBLEFBQUEsQ0FBUyxNQUFSLFFBQVEsQ0FBQyxDQUFFLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUEsQ0FBQTtBQUN2QyxBQUFBLEVBQU8sTUFBTCxLQUFL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Q0FBQyxDQUFDO0FBQ1osRUFBRSxDQUFDLENBQUE7QUFDSCxBQUFBO0FBQ0EsQUFBQSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNO0FBQ3RCLEFBQUE7QUFDQSxBQUFBLENBQUMsR0FBRyxDQUFBLFFBQVEsQ0FBQyxNQUFNLENBQUMsQ0FBQSxDQUFBLENBQUE7QUFDcEIsQUFBQSxFQUFFLE1BQU0sQyxDQUFFLENBQUMsQ0FBQyxNQUFNLEM7Q0FBQyxDQUFBO0FBQ25CLEFBQUEsQ0FBZ0IsTUFBZixLQUFLLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUUsQ0FBQyxDQUFDLENBQUM7QUFDdEIsQUFBQSxDQUFDLEdBQUcsQ0FBQyxDQUFBLE1BQUEsR0FBRyxDQUFDLEVBQUUsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFBLENBQUEsQ0FBQTtBQUM1QixBQUFBLEVBQUUsR0FBRyxDQUFBLENBQUksTUFBTSxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQSxDQUFBLENBQUE7QUFDN0IsQUFBQSxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUEsQUFBQyxHQUFHLEM7RUFBQSxDO0NBQUEsQ0FBQTtBQUNqQixBQUFBLENBQUMsTUFBTSxDQUFDLEs7QUFBSyxDQUFBO0FBQ2IsQUFBQTtBQUNBLEFBQUEsOEVBQTZFO0FBQzdFLEFBQUE7QUFDQSxBQUFBO0FBQ0E7QUFDQTtBQUNBLEdBQUc7QUFDSCxBQUFBO0FBQ0EsQUFBQSxBQUFBLE1BQU0sQ0FBTyxNQUFOLE1BQU0sQ0FBQyxDQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLEtBQUssQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUEsQ0FBQTtBQUMxRCxBQUFBO0FBQ0EsQUFBQSxDQUFDLEdBQUcsQ0FBQSxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUEsQ0FBQSxDQUFBO0FBQ2pCLEFB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LE1BQU0sQ0FBQyxDQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUEsQ0FBQTtBQUN2QyxBQUFBO0FBQ0EsQUFBQSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUMsQztBQUFDLENBQUE7QUFDckIsQUFBQTtBQUNBLEFBQUEsOEVBQTZFO0FBQzdFLEFBQUE7QUFDQSxBQUFBO0FBQ0E7QUFDQTtBQUNBLEdBQUc7QUFDSCxBQUFBO0FBQ0EsQUFBQSxBQUFBLE1BQU0sQ0FBSyxNQUFKLElBQUksQ0FBQyxDQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUEsQ0FBQTtBQUNyQyxBQUFBO0FBQ0EsQUFBQSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQztBQUFDLENBQUE7QUFDdEIsQUFBQTtBQUNBLEFBQUEsOEVBQTZFO0FBQzdFLEFBQUE7QUFDQSxBQUFBO0FBQ0E7QUFDQSxHQUFHO0FBQ0gsQUFBQTtBQUNBLEFBQUEsQUFBQSxNQUFNLENBQU0sTUFBTCxLQUFLLENBQUMsQ0FBRSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFBLENBQUE7QUFDekMsQUFBQTtBQUNBLEFBQUEsQ0FBQyxNQUFNLENBQUEsQUFBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLGNBQWMsRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQTtBQUN0RCxBQUFBLENBQVMsTUFBUixRQUFRLENBQUMsQ0FBRSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsWUFBWSxDQUFDO0FBQ3JDLEFBQUEsQ0FBQyxNQUFNLENBQUMsQ0FBQyxRQUFRLENBQUMsR0FBRSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLFFB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NkU7QUFDN0UsQUFBQTtBQUNBLEFBQUE7QUFDQTtBQUNBO0FBQ0EsR0FBRztBQUNILEFBQUE7QUFDQSxBQUFBLEFBQUEsTUFBTSxDQUFLLE1BQUosSUFBSSxDQUFDLENBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUEsQ0FBQTtBQUNwRSxBQUFBO0FBQ0EsQUFBQSxDQUFDLE1BQU0sQ0FBQSxBQUFDLENBQUMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxHQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxZQUFZLENBQUE7QUFDdEMsQUFBQSxDQUFNLE1BQUwsS0FBSyxDQUFDLENBQUUsQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBRyxDQUFDO0FBQzdCLEFBQUEsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsTUFBTSxDQUFDLEtBQUssQztBQUFDLENBQUE7QUFDOUIsQUFBQTtBQUNBLEFBQUEsOEVBQTZFO0FBQzdFLEFBQUE7QUFDQSxBQUFBO0FBQ0E7QUFDQTtBQUNBLEdBQUc7QUFDSCxBQUFBO0FBQ0EsQUFBQSxBQUFBLE1BQU0sQ0FBSyxNQUFKLElBQUksQ0FBQyxDQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFBLENBQUE7QUFDcEUsQUFBQTtBQUNBLEFBQUEsQ0FBQyxNQUFNLENBQUEsQUFBQyxDQUFDLEVBQUUsQ0FBQyxNQUFNLENBQUMsR0FBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsWUFBWSxDQUFBO0FBQ3RDLEFBQUEsQ0FBTSxNQUFMLEtBQUss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RSxBQUFBO0FBQ0EsQUFBQTtBQUNBO0FBQ0E7QUFDQSxHQUFHO0FBQ0gsQUFBQTtBQUNBLEFBQUEsQUFBQSxNQUFNLENBQUssTUFBSixJQUFJLENBQUMsQ0FBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFBLENBQUE7QUFDbEQsQUFBQTtBQUNBLEFBQUEsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBRyxDO0FBQUMsQ0FBQTtBQUNwQyxBQUFBO0FBQ0EsQUFBQSw4RUFBNkU7QUFDN0UsQUFBQSxZQUFXO0FBQ1gsQUFBQTtBQUNBLEFBQUEsQUFBQSxNQUFNLENBQVcsTUFBVixVQUFVLENBQUMsQ0FBRSxDQUE0RCxRLENBQTNELENBQUMsR0FBRyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBSSxDQUFBLENBQUE7QUFDbEYsQUFBQTtBQUNBLEFBQUEsQ0FBQyxtREFBa0Q7QUFDbkQsQUFBQSxDQUFNLE1BQUwsS0FBSyxDQUFDLENBQUUsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUM7QUFDeEUsQUFBQSxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUk7QUFDckMsQUFBQSxD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QUFFLENBQUMsQ0FBRyxBQUNSLEVBQUUsQUFDRixHQUFHLFFBQVEsV0FBVyxFQUFFLEFBQ3hCLEMsQ0FBSTtBQUNOLEFBQUEsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQSxDQUFBO0FBQzdDLEFBQUEsRUFBRSxNQUFNLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQyxLO0NBQUssQ0FBQTtBQUNqQyxFQUFFLEM7QUFBQyxDQUFBO0FBQ0gsQUFBQTtBQUNBLEFBQUEsOEVBQTZFO0FBQzdFLEFBQUE7QUFDQSxBQUFBLEFBQUEsTUFBTSxDQUFRLE1BQVAsT0FBTyxDQUFDLENBQUUsQ0FBQyxhQUFhLENBQUMsV0FBVyxDQUFDLEdBQUcsQ0FBQztBQUNoRCIsIm5hbWVzIjpbXSwic291cmNlc0NvbnRlbnQiOlsiIyBsbHV0aWxzLmxpYi5jaXZldFxuXG5pbXBvcnQge2NyZWF0ZVJlcXVpcmV9IGZyb20gXCJub2RlOm1vZHVsZVwiXG5pbXBvcnQge3NwcmludGZ9IGZyb20gXCJAc3RkL2ZtdC9wcmludGZcIlxuaW1wb3J0IHtyZWxhdGl2ZX0gZnJvbSAnQHN0ZC9wYXRoJ1xuXG5pbXBvcnQge3RydW5jU3RyfSBmcm9tICcuL3R5cGVzY3JpcHQubGliLnRzJ1xuaW1wb3J0IHtcblx0dW5kZWYsIGRlZmluZWQsIG5vdGRlZmluZWQsIGFzc2VydCwgY2hhciwgZGVlcEVxdWFsLFxuXHRpc0hhc2gsIGlzQXJyYXksIGlzTm9uRW1wdHlTdHJpbmcsIGlzQXJyYXlPZlN0cmluZ3MsXG5cdGlzRW1wdHksIG5vbkVtcHR5LCBpc1N0cmluZywgaXNPYmplY3QsIGlzSW50ZWdlcixcblx0aW50ZWdlciwgaGFzaCwgaGFzaG9mLCBhcnJheSwgYXJyYXlvZiwgdm9pZEZ1bmMsXG5cdFRGaWx0ZXJGdW5jLCBpc05vblByaW1pdGl2ZSwgZnVuY3Rpb25EZWYsXG5cdH0gZnJvbSAnLi9kYXRhdHlwZXMubGliLnRzJ1xuXG4vKipcbiAqIEBtb2R1bGUgbGx1dGlscyAtIGxvdyBsZXZlbCB1dGlsaXRpZXNcbiAqL1xuXG5sbHV0aWxzTG9hZFRpbWU6IGludGVnZXIgOj0gRGF0ZS5ub3coKVxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuIyAtLS0gU2hvdWxkIGJlIGNhbGxlZCBsaWtlOlxuIyAgICAgICAgcmVxdWlyZSA6PSBnZXRJbXBvcnRTeW5jKGltcG9ydC5tZXRhLnVybClcblxuZXhwb3J0IGdldEltcG9ydFN5bmMgOj0gKHVybDogc3RyaW5nKTogRnVuY3Rpb24gPT5cblxuXHRyZXR1cm4gY3JlYXRlUmVxdWlyZSh1cmwpXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbmV4cG9ydCBzaW5jZUxvYWQgOj0gKGRhdGV0aW1lOiBEYXRlIHwgaW50ZWdlciA9IERhdGUubm93KCkpID0+XG5cblx0aWYgKGRhdGV0aW1lIGluc3RhbmNlb2YgRGF0ZSlcblx0XHRyZXR1cm4gZGF0ZXRpbWUudmFsdWVPZigpIC0gbGx1dGlsc0xvYWRUaW1lXG5cdGVsc2Vcblx0XHRyZXR1cm4gZGF0ZXRpbWUgLSBsbHV0aWxzTG9hZFRpbWVcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuZXhwb3J0IHNpbmNlTG9hZFN0ciA6PSAoZGF0ZXRpbWU6IChEYXRlIHwgaW50ZWdlcik/ID0gdW5kZWYpID0+XG5cblx0cmV0dXJuIHNwcmludGYoXCIlNmRcIiwgc2luY2VMb2FkKGRhdGV0aW1lKSlcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuLyoqXG4gKiB0aHJvd3MgYW4gZXhjZXB0aW9uIHdpdGggdGhlIHByb3ZpZGVkIG1lc3NhZ2VcbiAqL1xuXG5leHBvcnQgY3JvYWsgOj0gKG1zZzogc3RyaW5nKTogbmV2ZXIgPT5cblxuXHR0aHJvdyBuZXcgRXJyb3IobXNnKVxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKipcbiAqIEFzc2VydHMgdGhhdCBgY29uZGAgaXMgdHJ1ZS4gSWYgaXQgaXNuJ3QsIGFuIGV4Y2VwdGlvbiBpc1xuICogdGhyb3duIHdpdGggdGhlIGdpdmVuIGBtc2dgXG4gKi9cblxuZXhwb3J0IHRocm93c0Vycm9yIDo9IChmdW5jOiB2b2lkRnVuYywgbXNnOiBzdHJpbmc9XCJVbmV4cGVjdGVkIHN1Y2Nlc3NcIik6IHZvaWQgPT5cblxuXHR0cnlcblx0XHRmdW5jKClcblx0XHR0aHJvdyBuZXcgRXJyb3IobXNnKVxuXHRjYXRjaCBlcnJcblx0XHRyZXR1cm4gICAgIyBpZ25vcmUgZXJyb3IgLSBpdCB3YXMgZXhwZWN0ZWRcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuLyoqXG4gKiBDYWxsaW5nIHBhc3MoKSBkb2VzIG5vdGhpbmdcbiAqL1xuXG5leHBvcnQgcGFzcyA6PSAoKTogdm9pZCA9PiAgICAjIGRvIG5vdGhpbmdcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuLyoqXG4gKiBzdHJpbmdpZnkgYW55IHZhbHVlLCBzbyB0aGF0IGlmIHdlIHRha2UgdGhlIHJlc3VsdFN0ciwgd2UgY2FuXG4gKiAgICBsZXQgeCA9IDxyZXN1bHRTdHI+XG4gKiB0byByZXRyaWV2ZSB0aGUgb3JpZ2luYWwgdmFsdWUgKGlmIG5vIHRydW5jIG9wdGlvbiBpcyBwYXNzZWQgaW4pXG4gKi9cblxuZXhwb3J0IHN0cmluZ2lmeSA6PSAoXG5cdHg6IGFueSxcblx0aE9wdGlvbnM6IGhhc2g9e31cblx0bGV2ZWw6IG51bWJlcj0wXG5cdCk6IHN0cmluZyA9PlxuXG5cdHtvbmVMaW5lLCBjb21wcmVzcywgdHJ1bmN9IDo9IGdldE9wdGlvbnMgaE9wdGlvbnMsIHtcblx0XHRvbmVMaW5lOiBmYWxzZVxuXHRcdGNvbXByZXNzOiB0cnVlXG5cdFx0dHJ1bmM6IHVuZGVmXG5cdFx0fVxuXG5cdHR5cGVTdHIgOj0gdHlwZW9mIHhcblx0cmVzdWx0IDo9IHN3aXRjaCB0eXBlU3RyXG5cdFx0d2hlbiAndW5kZWZpbmVkJ1xuXHRcdFx0J3VuZGVmaW5lZCdcblx0XHR3aGVuICdvYmplY3QnXG5cdFx0XHRpZiAoeCA9PSBudWxsKVxuXHRcdFx0XHQnbnVsbCdcblx0XHRcdGVsc2UgaWYgQXJyYXkuaXNBcnJheSh4KVxuXHRcdFx0XHRsUGFydHMgOj0gc3RyaW5naWZ5KGl0ZW0sIGhPcHRpb25zLCBsZXZlbCsxKSBmb3IgaXRlbSBvZiB4XG5cdFx0XHRcdGlmIG9uZUxpbmVcblx0XHRcdFx0XHQnWycgKyBsUGFydHMuam9pbignLCAnKSArICddJ1xuXHRcdFx0XHRlbHNlXG5cdFx0XHRcdFx0J1tcXG4nICsgbFBhcnRzLmpvaW4oJyxcXG4nKSArICdcXG5dJ1xuXHRcdFx0ZWxzZVxuXHRcdFx0XHRsUGFydHMgOj0gZm9yIGtleSx2YWwgaW4geFxuXHRcdFx0XHRcdFwiI3trZXl9OiAje3N0cmluZ2lmeSh2YWwsIGhPcHRpb25zLCBsZXZlbCsxKX1cIlxuXHRcdFx0XHRpZiBvbmVMaW5lXG5cdFx0XHRcdFx0J3snICsgbFBhcnRzLmpvaW4oJywgJykgKyAnfSdcblx0XHRcdFx0ZWxzZVxuXHRcdFx0XHRcdCd7XFxuJyArIGxQYXJ0cy5qb2luKCcsXFxuJykgKyAnXFxufSdcblx0XHR3aGVuICdib29sZWFuJ1xuXHRcdFx0eCA/ICd0cnVlJyA6ICdmYWxzZSdcblx0XHR3aGVuICdudW1iZXInXG5cdFx0XHR4LnRvU3RyaW5nKClcblx0XHR3aGVuICdiaWdpbnQnXG5cdFx0XHR4LnRvU3RyaW5nKCkgKyAnbidcblx0XHR3aGVuICdzdHJpbmcnXG5cdFx0XHRcIlxcXCIje2VzY2FwZVN0cih4LCBvJ3N0eWxlPUMnKX1cXFwiXCJcblx0XHR3aGVuICdzeW1ib2wnXG5cdFx0XHRpZiBkZWZpbmVkKHguZGVzY3JpcHRpb24pXG5cdFx0XHRcdFwiU3ltYm9sKFxcXCIje3guZGVzY3JpcHRpb259XFxcIilcIlxuXHRcdFx0ZWxzZVxuXHRcdFx0XHRcIlN5bWJvbCgpXCJcblx0XHR3aGVuICdmdW5jdGlvbidcblx0XHRcdGZ1bmN0aW9uRGVmKHgpXG5cblx0aWYgZGVmaW5lZCh0cnVuYylcblx0XHRyZXR1cm4gdHJ1bmNTdHIocmVzdWx0LCB0cnVuYylcblx0ZWxzZVxuXHRcdHJldHVybiByZXN1bHRcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuLyoqXG4gKiBKU09OIHN0cmluZ2lmaWVzIHggb24gb25lIGxpbmVcbiAqL1xuXG5leHBvcnQgT0wgOj0gKHg6IGFueSk6IHN0cmluZyA9PlxuXG5cdGlmICh4ID09IHVuZGVmKVxuXHRcdHJldHVybiAndW5kZWYnXG5cdGVsc2UgaWYgKHggPT0gbnVsbClcblx0XHRyZXR1cm4gJ251bGwnXG5cdGVsc2UgaWYgKHR5cGVvZiB4ID09ICdzeW1ib2wnKVxuXHRcdGlmIGRlZmluZWQoeC5kZXNjcmlwdGlvbilcblx0XHRcdHJldHVybiBcIltTeW1ib2wgI3t4LmRlc2NyaXB0aW9ufV1cIlxuXHRcdGVsc2Vcblx0XHRcdHJldHVybiBcIltTeW1ib2xdXCJcblx0XHRyZXR1cm4gJ3N5bWJvbCdcblx0ZWxzZSBpZiAodHlwZW9mIHggPT0gJ2Z1bmN0aW9uJylcblx0XHRyZXR1cm4geC50b1N0cmluZygpLnJlcGxhY2VBbGwoJ1xcbicsICcgJylcblx0ZWxzZVxuXHRcdHN0ciA6PSBKU09OLnN0cmluZ2lmeSh4LCAoayx2KSA9PiBkZWZpbmVkKHYpID8gdiA6ICdfX3VuZGVmX18nKVxuXHRcdHJldHVybiBzdHIucmVwbGFjZUFsbCgnXCJfX3VuZGVmX19cIicsICd1bmRlZmluZWQnKVxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG5leHBvcnQgTUwgOj0gKHg6IGFueSk6IHN0cmluZyA9PlxuXG5cdGlmICh4ID09IHVuZGVmKVxuXHRcdHJldHVybiAndW5kZWYnXG5cdGVsc2UgaWYgKHggPT0gbnVsbClcblx0XHRyZXR1cm4gJ251bGwnXG5cdGVsc2UgaWYgKHR5cGVvZiB4ID09ICdmdW5jdGlvbicpXG5cdFx0cmV0dXJuIHgudG9TdHJpbmcoKVxuXHRlbHNlXG5cdFx0c3RyIDo9IEpTT04uc3RyaW5naWZ5KHgsIChrLHYpID0+IGRlZmluZWQodikgPyB2IDogJ19fdW5kZWZfXycsIDMpXG5cdFx0aWYgZGVmaW5lZChzdHIpXG5cdFx0XHRyZXR1cm4gc3RyLnJlcGxhY2VBbGwoJ1wiX191bmRlZl9fXCInLCAndW5kZWZpbmVkJylcblx0XHRlbHNlXG5cdFx0XHRjb25zb2xlLmxvZyB4XG5cdFx0XHRyZXR1cm4gXCJKU09OLnN0cmluZ2lmeSByZXR1cm5lZCB1bmRlZiEhIVwiXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogQ29udmVydHMgdGhlIGdpdmVuIHN0cmluZyB0byBhIGhhc2hcbiAqIDx3b3JkPiBiZWNvbWVzIGEga2V5IHdpdGggYSB0cnVlIHZhbHVlXG4gKiAhPHdvcmQ+IGJlY29tZXMgYSBrZXlzIHdpdGggYSBmYWxzZSB2YWx1ZVxuICogPHdvcmQ+PTxzdHJpbmc+IGJlY29tZXMgYSBrZXkgd2l0aCB2YWx1ZSA8c3RyaW5nPlxuICogICAgLSA8c3RyaW5nPiBtdXN0IGJlIHF1b3RlZCBpZiBpdCBjb250YWlucyB3aGl0ZXNwYWNlXG4gKi9cblxuZXhwb3J0IHN0clRvSGFzaCA6PSAoc3RyOiBzdHJpbmcpOiBoYXNoID0+XG5cblx0aWYgaXNFbXB0eShzdHIpXG5cdFx0cmV0dXJuIHt9XG5cdGg6IGhhc2ggOj0ge31cblx0Zm9yIHdvcmQgb2Ygc3RyLnRyaW0oKS5zcGxpdCgvXFxzKy8pXG5cdFx0aWYgbE1hdGNoZXM6IHN0cmluZ1tdIHwgbnVsbCA6PSB3b3JkLm1hdGNoKC8vL15cblx0XHRcdFx0KFxcISk/ICAgICAgICAgICAgICAgICAgICAjIG5lZ2F0ZSB2YWx1ZVxuXHRcdFx0XHQoW0EtWmEtel1bQS1aYS16XzAtOV0qKSAgIyBpZGVudGlmaWVyXG5cdFx0XHRcdCg/OlxuXHRcdFx0XHRcdCg9KVxuXHRcdFx0XHRcdCguKilcblx0XHRcdFx0XHQpP1xuXHRcdFx0XHQkLy8vKVxuXHRcdFx0W18sIG5lZywgaWRlbnQsIGVxU2lnbiwgc3RyXSA6PSBsTWF0Y2hlc1xuXHRcdFx0aWYgaXNOb25FbXB0eVN0cmluZyhlcVNpZ24pXG5cdFx0XHRcdGFzc2VydCBub3RkZWZpbmVkKG5lZykgfHwgKG5lZyA9PSAnJyksXG5cdFx0XHRcdFx0XHRcIm5lZ2F0aW9uIHdpdGggc3RyaW5nIHZhbHVlXCJcblxuXHRcdFx0XHQjIC0tLSBjaGVjayBpZiBzdHIgaXMgYSB2YWxpZCBudW1iZXJcblx0XHRcdFx0aWYgc3RyLm1hdGNoKC9eLT9cXGQrKFxcLlxcZCspPyQvKVxuXHRcdFx0XHRcdG51bSA6PSBwYXJzZUZsb2F0KHN0cilcblx0XHRcdFx0XHRpZiBOdW1iZXIuaXNOYU4obnVtKVxuXHRcdFx0XHRcdFx0IyAtLS0gVE8gRE86IGludGVycHJldCBiYWNrc2xhc2ggZXNjYXBlc1xuXHRcdFx0XHRcdFx0aFtpZGVudF0gPSBzdHJcblx0XHRcdFx0XHRlbHNlXG5cdFx0XHRcdFx0XHRoW2lkZW50XSA9IG51bVxuXHRcdFx0XHRlbHNlXG5cdFx0XHRcdFx0aFtpZGVudF0gPSBzdHJcblx0XHRcdGVsc2UgaWYgbmVnXG5cdFx0XHRcdGhbaWRlbnRdID0gZmFsc2Vcblx0XHRcdGVsc2Vcblx0XHRcdFx0aFtpZGVudF0gPSB0cnVlXG5cdFx0ZWxzZVxuXHRcdFx0Y3JvYWsgXCJJbnZhbGlkIHdvcmQgI3tPTCh3b3JkKX1cIlxuXHRyZXR1cm4gaFxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG5leHBvcnQgbyA6PSAobFN0cmluZ3M6IFRlbXBsYXRlU3RyaW5nc0FycmF5KTogaGFzaCA9PlxuXG5cdHJldHVybiBzdHJUb0hhc2gobFN0cmluZ3NbMF0pXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogcyAtIGNvbnZlcnQgbGVhZGluZyB0YWJzIHRvIHNwYWNlc1xuICovXG5cbmV4cG9ydCBzIDo9IChsU3RyaW5nczogVGVtcGxhdGVTdHJpbmdzQXJyYXkpOiBzdHJpbmcgPT5cblxuXHRjb25zb2xlLmxvZyBcImNhbGxpbmcgZnVuY3Rpb24gc1wiXG5cdHJlcGxhY2VyIDo9IChtYXRjaDogc3RyaW5nKTogc3RyaW5nID0+XG5cdFx0Y29uc29sZS5sb2cgXCJtYXRjaCA9IDwje2VzY2FwZVN0cihtYXRjaCl9PlwiXG5cdFx0cmVzdWx0IDo9ICcgICAnLnJlcGVhdChtYXRjaC5sZW5ndGgpXG5cdFx0Y29uc29sZS5sb2cgXCJyZXN1bHQgPSA8I3tlc2NhcGVTdHIocmVzdWx0KX0+XCJcblx0XHRyZXR1cm4gcmVzdWx0XG5cdHJldHVybiBsU3RyaW5nc1swXS5yZXBsYWNlQWxsKC9eXFx0Ky9tZywgcmVwbGFjZXIpXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogdCAtIGNvbnZlcnQgbGVhZGluZyBzcGFjZXMgdG8gdGFic1xuICovXG5cbmV4cG9ydCB0IDo9IChsU3RyaW5nczogVGVtcGxhdGVTdHJpbmdzQXJyYXkpOiBzdHJpbmcgPT5cblxuXHRyZXBsYWNlciA6PSAobWF0Y2g6IHN0cmluZyk6IHN0cmluZyA9PlxuXHRcdGxldmVsIDo9IE1hdGguZmxvb3IobWF0Y2gubGVuZ3RoIC8gMylcblx0XHRyZXR1cm4gJ1xcdCcucmVwZWF0KGxldmVsKVxuXHRyZXR1cm4gbFN0cmluZ3NbMF0ucmVwbGFjZUFsbCgvXlxceDIwKy9tZywgcmVwbGFjZXIpXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogQWRkcyBhbnkga2V5cyBpbiBoRGVmYXVsdHMgdGhhdCBhcmUgbWlzc2luZyBpbiBoT3B0aW9uc1xuICogdG8gaE9wdGlvbnMgd2l0aCB0aGVpciBnaXZlbiB2YWx1ZXNcbiAqL1xuXG5leHBvcnQgYWRkRGVmYXVsdHMgOj0gKGhPcHRpb25zOiBoYXNoLCBoRGVmYXVsdHM6IGhhc2gpOiBoYXNoID0+XG5cblx0YXNzZXJ0IGlzT2JqZWN0KGhPcHRpb25zKSwgXCJoT3B0aW9ucyBub3QgYW4gb2JqZWN0OiAje09MKGhPcHRpb25zKX1cIlxuXHRhc3NlcnQgaXNPYmplY3QoaERlZmF1bHRzKSwgXCJoRGVmYXVsdHMgbm90IGFuIG9iamVjdDogI3tPTChoRGVmYXVsdHMpfVwiXG5cblx0IyAtLS0gRmlsbCBpbiBkZWZhdWx0cyBmb3IgbWlzc2luZyB2YWx1ZXNcblx0Zm9yIGtleSBvZiBPYmplY3Qua2V5cyhoRGVmYXVsdHMpXG5cdFx0dmFsdWUgOj0gaERlZmF1bHRzW2tleV1cblx0XHRpZiBub3QgaE9wdGlvbnMuaGFzT3duUHJvcGVydHkoa2V5KSAmJiBkZWZpbmVkKHZhbHVlKVxuXHRcdFx0aE9wdGlvbnNba2V5XSA9IHZhbHVlXG5cdHJldHVybiBoT3B0aW9uc1xuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKipcbiAqIHJldHVybnMgYSBoYXNoIG9mIG9wdGlvbnMgd2l0aCB0aGVpciB2YWx1ZXMsIHVzaW5nIG9wdGlvbnNcbiAqIGlmIGl0J3MgYSBoYXNoLCBvciBwYXJzaW5nIG9wdGlvbnMgdXNpbmcgc3RyVG9IYXNoKCkgaWZcbiAqIGl0J3MgYSBzdHJpbmcgLSBhZGRpbmcgYW55IGRlZmF1bHQgdmFsdWVzIGZyb20gaERlZmF1bHRzXG4gKiBpZiB0aGV5J3JlIG1pc3NpbmcgaW4gdGhlIHJlc3VsdGluZyBoYXNoXG4gKi9cblxuZXhwb3J0IGdldE9wdGlvbnMgOj0gKGhPcHRpb25zOiBoYXNoPXt9LCBoRGVmYXVsdHM6IGhhc2g9e30pOiBoYXNoID0+XG5cblx0cmV0dXJuIGFkZERlZmF1bHRzIGhPcHRpb25zLCBoRGVmYXVsdHNcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuZXhwb3J0IGdldE9uZU9wdGlvbiA6PSAoaE9wdGlvbnM6IGhhc2g9e30sIG5hbWU6IHN0cmluZywgZGVmVmFsOiBhbnkpID0+XG5cblx0cmV0dXJuIGhPcHRpb25zW25hbWVdIHx8IGRlZlZhbFxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKipcbiAqIHJlbW92ZSBhbGwga2V5cyBmcm9tIGEgaGFzaCB0aGF0IGhhdmUgZWl0aGVyIGFuIGVtcHR5IG5hbWVcbiAqIG9yIGFuIGVtcHR5IHZhbHVlXG4gKi9cblxuZXhwb3J0IHJlbW92ZUVtcHR5S2V5cyA6PSAoaDogaGFzaCk6IGhhc2ggPT5cblxuXHRoUmVzdWx0OiBoYXNoIDo9IHt9XG5cdGZvciBrZXkgb2Yga2V5cyhoKVxuXHRcdGlmIG5vbkVtcHR5KGtleSkgJiYgbm9uRW1wdHkoaFtrZXldKVxuXHRcdFx0aFJlc3VsdFtrZXldID0gaFtrZXldXG5cdHJldHVybiBoUmVzdWx0XG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogcmV0dXJuIGFuIGFycmF5IG9mIGFsbCBvd24ga2V5cyBpbiBhIGhhc2hcbiAqL1xuXG5leHBvcnQga2V5cyA6PSAob2JqOiBoYXNoLCBoT3B0aW9uczogaGFzaD17fSk6IHN0cmluZ1tdID0+XG5cblx0aCA6PSBnZXRPcHRpb25zIGhPcHRpb25zLCB7XG5cdFx0ZXhjZXB0OiBbXVxuXHRcdH1cblxuXHRsZXQgZXhjZXB0ID0gaC5leGNlcHRcblxuXHRpZiBpc1N0cmluZyhleGNlcHQpXG5cdFx0ZXhjZXB0ID0gW2V4Y2VwdF1cblx0bEtleXM6IHN0cmluZ1tdIDo9IFtdXG5cdGZvciBrZXkgb2YgT2JqZWN0LmtleXMob2JqKVxuXHRcdGlmIG5vdCBleGNlcHQuaW5jbHVkZXMoa2V5KVxuXHRcdFx0bEtleXMucHVzaCBrZXlcblx0cmV0dXJuIGxLZXlzXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogcmV0dXJucyB0cnVlIGlmIGVpdGhlciBgaGAgaXMgbm90IGRlZmluZWQsIG9yIGlmIGBoYCBpc1xuICogYSBoYXNoIHRoYXQgaW5jbHVkZXMgYWxsIHRoZSBrZXlzIHByb3ZpZGVkXG4gKi9cblxuZXhwb3J0IGhhc0tleSA6PSAoaDogaGFzaCwgLi4ubEtleXM6IHN0cmluZ1tdKTogYm9vbGVhbiA9PlxuXG5cdGlmIG5vdGRlZmluZWQoaClcblx0XHRyZXR1cm4gZmFsc2Vcblx0Zm9yIGtleSBvZiBsS2V5c1xuXHRcdGFzc2VydCBpc1N0cmluZyhrZXkpLCBcImtleSBub3QgYSBzdHJpbmc6ICN7T0woa2V5KX1cIlxuXHRcdGlmIG5vdCBoLmhhc093blByb3BlcnR5KGtleSlcblx0XHRcdHJldHVybiBmYWxzZVxuXHRyZXR1cm4gdHJ1ZVxuXG5leHBvcnQgaGFzS2V5cyA6PSBoYXNLZXlcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuZXhwb3J0IG1pc3NpbmdLZXlzIDo9IChoOiBoYXNoLCAuLi5sS2V5czogc3RyaW5nW10pOiBzdHJpbmdbXSA9PlxuXG5cdGlmIG5vdGRlZmluZWQoaClcblx0XHRyZXR1cm4gbEtleXNcblx0YXNzZXJ0IGlzSGFzaChoKSwgXCJoIG5vdCBhIGhhc2g6ICN7T0woaCl9XCJcblx0bE1pc3Npbmc6IHN0cmluZ1tdIDo9IFtdXG5cdGZvciBrZXkgb2YgbEtleXNcblx0XHRpZiBub3QgaC5oYXNPd25Qcm9wZXJ0eShrZXkpXG5cdFx0XHRsTWlzc2luZy5wdXNoIGtleVxuXHRyZXR1cm4gbE1pc3NpbmdcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuLyoqXG4gKiBtZXJnZXMgdGhlIHByb3ZpZGVkIG9iamVjdHMgaW50byBhIG5ldyBvYmplY3RcbiAqIE5PVEU6IG5vbmUgb2YgdGhlIHByb3ZpZGVkIGFyZ3VtZW50cyBhcmUgbW9kaWZpZWRcbiAqL1xuXG5leHBvcnQgbWVyZ2UgOj0gKC4uLmxPYmplY3RzOiBoYXNoW10pOiBoYXNoID0+XG5cblx0cmV0dXJuIE9iamVjdC5hc3NpZ24oe30sIGxPYmplY3RzLi4uKVxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG5leHBvcnQgaGl0IDo9IChwY3Q6IG51bWJlciA9IDUwKTogYm9vbGVhbiA9PlxuXG5cdHJldHVybiAoMTAwICogTWF0aC5yYW5kb20oKSA8IHBjdClcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiMgLS0tIEFTWU5DICFcblxuZXhwb3J0IHNsZWVwIDo9IChzZWM6IG51bWJlcik6IHZvaWQgPT5cblxuXHRhd2FpdCBuZXcgUHJvbWlzZSgocikgPT4gc2V0VGltZW91dChyLCAxMDAwICogc2VjKSlcblx0cmV0dXJuXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbmV4cG9ydCBzbGVlcFN5bmMgOj0gKHNlYzogbnVtYmVyKTogdm9pZCA9PlxuXG5cdHN0YXJ0IDo9IERhdGUubm93KClcblx0ZW5kIDo9IERhdGUubm93KCkgKyAxMDAwKnNlY1xuXHR3aGlsZSAoRGF0ZS5ub3coKSA8IGVuZClcblx0cmV0dXJuXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogcmV0dXJucyBhIHN0cmluZyBjb25zaXN0aW5nIG9mIHRoZSBnaXZlbiBudW1iZXJcbiAqIG9mIHNwYWNlIGNoYXJhY3RlcnNcbiAqL1xuXG5leHBvcnQgc3BhY2VzIDo9IChuOiBudW1iZXIpOiBzdHJpbmcgPT5cblxuXHRyZXR1cm4gXCIgXCIucmVwZWF0KG4pXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogcmV0dXJucyBhIHN0cmluZyBjb25zaXN0aW5nIG9mIHRoZSBnaXZlbiBudW1iZXJcbiAqIG9mIFRBQiBjaGFyYWN0ZXJzXG4gKi9cblxuZXhwb3J0IHRhYnMgOj0gKG46IG51bWJlcik6IHN0cmluZyA9PlxuXG5cdHJldHVybiBcIlxcdFwiLnJlcGVhdChuKVxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKipcbiAqIHJ0cmltIC0gc3RyaXAgdHJhaWxpbmcgd2hpdGVzcGFjZVxuICovXG5cbmV4cG9ydCBydHJpbSA6PSAobGluZTogc3RyaW5nKTogc3RyaW5nID0+XG5cblx0YXNzZXJ0IGlzU3RyaW5nKGxpbmUpLCBcIm5vdCBhIHN0cmluZzogI3t0eXBlb2YgbGluZX1cIlxuXHRsTWF0Y2hlcyA6PSBsaW5lLm1hdGNoKC9eKC4qPylcXHMrJC8pXG5cdHJldHVybiAobE1hdGNoZXMgPT0gbnVsbCkgPyBsaW5lIDogbE1hdGNoZXNbMV1cblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuLyoqXG4gKiBDb3VudCB0aGUgbnVtYmVyIG9mIGEgc3BlY2lmaWMgY2hhcmFjdGVyIGluIGEgc3RyaW5nXG4gKi9cblxuZXhwb3J0IGNvdW50Q2hhcnMgOj0gKHN0cjogc3RyaW5nLCBjaDogc3RyaW5nKTogbnVtYmVyID0+XG5cblx0bGV0IGNvdW50ID0gMFxuXHRsZXQgcG9zID0gLTFcblx0d2hpbGUgKHBvcyA9IHN0ci5pbmRleE9mKGNoLCBwb3MrMSkpICE9IC0xXG5cdFx0Y291bnQgKz0gMVxuXHRyZXR1cm4gY291bnRcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuLyoqXG4gKiBjb252ZXJ0IGEgbXVsdGktbGluZSBzdHJpbmcgdG8gYW4gYXJyYXlcbiAqIG9mIHNpbmdsZSBsaW5lIHN0cmluZ3NcbiAqL1xuXG5leHBvcnQgYmxvY2tUb0FycmF5IDo9IChibG9jazogc3RyaW5nKTogc3RyaW5nW10gPT5cblxuXHRpZiBpc0VtcHR5KGJsb2NrKVxuXHRcdHJldHVybiBbXVxuXHRlbHNlXG5cdFx0cmV0dXJuIGJsb2NrLnNwbGl0KC9cXHI/XFxuLylcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuZXhwb3J0IGFsbExpbmVzSW5CbG9jayA6PSAoXG5cdFx0YmxvY2s6IHN0cmluZ1xuXHRcdCk6IEdlbmVyYXRvcjxzdHJpbmcsIHZvaWQsIHZvaWQ+IC0+XG5cblx0bGV0IHN0YXJ0ID0gMFxuXHRsZXQgZW5kID0gYmxvY2suaW5kZXhPZignXFxuJylcblx0d2hpbGUgKGVuZCAhPSAtMSlcblx0XHR5aWVsZCBibG9jay5zdWJzdHJpbmcoc3RhcnQsIGVuZClcblx0XHRzdGFydCA9IGVuZCArIDFcblx0XHRlbmQgPSBibG9jay5pbmRleE9mKCdcXG4nLCBzdGFydClcblx0aWYgKHN0YXJ0IDwgYmxvY2subGVuZ3RoKVxuXHRcdHlpZWxkIGJsb2NrLnN1YnN0cmluZyhzdGFydClcblx0cmV0dXJuXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogQSBzdHJpbmcgb3Igc3RyaW5nIGFycmF5XG4gKi9cblxuZXhwb3J0IHR5cGUgVEJsb2NrU3BlYyA9IHN0cmluZyB8IHN0cmluZ1tdXG5cbmV4cG9ydCBpc0Jsb2NrU3BlYyA6PSAoeDogYW55KTogeCBpcyBUQmxvY2tTcGVjID0+XG5cblx0cmV0dXJuIGlzU3RyaW5nKHgpIHx8IGlzQXJyYXlPZlN0cmluZ3MoeClcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuLyoqXG4gKiByZXR1cm4gYW4gYXJyYXkgYXMgaXMsIGNvbnZlcnQgYSBtdWx0aS1saW5lIHN0cmluZ1xuICogdG8gYW4gYXJyYXkgb2Ygc2luZ2xlIGxpbmUgc3RyaW5nc1xuICovXG5cbmV4cG9ydCB0b0FycmF5IDo9IChzdHJPckFycmF5OiBUQmxvY2tTcGVjKTogc3RyaW5nW10gPT5cblxuXHRpZiBBcnJheS5pc0FycmF5KHN0ck9yQXJyYXkpXG5cdFx0cmV0dXJuIHN0ck9yQXJyYXlcblx0ZWxzZVxuXHRcdHJldHVybiBibG9ja1RvQXJyYXkoc3RyT3JBcnJheSlcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuLyoqXG4gKiBjb252ZXJ0IGFuIGFycmF5IG9mIHN0cmluZ3MgdG8gYSBzaW5nbGUgbXVsdGktbGluZSBzdHJpbmdcbiAqL1xuXG5leHBvcnQgYXJyYXlUb0Jsb2NrIDo9IChsTGluZXM6IHN0cmluZ1tdKTogc3RyaW5nID0+XG5cblx0YXNzZXJ0IGlzQXJyYXkobExpbmVzKSwgXCJsTGluZXMgaXMgbm90IGFuIGFycmF5OiAje09MKGxMaW5lcyl9XCJcblx0cmV0dXJuIGxMaW5lcy5maWx0ZXIoKGxpbmUpID0+IGRlZmluZWQobGluZSkpLmpvaW4oXCJcXG5cIilcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuLyoqXG4gKiByZXR1cm4gYSBzdHJpbmcgYXMgaXMsIGNvbnZlcnQgYW4gYXJyYXkgb2Ygc3RyaW5nc1xuICogdG8gYSBzaW5nbGUgbXVsdGktbGluZSBzdHJpbmdcbiAqL1xuXG5leHBvcnQgdG9CbG9jayA6PSAoc3RyT3JBcnJheTogVEJsb2NrU3BlYyk6IHN0cmluZyA9PlxuXG5cdGlmIGlzU3RyaW5nKHN0ck9yQXJyYXkpXG5cdFx0cmV0dXJuIHN0ck9yQXJyYXlcblx0ZWxzZVxuXHRcdHJldHVybiBhcnJheVRvQmxvY2soc3RyT3JBcnJheSlcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuZXhwb3J0IGludmVydEhhc2ggOj0gKGg6IGhhc2gpOiBoYXNoID0+XG5cblx0YXNzZXJ0IGlzSGFzaChoKSwgXCJOb3QgYSBoYXNoOiAje09MKGgpfVwiXG5cdGhSZXN1bHQ6IGhhc2ggOj0ge31cblx0Zm9yIGtleSBvZiBrZXlzKGgpXG5cdFx0dmFsdWUgOj0gaFtrZXldXG5cdFx0aWYgaXNTdHJpbmcodmFsdWUpXG5cdFx0XHRoUmVzdWx0W3ZhbHVlXSA9IGtleVxuXHRyZXR1cm4gaFJlc3VsdFxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG5leHBvcnQgd2l0aG91dEtleXMgOj0gKFxuXHRcdGg6IGhhc2gsXG5cdFx0Li4ubEtleXM6IHN0cmluZ1tdXG5cdFx0KTogaGFzaCA9PlxuXG5cdGhOZXc6IGhhc2ggOj0ge31cblx0Zm9yIGtleSBvZiBrZXlzKGgpXG5cdFx0aWYgbm90IGxLZXlzLmluY2x1ZGVzKGtleSlcblx0XHRcdGhOZXdba2V5XSA9IGhba2V5XVxuXHRyZXR1cm4gaE5ld1xuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG50eXBlIFRLZXlWYWwgPSBba2V5OiBzdHJpbmcsIHZhbDogYW55XVxuXG5leHBvcnQgd2l0aEtleVZhbHMgOj0gKFxuXHRcdGg6IGhhc2gsXG5cdFx0Li4ubEtleVZhbHM6IFRLZXlWYWxbXVxuXHRcdCk6IGhhc2ggPT5cblxuXHRoTmV3OiBoYXNoIDo9IHt9XG5cdGZvciBrIG9mIGtleXMoaClcblx0XHRoTmV3W2tdID0gaFtrXVxuXHRmb3IgcGFpciBvZiBsS2V5VmFsc1xuXHRcdFtrZXksIHZhbF0gOj0gcGFpclxuXHRcdGhOZXdba2V5XSA9IHZhbFxuXHRyZXR1cm4gaE5ld1xuXG5leHBvcnQgd2l0aEtleVZhbCA9IHdpdGhLZXlWYWxzXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogYnkgZGVmYXVsdCwgcmVwbGFjZSB0aGVzZSBjaGFyYWN0ZXJzOlxuICogICAgY2FycmlhZ2UgcmV0dXJuXG4gKiAgICBuZXdsaW5lXG4gKiAgICBUQUJcbiAqICAgIHNwYWNlXG4gKiBPcHRpb25hbGx5LCBhZGQgYSBjaGFyYWN0ZXIgdG8gaW5kaWNhdGUgYSBwYXJ0aWN1bGFyXG4gKiBwb3NpdGlvbiBpbiB0aGUgc3RyaW5nXG4gKiBWYWxpZCBvcHRpb25zOlxuICogICAgb2Zmc2V0IC0gaW5kaWNhdGUgcG9zaXRpb24gb2Ygb2Zmc2V0XG4gKiAgICBwb3NjaGFyIC0gY2hhciB0byB1c2UgdG8gaW5kaWNhdGUgcG9zaXRpb25cbiAqL1xuXG5oRGVidWdSZXBsYWNlOiBoYXNoIDo9IHtcblx0XCJcXHJcIjogJ+KGkCdcblx0XCJcXG5cIjogJ+KGkydcblx0XCJcXHRcIjogJ+KGkidcblx0XCIgXCI6ICAny7MnXG5cdH1cblxuaENSZXBsYWNlOiBoYXNoIDo9IHtcblx0XCJcXHJcIjogJ1xcXFxyJ1xuXHRcIlxcblwiOiAnXFxcXG4nXG5cdFwiXFx0XCI6ICdcXFxcdCdcblx0fVxuXG5leHBvcnQgZXNjYXBlU3RyIDo9IChcblx0XHRzdHI6IHN0cmluZ1xuXHRcdGhPcHRpb25zOiBoYXNoID0ge31cblx0XHQpOiBzdHJpbmcgPT5cblxuXHR7XG5cdFx0c3R5bGUsIGhSZXBsYWNlLCBibG9jaywgb2Zmc2V0LCBwb3NjaGFyXG5cdFx0fSA6PSBnZXRPcHRpb25zIGhPcHRpb25zLCB7XG5cdFx0XHRzdHlsZTogJ2RlYnVnJ1xuXHRcdFx0aFJlcGxhY2U6IHVuZGVmXG5cdFx0XHRibG9jazogZmFsc2Vcblx0XHRcdG9mZnNldDogdW5kZWZcblx0XHRcdHBvc2NoYXI6ICfilIonXG5cdFx0XHR9XG5cblx0bGV0IGhSZWFsUmVwbGFjZTogaGFzaCA9IHt9XG5cdGlmIGRlZmluZWQoaFJlcGxhY2UpXG5cdFx0aFJlYWxSZXBsYWNlID0gaFJlcGxhY2Vcblx0ZWxzZSBpZiAoc3R5bGUgPT0gJ0MnKVxuXHRcdGlmIGJsb2NrXG5cdFx0XHRoUmVhbFJlcGxhY2UgPSB3aXRob3V0S2V5cyhoQ1JlcGxhY2UsICdcXG4nLCAnXFxyJylcblx0XHRlbHNlXG5cdFx0XHRoUmVhbFJlcGxhY2UgPSBoQ1JlcGxhY2Vcblx0ZWxzZVxuXHRcdGlmIGJsb2NrXG5cdFx0XHRoUmVhbFJlcGxhY2UgPSB3aXRob3V0S2V5cyhoRGVidWdSZXBsYWNlLCAnXFxuJywgJ1xccicpXG5cdFx0ZWxzZVxuXHRcdFx0aFJlYWxSZXBsYWNlID0gaERlYnVnUmVwbGFjZVxuXG5cdGxQYXJ0czogc3RyaW5nW10gOj0gW11cblx0Zm9yIGNoLGkgb2Ygc3RyXG5cdFx0aWYgKGkgPT0gb2Zmc2V0KVxuXHRcdFx0bFBhcnRzLnB1c2ggcG9zY2hhclxuXHRcdGxQYXJ0cy5wdXNoIChoUmVhbFJlcGxhY2VbY2hdIHx8IGNoKVxuXHRpZiAob2Zmc2V0ID09IHN0ci5sZW5ndGgpXG5cdFx0bFBhcnRzLnB1c2ggcG9zY2hhclxuXHRyZXR1cm4gbFBhcnRzLmpvaW4oJycpXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbmV4cG9ydCB1bmVzY2FwZVN0ciA6PSAoXG5cdFx0c3RyOiBzdHJpbmdcblx0XHRoT3B0aW9uczogaGFzaCA9IHt9XG5cdFx0KTogc3RyaW5nID0+XG5cblx0e3N0eWxlLCBoUmVwbGFjZX0gOj0gZ2V0T3B0aW9ucyBoT3B0aW9ucywge1xuXHRcdHN0eWxlOiAnQydcblx0XHRoUmVwbGFjZTogdW5kZWZcblx0XHR9XG5cblx0bGV0IGhSZWFsUmVwbGFjZTogaGFzaCA9IHt9XG5cdGlmIGRlZmluZWQoaFJlcGxhY2UpXG5cdFx0aFJlYWxSZXBsYWNlID0gaFJlcGxhY2Vcblx0ZWxzZVxuXHRcdGlmIChzdHlsZSA9PSAnZGVidWcnKVxuXHRcdFx0aFJlYWxSZXBsYWNlID0ge1xuXHRcdFx0XHQn4oaQJzogJydcblx0XHRcdFx0J+KGkyc6ICdcXG4nXG5cdFx0XHRcdCfihpInOiAnXFx0J1xuXHRcdFx0XHQny7MnOiAnICdcblx0XHRcdFx0fVxuXHRcdGVsc2Vcblx0XHRcdGhSZWFsUmVwbGFjZSA9IHtcblx0XHRcdFx0J24nOiAnXFxuJ1xuXHRcdFx0XHQncic6ICcnICAgICAjIGNhcnJpYWdlIHJldHVybiBzaG91bGQganVzdCBkaXNhcHBlYXJcblx0XHRcdFx0J3QnOiAnXFx0J1xuXHRcdFx0XHR9XG5cblx0bGV0IGVzYyA9IGZhbHNlXG5cdGxQYXJ0czogc3RyaW5nW10gOj0gW11cblx0Zm9yIGNoLGkgb2Ygc3RyXG5cdFx0aWYgKGNoID09ICdcXFxcJylcblx0XHRcdGlmIGVzY1xuXHRcdFx0XHRsUGFydHMucHVzaCAnXFxcXCdcblx0XHRcdFx0ZXNjID0gZmFsc2Vcblx0XHRcdGVsc2Vcblx0XHRcdFx0ZXNjID0gdHJ1ZVxuXHRcdGVsc2Vcblx0XHRcdGlmIGVzY1xuXHRcdFx0XHRpZiBkZWZpbmVkKGhSZWFsUmVwbGFjZVtjaF0pXG5cdFx0XHRcdFx0bFBhcnRzLnB1c2ggaFJlYWxSZXBsYWNlW2NoXVxuXHRcdFx0XHRlbHNlXG5cdFx0XHRcdFx0bFBhcnRzLnB1c2ggY2hcblx0XHRcdFx0ZXNjID0gZmFsc2Vcblx0XHRcdGVsc2Vcblx0XHRcdFx0bFBhcnRzLnB1c2ggY2hcblx0cmV0dXJuIGxQYXJ0cy5qb2luKCcnKVxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKipcbiAqIGRvbid0IGVzY2FwZSBuZXdsaW5lIG9yIGNhcnJpYWdlIHJldHVyblxuICogT3B0aW9uYWxseSwgYWRkIGEgY2hhcmFjdGVyIHRvIGluZGljYXRlIGEgcGFydGljdWxhclxuICogcG9zaXRpb24gaW4gdGhlIHN0cmluZ1xuICovXG5cbmV4cG9ydCBlc2NhcGVCbG9jayA6PSAoXG5cdGJsb2NrOiBzdHJpbmcsXG5cdGhPcHRpb25zOiBoYXNoID0ge31cblx0KTogc3RyaW5nID0+XG5cblx0cmV0dXJuIGVzY2FwZVN0cihibG9jaywgd2l0aEtleVZhbChoT3B0aW9ucywgWydibG9jaycsIHRydWVdKSlcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuZXhwb3J0IHJlbHBhdGggOj0gKHBhdGg6IHN0cmluZyk6IHN0cmluZyA9PlxuXG5cdHJldHVybiByZWxhdGl2ZShEZW5vLmN3ZCgpLCBwYXRoKS5yZXBsYWNlQWxsKCdcXFxcJywgJy8nKVxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKipcbiAqIFNwbGl0cyBhIHN0cmluZyBvbiB3aGl0ZXNwYWNlIGludG8gYW4gYXJyYXksXG4gKiBpZ25vcmluZyBhbnkgbGVhZGluZyBvciB0cmFpbGluZyB3aGl0ZXNwYWNlXG4gKi9cblxuZXhwb3J0IHdzU3BsaXQgOj0gKHN0cjogc3RyaW5nKTogc3RyaW5nW10gPT5cblxuXHRuZXdzdHIgOj0gc3RyLnRyaW0oKVxuXHRpZiAobmV3c3RyID09ICcnKVxuXHRcdHJldHVybiBbXVxuXHRlbHNlXG5cdFx0cmV0dXJuIG5ld3N0ci5zcGxpdCgvXFxzKy8pXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogc3BsaXRzIGVhY2ggc3RyaW5nIG9uIHdoaXRlc3BhY2UgaWdub3JpbmcgYW55IGxlYWRpbmdcbiAqIG9yIHRyYWlsaW5nIHdoaXRlc3BhY2UsIGFuZCByZXR1cm5zIGFuIGFycmF5IG9mXG4gKiBhbGwgc3Vic3RyaW5ncyBvYnRhaW5lZFxuICovXG5cbmV4cG9ydCB3b3JkcyA6PSAoLi4ubFN0cmluZ3M6IHN0cmluZ1tdKTogc3RyaW5nW10gPT5cblxuXHRsZXQgbFdvcmRzID0gW11cblx0Zm9yIHN0ciBvZiBsU3RyaW5nc1xuXHRcdGZvciB3b3JkIG9mIHdzU3BsaXQoc3RyKVxuXHRcdFx0bFdvcmRzLnB1c2ggd29yZFxuXHRyZXR1cm4gbFdvcmRzXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogY2FsY3VsYXRlcyB0aGUgbnVtYmVyIG9mIGV4dHJhIGNoYXJhY3RlcnMgbmVlZGVkIHRvXG4gKiBtYWtlIHRoZSBnaXZlbiBzdHJpbmcgaGF2ZSB0aGUgZ2l2ZW4gbGVuZ3RoLlxuICogSWYgbm90IHBvc3NpYmxlLCByZXR1cm5zIDBcbiAqL1xuXG5leHBvcnQgZ2V0TkV4dHJhIDo9IChzdHI6IHN0cmluZywgbGVuOiBudW1iZXIpOiBudW1iZXIgPT5cblxuXHRleHRyYSA6PSBsZW4gLSBzdHIubGVuZ3RoXG5cdHJldHVybiAoZXh0cmEgPiAwKSA/IGV4dHJhIDogMFxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKipcbiAqIHBhZHMgdGhlIGdpdmVuIHN0cmluZyBvbiB0aGUgcmlnaHQgd2l0aFxuICogdGhlIGdpdmVuIGNoYXJhY3RlciwgdG8gdGhlIGdpdmVuIGxlbmd0aFxuICovXG5cbmV4cG9ydCBycGFkIDo9IChzdHI6IHN0cmluZywgbGVuOiBudW1iZXIsIGNoOiBzdHJpbmc9JyAnKTogc3RyaW5nID0+XG5cblx0YXNzZXJ0IChjaC5sZW5ndGggPT0gMSksIFwiTm90IGEgY2hhclwiXG5cdGV4dHJhIDo9IGdldE5FeHRyYShzdHIsIGxlbilcblx0cmV0dXJuIHN0ciArIGNoLnJlcGVhdChleHRyYSlcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuLyoqXG4gKiBwYWRzIHRoZSBnaXZlbiBzdHJpbmcgb24gdGhlIGxlZnQgd2l0aFxuICogdGhlIGdpdmVuIGNoYXJhY3RlciwgdG8gdGhlIGdpdmVuIGxlbmd0aFxuICovXG5cbmV4cG9ydCBscGFkIDo9IChzdHI6IHN0cmluZywgbGVuOiBudW1iZXIsIGNoOiBzdHJpbmc9JyAnKTogc3RyaW5nID0+XG5cblx0YXNzZXJ0IChjaC5sZW5ndGggPT0gMSksIFwiTm90IGEgY2hhclwiXG5cdGV4dHJhIDo9IGdldE5FeHRyYShzdHIsIGxlbilcblx0cmV0dXJuIGNoLnJlcGVhdChleHRyYSkgKyBzdHJcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiMgLS0tIHZhbGlkIG9wdGlvbnM6XG4jICAgICAgICBjaGFyIC0gY2hhciB0byB1c2Ugb24gbGVmdCBhbmQgcmlnaHRcbiMgICAgICAgIGJ1ZmZlciAtIG51bSBzcGFjZXMgYXJvdW5kIHRleHQgd2hlbiBjaGFyIDw+ICcgJ1xuXG4vKipcbiAqIHBhZHMgdGhlIGdpdmVuIHN0cmluZyBvbiBib3RoIHRoZSBsZWZ0IGFuZCByaWdodFxuICogd2l0aCB0aGUgZ2l2ZW4gY2hhcmFjdGVyLCB0byB0aGUgZ2l2ZW4gbGVuZ3RoXG4gKiBidXQgd2l0aCB0aGUgZ2l2ZW4gbnVtYmVyIG9mIGJ1ZmZlciBjaGFycyBzdXJyb3VuZGluZ1xuICogdGhlIHRleHRcbiAqL1xuXG5leHBvcnQgY2VudGVyZWQgOj0gKFxuXHR0ZXh0OiBzdHJpbmcsXG5cdHdpZHRoOiBudW1iZXIsXG5cdGNoYXI6IHN0cmluZyA9ICcgJyxcblx0bnVtQnVmZmVyOiBudW1iZXIgPSAyXG5cdCk6IHN0cmluZyA9PlxuXG5cdHRvdFNwYWNlcyA6PSB3aWR0aCAtIHRleHQubGVuZ3RoXG5cdGlmICh0b3RTcGFjZXMgPD0gMClcblx0XHRyZXR1cm4gdGV4dFxuXHRudW1MZWZ0IDo9IE1hdGguZmxvb3IodG90U3BhY2VzIC8gMilcblx0bnVtUmlnaHQgOj0gdG90U3BhY2VzIC0gbnVtTGVmdFxuXHRpZiAoY2hhciA9PSAnICcpXG5cdFx0cmV0dXJuIHNwYWNlcyhudW1MZWZ0KSArIHRleHQgKyBzcGFjZXMobnVtUmlnaHQpXG5cdGVsc2Vcblx0XHRidWYgOj0gJyAnLnJlcGVhdChudW1CdWZmZXIpXG5cdFx0bGVmdCA6PSBjaGFyLnJlcGVhdChudW1MZWZ0IC0gbnVtQnVmZmVyKVxuXHRcdHJpZ2h0IDo9IGNoYXIucmVwZWF0KG51bVJpZ2h0IC0gbnVtQnVmZmVyKVxuXHRcdHJldHVybiBsZWZ0ICsgYnVmICsgdGV4dCArIGJ1ZiArIHJpZ2h0XG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogcGFkIGEgc3RyaW5nIG9uIHRoZSBsZWZ0LCByaWdodCwgb3IgYm90aFxuICogdG8gdGhlIGdpdmVuIHdpZHRoXG4gKi9cblxuZXhwb3J0IHR5cGUgVEFsaWdubWVudCA9ICdsJ3wnYyd8J3InfCdsZWZ0J3wnY2VudGVyJ3wncmlnaHQnXG5cbmV4cG9ydCBpc0FsaWdubWVudCA6PSAoeDogYW55KTogeCBpcyBUQWxpZ25tZW50ID0+XG5cblx0cmV0dXJuIFsnbCcsJ2MnLCdyJywnbGVmdCcsJ2NlbnRlcicsJ3JpZ2h0J10uaW5jbHVkZXMoeClcblxuZXhwb3J0IGFsaWduU3RyaW5nIDo9IChcblx0c3RyOiBzdHJpbmcsXG5cdHdpZHRoOiBudW1iZXIsXG5cdGFsaWduOiBUQWxpZ25tZW50XG5cdCk6IHN0cmluZyAtPlxuXG5cdHN3aXRjaCBhbGlnblxuXHRcdHdoZW4gJ2xlZnQnLCAnbCdcblx0XHRcdHJldHVybiBycGFkKHN0ciwgd2lkdGgpXG5cdFx0d2hlbiAnY2VudGVyJywgJ2MnXG5cdFx0XHRyZXR1cm4gY2VudGVyZWQoc3RyLCB3aWR0aClcblx0XHR3aGVuICdyaWdodCcsICdyJ1xuXHRcdFx0cmV0dXJuIGxwYWQoc3RyLCB3aWR0aClcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuLyoqXG4gKiBjb252ZXJ0cyB0aGUgZ2l2ZW4gbnVtYmVyIHRvIGEgc3RyaW5nLCB0aGVuIHBhZHMgb24gdGhlIGxlZnRcbiAqIHdpdGggemVyb3MgdG8gYWNoaWV2ZSB0aGUgZ2l2ZW4gbGVuZ3RoXG4gKi9cblxuZXhwb3J0IHpwYWQgOj0gKG46IG51bWJlciwgbGVuOiBudW1iZXIpOiBzdHJpbmcgPT5cblxuXHRyZXR1cm4gbHBhZChuLnRvU3RyaW5nKCksIGxlbiwgJzAnKVxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuIyBHRU5FUkFUT1JcblxuZXhwb3J0IGFsbE1hdGNoZXMgOj0gKHN0cjogc3RyaW5nLCByZTogUmVnRXhwKTogR2VuZXJhdG9yPHN0cmluZ1tdLCB2b2lkLCB2b2lkPiAtPlxuXG5cdCMgLS0tIEVuc3VyZSB0aGUgcmVnZXggaGFzIHRoZSBnbG9iYWwgZmxhZyAoZykgc2V0XG5cdG5ld3JlIDo9IG5ldyBSZWdFeHAocmUsIHJlLmZsYWdzICsgKHJlLmZsYWdzLmluY2x1ZGVzKCdnJykgPyAnJyA6ICdnJykpXG5cdGxldCBsTWF0Y2hlczogc3RyaW5nW10gfCBudWxsID0gbnVsbFxuXHR3aGlsZSBkZWZpbmVkKGxNYXRjaGVzID0gbmV3cmUuZXhlYyhzdHIpKVxuICBcdFx0eWllbGQgbE1hdGNoZXNcblx0cmV0dXJuXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogQSBnZW5lcmF0b3IgdGhhdCB5aWVsZHMgaW50ZWdlcnMgc3RhcnRpbmcgd2l0aCAwIGFuZFxuICogY29udGludWluZyB0byBuLTFcbiAqL1xuXG5leHBvcnQgcmFuZ2UgOj0gKFxuXHRuOiBudW1iZXJcblx0KTogR2VuZXJhdG9yPG51bWJlciwgdm9pZCwgdm9pZD4gLT5cblxuXHRsZXQgaSA9IDBcblx0d2hpbGUgKGkgPCBuKVxuXHRcdHlpZWxkIGlcblx0XHRpID0gaSArIDFcblx0cmV0dXJuXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbmV4cG9ydCBjbGFzcyBGZXRjaGVyPFQ+XG5cblx0aXRlcjogSXRlcmF0b3I8VD5cblx0YnVmZmVyOiBUPyA9IHVuZGVmXG5cblx0Y29uc3RydWN0b3IoQGl0ZXI6IEl0ZXJhdG9yPFQ+LCBAZW9mVmFsdWU6IFQpXG5cblx0cGVlaygpOiBUXG5cdFx0aWYgZGVmaW5lZChAYnVmZmVyKVxuXHRcdFx0cmV0dXJuIEBidWZmZXJcblx0XHRlbHNlXG5cdFx0XHR7dmFsdWUsIGRvbmV9IDo9IEBpdGVyLm5leHQoKVxuXHRcdFx0aWYgZG9uZVxuXHRcdFx0XHRyZXR1cm4gQGVvZlZhbHVlXG5cdFx0XHRlbHNlXG5cdFx0XHRcdEBidWZmZXIgPSB2YWx1ZVxuXHRcdFx0XHRyZXR1cm4gdmFsdWVcblxuXHRnZXQoZXhwZWN0ZWQ6IFQ/PXVuZGVmKTogVFxuXHRcdGxldCByZXN1bHQ6IFQgPSBAZW9mVmFsdWVcblx0XHRpZiBkZWZpbmVkKEBidWZmZXIpXG5cdFx0XHRyZXN1bHQgPSBAYnVmZmVyXG5cdFx0XHRAYnVmZmVyID0gdW5kZWZcblx0XHRlbHNlXG5cdFx0XHR7dmFsdWUsIGRvbmV9IDo9IEBpdGVyLm5leHQoKVxuXHRcdFx0cmVzdWx0ID0gZG9uZSA/IEBlb2ZWYWx1ZSA6IHZhbHVlXG5cdFx0aWYgZGVmaW5lZChleHBlY3RlZClcblx0XHRcdGFzc2VydCBkZWVwRXF1YWwocmVzdWx0LCBleHBlY3RlZCksXG5cdFx0XHRcdFx0XCIje09MKGV4cGVjdGVkKX0gZXhwZWN0ZWRcIlxuXHRcdHJldHVybiByZXN1bHRcblxuXHRza2lwKGV4cGVjdGVkOiBUPz11bmRlZik6IHZvaWRcblx0XHRAZ2V0KGV4cGVjdGVkKVxuXHRcdHJldHVyblxuXG5cdGF0RW5kKCk6IGJvb2xlYW5cblx0XHRpZiBkZWZpbmVkKEBidWZmZXIpXG5cdFx0XHRyZXR1cm4gZmFsc2Vcblx0XHRlbHNlXG5cdFx0XHR7dmFsdWUsIGRvbmV9IDo9IEBpdGVyLm5leHQoKVxuXHRcdFx0aWYgZG9uZSB8fCAodmFsdWUgPT0gQGVvZlZhbHVlKVxuXHRcdFx0XHRyZXR1cm4gdHJ1ZVxuXHRcdFx0ZWxzZVxuXHRcdFx0XHRAYnVmZmVyID0gdmFsdWVcblx0XHRcdFx0cmV0dXJuIGZhbHNlXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbmV4cG9ydCBhc3NlcnRTYW1lU3RyIDo9IChcblx0XHRzdHIxOiBzdHJpbmcsXG5cdFx0c3RyMjogc3RyaW5nXG5cdFx0KTogdm9pZCA9PlxuXG5cdGlmIChzdHIxICE9IHN0cjIpXG5cdFx0Y29uc29sZS5sb2cgY2VudGVyZWQoXCJTdHJpbmdzIERpZmZlcjpcIiwgNjQsICctJylcblx0XHRjb25zb2xlLmxvZyBjZW50ZXJlZChcInN0cmluZyAxXCIsIDY0LCAnLScpXG5cdFx0Y29uc29sZS5sb2cgc3RyMVxuXHRcdGNvbnNvbGUubG9nIGNlbnRlcmVkKFwic3RyaW5nIDJcIiwgNjQsICctJylcblx0XHRjb25zb2xlLmxvZyBzdHIyXG5cdFx0Y29uc29sZS5sb2cgJy0nLnJlcGVhdCg2NClcblxuXHRhc3NlcnQgKHN0cjEgPT0gc3RyMiksIFwic3RyaW5ncyBkaWZmZXJcIlxuXHRyZXR1cm5cblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuZXhwb3J0IGludGVycG9sYXRlIDo9IChcblx0XHRzdHI6IHN0cmluZ1xuXHRcdGhSZXBsYWNlOiBoYXNob2Y8c3RyaW5nPiAgICMgLS0tIHsgPHRhZz46IDxyZXBsYWNlbWVudD4sIC4uLiB9XG5cdFx0KTogc3RyaW5nID0+XG5cblx0Zm9yIGtleSBvZiBPYmplY3Qua2V5cyhoUmVwbGFjZSlcblx0XHRhc3NlcnQgKGtleVswXSA9PSAnJCcpLCBcImFsbCBrZXlzIG11c3Qgc3RhcnQgd2l0aCAnJCdcIlxuXHRyZSA6PSAvLy9cblx0XHRcXCRcblx0XHQoPzpbQS1aYS16XVtBLVphLXowLTldKilcblx0XHQvLy9nXG5cdHJldHVybiBzdHIucmVwbGFjZUFsbChyZSwgKG1hdGNoOiBzdHJpbmcpID0+XG5cdFx0cmV0dXJuIGhSZXBsYWNlW21hdGNoXSB8fCBtYXRjaFxuXHRcdClcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuZXhwb3J0IHJlcXVpcmUgOj0gZ2V0SW1wb3J0U3luYyhpbXBvcnQubWV0YS51cmwpXG4iXX0=