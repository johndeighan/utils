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
	x: unknown,
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

	let ref;switch(typeof x) {
		case 'undefined': {
			ref = 'undefined';break;
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
		case 'object': {
			if (x === null) {
				ref = 'null'
			}
			else if (isArray(x)) {
				const lParts =(()=>{const results=[];for (const item of x) { results.push( stringify(item, hOptions, level+1)) }return results})()
				if (oneLine) {
					ref = '[' + lParts.join(', ') + ']'
				}
				else {
					ref = '[\n' + lParts.join(',\n') + '\n]'
				}
			}
			else if (isHash(x)) {
				const results1=[];for (const key in x) {const val = x[key];
					results1.push(`${key}: ${stringify(val, hOptions, level+1)}`)
				};const lParts =results1
				if (oneLine) {
					ref = '{' + lParts.join(', ') + '}'
				}
				else {
					ref = '{\n' + lParts.join(',\n') + '\n}'
				}
			}
			else {
				ref = "<unknown>"
			};break;
		}
		case 'function': {
			ref = functionDef(x);break;
		}
		default: {
			ref = croak(`Can't stringify ${OL(x)}`)
		}
	};const result: string =ref

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

export const OL = (x: unknown): string => {

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

export const ML = (x: unknown): string => {

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
		lExcept: string | string[]
		}
	const {lExcept} = getOptions<opt>(hOptions, {
		lExcept: []
		})

	const lRealExcept = isString(lExcept) ? [lExcept] : lExcept
	const lKeys: string[] = []
	for (const key of Object.keys(obj)) {
		if (!lRealExcept.includes(key)) {
			lKeys.push(key)
		}
	}
	return lKeys
}

// ---------------------------------------------------------------------------

export const hasKey = (obj: unknown, ...lKeys: string[]) => {

	if ((typeof obj !== 'object') || (obj === null)) {
		return false
	}
	for (const key of lKeys) {
		if (!obj.hasOwnProperty(key)) {
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

export const isBlockSpec = (x: unknown): x is TBlockSpec => {

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

export const isAlignment = (x: unknown): x is TAlignment => {

	return (
		   (typeof x === 'string')
		&& ['l','c','r','left','center','right'].includes(x)
		)
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

export const require = createRequire(import.meta.url)

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

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQzpcXFVzZXJzXFxqb2huZFxcdXRpbHNcXHNyY1xcbGliXFxsbHV0aWxzLmxpYi5jaXZldC50c3giLCJzb3VyY2VzIjpbIkM6XFxVc2Vyc1xcam9obmRcXHV0aWxzXFxzcmNcXGxpYlxcbGx1dGlscy5saWIuY2l2ZXQiXSwibWFwcGluZ3MiOiI7QUFBQSxvQkFBbUI7QUFDbkIsQUFBQTtBQUNBLEssVyx5QjtBQUFBLE1BQU0sQ0FBQyxDQUFDLGFBQWEsQ0FBQyxDQUFDLElBQUksQ0FBQyxhQUFhO0FBQ3pDLEFBQUEsQUFBQSxNQUFNLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxJQUFJLENBQUMsaUJBQWlCO0FBQ3ZDLEFBQUEsQUFBQSxNQUFNLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxJQUFJLENBQUMsV0FBVztBQUNsQyxBQUFBO0FBQ0EsQUFBQSxBQUFBLE1BQU0sQ0FBQyxDQUFDO0FBQ1IsQ0FBQyxLQUFLLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxTQUFTLENBQUM7QUFDckQsQ0FBQyxNQUFNLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDLGdCQUFnQixDQUFDO0FBQ3JELENBQUMsT0FBTyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsU0FBUyxDQUFDO0FBQ2xELENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsUUFBUSxDQUFDO0FBQ2pELENBQUMsY0FBYyxDQUFDLENBQUMsV0FBVyxDQUFDLENBQUMsS0FBSyxDQUFDO0FBQ3BDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxXQUFXO0FBQ25CLEFBQUE7QUFDQSxBQUFBO0FBQ0E7QUFDQSxHQUFHO0FBQ0gsQUFBQTtBQUNBLEFBQUEsQUFBd0Is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QUE7QUFDZixBQUFBLEdBQUcsR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFFLENBQUMsSUFBSSxDQUFDLENBQUEsQ0FBQTtBQUNqQixBQUFBLEksRyxHQUFJLE07R0FBTSxDQUFBO0FBQ1YsQUFBQSxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUEsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFBLENBQUEsQ0FBQTtBQUNyQixBQUFBLElBQVUsTUFBTixNQUFNLENBQUMsQyxDLEMsQyxFLEMsSyxDLE8sRyxDQUFzQyxHQUFHLENBQUMsQ0FBQSxNQUFBLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQyxDLEcsTyxNQUFqRCxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDLEMsRSxPLE8sQyxDLEVBQWU7QUFDOUQsQUFBQSxJQUFJLEdBQUcsQ0FBQSxPQUFPLENBQUEsQ0FBQSxDQUFBO0FBQ2QsQUFBQSxLLEcsR0FBSyxHQUFHLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLEc7SUFBRyxDQUFBO0FBQ2xDLEFBQUEsSUFBSSxJQUFJLENBQUEsQ0FBQTtBQUNSLEFBQUEsSyxHLEdBQUssS0FBSyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxLO0lBQUssQztHQUFBLENBQUE7QUFDdkMsQUFBQSxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUEsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFBLENBQUEsQ0FBQTtBQUNwQixBQUFBLEksSyxDLFEsRyxDQUFjLEdBQUcsQ0FBQyxDQUFBLE1BQUEsR0FBTyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUEsQ0FBQSxDQUFSLE1BQUEsRyxHQUFNLEFBQUMsQyxDQUFYLEcsQyxDQUFZO0FBQzlCLEFBQUEsSyxRLE1BQUssQ0FBQyxFQUFFLEdBQUcsQ0FBQyxFQUFFLEVBQUUsU0FBUyxDQUFDLEdBQUcsQ0FBQyxD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QUEsOEVBQTZFO0FBQzdFLEFBQUE7QUFDQSxBQUFBO0FBQ0E7QUFDQTtBQUNBLEdBQUc7QUFDSCxBQUFBO0FBQ0EsQUFBQSxBQUFBLE1BQU0sQ0FBTyxNQUFOLE1BQU0sQ0FBQyxDQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUEsQ0FBQTtBQUN2QyxBQUFBO0FBQ0EsQUFBQTtBQUNBLEFBQUEsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDO0FBQUMsQ0FBQTtBQUNyQyxBQUFBO0FBQ0EsQUFBQSw4RUFBNkU7QUFDN0UsQUFBQTtBQUNBLEFBQUE7QUFDQTtBQUNBO0FBQ0EsR0FBRztBQUNILEFBQUE7QUFDQSxBQUFBLEFBQUEsTUFBTSxDQUFLLE1BQUosSUFBSSxDQUFDLENBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQSxDQUFBO0FBQ3JDLEFBQUE7QUFDQSxBQUFBLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQztBQUFDLENBQUE7QUFDdEMsQUFBQTtBQUNBLEFBQUEsOEVBQTZFO0FBQzdFLEFBQUE7QUFDQSxBQUFBO0FBQ0E7QUFDQSxHQUFHO0FBQ0gsQUFBQTtBQUNBLEFBQUEsQUFBQSxNQUFNLENBQU0sTUFBTCxLQUFLLENBQUMsQ0FBRSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFBLENBQUE7QUFDekMsQUFBQTtBQUNBLEFBQUEsQ0FBQyxNQUFNLENBQUEsQUFBQyxRQUFR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QUFJLENBQUMsQ0FBQztBQUNyQixBQUFBLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxHQUFFLENBQUMsRUFBRSxDQUFDLENBQUEsQ0FBQTtBQUNsQixBQUFBLEVBQUUsTUFBTSxDQUFDLENBQUMsQztDQUFDLENBQUE7QUFDWCxBQUFBLENBQUMsSUFBSSxDQUFBLENBQUE7QUFDTCxBQUFBLEVBQUUsTUFBTSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsS0FBSyxDO0NBQUMsQztBQUFBLENBQUE7QUFDNUIsQUFBQTtBQUNBLEFBQUEsOEVBQTZFO0FBQzdFLEFBQUE7QUFDQSxBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsR0FBRztBQUNILEFBQUE7QUFDQSxBQUFBLEFBQUEsTUFBTSxDQUFNLE1BQUwsS0FBSyxDQUFDLENBQUUsQ0FBQyxDQUFDLEdBQUcsUUFBUSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUEsQ0FBQTtBQUNwRCxBQUFBO0FBQ0EsQUFBQSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNoQixBQUFBLENBQUMsR0FBRyxDQUFDLENBQUEsTUFBQSxHQUFHLENBQUMsRUFBRSxDQUFDLFFBQVEsQ0FBQSxDQUFBLENBQUE7QUFDcEIsQUFBQSxFQUFFLEdBQUcsQ0FBQyxDQUFBLE1BQUEsSUFBSSxDQUFDLEVBQUUsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUEsQ0FBQSxDQUFBO0FBQzFCLEFBQUEsR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFBLEFBQUMsSUFBSSxDO0VBQUEsQztDQUFBLENBQUE7QUFDbkIsQUFBQSxDQUFDLE1BQU0sQ0FBQyxNO0FBQU0sQ0FBQTtBQUNkLEFBQUE7QUFDQSxBQUFBLDhFQUE2RTtBQUM3RSxBQUFBO0FBQ0EsQUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLEdBQUc7QUFDSCxBQUFBO0FBQ0EsQUFBQSxBQUFBLE1BQU0sQ0FBVSxNQUFULFNBQVMs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QUEsQ0FBQTtBQUNiLEFBQUE7QUFDQSxBQUFBLENBQVUsTUFBVCxTQUFTLENBQUMsQ0FBRSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU07QUFDakMsQUFBQSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFBLENBQUE7QUFDcEIsQUFBQSxFQUFFLE1BQU0sQ0FBQyxJO0NBQUksQ0FBQTtBQUNiLEFBQUEsQ0FBUSxNQUFQLE9BQU8sQ0FBQyxDQUFFLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNyQyxBQUFBLENBQVMsTUFBUixRQUFRLENBQUMsQ0FBRSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsT0FBTztBQUNoQyxBQUFBLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxHQUFFLENBQUMsR0FBRyxDQUFDLENBQUEsQ0FBQTtBQUNqQixBQUFBLEVBQUUsTUFBTSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsUUFBUSxDO0NBQUMsQ0FBQTtBQUNsRCxBQUFBLENBQUMsSUFBSSxDQUFBLENBQUE7QUFDTCxBQUFBLEVBQUssTUFBSCxHQUFHLENBQUMsQ0FBRSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDO0FBQzlCLEFBQUEsRUFBTSxNQUFKLElBQUksQ0FBQyxDQUFFLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQztBQUMxQyxBQUFBLEVBQU8sTUFBTCxLQUFLLENBQUMsQ0FBRSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUM7QUFDNUMsQUFBQSxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxHQUFH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Q0FBQSxJQUFJLENBQUEsQ0FBQSxDQUFBO0FBQ1YsQUFBQSxJQUFJLE1BQU0sQ0FBQyxJLENBQUMsUTtHQUFRLENBQUE7QUFDcEIsQUFBQSxHQUFHLElBQUksQ0FBQSxDQUFBO0FBQ1AsQUFBQSxJQUFJLEksQ0FBQyxNQUFNLEMsQ0FBRSxDQUFDLEtBQUs7QUFDbkIsQUFBQSxJQUFJLE1BQU0sQ0FBQyxLO0dBQUssQztFQUFBLEM7Q0FBQSxDQUFBO0FBQ2hCLEFBQUE7QUFDQSxBQUFBLEMsR0FBSSxDQUFDLFFBQVEsQyxDLENBQUMsQUFBQyxDLFksQ0FBRSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFBLENBQUE7QUFDM0IsQUFBQSxFQUFFLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEksQ0FBQyxRQUFRO0FBQzNCLEFBQUEsRUFBRSxHQUFHLENBQUEsT0FBTyxDQUFDLEksQ0FBQyxNQUFNLENBQUMsQ0FBQSxDQUFBLENBQUE7QUFDckIsQUFBQSxHQUFHLE1BQU0sQyxDQUFFLENBQUMsSSxDQUFDLE1BQU07QUFDbkIsQUFBQSxHQUFHLEksQ0FBQyxNQUFNLEMsQ0FBRSxDQUFDLEs7RUFBSyxDQUFBO0FBQ2xCLEFBQUEsRUFBRSxJQUFJLENBQUEsQ0FBQTtBQUNOLEFBQUEsR0FBZ0IsTUFBYixDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUUsQ0FBQyxJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQ2hDLEFBQUEsR0FBRyxNQUFNLEMsQ0FBRSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsSztFQUFLLENBQUE7QUFDcEMsQUFBQSxFQUFFLEdBQUcsQ0FBQSxPQUFPLENBQUMsUUFBUSxDQUFDLENBQUEsQ0FBQSxDQUFBO0FBQ3RCLEFBQUEsR0FBRyxNQUFNLENBQUEsQUFBQyxTQUFTLENBQUMsTUFBTSxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUM7QUFDdEMsQUFBQSxL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Q0FBQTtBQUNIIiwibmFtZXMiOltdLCJzb3VyY2VzQ29udGVudCI6WyIjIGxsdXRpbHMubGliLmNpdmV0XHJcblxyXG5pbXBvcnQge2NyZWF0ZVJlcXVpcmV9IGZyb20gXCJub2RlOm1vZHVsZVwiXHJcbmltcG9ydCB7c3ByaW50Zn0gZnJvbSBcIkBzdGQvZm10L3ByaW50ZlwiXHJcbmltcG9ydCB7cmVsYXRpdmV9IGZyb20gJ0BzdGQvcGF0aCdcclxuXHJcbmltcG9ydCB7XHJcblx0dW5kZWYsIGRlZmluZWQsIG5vdGRlZmluZWQsIGFzc2VydCwgY2hhciwgZGVlcEVxdWFsLFxyXG5cdGlzSGFzaCwgaXNBcnJheSwgaXNOb25FbXB0eVN0cmluZywgaXNBcnJheU9mU3RyaW5ncyxcclxuXHRpc0VtcHR5LCBub25FbXB0eSwgaXNTdHJpbmcsIGlzT2JqZWN0LCBpc0ludGVnZXIsXHJcblx0aW50ZWdlciwgaGFzaCwgaGFzaG9mLCBhcnJheSwgYXJyYXlvZiwgdm9pZEZ1bmMsXHJcblx0aXNOb25QcmltaXRpdmUsIGZ1bmN0aW9uRGVmLCBjcm9hayxcclxuXHR9IGZyb20gJ2RhdGF0eXBlcydcclxuXHJcbi8qKlxyXG4gKiBAbW9kdWxlIGxsdXRpbHMgLSBsb3cgbGV2ZWwgdXRpbGl0aWVzXHJcbiAqL1xyXG5cclxubGx1dGlsc0xvYWRUaW1lOiBpbnRlZ2VyIDo9IERhdGUubm93KClcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgc2luY2VMb2FkIDo9IChkYXRldGltZTogRGF0ZSB8IGludGVnZXIgPSBEYXRlLm5vdygpKSA9PlxyXG5cclxuXHRpZiAoZGF0ZXRpbWUgaW5zdGFuY2VvZiBEYXRlKVxyXG5cdFx0cmV0dXJuIGRhdGV0aW1lLnZhbHVlT2YoKSAtIGxsdXRpbHNMb2FkVGltZVxyXG5cdGVsc2VcclxuXHRcdHJldHVybiBkYXRldGltZSAtIGxsdXRpbHNMb2FkVGltZVxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbmV4cG9ydCBzaW5jZUxvYWRTdHIgOj0gKGRhdGV0aW1lOiAoRGF0ZSB8IGludGVnZXIpPyA9IHVuZGVmKSA9PlxyXG5cclxuXHRyZXR1cm4gc3ByaW50ZihcIiU2ZFwiLCBzaW5jZUxvYWQoZGF0ZXRpbWUpKVxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbi8qKlxyXG4gKiBBc3NlcnRzIHRoYXQgYGNvbmRgIGlzIHRydWUuIElmIGl0IGlzbid0LCBhbiBleGNlcHRpb24gaXNcclxuICogdGhyb3duIHdpdGggdGhlIGdpdmVuIGBtc2dgXHJcbiAqL1xyXG5cclxuZXhwb3J0IHRocm93c0Vycm9yIDo9IChmdW5jOiB2b2lkRnVuYywgbXNnOiBzdHJpbmc9XCJVbmV4cGVjdGVkIHN1Y2Nlc3NcIik6IHZvaWQgPT5cclxuXHJcblx0dHJ5XHJcblx0XHRmdW5jKClcclxuXHRcdHRocm93IG5ldyBFcnJvcihtc2cpXHJcblx0Y2F0Y2ggZXJyXHJcblx0XHRyZXR1cm4gICAgIyBpZ25vcmUgZXJyb3IgLSBpdCB3YXMgZXhwZWN0ZWRcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG4vKipcclxuICogQ2FsbGluZyBwYXNzKCkgZG9lcyBub3RoaW5nXHJcbiAqL1xyXG5cclxuZXhwb3J0IHBhc3MgOj0gKCk6IHZvaWQgPT4gICAgIyBkbyBub3RoaW5nXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuZXhwb3J0IHRydW5jU3RyIDo9IChzdHI6IHN0cmluZywgbGVuOiBudW1iZXIpID0+XHJcblxyXG5cdGlmIChzdHIubGVuZ3RoIDw9IGxlbilcclxuXHRcdHJldHVybiBzdHJcclxuXHRyZXR1cm4gc3RyLnN1YnN0cmluZygwLCBsZW4tMykgKyAnLi4uJ1xyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbi8qKlxyXG4gKiBzdHJpbmdpZnkgYW55IHZhbHVlLCBzbyB0aGF0IGlmIHdlIHRha2UgdGhlIHJlc3VsdFN0ciwgd2UgY2FuXHJcbiAqICAgIGxldCB4ID0gPHJlc3VsdFN0cj5cclxuICogdG8gcmV0cmlldmUgdGhlIG9yaWdpbmFsIHZhbHVlIChpZiBubyB0cnVuYyBvcHRpb24gaXMgcGFzc2VkIGluKVxyXG4gKi9cclxuXHJcbmV4cG9ydCBzdHJpbmdpZnkgOj0gKFxyXG5cdHg6IHVua25vd24sXHJcblx0aE9wdGlvbnM6IGhhc2g9e31cclxuXHRsZXZlbDogbnVtYmVyPTBcclxuXHQpOiBzdHJpbmcgPT5cclxuXHJcblx0dHlwZSBvcHQgPSB7XHJcblx0XHRvbmVMaW5lOiBib29sZWFuXHJcblx0XHRjb21wcmVzczogYm9vbGVhblxyXG5cdFx0dHJ1bmM6IG51bWJlclxyXG5cdFx0fVxyXG5cdHtvbmVMaW5lLCBjb21wcmVzcywgdHJ1bmNcclxuXHRcdH0gOj0gZ2V0T3B0aW9uczxvcHQ+IGhPcHRpb25zLCB7XHJcblx0XHRvbmVMaW5lOiBmYWxzZVxyXG5cdFx0Y29tcHJlc3M6IHRydWVcclxuXHRcdHRydW5jOiAwXHJcblx0XHR9XHJcblxyXG5cdHJlc3VsdDogc3RyaW5nIDo9IHN3aXRjaCB0eXBlb2YgeFxyXG5cdFx0d2hlbiAndW5kZWZpbmVkJ1xyXG5cdFx0XHQndW5kZWZpbmVkJ1xyXG5cdFx0d2hlbiAnYm9vbGVhbidcclxuXHRcdFx0eCA/ICd0cnVlJyA6ICdmYWxzZSdcclxuXHRcdHdoZW4gJ251bWJlcidcclxuXHRcdFx0eC50b1N0cmluZygpXHJcblx0XHR3aGVuICdiaWdpbnQnXHJcblx0XHRcdHgudG9TdHJpbmcoKSArICduJ1xyXG5cdFx0d2hlbiAnc3RyaW5nJ1xyXG5cdFx0XHRcIlxcXCIje2VzY2FwZVN0cih4LCBvJ3N0eWxlPUMnKX1cXFwiXCJcclxuXHRcdHdoZW4gJ3N5bWJvbCdcclxuXHRcdFx0aWYgZGVmaW5lZCh4LmRlc2NyaXB0aW9uKVxyXG5cdFx0XHRcdFwiU3ltYm9sKFxcXCIje3guZGVzY3JpcHRpb259XFxcIilcIlxyXG5cdFx0XHRlbHNlXHJcblx0XHRcdFx0XCJTeW1ib2woKVwiXHJcblx0XHR3aGVuICdvYmplY3QnXHJcblx0XHRcdGlmICh4ID09IG51bGwpXHJcblx0XHRcdFx0J251bGwnXHJcblx0XHRcdGVsc2UgaWYgaXNBcnJheSh4KVxyXG5cdFx0XHRcdGxQYXJ0cyA6PSBzdHJpbmdpZnkoaXRlbSwgaE9wdGlvbnMsIGxldmVsKzEpIGZvciBpdGVtIG9mIHhcclxuXHRcdFx0XHRpZiBvbmVMaW5lXHJcblx0XHRcdFx0XHQnWycgKyBsUGFydHMuam9pbignLCAnKSArICddJ1xyXG5cdFx0XHRcdGVsc2VcclxuXHRcdFx0XHRcdCdbXFxuJyArIGxQYXJ0cy5qb2luKCcsXFxuJykgKyAnXFxuXSdcclxuXHRcdFx0ZWxzZSBpZiBpc0hhc2goeClcclxuXHRcdFx0XHRsUGFydHMgOj0gZm9yIGtleSx2YWwgaW4geFxyXG5cdFx0XHRcdFx0XCIje2tleX06ICN7c3RyaW5naWZ5KHZhbCwgaE9wdGlvbnMsIGxldmVsKzEpfVwiXHJcblx0XHRcdFx0aWYgb25lTGluZVxyXG5cdFx0XHRcdFx0J3snICsgbFBhcnRzLmpvaW4oJywgJykgKyAnfSdcclxuXHRcdFx0XHRlbHNlXHJcblx0XHRcdFx0XHQne1xcbicgKyBsUGFydHMuam9pbignLFxcbicpICsgJ1xcbn0nXHJcblx0XHRcdGVsc2VcclxuXHRcdFx0XHRcIjx1bmtub3duPlwiXHJcblx0XHR3aGVuICdmdW5jdGlvbidcclxuXHRcdFx0ZnVuY3Rpb25EZWYoeClcclxuXHRcdGVsc2VcclxuXHRcdFx0Y3JvYWsgXCJDYW4ndCBzdHJpbmdpZnkgI3tPTCh4KX1cIlxyXG5cclxuXHRpZiBpc0ludGVnZXIodHJ1bmMpICYmICh0cnVuYyA+IDApXHJcblx0XHRyZXR1cm4gdHJ1bmNTdHIocmVzdWx0LCB0cnVuYylcclxuXHRlbHNlXHJcblx0XHRyZXR1cm4gcmVzdWx0XHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuLyoqXHJcbiAqIEpTT04gc3RyaW5naWZpZXMgeCBvbiBvbmUgbGluZVxyXG4gKi9cclxuXHJcbmV4cG9ydCBPTCA6PSAoeDogdW5rbm93bik6IHN0cmluZyA9PlxyXG5cclxuXHRpZiAoeCA9PSB1bmRlZilcclxuXHRcdHJldHVybiAndW5kZWYnXHJcblx0ZWxzZSBpZiAoeCA9PSBudWxsKVxyXG5cdFx0cmV0dXJuICdudWxsJ1xyXG5cdGVsc2UgaWYgKHR5cGVvZiB4ID09ICdzeW1ib2wnKVxyXG5cdFx0aWYgZGVmaW5lZCh4LmRlc2NyaXB0aW9uKVxyXG5cdFx0XHRyZXR1cm4gXCJbU3ltYm9sICN7eC5kZXNjcmlwdGlvbn1dXCJcclxuXHRcdGVsc2VcclxuXHRcdFx0cmV0dXJuIFwiW1N5bWJvbF1cIlxyXG5cdFx0cmV0dXJuICdzeW1ib2wnXHJcblx0ZWxzZSBpZiAodHlwZW9mIHggPT0gJ2Z1bmN0aW9uJylcclxuXHRcdHJldHVybiB4LnRvU3RyaW5nKCkucmVwbGFjZUFsbCgnXFxuJywgJyAnKVxyXG5cdGVsc2VcclxuXHRcdHN0ciA6PSBKU09OLnN0cmluZ2lmeSh4LCAoayx2KSA9PiBkZWZpbmVkKHYpID8gdiA6ICdfX3VuZGVmX18nKVxyXG5cdFx0cmV0dXJuIHN0ci5yZXBsYWNlQWxsKCdcIl9fdW5kZWZfX1wiJywgJ3VuZGVmaW5lZCcpXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuZXhwb3J0IE1MIDo9ICh4OiB1bmtub3duKTogc3RyaW5nID0+XHJcblxyXG5cdGlmICh4ID09IHVuZGVmKVxyXG5cdFx0cmV0dXJuICd1bmRlZidcclxuXHRlbHNlIGlmICh4ID09IG51bGwpXHJcblx0XHRyZXR1cm4gJ251bGwnXHJcblx0ZWxzZSBpZiAodHlwZW9mIHggPT0gJ2Z1bmN0aW9uJylcclxuXHRcdHJldHVybiB4LnRvU3RyaW5nKClcclxuXHRlbHNlXHJcblx0XHRzdHIgOj0gSlNPTi5zdHJpbmdpZnkoeCwgKGssdikgPT4gZGVmaW5lZCh2KSA/IHYgOiAnX191bmRlZl9fJywgMylcclxuXHRcdGlmIGRlZmluZWQoc3RyKVxyXG5cdFx0XHRyZXR1cm4gc3RyLnJlcGxhY2VBbGwoJ1wiX191bmRlZl9fXCInLCAndW5kZWZpbmVkJylcclxuXHRcdGVsc2VcclxuXHRcdFx0Y29uc29sZS5sb2cgeFxyXG5cdFx0XHRyZXR1cm4gXCJKU09OLnN0cmluZ2lmeSByZXR1cm5lZCB1bmRlZiEhIVwiXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuLyoqXHJcbiAqIENvbnZlcnRzIHRoZSBnaXZlbiBzdHJpbmcgdG8gYSBoYXNoXHJcbiAqIDx3b3JkPiBiZWNvbWVzIGEga2V5IHdpdGggYSB0cnVlIHZhbHVlXHJcbiAqICE8d29yZD4gYmVjb21lcyBhIGtleXMgd2l0aCBhIGZhbHNlIHZhbHVlXHJcbiAqIDx3b3JkPj08c3RyaW5nPiBiZWNvbWVzIGEga2V5IHdpdGggdmFsdWUgPHN0cmluZz5cclxuICogICAgLSA8c3RyaW5nPiBtdXN0IGJlIHF1b3RlZCBpZiBpdCBjb250YWlucyB3aGl0ZXNwYWNlXHJcbiAqL1xyXG5cclxuZXhwb3J0IHN0clRvSGFzaCA6PSAoc3RyOiBzdHJpbmcpOiBoYXNoID0+XHJcblxyXG5cdGlmIGlzRW1wdHkoc3RyKVxyXG5cdFx0cmV0dXJuIHt9XHJcblx0aDogaGFzaCA6PSB7fVxyXG5cdGZvciB3b3JkIG9mIHN0ci50cmltKCkuc3BsaXQoL1xccysvKVxyXG5cdFx0aWYgbE1hdGNoZXM6IHN0cmluZ1tdIHwgbnVsbCA6PSB3b3JkLm1hdGNoKC8vL15cclxuXHRcdFx0XHQoXFwhKT8gICAgICAgICAgICAgICAgICAgICMgbmVnYXRlIHZhbHVlXHJcblx0XHRcdFx0KFtBLVphLXpdW0EtWmEtel8wLTldKikgICMgaWRlbnRpZmllclxyXG5cdFx0XHRcdCg/OlxyXG5cdFx0XHRcdFx0KD0pXHJcblx0XHRcdFx0XHQoLiopXHJcblx0XHRcdFx0XHQpP1xyXG5cdFx0XHRcdCQvLy8pXHJcblx0XHRcdFtfLCBuZWcsIGlkZW50LCBlcVNpZ24sIHN0cl0gOj0gbE1hdGNoZXNcclxuXHRcdFx0aWYgaXNOb25FbXB0eVN0cmluZyhlcVNpZ24pXHJcblx0XHRcdFx0YXNzZXJ0IG5vdGRlZmluZWQobmVnKSB8fCAobmVnID09ICcnKSxcclxuXHRcdFx0XHRcdFx0XCJuZWdhdGlvbiB3aXRoIHN0cmluZyB2YWx1ZVwiXHJcblxyXG5cdFx0XHRcdCMgLS0tIGNoZWNrIGlmIHN0ciBpcyBhIHZhbGlkIG51bWJlclxyXG5cdFx0XHRcdGlmIHN0ci5tYXRjaCgvXi0/XFxkKyhcXC5cXGQrKT8kLylcclxuXHRcdFx0XHRcdG51bSA6PSBwYXJzZUZsb2F0KHN0cilcclxuXHRcdFx0XHRcdGlmIE51bWJlci5pc05hTihudW0pXHJcblx0XHRcdFx0XHRcdCMgLS0tIFRPIERPOiBpbnRlcnByZXQgYmFja3NsYXNoIGVzY2FwZXNcclxuXHRcdFx0XHRcdFx0aFtpZGVudF0gPSBzdHJcclxuXHRcdFx0XHRcdGVsc2VcclxuXHRcdFx0XHRcdFx0aFtpZGVudF0gPSBudW1cclxuXHRcdFx0XHRlbHNlXHJcblx0XHRcdFx0XHRoW2lkZW50XSA9IHN0clxyXG5cdFx0XHRlbHNlIGlmIG5lZ1xyXG5cdFx0XHRcdGhbaWRlbnRdID0gZmFsc2VcclxuXHRcdFx0ZWxzZVxyXG5cdFx0XHRcdGhbaWRlbnRdID0gdHJ1ZVxyXG5cdFx0ZWxzZVxyXG5cdFx0XHRjcm9hayBcIkludmFsaWQgd29yZCAje09MKHdvcmQpfVwiXHJcblx0cmV0dXJuIGhcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgbyA6PSAobFN0cmluZ3M6IFRlbXBsYXRlU3RyaW5nc0FycmF5KTogaGFzaCA9PlxyXG5cclxuXHRyZXR1cm4gc3RyVG9IYXNoKGxTdHJpbmdzWzBdKVxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbi8qKlxyXG4gKiBzIC0gY29udmVydCBsZWFkaW5nIHRhYnMgdG8gc3BhY2VzXHJcbiAqL1xyXG5cclxuZXhwb3J0IHMgOj0gKGxTdHJpbmdzOiBUZW1wbGF0ZVN0cmluZ3NBcnJheSk6IHN0cmluZyA9PlxyXG5cclxuXHRjb25zb2xlLmxvZyBcImNhbGxpbmcgZnVuY3Rpb24gc1wiXHJcblx0cmVwbGFjZXIgOj0gKG1hdGNoOiBzdHJpbmcpOiBzdHJpbmcgPT5cclxuXHRcdGNvbnNvbGUubG9nIFwibWF0Y2ggPSA8I3tlc2NhcGVTdHIobWF0Y2gpfT5cIlxyXG5cdFx0cmVzdWx0IDo9ICcgICAnLnJlcGVhdChtYXRjaC5sZW5ndGgpXHJcblx0XHRjb25zb2xlLmxvZyBcInJlc3VsdCA9IDwje2VzY2FwZVN0cihyZXN1bHQpfT5cIlxyXG5cdFx0cmV0dXJuIHJlc3VsdFxyXG5cdHJldHVybiBsU3RyaW5nc1swXS5yZXBsYWNlQWxsKC9eXFx0Ky9tZywgcmVwbGFjZXIpXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuLyoqXHJcbiAqIHQgLSBjb252ZXJ0IGxlYWRpbmcgc3BhY2VzIHRvIHRhYnNcclxuICovXHJcblxyXG5leHBvcnQgdCA6PSAobFN0cmluZ3M6IFRlbXBsYXRlU3RyaW5nc0FycmF5KTogc3RyaW5nID0+XHJcblxyXG5cdHJlcGxhY2VyIDo9IChtYXRjaDogc3RyaW5nKTogc3RyaW5nID0+XHJcblx0XHRsZXZlbCA6PSBNYXRoLmZsb29yKG1hdGNoLmxlbmd0aCAvIDMpXHJcblx0XHRyZXR1cm4gJ1xcdCcucmVwZWF0KGxldmVsKVxyXG5cdHJldHVybiBsU3RyaW5nc1swXS5yZXBsYWNlQWxsKC9eXFx4MjArL21nLCByZXBsYWNlcilcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG4vKipcclxuICogcmV0dXJucyBhIGhhc2ggb2Ygb3B0aW9ucyB3aXRoIHRoZWlyIHZhbHVlcyxcclxuICogLSBhZGRpbmcgYW55IGRlZmF1bHQgdmFsdWVzIGZyb20gaERlZmF1bHRzXHJcbiAqICAgaWYgdGhleSdyZSBtaXNzaW5nXHJcbiAqL1xyXG5cclxuZXhwb3J0IGdldE9wdGlvbnMgOj0gPFQgZXh0ZW5kcyBoYXNoPihcclxuXHRcdGhPcHRpb25zOiBoYXNoPXt9LFxyXG5cdFx0aERlZmF1bHRzOiBUXHJcblx0XHQpOiBUID0+XHJcblxyXG5cdHJldHVybiB7Li4uaERlZmF1bHRzLCAuLi5oT3B0aW9uc31cclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG4vKipcclxuICogcmVtb3ZlIGFsbCBrZXlzIGZyb20gYSBoYXNoIHRoYXQgaGF2ZSBlaXRoZXIgYW4gZW1wdHkgbmFtZVxyXG4gKiBvciBhbiBlbXB0eSB2YWx1ZVxyXG4gKi9cclxuXHJcbmV4cG9ydCByZW1vdmVFbXB0eUtleXMgOj0gKGg6IGhhc2gpOiBoYXNoID0+XHJcblxyXG5cdGhSZXN1bHQ6IGhhc2ggOj0ge31cclxuXHRmb3Iga2V5IG9mIGtleXMoaClcclxuXHRcdGlmIG5vbkVtcHR5KGtleSkgJiYgbm9uRW1wdHkoaFtrZXldKVxyXG5cdFx0XHRoUmVzdWx0W2tleV0gPSBoW2tleV1cclxuXHRyZXR1cm4gaFJlc3VsdFxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbi8qKlxyXG4gKiByZXR1cm4gYW4gYXJyYXkgb2YgYWxsIG93biBrZXlzIGluIGEgaGFzaFxyXG4gKiB3aXRoIHBvc3NpYmxlIGV4Y2VwdGlvbnNcclxuICovXHJcblxyXG5leHBvcnQga2V5cyA6PSAob2JqOiBoYXNoLCBoT3B0aW9uczogaGFzaD17fSk6IHN0cmluZ1tdID0+XHJcblxyXG5cdHR5cGUgb3B0ID0ge1xyXG5cdFx0bEV4Y2VwdDogc3RyaW5nIHwgc3RyaW5nW11cclxuXHRcdH1cclxuXHR7bEV4Y2VwdH0gOj0gZ2V0T3B0aW9uczxvcHQ+IGhPcHRpb25zLCB7XHJcblx0XHRsRXhjZXB0OiBbXVxyXG5cdFx0fVxyXG5cclxuXHRsUmVhbEV4Y2VwdCA6PSBpc1N0cmluZyhsRXhjZXB0KSA/IFtsRXhjZXB0XSA6IGxFeGNlcHRcclxuXHRsS2V5czogc3RyaW5nW10gOj0gW11cclxuXHRmb3Iga2V5IG9mIE9iamVjdC5rZXlzKG9iailcclxuXHRcdGlmIG5vdCBsUmVhbEV4Y2VwdC5pbmNsdWRlcyhrZXkpXHJcblx0XHRcdGxLZXlzLnB1c2gga2V5XHJcblx0cmV0dXJuIGxLZXlzXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuZXhwb3J0IGhhc0tleSA6PSAob2JqOiB1bmtub3duLCAuLi5sS2V5czogc3RyaW5nW10pID0+XHJcblxyXG5cdGlmICh0eXBlb2Ygb2JqICE9ICdvYmplY3QnKSB8fCAob2JqID09IG51bGwpXHJcblx0XHRyZXR1cm4gZmFsc2VcclxuXHRmb3Iga2V5IG9mIGxLZXlzXHJcblx0XHRpZiBub3Qgb2JqLmhhc093blByb3BlcnR5KGtleSlcclxuXHRcdFx0cmV0dXJuIGZhbHNlXHJcblx0cmV0dXJuIHRydWVcclxuXHJcbmV4cG9ydCBoYXNLZXlzIDo9IGhhc0tleVxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbmV4cG9ydCBtaXNzaW5nS2V5cyA6PSAoaDogaGFzaCwgLi4ubEtleXM6IHN0cmluZ1tdKTogc3RyaW5nW10gPT5cclxuXHJcblx0aWYgbm90ZGVmaW5lZChoKVxyXG5cdFx0cmV0dXJuIGxLZXlzXHJcblx0YXNzZXJ0IGlzSGFzaChoKSwgXCJoIG5vdCBhIGhhc2g6ICN7T0woaCl9XCJcclxuXHRsTWlzc2luZzogc3RyaW5nW10gOj0gW11cclxuXHRmb3Iga2V5IG9mIGxLZXlzXHJcblx0XHRpZiBub3QgaC5oYXNPd25Qcm9wZXJ0eShrZXkpXHJcblx0XHRcdGxNaXNzaW5nLnB1c2gga2V5XHJcblx0cmV0dXJuIGxNaXNzaW5nXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuLyoqXHJcbiAqIG1lcmdlcyB0aGUgcHJvdmlkZWQgb2JqZWN0cyBpbnRvIGEgbmV3IG9iamVjdFxyXG4gKiBOT1RFOiBub25lIG9mIHRoZSBwcm92aWRlZCBhcmd1bWVudHMgYXJlIG1vZGlmaWVkXHJcbiAqL1xyXG5cclxuZXhwb3J0IG1lcmdlIDo9ICguLi5sT2JqZWN0czogaGFzaFtdKTogaGFzaCA9PlxyXG5cclxuXHRyZXR1cm4gT2JqZWN0LmFzc2lnbih7fSwgbE9iamVjdHMuLi4pXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuZXhwb3J0IGhpdCA6PSAocGN0OiBudW1iZXIgPSA1MCk6IGJvb2xlYW4gPT5cclxuXHJcblx0cmV0dXJuICgxMDAgKiBNYXRoLnJhbmRvbSgpIDwgcGN0KVxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuIyAtLS0gQVNZTkMgIVxyXG5cclxuZXhwb3J0IHNsZWVwIDo9IChzZWM6IG51bWJlcik6IHZvaWQgPT5cclxuXHJcblx0YXdhaXQgbmV3IFByb21pc2UoKHIpID0+IHNldFRpbWVvdXQociwgMTAwMCAqIHNlYykpXHJcblx0cmV0dXJuXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuZXhwb3J0IHNsZWVwU3luYyA6PSAoc2VjOiBudW1iZXIpOiB2b2lkID0+XHJcblxyXG5cdHN0YXJ0IDo9IERhdGUubm93KClcclxuXHRlbmQgOj0gRGF0ZS5ub3coKSArIDEwMDAqc2VjXHJcblx0d2hpbGUgKERhdGUubm93KCkgPCBlbmQpXHJcblx0cmV0dXJuXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuLyoqXHJcbiAqIHJldHVybnMgYSBzdHJpbmcgY29uc2lzdGluZyBvZiB0aGUgZ2l2ZW4gbnVtYmVyXHJcbiAqIG9mIHNwYWNlIGNoYXJhY3RlcnNcclxuICovXHJcblxyXG5leHBvcnQgc3BhY2VzIDo9IChuOiBudW1iZXIpOiBzdHJpbmcgPT5cclxuXHJcblxyXG5cdHJldHVybiAobiA8PSAwKSA/ICcnIDogJyAnLnJlcGVhdChuKVxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbi8qKlxyXG4gKiByZXR1cm5zIGEgc3RyaW5nIGNvbnNpc3Rpbmcgb2YgdGhlIGdpdmVuIG51bWJlclxyXG4gKiBvZiBUQUIgY2hhcmFjdGVyc1xyXG4gKi9cclxuXHJcbmV4cG9ydCB0YWJzIDo9IChuOiBudW1iZXIpOiBzdHJpbmcgPT5cclxuXHJcblx0cmV0dXJuIChuIDw9IDApID8gJycgOiAnXFx0Jy5yZXBlYXQobilcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG4vKipcclxuICogcnRyaW0gLSBzdHJpcCB0cmFpbGluZyB3aGl0ZXNwYWNlXHJcbiAqL1xyXG5cclxuZXhwb3J0IHJ0cmltIDo9IChsaW5lOiBzdHJpbmcpOiBzdHJpbmcgPT5cclxuXHJcblx0YXNzZXJ0IGlzU3RyaW5nKGxpbmUpLCBcIm5vdCBhIHN0cmluZzogI3t0eXBlb2YgbGluZX1cIlxyXG5cdGxNYXRjaGVzIDo9IGxpbmUubWF0Y2goL14oLio/KVxccyskLylcclxuXHRyZXR1cm4gKGxNYXRjaGVzID09IG51bGwpID8gbGluZSA6IGxNYXRjaGVzWzFdXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuLyoqXHJcbiAqIENvdW50IHRoZSBudW1iZXIgb2YgYSBzcGVjaWZpYyBjaGFyYWN0ZXIgaW4gYSBzdHJpbmdcclxuICovXHJcblxyXG5leHBvcnQgY291bnRDaGFycyA6PSAoc3RyOiBzdHJpbmcsIGNoOiBzdHJpbmcpOiBudW1iZXIgPT5cclxuXHJcblx0bGV0IGNvdW50ID0gMFxyXG5cdGxldCBwb3MgPSAtMVxyXG5cdHdoaWxlIChwb3MgPSBzdHIuaW5kZXhPZihjaCwgcG9zKzEpKSAhPSAtMVxyXG5cdFx0Y291bnQgKz0gMVxyXG5cdHJldHVybiBjb3VudFxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbi8qKlxyXG4gKiBjb252ZXJ0IGEgbXVsdGktbGluZSBzdHJpbmcgdG8gYW4gYXJyYXlcclxuICogb2Ygc2luZ2xlIGxpbmUgc3RyaW5nc1xyXG4gKi9cclxuXHJcbmV4cG9ydCBibG9ja1RvQXJyYXkgOj0gKGJsb2NrOiBzdHJpbmcpOiBzdHJpbmdbXSA9PlxyXG5cclxuXHRpZiBpc0VtcHR5KGJsb2NrKVxyXG5cdFx0cmV0dXJuIFtdXHJcblx0ZWxzZVxyXG5cdFx0cmV0dXJuIGJsb2NrLnNwbGl0KC9cXHI/XFxuLylcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgYWxsTGluZXNJbkJsb2NrIDo9IChcclxuXHRcdGJsb2NrOiBzdHJpbmdcclxuXHRcdCk6IEdlbmVyYXRvcjxzdHJpbmcsIHZvaWQsIHZvaWQ+IC0+XHJcblxyXG5cdGxldCBzdGFydCA9IDBcclxuXHRsZXQgZW5kID0gYmxvY2suaW5kZXhPZignXFxuJylcclxuXHR3aGlsZSAoZW5kICE9IC0xKVxyXG5cdFx0eWllbGQgYmxvY2suc3Vic3RyaW5nKHN0YXJ0LCBlbmQpXHJcblx0XHRzdGFydCA9IGVuZCArIDFcclxuXHRcdGVuZCA9IGJsb2NrLmluZGV4T2YoJ1xcbicsIHN0YXJ0KVxyXG5cdGlmIChzdGFydCA8IGJsb2NrLmxlbmd0aClcclxuXHRcdHlpZWxkIGJsb2NrLnN1YnN0cmluZyhzdGFydClcclxuXHRyZXR1cm5cclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG4vKipcclxuICogQSBzdHJpbmcgb3Igc3RyaW5nIGFycmF5XHJcbiAqL1xyXG5cclxuZXhwb3J0IHR5cGUgVEJsb2NrU3BlYyA9IHN0cmluZyB8IHN0cmluZ1tdXHJcblxyXG5leHBvcnQgaXNCbG9ja1NwZWMgOj0gKHg6IHVua25vd24pOiB4IGlzIFRCbG9ja1NwZWMgPT5cclxuXHJcblx0cmV0dXJuIGlzU3RyaW5nKHgpIHx8IGlzQXJyYXlPZlN0cmluZ3MoeClcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG4vKipcclxuICogcmV0dXJuIGFuIGFycmF5IGFzIGlzLCBjb252ZXJ0IGEgbXVsdGktbGluZSBzdHJpbmdcclxuICogdG8gYW4gYXJyYXkgb2Ygc2luZ2xlIGxpbmUgc3RyaW5nc1xyXG4gKi9cclxuXHJcbmV4cG9ydCB0b0FycmF5IDo9IChzdHJPckFycmF5OiBUQmxvY2tTcGVjKTogc3RyaW5nW10gPT5cclxuXHJcblx0aWYgQXJyYXkuaXNBcnJheShzdHJPckFycmF5KVxyXG5cdFx0cmV0dXJuIHN0ck9yQXJyYXlcclxuXHRlbHNlXHJcblx0XHRyZXR1cm4gYmxvY2tUb0FycmF5KHN0ck9yQXJyYXkpXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuLyoqXHJcbiAqIGNvbnZlcnQgYW4gYXJyYXkgb2Ygc3RyaW5ncyB0byBhIHNpbmdsZSBtdWx0aS1saW5lIHN0cmluZ1xyXG4gKi9cclxuXHJcbmV4cG9ydCBhcnJheVRvQmxvY2sgOj0gKGxMaW5lczogc3RyaW5nW10pOiBzdHJpbmcgPT5cclxuXHJcblx0YXNzZXJ0IGlzQXJyYXkobExpbmVzKSwgXCJsTGluZXMgaXMgbm90IGFuIGFycmF5OiAje09MKGxMaW5lcyl9XCJcclxuXHRyZXR1cm4gbExpbmVzLmZpbHRlcigobGluZSkgPT4gZGVmaW5lZChsaW5lKSkuam9pbihcIlxcblwiKVxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbi8qKlxyXG4gKiByZXR1cm4gYSBzdHJpbmcgYXMgaXMsIGNvbnZlcnQgYW4gYXJyYXkgb2Ygc3RyaW5nc1xyXG4gKiB0byBhIHNpbmdsZSBtdWx0aS1saW5lIHN0cmluZ1xyXG4gKi9cclxuXHJcbmV4cG9ydCB0b0Jsb2NrIDo9IChzdHJPckFycmF5OiBUQmxvY2tTcGVjKTogc3RyaW5nID0+XHJcblxyXG5cdGlmIGlzU3RyaW5nKHN0ck9yQXJyYXkpXHJcblx0XHRyZXR1cm4gc3RyT3JBcnJheVxyXG5cdGVsc2VcclxuXHRcdHJldHVybiBhcnJheVRvQmxvY2soc3RyT3JBcnJheSlcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgaW52ZXJ0SGFzaCA6PSAoaDogaGFzaCk6IGhhc2ggPT5cclxuXHJcblx0YXNzZXJ0IGlzSGFzaChoKSwgXCJOb3QgYSBoYXNoOiAje09MKGgpfVwiXHJcblx0aFJlc3VsdDogaGFzaCA6PSB7fVxyXG5cdGZvciBrZXkgb2Yga2V5cyhoKVxyXG5cdFx0dmFsdWUgOj0gaFtrZXldXHJcblx0XHRpZiBpc1N0cmluZyh2YWx1ZSlcclxuXHRcdFx0aFJlc3VsdFt2YWx1ZV0gPSBrZXlcclxuXHRyZXR1cm4gaFJlc3VsdFxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbi8qKlxyXG4gKiBieSBkZWZhdWx0LCByZXBsYWNlIHRoZXNlIGNoYXJhY3RlcnM6XHJcbiAqICAgIGNhcnJpYWdlIHJldHVyblxyXG4gKiAgICBuZXdsaW5lXHJcbiAqICAgIFRBQlxyXG4gKiAgICBzcGFjZVxyXG4gKiBPcHRpb25hbGx5LCBhZGQgYSBjaGFyYWN0ZXIgdG8gaW5kaWNhdGUgYSBwYXJ0aWN1bGFyXHJcbiAqIHBvc2l0aW9uIGluIHRoZSBzdHJpbmdcclxuICogVmFsaWQgb3B0aW9uczpcclxuICogICAgb2Zmc2V0IC0gaW5kaWNhdGUgcG9zaXRpb24gb2Ygb2Zmc2V0XHJcbiAqICAgIHBvc2NoYXIgLSBjaGFyIHRvIHVzZSB0byBpbmRpY2F0ZSBwb3NpdGlvblxyXG4gKi9cclxuXHJcbmhEZWJ1Z1JlcGxhY2U6IGhhc2hvZjxzdHJpbmc+IDo9IHtcclxuXHRcIlxcclwiOiAn4oaQJ1xyXG5cdFwiXFxuXCI6ICfihpMnXHJcblx0XCJcXHRcIjogJ+KGkidcclxuXHRcIiBcIjogICfLsydcclxuXHR9XHJcblxyXG5oRGVidWdOb05ld2xpbmVSZXBsYWNlOiBoYXNob2Y8c3RyaW5nPiA6PSB7XHJcblx0XCJcXHRcIjogJ+KGkidcclxuXHRcIiBcIjogICfLsydcclxuXHR9XHJcblxyXG5oQ1JlcGxhY2U6IGhhc2hvZjxzdHJpbmc+IDo9IHtcclxuXHRcIlxcclwiOiAnXFxcXHInXHJcblx0XCJcXG5cIjogJ1xcXFxuJ1xyXG5cdFwiXFx0XCI6ICdcXFxcdCdcclxuXHR9XHJcblxyXG5oQ05vTmV3bGluZVJlcGxhY2U6IGhhc2hvZjxzdHJpbmc+IDo9IHtcclxuXHRcIlxcdFwiOiAnXFxcXHQnXHJcblx0fVxyXG5cclxuZXhwb3J0IGVzY2FwZVN0ciA6PSAoXHJcblx0XHRzdHI6IHN0cmluZ1xyXG5cdFx0aE9wdGlvbnM6IGhhc2ggPSB7fVxyXG5cdFx0KTogc3RyaW5nID0+XHJcblxyXG5cdHR5cGUgb3B0ID0ge1xyXG5cdFx0c3R5bGU6IHN0cmluZ1xyXG5cdFx0aFJlcGxhY2U6IGhhc2hvZjxzdHJpbmc+XHJcblx0XHRibG9jazogYm9vbGVhblxyXG5cdFx0b2Zmc2V0OiBudW1iZXI/XHJcblx0XHRyYW5nZTogbnVtYmVyW10/ICAgICAgIyAtLS0gY2FuIGJlIFtpbnQsIGludF1cclxuXHRcdHBvc2NoYXI6IGNoYXJcclxuXHRcdGJlZ2luY2hhcjogY2hhclxyXG5cdFx0ZW5kY2hhcjogY2hhclxyXG5cdFx0fVxyXG5cdHtcclxuXHRcdHN0eWxlLCBoUmVwbGFjZSwgYmxvY2ssIG9mZnNldCwgcG9zY2hhcixcclxuXHRcdGJlZ2luY2hhciwgZW5kY2hhclxyXG5cdFx0fSA6PSBnZXRPcHRpb25zPG9wdD4gaE9wdGlvbnMsIHtcclxuXHRcdFx0c3R5bGU6ICdkZWJ1ZydcclxuXHRcdFx0aFJlcGxhY2U6IHt9XHJcblx0XHRcdGJsb2NrOiBmYWxzZVxyXG5cdFx0XHRvZmZzZXQ6IHVuZGVmXHJcblx0XHRcdHJhbmdlOiB1bmRlZiAgICAgICMgLS0tIGNhbiBiZSBbaW50LCBpbnRdXHJcblx0XHRcdHBvc2NoYXI6ICfilIonXHJcblx0XHRcdGJlZ2luY2hhcjogJ+KfqCdcclxuXHRcdFx0ZW5kY2hhcjogJ+KfqSdcclxuXHRcdFx0fVxyXG5cclxuXHRsZXQgaFJlYWxSZXBsYWNlOiBoYXNob2Y8c3RyaW5nPiA9IHt9XHJcblx0aWYgbm9uRW1wdHkoaFJlcGxhY2UpXHJcblx0XHRoUmVhbFJlcGxhY2UgPSBoUmVwbGFjZVxyXG5cdGVsc2UgaWYgKHN0eWxlID09ICdDJylcclxuXHRcdGlmIGJsb2NrXHJcblx0XHRcdGhSZWFsUmVwbGFjZSA9IGhDTm9OZXdsaW5lUmVwbGFjZVxyXG5cdFx0ZWxzZVxyXG5cdFx0XHRoUmVhbFJlcGxhY2UgPSBoQ1JlcGxhY2VcclxuXHRlbHNlXHJcblx0XHRpZiBibG9ja1xyXG5cdFx0XHRoUmVhbFJlcGxhY2UgPSBoRGVidWdOb05ld2xpbmVSZXBsYWNlXHJcblx0XHRlbHNlXHJcblx0XHRcdGhSZWFsUmVwbGFjZSA9IGhEZWJ1Z1JlcGxhY2VcclxuXHJcblx0W2JlZ2luUG9zLCBlbmRQb3NdIDo9IChcclxuXHRcdGlmIGRlZmluZWQocmFuZ2UpICYmIGlzQXJyYXkocmFuZ2UpXHJcblx0XHRcdHJhbmdlXHJcblx0XHRlbHNlXHJcblx0XHRcdFt1bmRlZiwgdW5kZWZdXHJcblx0XHQpXHJcblxyXG5cdGxQYXJ0czogc3RyaW5nW10gOj0gW11cclxuXHRmb3IgY2gsaSBvZiBzdHJcclxuXHRcdGlmIChpID09IG9mZnNldClcclxuXHRcdFx0bFBhcnRzLnB1c2ggcG9zY2hhclxyXG5cdFx0ZWxzZSBpZiAoaSA9PSBiZWdpblBvcylcclxuXHRcdFx0bFBhcnRzLnB1c2ggYmVnaW5jaGFyXHJcblx0XHRlbHNlIGlmIChpID09IGVuZFBvcylcclxuXHRcdFx0bFBhcnRzLnB1c2ggZW5kY2hhclxyXG5cdFx0bFBhcnRzLnB1c2ggKGhSZWFsUmVwbGFjZVtjaF0gfHwgY2gpXHJcblx0aWYgKG9mZnNldCA9PSBzdHIubGVuZ3RoKVxyXG5cdFx0bFBhcnRzLnB1c2ggcG9zY2hhclxyXG5cdHJldHVybiBsUGFydHMuam9pbignJylcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgdW5lc2NhcGVTdHIgOj0gKFxyXG5cdFx0c3RyOiBzdHJpbmdcclxuXHRcdGhPcHRpb25zOiBoYXNoID0ge31cclxuXHRcdCk6IHN0cmluZyA9PlxyXG5cclxuXHR0eXBlIG9wdCA9IHtcclxuXHRcdHN0eWxlOiBzdHJpbmdcclxuXHRcdGhSZXBsYWNlOiBoYXNob2Y8c3RyaW5nPlxyXG5cdFx0fVxyXG5cdHtzdHlsZSwgaFJlcGxhY2V9IDo9IGdldE9wdGlvbnM8b3B0PiBoT3B0aW9ucywge1xyXG5cdFx0c3R5bGU6ICdDJ1xyXG5cdFx0aFJlcGxhY2U6IHt9XHJcblx0XHR9XHJcblxyXG5cdGxldCBoUmVhbFJlcGxhY2U6IGhhc2hvZjxzdHJpbmc+ID0ge31cclxuXHRpZiBub25FbXB0eShoUmVwbGFjZSlcclxuXHRcdGhSZWFsUmVwbGFjZSA9IGhSZXBsYWNlXHJcblx0ZWxzZVxyXG5cdFx0aWYgKHN0eWxlID09ICdkZWJ1ZycpXHJcblx0XHRcdGhSZWFsUmVwbGFjZSA9IHtcclxuXHRcdFx0XHQn4oaQJzogJydcclxuXHRcdFx0XHQn4oaTJzogJ1xcbidcclxuXHRcdFx0XHQn4oaSJzogJ1xcdCdcclxuXHRcdFx0XHQny7MnOiAnICdcclxuXHRcdFx0XHR9XHJcblx0XHRlbHNlXHJcblx0XHRcdGhSZWFsUmVwbGFjZSA9IHtcclxuXHRcdFx0XHQnbic6ICdcXG4nXHJcblx0XHRcdFx0J3InOiAnJyAgICAgIyBjYXJyaWFnZSByZXR1cm4gc2hvdWxkIGp1c3QgZGlzYXBwZWFyXHJcblx0XHRcdFx0J3QnOiAnXFx0J1xyXG5cdFx0XHRcdH1cclxuXHJcblx0bGV0IGVzYyA9IGZhbHNlXHJcblx0bFBhcnRzOiBzdHJpbmdbXSA6PSBbXVxyXG5cdGZvciBjaCxpIG9mIHN0clxyXG5cdFx0aWYgKGNoID09ICdcXFxcJylcclxuXHRcdFx0aWYgZXNjXHJcblx0XHRcdFx0bFBhcnRzLnB1c2ggJ1xcXFwnXHJcblx0XHRcdFx0ZXNjID0gZmFsc2VcclxuXHRcdFx0ZWxzZVxyXG5cdFx0XHRcdGVzYyA9IHRydWVcclxuXHRcdGVsc2VcclxuXHRcdFx0aWYgZXNjXHJcblx0XHRcdFx0aWYgZGVmaW5lZChoUmVhbFJlcGxhY2VbY2hdKVxyXG5cdFx0XHRcdFx0bFBhcnRzLnB1c2ggaFJlYWxSZXBsYWNlW2NoXVxyXG5cdFx0XHRcdGVsc2VcclxuXHRcdFx0XHRcdGxQYXJ0cy5wdXNoIGNoXHJcblx0XHRcdFx0ZXNjID0gZmFsc2VcclxuXHRcdFx0ZWxzZVxyXG5cdFx0XHRcdGxQYXJ0cy5wdXNoIGNoXHJcblx0cmV0dXJuIGxQYXJ0cy5qb2luKCcnKVxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbi8qKlxyXG4gKiBkb24ndCBlc2NhcGUgbmV3bGluZSBvciBjYXJyaWFnZSByZXR1cm5cclxuICogT3B0aW9uYWxseSwgYWRkIGEgY2hhcmFjdGVyIHRvIGluZGljYXRlIGEgcGFydGljdWxhclxyXG4gKiBwb3NpdGlvbiBpbiB0aGUgc3RyaW5nXHJcbiAqL1xyXG5cclxuZXhwb3J0IGVzY2FwZUJsb2NrIDo9IChcclxuXHRibG9jazogc3RyaW5nLFxyXG5cdGhPcHRpb25zOiBoYXNoID0ge31cclxuXHQpOiBzdHJpbmcgPT5cclxuXHJcblx0aE9wdGlvbnMuYmxvY2sgPSB0cnVlXHJcblx0cmV0dXJuIGVzY2FwZVN0cihibG9jaywgaE9wdGlvbnMpXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuZXhwb3J0IHJlbHBhdGggOj0gKHBhdGg6IHN0cmluZyk6IHN0cmluZyA9PlxyXG5cclxuXHRyZXR1cm4gcmVsYXRpdmUoRGVuby5jd2QoKSwgcGF0aCkucmVwbGFjZUFsbCgnXFxcXCcsICcvJylcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG4vKipcclxuICogU3BsaXRzIGEgc3RyaW5nIG9uIHdoaXRlc3BhY2UgaW50byBhbiBhcnJheSxcclxuICogaWdub3JpbmcgYW55IGxlYWRpbmcgb3IgdHJhaWxpbmcgd2hpdGVzcGFjZVxyXG4gKi9cclxuXHJcbmV4cG9ydCB3c1NwbGl0IDo9IChzdHI6IHN0cmluZyk6IHN0cmluZ1tdID0+XHJcblxyXG5cdG5ld3N0ciA6PSBzdHIudHJpbSgpXHJcblx0aWYgKG5ld3N0ciA9PSAnJylcclxuXHRcdHJldHVybiBbXVxyXG5cdGVsc2VcclxuXHRcdHJldHVybiBuZXdzdHIuc3BsaXQoL1xccysvKVxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbi8qKlxyXG4gKiBzcGxpdHMgZWFjaCBzdHJpbmcgb24gd2hpdGVzcGFjZSBpZ25vcmluZyBhbnkgbGVhZGluZ1xyXG4gKiBvciB0cmFpbGluZyB3aGl0ZXNwYWNlLCBhbmQgcmV0dXJucyBhbiBhcnJheSBvZlxyXG4gKiBhbGwgc3Vic3RyaW5ncyBvYnRhaW5lZFxyXG4gKi9cclxuXHJcbmV4cG9ydCB3b3JkcyA6PSAoLi4ubFN0cmluZ3M6IHN0cmluZ1tdKTogc3RyaW5nW10gPT5cclxuXHJcblx0bGV0IGxXb3JkcyA9IFtdXHJcblx0Zm9yIHN0ciBvZiBsU3RyaW5nc1xyXG5cdFx0Zm9yIHdvcmQgb2Ygd3NTcGxpdChzdHIpXHJcblx0XHRcdGxXb3Jkcy5wdXNoIHdvcmRcclxuXHRyZXR1cm4gbFdvcmRzXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuLyoqXHJcbiAqIGNhbGN1bGF0ZXMgdGhlIG51bWJlciBvZiBleHRyYSBjaGFyYWN0ZXJzIG5lZWRlZCB0b1xyXG4gKiBtYWtlIHRoZSBnaXZlbiBzdHJpbmcgaGF2ZSB0aGUgZ2l2ZW4gbGVuZ3RoLlxyXG4gKiBJZiBub3QgcG9zc2libGUsIHJldHVybnMgMFxyXG4gKi9cclxuXHJcbmV4cG9ydCBnZXRORXh0cmEgOj0gKHN0cjogc3RyaW5nLCBsZW46IG51bWJlcik6IG51bWJlciA9PlxyXG5cclxuXHRleHRyYSA6PSBsZW4gLSBzdHIubGVuZ3RoXHJcblx0cmV0dXJuIChleHRyYSA+IDApID8gZXh0cmEgOiAwXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuLyoqXHJcbiAqIHBhZHMgdGhlIGdpdmVuIHN0cmluZyBvbiB0aGUgcmlnaHQgd2l0aFxyXG4gKiB0aGUgZ2l2ZW4gY2hhcmFjdGVyLCB0byB0aGUgZ2l2ZW4gbGVuZ3RoXHJcbiAqL1xyXG5cclxuZXhwb3J0IHJwYWQgOj0gKHN0cjogc3RyaW5nLCBsZW46IG51bWJlciwgY2g6IHN0cmluZz0nICcpOiBzdHJpbmcgPT5cclxuXHJcblx0YXNzZXJ0IChjaC5sZW5ndGggPT0gMSksIFwiTm90IGEgY2hhclwiXHJcblx0ZXh0cmEgOj0gZ2V0TkV4dHJhKHN0ciwgbGVuKVxyXG5cdHJldHVybiBzdHIgKyBjaC5yZXBlYXQoZXh0cmEpXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuLyoqXHJcbiAqIHBhZHMgdGhlIGdpdmVuIHN0cmluZyBvbiB0aGUgbGVmdCB3aXRoXHJcbiAqIHRoZSBnaXZlbiBjaGFyYWN0ZXIsIHRvIHRoZSBnaXZlbiBsZW5ndGhcclxuICovXHJcblxyXG5leHBvcnQgbHBhZCA6PSAoc3RyOiBzdHJpbmcsIGxlbjogbnVtYmVyLCBjaDogc3RyaW5nPScgJyk6IHN0cmluZyA9PlxyXG5cclxuXHRhc3NlcnQgKGNoLmxlbmd0aCA9PSAxKSwgXCJOb3QgYSBjaGFyXCJcclxuXHRleHRyYSA6PSBnZXRORXh0cmEoc3RyLCBsZW4pXHJcblx0cmV0dXJuIGNoLnJlcGVhdChleHRyYSkgKyBzdHJcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbiMgLS0tIHZhbGlkIG9wdGlvbnM6XHJcbiMgICAgICAgIGNoYXIgLSBjaGFyIHRvIHVzZSBvbiBsZWZ0IGFuZCByaWdodFxyXG4jICAgICAgICBidWZmZXIgLSBudW0gc3BhY2VzIGFyb3VuZCB0ZXh0IHdoZW4gY2hhciA8PiAnICdcclxuXHJcbi8qKlxyXG4gKiBwYWRzIHRoZSBnaXZlbiBzdHJpbmcgb24gYm90aCB0aGUgbGVmdCBhbmQgcmlnaHRcclxuICogd2l0aCB0aGUgZ2l2ZW4gY2hhcmFjdGVyLCB0byB0aGUgZ2l2ZW4gbGVuZ3RoXHJcbiAqIGJ1dCB3aXRoIHRoZSBnaXZlbiBudW1iZXIgb2YgYnVmZmVyIGNoYXJzIHN1cnJvdW5kaW5nXHJcbiAqIHRoZSB0ZXh0XHJcbiAqL1xyXG5cclxuZXhwb3J0IGNlbnRlcmVkIDo9IChcclxuXHR0ZXh0OiBzdHJpbmcsXHJcblx0d2lkdGg6IG51bWJlcixcclxuXHRjaGFyOiBzdHJpbmcgPSAnICcsXHJcblx0bnVtQnVmZmVyOiBudW1iZXIgPSAyXHJcblx0KTogc3RyaW5nID0+XHJcblxyXG5cdHRvdFNwYWNlcyA6PSB3aWR0aCAtIHRleHQubGVuZ3RoXHJcblx0aWYgKHRvdFNwYWNlcyA8PSAwKVxyXG5cdFx0cmV0dXJuIHRleHRcclxuXHRudW1MZWZ0IDo9IE1hdGguZmxvb3IodG90U3BhY2VzIC8gMilcclxuXHRudW1SaWdodCA6PSB0b3RTcGFjZXMgLSBudW1MZWZ0XHJcblx0aWYgKGNoYXIgPT0gJyAnKVxyXG5cdFx0cmV0dXJuIHNwYWNlcyhudW1MZWZ0KSArIHRleHQgKyBzcGFjZXMobnVtUmlnaHQpXHJcblx0ZWxzZVxyXG5cdFx0YnVmIDo9ICcgJy5yZXBlYXQobnVtQnVmZmVyKVxyXG5cdFx0bGVmdCA6PSBjaGFyLnJlcGVhdChudW1MZWZ0IC0gbnVtQnVmZmVyKVxyXG5cdFx0cmlnaHQgOj0gY2hhci5yZXBlYXQobnVtUmlnaHQgLSBudW1CdWZmZXIpXHJcblx0XHRyZXR1cm4gbGVmdCArIGJ1ZiArIHRleHQgKyBidWYgKyByaWdodFxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbi8qKlxyXG4gKiBwYWQgYSBzdHJpbmcgb24gdGhlIGxlZnQsIHJpZ2h0LCBvciBib3RoXHJcbiAqIHRvIHRoZSBnaXZlbiB3aWR0aFxyXG4gKi9cclxuXHJcbmV4cG9ydCB0eXBlIFRBbGlnbm1lbnQgPSAnbCd8J2MnfCdyJ3wnbGVmdCd8J2NlbnRlcid8J3JpZ2h0J1xyXG5cclxuZXhwb3J0IGlzQWxpZ25tZW50IDo9ICh4OiB1bmtub3duKTogeCBpcyBUQWxpZ25tZW50ID0+XHJcblxyXG5cdHJldHVybiAoXHJcblx0XHQgICAodHlwZW9mIHggPT0gJ3N0cmluZycpXHJcblx0XHQmJiBbJ2wnLCdjJywncicsJ2xlZnQnLCdjZW50ZXInLCdyaWdodCddLmluY2x1ZGVzKHgpXHJcblx0XHQpXHJcblxyXG5leHBvcnQgYWxpZ25TdHJpbmcgOj0gKFxyXG5cdHN0cjogc3RyaW5nLFxyXG5cdHdpZHRoOiBudW1iZXIsXHJcblx0YWxpZ246IFRBbGlnbm1lbnRcclxuXHQpOiBzdHJpbmcgLT5cclxuXHJcblx0c3dpdGNoIGFsaWduXHJcblx0XHR3aGVuICdsZWZ0JywgJ2wnXHJcblx0XHRcdHJldHVybiBycGFkKHN0ciwgd2lkdGgpXHJcblx0XHR3aGVuICdjZW50ZXInLCAnYydcclxuXHRcdFx0cmV0dXJuIGNlbnRlcmVkKHN0ciwgd2lkdGgpXHJcblx0XHR3aGVuICdyaWdodCcsICdyJ1xyXG5cdFx0XHRyZXR1cm4gbHBhZChzdHIsIHdpZHRoKVxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbi8qKlxyXG4gKiBjb252ZXJ0cyB0aGUgZ2l2ZW4gbnVtYmVyIHRvIGEgc3RyaW5nLCB0aGVuIHBhZHMgb24gdGhlIGxlZnRcclxuICogd2l0aCB6ZXJvcyB0byBhY2hpZXZlIHRoZSBnaXZlbiBsZW5ndGhcclxuICovXHJcblxyXG5leHBvcnQgenBhZCA6PSAobjogbnVtYmVyLCBsZW46IG51bWJlcik6IHN0cmluZyA9PlxyXG5cclxuXHRyZXR1cm4gbHBhZChuLnRvU3RyaW5nKCksIGxlbiwgJzAnKVxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuIyBHRU5FUkFUT1JcclxuXHJcbmV4cG9ydCBhbGxNYXRjaGVzIDo9IChzdHI6IHN0cmluZywgcmU6IFJlZ0V4cCk6IEdlbmVyYXRvcjxzdHJpbmdbXSwgdm9pZCwgdm9pZD4gLT5cclxuXHJcblx0IyAtLS0gRW5zdXJlIHRoZSByZWdleCBoYXMgdGhlIGdsb2JhbCBmbGFnIChnKSBzZXRcclxuXHRuZXdyZSA6PSBuZXcgUmVnRXhwKHJlLCByZS5mbGFncyArIChyZS5mbGFncy5pbmNsdWRlcygnZycpID8gJycgOiAnZycpKVxyXG5cdGxldCBsTWF0Y2hlczogc3RyaW5nW10gfCBudWxsID0gbnVsbFxyXG5cdHdoaWxlIGRlZmluZWQobE1hdGNoZXMgPSBuZXdyZS5leGVjKHN0cikpXHJcbiAgXHRcdHlpZWxkIGxNYXRjaGVzXHJcblx0cmV0dXJuXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuLyoqXHJcbiAqIEEgZ2VuZXJhdG9yIHRoYXQgeWllbGRzIGludGVnZXJzIHN0YXJ0aW5nIHdpdGggMCBhbmRcclxuICogY29udGludWluZyB0byBuLTFcclxuICovXHJcblxyXG5leHBvcnQgcmFuZ2UgOj0gKFxyXG5cdG46IG51bWJlclxyXG5cdCk6IEdlbmVyYXRvcjxudW1iZXIsIHZvaWQsIHZvaWQ+IC0+XHJcblxyXG5cdGxldCBpID0gMFxyXG5cdHdoaWxlIChpIDwgbilcclxuXHRcdHlpZWxkIGlcclxuXHRcdGkgPSBpICsgMVxyXG5cdHJldHVyblxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbmV4cG9ydCBjbGFzcyBGZXRjaGVyPFQ+XHJcblxyXG5cdGl0ZXI6IEl0ZXJhdG9yPFQ+XHJcblx0YnVmZmVyOiBUPyA9IHVuZGVmXHJcblxyXG5cdGNvbnN0cnVjdG9yKEBpdGVyOiBJdGVyYXRvcjxUPiwgQGVvZlZhbHVlOiBUKVxyXG5cclxuXHRwZWVrKCk6IFRcclxuXHRcdGlmIGRlZmluZWQoQGJ1ZmZlcilcclxuXHRcdFx0cmV0dXJuIEBidWZmZXJcclxuXHRcdGVsc2VcclxuXHRcdFx0e3ZhbHVlLCBkb25lfSA6PSBAaXRlci5uZXh0KClcclxuXHRcdFx0aWYgZG9uZVxyXG5cdFx0XHRcdHJldHVybiBAZW9mVmFsdWVcclxuXHRcdFx0ZWxzZVxyXG5cdFx0XHRcdEBidWZmZXIgPSB2YWx1ZVxyXG5cdFx0XHRcdHJldHVybiB2YWx1ZVxyXG5cclxuXHRnZXQoZXhwZWN0ZWQ6IFQ/PXVuZGVmKTogVFxyXG5cdFx0bGV0IHJlc3VsdDogVCA9IEBlb2ZWYWx1ZVxyXG5cdFx0aWYgZGVmaW5lZChAYnVmZmVyKVxyXG5cdFx0XHRyZXN1bHQgPSBAYnVmZmVyXHJcblx0XHRcdEBidWZmZXIgPSB1bmRlZlxyXG5cdFx0ZWxzZVxyXG5cdFx0XHR7dmFsdWUsIGRvbmV9IDo9IEBpdGVyLm5leHQoKVxyXG5cdFx0XHRyZXN1bHQgPSBkb25lID8gQGVvZlZhbHVlIDogdmFsdWVcclxuXHRcdGlmIGRlZmluZWQoZXhwZWN0ZWQpXHJcblx0XHRcdGFzc2VydCBkZWVwRXF1YWwocmVzdWx0LCBleHBlY3RlZCksXHJcblx0XHRcdFx0XHRcIiN7T0woZXhwZWN0ZWQpfSBleHBlY3RlZFwiXHJcblx0XHRyZXR1cm4gcmVzdWx0XHJcblxyXG5cdHNraXAoZXhwZWN0ZWQ6IFQ/PXVuZGVmKTogdm9pZFxyXG5cdFx0QGdldChleHBlY3RlZClcclxuXHRcdHJldHVyblxyXG5cclxuXHRhdEVuZCgpOiBib29sZWFuXHJcblx0XHRpZiBkZWZpbmVkKEBidWZmZXIpXHJcblx0XHRcdHJldHVybiBmYWxzZVxyXG5cdFx0ZWxzZVxyXG5cdFx0XHR7dmFsdWUsIGRvbmV9IDo9IEBpdGVyLm5leHQoKVxyXG5cdFx0XHRpZiBkb25lIHx8ICh2YWx1ZSA9PSBAZW9mVmFsdWUpXHJcblx0XHRcdFx0cmV0dXJuIHRydWVcclxuXHRcdFx0ZWxzZVxyXG5cdFx0XHRcdEBidWZmZXIgPSB2YWx1ZVxyXG5cdFx0XHRcdHJldHVybiBmYWxzZVxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbmV4cG9ydCBhc3NlcnRTYW1lU3RyIDo9IChcclxuXHRcdHN0cjE6IHN0cmluZyxcclxuXHRcdHN0cjI6IHN0cmluZ1xyXG5cdFx0KTogdm9pZCA9PlxyXG5cclxuXHRpZiAoc3RyMSAhPSBzdHIyKVxyXG5cdFx0Y29uc29sZS5sb2cgY2VudGVyZWQoXCJTdHJpbmdzIERpZmZlcjpcIiwgNjQsICctJylcclxuXHRcdGNvbnNvbGUubG9nIGNlbnRlcmVkKFwic3RyaW5nIDFcIiwgNjQsICctJylcclxuXHRcdGNvbnNvbGUubG9nIHN0cjFcclxuXHRcdGNvbnNvbGUubG9nIGNlbnRlcmVkKFwic3RyaW5nIDJcIiwgNjQsICctJylcclxuXHRcdGNvbnNvbGUubG9nIHN0cjJcclxuXHRcdGNvbnNvbGUubG9nICctJy5yZXBlYXQoNjQpXHJcblxyXG5cdGFzc2VydCAoc3RyMSA9PSBzdHIyKSwgXCJzdHJpbmdzIGRpZmZlclwiXHJcblx0cmV0dXJuXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuZXhwb3J0IGludGVycG9sYXRlIDo9IChcclxuXHRcdHN0cjogc3RyaW5nXHJcblx0XHRoUmVwbGFjZTogaGFzaG9mPHN0cmluZz4gICAjIC0tLSB7IDx0YWc+OiA8cmVwbGFjZW1lbnQ+LCAuLi4gfVxyXG5cdFx0KTogc3RyaW5nID0+XHJcblxyXG5cdGZvciBrZXkgb2Yga2V5cyhoUmVwbGFjZSlcclxuXHRcdGFzc2VydCAoa2V5WzBdID09ICckJyksIFwiYWxsIGtleXMgbXVzdCBzdGFydCB3aXRoICckJ1wiXHJcblx0cmUgOj0gLy8vXHJcblx0XHRcXCRcclxuXHRcdCg/OltBLVphLXpdW0EtWmEtejAtOV0qKVxyXG5cdFx0Ly8vZ1xyXG5cdHJldHVybiBzdHIucmVwbGFjZUFsbChyZSwgKG1hdGNoOiBzdHJpbmcpID0+XHJcblx0XHRyZXR1cm4gaFJlcGxhY2VbbWF0Y2hdIHx8IG1hdGNoXHJcblx0XHQpXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4jIC0tLSBnZW5lcmF0ZSByYW5kb20gbGFiZWxzXHJcblxyXG5sYWJlbEdlbiA6PSAoKTogR2VuZXJhdG9yPHN0cmluZywgdm9pZCwgdm9pZD4gLT5cclxuXHJcblx0Zm9yIGNoIG9mIFsnQScuLidaJ11cclxuXHRcdHlpZWxkIGNoXHJcblx0Zm9yIGNoIG9mIFsnQScuLidaJ11cclxuXHRcdGZvciBjaDIgb2YgWydBJy4uJ1onXVxyXG5cdFx0XHR5aWVsZCBjaCArIGNoMlxyXG5cdGZvciBjaCBvZiBbJ0EnLi4nWiddXHJcblx0XHRmb3IgY2gyIG9mIFsnQScuLidaJ11cclxuXHRcdFx0Zm9yIGNoMyBvZiBbJ0EnLi4nWiddXHJcblx0XHRcdFx0eWllbGQgY2ggKyBjaDIgKyBjaDNcclxuXHRyZXR1cm5cclxuXHJcbiMgLS0tIENyZWF0ZSBhbiBpdGVyYXRvciBmcm9tIHRoZSBnZW5lcmF0b3JcclxubGFiZWxzIDo9IGxhYmVsR2VuKClcclxuXHJcbmV4cG9ydCByYW5kb21MYWJlbCA6PSAoKTogc3RyaW5nID0+XHJcblx0bGFiZWwgOj0gbGFiZWxzLm5leHQoKVxyXG5cdHJldHVybiBsYWJlbC5kb25lID8gJ0VSUiEnIDogbGFiZWwudmFsdWVcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgcmVxdWlyZSA6PSBjcmVhdGVSZXF1aXJlKGltcG9ydC5tZXRhLnVybClcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgZ2V0TGluZUFuZENvbHVtbiA6PSAodGV4dDogc3RyaW5nLCBwb3M6IG51bWJlcikgPT5cclxuXHJcblx0IyAtLS0gR2V0IGxpbmUgbnVtYmVyIGJ5IGNvdW50aW5nIG51bWJlciBvZiBcXG4gY2hhcnNcclxuXHQjICAgICAgICBiZWZvcmUgdGhlIGN1cnJlbnQgcG9zaXRpb25cclxuXHQjICAgICBHZXQgY29sdW1uIG51bWJlciBieSBmaW5kaW5nIGNsb3Nlc3QgcHJldmlvdXMgcG9zaXRpb25cclxuXHQjICAgICAgICBvZiBhIFxcbiBhbmQgY29tcHV0aW5nIHRoZSBkaWZmZXJlbmNlXHJcblxyXG5cdHNob3J0U3RyIDo9IHRleHQuc3Vic3RyaW5nKDAsIHBvcylcclxuXHRyZXR1cm4gW1xyXG5cdFx0Y291bnRDaGFycyhzaG9ydFN0ciwgXCJcXG5cIikgKyAxXHJcblx0XHRwb3MgLSBzaG9ydFN0ci5sYXN0SW5kZXhPZignXFxuJylcclxuXHRcdF1cclxuIl19