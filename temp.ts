"use strict";

// ---------------------------------------------------------------------------

const isClassInstance = (
		x: unknown,
		lReqKeys: string[]=[]
		): boolean => {

	if (!(x instanceof Object)) {
		return false
	}

	for (const key of lReqKeys) {
		if (!(key in x)) {
			return false
		}
		const item = x[key]
		if (item === undefined) {
			return false
		}
	}
	return true
}
