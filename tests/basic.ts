import { Sevaluator } from "../src/index";
import assert from "assert/strict";

describe("Sevaluator", function () {
  it("Basic functionality", function () {
    const seval = new Sevaluator("const answer = 41; return answer + 1;");
    assert.equal(seval.run([]), 42);
  });
  it("Use of non-declared identifier fails", function () {
    assert.throws(() => {
      new Sevaluator("const answer = 42; return answer2;");
    });
    assert.throws(() => {
      new Sevaluator("a = 3;");
    });
  });
  it("Variable declarations are correctly block scoped", function () {
    assert.throws(() => {
      new Sevaluator(
        `
        {
            const answer = 42;
        }
        return answer;
        `
      );
    });
    assert.throws(() => {
      new Sevaluator(
        `
        for (let i = 0; i < 100; i++) {}
        return i;
        `
      );
    });
    assert.equal(
      new Sevaluator(
        `
        let answer;
        {
            answer = 42;
        }
        return answer;
        `
      ).run([]),
      42
    );
  });
  it("Empty statements", function () {
    const seval = new Sevaluator(" if (true); { ;; } ; return 1; ");
    assert.equal(seval.run([]), 1);
  });
  it("If statements", function () {
    const seval = new Sevaluator(
      "if (!false) { return 'true' } else { return 'false' } "
    );
    assert.equal(seval.run([]), "true");
  });
  it("`var` declarations are forbidden", function () {
    assert.throws(() => {
      new Sevaluator("var answer = 42;");
    });
  });
  it("Trivial sandbox escapes are forbidden", function () {
    assert.throws(() => {
      new Sevaluator("(1).constructor.constructor('42')");
    });
  });
  it("Loops are forbidden by default", function () {
    assert.throws(() => {
      new Sevaluator("while (true) {}");
    });
    assert.throws(() => {
      new Sevaluator("for (;;) {}");
    });
    assert.equal(
      new Sevaluator(
        "let sum = 0; for (let i = 0; i < 100; i++) { sum += i; }; return sum;",
        { allowLoops: true }
      ).run([]),
      4950
    );
    assert.equal(
      new Sevaluator("for (2;false;) { return 1; }; return 2;", {
        allowLoops: true,
      }).run([]),
      2
    );
    // The following should not throw
    new Sevaluator("while (true) {}", { allowLoops: true });
    new Sevaluator("for (;;) {}", { allowLoops: true });
  });
  it("Non-identifier assignments and declarations are forbidden", function () {
    // Not inherently insecure, but adds complexity to the library
    assert.throws(() => {
      new Sevaluator("let x; [ x ] = [ 2 ];");
    });
    assert.throws(() => {
      new Sevaluator("let [ x ] = [ 2 ];");
    });
  });
  it("Array expressions", function () {
    assert.deepEqual(new Sevaluator("return [1, 'abc', true];").run([]), [
      1,
      "abc",
      true,
    ]);
    // Non-expressions in array expression are forbidden
    assert.throws(() => {
      new Sevaluator("[1, ...[1,2,3]]");
    });
  });
  it("Ternary operator", function () {
    assert.equal(new Sevaluator("return true ? 1 : 2;").run([]), 1);
    assert.equal(new Sevaluator("return false ? 1 : 2;").run([]), 2);
  });
});
