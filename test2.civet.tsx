"use strict";
function Any(lRules) {

	return (state) => {
		for (const rule of lRules) {
			const next = rule(state)
			if (next !== state) {
				return next
			}
		}
		return state
	}
}

