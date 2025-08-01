"use strict";
// llutils.lib.civet

type AutoPromise<T> = Promise<Awaited<T>>;
import {createRequire} from "node:module"
import {sprintf} from "@std/fmt/printf"
import {relative} from '@std/path'

import {
	undef, defined, notdefined, assert, char, deepEqual,
	isHash, isArray, isNonEmptyString, isArrayOfStrings,
	isEmpty, nonEmpty, isString, isObject, isInteger,
	integer, hash, hashof, array, arrayof, voidFunc,
	isNonPrimitive, functionDef, croak,
	} from 'datatypes'

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

export const truncStr = (str: string, len: number) => {

	if (str.length <= len) {
		return str
	}
	return str.substring(0, len-3) + '...'
}

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

	type opt = {
		oneLine: boolean
		compress: boolean
		trunc: number
		}
	const {oneLine, compress, trunc
		} = getOptions<opt>(hOptions, {
		oneLine: false,
		compress: true,
		trunc: 0
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

	if (isInteger(trunc) && (trunc > 0)) {
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
 * returns a hash of options with their values,
 * - adding any default values from hDefaults
 *   if they're missing
 */

export const getOptions = <T extends hash,>(
		hOptions: hash={},
		hDefaults: T
		): T => {

	return {...hDefaults, ...hOptions}
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
 * with possible exceptions
 */

export const keys = (obj: hash, hOptions: hash={}): string[] => {

	type opt = {
		lExcept: string[]
		}
	const {lExcept} = getOptions<opt>(hOptions, {
		lExcept: []
		})

	const lKeys: string[] = []
	for (const key of Object.keys(obj)) {
		if (!lExcept.includes(key)) {
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

const hDebugReplace: hashof<string> = {
	"\r": '←',
	"\n": '↓',
	"\t": '→',
	" ":  '˳'
	}

const hDebugNoNewlineReplace: hashof<string> = {
	"\t": '→',
	" ":  '˳'
	}

const hCReplace: hashof<string> = {
	"\r": '\\r',
	"\n": '\\n',
	"\t": '\\t'
	}

const hCNoNewlineReplace: hashof<string> = {
	"\t": '\\t'
	}

export const escapeStr = (
		str: string,
		hOptions: hash = {}
		): string => {

	type opt = {
		style: string
		hReplace: hashof<string>
		block: boolean
		offset: (number | undefined)
		range: ((number[]) | undefined)      // --- can be [int, int]
		poschar: char
		beginchar: char
		endchar: char
		}
	const {
		style, hReplace, block, offset, poschar,
		beginchar, endchar
		} = getOptions<opt>(hOptions, {
			style: 'debug',
			hReplace: {},
			block: false,
			offset: undef,
			range: undef,      // --- can be [int, int]
			poschar: '┊',
			beginchar: '⟨',
			endchar: '⟩'
			})

	let hRealReplace: hashof<string> = {}
	if (nonEmpty(hReplace)) {
		hRealReplace = hReplace
	}
	else if (style === 'C') {
		if (block) {
			hRealReplace = hCNoNewlineReplace
		}
		else {
			hRealReplace = hCReplace
		}
	}
	else {
		if (block) {
			hRealReplace = hDebugNoNewlineReplace
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

	type opt = {
		style: string
		hReplace: hashof<string>
		}
	const {style, hReplace} = getOptions<opt>(hOptions, {
		style: 'C',
		hReplace: {}
		})

	let hRealReplace: hashof<string> = {}
	if (nonEmpty(hReplace)) {
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

	hOptions.block = true
	return escapeStr(block, hOptions)
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

	for (const key of keys(hReplace)) {
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

// ---------------------------------------------------------------------------

export const getLineAndColumn = (text: string, pos: number) => {

	// --- Get line number by counting number of \n chars
	//        before the current position
	//     Get column number by finding closest previous position
	//        of a \n and computing the difference

	const shortStr = text.substring(0, pos)
	return [
		countChars(shortStr, "\n") + 1,
		pos - shortStr.lastIndexOf('\n')
		]
}

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3JjL2xpYi9sbHV0aWxzLmxpYi5jaXZldC50c3giLCJzb3VyY2VzIjpbInNyYy9saWIvbGx1dGlscy5saWIuY2l2ZXQiXSwibWFwcGluZ3MiOiI7QUFBQSxvQkFBbUI7QUFDbkIsQUFBQTtBQUNBLEssVyx5QjtBQUFBLE1BQU0sQ0FBQyxDQUFDLGFBQWEsQ0FBQyxDQUFDLElBQUksQ0FBQyxhQUFhO0FBQ3pDLEFBQUEsQUFBQSxNQUFNLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxJQUFJLENBQUMsaUJBQWlCO0FBQ3ZDLEFBQUEsQUFBQSxNQUFNLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxJQUFJLENBQUMsV0FBVztBQUNsQyxBQUFBO0FBQ0EsQUFBQSxBQUFBLE1BQU0sQ0FBQyxDQUFDO0FBQ1IsQ0FBQyxLQUFLLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxTQUFTLENBQUM7QUFDckQsQ0FBQyxNQUFNLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDLGdCQUFnQixDQUFDO0FBQ3JELENBQUMsT0FBTyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsU0FBUyxDQUFDO0FBQ2xELENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsUUFBUSxDQUFDO0FBQ2pELENBQUMsY0FBYyxDQUFDLENBQUMsV0FBVyxDQUFDLENBQUMsS0FBSyxDQUFDO0FBQ3BDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxXQUFXO0FBQ25CLEFBQUE7QUFDQSxBQUFBO0FBQ0E7QUFDQSxHQUFHO0FBQ0gsQUFBQTtBQUNBLEFBQUEsQUFBd0IsTUFBeEIsZUFBZSxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUUsQ0FBQyxJQUFJLENBQUMsR0FB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QyxDQUFDLEVBQUUsQ0FBQSxDQUFBO0FBQ2hELEFBQUE7QUFDQSxBQUFBLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFBLENBQUE7QUFDdkIsQUFBQSxFQUFFLE1BQU0sQ0FBQyxHO0NBQUcsQ0FBQTtBQUNaLEFBQUEsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEs7QUFBSyxDQUFBO0FBQ3ZDLEFBQUE7QUFDQSxBQUFBLDhFQUE2RTtBQUM3RSxBQUFBO0FBQ0EsQUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLEdBQUc7QUFDSCxBQUFBO0FBQ0EsQUFBQSxBQUFBLE1BQU0sQ0FBVSxNQUFULFNBQVMsQ0FBQyxDQUFFLENBQUMsQ0FBQztBQUNyQixBQUFBLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDO0FBQ1IsQUFBQSxDQUFDLFFBQVEsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUNsQixBQUFBLENBQUMsS0FBSyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUM7QUFDaEIsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFBLENBQUE7QUFDYixBQUFBO0FBQ0EsQUFBQSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDYixBQUFBLEVBQUUsT0FBTyxDQUFDLENBQUMsT0FBTztBQUNsQixBQUFBLEVBQUUsUUFBUSxDQUFDLENBQUMsT0FBTztBQUNuQixBQUFBLEVBQUUsS0FBSyxDQUFDLENBQUMsTUFBTTtBQUNmLEVBQUUsQ0FBQztBQUNILEFBQUEsQ0FDRyxNQURGLENBQUMsT0FBTyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsS0FBSztBQUMxQixFQUFFLENBQUMsQ0FBQyxDQUFFLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxDQUFBLEFBQUMsUUFBUSxDQUFDLENB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QUFjLEVBQUUsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUE7QUFDdEQsQUFBQSxDQUFTLE1BQVIsUUFBUSxDQUFDLENBQUUsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLFlBQVksQ0FBQztBQUNyQyxBQUFBLENBQUMsTUFBTSxDQUFDLENBQUMsUUFBUSxDQUFDLEdBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDO0FBQUMsQ0FBQTtBQUMvQyxBQUFBO0FBQ0EsQUFBQSw4RUFBNkU7QUFDN0UsQUFBQTtBQUNBLEFBQUE7QUFDQTtBQUNBLEdBQUc7QUFDSCxBQUFBO0FBQ0EsQUFBQSxBQUFBLE1BQU0sQ0FBVyxNQUFWLFVBQVUsQ0FBQyxDQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUEsQ0FBQTtBQUN6RCxBQUFBO0FBQ0EsQUFBQSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDZCxBQUFBLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ2IsQUFBQSxDQUFDLEtBQUssQ0FBQyxDQUFBLENBQUMsR0FBRyxDLENBQUUsQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQSxDQUFBLENBQUE7QUFDM0MsQUFBQSxFQUFFLEtBQUssQyxFQUFHLENBQUMsQztDQUFDLENBQUE7QUFDWixBQUFBLENBQUMsTUFBTSxDQUFDLEs7QUFBSyxDQUFBO0FBQ2IsQUFBQTtBQUNBLEFBQUEsOEVBQTZFO0FBQzdFLEFBQUE7QUFDQSxBQUFBO0FBQ0E7QUFDQTtBQUNBLEdBQUc7QUFDSCxBQUFBO0FBQ0EsQUFBQSxBQUFBLE1BQU0s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QUMsTUFBTSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFBLENBQUE7QUFDekQsQUFBQTtBQUNBLEFBQUEsQ0FBTSxNQUFMLEtBQUssQ0FBQyxDQUFFLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsTUFBTTtBQUMxQixBQUFBLENBQUMsTUFBTSxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDO0FBQUMsQ0FBQTtBQUMvQixBQUFBO0FBQ0EsQUFBQSw4RUFBNkU7QUFDN0UsQUFBQTtBQUNBLEFBQUE7QUFDQTtBQUNBO0FBQ0EsR0FBRztBQUNILEFBQUE7QUFDQSxBQUFBLEFBQUEsTUFBTSxDQUFLLE1BQUosSUFBSSxDQUFDLENBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUEsQ0FBQTtBQUNwRSxBQUFBO0FBQ0EsQUFBQSxDQUFDLE1BQU0sQ0FBQSxBQUFDLENBQUMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxHQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxZQUFZLENBQUE7QUFDdEMsQUFBQSxDQUFNLE1BQUwsS0FBSyxDQUFDLENBQUUsQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBRyxDQUFDO0FBQzdCLEFBQUEsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsTUFBTSxDQUFDLEtBQUssQztBQUFDLENBQUE7QUFDOUIsQUFBQTtBQUNBLEFBQUEsOEVBQTZFO0FBQzdFLEFBQUE7QUFDQSxBQUFBO0FBQ0E7QUFDQTtBQUNBLEdBQUc7QUFDSCxBQUFBO0FBQ0EsQUFBQSxBQUFBLE1BQU0s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LEtBQUs7QUFDbkIsQUFBQSxJQUFJLE1BQU0sQ0FBQyxLO0dBQUssQztFQUFBLEM7Q0FBQSxDQUFBO0FBQ2hCLEFBQUE7QUFDQSxBQUFBLEMsR0FBSSxDQUFDLFFBQVEsQyxDLENBQUMsQUFBQyxDLFksQ0FBRSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFBLENBQUE7QUFDM0IsQUFBQSxFQUFFLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEksQ0FBQyxRQUFRO0FBQzNCLEFBQUEsRUFBRSxHQUFHLENBQUEsT0FBTyxDQUFDLEksQ0FBQyxNQUFNLENBQUMsQ0FBQSxDQUFBLENBQUE7QUFDckIsQUFBQSxHQUFHLE1BQU0sQyxDQUFFLENBQUMsSSxDQUFDLE1BQU07QUFDbkIsQUFBQSxHQUFHLEksQ0FBQyxNQUFNLEMsQ0FBRSxDQUFDLEs7RUFBSyxDQUFBO0FBQ2xCLEFBQUEsRUFBRSxJQUFJLENBQUEsQ0FBQTtBQUNOLEFBQUEsR0FBZ0IsTUFBYixDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUUsQ0FBQyxJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQ2hDLEFBQUEsR0FBRyxNQUFNLEMsQ0FBRSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsSztFQUFLLENBQUE7QUFDcEMsQUFBQSxFQUFFLEdBQUcsQ0FBQSxPQUFPLENBQUMsUUFBUSxDQUFDLENBQUEsQ0FBQSxDQUFBO0FBQ3RCLEFBQUEsR0FBRyxNQUFNLENBQUEsQUFBQyxTQUFTLENBQUMsTUFBTSxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUM7QUFDdEMsQUFBQSxLQUFLLENBQUMsRUFBRSxFQUFFLENBQUMsUUFBUSxDQUFDLENBQUMsU0FBUyxDQUFDLEM7RUFBQSxDQUFBO0FBQy9CLEFBQUEsRUFBRSxNQUFNLENBQUMsTTtDQUFNLENBQUE7QUFDZixBQUFBO0FBQ0EsQUFBQSxDLElBQUssQ0FBQyxRQUFRLEMs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Q0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxLO0FBQUssQ0FBQTtBQUN6QyxBQUFBO0FBQ0EsQUFBQSw4RUFBNkU7QUFDN0UsQUFBQTtBQUNBLEFBQUEsQUFBQSxNQUFNLENBQVEsTUFBUCxPQUFPLENBQUMsQ0FBRSxDQUFDLGFBQWEsQ0FBQyxXQUFXLENBQUMsR0FBRyxDQUFDO0FBQ2hELEFBQUE7QUFDQSxBQUFBLDhFQUE2RTtBQUM3RSxBQUFBO0FBQ0EsQUFBQSxBQUFBLE1BQU0sQ0FBaUIsTUFBaEIsZ0JBQWdCLENBQUMsQ0FBRSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFBLENBQUE7QUFDekQsQUFBQTtBQUNBLEFBQUEsQ0FBQyxxREFBb0Q7QUFDckQsQUFBQSxDQUFDLHFDQUFvQztBQUNyQyxBQUFBLENBQUMsNkRBQTREO0FBQzdELEFBQUEsQ0FBQyw4Q0FBNkM7QUFDOUMsQUFBQTtBQUNBLEFBQUEsQ0FBUyxNQUFSLFFBQVEsQ0FBQyxDQUFFLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUM7QUFDbkMsQUFBQSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0FBQ1QsQUFBQSxFQUFFLFVBQVUsQ0FBQyxRQUFRLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQ2hDLEFBQUEsRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDO0FBQ2xDLEFBQUEsRUFBRSxDO0FBQUMsQ0FBQTtBQUNIIiwibmFtZXMiOltdLCJzb3VyY2VzQ29udGVudCI6WyIjIGxsdXRpbHMubGliLmNpdmV0XHJcblxyXG5pbXBvcnQge2NyZWF0ZVJlcXVpcmV9IGZyb20gXCJub2RlOm1vZHVsZVwiXHJcbmltcG9ydCB7c3ByaW50Zn0gZnJvbSBcIkBzdGQvZm10L3ByaW50ZlwiXHJcbmltcG9ydCB7cmVsYXRpdmV9IGZyb20gJ0BzdGQvcGF0aCdcclxuXHJcbmltcG9ydCB7XHJcblx0dW5kZWYsIGRlZmluZWQsIG5vdGRlZmluZWQsIGFzc2VydCwgY2hhciwgZGVlcEVxdWFsLFxyXG5cdGlzSGFzaCwgaXNBcnJheSwgaXNOb25FbXB0eVN0cmluZywgaXNBcnJheU9mU3RyaW5ncyxcclxuXHRpc0VtcHR5LCBub25FbXB0eSwgaXNTdHJpbmcsIGlzT2JqZWN0LCBpc0ludGVnZXIsXHJcblx0aW50ZWdlciwgaGFzaCwgaGFzaG9mLCBhcnJheSwgYXJyYXlvZiwgdm9pZEZ1bmMsXHJcblx0aXNOb25QcmltaXRpdmUsIGZ1bmN0aW9uRGVmLCBjcm9hayxcclxuXHR9IGZyb20gJ2RhdGF0eXBlcydcclxuXHJcbi8qKlxyXG4gKiBAbW9kdWxlIGxsdXRpbHMgLSBsb3cgbGV2ZWwgdXRpbGl0aWVzXHJcbiAqL1xyXG5cclxubGx1dGlsc0xvYWRUaW1lOiBpbnRlZ2VyIDo9IERhdGUubm93KClcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbiMgLS0tIFNob3VsZCBiZSBjYWxsZWQgbGlrZTpcclxuIyAgICAgICAgcmVxdWlyZSA6PSBnZXRJbXBvcnRTeW5jKGltcG9ydC5tZXRhLnVybClcclxuXHJcbmV4cG9ydCBnZXRJbXBvcnRTeW5jIDo9ICh1cmw6IHN0cmluZyk6IEZ1bmN0aW9uID0+XHJcblxyXG5cdHJldHVybiBjcmVhdGVSZXF1aXJlKHVybClcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgc2luY2VMb2FkIDo9IChkYXRldGltZTogRGF0ZSB8IGludGVnZXIgPSBEYXRlLm5vdygpKSA9PlxyXG5cclxuXHRpZiAoZGF0ZXRpbWUgaW5zdGFuY2VvZiBEYXRlKVxyXG5cdFx0cmV0dXJuIGRhdGV0aW1lLnZhbHVlT2YoKSAtIGxsdXRpbHNMb2FkVGltZVxyXG5cdGVsc2VcclxuXHRcdHJldHVybiBkYXRldGltZSAtIGxsdXRpbHNMb2FkVGltZVxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbmV4cG9ydCBzaW5jZUxvYWRTdHIgOj0gKGRhdGV0aW1lOiAoRGF0ZSB8IGludGVnZXIpPyA9IHVuZGVmKSA9PlxyXG5cclxuXHRyZXR1cm4gc3ByaW50ZihcIiU2ZFwiLCBzaW5jZUxvYWQoZGF0ZXRpbWUpKVxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbi8qKlxyXG4gKiBBc3NlcnRzIHRoYXQgYGNvbmRgIGlzIHRydWUuIElmIGl0IGlzbid0LCBhbiBleGNlcHRpb24gaXNcclxuICogdGhyb3duIHdpdGggdGhlIGdpdmVuIGBtc2dgXHJcbiAqL1xyXG5cclxuZXhwb3J0IHRocm93c0Vycm9yIDo9IChmdW5jOiB2b2lkRnVuYywgbXNnOiBzdHJpbmc9XCJVbmV4cGVjdGVkIHN1Y2Nlc3NcIik6IHZvaWQgPT5cclxuXHJcblx0dHJ5XHJcblx0XHRmdW5jKClcclxuXHRcdHRocm93IG5ldyBFcnJvcihtc2cpXHJcblx0Y2F0Y2ggZXJyXHJcblx0XHRyZXR1cm4gICAgIyBpZ25vcmUgZXJyb3IgLSBpdCB3YXMgZXhwZWN0ZWRcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG4vKipcclxuICogQ2FsbGluZyBwYXNzKCkgZG9lcyBub3RoaW5nXHJcbiAqL1xyXG5cclxuZXhwb3J0IHBhc3MgOj0gKCk6IHZvaWQgPT4gICAgIyBkbyBub3RoaW5nXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuZXhwb3J0IHRydW5jU3RyIDo9IChzdHI6IHN0cmluZywgbGVuOiBudW1iZXIpID0+XHJcblxyXG5cdGlmIChzdHIubGVuZ3RoIDw9IGxlbilcclxuXHRcdHJldHVybiBzdHJcclxuXHRyZXR1cm4gc3RyLnN1YnN0cmluZygwLCBsZW4tMykgKyAnLi4uJ1xyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbi8qKlxyXG4gKiBzdHJpbmdpZnkgYW55IHZhbHVlLCBzbyB0aGF0IGlmIHdlIHRha2UgdGhlIHJlc3VsdFN0ciwgd2UgY2FuXHJcbiAqICAgIGxldCB4ID0gPHJlc3VsdFN0cj5cclxuICogdG8gcmV0cmlldmUgdGhlIG9yaWdpbmFsIHZhbHVlIChpZiBubyB0cnVuYyBvcHRpb24gaXMgcGFzc2VkIGluKVxyXG4gKi9cclxuXHJcbmV4cG9ydCBzdHJpbmdpZnkgOj0gKFxyXG5cdHg6IGFueSxcclxuXHRoT3B0aW9uczogaGFzaD17fVxyXG5cdGxldmVsOiBudW1iZXI9MFxyXG5cdCk6IHN0cmluZyA9PlxyXG5cclxuXHR0eXBlIG9wdCA9IHtcclxuXHRcdG9uZUxpbmU6IGJvb2xlYW5cclxuXHRcdGNvbXByZXNzOiBib29sZWFuXHJcblx0XHR0cnVuYzogbnVtYmVyXHJcblx0XHR9XHJcblx0e29uZUxpbmUsIGNvbXByZXNzLCB0cnVuY1xyXG5cdFx0fSA6PSBnZXRPcHRpb25zPG9wdD4gaE9wdGlvbnMsIHtcclxuXHRcdG9uZUxpbmU6IGZhbHNlXHJcblx0XHRjb21wcmVzczogdHJ1ZVxyXG5cdFx0dHJ1bmM6IDBcclxuXHRcdH1cclxuXHJcblx0dHlwZVN0ciA6PSB0eXBlb2YgeFxyXG5cdHJlc3VsdCA6PSBzd2l0Y2ggdHlwZVN0clxyXG5cdFx0d2hlbiAndW5kZWZpbmVkJ1xyXG5cdFx0XHQndW5kZWZpbmVkJ1xyXG5cdFx0d2hlbiAnb2JqZWN0J1xyXG5cdFx0XHRpZiAoeCA9PSBudWxsKVxyXG5cdFx0XHRcdCdudWxsJ1xyXG5cdFx0XHRlbHNlIGlmIEFycmF5LmlzQXJyYXkoeClcclxuXHRcdFx0XHRsUGFydHMgOj0gc3RyaW5naWZ5KGl0ZW0sIGhPcHRpb25zLCBsZXZlbCsxKSBmb3IgaXRlbSBvZiB4XHJcblx0XHRcdFx0aWYgb25lTGluZVxyXG5cdFx0XHRcdFx0J1snICsgbFBhcnRzLmpvaW4oJywgJykgKyAnXSdcclxuXHRcdFx0XHRlbHNlXHJcblx0XHRcdFx0XHQnW1xcbicgKyBsUGFydHMuam9pbignLFxcbicpICsgJ1xcbl0nXHJcblx0XHRcdGVsc2VcclxuXHRcdFx0XHRsUGFydHMgOj0gZm9yIGtleSx2YWwgaW4geFxyXG5cdFx0XHRcdFx0XCIje2tleX06ICN7c3RyaW5naWZ5KHZhbCwgaE9wdGlvbnMsIGxldmVsKzEpfVwiXHJcblx0XHRcdFx0aWYgb25lTGluZVxyXG5cdFx0XHRcdFx0J3snICsgbFBhcnRzLmpvaW4oJywgJykgKyAnfSdcclxuXHRcdFx0XHRlbHNlXHJcblx0XHRcdFx0XHQne1xcbicgKyBsUGFydHMuam9pbignLFxcbicpICsgJ1xcbn0nXHJcblx0XHR3aGVuICdib29sZWFuJ1xyXG5cdFx0XHR4ID8gJ3RydWUnIDogJ2ZhbHNlJ1xyXG5cdFx0d2hlbiAnbnVtYmVyJ1xyXG5cdFx0XHR4LnRvU3RyaW5nKClcclxuXHRcdHdoZW4gJ2JpZ2ludCdcclxuXHRcdFx0eC50b1N0cmluZygpICsgJ24nXHJcblx0XHR3aGVuICdzdHJpbmcnXHJcblx0XHRcdFwiXFxcIiN7ZXNjYXBlU3RyKHgsIG8nc3R5bGU9QycpfVxcXCJcIlxyXG5cdFx0d2hlbiAnc3ltYm9sJ1xyXG5cdFx0XHRpZiBkZWZpbmVkKHguZGVzY3JpcHRpb24pXHJcblx0XHRcdFx0XCJTeW1ib2woXFxcIiN7eC5kZXNjcmlwdGlvbn1cXFwiKVwiXHJcblx0XHRcdGVsc2VcclxuXHRcdFx0XHRcIlN5bWJvbCgpXCJcclxuXHRcdHdoZW4gJ2Z1bmN0aW9uJ1xyXG5cdFx0XHRmdW5jdGlvbkRlZih4KVxyXG5cclxuXHRpZiBpc0ludGVnZXIodHJ1bmMpICYmICh0cnVuYyA+IDApXHJcblx0XHRyZXR1cm4gdHJ1bmNTdHIocmVzdWx0LCB0cnVuYylcclxuXHRlbHNlXHJcblx0XHRyZXR1cm4gcmVzdWx0XHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuLyoqXHJcbiAqIEpTT04gc3RyaW5naWZpZXMgeCBvbiBvbmUgbGluZVxyXG4gKi9cclxuXHJcbmV4cG9ydCBPTCA6PSAoeDogYW55KTogc3RyaW5nID0+XHJcblxyXG5cdGlmICh4ID09IHVuZGVmKVxyXG5cdFx0cmV0dXJuICd1bmRlZidcclxuXHRlbHNlIGlmICh4ID09IG51bGwpXHJcblx0XHRyZXR1cm4gJ251bGwnXHJcblx0ZWxzZSBpZiAodHlwZW9mIHggPT0gJ3N5bWJvbCcpXHJcblx0XHRpZiBkZWZpbmVkKHguZGVzY3JpcHRpb24pXHJcblx0XHRcdHJldHVybiBcIltTeW1ib2wgI3t4LmRlc2NyaXB0aW9ufV1cIlxyXG5cdFx0ZWxzZVxyXG5cdFx0XHRyZXR1cm4gXCJbU3ltYm9sXVwiXHJcblx0XHRyZXR1cm4gJ3N5bWJvbCdcclxuXHRlbHNlIGlmICh0eXBlb2YgeCA9PSAnZnVuY3Rpb24nKVxyXG5cdFx0cmV0dXJuIHgudG9TdHJpbmcoKS5yZXBsYWNlQWxsKCdcXG4nLCAnICcpXHJcblx0ZWxzZVxyXG5cdFx0c3RyIDo9IEpTT04uc3RyaW5naWZ5KHgsIChrLHYpID0+IGRlZmluZWQodikgPyB2IDogJ19fdW5kZWZfXycpXHJcblx0XHRyZXR1cm4gc3RyLnJlcGxhY2VBbGwoJ1wiX191bmRlZl9fXCInLCAndW5kZWZpbmVkJylcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgTUwgOj0gKHg6IGFueSk6IHN0cmluZyA9PlxyXG5cclxuXHRpZiAoeCA9PSB1bmRlZilcclxuXHRcdHJldHVybiAndW5kZWYnXHJcblx0ZWxzZSBpZiAoeCA9PSBudWxsKVxyXG5cdFx0cmV0dXJuICdudWxsJ1xyXG5cdGVsc2UgaWYgKHR5cGVvZiB4ID09ICdmdW5jdGlvbicpXHJcblx0XHRyZXR1cm4geC50b1N0cmluZygpXHJcblx0ZWxzZVxyXG5cdFx0c3RyIDo9IEpTT04uc3RyaW5naWZ5KHgsIChrLHYpID0+IGRlZmluZWQodikgPyB2IDogJ19fdW5kZWZfXycsIDMpXHJcblx0XHRpZiBkZWZpbmVkKHN0cilcclxuXHRcdFx0cmV0dXJuIHN0ci5yZXBsYWNlQWxsKCdcIl9fdW5kZWZfX1wiJywgJ3VuZGVmaW5lZCcpXHJcblx0XHRlbHNlXHJcblx0XHRcdGNvbnNvbGUubG9nIHhcclxuXHRcdFx0cmV0dXJuIFwiSlNPTi5zdHJpbmdpZnkgcmV0dXJuZWQgdW5kZWYhISFcIlxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbi8qKlxyXG4gKiBDb252ZXJ0cyB0aGUgZ2l2ZW4gc3RyaW5nIHRvIGEgaGFzaFxyXG4gKiA8d29yZD4gYmVjb21lcyBhIGtleSB3aXRoIGEgdHJ1ZSB2YWx1ZVxyXG4gKiAhPHdvcmQ+IGJlY29tZXMgYSBrZXlzIHdpdGggYSBmYWxzZSB2YWx1ZVxyXG4gKiA8d29yZD49PHN0cmluZz4gYmVjb21lcyBhIGtleSB3aXRoIHZhbHVlIDxzdHJpbmc+XHJcbiAqICAgIC0gPHN0cmluZz4gbXVzdCBiZSBxdW90ZWQgaWYgaXQgY29udGFpbnMgd2hpdGVzcGFjZVxyXG4gKi9cclxuXHJcbmV4cG9ydCBzdHJUb0hhc2ggOj0gKHN0cjogc3RyaW5nKTogaGFzaCA9PlxyXG5cclxuXHRpZiBpc0VtcHR5KHN0cilcclxuXHRcdHJldHVybiB7fVxyXG5cdGg6IGhhc2ggOj0ge31cclxuXHRmb3Igd29yZCBvZiBzdHIudHJpbSgpLnNwbGl0KC9cXHMrLylcclxuXHRcdGlmIGxNYXRjaGVzOiBzdHJpbmdbXSB8IG51bGwgOj0gd29yZC5tYXRjaCgvLy9eXHJcblx0XHRcdFx0KFxcISk/ICAgICAgICAgICAgICAgICAgICAjIG5lZ2F0ZSB2YWx1ZVxyXG5cdFx0XHRcdChbQS1aYS16XVtBLVphLXpfMC05XSopICAjIGlkZW50aWZpZXJcclxuXHRcdFx0XHQoPzpcclxuXHRcdFx0XHRcdCg9KVxyXG5cdFx0XHRcdFx0KC4qKVxyXG5cdFx0XHRcdFx0KT9cclxuXHRcdFx0XHQkLy8vKVxyXG5cdFx0XHRbXywgbmVnLCBpZGVudCwgZXFTaWduLCBzdHJdIDo9IGxNYXRjaGVzXHJcblx0XHRcdGlmIGlzTm9uRW1wdHlTdHJpbmcoZXFTaWduKVxyXG5cdFx0XHRcdGFzc2VydCBub3RkZWZpbmVkKG5lZykgfHwgKG5lZyA9PSAnJyksXHJcblx0XHRcdFx0XHRcdFwibmVnYXRpb24gd2l0aCBzdHJpbmcgdmFsdWVcIlxyXG5cclxuXHRcdFx0XHQjIC0tLSBjaGVjayBpZiBzdHIgaXMgYSB2YWxpZCBudW1iZXJcclxuXHRcdFx0XHRpZiBzdHIubWF0Y2goL14tP1xcZCsoXFwuXFxkKyk/JC8pXHJcblx0XHRcdFx0XHRudW0gOj0gcGFyc2VGbG9hdChzdHIpXHJcblx0XHRcdFx0XHRpZiBOdW1iZXIuaXNOYU4obnVtKVxyXG5cdFx0XHRcdFx0XHQjIC0tLSBUTyBETzogaW50ZXJwcmV0IGJhY2tzbGFzaCBlc2NhcGVzXHJcblx0XHRcdFx0XHRcdGhbaWRlbnRdID0gc3RyXHJcblx0XHRcdFx0XHRlbHNlXHJcblx0XHRcdFx0XHRcdGhbaWRlbnRdID0gbnVtXHJcblx0XHRcdFx0ZWxzZVxyXG5cdFx0XHRcdFx0aFtpZGVudF0gPSBzdHJcclxuXHRcdFx0ZWxzZSBpZiBuZWdcclxuXHRcdFx0XHRoW2lkZW50XSA9IGZhbHNlXHJcblx0XHRcdGVsc2VcclxuXHRcdFx0XHRoW2lkZW50XSA9IHRydWVcclxuXHRcdGVsc2VcclxuXHRcdFx0Y3JvYWsgXCJJbnZhbGlkIHdvcmQgI3tPTCh3b3JkKX1cIlxyXG5cdHJldHVybiBoXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuZXhwb3J0IG8gOj0gKGxTdHJpbmdzOiBUZW1wbGF0ZVN0cmluZ3NBcnJheSk6IGhhc2ggPT5cclxuXHJcblx0cmV0dXJuIHN0clRvSGFzaChsU3RyaW5nc1swXSlcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG4vKipcclxuICogcyAtIGNvbnZlcnQgbGVhZGluZyB0YWJzIHRvIHNwYWNlc1xyXG4gKi9cclxuXHJcbmV4cG9ydCBzIDo9IChsU3RyaW5nczogVGVtcGxhdGVTdHJpbmdzQXJyYXkpOiBzdHJpbmcgPT5cclxuXHJcblx0Y29uc29sZS5sb2cgXCJjYWxsaW5nIGZ1bmN0aW9uIHNcIlxyXG5cdHJlcGxhY2VyIDo9IChtYXRjaDogc3RyaW5nKTogc3RyaW5nID0+XHJcblx0XHRjb25zb2xlLmxvZyBcIm1hdGNoID0gPCN7ZXNjYXBlU3RyKG1hdGNoKX0+XCJcclxuXHRcdHJlc3VsdCA6PSAnICAgJy5yZXBlYXQobWF0Y2gubGVuZ3RoKVxyXG5cdFx0Y29uc29sZS5sb2cgXCJyZXN1bHQgPSA8I3tlc2NhcGVTdHIocmVzdWx0KX0+XCJcclxuXHRcdHJldHVybiByZXN1bHRcclxuXHRyZXR1cm4gbFN0cmluZ3NbMF0ucmVwbGFjZUFsbCgvXlxcdCsvbWcsIHJlcGxhY2VyKVxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbi8qKlxyXG4gKiB0IC0gY29udmVydCBsZWFkaW5nIHNwYWNlcyB0byB0YWJzXHJcbiAqL1xyXG5cclxuZXhwb3J0IHQgOj0gKGxTdHJpbmdzOiBUZW1wbGF0ZVN0cmluZ3NBcnJheSk6IHN0cmluZyA9PlxyXG5cclxuXHRyZXBsYWNlciA6PSAobWF0Y2g6IHN0cmluZyk6IHN0cmluZyA9PlxyXG5cdFx0bGV2ZWwgOj0gTWF0aC5mbG9vcihtYXRjaC5sZW5ndGggLyAzKVxyXG5cdFx0cmV0dXJuICdcXHQnLnJlcGVhdChsZXZlbClcclxuXHRyZXR1cm4gbFN0cmluZ3NbMF0ucmVwbGFjZUFsbCgvXlxceDIwKy9tZywgcmVwbGFjZXIpXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuLyoqXHJcbiAqIHJldHVybnMgYSBoYXNoIG9mIG9wdGlvbnMgd2l0aCB0aGVpciB2YWx1ZXMsXHJcbiAqIC0gYWRkaW5nIGFueSBkZWZhdWx0IHZhbHVlcyBmcm9tIGhEZWZhdWx0c1xyXG4gKiAgIGlmIHRoZXkncmUgbWlzc2luZ1xyXG4gKi9cclxuXHJcbmV4cG9ydCBnZXRPcHRpb25zIDo9IDxUIGV4dGVuZHMgaGFzaD4oXHJcblx0XHRoT3B0aW9uczogaGFzaD17fSxcclxuXHRcdGhEZWZhdWx0czogVFxyXG5cdFx0KTogVCA9PlxyXG5cclxuXHRyZXR1cm4gey4uLmhEZWZhdWx0cywgLi4uaE9wdGlvbnN9XHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuLyoqXHJcbiAqIHJlbW92ZSBhbGwga2V5cyBmcm9tIGEgaGFzaCB0aGF0IGhhdmUgZWl0aGVyIGFuIGVtcHR5IG5hbWVcclxuICogb3IgYW4gZW1wdHkgdmFsdWVcclxuICovXHJcblxyXG5leHBvcnQgcmVtb3ZlRW1wdHlLZXlzIDo9IChoOiBoYXNoKTogaGFzaCA9PlxyXG5cclxuXHRoUmVzdWx0OiBoYXNoIDo9IHt9XHJcblx0Zm9yIGtleSBvZiBrZXlzKGgpXHJcblx0XHRpZiBub25FbXB0eShrZXkpICYmIG5vbkVtcHR5KGhba2V5XSlcclxuXHRcdFx0aFJlc3VsdFtrZXldID0gaFtrZXldXHJcblx0cmV0dXJuIGhSZXN1bHRcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG4vKipcclxuICogcmV0dXJuIGFuIGFycmF5IG9mIGFsbCBvd24ga2V5cyBpbiBhIGhhc2hcclxuICogd2l0aCBwb3NzaWJsZSBleGNlcHRpb25zXHJcbiAqL1xyXG5cclxuZXhwb3J0IGtleXMgOj0gKG9iajogaGFzaCwgaE9wdGlvbnM6IGhhc2g9e30pOiBzdHJpbmdbXSA9PlxyXG5cclxuXHR0eXBlIG9wdCA9IHtcclxuXHRcdGxFeGNlcHQ6IHN0cmluZ1tdXHJcblx0XHR9XHJcblx0e2xFeGNlcHR9IDo9IGdldE9wdGlvbnM8b3B0PiBoT3B0aW9ucywge1xyXG5cdFx0bEV4Y2VwdDogW11cclxuXHRcdH1cclxuXHJcblx0bEtleXM6IHN0cmluZ1tdIDo9IFtdXHJcblx0Zm9yIGtleSBvZiBPYmplY3Qua2V5cyhvYmopXHJcblx0XHRpZiBub3QgbEV4Y2VwdC5pbmNsdWRlcyhrZXkpXHJcblx0XHRcdGxLZXlzLnB1c2gga2V5XHJcblx0cmV0dXJuIGxLZXlzXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuLyoqXHJcbiAqIHJldHVybnMgdHJ1ZSBpZiBlaXRoZXIgYGhgIGlzIG5vdCBkZWZpbmVkLCBvciBpZiBgaGAgaXNcclxuICogYSBoYXNoIHRoYXQgaW5jbHVkZXMgYWxsIHRoZSBrZXlzIHByb3ZpZGVkXHJcbiAqL1xyXG5cclxuZXhwb3J0IGhhc0tleSA6PSAoaDogaGFzaCwgLi4ubEtleXM6IHN0cmluZ1tdKTogYm9vbGVhbiA9PlxyXG5cclxuXHRpZiBub3RkZWZpbmVkKGgpXHJcblx0XHRyZXR1cm4gZmFsc2VcclxuXHRmb3Iga2V5IG9mIGxLZXlzXHJcblx0XHRhc3NlcnQgaXNTdHJpbmcoa2V5KSwgXCJrZXkgbm90IGEgc3RyaW5nOiAje09MKGtleSl9XCJcclxuXHRcdGlmIG5vdCBoLmhhc093blByb3BlcnR5KGtleSlcclxuXHRcdFx0cmV0dXJuIGZhbHNlXHJcblx0cmV0dXJuIHRydWVcclxuXHJcbmV4cG9ydCBoYXNLZXlzIDo9IGhhc0tleVxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbmV4cG9ydCBtaXNzaW5nS2V5cyA6PSAoaDogaGFzaCwgLi4ubEtleXM6IHN0cmluZ1tdKTogc3RyaW5nW10gPT5cclxuXHJcblx0aWYgbm90ZGVmaW5lZChoKVxyXG5cdFx0cmV0dXJuIGxLZXlzXHJcblx0YXNzZXJ0IGlzSGFzaChoKSwgXCJoIG5vdCBhIGhhc2g6ICN7T0woaCl9XCJcclxuXHRsTWlzc2luZzogc3RyaW5nW10gOj0gW11cclxuXHRmb3Iga2V5IG9mIGxLZXlzXHJcblx0XHRpZiBub3QgaC5oYXNPd25Qcm9wZXJ0eShrZXkpXHJcblx0XHRcdGxNaXNzaW5nLnB1c2gga2V5XHJcblx0cmV0dXJuIGxNaXNzaW5nXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuLyoqXHJcbiAqIG1lcmdlcyB0aGUgcHJvdmlkZWQgb2JqZWN0cyBpbnRvIGEgbmV3IG9iamVjdFxyXG4gKiBOT1RFOiBub25lIG9mIHRoZSBwcm92aWRlZCBhcmd1bWVudHMgYXJlIG1vZGlmaWVkXHJcbiAqL1xyXG5cclxuZXhwb3J0IG1lcmdlIDo9ICguLi5sT2JqZWN0czogaGFzaFtdKTogaGFzaCA9PlxyXG5cclxuXHRyZXR1cm4gT2JqZWN0LmFzc2lnbih7fSwgbE9iamVjdHMuLi4pXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuZXhwb3J0IGhpdCA6PSAocGN0OiBudW1iZXIgPSA1MCk6IGJvb2xlYW4gPT5cclxuXHJcblx0cmV0dXJuICgxMDAgKiBNYXRoLnJhbmRvbSgpIDwgcGN0KVxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuIyAtLS0gQVNZTkMgIVxyXG5cclxuZXhwb3J0IHNsZWVwIDo9IChzZWM6IG51bWJlcik6IHZvaWQgPT5cclxuXHJcblx0YXdhaXQgbmV3IFByb21pc2UoKHIpID0+IHNldFRpbWVvdXQociwgMTAwMCAqIHNlYykpXHJcblx0cmV0dXJuXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuZXhwb3J0IHNsZWVwU3luYyA6PSAoc2VjOiBudW1iZXIpOiB2b2lkID0+XHJcblxyXG5cdHN0YXJ0IDo9IERhdGUubm93KClcclxuXHRlbmQgOj0gRGF0ZS5ub3coKSArIDEwMDAqc2VjXHJcblx0d2hpbGUgKERhdGUubm93KCkgPCBlbmQpXHJcblx0cmV0dXJuXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuLyoqXHJcbiAqIHJldHVybnMgYSBzdHJpbmcgY29uc2lzdGluZyBvZiB0aGUgZ2l2ZW4gbnVtYmVyXHJcbiAqIG9mIHNwYWNlIGNoYXJhY3RlcnNcclxuICovXHJcblxyXG5leHBvcnQgc3BhY2VzIDo9IChuOiBudW1iZXIpOiBzdHJpbmcgPT5cclxuXHJcblxyXG5cdHJldHVybiAobiA8PSAwKSA/ICcnIDogJyAnLnJlcGVhdChuKVxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbi8qKlxyXG4gKiByZXR1cm5zIGEgc3RyaW5nIGNvbnNpc3Rpbmcgb2YgdGhlIGdpdmVuIG51bWJlclxyXG4gKiBvZiBUQUIgY2hhcmFjdGVyc1xyXG4gKi9cclxuXHJcbmV4cG9ydCB0YWJzIDo9IChuOiBudW1iZXIpOiBzdHJpbmcgPT5cclxuXHJcblx0cmV0dXJuIChuIDw9IDApID8gJycgOiAnXFx0Jy5yZXBlYXQobilcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG4vKipcclxuICogcnRyaW0gLSBzdHJpcCB0cmFpbGluZyB3aGl0ZXNwYWNlXHJcbiAqL1xyXG5cclxuZXhwb3J0IHJ0cmltIDo9IChsaW5lOiBzdHJpbmcpOiBzdHJpbmcgPT5cclxuXHJcblx0YXNzZXJ0IGlzU3RyaW5nKGxpbmUpLCBcIm5vdCBhIHN0cmluZzogI3t0eXBlb2YgbGluZX1cIlxyXG5cdGxNYXRjaGVzIDo9IGxpbmUubWF0Y2goL14oLio/KVxccyskLylcclxuXHRyZXR1cm4gKGxNYXRjaGVzID09IG51bGwpID8gbGluZSA6IGxNYXRjaGVzWzFdXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuLyoqXHJcbiAqIENvdW50IHRoZSBudW1iZXIgb2YgYSBzcGVjaWZpYyBjaGFyYWN0ZXIgaW4gYSBzdHJpbmdcclxuICovXHJcblxyXG5leHBvcnQgY291bnRDaGFycyA6PSAoc3RyOiBzdHJpbmcsIGNoOiBzdHJpbmcpOiBudW1iZXIgPT5cclxuXHJcblx0bGV0IGNvdW50ID0gMFxyXG5cdGxldCBwb3MgPSAtMVxyXG5cdHdoaWxlIChwb3MgPSBzdHIuaW5kZXhPZihjaCwgcG9zKzEpKSAhPSAtMVxyXG5cdFx0Y291bnQgKz0gMVxyXG5cdHJldHVybiBjb3VudFxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbi8qKlxyXG4gKiBjb252ZXJ0IGEgbXVsdGktbGluZSBzdHJpbmcgdG8gYW4gYXJyYXlcclxuICogb2Ygc2luZ2xlIGxpbmUgc3RyaW5nc1xyXG4gKi9cclxuXHJcbmV4cG9ydCBibG9ja1RvQXJyYXkgOj0gKGJsb2NrOiBzdHJpbmcpOiBzdHJpbmdbXSA9PlxyXG5cclxuXHRpZiBpc0VtcHR5KGJsb2NrKVxyXG5cdFx0cmV0dXJuIFtdXHJcblx0ZWxzZVxyXG5cdFx0cmV0dXJuIGJsb2NrLnNwbGl0KC9cXHI/XFxuLylcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgYWxsTGluZXNJbkJsb2NrIDo9IChcclxuXHRcdGJsb2NrOiBzdHJpbmdcclxuXHRcdCk6IEdlbmVyYXRvcjxzdHJpbmcsIHZvaWQsIHZvaWQ+IC0+XHJcblxyXG5cdGxldCBzdGFydCA9IDBcclxuXHRsZXQgZW5kID0gYmxvY2suaW5kZXhPZignXFxuJylcclxuXHR3aGlsZSAoZW5kICE9IC0xKVxyXG5cdFx0eWllbGQgYmxvY2suc3Vic3RyaW5nKHN0YXJ0LCBlbmQpXHJcblx0XHRzdGFydCA9IGVuZCArIDFcclxuXHRcdGVuZCA9IGJsb2NrLmluZGV4T2YoJ1xcbicsIHN0YXJ0KVxyXG5cdGlmIChzdGFydCA8IGJsb2NrLmxlbmd0aClcclxuXHRcdHlpZWxkIGJsb2NrLnN1YnN0cmluZyhzdGFydClcclxuXHRyZXR1cm5cclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG4vKipcclxuICogQSBzdHJpbmcgb3Igc3RyaW5nIGFycmF5XHJcbiAqL1xyXG5cclxuZXhwb3J0IHR5cGUgVEJsb2NrU3BlYyA9IHN0cmluZyB8IHN0cmluZ1tdXHJcblxyXG5leHBvcnQgaXNCbG9ja1NwZWMgOj0gKHg6IGFueSk6IHggaXMgVEJsb2NrU3BlYyA9PlxyXG5cclxuXHRyZXR1cm4gaXNTdHJpbmcoeCkgfHwgaXNBcnJheU9mU3RyaW5ncyh4KVxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbi8qKlxyXG4gKiByZXR1cm4gYW4gYXJyYXkgYXMgaXMsIGNvbnZlcnQgYSBtdWx0aS1saW5lIHN0cmluZ1xyXG4gKiB0byBhbiBhcnJheSBvZiBzaW5nbGUgbGluZSBzdHJpbmdzXHJcbiAqL1xyXG5cclxuZXhwb3J0IHRvQXJyYXkgOj0gKHN0ck9yQXJyYXk6IFRCbG9ja1NwZWMpOiBzdHJpbmdbXSA9PlxyXG5cclxuXHRpZiBBcnJheS5pc0FycmF5KHN0ck9yQXJyYXkpXHJcblx0XHRyZXR1cm4gc3RyT3JBcnJheVxyXG5cdGVsc2VcclxuXHRcdHJldHVybiBibG9ja1RvQXJyYXkoc3RyT3JBcnJheSlcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG4vKipcclxuICogY29udmVydCBhbiBhcnJheSBvZiBzdHJpbmdzIHRvIGEgc2luZ2xlIG11bHRpLWxpbmUgc3RyaW5nXHJcbiAqL1xyXG5cclxuZXhwb3J0IGFycmF5VG9CbG9jayA6PSAobExpbmVzOiBzdHJpbmdbXSk6IHN0cmluZyA9PlxyXG5cclxuXHRhc3NlcnQgaXNBcnJheShsTGluZXMpLCBcImxMaW5lcyBpcyBub3QgYW4gYXJyYXk6ICN7T0wobExpbmVzKX1cIlxyXG5cdHJldHVybiBsTGluZXMuZmlsdGVyKChsaW5lKSA9PiBkZWZpbmVkKGxpbmUpKS5qb2luKFwiXFxuXCIpXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuLyoqXHJcbiAqIHJldHVybiBhIHN0cmluZyBhcyBpcywgY29udmVydCBhbiBhcnJheSBvZiBzdHJpbmdzXHJcbiAqIHRvIGEgc2luZ2xlIG11bHRpLWxpbmUgc3RyaW5nXHJcbiAqL1xyXG5cclxuZXhwb3J0IHRvQmxvY2sgOj0gKHN0ck9yQXJyYXk6IFRCbG9ja1NwZWMpOiBzdHJpbmcgPT5cclxuXHJcblx0aWYgaXNTdHJpbmcoc3RyT3JBcnJheSlcclxuXHRcdHJldHVybiBzdHJPckFycmF5XHJcblx0ZWxzZVxyXG5cdFx0cmV0dXJuIGFycmF5VG9CbG9jayhzdHJPckFycmF5KVxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbmV4cG9ydCBpbnZlcnRIYXNoIDo9IChoOiBoYXNoKTogaGFzaCA9PlxyXG5cclxuXHRhc3NlcnQgaXNIYXNoKGgpLCBcIk5vdCBhIGhhc2g6ICN7T0woaCl9XCJcclxuXHRoUmVzdWx0OiBoYXNoIDo9IHt9XHJcblx0Zm9yIGtleSBvZiBrZXlzKGgpXHJcblx0XHR2YWx1ZSA6PSBoW2tleV1cclxuXHRcdGlmIGlzU3RyaW5nKHZhbHVlKVxyXG5cdFx0XHRoUmVzdWx0W3ZhbHVlXSA9IGtleVxyXG5cdHJldHVybiBoUmVzdWx0XHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuLyoqXHJcbiAqIGJ5IGRlZmF1bHQsIHJlcGxhY2UgdGhlc2UgY2hhcmFjdGVyczpcclxuICogICAgY2FycmlhZ2UgcmV0dXJuXHJcbiAqICAgIG5ld2xpbmVcclxuICogICAgVEFCXHJcbiAqICAgIHNwYWNlXHJcbiAqIE9wdGlvbmFsbHksIGFkZCBhIGNoYXJhY3RlciB0byBpbmRpY2F0ZSBhIHBhcnRpY3VsYXJcclxuICogcG9zaXRpb24gaW4gdGhlIHN0cmluZ1xyXG4gKiBWYWxpZCBvcHRpb25zOlxyXG4gKiAgICBvZmZzZXQgLSBpbmRpY2F0ZSBwb3NpdGlvbiBvZiBvZmZzZXRcclxuICogICAgcG9zY2hhciAtIGNoYXIgdG8gdXNlIHRvIGluZGljYXRlIHBvc2l0aW9uXHJcbiAqL1xyXG5cclxuaERlYnVnUmVwbGFjZTogaGFzaG9mPHN0cmluZz4gOj0ge1xyXG5cdFwiXFxyXCI6ICfihpAnXHJcblx0XCJcXG5cIjogJ+KGkydcclxuXHRcIlxcdFwiOiAn4oaSJ1xyXG5cdFwiIFwiOiAgJ8uzJ1xyXG5cdH1cclxuXHJcbmhEZWJ1Z05vTmV3bGluZVJlcGxhY2U6IGhhc2hvZjxzdHJpbmc+IDo9IHtcclxuXHRcIlxcdFwiOiAn4oaSJ1xyXG5cdFwiIFwiOiAgJ8uzJ1xyXG5cdH1cclxuXHJcbmhDUmVwbGFjZTogaGFzaG9mPHN0cmluZz4gOj0ge1xyXG5cdFwiXFxyXCI6ICdcXFxccidcclxuXHRcIlxcblwiOiAnXFxcXG4nXHJcblx0XCJcXHRcIjogJ1xcXFx0J1xyXG5cdH1cclxuXHJcbmhDTm9OZXdsaW5lUmVwbGFjZTogaGFzaG9mPHN0cmluZz4gOj0ge1xyXG5cdFwiXFx0XCI6ICdcXFxcdCdcclxuXHR9XHJcblxyXG5leHBvcnQgZXNjYXBlU3RyIDo9IChcclxuXHRcdHN0cjogc3RyaW5nXHJcblx0XHRoT3B0aW9uczogaGFzaCA9IHt9XHJcblx0XHQpOiBzdHJpbmcgPT5cclxuXHJcblx0dHlwZSBvcHQgPSB7XHJcblx0XHRzdHlsZTogc3RyaW5nXHJcblx0XHRoUmVwbGFjZTogaGFzaG9mPHN0cmluZz5cclxuXHRcdGJsb2NrOiBib29sZWFuXHJcblx0XHRvZmZzZXQ6IG51bWJlcj9cclxuXHRcdHJhbmdlOiBudW1iZXJbXT8gICAgICAjIC0tLSBjYW4gYmUgW2ludCwgaW50XVxyXG5cdFx0cG9zY2hhcjogY2hhclxyXG5cdFx0YmVnaW5jaGFyOiBjaGFyXHJcblx0XHRlbmRjaGFyOiBjaGFyXHJcblx0XHR9XHJcblx0e1xyXG5cdFx0c3R5bGUsIGhSZXBsYWNlLCBibG9jaywgb2Zmc2V0LCBwb3NjaGFyLFxyXG5cdFx0YmVnaW5jaGFyLCBlbmRjaGFyXHJcblx0XHR9IDo9IGdldE9wdGlvbnM8b3B0PiBoT3B0aW9ucywge1xyXG5cdFx0XHRzdHlsZTogJ2RlYnVnJ1xyXG5cdFx0XHRoUmVwbGFjZToge31cclxuXHRcdFx0YmxvY2s6IGZhbHNlXHJcblx0XHRcdG9mZnNldDogdW5kZWZcclxuXHRcdFx0cmFuZ2U6IHVuZGVmICAgICAgIyAtLS0gY2FuIGJlIFtpbnQsIGludF1cclxuXHRcdFx0cG9zY2hhcjogJ+KUiidcclxuXHRcdFx0YmVnaW5jaGFyOiAn4p+oJ1xyXG5cdFx0XHRlbmRjaGFyOiAn4p+pJ1xyXG5cdFx0XHR9XHJcblxyXG5cdGxldCBoUmVhbFJlcGxhY2U6IGhhc2hvZjxzdHJpbmc+ID0ge31cclxuXHRpZiBub25FbXB0eShoUmVwbGFjZSlcclxuXHRcdGhSZWFsUmVwbGFjZSA9IGhSZXBsYWNlXHJcblx0ZWxzZSBpZiAoc3R5bGUgPT0gJ0MnKVxyXG5cdFx0aWYgYmxvY2tcclxuXHRcdFx0aFJlYWxSZXBsYWNlID0gaENOb05ld2xpbmVSZXBsYWNlXHJcblx0XHRlbHNlXHJcblx0XHRcdGhSZWFsUmVwbGFjZSA9IGhDUmVwbGFjZVxyXG5cdGVsc2VcclxuXHRcdGlmIGJsb2NrXHJcblx0XHRcdGhSZWFsUmVwbGFjZSA9IGhEZWJ1Z05vTmV3bGluZVJlcGxhY2VcclxuXHRcdGVsc2VcclxuXHRcdFx0aFJlYWxSZXBsYWNlID0gaERlYnVnUmVwbGFjZVxyXG5cclxuXHRbYmVnaW5Qb3MsIGVuZFBvc10gOj0gKFxyXG5cdFx0aWYgZGVmaW5lZChyYW5nZSkgJiYgaXNBcnJheShyYW5nZSlcclxuXHRcdFx0cmFuZ2VcclxuXHRcdGVsc2VcclxuXHRcdFx0W3VuZGVmLCB1bmRlZl1cclxuXHRcdClcclxuXHJcblx0bFBhcnRzOiBzdHJpbmdbXSA6PSBbXVxyXG5cdGZvciBjaCxpIG9mIHN0clxyXG5cdFx0aWYgKGkgPT0gb2Zmc2V0KVxyXG5cdFx0XHRsUGFydHMucHVzaCBwb3NjaGFyXHJcblx0XHRlbHNlIGlmIChpID09IGJlZ2luUG9zKVxyXG5cdFx0XHRsUGFydHMucHVzaCBiZWdpbmNoYXJcclxuXHRcdGVsc2UgaWYgKGkgPT0gZW5kUG9zKVxyXG5cdFx0XHRsUGFydHMucHVzaCBlbmRjaGFyXHJcblx0XHRsUGFydHMucHVzaCAoaFJlYWxSZXBsYWNlW2NoXSB8fCBjaClcclxuXHRpZiAob2Zmc2V0ID09IHN0ci5sZW5ndGgpXHJcblx0XHRsUGFydHMucHVzaCBwb3NjaGFyXHJcblx0cmV0dXJuIGxQYXJ0cy5qb2luKCcnKVxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbmV4cG9ydCB1bmVzY2FwZVN0ciA6PSAoXHJcblx0XHRzdHI6IHN0cmluZ1xyXG5cdFx0aE9wdGlvbnM6IGhhc2ggPSB7fVxyXG5cdFx0KTogc3RyaW5nID0+XHJcblxyXG5cdHR5cGUgb3B0ID0ge1xyXG5cdFx0c3R5bGU6IHN0cmluZ1xyXG5cdFx0aFJlcGxhY2U6IGhhc2hvZjxzdHJpbmc+XHJcblx0XHR9XHJcblx0e3N0eWxlLCBoUmVwbGFjZX0gOj0gZ2V0T3B0aW9uczxvcHQ+IGhPcHRpb25zLCB7XHJcblx0XHRzdHlsZTogJ0MnXHJcblx0XHRoUmVwbGFjZToge31cclxuXHRcdH1cclxuXHJcblx0bGV0IGhSZWFsUmVwbGFjZTogaGFzaG9mPHN0cmluZz4gPSB7fVxyXG5cdGlmIG5vbkVtcHR5KGhSZXBsYWNlKVxyXG5cdFx0aFJlYWxSZXBsYWNlID0gaFJlcGxhY2VcclxuXHRlbHNlXHJcblx0XHRpZiAoc3R5bGUgPT0gJ2RlYnVnJylcclxuXHRcdFx0aFJlYWxSZXBsYWNlID0ge1xyXG5cdFx0XHRcdCfihpAnOiAnJ1xyXG5cdFx0XHRcdCfihpMnOiAnXFxuJ1xyXG5cdFx0XHRcdCfihpInOiAnXFx0J1xyXG5cdFx0XHRcdCfLsyc6ICcgJ1xyXG5cdFx0XHRcdH1cclxuXHRcdGVsc2VcclxuXHRcdFx0aFJlYWxSZXBsYWNlID0ge1xyXG5cdFx0XHRcdCduJzogJ1xcbidcclxuXHRcdFx0XHQncic6ICcnICAgICAjIGNhcnJpYWdlIHJldHVybiBzaG91bGQganVzdCBkaXNhcHBlYXJcclxuXHRcdFx0XHQndCc6ICdcXHQnXHJcblx0XHRcdFx0fVxyXG5cclxuXHRsZXQgZXNjID0gZmFsc2VcclxuXHRsUGFydHM6IHN0cmluZ1tdIDo9IFtdXHJcblx0Zm9yIGNoLGkgb2Ygc3RyXHJcblx0XHRpZiAoY2ggPT0gJ1xcXFwnKVxyXG5cdFx0XHRpZiBlc2NcclxuXHRcdFx0XHRsUGFydHMucHVzaCAnXFxcXCdcclxuXHRcdFx0XHRlc2MgPSBmYWxzZVxyXG5cdFx0XHRlbHNlXHJcblx0XHRcdFx0ZXNjID0gdHJ1ZVxyXG5cdFx0ZWxzZVxyXG5cdFx0XHRpZiBlc2NcclxuXHRcdFx0XHRpZiBkZWZpbmVkKGhSZWFsUmVwbGFjZVtjaF0pXHJcblx0XHRcdFx0XHRsUGFydHMucHVzaCBoUmVhbFJlcGxhY2VbY2hdXHJcblx0XHRcdFx0ZWxzZVxyXG5cdFx0XHRcdFx0bFBhcnRzLnB1c2ggY2hcclxuXHRcdFx0XHRlc2MgPSBmYWxzZVxyXG5cdFx0XHRlbHNlXHJcblx0XHRcdFx0bFBhcnRzLnB1c2ggY2hcclxuXHRyZXR1cm4gbFBhcnRzLmpvaW4oJycpXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuLyoqXHJcbiAqIGRvbid0IGVzY2FwZSBuZXdsaW5lIG9yIGNhcnJpYWdlIHJldHVyblxyXG4gKiBPcHRpb25hbGx5LCBhZGQgYSBjaGFyYWN0ZXIgdG8gaW5kaWNhdGUgYSBwYXJ0aWN1bGFyXHJcbiAqIHBvc2l0aW9uIGluIHRoZSBzdHJpbmdcclxuICovXHJcblxyXG5leHBvcnQgZXNjYXBlQmxvY2sgOj0gKFxyXG5cdGJsb2NrOiBzdHJpbmcsXHJcblx0aE9wdGlvbnM6IGhhc2ggPSB7fVxyXG5cdCk6IHN0cmluZyA9PlxyXG5cclxuXHRoT3B0aW9ucy5ibG9jayA9IHRydWVcclxuXHRyZXR1cm4gZXNjYXBlU3RyKGJsb2NrLCBoT3B0aW9ucylcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgcmVscGF0aCA6PSAocGF0aDogc3RyaW5nKTogc3RyaW5nID0+XHJcblxyXG5cdHJldHVybiByZWxhdGl2ZShEZW5vLmN3ZCgpLCBwYXRoKS5yZXBsYWNlQWxsKCdcXFxcJywgJy8nKVxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbi8qKlxyXG4gKiBTcGxpdHMgYSBzdHJpbmcgb24gd2hpdGVzcGFjZSBpbnRvIGFuIGFycmF5LFxyXG4gKiBpZ25vcmluZyBhbnkgbGVhZGluZyBvciB0cmFpbGluZyB3aGl0ZXNwYWNlXHJcbiAqL1xyXG5cclxuZXhwb3J0IHdzU3BsaXQgOj0gKHN0cjogc3RyaW5nKTogc3RyaW5nW10gPT5cclxuXHJcblx0bmV3c3RyIDo9IHN0ci50cmltKClcclxuXHRpZiAobmV3c3RyID09ICcnKVxyXG5cdFx0cmV0dXJuIFtdXHJcblx0ZWxzZVxyXG5cdFx0cmV0dXJuIG5ld3N0ci5zcGxpdCgvXFxzKy8pXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuLyoqXHJcbiAqIHNwbGl0cyBlYWNoIHN0cmluZyBvbiB3aGl0ZXNwYWNlIGlnbm9yaW5nIGFueSBsZWFkaW5nXHJcbiAqIG9yIHRyYWlsaW5nIHdoaXRlc3BhY2UsIGFuZCByZXR1cm5zIGFuIGFycmF5IG9mXHJcbiAqIGFsbCBzdWJzdHJpbmdzIG9idGFpbmVkXHJcbiAqL1xyXG5cclxuZXhwb3J0IHdvcmRzIDo9ICguLi5sU3RyaW5nczogc3RyaW5nW10pOiBzdHJpbmdbXSA9PlxyXG5cclxuXHRsZXQgbFdvcmRzID0gW11cclxuXHRmb3Igc3RyIG9mIGxTdHJpbmdzXHJcblx0XHRmb3Igd29yZCBvZiB3c1NwbGl0KHN0cilcclxuXHRcdFx0bFdvcmRzLnB1c2ggd29yZFxyXG5cdHJldHVybiBsV29yZHNcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG4vKipcclxuICogY2FsY3VsYXRlcyB0aGUgbnVtYmVyIG9mIGV4dHJhIGNoYXJhY3RlcnMgbmVlZGVkIHRvXHJcbiAqIG1ha2UgdGhlIGdpdmVuIHN0cmluZyBoYXZlIHRoZSBnaXZlbiBsZW5ndGguXHJcbiAqIElmIG5vdCBwb3NzaWJsZSwgcmV0dXJucyAwXHJcbiAqL1xyXG5cclxuZXhwb3J0IGdldE5FeHRyYSA6PSAoc3RyOiBzdHJpbmcsIGxlbjogbnVtYmVyKTogbnVtYmVyID0+XHJcblxyXG5cdGV4dHJhIDo9IGxlbiAtIHN0ci5sZW5ndGhcclxuXHRyZXR1cm4gKGV4dHJhID4gMCkgPyBleHRyYSA6IDBcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG4vKipcclxuICogcGFkcyB0aGUgZ2l2ZW4gc3RyaW5nIG9uIHRoZSByaWdodCB3aXRoXHJcbiAqIHRoZSBnaXZlbiBjaGFyYWN0ZXIsIHRvIHRoZSBnaXZlbiBsZW5ndGhcclxuICovXHJcblxyXG5leHBvcnQgcnBhZCA6PSAoc3RyOiBzdHJpbmcsIGxlbjogbnVtYmVyLCBjaDogc3RyaW5nPScgJyk6IHN0cmluZyA9PlxyXG5cclxuXHRhc3NlcnQgKGNoLmxlbmd0aCA9PSAxKSwgXCJOb3QgYSBjaGFyXCJcclxuXHRleHRyYSA6PSBnZXRORXh0cmEoc3RyLCBsZW4pXHJcblx0cmV0dXJuIHN0ciArIGNoLnJlcGVhdChleHRyYSlcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG4vKipcclxuICogcGFkcyB0aGUgZ2l2ZW4gc3RyaW5nIG9uIHRoZSBsZWZ0IHdpdGhcclxuICogdGhlIGdpdmVuIGNoYXJhY3RlciwgdG8gdGhlIGdpdmVuIGxlbmd0aFxyXG4gKi9cclxuXHJcbmV4cG9ydCBscGFkIDo9IChzdHI6IHN0cmluZywgbGVuOiBudW1iZXIsIGNoOiBzdHJpbmc9JyAnKTogc3RyaW5nID0+XHJcblxyXG5cdGFzc2VydCAoY2gubGVuZ3RoID09IDEpLCBcIk5vdCBhIGNoYXJcIlxyXG5cdGV4dHJhIDo9IGdldE5FeHRyYShzdHIsIGxlbilcclxuXHRyZXR1cm4gY2gucmVwZWF0KGV4dHJhKSArIHN0clxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuIyAtLS0gdmFsaWQgb3B0aW9uczpcclxuIyAgICAgICAgY2hhciAtIGNoYXIgdG8gdXNlIG9uIGxlZnQgYW5kIHJpZ2h0XHJcbiMgICAgICAgIGJ1ZmZlciAtIG51bSBzcGFjZXMgYXJvdW5kIHRleHQgd2hlbiBjaGFyIDw+ICcgJ1xyXG5cclxuLyoqXHJcbiAqIHBhZHMgdGhlIGdpdmVuIHN0cmluZyBvbiBib3RoIHRoZSBsZWZ0IGFuZCByaWdodFxyXG4gKiB3aXRoIHRoZSBnaXZlbiBjaGFyYWN0ZXIsIHRvIHRoZSBnaXZlbiBsZW5ndGhcclxuICogYnV0IHdpdGggdGhlIGdpdmVuIG51bWJlciBvZiBidWZmZXIgY2hhcnMgc3Vycm91bmRpbmdcclxuICogdGhlIHRleHRcclxuICovXHJcblxyXG5leHBvcnQgY2VudGVyZWQgOj0gKFxyXG5cdHRleHQ6IHN0cmluZyxcclxuXHR3aWR0aDogbnVtYmVyLFxyXG5cdGNoYXI6IHN0cmluZyA9ICcgJyxcclxuXHRudW1CdWZmZXI6IG51bWJlciA9IDJcclxuXHQpOiBzdHJpbmcgPT5cclxuXHJcblx0dG90U3BhY2VzIDo9IHdpZHRoIC0gdGV4dC5sZW5ndGhcclxuXHRpZiAodG90U3BhY2VzIDw9IDApXHJcblx0XHRyZXR1cm4gdGV4dFxyXG5cdG51bUxlZnQgOj0gTWF0aC5mbG9vcih0b3RTcGFjZXMgLyAyKVxyXG5cdG51bVJpZ2h0IDo9IHRvdFNwYWNlcyAtIG51bUxlZnRcclxuXHRpZiAoY2hhciA9PSAnICcpXHJcblx0XHRyZXR1cm4gc3BhY2VzKG51bUxlZnQpICsgdGV4dCArIHNwYWNlcyhudW1SaWdodClcclxuXHRlbHNlXHJcblx0XHRidWYgOj0gJyAnLnJlcGVhdChudW1CdWZmZXIpXHJcblx0XHRsZWZ0IDo9IGNoYXIucmVwZWF0KG51bUxlZnQgLSBudW1CdWZmZXIpXHJcblx0XHRyaWdodCA6PSBjaGFyLnJlcGVhdChudW1SaWdodCAtIG51bUJ1ZmZlcilcclxuXHRcdHJldHVybiBsZWZ0ICsgYnVmICsgdGV4dCArIGJ1ZiArIHJpZ2h0XHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuLyoqXHJcbiAqIHBhZCBhIHN0cmluZyBvbiB0aGUgbGVmdCwgcmlnaHQsIG9yIGJvdGhcclxuICogdG8gdGhlIGdpdmVuIHdpZHRoXHJcbiAqL1xyXG5cclxuZXhwb3J0IHR5cGUgVEFsaWdubWVudCA9ICdsJ3wnYyd8J3InfCdsZWZ0J3wnY2VudGVyJ3wncmlnaHQnXHJcblxyXG5leHBvcnQgaXNBbGlnbm1lbnQgOj0gKHg6IGFueSk6IHggaXMgVEFsaWdubWVudCA9PlxyXG5cclxuXHRyZXR1cm4gWydsJywnYycsJ3InLCdsZWZ0JywnY2VudGVyJywncmlnaHQnXS5pbmNsdWRlcyh4KVxyXG5cclxuZXhwb3J0IGFsaWduU3RyaW5nIDo9IChcclxuXHRzdHI6IHN0cmluZyxcclxuXHR3aWR0aDogbnVtYmVyLFxyXG5cdGFsaWduOiBUQWxpZ25tZW50XHJcblx0KTogc3RyaW5nIC0+XHJcblxyXG5cdHN3aXRjaCBhbGlnblxyXG5cdFx0d2hlbiAnbGVmdCcsICdsJ1xyXG5cdFx0XHRyZXR1cm4gcnBhZChzdHIsIHdpZHRoKVxyXG5cdFx0d2hlbiAnY2VudGVyJywgJ2MnXHJcblx0XHRcdHJldHVybiBjZW50ZXJlZChzdHIsIHdpZHRoKVxyXG5cdFx0d2hlbiAncmlnaHQnLCAncidcclxuXHRcdFx0cmV0dXJuIGxwYWQoc3RyLCB3aWR0aClcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG4vKipcclxuICogY29udmVydHMgdGhlIGdpdmVuIG51bWJlciB0byBhIHN0cmluZywgdGhlbiBwYWRzIG9uIHRoZSBsZWZ0XHJcbiAqIHdpdGggemVyb3MgdG8gYWNoaWV2ZSB0aGUgZ2l2ZW4gbGVuZ3RoXHJcbiAqL1xyXG5cclxuZXhwb3J0IHpwYWQgOj0gKG46IG51bWJlciwgbGVuOiBudW1iZXIpOiBzdHJpbmcgPT5cclxuXHJcblx0cmV0dXJuIGxwYWQobi50b1N0cmluZygpLCBsZW4sICcwJylcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbiMgR0VORVJBVE9SXHJcblxyXG5leHBvcnQgYWxsTWF0Y2hlcyA6PSAoc3RyOiBzdHJpbmcsIHJlOiBSZWdFeHApOiBHZW5lcmF0b3I8c3RyaW5nW10sIHZvaWQsIHZvaWQ+IC0+XHJcblxyXG5cdCMgLS0tIEVuc3VyZSB0aGUgcmVnZXggaGFzIHRoZSBnbG9iYWwgZmxhZyAoZykgc2V0XHJcblx0bmV3cmUgOj0gbmV3IFJlZ0V4cChyZSwgcmUuZmxhZ3MgKyAocmUuZmxhZ3MuaW5jbHVkZXMoJ2cnKSA/ICcnIDogJ2cnKSlcclxuXHRsZXQgbE1hdGNoZXM6IHN0cmluZ1tdIHwgbnVsbCA9IG51bGxcclxuXHR3aGlsZSBkZWZpbmVkKGxNYXRjaGVzID0gbmV3cmUuZXhlYyhzdHIpKVxyXG4gIFx0XHR5aWVsZCBsTWF0Y2hlc1xyXG5cdHJldHVyblxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbi8qKlxyXG4gKiBBIGdlbmVyYXRvciB0aGF0IHlpZWxkcyBpbnRlZ2VycyBzdGFydGluZyB3aXRoIDAgYW5kXHJcbiAqIGNvbnRpbnVpbmcgdG8gbi0xXHJcbiAqL1xyXG5cclxuZXhwb3J0IHJhbmdlIDo9IChcclxuXHRuOiBudW1iZXJcclxuXHQpOiBHZW5lcmF0b3I8bnVtYmVyLCB2b2lkLCB2b2lkPiAtPlxyXG5cclxuXHRsZXQgaSA9IDBcclxuXHR3aGlsZSAoaSA8IG4pXHJcblx0XHR5aWVsZCBpXHJcblx0XHRpID0gaSArIDFcclxuXHRyZXR1cm5cclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgY2xhc3MgRmV0Y2hlcjxUPlxyXG5cclxuXHRpdGVyOiBJdGVyYXRvcjxUPlxyXG5cdGJ1ZmZlcjogVD8gPSB1bmRlZlxyXG5cclxuXHRjb25zdHJ1Y3RvcihAaXRlcjogSXRlcmF0b3I8VD4sIEBlb2ZWYWx1ZTogVClcclxuXHJcblx0cGVlaygpOiBUXHJcblx0XHRpZiBkZWZpbmVkKEBidWZmZXIpXHJcblx0XHRcdHJldHVybiBAYnVmZmVyXHJcblx0XHRlbHNlXHJcblx0XHRcdHt2YWx1ZSwgZG9uZX0gOj0gQGl0ZXIubmV4dCgpXHJcblx0XHRcdGlmIGRvbmVcclxuXHRcdFx0XHRyZXR1cm4gQGVvZlZhbHVlXHJcblx0XHRcdGVsc2VcclxuXHRcdFx0XHRAYnVmZmVyID0gdmFsdWVcclxuXHRcdFx0XHRyZXR1cm4gdmFsdWVcclxuXHJcblx0Z2V0KGV4cGVjdGVkOiBUPz11bmRlZik6IFRcclxuXHRcdGxldCByZXN1bHQ6IFQgPSBAZW9mVmFsdWVcclxuXHRcdGlmIGRlZmluZWQoQGJ1ZmZlcilcclxuXHRcdFx0cmVzdWx0ID0gQGJ1ZmZlclxyXG5cdFx0XHRAYnVmZmVyID0gdW5kZWZcclxuXHRcdGVsc2VcclxuXHRcdFx0e3ZhbHVlLCBkb25lfSA6PSBAaXRlci5uZXh0KClcclxuXHRcdFx0cmVzdWx0ID0gZG9uZSA/IEBlb2ZWYWx1ZSA6IHZhbHVlXHJcblx0XHRpZiBkZWZpbmVkKGV4cGVjdGVkKVxyXG5cdFx0XHRhc3NlcnQgZGVlcEVxdWFsKHJlc3VsdCwgZXhwZWN0ZWQpLFxyXG5cdFx0XHRcdFx0XCIje09MKGV4cGVjdGVkKX0gZXhwZWN0ZWRcIlxyXG5cdFx0cmV0dXJuIHJlc3VsdFxyXG5cclxuXHRza2lwKGV4cGVjdGVkOiBUPz11bmRlZik6IHZvaWRcclxuXHRcdEBnZXQoZXhwZWN0ZWQpXHJcblx0XHRyZXR1cm5cclxuXHJcblx0YXRFbmQoKTogYm9vbGVhblxyXG5cdFx0aWYgZGVmaW5lZChAYnVmZmVyKVxyXG5cdFx0XHRyZXR1cm4gZmFsc2VcclxuXHRcdGVsc2VcclxuXHRcdFx0e3ZhbHVlLCBkb25lfSA6PSBAaXRlci5uZXh0KClcclxuXHRcdFx0aWYgZG9uZSB8fCAodmFsdWUgPT0gQGVvZlZhbHVlKVxyXG5cdFx0XHRcdHJldHVybiB0cnVlXHJcblx0XHRcdGVsc2VcclxuXHRcdFx0XHRAYnVmZmVyID0gdmFsdWVcclxuXHRcdFx0XHRyZXR1cm4gZmFsc2VcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgYXNzZXJ0U2FtZVN0ciA6PSAoXHJcblx0XHRzdHIxOiBzdHJpbmcsXHJcblx0XHRzdHIyOiBzdHJpbmdcclxuXHRcdCk6IHZvaWQgPT5cclxuXHJcblx0aWYgKHN0cjEgIT0gc3RyMilcclxuXHRcdGNvbnNvbGUubG9nIGNlbnRlcmVkKFwiU3RyaW5ncyBEaWZmZXI6XCIsIDY0LCAnLScpXHJcblx0XHRjb25zb2xlLmxvZyBjZW50ZXJlZChcInN0cmluZyAxXCIsIDY0LCAnLScpXHJcblx0XHRjb25zb2xlLmxvZyBzdHIxXHJcblx0XHRjb25zb2xlLmxvZyBjZW50ZXJlZChcInN0cmluZyAyXCIsIDY0LCAnLScpXHJcblx0XHRjb25zb2xlLmxvZyBzdHIyXHJcblx0XHRjb25zb2xlLmxvZyAnLScucmVwZWF0KDY0KVxyXG5cclxuXHRhc3NlcnQgKHN0cjEgPT0gc3RyMiksIFwic3RyaW5ncyBkaWZmZXJcIlxyXG5cdHJldHVyblxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbmV4cG9ydCBpbnRlcnBvbGF0ZSA6PSAoXHJcblx0XHRzdHI6IHN0cmluZ1xyXG5cdFx0aFJlcGxhY2U6IGhhc2hvZjxzdHJpbmc+ICAgIyAtLS0geyA8dGFnPjogPHJlcGxhY2VtZW50PiwgLi4uIH1cclxuXHRcdCk6IHN0cmluZyA9PlxyXG5cclxuXHRmb3Iga2V5IG9mIGtleXMoaFJlcGxhY2UpXHJcblx0XHRhc3NlcnQgKGtleVswXSA9PSAnJCcpLCBcImFsbCBrZXlzIG11c3Qgc3RhcnQgd2l0aCAnJCdcIlxyXG5cdHJlIDo9IC8vL1xyXG5cdFx0XFwkXHJcblx0XHQoPzpbQS1aYS16XVtBLVphLXowLTldKilcclxuXHRcdC8vL2dcclxuXHRyZXR1cm4gc3RyLnJlcGxhY2VBbGwocmUsIChtYXRjaDogc3RyaW5nKSA9PlxyXG5cdFx0cmV0dXJuIGhSZXBsYWNlW21hdGNoXSB8fCBtYXRjaFxyXG5cdFx0KVxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuIyAtLS0gZ2VuZXJhdGUgcmFuZG9tIGxhYmVsc1xyXG5cclxubGFiZWxHZW4gOj0gKCk6IEdlbmVyYXRvcjxzdHJpbmcsIHZvaWQsIHZvaWQ+IC0+XHJcblxyXG5cdGZvciBjaCBvZiBbJ0EnLi4nWiddXHJcblx0XHR5aWVsZCBjaFxyXG5cdGZvciBjaCBvZiBbJ0EnLi4nWiddXHJcblx0XHRmb3IgY2gyIG9mIFsnQScuLidaJ11cclxuXHRcdFx0eWllbGQgY2ggKyBjaDJcclxuXHRmb3IgY2ggb2YgWydBJy4uJ1onXVxyXG5cdFx0Zm9yIGNoMiBvZiBbJ0EnLi4nWiddXHJcblx0XHRcdGZvciBjaDMgb2YgWydBJy4uJ1onXVxyXG5cdFx0XHRcdHlpZWxkIGNoICsgY2gyICsgY2gzXHJcblx0cmV0dXJuXHJcblxyXG4jIC0tLSBDcmVhdGUgYW4gaXRlcmF0b3IgZnJvbSB0aGUgZ2VuZXJhdG9yXHJcbmxhYmVscyA6PSBsYWJlbEdlbigpXHJcblxyXG5leHBvcnQgcmFuZG9tTGFiZWwgOj0gKCk6IHN0cmluZyA9PlxyXG5cdGxhYmVsIDo9IGxhYmVscy5uZXh0KClcclxuXHRyZXR1cm4gbGFiZWwuZG9uZSA/ICdFUlIhJyA6IGxhYmVsLnZhbHVlXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuZXhwb3J0IHJlcXVpcmUgOj0gZ2V0SW1wb3J0U3luYyhpbXBvcnQubWV0YS51cmwpXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuZXhwb3J0IGdldExpbmVBbmRDb2x1bW4gOj0gKHRleHQ6IHN0cmluZywgcG9zOiBudW1iZXIpID0+XHJcblxyXG5cdCMgLS0tIEdldCBsaW5lIG51bWJlciBieSBjb3VudGluZyBudW1iZXIgb2YgXFxuIGNoYXJzXHJcblx0IyAgICAgICAgYmVmb3JlIHRoZSBjdXJyZW50IHBvc2l0aW9uXHJcblx0IyAgICAgR2V0IGNvbHVtbiBudW1iZXIgYnkgZmluZGluZyBjbG9zZXN0IHByZXZpb3VzIHBvc2l0aW9uXHJcblx0IyAgICAgICAgb2YgYSBcXG4gYW5kIGNvbXB1dGluZyB0aGUgZGlmZmVyZW5jZVxyXG5cclxuXHRzaG9ydFN0ciA6PSB0ZXh0LnN1YnN0cmluZygwLCBwb3MpXHJcblx0cmV0dXJuIFtcclxuXHRcdGNvdW50Q2hhcnMoc2hvcnRTdHIsIFwiXFxuXCIpICsgMVxyXG5cdFx0cG9zIC0gc2hvcnRTdHIubGFzdEluZGV4T2YoJ1xcbicpXHJcblx0XHRdXHJcbiJdfQ==