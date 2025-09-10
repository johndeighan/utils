"use strict";
// v8-module.civet
import {getMyCaller, TStackFrame} from 'v8-stack'
// ---------------------------------------------------------------------------
type bothFrames = ((TStackFrame?))[]
const isBothFrames = (x: unknown): x is bothFrames => {
	return Array.isArray(x) && (x.length === 2)
}
// ---------------------------------------------------------------------------
export const getBoth = function(): bothFrames {
	const result = secondFunc('both')
	if (Array.isArray(result)) {
		return result
	}
	else {
		throw new Error("Expected array, got TStackFrame")
	}
}
// ---------------------------------------------------------------------------
export const getDirect = function(): (TStackFrame?) {
	const result = secondFunc('direct')
	if (Array.isArray(result)) {
		throw new Error("Got unexpected array")
	}
	return result
}
// ---------------------------------------------------------------------------
export const getOutside = function(): (TStackFrame?) {
	const result = secondFunc('outside')
	if (Array.isArray(result)) {
		throw new Error("Got unexpected array")
	}
	return result
}
// ---------------------------------------------------------------------------
const secondFunc = function(type: string): bothFrames | (TStackFrame?) {
	return thirdFunc(type)
}
// ---------------------------------------------------------------------------
const thirdFunc = function(type: string): bothFrames | (TStackFrame?) {
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