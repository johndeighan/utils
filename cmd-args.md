cmd-args
========

Parse command line arguments, optionally specifying which
options are allowed and/or the expected number of non-options

The function `getCmdArgs()` accepts up to 3 arguments:

1. A description of expected command line arguments
	(described below) which defaults to undef, which results
	in no checking of provided command line arguments

2. The command line arguments themselves. Defaults to Deno.args()

3. An options hash, defaults to undef
	there is currently only one option, `doSetLogger`
	which defaults to true

To obtain help for a command, the user can simply enter:

```bash
$ <command name> -h
```

SYNOPSIS
--------

```coffee
# --- NOTE: typically only the first argument is provided

[hArgs, lNonOptions] := getCmdArgs {
	_: {
		desc: """
			files to compile, either:
				- <stub>.lib  - file <stub>.lib.<ext>
				- a full or relative file path
			where <ext> is a valid extension to compile
			"""
		min: 1
		}
	f: "force compilation"
	w: {
		desc: "watch for and recompile files if they change"
		defaultVal: false
		}
	label: {
		type: 'string'
		desc: 'Label to display in error messages'
		defaultVal: '<No label>'
		}
	}
```
explanation
-----------

- At least one non-option must appear on the command line
- There is no maximum number of allowed non-options
- There are 2 possible flags: '-f' and '-w'
- Both have descriptions, both default to false
- There is a possible non-flag option: '-label'
- To provide a label, you must use something like:
	'-label=myfile'

EXAMPLES
--------

Some sample command lines and their resulting values are:

```bash
$ command -w -label='input file' file1.txt
```
```ts
hArgs = {
	f: false
	w: true
	label: 'input file'
	}
lNonOptions = ['file1.txt']
```

<hr>

```bash
$ command -f file1.txt file2.txt
```
```ts
hArgs = {
	f: true
	w: false
	label: '<No label>'
	}
lNonOptions = ['file1.txt', 'file2.txt']
```

<hr>

```bash
$ command -fw file1.txt
```
```ts
hArgs = {
	f: true
	w: true
	label: '<No label>'
	}
lNonOptions = ['file1.txt']
```

<hr>

These command lines will result in an exception being thrown:

```bash
command -fwx temp1.txt       # --- unknown flag 'x'
command -f                   # --- must be >0 non-options
```

DETAILS
-------

There are 3 kinds of items allowed on the command line:

1. flags, e.g.
	`-fnx` - sets flags `f`, 'n' and `x` to true<br>
   flags must be upper or lower case letters

2. an option with a value, e.g.
	`-label=mylabel` - sets option `label` to `'mylabel'`<br>
	if the value contains whitespace, it must be quoted<br>
	if the value looks like a number, it's set to a number<br>

3. anything else is a non-option, e.g.
	c:/temp/temp.txt<br>
	if it includes a space char or starts with `-`,
		it must be quoted

the 1st argument to getCmdArgs() is optional, and is a hash
of information about the expected arguments.

If key `_` is present, it may be a hash possibly including keys:<br>
   'desc' - a text description of what non-options are<br>
   'range' - either an integer specifying the exact number of
             non-options expected, or an array of 2 integers
             specifying the minimum and maximum number of
             non-options expected.<br>
The `_` key may also have a string value, which is simply
a description of the possible non-options

All other keys are names of options allowed<br>
   the associated value must be a hash with possibly these keys:<br>
   type - the type of value expected<br>
   	(defaults to 'boolean' for flags and 'string' for non-flags)<br>
   desc - a text description of the option (used on help screens)

the 2nd argument to getCmdArgs() is an array of string arguments
from the command line (defaults to Deno.args)

the 3rd argument to getCmdArgs() is a hash of possible options:<br>
there is currently only one possible option:<br>
   doSetLogger - defaults to true - if false, then options
                 -P, -D, -Q, -I and -S no longer set logging options
                 and may therefore be used for other purposes

By default, the following flags are recognized, and therefore
cannot be included in hDesc (this behavior can be
disabled by setting hOptions.doSetLogger to false):

`-P` - set the current log level to 'profile'
`-D` - set the current log level to 'debug'
`-Q` - set the current log level to 'warn'
`-I` - set the current log level to 'info'
`-S` - set the current log level to 'silent'
