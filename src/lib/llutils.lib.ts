"use strict";
// llutils.lib.civet

type AutoPromise<T> = Promise<Awaited<T>>;
import {stripAnsiCode} from "@std/fmt/colors"
import {createRequire} from "node:module"
import {sprintf} from "@std/fmt/printf"
import {relative} from '@std/path'

import {
	undef, defined, notdefined, assert, char, deepEqual,
	isHash, isArray, isNonEmptyString, isArrayOfStrings,
	isEmpty, nonEmpty, isString, isInteger,
	integer, hash, hashof, array, arrayof, voidFunc,
	isNonPrimitive, functionDef, croak,
	assertIsString, assertIsNumber,
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
// --- valid options:
//        char - char to use on left and right
//        buffer - num spaces around text when char <> ' '

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

// ---------------------------------------------------------------------------

export class KeyedStringSet {

	readonly hMap = new Map<string, Set<string>>

	// ..........................................................

	add(key: string, value: string): void {

		const aSet = this.hMap.get(key)
		if (defined(aSet)) {
			aSet.add(value)
		}
		else {
			const newSet = new Set<string>()
			newSet.add(value)
			this.hMap.set(key, newSet)
		}
		return
	}

	// ..........................................................

	*allKeys(): Generator<string, void, void> {

		yield* this.hMap.keys()
		return
	}

	// ..........................................................

	*allValues(key: string): Generator<string, void, void> {

		const aSet = this.hMap.get(key)
		if (defined(aSet)) {
			yield* aSet.values()
		}
		return
	}
}

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQzpcXFVzZXJzXFxqb2huZFxcdXRpbHNcXHNyY1xcbGliXFxsbHV0aWxzLmxpYi5jaXZldC50c3giLCJzb3VyY2VzIjpbIkM6XFxVc2Vyc1xcam9obmRcXHV0aWxzXFxzcmNcXGxpYlxcbGx1dGlscy5saWIuY2l2ZXQiXSwibWFwcGluZ3MiOiI7QUFBQSxvQkFBbUI7QUFDbkIsQUFBQTtBQUNBLEssVyx5QjtBQUFBLE1BQU0sQ0FBQyxDQUFDLGFBQWEsQ0FBQyxDQUFDLElBQUksQ0FBQyxpQkFBaUI7QUFDN0MsQUFBQSxBQUFBLE1BQU0sQ0FBQyxDQUFDLGFBQWEsQ0FBQyxDQUFDLElBQUksQ0FBQyxhQUFhO0FBQ3pDLEFBQUEsQUFBQSxNQUFNLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxJQUFJLENBQUMsaUJBQWlCO0FBQ3ZDLEFBQUEsQUFBQSxNQUFNLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxJQUFJLENBQUMsV0FBVztBQUNsQyxBQUFBO0FBQ0EsQUFBQSxBQUFBLE1BQU0sQ0FBQyxDQUFDO0FBQ1IsQ0FBQyxLQUFLLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxTQUFTLENBQUM7QUFDckQsQ0FBQyxNQUFNLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDLGdCQUFnQixDQUFDO0FBQ3JELENBQUMsT0FBTyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsU0FBUyxDQUFDO0FBQ3hDLENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsUUFBUSxDQUFDO0FBQ2pELENBQUMsY0FBYyxDQUFDLENBQUMsV0FBVyxDQUFDLENBQUMsS0FBSyxDQUFDO0FBQ3BDLENBQUMsY0FBYyxDQUFDLENBQUMsY0FBYyxDQUFDO0FBQ2hDLENBQUMsQ0FB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ZCxBQUFBLEVBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQSxDQUFBLENBQUE7QUFDZixBQUFBLEdBQUcsR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFFLENBQUMsSUFBSSxDQUFDLENBQUEsQ0FBQTtBQUNqQixBQUFBLEksRyxHQUFJLE07R0FBTSxDQUFBO0FBQ1YsQUFBQSxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUEsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFBLENBQUEsQ0FBQTtBQUNyQixBQUFBLElBQVUsTUFBTixNQUFNLENBQUMsQyxDLEMsQyxFLEMsSyxDLE8sRyxDQUFzQyxHQUFHLENBQUMsQ0FBQSxNQUFBLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQyxDLEcsTyxNQUFqRCxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDLEMsRSxPLE8sQyxDLEVBQWU7QUFDOUQsQUFBQSxJQUFJLEdBQUcsQ0FBQSxPQUFPLENBQUEsQ0FBQSxDQUFBO0FBQ2QsQUFBQSxLLEcsR0FBSyxHQUFHLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLEc7SUFBRyxDQUFBO0FBQ2xDLEFBQUEsSUFBSSxJQUFJLENBQUEsQ0FBQTtBQUNSLEFBQUEsSyxHLEdBQUssS0FBSyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxLO0lBQUssQztHQUFBLENBQUE7QUFDdkMsQUFBQSxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUEsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFBLENBQUEsQ0FBQTtBQUNwQixBQUFBLEksSyxDLFEsRyxDQUFjLEdBQUcsQ0FBQyxDQUFBLE1BQUEsR0FBTyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUEsQ0FBQSxDQUFSLE1BQUEsRyxHQUFNLEFBQUMsQyxDQUFYLEcsQyxDQUFZO0FBQzlCLEFBQUEsSyxRLE1BQUssQ0FBQyxFQUFFLEdB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Q0FBQSxBQUFDLENBQUMsU0FBUyxFQUFFLFNBQVMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUM3QyxBQUFBLEVBQVEsTUFBTixNQUFNLENBQUMsQ0FBRSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQztBQUN0QyxBQUFBLEVBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQSxBQUFDLENBQUMsVUFBVSxFQUFFLFNBQVMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUMvQyxBQUFBLEVBQUUsTUFBTSxDQUFDLE07Q0FBTSxDQUFBO0FBQ2YsQUFBQSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLFFBQVEsQ0FBQyxDQUFDLFFBQVEsQztBQUFDLENBQUE7QUFDbEQsQUFBQTtBQUNBLEFBQUEsOEVBQTZFO0FBQzdFLEFBQUE7QUFDQSxBQUFBO0FBQ0E7QUFDQSxHQUFHO0FBQ0gsQUFBQTtBQUNBLEFBQUEsQUFBQSxNQUFNLENBQUUsTUFBRCxDQUFDLENBQUMsQ0FBRSxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsb0JBQW9CLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUEsQ0FBQTtBQUN2RCxBQUFBO0FBQ0EsQUFBQSxDQUFTLE1BQVIsUUFBUSxDQUFDLENBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQSxDQUFBO0FBQ3ZDLEFBQUEsRUFBTyxNQUFMLEtBQUssQ0FBQyxDQUFFLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDdkMsQUFBQSxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssQztDQUFDLENBQUE7QUFDM0IsQUFBQSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsVUFBVSxD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RCxBQUFBLENBQUMsTTtBQUFNLENBQUE7QUFDUCxBQUFBO0FBQ0EsQUFBQSw4RUFBNkU7QUFDN0UsQUFBQTtBQUNBLEFBQUEsQUFBQSxNQUFNLENBQVUsTUFBVCxTQUFTLENBQUMsQ0FBRSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFBLENBQUE7QUFDMUMsQUFBQTtBQUNBLEFBQUEsQ0FBTSxNQUFMLEtBQUssQ0FBQyxDQUFFLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0FBQ3BCLEFBQUEsQ0FBSSxNQUFILEdBQUcsQ0FBQyxDQUFFLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHO0FBQzdCLEFBQUEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUE7QUFDekIsQUFBQSxDQUFDLE07QUFBTSxDQUFBO0FBQ1AsQUFBQTtBQUNBLEFBQUEsOEVBQTZFO0FBQzdFLEFBQUE7QUFDQSxBQUFBO0FBQ0E7QUFDQTtBQUNBLEdBQUc7QUFDSCxBQUFBO0FBQ0EsQUFBQSxBQUFBLE1BQU0sQ0FBTyxNQUFOLE1BQU0sQ0FBQyxDQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUEsQ0FBQTtBQUN2QyxBQUFBO0FBQ0EsQUFBQTtBQUNBLEFBQUEsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDO0FBQUMsQ0FBQTtBQUNyQyxBQUFBO0FBQ0EsQUFBQSw4RUFBNkU7QUFDN0UsQUFBQTtBQUNBLEFBQUE7QUFDQTtBQUNBO0FBQ0EsR0FBRztBQUNILEFBQUE7QUFDQSxBQUFBLEFBQUEsTUFBTSxDQUFLLE1BQUosSUFBSSxDQUFDLENBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQSxDQUFBO0FBQ3JDLEFBQUE7QUFDQSxBQUFBLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQztBQUFDLENBQUE7QUFDdEMsQUFBQTtBQUNBLEFBQUEsOEVBQTZFO0FBQzdFLEFBQUE7QUFDQSxBQUFBO0FBQ0E7QUFDQSxHQUFHO0FBQ0gsQUFBQTtBQUNBLEFBQUEsQUFBQSxNQUFNLENBQU0sTUFBTCxLQUFLLENBQUMsQ0FBRSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFBLENBQUE7QUFDekMsQUFBQTtBQUNBLEFBQUEsQ0FBQyxNQUFNLENBQUEsQUFBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLGNBQWMsRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQTtBQUN0RCxBQUFBLENBQVMsTUFBUixRQUFRLENBQUMsQ0FBRSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsWUFBWSxDQUFDO0FBQ3JDLEFBQUEsQ0FBQyxNQUFNLENBQUMsQ0FBQyxRQUFRLENBQUMsR0FBRSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLEM7QUFBQyxDQUFBO0FBQy9DLEFBQUE7QUFDQSxBQUFBLDhFQUE2RTtBQUM3RSxBQUFBO0FBQ0EsQUFBQTtBQUNBO0FBQ0EsR0FBRztBQUNILEFBQUE7QUFDQSxBQUFBLEFBQUEsTUFBTSxDQUFXLE1BQVYsVUFBVSxDQUFDLENBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQSxDQUFBO0FBQ3pELEFBQUE7QUFDQSxBQUFBLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNkLEFBQUEsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDYixBQUFBLENBQUMsS0FBSyxDQUFDLENBQUEsQ0FBQyxHQUFHLEMsQ0FBRSxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRSxDQUFDLENBQUMsQ0FBQyxDQUFBLENBQUEsQ0FBQTtBQUMzQyxBQUFBLEVBQUUsS0FBSyxDLEVBQUcsQ0FBQyxDO0NBQUMsQ0FBQTtBQUNaLEFBQUEsQ0FBQyxNQUFNLENBQUMsSztBQUFLLENBQUE7QUFDYixBQUFBO0FBQ0EsQUFBQSw4RUFBNkU7QUFDN0UsQUFBQTtBQUNBLEFBQUE7QUFDQTtBQUNBO0FBQ0EsR0FBRztBQUNILEFBQUE7QUFDQSxBQUFBLEFBQUEsTUFBTSxDQUFhLE1BQVosWUFBWSxDQUFDLENBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUEsQ0FBQTtBQUNuRCxBQUFBO0FBQ0EsQUFBQSxDQUFDLEdBQUcsQ0FBQSxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUEsQ0FBQSxDQUFBO0FBQ2xCLEFBQUEsRUFBRSxNQUFNLENBQUMsQ0FBQyxDO0NBQUMsQ0FBQTtBQUNYLEFBQUEsQ0FBQyxJQUFJLENBQUEsQ0FBQTtBQUNMLEFBQUEsRUFBRSxNQUFNLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxPQUFPLEM7Q0FBQyxDO0FBQUEsQ0FBQTtBQUM3QixBQUFBO0FBQ0EsQUFBQSw4RUFBNkU7QUFDN0UsQUFBQTtBQUNBLEFBQUEsQUFBQSxNQUFNLENBQWdCLE1BQWYsZUFBZSxDQUFDLENBQUUsQ0FFVSxRLENBRlQsQ0FBQztBQUMzQixBQUFBLEVBQUUsS0FBSyxDQUFDLENBQUMsTUFBTTtBQUNmLEVBQUUsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBSSxDQUFBLENBQUE7QUFDckMsQUFBQTtBQUNBLEFBQUEsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ2QsQUFBQSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDO0FBQzlCLEFBQUEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxHQUFHLENBQUMsR0FBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUEsQ0FBQTtBQUNsQixBQUFBLEVBQUUsS0FBSyxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLENBQUMsR0FBRyxDQUFDO0FBQ25DLEFBQUEsRUFBRSxLQUFLLEMsQ0FBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNqQixBQUFBLEVBQUUsR0FBRyxDLENBQUUsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLEtBQUssQztDQUFDLENBQUE7QUFDbEMsQUFBQSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQSxDQUFBO0FBQzFCLEFBQUEsRUFBRSxLQUFLLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxLQUFLLEM7Q0FBQyxDQUFBO0FBQzlCLEFBQUEsQ0FBQyxNO0FBQU0sQ0FBQTtBQUNQLEFBQUE7QUFDQSxBQUFBLDhFQUE2RTtBQUM3RSxBQUFBO0FBQ0EsQUFBQSxBQUFBLElBQUksQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDLE1BQU07QUFDM0MsQUFBQTtBQUNBLEFBQUEs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LENBQUEsQ0FBQTtBQUMzQyxBQUFBO0FBQ0EsQUFBQSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDO0FBQUMsQ0FBQTtBQUN4RCxBQUFBO0FBQ0EsQUFBQSw4RUFBNkU7QUFDN0UsQUFBQTtBQUNBLEFBQUE7QUFDQTtBQUNBO0FBQ0EsR0FBRztBQUNILEFBQUE7QUFDQSxBQUFBLEFBQUEsTUFBTSxDQUFRLE1BQVAsT0FBTyxDQUFDLENBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUEsQ0FBQTtBQUM1QyxBQUFBO0FBQ0EsQUFBQSxDQUFPLE1BQU4sTUFBTSxDQUFDLENBQUUsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDckIsQUFBQSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRSxDQUFDLEVBQUUsQ0FBQyxDQUFBLENBQUE7QUFDbEIsQUFBQSxFQUFFLE1BQU0sQ0FBQyxDQUFDLEM7Q0FBQyxDQUFBO0FBQ1gsQUFBQSxDQUFDLElBQUksQ0FBQSxDQUFBO0FBQ0wsQUFBQSxFQUFFLE1BQU0sQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLEtBQUssQztDQUFDLEM7QUFBQSxDQUFBO0FBQzVCLEFBQUE7QUFDQSxBQUFBLDhFQUE2RTtBQUM3RSxBQUFBO0FBQ0EsQUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLEdBQUc7QUFDSCxBQUFBO0FBQ0EsQUFBQSxBQUFBLE1BQU0sQ0FBTSxNQUFMLEtBQUssQ0FBQyxDQUFFLENBQUMsQ0FBQyxHQUFHLFFBQVEsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFBLENBQUE7QUFDcEQsQUFBQTtBQUNBLEFBQUEsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDaEIsQUFBQSxDQUFDLEdBQUcsQ0FBQyxDQUFBLE1BQUEsR0FBRyxDQUFDLEVBQUUsQ0FBQyxRQUFRLENBQUEsQ0FBQSxDQUFBO0FBQ3BCLEFBQUEsRUFBRSxHQUFHLENBQUMsQ0FBQSxNQUFBLElBQUksQ0FBQyxFQUFFLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFBLENBQUEsQ0FBQTtBQUMxQixBQUFBLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQSxBQUFDLElBQUksQztFQUFBLEM7Q0FBQSxDQUFBO0FBQ25CLEFBQUEsQ0FBQyxNQUFNLENBQUMsTTtBQUFNLENBQUE7QUFDZCxBQUFBO0FBQ0EsQUFBQSw4RUFBNkU7QUFDN0UsQUFBQTtBQUNBLEFBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQSxHQUFHO0FBQ0gsQUFBQTtBQUNBLEFBQUEsQUFBQSxNQUFNLENBQVUsTUFBVCxTQUFTLENBQUMsQ0FBRSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFBLENBQUE7QUFDekQsQUFBQTtBQUNBLEFBQUEsQ0FBTSxNQUFMLEtBQUssQ0FBQyxDQUFFLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsTUFBTTtBQUMxQixBQUFBLENBQUMsTUFBTSxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDO0FBQUMsQ0FBQTtBQUMvQixBQUFBO0FBQ0EsQUFBQSw4RUFBNkU7QUFDN0UsQUFBQTtBQUNBLEFBQUE7QUFDQTtBQUNBO0FBQ0EsR0FBRztBQUNILEFBQUE7QUFDQSxBQUFBLEFBQUEsTUFBTSxDQUFLLE1BQUosSUFBSSxDQUFDLENBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUEsQ0FBQTtBQUNwRSxBQUFBO0FBQ0EsQUFBQSxDQUFDLE1BQU0sQ0FBQSxBQUFDLENBQUMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxHQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxZQUFZLENBQUE7QUFDdEMsQUFBQSxDQUFNLE1BQUwsS0FBSyxDQUFDLENBQUUsQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBRyxDQUFDO0FBQzdCLEFBQUEsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsTUFBTSxDQUFDLEtBQUssQztBQUFDLENBQUE7QUFDOUIsQUFBQTtBQUNBLEFBQUEsOEVBQTZFO0FBQzdFLEFBQUE7QUFDQSxBQUFBO0FBQ0E7QUFDQTtBQUNBLEdBQUc7QUFDSCxBQUFBO0FBQ0EsQUFBQSxBQUFBLE1BQU0sQ0FBSyxNQUFKLElBQUksQ0FBQyxDQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFBLENBQUE7QUFDcEUsQUFBQTtBQUNBLEFBQUEsQ0FBQyxNQUFNLENBQUEsQUFBQyxDQUFDLEVBQUUsQ0FBQyxNQUFNLENBQUMsR0FBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsWUFBWSxDQUFBO0FBQ3RDLEFBQUEsQ0FBTSxNQUFMLEtBQUssQ0FBQyxDQUFFLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQztBQUM3QixBQUFBLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLEc7QUFBRyxDQUFBO0FBQzlCLEFBQUE7QUFDQSxBQUFBLDhFQUE2RTtBQUM3RSxBQUFBLHFCQUFvQjtBQUNwQixBQUFBLDhDQUE2QztBQUM3QyxBQUFBLDBEQUF5RDtBQUN6RCxBQUFBO0FBQ0EsQUFBQSxBQUFBLE1BQU0sQ0FBUyxNQUFSLFFBQVEsQ0FBQyxDQUFFLENBQUMsQ0FBQztBQUNwQixBQUFBLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDO0FBQ2QsQUFBQSxDQUFDLEtBQUssQ0FBQyxDQUFDLE1BQU0sQ0FBQztBQUNmLEFBQUEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQztBQUNwQixBQUFBLENBQUMsU0FBUyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ3RCLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQSxDQUFBO0FBQ2IsQUFBQTtBQUNBLEFBQUEsQ0FBVSxNQUFULFNBQVMsQ0FBQyxDQUFFLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTTtBQUNqQyxBQUFBLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUEsQ0FBQTtBQUNwQixBQUFBLEVBQUUsTUFBTSxDQUFDLEk7Q0FBSSxDQUFBO0FBQ2IsQUFBQSxDQUFRLE1BQVAsT0FBTyxDQUFDLENBQUUsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ3JDLEFBQUEsQ0FBUyxNQUFSLFFBQVEsQ0FBQyxDQUFFLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxPQUFPO0FBQ2hDLEFBQUEsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEdBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQSxDQUFBO0FBQ2pCLEFBQUEsRUFBRSxNQUFNLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxRQUFRLEM7Q0FBQyxDQUFBO0FBQ2xELEFBQUEsQ0FBQyxJQUFJLENBQUEsQ0FBQTtBQUNMLEFBQUEsRUFBSyxNQUFILEdBQUcsQ0FBQyxDQUFFLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUM7QUFDOUIsQUFBQSxFQUFNLE1BQUosSUFBSSxDQUFDLENBQUUsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDO0FBQzFDLEFBQUEsRUFBTyxNQUFMLEtBQUssQ0FBQyxDQUFFLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQztBQUM1QyxBQUFBLEVBQUUsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsSztDQUFLLEM7QUFBQSxDQUFBO0FBQ3hDLEFBQUE7QUFDQSxBQUFBLDhFQUE2RTtBQUM3RSxBQUFBO0FBQ0EsQUFBQTtBQUNBO0FBQ0E7QUFDQSxHQUFHO0FBQ0gsQUFBQTtBQUNBLEFBQUEsQUFBQSxNQUFNLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxPQUFPO0FBQzVELEFBQUE7QUFDQSxBQUFBLEFBQUEsTUFBTSxDQUFZLE1BQVgsV0FBVyxDQUFDLENBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFBLENBQUE7QUFDdEQsQUFBQTtBQUNBLEFBQUEsQ0FBQyxNQUFNLENBQUMsQ0FBQztBQUNULEFBQUEsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsR0FBRSxDQUFDLFFBQVEsQ0FBQztBQUMzQixBQUFBLEVBQUUsRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDO0FBQ3RELEVBQUUsQztBQUFDLENBQUE7QUFDSCxBQUFBO0FBQ0EsQUFBQSxBQUFBLE1BQU0sQ0FBWSxNQUFYLFdBQVcsQ0FBQyxDQUFFLENBSVYsUUFKVyxDQUFDO0FBQ3ZCLEFBQUEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxNQUFNLENBQUM7QUFDYixBQUFBLENBQUMsS0FBSyxDQUFDLENBQUMsTUFBTSxDQUFDO0FBQ2YsQUFBQSxDQUFDLEtBQUssQ0FBQyxDQUFDLFVBQVU7QUFDbEIsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFTLENBQUEsQ0FBQTtBQUNiLEFBQUE7QUFDQSxBQUFBLENBQUMsTUFBTSxDQUFBLEFBQUMsS0FBSyxDQUFBLENBQUEsQ0FBQTtBQUNiLEFBQUEsRUFBRSxJQUFJLENBQUMsTUFBTSxDLEtBQUMsQUFBQyxHQUFHLENBQUEsQ0FBQSxDQUFBO0FBQ2xCLEFBQUEsR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEtBQUssQztFQUFDLENBQUE7QUFDMUIsQUFBQSxFQUFFLElBQUksQ0FBQyxRQUFRLEMsS0FBQyxBQUFDLEdBQUcsQ0FBQSxDQUFBLENBQUE7QUFDcEIsQUFBQSxHQUFHLE1BQU0sQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUMsS0FBSyxDO0VBQUMsQ0FBQTtBQUM5QixBQUFBLEVBQUUsSUFBSSxDQUFDLE9BQU8sQyxLQUFDLEFBQUMsR0FBRyxDQUFBLENBQUEsQ0FBQTtBQUNuQixBQUFBLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxLQUFLLEM7RUFBQyxDO0NBQUEsQztBQUFBLENBQUE7QUFDMUIsQUFBQTtBQUNBLEFBQUEsOEVBQTZFO0FBQzdFLEFBQUE7QUFDQSxBQUFBO0FBQ0E7QUFDQTtBQUNBLEdBQUc7QUFDSCxBQUFBO0FBQ0EsQUFBQSxBQUFBLE1BQU0sQ0FBSyxNQUFKLElBQUksQ0FBQyxDQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUEsQ0FBQTtBQUNsRCxBQUFBO0FBQ0EsQUFBQSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLEM7QUFBQyxDQUFBO0FBQ3BDLEFBQUE7QUFDQSxBQUFBLDhFQUE2RTtBQUM3RSxBQUFBLFlBQVc7QUFDWCxBQUFBO0FBQ0EsQUFBQSxBQUFBLE1BQU0sQ0FBVyxNQUFWLFVBQVUsQ0FBQyxDQUFFLENBQTRELFEsQ0FBM0QsQ0FBQyxHQUFHLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFJLENBQUEsQ0FBQTtBQUNsRixBQUFBO0FBQ0EsQUFBQSxDQUFDLG1EQUFrRDtBQUNuRCxBQUFBLENBQU0sTUFBTCxLQUFLLENBQUMsQ0FBRSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUN4RSxBQUFBLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsSUFBSTtBQUNyQyxBQUFBLENBQUMsS0FBSyxDQUFDLENBQUEsT0FBTyxDQUFDLFFBQVEsQyxDQUFFLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFBLENBQUEsQ0FBQTtBQUMx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QUFBO0FBQ3ZCLEFBQUEsRUFBRSxNO0NBQU0sQztBQUFBLENBQUE7QUFDUiIsIm5hbWVzIjpbXSwic291cmNlc0NvbnRlbnQiOlsiIyBsbHV0aWxzLmxpYi5jaXZldFxyXG5cclxuaW1wb3J0IHtzdHJpcEFuc2lDb2RlfSBmcm9tIFwiQHN0ZC9mbXQvY29sb3JzXCJcclxuaW1wb3J0IHtjcmVhdGVSZXF1aXJlfSBmcm9tIFwibm9kZTptb2R1bGVcIlxyXG5pbXBvcnQge3NwcmludGZ9IGZyb20gXCJAc3RkL2ZtdC9wcmludGZcIlxyXG5pbXBvcnQge3JlbGF0aXZlfSBmcm9tICdAc3RkL3BhdGgnXHJcblxyXG5pbXBvcnQge1xyXG5cdHVuZGVmLCBkZWZpbmVkLCBub3RkZWZpbmVkLCBhc3NlcnQsIGNoYXIsIGRlZXBFcXVhbCxcclxuXHRpc0hhc2gsIGlzQXJyYXksIGlzTm9uRW1wdHlTdHJpbmcsIGlzQXJyYXlPZlN0cmluZ3MsXHJcblx0aXNFbXB0eSwgbm9uRW1wdHksIGlzU3RyaW5nLCBpc0ludGVnZXIsXHJcblx0aW50ZWdlciwgaGFzaCwgaGFzaG9mLCBhcnJheSwgYXJyYXlvZiwgdm9pZEZ1bmMsXHJcblx0aXNOb25QcmltaXRpdmUsIGZ1bmN0aW9uRGVmLCBjcm9hayxcclxuXHRhc3NlcnRJc1N0cmluZywgYXNzZXJ0SXNOdW1iZXIsXHJcblx0fSBmcm9tICdkYXRhdHlwZXMnXHJcblxyXG4vKipcclxuICogQG1vZHVsZSBsbHV0aWxzIC0gbG93IGxldmVsIHV0aWxpdGllc1xyXG4gKi9cclxuXHJcbmxsdXRpbHNMb2FkVGltZTogaW50ZWdlciA6PSBEYXRlLm5vdygpXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuZXhwb3J0IHNpbmNlTG9hZCA6PSAoZGF0ZXRpbWU6IERhdGUgfCBpbnRlZ2VyID0gRGF0ZS5ub3coKSkgPT5cclxuXHJcblx0aWYgKGRhdGV0aW1lIGluc3RhbmNlb2YgRGF0ZSlcclxuXHRcdHJldHVybiBkYXRldGltZS52YWx1ZU9mKCkgLSBsbHV0aWxzTG9hZFRpbWVcclxuXHRlbHNlXHJcblx0XHRyZXR1cm4gZGF0ZXRpbWUgLSBsbHV0aWxzTG9hZFRpbWVcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgc2luY2VMb2FkU3RyIDo9IChkYXRldGltZTogKERhdGUgfCBpbnRlZ2VyKT8gPSB1bmRlZikgPT5cclxuXHJcblx0cmV0dXJuIHNwcmludGYoXCIlNmRcIiwgc2luY2VMb2FkKGRhdGV0aW1lKSlcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG4vKipcclxuICogQXNzZXJ0cyB0aGF0IGBjb25kYCBpcyB0cnVlLiBJZiBpdCBpc24ndCwgYW4gZXhjZXB0aW9uIGlzXHJcbiAqIHRocm93biB3aXRoIHRoZSBnaXZlbiBgbXNnYFxyXG4gKi9cclxuXHJcbmV4cG9ydCB0aHJvd3NFcnJvciA6PSAoZnVuYzogdm9pZEZ1bmMsIG1zZzogc3RyaW5nPVwiVW5leHBlY3RlZCBzdWNjZXNzXCIpOiB2b2lkID0+XHJcblxyXG5cdHRyeVxyXG5cdFx0ZnVuYygpXHJcblx0XHR0aHJvdyBuZXcgRXJyb3IobXNnKVxyXG5cdGNhdGNoIGVyclxyXG5cdFx0cmV0dXJuICAgICMgaWdub3JlIGVycm9yIC0gaXQgd2FzIGV4cGVjdGVkXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuLyoqXHJcbiAqIENhbGxpbmcgcGFzcygpIGRvZXMgbm90aGluZ1xyXG4gKi9cclxuXHJcbmV4cG9ydCBwYXNzIDo9ICgpOiB2b2lkID0+ICAgICMgZG8gbm90aGluZ1xyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbmV4cG9ydCB0cnVuY1N0ciA6PSAoc3RyOiBzdHJpbmcsIGxlbjogbnVtYmVyKSA9PlxyXG5cclxuXHRpZiAoc3RyLmxlbmd0aCA8PSBsZW4pXHJcblx0XHRyZXR1cm4gc3RyXHJcblx0cmV0dXJuIHN0ci5zdWJzdHJpbmcoMCwgbGVuLTMpICsgJy4uLidcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgc3RyaW5naWZ5IDo9IChcclxuXHR4OiB1bmtub3duLFxyXG5cdGhPcHRpb25zOiBoYXNoPXt9XHJcblx0bGV2ZWw6IG51bWJlcj0wXHJcblx0KTogc3RyaW5nID0+XHJcblxyXG5cdHR5cGUgb3B0ID0ge1xyXG5cdFx0b25lTGluZTogYm9vbGVhblxyXG5cdFx0Y29tcHJlc3M6IGJvb2xlYW5cclxuXHRcdHRydW5jOiBudW1iZXJcclxuXHRcdH1cclxuXHR7b25lTGluZSwgY29tcHJlc3MsIHRydW5jXHJcblx0XHR9IDo9IGdldE9wdGlvbnM8b3B0PiBoT3B0aW9ucywge1xyXG5cdFx0b25lTGluZTogZmFsc2VcclxuXHRcdGNvbXByZXNzOiB0cnVlXHJcblx0XHR0cnVuYzogMFxyXG5cdFx0fVxyXG5cclxuXHRyZXN1bHQ6IHN0cmluZyA6PSBzd2l0Y2ggdHlwZW9mIHhcclxuXHRcdHdoZW4gJ3VuZGVmaW5lZCdcclxuXHRcdFx0J3VuZGVmaW5lZCdcclxuXHRcdHdoZW4gJ2Jvb2xlYW4nXHJcblx0XHRcdHggPyAndHJ1ZScgOiAnZmFsc2UnXHJcblx0XHR3aGVuICdudW1iZXInXHJcblx0XHRcdHgudG9TdHJpbmcoKVxyXG5cdFx0d2hlbiAnYmlnaW50J1xyXG5cdFx0XHR4LnRvU3RyaW5nKCkgKyAnbidcclxuXHRcdHdoZW4gJ3N0cmluZydcclxuXHRcdFx0XCJcXFwiI3tlc2NhcGVTdHIoeCwgbydzdHlsZT1DJyl9XFxcIlwiXHJcblx0XHR3aGVuICdzeW1ib2wnXHJcblx0XHRcdGlmIGRlZmluZWQoeC5kZXNjcmlwdGlvbilcclxuXHRcdFx0XHRcIlN5bWJvbChcXFwiI3t4LmRlc2NyaXB0aW9ufVxcXCIpXCJcclxuXHRcdFx0ZWxzZVxyXG5cdFx0XHRcdFwiU3ltYm9sKClcIlxyXG5cdFx0d2hlbiAnb2JqZWN0J1xyXG5cdFx0XHRpZiAoeCA9PSBudWxsKVxyXG5cdFx0XHRcdCdudWxsJ1xyXG5cdFx0XHRlbHNlIGlmIGlzQXJyYXkoeClcclxuXHRcdFx0XHRsUGFydHMgOj0gc3RyaW5naWZ5KGl0ZW0sIGhPcHRpb25zLCBsZXZlbCsxKSBmb3IgaXRlbSBvZiB4XHJcblx0XHRcdFx0aWYgb25lTGluZVxyXG5cdFx0XHRcdFx0J1snICsgbFBhcnRzLmpvaW4oJywgJykgKyAnXSdcclxuXHRcdFx0XHRlbHNlXHJcblx0XHRcdFx0XHQnW1xcbicgKyBsUGFydHMuam9pbignLFxcbicpICsgJ1xcbl0nXHJcblx0XHRcdGVsc2UgaWYgaXNIYXNoKHgpXHJcblx0XHRcdFx0bFBhcnRzIDo9IGZvciBrZXksdmFsIGluIHhcclxuXHRcdFx0XHRcdFwiI3trZXl9OiAje3N0cmluZ2lmeSh2YWwsIGhPcHRpb25zLCBsZXZlbCsxKX1cIlxyXG5cdFx0XHRcdGlmIG9uZUxpbmVcclxuXHRcdFx0XHRcdCd7JyArIGxQYXJ0cy5qb2luKCcsICcpICsgJ30nXHJcblx0XHRcdFx0ZWxzZVxyXG5cdFx0XHRcdFx0J3tcXG4nICsgbFBhcnRzLmpvaW4oJyxcXG4nKSArICdcXG59J1xyXG5cdFx0XHRlbHNlXHJcblx0XHRcdFx0XCI8dW5rbm93bj5cIlxyXG5cdFx0d2hlbiAnZnVuY3Rpb24nXHJcblx0XHRcdGZ1bmN0aW9uRGVmKHgpXHJcblx0XHRlbHNlXHJcblx0XHRcdGNyb2FrIFwiQ2FuJ3Qgc3RyaW5naWZ5ICN7eH1cIlxyXG5cclxuXHRpZiBpc0ludGVnZXIodHJ1bmMpICYmICh0cnVuYyA+IDApXHJcblx0XHRyZXR1cm4gdHJ1bmNTdHIocmVzdWx0LCB0cnVuYylcclxuXHRlbHNlXHJcblx0XHRyZXR1cm4gcmVzdWx0XHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuZXhwb3J0IHN0clRvSGFzaCA6PSAoc3RyOiBzdHJpbmcpOiBoYXNoID0+XHJcblxyXG5cdGlmIGlzRW1wdHkoc3RyKVxyXG5cdFx0cmV0dXJuIHt9XHJcblx0aDogaGFzaCA6PSB7fVxyXG5cdGZvciB3b3JkIG9mIHN0ci50cmltKCkuc3BsaXQoL1xccysvKVxyXG5cdFx0aWYgbE1hdGNoZXM6IHN0cmluZ1tdIHwgbnVsbCA6PSB3b3JkLm1hdGNoKC8vL15cclxuXHRcdFx0XHQoXFwhKT8gICAgICAgICAgICAgICAgICAgICMgbmVnYXRlIHZhbHVlXHJcblx0XHRcdFx0KFtBLVphLXpdW0EtWmEtel8wLTldKikgICMgaWRlbnRpZmllclxyXG5cdFx0XHRcdCg/OlxyXG5cdFx0XHRcdFx0KD0pXHJcblx0XHRcdFx0XHQoLiopXHJcblx0XHRcdFx0XHQpP1xyXG5cdFx0XHRcdCQvLy8pXHJcblx0XHRcdFtfLCBuZWcsIGlkZW50LCBlcVNpZ24sIHN0cl0gOj0gbE1hdGNoZXNcclxuXHRcdFx0aWYgaXNOb25FbXB0eVN0cmluZyhlcVNpZ24pXHJcblx0XHRcdFx0YXNzZXJ0IG5vdGRlZmluZWQobmVnKSB8fCAobmVnID09ICcnKSxcclxuXHRcdFx0XHRcdFx0XCJuZWdhdGlvbiB3aXRoIHN0cmluZyB2YWx1ZVwiXHJcblxyXG5cdFx0XHRcdCMgLS0tIGNoZWNrIGlmIHN0ciBpcyBhIHZhbGlkIG51bWJlclxyXG5cdFx0XHRcdGlmIHN0ci5tYXRjaCgvXi0/XFxkKyhcXC5cXGQrKT8kLylcclxuXHRcdFx0XHRcdG51bSA6PSBwYXJzZUZsb2F0KHN0cilcclxuXHRcdFx0XHRcdGlmIE51bWJlci5pc05hTihudW0pXHJcblx0XHRcdFx0XHRcdCMgLS0tIFRPIERPOiBpbnRlcnByZXQgYmFja3NsYXNoIGVzY2FwZXNcclxuXHRcdFx0XHRcdFx0aFtpZGVudF0gPSBzdHJcclxuXHRcdFx0XHRcdGVsc2VcclxuXHRcdFx0XHRcdFx0aFtpZGVudF0gPSBudW1cclxuXHRcdFx0XHRlbHNlXHJcblx0XHRcdFx0XHRoW2lkZW50XSA9IHN0clxyXG5cdFx0XHRlbHNlIGlmIG5lZ1xyXG5cdFx0XHRcdGhbaWRlbnRdID0gZmFsc2VcclxuXHRcdFx0ZWxzZVxyXG5cdFx0XHRcdGhbaWRlbnRdID0gdHJ1ZVxyXG5cdFx0ZWxzZVxyXG5cdFx0XHRjcm9hayBcIkludmFsaWQgd29yZCAje3dvcmR9XCJcclxuXHRyZXR1cm4gaFxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbmV4cG9ydCBvIDo9IChsU3RyaW5nczogVGVtcGxhdGVTdHJpbmdzQXJyYXkpOiBoYXNoID0+XHJcblxyXG5cdHJldHVybiBzdHJUb0hhc2gobFN0cmluZ3NbMF0pXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuLyoqXHJcbiAqIHMgLSBjb252ZXJ0IGxlYWRpbmcgdGFicyB0byBzcGFjZXNcclxuICovXHJcblxyXG5leHBvcnQgcyA6PSAobFN0cmluZ3M6IFRlbXBsYXRlU3RyaW5nc0FycmF5KTogc3RyaW5nID0+XHJcblxyXG5cdGNvbnNvbGUubG9nIFwiY2FsbGluZyBmdW5jdGlvbiBzXCJcclxuXHRyZXBsYWNlciA6PSAobWF0Y2g6IHN0cmluZyk6IHN0cmluZyA9PlxyXG5cdFx0Y29uc29sZS5sb2cgXCJtYXRjaCA9IDwje2VzY2FwZVN0cihtYXRjaCl9PlwiXHJcblx0XHRyZXN1bHQgOj0gJyAgICcucmVwZWF0KG1hdGNoLmxlbmd0aClcclxuXHRcdGNvbnNvbGUubG9nIFwicmVzdWx0ID0gPCN7ZXNjYXBlU3RyKHJlc3VsdCl9PlwiXHJcblx0XHRyZXR1cm4gcmVzdWx0XHJcblx0cmV0dXJuIGxTdHJpbmdzWzBdLnJlcGxhY2VBbGwoL15cXHQrL21nLCByZXBsYWNlcilcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG4vKipcclxuICogdCAtIGNvbnZlcnQgbGVhZGluZyBzcGFjZXMgdG8gdGFic1xyXG4gKi9cclxuXHJcbmV4cG9ydCB0IDo9IChsU3RyaW5nczogVGVtcGxhdGVTdHJpbmdzQXJyYXkpOiBzdHJpbmcgPT5cclxuXHJcblx0cmVwbGFjZXIgOj0gKG1hdGNoOiBzdHJpbmcpOiBzdHJpbmcgPT5cclxuXHRcdGxldmVsIDo9IE1hdGguZmxvb3IobWF0Y2gubGVuZ3RoIC8gMylcclxuXHRcdHJldHVybiAnXFx0Jy5yZXBlYXQobGV2ZWwpXHJcblx0cmV0dXJuIGxTdHJpbmdzWzBdLnJlcGxhY2VBbGwoL15cXHgyMCsvbWcsIHJlcGxhY2VyKVxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbi8qKlxyXG4gKiByZXR1cm5zIGEgaGFzaCBvZiBvcHRpb25zIHdpdGggdGhlaXIgdmFsdWVzLFxyXG4gKiAtIGFkZGluZyBhbnkgZGVmYXVsdCB2YWx1ZXMgZnJvbSBoRGVmYXVsdHNcclxuICogICBpZiB0aGV5J3JlIG1pc3NpbmdcclxuICovXHJcblxyXG5leHBvcnQgZ2V0T3B0aW9ucyA6PSA8VCBleHRlbmRzIGhhc2g+KFxyXG5cdFx0aE9wdGlvbnM6IGhhc2g9e30sXHJcblx0XHRoRGVmYXVsdHM6IFRcclxuXHRcdCk6IFQgPT5cclxuXHJcblx0cmV0dXJuIHsuLi5oRGVmYXVsdHMsIC4uLmhPcHRpb25zfVxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbi8qKlxyXG4gKiByZW1vdmUgYWxsIGtleXMgZnJvbSBhIGhhc2ggdGhhdCBoYXZlIGVpdGhlciBhbiBlbXB0eSBuYW1lXHJcbiAqIG9yIGFuIGVtcHR5IHZhbHVlXHJcbiAqL1xyXG5cclxuZXhwb3J0IHJlbW92ZUVtcHR5S2V5cyA6PSAoaDogaGFzaCk6IGhhc2ggPT5cclxuXHJcblx0aFJlc3VsdDogaGFzaCA6PSB7fVxyXG5cdGZvciBrZXkgb2Yga2V5cyhoKVxyXG5cdFx0aWYgbm9uRW1wdHkoa2V5KSAmJiBub25FbXB0eShoW2tleV0pXHJcblx0XHRcdGhSZXN1bHRba2V5XSA9IGhba2V5XVxyXG5cdHJldHVybiBoUmVzdWx0XHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuLyoqXHJcbiAqIHJldHVybiBhbiBhcnJheSBvZiBhbGwgb3duIGtleXMgaW4gYSBoYXNoXHJcbiAqIHdpdGggcG9zc2libGUgZXhjZXB0aW9uc1xyXG4gKi9cclxuXHJcbmV4cG9ydCBrZXlzIDo9IChvYmo6IGhhc2gsIGhPcHRpb25zOiBoYXNoPXt9KTogc3RyaW5nW10gPT5cclxuXHJcblx0dHlwZSBvcHQgPSB7XHJcblx0XHRsRXhjZXB0OiBzdHJpbmcgfCBzdHJpbmdbXVxyXG5cdFx0fVxyXG5cdHtsRXhjZXB0fSA6PSBnZXRPcHRpb25zPG9wdD4gaE9wdGlvbnMsIHtcclxuXHRcdGxFeGNlcHQ6IFtdXHJcblx0XHR9XHJcblxyXG5cdGxSZWFsRXhjZXB0IDo9IGlzU3RyaW5nKGxFeGNlcHQpID8gW2xFeGNlcHRdIDogbEV4Y2VwdFxyXG5cdGxLZXlzOiBzdHJpbmdbXSA6PSBbXVxyXG5cdGZvciBrZXkgb2YgT2JqZWN0LmtleXMob2JqKVxyXG5cdFx0aWYgbm90IGxSZWFsRXhjZXB0LmluY2x1ZGVzKGtleSlcclxuXHRcdFx0bEtleXMucHVzaCBrZXlcclxuXHRyZXR1cm4gbEtleXNcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgaGFzT3duIDo9IE9iamVjdC5oYXNPd25cclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgaGFzS2V5IDo9IChvYmo6IHVua25vd24sIC4uLmxLZXlzOiBzdHJpbmdbXSkgPT5cclxuXHJcblx0aWYgKHR5cGVvZiBvYmogIT0gJ29iamVjdCcpIHx8IChvYmogPT0gbnVsbClcclxuXHRcdHJldHVybiBmYWxzZVxyXG5cdGZvciBrZXkgb2YgbEtleXNcclxuXHRcdGlmIG5vdCBvYmouaGFzT3duUHJvcGVydHkoa2V5KVxyXG5cdFx0XHRyZXR1cm4gZmFsc2VcclxuXHRyZXR1cm4gdHJ1ZVxyXG5cclxuZXhwb3J0IGhhc0tleXMgOj0gaGFzS2V5XHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuZXhwb3J0IG1pc3NpbmdLZXlzIDo9IChoOiBoYXNoLCAuLi5sS2V5czogc3RyaW5nW10pOiBzdHJpbmdbXSA9PlxyXG5cclxuXHRpZiBub3RkZWZpbmVkKGgpXHJcblx0XHRyZXR1cm4gbEtleXNcclxuXHRhc3NlcnQgaXNIYXNoKGgpLCBcImggbm90IGEgaGFzaDogI3tofVwiXHJcblx0bE1pc3Npbmc6IHN0cmluZ1tdIDo9IFtdXHJcblx0Zm9yIGtleSBvZiBsS2V5c1xyXG5cdFx0aWYgbm90IGguaGFzT3duUHJvcGVydHkoa2V5KVxyXG5cdFx0XHRsTWlzc2luZy5wdXNoIGtleVxyXG5cdHJldHVybiBsTWlzc2luZ1xyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbi8qKlxyXG4gKiBtZXJnZXMgdGhlIHByb3ZpZGVkIG9iamVjdHMgaW50byBhIG5ldyBvYmplY3RcclxuICogTk9URTogbm9uZSBvZiB0aGUgcHJvdmlkZWQgYXJndW1lbnRzIGFyZSBtb2RpZmllZFxyXG4gKi9cclxuXHJcbmV4cG9ydCBtZXJnZSA6PSAoLi4ubE9iamVjdHM6IGhhc2hbXSk6IGhhc2ggPT5cclxuXHJcblx0cmV0dXJuIE9iamVjdC5hc3NpZ24oe30sIGxPYmplY3RzLi4uKVxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbmV4cG9ydCBoaXQgOj0gKHBjdDogbnVtYmVyID0gNTApOiBib29sZWFuID0+XHJcblxyXG5cdHJldHVybiAoMTAwICogTWF0aC5yYW5kb20oKSA8IHBjdClcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbiMgLS0tIEFTWU5DICFcclxuXHJcbmV4cG9ydCBzbGVlcCA6PSAoc2VjOiBudW1iZXIpOiB2b2lkID0+XHJcblxyXG5cdGF3YWl0IG5ldyBQcm9taXNlKChyKSA9PiBzZXRUaW1lb3V0KHIsIDEwMDAgKiBzZWMpKVxyXG5cdHJldHVyblxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbmV4cG9ydCBzbGVlcFN5bmMgOj0gKHNlYzogbnVtYmVyKTogdm9pZCA9PlxyXG5cclxuXHRzdGFydCA6PSBEYXRlLm5vdygpXHJcblx0ZW5kIDo9IERhdGUubm93KCkgKyAxMDAwKnNlY1xyXG5cdHdoaWxlIChEYXRlLm5vdygpIDwgZW5kKVxyXG5cdHJldHVyblxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbi8qKlxyXG4gKiByZXR1cm5zIGEgc3RyaW5nIGNvbnNpc3Rpbmcgb2YgdGhlIGdpdmVuIG51bWJlclxyXG4gKiBvZiBzcGFjZSBjaGFyYWN0ZXJzXHJcbiAqL1xyXG5cclxuZXhwb3J0IHNwYWNlcyA6PSAobjogbnVtYmVyKTogc3RyaW5nID0+XHJcblxyXG5cclxuXHRyZXR1cm4gKG4gPD0gMCkgPyAnJyA6ICcgJy5yZXBlYXQobilcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG4vKipcclxuICogcmV0dXJucyBhIHN0cmluZyBjb25zaXN0aW5nIG9mIHRoZSBnaXZlbiBudW1iZXJcclxuICogb2YgVEFCIGNoYXJhY3RlcnNcclxuICovXHJcblxyXG5leHBvcnQgdGFicyA6PSAobjogbnVtYmVyKTogc3RyaW5nID0+XHJcblxyXG5cdHJldHVybiAobiA8PSAwKSA/ICcnIDogJ1xcdCcucmVwZWF0KG4pXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuLyoqXHJcbiAqIHJ0cmltIC0gc3RyaXAgdHJhaWxpbmcgd2hpdGVzcGFjZVxyXG4gKi9cclxuXHJcbmV4cG9ydCBydHJpbSA6PSAobGluZTogc3RyaW5nKTogc3RyaW5nID0+XHJcblxyXG5cdGFzc2VydCBpc1N0cmluZyhsaW5lKSwgXCJub3QgYSBzdHJpbmc6ICN7dHlwZW9mIGxpbmV9XCJcclxuXHRsTWF0Y2hlcyA6PSBsaW5lLm1hdGNoKC9eKC4qPylcXHMrJC8pXHJcblx0cmV0dXJuIChsTWF0Y2hlcyA9PSBudWxsKSA/IGxpbmUgOiBsTWF0Y2hlc1sxXVxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbi8qKlxyXG4gKiBDb3VudCB0aGUgbnVtYmVyIG9mIGEgc3BlY2lmaWMgY2hhcmFjdGVyIGluIGEgc3RyaW5nXHJcbiAqL1xyXG5cclxuZXhwb3J0IGNvdW50Q2hhcnMgOj0gKHN0cjogc3RyaW5nLCBjaDogc3RyaW5nKTogbnVtYmVyID0+XHJcblxyXG5cdGxldCBjb3VudCA9IDBcclxuXHRsZXQgcG9zID0gLTFcclxuXHR3aGlsZSAocG9zID0gc3RyLmluZGV4T2YoY2gsIHBvcysxKSkgIT0gLTFcclxuXHRcdGNvdW50ICs9IDFcclxuXHRyZXR1cm4gY291bnRcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG4vKipcclxuICogY29udmVydCBhIG11bHRpLWxpbmUgc3RyaW5nIHRvIGFuIGFycmF5XHJcbiAqIG9mIHNpbmdsZSBsaW5lIHN0cmluZ3NcclxuICovXHJcblxyXG5leHBvcnQgYmxvY2tUb0FycmF5IDo9IChibG9jazogc3RyaW5nKTogc3RyaW5nW10gPT5cclxuXHJcblx0aWYgaXNFbXB0eShibG9jaylcclxuXHRcdHJldHVybiBbXVxyXG5cdGVsc2VcclxuXHRcdHJldHVybiBibG9jay5zcGxpdCgvXFxyP1xcbi8pXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuZXhwb3J0IGFsbExpbmVzSW5CbG9jayA6PSAoXHJcblx0XHRibG9jazogc3RyaW5nXHJcblx0XHQpOiBHZW5lcmF0b3I8c3RyaW5nLCB2b2lkLCB2b2lkPiAtPlxyXG5cclxuXHRsZXQgc3RhcnQgPSAwXHJcblx0bGV0IGVuZCA9IGJsb2NrLmluZGV4T2YoJ1xcbicpXHJcblx0d2hpbGUgKGVuZCAhPSAtMSlcclxuXHRcdHlpZWxkIGJsb2NrLnN1YnN0cmluZyhzdGFydCwgZW5kKVxyXG5cdFx0c3RhcnQgPSBlbmQgKyAxXHJcblx0XHRlbmQgPSBibG9jay5pbmRleE9mKCdcXG4nLCBzdGFydClcclxuXHRpZiAoc3RhcnQgPCBibG9jay5sZW5ndGgpXHJcblx0XHR5aWVsZCBibG9jay5zdWJzdHJpbmcoc3RhcnQpXHJcblx0cmV0dXJuXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxudHlwZSBUTGluZU1hcHBlciA9IChsaW5lOiBzdHJpbmcpID0+IHN0cmluZ1xyXG5cclxuZXhwb3J0IG1hcEVhY2hMaW5lIDo9IChcclxuXHRcdGJsb2NrOiBzdHJpbmdcclxuXHRcdG1hcHBlcjogVExpbmVNYXBwZXJcclxuXHRcdCkgPT5cclxuXHJcblx0bExpbmVzIDo9IGZvciBsaW5lIG9mIGFsbExpbmVzSW5CbG9jayhibG9jaylcclxuXHRcdG1hcHBlciBsaW5lXHJcblx0cmV0dXJuIGxMaW5lcy5qb2luKCdcXG4nKVxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbi8qKlxyXG4gKiBBIHN0cmluZyBvciBzdHJpbmcgYXJyYXlcclxuICovXHJcblxyXG5leHBvcnQgdHlwZSBUQmxvY2tTcGVjID0gc3RyaW5nIHwgc3RyaW5nW11cclxuXHJcbmV4cG9ydCBpc0Jsb2NrU3BlYyA6PSAoeDogdW5rbm93bik6IHggaXMgVEJsb2NrU3BlYyA9PlxyXG5cclxuXHRyZXR1cm4gaXNTdHJpbmcoeCkgfHwgaXNBcnJheU9mU3RyaW5ncyh4KVxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbi8qKlxyXG4gKiByZXR1cm4gYW4gYXJyYXkgYXMgaXMsIGNvbnZlcnQgYSBtdWx0aS1saW5lIHN0cmluZ1xyXG4gKiB0byBhbiBhcnJheSBvZiBzaW5nbGUgbGluZSBzdHJpbmdzXHJcbiAqL1xyXG5cclxuZXhwb3J0IHRvQXJyYXkgOj0gKHN0ck9yQXJyYXk6IFRCbG9ja1NwZWMpOiBzdHJpbmdbXSA9PlxyXG5cclxuXHRpZiBBcnJheS5pc0FycmF5KHN0ck9yQXJyYXkpXHJcblx0XHRyZXR1cm4gc3RyT3JBcnJheVxyXG5cdGVsc2VcclxuXHRcdHJldHVybiBibG9ja1RvQXJyYXkoc3RyT3JBcnJheSlcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG4vKipcclxuICogY29udmVydCBhbiBhcnJheSBvZiBzdHJpbmdzIHRvIGEgc2luZ2xlIG11bHRpLWxpbmUgc3RyaW5nXHJcbiAqL1xyXG5cclxuZXhwb3J0IGFycmF5VG9CbG9jayA6PSAobExpbmVzOiBzdHJpbmdbXSk6IHN0cmluZyA9PlxyXG5cclxuXHRhc3NlcnQgaXNBcnJheShsTGluZXMpLCBcImxMaW5lcyBpcyBub3QgYW4gYXJyYXk6ICN7bExpbmVzfVwiXHJcblx0cmV0dXJuIGxMaW5lcy5maWx0ZXIoKGxpbmUpID0+IGRlZmluZWQobGluZSkpLmpvaW4oXCJcXG5cIilcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG4vKipcclxuICogcmV0dXJuIGEgc3RyaW5nIGFzIGlzLCBjb252ZXJ0IGFuIGFycmF5IG9mIHN0cmluZ3NcclxuICogdG8gYSBzaW5nbGUgbXVsdGktbGluZSBzdHJpbmdcclxuICovXHJcblxyXG5leHBvcnQgdG9CbG9jayA6PSAoc3RyT3JBcnJheTogVEJsb2NrU3BlYyk6IHN0cmluZyA9PlxyXG5cclxuXHRpZiBpc1N0cmluZyhzdHJPckFycmF5KVxyXG5cdFx0cmV0dXJuIHN0ck9yQXJyYXlcclxuXHRlbHNlXHJcblx0XHRyZXR1cm4gYXJyYXlUb0Jsb2NrKHN0ck9yQXJyYXkpXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuZXhwb3J0IGludmVydEhhc2ggOj0gKGg6IGhhc2gpOiBoYXNoID0+XHJcblxyXG5cdGFzc2VydCBpc0hhc2goaCksIFwiTm90IGEgaGFzaDogI3tofVwiXHJcblx0aFJlc3VsdDogaGFzaCA6PSB7fVxyXG5cdGZvciBrZXkgb2Yga2V5cyhoKVxyXG5cdFx0dmFsdWUgOj0gaFtrZXldXHJcblx0XHRpZiBpc1N0cmluZyh2YWx1ZSlcclxuXHRcdFx0aFJlc3VsdFt2YWx1ZV0gPSBrZXlcclxuXHRyZXR1cm4gaFJlc3VsdFxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbi8qKlxyXG4gKiBieSBkZWZhdWx0LCByZXBsYWNlIHRoZXNlIGNoYXJhY3RlcnM6XHJcbiAqICAgIGNhcnJpYWdlIHJldHVyblxyXG4gKiAgICBuZXdsaW5lXHJcbiAqICAgIFRBQlxyXG4gKiAgICBzcGFjZVxyXG4gKiBPcHRpb25hbGx5LCBhZGQgYSBjaGFyYWN0ZXIgdG8gaW5kaWNhdGUgYSBwYXJ0aWN1bGFyXHJcbiAqIHBvc2l0aW9uIGluIHRoZSBzdHJpbmdcclxuICogVmFsaWQgb3B0aW9uczpcclxuICogICAgb2Zmc2V0IC0gaW5kaWNhdGUgcG9zaXRpb24gb2Ygb2Zmc2V0XHJcbiAqICAgIHBvc2NoYXIgLSBjaGFyIHRvIHVzZSB0byBpbmRpY2F0ZSBwb3NpdGlvblxyXG4gKi9cclxuXHJcbmhEZWJ1Z1JlcGxhY2U6IGhhc2hvZjxzdHJpbmc+IDo9IHtcclxuXHRcIlxcclwiOiAn4oaQJ1xyXG5cdFwiXFxuXCI6ICfihpMnXHJcblx0XCJcXHRcIjogJ+KGkidcclxuXHRcIiBcIjogICfLsydcclxuXHRcIuKGkFwiOiAgJ1xcXFzihpAnXHJcblx0XCLihpNcIjogICdcXFxc4oaTJ1xyXG5cdFwi4oaSXCI6ICAnXFxcXOKGkidcclxuXHRcIsuzXCI6ICAnXFxcXMuzJ1xyXG5cdFwiXFxcXFwiOiAnXFxcXFxcXFwnXHJcblx0fVxyXG5cclxuaERlYnVnTm9OZXdsaW5lUmVwbGFjZTogaGFzaG9mPHN0cmluZz4gOj0ge1xyXG5cdFwiXFx0XCI6ICfihpInXHJcblx0XCIgXCI6ICAny7MnXHJcblx0XCLihpJcIjogICdcXFxc4oaSJ1xyXG5cdFwiy7NcIjogICdcXFxcy7MnXHJcblx0fVxyXG5cclxuaENSZXBsYWNlOiBoYXNob2Y8c3RyaW5nPiA6PSB7XHJcblx0XCJcXHJcIjogJ1xcXFxyJ1xyXG5cdFwiXFxuXCI6ICdcXFxcbidcclxuXHRcIlxcdFwiOiAnXFxcXHQnXHJcblx0fVxyXG5cclxuaENOb05ld2xpbmVSZXBsYWNlOiBoYXNob2Y8c3RyaW5nPiA6PSB7XHJcblx0XCJcXHRcIjogJ1xcXFx0J1xyXG5cdH1cclxuXHJcbmV4cG9ydCBlc2NhcGVTdHIgOj0gKFxyXG5cdFx0c3RyOiBzdHJpbmdcclxuXHRcdGhPcHRpb25zOiBoYXNoID0ge31cclxuXHRcdCk6IHN0cmluZyA9PlxyXG5cclxuXHR0eXBlIG9wdCA9IHtcclxuXHRcdHN0eWxlOiBzdHJpbmdcclxuXHRcdGhSZXBsYWNlOiBoYXNob2Y8c3RyaW5nPlxyXG5cdFx0YmxvY2s6IGJvb2xlYW5cclxuXHRcdG9mZnNldDogbnVtYmVyP1xyXG5cdFx0cmFuZ2U6IG51bWJlcltdPyAgICAgICMgLS0tIGNhbiBiZSBbaW50LCBpbnRdXHJcblx0XHRwb3NjaGFyOiBjaGFyXHJcblx0XHRiZWdpbmNoYXI6IGNoYXJcclxuXHRcdGVuZGNoYXI6IGNoYXJcclxuXHRcdH1cclxuXHR7XHJcblx0XHRzdHlsZSxcclxuXHRcdGhSZXBsYWNlLFxyXG5cdFx0YmxvY2ssXHJcblx0XHRvZmZzZXQsXHJcblx0XHRwb3NjaGFyLFxyXG5cdFx0YmVnaW5jaGFyLFxyXG5cdFx0ZW5kY2hhclxyXG5cdFx0fSA6PSBnZXRPcHRpb25zPG9wdD4gaE9wdGlvbnMsIHtcclxuXHRcdFx0c3R5bGU6ICdkZWJ1ZydcclxuXHRcdFx0aFJlcGxhY2U6IHt9XHJcblx0XHRcdGJsb2NrOiBmYWxzZVxyXG5cdFx0XHRvZmZzZXQ6IHVuZGVmXHJcblx0XHRcdHJhbmdlOiB1bmRlZiAgICAgICMgLS0tIGNhbiBiZSBbaW50LCBpbnRdXHJcblx0XHRcdHBvc2NoYXI6ICfilIonXHJcblx0XHRcdGJlZ2luY2hhcjogJ+KfqCdcclxuXHRcdFx0ZW5kY2hhcjogJ+KfqSdcclxuXHRcdFx0fVxyXG5cclxuXHRsZXQgaFJlYWxSZXBsYWNlOiBoYXNob2Y8c3RyaW5nPiA9IHt9XHJcblx0aWYgbm9uRW1wdHkoaFJlcGxhY2UpXHJcblx0XHRoUmVhbFJlcGxhY2UgPSBoUmVwbGFjZVxyXG5cdGVsc2UgaWYgKHN0eWxlID09ICdDJylcclxuXHRcdGlmIGJsb2NrXHJcblx0XHRcdGhSZWFsUmVwbGFjZSA9IGhDTm9OZXdsaW5lUmVwbGFjZVxyXG5cdFx0ZWxzZVxyXG5cdFx0XHRoUmVhbFJlcGxhY2UgPSBoQ1JlcGxhY2VcclxuXHRlbHNlXHJcblx0XHRpZiBibG9ja1xyXG5cdFx0XHRoUmVhbFJlcGxhY2UgPSBoRGVidWdOb05ld2xpbmVSZXBsYWNlXHJcblx0XHRlbHNlXHJcblx0XHRcdGhSZWFsUmVwbGFjZSA9IGhEZWJ1Z1JlcGxhY2VcclxuXHJcblx0W2JlZ2luUG9zLCBlbmRQb3NdIDo9IChcclxuXHRcdGlmIGRlZmluZWQocmFuZ2UpICYmIGlzQXJyYXkocmFuZ2UpXHJcblx0XHRcdHJhbmdlXHJcblx0XHRlbHNlXHJcblx0XHRcdFt1bmRlZiwgdW5kZWZdXHJcblx0XHQpXHJcblxyXG5cdGxQYXJ0czogc3RyaW5nW10gOj0gW11cclxuXHRmb3IgY2gsaSBvZiBzdHJcclxuXHRcdGlmIChpID09IG9mZnNldClcclxuXHRcdFx0bFBhcnRzLnB1c2ggcG9zY2hhclxyXG5cdFx0ZWxzZSBpZiAoaSA9PSBiZWdpblBvcylcclxuXHRcdFx0bFBhcnRzLnB1c2ggYmVnaW5jaGFyXHJcblx0XHRlbHNlIGlmIChpID09IGVuZFBvcylcclxuXHRcdFx0bFBhcnRzLnB1c2ggZW5kY2hhclxyXG5cdFx0bFBhcnRzLnB1c2ggKGhSZWFsUmVwbGFjZVtjaF0gfHwgY2gpXHJcblx0aWYgKG9mZnNldCA9PSBzdHIubGVuZ3RoKVxyXG5cdFx0bFBhcnRzLnB1c2ggcG9zY2hhclxyXG5cdHJldHVybiBsUGFydHMuam9pbignJylcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgdW5lc2NhcGVTdHIgOj0gKFxyXG5cdFx0c3RyOiBzdHJpbmdcclxuXHRcdGhPcHRpb25zOiBoYXNoID0ge31cclxuXHRcdCk6IHN0cmluZyA9PlxyXG5cclxuXHR0eXBlIG9wdCA9IHtcclxuXHRcdHN0eWxlOiBzdHJpbmdcclxuXHRcdGhSZXBsYWNlOiBoYXNob2Y8c3RyaW5nPlxyXG5cdFx0fVxyXG5cdHtzdHlsZSwgaFJlcGxhY2V9IDo9IGdldE9wdGlvbnM8b3B0PiBoT3B0aW9ucywge1xyXG5cdFx0c3R5bGU6ICdDJ1xyXG5cdFx0aFJlcGxhY2U6IHt9XHJcblx0XHR9XHJcblxyXG5cdGxldCBoUmVhbFJlcGxhY2U6IGhhc2hvZjxzdHJpbmc+ID0ge31cclxuXHRpZiBub25FbXB0eShoUmVwbGFjZSlcclxuXHRcdGhSZWFsUmVwbGFjZSA9IGhSZXBsYWNlXHJcblx0ZWxzZVxyXG5cdFx0aWYgKHN0eWxlID09ICdkZWJ1ZycpXHJcblx0XHRcdGhSZWFsUmVwbGFjZSA9IHtcclxuXHRcdFx0XHQn4oaQJzogJydcclxuXHRcdFx0XHQn4oaTJzogJ1xcbidcclxuXHRcdFx0XHQn4oaSJzogJ1xcdCdcclxuXHRcdFx0XHQny7MnOiAnICdcclxuXHRcdFx0XHR9XHJcblx0XHRlbHNlXHJcblx0XHRcdGhSZWFsUmVwbGFjZSA9IHtcclxuXHRcdFx0XHQnbic6ICdcXG4nXHJcblx0XHRcdFx0J3InOiAnJyAgICAgIyBjYXJyaWFnZSByZXR1cm4gc2hvdWxkIGp1c3QgZGlzYXBwZWFyXHJcblx0XHRcdFx0J3QnOiAnXFx0J1xyXG5cdFx0XHRcdH1cclxuXHJcblx0bGV0IGVzYyA9IGZhbHNlXHJcblx0bFBhcnRzOiBzdHJpbmdbXSA6PSBbXVxyXG5cdGZvciBjaCxpIG9mIHN0clxyXG5cdFx0aWYgKGNoID09ICdcXFxcJylcclxuXHRcdFx0aWYgZXNjXHJcblx0XHRcdFx0bFBhcnRzLnB1c2ggJ1xcXFwnXHJcblx0XHRcdFx0ZXNjID0gZmFsc2VcclxuXHRcdFx0ZWxzZVxyXG5cdFx0XHRcdGVzYyA9IHRydWVcclxuXHRcdGVsc2VcclxuXHRcdFx0aWYgZXNjXHJcblx0XHRcdFx0aWYgZGVmaW5lZChoUmVhbFJlcGxhY2VbY2hdKVxyXG5cdFx0XHRcdFx0bFBhcnRzLnB1c2ggaFJlYWxSZXBsYWNlW2NoXVxyXG5cdFx0XHRcdGVsc2VcclxuXHRcdFx0XHRcdGxQYXJ0cy5wdXNoIGNoXHJcblx0XHRcdFx0ZXNjID0gZmFsc2VcclxuXHRcdFx0ZWxzZVxyXG5cdFx0XHRcdGxQYXJ0cy5wdXNoIGNoXHJcblx0cmV0dXJuIGxQYXJ0cy5qb2luKCcnKVxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbi8qKlxyXG4gKiBkb24ndCBlc2NhcGUgbmV3bGluZSBvciBjYXJyaWFnZSByZXR1cm5cclxuICogT3B0aW9uYWxseSwgYWRkIGEgY2hhcmFjdGVyIHRvIGluZGljYXRlIGEgcGFydGljdWxhclxyXG4gKiBwb3NpdGlvbiBpbiB0aGUgc3RyaW5nXHJcbiAqL1xyXG5cclxuZXhwb3J0IGVzY2FwZUJsb2NrIDo9IChcclxuXHRibG9jazogc3RyaW5nLFxyXG5cdGhPcHRpb25zOiBoYXNoID0ge31cclxuXHQpOiBzdHJpbmcgPT5cclxuXHJcblx0aE9wdGlvbnMuYmxvY2sgPSB0cnVlXHJcblx0cmV0dXJuIGVzY2FwZVN0cihibG9jaywgaE9wdGlvbnMpXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuZXhwb3J0IHJlbHBhdGggOj0gKHBhdGg6IHN0cmluZyk6IHN0cmluZyA9PlxyXG5cclxuXHRyZXR1cm4gcmVsYXRpdmUoRGVuby5jd2QoKSwgcGF0aCkucmVwbGFjZUFsbCgnXFxcXCcsICcvJylcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG4vKipcclxuICogU3BsaXRzIGEgc3RyaW5nIG9uIHdoaXRlc3BhY2UgaW50byBhbiBhcnJheSxcclxuICogaWdub3JpbmcgYW55IGxlYWRpbmcgb3IgdHJhaWxpbmcgd2hpdGVzcGFjZVxyXG4gKi9cclxuXHJcbmV4cG9ydCB3c1NwbGl0IDo9IChzdHI6IHN0cmluZyk6IHN0cmluZ1tdID0+XHJcblxyXG5cdG5ld3N0ciA6PSBzdHIudHJpbSgpXHJcblx0aWYgKG5ld3N0ciA9PSAnJylcclxuXHRcdHJldHVybiBbXVxyXG5cdGVsc2VcclxuXHRcdHJldHVybiBuZXdzdHIuc3BsaXQoL1xccysvKVxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbi8qKlxyXG4gKiBzcGxpdHMgZWFjaCBzdHJpbmcgb24gd2hpdGVzcGFjZSBpZ25vcmluZyBhbnkgbGVhZGluZ1xyXG4gKiBvciB0cmFpbGluZyB3aGl0ZXNwYWNlLCBhbmQgcmV0dXJucyBhbiBhcnJheSBvZlxyXG4gKiBhbGwgc3Vic3RyaW5ncyBvYnRhaW5lZFxyXG4gKi9cclxuXHJcbmV4cG9ydCB3b3JkcyA6PSAoLi4ubFN0cmluZ3M6IHN0cmluZ1tdKTogc3RyaW5nW10gPT5cclxuXHJcblx0bGV0IGxXb3JkcyA9IFtdXHJcblx0Zm9yIHN0ciBvZiBsU3RyaW5nc1xyXG5cdFx0Zm9yIHdvcmQgb2Ygd3NTcGxpdChzdHIpXHJcblx0XHRcdGxXb3Jkcy5wdXNoIHdvcmRcclxuXHRyZXR1cm4gbFdvcmRzXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuLyoqXHJcbiAqIGNhbGN1bGF0ZXMgdGhlIG51bWJlciBvZiBleHRyYSBjaGFyYWN0ZXJzIG5lZWRlZCB0b1xyXG4gKiBtYWtlIHRoZSBnaXZlbiBzdHJpbmcgaGF2ZSB0aGUgZ2l2ZW4gbGVuZ3RoLlxyXG4gKiBJZiBub3QgcG9zc2libGUsIHJldHVybnMgMFxyXG4gKi9cclxuXHJcbmV4cG9ydCBnZXRORXh0cmEgOj0gKHN0cjogc3RyaW5nLCBsZW46IG51bWJlcik6IG51bWJlciA9PlxyXG5cclxuXHRleHRyYSA6PSBsZW4gLSBzdHIubGVuZ3RoXHJcblx0cmV0dXJuIChleHRyYSA+IDApID8gZXh0cmEgOiAwXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuLyoqXHJcbiAqIHBhZHMgdGhlIGdpdmVuIHN0cmluZyBvbiB0aGUgcmlnaHQgd2l0aFxyXG4gKiB0aGUgZ2l2ZW4gY2hhcmFjdGVyLCB0byB0aGUgZ2l2ZW4gbGVuZ3RoXHJcbiAqL1xyXG5cclxuZXhwb3J0IHJwYWQgOj0gKHN0cjogc3RyaW5nLCBsZW46IG51bWJlciwgY2g6IHN0cmluZz0nICcpOiBzdHJpbmcgPT5cclxuXHJcblx0YXNzZXJ0IChjaC5sZW5ndGggPT0gMSksIFwiTm90IGEgY2hhclwiXHJcblx0ZXh0cmEgOj0gZ2V0TkV4dHJhKHN0ciwgbGVuKVxyXG5cdHJldHVybiBzdHIgKyBjaC5yZXBlYXQoZXh0cmEpXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuLyoqXHJcbiAqIHBhZHMgdGhlIGdpdmVuIHN0cmluZyBvbiB0aGUgbGVmdCB3aXRoXHJcbiAqIHRoZSBnaXZlbiBjaGFyYWN0ZXIsIHRvIHRoZSBnaXZlbiBsZW5ndGhcclxuICovXHJcblxyXG5leHBvcnQgbHBhZCA6PSAoc3RyOiBzdHJpbmcsIGxlbjogbnVtYmVyLCBjaDogc3RyaW5nPScgJyk6IHN0cmluZyA9PlxyXG5cclxuXHRhc3NlcnQgKGNoLmxlbmd0aCA9PSAxKSwgXCJOb3QgYSBjaGFyXCJcclxuXHRleHRyYSA6PSBnZXRORXh0cmEoc3RyLCBsZW4pXHJcblx0cmV0dXJuIGNoLnJlcGVhdChleHRyYSkgKyBzdHJcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbiMgLS0tIHZhbGlkIG9wdGlvbnM6XHJcbiMgICAgICAgIGNoYXIgLSBjaGFyIHRvIHVzZSBvbiBsZWZ0IGFuZCByaWdodFxyXG4jICAgICAgICBidWZmZXIgLSBudW0gc3BhY2VzIGFyb3VuZCB0ZXh0IHdoZW4gY2hhciA8PiAnICdcclxuXHJcbmV4cG9ydCBjZW50ZXJlZCA6PSAoXHJcblx0dGV4dDogc3RyaW5nLFxyXG5cdHdpZHRoOiBudW1iZXIsXHJcblx0Y2hhcjogc3RyaW5nID0gJyAnLFxyXG5cdG51bUJ1ZmZlcjogbnVtYmVyID0gMlxyXG5cdCk6IHN0cmluZyA9PlxyXG5cclxuXHR0b3RTcGFjZXMgOj0gd2lkdGggLSB0ZXh0Lmxlbmd0aFxyXG5cdGlmICh0b3RTcGFjZXMgPD0gMClcclxuXHRcdHJldHVybiB0ZXh0XHJcblx0bnVtTGVmdCA6PSBNYXRoLmZsb29yKHRvdFNwYWNlcyAvIDIpXHJcblx0bnVtUmlnaHQgOj0gdG90U3BhY2VzIC0gbnVtTGVmdFxyXG5cdGlmIChjaGFyID09ICcgJylcclxuXHRcdHJldHVybiBzcGFjZXMobnVtTGVmdCkgKyB0ZXh0ICsgc3BhY2VzKG51bVJpZ2h0KVxyXG5cdGVsc2VcclxuXHRcdGJ1ZiA6PSAnICcucmVwZWF0KG51bUJ1ZmZlcilcclxuXHRcdGxlZnQgOj0gY2hhci5yZXBlYXQobnVtTGVmdCAtIG51bUJ1ZmZlcilcclxuXHRcdHJpZ2h0IDo9IGNoYXIucmVwZWF0KG51bVJpZ2h0IC0gbnVtQnVmZmVyKVxyXG5cdFx0cmV0dXJuIGxlZnQgKyBidWYgKyB0ZXh0ICsgYnVmICsgcmlnaHRcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG4vKipcclxuICogcGFkIGEgc3RyaW5nIG9uIHRoZSBsZWZ0LCByaWdodCwgb3IgYm90aFxyXG4gKiB0byB0aGUgZ2l2ZW4gd2lkdGhcclxuICovXHJcblxyXG5leHBvcnQgdHlwZSBUQWxpZ25tZW50ID0gJ2wnfCdjJ3wncid8J2xlZnQnfCdjZW50ZXInfCdyaWdodCdcclxuXHJcbmV4cG9ydCBpc0FsaWdubWVudCA6PSAoeDogdW5rbm93bik6IHggaXMgVEFsaWdubWVudCA9PlxyXG5cclxuXHRyZXR1cm4gKFxyXG5cdFx0ICAgKHR5cGVvZiB4ID09ICdzdHJpbmcnKVxyXG5cdFx0JiYgWydsJywnYycsJ3InLCdsZWZ0JywnY2VudGVyJywncmlnaHQnXS5pbmNsdWRlcyh4KVxyXG5cdFx0KVxyXG5cclxuZXhwb3J0IGFsaWduU3RyaW5nIDo9IChcclxuXHRzdHI6IHN0cmluZyxcclxuXHR3aWR0aDogbnVtYmVyLFxyXG5cdGFsaWduOiBUQWxpZ25tZW50XHJcblx0KTogc3RyaW5nIC0+XHJcblxyXG5cdHN3aXRjaCBhbGlnblxyXG5cdFx0d2hlbiAnbGVmdCcsICdsJ1xyXG5cdFx0XHRyZXR1cm4gcnBhZChzdHIsIHdpZHRoKVxyXG5cdFx0d2hlbiAnY2VudGVyJywgJ2MnXHJcblx0XHRcdHJldHVybiBjZW50ZXJlZChzdHIsIHdpZHRoKVxyXG5cdFx0d2hlbiAncmlnaHQnLCAncidcclxuXHRcdFx0cmV0dXJuIGxwYWQoc3RyLCB3aWR0aClcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG4vKipcclxuICogY29udmVydHMgdGhlIGdpdmVuIG51bWJlciB0byBhIHN0cmluZywgdGhlbiBwYWRzIG9uIHRoZSBsZWZ0XHJcbiAqIHdpdGggemVyb3MgdG8gYWNoaWV2ZSB0aGUgZ2l2ZW4gbGVuZ3RoXHJcbiAqL1xyXG5cclxuZXhwb3J0IHpwYWQgOj0gKG46IG51bWJlciwgbGVuOiBudW1iZXIpOiBzdHJpbmcgPT5cclxuXHJcblx0cmV0dXJuIGxwYWQobi50b1N0cmluZygpLCBsZW4sICcwJylcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbiMgR0VORVJBVE9SXHJcblxyXG5leHBvcnQgYWxsTWF0Y2hlcyA6PSAoc3RyOiBzdHJpbmcsIHJlOiBSZWdFeHApOiBHZW5lcmF0b3I8c3RyaW5nW10sIHZvaWQsIHZvaWQ+IC0+XHJcblxyXG5cdCMgLS0tIEVuc3VyZSB0aGUgcmVnZXggaGFzIHRoZSBnbG9iYWwgZmxhZyAoZykgc2V0XHJcblx0bmV3cmUgOj0gbmV3IFJlZ0V4cChyZSwgcmUuZmxhZ3MgKyAocmUuZmxhZ3MuaW5jbHVkZXMoJ2cnKSA/ICcnIDogJ2cnKSlcclxuXHRsZXQgbE1hdGNoZXM6IHN0cmluZ1tdIHwgbnVsbCA9IG51bGxcclxuXHR3aGlsZSBkZWZpbmVkKGxNYXRjaGVzID0gbmV3cmUuZXhlYyhzdHIpKVxyXG4gIFx0XHR5aWVsZCBsTWF0Y2hlc1xyXG5cdHJldHVyblxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbi8qKlxyXG4gKiBBIGdlbmVyYXRvciB0aGF0IHlpZWxkcyBpbnRlZ2VycyBzdGFydGluZyB3aXRoIDAgYW5kXHJcbiAqIGNvbnRpbnVpbmcgdG8gbi0xXHJcbiAqL1xyXG5cclxuZXhwb3J0IHJhbmdlIDo9IChcclxuXHRuOiBudW1iZXJcclxuXHQpOiBHZW5lcmF0b3I8bnVtYmVyLCB2b2lkLCB2b2lkPiAtPlxyXG5cclxuXHRsZXQgaSA9IDBcclxuXHR3aGlsZSAoaSA8IG4pXHJcblx0XHR5aWVsZCBpXHJcblx0XHRpID0gaSArIDFcclxuXHRyZXR1cm5cclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgY2xhc3MgRmV0Y2hlcjxUPlxyXG5cclxuXHRpdGVyOiBJdGVyYXRvcjxUPlxyXG5cdGJ1ZmZlcjogVD8gPSB1bmRlZlxyXG5cclxuXHRjb25zdHJ1Y3RvcihAaXRlcjogSXRlcmF0b3I8VD4sIEBlb2ZWYWx1ZTogVClcclxuXHJcblx0cGVlaygpOiBUXHJcblx0XHRpZiBkZWZpbmVkKEBidWZmZXIpXHJcblx0XHRcdHJldHVybiBAYnVmZmVyXHJcblx0XHRlbHNlXHJcblx0XHRcdHt2YWx1ZSwgZG9uZX0gOj0gQGl0ZXIubmV4dCgpXHJcblx0XHRcdGlmIGRvbmVcclxuXHRcdFx0XHRyZXR1cm4gQGVvZlZhbHVlXHJcblx0XHRcdGVsc2VcclxuXHRcdFx0XHRAYnVmZmVyID0gdmFsdWVcclxuXHRcdFx0XHRyZXR1cm4gdmFsdWVcclxuXHJcblx0Z2V0KGV4cGVjdGVkOiBUPz11bmRlZik6IFRcclxuXHRcdGxldCByZXN1bHQ6IFQgPSBAZW9mVmFsdWVcclxuXHRcdGlmIGRlZmluZWQoQGJ1ZmZlcilcclxuXHRcdFx0cmVzdWx0ID0gQGJ1ZmZlclxyXG5cdFx0XHRAYnVmZmVyID0gdW5kZWZcclxuXHRcdGVsc2VcclxuXHRcdFx0e3ZhbHVlLCBkb25lfSA6PSBAaXRlci5uZXh0KClcclxuXHRcdFx0cmVzdWx0ID0gZG9uZSA/IEBlb2ZWYWx1ZSA6IHZhbHVlXHJcblx0XHRpZiBkZWZpbmVkKGV4cGVjdGVkKVxyXG5cdFx0XHRhc3NlcnQgZGVlcEVxdWFsKHJlc3VsdCwgZXhwZWN0ZWQpLFxyXG5cdFx0XHRcdFx0XCIje2V4cGVjdGVkfSBleHBlY3RlZFwiXHJcblx0XHRyZXR1cm4gcmVzdWx0XHJcblxyXG5cdHNraXAoZXhwZWN0ZWQ6IFQ/PXVuZGVmKTogdm9pZFxyXG5cdFx0QGdldChleHBlY3RlZClcclxuXHRcdHJldHVyblxyXG5cclxuXHRhdEVuZCgpOiBib29sZWFuXHJcblx0XHRpZiBkZWZpbmVkKEBidWZmZXIpXHJcblx0XHRcdHJldHVybiBmYWxzZVxyXG5cdFx0ZWxzZVxyXG5cdFx0XHR7dmFsdWUsIGRvbmV9IDo9IEBpdGVyLm5leHQoKVxyXG5cdFx0XHRpZiBkb25lIHx8ICh2YWx1ZSA9PSBAZW9mVmFsdWUpXHJcblx0XHRcdFx0cmV0dXJuIHRydWVcclxuXHRcdFx0ZWxzZVxyXG5cdFx0XHRcdEBidWZmZXIgPSB2YWx1ZVxyXG5cdFx0XHRcdHJldHVybiBmYWxzZVxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbmV4cG9ydCBhc3NlcnRTYW1lU3RyIDo9IChcclxuXHRcdHN0cjE6IHN0cmluZyxcclxuXHRcdHN0cjI6IHN0cmluZ1xyXG5cdFx0KTogdm9pZCA9PlxyXG5cclxuXHRpZiAoc3RyMSAhPSBzdHIyKVxyXG5cdFx0Y29uc29sZS5sb2cgY2VudGVyZWQoXCJTdHJpbmdzIERpZmZlcjpcIiwgNjQsICctJylcclxuXHRcdGNvbnNvbGUubG9nIGNlbnRlcmVkKFwic3RyaW5nIDFcIiwgNjQsICctJylcclxuXHRcdGNvbnNvbGUubG9nIHN0cjFcclxuXHRcdGNvbnNvbGUubG9nIGNlbnRlcmVkKFwic3RyaW5nIDJcIiwgNjQsICctJylcclxuXHRcdGNvbnNvbGUubG9nIHN0cjJcclxuXHRcdGNvbnNvbGUubG9nICctJy5yZXBlYXQoNjQpXHJcblxyXG5cdGFzc2VydCAoc3RyMSA9PSBzdHIyKSwgXCJzdHJpbmdzIGRpZmZlclwiXHJcblx0cmV0dXJuXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuZXhwb3J0IGludGVycG9sYXRlIDo9IChcclxuXHRcdHN0cjogc3RyaW5nXHJcblx0XHRoUmVwbGFjZTogaGFzaG9mPHN0cmluZz4gICAjIC0tLSB7IDx0YWc+OiA8cmVwbGFjZW1lbnQ+LCAuLi4gfVxyXG5cdFx0KTogc3RyaW5nID0+XHJcblxyXG5cdGZvciBrZXkgb2Yga2V5cyhoUmVwbGFjZSlcclxuXHRcdGFzc2VydCAoa2V5WzBdID09ICckJyksIFwiYWxsIGtleXMgbXVzdCBzdGFydCB3aXRoICckJ1wiXHJcblx0cmUgOj0gLy8vXHJcblx0XHRcXCRcclxuXHRcdCg/OltBLVphLXpdW0EtWmEtejAtOV0qKVxyXG5cdFx0Ly8vZ1xyXG5cdHJldHVybiBzdHIucmVwbGFjZUFsbChyZSwgKG1hdGNoOiBzdHJpbmcpID0+XHJcblx0XHRyZXR1cm4gaFJlcGxhY2VbbWF0Y2hdIHx8IG1hdGNoXHJcblx0XHQpXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4jIC0tLSBnZW5lcmF0ZSByYW5kb20gbGFiZWxzXHJcblxyXG5sYWJlbEdlbiA6PSAoKTogR2VuZXJhdG9yPHN0cmluZywgdm9pZCwgdm9pZD4gLT5cclxuXHJcblx0Zm9yIGNoIG9mIFsnQScuLidaJ11cclxuXHRcdHlpZWxkIGNoXHJcblx0Zm9yIGNoIG9mIFsnQScuLidaJ11cclxuXHRcdGZvciBjaDIgb2YgWydBJy4uJ1onXVxyXG5cdFx0XHR5aWVsZCBjaCArIGNoMlxyXG5cdGZvciBjaCBvZiBbJ0EnLi4nWiddXHJcblx0XHRmb3IgY2gyIG9mIFsnQScuLidaJ11cclxuXHRcdFx0Zm9yIGNoMyBvZiBbJ0EnLi4nWiddXHJcblx0XHRcdFx0eWllbGQgY2ggKyBjaDIgKyBjaDNcclxuXHRyZXR1cm5cclxuXHJcbiMgLS0tIENyZWF0ZSBhbiBpdGVyYXRvciBmcm9tIHRoZSBnZW5lcmF0b3JcclxubGFiZWxzIDo9IGxhYmVsR2VuKClcclxuXHJcbmV4cG9ydCByYW5kb21MYWJlbCA6PSAoKTogc3RyaW5nID0+XHJcblx0bGFiZWwgOj0gbGFiZWxzLm5leHQoKVxyXG5cdHJldHVybiBsYWJlbC5kb25lID8gJ0VSUiEnIDogbGFiZWwudmFsdWVcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgcmVxdWlyZSA6PSBjcmVhdGVSZXF1aXJlKGltcG9ydC5tZXRhLnVybClcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgZ2V0TGluZUFuZENvbHVtbiA6PSAodGV4dDogc3RyaW5nLCBwb3M6IG51bWJlcikgPT5cclxuXHJcblx0IyAtLS0gR2V0IGxpbmUgbnVtYmVyIGJ5IGNvdW50aW5nIG51bWJlciBvZiBcXG4gY2hhcnNcclxuXHQjICAgICAgICBiZWZvcmUgdGhlIGN1cnJlbnQgcG9zaXRpb25cclxuXHQjICAgICBHZXQgY29sdW1uIG51bWJlciBieSBmaW5kaW5nIGNsb3Nlc3QgcHJldmlvdXMgcG9zaXRpb25cclxuXHQjICAgICAgICBvZiBhIFxcbiBhbmQgY29tcHV0aW5nIHRoZSBkaWZmZXJlbmNlXHJcblxyXG5cdHNob3J0U3RyIDo9IHRleHQuc3Vic3RyaW5nKDAsIHBvcylcclxuXHRyZXR1cm4gW1xyXG5cdFx0Y291bnRDaGFycyhzaG9ydFN0ciwgXCJcXG5cIikgKyAxXHJcblx0XHRwb3MgLSBzaG9ydFN0ci5sYXN0SW5kZXhPZignXFxuJylcclxuXHRcdF1cclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgY2xhc3MgS2V5ZWRTdHJpbmdTZXRcclxuXHJcblx0aE1hcCA6PSBuZXcgTWFwPHN0cmluZywgU2V0PHN0cmluZz4+XHJcblxyXG5cdCMgLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLlxyXG5cclxuXHRhZGQoa2V5OiBzdHJpbmcsIHZhbHVlOiBzdHJpbmcpOiB2b2lkXHJcblxyXG5cdFx0YVNldCA6PSBAaE1hcC5nZXQga2V5XHJcblx0XHRpZiBkZWZpbmVkKGFTZXQpXHJcblx0XHRcdGFTZXQuYWRkIHZhbHVlXHJcblx0XHRlbHNlXHJcblx0XHRcdG5ld1NldCA6PSBuZXcgU2V0PHN0cmluZz4oKVxyXG5cdFx0XHRuZXdTZXQuYWRkIHZhbHVlXHJcblx0XHRcdEBoTWFwLnNldCBrZXksIG5ld1NldFxyXG5cdFx0cmV0dXJuXHJcblxyXG5cdCMgLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLlxyXG5cclxuXHRhbGxLZXlzKCk6IEdlbmVyYXRvcjxzdHJpbmcsIHZvaWQsIHZvaWQ+XHJcblxyXG5cdFx0eWllbGQqIEBoTWFwLmtleXMoKVxyXG5cdFx0cmV0dXJuXHJcblxyXG5cdCMgLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLlxyXG5cclxuXHRhbGxWYWx1ZXMoa2V5OiBzdHJpbmcpOiBHZW5lcmF0b3I8c3RyaW5nLCB2b2lkLCB2b2lkPlxyXG5cclxuXHRcdGFTZXQgOj0gQGhNYXAuZ2V0IGtleVxyXG5cdFx0aWYgZGVmaW5lZChhU2V0KVxyXG5cdFx0XHR5aWVsZCogYVNldC52YWx1ZXMoKVxyXG5cdFx0cmV0dXJuXHJcbiJdfQ==