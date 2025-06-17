@jdeighan/utils
===============

**NOTE**: All code in this README is `civet` code (danielx/civet on npm)
However, I have `civet` set up to be (mostly) CoffeeScript compatible.
The main points are that:

1. The body of program structures, such as  `if`, `while`, etc.
	are indicated by indentation, a la Python, not `{` and `}'.
	For example:

```coffee
if (x == 2)
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
	that includes a `yield` is a generator. No need for the `async`
	keyword or JavaScripts weird generator naming convention.

6. Constants can be declared using `:=` (CoffeeScript does not allow
	declaring values at all, i.e. you can't use `const`, `let` or `var`,
	but civet allows it and even provides some shortcut symbols:

```coffee
x := 13      # --- declares a constant
let x = 42   #     declares a let variable
x .= 42      #     also declares a let variable (I don't use it)
```

Debugging
---------

To debug the temp file, put a 'debugger' statement at the top
of temp.js or temp.civet

Then, run:

```bash
$ deno task debug
```

Then, open Chrome, enter URL "chrome://inspect"
Then, click on "Open dedicated DevTools for Node"
Then, click on 'Run' to continue to the debugger statement

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

Logging
-------

Logging is accomplished via one of 4 functions:
	DBG()
	LOG()
	WARN()
	ERR()

There are 4 possible handlers (see usage below),
	where they write to and any prefix added
	in addition to indentation by level

	console - CONSOLE
	profile - CONSOLE   prefix with ms since start
	file    - LOG FILE
	pfile   - LOG FILE  prefix with ms since start

Whether logging happens depends on the 'log level'.
Here are the functions supported and handlers invoked
for each possible log level

	'profile' - ALL       - invoke 'profile' and 'pfile'
	'debug'   - ALL       - invoke 'console' and 'file'
	'info'    - ALL - DBG - invoke 'console' and 'file'
	'warn'    - WARN, ERR - invoke 'console' and 'file
	'error'   - ERR       - invoke 'console' and 'file'
	'file'    - ALL       - invoke 'file'
	'silent'  - ERR       - invoke no handlers

The initial log level is 'info'
The log file is at "./logs/logs.txt"

There are also utility functions:

setLogLevel(level) - set the log level
curLogLevel() - return the current log level
clearLog - make log file empty
resetLog - clear log and set level to 'info'

Using uglify-js with deno
-------------------------

```bash
$ deno install npm:uglify-js
$ deno install npm:@types/uglify-js
```
Then
```coffee
import {minify} from 'npm:uglify-js'

minimized := minify(jsCode).code
```

Using rd-parse with deno
------------------------

```bash
$ deno install npm:rd-parse
```

