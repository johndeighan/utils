"use strict";
const lData: (number | string | undefined)[] = [
	42,
	'abc',
	undefined
	];

const lRow: string[] = lData.map((item) => {
	if (item === undefined) {
		return '';
	}
	if (typeof item === 'number') {
		return item.toFixed(2);
	}
	if (typeof item === 'string') {
		return item;
	}
})

console.dir(lRow);
