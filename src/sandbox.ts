export function sandboxed(codeString: string): Function {
  // See https://blog.risingstack.com/writing-a-javascript-framework-sandboxed-code-evaluation/
  return new Function(
    `
    const __seval_sandbox = new Proxy(
      {},
      {
        has: () => true,
        get: (target, property, receiver) => {
          if (property === "arguments") {
            return arguments;
          }
          return undefined;
        },
      }
    );
    with (__seval_sandbox) { ${codeString} }`
  );
}
