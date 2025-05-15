"use strict";
const lData: (number | string | undefined)[] = [
	42,
	'abc',
	undefined
	]

const lRow: string[] = lData.map((item) => {
	switch(typeof item) {
		case 'undefined': {
			return '';
		}
		case 'number': {
			return item.toFixed(2);
		}
		case 'string': {
			return item;
		}
	}
})

console.dir(lRow)
