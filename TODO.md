to do

Work on library nice.lib.civet
	in fromNice(), create a Fetcher object, then use
	recursive descent parsing

When using isType(), if the value passed has circular references,
the fields are set to undefined, and therefore fail type checking.

test function ast2ts in ts.lib.civet

In coverage command, use a function to get valid stubs

coverage command, without options, should list missing symbols at end

In .symbols, if a lib is not followed by symbols,
automatically add all exported symbols.

work on all libs to be sure there are unit tests for everything
by using analyze command

in compile.lib.test.civet, the last test calls compileFile()
which fails

runAllUnitTests() should use glob pattern from runUnitTestsFor()
get working: deno task build:compile
check that the 'compile' unit tests testing everything in lib

Add examples to all entrypoint modules
Ask Deno:
	- how to link to unit tests
	- why Deno doesn't think I have all module docs

Document all libraries

test commands compile, runtemp, utest

command 'compile' should log post-processing
implement -w options (esp. on compile command)

cleanup should only remove *.js files that it KNOWS they were
generated by compileFile()

// WORKS FOR TYPESCRIPT:
1. Set tsconfig.json to:
	module: "nodenext"
	target: "esnext"
	moduleResolution: "nodenext"
	esModuleInterop: true

2. add a JSR module using command:
	npx jsr add @std/fs

3. Import from the lib as:
	import {copy} from "@std/fs";

4. Execute:
	npm install --save-dev @types/node

5. Typecheck a file:
	civet --typecheck <path>




International Congress of Speleology

https://speleo2025.org/information/registration

Mon 21
Tue 22
Wed 23 - City tour in Belo Horizonte
Thu 24
Fri 25
