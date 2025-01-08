@jdeighan/utils
===============

**NOTE**: All code in this README is `civet` code (danielx/civet on npm)
However, I have `civet` set up to be CoffeeScript compatible.
The main points are that:

1. The body of program structures, such as  `if`, `while`, etc.
	are indicated by indentation, a la Python, not `{` and `}'.
	For example:

```coffee
if x == 2
	console.log "OK"
	return true
else
	console.log "Bad"
	return false
```

2. Note that semicolons are optional - I never use them.

3. Parentheses around function arguments or if/while conditions
	are optional, though I always include the parentheses for
	function calls that are passed as arguments to other
	functions to avoid ambiguity. E.g. `equal 2+2, 4` means `
	equal(2+2, 4);`. I also use parens around comparison conditions,
	e.g. `(something == 'Python')` though it's not required.

4. Comments begin with a `#` - `civet` also allows `/* */` style
	comments, though CoffeeScript does not.

5. Any function that includes an `await` is async and any function
	that includes a `yield` is a generator.

6. Constants can be declared using `:=` (CoffeeScript does not allow
	declaring values, i.e. you can't use `const`, `let` or `var`, but
	civet allows it and even provides some shortcut symbols:

```coffee
x := 13      # --- declares a constant
let x = 42   #     declares a variable
x .= 42      #     also declares a variable
```

Unit Testing
------------

Using `@jdeighan/utils` allows you to dramatically simplify
your unit tests. Here is a sample unit test file that tests
functions in `@jdeighan/utils/fs.js`:

```coffee
equal  fileExt("C:/temp/file.txt"), ".txt"
equal  withExt("C:/temp/file.txt", ".js"), "C:/temp/file.js"
equal  normalizePath("C:/temp/file.txt"), "c:/temp/file.txt"
equal  mkpath("C:/temp/file.txt"), "c:/temp/file.txt"
```

The 4 functions tested here are:

`fileExt()` - extract the file extension
`withExt()` - replace one file extension with another
`normalizePath()` - replace `\` with `/`, lower-case drive letters
`mkpath()` - combine parts of a path into a single path, normalize path

You probably noticed that there are no names provided for unit
tests. That's because a name is automatically generated for
each test, such as "line 99" where 99 is the line number where
the test statement exists. This makes it trivial to locate failing
tests. Note that, when inline source maps exist, the line number
will be from the original source file, even if you use `civet`,
`CoffeeScript`, or any other JavaScript generating system to
write your unit tests.
