"use strict";
// llutils.lib.civet

type AutoPromise<T> = Promise<Awaited<T>>;
import {stripAnsiCode} from "@std/fmt/colors"
import {createRequire} from "node:module"
import {sprintf} from "@std/fmt/printf"
import {relative} from '@std/path'

import {sep} from 'base-utils'
import {
	undef, defined, notdefined, assert, char, deepEqual,
	isHash, isArray, isNonEmptyString, isArrayOfStrings,
	isEmpty, nonEmpty, isString, isInteger,
	integer, hash, hashof, array, arrayof, voidFunc,
	isNonPrimitive, functionDef, croak,
	assertIsString, assertIsNumber,
	} from 'datatypes'

export {sep}

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
			ref = croak(`Can't stringify ${x}`)
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
			croak(`Invalid word ${word}`)
		}
	}
	return h
}

// ---------------------------------------------------------------------------

export const o = (lStrings: TemplateStringsArray): hash => {

	return strToHash(lStrings[0])
}

// ---------------------------------------------------------------------------

export const s = (lStrings: TemplateStringsArray): string => {

	const replacer = (match: string): string => {
		return '   '.repeat(match.length)
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

export const getOptions = <T extends hash,>(
		hOptions: hash={},
		hDefaults: T
		): T => {

	return {...hDefaults, ...hOptions}
}

// ---------------------------------------------------------------------------

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

export const keys = (obj: hash): string[] => {

	return Object.keys(obj)
}

// ---------------------------------------------------------------------------

export const hasOwn = Object.hasOwn

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
	assert(isHash(h), `h not a hash: ${h}`)
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

type TLineMapper = (line: string) => string

export const mapEachLine = (
		block: string,
		mapper: TLineMapper
		) => {

	const results2=[];for (const line of allLinesInBlock(block)) {
		results2.push(mapper(line))
	};const lLines =results2
	return lLines.join('\n')
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

	assert(isArray(lLines), `lLines is not an array: ${lLines}`)
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

	assert(isHash(h), `Not a hash: ${h}`)
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
	" ":  '˳',
	"←":  '\\←',
	"↓":  '\\↓',
	"→":  '\\→',
	"˳":  '\\˳',
	"\\": '\\\\'
	}

const hDebugNoNewlineReplace: hashof<string> = {
	"\t": '→',
	" ":  '˳',
	"→":  '\\→',
	"˳":  '\\˳'
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
		style,
		hReplace,
		block,
		offset,
		poschar,
		beginchar,
		endchar
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
			return sep(str, ' ', width)
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
					`${expected} expected`)
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
		console.log(sep("Strings Differ:"))
		console.log(sep("string 1"))
		console.log(str1)
		console.log(sep("string 2"))
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

// ---------------------------------------------------------------------------
// later? allow passing in string[] ???

export const widthOf = (block: string): number => {

	let width = 0
	for (const line of allLinesInBlock(block)) {
		if (line.length > width) {
			width = line.length
		}
	}
	return width
}

// ---------------------------------------------------------------------------

export const heightOf = (block: string): number => {

	return (block === '') ? 0 : block.split('\n').length
}

// ---------------------------------------------------------------------------

export const blockify = (
		lStrings: string[],
		hOptions: hash = {}
		): string => {

	type opt = {
		sep: string
		endsep: string
		width: number
		}
	const {sep, endsep, width,
		} = getOptions<opt>(hOptions, {
		sep: ' ',
		endsep: '',
		width: 64
		})

	const lLines: string[] = []
	const lWords: string[] = []
	let lineLen = endsep.length

	for (const str of lStrings) {
		// --- If adding the string makes the line too long,
		//     output the line and clear the array of words
		if (lineLen + str.length + sep.length > width) {
			lLines.push(lWords.join(sep))
			lWords.length = 0
			lineLen = 0
		}
		lWords.push(str)
		lineLen += str.length + sep.length
	}
	if (lWords.length > 0) {
		lLines.push(lWords.join(sep))
	}
	return lLines.join('\n')
}

// ---------------------------------------------------------------------------

export class CStringSetMap<T = string> extends Map<T, Set<string>> {

	// ..........................................................

	add(key: T, value: string): void {

		const aSet = super.get(key)
		if (defined(aSet)) {
			aSet.add(value)
		}
		else {
			const newSet = new Set<string>()
			newSet.add(value)
			super.set(key, newSet)
		}
		return
	}

	// ..........................................................

	hasKey(key: T): boolean {

		return this.has(key)
	}

	// ..........................................................

	hasValue(val: string): boolean {

		for (const key of this.allKeys()) {
			const set = this.get(key)
			if (defined(set) && set.has(val)) {
				return true
			}
		}
		return false
	}

	// ..........................................................

	*allKeys(): Generator<T, void, void> {

		yield* super.keys()
		return
	}

	// ..........................................................

	*allValues(key: T): Generator<string, void, void> {

		const aSet = super.get(key)
		if (defined(aSet)) {
			yield* aSet.values()
		}
		return
	}

	// ..........................................................

	asString(): string {

		const results3=[];for (const key of this.allKeys()) {
			results3.push(`${key}: ${Array.from(this.allValues(key)).join(' ')}`)
		};const lLines =results3
		return lLines.join('\n')
	}
}

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQzpcXFVzZXJzXFxqb2huZFxcdXRpbHNcXHNyY1xcbGliXFxsbHV0aWxzLmxpYi5jaXZldC50c3giLCJzb3VyY2VzIjpbIkM6XFxVc2Vyc1xcam9obmRcXHV0aWxzXFxzcmNcXGxpYlxcbGx1dGlscy5saWIuY2l2ZXQiXSwibWFwcGluZ3MiOiI7QUFBQSxvQkFBbUI7QUFDbkIsQUFBQTtBQUNBLEssVyx5QjtBQUFBLE1BQU0sQ0FBQyxDQUFDLGFBQWEsQ0FBQyxDQUFDLElBQUksQ0FBQyxpQkFBaUI7QUFDN0MsQUFBQSxBQUFBLE1BQU0sQ0FBQyxDQUFDLGFBQWEsQ0FBQyxDQUFDLElBQUksQ0FBQyxhQUFhO0FBQ3pDLEFBQUEsQUFBQSxNQUFNLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxJQUFJLENBQUMsaUJBQWlCO0FBQ3ZDLEFBQUEsQUFBQSxNQUFNLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxJQUFJLENBQUMsV0FBVztBQUNsQyxBQUFBO0FBQ0EsQUFBQSxBQUFBLE1BQU0sQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxZQUFZO0FBQzlCLEFBQUEsQUFBQSxNQUFNLENBQUMsQ0FBQztBQUNSLENBQUMsS0FBSyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsU0FBUyxDQUFDO0FBQ3JELENBQUMsTUFBTSxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxnQkFBZ0IsQ0FBQztBQUNyRCxDQUFDLE9BQU8sQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLFNBQVMsQ0FBQztBQUN4QyxDQUFDLE9BQU8sQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLFFBQVEsQ0FBQztBQUNqRCxDQUFDLGNBQWMsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxDQUFD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LENBQUE7QUFDaEIsQUFBQSxFQUFFLEtBQUssQ0FBQyxDQUFDLENBQUM7QUFDVixFQUFFLENBQUMsQ0FBQTtBQUNILEFBQUE7QUFDQSxBQUFBLEMsSSxHLENBQW1CLE1BQU0sQ0FBQSxBQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUEsQ0FBQSxDQUFBO0FBQ2xDLEFBQUEsRUFBRSxJQUFJLENBQUMsV0FBVyxDQUFBLENBQUEsQ0FBQTtBQUNsQixBQUFBLEcsRyxHQUFHLFdBQVcsTztFQUFBLENBQUE7QUFDZCxBQUFBLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQSxDQUFBLENBQUE7QUFDaEIsQUFBQSxHLEcsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsT0FBTyxPO0VBQUEsQ0FBQTtBQUN2QixBQUFBLEVBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQSxDQUFBLENBQUE7QUFDZixBQUFBLEcsRyxHQUFHLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxPO0VBQUEsQ0FBQTtBQUNmLEFBQUEsRUFBRSxJQUFJLENBQUMsUUFBUSxDQUFBLENBQUEsQ0FBQTtBQUNmLEFBQUEsRyxHLEdBQUcsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsTztFQUFBLENBQUE7QUFDckIsQUFBQSxFQUFFLElBQUksQ0FBQyxRQUFRLENBQUEsQ0FBQSxDQUFBO0FBQ2YsQUFBQSxHLEcsR0FBRyxDQUFDLEVBQUUsRUFBRSxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsQyxTQUFVLENBQUMsQ0FBQyxFQUFFLENBQUMsTztFQUFBLENBQUE7QUFDcEMsQUFBQSxFQUFFLElBQUksQ0FBQyxRQUFRLENBQUEsQ0FBQSxDQUFBO0FBQ2YsQUFBQSxHQUFHLEdBQUcsQ0FBQSxPQUFPLENBQUMsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxDQUFBLENBQUEsQ0FBQTtBQUM1QixBQUFBLEksRyxHQUFJLENBQUMsU0FBUyxFQUFFLENBQUMsQ0FBQyxXQUFXLENBQUMsR0FBRyxDO0dBQUMsQ0FBQTtB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QUMsS0FBSyxDQUFDLE1BQU0sQztDQUFDLENBQUE7QUFDbkMsQUFBQSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLFFBQVEsQ0FBQyxDQUFDLFFBQVEsQztBQUFDLENBQUE7QUFDbEQsQUFBQTtBQUNBLEFBQUEsOEVBQTZFO0FBQzdFLEFBQUE7QUFDQSxBQUFBO0FBQ0E7QUFDQSxHQUFHO0FBQ0gsQUFBQTtBQUNBLEFBQUEsQUFBQSxNQUFNLENBQUUsTUFBRCxDQUFDLENBQUMsQ0FBRSxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsb0JBQW9CLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUEsQ0FBQTtBQUN2RCxBQUFBO0FBQ0EsQUFBQSxDQUFTLE1BQVIsUUFBUSxDQUFDLENBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQSxDQUFBO0FBQ3ZDLEFBQUEsRUFBTyxNQUFMLEtBQUssQ0FBQyxDQUFFLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDdkMsQUFBQSxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssQztDQUFDLENBQUE7QUFDM0IsQUFBQSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLFVBQVUsQ0FBQyxDQUFDLFFBQVEsQztBQUFDLENBQUE7QUFDcEQsQUFBQTtBQUNBLEFBQUEsOEVBQTZFO0FBQzdFLEFBQUE7QUFDQSxBQUFBLEFBQUEsTUFBTSxDQUFXLE1BQVYsVUFBVSxDQUFDLENBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsSSxDQUFJLENBQUMsQ0FBQztBQUN0QyxBQUFBLEVBQUUsUUFBUSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ3BCLEFBQUEsRUFBRSxTQUFTLENBQUMs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QUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0FBQ3BCLEFBQUEsQ0FBSSxNQUFILEdBQUcsQ0FBQyxDQUFFLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHO0FBQzdCLEFBQUEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUE7QUFDekIsQUFBQSxDQUFDLE07QUFBTSxDQUFBO0FBQ1AsQUFBQTtBQUNBLEFBQUEsOEVBQTZFO0FBQzdFLEFBQUE7QUFDQSxBQUFBO0FBQ0E7QUFDQTtBQUNBLEdBQUc7QUFDSCxBQUFBO0FBQ0EsQUFBQSxBQUFBLE1BQU0sQ0FBTyxNQUFOLE1BQU0sQ0FBQyxDQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUEsQ0FBQTtBQUN2QyxBQUFBO0FBQ0EsQUFBQTtBQUNBLEFBQUEsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDO0FBQUMsQ0FBQTtBQUNyQyxBQUFBO0FBQ0EsQUFBQSw4RUFBNkU7QUFDN0UsQUFBQTtBQUNBLEFBQUE7QUFDQTtBQUNBO0FBQ0EsR0FBRztBQUNILEFBQUE7QUFDQSxBQUFBLEFBQUEsTUFBTSxDQUFLLE1BQUosSUFBSSxDQUFDLENBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQSxDQUFBO0FBQ3JDLEFBQUE7QUFDQSxBQUFBLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxD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Q0FBQSxBQUFDLElBQUksQztFQUFBLEM7Q0FBQSxDQUFBO0FBQ25CLEFBQUEsQ0FBQyxNQUFNLENBQUMsTTtBQUFNLENBQUE7QUFDZCxBQUFBO0FBQ0EsQUFBQSw4RUFBNkU7QUFDN0UsQUFBQTtBQUNBLEFBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQSxHQUFHO0FBQ0gsQUFBQTtBQUNBLEFBQUEsQUFBQSxNQUFNLENBQVUsTUFBVCxTQUFTLENBQUMsQ0FBRSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFBLENBQUE7QUFDekQsQUFBQTtBQUNBLEFBQUEsQ0FBTSxNQUFMLEtBQUssQ0FBQyxDQUFFLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsTUFBTTtBQUMxQixBQUFBLENBQUMsTUFBTSxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDO0FBQUMsQ0FBQTtBQUMvQixBQUFBO0FBQ0EsQUFBQSw4RUFBNkU7QUFDN0UsQUFBQTtBQUNBLEFBQUE7QUFDQTtBQUNBO0FBQ0EsR0FBRztBQUNILEFBQUE7QUFDQSxBQUFBLEFBQUEsTUFBTSxDQUFLLE1BQUosSUFBSSxDQUFDLENBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUEsQ0FBQTtBQUNwRSxBQUFBO0FBQ0EsQUFBQSxDQUFDLE1BQU0sQ0FBQSxBQUFDLENBQUMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxHQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxZQUFZLENBQUE7QUFDdEMsQUFBQSxDQUFNLE1BQUwsS0FBSyxDQUFDLENBQUUsQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBRyxDQUFDO0FBQzdCLEFBQUEsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsTUFBTSxDQUFDLEtBQUssQztBQUFDLENBQUE7QUFDOUIsQUFBQTtBQUNBLEFBQUEsOEVBQTZFO0FBQzdFLEFBQUE7QUFDQSxBQUFBO0FBQ0E7QUFDQTtBQUNBLEdBQUc7QUFDSCxBQUFBO0FBQ0EsQUFBQSxBQUFBLE1BQU0sQ0FBSyxNQUFKLElBQUksQ0FBQyxDQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFBLENBQUE7QUFDcEUsQUFBQTtBQUNBLEFBQUEsQ0FBQyxNQUFNLENBQUEsQUFBQyxDQUFDLEVBQUUsQ0FBQyxNQUFNLENBQUMsR0FBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsWUFBWSxDQUFBO0FBQ3RDLEFBQUEsQ0FBTSxNQUFMLEtBQUssQ0FBQyxDQUFFLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQztBQUM3QixBQUFBLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLEc7QUFBRyxDQUFBO0FBQzlCLEFBQUE7QUFDQSxBQUFBLDhFQUE2RTtBQUM3RSxBQUFBO0FBQ0EsQUFBQTtBQUNBO0FBQ0E7QUFDQSxHQUFHO0FBQ0gsQUFBQTtBQUNBLEFBQUEsQUFBQSxNQUFNLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxPQUFPO0FBQzVELEFBQUE7QUFDQSxBQUFBLEFBQUEsTUFBTSxDQUFZLE1BQVgsV0FBVyxDQUFDLENBQUUsQ0FB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Q0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFBLENBQUE7QUFDMUIsQUFBQSxHQUFHLEtBQUssQyxDQUFFLENBQUMsSUFBSSxDQUFDLE07RUFBTSxDO0NBQUEsQ0FBQTtBQUN0QixBQUFBLENBQUMsTUFBTSxDQUFDLEs7QUFBSyxDQUFBO0FBQ2IsQUFBQTtBQUNBLEFBQUEsOEVBQTZFO0FBQzdFLEFBQUE7QUFDQSxBQUFBLEFBQUEsTUFBTSxDQUFTLE1BQVIsUUFBUSxDQUFDLENBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQSxDQUFBO0FBQzdDLEFBQUE7QUFDQSxBQUFBLENBQUMsTUFBTSxDQUFDLENBQUMsS0FBSyxDQUFDLEdBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLE07QUFBTSxDQUFBO0FBQ3BELEFBQUE7QUFDQSxBQUFBLDhFQUE2RTtBQUM3RSxBQUFBO0FBQ0EsQUFBQSxBQUFBLE1BQU0sQ0FBUyxNQUFSLFFBQVEsQ0FBQyxDQUFFLENBQUMsQ0FBQztBQUNwQixBQUFBLEVBQUUsUUFBUSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQTtBQUNwQixBQUFBLEVBQUUsUUFBUSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDckIsRUFBRSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFBLENBQUE7QUFDZCxBQUFBO0FBQ0EsQUFBQSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDYixBQUFBLEVBQUUsR0FBRyxDQUFDLENBQUMsTUFBTTtBQUNiLEFBQUEsRUFBRSxNQUFNLENBQUMsQ0FBQyxNQUFNO0FBQ2hCLEFBQUEsRUFBRSxLQUFLLENBQUMsQ0FBQyxNQUFNO0FBQ2YsRUFBRSxDQUFDO0FBQ0gsQUFBQSxDQUNHLE1BREYsQ0FBQyxH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QUMsRUFBRSxHQUFHLENBQUMsRUFBRSxFQUFFLEtBQUssQ0FBQyxJQUFJLENBQUMsSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDLEM7RUFBQyxDLENBRDdDLE1BQU4sTUFBTSxDQUFDLEMsUUFDNEM7QUFDckQsQUFBQSxFQUFFLE1BQU0sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQztDQUFDLEM7QUFBQSxDQUFBO0FBQzFCIiwibmFtZXMiOltdLCJzb3VyY2VzQ29udGVudCI6WyIjIGxsdXRpbHMubGliLmNpdmV0XHJcblxyXG5pbXBvcnQge3N0cmlwQW5zaUNvZGV9IGZyb20gXCJAc3RkL2ZtdC9jb2xvcnNcIlxyXG5pbXBvcnQge2NyZWF0ZVJlcXVpcmV9IGZyb20gXCJub2RlOm1vZHVsZVwiXHJcbmltcG9ydCB7c3ByaW50Zn0gZnJvbSBcIkBzdGQvZm10L3ByaW50ZlwiXHJcbmltcG9ydCB7cmVsYXRpdmV9IGZyb20gJ0BzdGQvcGF0aCdcclxuXHJcbmltcG9ydCB7c2VwfSBmcm9tICdiYXNlLXV0aWxzJ1xyXG5pbXBvcnQge1xyXG5cdHVuZGVmLCBkZWZpbmVkLCBub3RkZWZpbmVkLCBhc3NlcnQsIGNoYXIsIGRlZXBFcXVhbCxcclxuXHRpc0hhc2gsIGlzQXJyYXksIGlzTm9uRW1wdHlTdHJpbmcsIGlzQXJyYXlPZlN0cmluZ3MsXHJcblx0aXNFbXB0eSwgbm9uRW1wdHksIGlzU3RyaW5nLCBpc0ludGVnZXIsXHJcblx0aW50ZWdlciwgaGFzaCwgaGFzaG9mLCBhcnJheSwgYXJyYXlvZiwgdm9pZEZ1bmMsXHJcblx0aXNOb25QcmltaXRpdmUsIGZ1bmN0aW9uRGVmLCBjcm9hayxcclxuXHRhc3NlcnRJc1N0cmluZywgYXNzZXJ0SXNOdW1iZXIsXHJcblx0fSBmcm9tICdkYXRhdHlwZXMnXHJcblxyXG5leHBvcnQge3NlcH1cclxuXHJcbmxsdXRpbHNMb2FkVGltZTogaW50ZWdlciA6PSBEYXRlLm5vdygpXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuZXhwb3J0IHNpbmNlTG9hZCA6PSAoZGF0ZXRpbWU6IERhdGUgfCBpbnRlZ2VyID0gRGF0ZS5ub3coKSkgPT5cclxuXHJcblx0aWYgKGRhdGV0aW1lIGluc3RhbmNlb2YgRGF0ZSlcclxuXHRcdHJldHVybiBkYXRldGltZS52YWx1ZU9mKCkgLSBsbHV0aWxzTG9hZFRpbWVcclxuXHRlbHNlXHJcblx0XHRyZXR1cm4gZGF0ZXRpbWUgLSBsbHV0aWxzTG9hZFRpbWVcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgc2luY2VMb2FkU3RyIDo9IChkYXRldGltZTogKERhdGUgfCBpbnRlZ2VyKT8gPSB1bmRlZikgPT5cclxuXHJcblx0cmV0dXJuIHNwcmludGYoXCIlNmRcIiwgc2luY2VMb2FkKGRhdGV0aW1lKSlcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG4vKipcclxuICogQXNzZXJ0cyB0aGF0IGBjb25kYCBpcyB0cnVlLiBJZiBpdCBpc24ndCwgYW4gZXhjZXB0aW9uIGlzXHJcbiAqIHRocm93biB3aXRoIHRoZSBnaXZlbiBgbXNnYFxyXG4gKi9cclxuXHJcbmV4cG9ydCB0aHJvd3NFcnJvciA6PSAoZnVuYzogdm9pZEZ1bmMsIG1zZzogc3RyaW5nPVwiVW5leHBlY3RlZCBzdWNjZXNzXCIpOiB2b2lkID0+XHJcblxyXG5cdHRyeVxyXG5cdFx0ZnVuYygpXHJcblx0XHR0aHJvdyBuZXcgRXJyb3IobXNnKVxyXG5cdGNhdGNoIGVyclxyXG5cdFx0cmV0dXJuICAgICMgaWdub3JlIGVycm9yIC0gaXQgd2FzIGV4cGVjdGVkXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuLyoqXHJcbiAqIENhbGxpbmcgcGFzcygpIGRvZXMgbm90aGluZ1xyXG4gKi9cclxuXHJcbmV4cG9ydCBwYXNzIDo9ICgpOiB2b2lkID0+ICAgICMgZG8gbm90aGluZ1xyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbmV4cG9ydCB0cnVuY1N0ciA6PSAoc3RyOiBzdHJpbmcsIGxlbjogbnVtYmVyKSA9PlxyXG5cclxuXHRpZiAoc3RyLmxlbmd0aCA8PSBsZW4pXHJcblx0XHRyZXR1cm4gc3RyXHJcblx0cmV0dXJuIHN0ci5zdWJzdHJpbmcoMCwgbGVuLTMpICsgJy4uLidcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgc3RyaW5naWZ5IDo9IChcclxuXHR4OiB1bmtub3duLFxyXG5cdGhPcHRpb25zOiBoYXNoPXt9XHJcblx0bGV2ZWw6IG51bWJlcj0wXHJcblx0KTogc3RyaW5nID0+XHJcblxyXG5cdHR5cGUgb3B0ID0ge1xyXG5cdFx0b25lTGluZTogYm9vbGVhblxyXG5cdFx0Y29tcHJlc3M6IGJvb2xlYW5cclxuXHRcdHRydW5jOiBudW1iZXJcclxuXHRcdH1cclxuXHR7b25lTGluZSwgY29tcHJlc3MsIHRydW5jXHJcblx0XHR9IDo9IGdldE9wdGlvbnM8b3B0PiBoT3B0aW9ucywge1xyXG5cdFx0b25lTGluZTogZmFsc2VcclxuXHRcdGNvbXByZXNzOiB0cnVlXHJcblx0XHR0cnVuYzogMFxyXG5cdFx0fVxyXG5cclxuXHRyZXN1bHQ6IHN0cmluZyA6PSBzd2l0Y2ggdHlwZW9mIHhcclxuXHRcdHdoZW4gJ3VuZGVmaW5lZCdcclxuXHRcdFx0J3VuZGVmaW5lZCdcclxuXHRcdHdoZW4gJ2Jvb2xlYW4nXHJcblx0XHRcdHggPyAndHJ1ZScgOiAnZmFsc2UnXHJcblx0XHR3aGVuICdudW1iZXInXHJcblx0XHRcdHgudG9TdHJpbmcoKVxyXG5cdFx0d2hlbiAnYmlnaW50J1xyXG5cdFx0XHR4LnRvU3RyaW5nKCkgKyAnbidcclxuXHRcdHdoZW4gJ3N0cmluZydcclxuXHRcdFx0XCJcXFwiI3tlc2NhcGVTdHIoeCwgbydzdHlsZT1DJyl9XFxcIlwiXHJcblx0XHR3aGVuICdzeW1ib2wnXHJcblx0XHRcdGlmIGRlZmluZWQoeC5kZXNjcmlwdGlvbilcclxuXHRcdFx0XHRcIlN5bWJvbChcXFwiI3t4LmRlc2NyaXB0aW9ufVxcXCIpXCJcclxuXHRcdFx0ZWxzZVxyXG5cdFx0XHRcdFwiU3ltYm9sKClcIlxyXG5cdFx0d2hlbiAnb2JqZWN0J1xyXG5cdFx0XHRpZiAoeCA9PSBudWxsKVxyXG5cdFx0XHRcdCdudWxsJ1xyXG5cdFx0XHRlbHNlIGlmIGlzQXJyYXkoeClcclxuXHRcdFx0XHRsUGFydHMgOj0gc3RyaW5naWZ5KGl0ZW0sIGhPcHRpb25zLCBsZXZlbCsxKSBmb3IgaXRlbSBvZiB4XHJcblx0XHRcdFx0aWYgb25lTGluZVxyXG5cdFx0XHRcdFx0J1snICsgbFBhcnRzLmpvaW4oJywgJykgKyAnXSdcclxuXHRcdFx0XHRlbHNlXHJcblx0XHRcdFx0XHQnW1xcbicgKyBsUGFydHMuam9pbignLFxcbicpICsgJ1xcbl0nXHJcblx0XHRcdGVsc2UgaWYgaXNIYXNoKHgpXHJcblx0XHRcdFx0bFBhcnRzIDo9IGZvciBrZXksdmFsIGluIHhcclxuXHRcdFx0XHRcdFwiI3trZXl9OiAje3N0cmluZ2lmeSh2YWwsIGhPcHRpb25zLCBsZXZlbCsxKX1cIlxyXG5cdFx0XHRcdGlmIG9uZUxpbmVcclxuXHRcdFx0XHRcdCd7JyArIGxQYXJ0cy5qb2luKCcsICcpICsgJ30nXHJcblx0XHRcdFx0ZWxzZVxyXG5cdFx0XHRcdFx0J3tcXG4nICsgbFBhcnRzLmpvaW4oJyxcXG4nKSArICdcXG59J1xyXG5cdFx0XHRlbHNlXHJcblx0XHRcdFx0XCI8dW5rbm93bj5cIlxyXG5cdFx0d2hlbiAnZnVuY3Rpb24nXHJcblx0XHRcdGZ1bmN0aW9uRGVmKHgpXHJcblx0XHRlbHNlXHJcblx0XHRcdGNyb2FrIFwiQ2FuJ3Qgc3RyaW5naWZ5ICN7eH1cIlxyXG5cclxuXHRpZiBpc0ludGVnZXIodHJ1bmMpICYmICh0cnVuYyA+IDApXHJcblx0XHRyZXR1cm4gdHJ1bmNTdHIocmVzdWx0LCB0cnVuYylcclxuXHRlbHNlXHJcblx0XHRyZXR1cm4gcmVzdWx0XHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuZXhwb3J0IHN0clRvSGFzaCA6PSAoc3RyOiBzdHJpbmcpOiBoYXNoID0+XHJcblxyXG5cdGlmIGlzRW1wdHkoc3RyKVxyXG5cdFx0cmV0dXJuIHt9XHJcblx0aDogaGFzaCA6PSB7fVxyXG5cdGZvciB3b3JkIG9mIHN0ci50cmltKCkuc3BsaXQoL1xccysvKVxyXG5cdFx0aWYgbE1hdGNoZXM6IHN0cmluZ1tdIHwgbnVsbCA6PSB3b3JkLm1hdGNoKC8vL15cclxuXHRcdFx0XHQoXFwhKT8gICAgICAgICAgICAgICAgICAgICMgbmVnYXRlIHZhbHVlXHJcblx0XHRcdFx0KFtBLVphLXpdW0EtWmEtel8wLTldKikgICMgaWRlbnRpZmllclxyXG5cdFx0XHRcdCg/OlxyXG5cdFx0XHRcdFx0KD0pXHJcblx0XHRcdFx0XHQoLiopXHJcblx0XHRcdFx0XHQpP1xyXG5cdFx0XHRcdCQvLy8pXHJcblx0XHRcdFtfLCBuZWcsIGlkZW50LCBlcVNpZ24sIHN0cl0gOj0gbE1hdGNoZXNcclxuXHRcdFx0aWYgaXNOb25FbXB0eVN0cmluZyhlcVNpZ24pXHJcblx0XHRcdFx0YXNzZXJ0IG5vdGRlZmluZWQobmVnKSB8fCAobmVnID09ICcnKSxcclxuXHRcdFx0XHRcdFx0XCJuZWdhdGlvbiB3aXRoIHN0cmluZyB2YWx1ZVwiXHJcblxyXG5cdFx0XHRcdCMgLS0tIGNoZWNrIGlmIHN0ciBpcyBhIHZhbGlkIG51bWJlclxyXG5cdFx0XHRcdGlmIHN0ci5tYXRjaCgvXi0/XFxkKyhcXC5cXGQrKT8kLylcclxuXHRcdFx0XHRcdG51bSA6PSBwYXJzZUZsb2F0KHN0cilcclxuXHRcdFx0XHRcdGlmIE51bWJlci5pc05hTihudW0pXHJcblx0XHRcdFx0XHRcdCMgLS0tIFRPIERPOiBpbnRlcnByZXQgYmFja3NsYXNoIGVzY2FwZXNcclxuXHRcdFx0XHRcdFx0aFtpZGVudF0gPSBzdHJcclxuXHRcdFx0XHRcdGVsc2VcclxuXHRcdFx0XHRcdFx0aFtpZGVudF0gPSBudW1cclxuXHRcdFx0XHRlbHNlXHJcblx0XHRcdFx0XHRoW2lkZW50XSA9IHN0clxyXG5cdFx0XHRlbHNlIGlmIG5lZ1xyXG5cdFx0XHRcdGhbaWRlbnRdID0gZmFsc2VcclxuXHRcdFx0ZWxzZVxyXG5cdFx0XHRcdGhbaWRlbnRdID0gdHJ1ZVxyXG5cdFx0ZWxzZVxyXG5cdFx0XHRjcm9hayBcIkludmFsaWQgd29yZCAje3dvcmR9XCJcclxuXHRyZXR1cm4gaFxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbmV4cG9ydCBvIDo9IChsU3RyaW5nczogVGVtcGxhdGVTdHJpbmdzQXJyYXkpOiBoYXNoID0+XHJcblxyXG5cdHJldHVybiBzdHJUb0hhc2gobFN0cmluZ3NbMF0pXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuZXhwb3J0IHMgOj0gKGxTdHJpbmdzOiBUZW1wbGF0ZVN0cmluZ3NBcnJheSk6IHN0cmluZyA9PlxyXG5cclxuXHRyZXBsYWNlciA6PSAobWF0Y2g6IHN0cmluZyk6IHN0cmluZyA9PlxyXG5cdFx0cmV0dXJuICcgICAnLnJlcGVhdChtYXRjaC5sZW5ndGgpXHJcblx0cmV0dXJuIGxTdHJpbmdzWzBdLnJlcGxhY2VBbGwoL15cXHQrL21nLCByZXBsYWNlcilcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG4vKipcclxuICogdCAtIGNvbnZlcnQgbGVhZGluZyBzcGFjZXMgdG8gdGFic1xyXG4gKi9cclxuXHJcbmV4cG9ydCB0IDo9IChsU3RyaW5nczogVGVtcGxhdGVTdHJpbmdzQXJyYXkpOiBzdHJpbmcgPT5cclxuXHJcblx0cmVwbGFjZXIgOj0gKG1hdGNoOiBzdHJpbmcpOiBzdHJpbmcgPT5cclxuXHRcdGxldmVsIDo9IE1hdGguZmxvb3IobWF0Y2gubGVuZ3RoIC8gMylcclxuXHRcdHJldHVybiAnXFx0Jy5yZXBlYXQobGV2ZWwpXHJcblx0cmV0dXJuIGxTdHJpbmdzWzBdLnJlcGxhY2VBbGwoL15cXHgyMCsvbWcsIHJlcGxhY2VyKVxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbmV4cG9ydCBnZXRPcHRpb25zIDo9IDxUIGV4dGVuZHMgaGFzaD4oXHJcblx0XHRoT3B0aW9uczogaGFzaD17fSxcclxuXHRcdGhEZWZhdWx0czogVFxyXG5cdFx0KTogVCA9PlxyXG5cclxuXHRyZXR1cm4gey4uLmhEZWZhdWx0cywgLi4uaE9wdGlvbnN9XHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuZXhwb3J0IHJlbW92ZUVtcHR5S2V5cyA6PSAoaDogaGFzaCk6IGhhc2ggPT5cclxuXHJcblx0aFJlc3VsdDogaGFzaCA6PSB7fVxyXG5cdGZvciBrZXkgb2Yga2V5cyhoKVxyXG5cdFx0aWYgbm9uRW1wdHkoa2V5KSAmJiBub25FbXB0eShoW2tleV0pXHJcblx0XHRcdGhSZXN1bHRba2V5XSA9IGhba2V5XVxyXG5cdHJldHVybiBoUmVzdWx0XHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuZXhwb3J0IGtleXMgOj0gKG9iajogaGFzaCk6IHN0cmluZ1tdID0+XHJcblxyXG5cdHJldHVybiBPYmplY3Qua2V5cyhvYmopXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuZXhwb3J0IGhhc093biA6PSBPYmplY3QuaGFzT3duXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuZXhwb3J0IGhhc0tleSA6PSAob2JqOiB1bmtub3duLCAuLi5sS2V5czogc3RyaW5nW10pID0+XHJcblxyXG5cdGlmICh0eXBlb2Ygb2JqICE9ICdvYmplY3QnKSB8fCAob2JqID09IG51bGwpXHJcblx0XHRyZXR1cm4gZmFsc2VcclxuXHRmb3Iga2V5IG9mIGxLZXlzXHJcblx0XHRpZiBub3Qgb2JqLmhhc093blByb3BlcnR5KGtleSlcclxuXHRcdFx0cmV0dXJuIGZhbHNlXHJcblx0cmV0dXJuIHRydWVcclxuXHJcbmV4cG9ydCBoYXNLZXlzIDo9IGhhc0tleVxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbmV4cG9ydCBtaXNzaW5nS2V5cyA6PSAoaDogaGFzaCwgLi4ubEtleXM6IHN0cmluZ1tdKTogc3RyaW5nW10gPT5cclxuXHJcblx0aWYgbm90ZGVmaW5lZChoKVxyXG5cdFx0cmV0dXJuIGxLZXlzXHJcblx0YXNzZXJ0IGlzSGFzaChoKSwgXCJoIG5vdCBhIGhhc2g6ICN7aH1cIlxyXG5cdGxNaXNzaW5nOiBzdHJpbmdbXSA6PSBbXVxyXG5cdGZvciBrZXkgb2YgbEtleXNcclxuXHRcdGlmIG5vdCBoLmhhc093blByb3BlcnR5KGtleSlcclxuXHRcdFx0bE1pc3NpbmcucHVzaCBrZXlcclxuXHRyZXR1cm4gbE1pc3NpbmdcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG4vKipcclxuICogbWVyZ2VzIHRoZSBwcm92aWRlZCBvYmplY3RzIGludG8gYSBuZXcgb2JqZWN0XHJcbiAqIE5PVEU6IG5vbmUgb2YgdGhlIHByb3ZpZGVkIGFyZ3VtZW50cyBhcmUgbW9kaWZpZWRcclxuICovXHJcblxyXG5leHBvcnQgbWVyZ2UgOj0gKC4uLmxPYmplY3RzOiBoYXNoW10pOiBoYXNoID0+XHJcblxyXG5cdHJldHVybiBPYmplY3QuYXNzaWduKHt9LCBsT2JqZWN0cy4uLilcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgaGl0IDo9IChwY3Q6IG51bWJlciA9IDUwKTogYm9vbGVhbiA9PlxyXG5cclxuXHRyZXR1cm4gKDEwMCAqIE1hdGgucmFuZG9tKCkgPCBwY3QpXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4jIC0tLSBBU1lOQyAhXHJcblxyXG5leHBvcnQgc2xlZXAgOj0gKHNlYzogbnVtYmVyKTogdm9pZCA9PlxyXG5cclxuXHRhd2FpdCBuZXcgUHJvbWlzZSgocikgPT4gc2V0VGltZW91dChyLCAxMDAwICogc2VjKSlcclxuXHRyZXR1cm5cclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgc2xlZXBTeW5jIDo9IChzZWM6IG51bWJlcik6IHZvaWQgPT5cclxuXHJcblx0c3RhcnQgOj0gRGF0ZS5ub3coKVxyXG5cdGVuZCA6PSBEYXRlLm5vdygpICsgMTAwMCpzZWNcclxuXHR3aGlsZSAoRGF0ZS5ub3coKSA8IGVuZClcclxuXHRyZXR1cm5cclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG4vKipcclxuICogcmV0dXJucyBhIHN0cmluZyBjb25zaXN0aW5nIG9mIHRoZSBnaXZlbiBudW1iZXJcclxuICogb2Ygc3BhY2UgY2hhcmFjdGVyc1xyXG4gKi9cclxuXHJcbmV4cG9ydCBzcGFjZXMgOj0gKG46IG51bWJlcik6IHN0cmluZyA9PlxyXG5cclxuXHJcblx0cmV0dXJuIChuIDw9IDApID8gJycgOiAnICcucmVwZWF0KG4pXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuLyoqXHJcbiAqIHJldHVybnMgYSBzdHJpbmcgY29uc2lzdGluZyBvZiB0aGUgZ2l2ZW4gbnVtYmVyXHJcbiAqIG9mIFRBQiBjaGFyYWN0ZXJzXHJcbiAqL1xyXG5cclxuZXhwb3J0IHRhYnMgOj0gKG46IG51bWJlcik6IHN0cmluZyA9PlxyXG5cclxuXHRyZXR1cm4gKG4gPD0gMCkgPyAnJyA6ICdcXHQnLnJlcGVhdChuKVxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbi8qKlxyXG4gKiBydHJpbSAtIHN0cmlwIHRyYWlsaW5nIHdoaXRlc3BhY2VcclxuICovXHJcblxyXG5leHBvcnQgcnRyaW0gOj0gKGxpbmU6IHN0cmluZyk6IHN0cmluZyA9PlxyXG5cclxuXHRhc3NlcnQgaXNTdHJpbmcobGluZSksIFwibm90IGEgc3RyaW5nOiAje3R5cGVvZiBsaW5lfVwiXHJcblx0bE1hdGNoZXMgOj0gbGluZS5tYXRjaCgvXiguKj8pXFxzKyQvKVxyXG5cdHJldHVybiAobE1hdGNoZXMgPT0gbnVsbCkgPyBsaW5lIDogbE1hdGNoZXNbMV1cclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG4vKipcclxuICogQ291bnQgdGhlIG51bWJlciBvZiBhIHNwZWNpZmljIGNoYXJhY3RlciBpbiBhIHN0cmluZ1xyXG4gKi9cclxuXHJcbmV4cG9ydCBjb3VudENoYXJzIDo9IChzdHI6IHN0cmluZywgY2g6IHN0cmluZyk6IG51bWJlciA9PlxyXG5cclxuXHRsZXQgY291bnQgPSAwXHJcblx0bGV0IHBvcyA9IC0xXHJcblx0d2hpbGUgKHBvcyA9IHN0ci5pbmRleE9mKGNoLCBwb3MrMSkpICE9IC0xXHJcblx0XHRjb3VudCArPSAxXHJcblx0cmV0dXJuIGNvdW50XHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuLyoqXHJcbiAqIGNvbnZlcnQgYSBtdWx0aS1saW5lIHN0cmluZyB0byBhbiBhcnJheVxyXG4gKiBvZiBzaW5nbGUgbGluZSBzdHJpbmdzXHJcbiAqL1xyXG5cclxuZXhwb3J0IGJsb2NrVG9BcnJheSA6PSAoYmxvY2s6IHN0cmluZyk6IHN0cmluZ1tdID0+XHJcblxyXG5cdGlmIGlzRW1wdHkoYmxvY2spXHJcblx0XHRyZXR1cm4gW11cclxuXHRlbHNlXHJcblx0XHRyZXR1cm4gYmxvY2suc3BsaXQoL1xccj9cXG4vKVxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbmV4cG9ydCBhbGxMaW5lc0luQmxvY2sgOj0gKFxyXG5cdFx0YmxvY2s6IHN0cmluZ1xyXG5cdFx0KTogR2VuZXJhdG9yPHN0cmluZywgdm9pZCwgdm9pZD4gLT5cclxuXHJcblx0bGV0IHN0YXJ0ID0gMFxyXG5cdGxldCBlbmQgPSBibG9jay5pbmRleE9mKCdcXG4nKVxyXG5cdHdoaWxlIChlbmQgIT0gLTEpXHJcblx0XHR5aWVsZCBibG9jay5zdWJzdHJpbmcoc3RhcnQsIGVuZClcclxuXHRcdHN0YXJ0ID0gZW5kICsgMVxyXG5cdFx0ZW5kID0gYmxvY2suaW5kZXhPZignXFxuJywgc3RhcnQpXHJcblx0aWYgKHN0YXJ0IDwgYmxvY2subGVuZ3RoKVxyXG5cdFx0eWllbGQgYmxvY2suc3Vic3RyaW5nKHN0YXJ0KVxyXG5cdHJldHVyblxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbnR5cGUgVExpbmVNYXBwZXIgPSAobGluZTogc3RyaW5nKSA9PiBzdHJpbmdcclxuXHJcbmV4cG9ydCBtYXBFYWNoTGluZSA6PSAoXHJcblx0XHRibG9jazogc3RyaW5nXHJcblx0XHRtYXBwZXI6IFRMaW5lTWFwcGVyXHJcblx0XHQpID0+XHJcblxyXG5cdGxMaW5lcyA6PSBmb3IgbGluZSBvZiBhbGxMaW5lc0luQmxvY2soYmxvY2spXHJcblx0XHRtYXBwZXIgbGluZVxyXG5cdHJldHVybiBsTGluZXMuam9pbignXFxuJylcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG4vKipcclxuICogQSBzdHJpbmcgb3Igc3RyaW5nIGFycmF5XHJcbiAqL1xyXG5cclxuZXhwb3J0IHR5cGUgVEJsb2NrU3BlYyA9IHN0cmluZyB8IHN0cmluZ1tdXHJcblxyXG5leHBvcnQgaXNCbG9ja1NwZWMgOj0gKHg6IHVua25vd24pOiB4IGlzIFRCbG9ja1NwZWMgPT5cclxuXHJcblx0cmV0dXJuIGlzU3RyaW5nKHgpIHx8IGlzQXJyYXlPZlN0cmluZ3MoeClcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG4vKipcclxuICogcmV0dXJuIGFuIGFycmF5IGFzIGlzLCBjb252ZXJ0IGEgbXVsdGktbGluZSBzdHJpbmdcclxuICogdG8gYW4gYXJyYXkgb2Ygc2luZ2xlIGxpbmUgc3RyaW5nc1xyXG4gKi9cclxuXHJcbmV4cG9ydCB0b0FycmF5IDo9IChzdHJPckFycmF5OiBUQmxvY2tTcGVjKTogc3RyaW5nW10gPT5cclxuXHJcblx0aWYgQXJyYXkuaXNBcnJheShzdHJPckFycmF5KVxyXG5cdFx0cmV0dXJuIHN0ck9yQXJyYXlcclxuXHRlbHNlXHJcblx0XHRyZXR1cm4gYmxvY2tUb0FycmF5KHN0ck9yQXJyYXkpXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuLyoqXHJcbiAqIGNvbnZlcnQgYW4gYXJyYXkgb2Ygc3RyaW5ncyB0byBhIHNpbmdsZSBtdWx0aS1saW5lIHN0cmluZ1xyXG4gKi9cclxuXHJcbmV4cG9ydCBhcnJheVRvQmxvY2sgOj0gKGxMaW5lczogc3RyaW5nW10pOiBzdHJpbmcgPT5cclxuXHJcblx0YXNzZXJ0IGlzQXJyYXkobExpbmVzKSwgXCJsTGluZXMgaXMgbm90IGFuIGFycmF5OiAje2xMaW5lc31cIlxyXG5cdHJldHVybiBsTGluZXMuZmlsdGVyKChsaW5lKSA9PiBkZWZpbmVkKGxpbmUpKS5qb2luKFwiXFxuXCIpXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuLyoqXHJcbiAqIHJldHVybiBhIHN0cmluZyBhcyBpcywgY29udmVydCBhbiBhcnJheSBvZiBzdHJpbmdzXHJcbiAqIHRvIGEgc2luZ2xlIG11bHRpLWxpbmUgc3RyaW5nXHJcbiAqL1xyXG5cclxuZXhwb3J0IHRvQmxvY2sgOj0gKHN0ck9yQXJyYXk6IFRCbG9ja1NwZWMpOiBzdHJpbmcgPT5cclxuXHJcblx0aWYgaXNTdHJpbmcoc3RyT3JBcnJheSlcclxuXHRcdHJldHVybiBzdHJPckFycmF5XHJcblx0ZWxzZVxyXG5cdFx0cmV0dXJuIGFycmF5VG9CbG9jayhzdHJPckFycmF5KVxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbmV4cG9ydCBpbnZlcnRIYXNoIDo9IChoOiBoYXNoKTogaGFzaCA9PlxyXG5cclxuXHRhc3NlcnQgaXNIYXNoKGgpLCBcIk5vdCBhIGhhc2g6ICN7aH1cIlxyXG5cdGhSZXN1bHQ6IGhhc2ggOj0ge31cclxuXHRmb3Iga2V5IG9mIGtleXMoaClcclxuXHRcdHZhbHVlIDo9IGhba2V5XVxyXG5cdFx0aWYgaXNTdHJpbmcodmFsdWUpXHJcblx0XHRcdGhSZXN1bHRbdmFsdWVdID0ga2V5XHJcblx0cmV0dXJuIGhSZXN1bHRcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG4vKipcclxuICogYnkgZGVmYXVsdCwgcmVwbGFjZSB0aGVzZSBjaGFyYWN0ZXJzOlxyXG4gKiAgICBjYXJyaWFnZSByZXR1cm5cclxuICogICAgbmV3bGluZVxyXG4gKiAgICBUQUJcclxuICogICAgc3BhY2VcclxuICogT3B0aW9uYWxseSwgYWRkIGEgY2hhcmFjdGVyIHRvIGluZGljYXRlIGEgcGFydGljdWxhclxyXG4gKiBwb3NpdGlvbiBpbiB0aGUgc3RyaW5nXHJcbiAqIFZhbGlkIG9wdGlvbnM6XHJcbiAqICAgIG9mZnNldCAtIGluZGljYXRlIHBvc2l0aW9uIG9mIG9mZnNldFxyXG4gKiAgICBwb3NjaGFyIC0gY2hhciB0byB1c2UgdG8gaW5kaWNhdGUgcG9zaXRpb25cclxuICovXHJcblxyXG5oRGVidWdSZXBsYWNlOiBoYXNob2Y8c3RyaW5nPiA6PSB7XHJcblx0XCJcXHJcIjogJ+KGkCdcclxuXHRcIlxcblwiOiAn4oaTJ1xyXG5cdFwiXFx0XCI6ICfihpInXHJcblx0XCIgXCI6ICAny7MnXHJcblx0XCLihpBcIjogICdcXFxc4oaQJ1xyXG5cdFwi4oaTXCI6ICAnXFxcXOKGkydcclxuXHRcIuKGklwiOiAgJ1xcXFzihpInXHJcblx0XCLLs1wiOiAgJ1xcXFzLsydcclxuXHRcIlxcXFxcIjogJ1xcXFxcXFxcJ1xyXG5cdH1cclxuXHJcbmhEZWJ1Z05vTmV3bGluZVJlcGxhY2U6IGhhc2hvZjxzdHJpbmc+IDo9IHtcclxuXHRcIlxcdFwiOiAn4oaSJ1xyXG5cdFwiIFwiOiAgJ8uzJ1xyXG5cdFwi4oaSXCI6ICAnXFxcXOKGkidcclxuXHRcIsuzXCI6ICAnXFxcXMuzJ1xyXG5cdH1cclxuXHJcbmhDUmVwbGFjZTogaGFzaG9mPHN0cmluZz4gOj0ge1xyXG5cdFwiXFxyXCI6ICdcXFxccidcclxuXHRcIlxcblwiOiAnXFxcXG4nXHJcblx0XCJcXHRcIjogJ1xcXFx0J1xyXG5cdH1cclxuXHJcbmhDTm9OZXdsaW5lUmVwbGFjZTogaGFzaG9mPHN0cmluZz4gOj0ge1xyXG5cdFwiXFx0XCI6ICdcXFxcdCdcclxuXHR9XHJcblxyXG5leHBvcnQgZXNjYXBlU3RyIDo9IChcclxuXHRcdHN0cjogc3RyaW5nXHJcblx0XHRoT3B0aW9uczogaGFzaCA9IHt9XHJcblx0XHQpOiBzdHJpbmcgPT5cclxuXHJcblx0dHlwZSBvcHQgPSB7XHJcblx0XHRzdHlsZTogc3RyaW5nXHJcblx0XHRoUmVwbGFjZTogaGFzaG9mPHN0cmluZz5cclxuXHRcdGJsb2NrOiBib29sZWFuXHJcblx0XHRvZmZzZXQ6IG51bWJlcj9cclxuXHRcdHJhbmdlOiBudW1iZXJbXT8gICAgICAjIC0tLSBjYW4gYmUgW2ludCwgaW50XVxyXG5cdFx0cG9zY2hhcjogY2hhclxyXG5cdFx0YmVnaW5jaGFyOiBjaGFyXHJcblx0XHRlbmRjaGFyOiBjaGFyXHJcblx0XHR9XHJcblx0e1xyXG5cdFx0c3R5bGUsXHJcblx0XHRoUmVwbGFjZSxcclxuXHRcdGJsb2NrLFxyXG5cdFx0b2Zmc2V0LFxyXG5cdFx0cG9zY2hhcixcclxuXHRcdGJlZ2luY2hhcixcclxuXHRcdGVuZGNoYXJcclxuXHRcdH0gOj0gZ2V0T3B0aW9uczxvcHQ+IGhPcHRpb25zLCB7XHJcblx0XHRcdHN0eWxlOiAnZGVidWcnXHJcblx0XHRcdGhSZXBsYWNlOiB7fVxyXG5cdFx0XHRibG9jazogZmFsc2VcclxuXHRcdFx0b2Zmc2V0OiB1bmRlZlxyXG5cdFx0XHRyYW5nZTogdW5kZWYgICAgICAjIC0tLSBjYW4gYmUgW2ludCwgaW50XVxyXG5cdFx0XHRwb3NjaGFyOiAn4pSKJ1xyXG5cdFx0XHRiZWdpbmNoYXI6ICfin6gnXHJcblx0XHRcdGVuZGNoYXI6ICfin6knXHJcblx0XHRcdH1cclxuXHJcblx0bGV0IGhSZWFsUmVwbGFjZTogaGFzaG9mPHN0cmluZz4gPSB7fVxyXG5cdGlmIG5vbkVtcHR5KGhSZXBsYWNlKVxyXG5cdFx0aFJlYWxSZXBsYWNlID0gaFJlcGxhY2VcclxuXHRlbHNlIGlmIChzdHlsZSA9PSAnQycpXHJcblx0XHRpZiBibG9ja1xyXG5cdFx0XHRoUmVhbFJlcGxhY2UgPSBoQ05vTmV3bGluZVJlcGxhY2VcclxuXHRcdGVsc2VcclxuXHRcdFx0aFJlYWxSZXBsYWNlID0gaENSZXBsYWNlXHJcblx0ZWxzZVxyXG5cdFx0aWYgYmxvY2tcclxuXHRcdFx0aFJlYWxSZXBsYWNlID0gaERlYnVnTm9OZXdsaW5lUmVwbGFjZVxyXG5cdFx0ZWxzZVxyXG5cdFx0XHRoUmVhbFJlcGxhY2UgPSBoRGVidWdSZXBsYWNlXHJcblxyXG5cdFtiZWdpblBvcywgZW5kUG9zXSA6PSAoXHJcblx0XHRpZiBkZWZpbmVkKHJhbmdlKSAmJiBpc0FycmF5KHJhbmdlKVxyXG5cdFx0XHRyYW5nZVxyXG5cdFx0ZWxzZVxyXG5cdFx0XHRbdW5kZWYsIHVuZGVmXVxyXG5cdFx0KVxyXG5cclxuXHRsUGFydHM6IHN0cmluZ1tdIDo9IFtdXHJcblx0Zm9yIGNoLGkgb2Ygc3RyXHJcblx0XHRpZiAoaSA9PSBvZmZzZXQpXHJcblx0XHRcdGxQYXJ0cy5wdXNoIHBvc2NoYXJcclxuXHRcdGVsc2UgaWYgKGkgPT0gYmVnaW5Qb3MpXHJcblx0XHRcdGxQYXJ0cy5wdXNoIGJlZ2luY2hhclxyXG5cdFx0ZWxzZSBpZiAoaSA9PSBlbmRQb3MpXHJcblx0XHRcdGxQYXJ0cy5wdXNoIGVuZGNoYXJcclxuXHRcdGxQYXJ0cy5wdXNoIChoUmVhbFJlcGxhY2VbY2hdIHx8IGNoKVxyXG5cdGlmIChvZmZzZXQgPT0gc3RyLmxlbmd0aClcclxuXHRcdGxQYXJ0cy5wdXNoIHBvc2NoYXJcclxuXHRyZXR1cm4gbFBhcnRzLmpvaW4oJycpXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuZXhwb3J0IHVuZXNjYXBlU3RyIDo9IChcclxuXHRcdHN0cjogc3RyaW5nXHJcblx0XHRoT3B0aW9uczogaGFzaCA9IHt9XHJcblx0XHQpOiBzdHJpbmcgPT5cclxuXHJcblx0dHlwZSBvcHQgPSB7XHJcblx0XHRzdHlsZTogc3RyaW5nXHJcblx0XHRoUmVwbGFjZTogaGFzaG9mPHN0cmluZz5cclxuXHRcdH1cclxuXHR7c3R5bGUsIGhSZXBsYWNlfSA6PSBnZXRPcHRpb25zPG9wdD4gaE9wdGlvbnMsIHtcclxuXHRcdHN0eWxlOiAnQydcclxuXHRcdGhSZXBsYWNlOiB7fVxyXG5cdFx0fVxyXG5cclxuXHRsZXQgaFJlYWxSZXBsYWNlOiBoYXNob2Y8c3RyaW5nPiA9IHt9XHJcblx0aWYgbm9uRW1wdHkoaFJlcGxhY2UpXHJcblx0XHRoUmVhbFJlcGxhY2UgPSBoUmVwbGFjZVxyXG5cdGVsc2VcclxuXHRcdGlmIChzdHlsZSA9PSAnZGVidWcnKVxyXG5cdFx0XHRoUmVhbFJlcGxhY2UgPSB7XHJcblx0XHRcdFx0J+KGkCc6ICcnXHJcblx0XHRcdFx0J+KGkyc6ICdcXG4nXHJcblx0XHRcdFx0J+KGkic6ICdcXHQnXHJcblx0XHRcdFx0J8uzJzogJyAnXHJcblx0XHRcdFx0fVxyXG5cdFx0ZWxzZVxyXG5cdFx0XHRoUmVhbFJlcGxhY2UgPSB7XHJcblx0XHRcdFx0J24nOiAnXFxuJ1xyXG5cdFx0XHRcdCdyJzogJycgICAgICMgY2FycmlhZ2UgcmV0dXJuIHNob3VsZCBqdXN0IGRpc2FwcGVhclxyXG5cdFx0XHRcdCd0JzogJ1xcdCdcclxuXHRcdFx0XHR9XHJcblxyXG5cdGxldCBlc2MgPSBmYWxzZVxyXG5cdGxQYXJ0czogc3RyaW5nW10gOj0gW11cclxuXHRmb3IgY2gsaSBvZiBzdHJcclxuXHRcdGlmIChjaCA9PSAnXFxcXCcpXHJcblx0XHRcdGlmIGVzY1xyXG5cdFx0XHRcdGxQYXJ0cy5wdXNoICdcXFxcJ1xyXG5cdFx0XHRcdGVzYyA9IGZhbHNlXHJcblx0XHRcdGVsc2VcclxuXHRcdFx0XHRlc2MgPSB0cnVlXHJcblx0XHRlbHNlXHJcblx0XHRcdGlmIGVzY1xyXG5cdFx0XHRcdGlmIGRlZmluZWQoaFJlYWxSZXBsYWNlW2NoXSlcclxuXHRcdFx0XHRcdGxQYXJ0cy5wdXNoIGhSZWFsUmVwbGFjZVtjaF1cclxuXHRcdFx0XHRlbHNlXHJcblx0XHRcdFx0XHRsUGFydHMucHVzaCBjaFxyXG5cdFx0XHRcdGVzYyA9IGZhbHNlXHJcblx0XHRcdGVsc2VcclxuXHRcdFx0XHRsUGFydHMucHVzaCBjaFxyXG5cdHJldHVybiBsUGFydHMuam9pbignJylcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG4vKipcclxuICogZG9uJ3QgZXNjYXBlIG5ld2xpbmUgb3IgY2FycmlhZ2UgcmV0dXJuXHJcbiAqIE9wdGlvbmFsbHksIGFkZCBhIGNoYXJhY3RlciB0byBpbmRpY2F0ZSBhIHBhcnRpY3VsYXJcclxuICogcG9zaXRpb24gaW4gdGhlIHN0cmluZ1xyXG4gKi9cclxuXHJcbmV4cG9ydCBlc2NhcGVCbG9jayA6PSAoXHJcblx0YmxvY2s6IHN0cmluZyxcclxuXHRoT3B0aW9uczogaGFzaCA9IHt9XHJcblx0KTogc3RyaW5nID0+XHJcblxyXG5cdGhPcHRpb25zLmJsb2NrID0gdHJ1ZVxyXG5cdHJldHVybiBlc2NhcGVTdHIoYmxvY2ssIGhPcHRpb25zKVxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbmV4cG9ydCByZWxwYXRoIDo9IChwYXRoOiBzdHJpbmcpOiBzdHJpbmcgPT5cclxuXHJcblx0cmV0dXJuIHJlbGF0aXZlKERlbm8uY3dkKCksIHBhdGgpLnJlcGxhY2VBbGwoJ1xcXFwnLCAnLycpXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuLyoqXHJcbiAqIFNwbGl0cyBhIHN0cmluZyBvbiB3aGl0ZXNwYWNlIGludG8gYW4gYXJyYXksXHJcbiAqIGlnbm9yaW5nIGFueSBsZWFkaW5nIG9yIHRyYWlsaW5nIHdoaXRlc3BhY2VcclxuICovXHJcblxyXG5leHBvcnQgd3NTcGxpdCA6PSAoc3RyOiBzdHJpbmcpOiBzdHJpbmdbXSA9PlxyXG5cclxuXHRuZXdzdHIgOj0gc3RyLnRyaW0oKVxyXG5cdGlmIChuZXdzdHIgPT0gJycpXHJcblx0XHRyZXR1cm4gW11cclxuXHRlbHNlXHJcblx0XHRyZXR1cm4gbmV3c3RyLnNwbGl0KC9cXHMrLylcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG4vKipcclxuICogc3BsaXRzIGVhY2ggc3RyaW5nIG9uIHdoaXRlc3BhY2UgaWdub3JpbmcgYW55IGxlYWRpbmdcclxuICogb3IgdHJhaWxpbmcgd2hpdGVzcGFjZSwgYW5kIHJldHVybnMgYW4gYXJyYXkgb2ZcclxuICogYWxsIHN1YnN0cmluZ3Mgb2J0YWluZWRcclxuICovXHJcblxyXG5leHBvcnQgd29yZHMgOj0gKC4uLmxTdHJpbmdzOiBzdHJpbmdbXSk6IHN0cmluZ1tdID0+XHJcblxyXG5cdGxldCBsV29yZHMgPSBbXVxyXG5cdGZvciBzdHIgb2YgbFN0cmluZ3NcclxuXHRcdGZvciB3b3JkIG9mIHdzU3BsaXQoc3RyKVxyXG5cdFx0XHRsV29yZHMucHVzaCB3b3JkXHJcblx0cmV0dXJuIGxXb3Jkc1xyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbi8qKlxyXG4gKiBjYWxjdWxhdGVzIHRoZSBudW1iZXIgb2YgZXh0cmEgY2hhcmFjdGVycyBuZWVkZWQgdG9cclxuICogbWFrZSB0aGUgZ2l2ZW4gc3RyaW5nIGhhdmUgdGhlIGdpdmVuIGxlbmd0aC5cclxuICogSWYgbm90IHBvc3NpYmxlLCByZXR1cm5zIDBcclxuICovXHJcblxyXG5leHBvcnQgZ2V0TkV4dHJhIDo9IChzdHI6IHN0cmluZywgbGVuOiBudW1iZXIpOiBudW1iZXIgPT5cclxuXHJcblx0ZXh0cmEgOj0gbGVuIC0gc3RyLmxlbmd0aFxyXG5cdHJldHVybiAoZXh0cmEgPiAwKSA/IGV4dHJhIDogMFxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbi8qKlxyXG4gKiBwYWRzIHRoZSBnaXZlbiBzdHJpbmcgb24gdGhlIHJpZ2h0IHdpdGhcclxuICogdGhlIGdpdmVuIGNoYXJhY3RlciwgdG8gdGhlIGdpdmVuIGxlbmd0aFxyXG4gKi9cclxuXHJcbmV4cG9ydCBycGFkIDo9IChzdHI6IHN0cmluZywgbGVuOiBudW1iZXIsIGNoOiBzdHJpbmc9JyAnKTogc3RyaW5nID0+XHJcblxyXG5cdGFzc2VydCAoY2gubGVuZ3RoID09IDEpLCBcIk5vdCBhIGNoYXJcIlxyXG5cdGV4dHJhIDo9IGdldE5FeHRyYShzdHIsIGxlbilcclxuXHRyZXR1cm4gc3RyICsgY2gucmVwZWF0KGV4dHJhKVxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbi8qKlxyXG4gKiBwYWRzIHRoZSBnaXZlbiBzdHJpbmcgb24gdGhlIGxlZnQgd2l0aFxyXG4gKiB0aGUgZ2l2ZW4gY2hhcmFjdGVyLCB0byB0aGUgZ2l2ZW4gbGVuZ3RoXHJcbiAqL1xyXG5cclxuZXhwb3J0IGxwYWQgOj0gKHN0cjogc3RyaW5nLCBsZW46IG51bWJlciwgY2g6IHN0cmluZz0nICcpOiBzdHJpbmcgPT5cclxuXHJcblx0YXNzZXJ0IChjaC5sZW5ndGggPT0gMSksIFwiTm90IGEgY2hhclwiXHJcblx0ZXh0cmEgOj0gZ2V0TkV4dHJhKHN0ciwgbGVuKVxyXG5cdHJldHVybiBjaC5yZXBlYXQoZXh0cmEpICsgc3RyXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuLyoqXHJcbiAqIHBhZCBhIHN0cmluZyBvbiB0aGUgbGVmdCwgcmlnaHQsIG9yIGJvdGhcclxuICogdG8gdGhlIGdpdmVuIHdpZHRoXHJcbiAqL1xyXG5cclxuZXhwb3J0IHR5cGUgVEFsaWdubWVudCA9ICdsJ3wnYyd8J3InfCdsZWZ0J3wnY2VudGVyJ3wncmlnaHQnXHJcblxyXG5leHBvcnQgaXNBbGlnbm1lbnQgOj0gKHg6IHVua25vd24pOiB4IGlzIFRBbGlnbm1lbnQgPT5cclxuXHJcblx0cmV0dXJuIChcclxuXHRcdCAgICh0eXBlb2YgeCA9PSAnc3RyaW5nJylcclxuXHRcdCYmIFsnbCcsJ2MnLCdyJywnbGVmdCcsJ2NlbnRlcicsJ3JpZ2h0J10uaW5jbHVkZXMoeClcclxuXHRcdClcclxuXHJcbmV4cG9ydCBhbGlnblN0cmluZyA6PSAoXHJcblx0c3RyOiBzdHJpbmcsXHJcblx0d2lkdGg6IG51bWJlcixcclxuXHRhbGlnbjogVEFsaWdubWVudFxyXG5cdCk6IHN0cmluZyAtPlxyXG5cclxuXHRzd2l0Y2ggYWxpZ25cclxuXHRcdHdoZW4gJ2xlZnQnLCAnbCdcclxuXHRcdFx0cmV0dXJuIHJwYWQoc3RyLCB3aWR0aClcclxuXHRcdHdoZW4gJ2NlbnRlcicsICdjJ1xyXG5cdFx0XHRyZXR1cm4gc2VwKHN0ciwgJyAnLCB3aWR0aClcclxuXHRcdHdoZW4gJ3JpZ2h0JywgJ3InXHJcblx0XHRcdHJldHVybiBscGFkKHN0ciwgd2lkdGgpXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuLyoqXHJcbiAqIGNvbnZlcnRzIHRoZSBnaXZlbiBudW1iZXIgdG8gYSBzdHJpbmcsIHRoZW4gcGFkcyBvbiB0aGUgbGVmdFxyXG4gKiB3aXRoIHplcm9zIHRvIGFjaGlldmUgdGhlIGdpdmVuIGxlbmd0aFxyXG4gKi9cclxuXHJcbmV4cG9ydCB6cGFkIDo9IChuOiBudW1iZXIsIGxlbjogbnVtYmVyKTogc3RyaW5nID0+XHJcblxyXG5cdHJldHVybiBscGFkKG4udG9TdHJpbmcoKSwgbGVuLCAnMCcpXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4jIEdFTkVSQVRPUlxyXG5cclxuZXhwb3J0IGFsbE1hdGNoZXMgOj0gKHN0cjogc3RyaW5nLCByZTogUmVnRXhwKTogR2VuZXJhdG9yPHN0cmluZ1tdLCB2b2lkLCB2b2lkPiAtPlxyXG5cclxuXHQjIC0tLSBFbnN1cmUgdGhlIHJlZ2V4IGhhcyB0aGUgZ2xvYmFsIGZsYWcgKGcpIHNldFxyXG5cdG5ld3JlIDo9IG5ldyBSZWdFeHAocmUsIHJlLmZsYWdzICsgKHJlLmZsYWdzLmluY2x1ZGVzKCdnJykgPyAnJyA6ICdnJykpXHJcblx0bGV0IGxNYXRjaGVzOiBzdHJpbmdbXSB8IG51bGwgPSBudWxsXHJcblx0d2hpbGUgZGVmaW5lZChsTWF0Y2hlcyA9IG5ld3JlLmV4ZWMoc3RyKSlcclxuICBcdFx0eWllbGQgbE1hdGNoZXNcclxuXHRyZXR1cm5cclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG4vKipcclxuICogQSBnZW5lcmF0b3IgdGhhdCB5aWVsZHMgaW50ZWdlcnMgc3RhcnRpbmcgd2l0aCAwIGFuZFxyXG4gKiBjb250aW51aW5nIHRvIG4tMVxyXG4gKi9cclxuXHJcbmV4cG9ydCByYW5nZSA6PSAoXHJcblx0bjogbnVtYmVyXHJcblx0KTogR2VuZXJhdG9yPG51bWJlciwgdm9pZCwgdm9pZD4gLT5cclxuXHJcblx0bGV0IGkgPSAwXHJcblx0d2hpbGUgKGkgPCBuKVxyXG5cdFx0eWllbGQgaVxyXG5cdFx0aSA9IGkgKyAxXHJcblx0cmV0dXJuXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuZXhwb3J0IGNsYXNzIEZldGNoZXI8VD5cclxuXHJcblx0aXRlcjogSXRlcmF0b3I8VD5cclxuXHRidWZmZXI6IFQ/ID0gdW5kZWZcclxuXHJcblx0Y29uc3RydWN0b3IoQGl0ZXI6IEl0ZXJhdG9yPFQ+LCBAZW9mVmFsdWU6IFQpXHJcblxyXG5cdHBlZWsoKTogVFxyXG5cdFx0aWYgZGVmaW5lZChAYnVmZmVyKVxyXG5cdFx0XHRyZXR1cm4gQGJ1ZmZlclxyXG5cdFx0ZWxzZVxyXG5cdFx0XHR7dmFsdWUsIGRvbmV9IDo9IEBpdGVyLm5leHQoKVxyXG5cdFx0XHRpZiBkb25lXHJcblx0XHRcdFx0cmV0dXJuIEBlb2ZWYWx1ZVxyXG5cdFx0XHRlbHNlXHJcblx0XHRcdFx0QGJ1ZmZlciA9IHZhbHVlXHJcblx0XHRcdFx0cmV0dXJuIHZhbHVlXHJcblxyXG5cdGdldChleHBlY3RlZDogVD89dW5kZWYpOiBUXHJcblx0XHRsZXQgcmVzdWx0OiBUID0gQGVvZlZhbHVlXHJcblx0XHRpZiBkZWZpbmVkKEBidWZmZXIpXHJcblx0XHRcdHJlc3VsdCA9IEBidWZmZXJcclxuXHRcdFx0QGJ1ZmZlciA9IHVuZGVmXHJcblx0XHRlbHNlXHJcblx0XHRcdHt2YWx1ZSwgZG9uZX0gOj0gQGl0ZXIubmV4dCgpXHJcblx0XHRcdHJlc3VsdCA9IGRvbmUgPyBAZW9mVmFsdWUgOiB2YWx1ZVxyXG5cdFx0aWYgZGVmaW5lZChleHBlY3RlZClcclxuXHRcdFx0YXNzZXJ0IGRlZXBFcXVhbChyZXN1bHQsIGV4cGVjdGVkKSxcclxuXHRcdFx0XHRcdFwiI3tleHBlY3RlZH0gZXhwZWN0ZWRcIlxyXG5cdFx0cmV0dXJuIHJlc3VsdFxyXG5cclxuXHRza2lwKGV4cGVjdGVkOiBUPz11bmRlZik6IHZvaWRcclxuXHRcdEBnZXQoZXhwZWN0ZWQpXHJcblx0XHRyZXR1cm5cclxuXHJcblx0YXRFbmQoKTogYm9vbGVhblxyXG5cdFx0aWYgZGVmaW5lZChAYnVmZmVyKVxyXG5cdFx0XHRyZXR1cm4gZmFsc2VcclxuXHRcdGVsc2VcclxuXHRcdFx0e3ZhbHVlLCBkb25lfSA6PSBAaXRlci5uZXh0KClcclxuXHRcdFx0aWYgZG9uZSB8fCAodmFsdWUgPT0gQGVvZlZhbHVlKVxyXG5cdFx0XHRcdHJldHVybiB0cnVlXHJcblx0XHRcdGVsc2VcclxuXHRcdFx0XHRAYnVmZmVyID0gdmFsdWVcclxuXHRcdFx0XHRyZXR1cm4gZmFsc2VcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgYXNzZXJ0U2FtZVN0ciA6PSAoXHJcblx0XHRzdHIxOiBzdHJpbmcsXHJcblx0XHRzdHIyOiBzdHJpbmdcclxuXHRcdCk6IHZvaWQgPT5cclxuXHJcblx0aWYgKHN0cjEgIT0gc3RyMilcclxuXHRcdGNvbnNvbGUubG9nIHNlcChcIlN0cmluZ3MgRGlmZmVyOlwiKVxyXG5cdFx0Y29uc29sZS5sb2cgc2VwKFwic3RyaW5nIDFcIilcclxuXHRcdGNvbnNvbGUubG9nIHN0cjFcclxuXHRcdGNvbnNvbGUubG9nIHNlcChcInN0cmluZyAyXCIpXHJcblx0XHRjb25zb2xlLmxvZyBzdHIyXHJcblx0XHRjb25zb2xlLmxvZyAnLScucmVwZWF0KDY0KVxyXG5cclxuXHRhc3NlcnQgKHN0cjEgPT0gc3RyMiksIFwic3RyaW5ncyBkaWZmZXJcIlxyXG5cdHJldHVyblxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbmV4cG9ydCBpbnRlcnBvbGF0ZSA6PSAoXHJcblx0XHRzdHI6IHN0cmluZ1xyXG5cdFx0aFJlcGxhY2U6IGhhc2hvZjxzdHJpbmc+ICAgIyAtLS0geyA8dGFnPjogPHJlcGxhY2VtZW50PiwgLi4uIH1cclxuXHRcdCk6IHN0cmluZyA9PlxyXG5cclxuXHRmb3Iga2V5IG9mIGtleXMoaFJlcGxhY2UpXHJcblx0XHRhc3NlcnQgKGtleVswXSA9PSAnJCcpLCBcImFsbCBrZXlzIG11c3Qgc3RhcnQgd2l0aCAnJCdcIlxyXG5cdHJlIDo9IC8vL1xyXG5cdFx0XFwkXHJcblx0XHQoPzpbQS1aYS16XVtBLVphLXowLTldKilcclxuXHRcdC8vL2dcclxuXHRyZXR1cm4gc3RyLnJlcGxhY2VBbGwocmUsIChtYXRjaDogc3RyaW5nKSA9PlxyXG5cdFx0cmV0dXJuIGhSZXBsYWNlW21hdGNoXSB8fCBtYXRjaFxyXG5cdFx0KVxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuIyAtLS0gZ2VuZXJhdGUgcmFuZG9tIGxhYmVsc1xyXG5cclxubGFiZWxHZW4gOj0gKCk6IEdlbmVyYXRvcjxzdHJpbmcsIHZvaWQsIHZvaWQ+IC0+XHJcblxyXG5cdGZvciBjaCBvZiBbJ0EnLi4nWiddXHJcblx0XHR5aWVsZCBjaFxyXG5cdGZvciBjaCBvZiBbJ0EnLi4nWiddXHJcblx0XHRmb3IgY2gyIG9mIFsnQScuLidaJ11cclxuXHRcdFx0eWllbGQgY2ggKyBjaDJcclxuXHRmb3IgY2ggb2YgWydBJy4uJ1onXVxyXG5cdFx0Zm9yIGNoMiBvZiBbJ0EnLi4nWiddXHJcblx0XHRcdGZvciBjaDMgb2YgWydBJy4uJ1onXVxyXG5cdFx0XHRcdHlpZWxkIGNoICsgY2gyICsgY2gzXHJcblx0cmV0dXJuXHJcblxyXG4jIC0tLSBDcmVhdGUgYW4gaXRlcmF0b3IgZnJvbSB0aGUgZ2VuZXJhdG9yXHJcbmxhYmVscyA6PSBsYWJlbEdlbigpXHJcblxyXG5leHBvcnQgcmFuZG9tTGFiZWwgOj0gKCk6IHN0cmluZyA9PlxyXG5cdGxhYmVsIDo9IGxhYmVscy5uZXh0KClcclxuXHRyZXR1cm4gbGFiZWwuZG9uZSA/ICdFUlIhJyA6IGxhYmVsLnZhbHVlXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuZXhwb3J0IHJlcXVpcmUgOj0gY3JlYXRlUmVxdWlyZShpbXBvcnQubWV0YS51cmwpXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuZXhwb3J0IGdldExpbmVBbmRDb2x1bW4gOj0gKHRleHQ6IHN0cmluZywgcG9zOiBudW1iZXIpID0+XHJcblxyXG5cdCMgLS0tIEdldCBsaW5lIG51bWJlciBieSBjb3VudGluZyBudW1iZXIgb2YgXFxuIGNoYXJzXHJcblx0IyAgICAgICAgYmVmb3JlIHRoZSBjdXJyZW50IHBvc2l0aW9uXHJcblx0IyAgICAgR2V0IGNvbHVtbiBudW1iZXIgYnkgZmluZGluZyBjbG9zZXN0IHByZXZpb3VzIHBvc2l0aW9uXHJcblx0IyAgICAgICAgb2YgYSBcXG4gYW5kIGNvbXB1dGluZyB0aGUgZGlmZmVyZW5jZVxyXG5cclxuXHRzaG9ydFN0ciA6PSB0ZXh0LnN1YnN0cmluZygwLCBwb3MpXHJcblx0cmV0dXJuIFtcclxuXHRcdGNvdW50Q2hhcnMoc2hvcnRTdHIsIFwiXFxuXCIpICsgMVxyXG5cdFx0cG9zIC0gc2hvcnRTdHIubGFzdEluZGV4T2YoJ1xcbicpXHJcblx0XHRdXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4jIGxhdGVyPyBhbGxvdyBwYXNzaW5nIGluIHN0cmluZ1tdID8/P1xyXG5cclxuZXhwb3J0IHdpZHRoT2YgOj0gKGJsb2NrOiBzdHJpbmcpOiBudW1iZXIgPT5cclxuXHJcblx0bGV0IHdpZHRoID0gMFxyXG5cdGZvciBsaW5lIG9mIGFsbExpbmVzSW5CbG9jayhibG9jaylcclxuXHRcdGlmIChsaW5lLmxlbmd0aCA+IHdpZHRoKVxyXG5cdFx0XHR3aWR0aCA9IGxpbmUubGVuZ3RoXHJcblx0cmV0dXJuIHdpZHRoXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuZXhwb3J0IGhlaWdodE9mIDo9IChibG9jazogc3RyaW5nKTogbnVtYmVyID0+XHJcblxyXG5cdHJldHVybiAoYmxvY2sgPT0gJycpID8gMCA6IGJsb2NrLnNwbGl0KCdcXG4nKS5sZW5ndGhcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgYmxvY2tpZnkgOj0gKFxyXG5cdFx0bFN0cmluZ3M6IHN0cmluZ1tdXHJcblx0XHRoT3B0aW9uczogaGFzaCA9IHt9XHJcblx0XHQpOiBzdHJpbmcgPT5cclxuXHJcblx0dHlwZSBvcHQgPSB7XHJcblx0XHRzZXA6IHN0cmluZ1xyXG5cdFx0ZW5kc2VwOiBzdHJpbmdcclxuXHRcdHdpZHRoOiBudW1iZXJcclxuXHRcdH1cclxuXHR7c2VwLCBlbmRzZXAsIHdpZHRoLFxyXG5cdFx0fSA6PSBnZXRPcHRpb25zPG9wdD4gaE9wdGlvbnMsIHtcclxuXHRcdHNlcDogJyAnXHJcblx0XHRlbmRzZXA6ICcnXHJcblx0XHR3aWR0aDogNjRcclxuXHRcdH1cclxuXHJcblx0bExpbmVzOiBzdHJpbmdbXSA6PSBbXVxyXG5cdGxXb3Jkczogc3RyaW5nW10gOj0gW11cclxuXHRsZXQgbGluZUxlbiA9IGVuZHNlcC5sZW5ndGhcclxuXHJcblx0Zm9yIHN0ciBvZiBsU3RyaW5nc1xyXG5cdFx0IyAtLS0gSWYgYWRkaW5nIHRoZSBzdHJpbmcgbWFrZXMgdGhlIGxpbmUgdG9vIGxvbmcsXHJcblx0XHQjICAgICBvdXRwdXQgdGhlIGxpbmUgYW5kIGNsZWFyIHRoZSBhcnJheSBvZiB3b3Jkc1xyXG5cdFx0aWYgKGxpbmVMZW4gKyBzdHIubGVuZ3RoICsgc2VwLmxlbmd0aCA+IHdpZHRoKVxyXG5cdFx0XHRsTGluZXMucHVzaCBsV29yZHMuam9pbihzZXApXHJcblx0XHRcdGxXb3Jkcy5sZW5ndGggPSAwXHJcblx0XHRcdGxpbmVMZW4gPSAwXHJcblx0XHRsV29yZHMucHVzaCBzdHJcclxuXHRcdGxpbmVMZW4gKz0gc3RyLmxlbmd0aCArIHNlcC5sZW5ndGhcclxuXHRpZiAobFdvcmRzLmxlbmd0aCA+IDApXHJcblx0XHRsTGluZXMucHVzaCBsV29yZHMuam9pbihzZXApXHJcblx0cmV0dXJuIGxMaW5lcy5qb2luKCdcXG4nKVxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbmV4cG9ydCBjbGFzcyBDU3RyaW5nU2V0TWFwPFQgPSBzdHJpbmc+IGV4dGVuZHMgTWFwPFQsIFNldDxzdHJpbmc+PlxyXG5cclxuXHQjIC4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi5cclxuXHJcblx0YWRkKGtleTogVCwgdmFsdWU6IHN0cmluZyk6IHZvaWRcclxuXHJcblx0XHRhU2V0IDo9IHN1cGVyLmdldCBrZXlcclxuXHRcdGlmIGRlZmluZWQoYVNldClcclxuXHRcdFx0YVNldC5hZGQgdmFsdWVcclxuXHRcdGVsc2VcclxuXHRcdFx0bmV3U2V0IDo9IG5ldyBTZXQ8c3RyaW5nPigpXHJcblx0XHRcdG5ld1NldC5hZGQgdmFsdWVcclxuXHRcdFx0c3VwZXIuc2V0IGtleSwgbmV3U2V0XHJcblx0XHRyZXR1cm5cclxuXHJcblx0IyAuLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uXHJcblxyXG5cdGhhc0tleShrZXk6IFQpOiBib29sZWFuXHJcblxyXG5cdFx0cmV0dXJuIEBoYXMga2V5XHJcblxyXG5cdCMgLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLlxyXG5cclxuXHRoYXNWYWx1ZSh2YWw6IHN0cmluZyk6IGJvb2xlYW5cclxuXHJcblx0XHRmb3Iga2V5IG9mIEBhbGxLZXlzKClcclxuXHRcdFx0c2V0IDo9IEAuZ2V0KGtleSlcclxuXHRcdFx0aWYgZGVmaW5lZChzZXQpICYmIHNldC5oYXModmFsKVxyXG5cdFx0XHRcdHJldHVybiB0cnVlXHJcblx0XHRyZXR1cm4gZmFsc2VcclxuXHJcblx0IyAuLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uXHJcblxyXG5cdGFsbEtleXMoKTogR2VuZXJhdG9yPFQsIHZvaWQsIHZvaWQ+XHJcblxyXG5cdFx0eWllbGQqIHN1cGVyLmtleXMoKVxyXG5cdFx0cmV0dXJuXHJcblxyXG5cdCMgLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLlxyXG5cclxuXHRhbGxWYWx1ZXMoa2V5OiBUKTogR2VuZXJhdG9yPHN0cmluZywgdm9pZCwgdm9pZD5cclxuXHJcblx0XHRhU2V0IDo9IHN1cGVyLmdldCBrZXlcclxuXHRcdGlmIGRlZmluZWQoYVNldClcclxuXHRcdFx0eWllbGQqIGFTZXQudmFsdWVzKClcclxuXHRcdHJldHVyblxyXG5cclxuXHQjIC4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi5cclxuXHJcblx0YXNTdHJpbmcoKTogc3RyaW5nXHJcblxyXG5cdFx0bExpbmVzIDo9IGZvciBrZXkgb2YgQGFsbEtleXMoKVxyXG5cdFx0XHRcIiN7a2V5fTogI3tBcnJheS5mcm9tKEBhbGxWYWx1ZXMoa2V5KSkuam9pbignICcpfVwiXHJcblx0XHRyZXR1cm4gbExpbmVzLmpvaW4oJ1xcbicpXHJcbiJdfQ==