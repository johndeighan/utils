class State {
	text: string = ''
	pos: number = 0

// 	constructor(
// 			text: string,
// 			pos: number,
// 			hProps: Object
// 			)
// 	constructor(
// 			state: State,
// 			advanceBy: number
// 			)
	constructor(
			src: string | State,
			n: number = 0,
			hProps: Object = {}
			) {
		if (typeof src === 'string') {
			this.text = src
			this.pos = n
			Object.assign(this, hProps)
		}
		else {
			Object.assign(this, src)
			this.pos += n
		}
	}
}

let state1 = new State('abcde', 1);
console.log(state1);
let state2 = new State(state1, 2);
console.log(state2);
