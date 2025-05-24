"use strict";
// v8-module.civet
import {getMyCaller, stackFrame} from '../../src/lib/v8-stack.lib.ts'
// ---------------------------------------------------------------------------
type bothFrames = ((stackFrame | undefined))[]
const isBothFrames = (x: any): x is bothFrames => {
	return Array.isArray(x) && (x.length === 2)
}
// ---------------------------------------------------------------------------
export const getBoth = function(): bothFrames {
	const result = secondFunc('both')
	if (Array.isArray(result)) {
		return result
	}
	else {
		throw new Error("Expected array, got stackFrame")
	}
}
// ---------------------------------------------------------------------------
export const getDirect = function(): (stackFrame | undefined) {
	const result = secondFunc('direct')
	if (Array.isArray(result)) {
		throw new Error("Got unexpected array")
	}
	return result
}
// ---------------------------------------------------------------------------
export const getOutside = function(): (stackFrame | undefined) {
	const result = secondFunc('outside')
	if (Array.isArray(result)) {
		throw new Error("Got unexpected array")
	}
	return result
}
// ---------------------------------------------------------------------------
const secondFunc = function(type: string): bothFrames | (stackFrame | undefined) {
	return thirdFunc(type)
}
// ---------------------------------------------------------------------------
const thirdFunc = function(type: string): bothFrames | (stackFrame | undefined) {
	// --- direct caller should be 'secondFunc'
	//     outside caller should be the function
	//        that called getCaller()
	switch(type) {
		case 'both': {
			return [getMyCaller(), getMyCaller()]
		}
		case 'direct': {
			return getMyCaller()
		}
		case 'outside': {
			return getMyCaller()
		}
		default: {
			throw new Error(`Unknown type: ${type}`)
		}
	}
}