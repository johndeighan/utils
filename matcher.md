Matcher
=======

Chars that must be escaped
--------------------------

( ) [ ] { } < > * + ? : |

Matcher Descriptor
------------------

A **Matcher Descriptor** is a multi-line string
that can be converted into a **Matcher AST**.
The **Matcher AST** can then be used to match
against another multi-line string, returning
another AST.

Here is a **Matcher Descriptor**
(WARNING: recursive!) that describes
the syntax of a **Matcher Descriptor**

NOTE: Inside a regexp **character set**, only
the following characters need to be escaped:

```text
\ ^ - ]
```

Predefined entities:

```text
<desc>   ::= <block>+

<ws>     ::= \s+
<ident>  ::= [A-Za-z_][A-Za-z0-9_]*
<int>    ::= \d+
<label>  ::= <ident> \:
<string> ::= [^()[\]{}<>*+?:|]+
<word>   ::= <string> | <regexp> | <label> | <rulename>
<block>  ::= <word>+
