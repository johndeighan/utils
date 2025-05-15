"use strict";
const lData: (number | string | undefined)[] = [
	42,
	'abc',
	undefined
	]

const lRow: string[] = lData.map((item) => {
	if (item === undefined) {
		return ''
	}
	if (typeof item === 'number') {
		return item.toFixed(2)
	}
	if (typeof item === 'string') {
		if (item.match(/^\d+(\.\d*)?([Ee]\d+)?$/)) {
			const num = parseFloat(item)
			if (Number.isNaN(num)) {
				return item
			}
			else {
				return num.toFixed(2)
			}
		}
		else {
			return item
		}
	}
})

console.dir(lRow)
