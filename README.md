# Seval library

The `seval` takes arbitrary untrusted JavaScript code as a text string, and uses
static analysis to determine if it can be securely run or not.

## How does it work?

The `seval` library parses the untrusted JavaScript code using `acorn`, and
finds any uses of unsafe constucts such as function calls and property accesses.
By default, `seval` also forbids the use of `for` and `while` loops, since
these can potentially block the running thread forever.

## What does `seval` stand for?

It either stands for "Safe `eval`", or "Stupid `eval`", depending on if any security holes are found in the library.