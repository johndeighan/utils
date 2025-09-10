ast-walker
==========

Walk a TypeScript AST
---------------------

```coffee
import {ts2ast} from 'typescript'

tsCode := """
	import {undef} from 'datatypes'
	export sum := (a: number, b: number) =>
		return a + b
	"""

walker := getAstWalker(ts2ast(tsCode))
for hInfo of walker()
	console.dir hInfo
```
