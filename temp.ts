"use strict";
class Fetcher<T> {

	iter: Iterator<T>
	buffer: (T | undefined) = undefined

	eofValue: T;constructor(iter1: Iterator<T>, eofValue: T){this.iter = iter1;this.eofValue = eofValue;}

	peek(): T {
		if (this.buffer === undefined) {
			const {value, done} = this.iter.next()
			if (done) {
				return this.eofValue
			}
			else {
				this.buffer = value
				return value
			}
		}
		else {
			return this.buffer
		}
	}

	get(): T {
		const result: T = (
			(()=>{if (this.buffer === undefined) {
				const {value, done} = this.iter.next()
				if (done) {
					return this.eofValue
				}
				else {
					return value
				}
			}
			else {
				const save: T = this.buffer
				this.buffer = undefined
				return save
			}})()
			)
		return result
	}
}

const range = function*(n: number): Generator<number, void, void> {
	let i = 0
	while (i < n) {
		yield i
		i += 1
	}
	return
}

const fetcher = new Fetcher<number>(range(3), -1)

console.log(fetcher.get())
