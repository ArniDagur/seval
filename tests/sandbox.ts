import { sandboxed } from "../src/sandbox";
import assert from "assert/strict";

describe("sandboxed()", function () {
    it("Basic functionality", function () {
        assert.equal(sandboxed("a")(), undefined);
        assert.equal(sandboxed("Math")(), undefined);
    });
});