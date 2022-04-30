export function sandboxed(codeString: string): Function {
  // See https://blog.risingstack.com/writing-a-javascript-framework-sandboxed-code-evaluation/
  return new Function(
    "__seval_sandbox",
    `with (__seval_sandbox) { ${codeString} }`
  ).bind(
    {},
    new Proxy(
      {},
      {
        has: () => true,
        get: () => undefined,
      }
    )
  );
}
